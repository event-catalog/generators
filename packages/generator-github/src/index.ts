import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import fsExtra from 'fs-extra';
import checkLicense from '../../../shared/checkLicense';
import os from 'node:os';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import { cloneRepo } from './utils/git';
import { EventCatalogConfig, GeneratorProps } from './types';
import { processMessageAndSchema } from './utils/messages';
import { getMarkdownForDomain, getMarkdownForService } from './utils/markdown';

const tmpDir = path.join(os.tmpdir(), 'eventcatalog-generator-github');

export default async (_: EventCatalogConfig, options: GeneratorProps) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;

  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  const { getService, versionService, writeService, getDomain, versionDomain, writeDomain, addServiceToDomain } =
    utils(eventCatalogDirectory);

  if (!options.source) {
    throw new Error('Please provide a repository to clone');
  }

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_GITHUB || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  // Remove the tmpDir if it exists
  if (fsExtra.existsSync(tmpDir)) {
    await fsExtra.remove(tmpDir);
    await fsExtra.mkdir(tmpDir, { recursive: true });
  }

  // Get GitHub token from options or environment variable
  const GITHUB_TOKEN = options.token || process.env.EVENTCATALOG_GITHUB_TOKEN;

  // If its already cloned dont clone it again
  if (fsExtra.existsSync(join(tmpDir, options.path || ''))) {
    console.log(chalk.green(`${options.source} already cloned..., skipping clone`));
  } else {
    console.log(chalk.green(`Cloning ${options.source}...`));
    await cloneRepo(options.source, tmpDir, options.branch || 'main', options.path, GITHUB_TOKEN);
  }

  // Process the messages
  if (options.messages) {
    console.log(chalk.cyan(`\nProcessing messages...`));
    for (const message of options.messages) {
      await processMessageAndSchema({
        pathToCatalog: eventCatalogDirectory,
        directory: join(tmpDir, options.path || ''),
        message,
      });
    }
  }

  // Create/manage domain if one is configured
  if (options.domain) {
    console.log(chalk.cyan(`\nProcessing domain: ${options.domain.name} (v${options.domain.version})`));

    const { id: domainId, name: domainName, version: domainVersion } = options.domain;
    const domain = await getDomain(options.domain.id, domainVersion || 'latest');
    const currentDomain = await getDomain(options.domain.id, 'latest');

    console.log(chalk.cyan(`\nProcessing domain: ${domainName} (v${domainVersion})`));

    // Found a domain, but the versions do not match
    if (currentDomain && currentDomain.version !== domainVersion) {
      await versionDomain(domainId);
      console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
    }

    // Do we need to create a new domain?
    if (!domain || (domain && domain.version !== domainVersion)) {
      await writeDomain({
        id: domainId,
        name: domainName,
        version: domainVersion,
        markdown: getMarkdownForDomain(),
      });
      console.log(chalk.green(` - Domain ${domainName} (v${domainVersion}) created`));
    }

    //  Add all the services to the domain
    for (const service of options.services || []) {
      await addServiceToDomain(domainId, { id: service.id, version: service.version }, domainVersion);
    }
  }

  if (options.services) {
    for (const service of options.services) {
      console.log(chalk.cyan(`Processing service: ${service.id} (v${service.version})`));
      const sends = (service.sends || []).map((send) => ({ id: send.id, ...(send.version ? { version: send.version } : {}) }));
      const receives = (service.receives || []).map((receive) => ({
        id: receive.id,
        ...(receive.version ? { version: receive.version } : {}),
      }));

      const serviceInCatalog = await getService(service.id);
      const { sends: previousSends, receives: previousReceives, ...previousServiceInformation } = serviceInCatalog || {};

      if (serviceInCatalog && serviceInCatalog.version !== service.version) {
        // If the versions match, remove it as we are going to update/rewrite it with persisted information
        await versionService(service.id);
        console.log(chalk.cyan(` - Versioned previous service: (v${serviceInCatalog.version})`));
      }

      const pathToService = join('../', 'services', service.id);

      const serviceToWrite = {
        // Persist if we have previous information
        ...previousServiceInformation,

        // Regardless if we have previous information or not, we add this information always
        id: service.id,
        name: service.name || service.id,
        version: service.version,
        ...(sends.length > 0 ? { sends } : {}),
        ...(receives.length > 0 ? { receives } : {}),

        // If the service does not already exist we need to add fields for new documented topics
        ...(!serviceInCatalog
          ? {
              markdown: getMarkdownForService(),
              summary: `${service.id} Service`,
            }
          : {}),
      };

      let servicePath = options.domain ? path.join('../', 'domains', options.domain.id, 'services', service.id) : pathToService;
      // @ts-ignore
      await writeService(serviceToWrite, { path: servicePath, override: serviceInCatalog?.version === service.version });

      console.log(chalk.green(` - Service ${service.id} (v${service.version}) created`));

      const messages = [...(service.sends || []), ...(service.receives || [])];
      for (const message of messages) {
        await processMessageAndSchema({
          pathToCatalog: eventCatalogDirectory,
          directory: join(tmpDir, options.path || ''),
          message,
          service: { id: service.id, version: service.version },
        });
      }
    }
  }

  console.log(chalk.green(`\nFinished processing ${options.source} to EventCatalog`));

  // // Remove the tmpDir
  await fs.rm(tmpDir, { recursive: true });
};
