import { AsyncAPIDocumentInterface, MessageInterface, Parser, fromFile, fromURL } from '@asyncapi/parser';
import utils from '@eventcatalog/sdk';
import { readFile } from 'node:fs/promises';
import argv from 'minimist';
import yaml from 'js-yaml';
import { z } from 'zod';
import chalk from 'chalk';
import path from 'path';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

// AsyncAPI Parsers
import { AvroSchemaParser } from '@asyncapi/avro-schema-parser';

import {
  defaultMarkdown as generateMarkdownForMessage,
  getChannelsForMessage,
  getMessageName,
  getSummary as getMessageSummary,
  getSchemaFileName,
  messageHasSchema,
} from './utils/messages';
import { defaultMarkdown as generateMarkdownForService, getSummary as getServiceSummary } from './utils/services';
import { defaultMarkdown as generateMarkdownForDomain } from './utils/domains';
import { defaultMarkdown as generateMarkdownForChannel, getChannelProtocols, getChannelTags } from './utils/channels';
import checkLicense from '../../../shared/checkLicense';

import { EventType, MessageOperations } from './types';
import { join } from 'node:path';

const parser = new Parser();

// register avro schema support
parser.registerSchemaParser(AvroSchemaParser());
const cliArgs = argv(process.argv.slice(2));

const optionsSchema = z.object({
  licenseKey: z.string().optional(),
  writeFilesToRoot: z.boolean().optional(),
  services: z.array(
    z.object({
      id: z.string({ required_error: 'The service id is required. please provide the service id' }),
      version: z.string().optional(),
      path: z.string({ required_error: 'The service path is required. please provide the path to specification file' }),
      draft: z.boolean().optional(),
      name: z.string().optional(),
      summary: z.string().optional(),
      writesTo: z.array(z.object({ id: z.string(), version: z.string().optional() })).optional(),
      readsFrom: z.array(z.object({ id: z.string(), version: z.string().optional() })).optional(),
      owners: z.array(z.string()).optional(),
      headers: z.record(z.string()).optional(),
      generateMarkdown: z
        .function()
        .args(
          z.object({
            service: z.object({
              id: z.string(),
              name: z.string(),
              version: z.string(),
            }),
            // AsyncAPI Interface
            document: z.any(),
            markdown: z.string().optional(),
          })
        )
        .returns(z.string())
        .optional(),
    }),
    { message: 'Please provide correct services configuration' }
  ),
  messages: z
    .object({
      id: z
        .object({
          lowerCase: z.boolean().optional(),
          prefix: z.string().optional(),
          separator: z.string().optional(),
          prefixWithServiceId: z.boolean().optional(),
        })
        .optional(),
      generateMarkdown: z
        .function()
        .args(
          z.object({
            message: z.any(),
            document: z.any(),
            markdown: z.string().optional(),
          })
        )
        .returns(z.string())
        .optional(),
    })
    .optional(),
  domain: z
    .object({
      id: z.string({ required_error: 'The domain id is required. please provide a domain id' }),
      name: z.string({ required_error: 'The domain name is required. please provide a domain name' }),
      owners: z.array(z.string()).optional(),
      version: z.string({ required_error: 'The domain version is required. please provide a domain version' }),
      draft: z.boolean().optional(),
      // function that takes options (including domain) and returns a string
      generateMarkdown: z
        .function()
        .args(
          z.object({
            domain: z.object({
              id: z.string(),
              name: z.string(),
              version: z.string(),
            }),
            markdown: z.string().optional(),
          })
        )
        .returns(z.string())
        .optional(),
    })
    .optional(),
  debug: z.boolean().optional(),
  parseSchemas: z.boolean().optional(),
  parseChannels: z.boolean().optional(),
  saveParsedSpecFile: z.boolean({ invalid_type_error: 'The saveParsedSpecFile is not a boolean in options' }).optional(),
});

