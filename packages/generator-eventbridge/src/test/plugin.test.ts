import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import {
  DescribeSchemaCommand,
  DescribeSchemaCommandOutput,
  ExportSchemaCommand,
  ListSchemasCommand,
  SchemasClient,
} from '@aws-sdk/client-schemas';

import { DescribeEventBusCommand, DescribeEventBusCommandOutput } from '@aws-sdk/client-eventbridge';

import { existsSync } from 'node:fs';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

const setupMocks = () => {
  // Mock the entire @aws-sdk/client-schemas module
  vi.mock('@aws-sdk/client-schemas', () => {
    return {
      SchemasClient: vi.fn(() => ({
        send: vi.fn((command) => {
          if (command instanceof ListSchemasCommand) {
            return Promise.resolve({
              Schemas: [
                { SchemaName: 'myapp.users@UserSignedUp', VersionCount: 1 },
                { SchemaName: 'myapp.users@UserLoggedIn', VersionCount: 3 },
                { SchemaName: 'myapp.orders@OrderPlaced', VersionCount: 10 },
              ],
            });
          }
          if (command instanceof ExportSchemaCommand) {
            return Promise.resolve({
              Content: JSON.stringify({
                type: 'object',
                properties: {
                  detail: {
                    type: 'object',
                    properties: {
                      key1: { type: 'string' },
                      key2: { type: 'number' },
                    },
                  },
                },
              }),
            });
          }
          if (command instanceof DescribeSchemaCommand) {
            return Promise.resolve({
              Content: JSON.stringify({
                openapi: '3.0.0',
                info: { title: 'Test Schema', version: '1.0.0' },
                paths: {},
              }),
              SchemaVersion: '1',
              LastModified: new Date('2023-01-01'),
            } as DescribeSchemaCommandOutput);
          }
          return Promise.reject(new Error('Command not mocked'));
        }),
      })),
      DescribeSchemaCommand: vi.fn(),
      ListSchemasCommand: vi.fn(),
      ExportSchemaCommand: vi.fn(),
    };
  });
  // Mock the entire @aws-sdk/client-schemas module
  vi.mock('@aws-sdk/client-eventbridge', () => {
    return {
      EventBridgeClient: vi.fn(() => ({
        send: vi.fn((command) => {
          if (command instanceof DescribeEventBusCommand) {
            return Promise.resolve({
              Arn: 'arn:aws:events:us-east-1:123456789012:event-bus/demo',
              Name: 'demo',
              Description: 'My event bus',
              $metadata: {
                httpStatusCode: 200,
                requestId: 'mock-request-id',
                extendedRequestId: 'mock-extended-request-id',
                cfId: 'mock-cf-id',
              },
            } as DescribeEventBusCommandOutput);
          }
        }),
      })),
      DescribeEventBusCommand: vi.fn(),
    };
  });
};

// Fake eventcatalog config
const config = {
  title: 'My EventCatalog',
};

let catalogDir: string;

