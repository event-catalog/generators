import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { Document } from 'langchain/document';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import pkgJSON from '../package.json';
import { MarkdownTextSplitter } from 'langchain/text_splitter';

import { HuggingFaceEmbedder, OpenAIEmbedder, type Embedder } from './embedders';

// The event.catalog.js values for your plugin
type EventCatalogConfig = any;

// Configuration the users give your catalog
type GeneratorProps = {
  debug?: boolean;
  licenseKey?: string;
  splitMarkdownFiles?: boolean;
  includeUsersAndTeams?: boolean;
  includeCustomDocumentationPages?: boolean;
  includeSchemas?: boolean;
  embedding?: {
    provider: 'openai' | 'huggingface';
    model?: string;
  };
  // Deprecated
  embedingModel?: string;
};

export default async (_: EventCatalogConfig, options: GeneratorProps) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  console.log(chalk.cyan(`@eventcatalog/generator-ai processing your catalog...`));

  // users and teams can bloat the embeddings and may not provide much value, let the user decide if they want to include them
  const includeUsersAndTeams = options.includeUsersAndTeams ?? false;
  const includeCustomDocumentationPages = options.includeCustomDocumentationPages ?? true;
  const includeSchemas = options.includeSchemas ?? true;
  const debug = options.debug ?? false;

  // Check for license and package update
  // const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_FEDERATION || options.licenseKey || '';
  // await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  const { getEvents, getUsers, getServices, getDomains, getCommands, getQueries, getTeams, getCustomDocs } = utils(
    process.env.PROJECT_DIR
  );

  const [events = [], users = [], services = [], domains = [], commands = [], queries = [], teams = [], customDocs = []] =
    await Promise.all([
      getEvents({
        attachSchema: includeSchemas,
      }),
      includeUsersAndTeams ? getUsers() : [],
      getServices(),
      getDomains(),
      getCommands({
        attachSchema: includeSchemas,
      }),
      getQueries({
        attachSchema: includeSchemas,
      }),
      includeUsersAndTeams ? getTeams() : [],
      includeCustomDocumentationPages ? getCustomDocs() : [],
    ]);

  const resourceTypes = [
    { items: events, type: 'event' },
    { items: users, type: 'user' },
    { items: services, type: 'service' },
    { items: domains, type: 'domain' },
    { items: commands, type: 'command' },
    { items: queries, type: 'query' },
    { items: teams, type: 'team' },
    { items: customDocs, type: 'custom-documentation-page' },
  ];

  if (debug) {
    console.log('Events:', events.length);
    console.log('Users:', users.length);
    console.log('Services:', services.length);
    console.log('Domains:', domains.length);
    console.log('Commands:', commands.length);
    console.log('Queries:', queries.length);
    console.log('Teams:', teams.length);
    console.log('Custom Documentation Pages:', customDocs.length);
  }

  const resources = resourceTypes.flatMap(({ items, type }) => items.map((item) => ({ ...item, type })));

  let documents: Document[] = [];

  // Split documents using chunks from markdown files
  if (options.splitMarkdownFiles) {
    console.log(chalk.cyan(`  - Splitting markdown documents...`));
    const markdownSplitter = new MarkdownTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    // console.log('resources', resources)
    // Process each event and create documents with split content
    // @ts-ignore
    documents = await Promise.all(
      resources.map(async (resource) => {
        const splitDocs = await markdownSplitter.createDocuments(
          [resource.markdown],
          [
            {
              ...resource,
              markdown: undefined,
              loc: undefined,
            },
          ]
        );
        return splitDocs;
      })
    );
  } else {
    // Don't split the markdown documents
    documents = resources.map(
      (resource) =>
        new Document({
          pageContent: resource.markdown,
          metadata: {
            ...resource,
            markdown: undefined,
            loc: undefined,
          },
        })
    );
  }

  const flattenedDocuments = documents.flat();

  let embedder: Embedder;

  if (options.embedding?.provider === 'openai') {
    embedder = new OpenAIEmbedder(options.embedding?.model);
  } else {
    embedder = new HuggingFaceEmbedder(options.embedding?.model);
  }

  const embeddings = await embedder.generateEmbeddings(flattenedDocuments.map((d) => d.pageContent));

  // ensure the ai directory exists in the users catalog
  await fs.ensureDir(path.join(process.env.PROJECT_DIR, 'public/ai'));

  // Write the file to embeddings.json
  // remove the old file if it exists
  if (fs.existsSync(path.join(process.env.PROJECT_DIR, 'public/ai/documents.json'))) {
    await fs.unlink(path.join(process.env.PROJECT_DIR, 'public/ai/documents.json'));
  }

  await fs.writeJSON(path.join(process.env.PROJECT_DIR, 'public/ai/documents.json'), flattenedDocuments);

  // Write the file to embeddings.json
  // remove the old file if it exists
  if (fs.existsSync(path.join(process.env.PROJECT_DIR, 'public/ai/embeddings.json'))) {
    await fs.unlink(path.join(process.env.PROJECT_DIR, 'public/ai/embeddings.json'));
  }
  await fs.writeJSON(path.join(process.env.PROJECT_DIR, 'public/ai/embeddings.json'), embeddings);

  // Add README.md to generated-ai folder
  const readmePath = path.join(process.env.PROJECT_DIR, 'public/ai/README.md');
  const readmeContent = `# Generated AI Content

This directory contains auto-generated files used by the @eventcatalog/ai plugin. These files are automatically created and updated when running the AI generator plugin

## Files

- \`documents.json\`: Contains the processed documents and their metadata
- \`embeddings.json\`: Contains vector embeddings for the documents

> **Note:** This directory is automatically added to .gitignore as these files should not be committed to version control.
`;

  await fs.writeFile(readmePath, readmeContent);

  // Add ai folder to .gitignore if not already present
  const gitignorePath = path.join(process.env.PROJECT_DIR, '.gitignore');
  let gitignoreContent = '';

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
  }

  if (!gitignoreContent.includes('public/ai/')) {
    const aiEntry = gitignoreContent.endsWith('\n') ? 'public/ai/' : '\npublic/ai/';
    await fs.appendFile(gitignorePath, aiEntry);
    console.log(chalk.green(`Added public/ai/ directory to .gitignore`));
  }

  console.log(chalk.green(`  - Generated embeddings and documents. Saved to public/ai/`));
};
