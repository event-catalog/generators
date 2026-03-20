import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'node:fs';
import artifactsMock from './mock-data/artifacts.json';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Fake eventcatalog config
const config = {
  title: 'My EventCatalog',
};

let catalogDir: string;

// Mock axios for Apicurio V3 API calls
vi.mock('axios', () => {
  // Multi-version artifact data for testing includeAllVersions (defined inside factory to avoid hoisting issues)
  const multiVersionArtifacts: Record<string, { versions: { version: string; globalId: number }[]; latestVersion: string }> = {
    'order-placed': {
      versions: [
        { version: '1', globalId: 1 },
        { version: '2', globalId: 2 },
        { version: '3', globalId: 3 },
      ],
      latestVersion: '3',
    },
    'order-cancelled': {
      versions: [{ version: '1', globalId: 4 }],
      latestVersion: '1',
    },
    'place-order': {
      versions: [{ version: '1', globalId: 5 }],
      latestVersion: '1',
    },
    'cancel-order': {
      versions: [{ version: '1', globalId: 6 }],
      latestVersion: '1',
    },
    'get-order-status': {
      versions: [{ version: '1', globalId: 7 }],
      latestVersion: '1',
    },
    'orders-service-openapi': {
      versions: [
        { version: '1.0.0', globalId: 8 },
        { version: '2.0.0', globalId: 9 },
      ],
      latestVersion: '2.0.0',
    },
    'orders-service-asyncapi': {
      versions: [{ version: '1.0.0', globalId: 10 }],
      latestVersion: '1.0.0',
    },
  };

  // Mock artifacts data (same as artifacts.json but inline)
  const mockArtifacts = {
    artifacts: [
      { artifactId: 'order-placed', name: 'order-placed', artifactType: 'AVRO', groupId: 'default' },
      { artifactId: 'order-cancelled', name: 'order-cancelled', artifactType: 'AVRO', groupId: 'default' },
      { artifactId: 'place-order', name: 'place-order', artifactType: 'JSON', groupId: 'default' },
      { artifactId: 'cancel-order', name: 'cancel-order', artifactType: 'JSON', groupId: 'default' },
      { artifactId: 'get-order-status', name: 'get-order-status', artifactType: 'JSON', groupId: 'default' },
      { artifactId: 'orders-service-openapi', name: 'orders-service-openapi', artifactType: 'OPENAPI', groupId: 'default' },
      { artifactId: 'orders-service-asyncapi', name: 'orders-service-asyncapi', artifactType: 'ASYNCAPI', groupId: 'default' },
    ],
    count: 7,
  };

  // Mock OpenAPI/AsyncAPI content
  const mockOpenApiContent = `openapi: 3.0.0
info:
  title: Orders API
  version: 2.0.0
paths:
  /orders:
    get:
      summary: Get orders`;

  const mockAsyncApiContent = `asyncapi: 2.6.0
info:
  title: Orders Events
  version: 1.0.0
channels:
  orders:
    publish:
      message:
        $ref: '#/components/messages/OrderPlaced'`;

  return {
    default: {
      create: () => ({
        get: (url: string) => {
          // Search artifacts
          if (url.includes('/search/artifacts')) {
            return Promise.resolve({ data: mockArtifacts });
          }
          // V3: Get artifact version content (ends with /content)
          if (url.includes('/content')) {
            // Extract artifactId and version from URL
            const artifactIdMatch = url.match(/\/artifacts\/([^/]+)\/versions/);
            const artifactId = artifactIdMatch ? artifactIdMatch[1] : 'order-placed';
            const versionMatch = url.match(/\/versions\/([^/]+)\/content/);
            const version = versionMatch ? versionMatch[1] : '1';

            // Return OpenAPI content for openapi artifacts
            if (artifactId === 'orders-service-openapi') {
              return Promise.resolve({ data: mockOpenApiContent });
            }

            // Return AsyncAPI content for asyncapi artifacts
            if (artifactId === 'orders-service-asyncapi') {
              return Promise.resolve({ data: mockAsyncApiContent });
            }

            // Default schema response for other artifacts
            return Promise.resolve({
              data: {
                type: 'record',
                name: 'OrderPlaced',
                version: version,
                fields: [
                  { name: 'orderId', type: 'string' },
                  { name: 'customerId', type: 'string' },
                  { name: 'amount', type: 'double' },
                  ...(version !== '1' ? [{ name: `addedInV${version}`, type: 'string' }] : []),
                ],
              },
            });
          }
          // V3: Get artifact versions list
          if (url.includes('/versions') && !url.includes('/versions/')) {
            // Extract artifactId from URL
            const artifactIdMatch = url.match(/\/artifacts\/([^/]+)\/versions/);
            const artifactId = artifactIdMatch ? artifactIdMatch[1] : 'order-placed';
            const artifactData = multiVersionArtifacts[artifactId] || {
              versions: [{ version: '1', globalId: 1 }],
              latestVersion: '1',
            };

            // Get artifact type from mock artifacts
            const mockArtifact = mockArtifacts.artifacts.find((a) => a.artifactId === artifactId);
            const artifactType = mockArtifact?.artifactType || 'AVRO';

            return Promise.resolve({
              data: {
                versions: artifactData.versions.map((v) => ({
                  ...v,
                  state: 'ENABLED',
                  createdOn: '2024-01-01T00:00:00Z',
                  modifiedOn: '2024-01-01T00:00:00Z',
                  type: artifactType,
                })),
                count: artifactData.versions.length,
              },
            });
          }
          // V3: Get artifact metadata (at /groups/{groupId}/artifacts/{artifactId})
          if (url.match(/\/groups\/[^/]+\/artifacts\/[^/]+$/) && !url.includes('/versions')) {
            const artifactId = url.split('/').pop() || 'order-placed';
            const mockArtifact = mockArtifacts.artifacts.find((a) => a.artifactId === artifactId);
            const artifactType = mockArtifact?.artifactType || 'AVRO';

            return Promise.resolve({
              data: {
                groupId: 'default',
                artifactId: artifactId,
                name: artifactId,
                artifactType: artifactType,
                type: artifactType,
                state: 'ENABLED',
                createdOn: '2024-01-01T00:00:00Z',
                modifiedOn: '2024-01-01T00:00:00Z',
              },
            });
          }
          return Promise.resolve({ data: {} });
        },
      }),
    },
  };
});

