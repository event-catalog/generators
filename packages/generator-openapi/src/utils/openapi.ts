import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIDocument, OpenAPIOperation, OpenAPIParameter, Operation } from '../types';
import { HTTP_METHOD, HTTP_METHOD_TO_MESSAGE_TYPE } from '../index';
const DEFAULT_MESSAGE_TYPE = 'query';

export async function getSchemasByOperationId(
  filePath: string,
  operationId: string | undefined,
  parsedDocument?: OpenAPIDocument,
  operationLookup?: { path: string; method: string }
): Promise<OpenAPIOperation | undefined> {
  try {
    // Use pre-parsed document if provided, otherwise parse from file
    const api = parsedDocument || ((await SwaggerParser.dereference(filePath)) as OpenAPIDocument);
    const schemas: {
      parameters: OpenAPIParameter[];
      requestBody: any;
      responses: { [statusCode: string]: any };
    } = {
      parameters: [],
      requestBody: null,
      responses: {},
    };

    // Iterate through paths and operations
    for (const [path, pathItem] of Object.entries(api.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Cast operation to OpenAPIOperation type
        const typedOperation = operation as OpenAPIOperation;

        const matchesByOperationId = operationId ? typedOperation.operationId === operationId : false;
        const matchesByPathAndMethod = operationLookup
          ? path === operationLookup.path && method.toUpperCase() === operationLookup.method.toUpperCase()
          : false;

        if (matchesByOperationId || matchesByPathAndMethod) {
          // Extract query parameters
          if (typedOperation.parameters) {
            schemas.parameters = typedOperation.parameters;
          }

          // Extract request body schema
          if (typedOperation.requestBody && typedOperation.requestBody.content) {
            const contentType = Object.keys(typedOperation.requestBody.content)[0];
            schemas.requestBody = typedOperation.requestBody.content[contentType].schema;
          }

          // Extract response schemas (clone to avoid mutating the original document)
          if (typedOperation.responses) {
            for (const [statusCode, response] of Object.entries(typedOperation.responses)) {
              if (response.content) {
                const contentType = Object.keys(response.content)[0];
                const schemaOrContent = response.content[contentType].schema || response.content[contentType];
                schemas.responses[statusCode] = { ...schemaOrContent };
                schemas.responses[statusCode].isSchema = !!response.content[contentType].schema;
              }
            }
          }

          return schemas;
        }
      }
    }

    throw new Error(
      operationId
        ? `Operation with ID "${operationId}" not found.`
        : `Operation not found for ${operationLookup?.method || 'UNKNOWN'} ${operationLookup?.path || ''}.`
    );
  } catch (error) {
    console.error('Error parsing OpenAPI file or finding operation:', error);
    return;
  }
}

function getDeprecatedValues(openAPIOperation: any) {
  const deprecatedDate = openAPIOperation['x-eventcatalog-deprecated-date'] || null;
  const deprecatedMessage = openAPIOperation['x-eventcatalog-deprecated-message'] || null;
  const isNativeDeprecated = openAPIOperation.deprecated;
  let deprecated = isNativeDeprecated;

  if (deprecatedDate) {
    deprecated = {
      date: deprecatedDate,
      message: deprecatedMessage,
    };
  }

  return deprecated;
}

export async function getOperationsByType(
  openApiPath: string,
  httpMethodsToMessages?: HTTP_METHOD_TO_MESSAGE_TYPE,
  parsedDocument?: any
) {
  try {
    // Use pre-parsed document if provided, otherwise parse from file
    const api = parsedDocument || (await SwaggerParser.validate(openApiPath));

    const operations = [];

    // Iterate through paths
    for (const path in api.paths) {
      const pathItem = api.paths[path];

      // Iterate through each HTTP method in the path
      for (const method in pathItem) {
        // @ts-ignore
        const openAPIOperation = pathItem[method];

        const defaultMessageType = httpMethodsToMessages?.[method.toUpperCase() as HTTP_METHOD] || DEFAULT_MESSAGE_TYPE;

        const deprecated = getDeprecatedValues(openAPIOperation);

        // Check if the x-eventcatalog-message-type field is set
        const messageType = openAPIOperation['x-eventcatalog-message-type'] || defaultMessageType;

        const messageAction = openAPIOperation['x-eventcatalog-message-action'] === 'sends' ? 'sends' : 'receives';
        const extensions = Object.keys(openAPIOperation).reduce((acc: { [key: string]: any }, key) => {
          if (key.startsWith('x-eventcatalog-')) {
            acc[key] = openAPIOperation[key];
          }
          return acc;
        }, {});

        const operation = {
          path: path,
          method: method.toUpperCase(),
          operationId: openAPIOperation.operationId,
          externalDocs: openAPIOperation.externalDocs,
          type: messageType,
          action: messageAction,
          description: openAPIOperation.description,
          summary: openAPIOperation.summary,
          tags: openAPIOperation.tags || [],
          extensions,
          ...(deprecated ? { deprecated } : {}),
        } as Operation;

        operations.push(operation);
      }
    }

    return operations;
  } catch (err) {
    console.error('Error parsing OpenAPI document:', err);
    return [];
  }
}
