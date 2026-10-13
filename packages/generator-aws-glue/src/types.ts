import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';

export type EventCatalogConfig = any;

export type GlueSchema = {
  id: string;
  name: string;
  registryName: string;
  schemaArn?: string;
  schemaVersionId?: string;
  schemaVersionNumber?: number;
  dataFormat?: 'AVRO' | 'JSON' | 'PROTOBUF';
  compatibility?: string;
  status?: string;
  description?: string;
  tags?: Record<string, string>;
  createdDate?: Date;
  lastUpdated?: Date;
  schemaDefinition?: string;
  version?: string;
  latestVersion?: boolean;
};

export type Domain = {
  id: string;
  name: string;
  version: string;
};

export type Filter = {
  schemaName?: string | string[];
  prefix?: string | string[];
  suffix?: string | string[];
  includes?: string | string[];
  dataFormat?: string | string[];
  registryName?: string;
  tags?: Record<string, string>;
};

export type Service = {
  id: string;
  sends?: Filter[];
  receives?: Filter[];
  version: string;
};

export type GeneratorProps = {
  region: string;
  registryName: string;
  registryArn?: string;
  services?: Service[];
  domain?: Domain;
  debug?: boolean;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
  writeFilesToRoot?: boolean;
  format?: 'md' | 'mdx';
  includeAllVersions?: boolean;
};
