import { OpenAPI } from 'openapi-types';
import { getSchemasByOperationId } from './openapi';
import { Message, MessageIdConfig, OpenAPIOperation, OpenAPIParameter, Operation } from '../types';
import slugify from 'slugify';

const markdownForParameters = (parameters: OpenAPIParameter[]) => {
  let markdown = '### Parameters\n';

  for (const parameter of parameters) {
    markdown += `- **${parameter.name}** (${parameter.in})`;
    if (parameter.required) {
      markdown += ' (required)';
    }
    if (parameter.description) {
      markdown += `: ${parameter.description}`;
    }
    markdown += '\n';
  }

  return markdown;
};

export const markdownForResponses = (openAPIOperation: OpenAPIOperation) => {
  let markdown = '### Responses\n\n';

  const getStatusCodeColor = (code: string) => {
    const firstDigit = code[0];
    switch (firstDigit) {
      case '2':
        return 'green';
      case '4':
        return 'orange';
      case '5':
        return 'red';
      default:
        return 'gray';
    }
  };

  for (const [statusCode, content] of Object.entries(openAPIOperation.responses as any)) {
    const color = getStatusCodeColor(statusCode);
    const statusText =
      {
        '200': 'OK',
        '201': 'Created',
        '202': 'Accepted',
        '204': 'No Content',
        '301': 'Moved Permanently',
        '302': 'Found',
        '304': 'Not Modified',
        '400': 'Bad Request',
        '401': 'Unauthorized',
        '403': 'Forbidden',
        '404': 'Not Found',
        '405': 'Method Not Allowed',
        '409': 'Conflict',
        '422': 'Unprocessable Entity',
        '429': 'Too Many Requests',
        '500': 'Internal Server Error',
        '502': 'Bad Gateway',
        '503': 'Service Unavailable',
        '504': 'Gateway Timeout',
      }[statusCode] || '';

    markdown += `#### <span className="text-${color}-500">${statusCode}${statusText ? ` ${statusText}` : ''}</span>\n`;

    // Add description if available
    if ((content as any).description) {
      markdown += `${(content as any).description}\n`;
    }

    // Add schema viewer or JSON content
    if ((content as any).isSchema) {
      markdown += `<SchemaViewer file="response-${statusCode}.json" maxHeight="500" id="response-${statusCode}" />\n\n`;
    } else {
      markdown += `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\`\n\n`;
    }
  }

  return markdown;
};

export const defaultMarkdown = (message: Operation, openAPIOperation: OpenAPIOperation = {}) => {
  return `
${
  message.description
    ? `
## Overview
${escapeSpecialCharactersThatBreakMarkdown(message.description)}
`
    : ''
}

${
  message.externalDocs
    ? `
## External documentation
- [${message.externalDocs.description}](${message.externalDocs.url})
`
    : ''
}

## ${message.method.toUpperCase()} \`(${message.path})\`

${openAPIOperation.parameters && openAPIOperation.parameters.length > 0 ? markdownForParameters(openAPIOperation.parameters) : ''}

${
  openAPIOperation.requestBody
    ? `
### Request Body
<SchemaViewer file="request-body.json" maxHeight="500" id="request-body" />
`
    : ''
}

${markdownForResponses(openAPIOperation)}

## Architecture

<NodeGraph />

`;
};

export const escapeSpecialCharactersThatBreakMarkdown = (text: string) => {
  // find code blocks, and don't escape the curly braces within them, but escape the rest
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks: string[] = [];
  const placeholders: string[] = [];

  // Replace code blocks with placeholders and store them
  let processedText = text.replace(codeBlockRegex, (match, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    codeBlocks.push(match);
    placeholders.push(placeholder);
    return placeholder;
  });

  // Escape curly braces in the text outside of code blocks
  processedText = processedText.replace(/{/g, '\\{').replace(/}/g, '\\}');

  // Restore code blocks with their original curly braces
  placeholders.forEach((placeholder, index) => {
    processedText = processedText.replace(placeholder, codeBlocks[index]);
  });

  return processedText;
};

