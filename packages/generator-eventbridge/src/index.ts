import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import {
  SchemasClient,
  DescribeSchemaCommand,
  ListSchemasCommand,
  ExportSchemaCommand,
  DescribeSchemaCommandOutput,
  SchemaSummary,
} from '@aws-sdk/client-schemas';
import { EventCatalogConfig, Event, GeneratorProps, EventMap } from './types';
import { filterEvents } from './utils/filters';
import checkLicense from '../../../shared/checkLicense';

import { defaultMarkdown as generateMarkdownForService } from './utils/services';
import { defaultMarkdown as generateMarkdownForDomain } from './utils/domains';
import { defaultMarkdown as generateMarkdownForMessage, getBadgesForMessage } from './utils/messages';
import { generatedMarkdownByEventBus } from './utils/channel';
import { parse } from '@aws-sdk/util-arn-parser';
import { DescribeEventBusCommand, EventBridgeClient } from '@aws-sdk/client-eventbridge';
import path, { join } from 'node:path';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

async function tryFetchJSONSchema(
  schemasClient: SchemasClient,
  registryName: string,
  schemaName: string
): Promise<string | null> {
  try {
    const exportSchemaCommand = new ExportSchemaCommand({
      RegistryName: registryName,
      SchemaName: schemaName,
      Type: 'JSONSchemaDraft4',
    });
    const exportResponse = await schemasClient.send(exportSchemaCommand);
    return exportResponse.Content || null;
  } catch (error) {
    // Can't get the schema, just return null
    // Custom schema regs will either be JSON or OpenAPI we try both...
    // console.error(`Error getting JSON Schema for ${schemaName}:`, error);
    return null;
  }
}

async function tryFetchOpenAPISchema(
  schemasClient: SchemasClient,
  registryName: string,
  schemaName: string
): Promise<DescribeSchemaCommandOutput | null> {
  try {
    const describeSchemaCommand = new DescribeSchemaCommand({
      RegistryName: registryName,
      SchemaName: schemaName,
    });
    const schemaDetails = await schemasClient.send(describeSchemaCommand);
    return schemaDetails || null;
  } catch (error) {
    // Can't get the schema, just return null
    // Custom schema regs will either be JSON or OpenAPI we try both...
    // console.error(`Error getting OpenAPI Schema for ${schemaName}:`, error);
    return null;
  }
}

