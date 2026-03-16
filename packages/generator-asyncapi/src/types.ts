// Define the types of operations available for each message type
export interface MessageOperations {
  write: (payload: any, options: any) => Promise<void>;
  version: (id: string) => Promise<any>;
  get: (id: string, version: string) => Promise<any>;
  addSchema: (id: string, schema: any, version: any, options: { path: string }) => Promise<void>;
  addExample: (id: string, example: { content: string; fileName: string }, version?: string) => Promise<void>;
  collection: string;
}

// Define valid event types
export type EventType = 'event' | 'command' | 'query';