export const getSummary = (message: Operation) => {
  const messageSummary = message.summary ? message.summary : '';
  const messageDescription = message.description ? message.description : '';

  let eventCatalogMessageSummary = messageSummary;

  if (!eventCatalogMessageSummary) {
    eventCatalogMessageSummary = messageDescription && messageDescription.length < 150 ? messageDescription : '';
  }

  return escapeSpecialCharactersThatBreakMarkdown(eventCatalogMessageSummary);
};

export const buildMessage = async (
  pathToFile: string,
  document: OpenAPI.Document,
  operation: Operation,
  generateMarkdown?: ({}: { operation: Operation; markdown: string }) => string,
  messageIdConfig?: MessageIdConfig,
  serviceId?: string,
  serviceVersion?: string
) => {
  // Pass the document to avoid re-parsing (needed for authenticated URLs)
  const requestBodiesAndResponses = await getSchemasByOperationId(pathToFile, operation.operationId, document as any);
  const extensions = operation.extensions || {};

  const operationTags = operation.tags.map((badge) => ({
    content: `tag:${badge}`,
    textColor: 'blue',
    backgroundColor: 'blue',
  }));

  const badges = [{ content: operation.method.toUpperCase(), textColor: 'blue', backgroundColor: 'blue' }, ...operationTags];

  const apiName = slugify(document.info.title, { lower: true });
  const path = operation.path.replace(/\//, '').replace(/\//g, '_');
  let uniqueIdentifier = operation.operationId || `${apiName}_${operation.method}`;

  if (!operation.operationId && path) {
    uniqueIdentifier = uniqueIdentifier.concat(`_${path}`);
  }

  const httpVerb = operation.method.toUpperCase() || '';
  const generatedMarkdownForMessage = defaultMarkdown(operation, requestBodiesAndResponses);

  if (messageIdConfig?.prefix) {
    const separator = messageIdConfig.separator || '-';
    uniqueIdentifier = [messageIdConfig.prefix, uniqueIdentifier].join(separator);
  }

  // Put this before the prefixWithServiceId check so that the folder name is the same as the id
  const messageName = extensions['x-eventcatalog-message-id'] || uniqueIdentifier;
  const messageVersion = extensions['x-eventcatalog-message-version'] || serviceVersion || document.info.version;

  if (messageIdConfig?.prefixWithServiceId) {
    const separator = messageIdConfig.separator || '-';
    uniqueIdentifier = [serviceId, uniqueIdentifier].join(separator);
  }

  // Build the operation frontmatter (method, path, statusCodes)
  const validOperationMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const operationMethod = operation.method.toUpperCase();
  let operationFrontmatter: { method?: string; path?: string; statusCodes?: string[] } | undefined;

  if (validOperationMethods.includes(operationMethod)) {
    const statusCodes = requestBodiesAndResponses?.responses
      ? Object.keys(requestBodiesAndResponses.responses).filter((code) => code !== 'default')
      : [];

    operationFrontmatter = {
      method: operationMethod as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      path: operation.path,
      ...(statusCodes.length > 0 ? { statusCodes } : {}),
    };
  }

  return {
    id: extensions['x-eventcatalog-message-id'] || uniqueIdentifier,
    version: messageVersion,
    name: extensions['x-eventcatalog-message-name'] || messageName,
    summary: getSummary(operation),
    markdown: generateMarkdown
      ? generateMarkdown({ operation, markdown: generatedMarkdownForMessage })
      : generatedMarkdownForMessage,
    schemaPath: requestBodiesAndResponses?.requestBody ? 'request-body.json' : '',
    badges,
    requestBodiesAndResponses,
    sidebar: {
      badge: httpVerb,
    },
    messageName,
    ...(extensions['x-eventcatalog-draft'] ? { draft: true } : {}),
    ...(operation.deprecated ? { deprecated: operation.deprecated } : {}),
    ...(operationFrontmatter ? { operation: operationFrontmatter } : {}),
  };
};
