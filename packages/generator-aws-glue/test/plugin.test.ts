import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'node:fs';

// Add mock for the local checkLicense module
vi.mock('../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Mock the AWS SDK before importing anything else
vi.mock('@aws-sdk/client-glue', () => {
  const mockSend = vi.fn((command) => {
    // Check if it's a ListSchemasCommand
    if (command.input && 'RegistryId' in command.input) {
      return Promise.resolve({
        Schemas: [
          { SchemaName: 'customer_data', SchemaArn: 'arn:aws:glue:us-east-1:123456789012:schema/test-registry/customer_data' },
          { SchemaName: 'order_events', SchemaArn: 'arn:aws:glue:us-east-1:123456789012:schema/test-registry/order_events' },
          {
            SchemaName: 'inventory_updates',
            SchemaArn: 'arn:aws:glue:us-east-1:123456789012:schema/test-registry/inventory_updates',
          },
        ],
      });
    }
    // Check if it's a GetSchemaCommand
    if (
      command.input &&
      'SchemaId' in command.input &&
      !('SchemaVersionNumber' in command.input) &&
      !('SchemaVersionId' in command.input)
    ) {
      return Promise.resolve({
        SchemaName: command.input.SchemaId.SchemaArn?.split('/').pop(),
        RegistryName: 'test-registry',
        Compatibility: 'BACKWARD',
        Description: 'Test schema for event catalog',
      });
    }
    // Check if it's a ListSchemaVersionsCommand by looking for SchemaVersions in the expected response
    if (command.constructor.name === 'ListSchemaVersionsCommand') {
      const schemaName = command.input.SchemaId?.SchemaArn?.split('/').pop();
      if (schemaName === 'customer_data') {
        return Promise.resolve({
          Schemas: [
            { SchemaVersionId: 'v1', VersionNumber: 1, CreatedTime: '2024-01-01T00:00:00Z' },
            { SchemaVersionId: 'v2', VersionNumber: 2, CreatedTime: '2024-01-02T00:00:00Z' },
            { SchemaVersionId: 'v3', VersionNumber: 3, CreatedTime: '2024-01-03T00:00:00Z' },
          ],
        });
      }
      return Promise.resolve({
        Schemas: [{ SchemaVersionId: 'v1', VersionNumber: 1, CreatedTime: '2024-01-01T00:00:00Z' }],
      });
    }
    // Check if it's a GetSchemaVersionCommand with version ID
    if (command.input && 'SchemaVersionId' in command.input) {
      const versionId = command.input.SchemaVersionId;
      const versionNumber = parseInt(versionId.replace('v', ''));
      // Determine schema name from context or default to customer_data for multi-version test
      const schemaName = versionId.includes('order')
        ? 'order_events'
        : versionId.includes('inventory')
          ? 'inventory_updates'
          : 'customer_data';

      let fields = [];

      if (schemaName === 'customer_data') {
        fields = [
          { name: 'id', type: 'string', doc: 'Primary key' },
          { name: 'name', type: 'string', doc: 'Customer name' },
          { name: 'email', type: 'string', doc: 'Email address' },
        ];

        // Add more fields for newer versions
        if (versionNumber >= 2) {
          fields.push({ name: 'phone', type: 'string', doc: 'Phone number' });
        }
        if (versionNumber >= 3) {
          fields.push({ name: 'address', type: 'string', doc: 'Address' });
        }
      } else {
        fields = [
          { name: 'id', type: 'string', doc: 'Primary key' },
          { name: 'name', type: 'string', doc: 'Event name' },
          { name: 'timestamp', type: 'long', doc: 'Event timestamp' },
          { name: 'created_at', type: 'long', doc: 'Creation timestamp' },
        ];
      }

      const avroSchema = {
        type: 'record',
        name: schemaName,
        fields: fields,
      };

      return Promise.resolve({
        SchemaVersionId: versionId,
        VersionNumber: versionNumber,
        Status: 'AVAILABLE',
        SchemaDefinition: JSON.stringify(avroSchema, null, 2),
        DataFormat: 'AVRO',
        CreatedTime: `2024-01-0${versionNumber}T00:00:00Z`,
      });
    }
    // Check if it's a GetSchemaVersionCommand with LatestVersion
    if (command.input && 'SchemaVersionNumber' in command.input && command.input.SchemaVersionNumber.LatestVersion) {
      const schemaName = command.input.SchemaId?.SchemaArn?.split('/').pop();
      const latestVersion = schemaName === 'customer_data' ? 3 : 1;

      const fields = [
        { name: 'id', type: 'string', doc: 'Primary key' },
        { name: 'name', type: 'string', doc: 'Customer name' },
        { name: 'email', type: 'string', doc: 'Email address' },
      ];

      if (schemaName === 'customer_data' && latestVersion >= 2) {
        fields.push({ name: 'phone', type: 'string', doc: 'Phone number' });
      }
      if (schemaName === 'customer_data' && latestVersion >= 3) {
        fields.push({ name: 'address', type: 'string', doc: 'Address' });
      }
      if (schemaName !== 'customer_data') {
        fields.push({ name: 'created_at', type: 'long', doc: 'Creation timestamp' });
      }

      const avroSchema = {
        type: 'record',
        name: schemaName,
        fields: fields,
      };

      return Promise.resolve({
        SchemaVersionId: `${schemaName}-v${latestVersion}`,
        VersionNumber: latestVersion,
        Status: 'AVAILABLE',
        SchemaDefinition: JSON.stringify(avroSchema, null, 2),
        DataFormat: 'AVRO',
        CreatedTime: `2024-01-0${latestVersion}T00:00:00Z`,
      });
    }
    // Check if it's a GetTagsCommand
    if (command.input && 'ResourceArn' in command.input) {
      const resourceArn = command.input.ResourceArn;
      const schemaName = resourceArn.split('/').pop();

      // Mock different tags for different schemas
      const mockTags = {
        customer_data: { team: 'customer', env: 'prod', type: 'event' },
        order_events: { team: 'orders', env: 'prod', type: 'event' },
        inventory_updates: { team: 'inventory', env: 'staging', type: 'event' },
      };

      return Promise.resolve({
        Tags: mockTags[schemaName] || {},
      });
    }
    return Promise.resolve({});
  });

  return {
    GlueClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    ListSchemasCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetSchemaCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetSchemaVersionCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetTagsCommand: vi.fn().mockImplementation((input) => ({ input })),
    ListSchemaVersionsCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Mock the checkForPackageUpdate function
vi.mock('../../../../shared/check-for-package-update', () => ({
  checkForPackageUpdate: vi.fn().mockResolvedValue(undefined),
}));

// Import the plugin after all mocks are set up
import plugin from '../src/index';

const catalogDir = join(__dirname, 'catalog');

describe('AWS Glue Schema Registry Generator', () => {
  beforeEach(async () => {
    process.env.PROJECT_DIR = catalogDir;
    if (existsSync(catalogDir)) {
      await fs.rm(catalogDir, { recursive: true });
    }
    await fs.mkdir(catalogDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(catalogDir)) {
      await fs.rm(catalogDir, { recursive: true });
    }
    vi.clearAllMocks();
  });

  describe('Basic schema processing', () => {
    it('should generate events for all schemas when no services are provided', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
        }
      );

      const { getEvent } = utils(catalogDir);

      // Check that schemas were created as events
      const customerEvent = await getEvent('customer_data', 'latest');
      const orderEvent = await getEvent('order_events', 'latest');
      const inventoryEvent = await getEvent('inventory_updates', 'latest');

      expect(customerEvent).toBeDefined();
      expect(customerEvent?.name).toBe('customer_data');
      expect(customerEvent?.version).toBe('3');

      expect(orderEvent).toBeDefined();
      expect(orderEvent?.name).toBe('order_events');

      expect(inventoryEvent).toBeDefined();
      expect(inventoryEvent?.name).toBe('inventory_updates');
    });

    it('should add schema definitions to events', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
        }
      );

      // Check that schema files were created
      const schemaPath = join(catalogDir, 'events', 'customer_data', 'customer_data-schema.avsc');
      expect(existsSync(schemaPath)).toBe(true);

      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);

      expect(schema.type).toBe('record');
      expect(schema.name).toBe('customer_data');
      expect(schema.fields).toBeDefined();
      expect(schema.fields).toHaveLength(5);
      expect(schema.fields[0]).toEqual({
        name: 'id',
        type: 'string',
        doc: 'Primary key',
      });
    });
  });

  describe('Service mapping and filtering', () => {
    it('should map schemas to services based on exact schema name filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Customer Service',
              version: '1.0.0',
              sends: [{ schemaName: ['customer_data'] }],
              receives: [{ schemaName: ['order_events'] }],
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Customer Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(1);
      expect(service?.sends?.[0].id).toBe('customer_data');
      expect(service?.receives).toHaveLength(1);
      expect(service?.receives?.[0].id).toBe('order_events');
    });

    it('should map schemas to services based on prefix filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Customer Service',
              version: '1.0.0',
              sends: [{ prefix: ['customer_'] }],
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Customer Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(1);
      expect(service?.sends?.[0].id).toBe('customer_data');
    });

    it('should map schemas to services based on suffix filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Event Service',
              version: '1.0.0',
              receives: [{ suffix: ['_events'] }],
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Event Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.receives).toHaveLength(1);
      expect(service?.receives?.[0].id).toBe('order_events');
    });

    it('should map schemas to services based on data format filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'AVRO Service',
              version: '1.0.0',
              sends: [{ dataFormat: ['avro'] }],
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('AVRO Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(3); // All schemas have AVRO format in mock
    });

    it('should map schemas to services based on includes filters with arrays', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Analytics Service',
              version: '1.0.0',
              sends: [{ includes: ['customer', 'data'] }], // Array of includes
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Analytics Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(1); // customer_data matches both 'customer' and 'data'
      expect(service?.sends?.[0].id).toBe('customer_data');
    });

    it('should map schemas to services based on tags filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Customer Team Service',
              version: '1.0.0',
              sends: [{ tags: { team: 'customer' } }], // Filter by team tag
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Customer Team Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(1); // Only customer_data has team: 'customer'
      expect(service?.sends?.[0].id).toBe('customer_data');
    });

    it('should map schemas to services based on multiple tags filters', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Prod Event Service',
              version: '1.0.0',
              receives: [{ tags: { env: 'prod', type: 'event' } }], // Filter by multiple tags
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Prod Event Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.receives).toHaveLength(2); // customer_data and order_events have env: 'prod' and type: 'event'
      expect(service?.receives?.map((event) => event.id)).toContain('customer_data');
      expect(service?.receives?.map((event) => event.id)).toContain('order_events');
    });

    it('should not match schemas when tags filters do not match', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          services: [
            {
              id: 'Development Service',
              version: '1.0.0',
              sends: [{ tags: { env: 'dev' } }], // No schemas have env: 'dev'
            },
          ],
        }
      );

      const { getService } = utils(catalogDir);
      const service = await getService('Development Service', 'latest');

      expect(service).toBeDefined();
      expect(service?.sends).toHaveLength(0); // No schemas match the dev environment tag
    });
  });

  describe('Domain management', () => {
    it('should create domain and add services to it', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          domain: { id: 'ecommerce', name: 'E-commerce', version: '1.0.0' },
          services: [
            {
              id: 'Customer Service',
              version: '1.0.0',
              sends: [{ schemaName: ['customer_data'] }],
            },
          ],
        }
      );

      const { getDomain } = utils(catalogDir);
      const domain = await getDomain('ecommerce', 'latest');

      expect(domain).toBeDefined();
      expect(domain?.name).toBe('E-commerce');
      expect(domain?.version).toBe('1.0.0');

      // Check service is in domain
      const servicePath = join(catalogDir, 'domains', 'ecommerce', 'services', 'Customer Service', 'index.mdx');
      expect(existsSync(servicePath)).toBe(true);
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

      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          domain: { id: 'Agency', name: 'Agency Domain', version: '1.0.0' },
          services: [
            {
              id: 'Customer Service',
              version: '1.0.0',
              sends: [{ schemaName: ['customer_data'] }],
            },
          ],
        }
      );

      const service = await getService('Customer Service', '1.0.0');
      expect(service).toBeDefined();

      const subdomainServicePath = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency', 'services', 'Customer Service');
      expect(existsSync(subdomainServicePath)).toBe(true);
    });
  });

  describe('Configuration options', () => {
    it('should support different output formats', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          format: 'md',
        }
      );

      // Check that files are created with .md extension
      const eventPath = join(catalogDir, 'events', 'customer_data', 'index.md');
      expect(existsSync(eventPath)).toBe(true);
    });

    it('should write files to root when writeFilesToRoot is true', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          writeFilesToRoot: true,
          services: [
            {
              id: 'Customer Service',
              version: '1.0.0',
              sends: [{ schemaName: ['customer_data'] }],
            },
          ],
        }
      );

      // Events should be written to root level, not under service
      const eventPath = join(catalogDir, 'events', 'customer_data', 'index.mdx');
      expect(existsSync(eventPath)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should require services when domain is provided without services', async () => {
      await expect(
        plugin(
          {},
          {
            region: 'us-east-1',
            registryName: 'test-registry',
            domain: { id: 'test', name: 'Test', version: '1.0.0' },
          }
        )
      ).rejects.toThrow('Please provide services for your schemas. Please see the generator example and API docs');
    });
  });

  describe('Include all versions functionality', () => {
    it('should only fetch latest version when includeAllVersions is false or not provided', async () => {
      await plugin(
        {},
        {
          region: 'us-east-1',
          registryName: 'test-registry',
          includeAllVersions: false,
        }
      );

      const { getEvent } = utils(catalogDir);

      // Should only have the latest version (v3) for customer_data
      const customerEvent = await getEvent('customer_data', 'latest');
      expect(customerEvent).toBeDefined();
      expect(customerEvent?.version).toBe('3');

      // Check that the latest version has all fields
      const schemaPath = join(catalogDir, 'events', 'customer_data', 'customer_data-schema.avsc');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      expect(schema.fields).toHaveLength(5); // id, name, email, phone, address

      // Should not have older versions
      const versionedPath = join(catalogDir, 'events', 'customer_data', 'versioned');
      expect(existsSync(versionedPath)).toBe(false);
    });
  });
});
