import utils from '@eventcatalog/sdk';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import chalk from 'chalk';
import path from 'path';
import { buildSchema } from 'graphql';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

import {
  defaultMarkdown as generateMarkdownForMessage,
  getMessageName,
  getSummary as getMessageSummary,
  getOperationsFromSchema,
} from './utils/messages';
import { defaultMarkdown as generateMarkdownForService } from './utils/services';
import { defaultMarkdown as generateMarkdownForDomain } from './utils/domains';
import checkLicense from '../../../shared/checkLicense';
import { join } from 'node:path';

const optionsSchema = z.object({
  licenseKey: z.string().optional(),
  writeFilesToRoot: z.boolean().optional(),
  services: z.array(
    z.object({
      id: z.string({ required_error: 'The service id is required. please provide the service id' }),
      path: z.string({ required_error: 'The service path is required. please provide the path to GraphQL schema file' }),
      summary: z.string().optional(),
      writesTo: z.array(z.object({ id: z.string(), version: z.string().optional() })).optional(),
      readsFrom: z.array(z.object({ id: z.string(), version: z.string().optional() })).optional(),
      version: z.string(),
      draft: z.boolean().optional(),
      name: z.string().optional(),
      owners: z.array(z.string()).optional(),
      generateMarkdown: z
        .function()
        .args(
          z.object({
            service: z.any(),
            schema: z.any(),
          })
        )
        .returns(z.string())
        .optional(),
    })
  ),
  domain: z
    .object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      markdown: z.string().optional(),
      owners: z.array(z.string()).optional(),
    })
    .optional(),
  messages: z
    .object({
      generateMarkdown: z
        .function()
        .args(
          z.object({
            field: z.any(),
            operationType: z.enum(['query', 'mutation', 'subscription']),
            serviceName: z.string(),
            schema: z.any().optional(),
          })
        )
        .returns(z.string())
        .optional(),
    })
    .optional(),
  debug: z.boolean().optional(),
  saveParsedSpecFile: z.boolean().optional(),
});

type Options = z.infer<typeof optionsSchema>;

interface OperationConfig {
  getOperation: (schemaType: any) => any[];
  getLatestInCatalog: (id: string, version: string) => Promise<any>;
  writeOperation: (data: any, options: any) => Promise<void>;
  versionOperation: (id: string) => Promise<void>;
  badge: { content: string; backgroundColor: string; textColor: string };
  sidebarBadge: string;
  addToReceives: boolean;
  logPrefix: string;
  servicePath: string;
  collection: string;
  writeFilesToRoot?: boolean;
}

async function processOperations(
  operations: any[],
  operationType: 'query' | 'mutation' | 'subscription',
  service: any,
  messages: any,
  config: OperationConfig,
  schema: any
): Promise<{ id: string; version: string }[]> {
  const results: { id: string; version: string }[] = [];
  const folder = config.collection;
  const writeFilesToRoot = config.writeFilesToRoot || false;

  for (const { field, operationType: opType } of operations) {
    const id = getMessageName(field);
    const latestInCatalog = await config.getLatestInCatalog(id, 'latest');

    let version = service.version;
    const messageName = getMessageName(field);
    let messageMarkdown = messages?.generateMarkdown
      ? messages.generateMarkdown({ field, operationType: opType, serviceName: service.name || service.id })
      : generateMarkdownForMessage({ field, operationType: opType, serviceName: service.name || service.id, schema });
    let messageBadges = [config.badge];
    let messageAttachments = [] as any;

    console.log(chalk.blue(`Processing message: ${messageName} (v${version})`));

    if (latestInCatalog) {
      messageMarkdown = latestInCatalog.markdown;
      messageBadges = latestInCatalog.badges || [];
      messageAttachments = latestInCatalog.attachments || [];
      if (latestInCatalog.version !== version) {
        await config.versionOperation(id);
        console.log(chalk.cyan(` - Versioned previous ${config.logPrefix}: ${messageName} (v${latestInCatalog.version})`));
      }
    }

    let messagePath = join(config.servicePath, folder, id);

    if (writeFilesToRoot) {
      messagePath = id;
    }

    await config.writeOperation(
      {
        id: messageName,
        name: messageName,
        version: version,
        summary: getMessageSummary({ field, operationType: opType }),
        markdown: messageMarkdown,
        ...(messageBadges.length > 0 ? { badges: messageBadges } : {}),
        ...(messageAttachments.length > 0 ? { attachments: messageAttachments } : {}),
        sidebar: {
          badge: config.sidebarBadge,
        },
      },
      { path: messagePath, override: true }
    );

    console.log(chalk.cyan(` - ${config.sidebarBadge} (v${version}) created`));
    results.push({ id: messageName, version: version });
  }

  return results;
}

