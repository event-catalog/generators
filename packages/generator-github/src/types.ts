export type EventCatalogConfig = any;

export type MessageType = 'event' | 'command' | 'query';

export type Message = {
  id: string;
  name?: string;
  version?: string;
  schemaPath: string;
  type: MessageType;
};

export type Service = {
  id: string;
  name?: string;
  version: string;
  sends?: Message[];
  receives?: Message[];
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
   * The license key for the plugin
   */
  licenseKey?: string;

  /**
   * The repository to clone
   */
  source: string;

  /**
   * GitHub personal access token for private repository access.
   * Can also be set via EVENTCATALOG_GITHUB_TOKEN environment variable.
   */
  token?: string;

  /**
   * The branch to clone
   */
  branch?: string;

  /**
   * The path to clone
   */
  path?: string;

  /**
   * Optional list of services to add to the catalog
   */
  services?: Service[];

  /**
   * Optional domain to add to the catalog and attach the services too
   */
  domain?: Domain;

  /**
   * Optional list of messages to add to the catalog
   */
  messages?: Message[];

  //   topics?: Channel[];
};
