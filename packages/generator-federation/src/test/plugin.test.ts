import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import fsExtra from 'fs-extra';
// Fake eventcatalog config
const eventCatalogConfig = {
  title: 'My EventCatalog',
};

let catalogDir: string;

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

describe('generator-federation', () => {
  beforeEach(async () => {
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
    if (fsExtra.existsSync(catalogDir)) {
      await fsExtra.remove(catalogDir);
    }
  });

  it(
    'clones the source directory and copies the files specified in the content to the destination directory',
    async () => {
      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        copy: [
          {
            content: 'examples/default/domains/E-Commerce/subdomains/Orders/services',
            destination: path.join(catalogDir, 'services'),
          },
        ],
      });

      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toHaveLength(4);
    },
    { timeout: 20000 }
  );

  it(
    'clones the source directory and copies the files specified in the content array to the destination directory',
    async () => {
      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        copy: [
          {
            content: [
              'examples/default/domains/E-Commerce/subdomains/Orders/services',
              'examples/default/domains/E-Commerce/subdomains/Payment/services',
            ],
            destination: path.join(catalogDir, 'services'),
          },
        ],
      });

      const services = await fs.readdir(path.join(catalogDir, 'services'));
      expect(services).toHaveLength(5);
    },
    { timeout: 20000 }
  );

  it(
    'if no copy configuration is provided then it clones target directory and copies all resources (e.g events, services, domains, teams, users) into the catalog',
    async () => {
      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog-ai-demo',
        override: true,
        destination: path.join(catalogDir),
      });

      const domains = await fs.readdir(path.join(catalogDir, 'domains'));
      expect(domains).toHaveLength(3);

      const teams = await fs.readdir(path.join(catalogDir, 'teams'));
      expect(teams).toHaveLength(2);

      const users = await fs.readdir(path.join(catalogDir, 'users'));
      expect(users).toHaveLength(3);
    },
    { timeout: 20000 }
  );

  it(
    'if a `sourceRootDir` is provided then it will be used as the root directory to copy files from',
    async () => {
      await plugin(eventCatalogConfig, {
        source: 'https://github.com/event-catalog/eventcatalog.git',
        sourceRootDir: 'examples/default',
        override: true,
        destination: path.join(catalogDir),
      });

      const files = await fs.readdir(catalogDir);
      console.log(files);

      const domains = await fs.readdir(path.join(catalogDir, 'domains'));
      expect(domains).toHaveLength(1);

      const subdomains = await fs.readdir(path.join(catalogDir, 'domains', 'E-Commerce', 'subdomains'));
      expect(subdomains).toHaveLength(3);

      const teams = await fs.readdir(path.join(catalogDir, 'teams'));
      expect(teams).toHaveLength(4);

      const users = await fs.readdir(path.join(catalogDir, 'users'));
      expect(users).toHaveLength(23);
    },
    { timeout: 20000 }
  );

  describe('branch', () => {
    it(
      'clones the source directory (with the given branch) and copies the files specified in the content array to the destination directory',
      async () => {
        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          copy: [
            {
              content: ['examples/basic/services'],
              destination: path.join(catalogDir, 'services'),
            },
          ],
          branch: 'v1',
        });

        const services = await fs.readdir(path.join(catalogDir, 'services'));
        expect(services).toHaveLength(2);
      },
      { timeout: 20000 }
    );
  });

  describe('override', () => {
    it(
      'overrides the content if the destination directory already exists and override is true',
      async () => {
        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          copy: [
            {
              content: ['examples/default/domains/E-Commerce/subdomains/Orders/services'],
              destination: path.join(catalogDir, 'services'),
            },
          ],
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          copy: [
            {
              content: ['examples/default/domains/E-Commerce/subdomains/Orders/services'],
              destination: path.join(catalogDir, 'services'),
            },
          ],
          override: true,
        });

        const services = await fs.readdir(path.join(catalogDir, 'services'));
        expect(services).toHaveLength(4);
      },
      { timeout: 20000 }
    );

    it(
      'overides the content if the destination directory already exists and override is true',
      async () => {
        const { writeService } = utils(catalogDir);
        await writeService({
          id: 'InventoryService',
          name: 'Inventory Service',
          version: '1.0.0',
          summary: 'The inventory service',
          markdown: 'Hello world',
        });

        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          copy: [
            {
              content: [
                'examples/default/domains/E-Commerce/subdomains/Orders/services',
                'examples/default/domains/E-Commerce/subdomains/Payment/services',
              ],
              destination: path.join(catalogDir, 'services'),
            },
          ],
          override: true,
        });

        const services = await fs.readdir(path.join(catalogDir, 'services'));
        expect(services).toHaveLength(5);
      },
      { timeout: 20000 }
    );
  });

  describe('error handling', () => {
    it(
      'throws an error if the content trying to copy is already in the destination directory',
      async () => {
        await plugin(eventCatalogConfig, {
          source: 'https://github.com/event-catalog/eventcatalog.git',
          copy: [
            {
              content: ['examples/default/domains/E-Commerce/subdomains/Orders/services'],
              destination: path.join(catalogDir, 'services'),
            },
          ],
        });

        await expect(
          plugin(eventCatalogConfig, {
            source: 'https://github.com/event-catalog/eventcatalog.git',
            copy: [
              {
                content: ['examples/default/domains/E-Commerce/subdomains/Orders/services'],
                destination: path.join(catalogDir, 'services'),
              },
            ],
          })
        ).rejects.toThrow(/Path already exists at/);
      },
      { timeout: 20000 }
    );

    it(
      'throws an error if any of the resources in the content are found in the destination directory',
      async () => {
        const { writeService } = utils(catalogDir);
        await writeService({
          id: 'InventoryService',
          name: 'Inventory Service',
          version: '1.0.0',
          summary: 'The inventory service',
          markdown: 'Hello world',
        });

        await expect(
          plugin(eventCatalogConfig, {
            source: 'https://github.com/event-catalog/eventcatalog.git',
            copy: [
              {
                content: [
                  'examples/default/domains/E-Commerce/subdomains/Orders/services',
                  'examples/default/domains/E-Commerce/subdomains/Payment/services',
                ],
                destination: path.join(catalogDir, 'services'),
              },
            ],
          })
        ).rejects.toThrow(/Path already exists at/);
      },
      { timeout: 20000 }
    );
  });

  describe('deep check', () => {
    it(
      'if deep check is true then each resource will be checked if it already exists in EventCatalog using its id',
      async () => {
        const { writeService } = utils(catalogDir);
        await writeService(
          {
            id: 'InventoryService',
            name: 'Inventory Service',
            version: '1.0.0',
            summary: 'The inventory service',
            markdown: 'Hello world',
          },
          {
            path: path.join('InventoryServiceDuplicated'),
          }
        );

        await expect(
          plugin(eventCatalogConfig, {
            source: 'https://github.com/event-catalog/eventcatalog.git',
            copy: [
              {
                content: ['examples/default/domains/E-Commerce/subdomains/Orders/services'],
                destination: path.join(catalogDir, 'services'),
              },
            ],
            enforceUniqueResources: true,
          })
        ).rejects.toThrow(/EventCatalog already has services with the id InventoryService/);
      },
      { timeout: 20000 }
    );
  });
});
