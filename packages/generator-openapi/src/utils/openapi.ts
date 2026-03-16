import SwaggerParser from '@apidevtools/swagger-parser';
import { HTTP_METHOD, HTTP_METHOD_TO_MESSAGE_TYPE } from '../index';
import { OpenAPIDocument, OpenAPIOperation, OpenAPIParameter, Operation } from '../types';
const DEFAULT_MESSAGE_TYPE = 'query';
// Valid HTTP methods in OpenAPI 3.0
const validHttpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export async function getSchemasByOperationId(
  filePath: string,
  operationId: string,
  parsedDocument?: OpenAPIDocument
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

    throw new Error(`Operation with ID "${operationId}" not found.`);
  } catch (error) {
    console.error('Error parsing OpenAPI file or finding operation:', error);
    return;
  }
}

export async function getExamplesByOperationId(
  filePath: string,
  operationId: string,
  parsedDocument?: OpenAPIDocument
): Promise<{ fileName: string; content: string }[]> {
  const api = parsedDocument || ((await SwaggerParser.dereference(filePath)) as OpenAPIDocument);
  const examples: { fileName: string; content: string }[] = [];

  for (const [, pathItem] of Object.entries(api.paths)) {
    for (const [, operation] of Object.entries(pathItem)) {
      const typedOperation = operation as OpenAPIOperation;
      if (typedOperation.operationId !== operationId) continue;

      // Extract request body examples
      if (typedOperation.requestBody?.content) {
        const contentType = Object.keys(typedOperation.requestBody.content)[0];
        const mediaType = typedOperation.requestBody.content[contentType];

        // Single example
        if (mediaType.example) {
          examples.push({ fileName: 'example.json', content: JSON.stringify(mediaType.example, null, 2) });
        }

        // Named examples
        if (mediaType.examples) {
          for (const [name, exampleObj] of Object.entries(mediaType.examples as Record<string, any>)) {
            if (exampleObj.value) {
              examples.push({ fileName: `${name}.json`, content: JSON.stringify(exampleObj.value, null, 2) });
            }
          }
        }
      }

      // Extract response examples
      if (typedOperation.responses) {
        for (const [statusCode, response] of Object.entries(typedOperation.responses)) {
          if (response.content) {
            const contentType = Object.keys(response.content)[0];
            const mediaType = response.content[contentType];

            if (mediaType.example) {
              examples.push({ fileName: `response-${statusCode}.json`, content: JSON.stringify(mediaType.example, null, 2) });
            }

            if (mediaType.examples) {
              for (const [name, exampleObj] of Object.entries(mediaType.examples as Record<string, any>)) {
                if (exampleObj.value) {
                  examples.push({
                    fileName: `response-${statusCode}-${name}.json`,
                    content: JSON.stringify(exampleObj.value, null, 2),
                  });
                }
              }
            }
          }
        }
      }

      return examples;
    }
  }

  return examples;
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
