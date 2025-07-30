import { OpenAPIV3_1, OpenAPI } from 'openapi-types';

export type Domain = {
  id: string;
  name: string;
  version: string;
  owners?: string[];
  generateMarkdown?: ({}: { domain: Domain; markdown: string }) => string;
  draft?: boolean;
};

export type Service = {
  id: string;
  path: string | string[];
  owners?: string[];
  setMessageOwnersToServiceOwners?: boolean;
  draft?: boolean;
  generateMarkdown?: ({}: { service: Service; document: OpenAPI.Document; markdown: string }) => string;
};

export type Message = {
  generateMarkdown?: ({}: { operation: Operation; markdown: string }) => string;
};

export type Operation = {
  path: string;
  method: string;
  operationId: string;
  summary?: string;
  description?: string;
  type: string;
  action: string;
  externalDocs?: OpenAPIV3_1.ExternalDocumentationObject;
  tags: string[];
  extensions?: {
    [key: string]: any;
  };
  deprecated?:
    | boolean
    | {
        date?: string;
        message?: string;
      };
};

export interface OpenAPIParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: any;
  description?: string;
}

export interface OpenAPIOperation {
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content?: {
      [contentType: string]: {
        schema: any;
      };
    };
  };
  responses?: {
    [statusCode: string]: {
      isSchema?: boolean;
      content?: {
        [contentType: string]: {
          schema: any;
        };
      };
    };
  };
}

export interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation;
}

export interface OpenAPIPaths {
  [path: string]: OpenAPIPathItem;
}

export interface OpenAPIDocument {
  paths: OpenAPIPaths;
}
