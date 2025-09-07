import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIDocument, OpenAPIOperation, OpenAPIParameter, Operation } from '../types';
import { HTTP_METHOD, HTTP_METHOD_TO_MESSAGE_TYPE } from '../index';
const DEFAULT_MESSAGE_TYPE = 'query';

export async function getSchemasByOperationId(filePath: string, operationId: string): Promise<OpenAPIOperation | undefined> {
  try {
    // Parse and resolve all references in the OpenAPI document
    const api = (await SwaggerParser.dereference(filePath)) as OpenAPIDocument;
    const schemas: {
      parameters: OpenAPIParameter[];
      requestBody: any;
      responses: { [statusCode: string]: any };
    } = {
      parameters: [],
      requestBody: null,
      responses: {},
    };

    // Valid HTTP methods in OpenAPI 3.0
    const validHttpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    // Iterate through paths and operations
    for (const [path, pathItem] of Object.entries(api.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip non-HTTP method properties like 'parameters', 'summary', 'description', '$ref', 'servers'
        if (!validHttpMethods.includes(method.toLowerCase())) {
          continue;
        }

        // Cast operation to OpenAPIOperation type
        const typedOperation = operation as OpenAPIOperation;

        if (typedOperation.operationId === operationId) {
          // Extract query parameters
          if (typedOperation.parameters) {
            schemas.parameters = typedOperation.parameters;
          }

          // Extract request body schema
          if (typedOperation.requestBody && typedOperation.requestBody.content) {
            const contentType = Object.keys(typedOperation.requestBody.content)[0];
            schemas.requestBody = typedOperation.requestBody.content[contentType].schema;
          }

          // Extract response schemas
          if (typedOperation.responses) {
            for (const [statusCode, response] of Object.entries(typedOperation.responses)) {
              if (response.content) {
                const contentType = Object.keys(response.content)[0];
                schemas.responses[statusCode] = response.content[contentType].schema || response.content[contentType];
                schemas.responses[statusCode].isSchema = !!response.content[contentType].schema;
              }
            }
          }

          return schemas;
        }
      }
    }

    throw new Error(`Operation with ID "${operationId}" not found.`);
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

export async function getOperationsByType(openApiPath: string, httpMethodsToMessages?: HTTP_METHOD_TO_MESSAGE_TYPE) {
  try {
    // Parse the OpenAPI document
    const api = await SwaggerParser.validate(openApiPath);

    const operations = [];

    // Valid HTTP methods in OpenAPI 3.0
    const validHttpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    // Iterate through paths
    for (const path in api.paths) {
      const pathItem = api.paths[path];

      // Iterate through each HTTP method in the path, but skip non-HTTP method properties
      for (const method in pathItem) {
        // Skip non-HTTP method properties like 'parameters', 'summary', 'description', '$ref', 'servers'
        if (!validHttpMethods.includes(method.toLowerCase())) {
          continue;
        }

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
