export type EventCatalogConfig = any;

export type MessageType = 'event' | 'command' | 'query';

export type Filter = {
  id: string;
  schemaGroup: string;
  messageType?: MessageType;
  name?: string;
  schemaRegistryUrl?: string;
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
  AVRO = 'Avro',
  JSON = 'Json',
}

export type Schema = {
  schemaGroup: string;
  schemaName: string;
  version: number;
  id: string;
  schemaType: SchemaType;
  schema: string;
  latestVersion?: boolean;
  messageType?: MessageType;
  customName?: string;
  schemaRegistryUrl?: string;
};

export type Domain = {
  id: string;
  name: string;
  version: string;
};

export type GeneratorProps = {
  /**
   * URL of the Azure Schema Registry (e.g., https://your-namespace.servicebus.windows.net)
   */
  schemaRegistryUrl: string;

  /**
   * Optional list of services to add to the catalog
   */
  services?: Service[];

  /**
   * Optional domain to add to the catalog and attach the services too
   */
  domain?: Domain;
};

export type AzureSchemaRegistrySchema = {
  id: string;
  groupName: string;
  name: string;
  version: number;
  schemaType: SchemaType;
  content: string;
};
