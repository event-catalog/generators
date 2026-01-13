import utils from '@eventcatalog/sdk';
import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import SwaggerParser from '@apidevtools/swagger-parser';

import { defaultMarkdown as generateMarkdownForDomain } from './utils/domains';
import { buildService, getSummary } from './utils/services';
import { buildMessage } from './utils/messages';
import { getOperationsByType } from './utils/openapi';
import { Domain, Service, Message, Pointer } from './types';
import { getMessageTypeUtils } from './utils/catalog-shorthand';
import { OpenAPI } from 'openapi-types';
import checkLicense from '../../../shared/checkLicense';
import yaml from 'js-yaml';
import { join } from 'node:path';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';
import { isVersionGreaterThan, isVersionLessThan } from './utils/versions';

type MESSAGE_TYPE = 'command' | 'query' | 'event';
export type HTTP_METHOD = 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type HTTP_METHOD_TO_MESSAGE_TYPE = Partial<Record<HTTP_METHOD, MESSAGE_TYPE>>;

type Props = {
  services: Service[];
  messages?: Message;
  domain?: Domain;
  debug?: boolean;
  saveParsedSpecFile?: boolean;
  licenseKey?: string;
  writeFilesToRoot?: boolean;
  sidebarBadgeType?: 'HTTP_METHOD' | 'MESSAGE_TYPE';
  httpMethodsToMessages?: HTTP_METHOD_TO_MESSAGE_TYPE;
  preserveExistingMessages?: boolean;
};

const toUniqueArray = (array: Pointer[]) => {
  return array.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id && t.version === item.version));
};