describe('Apicurio Registry EventCatalog Plugin', () => {
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
    // await fs.rm(join(catalogDir), { recursive: true });
  });

  it('when no url is provided, it throws an error', async () => {
    // @ts-ignore
    await expect(plugin(config, {})).rejects.toThrow('Please provide a url for the Apicurio Registry');
  });

  describe('when no services are configured (messages as events are written to the root of the catalog)', () => {
    it('all schemas are added to the catalog as events (within the events directory, when no services are configured)', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
      });

      const event = await getEvent('order-placed');
      // order-placed has 3 versions, latest is v3
      expect(event).toEqual(expect.objectContaining({ id: 'order-placed', version: '3' }));

      const eventsFolder = await existsSync(join(catalogDir, 'events', 'order-placed', 'index.mdx'));
      expect(eventsFolder).toBeTruthy();
    });

    it('if the event does not exist in the catalog, default values are given for the badges, summary and markdown', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: false,
      });

      const event = await getEvent('order-placed');
      expect(event.markdown).toEqual(expect.stringContaining('<NodeGraph />'));
      expect(event.badges).toEqual([{ backgroundColor: 'blue', textColor: 'white', content: 'Apicurio', icon: 'apicurio' }]);
      expect(event.summary).toEqual('Message from Apicurio Registry');
    });
  });

  describe('services', () => {
    it('when a service is configured, the service is added to the catalog with the configured messages (events or commands) as publishers and subscribers', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed', 'order-cancelled'] }],
            receives: [{ commands: ['place-order', 'cancel-order'] }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'orders-service',
          name: 'Orders Service',
          version: '1.0.0',
          sends: [
            { id: 'order-placed', version: '3' }, // order-placed has latest v3
            { id: 'order-cancelled', version: '1' },
          ],
          receives: [
            { id: 'place-order', version: '1' },
            { id: 'cancel-order', version: '1' },
          ],
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );
    });

    it('when the service has sends and receives configured, the messages are added to the catalog (within the service directory)', async () => {
      const { getEvent, getCommand } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            receives: [{ commands: ['place-order'] }],
          },
        ],
      });

      const event = await getEvent('order-placed');
      expect(event).toEqual(
        expect.objectContaining({
          id: 'order-placed',
          version: '3', // order-placed has latest v3
          markdown: expect.stringContaining('<NodeGraph />'),
          badges: [{ backgroundColor: 'blue', textColor: 'white', content: 'Apicurio', icon: 'apicurio' }],
          summary: 'Message from Apicurio Registry',
        })
      );

      const command = await getCommand('place-order');
      expect(command).toEqual(
        expect.objectContaining({
          id: 'place-order',
          version: '1',
        })
      );

      // Verify folder structure
      const eventsFolder = await existsSync(join(catalogDir, 'services', 'orders-service', 'events'));
      expect(eventsFolder).toBeTruthy();

      const commandsFolder = await existsSync(join(catalogDir, 'services', 'orders-service', 'commands'));
      expect(commandsFolder).toBeTruthy();
    });
  });

  describe('domains', () => {
    it('if a domain is configured along side the services, the domain is created and the services are added to the domain', async () => {
      const { getDomain } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            receives: [{ commands: ['place-order'] }],
          },
        ],
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      });

      const domain = await getDomain('orders', '0.0.1');
      expect(domain).toEqual(
        expect.objectContaining({
          id: 'orders',
          name: 'Orders',
          version: '0.0.1',
          services: [{ id: 'orders-service', version: '1.0.0' }],
          markdown: expect.stringContaining('<NodeGraph />'),
        })
      );

      // Verify folder structure
      const servicesFolder = await existsSync(join(catalogDir, 'domains', 'orders', 'services'));
      expect(servicesFolder).toBeTruthy();

      const ordersService = await existsSync(join(catalogDir, 'domains', 'orders', 'services', 'orders-service'));
      expect(ordersService).toBeTruthy();
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
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            receives: [{ commands: ['place-order'] }],
          },
        ],
        domain: { id: 'Agency', name: 'Agency Domain', version: '1.0.0' },
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();

      const subdomainServicePath = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency', 'services', 'orders-service');
      expect(existsSync(subdomainServicePath)).toBe(true);
    });
  });

  describe('filtering (prefix, suffix, exact)', () => {
    it('supports prefix matching for events', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: { prefix: 'order-' } }],
            receives: [],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');

      // Should match 'order-placed' and 'order-cancelled'
      expect(service.sends).toHaveLength(2);
      expect(service.sends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'order-placed' }),
          expect.objectContaining({ id: 'order-cancelled' }),
        ])
      );
    });

    it('supports suffix matching for events', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: { suffix: '-placed' } }],
            receives: [],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');

      // Should match only 'order-placed'
      expect(service.sends).toHaveLength(1);
      expect(service.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'order-placed' })]));
    });

    it('supports explicit exact matching via object for events', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: { exact: 'order-placed' } }],
            receives: [],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');

      // Should match only 'order-placed'
      expect(service.sends).toHaveLength(1);
      expect(service.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'order-placed' })]));
    });

    it('supports multiple conditions (prefix OR suffix)', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            // prefix matches nothing, suffix matches 'order-cancelled'
            sends: [{ events: { prefix: 'nomatch', suffix: '-cancelled' } }],
            receives: [],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');

      // Should match 'order-cancelled'
      expect(service.sends).toHaveLength(1);
      expect(service.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'order-cancelled' })]));
    });

    it('supports queries as a message type', async () => {
      const { getService, getQuery } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            receives: [{ queries: ['get-order-status'] }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');

      // Should have query in receives
      expect(service.receives).toHaveLength(1);
      expect(service.receives).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'get-order-status', version: '1' })])
      );

      // Query should be written to the catalog
      const query = await getQuery('get-order-status');
      expect(query).toBeDefined();
      expect(query.id).toEqual('get-order-status');
      expect(query.version).toEqual('1');
    });
  });

  describe('data persistence (reruns)', () => {
    it('if the event already exists in the catalog data is persisted (e.g markdown, badges, summary)', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'order-placed',
        name: 'order-placed',
        version: '1',
        markdown: 'This should be persisted',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        summary: 'This is custom summary',
      });

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
      });

      const event = await getEvent('order-placed');
      expect(event.markdown).toEqual('This should be persisted');
      expect(event.badges).toEqual([{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }]);
      expect(event.summary).toEqual('This is custom summary');
    });

    it('if the service already exists in the catalog data is persisted (e.g markdown, summary, owners)', async () => {
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'orders-service',
        version: '1.0.0',
        name: 'Orders Service',
        markdown: 'This markdown is persisted',
        summary: 'This is custom summary',
        owners: ['John Doe'],
      });

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service.markdown).toEqual('This markdown is persisted');
      expect(service.summary).toEqual('This is custom summary');
      expect(service.owners).toEqual(['John Doe']);

      // Should still have the new messages
      expect(service.sends).toHaveLength(1);
      expect(service.sends?.[0].id).toEqual('order-placed');
    });

    it('if the domain already exists in the catalog data is persisted (e.g markdown)', async () => {
      const { writeDomain, getDomain } = utils(catalogDir);

      await writeDomain({
        id: 'orders',
        name: 'Orders',
        version: '0.0.1',
        markdown: 'This markdown is persisted',
      });

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      });

      const domain = await getDomain('orders', '0.0.1');
      expect(domain.markdown).toEqual('This markdown is persisted');
    });
  });

  describe('multi-version support (includeAllVersions)', () => {
    it('when includeAllVersions is true, all versions of an artifact are fetched and documented', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: true,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // order-placed has 3 versions in the mock
      // The latest version (v3) should be in the root
      const latestEvent = await getEvent('order-placed', '3');
      expect(latestEvent).toBeDefined();
      expect(latestEvent.id).toEqual('order-placed');
      expect(latestEvent.version).toEqual('3');

      // Verify version 1 is also documented (in versioned folder)
      const v1Event = await getEvent('order-placed', '1');
      expect(v1Event).toBeDefined();
      expect(v1Event.id).toEqual('order-placed');
      expect(v1Event.version).toEqual('1');

      // Verify version 2 is also documented (in versioned folder)
      const v2Event = await getEvent('order-placed', '2');
      expect(v2Event).toBeDefined();
      expect(v2Event.id).toEqual('order-placed');
      expect(v2Event.version).toEqual('2');
    });

    it('when includeAllVersions is false (default), only the latest version is documented', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: false,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // order-placed has 3 versions in the mock, but only latest should be documented
      const latestEvent = await getEvent('order-placed', '3');
      expect(latestEvent).toBeDefined();
      expect(latestEvent.version).toEqual('3');

      // Version 1 should NOT be documented
      const v1Event = await getEvent('order-placed', '1');
      expect(v1Event).toBeUndefined();
    });

    it('versioned events have their schema files in versioned folders', async () => {
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: true,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // Check schema file exists for the latest version
      const latestSchemaFile = existsSync(
        join(catalogDir, 'services', 'orders-service', 'events', 'order-placed', 'order-placed.avsc')
      );
      expect(latestSchemaFile).toBeTruthy();

      // Check versioned folder exists for version 1
      const versionedFolder = existsSync(
        join(catalogDir, 'services', 'orders-service', 'events', 'order-placed', 'versioned', '1')
      );
      expect(versionedFolder).toBeTruthy();

      // Check schema file exists in versioned folder
      const v1SchemaFile = existsSync(
        join(catalogDir, 'services', 'orders-service', 'events', 'order-placed', 'versioned', '1', 'order-placed.avsc')
      );
      expect(v1SchemaFile).toBeTruthy();
    });

    it('versioned events have markdown files', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: true,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // Each versioned event should have its own markdown
      const v1Event = await getEvent('order-placed', '1');
      expect(v1Event.markdown).toBeDefined();
      expect(v1Event.markdown).toContain('<NodeGraph />');

      const v2Event = await getEvent('order-placed', '2');
      expect(v2Event.markdown).toBeDefined();
    });

    it('when re-running with includeAllVersions, existing versions are not duplicated', async () => {
      const { getEvent } = utils(catalogDir);

      // Run once
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: true,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // Run again
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        includeAllVersions: true,
        services: [
          {
            id: 'orders-service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
          },
        ],
      });

      // Should still have all versions without errors
      const v1Event = await getEvent('order-placed', '1');
      const v2Event = await getEvent('order-placed', '2');
      const v3Event = await getEvent('order-placed', '3');

      expect(v1Event).toBeDefined();
      expect(v2Event).toBeDefined();
      expect(v3Event).toBeDefined();
    });
  });

  describe('specifications', () => {
    it('when specifications are configured, they are fetched and attached to the service', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [{ type: 'openapi', artifactId: 'orders-service-openapi' }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');

      // Verify the spec file was created
      const specFileExists = existsSync(join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml'));
      expect(specFileExists).toBeTruthy();
    });

    it('when a specific version is provided for specification, that version is fetched', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [{ type: 'openapi', artifactId: 'orders-service-openapi', version: '1.0.0' }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');
    });

    it('when version is set to "latest", the latest version is fetched', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [{ type: 'openapi', artifactId: 'orders-service-openapi', version: 'latest' }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');

      // Verify the spec file was created
      const specFileExists = existsSync(join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml'));
      expect(specFileExists).toBeTruthy();
    });

    it('supports both openapi and asyncapi specifications on the same service', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [
              { type: 'openapi', artifactId: 'orders-service-openapi' },
              { type: 'asyncapi', artifactId: 'orders-service-asyncapi' },
            ],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');
      expect(service.specifications.asyncapiPath).toEqual('orders-service-asyncapi.asyncapi.yml');

      // Verify both spec files were created
      const openapiFileExists = existsSync(join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml'));
      const asyncapiFileExists = existsSync(
        join(catalogDir, 'services', 'orders-service', 'orders-service-asyncapi.asyncapi.yml')
      );
      expect(openapiFileExists).toBeTruthy();
      expect(asyncapiFileExists).toBeTruthy();
    });

    it('preserves existing specifications on service rerun', async () => {
      const { writeService, getService, addFileToService } = utils(catalogDir);

      // Pre-create service with existing specification
      await writeService({
        id: 'orders-service',
        name: 'Orders Service',
        version: '1.0.0',
        markdown: 'Existing service markdown',
        specifications: { openapiPath: 'existing-spec.openapi.yml' },
      });

      await addFileToService(
        'orders-service',
        {
          content: 'openapi: 3.0.0\ninfo:\n  title: Existing\n  version: 1.0.0',
          fileName: 'existing-spec.openapi.yml',
        },
        '1.0.0'
      );

      // Run plugin with asyncapi specification
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [{ type: 'asyncapi', artifactId: 'orders-service-asyncapi' }],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      // Should have both existing openapi and new asyncapi
      expect(service.specifications.openapiPath).toEqual('existing-spec.openapi.yml');
      expect(service.specifications.asyncapiPath).toEqual('orders-service-asyncapi.asyncapi.yml');
    });

    it('specification files contain correct content from registry', async () => {
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [{ type: 'openapi', artifactId: 'orders-service-openapi' }],
          },
        ],
      });

      // Read the spec file content
      const specFilePath = join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml');
      const specContent = await fs.readFile(specFilePath, 'utf-8');

      expect(specContent).toContain('openapi: 3.0.0');
      expect(specContent).toContain('Orders API');
    });

    it('when generator is configured, the spec file is still written correctly', async () => {
      const { getService } = utils(catalogDir);

      // The generator will fail to import since it's not installed, but the spec file should still be written
      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [
              {
                type: 'openapi',
                artifactId: 'orders-service-openapi',
                generator: ['@eventcatalog/generator-openapi', { debug: true }],
              },
            ],
          },
        ],
      });

      // Service and spec should still be created even if generator fails to load
      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');

      // Verify the spec file was created
      const specFileExists = existsSync(join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml'));
      expect(specFileExists).toBeTruthy();
    });

    it('generator config with asyncapi type creates correct spec file', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [
              {
                type: 'asyncapi',
                artifactId: 'orders-service-asyncapi',
                generator: ['@eventcatalog/generator-asyncapi', { parseSchemas: true }],
              },
            ],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications.asyncapiPath).toEqual('orders-service-asyncapi.asyncapi.yml');

      // Verify the spec file was created with correct content
      const specFilePath = join(catalogDir, 'services', 'orders-service', 'orders-service-asyncapi.asyncapi.yml');
      const specContent = await fs.readFile(specFilePath, 'utf-8');
      expect(specContent).toContain('asyncapi:');
      expect(specContent).toContain('Orders Events');
    });

    it('multiple specifications with different generators are processed correctly', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        registryUrl: 'http://localhost:8080',
        services: [
          {
            id: 'orders-service',
            name: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ['order-placed'] }],
            specifications: [
              {
                type: 'openapi',
                artifactId: 'orders-service-openapi',
                generator: ['@eventcatalog/generator-openapi', {}],
              },
              {
                type: 'asyncapi',
                artifactId: 'orders-service-asyncapi',
                generator: ['@eventcatalog/generator-asyncapi', {}],
              },
            ],
          },
        ],
      });

      const service = await getService('orders-service', '1.0.0');
      expect(service).toBeDefined();
      expect(service.specifications.openapiPath).toEqual('orders-service-openapi.openapi.yml');
      expect(service.specifications.asyncapiPath).toEqual('orders-service-asyncapi.asyncapi.yml');

      // Verify both spec files exist
      const openapiFileExists = existsSync(join(catalogDir, 'services', 'orders-service', 'orders-service-openapi.openapi.yml'));
      const asyncapiFileExists = existsSync(
        join(catalogDir, 'services', 'orders-service', 'orders-service-asyncapi.asyncapi.yml')
      );
      expect(openapiFileExists).toBeTruthy();
      expect(asyncapiFileExists).toBeTruthy();
    });
  });
});
