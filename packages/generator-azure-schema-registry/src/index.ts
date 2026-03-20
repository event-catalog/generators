import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import checkLicense from '../../../shared/checkLicense';
import { filterSchemas } from './utils/filters';
import pkgJSON from '../package.json';
import path, { join } from 'path';
import { EventCatalogConfig, GeneratorProps, Schema, Filter } from './types';
import { getSchemasForServices } from './lib/azure';
import { writeMessageToEventCatalog } from './utils/messages';
import { getMarkdownForService, getMarkdownForDomain } from './utils/markdown';

/////////////////////////////////////////////////

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  const SCHEMA_REGISTRY_URL = options.schemaRegistryUrl;

  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!SCHEMA_REGISTRY_URL) {
    throw new Error('Please provide a url for the Azure Schema Registry');
  }

  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;

  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  const { writeService, getService, versionService, getDomain, versionDomain, writeDomain, addServiceToDomain, getResourcePath } =
    utils(eventCatalogDirectory);

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_AZURE_SCHEMA_REGISTRY || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  console.log(chalk.green(`Fetching schemas from Azure Schema Registry: ${SCHEMA_REGISTRY_URL}...`));

  // Document all the services
  const services = options.services || [];

  if (services.length === 0) {
    throw new Error(
      'Azure Schema Registry does not provide an API to list all schemas. ' +
        'Please provide a list of services with their schema mappings in the configuration.'
    );
  }

  // Collect all schema filters from services
  const allFilters = services.flatMap((service) => [...(service.sends || []), ...(service.receives || [])]);

  // Create a map from schemaGroup:schemaName to filter for custom name and URL lookup
  const filterMap = new Map<string, Filter>();
  for (const filter of allFilters) {
    const key = `${filter.schemaGroup}:${filter.id}`;
    filterMap.set(key, filter);
  }

  // Fetch all schemas (fetches latest 5 versions of each schema)
  const allSchemas = await getSchemasForServices(SCHEMA_REGISTRY_URL, allFilters);

  console.log(chalk.green(`Found ${allSchemas.length} schema${allSchemas.length === 1 ? '' : 's'} in Azure Schema Registry`));

  // Group schemas by schema group and name (for versioning)
  const groupedSchemas = allSchemas.reduce((acc: Record<string, Schema[]>, azureSchema) => {
    const key = `${azureSchema.groupName}:${azureSchema.name}`;
    const filter = filterMap.get(key);

    const schema: Schema = {
      schemaGroup: azureSchema.groupName,
      schemaName: azureSchema.name,
      version: azureSchema.version,
      id: azureSchema.id,
      schemaType: azureSchema.schemaType,
      schema: azureSchema.content,
      latestVersion: azureSchema.latestVersion || false,
      customName: filter?.name,
      schemaRegistryUrl: filter?.schemaRegistryUrl,
    };

    acc[key] = [...(acc[key] || []), schema];
    return acc;
  }, {});

  // Create/manage domain if one is configured
  if (options.domain) {
    const { id: domainId, name: domainName, version: domainVersion } = options.domain;
    const domain = await getDomain(options.domain.id, domainVersion || 'latest');
    const currentDomain = await getDomain(options.domain.id, 'latest');

    console.log(chalk.blue(`\nProcessing domain: ${domainName} (v${domainVersion})`));

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
      console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));
    }

    //  Add all the services to the domain
    for (const service of services) {
      await addServiceToDomain(domainId, { id: service.id, version: service.version }, domainVersion);
    }
  }

  // Track which message versions have been processed globally
  const processedMessages = new Set<string>();

  // Process services
  for (const service of services) {
    // Try and find the given messages to match against the service
    const allSends = filterSchemas(groupedSchemas, service.sends || []).filter((message) => message !== undefined);
    const allReceives = filterSchemas(groupedSchemas, service.receives || []).filter((message) => message !== undefined);

    // Only include latest versions in service references
    const latestSends = allSends.filter((msg) => msg.latestVersion);
    const latestReceives = allReceives.filter((msg) => msg.latestVersion);

    const serviceInCatalog = await getService(service.id);
    const { sends: previousSends, receives: previousReceives, ...previousServiceInformation } = serviceInCatalog || {};

    if (serviceInCatalog && serviceInCatalog.version !== service.version) {
      // If the versions match, remove it as we are going to update/rewrite it with persisted information
      await versionService(service.id);
      console.log(chalk.cyan(` - Versioned previous service: (v${serviceInCatalog.version})`));
    }

    // Path to service
    const pathToService = join('../', 'services', service.id);
    const serviceToWrite = {
      // Persist if we have previous information
      ...previousServiceInformation,

      // Regardless if we have previous information or not, we add this information always
      id: service.id,
      name: service.name || service.id,
      version: service.version,
      ...(latestSends.length > 0
        ? { sends: latestSends.map((msg) => ({ id: msg.schemaName, version: msg.version.toString() })) }
        : {}),
      ...(latestReceives.length > 0
        ? { receives: latestReceives.map((msg) => ({ id: msg.schemaName, version: msg.version.toString() })) }
        : {}),

      ...(service.writesTo && { writesTo: service.writesTo }),
      ...(service.readsFrom && { readsFrom: service.readsFrom }),

      // If the service does not already exist we need to add fields for new documented services
      ...(!serviceInCatalog
        ? {
            markdown: getMarkdownForService({ schemaRegistryUrl: SCHEMA_REGISTRY_URL }),
            summary: service.summary || `${service.id} Service`,
          }
        : {}),
    };

    // Use getResourcePath to resolve the actual domain location (supports subdomains)
    let servicePath = pathToService;
    if (options.domain) {
      const domainResource = await getResourcePath(eventCatalogDirectory, options.domain.id, options.domain.version);
      if (domainResource) {
        servicePath = path.join('../', domainResource.directory, 'services', service.id);
      } else {
        servicePath = path.join('../', 'domains', options.domain.id, 'services', service.id);
      }
    }

    await writeService(serviceToWrite, { path: servicePath, override: serviceInCatalog?.version === service.version });

    // Process all versions of messages (both sends and receives)
    // Sort by version (oldest to newest) - SDK will automatically version older ones
    const allMessages = [...allSends, ...allReceives].sort((a, b) => a.version - b.version);

    for (const message of allMessages) {
      // Create a unique key for this message version
      const messageKey = `${message.schemaName}:${message.version}`;

      // Skip if we've already processed this message version globally
      if (processedMessages.has(messageKey)) {
        console.log(chalk.gray(`  - Skipping ${message.schemaName} (v${message.version}) - already processed`));
        continue;
      }

      await writeMessageToEventCatalog({
        pathToCatalog: eventCatalogDirectory,
        message,
        rootPath: pathToService,
        serviceId: service.id,
        messageType: message.messageType || 'event',
      });

      // Mark this message version as processed
      processedMessages.add(messageKey);

      console.log(chalk.blue(`  - Processed ${message.schemaName} (v${message.version}), added schema to event catalog`));
    }

    console.log(chalk.blue(`  - Processed ${service.id} (v${service.version}), added service to event catalog`));
  }

  console.log(chalk.green(`\nFinished generating event catalog with Azure Schema Registry ${SCHEMA_REGISTRY_URL}`));
};
