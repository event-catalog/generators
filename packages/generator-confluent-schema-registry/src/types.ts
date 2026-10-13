export type EventCatalogConfig = any;

export type MessageType = 'event' | 'command';

export type Filter = {
  events?: string | string[] | { prefix?: string | string[]; suffix?: string | string[]; includes?: string | string[] };
  commands?: string | string[] | { prefix?: string | string[]; suffix?: string | string[]; includes?: string | string[] };
  topic?: string;
  // id: number;
  // schemaType: SchemaType;
  // schema: string;
  // latestVersion?: boolean;
  // messageType?: MessageType;
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
};

export enum SchemaType {
  JSON = 'JSON',
  PROTOBUF = 'PROTOBUF',
  AVRO = 'avsc',
}

export type Schema = {
  subject: string;
  eventId: string;
  version: number;
  id: number;
  schemaType: SchemaType;
  schema: string;
  latestVersion?: boolean;
  messageType?: MessageType;
  topic?: string;
};

export type Domain = {
  id: string;
  name: string;
  version: string;
};

export type Channel = {
  id: string;
  name: string;
  address: string;
};

export type GeneratorProps = {
  /**
   * URL of the Confluent Schema Registry
   */
  schemaRegistryUrl: string;

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

  topics?: Channel[];
};
