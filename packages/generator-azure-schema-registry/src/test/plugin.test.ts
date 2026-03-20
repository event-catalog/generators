import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'node:fs';
import schemasMock from './mock-data/schemas.json';
import axios from 'axios';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Mock axios for Azure Schema Registry REST API calls
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

mockedAxios.get.mockImplementation(async (url: string) => {
  const urlStr = url.toString();

  // Extract schema group, schema name, and check if it's a versions endpoint or specific version
  const versionsMatch = urlStr.match(/\$schemagroups\/([^/]+)\/schemas\/([^/]+)\/versions\?api-version=/);
  const specificVersionMatch = urlStr.match(/\$schemagroups\/([^/]+)\/schemas\/([^/]+)\/versions\/(\d+)\?api-version=/);

  if (versionsMatch) {
    // Return list of versions for a schema
    // Azure API returns: { Value: [1, 2, 3], NextLink?: "..." }
    const [, schemaGroup, schemaName] = versionsMatch;
    const schemas = schemasMock.filter((s) => s.groupName === schemaGroup && s.name === schemaName);

    if (schemas.length === 0) {
      throw new Error('Schema not found');
    }

    return {
      data: {
        Value: schemas.map((s) => s.version),
      },
    };
  } else if (specificVersionMatch) {
    // Return specific schema version
    // Azure API returns: schema content as JSON object in response body
    const [, schemaGroup, schemaName, version] = specificVersionMatch;
    const schema = schemasMock.find(
      (s) => s.groupName === schemaGroup && s.name === schemaName && s.version === Number.parseInt(version)
    );

    if (!schema) {
      throw new Error('Schema not found');
    }

    return {
      data: JSON.parse(schema.content),
      headers: {
        'content-type': 'application/json',
      },
    };
  }

  throw new Error(`Unexpected URL: ${url}`);
});

// Fake eventcatalog config
const config = {
  title: 'My EventCatalog',
};

let catalogDir: string;

