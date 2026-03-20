import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import {
  GlueClient,
  ListSchemasCommand,
  GetSchemaVersionCommand,
  GetSchemaCommand,
  GetTagsCommand,
  ListSchemaVersionsCommand,
} from '@aws-sdk/client-glue';
import { EventCatalogConfig, GlueSchema, GeneratorProps } from './types';
import { filterSchemas } from './utils/filters';
import checkLicense from '../../../shared/checkLicense';

import { defaultMarkdown as generateMarkdownForService } from './utils/services';
import { defaultMarkdown as generateMarkdownForDomain } from './utils/domains';
import { defaultMarkdown as generateMarkdownForMessage, getBadgesForMessage } from './utils/messages';
import path, { join } from 'node:path';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

const fetchTagsForSchema = async (glueClient: GlueClient, schemaArn: string): Promise<Record<string, string>> => {
  try {
    const getTagsCommand = new GetTagsCommand({
      ResourceArn: schemaArn,
    });
    const response = await glueClient.send(getTagsCommand);
    return response.Tags || {};
  } catch (error) {
    // Tags might not be accessible or the resource might not support tags
    // We'll silently ignore errors and return empty tags
    return {};
  }
};

const fetchSchemasFromRegistry =
  (glueClient: GlueClient, includeAllVersions: boolean = false) =>
  async (registryName: string, registryArn?: string): Promise<GlueSchema[]> => {
    const schemas = [] as GlueSchema[];
    let nextToken: string | undefined;

    console.log(chalk.green(`Fetching Glue schemas from registry: ${registryName}...`));

    do {
      const listSchemasCommand = new ListSchemasCommand({
        RegistryId: registryArn ? { RegistryArn: registryArn } : { RegistryName: registryName },
        NextToken: nextToken,
      });
      const response = await glueClient.send(listSchemasCommand);

      if (response.Schemas) {
        for (const schema of response.Schemas) {
          if (!schema.SchemaName) {
            console.log(`Skipping schema with no name`);
            continue;
          }

          try {
            const getSchemaCommand = new GetSchemaCommand({
              SchemaId: {
                SchemaArn: schema.SchemaArn,
              },
            });
            const schemaDetails = await glueClient.send(getSchemaCommand);

            if (includeAllVersions) {
              // Fetch all versions of the schema
              let versionsNextToken: string | undefined;
              const versions: GlueSchema[] = [];
              let latestVersionNumber = 1;

              do {
                const listVersionsCommand = new ListSchemaVersionsCommand({
                  SchemaId: {
                    SchemaArn: schema.SchemaArn,
                  },
                  NextToken: versionsNextToken,
                });
                const versionsResponse = await glueClient.send(listVersionsCommand);

                if (versionsResponse.Schemas) {
                  for (const versionSummary of versionsResponse.Schemas) {
                    if (versionSummary.VersionNumber && versionSummary.VersionNumber > latestVersionNumber) {
                      latestVersionNumber = versionSummary.VersionNumber;
                    }

                    // Get full details for each version
                    const getVersionCommand = new GetSchemaVersionCommand({
                      SchemaVersionId: versionSummary.SchemaVersionId,
                    });
                    const versionDetails = await glueClient.send(getVersionCommand);

                    if (versionDetails) {
                      const tags = schema.SchemaArn ? await fetchTagsForSchema(glueClient, schema.SchemaArn) : {};

                      versions.push({
                        id: schema.SchemaName!,
                        name: schema.SchemaName!,
                        registryName: registryName,
                        schemaArn: schema.SchemaArn,
                        schemaVersionId: versionDetails.SchemaVersionId,
                        schemaVersionNumber: versionDetails.VersionNumber,
                        dataFormat: versionDetails.DataFormat,
                        compatibility: schemaDetails.Compatibility,
                        status: versionDetails.Status,
                        description: schemaDetails.Description,
                        tags: tags,
                        createdDate: versionDetails.CreatedTime ? new Date(versionDetails.CreatedTime) : undefined,
                        lastUpdated: versionSummary.CreatedTime ? new Date(versionSummary.CreatedTime) : undefined,
                        schemaDefinition: versionDetails.SchemaDefinition,
                        version: versionDetails.VersionNumber?.toString() || '1',
                      });
                    }
                  }
                }

                versionsNextToken = versionsResponse.NextToken;
              } while (versionsNextToken);

              // Mark the latest version
              versions.forEach((v) => {
                (v as any).latestVersion = v.schemaVersionNumber === latestVersionNumber;
              });

              schemas.push(...versions);
            } else {
              // Get only the latest version of the schema
              const getSchemaVersionCommand = new GetSchemaVersionCommand({
                SchemaId: {
                  SchemaArn: schema.SchemaArn,
                },
                SchemaVersionNumber: {
                  LatestVersion: true,
                },
              });
              const versionDetails = await glueClient.send(getSchemaVersionCommand);

              if (schemaDetails && versionDetails) {
                const tags = schema.SchemaArn ? await fetchTagsForSchema(glueClient, schema.SchemaArn) : {};

                schemas.push({
                  id: schema.SchemaName!,
                  name: schema.SchemaName!,
                  registryName: registryName,
                  schemaArn: schema.SchemaArn,
                  schemaVersionId: versionDetails.SchemaVersionId,
                  schemaVersionNumber: versionDetails.VersionNumber,
                  dataFormat: versionDetails.DataFormat,
                  compatibility: schemaDetails.Compatibility,
                  status: versionDetails.Status,
                  description: schemaDetails.Description,
                  tags: tags,
                  createdDate: versionDetails.CreatedTime ? new Date(versionDetails.CreatedTime) : undefined,
                  lastUpdated: schema.UpdatedTime ? new Date(schema.UpdatedTime) : undefined,
                  schemaDefinition: versionDetails.SchemaDefinition,
                  version: versionDetails.VersionNumber?.toString() || '1',
                  latestVersion: true,
                });
              }
            }
          } catch (error) {
            console.log(`Error fetching details for schema ${schema.SchemaName}:`, error);
            continue;
          }
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return schemas;
  };

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;
  const { services, region, registryName, registryArn } = options;
  const glueClient = new GlueClient({ region, credentials: options.credentials });
  const format = options.format || 'mdx';

  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_AWS_GLUE_SCHEMA_REGISTRY || options.licenseKey || '';
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
    getResourcePath,
  } = utils(eventCatalogDirectory);

  const schemas = await fetchSchemasFromRegistry(glueClient, options.includeAllVersions)(registryName, registryArn);

  // If no domain or services, just write all schemas as messages to catalog.
  if (!options.domain && !options.services) {
    await processSchemas(schemas, options);
    return;
  }

  if (!services) {
    throw new Error('Please provide services for your schemas. Please see the generator example and API docs');
  }

  console.log(chalk.green(`Processing ${services.length} services with AWS Glue...`));

  for (const service of services) {
    console.log(chalk.gray(`Processing ${service.id}`));

    let sendsSchemas = [] as GlueSchema[];
    let receivesSchemas = [] as GlueSchema[];

    if (service.sends) {
      sendsSchemas = filterSchemas(schemas, service.sends);
    }

    if (service.receives) {
      receivesSchemas = filterSchemas(schemas, service.receives);
    }

    const schemasToWrite = [...sendsSchemas, ...receivesSchemas];

    // Manage domain
    if (options.domain) {
      // Try and get the domain
      const { id: domainId, name: domainName, version: domainVersion } = options.domain;
      const domain = await getDomain(options.domain.id, domainVersion || 'latest');
      const currentDomain = await getDomain(options.domain.id, 'latest');

      console.log(chalk.blueBright(`\nProcessing domain: ${domainName} (v${domainVersion})`));

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

    // Have to ../ as the SDK will put the files into hard coded folders
    // Use getResourcePath to resolve the actual domain location (supports subdomains)
    let servicePath = path.join('../', 'services', service.id);
    if (options.domain) {
      const domainResource = await getResourcePath(eventCatalogDirectory, options.domain.id, options.domain.version);
      if (domainResource) {
        servicePath = path.join('../', domainResource.directory, 'services', service.id);
      } else {
        servicePath = path.join('../', 'domains', options.domain.id, 'services', service.id);
      }
    }
    if (options.writeFilesToRoot) {
      servicePath = service.id;
    }

    // Check if service is already defined... if the versions do not match then create service.
    const latestServiceInCatalog = await getService(service.id, 'latest');
    let serviceMarkdown = generateMarkdownForService();
    let styles = null;
    let serviceSpecifications = {};
    let serviceSpecificationsFiles = [];
    let sends = sendsSchemas.map((schema) => ({ id: schema.name, version: schema.version || 'latest' }));
    let receives = receivesSchemas.map((schema) => ({
      id: schema.name,
      version: schema.version || 'latest',
    }));
    let owners = [] as any;

    console.log(chalk.blueBright(`Processing service: ${service.id} (v${service.version})`));

    if (latestServiceInCatalog) {
      serviceMarkdown = latestServiceInCatalog.markdown;
      owners = latestServiceInCatalog.owners || [];
      styles = latestServiceInCatalog.styles || null;
      // Found a service, and versions do not match, we need to version the one already there
      if (latestServiceInCatalog.version !== service.version) {
        await versionService(service.id);
        console.log(chalk.cyan(` - Versioned previous service (v${latestServiceInCatalog.version})`));
      }

      // Match found, override it
      if (latestServiceInCatalog.version === service.version) {
        // we want to preserve the markdown any any spec files that are already there
        serviceMarkdown = latestServiceInCatalog.markdown;
        serviceSpecifications = latestServiceInCatalog.specifications ?? {};
        // @ts-ignore
        sends = latestServiceInCatalog.sends ? [...latestServiceInCatalog.sends, ...sends] : sends;
        // @ts-ignore
        receives = latestServiceInCatalog.receives ? [...latestServiceInCatalog.receives, ...receives] : receives;
        serviceSpecificationsFiles = await getSpecificationFilesForService(
          latestServiceInCatalog.id,
          latestServiceInCatalog.version
        );

        // Process schemas BEFORE removing service to preserve events folder
        await processSchemas(schemasToWrite, options, servicePath);

        // await rmServiceById(service.id);
      }
    }

    // Process schemas if service was not removed (new service or different version)
    if (!latestServiceInCatalog || latestServiceInCatalog.version !== service.version) {
      await processSchemas(schemasToWrite, options, servicePath);
    }

    await writeService(
      {
        id: service.id,
        markdown: serviceMarkdown,
        name: service.id,
        version: service.version,
        sends,
        receives,
        specifications: serviceSpecifications,
        owners: owners,
        ...(styles && { styles }),
      },
      { path: servicePath, override: true, format }
    );
  }

  console.log(chalk.green(`\nFinished generating event catalog with AWS Glue Schema Registry ${registryName}`));
};

const processSchemas = async (schemas: GlueSchema[], options: GeneratorProps, servicePath?: string) => {
  // This is set by EventCatalog. This is the directory where the catalog is stored
  const eventCatalogDirectory = process.env.PROJECT_DIR;
  const format = options.format || 'mdx';
  if (!eventCatalogDirectory) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  const { getEvent, writeEvent, addSchemaToEvent, versionEvent } = utils(eventCatalogDirectory);

  // Group schemas by id to process them in the correct order
  const schemasByEvent = schemas.reduce((acc: Record<string, GlueSchema[]>, schema) => {
    if (!acc[schema.id]) {
      acc[schema.id] = [];
    }
    acc[schema.id].push(schema);
    return acc;
  }, {});

  // Process each event and its versions
  for (const eventId in schemasByEvent) {
    const eventSchemas = schemasByEvent[eventId];

    // Sort by version number to ensure we process them in the correct order
    eventSchemas.sort((a, b) => {
      const versionA = parseInt(a.version || '1');
      const versionB = parseInt(b.version || '1');
      return versionA - versionB;
    });

    for (const schema of eventSchemas) {
      console.log(chalk.blueBright(`Processing schema: ${schema.id} (v${schema.version})`));

      let messageMarkdown = generateMarkdownForMessage(schema, options.region);
      const catalogedEvent = await getEvent(schema.id, 'latest');

      if (catalogedEvent) {
        // Persist markdown between versions
        messageMarkdown = catalogedEvent.markdown;

        if (catalogedEvent.version !== schema.version) {
          await versionEvent(schema.id);
          console.log(chalk.cyan(` - Versioned previous message: (v${catalogedEvent.version})`));
        }
      }

      // Where to write the event to
      let messagePath = schema.id;

      if (servicePath && !options.writeFilesToRoot) {
        messagePath = join(servicePath, 'events', schema.id);
      }

      await writeEvent(
        {
          id: schema.id,
          name: schema.name,
          version: schema.version?.toString() || '1',
          markdown: messageMarkdown,
          badges: getBadgesForMessage(schema, options.registryName),
        },
        { path: messagePath, format, override: true }
      );

      console.log(chalk.cyan(` - Event (${schema.id} v${schema.version}) created`));

      // Add schema definition to the event
      if (schema.schemaDefinition) {
        const schemaFileName =
          schema.dataFormat === 'AVRO'
            ? `${schema.name}-schema.avsc`
            : schema.dataFormat === 'PROTOBUF'
              ? `${schema.name}-schema.proto`
              : `${schema.name}-schema.json`;

        await addSchemaToEvent(schema.id, {
          fileName: schemaFileName,
          schema: schema.schemaDefinition,
        });
        console.log(chalk.cyan(` - Schema added to event (v${schema.version})`));
      }

      // If this is not the latest version and includeAllVersions is true, version it immediately
      if (!schema.latestVersion && options.includeAllVersions) {
        await versionEvent(schema.id);
        console.log(chalk.cyan(` - Versioned event as it's not the latest (v${schema.version})`));
      }
    }
  }
};