// Helper to fetch authenticated URLs and parse the spec in memory
const fetchAuthenticatedSpec = async (specUrl: string, headers: Record<string, string>): Promise<OpenAPI.Document> => {
  const response = await fetch(specUrl, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${specUrl}, status: ${response.status}`);
  }
  const content = await response.text();
  const contentType = response.headers.get('content-type') || '';

  // Use Content-Type header if available, otherwise try JSON then YAML
  if (contentType.includes('json')) {
    return JSON.parse(content) as OpenAPI.Document;
  }
  if (contentType.includes('yaml')) {
    return yaml.load(content) as OpenAPI.Document;
  }

  // Fallback: try JSON first, then YAML
  try {
    return JSON.parse(content) as OpenAPI.Document;
  } catch {
    return yaml.load(content) as OpenAPI.Document;
  }
};

// Helper to merge openapi path into existing specifications, preserving format (array or object)
const mergeOpenApiIntoSpecifications = (existingSpecs: any, openapiFileName: string): any => {
  if (Array.isArray(existingSpecs)) {
    return [...existingSpecs.filter((spec: any) => spec.type !== 'openapi'), { type: 'openapi', path: openapiFileName }];
  }
  // Remove old openapiPath and add new one first to preserve expected key order
  const { openapiPath: _, ...rest } = existingSpecs || {};
  return { openapiPath: openapiFileName, ...rest };
};

export default async (_: any, options: Props) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check if the license is valid
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_OPENAPI || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);
  const {
    getDomain,
    versionDomain,
    writeDomain,
    addServiceToDomain,
    getService,
    versionService,
    writeService,
    addFileToService,
    getSpecificationFilesForService,
  } = utils(process.env.PROJECT_DIR);

  const { services = [], saveParsedSpecFile = false } = options;

  for (const serviceSpec of services) {
    const specFiles = Array.isArray(serviceSpec.path) ? serviceSpec.path : [serviceSpec.path];

    const specs = specFiles.map(async (specFile) => {
      try {
        const isUrl = specFile.startsWith('http');
        const hasHeaders = serviceSpec.headers && Object.keys(serviceSpec.headers).length > 0;

        let document: OpenAPI.Document;

        // If URL with headers, fetch and parse in memory
        if (isUrl && hasHeaders) {
          const parsedSpec = await fetchAuthenticatedSpec(specFile, serviceSpec.headers!);
          await SwaggerParser.validate(parsedSpec);
          document = await SwaggerParser.dereference(parsedSpec);
        } else {
          await SwaggerParser.validate(specFile);
          document = await SwaggerParser.dereference(specFile);
        }

        return {
          document,
          path: specFile,
          version: serviceSpec.version || document.info.version,
        };
      } catch (error) {
        console.error(chalk.red(`Failed to parse OpenAPI file: ${specFile}`));
        console.error(chalk.red(error));
        return null;
      }
    });

    const validSpecs = await Promise.all(specs);
    const validSpecFiles = validSpecs.filter((v) => v !== null);

    const orderedSpecs = validSpecFiles.sort((a, b) => {
      const versionA = a?.version ?? '';
      const versionB = b?.version ?? '';
      return versionA.localeCompare(versionB);
    });

    for (const specification of orderedSpecs) {
      const document = specification.document;
      const version = specification.version;
      const specPath = specification.path;

      const service = buildService(
        { ...serviceSpec, path: specPath, version: specification.version },
        document,
        serviceSpec.generateMarkdown
      );

      let serviceMarkdown = service.markdown;
      let serviceSpecificationsFiles = [];
      let serviceSpecifications = service.specifications;
      let serviceBadges = null;
      let serviceAttachments = null;
      let configuredWritesTo = service.writesTo || ([] as any);
      let configuredReadsFrom = service.readsFrom || ([] as any);
      const isDomainMarkedAsDraft = options.domain?.draft || null;

      const isServiceMarkedAsDraft =
        // @ts-ignore
        isDomainMarkedAsDraft || document.info?.['x-eventcatalog-draft'] || serviceSpec.draft || null;

      // Have to ../ as the SDK will put the files into hard coded folders
      let servicePath = options.domain
        ? join('../', 'domains', options.domain.id, 'services', service.id)
        : join('../', 'services', service.id);
      if (options.writeFilesToRoot) {
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
          const generatedMarkdownForDomain = generateMarkdownForDomain();
          await writeDomain({
            id: domainId,
            name: domainName,
            version: domainVersion,
            markdown: options.domain?.generateMarkdown
              ? options.domain.generateMarkdown({ domain: options.domain, markdown: generatedMarkdownForDomain })
              : generatedMarkdownForDomain,
            ...(options.domain?.owners ? { owners: options.domain.owners } : {}),
            ...(isDomainMarkedAsDraft && { draft: true }),
          });
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
      let latestVersionSpecificationFiles = [];

      try {
        latestVersionSpecificationFiles = await getSpecificationFilesForService(service.id, 'latest');
      } catch (error) {
        // No latest specifications found, skipping...
      }

      const versionTheService = latestServiceInCatalog && isVersionGreaterThan(version, latestServiceInCatalog.version);
      console.log(chalk.blue(`Processing service: ${document.info.title} (v${version})`));

      // If the version is less than the latest service version, we need to write is a versioned service
      if (latestServiceInCatalog && isVersionLessThan(version, latestServiceInCatalog.version)) {
        servicePath = join(servicePath, 'versioned', version);
      }

      // Found a service, and versions do not match, we need to version the one already there
      if (versionTheService) {
        await versionService(service.id);
        console.log(chalk.cyan(` - Versioned previous service (v${latestServiceInCatalog.version})`));
      }

      // Process all messages for the OpenAPI spec
      let { sends, receives } = await processMessagesForOpenAPISpec(specPath, document, servicePath, {
        ...options,
        owners: service.setMessageOwnersToServiceOwners ? service.owners : [],
        serviceHasMultipleSpecFiles: Array.isArray(serviceSpec.path),
        isDraft: isServiceMarkedAsDraft,
        serviceId: service.id,
        serviceVersion: service.version,
      });

      let owners = service.owners || [];
      let repository = null;
      let styles = null;
      let serviceWritesTo = configuredWritesTo;
      let serviceReadsFrom = configuredReadsFrom;

      // for now, if the user is doing multiple files into the same service,
      // we don't persist the previous specification files. TODO: fix this
      const persistPreviousSpecificationFiles = Array.isArray(serviceSpec.path) === false;

      if (latestServiceInCatalog) {
        serviceMarkdown = latestServiceInCatalog.markdown;
        serviceSpecificationsFiles = latestVersionSpecificationFiles;
        sends = latestServiceInCatalog.sends || ([] as any);
        owners = latestServiceInCatalog.owners || ([] as any);
        repository = latestServiceInCatalog.repository || null;
        styles = latestServiceInCatalog.styles || null;
        serviceBadges = latestServiceInCatalog.badges || null;
        serviceAttachments = latestServiceInCatalog.attachments || null;
        serviceWritesTo = latestServiceInCatalog.writesTo || ([] as any);
        serviceReadsFrom = latestServiceInCatalog.readsFrom || ([] as any);
        // persist any specifications that are already in the catalog, preserving format (array or object)
        if (persistPreviousSpecificationFiles && latestServiceInCatalog.specifications) {
          serviceSpecifications = mergeOpenApiIntoSpecifications(latestServiceInCatalog.specifications, service.schemaPath);
        }

        // Match found, override it
        if (latestServiceInCatalog.version === version) {
          // @ts-ignore
          receives = latestServiceInCatalog.receives
            ? // @ts-ignore
              toUniqueArray([...latestServiceInCatalog.receives, ...receives])
            : receives;

          serviceWritesTo = latestServiceInCatalog.writesTo
            ? toUniqueArray([...latestServiceInCatalog.writesTo, ...configuredWritesTo])
            : configuredWritesTo;
          serviceReadsFrom = latestServiceInCatalog.readsFrom
            ? toUniqueArray([...latestServiceInCatalog.readsFrom, ...configuredReadsFrom])
            : configuredReadsFrom;
        }
      }

      await writeService(
        {
          ...service,
          name: serviceSpec.name || service.name,
          summary: serviceSpec.summary || service.summary,
          badges: serviceBadges || service.badges,
          markdown: serviceMarkdown,
          specifications: serviceSpecifications,
          sends,
          receives,
          ...(owners ? { owners } : {}),
          ...(repository ? { repository } : {}),
          ...(styles ? { styles } : {}),
          ...(isServiceMarkedAsDraft ? { draft: true } : {}),
          ...(serviceAttachments ? { attachments: serviceAttachments } : {}),
          ...(serviceWritesTo.length > 0 ? { writesTo: serviceWritesTo } : {}),
          ...(serviceReadsFrom.length > 0 ? { readsFrom: serviceReadsFrom } : {}),
        },
        { path: join(servicePath), override: true }
      );

      // What files need added to the service (specification files)
      const specFiles = [
        // add any previous spec files to the list
        ...(persistPreviousSpecificationFiles ? serviceSpecificationsFiles : []),
        {
          content: saveParsedSpecFile
            ? getParsedSpecFile({ ...serviceSpec, path: specPath }, document)
            : await getRawSpecFile({ ...serviceSpec, path: specPath }),
          fileName: service.schemaPath,
        },
      ];

      for (const specFile of specFiles) {
        await addFileToService(
          service.id,
          {
            fileName: specFile.fileName,
            content: specFile.content,
          },
          version
        );
      }

      console.log(chalk.cyan(` - Service (v${version}) created`));
    }
  }
};

const processMessagesForOpenAPISpec = async (
  pathToSpec: string,
  document: OpenAPI.Document,
  servicePath: string,
  options: Props & {
    owners: string[];
    pathForMessages?: string;
    serviceHasMultipleSpecFiles: boolean;
    isDraft?: boolean;
    serviceId?: string;
    serviceVersion?: string;
  }
) => {
  // Pass document to avoid re-parsing (needed for authenticated URLs)
  const operations = await getOperationsByType(pathToSpec, options.httpMethodsToMessages, document);
  const sidebarBadgeType = options.sidebarBadgeType || 'HTTP_METHOD';
  const version = options.serviceVersion || document.info.version;
  const preserveExistingMessages = options.preserveExistingMessages ?? true;
  const isDraft = options.isDraft ?? null;

  let receives = [],
    sends = [];

  // Go through all messages
  for (const operation of operations) {
    const { requestBodiesAndResponses, sidebar, messageName, ...message } = await buildMessage(
      pathToSpec,
      document,
      operation,
      options.messages?.generateMarkdown,
      options.messages?.id,
      options.serviceId,
      version
    );
    let messageMarkdown = message.markdown;
    const messageType = operation.type;
    const messageAction = operation.action;
    let messageBadges = null;
    let messageAttachments = null;

    console.log(chalk.blue(`Processing message: ${message.name} (v${message.version})`));

    const {
      addFileToMessage,
      writeMessage,
      getMessage,
      versionMessage,
      collection: folder,
    } = getMessageTypeUtils(process.env.PROJECT_DIR as string, messageType);

    // Check if the message already exists in the catalog
    const catalogedMessage = await getMessage(message.id, 'latest');

    if (catalogedMessage) {
      // always preserve badges and attachments
      messageBadges = catalogedMessage.badges || null;
      messageAttachments = catalogedMessage.attachments || null;

      // only keep the markdown if the message is being preserved
      if (preserveExistingMessages) {
        messageMarkdown = catalogedMessage.markdown;
      }

      // if the version matches, we can override the message but keep markdown as it  was
      if (catalogedMessage.version !== message.version) {
        console.log('versioning message', message.id);
        // if the version does not match, we need to version the message
        await versionMessage(message.id);
        console.log(chalk.cyan(` - Versioned previous message: ${message.id} (v${catalogedMessage.version})`));
      }
    }

    let messagePath = join(servicePath, folder, messageName);

    if (options.writeFilesToRoot) {
      messagePath = message.id;
    }

    // Write the message to the catalog
    await writeMessage(
      {
        ...message,
        badges: messageBadges || message.badges,
        markdown: messageMarkdown,
        ...(options.owners ? { owners: options.owners } : {}),
        ...(messageAttachments ? { attachments: messageAttachments } : {}),
        // only if its defined add it to the sidebar
        ...(sidebarBadgeType === 'HTTP_METHOD' ? { sidebar } : {}),
        ...(isDraft ? { draft: true } : {}),
      },
      { path: options.pathForMessages || messagePath, override: true }
    );

    // If the message send or recieved by the service?
    if (messageAction === 'sends') {
      sends.push({
        id: message.id,
        version: message.version,
      });
    } else {
      receives.push({
        id: message.id,
        version: message.version,
      });
    }

    // Does the message have a request body or responses?
    if (requestBodiesAndResponses?.requestBody) {
      await addFileToMessage(
        message.id,
        {
          fileName: 'request-body.json',
          content: JSON.stringify(requestBodiesAndResponses.requestBody, null, 2),
        },
        message.version
      );
    }

    if (requestBodiesAndResponses?.responses) {
      for (const [statusCode, schema] of Object.entries(requestBodiesAndResponses.responses)) {
        const getContent = () => {
          try {
            return JSON.stringify(schema, null, 2);
          } catch (error) {
            // Handle circular references in JSON.stringify
            const seen = new WeakSet();
            return JSON.stringify(
              schema,
              (key, value) => {
                if (typeof value === 'object' && value !== null) {
                  if (seen.has(value)) return '[Circular]'; // Handle circular references
                  seen.add(value);
                }
                return value;
              },
              2
            );
          }
        };

        await addFileToMessage(
          message.id,
          {
            fileName: `response-${statusCode}.json`,
            content: getContent(),
          },
          message.version
        );
      }
    }

    console.log(chalk.cyan(` - Message (v${message.version}) created`));
    if (!operation.operationId) {
      console.log(chalk.yellow(`  - OperationId not found for ${operation.method} ${operation.path}, creating one...`));
      console.log(chalk.yellow(`  - Use operationIds to give better unique names for EventCatalog`));
    }
  }
  return { receives, sends };
};

const getParsedSpecFile = (service: Service, document: OpenAPI.Document) => {
  const specPath = service.path as string;
  const isSpecFileJSON = specPath.endsWith('.json');
  return isSpecFileJSON ? JSON.stringify(document, null, 2) : yaml.dump(document, { noRefs: true });
};

const getRawSpecFile = async (service: Service) => {
  const specPath = service.path as string;
  if (specPath.startsWith('http')) {
    const fetchOptions: RequestInit = { method: 'GET' };
    if (service.headers && Object.keys(service.headers).length > 0) {
      fetchOptions.headers = service.headers;
    }
    const file = await fetch(specPath, fetchOptions);
    if (!file.ok) {
      throw new Error(`Failed to fetch file: ${specPath}, status: ${file.status}`);
    }
    return await file.text();
  }
  return await readFile(specPath, 'utf8');
};