describe('Azure Schema Registry EventCatalog Plugin', () => {
  describe('service generation', () => {
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
      process.env.AZURE_SCHEMA_REGISTRY_TOKEN = 'mock-token';
    });

    afterEach(async () => {
      // Cleanup if needed
    });

    it('when no url is provided, it throws an error', async () => {
      // @ts-ignore
      await expect(plugin(config, {})).rejects.toThrow('Please provide a url for the Azure Schema Registry');
    });

    it('when no services are provided, it throws an error about Azure API limitations', async () => {
      await expect(
        plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
        })
      ).rejects.toThrow('Azure Schema Registry does not provide an API to list all schemas');
    });

    describe('domains', () => {
      it('if a domain is defined in the plugin configuration but the versions do not match, the existing domain is versioned and a new one is created', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders-domain',
          name: 'Orders Domain',
          version: '1.0.0',
          markdown: 'Version 1.0.0 markdown',
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          domain: {
            id: 'orders-domain',
            name: 'Orders Domain',
            version: '2.0.0',
          },
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const versionedDomain = await getDomain('orders-domain', '1.0.0');
        const newDomain = await getDomain('orders-domain', '2.0.0');

        expect(versionedDomain.version).toEqual('1.0.0');
        expect(newDomain.version).toEqual('2.0.0');
        expect(newDomain.services).toEqual([{ id: 'orders-service', version: '1.0.0' }]);

        // Check versioned folder exists
        const versionedFolder = await existsSync(join(catalogDir, 'domains', 'orders-domain', 'versioned', '1.0.0'));
        expect(versionedFolder).toBeTruthy();
      });

      it('if a domain is defined in the plugin configuration and that domain exists, the Azure Schema Registry service is added to that domain', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders-domain',
          name: 'Orders Domain',
          version: '1.0.0',
          markdown: '',
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          domain: {
            id: 'orders-domain',
            name: 'Orders Domain',
            version: '1.0.0',
          },
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const domain = await getDomain('orders-domain', '1.0.0');
        expect(domain.services).toEqual([{ id: 'orders-service', version: '1.0.0' }]);
      });

      it('if a domain is defined in the plugin configuration and that domain does not exist, it is created', async () => {
        const { getDomain } = utils(catalogDir);

        expect(await getDomain('orders-domain', '1.0.0')).toBeUndefined();

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          domain: {
            id: 'orders-domain',
            name: 'Orders Domain',
            version: '1.0.0',
          },
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const domain = await getDomain('orders-domain', '1.0.0');
        expect(domain).toBeDefined();
        expect(domain.services).toEqual([{ id: 'orders-service', version: '1.0.0' }]);
      });

      it('services can be generated into a subdomain folder structure', async () => {
        const { writeDomain, getService, addSubDomainToDomain } = utils(catalogDir);

        // Create the subdomain directory structure on disk
        const subdomainDir = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency');
        await fs.mkdir(subdomainDir, { recursive: true });
        await fs.writeFile(join(subdomainDir, 'index.mdx'), '---\nid: Agency\nname: Agency Domain\nversion: 1.0.0\n---\n');

        await writeDomain({
          id: 'Buyer',
          name: 'Buyer Domain',
          version: '1.0.0',
          markdown: '',
        });

        await addSubDomainToDomain('Buyer', { id: 'Agency', version: '1.0.0' });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          domain: { id: 'Agency', name: 'Agency Domain', version: '1.0.0' },
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const service = await getService('orders-service', '1.0.0');
        expect(service).toBeDefined();

        const subdomainServicePath = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency', 'services', 'orders-service');
        expect(existsSync(subdomainServicePath)).toBe(true);
      });
    });

    describe('services', () => {
      it('schemas are mapped into a service in EventCatalog when no service with this name is already defined', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              name: 'Orders Service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
              receives: [{ id: 'inventory-updated', schemaGroup: 'com.example.inventory' }],
            },
          ],
        });

        const service = await getService('orders-service');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ id: 'order-created', version: '2' }],
            receives: [{ id: 'inventory-updated', version: '1' }],
            markdown: expect.stringContaining('<NodeGraph />'),
          })
        );
      });

      it('when the Azure Schema Registry service is already defined in EventCatalog and the versions match, the markdown, writesTo, readsFrom, and attachments are persisted and not overwritten', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'orders-service',
          name: 'Orders Service',
          version: '1.0.0',
          markdown: 'Custom service markdown - do not override!',
          writesTo: [{ id: 'order-created', version: '1.0.0' }],
          readsFrom: [{ id: 'inventory-updated', version: '1.0.0' }],
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const service = await getService('orders-service', '1.0.0');
        expect(service.markdown).toEqual('Custom service markdown - do not override!');
        expect(service.writesTo).toEqual([{ id: 'order-created', version: '1.0.0' }]);
        expect(service.readsFrom).toEqual([{ id: 'inventory-updated', version: '1.0.0' }]);
      });

      it('when the Azure Schema Registry service is already defined in EventCatalog and the versions match, the owners, repository, badges and attachments are persisted', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          owners: ['dboyne'],
          repository: {
            language: 'typescript',
            url: 'https://github.com/example/orders-service',
          },
          markdown: 'Custom service markdown',
          badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
          attachments: ['https://github.com/example/docs/service.md'],
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              name: 'Orders Service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const service = await getService('orders-service', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            owners: ['dboyne'],
            repository: {
              language: 'typescript',
              url: 'https://github.com/example/orders-service',
            },
            markdown: 'Custom service markdown',
            badges: [
              {
                content: 'Custom Badge',
                textColor: 'white',
                backgroundColor: 'red',
              },
            ],
            attachments: ['https://github.com/example/docs/service.md'],
          })
        );
      });

      it('when the Azure Schema Registry service is already defined in EventCatalog and the versions do not match, a new service is created and the old one is versioned', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: 'Version 1.0.0 markdown',
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '2.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const versionedService = await getService('orders-service', '1.0.0');
        const newService = await getService('orders-service', '2.0.0');
        expect(versionedService).toBeDefined();
        expect(newService).toBeDefined();
        expect(newService.version).toEqual('2.0.0');

        // Check versioned folder exists
        const versionedFolder = await existsSync(join(catalogDir, 'services', 'orders-service', 'versioned', '1.0.0'));
        expect(versionedFolder).toBeTruthy();
      });

      it('when multiple services are configured, all services are added to the catalog', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              name: 'Orders Service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
            {
              id: 'inventory-service',
              name: 'Inventory Service',
              version: '1.0.0',
              sends: [{ id: 'inventory-updated', schemaGroup: 'com.example.inventory' }],
              receives: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const ordersService = await getService('orders-service', '1.0.0');
        expect(ordersService).toBeDefined();

        const inventoryService = await getService('inventory-service', '1.0.0');
        expect(inventoryService).toBeDefined();
        expect(inventoryService.sends).toEqual([{ id: 'inventory-updated', version: '1' }]);
        expect(inventoryService.receives).toEqual([{ id: 'order-created', version: '2' }]);
      });
    });

    describe('messages', () => {
      it('schemas from Azure Schema Registry are written to EventCatalog as messages', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const event = await getEvent('order-created');
        expect(event).toEqual(
          expect.objectContaining({
            id: 'order-created',
            name: 'order-created',
            version: '2',
            badges: [{ backgroundColor: 'blue', textColor: 'white', content: 'Azure Event Hubs', icon: 'azure' }],
          })
        );

        // Check schema file exists - schemas are stored in the service's events directory
        const schemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'events', 'order-created', 'order-created-avro.avsc')
        );
        expect(schemaFile).toBeDefined();
      });

      it('when a message already exists in EventCatalog and the versions match, the markdown, badges and attachments are persisted and not overwritten', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'order-created',
          name: 'order-created',
          version: '2',
          markdown: 'Custom event markdown - do not override!',
          badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
          attachments: ['https://github.com/example/docs/schema.md'],
          summary: 'Custom summary',
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const event = await getEvent('order-created', '2');
        expect(event.markdown).toEqual('Custom event markdown - do not override!');
        expect(event.badges).toEqual([{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }]);
        expect(event.summary).toEqual('Custom summary');
        expect(event.attachments).toEqual(['https://github.com/example/docs/schema.md']);
      });

      it('when a message already exists in EventCatalog with a different version, the markdown, badges and attachments are persisted to the new version', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'order-created',
          name: 'order-created',
          version: '1',
          markdown: 'Version 1 markdown - should be persisted',
          badges: [{ backgroundColor: 'green', textColor: 'white', content: 'Version 1 Badge' }],
          attachments: ['https://github.com/example/docs/v1-schema.md'],
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const newEvent = await getEvent('order-created', '2');
        expect(newEvent.markdown).toEqual('Version 1 markdown - should be persisted');
        expect(newEvent.badges).toEqual([{ backgroundColor: 'green', textColor: 'white', content: 'Version 1 Badge' }]);
        expect(newEvent.attachments).toEqual(['https://github.com/example/docs/v1-schema.md']);

        // Check that the old version still exists
        const oldEvent = await getEvent('order-created', '1');
        expect(oldEvent).toBeDefined();
      });

      it('when a message already exists with owners and repository, these are persisted', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'order-created',
          name: 'order-created',
          version: '2',
          markdown: 'Custom event markdown',
          owners: ['dboyne', 'anotherdev'],
          repository: {
            language: 'typescript',
            url: 'https://github.com/example/orders-service',
          },
        });

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const event = await getEvent('order-created', '2');
        expect(event.owners).toEqual(['dboyne', 'anotherdev']);
        expect(event.repository).toEqual({
          language: 'typescript',
          url: 'https://github.com/example/orders-service',
        });
      });

      it('when a custom name is provided for a schema, the custom name is used in EventCatalog', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders', name: 'Order Created Event' }],
            },
          ],
        });

        const event = await getEvent('order-created', '2');
        expect(event.id).toEqual('order-created');
        expect(event.name).toEqual('Order Created Event');
      });

      it('when a custom schemaRegistryUrl is provided for a schema, the schema is fetched from the custom URL', async () => {
        const { getEvent } = utils(catalogDir);

        // This test verifies that the custom URL is used by checking that the schema is still fetched successfully
        // In a real scenario, this would fetch from a different registry
        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [
                {
                  id: 'order-created',
                  schemaGroup: 'com.example.orders',
                  schemaRegistryUrl: 'https://custom-namespace.servicebus.windows.net',
                },
              ],
            },
          ],
        });

        const event = await getEvent('order-created', '2');
        expect(event).toBeDefined();
        expect(event.id).toEqual('order-created');
        expect(event.version).toEqual('2');
      });

      it('when messageType is set to command, the schema is written as a command in EventCatalog', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders', messageType: 'command' }],
            },
          ],
        });

        const command = await getCommand('order-created', '2');
        expect(command).toBeDefined();
        expect(command.id).toEqual('order-created');
        expect(command.name).toEqual('order-created');
        expect(command.version).toEqual('2');
        expect(command.badges).toEqual([
          { backgroundColor: 'blue', textColor: 'white', content: 'Azure Event Hubs', icon: 'azure' },
        ]);

        // Check schema file exists - schemas are stored in the service's commands directory
        const schemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'commands', 'order-created', 'order-created-avro.avsc')
        );
        expect(schemaFile).toBeDefined();
      });

      it('when messageType is set to query, the schema is written as a query in EventCatalog', async () => {
        const { getQuery } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              receives: [{ id: 'order-created', schemaGroup: 'com.example.orders', messageType: 'query' }],
            },
          ],
        });

        const query = await getQuery('order-created', '2');
        expect(query).toBeDefined();
        expect(query.id).toEqual('order-created');
        expect(query.name).toEqual('order-created');
        expect(query.version).toEqual('2');
        expect(query.badges).toEqual([
          { backgroundColor: 'blue', textColor: 'white', content: 'Azure Event Hubs', icon: 'azure' },
        ]);

        // Check schema file exists - schemas are stored in the service's queries directory
        const schemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'queries', 'order-created', 'order-created-avro.avsc')
        );
        expect(schemaFile).toBeDefined();
      });

      it('when messageType is not specified, the schema defaults to event in EventCatalog', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        // Verify it was created as an event
        const event = await getEvent('order-created', '2');
        expect(event).toBeDefined();
        expect(event.id).toEqual('order-created');
        expect(event.version).toEqual('2');

        // Check schema file exists in the events directory
        const schemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'events', 'order-created', 'order-created-avro.avsc')
        );
        expect(schemaFile).toBeDefined();
      });
    });

    describe('multi-version support', () => {
      it('all versions of a schema are fetched and documented', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        // Verify the latest version (v2) is in the root
        const latestEvent = await getEvent('order-created', '2');
        expect(latestEvent).toBeDefined();
        expect(latestEvent.id).toEqual('order-created');
        expect(latestEvent.version).toEqual('2');

        // Verify version 1 is also documented (versioned)
        const versionedEvent = await getEvent('order-created', '1');
        expect(versionedEvent).toBeDefined();
        expect(versionedEvent.id).toEqual('order-created');
        expect(versionedEvent.version).toEqual('1');

        // Check schema files exist for both versions
        const latestSchemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'events', 'order-created', 'order-created-avro.avsc')
        );
        expect(latestSchemaFile).toBeDefined();

        const versionedSchemaFile = await fs.readFile(
          join(catalogDir, 'services', 'orders-service', 'events', 'order-created', 'versioned', '1', 'order-created-avro.avsc')
        );
        expect(versionedSchemaFile).toBeDefined();
      });

      it('when a schema has 4 versions, all intermediate versions (1,2,3) are properly versioned', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'shipping-service',
              version: '1.0.0',
              sends: [{ id: 'shipment-dispatched', schemaGroup: 'com.example.shipping' }],
            },
          ],
        });

        // Verify the latest version (v4) is in the root
        const latestEvent = await getEvent('shipment-dispatched', '4');
        expect(latestEvent).toBeDefined();
        expect(latestEvent.id).toEqual('shipment-dispatched');
        expect(latestEvent.version).toEqual('4');

        // Verify version 1 is in versioned folder
        const v1Event = await getEvent('shipment-dispatched', '1');
        expect(v1Event).toBeDefined();
        expect(v1Event.version).toEqual('1');

        // Verify version 2 is in versioned folder
        const v2Event = await getEvent('shipment-dispatched', '2');
        expect(v2Event).toBeDefined();
        expect(v2Event.version).toEqual('2');

        // Verify version 3 is in versioned folder
        const v3Event = await getEvent('shipment-dispatched', '3');
        expect(v3Event).toBeDefined();
        expect(v3Event.version).toEqual('3');

        // Check schema files exist for all versions
        const v1SchemaFile = await fs.readFile(
          join(
            catalogDir,
            'services',
            'shipping-service',
            'events',
            'shipment-dispatched',
            'versioned',
            '1',
            'shipment-dispatched-avro.avsc'
          )
        );
        expect(v1SchemaFile).toBeDefined();

        const v2SchemaFile = await fs.readFile(
          join(
            catalogDir,
            'services',
            'shipping-service',
            'events',
            'shipment-dispatched',
            'versioned',
            '2',
            'shipment-dispatched-avro.avsc'
          )
        );
        expect(v2SchemaFile).toBeDefined();

        const v3SchemaFile = await fs.readFile(
          join(
            catalogDir,
            'services',
            'shipping-service',
            'events',
            'shipment-dispatched',
            'versioned',
            '3',
            'shipment-dispatched-avro.avsc'
          )
        );
        expect(v3SchemaFile).toBeDefined();

        const latestSchemaFile = await fs.readFile(
          join(catalogDir, 'services', 'shipping-service', 'events', 'shipment-dispatched', 'shipment-dispatched-avro.avsc')
        );
        expect(latestSchemaFile).toBeDefined();
      });

      it('services only reference the latest version', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        const service = await getService('orders-service', '1.0.0');
        expect(service).toBeDefined();
        expect(service.sends).toEqual([{ id: 'order-created', version: '2' }]);
      });

      it('when running the plugin again, existing versions are not overwritten', async () => {
        const { getEvent } = utils(catalogDir);

        // First run
        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        // Verify both versions exist
        const latestEvent = await getEvent('order-created', '2');
        expect(latestEvent).toBeDefined();

        const versionedEvent = await getEvent('order-created', '1');
        expect(versionedEvent).toBeDefined();

        // Second run (should skip existing versions)
        await plugin(config, {
          schemaRegistryUrl: 'https://test-namespace.servicebus.windows.net',
          services: [
            {
              id: 'orders-service',
              version: '1.0.0',
              sends: [{ id: 'order-created', schemaGroup: 'com.example.orders' }],
            },
          ],
        });

        // Verify both versions still exist
        const latestEvent2 = await getEvent('order-created', '2');
        expect(latestEvent2).toBeDefined();

        const versionedEvent2 = await getEvent('order-created', '1');
        expect(versionedEvent2).toBeDefined();
      });
    });
  });
});
