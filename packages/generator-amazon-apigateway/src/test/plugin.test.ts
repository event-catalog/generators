import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { vi } from 'vitest';
import { GetExportCommand, GetRestApisCommand } from '@aws-sdk/client-api-gateway';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Fake eventcatalog config
const config = {};

let catalogDir: string;

const setupMocks = async () => {
  vi.mock('@aws-sdk/client-api-gateway', () => ({
    APIGatewayClient: vi.fn(() => ({
      send: vi.fn((command) => {
        if (command instanceof GetRestApisCommand) {
          return Promise.resolve({
            items: [{ id: 'abc123', name: 'InfaApi' }],
          });
        }
        if (command instanceof GetExportCommand) {
          const mockFile = join(__dirname, 'mocks', 'amazon-apigateway-mock-response.json');
          const file = fsSync.readFileSync(mockFile, 'utf-8');
          const parsedSpec = JSON.parse(file);
          return Promise.resolve({
            body: parsedSpec,
          });
        }
      }),
    })),
    GetRestApisCommand: vi.fn(),
    GetExportCommand: vi.fn(),
  }));
};

describe('Amazon API Gateway Plugin', () => {
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

    await setupMocks();
  });

  afterEach(async () => {
    await fs.rm(join(catalogDir), { recursive: true });
  });

  it('takes a given API name, fetches the OpenAPI (v3) version of the spec and writes it to the given output', async () => {
    await plugin(config, {
      output: 'amazon-apigateway-specs',
      apis: [
        {
          name: 'InfaApi',
          region: 'us-east-1',
          stageName: 'prod',
          routes: {
            'post /users': {
              type: 'command',
              id: 'create-user',
              name: 'Create User Command',
              description: 'Creates a new user in the system',
            },
          },
        },
      ],
    });

    const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');

    expect(file).toBeDefined();
  });

  describe('version', () => {
    it('if not version if given to the configuration a default version of `1` is set on the spec', async () => {
      await plugin(config, {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'InfaApi',
            region: 'us-east-1',
            stageName: 'prod',
            routes: {
              'post /users': {
                type: 'command',
              },
            },
          },
        ],
      });

      const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
      const parsedSpec = JSON.parse(file);

      expect(parsedSpec.info.version).toEqual('1');
    });

    it('if a version is given to the configuration that version is used for the specification file', async () => {
      await plugin(config, {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'InfaApi',
            region: 'us-east-1',
            version: 2,
            stageName: 'prod',
            routes: {
              'post /users': {
                type: 'command',
              },
            },
          },
        ],
      });

      const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
      const parsedSpec = JSON.parse(file);

      expect(parsedSpec.info.version).toEqual('2');
    });
  });

  describe('eventcatalog extension hydration', () => {
    ['command', 'query', 'event'].forEach((type) => {
      it(`when the message is given a type (${type}), that type is transformed into a x-eventcatalog-message-type extension`, async () => {
        await plugin(config, {
          output: 'amazon-apigateway-specs',
          apis: [
            {
              name: 'InfaApi',
              region: 'us-east-1',
              stageName: 'prod',
              routes: {
                'get /orders': {
                  type: type as 'command' | 'query' | 'event',
                },
              },
            },
          ],
        });

        const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
        const parsedSpec = JSON.parse(file);

        expect(parsedSpec.paths['/orders'].get['x-eventcatalog-message-type']).toEqual(type);
      });
    });

    it('when a message id is given, it is transformed into a x-eventcatalog-message-id extension', async () => {
      await plugin(config, {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'InfaApi',
            region: 'us-east-1',
            stageName: 'prod',
            routes: {
              'get /orders': {
                type: 'command',
                id: 'MyCustomId',
              },
            },
          },
        ],
      });

      const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
      const parsedSpec = JSON.parse(file);

      expect(parsedSpec.paths['/orders'].get['x-eventcatalog-message-id']).toEqual('MyCustomId');
    });

    it('when a message name is given, it is transformed into a x-eventcatalog-message-name extension', async () => {
      await plugin(config, {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'InfaApi',
            region: 'us-east-1',
            stageName: 'prod',
            routes: {
              'get /orders': {
                type: 'command',
                name: 'MyCustomName',
              },
            },
          },
        ],
      });

      const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
      const parsedSpec = JSON.parse(file);

      expect(parsedSpec.paths['/orders'].get['x-eventcatalog-message-name']).toEqual('MyCustomName');
    });

    it('if the schema is empty, the x-eventcatalog-render-schema-viewer extension is set to false on that component', async () => {
      await plugin(config, {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'InfaApi',
            region: 'us-east-1',
            stageName: 'prod',
            routes: {
              'get /orders': {
                type: 'command',
                name: 'MyCustomName',
              },
            },
          },
        ],
      });

      const file = await fs.readFile(join(catalogDir, 'amazon-apigateway-specs', 'InfaApi.json'), 'utf-8');
      const parsedSpec = JSON.parse(file);

      expect(parsedSpec.components.schemas.Empty['x-eventcatalog-render-schema-viewer']).toEqual(false);
    });
  });
});