type Props = z.infer<typeof optionsSchema>;
type Domain = z.infer<typeof optionsSchema>['domain'];
type Service = z.infer<typeof optionsSchema>['services'][0];

const toUniqueArray = (array: { id: string; version: string }[]) => {
  return array.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id && t.version === item.version));
};

// Helper to merge asyncapi path into existing specifications, preserving format (array or object)
const mergeAsyncApiIntoSpecifications = (existingSpecs: any, asyncapiFileName: string): any => {
  if (Array.isArray(existingSpecs)) {
    return [...existingSpecs.filter((spec: any) => spec.type !== 'asyncapi'), { type: 'asyncapi', path: asyncapiFileName }];
  }
  return { ...existingSpecs, asyncapiPath: asyncapiFileName };
};

const validateOptions = (options: Props) => {
  try {
    optionsSchema.parse(options);
  } catch (error: any) {
    if (error instanceof z.ZodError) throw new Error(JSON.stringify(error.issues, null, 2));
  }
};

export default async (config: any, options: Props) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check for license and package update
  const LICENSE_KEY: string = process.env.EVENTCATALOG_LICENSE_KEY_ASYNCAPI || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  const {
    writeService,
    writeEvent,
    writeCommand,
    writeQuery,
    getService,
    versionService,
    getDomain,
    writeDomain,
    addServiceToDomain,
    getCommand,
    getEvent,
    getQuery,
    versionCommand,
    versionEvent,
    versionQuery,
    addSchemaToCommand,
    addSchemaToEvent,
    addSchemaToQuery,
    addFileToService,
    versionDomain,
    getSpecificationFilesForService,
    writeChannel,
    getChannel,
    versionChannel,
  } = utils(process.env.PROJECT_DIR);

  // Define the message operations mapping with proper types
  const MESSAGE_OPERATIONS: Record<EventType, MessageOperations> = {
    event: {
      write: writeEvent,
      version: versionEvent,
      get: getEvent,
      addSchema: addSchemaToEvent,
      collection: 'events',
    },
    command: {
      write: writeCommand,
      version: versionCommand,
      get: getCommand,
      addSchema: addSchemaToCommand,
      collection: 'commands',
    },
    query: {
      write: writeQuery,
      version: versionQuery,
      get: getQuery,
      addSchema: addSchemaToQuery,
      collection: 'queries',
    },
  };

  // Should the file that is written to the catalog be parsed (https://github.com/asyncapi/parser-js) or as it is?
  validateOptions(options);

  const { services, saveParsedSpecFile = false, parseSchemas = true, parseChannels = false } = options;
  // const asyncAPIFiles = Array.isArray(options.path) ? options.path : [options.path];
  console.log(chalk.green(`Processing ${services.length} AsyncAPI files...`));
  for (const service of services) {
    console.log(chalk.gray(`Processing ${service.path}`));

    const { document, diagnostics } = service.path.startsWith('http')
      ? await fromURL(parser, service.path, { headers: service.headers }).parse({
          parseSchemas,
        })
      : await fromFile(parser, service.path).parse({
          parseSchemas,
        });

    if (!document) {
      console.log(chalk.red('Failed to parse AsyncAPI file'));
      if (options.debug || cliArgs.debug) {
        console.log(diagnostics);
      } else {
        console.log(chalk.red('Run with debug option in the generator to see diagnostics'));
      }
      continue;
    }

    const operations = document.allOperations();
    const channels = document.allChannels();
    const documentTags = document.info().tags().all() || [];
    const isDomainMarkedAsDraft = options.domain?.draft || false;
    const isServiceMarkedAsDraft =
      isDomainMarkedAsDraft || document.info().extensions().get('x-eventcatalog-draft')?.value() || service.draft || false;

    const serviceId = service.id;

    const serviceName = service.name || document.info().title();
    const version = service.version || document.info().version();

    // What messages does this service send and receive
    let sends = [];
    let receives = [];

    let owners = service.owners || null;
    let repository = null;
    let badges = null;
    let attachments = null;

    let serviceSpecifications: any = {};
    let serviceSpecificationsFiles: Array<{ fileName: string; content: string }> = [];
    let configuredWritesTo = service.writesTo || ([] as any);
    let configuredReadsFrom = service.readsFrom || ([] as any);
    let serviceWritesTo = configuredWritesTo;
    let serviceReadsFrom = configuredReadsFrom;

    const generatedMarkdownForService = generateMarkdownForService(document);
    let serviceMarkdown = service.generateMarkdown
      ? service.generateMarkdown({
          service: { id: service.id, name: serviceName, version },
          document,
          markdown: generatedMarkdownForService,
        })
      : generatedMarkdownForService;
    let styles = null;
    // Have to ../ as the SDK will put the files into hard coded folders
    let servicePath = options.domain
      ? path.join('../', 'domains', options.domain.id, 'services', service.id)
      : path.join('../', 'services', service.id);
    if (options.writeFilesToRoot) {
      servicePath = service.id;
    }

    // Manage domain
    if (options.domain) {
      // Try and get the domain
      const { id: domainId, name: domainName, version: domainVersion, owners: domainOwners } = options.domain;
      const domain = await getDomain(options.domain.id, domainVersion || 'latest');
      const currentDomain = await getDomain(options.domain.id, 'latest');
      const domainIsDraft = isDomainMarkedAsDraft || currentDomain?.draft || false;

      console.log(chalk.blue(`\nProcessing domain: ${domainName} (v${domainVersion})`));

      // Found a domain, but the versions do not match
      if (currentDomain && currentDomain.version !== domainVersion) {
        await versionDomain(domainId);
        console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
      }

      // Do we need to create a new domain?
      if (!domain || (domain && domain.version !== domainVersion)) {
        const generatedMarkdownForDomain = generateMarkdownForDomain(document);
        await writeDomain({
          id: domainId,
          name: domainName,
          version: domainVersion,
          markdown: options.domain?.generateMarkdown
            ? options.domain.generateMarkdown({ domain: options.domain, markdown: generatedMarkdownForDomain })
            : generatedMarkdownForDomain,
          ...(domainOwners && { owners: domainOwners }),
          ...(domainIsDraft && { draft: true }),
          // services: [{ id: serviceId, version: version }],
        });
        console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));
      }

      if (currentDomain && currentDomain.version === domainVersion) {
        console.log(chalk.yellow(` - Domain (v${domainVersion}) already exists, skipped creation...`));
      }

      // Add the service to the domain
      await addServiceToDomain(domainId, { id: serviceId, version: version }, domainVersion);
    }

    // Parse channels
    if (parseChannels) {
      for (const channel of channels) {
        const channelAsJSON = channel.json();
        const channelId = channel.id();
        const params = channelAsJSON?.parameters || {};
        const protocols = getChannelProtocols(channel);
        const channelTags: string[] = getChannelTags(channel);
        const channelVersion = channel.extensions().get('x-eventcatalog-channel-version')?.value() || version;
        let channelMarkdown = generateMarkdownForChannel(document, channel);

        console.log(chalk.blue(`Processing channel: ${channelId} (v${channelVersion})`));

        const paramsForCatalog = Object.keys(params).reduce(
          (acc, key) => {
            const param = params[key];
            acc[key] = {};
            if (param.enum) acc[key].enum = param.enum;
            if (param.default) acc[key].default = param.default;
            if (param.examples) acc[key].examples = param.examples;
            if (param.description) acc[key].description = param.description;
            return acc;
          },
          {} as Record<string, { enum?: string[]; default?: string; examples?: string[]; description?: string }>
        );

        const catalogedChannel = await getChannel(channelId, 'latest');

        if (catalogedChannel) {
          channelMarkdown = catalogedChannel.markdown;
          if (catalogedChannel.version !== channelVersion) {
            await versionChannel(channelId);
            console.log(chalk.cyan(` - Versioned previous channel: ${channelId} (v${channelVersion})`));
          }
        }

        await writeChannel(
          {
            id: channelId,
            name: channelAsJSON?.title || channel.id(),
            markdown: channelMarkdown,
            version: channelVersion,
            ...(Object.keys(paramsForCatalog).length > 0 && { parameters: paramsForCatalog }),
            ...(channel.address() && { address: channel.address() }),
            ...(channelAsJSON?.summary && { summary: channelAsJSON.summary }),
            ...(channelTags.length > 0 && {
              badges: channelTags.map((tagName) => ({ content: tagName, textColor: 'blue', backgroundColor: 'blue' })),
            }),
            ...(protocols.length > 0 && { protocols }),
            ...((isDomainMarkedAsDraft || isServiceMarkedAsDraft) && { draft: true }),
          },
          { override: true }
        );

        console.log(chalk.cyan(` - Message ${channelId} (v${version}) created`));
      }
    }

    // Find events/commands
    for (const operation of operations) {
      for (const message of operation.messages()) {
        const eventType = (message.extensions().get('x-eventcatalog-message-type')?.value() as EventType) || 'event';
        const messageVersion = message.extensions().get('x-eventcatalog-message-version')?.value() || version;
        const deprecatedDate = message.extensions().get('x-eventcatalog-deprecated-date')?.value() || null;
        const deprecatedMessage = message.extensions().get('x-eventcatalog-deprecated-message')?.value() || null;
        const isMessageMarkedAsDraft =
          isDomainMarkedAsDraft || isServiceMarkedAsDraft || message.extensions().get('x-eventcatalog-draft')?.value() || null;

        // does this service own or just consume the message?
        const serviceOwnsMessageContract = isServiceMessageOwner(message);
        const isReceived = operation.action() === 'receive' || operation.action() === 'subscribe';
        const isSent = operation.action() === 'send' || operation.action() === 'publish';

        let messageId = options.messages?.id?.lowerCase ? message.id().toLowerCase() : message.id();
        const messageName = messageId;

        if (eventType !== 'event' && eventType !== 'command' && eventType !== 'query') {
          throw new Error('Invalid message type');
        }

        if (options.messages?.id?.prefix) {
          messageId = [options.messages.id.prefix, messageId].join(options.messages.id.separator || '-');
        }

        if (options.messages?.id?.prefixWithServiceId) {
          messageId = [serviceId, messageId].join(options.messages.id.separator || '-');
        }

        const {
          write: writeMessage,
          version: versionMessage,
          get: getMessage,
          addSchema: addSchemaToMessage,
          collection: folder,
        } = MESSAGE_OPERATIONS[eventType];

        const generatedMarkdownForMessage = generateMarkdownForMessage(document, message);
        let messageMarkdown = options.messages?.generateMarkdown
          ? options.messages.generateMarkdown({ message, document, markdown: generatedMarkdownForMessage })
          : generatedMarkdownForMessage;
        const badges = message.tags().all() || [];

        let messageBadges = null;
        let messageAttachments = null;

        console.log(chalk.blue(`Processing message: ${getMessageName(message)} (v${messageVersion})`));

        let messagePath = join(servicePath, folder, messageName);
        if (options.writeFilesToRoot) {
          messagePath = messageId;
        }

        if (serviceOwnsMessageContract) {
          // Check if the message already exists in the catalog
          const catalogedMessage = await getMessage(messageId, 'latest');

          if (catalogedMessage) {
            // persist markdown, badges and attachments if it exists
            messageMarkdown = catalogedMessage.markdown;
            messageBadges = catalogedMessage.badges || null;
            messageAttachments = catalogedMessage.attachments || null;

            if (catalogedMessage.version !== messageVersion) {
              // if the version does not match, we need to version the message
              await versionMessage(messageId);
              console.log(chalk.cyan(` - Versioned previous message: (v${catalogedMessage.version})`));
            }
          }

          const channelsForMessage = parseChannels ? getChannelsForMessage(message, channels, document) : [];

          await writeMessage(
            {
              id: messageId,
              version: messageVersion,
              name: getMessageName(message),
              summary: getMessageSummary(message),
              markdown: messageMarkdown,
              badges:
                messageBadges || badges.map((badge) => ({ content: badge.name(), textColor: 'blue', backgroundColor: 'blue' })),
              ...(messageHasSchema(message) && { schemaPath: getSchemaFileName(message) }),
              ...(owners && { owners }),
              ...(messageAttachments && { attachments: messageAttachments }),
              ...(channelsForMessage.length > 0 && { channels: channelsForMessage }),
              ...(deprecatedDate && {
                deprecated: { date: deprecatedDate, ...(deprecatedMessage && { message: deprecatedMessage }) },
              }),
              ...(isMessageMarkedAsDraft && { draft: true }),
            },
            {
              override: true,
              path: messagePath,
            }
          );

          console.log(chalk.cyan(` - Message (v${messageVersion}) created`));

          // Check if the message has a payload, if it does then document in EventCatalog
          if (messageHasSchema(message)) {
            // Get the schema from the original payload if it exists
            let schema = message.payload()?.extensions()?.get('x-parser-original-payload')?.json() || message.payload()?.json();

            // Sometimes the payload comes back with the schema nested in the payload
            // if thats the case, we need to extract the schema from the payload (e.g async-file-with-schema-format.yml in tests folder)
            if (schema?.schema) {
              schema = schema.schema;
            }

            // Normalize path separators and remove leading relative path segments (../ or ./ for both Unix and Windows)
            const cleanedMessagePath = messagePath
              .replace(/\\/g, '/') // Convert all backslashes to forward slashes
              .replace(/^(\.\.\/|\.\/)+/g, ''); // Remove all leading ../ or ./ segments

            await addSchemaToMessage(
              messageId,
              {
                fileName: getSchemaFileName(message),
                schema: JSON.stringify(schema, null, 4),
              },
              messageVersion,
              { path: cleanedMessagePath }
            );
            console.log(chalk.cyan(` - Schema added to message (v${messageVersion})`));
          }
        } else {
          // Message is not owned by this service, therefore we don't need to document it
          console.log(chalk.yellow(` - Skipping external message: ${getMessageName(message)}(v${messageVersion})`));
        }
        // Add the message to the correct array
        if (isSent) sends.push({ id: messageId, version: messageVersion });
        if (isReceived) receives.push({ id: messageId, version: messageVersion });
      }
    }

    // Check if service is already defined... if the versions do not match then create service.
    const latestServiceInCatalog = await getService(serviceId, 'latest');

    console.log(chalk.blue(`Processing service: ${serviceId} (v${version})`));

    if (latestServiceInCatalog) {
      // persist data between versioning and matching
      serviceMarkdown = latestServiceInCatalog.markdown;
      owners = latestServiceInCatalog.owners || owners;
      repository = latestServiceInCatalog.repository || null;
      styles = latestServiceInCatalog.styles || null;
      badges = latestServiceInCatalog.badges || null;
      attachments = latestServiceInCatalog.attachments || null;
      // persist writesTo and readsFrom
      serviceWritesTo = latestServiceInCatalog.writesTo ? latestServiceInCatalog.writesTo : configuredWritesTo;
      serviceReadsFrom = latestServiceInCatalog.readsFrom ? latestServiceInCatalog.readsFrom : configuredReadsFrom;

      // Found a service, and versions do not match, we need to version the one already there
      if (latestServiceInCatalog.version !== version) {
        await versionService(serviceId);
        console.log(chalk.cyan(` - Versioned previous service (v${latestServiceInCatalog.version})`));
      }

      // Match found, persist data
      if (latestServiceInCatalog.version === version) {
        serviceMarkdown = latestServiceInCatalog.markdown;
        serviceSpecifications = latestServiceInCatalog.specifications ?? {};
        sends = latestServiceInCatalog.sends ? [...latestServiceInCatalog.sends, ...sends] : sends;
        receives = latestServiceInCatalog.receives ? [...latestServiceInCatalog.receives, ...receives] : receives;
        serviceSpecificationsFiles = await getSpecificationFilesForService(serviceId, version);
        serviceWritesTo = latestServiceInCatalog.writesTo
          ? toUniqueArray([...latestServiceInCatalog.writesTo, ...configuredWritesTo])
          : configuredWritesTo;
        serviceReadsFrom = latestServiceInCatalog.readsFrom
          ? toUniqueArray([...latestServiceInCatalog.readsFrom, ...configuredReadsFrom])
          : configuredReadsFrom;
      }
    }

    const fileName = path.basename(service.path);

    await writeService(
      {
        id: serviceId,
        name: serviceName,
        version: version,
        summary: service.summary || getServiceSummary(document),
        badges: badges || documentTags.map((tag) => ({ content: tag.name(), textColor: 'blue', backgroundColor: 'blue' })),
        markdown: serviceMarkdown,
        sends,
        receives,
        schemaPath: fileName || 'asyncapi.yml',
        specifications: mergeAsyncApiIntoSpecifications(serviceSpecifications, fileName || 'asyncapi.yml'),
        ...(owners && { owners }),
        ...(repository && { repository }),
        ...(styles && { styles }),
        ...(isServiceMarkedAsDraft && { draft: true }),
        ...(attachments && { attachments }),
        ...(serviceWritesTo.length > 0 ? { writesTo: serviceWritesTo } : {}),
        ...(serviceReadsFrom.length > 0 ? { readsFrom: serviceReadsFrom } : {}),
      },
      {
        path: servicePath,
        override: true,
      }
    );

    // What files need added to the service (speficiation files)
    const specFiles = [
      // add any previous spec files to the list
      ...serviceSpecificationsFiles,
      {
        content: saveParsedSpecFile ? getParsedSpecFile(service, document) : await getRawSpecFile(service),
        fileName: path.basename(service.path) || 'asyncapi.yml',
      },
    ];

    for (const specFile of specFiles) {
      await addFileToService(
        serviceId,
        {
          fileName: specFile.fileName,
          content: specFile.content,
        },
        version
      );
    }

    console.log(chalk.cyan(` - Service (v${version}) created`));

    console.log(chalk.green(`\nFinished generating event catalog for AsyncAPI ${serviceId} (v${version})`));
  }
};