export default async (_: any, options: Options) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check if the license is valid
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_GRAPHQL || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  const {
    writeService,
    writeDomain,
    // writeMessage,
    getService,
    getDomain,
    versionService,
    versionDomain,
    addFileToService,
    writeQuery,
    getQuery,
    versionQuery,
    getCommand,
    writeCommand,
    versionCommand,
    getEvent,
    versionEvent,
    writeEvent,
    getResourcePath,
  } = utils(process.env.PROJECT_DIR);

  const validatedOptions = optionsSchema.parse(options);
  const { services, domain, debug, saveParsedSpecFile, messages } = validatedOptions;

  console.log(chalk.green(`\n Processing ${services.length} GraphQL schema(s)...\n`));

  for (const service of services) {
    try {
      console.log(chalk.blue(`Processing service: ${service.name || service.id} (v${service.version})`));

      // Have to ../ as the SDK will put the files into hard coded folders
      // Use getResourcePath to resolve the actual domain location (supports subdomains)
      let servicePath = join('../', 'services', service.id);
      if (options.domain) {
        const domainResource = await getResourcePath(
          process.env.PROJECT_DIR as string,
          options.domain.id,
          options.domain.version
        );
        if (domainResource) {
          servicePath = join('../', domainResource.directory, 'services', service.id);
        } else {
          servicePath = join('../', 'domains', options.domain.id, 'services', service.id);
        }
      }

      if (options.writeFilesToRoot) {
        servicePath = service.id;
      }

      // Load the GraphQL schema
      const schemaContent = await readFile(service.path, 'utf-8');
      const schema = buildSchema(schemaContent);
      let schemaPath = path.basename(service.path as string) || 'schema.graphql';
      let serviceMarkdown = generateMarkdownForService({ service, schema, schemaPath });
      let serviceWritesTo = service.writesTo || ([] as any);
      let serviceReadsFrom = service.readsFrom || ([] as any);
      let serviceBadges = [] as any;
      let serviceAttachments = [] as any;

      let receives = [] as any;
      let sends = [] as any;

      if (debug) {
        console.log(chalk.gray(`Schema loaded successfully for service: ${service.id}`));
      }

      // Check if service exists and handle versioning
      const latestServiceInCatalog = await getService(service.id, 'latest');
      if (latestServiceInCatalog) {
        // persist data between versions
        serviceMarkdown = latestServiceInCatalog.markdown;
        serviceBadges = latestServiceInCatalog.badges || [];
        serviceAttachments = latestServiceInCatalog.attachments || [];
        serviceWritesTo = latestServiceInCatalog.writesTo || ([] as any);
        serviceReadsFrom = latestServiceInCatalog.readsFrom || ([] as any);
        if (latestServiceInCatalog.version !== service.version) {
          await versionService(service.id);
          console.log(
            chalk.cyan(` - Versioned previous service: ${service.name || service.id} (v${latestServiceInCatalog.version})`)
          );
        }
      }

      // Process queries
      const queries = getOperationsFromSchema(schema.getQueryType(), 'query');
      const queryResults = await processOperations(
        queries,
        'query',
        service,
        messages,
        {
          getOperation: (schemaType) => getOperationsFromSchema(schemaType, 'query'),
          getLatestInCatalog: getQuery,
          writeOperation: writeQuery,
          versionOperation: versionQuery,
          badge: { content: 'GraphQL:Query', backgroundColor: 'blue', textColor: 'white' },
          sidebarBadge: 'Query',
          addToReceives: true,
          logPrefix: 'query',
          servicePath,
          collection: 'queries',
          writeFilesToRoot: options.writeFilesToRoot,
        },
        schema
      );
      receives = [...receives, ...queryResults];

      // Process mutations
      const mutations = getOperationsFromSchema(schema.getMutationType(), 'mutation');
      const mutationResults = await processOperations(
        mutations,
        'mutation',
        service,
        messages,
        {
          getOperation: (schemaType) => getOperationsFromSchema(schemaType, 'mutation'),
          getLatestInCatalog: getCommand,
          writeOperation: writeCommand,
          versionOperation: versionCommand,
          badge: { content: 'GraphQL:Mutation', backgroundColor: 'green', textColor: 'white' },
          sidebarBadge: 'Mutation',
          addToReceives: true,
          logPrefix: 'mutation',
          servicePath,
          collection: 'commands',
          writeFilesToRoot: options.writeFilesToRoot,
        },
        schema
      );
      receives = [...receives, ...mutationResults];

      // Process subscriptions
      const subscriptions = getOperationsFromSchema(schema.getSubscriptionType(), 'subscription');
      const subscriptionResults = await processOperations(
        subscriptions,
        'subscription',
        service,
        messages,
        {
          getOperation: (schemaType) => getOperationsFromSchema(schemaType, 'subscription'),
          getLatestInCatalog: getEvent,
          writeOperation: writeEvent,
          versionOperation: versionEvent,
          badge: { content: 'GraphQL:Subscription', backgroundColor: 'purple', textColor: 'white' },
          sidebarBadge: 'Subscription',
          addToReceives: false,
          logPrefix: 'subscription',
          servicePath,
          collection: 'events',
          writeFilesToRoot: options.writeFilesToRoot,
        },
        schema
      );
      sends = [...sends, ...subscriptionResults];

      await writeService(
        {
          id: service.id,
          name: service.name || service.id,
          version: service.version || '1.0.0',
          summary: service.summary || '',
          markdown: serviceMarkdown,
          ...(serviceBadges.length > 0 ? { badges: serviceBadges } : {}),
          ...(serviceAttachments.length > 0 ? { attachments: serviceAttachments } : {}),
          ...(service.draft && { draft: service.draft }),
          ...(service.owners && { owners: service.owners }),
          ...(receives.length > 0 ? { receives } : {}),
          ...(sends.length > 0 ? { sends } : {}),
          ...(serviceWritesTo.length > 0 ? { writesTo: serviceWritesTo } : {}),
          ...(serviceReadsFrom.length > 0 ? { readsFrom: serviceReadsFrom } : {}),
          schemaPath,
          specifications: [
            {
              path: schemaPath,
              type: 'graphql',
              name: (service.name || service.id) + 'GraphQL API',
            },
          ],
        },
        { path: join(servicePath), override: true }
      );

      // Add the file to the service
      await addFileToService(service.id, { fileName: schemaPath, content: schemaContent });

      console.log(chalk.cyan(` - Service (v${service.version}) created`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to process service: ${service.name || service.id} (v${service.version})`));
      console.error(chalk.red(error));
      throw error;
    }
  }

  // Handle domain if specified
  if (domain) {
    const latestDomainInCatalog = await getDomain(domain.id, 'latest');
    let domainMarkdown = generateMarkdownForDomain({ domain });
    let domainOwners = domain.owners || [];
    let domainBadges = [] as any;
    let domainAttachments = [] as any;

    console.log(chalk.blue(`\nProcessing domain: ${domain.name} (v${domain.version})`));

    if (latestDomainInCatalog) {
      domainMarkdown = latestDomainInCatalog.markdown;
      domainOwners = latestDomainInCatalog.owners || [];
      domainBadges = latestDomainInCatalog.badges || [];
      domainAttachments = latestDomainInCatalog.attachments || [];

      if (latestDomainInCatalog.version !== domain.version) {
        await versionDomain(domain.id);
        console.log(chalk.cyan(` - Versioned previous domain: ${domain.name} (v${latestDomainInCatalog.version})`));
      }
    }

    const domainServices = services.map((service) => ({ id: service.id, version: service.version }));

    await writeDomain(
      {
        id: domain.id,
        name: domain.name,
        version: domain.version,
        markdown: domainMarkdown,
        services: domainServices,
        ...(domainOwners.length > 0 ? { owners: domainOwners } : {}),
        ...(domainBadges.length > 0 ? { badges: domainBadges } : {}),
        ...(domainAttachments.length > 0 ? { attachments: domainAttachments } : {}),
      },
      { override: true }
    );

    console.log(chalk.cyan(` - Domain (v${domain.version}) created`));
  }

  console.log(chalk.blue('\n🎉 GraphQL schema processing complete!\n'));
};
