import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import fsExtra from 'fs-extra';
import checkLicense from '../../../shared/checkLicense';
import fm from 'front-matter';
import os from 'node:os';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

// The event.catalog.js values for your plugin
type EventCatalogConfig = any;

// Configuration for copying files
type CopyProps = {
  content: string | string[];
  destination: string;
};

// Configuration the users give your catalog
type GeneratorProps = {
  licenseKey?: string;
  source: string;
  branch?: string;
  copy?: CopyProps[];
  debug?: boolean;
  override?: boolean;
  destination?: string;
  enforceUniqueResources?: boolean;
  sourceRootDir?: string;
};

const resources = ['services', 'events', 'domains', 'commands', 'queries', 'flows', 'teams', 'users'];
const tmpDir = path.join(os.tmpdir(), 'eventcatalog');

const getFrontmatter = async (filename: string) => {
  const frontmatter = (await fs.readFile(filename, 'utf8').then((file) => fm(file))) as any;
  return frontmatter.attributes;
};

async function checkForExistingPaths(contents: string | string[], destination: string, enforceUniqueResources: boolean) {
  // @ts-ignore
  const { getService, getEvent, getDomain, getCommand, getQuery, getFlow } = utils(process.env.PROJECT_DIR);

  const resourceFunctions = {
    services: getService,
    events: getEvent,
    domains: getDomain,
    commands: getCommand,
    queries: getQuery,
    flows: getFlow,
  };

  const paths = Array.isArray(contents) ? contents : [contents];

  for (const content of paths) {
    const sourcePath = join(tmpDir, content);

    // Get all files and directories recursively from source
    const items = await fsExtra.readdir(sourcePath, { withFileTypes: true });

    for (const item of items) {
      // If enforceUniqueResources, then check if the resource is already in the catalog
      // depending on the catalog size this could take a while
      if ((item.name.endsWith('.md') || item.name.endsWith('.mdx')) && enforceUniqueResources) {
        const { id } = await getFrontmatter(join(sourcePath, item.name));

        if (!id) {
          continue;
        }

        const resource = resources.find((resource) => item.parentPath.includes(resource));

        console.log(chalk.yellow(`Checking if ${resource} with id ${id} exists in the catalog...`));

        if (id && resource) {
          // Type assertion to handle indexing
          const resourceFunction = resourceFunctions[resource as keyof typeof resourceFunctions];
          const resourceExists = await resourceFunction(id);

          // Found the resource in the catalog.
          if (resourceExists) {
            console.log(chalk.red(`Warning: EventCatalog already has a ${resource} with id ${id}.`));
            throw new Error(`EventCatalog already has ${resource} with the id ${id}.`);
          }
        }
      }

      const destPath = join(destination, item.name);

      if (await fsExtra.pathExists(destPath)) {
        console.warn(
          chalk.red(`Warning: EventCatalog already has resources at ${destPath}. Use 'override: true' to force copy.`)
        );
        throw new Error(`Path already exists at ${destPath}. Use 'override: true' to force copy.`);
      }

      // If it's a directory, recursively check its contents
      if (item.isDirectory()) {
        await checkForExistingPaths(join(content, item.name), join(destination, item.name), enforceUniqueResources);
      }
    }
  }
}

export default async (_: EventCatalogConfig, options: GeneratorProps) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_FEDERATION || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  // Remove the tmpDir if it exists
  if (fsExtra.existsSync(tmpDir)) {
    await fsExtra.remove(tmpDir);
    await fsExtra.mkdir(tmpDir, { recursive: true });
  }

  console.log(chalk.green(`Cloning ${options.source}...`));

  // Clone the repo without checking out the files
  await execSync(`git clone --no-checkout ${options.source} ${tmpDir}`);

  // Sparse checkout the content
  await execSync(`git sparse-checkout init`, { cwd: tmpDir });

  let contentsToCopy = options.copy || resources.map((resource) => ({ content: resource, destination: resource }));

  // If a `sourceRootDir` is provided then it will be used as the root directory to copy files from
  if (options.sourceRootDir) {
    contentsToCopy = contentsToCopy.map((content) => {
      const contentPath = Array.isArray(content.content)
        ? content.content.map((c) => join(options.sourceRootDir as string, c))
        : join(options.sourceRootDir as string, content.content);
      return { content: contentPath, destination: content.destination };
    });
  }

  const isRootCopyConfiguration = !options.copy;

  // Collect all content paths for sparse checkout
  let allContentPaths = contentsToCopy.flatMap(({ content }) => (Array.isArray(content) ? content : [content]));

  // Convert Windows backslashes to forward slashes for git commands
  const gitPaths = allContentPaths.map((p) => p.replace(/\\/g, '/'));

  await execSync(`git sparse-checkout set ${gitPaths.join(' ')} --no-cone`, { cwd: tmpDir });

  // Checkout the branch
  await execSync(`git checkout ${options.branch || 'main'}`, { cwd: tmpDir });

  // No copy values have been provides, lets try and copy all EventCatalog Resources, first we have to check if they exist in the project
  if (isRootCopyConfiguration) {
    const existingPaths = await Promise.all(
      allContentPaths.map(async (content) => {
        const exists = await fsExtra.pathExists(join(tmpDir, content));
        return exists ? content : null;
      })
    );
    const validPaths = existingPaths.filter((path): path is string => path !== null);

    contentsToCopy = validPaths.map((value) => ({
      content: value,
      destination: join(
        options.destination || process.cwd(),
        options.sourceRootDir ? path.normalize(path.relative(path.normalize(options.sourceRootDir), value)) : value
      ),
    }));
  }

  // Check for existing paths first and copy for each configuration
  for (const copyConfig of contentsToCopy) {
    if (!options.override) {
      try {
        await checkForExistingPaths(copyConfig.content, copyConfig.destination, options.enforceUniqueResources || false);
      } catch (error) {
        throw error;
      }
    }

    // Copy files for each configuration
    if (Array.isArray(copyConfig.content)) {
      for (const content of copyConfig.content) {
        await fsExtra.copy(join(tmpDir, content), copyConfig.destination);
      }
    } else {
      await fsExtra.copy(join(tmpDir, copyConfig.content), copyConfig.destination);
    }

    console.log(chalk.cyan(` - Files successfully copied to ${copyConfig.destination}`));
  }

  // Remove the tmpDir
  await fs.rm(tmpDir, { recursive: true });
};