const getParsedSpecFile = (service: Service, document: AsyncAPIDocumentInterface) => {
  const isSpecFileJSON = service.path.endsWith('.json');
  return isSpecFileJSON
    ? JSON.stringify(document.meta().asyncapi.parsed, null, 4)
    : yaml.dump(document.meta().asyncapi.parsed, { noRefs: true });
};

const getRawSpecFile = async (service: Service) => {
  if (service.path.startsWith('http')) {
    try {
      const fetchOptions: RequestInit = { method: 'GET' };
      if (service.headers && Object.keys(service.headers).length > 0) {
        fetchOptions.headers = service.headers;
      }
      const response = await fetch(service.path, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    } catch (error) {
      console.log(chalk.red(`\nFailed to request AsyncAPI file from ${service.path}`));
      return '';
    }
  } else {
    return await readFile(service.path, 'utf8');
  }
};
/**
 * Is the AsyncAPI specification (service) the owner of the message?
 * This is determined by the 'x-eventcatalog-role' extension in the message
 *
 * @param message
 * @returns boolean
 *
 * default is provider (AsyncAPI file / service owns the message)
 */
const isServiceMessageOwner = (message: MessageInterface): boolean => {
  const value = message.extensions().get('x-eventcatalog-role')?.value() || 'provider';
  return value === 'provider';
};