const fetchSchemasForRegistry =
  (schemasClient: SchemasClient) =>
  async (registryName: string, mapEventsBy: EventMap): Promise<Event[]> => {
    // Get all schemas from discovered-schemas
    const schemas = [] as Event[];
    let allSchemas: SchemaSummary[] = [];
    let nextToken: string | undefined;

    do {
      const listSchemasCommand = new ListSchemasCommand({
        RegistryName: registryName,
        NextToken: nextToken,
      });
      const response = await schemasClient.send(listSchemasCommand);
      allSchemas = [...allSchemas, ...(response.Schemas || [])];
      nextToken = response.NextToken;
    } while (nextToken);

    console.log(chalk.green(`Fetching EventBridge schemas...`));

    for (const schema of allSchemas) {
      if (!schema.SchemaName) {
        console.log(`Skipping schema ${schema.SchemaName} as it has no name`);
        continue;
      }

      const jsonSchema = await tryFetchJSONSchema(schemasClient, registryName, schema.SchemaName);
      const openApiSchema = await tryFetchOpenAPISchema(schemasClient, registryName, schema.SchemaName);

      if ((jsonSchema === null && openApiSchema === null) || !schema.SchemaName) {
        console.log(`Skipping schema ${schema.SchemaName} as both JSON and OpenAPI schemas are null`);
        continue;
      }

      const parts = schema.SchemaName?.split('@');
      const source = parts[0];
      const detailType = parts[1];

      // ARN?
      const arn = schema.SchemaArn ? parse(schema.SchemaArn) : undefined;

      // in custom registries detailType is not a value, so we use schema name
      const id = mapEventsBy === 'detail-type' ? detailType || schema.SchemaName : schema.SchemaName;

      schemas.push({
        id,
        schemaName: schema.SchemaName,
        registryName: registryName,
        source,
        // in custom registries detailType is not set
        detailType,
        jsonSchema,
        openApiSchema: openApiSchema?.Content,
        // Use EventBridge version count
        version: schema.VersionCount?.toString() || '1',
        createdDate: openApiSchema?.VersionCreatedDate,
        // EventBridge versions with every change, we can use this as the minor version
        versionCount: schema.VersionCount || 0,
        region: arn?.region,
        accountId: arn?.accountId,
        jsonDraftFileName: `${schema.SchemaName}-jsondraft.json`,
        openApiFileName: `${schema.SchemaName}-openapi.json`,
      });
    }

    return schemas;
  };

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;
  const { services, region, mapEventsBy = 'detail-type' } = options;
  const schemasClient = new SchemasClient({ region, credentials: options.credentials });
  const format = options.format || 'mdx';

  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_EVENTBRIDGE || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);
  // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
  const {
    writeService,
    writeDomain,
    getDomain,
    versionDomain,
    addServiceToDomain,
    getService,
    versionService,
    getSpecificationFilesForService,
    rmServiceById,
  } = utils(eventCatalogDirectory);

  const events = await fetchSchemasForRegistry(schemasClient)(options.registryName, mapEventsBy);

  // If no domain or services, just write all messages to catalog.
  if (!options.domain && !options.services) {
    await processEvents(events, options);
    return;
  }

  if (!services) {
    throw new Error('Please provide services for your events. Please see the generator example and API docs');
  }

  console.log(chalk.green(`Processing ${services.length} services with EventBridge...`));

  for (const service of services) {
    console.log(chalk.gray(`Processing ${service.id}`));

    let sendsEvents = [] as Event[];
    let receivesEvents = [] as Event[];

    if (service.sends) {
      sendsEvents = filterEvents(events, service.sends);
    }

    if (service.receives) {
      receivesEvents = filterEvents(events, service.receives);
    }

    const eventsToWrite = [...sendsEvents, ...receivesEvents];

    // Path to write the service to
    // Have to ../ as the SDK will put the files into hard coded folders
    let servicePath = options.domain
      ? path.join('../', 'domains', options.domain.id, 'services', service.id)
      : path.join('../', 'services', service.id);
    if (options.writeFilesToRoot || service.writeToRoot) {
      servicePath = service.id;
    }

    // Manage domain
    if (options.domain) {
      // Try and get the domain
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
        await writeDomain(
          {
            id: domainId,
            name: domainName,
            version: domainVersion,
            markdown: generateMarkdownForDomain(),
            // services: [{ id: serviceId, version: version }],
          },
          { format }
        );
        console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));
      }

      if (currentDomain && currentDomain.version === domainVersion) {
        console.log(chalk.yellow(` - Domain (v${domainVersion}) already exists, skipped creation...`));
      }

      // Add the service to the domain
      await addServiceToDomain(domainId, { id: service.id, version: service.version }, domainVersion);
    }

    // Check if service is already defined... if the versions do not match then create service.
    const latestServiceInCatalog = await getService(service.id, 'latest');
    let serviceMarkdown = generateMarkdownForService();
    let serviceWritesTo = service.writesTo || ([] as any);
    let serviceReadsFrom = service.readsFrom || ([] as any);
    let styles = null;
    let serviceSpecifications = {};
    let serviceSpecificationsFiles = [];
    let serviceBadges = null;
    let serviceAttachments = null;
    let sends = sendsEvents.map((event) => ({ id: event.detailType || event.schemaName, version: event.version || 'latest' }));
    let receives = receivesEvents.map((event) => ({
      id: event.detailType || event.schemaName,
      version: event.version || 'latest',
    }));
    let owners = [] as any;

    console.log(chalk.blue(`Processing service: ${service.id} (v${service.version})`));

    if (latestServiceInCatalog) {
      serviceMarkdown = latestServiceInCatalog.markdown;
      owners = latestServiceInCatalog.owners || [];
      styles = latestServiceInCatalog.styles || null;
      serviceBadges = latestServiceInCatalog.badges || null;
      serviceAttachments = latestServiceInCatalog.attachments || null;
      serviceWritesTo = latestServiceInCatalog.writesTo || ([] as any);
      serviceReadsFrom = latestServiceInCatalog.readsFrom || ([] as any);
      // Found a service, and versions do not match, we need to version the one already there
      if (latestServiceInCatalog.version !== service.version) {
        await versionService(service.id);
        console.log(chalk.cyan(` - Versioned previous service (v${latestServiceInCatalog.version})`));
      }

      // Match found, override it
      if (latestServiceInCatalog.version === service.version) {
        // we want to preserve the markdown any any spec files that are already there
        serviceMarkdown = latestServiceInCatalog.markdown;
        serviceSpecifications = latestServiceInCatalog.specifications ?? {}; // Why this not here?
        // @ts-ignore
        sends = latestServiceInCatalog.sends ? [...latestServiceInCatalog.sends, ...sends] : sends;
        // @ts-ignore
        receives = latestServiceInCatalog.receives ? [...latestServiceInCatalog.receives, ...receives] : receives;
        serviceSpecificationsFiles = await getSpecificationFilesForService(
          latestServiceInCatalog.id,
          latestServiceInCatalog.version
        );
        await rmServiceById(service.id);
      }
    }

    await writeService(
      {
        id: service.id,
        markdown: serviceMarkdown,
        name: service.name || service.id,
        version: service.version,
        sends,
        receives,
        specifications: serviceSpecifications,
        owners: owners,
        ...(service.summary && { summary: service.summary }),
        ...(styles && { styles }),
        ...(serviceBadges && { badges: serviceBadges }),
        ...(serviceAttachments && { attachments: serviceAttachments }),
        ...(serviceWritesTo.length > 0 ? { writesTo: serviceWritesTo } : {}),
        ...(serviceReadsFrom.length > 0 ? { readsFrom: serviceReadsFrom } : {}),
      },
      { path: servicePath, override: true, format }
    );

    // We have to process the events last, as we need to get the service path from the service we just wrote
    await processEvents(eventsToWrite, options, servicePath);
  }

  console.log(chalk.green(`\nFinished generating event catalog with EventBridge schema registry ${options.registryName}`));
};

