import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { vi } from 'vitest';
// Fake eventcatalog config
const config = {};

let catalogDir: string;
const asyncAPIExamplesDir = join(__dirname, 'asyncapi-files');

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

describe('AsyncAPI EventCatalog Plugin', () => {
  beforeEach(() => {
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
  });

  afterEach(async () => {
    if (existsSync(catalogDir)) await fs.rm(join(catalogDir), { recursive: true });
  });

  describe('service generation', () => {
    describe('domains', () => {
      it('if a domain is defined in the AsyncAPI file but the versions do not match, the existing domain is version and a new one is created', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders',
          name: 'Orders Domain',
          version: '0.0.1',
          markdown: '',
        });

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const versionedDomain = await getDomain('orders', '0.0.1');
        const newDomain = await getDomain('orders', '1.0.0');

        expect(versionedDomain.version).toEqual('0.0.1');
        expect(newDomain.version).toEqual('1.0.0');
        expect(newDomain.services).toEqual([{ id: 'account-service', version: '1.0.0' }]);
      });

      it('if a domain is defined in the AsyncAPI plugin configuration and that domain exists the AsyncAPI Service is added to that domain', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders',
          name: 'Orders Domain',
          version: '1.0.0',
          markdown: '',
        });

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const domain = await getDomain('orders', '1.0.0');
        expect(domain.services).toEqual([{ id: 'account-service', version: '1.0.0' }]);
      });

      it(
        'if multiple asyncapi files are processed, they are all added to the domain',
        async () => {
          const { getDomain } = utils(catalogDir);

          await plugin(config, {
            services: [
              { path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' },
              { path: join(asyncAPIExamplesDir, 'orders-service.asyncapi.yml'), id: 'orders-service' },
            ],
            domain: { id: 'orders', name: 'Orders', version: '1.0.0' },
          });

          const domain = await getDomain('orders', 'latest');

          expect(domain.services).toHaveLength(2);
          expect(domain.services).toEqual([
            { id: 'account-service', version: '1.0.0' },
            { id: 'orders-service', version: '1.0.1' },
          ]);
        },
        { timeout: 20000 }
      );

      it('if a domain is defined in the AsyncAPI plugin configuration and that domain does not exist, it is created', async () => {
        const { getDomain } = utils(catalogDir);

        expect(await getDomain('orders', '1.0.0')).toBeUndefined();

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const domain = await getDomain('orders', '1.0.0');
        expect(domain.services).toEqual([{ id: 'account-service', version: '1.0.0' }]);
      });

      it('if a domain is not defined in the AsyncAPI plugin configuration, the service is not added to any domains', async () => {
        const { getDomain } = utils(catalogDir);
        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        });
        expect(await getDomain('orders', '1.0.0')).toBeUndefined();
      });

      it(
        'if a domain is defined with owners, the owners are written to the domain',
        async () => {
          const { getDomain } = utils(catalogDir);
          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
            domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0', owners: ['John Doe', 'Jane Doe'] },
          });

          const domain = await getDomain('orders', '1.0.0');
          expect(domain.owners).toEqual(['John Doe', 'Jane Doe']);
        },
        { timeout: 20000 }
      );
    });

    describe('domain options', () => {
      describe('config option: template', () => {
        it('if a `template` value is given in the domain config options, then the generator uses that template to generate the domain markdown', async () => {
          const { getDomain } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
            domain: {
              id: 'orders',
              name: 'Orders Domain',
              version: '1.0.0',
              owners: ['John Doe', 'Jane Doe'],
              generateMarkdown: ({ domain, markdown }) => {
                return `
                  # My custom template

                  The domain is ${domain.name}

                  ${markdown}
                `;
              },
            },
          });

          const domain = await getDomain('orders', '1.0.0');

          expect(domain.markdown).toContain('# My custom template');
          expect(domain.markdown).toContain('The domain is Orders Domain');

          // The default markdown should be included as we added it in our custom template
          expect(domain.markdown).toContain('## Architecture diagram');
        });

        it('if no `template` value is given in the domain config options, then the generator uses the default markdown', async () => {
          const { getDomain } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
            domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0', owners: ['John Doe', 'Jane Doe'] },
          });

          const domain = await getDomain('orders', '1.0.0');

          expect(domain.markdown).toContain('## Architecture diagram');
        });
      });

      describe('config option: draft', () => {
        it('if a `draft` value is given in the domain config options, then the domain, services and all messages are added as `draft`', async () => {
          const { getDomain, getService, getEvent } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
            domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0', draft: true },
          });

          const domain = await getDomain('orders', '1.0.0');
          expect(domain.draft).toEqual(true);

          const service = await getService('account-service', '1.0.0');
          expect(service.draft).toEqual(true);

          const event = await getEvent('UserSignedUp');
          expect(event.draft).toEqual(true);
        });
      });
    });
  });

  describe('services', () => {
    it('asyncapi is mapped into a service in EventCatalog when no service with this name is already defined', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service');

      expect(service).toEqual(
        expect.objectContaining({
          id: 'account-service',
          name: 'Account Service',
          version: '1.0.0',
          summary: 'This service is in charge of processing user signups',
          badges: [
            {
              content: 'Events',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
            {
              content: 'Authentication',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('when the AsyncAPI service is already defined in EventCatalog and the versions match, only metadata is updated', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'account-service',
        version: '1.0.0',
        name: 'Random Name',
        markdown: '',
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'account-service',
          name: 'Account Service',
          version: '1.0.0',
          summary: 'This service is in charge of processing user signups',
          badges: [
            {
              content: 'Events',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
            {
              content: 'Authentication',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the markdown, writesTo, readsFrom, badges and attachments are persisted and not overwritten', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'account-service',
        version: '1.0.0',
        name: 'Random Name',
        markdown: 'Here is my original markdown, please do not override this!',
        writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
        readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'account-service',
          name: 'Account Service',
          version: '1.0.0',
          summary: 'This service is in charge of processing user signups',
          markdown: 'Here is my original markdown, please do not override this!',
          badges: [
            {
              content: 'Events',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
            {
              content: 'Authentication',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
          writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
          readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
        })
      );
    });

    it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the owners, repo, badges and attachments are persisted', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'account-service',
        version: '1.0.0',
        name: 'Random Name',
        owners: ['dboyne'],
        repository: {
          language: 'typescript',
          url: 'https://github.com/dboyne/eventcatalog',
        },
        markdown: 'Here is my original markdown, please do not override this!',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'account-service',
          name: 'Account Service',
          version: '1.0.0',
          summary: 'This service is in charge of processing user signups',
          owners: ['dboyne'],
          repository: {
            language: 'typescript',
            url: 'https://github.com/dboyne/eventcatalog',
          },
          markdown: 'Here is my original markdown, please do not override this!',
          badges: [
            {
              content: 'Custom Badge',
              textColor: 'white',
              backgroundColor: 'red',
            },
          ],
          attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
        })
      );
    });

    it('when the AsyncAPI service is already defined in EventCatalog and the versions do not match, a new service is created and the old one is versioned', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService } = utils(catalogDir);

      await writeService({
        id: 'account-service',
        version: '0.0.1',
        name: 'Account Service',
        markdown: '',
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const versionedService = await getService('account-service', '0.0.1');
      const newService = await getService('account-service', '1.0.0');
      expect(versionedService).toBeDefined();
      expect(newService).toBeDefined();
    });

    it('when the version is given to the service through the configuration, the service version is used over the AsyncAPI version', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service', version: '5.0.0' }],
      });

      const service = await getService('account-service');

      expect(service).toEqual(
        expect.objectContaining({
          id: 'account-service',
          name: 'Account Service',
          version: '5.0.0',
          summary: 'This service is in charge of processing user signups',
          badges: [
            {
              content: 'Events',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
            {
              content: 'Authentication',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    describe('sends', () => {
      it('any message with the operation `send` is added to the service. The service publishes this message.', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.sends).toHaveLength(2);
        expect(service.sends).toEqual([
          { id: 'UserSignedUp', version: '1.0.0' },
          { id: 'UserSignedOut', version: '1.0.0' },
        ]);
      });

      it('if the service is already defined and is sending messages these are persisted', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service',
          version: '1.0.0',
          name: 'Account Service',
          markdown: '',
          sends: [{ id: 'UserLoggedIn', version: '1.0.0' }],
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.sends).toHaveLength(3);
        expect(service.sends).toEqual([
          { id: 'UserLoggedIn', version: '1.0.0' },
          { id: 'UserSignedUp', version: '1.0.0' },
          { id: 'UserSignedOut', version: '1.0.0' },
        ]);
      });

      it('if the service is already defined and is sending messages these are persisted, messages are not duplicated in the list', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service',
          version: '1.0.0',
          name: 'Account Service',
          markdown: '',
          sends: [
            { id: 'UserSignedUp', version: '1.0.0' },
            { id: 'UserSignedOut', version: '1.0.0' },
          ],
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.sends).toHaveLength(2);
        expect(service.sends).toEqual([
          { id: 'UserSignedUp', version: '1.0.0' },
          { id: 'UserSignedOut', version: '1.0.0' },
        ]);
      });

      it('[AsyncApi 2.X] any message with the operation `publish` is added to the service. The service sends this message.', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi-v2.yml'), id: 'account-service' }],
        });

        const service = await getService('account-service', '1.0.0');

        expect(service.sends).toHaveLength(1);
        expect(service.sends).toEqual([{ id: 'SomeCoolpublishedMessage', version: '1.0.0' }]);
      });
    });

    describe('receives', () => {
      it('any message with the operation `receive` is added to the service. The service receives this message.', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.receives).toHaveLength(4);
        expect(service.receives).toEqual([
          { id: 'SignUpUser', version: '2.0.0' },
          {
            id: 'GetUserByEmail',
            version: '1.0.0',
          },
          {
            id: 'CheckEmailAvailability',
            version: '1.0.0',
          },
          { id: 'UserSubscribed', version: '1.0.0' },
        ]);
      });

      it('[AsyncApi 2.X] any message with the operation `subscribe` is added to the service. The service receives this message.', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi-v2.yml'), id: 'account-service' }],
        });

        const service = await getService('account-service', '1.0.0');

        expect(service.receives).toHaveLength(1);
        expect(service.receives).toEqual([{ id: 'SomeCoolReceivedMessage', version: '1.0.0' }]);
      });

      it('if the service is already defined and is receiving messages these are persisted', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service',
          version: '1.0.0',
          name: 'Account Service',
          markdown: '',
          receives: [{ id: 'UserLoggedIn', version: '1.0.0' }],
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.receives).toHaveLength(5);
        expect(service.receives).toEqual([
          { id: 'UserLoggedIn', version: '1.0.0' },
          { id: 'SignUpUser', version: '2.0.0' },
          { id: 'GetUserByEmail', version: '1.0.0' },
          { id: 'CheckEmailAvailability', version: '1.0.0' },
          { id: 'UserSubscribed', version: '1.0.0' },
        ]);
      });
    });

    it('the asyncapi file is added to the service which can be downloaded in eventcatalog', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');

      expect(service.schemaPath).toEqual('simple.asyncapi.yml');

      const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'));
      expect(schema).toBeDefined();
    });

    it('the original asyncapi file is added to the service by default instead of parsed version', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
      });

      const service = await getService('account-service', '1.0.0');

      expect(service.schemaPath).toEqual('simple.asyncapi.yml');

      const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf8');
      expect(schema).toBeDefined();
      expect(schema).not.toContain('x-parser-schema-id');
    });

    it('the original asyncapi file is added to the service instead of parsed version', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        saveParsedSpecFile: false,
      });

      const service = await getService('account-service', '1.0.0');

      expect(service.schemaPath).toEqual('simple.asyncapi.yml');

      const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf8');
      expect(schema).toBeDefined();
      expect(schema).not.toContain('x-parser-schema-id');
    });

    it('the original asyncapi file is not added but the parsed version', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        saveParsedSpecFile: true,
      });

      const service = await getService('account-service', '1.0.0');

      expect(service.schemaPath).toEqual('simple.asyncapi.yml');

      const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf8');
      expect(schema).toBeDefined();
      expect(schema).toContain('x-parser-schema-id');
    });

    it('the asyncapi specification file path is added to the service which can be rendered and visualized in eventcatalog', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');

      expect(service.specifications?.asyncapiPath).toEqual('simple.asyncapi.yml');

      const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'));
      expect(schema).toBeDefined();
    });

    it('if the service already has specifications attached to it, the asyncapi spec file is added to this list', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService, addFileToService, getSpecificationFilesForService } = utils(catalogDir);
      const existingVersion = '1.0.0';
      await writeService({
        id: 'account-service',
        version: existingVersion,
        name: 'Random Name',
        markdown: 'Here is my original markdown, please do not override this!',
        specifications: { openapiPath: 'simple.openapi.yml' },
      });

      await addFileToService(
        'account-service',
        {
          fileName: 'simple.openapi.yml',
          content: 'Some content',
        },
        existingVersion
      );

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', existingVersion);
      const specs = await getSpecificationFilesForService('account-service', existingVersion);

      expect(specs).toHaveLength(2);
      expect(specs[0]).toEqual({
        key: 'openapiPath',
        content: 'Some content',
        fileName: 'simple.openapi.yml',
        path: expect.anything(),
      });
      expect(specs[1]).toEqual({
        key: 'asyncapiPath',
        content: expect.anything(),
        fileName: 'simple.asyncapi.yml',
        path: expect.anything(),
      });

      expect(service.specifications).toEqual({
        openapiPath: 'simple.openapi.yml',
        asyncapiPath: 'simple.asyncapi.yml',
      });
    });

    it('if the service already has specifications attached to it including an AsyncAPI spec file the asyncapi file is overriden', async () => {
      // Create a service with the same name and version as the AsyncAPI file for testing
      const { writeService, getService, addFileToService, getSpecificationFilesForService } = utils(catalogDir);
      const existingVersion = '1.0.0';
      await writeService({
        id: 'account-service',
        version: existingVersion,
        name: 'Random Name',
        markdown: 'Here is my original markdown, please do not override this!',
        // Test with array format for specifications (new format)
        specifications: [
          { type: 'openapi', path: 'simple.openapi.yml' },
          { type: 'asyncapi', path: 'old.asyncapi.yml' },
        ],
      });

      await addFileToService(
        'account-service',
        {
          fileName: 'simple.openapi.yml',
          content: 'Some content',
        },
        existingVersion
      );

      await addFileToService(
        'account-service',
        {
          fileName: 'old.asyncapi.yml',
          content: 'old contents',
        },
        existingVersion
      );

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', existingVersion);
      const specs = await getSpecificationFilesForService('account-service', existingVersion);

      expect(specs).toHaveLength(2);
      expect(specs[0]).toEqual({
        key: 'openapi',
        content: 'Some content',
        fileName: 'simple.openapi.yml',
        path: expect.anything(),
      });
      expect(specs[1]).toEqual({
        key: 'asyncapi',
        content: expect.anything(),
        fileName: 'simple.asyncapi.yml',
        path: expect.anything(),
      });

      // Verify that the asyncapi file is overriden content
      expect(specs[1].content).not.toEqual('old contents');

      // Array format is preserved
      expect(service.specifications).toEqual([
        { type: 'openapi', path: 'simple.openapi.yml' },
        { type: 'asyncapi', path: 'simple.asyncapi.yml' },
      ]);
    });

    it('if the service has owners, these owners are written to the service', async () => {
      const { getService } = utils(catalogDir);
      await plugin(config, {
        services: [
          { path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service', owners: ['John Doe', 'Jane Doe'] },
        ],
      });

      const service = await getService('account-service', '1.0.0');
      expect(service.owners).toEqual(['John Doe', 'Jane Doe']);
    });

    it('if the service has a `x-eventcatalog-draft` header set to `true`, the service is added as `draft` and all the messages are added as `draft`', async () => {
      const { getService, getEvent, getChannels } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'draft-service.yml'), id: 'account-service' }],
      });

      const service = await getService('account-service', '1.0.0');
      expect(service.draft).toEqual(true);

      const event = await getEvent('UserSignedUp');
      expect(event.draft).toEqual(true);
    });

    it('when no draft settings are provided, all resources do not have a draft value', async () => {
      const { getService, getEvent } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
      });

      const service = await getService('account-service', '1.0.0');
      expect(service.draft).toEqual(undefined);

      const event = await getEvent('UserSignedUp');
      expect(event.draft).toEqual(undefined);
    });
  });

  describe('generator options', () => {
    describe('config option: id', () => {
      it('if an `id` value is given with the service, then the generator uses that id and does not generate one from the title', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'custom-id' }],
        });

        const service = await getService('custom-id', '1.0.0');

        expect(service).toBeDefined();
      });
    });
    describe('config options', () => {
      it('[name] if the `name` value is given in the service config options, then the service name is set to the config value', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              name: 'Awesome account service',
            },
          ],
        });

        const service = await getService('account-service', '1.0.0');
        expect(service.name).toEqual('Awesome account service');
      });

      it('[summary] if the `summary` value is given in the service config options, then the service summary is set to the config value', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              summary: 'Awesome account service summary',
            },
          ],
        });

        const service = await getService('account-service', '1.0.0');
        expect(service.summary).toEqual('Awesome account service summary');
      });

      it('[id] if the `id` not provided in the service config options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, {
            services: [
              {
                path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
                name: 'Awesome account service',
              } as any,
            ],
          })
        ).rejects.toThrow('The service id is required');
      });
      it('[services] if the `services` not provided in options, The generator throw an explicit error', async () => {
        await expect(plugin(config, {} as any)).rejects.toThrow('Please provide correct services configuration');
      });
      it('[services] if the `services` is undefiend in options, The generator throw an explicit error', async () => {
        await expect(plugin(config, { services: undefined } as any)).rejects.toThrow(
          'Please provide correct services configuration'
        );
      });
      it('[services::path] if the `services::path` not provided in options, The generator throw an explicit error', async () => {
        await expect(plugin(config, { services: [{ id: 'service_id' }] } as any)).rejects.toThrow(
          'The service path is required. please provide the path to specification file'
        );
      });
      it('[services::id] if the `services::id` not provided in options, The generator throw an explicit error', async () => {
        await expect(plugin(config, { services: [{ path: 'path/to/spec' }] } as any)).rejects.toThrow(
          'The service id is required. please provide the service id'
        );
      });
      it('[path] if the `path` not provided in service config options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, {
            services: [
              {
                name: 'Awesome account service',
                id: 'awsome-service',
              } as any,
            ],
          })
        ).rejects.toThrow('The service path is required. please provide the path to specification file');
      });
      it('[services::saveParsedSpecFile] if the `services::saveParsedSpecFile` not a boolean in options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, { services: [{ path: 'path/to/spec', id: 'sevice_id' }], saveParsedSpecFile: 'true' } as any)
        ).rejects.toThrow('The saveParsedSpecFile is not a boolean in options');
      });
      it('[domain::id] if the `domain::id` not provided in options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, {
            domain: { name: 'domain_name', version: '1.0.0' },
            services: [{ path: 'path/to/spec', id: 'sevice_id' }],
          } as any)
        ).rejects.toThrow('The domain id is required. please provide a domain id');
      });
      it('[domain::name] if the `domain::name` not provided in options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, {
            domain: { id: 'domain_name', version: '1.0.0' },
            services: [{ path: 'path/to/spec', id: 'sevice_id' }],
          } as any)
        ).rejects.toThrow('The domain name is required. please provide a domain name');
      });
      it('[domain::version] if the `domain::version` not provided in options, The generator throw an explicit error', async () => {
        await expect(
          plugin(config, {
            domain: { id: 'domain_name', name: 'domain_name' },
            services: [{ path: 'path/to/spec', id: 'sevice_id' }],
          } as any)
        ).rejects.toThrow('The domain version is required. please provide a domain version');
      });

      it('[services::writesTo] if the `services::writesTo` is given in the service config options, then the service writesTo is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              writesTo: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });
        const service = await getService('account-service', '1.0.0');
        expect(service.writesTo).toEqual([{ id: 'orders-service', version: '1.0.0' }]);
      });

      it('[services::readsFrom] if the `services::readsFrom` is given in the service config options, then the service readsFrom is set to the config value', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              readsFrom: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });
        const service = await getService('account-service', '1.0.0');
        expect(service.readsFrom).toEqual([{ id: 'orders-service', version: '1.0.0' }]);
      });

      it('if the service already has writesTo and readsFrom within the same version they are merged with any new values being added and unique values are kept', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              writesTo: [{ id: 'orders-service', version: '1.0.0' }],
              readsFrom: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });
        const service = await getService('account-service', '1.0.0');
        expect(service.writesTo).toEqual([{ id: 'orders-service', version: '1.0.0' }]);
        expect(service.readsFrom).toEqual([{ id: 'orders-service', version: '1.0.0' }]);

        // Now we add a new writesTo and readsFrom, but the values are different
        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              writesTo: [
                { id: 'orders-service-2', version: '1.0.0' },
                { id: 'orders-service', version: '1.0.0' },
              ],
              readsFrom: [
                { id: 'orders-service-2', version: '1.0.0' },
                { id: 'orders-service', version: '1.0.0' },
              ],
            },
          ],
        });
        const serviceUpdated = await getService('account-service', '1.0.0');
        expect(serviceUpdated.writesTo).toEqual([
          { id: 'orders-service', version: '1.0.0' },
          { id: 'orders-service-2', version: '1.0.0' },
        ]);
        expect(serviceUpdated.readsFrom).toEqual([
          { id: 'orders-service', version: '1.0.0' },
          { id: 'orders-service-2', version: '1.0.0' },
        ]);
      });
    });

    describe('config option: generateMarkdown', () => {
      it('if a `generateMarkdown` value is given in the service config options, then the generator uses that function to generate the service markdown', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'),
              id: 'account-service',
              generateMarkdown: ({ service, document, markdown }) => {
                console.log('markdown', markdown);
                return `
                # My custom markdown

                The service is ${service.name}
                The document is ${document.info().title()}

                ${markdown}
              `;
              },
            },
          ],
        });

        const service = await getService('account-service', '1.0.0');

        expect(service.markdown).toContain('My custom markdown');
        expect(service.markdown).toContain('The service is Account Service');
        expect(service.markdown).toContain('The document is Account Service');

        // The default markdown should be included as we added it in our cusotm template
        expect(service.markdown).toContain('## Architecture diagram');
        expect(service.markdown).toContain('## External documentation');
      });
      it('if no `generateMarkdown` value is given in the service config options, then the generator uses the default markdown', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');

        expect(service.markdown).toContain('## Architecture diagram');
      });
    });
  });

  describe('messages', () => {
    it('messages that do not have an eventcatalog header are documented as events by default in EventCatalog', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const event = await getEvent('UserSignedOut');

      expect(event).toEqual(
        expect.objectContaining({
          id: 'UserSignedOut',
          name: 'UserSignedOut',
          version: '1.0.0',
          summary: 'User signed out the application',
          badges: [
            {
              content: 'New',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('messages marked as "events" using the custom `x-eventcatalog-message-type` header in an AsyncAPI are documented in EventCatalog as events ', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const event = await getEvent('UserSignedUp');

      expect(event).toEqual(
        expect.objectContaining({
          id: 'UserSignedUp',
          name: 'UserSignedUp',
          version: '1.0.0',
          summary: 'User signed up the application',
          badges: [
            {
              content: 'New',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('messages marked as "commands" using the custom `x-eventcatalog-message-type` header in an AsyncAPI are documented in EventCatalog as commands ', async () => {
      const { getCommand } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const event = await getCommand('SignUpUser');

      expect(event).toEqual(
        expect.objectContaining({
          id: 'SignUpUser',
          name: 'SignUpUser',
          version: '2.0.0',
          summary: 'Sign up a user',
          badges: [
            {
              content: 'New',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('messages marked as "queries" using the custom `x-eventcatalog-message-type` header in an AsyncAPI are documented in EventCatalog as queries ', async () => {
      const { getQuery } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const query = await getQuery('CheckEmailAvailability');

      expect(query).toEqual(
        expect.objectContaining({
          id: 'CheckEmailAvailability',
          version: '1.0.0',
          name: 'CheckEmailAvailability',
          summary: 'Check if an email is available for registration',
          badges: [
            {
              content: 'Query',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
          schemaPath: 'schema.json',
        })
      );
    });

    it('messages are added as `draft` when custom `x-eventcatalog-draft` header is set to `true`', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'draft-messages.yml'), id: 'account-service' }] });

      const event = await getEvent('UserSignedUp');

      expect(event.draft).toEqual(true);
    });

    it('when the message already exists in EventCatalog but the versions do not match, the existing message is versioned', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'UserSignedUp',
        version: '0.0.1',
        name: 'UserSignedUp',
        markdown: '',
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const versionedEvent = await getEvent('UserSignedUp', '0.0.1');
      const newEvent = await getEvent('UserSignedUp', '1.0.0');

      expect(versionedEvent).toBeDefined();
      expect(newEvent).toBeDefined();
    });

    it('when a message already exists in EventCatalog the markdown, badges and attachments are persisted and not overwritten', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'UserSignedUp',
        version: '0.0.1',
        name: 'UserSignedUp',
        markdown: 'please dont override me!',
        badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
        attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const newEvent = await getEvent('UserSignedUp', '1.0.0');
      expect(newEvent.markdown).toEqual('please dont override me!');
      expect(newEvent.badges).toEqual([{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }]);
      expect(newEvent.attachments).toEqual(['https://github.com/dboyne/eventcatalog/blob/main/README.md']);
    });

    it('when a message already exists in EventCatalog with the same version the metadata is updated', async () => {
      const { writeEvent, getEvent } = utils(catalogDir);

      await writeEvent({
        id: 'UserSignedUp',
        version: '0.0.1',
        name: 'UserSignedUp',
        markdown: 'please dont override me!',
      });

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const newEvent = await getEvent('UserSignedUp', '1.0.0');
      expect(newEvent.markdown).toEqual('please dont override me!');
    });

    it('when the `x-eventcatalog-role` is defined and set to `client` the generator does not create or modify the message documentation, but still included in the service (sends/receives)', async () => {
      const { getEvent } = utils(catalogDir);
      const { getService } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');
      const newEvent = await getEvent('UserSubscribed', 'latest');

      // Event was not added to the EventCatalog
      expect(newEvent).toBeUndefined();

      expect(service.receives).toEqual([
        { id: 'SignUpUser', version: '2.0.0' },
        { id: 'GetUserByEmail', version: '1.0.0' },
        { id: 'CheckEmailAvailability', version: '1.0.0' },
        // The event we expect
        { id: 'UserSubscribed', version: '1.0.0' },
      ]);
    });

    it('when `x-eventcatalog-role` is defined on an operation and set to `client`, the message is treated as external', async () => {
      const { getEvent } = utils(catalogDir);
      const { getService } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'operation-role-client.asyncapi.yml'), id: 'account-service' }],
      });

      const service = await getService('account-service', '1.0.0');
      const event = await getEvent('UserSignedUp', 'latest');

      expect(event).toBeUndefined();
      expect(service.receives).toContainEqual({ id: 'UserSignedUp', version: '1.0.0' });
    });

    it('when the `x-eventcatalog-message-version` is defined on a message that version is used and not the the AsyncAPI version', async () => {
      const { getEvent } = utils(catalogDir);
      const { getService } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const service = await getService('account-service', '1.0.0');
      const event = await getEvent('SignUpUser', 'latest');

      // Event was not added to the EventCatalog
      expect(event).toBeDefined();
      expect(event.version).toEqual('2.0.0');
      expect(service.version).toEqual('1.0.0');
    });

    it('when the `x-eventcatalog-message-version` is not defined on a message but the service version is defined through configuration, the message version is set to the service version', async () => {
      const { getQuery } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service', version: '15.0.0' }],
      });

      const event = await getQuery('GetUserByEmail', '15.0.0');
      expect(event.version).toEqual('15.0.0');
    });

    it('when the `x-eventcatalog-message-version` is defined on a message the schema is stored against that version', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const event = await getEvent('SignUpUser', 'latest');

      // custom version is used
      expect(event.version).toEqual('2.0.0');
      expect(event.schemaPath).toEqual('schema.json');
    });

    it('when the `x-eventcatalog-deprecated-date` is defined on a message, the message is deprecated in EventCatalog', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

      const event = await getEvent('SignUpUser', 'latest');

      expect(event.deprecated).toEqual({
        date: '2025-04-09',
        message: 'This operation is deprecated because it is not used in the codebase',
      });
    });

    it('when the service has owners, the messages are given the same owners', async () => {
      const { getEvent } = utils(catalogDir);
      const { getService } = utils(catalogDir);

      await plugin(config, {
        services: [
          { path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service', owners: ['John Doe', 'Jane Doe'] },
        ],
      });

      const service = await getService('account-service', '1.0.0');
      const event = await getEvent('UserSignedUp', '1.0.0');

      expect(event.owners).toEqual(['John Doe', 'Jane Doe']);
      expect(service.owners).toEqual(['John Doe', 'Jane Doe']);
    });

    describe('config option: generateMarkdown', () => {
      it('if a `generateMarkdown` value is given in the message config options, then the generator uses that function to generate the message markdown', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          messages: {
            generateMarkdown: ({ message, markdown }) => {
              console.log('markdown', markdown);
              console.log('message', message);
              return `
                  # My custom markdown

                  ${markdown}
                `;
            },
          },
        });

        const event = await getEvent('UserSignedUp', '1.0.0');

        expect(event.markdown).toContain('# My custom markdown');

        // The default markdown should be included as we added it in our custom template
        expect(event.markdown).toContain('## Schema');
      });

      it('if no `generateMarkdown` value is given in the message config options, then the default markdown is used', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const event = await getEvent('UserSignedUp', '1.0.0');

        expect(event.markdown).toContain('## Schema');
      });
    });

    describe('config option: id', () => {
      it('if a `messages.id.prefix` value is given then the id of the message is prefixed with that value, but the folder name is not prefixed', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          messages: { id: { prefix: 'hello' } },
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        });

        const event = await getEvent('hello-UserSignedUp', '1.0.0');

        expect(event.id).toEqual('hello-UserSignedUp');
        expect(existsSync(join(catalogDir, 'services', 'account-service', 'events', 'UserSignedUp'))).toBe(true);
      });

      it('if a `messages.id.lowerCase` is set to true then the id of all messages is lowercased and the folder name is also lowercased', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          messages: { id: { lowerCase: true } },
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        });

        const event = await getEvent('usersignedup', '1.0.0');

        expect(event.id).toEqual('usersignedup');
        expect(existsSync(join(catalogDir, 'services', 'account-service', 'events', 'usersignedup'))).toBe(true);
      });

      it('if `messages.id.prefixWithServiceId` is set to true then the id of the message is prefixed with the service id, but the folder name is not prefixed', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          messages: { id: { prefixWithServiceId: true } },
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'accounts' }],
        });

        const event = await getEvent('accounts-UserSignedUp', '1.0.0');

        expect(event.id).toEqual('accounts-UserSignedUp');
        expect(existsSync(join(catalogDir, 'services', 'accounts', 'events', 'UserSignedUp'))).toBe(true);
      });

      it('if `messages.id.prefixWithServiceId` only the id  is prefixed with the service id and nothing else (e.g name)', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          messages: { id: { prefixWithServiceId: true } },
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'accounts' }],
        });

        const event = await getEvent('accounts-UserSignedUp', '1.0.0');

        expect(event.id).toEqual('accounts-UserSignedUp');
        expect(event.name).toEqual('UserSignedUp');
      });

      it('if a `messages.id.separator` value is given then the that separator is used to join the prefix and the message id', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          messages: { id: { separator: '_', prefix: 'hello' } },
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        });

        const event = await getEvent('hello_UserSignedUp', '1.0.0');

        expect(event.id).toEqual('hello_UserSignedUp');
      });
    });

    describe('schemas', () => {
      it('when a message has a schema defined in the AsyncAPI file, the schema is documented in EventCatalog', async () => {
        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const schema = await fs.readFile(
          join(catalogDir, 'services', 'account-service', 'events', 'UserSignedUp', 'schema.json')
        );

        expect(schema).toBeDefined();
      });

      it('when a message has a schema defined in the AsyncAPI file, the schema download is enabled in EventCatalog', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });
        const event = await getEvent('UserSignedUp', '1.0.0');

        expect(event.schemaPath).toEqual('schema.json');
      });

      it('when a domain is configured, the schema path is correctly cleaned of relative path segments and the schema is written to the correct location', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const event = await getEvent('UserSignedUp', '1.0.0');
        expect(event.schemaPath).toEqual('schema.json');

        // Verify the schema file exists at the correct location within the domain structure
        const schema = await fs.readFile(
          join(catalogDir, 'domains', 'orders', 'services', 'account-service', 'events', 'UserSignedUp', 'schema.json')
        );
        expect(schema).toBeDefined();

        // Verify the schema content is valid JSON
        const schemaParsed = JSON.parse(schema.toString());
        expect(schemaParsed).toHaveProperty('type');
      });
    });

    describe('bindings', () => {
      it('when a message has Google PubSub bindings defined, the bindings are rendered as markdown in the message documentation', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'google-pubsub.yml'), id: 'pubsub-service' }],
        });

        const event = await getEvent('orderCreated', '1.0.0');

        // Check that bindings are rendered in markdown
        expect(event.markdown).toContain('## Bindings');
        expect(event.markdown).toContain('### Google PubSub');
        expect(event.markdown).toContain('| Property | Value |');
        expect(event.markdown).toContain('attributes.eventType');
        expect(event.markdown).toContain('attributes.correlationId');
        expect(event.markdown).toContain('attributes.source');
      });

      it('when a message has Kafka bindings defined, the bindings are rendered as markdown in the message documentation', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'kafka-bindings.yml'), id: 'kafka-service' }],
        });

        const event = await getEvent('userCreated', '1.0.0');

        // Check that Kafka bindings are rendered in markdown
        expect(event.markdown).toContain('## Bindings');
        expect(event.markdown).toContain('### Kafka');
        expect(event.markdown).toContain('| Property | Value |');
        expect(event.markdown).toContain('schemaIdLocation');
        expect(event.markdown).toContain('schemaIdPayloadEncoding');
      });

      it('when a message has AMQP bindings defined, the bindings are rendered as markdown in the message documentation', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'amqp-bindings.yml'), id: 'amqp-service' }],
        });

        const event = await getEvent('notificationSent', '1.0.0');

        // Check that AMQP bindings are rendered in markdown
        expect(event.markdown).toContain('## Bindings');
        expect(event.markdown).toContain('### AMQP');
        expect(event.markdown).toContain('| Property | Value |');
        expect(event.markdown).toContain('contentEncoding');
        expect(event.markdown).toContain('messageType');
      });

      it('when a message has no bindings defined, no bindings section is added to the markdown', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
        });

        const event = await getEvent('UserSignedUp', '1.0.0');

        // No bindings section should be present
        expect(event.markdown).not.toContain('## Bindings');
      });
    });

    describe('channels', () => {
      describe('when `channels` is set to true in the generator configuration file', () => {
        it('all channels in the AsyncAPI file are documented in EventCatalog', async () => {
          const { getChannel, getChannels } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const channels = await getChannels();
          expect(channels).toHaveLength(4);

          const lightingMeasured = await getChannel('lightingMeasured');

          console.log(lightingMeasured.markdown);

          expect(lightingMeasured).toEqual({
            id: 'lightingMeasured',
            name: 'Lighting Measured Channel',
            address: 'smartylighting.streetlights.1.0.event.{streetlightId}.lighting.measured',
            summary: 'Inform about environmental lighting conditions of a particular streetlight.',
            version: '1.0.0',
            badges: [
              {
                content: 'kind:remote',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
              {
                content: 'visibility:private',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
            markdown: expect.toMatchMarkdown(`## Overview
              The topic on which measured values may be produced and consumed.
              <ChannelInformation />`),
            protocols: ['kafka'],
            parameters: {
              streetlightId: {
                description: 'The ID of the streetlight.',
              },
            },
          });
        });

        it('when no address, parameters, title or description is set on a channel the channel is still written to the catalog', async () => {
          const { getChannel, getChannels } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const lightsDim = await getChannel('lightsDim');

          expect(lightsDim).toEqual({
            id: 'lightsDim',
            name: 'lightsDim',
            version: '2.0.0',
            markdown: '<ChannelInformation />',
          });
        });

        it('when a channel has multiple servers with different protocols, those protocols are added to the channel', async () => {
          const { getChannel } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'multi-server-protocols.yml'), id: 'multi-server-protocols-service' }],
            parseChannels: true,
          });

          const ordersChannel = await getChannel('orders');
          expect(ordersChannel.protocols).toEqual(expect.arrayContaining(['kafka', 'ws']));
          expect(ordersChannel.protocols).toHaveLength(2);
        });

        it('when a channel has bindings and servers, protocols from both are added to the channel', async () => {
          const { getChannel } = utils(catalogDir);

          await plugin(config, {
            services: [
              {
                path: join(asyncAPIExamplesDir, 'channel-binding-and-server-protocols.yml'),
                id: 'channel-binding-and-server-protocols-service',
              },
            ],
            parseChannels: true,
          });

          const ordersChannel = await getChannel('orders');
          expect(ordersChannel.protocols).toEqual(expect.arrayContaining(['kafka', 'ws']));
          expect(ordersChannel.protocols).toHaveLength(2);
        });

        it('when a channel (root level) defines messages, these messages are linked to that channel', async () => {
          const { getEvent, getEvents } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const event = await getEvent('lightMeasured', '1.0.0');

          expect(event).toBeDefined();

          expect(event.channels).toEqual([
            {
              id: 'lightingMeasured',
              version: '1.0.0',
            },
          ]);
        });

        it('when the channel has a `x-eventcatalog-channel-version` value, that version is used over the global AsyncAPI version', async () => {
          const { getChannel, getEvent } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const channel = await getChannel('lightsDim');
          const event = await getEvent('dimLight');

          expect(channel.version).toEqual('2.0.0');
          expect(event.channels).toEqual([
            {
              id: 'lightsDim',
              version: '2.0.0',
            },
          ]);
        });

        it('if the channel already exists and the versions match the metadata is updated, but the markdown is not overwritten', async () => {
          const { writeChannel, getChannel } = utils(catalogDir);

          await writeChannel({
            id: 'lightingMeasured',
            version: '1.0.0',
            name: 'Lighting Measured Channel',
            markdown: 'please dont override me!',
          });

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const channel = await getChannel('lightingMeasured');

          expect(channel.markdown).toEqual('please dont override me!');
        });

        it('if the channel already exists and the versions do not match the existing channel is versioned', async () => {
          const { writeChannel, getChannel } = utils(catalogDir);

          await writeChannel({
            id: 'lightingMeasured',
            version: '0.0.5',
            name: 'Lighting Measured Channel',
            markdown: '',
          });

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const versionedChannel = await getChannel('lightingMeasured', '0.0.5');
          const newChannel = await getChannel('lightingMeasured', '1.0.0');

          expect(versionedChannel).toBeDefined();
          expect(newChannel).toBeDefined();
        });
      });

      it('if a channel has any tags, these are added to the channel in EventCatalog', async () => {
        const { getChannel, getChannels } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
          parseChannels: true,
        });

        const channels = await getChannels();
        expect(channels).toHaveLength(4);

        const lightingMeasured = await getChannel('lightingMeasured');

        expect(lightingMeasured.badges).toEqual([
          {
            content: 'kind:remote',
            textColor: 'blue',
            backgroundColor: 'blue',
          },
          {
            content: 'visibility:private',
            textColor: 'blue',
            backgroundColor: 'blue',
          },
        ]);
      });
    });

    describe('$ref', () => {
      it('AsyncAPI files with $ref are resolved and added to the catalog', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'ref-example.asyncapi.yml'), id: 'test-service' }] });

        const service = await getService('test-service', '1.1.0');
        const event = await getEvent('UserSignup', '1.1.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();
        expect(event.schemaPath).toEqual('schema.json');
      });

      it('if `parseSchemas` is false, the schemas for the AsyncAPI document are not parsed, and the original AsyncAPI file is saved against the service', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            { path: join(asyncAPIExamplesDir, 'asyncapi-with-avro-expect-not-to-parse-schemas.yml'), id: 'test-service' },
          ],
          saveParsedSpecFile: true,
          parseSchemas: false,
        });

        const service = await getService('test-service', '1.0.0');
        const event = await getEvent('lightMeasuredMessageAvro', '1.0.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();
        expect(event.schemaPath).toEqual('schema.avsc');

        const schema = await fs.readFile(
          join(catalogDir, 'services', 'test-service', 'events', 'lightMeasuredMessageAvro', 'schema.avsc'),
          'utf-8'
        );
        const parsedAsyncAPIFile = await fs.readFile(
          join(catalogDir, 'services', 'test-service', 'asyncapi-with-avro-expect-not-to-parse-schemas.yml'),
          'utf-8'
        );
        const parsedSchema = JSON.parse(schema);
        expect(parsedSchema).toEqual({
          type: 'record',
          name: 'UserCreated',
          namespace: 'com.example.events',
          fields: [
            {
              name: 'id',
              type: 'string',
              doc: 'User identifier',
            },
            {
              name: 'email',
              type: 'string',
              doc: "User's email address",
            },
            {
              name: 'createdAt',
              type: 'long',
              doc: 'Timestamp of user creation',
              logicalType: 'timestamp-millis',
            },
            {
              name: 'isActive',
              type: 'boolean',
              default: true,
            },
          ],
          'x-parser-schema-id': '<anonymous-schema-1>',
        });

        // Schema is now parsed, added as it was defined.
        expect(parsedAsyncAPIFile).toContain(`lightMeasuredMessageAvro:
          name: LightMeasuredAvro
          payload:
            schemaFormat: application/vnd.apache.avro;version=1.9.0
            schema:
              type: record
              name: UserCreated
              namespace: com.example.events
              fields:
                - name: id
                  type: string
                  doc: User identifier
                - name: email
                  type: string
                  doc: User's email address
                - name: createdAt
                  type: long
                  doc: Timestamp of user creation
                  logicalType: timestamp-millis
                - name: isActive
                  type: boolean
                  default: true`);
      });

      it('if the AsyncAPI has any $ref these are not saved to the service. The servive AsyncAPI is has no $ref', async () => {
        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'ref-example.asyncapi.yml'), id: 'Test Service' }],
          saveParsedSpecFile: true,
        });

        const asyncAPIFile = (
          await fs.readFile(join(catalogDir, 'services', 'Test Service', 'ref-example.asyncapi.yml'))
        ).toString();

        const expected = (await fs.readFile(join(asyncAPIExamplesDir, 'ref-example-without-refs.asyncapi.yml'))).toString();
        const normalizeLineEndings = (str: string) => str.replace(/\r\n/g, '\n');

        expect(normalizeLineEndings(asyncAPIFile.trim())).toEqual(normalizeLineEndings(expected.trim()));
      });
    });

    describe('asyncapi files with avro schemas', () => {
      it('parses the AsyncAPI file with avro schemas, and stores the avro schema against the event', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'asyncapi-with-avro.asyncapi.yml'), id: 'user-signup-api' }],
        });

        const service = await getService('user-signup-api', '1.0.0');
        const event = await getEvent('userSignedUp', '1.0.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();

        expect(event.schemaPath).toEqual('schema.avsc');

        // Check file schema.avsc
        const schema = await fs.readFile(
          join(catalogDir, 'services', 'user-signup-api', 'events', 'userSignedUp', 'schema.avsc'),
          'utf-8'
        );
        const schemaParsed = JSON.parse(schema);
        expect(schemaParsed).toEqual({
          type: 'record',
          name: 'UserSignedUp',
          namespace: 'com.company',
          doc: 'User sign-up information',
          fields: [
            {
              name: 'userId',
              type: 'int',
            },
            {
              name: 'userEmail',
              type: 'string',
            },
          ],
        });
      });
    });

    describe('AsyncAPI files as JSON', () => {
      it('parses the JSON spec file and writes the schema as JSON to the given service ', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'example-as-json.json'), id: 'user-service' }] });

        const service = await getService('user-service', '1.0.0');
        const event = await getEvent('UserUpdated', '1.0.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();

        const schema = await fs.readFile(join(catalogDir, 'services', 'user-service', 'example-as-json.json'), 'utf-8');
        expect(schema).toBeDefined();

        // verify its JSON
        const parsedJSON = JSON.parse(schema);
        expect(parsedJSON).toBeDefined();

        expect(parsedJSON).toEqual(
          expect.objectContaining({
            info: {
              title: 'User Service',
              version: '1.0.0',
              description: 'CRUD based API to handle User interactions for users of Kitchenshelf app.',
            },
          })
        );
      });
    });

    describe('headers option', () => {
      it('passes headers to fetch when fetching authenticated URLs', async () => {
        const yamlContent = await fs.readFile(join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), 'utf8');
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(yamlContent),
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch;

        try {
          const { getService } = utils(catalogDir);
          await plugin(config, {
            services: [
              {
                path: 'https://api.example.com/specs/asyncapi',
                id: 'authenticated-asyncapi-service',
                headers: {
                  Authorization: 'Bearer test-token',
                  'X-Custom-Header': 'custom-value',
                },
              },
            ],
          });

          const service = await getService('authenticated-asyncapi-service', '1.0.0');
          expect(service).toBeDefined();

          // Verify fetch was called with headers for getRawSpecFile
          expect(mockFetch).toHaveBeenCalled();
          const fetchCalls = mockFetch.mock.calls.filter(
            (call: any[]) => typeof call[0] === 'string' && call[0].includes('api.example.com')
          );
          expect(fetchCalls.length).toBeGreaterThan(0);
          const [, fetchOptions] = fetchCalls[0];
          expect(fetchOptions.headers).toEqual({
            Authorization: 'Bearer test-token',
            'X-Custom-Header': 'custom-value',
          });
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('does not set headers when none are provided for URL-based specs', async () => {
        const yamlContent = await fs.readFile(join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), 'utf8');
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(yamlContent),
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch;

        try {
          const { getService } = utils(catalogDir);
          await plugin(config, {
            services: [
              {
                path: 'https://api.example.com/specs/asyncapi',
                id: 'no-headers-service',
              },
            ],
          });

          const service = await getService('no-headers-service', '1.0.0');
          expect(service).toBeDefined();

          // Verify fetch was called without headers
          const fetchCalls = mockFetch.mock.calls.filter(
            (call: any[]) => typeof call[0] === 'string' && call[0].includes('api.example.com')
          );
          expect(fetchCalls.length).toBeGreaterThan(0);
          const [, fetchOptions] = fetchCalls[0];
          expect(fetchOptions?.headers).toBeUndefined();
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('AsyncAPI files as external urls', () => {
      it('when the `path` value is a URL then the plugin fetches the file and processes it', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: 'https://raw.githubusercontent.com/event-catalog/generator-asyncapi/refs/heads/main/src/test/asyncapi-files/simple.asyncapi.yml',
              id: 'account-service',
            },
          ],
        });

        const service = await getService('account-service');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'account-service',
            name: 'Account Service',
            version: '1.0.0',
            summary: 'This service is in charge of processing user signups',
            badges: [
              {
                content: 'Events',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
              {
                content: 'Authentication',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
          })
        );
      });

      it('when `saveParsedSpecFile` is false, the asyncapi file is requested from the given URL and stored against the service', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: 'https://raw.githubusercontent.com/event-catalog/generator-asyncapi/refs/heads/main/src/test/asyncapi-files/simple.asyncapi.yml',
              id: 'account-service',
            },
          ],
          saveParsedSpecFile: false,
        });

        const service = await getService('account-service', '1.0.0');

        expect(service.schemaPath).toEqual('simple.asyncapi.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf8');
        expect(schema).toBeDefined();
        expect(schema).not.toContain('x-parser-schema-id');
      });

      it('when `saveParsedSpecFile` is true, the asyncapi is requested from the given URL and is parsed then stored against the service', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: 'https://raw.githubusercontent.com/event-catalog/generator-asyncapi/refs/heads/main/src/test/asyncapi-files/simple.asyncapi.yml',
              id: 'account-service',
            },
          ],
          saveParsedSpecFile: true,
        });

        const service = await getService('account-service', '1.0.0');

        expect(service.schemaPath).toEqual('simple.asyncapi.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf8');
        expect(schema).toBeDefined();
        expect(schema).toContain('x-parser-schema-id');
      });
    });

    describe('writeFilesToRoot', () => {
      it('if `writeFilesToRoot` is true, the files are written to the root of the service', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          writeFilesToRoot: true,
        });

        const service = await getService('account-service', '1.0.0');
        expect(service.schemaPath).toEqual('simple.asyncapi.yml');

        const events = await fs.readdir(join(catalogDir, 'events'));
        expect(events).toEqual(['UserSignedOut', 'UserSignedUp']);

        const queries = await fs.readdir(join(catalogDir, 'queries'));
        expect(queries).toEqual(['CheckEmailAvailability', 'GetUserByEmail']);

        const commands = await fs.readdir(join(catalogDir, 'commands'));
        expect(commands).toEqual(['SignUpUser']);

        const services = await fs.readdir(join(catalogDir, 'services'));
        expect(services).toEqual(['account-service']);
        const file = await fs.readFile(join(catalogDir, 'services', 'account-service', 'simple.asyncapi.yml'), 'utf-8');
        expect(file).toBeDefined();
      });
    });

    it('when a messages has no payload, the message is still parsed and added to the catalog', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'asyncapi-without-payload.yml'), id: 'my-service' }],
      });

      const event = await getEvent('messageProjectDeleted', '1.0.0');
      expect(event).toEqual(
        expect.objectContaining({
          id: 'messageProjectDeleted',
          version: '1.0.0',
          name: 'Message.ProjectDeleted',
          summary: 'Message summary',
          badges: [],
          markdown: '## Architecture\n<NodeGraph />',
        })
      );
    });

    it('when the message payload specifies a schema format, the schema written to EventCatalog just documents the schema values', async () => {
      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'async-file-with-schema-format.yml'), id: 'my-service' }],
      });

      // Get the schema
      const schema = await fs.readFile(
        join(catalogDir, 'services', 'my-service', 'events', 'messageProjectDeleted', 'schema.json'),
        'utf-8'
      );

      const schemaParsed = JSON.parse(schema);

      expect(schemaParsed).toEqual({
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project id',
            example: 12345,
            'x-parser-schema-id': '<anonymous-schema-2>',
          },
          projectName: {
            type: 'string',
            description: 'The project name',
            example: 'My Project',
            'x-parser-schema-id': '<anonymous-schema-3>',
          },
        },
        'x-parser-schema-id': 'ProjectDeleted',
      });
    });

    it('when the AsyncAPI file has $ values in the message name, the message is parsed and added to the catalog', async () => {
      const { getEvent } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(asyncAPIExamplesDir, 'async-file-with-$-values.json'), id: 'my-service' }],
      });

      const event = await getEvent('de.maxdobler.springwolfexample.EventPublisher$ExampleStartedEvent', '1.0.0');
      expect(event).toEqual(
        expect.objectContaining({
          id: 'de.maxdobler.springwolfexample.EventPublisher$ExampleStartedEvent',
          version: '1.0.0',
          name: 'ExampleStartedEvent',
        })
      );
      expect(event.schemaPath).toEqual('schema.json');
    });

    describe('persisted data', () => {
      it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the markdown is persisted and not overwritten', async () => {
        // Create a service with the same name and version as the AsyncAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          styles: {
            icon: 'BellIcon',
            node: {
              color: 'red',
              label: 'Custom Label',
            },
          },
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'account-service',
            name: 'Account Service',
            version: '1.0.0',
            summary: 'This service is in charge of processing user signups',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [
              {
                content: 'Events',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
              {
                content: 'Authentication',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
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

      it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the diagrams are persisted and not overwritten', async () => {
        // Create a service with the same name and version as the AsyncAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service-diagrams',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          diagrams: [
            {
              id: 'my-custom-diagram',
              title: 'My Custom Diagram',
            },
          ],
        });

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service-diagrams' }],
        });

        const service = await getService('account-service-diagrams', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'account-service-diagrams',
            name: 'Account Service',
            version: '1.0.0',
            summary: 'This service is in charge of processing user signups',
            markdown: 'Here is my original markdown, please do not override this!',
            diagrams: [
              {
                id: 'my-custom-diagram',
                title: 'My Custom Diagram',
              },
            ],
          })
        );
      });
    });
  });
});
