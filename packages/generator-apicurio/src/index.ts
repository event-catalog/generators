import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import checkLicense from '../../../shared/checkLicense';
import { filterSchemas } from './utils/filters';
import pkgJSON from '../package.json';
import path, { join } from 'path';
import { createRequire } from 'module';
import fs from 'fs';
import { EventCatalogConfig, GeneratorProps, Schema, ServiceSpecification } from './types';
import {
  getSchemasFromRegistry,
  extractExactArtifactIds,
  getSchemasByArtifactIds,
  getSpecificationArtifact,
} from './lib/apicurio';
import { writeMessageToEventCatalog } from './utils/messages';
import { getMarkdownForService, getMarkdownForDomain } from './utils/markdown';

/**
 * Dynamically imports and runs a generator on a specification file.
 * The generator is expected to be installed as a peer dependency.
 */
async function runSpecificationGenerator(
  specConfig: ServiceSpecification,
  specFilePath: string,
  serviceId: string,
  serviceName: string,
  serviceVersion: string,
  projectDir: string,
  domain?: { id: string; name: string; version: string }
): Promise<void> {
  if (!specConfig.generator) return;

  const [generatorPackage, generatorOptions = {}] = specConfig.generator;

  try {
    // Create a require function that resolves from the user's project directory
    // This allows finding packages installed in the user's project, not just in this plugin
    const projectRequire = createRequire(path.join(projectDir, 'package.json'));

    // Resolve and import the generator from the user's project
    const generatorPath = projectRequire.resolve(generatorPackage);
    const generatorModule = await import(generatorPath);

    // Handle CJS/ESM interop - the function could be at different levels
    let generator = generatorModule.default || generatorModule;
    // Handle nested default (CJS module imported via ESM)
    if (typeof generator !== 'function' && generator?.default) {
      generator = generator.default;
    }

    if (typeof generator !== 'function') {
      console.warn(chalk.yellow(`  - Generator ${generatorPackage} is not a valid function, skipping`));
      return;
    }

    // Extract service-specific options if provided
    const { service: serviceOptions, ...restOptions } = generatorOptions as Record<string, any>;

    // Build the service config for the generator
    // Both OpenAPI and AsyncAPI generators expect a services array with path to the spec file
    const generatorServiceConfig = {
      id: serviceId,
      name: serviceName,
      path: specFilePath,
      version: serviceVersion,
      ...serviceOptions, // Allow overriding service options
    };

    // Build the full generator options
    const fullGeneratorOptions = {
      ...restOptions,
      services: [generatorServiceConfig],
      // If domain is configured, pass it to the generator
      ...(domain ? { domain } : {}),
    };

    console.log(chalk.cyan(`  - Running ${generatorPackage} generator for ${specConfig.artifactId}...`));

    // Run the generator
    await generator({}, fullGeneratorOptions);

    console.log(chalk.cyan(`  - Completed ${generatorPackage} generator for ${specConfig.artifactId}`));
  } catch (error: any) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
      console.error(chalk.red(`  - Generator ${generatorPackage} not found. Please install it: npm install ${generatorPackage}`));
    } else {
      console.error(chalk.red(`  - Error running generator ${generatorPackage}: ${error.message}`));
    }
  }
}