describe('EventBridge EventCatalog Plugin', () => {
  beforeEach(async () => {
    // if it exists, remove it
    if (existsSync(join(__dirname, 'catalog'))) {
      await fs.rm(join(__dirname, 'catalog'), { recursive: true });
    }
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
    // vi.clearAllMocks();
    setupMocks();
    // Set up the mock SchemasClient
    // mockSchemasClient = new SchemasClient({});
  });

  afterEach(async () => {
    // await fs.rm(join(catalogDir), { recursive: true });
  });

  describe('format', () => {
    it('when format is set to "md" all files are written as ".md" and not ".mdx"', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        writeFilesToRoot: true,
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp' }] }],
        domain: { id: 'Orders Domain', version: '1.0.0', name: 'Orders Domain' },
        format: 'md',
      });

      const domains = await fs.readdir(path.join(catalogDir, 'domains'));
      expect(domains).toEqual(['Orders Domain']);

      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toEqual(['Orders Service']);

      const events = await fs.readdir(path.join(catalogDir, 'events'));
      expect(events).toEqual(['OrderPlaced', 'UserLoggedIn', 'UserSignedUp']);

      const orderPlacedFiles = await fs.readdir(path.join(catalogDir, 'events', 'OrderPlaced'));
      expect(orderPlacedFiles).toContain('index.md');
      expect(orderPlacedFiles).not.toContain('index.mdx');

      const userSignedUpFiles = await fs.readdir(path.join(catalogDir, 'events', 'UserSignedUp'));
      expect(userSignedUpFiles).toContain('index.md');

      const userLoggedInFiles = await fs.readdir(path.join(catalogDir, 'events', 'UserLoggedIn'));
      expect(userLoggedInFiles).toContain('index.md');
      expect(userLoggedInFiles).not.toContain('index.mdx');

      // Service
      const serviceFiles = await fs.readdir(path.join(catalogDir, 'services', 'Orders Service'));
      expect(serviceFiles).toContain('index.md');
      expect(serviceFiles).not.toContain('index.mdx');

      // Domain
      const domainFiles = await fs.readdir(path.join(catalogDir, 'domains', 'Orders Domain'));
      expect(domainFiles).toContain('index.md');
      expect(domainFiles).not.toContain('index.mdx');
    });
  });

  describe('domains', () => {
    it('if a domain is defined in the EventBridge generator and it does not exist it is created and the service is mapped to the domain', async () => {
      const { getDomain } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
        domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
      });

      const domain = await getDomain('orders', '1.0.0');

      expect(domain).toEqual({
        id: 'orders',
        name: 'Orders Domain',
        version: '1.0.0',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
        markdown: expect.any(String),
      });
    });

    it('if a domain is defined in the EventBridge generator but the versions do  not match, the existing domain is versioned and a new one is created', async () => {
      const { writeDomain, getDomain } = utils(catalogDir);

      await writeDomain({
        id: 'orders',
        name: 'Orders Domain',
        version: '0.0.1',
        markdown: '',
      });

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
        domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
      });

      const versionedDomain = await getDomain('orders', '0.0.1');
      const newDomain = await getDomain('orders', '1.0.0');

      expect(versionedDomain.version).toEqual('0.0.1');
      expect(newDomain.version).toEqual('1.0.0');
      expect(newDomain.services).toEqual([{ id: 'Orders Service', version: '1.0.0' }]);
    });

    it('if multiple services processed for a domain, they are all added to the domain', async () => {
      const { getDomain } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          { id: 'Orders Service', version: '1.0.0' },
          { id: 'Account Service', version: '1.0.0' },
        ],
        domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
      });

      const domain = await getDomain('orders', 'latest');

      expect(domain.services).toHaveLength(2);
      expect(domain.services).toEqual([
        { id: 'Orders Service', version: '1.0.0' },
        { id: 'Account Service', version: '1.0.0' },
      ]);
    });

    it('if a domain is not defined in the eventbridge plugin configuration, the service is not added to any domains', async () => {
      const { getDomain } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
      });

      expect(await getDomain('orders', '1.0.0')).toBeUndefined();
    });
  });

  describe('service', () => {
    it('creates a service in EventCatalog and maps EventBridge events into that service', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
      });

      const service = await getService('Orders Service');

      expect(service.id).toEqual('Orders Service');
      expect(service.name).toEqual('Orders Service');
    });

    it('when the service is already defined in EventCatalog and the versions match, only metadata is updated and markdown, writesTo, readsFrom, badges and attachments are persisted', async () => {
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'Orders Service',
        version: '1.0.0',
        name: 'Random Name',
        markdown: 'old markdown',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
        writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
        readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
      });

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
      });

      const service = await getService('Orders Service');

      expect(service).toEqual(
        expect.objectContaining({
          id: 'Orders Service',
          name: 'Orders Service',
          version: '1.0.0',
          markdown: 'old markdown',
          badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
          attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
          writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
          readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
        })
      );
    });

    it('when the service is already defined in EventCatalog and the versions do not match, a new service is created and the old one is versioned', async () => {
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'Orders Service',
        version: '0.0.1',
        name: 'Random Name',
        markdown: 'old markdown',
      });

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0' }],
      });

      const versionedService = await getService('Orders Service', '0.0.1');
      const newService = await getService('Orders Service', '1.0.0');
      expect(versionedService).toBeDefined();
      expect(newService).toBeDefined();
    });

    describe('produces events (sends)', () => {
      it('maps EventBridge events matching the given `detailType` into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ detailType: 'UserSignedUp' }] }],
        });

        const event = await getEvent('UserSignedUp');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(1);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });

        expect(event).toEqual({
          id: 'UserSignedUp',
          name: 'UserSignedUp',
          version: '1',
          markdown: expect.any(String),
          schemaPath: 'myapp.users@UserSignedUp-jsondraft.json',
          badges: expect.anything(),
        });
      });

      it('maps EventBridge events matching the given `detailType` even when the case in the detail type is different into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ detailType: 'usersignedup' }] }],
        });

        const event = await getEvent('UserSignedUp');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(1);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });

        expect(event).toEqual({
          id: 'UserSignedUp',
          name: 'UserSignedUp',
          version: '1',
          markdown: expect.any(String),
          schemaPath: 'myapp.users@UserSignedUp-jsondraft.json',
          badges: expect.anything(),
        });
      });

      it('maps EventBridge events matching multiple `detailType` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ detailType: ['UserSignedUp', 'OrderPlaced'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(2);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(orderPlaced).toBeDefined();
        expect(userSignedUp).toBeDefined();
      });

      it('maps EventBridge events matching `prefix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp.users' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(2);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();

        expect(orderPlaced).not.toBeDefined();
      });

      it('maps EventBridge events matching multiple `prefix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: ['myapp.users', 'myapp.orders'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');

        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(3);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });
        expect(service.sends?.[2]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });

      it('maps EventBridge events matching `suffix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ suffix: 'SignedUp' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(1);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });

        expect(userSignedUp).toBeDefined();

        expect(userLoggedIn).not.toBeDefined();
        expect(orderPlaced).not.toBeDefined();
      });

      it('maps EventBridge events matching multiple `suffix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ suffix: ['SignedUp', 'Placed'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(2);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();

        expect(userLoggedIn).not.toBeDefined();
      });

      it('maps EventBridge events matching the given source into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ source: 'myapp.users' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');

        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(2);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });

        expect(userSignedUp).toBeDefined();
        expect(userLoggedIn).toBeDefined();
      });

      it('maps EventBridge events matching multiple `source` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ source: ['myapp.users', 'myapp.orders'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(3);
        expect(service.sends?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.sends?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });
        expect(service.sends?.[2]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });

      it('maps EventBridge events matching multiple filters into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [
            { id: 'Orders Service', version: '1.0.0', sends: [{ source: ['myapp.users'], detailType: ['OrderPlaced'] }] },
          ],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.sends?.length).toEqual(3);

        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
        expect(userLoggedIn).toBeDefined();
      });

      it('when an event version already exists in the versioned folder, writing the same version should not fail', async () => {
        const { getEvent, writeEvent } = utils(catalogDir);

        // Simulate the scenario where an event has been versioned before:
        // - Event v1 exists in versioned/1 folder (from a previous generator run)
        // - Event v3 is the latest version
        // - A new service tries to write v1 again
        await writeEvent(
          {
            id: 'UserSignedUp',
            name: 'UserSignedUp',
            version: '1',
            markdown: 'Version 1 from previous run',
          },
          { path: 'events/UserSignedUp/versioned/1' }
        );

        await writeEvent(
          {
            id: 'UserSignedUp',
            name: 'UserSignedUp',
            version: '3',
            markdown: 'Version 3 is latest',
          },
          { path: 'events/UserSignedUp' }
        );

        // Now run the plugin - a service sends an event that maps to v1
        // This should NOT fail even though v1 already exists in versioned folder
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          writeFilesToRoot: true,
          services: [
            {
              id: 'ServiceA',
              version: '1.0.0',
              sends: [{ detailType: 'UserSignedUp' }],
            },
          ],
        });

        const event = await getEvent('UserSignedUp');
        expect(event).toBeDefined();
      });
    });

    describe('subscribes to events (receives)', () => {
      it('maps EventBridge events matching the given `detailType` into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          credentials: {
            accessKeyId: 'X',
            secretAccessKey: 'X',
            accountId: 'X',
          },
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ detailType: 'UserSignedUp' }] }],
        });

        const event = await getEvent('UserSignedUp');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(1);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });

        expect(event).toEqual({
          id: 'UserSignedUp',
          name: 'UserSignedUp',
          version: '1',
          markdown: expect.any(String),
          schemaPath: 'myapp.users@UserSignedUp-jsondraft.json',
          badges: expect.anything(),
        });
      });

      it('maps EventBridge events matching multiple `detailType` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ detailType: ['UserSignedUp', 'OrderPlaced'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(2);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });

      it('maps EventBridge events matching `prefix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ prefix: 'myapp.users' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(2);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });

        expect(userLoggedIn).toBeDefined();
        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();

        expect(orderPlaced).not.toBeDefined();
      });

      it('maps EventBridge events matching multiple `prefix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ prefix: ['myapp.users', 'myapp.orders'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(3);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });
        expect(service.receives?.[2]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });

      it('maps EventBridge events matching `suffix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ suffix: 'SignedUp' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(1);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });

        expect(userSignedUp).toBeDefined();
        expect(userLoggedIn).not.toBeDefined();
        expect(orderPlaced).not.toBeDefined();
      });

      it('maps EventBridge events matching multiple `suffix` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ suffix: ['SignedUp', 'Placed'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(2);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'OrderPlaced', version: '10' });

        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();

        expect(userLoggedIn).not.toBeDefined();
      });

      it('maps EventBridge events matching the given source into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ source: 'myapp.users' }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(2);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();
      });

      it('maps EventBridge events matching multiple `source` values into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', receives: [{ source: ['myapp.users', 'myapp.orders'] }] }],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(3);
        expect(service.receives?.[0]).toEqual({ id: 'UserSignedUp', version: '1' });
        expect(service.receives?.[1]).toEqual({ id: 'UserLoggedIn', version: '3' });

        expect(userLoggedIn).toBeDefined();
        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });
    });

    describe('subscribes and receives events', () => {
      it('maps EventBridge events matching multiple filters into the given service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [
            {
              id: 'Orders Service',
              version: '1.0.0',
              receives: [{ source: ['myapp.users'] }],
              sends: [{ source: ['myapp.orders'] }],
            },
          ],
        });

        const userSignedUp = await getEvent('UserSignedUp');
        const orderPlaced = await getEvent('OrderPlaced');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const service = await getService('Orders Service');

        expect(service.receives?.length).toEqual(2);
        expect(service.sends?.length).toEqual(1);

        expect(userSignedUp).toBeDefined();
        expect(orderPlaced).toBeDefined();
        expect(userLoggedIn).toBeDefined();
      });
    });

    describe('schemas', () => {
      it('the EventBridge JSON schema is stored in EventCatalog along side the event', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [
            {
              id: 'Orders Service',
              version: '1.0.0',
              receives: [{ source: ['myapp.users'] }],
              sends: [{ source: ['myapp.orders'] }],
            },
          ],
        });

        const userSignedUp = await getEvent('UserSignedUp');

        expect(userSignedUp.schemaPath).toEqual('myapp.users@UserSignedUp-jsondraft.json');
        const jsonDraftSchema = await fs.readFile(
          join(catalogDir, 'services', 'Orders Service', 'events', 'UserSignedUp', 'myapp.users@UserSignedUp-jsondraft.json')
        );
        const openAPISchema = await fs.readFile(
          join(catalogDir, 'services', 'Orders Service', 'events', 'UserSignedUp', 'myapp.users@UserSignedUp-openapi.json')
        );

        expect(jsonDraftSchema).toBeDefined();
        expect(openAPISchema).toBeDefined();
      });
    });

    describe('service options', () => {
      it('if the `writesTo` option is provided, the service writesTo is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', writesTo: [{ id: 'Users Service', version: '1.0.0' }] }],
        });
        const service = await getService('Orders Service');
        expect(service.writesTo).toEqual([{ id: 'Users Service', version: '1.0.0' }]);
      });

      it('if the `readsFrom` option is provided, the service readsFrom is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', readsFrom: [{ id: 'Users Service', version: '1.0.0' }] }],
        });
        const service = await getService('Orders Service');
        expect(service.readsFrom).toEqual([{ id: 'Users Service', version: '1.0.0' }]);
      });

      it('if the `name` option is provided, the service name is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', name: 'Orders Service' }],
        });
        const service = await getService('Orders Service');
        expect(service.name).toEqual('Orders Service');
      });

      it('if the `summary` option is provided, the service summary is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0', summary: 'Orders Service' }],
        });
        const service = await getService('Orders Service');
        expect(service.summary).toEqual('Orders Service');
      });
    });
  });

  describe('channels', () => {
    it('when an eventBusName is not provided for a service (sends or receives) no channel is created', async () => {
      const { getChannel } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const channel = await getChannel('demo');

      expect(channel).toBeUndefined();
    });

    it('when an eventBusName is provided for a service (sends or receives) a channel is created', async () => {
      const { getChannel } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ source: ['myapp.orders'], eventBusName: 'demo' }],
          },
        ],
      });

      const channel = await getChannel('demo');

      expect(channel).toEqual({
        id: 'demo',
        name: 'EventBridge: demo',
        version: '1.0.0',
        address: 'arn:aws:events:us-east-1:123456789012:event-bus/demo',
        protocols: ['eventbridge'],
        summary: 'Amazon EventBridge: My event bus',
        markdown:
          '## Overview\n  \n  Documentation for the Amazon EventBridge Event Bus: demo.\n  \n  <Tiles >\n      <Tile icon="GlobeAltIcon" href="https://undefined.console.aws.amazon.com/events/home?region=undefined#/eventbus/demo" openWindow={true} title="Open event bus" description="Open the demo bus in the AWS console" />\n      <Tile icon="GlobeAltIcon" href="https://undefined.console.aws.amazon.com/events/home?region=undefined#/rules/create?demo" openWindow={true} title="Create new rule" description="Create a new rule for the demo bus" />\n      <Tile icon="CodeBracketIcon" href="https://undefined.console.aws.amazon.com/events/home?region=undefined#/eventbuses/sendevents?eventBus=demo" openWindow={true} title="Send test events" description="Send test events to demo in the AWS console." />\n      <Tile icon="ChartBarSquareIcon" href="https://undefined.console.aws.amazon.com/events/home?region=undefined#/eventbus/demo?tab=MONITORING" title="Monitoring" description="AWS dashboard that shows metrics for all event buses" />\n  </Tiles>',
      });
    });

    it('when an eventBusName is provided for a service (sends or receives), and the channel is already created, no new channel is created', async () => {
      const { getChannel, writeChannel } = utils(catalogDir);

      const channelData = {
        id: 'demo',
        name: 'EventBridge: demo',
        version: '0.0.1',
        address: 'arn:aws:events:us-east-1:123456789012:event-bus/demo',
        protocols: ['eventbridge'],
        summary: 'Amazon EventBridge: My event bus',
        markdown: 'Some markdown',
      };

      await writeChannel(channelData);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ source: ['myapp.orders'], eventBusName: 'demo' }],
          },
        ],
      });

      const channel = await getChannel('demo');

      expect(channel).toEqual(channelData);
    });

    it('when an eventBusName is provided for a service (sends or receives), and messages are assigned to the channel', async () => {
      const { getEvent, getService } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ detailType: 'UserSignedUp', eventBusName: 'demo' }] }],
      });

      const event = await getEvent('UserSignedUp');

      expect(event).toEqual({
        id: 'UserSignedUp',
        name: 'UserSignedUp',
        channels: [{ id: 'demo', version: 'latest' }],
        version: '1',
        markdown: expect.any(String),
        schemaPath: 'myapp.users@UserSignedUp-jsondraft.json',
        badges: expect.anything(),
      });
    });
  });

  describe('writeFilesToRoot', () => {
    it('when writeFilesToRoot is true the events, domains and services are written to the root of the catalog', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        writeFilesToRoot: true,
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp' }] }],
        domain: { id: 'Orders Domain', version: '1.0.0', name: 'Orders Domain' },
      });

      const domains = await fs.readdir(path.join(catalogDir, 'domains'));
      expect(domains).toEqual(['Orders Domain']);

      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toEqual(['Orders Service']);

      const events = await fs.readdir(path.join(catalogDir, 'events'));
      expect(events).toEqual(['OrderPlaced', 'UserLoggedIn', 'UserSignedUp']);

      const orderPlacedFiles = await fs.readdir(path.join(catalogDir, 'events', 'OrderPlaced'));
      expect(orderPlacedFiles).toEqual([
        'index.mdx',
        'myapp.orders@OrderPlaced-jsondraft.json',
        'myapp.orders@OrderPlaced-openapi.json',
      ]);

      const userSignedUpFiles = await fs.readdir(path.join(catalogDir, 'events', 'UserSignedUp'));
      expect(userSignedUpFiles).toEqual([
        'index.mdx',
        'myapp.users@UserSignedUp-jsondraft.json',
        'myapp.users@UserSignedUp-openapi.json',
      ]);

      const userLoggedInFiles = await fs.readdir(path.join(catalogDir, 'events', 'UserLoggedIn'));
      expect(userLoggedInFiles).toEqual([
        'index.mdx',
        'myapp.users@UserLoggedIn-jsondraft.json',
        'myapp.users@UserLoggedIn-openapi.json',
      ]);
    });
  });

  describe('writeEventsToRoot', () => {
    it('when writeEventsToRoot is true only events are written to the root, services and domains remain nested', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        writeEventsToRoot: true,
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp' }] }],
        domain: { id: 'Orders Domain', version: '1.0.0', name: 'Orders Domain' },
      });

      // Events should be written to the root /events folder
      const events = await fs.readdir(path.join(catalogDir, 'events'));
      expect(events).toEqual(['OrderPlaced', 'UserLoggedIn', 'UserSignedUp']);

      const orderPlacedFiles = await fs.readdir(path.join(catalogDir, 'events', 'OrderPlaced'));
      expect(orderPlacedFiles).toEqual([
        'index.mdx',
        'myapp.orders@OrderPlaced-jsondraft.json',
        'myapp.orders@OrderPlaced-openapi.json',
      ]);

      // Domains should still be in the domains folder
      const domains = await fs.readdir(path.join(catalogDir, 'domains'));
      expect(domains).toEqual(['Orders Domain']);

      // Services should be nested inside domains (normal behavior)
      const domainContents = await fs.readdir(path.join(catalogDir, 'domains', 'Orders Domain'));
      expect(domainContents).toContain('services');

      const servicesInDomain = await fs.readdir(path.join(catalogDir, 'domains', 'Orders Domain', 'services'));
      expect(servicesInDomain).toEqual(['Orders Service']);

      // Verify service does NOT have nested events (events went to root)
      const serviceContents = await fs.readdir(path.join(catalogDir, 'domains', 'Orders Domain', 'services', 'Orders Service'));
      expect(serviceContents).not.toContain('events');
    });

    it('when writeEventsToRoot is true and no domain is provided, services remain in services folder and events go to root', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        writeEventsToRoot: true,
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp' }] }],
      });

      // Events should be written to the root /events folder
      const events = await fs.readdir(path.join(catalogDir, 'events'));
      expect(events).toEqual(['OrderPlaced', 'UserLoggedIn', 'UserSignedUp']);

      // Services should be in the services folder (not nested in domain)
      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toEqual(['Orders Service']);

      // Verify service does NOT have nested events
      const serviceContents = await fs.readdir(path.join(catalogDir, 'services', 'Orders Service'));
      expect(serviceContents).not.toContain('events');
    });
  });

  describe('service.writeToRoot', () => {
    it('when a service has writeToRoot: true, that service is written to the root even when a domain is provided', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          { id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp.orders' }], writeToRoot: true },
          { id: 'Users Service', version: '1.0.0', sends: [{ prefix: 'myapp.users' }] },
        ],
        domain: { id: 'Orders Domain', version: '1.0.0', name: 'Orders Domain' },
      });

      // Orders Service should be in the root /services folder (writeToRoot: true)
      const rootServices = await fs.readdir(path.join(catalogDir, 'services'));
      expect(rootServices).toContain('Orders Service');

      // Users Service should be nested inside the domain (writeToRoot not set)
      const domainServices = await fs.readdir(path.join(catalogDir, 'domains', 'Orders Domain', 'services'));
      expect(domainServices).toContain('Users Service');
      expect(domainServices).not.toContain('Orders Service');
    });

    it('when a service has writeToRoot: true without a domain, it still writes to the root services folder', async () => {
      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [{ id: 'Orders Service', version: '1.0.0', sends: [{ prefix: 'myapp' }], writeToRoot: true }],
      });

      // Service should be in the root /services folder
      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toEqual(['Orders Service']);
    });
  });

  describe('events', () => {
    it('when a message is written to EventCatalog the version number is taken from the schema VersionCount', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const versionedEvent = await getEvent('OrderPlaced', '10');

      expect(versionedEvent).toBeDefined();
    });

    it('when the message already exists in EventCatalog but the versions do not match, the existing message is versioned', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'UserSignedUp',
        version: '0.0.1',
        name: 'UserSignedUp',
        markdown: '',
      });

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            receives: [{ source: ['myapp.users'] }],
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const versionedEvent = await getEvent('UserSignedUp', '0.0.1');
      const newEvent = await getEvent('UserSignedUp', 'latest');

      expect(versionedEvent).toBeDefined();
      expect(newEvent).toBeDefined();
    });

    it('when a the message already exists in EventCatalog the markdown, summary, badges and attachments are persisted and not overwritten', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'UserSignedUp',
        version: '0.0.1',
        name: 'UserSignedUp',
        markdown: 'Please do not overwrite me',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
        summary: 'This is a custom summary',
      });

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            receives: [{ source: ['myapp.users'] }],
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const newEvent = await getEvent('UserSignedUp', 'latest');

      expect(newEvent.markdown).toEqual('Please do not overwrite me');
      expect(newEvent.badges).toEqual([{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }]);
      expect(newEvent.attachments).toEqual(['https://github.com/dboyne/eventcatalog/blob/main/README.md']);
      expect(newEvent.summary).toEqual('This is a custom summary');
    });

    it('the event bus name is added as a badge onto the event when `eventBusName` is set on the generator', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        eventBusName: 'my-event-bus',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            receives: [{ source: ['myapp.users'] }],
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const event = await getEvent('UserSignedUp', 'latest');

      expect(event.badges).toEqual([
        {
          content: 'Bus: my-event-bus',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
        {
          content: 'Source: myapp.users',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
        {
          content: 'DetailType: UserSignedUp',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
        {
          content: 'Schema name: myapp.users@UserSignedUp',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
      ]);
    });

    it('the source, detailtype and schema name are added as badges for all events', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            receives: [{ source: ['myapp.users'] }],
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
      });

      const event = await getEvent('UserSignedUp', 'latest');

      expect(event.badges).toEqual([
        {
          content: 'Source: myapp.users',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
        {
          content: 'DetailType: UserSignedUp',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
        {
          content: 'Schema name: myapp.users@UserSignedUp',
          backgroundColor: 'pink',
          textColor: 'pink',
        },
      ]);
    });

    it('when mapEventsBy is set to "schema-name" the schema name is used as the event id', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ source: ['myapp.orders'] }],
          },
        ],
        mapEventsBy: 'schema-name',
      });

      const versionedEvent = await getEvent('myapp.orders@OrderPlaced', '10');
      expect(versionedEvent).toBeDefined();
    });

    describe('events without services', () => {
      it('if no services or domains are provided all the messages are added to EventCatalog without a service', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          eventBusName: 'my-event-bus',
        });

        const userSignedUp = await getEvent('UserSignedUp', 'latest');
        const userLoggedIn = await getEvent('UserLoggedIn');
        const orderPlaced = await getEvent('OrderPlaced');

        expect(userSignedUp).toBeDefined();
        expect(userLoggedIn).toBeDefined();
        expect(orderPlaced).toBeDefined();
      });
    });

    it('when message does not have source or detailype in registry (custom registry), the schema name is used as the event id', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      // Override the mock for this specific test
      vi.mocked(SchemasClient).mockImplementation(
        () =>
          ({
            send: vi.fn((command) => {
              if (command instanceof ListSchemasCommand) {
                return Promise.resolve({
                  Schemas: [{ SchemaName: 'SchemaWithoutSourceAndDetailType', VersionCount: 1 }],
                });
              }
              if (command instanceof ExportSchemaCommand) {
                return Promise.resolve({
                  Content: JSON.stringify({
                    type: 'object',
                    properties: {
                      detail: {
                        type: 'object',
                        properties: {
                          key1: { type: 'string' },
                          key2: { type: 'number' },
                        },
                      },
                    },
                  }),
                });
              }
              if (command instanceof DescribeSchemaCommand) {
                return Promise.resolve({
                  Content: JSON.stringify({
                    openapi: '3.0.0',
                    info: { title: 'Test Schema', version: '1.0.0' },
                    paths: {},
                  }),
                  SchemaVersion: '1',
                  LastModified: new Date('2023-01-01'),
                } as DescribeSchemaCommandOutput);
              }
              return Promise.reject(new Error('Command not mocked'));
            }),
          }) as unknown as SchemasClient
      );

      await plugin(config, {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            receives: [{ prefix: ['SchemaWithoutSourceAndDetailType'] }],
          },
        ],
      });

      const event = await getEvent('SchemaWithoutSourceAndDetailType');

      expect(event).toBeDefined();
    });

    describe('persisted data', () => {
      it('when the service is already defined in EventCatalog and the versions match, the styles are persisted and not overwritten', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'Orders Service',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'old markdown',
          styles: {
            icon: 'BellIcon',
            node: {
              color: 'red',
              label: 'Custom Label',
            },
          },
        });
        await plugin(config, {
          region: 'us-east-1',
          registryName: 'discovered-schemas',
          services: [{ id: 'Orders Service', version: '1.0.0' }],
        });

        const service = await getService('Orders Service');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'Orders Service',
            name: 'Orders Service',
            version: '1.0.0',
            markdown: 'old markdown',
            styles: {
              icon: 'BellIcon',
              node: {
                color: 'red',
                label: 'Custom Label',
              },
            },
          })
        );
      });
    });
  });
});