const processEvents = async (events: Event[], options: GeneratorProps, servicePath?: string) => {
  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;
  const eventBridgeClient = new EventBridgeClient({ region: options.region, credentials: options.credentials });
  const format = options.format || 'mdx';
  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
  const { getEvent, writeEvent, addSchemaToEvent, rmEventById, versionEvent, writeChannel, getChannel } =
    utils(eventCatalogDirectory);

  for (const event of events) {
    // in custom registries detailType is not a value, so we use schema name
    console.log(chalk.blue(`Processing event: ${event.id} (v${event.version})`));

    const schemaPath = event.jsonSchema ? event.jsonDraftFileName : event.openApiSchema ? event.openApiFileName : '';
    let messageMarkdown = generateMarkdownForMessage(event);
    let messageBadges = getBadgesForMessage(event, options.eventBusName);
    let messageAttachments = null;
    const catalogedEvent = await getEvent(event.id, 'latest');
    let eventChannel = [] as any;
    let messageSummary = null;

    console.log('IS THE EVENT CATALOGED?', event.id, event.version, catalogedEvent);

    if (catalogedEvent) {
      // Persist markdown between versions
      messageMarkdown = catalogedEvent.markdown;
      messageBadges = catalogedEvent.badges || messageBadges;
      messageAttachments = catalogedEvent.attachments;
      messageSummary = catalogedEvent.summary;
      // if the version matches, we can override the message but keep markdown as it  was
      if (catalogedEvent.version === event.version) {
        await rmEventById(event.id, event.version);
      } else {
        // if the version does not match, we need to version the message
        await versionEvent(event.id);
        console.log(chalk.cyan(` - Versioned previous message: (v${catalogedEvent.version})`));
      }
    }

    // If we have defined an eventbus for this event (channel), we document it
    if (event.eventBusName) {
      const channel = await getChannel(event.eventBusName);

      if (!channel) {
        let name = event.eventBusName;
        let address = '';
        let summary = 'Amazon EventBridge event bus';
        let markdown =
          'This EventBridge Event Bus serves as a message routing system on AWS. It handles events and routes them to targets.';

        try {
          const eventBusCommand = new DescribeEventBusCommand({
            Name: event.eventBusName,
          });
          const response = await eventBridgeClient.send(eventBusCommand);
          name = response.Name || event.eventBusName;
          address = response.Arn || '';
          summary = `Amazon EventBridge: ${response.Description}` || 'Amazon EventBridge event bus';
          markdown = generatedMarkdownByEventBus(event, response);
        } catch (error) {
          console.log(error);
          // Do nothing, fall back.
        }

        await writeChannel(
          {
            id: event.eventBusName,
            name: `EventBridge: ${name}`,
            markdown,
            version: '1.0.0', // hardcode for now, what would this be?
            address,
            protocols: ['eventbridge'],
            summary,
          },
          { format }
        );
      }

      eventChannel = [{ id: event.eventBusName, version: 'latest' }];
    }

    // Where to write the event to
    let messagePath = event.id;

    if (servicePath && !options.writeFilesToRoot && !options.writeEventsToRoot) {
      messagePath = join(servicePath, 'events', event.id);
    }

    await writeEvent(
      {
        id: event.id,
        name: event.id,
        version: event.version?.toString() || '',
        schemaPath,
        markdown: messageMarkdown,
        badges: messageBadges,
        ...(messageSummary && { summary: messageSummary }),
        ...(messageAttachments && { attachments: messageAttachments }),
        ...(eventChannel.length > 0 && { channels: eventChannel }),
      },
      { path: messagePath, format, override: true }
    );

    console.log(chalk.cyan(` - Event (${event.id} v${event.version}) created`));

    if (event.jsonSchema) {
      await addSchemaToEvent(event.id, { fileName: event.jsonDraftFileName, schema: event.jsonSchema });
      console.log(chalk.cyan(` - Schema added to event (v${event.version})`));
    }

    if (event.openApiSchema) {
      await addSchemaToEvent(event.id, { fileName: event.openApiFileName, schema: event.openApiSchema });
      console.log(chalk.cyan(` - Schema added to event (v${event.version})`));
    }
  }
};