/////////////////////////////////////////////////

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  const REGISTRY_URL = options.registryUrl;
  const INCLUDE_ALL_VERSIONS = options.includeAllVersions;

  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!REGISTRY_URL) {
    throw new Error('Please provide a url for the Apicurio Registry');
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
    addFileToService,
    getSpecificationFilesForService,
    getResourcePath,
  } = utils(eventCatalogDirectory);

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_APICURIO_SCHEMA_REGISTRY || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  // Document all the services
  const services = options.services || [];
  const documentMessagesWithService = services.length > 0;

  let schemas: Schema[] = [];

  // Smart fetching: if services are configured with exact artifact IDs, only fetch those
  if (documentMessagesWithService) {
    const exactArtifactIds = extractExactArtifactIds(services);

    if (exactArtifactIds && exactArtifactIds.length > 0) {
      // Efficient path: only fetch the specific artifacts we need
      console.log(
        chalk.green(
          `Fetching ${exactArtifactIds.length} specific artifacts from registry: ${REGISTRY_URL}${INCLUDE_ALL_VERSIONS ? ' (including all versions)' : ''}...`
        )
      );
      console.log(chalk.cyan(`  Artifacts: ${exactArtifactIds.join(', ')}`));
      schemas = await getSchemasByArtifactIds(REGISTRY_URL, exactArtifactIds, INCLUDE_ALL_VERSIONS);
    } else if (exactArtifactIds === null) {
      // Has prefix/suffix/includes filters - need to fetch all
      console.log(chalk.green(`Fetching all schemas from registry (prefix/suffix filters detected): ${REGISTRY_URL}...`));
      schemas = await getSchemasFromRegistry(REGISTRY_URL);
    } else {
      // No artifact IDs specified in services
      console.log(chalk.yellow(`No artifacts specified in services configuration`));
    }
  } else {
    // No services configured - fetch all (for documenting everything)
    console.log(chalk.green(`Fetching all schemas from registry: ${REGISTRY_URL}...`));
    schemas = await getSchemasFromRegistry(REGISTRY_URL);
  }

  console.log(chalk.green(`Found ${schemas.length} schemas in Apicurio Registry`));

  // Group them by artifactId
  const groupedSchemas = schemas.reduce((acc: Record<string, Schema[]>, schema: Schema) => {
    acc[schema.artifactId] = [...(acc[schema.artifactId] || []), schema];
    return acc;
  }, {});

  const allMessagesInRegistry = Object.keys(groupedSchemas);

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
        // Persist if we have previous information
        ...currentDomain,
        id: domainId,
        name: domainName,
        version: domainVersion,
        markdown: currentDomain?.markdown || getMarkdownForDomain(),
      });
      console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));
    }

    //  Add all the services to the domain
    for (const service of services) {
      await addServiceToDomain(domainId, { id: service.id, version: service.version }, domainVersion);
    }
  }

  if (documentMessagesWithService) {
    for (const service of services) {
      // Try and find the given messages to match against the service
      const sends = filterSchemas(groupedSchemas, service.sends || [], INCLUDE_ALL_VERSIONS).filter(
        (message) => message !== undefined
      );
      const receives = filterSchemas(groupedSchemas, service.receives || [], INCLUDE_ALL_VERSIONS).filter(
        (message) => message !== undefined
      );

      const serviceInCatalog = await getService(service.id);
      const { sends: previousSends, receives: previousReceives, ...previousServiceInformation } = serviceInCatalog || {};

      if (serviceInCatalog && serviceInCatalog.version !== service.version) {
        // If the versions match, remove it as we are going to update/rewrite it with persisted information
        await versionService(service.id);
        console.log(chalk.cyan(` - Versioned previous service: (v${serviceInCatalog.version})`));
      }

      // Path to service
      const pathToService = join('../', 'services', service.id);

      // If the service has a summary, we should use it
      const summary = service.summary || serviceInCatalog?.summary || `${service.id} Service`;

      // For service metadata, only include latest versions of each message
      const latestSends = sends.filter((m) => m.latestVersion);
      const latestReceives = receives.filter((m) => m.latestVersion);

      const serviceToWrite = {
        // Persist if we have previous information
        ...previousServiceInformation,

        // Regardless if we have previous information or not, we add this information always
        id: service.id,
        name: service.name || service.id,
        version: service.version,
        summary,
        ...(latestSends.length > 0
          ? { sends: latestSends.map((message) => ({ id: message.messageId, version: message.version.toString() })) }
          : {}),
        ...(latestReceives.length > 0
          ? { receives: latestReceives.map((message) => ({ id: message.messageId, version: message.version.toString() })) }
          : {}),

        ...(service.writesTo && { writesTo: service.writesTo }),
        ...(service.readsFrom && { readsFrom: service.readsFrom }),

        // If the service does not already exist we need to add fields for new documented topics
        ...(!serviceInCatalog
          ? {
              markdown: getMarkdownForService({ registryUrl: REGISTRY_URL }),
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

      // Get existing specifications from the service in catalog (it's an object like { openapiPath: 'file.yaml' })
      let existingSpecifications: Record<string, string> = {};
      if (
        serviceInCatalog?.specifications &&
        typeof serviceInCatalog.specifications === 'object' &&
        !Array.isArray(serviceInCatalog.specifications)
      ) {
        existingSpecifications = serviceInCatalog.specifications as Record<string, string>;
      }

      // Get existing specification files to preserve them
      let existingSpecFiles: { content: string; fileName: string }[] = [];
      if (serviceInCatalog?.version === service.version) {
        existingSpecFiles = await getSpecificationFilesForService(service.id, service.version);
      }

      // Process specifications from config
      const specFilesToAdd: { content: string; fileName: string }[] = [...existingSpecFiles];
      const newSpecifications: Record<string, string> = { ...existingSpecifications };
      // Track specs that have generators configured (include content for writing)
      const specsWithGenerators: { specConfig: ServiceSpecification; fileName: string; content: string }[] = [];

      if (service.specifications && service.specifications.length > 0) {
        for (const specConfig of service.specifications) {
          const specArtifact = await getSpecificationArtifact(REGISTRY_URL, specConfig.artifactId, specConfig.version);

          if (specArtifact) {
            // Determine file extension based on type
            const extension = specConfig.type === 'asyncapi' ? 'asyncapi.yml' : 'openapi.yml';
            const fileName = `${specConfig.artifactId.toLowerCase().replace(/\s+/g, '-')}.${extension}`;

            // Add to spec files
            specFilesToAdd.push({
              content: specArtifact.content,
              fileName,
            });

            // Add to specifications frontmatter (openapiPath or asyncapiPath)
            const specKey = specConfig.type === 'asyncapi' ? 'asyncapiPath' : 'openapiPath';
            newSpecifications[specKey] = fileName;

            console.log(
              chalk.cyan(`  - Added ${specConfig.type} specification: ${specConfig.artifactId} (v${specArtifact.version})`)
            );

            // Track specs with generators to run after files are written
            if (specConfig.generator) {
              specsWithGenerators.push({ specConfig, fileName, content: specArtifact.content });
            }
          }
        }
      }

      // Add specifications to the service to write
      const serviceWithSpecs = {
        ...serviceToWrite,
        ...(Object.keys(newSpecifications).length > 0 ? { specifications: newSpecifications } : {}),
      };

      await writeService(serviceWithSpecs, { path: servicePath, override: serviceInCatalog?.version === service.version });

      // Add specification files to the service (don't pass version so file goes to service root)
      for (const specFile of specFilesToAdd) {
        await addFileToService(service.id, { content: specFile.content, fileName: specFile.fileName });
      }

      // Run generators for specifications that have them configured
      for (const { specConfig, fileName, content } of specsWithGenerators) {
        // Build the absolute path to the spec file
        // Use domain path if domain is configured, otherwise use root services path
        let specFilePath = path.join(eventCatalogDirectory, 'services', service.id, fileName);
        if (options.domain) {
          const domainResource = await getResourcePath(eventCatalogDirectory, options.domain.id, options.domain.version);
          if (domainResource) {
            specFilePath = path.join(eventCatalogDirectory, domainResource.directory, 'services', service.id, fileName);
          } else {
            specFilePath = path.join(eventCatalogDirectory, 'domains', options.domain.id, 'services', service.id, fileName);
          }
        }

        // Ensure the directory exists and write the spec file directly
        // This ensures the file is available for the generator at the expected path
        const specDir = path.dirname(specFilePath);
        if (!fs.existsSync(specDir)) {
          fs.mkdirSync(specDir, { recursive: true });
        }
        fs.writeFileSync(specFilePath, content, 'utf-8');

        await runSpecificationGenerator(
          specConfig,
          specFilePath,
          service.id,
          service.name || service.id,
          service.version,
          eventCatalogDirectory,
          options.domain
        );
      }

      const messages = [...sends, ...receives];

      for (const message of messages) {
        await writeMessageToEventCatalog({
          pathToCatalog: eventCatalogDirectory,
          message,
          rootPath: pathToService,
          serviceId: service.id,
          messageType: message.messageType || 'event',
        });
        console.log(chalk.blue(`  - Processed ${message.messageId} (v${message.version}), added schema to event catalog`));
      }

      console.log(chalk.blue(`  - Processed ${service.id} (v${service.version}), added service to event catalog`));
    }
  } else {
    // Just document all the artifacts
    for (const artifactId of allMessagesInRegistry) {
      const messages = groupedSchemas[artifactId];

      const messagesToWriteToEventCatalog = messages.filter((v: Schema) => (INCLUDE_ALL_VERSIONS ? true : v.latestVersion));
      for (const message of messagesToWriteToEventCatalog) {
        await writeMessageToEventCatalog({
          pathToCatalog: eventCatalogDirectory,
          message,
          rootPath: '../',
          messageType: 'event',
        });
        console.log(chalk.blue(`  - Processed ${message.messageId} (v${message.version}), added schema to event catalog`));
      }
    }
  }

  console.log(chalk.green(`\nFinished generating event catalog with Apicurio Registry ${REGISTRY_URL}`));
};
