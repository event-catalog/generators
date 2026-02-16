import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import checkLicense from '../../../shared/checkLicense';
import { filterSchemas } from './utils/filters';
import pkgJSON from '../package.json';
import path, { join } from 'path';
import { EventCatalogConfig, GeneratorProps, Schema } from './types';
import { getSchemasFromRegistry, getLatestVersionFromSubject } from './lib/confluent';
import { writeMessageToEventCatalog } from './utils/topics';
import { getMarkdownForService, getMarkdownForDomain } from './utils/markdown';

/////////////////////////////////////////////////

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  const SCHEMA_REGISTRY_URL = options.schemaRegistryUrl;
  const INCLUDE_ALL_VERSIONS = options.includeAllVersions;

  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!SCHEMA_REGISTRY_URL) {
    throw new Error('Please provide a url for the Confluent Schema Registry');
  }

  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;

  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  const {
    writeService,
    getService,
    versionService,
    getDomain,
    versionDomain,
    writeDomain,
    addServiceToDomain,
    writeChannel,
    getChannel,
  } = utils(eventCatalogDirectory);

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_CONFLUENT_SCHEMA_REGISTRY || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  console.log(chalk.green(`Fetching schemas from registry: ${SCHEMA_REGISTRY_URL}...`));
  const schemas = await getSchemasFromRegistry(SCHEMA_REGISTRY_URL, {
    username: process.env.CONFLUENT_SCHEMA_REGISTRY_KEY || '',
    password: process.env.CONFLUENT_SCHEMA_REGISTRY_SECRET || '',
  });

  console.log(chalk.green(`Found ${schemas.length} schemas in Confluent Schema Registry`));

  // group them by subject
  const groupedSchemas = schemas.reduce((acc: Record<string, Schema[]>, schema: Schema) => {
    acc[schema.subject] = [...(acc[schema.subject] || []), { ...schema, eventId: schema.subject.replace('-value', '') }];
    return acc;
  }, {});

  console.log(chalk.green(`Fetching latest version for each topic...`));
  // Get the latest version for each subject (schema), and hydrate the latestVersion property
  for (const subject in groupedSchemas) {
    const latestVersion = await getLatestVersionFromSubject(options.schemaRegistryUrl, subject, {
      username: process.env.CONFLUENT_SCHEMA_REGISTRY_KEY || '',
      password: process.env.CONFLUENT_SCHEMA_REGISTRY_SECRET || '',
    });
    // Find the schema in the array that has the same id as the latestVersion.id
    const schema = groupedSchemas[subject].find((s: Schema) => s.version === latestVersion.version);
    if (schema) {
      schema.latestVersion = true;
    }
  }

  const allMessagesInSchemaRegistry = Object.keys(groupedSchemas);

  // Document all the services
  const services = options.services || [];
  const documentMessagesWithService = services.length > 0;

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

  if (options.topics) {
    for (const topic of options.topics) {
      const { id: topicId, name: topicName, address: topicAddress } = topic;

      const channel = await getChannel(topicId);
      const { ...previousChannelInformation } = channel || {};
      const hasPreviousChannelInformation = Object.keys(previousChannelInformation).length > 0;

      await writeChannel(
        {
          // Write any previous information if we have it
          ...previousChannelInformation,

          id: topicId,
          name: topicName,
          address: topicAddress,
          ...(!hasPreviousChannelInformation
            ? {
                protocols: ['kafka'],
                version: '0.0.1',
                summary: 'Kafka Topic',
                sidebar: {
                  badge: 'Topic',
                },
                badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Kafka Topic', icon: 'kafka' }],
                markdown: '<ChannelInformation />',
              }
            : {}),
        },
        { override: true }
      );

      console.log(chalk.cyan(` - Topic (EventCatalog Channel) (${topicName}) created`));
    }
  }

  if (documentMessagesWithService) {
    for (const service of services) {
      // Try and find the given messages to match against the service
      const sends = filterSchemas(groupedSchemas, service.sends || []).filter((message) => message !== undefined);
      const receives = filterSchemas(groupedSchemas, service.receives || []).filter((message) => message !== undefined);

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
        ...(sends.length > 0 ? { sends: sends.map((topic) => ({ id: topic.eventId, version: topic.version.toString() })) } : {}),
        ...(receives.length > 0
          ? { receives: receives.map((topic) => ({ id: topic.eventId, version: topic.version.toString() })) }
          : {}),

        ...(service.writesTo && { writesTo: service.writesTo }),
        ...(service.readsFrom && { readsFrom: service.readsFrom }),

        // If the service does not already exist we need to add fields for new documented topics
        ...(!serviceInCatalog
          ? {
              markdown: getMarkdownForService({ schemaRegistryUrl: SCHEMA_REGISTRY_URL }),
              summary: service.summary || `${service.id} Service`,
            }
          : {}),
      };

      let servicePath = options.domain ? path.join('../', 'domains', options.domain.id, 'services', service.id) : pathToService;

      await writeService(serviceToWrite, { path: servicePath, override: serviceInCatalog?.version === service.version });

      const messages = [...sends, ...receives];

      for (const message of messages) {
        await writeMessageToEventCatalog({
          pathToCatalog: eventCatalogDirectory,
          message,
          rootPath: pathToService,
          serviceId: service.id,
          messageType: message.messageType || 'event',
        });
        console.log(chalk.blue(`  - Processed ${message.eventId} (v${message.version}), added schema to event catalog`));
      }

      console.log(chalk.blue(`  - Processed ${service.id} (v${service.version}), added service to event catalog`));
    }
  } else {
    // Just document all the topics
    for (const subject of allMessagesInSchemaRegistry) {
      const messages = groupedSchemas[subject];

      const messagesToWriteToEventCatalog = messages.filter((v: Schema) => (INCLUDE_ALL_VERSIONS ? true : v.latestVersion));
      for (const message of messagesToWriteToEventCatalog) {
        await writeMessageToEventCatalog({
          pathToCatalog: eventCatalogDirectory,
          message,
          rootPath: '../',
          messageType: 'event',
        });
        console.log(chalk.blue(`  - Processed ${message.eventId} (v${message.version}), added schema to event catalog`));
      }
    }
  }

  console.log(chalk.green(`\nFinished generating event catalog with Confluent Schema Registry ${SCHEMA_REGISTRY_URL}`));
};
