// Apicurio API response types
export interface ArtifactMetadata {
  id: string;
  version: string;
  type: string;
  state: string;
  createdOn: string;
  modifiedOn: string;
  globalId: number;
  contentId: number;
}

export interface Artifact {
  // V2 uses 'id', V3 uses 'artifactId'
  id?: string;
  artifactId?: string;
  name?: string;
  description?: string;
  createdOn: string;
  createdBy?: string;
  owner?: string; // V3 uses 'owner' instead of 'createdBy'
  // V2 uses 'type', V3 uses 'artifactType'
  type?: string;
  artifactType?: string;
  labels?: Record<string, string>;
  state?: string;
  modifiedOn: string;
  modifiedBy?: string;
  groupId: string;
}

export interface ArtifactSearchResults {
  artifacts: Artifact[];
  count: number;
}

export interface Version {
  version: string;
  globalId: number;
  state: string;
  createdOn: string;
  modifiedOn: string;
  type: string;
}

export interface VersionSearchResults {
  versions: Version[];
  count: number;
}

export interface ArtifactWithVersions {
  artifact: Artifact;
  versions: Version[];
  latestVersion: string;
  content?: any;
}

export enum SchemaType {
  OPENAPI = 'OPENAPI',
  ASYNCAPI = 'ASYNCAPI',
  AVRO = 'AVRO',
  JSON = 'JSON',
  PROTOBUF = 'PROTOBUF',
}

// EventCatalog generator types
export type EventCatalogConfig = any;

export type MessageType = 'event' | 'command' | 'query';

export type FilterCriterion =
  | string
  | string[]
  | { exact?: string | string[]; prefix?: string | string[]; suffix?: string | string[]; includes?: string | string[] };

export type Filter = {
  events?: FilterCriterion;
  commands?: FilterCriterion;
  queries?: FilterCriterion;
};

export type SpecificationType = 'openapi' | 'asyncapi';

/**
 * Generator configuration tuple: [generatorPackage, options]
 * Example: ['@eventcatalog/generator-openapi', { debug: true }]
 */
export type GeneratorConfig = [string, Record<string, any>?];

export type ServiceSpecification = {
  type: SpecificationType;
  artifactId: string;
  version?: string; // If not provided, uses latest
  /**
   * Optional generator to run on the specification to create message documentation.
   * When specified, the generator will be dynamically imported and executed with the spec file.
   * Example: ['@eventcatalog/generator-openapi', { debug: true }]
   */
  generator?: GeneratorConfig;
};

export type Service = {
  id: string;
  name?: string;
  sends?: Filter[];
  receives?: Filter[];
  version: string;
  writesTo?: { id: string; version?: string }[];
  readsFrom?: { id: string; version?: string }[];
  summary?: string;
  specifications?: ServiceSpecification[];
};

export type Schema = {
  artifactId: string;
  messageId: string;
  version: string;
  globalId: number;
  schemaType: SchemaType;
  schema: string;
  latestVersion?: boolean;
  messageType?: MessageType;
  groupId?: string;
};

export type Domain = {
  id: string;
  name: string;
  version: string;
};

export type GeneratorProps = {
  /**
   * URL of the Apicurio Registry
   */
  registryUrl: string;

  /**
   * Include all versions of the schemas in the catalog
   */
  includeAllVersions?: boolean;

  /**
   * Optional list of services to add to the catalog
   */
  services?: Service[];

  /**
   * Optional domain to add to the catalog and attach the services too
   */
  domain?: Domain;
};
