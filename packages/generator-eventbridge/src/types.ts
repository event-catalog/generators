import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';

export type EventCatalogConfig = any;

export type Event = {
  id: string;
  schemaName: string;
  registryName: string;
  source: string;
  detailType: string;
  jsonSchema: any;
  openApiSchema: any;
  version?: string;
  createdDate?: Date;
  versionCount?: number;
  region?: string;
  accountId?: string;
  jsonDraftFileName: string;
  openApiFileName: string;
  eventBusName?: string;
};

export type Domain = {
  id: string;
  name: string;
  version: string;
};

export type Filter = {
  source?: string | string[];
  prefix?: string | string[];
  suffix?: string | string[];
  includes?: string;
  detailType?: string | string[];
  eventBusName?: string;
};

export type Service = {
  id: string;
  sends?: Filter[];
  receives?: Filter[];
  version: string;
  writesTo?: { id: string; version?: string }[];
  readsFrom?: { id: string; version?: string }[];
  name?: string;
  summary?: string;
  writeToRoot?: boolean;
};

export type EventMap = 'detail-type' | 'schema-name';

export type GeneratorProps = {
  region: string;
  registryName: string;
  eventBusName?: string;
  services?: Service[];
  domain?: Domain;
  debug?: boolean;
  mapEventsBy?: EventMap;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
  writeFilesToRoot?: boolean;
  writeEventsToRoot?: boolean;
  format?: 'md' | 'mdx';
};
