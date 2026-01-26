import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'fs-extra';
// Fake eventcatalog config
const eventCatalogConfig = {
  title: 'My EventCatalog',
};

let catalogDir: string;

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Store original env
const originalEnv = process.env;

describe('generator-github', () => {
  beforeEach(async () => {
    catalogDir = join(__dirname, 'catalog') || '';
    const exists = await fs
      .access(catalogDir)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      await fs.rm(catalogDir, { recursive: true });
    }
    await fs.mkdir(catalogDir, { recursive: true });
    process.env.PROJECT_DIR = catalogDir;
  });

  afterEach(async () => {
    await fs.rm(join(catalogDir), { recursive: true });
  });

  it('when no repo is provided, it throws an error', async () => {
    // @ts-ignore
    await expect(plugin(eventCatalogConfig, {})).rejects.toThrow('Please provide a repository to clone');
  }, 20000);

  describe('token authentication', () => {
    afterEach(() => {
      // Restore env after each test
      delete process.env.EVENTCATALOG_GITHUB_TOKEN;
    });

    it('accepts a token via the options parameter', async () => {
      // This test verifies the token option is accepted without errors
      // The actual cloning with a real token would require a private repo
      await expect(
        plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          token: 'test-token-value',
        })
      ).resolves.not.toThrow();
    }, 20000);

    it('accepts a token via the EVENTCATALOG_GITHUB_TOKEN environment variable', async () => {
      process.env.EVENTCATALOG_GITHUB_TOKEN = 'env-token-value';

      // This test verifies the env variable is read without errors
      await expect(
        plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
        })
      ).resolves.not.toThrow();
    }, 20000);
  });

  describe('messages', () => {
    describe('events', () => {
      it(
        'creates an event with the schema from GitHub',
        async () => {
          const { getEvent } = utils(catalogDir);

          await plugin(eventCatalogConfig, {
            source: 'https://github.com/event-catalog/eventcatalog.git',
            path: 'examples/default',
            messages: [
              {
                id: 'analytics-event-view',
                name: 'analytics-event-view',
                version: '1',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
          });

          const event = await getEvent('analytics-event-view', '1');
          expect(event).toEqual(
            expect.objectContaining({
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              version: '1',
              schemaPath: 'schema.avro',
              markdown: expect.stringContaining('<NodeGraph />'),
            })
          );

          const schema = await fs.readFile(join(catalogDir, 'events/analytics-event-view/schema.avro'), 'utf8');
          expect(schema).toBeDefined();
        },
        { timeout: 20000 }
      );

      it('when the event already exists, the schema is the only thing updated', async () => {
        const { writeEvent, getEvent, addSchemaToEvent } = utils(catalogDir);

        await writeEvent({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '1',
          markdown: 'This is persisted and not changed',
          schemaPath: 'schema.avro',
        });

        await addSchemaToEvent('analytics-event-view', {
          fileName: 'schema.avro',
          schema: 'This is the new schema',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              version: '1',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'event',
            },
          ],
        });

        const event = await getEvent('analytics-event-view', '1');
        expect(event).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
            version: '1',
            markdown: 'This is persisted and not changed',
            schemaPath: 'schema.avro',
          })
        );

        const schema = await fs.readFile(join(catalogDir, 'events/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);

      it('when the event does not have a given version, and it does not exist in the catalog, it is given a version of 1', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'event',
            },
          ],
        });

        const event = await getEvent('analytics-event-view', '1');
        expect(event).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );
      }, 20000);

      it('when the event does not have a given version, and it exists in the catalog, the schema is stored against the latest version of the event', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '10',
          markdown: 'This is persisted and not changed',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'event',
            },
          ],
        });

        const event = await getEvent('analytics-event-view', '10');
        expect(event).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );

        const schema = await fs.readFile(join(catalogDir, 'events/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);
    });
    describe('commands', () => {
      it('creates a command with the schema from GitHub', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'update-analytics',
              name: 'update-analytics',
              version: '1',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'command',
            },
          ],
        });

        const command = await getCommand('update-analytics', '1');
        expect(command).toEqual(
          expect.objectContaining({
            id: 'update-analytics',
            name: 'update-analytics',
            version: '1',
            schemaPath: 'schema.avro',
            markdown: expect.stringContaining('<NodeGraph />'),
          })
        );

        expect(await fs.readFile(join(catalogDir, 'commands/update-analytics/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'commands/update-analytics/schema.avro'), 'utf8');
        expect(schema).toBeDefined();
      }, 20000);

      it('when the command already exists, the schema is the only thing updated', async () => {
        const { writeCommand, getCommand, addSchemaToCommand } = utils(catalogDir);

        await writeCommand({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '1',
          markdown: 'This is persisted and not changed',
        });

        await addSchemaToCommand('analytics-event-view', {
          fileName: 'schema.avro',
          schema: 'This is the new schema',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              version: '1',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'event',
            },
          ],
        });

        const command = await getCommand('analytics-event-view', '1');
        expect(command).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
            version: '1',
            markdown: 'This is persisted and not changed',
          })
        );

        expect(await fs.readFile(join(catalogDir, 'commands/analytics-event-view/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'commands/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);

      it('when the command does not have a given version, and it does not exist in the catalog, it is given a version of 1', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'command',
            },
          ],
        });

        const command = await getCommand('analytics-event-view', '1');
        expect(command).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );
      }, 20000);

      it('when the command does not have a given version, and it exists in the catalog, the schema is stored against the latest version of the command', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '10',
          markdown: 'This is persisted and not changed',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'command',
            },
          ],
        });

        const command = await getCommand('analytics-event-view', '10');
        expect(command).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );

        expect(await fs.readFile(join(catalogDir, 'commands/analytics-event-view/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'commands/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);
    });

    describe('queries', () => {
      it('creates a query with the schema from GitHub', async () => {
        const { getQuery } = utils(catalogDir);

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'update-analytics',
              name: 'update-analytics',
              version: '1',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'query',
            },
          ],
        });

        const query = await getQuery('update-analytics', '1');
        expect(query).toEqual(
          expect.objectContaining({
            id: 'update-analytics',
            name: 'update-analytics',
            version: '1',
            schemaPath: 'schema.avro',
            markdown: expect.stringContaining('<NodeGraph />'),
          })
        );

        expect(await fs.readFile(join(catalogDir, 'queries/update-analytics/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'queries/update-analytics/schema.avro'), 'utf8');
        expect(schema).toBeDefined();
      }, 20000);

      it('when the query already exists, the schema is the only thing updated', async () => {
        const { writeQuery, getQuery, addSchemaToQuery } = utils(catalogDir);

        await writeQuery({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '1',
          markdown: 'This is persisted and not changed',
        });

        await addSchemaToQuery('analytics-event-view', {
          fileName: 'schema.avro',
          schema: 'This is the new schema',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              version: '1',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'query',
            },
          ],
        });

        const query = await getQuery('analytics-event-view', '1');
        expect(query).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
            version: '1',
            markdown: 'This is persisted and not changed',
          })
        );

        expect(await fs.readFile(join(catalogDir, 'queries/analytics-event-view/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'queries/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);

      it('when the query does not have a given version, and it does not exist in the catalog, it is given a version of 1', async () => {
        const { getQuery } = utils(catalogDir);

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'query',
            },
          ],
        });

        const query = await getQuery('analytics-event-view', '1');
        expect(query).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );
      }, 20000);

      it('when the query does not have a given version, and it exists in the catalog, the schema is stored against the latest version of the query', async () => {
        const { writeQuery, getQuery } = utils(catalogDir);

        await writeQuery({
          id: 'analytics-event-view',
          name: 'analytics-event-view',
          version: '10',
          markdown: 'This is persisted and not changed',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          path: 'examples/default',
          messages: [
            {
              id: 'analytics-event-view',
              name: 'analytics-event-view',
              schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
              type: 'command',
            },
          ],
        });

        const query = await getQuery('analytics-event-view', '10');
        expect(query).toEqual(
          expect.objectContaining({
            id: 'analytics-event-view',
            name: 'analytics-event-view',
          })
        );

        expect(await fs.readFile(join(catalogDir, 'queries/analytics-event-view/index.mdx'), 'utf8')).toBeDefined();
        const schema = await fs.readFile(join(catalogDir, 'queries/analytics-event-view/schema.avro'), 'utf8');
        expect(schema).not.toEqual('This is the new schema');
      }, 20000);
    });
  });

  describe('services', () => {
    it('when a service is configured, the service is added to the catalog with the configured messages (events or commands) as publishers and subscribers', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                version: '5',
                name: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                version: '1',
                name: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
        ],
      });

      const service = await getService('Orders Service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '1.0.0',
          sends: [{ id: 'analytics-event-view', version: '5' }],
          receives: [{ id: 'analytics-capture', version: '1' }],
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );
    }, 20000);

    it('when a service is configured with messages without a name or version, the service is added to the catalog with the configured messages (events or commands) as publishers and subscribers', async () => {
      const { getService, getEvent, getCommand } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
        ],
      });

      const service = await getService('Orders Service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '1.0.0',
          sends: [{ id: 'analytics-event-view' }],
          receives: [{ id: 'analytics-capture' }],
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );

      const event = await getEvent('analytics-event-view', '1');
      expect(event).toEqual(
        expect.objectContaining({
          id: 'analytics-event-view',
          // no name given, so it is given the id
          name: 'analytics-event-view',
          // no version given, so it is given a version of 1
          version: '1',
          schemaPath: 'schema.avro',
        })
      );

      const command = await getCommand('analytics-capture', '1');
      expect(command).toEqual(
        expect.objectContaining({
          id: 'analytics-capture',
          // no name given, so it is given the id
          name: 'analytics-capture',
          // no version given, so it is given a version of 1
          version: '1',
          schemaPath: 'schema.avro',
        })
      );
    }, 20000);

    it('when multiple services are configured, the services are added to the catalog with the configured messages (events or commands) as publishers and subscribers', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
          {
            id: 'Billing Service',
            version: '1.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
        ],
      });

      const service = await getService('Orders Service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '1.0.0',
        })
      );

      const billingService = await getService('Billing Service', '1.0.0');
      expect(billingService).toEqual(
        expect.objectContaining({
          id: 'Billing Service',
          version: '1.0.0',
        })
      );

      // Expect them to have events
      expect(
        await fs.readFile(join(catalogDir, 'services/Orders Service/events/analytics-event-view/index.mdx'), 'utf8')
      ).toBeDefined();
      expect(
        await fs.readFile(join(catalogDir, 'services/Orders Service/events/analytics-event-view/schema.avro'), 'utf8')
      ).toBeDefined();
    }, 20000);

    it('when the service already exists in the catalog, the service information is persisted (e.g markdown, badges, summary) but the sends and receives are updated', async () => {
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'Orders Service',
        version: '1.0.0',
        name: 'Orders Service',
        markdown: 'This markdown is persisted',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        summary: 'This is custom summary',
      });

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
        ],
      });

      const service = await getService('Orders Service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '1.0.0',
          markdown: 'This markdown is persisted',
          badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
          summary: 'This is custom summary',
        })
      );
    }, 20000);

    it('when the service already exists in the catalog, but the versions are different, the service in the catalog is versioned', async () => {
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'Orders Service',
        version: '1.0.0',
        name: 'Orders Service',
        markdown: 'This markdown is persisted',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        summary: 'This is custom summary',
      });

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        services: [
          {
            id: 'Orders Service',
            version: '2.0.0',
            sends: [
              {
                id: 'analytics-event-view',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'event',
              },
            ],
            receives: [
              {
                id: 'analytics-capture',
                schemaPath: 'domains/E-Commerce/subdomains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
                type: 'command',
              },
            ],
          },
        ],
      });

      const oldService = await getService('Orders Service', '1.0.0');
      expect(oldService).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '1.0.0',
        })
      );

      const newService = await getService('Orders Service', '2.0.0');
      expect(newService).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          version: '2.0.0',
        })
      );

      // Make sure versioned folder exists
      const versionedFolder = await existsSync(join(catalogDir, 'services', 'Orders Service', 'versioned'));
      expect(versionedFolder).toBeTruthy();
    }, 20000);
  });

  describe('domains', () => {
    it('if a domain is configured along side the services, the domain is created and the services are added to the domain, and events added to the services folder', async () => {
      const { getDomain } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        domain: {
          id: 'orders',
          name: 'Orders',
          version: '0.0.1',
        },
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
          },
        ],
      });

      const domain = await getDomain('orders', '0.0.1');
      expect(domain).toEqual(
        expect.objectContaining({
          id: 'orders',
          name: 'Orders',
          version: '0.0.1',
          services: [{ id: 'Orders Service', version: '1.0.0' }],
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );
    }, 20000);

    it('if the given domain already exists in the catalog, but the versions are different, the domain is versioned', async () => {
      const { writeDomain, getDomain } = utils(catalogDir);

      await writeDomain({
        id: 'orders',
        name: 'Orders',
        version: '0.0.1',
        markdown: '',
      });

      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
        domain: {
          id: 'orders',
          name: 'Orders',
          version: '0.0.2',
        },
      });

      const domain = await getDomain('orders', '0.0.2');
      expect(domain).toEqual(
        expect.objectContaining({
          id: 'orders',
          name: 'Orders',
          version: '0.0.2',
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );

      // Make sure versioned folder exists
      const versionedFolder = await existsSync(join(catalogDir, 'domains', 'orders', 'versioned'));
      expect(versionedFolder).toBeTruthy();
    }, 20000);
  });

  it(
    'clones the source directory and copies the files specified in the content to the destination directory',
    async () => {
      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        path: 'examples/default',
      });
    },
    {
      timeout: 20000,
    }
  );
});
