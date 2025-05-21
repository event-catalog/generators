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
  describe('service generation', () => {
    beforeEach(() => {
      catalogDir = join(__dirname, 'catalog') || '';
      process.env.PROJECT_DIR = catalogDir;
    });

    afterEach(async () => {
      if (existsSync(catalogDir)) await fs.rm(join(catalogDir), { recursive: true });
    });

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

      it('if multiple asyncapi files are processed, they are all added to the domain', async () => {
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
      });

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

      it('if a domain is defined with owners, the owners are written to the domain', async () => {
        const { getDomain } = utils(catalogDir);
        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0', owners: ['John Doe', 'Jane Doe'] },
        });

        const domain = await getDomain('orders', '1.0.0');
        expect(domain.owners).toEqual(['John Doe', 'Jane Doe']);
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

      it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the markdown is persisted and not overwritten', async () => {
        // Create a service with the same name and version as the AsyncAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'account-service',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
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
          })
        );
      });

      it('when the AsyncAPI service is already defined in EventCatalog and the versions match, the owners and repo are persisted', async () => {
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

      describe('sends', () => {
        it('any message with the operation `send` is added to the service. The service publishes this message.', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

          const service = await getService('account-service', '1.0.0');

          expect(service.sends).toHaveLength(2);
          expect(service.sends).toEqual([
            { id: 'usersignedup', version: '1.0.0' },
            { id: 'usersignedout', version: '1.0.0' },
          ]);
        });

        it('if the service is already defined and is sending messages these are persisted', async () => {
          const { writeService, getService } = utils(catalogDir);

          await writeService({
            id: 'account-service',
            version: '1.0.0',
            name: 'Account Service',
            markdown: '',
            sends: [{ id: 'userloggedin', version: '1.0.0' }],
          });

          await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

          const service = await getService('account-service', '1.0.0');

          expect(service.sends).toHaveLength(3);
          expect(service.sends).toEqual([
            { id: 'userloggedin', version: '1.0.0' },
            { id: 'usersignedup', version: '1.0.0' },
            { id: 'usersignedout', version: '1.0.0' },
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
              { id: 'usersignedup', version: '1.0.0' },
              { id: 'usersignedout', version: '1.0.0' },
            ],
          });

          await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

          const service = await getService('account-service', '1.0.0');

          expect(service.sends).toHaveLength(2);
          expect(service.sends).toEqual([
            { id: 'usersignedup', version: '1.0.0' },
            { id: 'usersignedout', version: '1.0.0' },
          ]);
        });

        it('[AsyncApi 2.X] any message with the operation `publish` is added to the service. The service sends this message.', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi-v2.yml'), id: 'account-service' }],
          });

          const service = await getService('account-service', '1.0.0');

          expect(service.sends).toHaveLength(1);
          expect(service.sends).toEqual([{ id: 'somecoolpublishedmessage', version: '1.0.0' }]);
        });
      });

      describe('receives', () => {
        it('any message with the operation `receive` is added to the service. The service receives this message.', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

          const service = await getService('account-service', '1.0.0');

          expect(service.receives).toHaveLength(4);
          expect(service.receives).toEqual([
            { id: 'signupuser', version: '2.0.0' },
            {
              id: 'getuserbyemail',
              version: '1.0.0',
            },
            {
              id: 'checkemailavailability',
              version: '1.0.0',
            },
            { id: 'usersubscribed', version: '1.0.0' },
          ]);
        });

        it('[AsyncApi 2.X] any message with the operation `subscribe` is added to the service. The service receives this message.', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi-v2.yml'), id: 'account-service' }],
          });

          const service = await getService('account-service', '1.0.0');

          expect(service.receives).toHaveLength(1);
          expect(service.receives).toEqual([{ id: 'somecoolreceivedmessage', version: '1.0.0' }]);
        });

        it('if the service is already defined and is receiving messages these are persisted', async () => {
          const { writeService, getService } = utils(catalogDir);

          await writeService({
            id: 'account-service',
            version: '1.0.0',
            name: 'Account Service',
            markdown: '',
            receives: [{ id: 'userloggedin', version: '1.0.0' }],
          });

          await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

          const service = await getService('account-service', '1.0.0');

          expect(service.receives).toHaveLength(5);
          expect(service.receives).toEqual([
            { id: 'userloggedin', version: '1.0.0' },
            { id: 'signupuser', version: '2.0.0' },
            { id: 'getuserbyemail', version: '1.0.0' },
            { id: 'checkemailavailability', version: '1.0.0' },
            { id: 'usersubscribed', version: '1.0.0' },
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
          specifications: { openapiPath: 'simple.openapi.yml', asyncapiPath: 'old.asyncapi.yml' },
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

        // Verify that the asyncapi file is overriden content
        expect(specs[1].content).not.toEqual('old contents');

        expect(service.specifications).toEqual({
          openapiPath: 'simple.openapi.yml',
          asyncapiPath: 'simple.asyncapi.yml',
        });
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
    });

    describe('generator options', () => {
      describe('config option: id', () => {
        it('if an `id` value is given with the service, then the generator uses that id and does not generate one from the title', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service', id: 'custom-id' }],
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
      });
    });

    describe('messages', () => {
      it('messages that do not have an eventcatalog header are documented as events by default in EventCatalog', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const event = await getEvent('usersignedout');

        expect(event).toEqual(
          expect.objectContaining({
            id: 'usersignedout',
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

      it('messages marked as "events" using the custom `ec-message-type` header in an AsyncAPI are documented in EventCatalog as events ', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const event = await getEvent('usersignedup');

        expect(event).toEqual(
          expect.objectContaining({
            id: 'usersignedup',
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

        const event = await getCommand('signupuser');

        expect(event).toEqual(
          expect.objectContaining({
            id: 'signupuser',
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

      it('messages marked as "queries" using the custom `ec-message-type` header in an AsyncAPI are documented in EventCatalog as queries ', async () => {
        const { getQuery } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const query = await getQuery('checkemailavailability');

        expect(query).toEqual(
          expect.objectContaining({
            id: 'checkemailavailability',
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

      it('when the message already exists in EventCatalog but the versions do not match, the existing message is versioned', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'usersignedup',
          version: '0.0.1',
          name: 'UserSignedUp',
          markdown: '',
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const versionedEvent = await getEvent('usersignedup', '0.0.1');
        const newEvent = await getEvent('usersignedup', '1.0.0');

        expect(versionedEvent).toBeDefined();
        expect(newEvent).toBeDefined();
      });

      it('when a message already exists in EventCatalog the markdown is persisted and not overwritten', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'usersignedup',
          version: '0.0.1',
          name: 'UserSignedUp',
          markdown: 'please dont override me!',
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const newEvent = await getEvent('usersignedup', '1.0.0');
        expect(newEvent.markdown).toEqual('please dont override me!');
      });

      it('when a message already exists in EventCatalog with the same version the metadata is updated', async () => {
        const { writeEvent, getEvent } = utils(catalogDir);

        await writeEvent({
          id: 'usersignedup',
          version: '0.0.1',
          name: 'UserSignedUp',
          markdown: 'please dont override me!',
        });

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const newEvent = await getEvent('usersignedup', '1.0.0');
        expect(newEvent.markdown).toEqual('please dont override me!');
      });

      it('when the `x-eventcatalog-role` is defined and set to `client` the generator does not create or modify the message documentation, but still included in the service (sends/receives)', async () => {
        const { getEvent } = utils(catalogDir);
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');
        const newEvent = await getEvent('usersubscribed', 'latest');

        // Event was not added to the EventCatalog
        expect(newEvent).toBeUndefined();

        expect(service.receives).toEqual([
          { id: 'signupuser', version: '2.0.0' },
          { id: 'getuserbyemail', version: '1.0.0' },
          { id: 'checkemailavailability', version: '1.0.0' },
          // The event we expect
          { id: 'usersubscribed', version: '1.0.0' },
        ]);
      });

      it('when the `x-eventcatalog-message-version` is defined on a message that version is used and not the the AsyncAPI version', async () => {
        const { getEvent } = utils(catalogDir);
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const service = await getService('account-service', '1.0.0');
        const event = await getEvent('signupuser', 'latest');

        // Event was not added to the EventCatalog
        expect(event).toBeDefined();
        expect(event.version).toEqual('2.0.0');
        expect(service.version).toEqual('1.0.0');
      });

      it('when the `x-eventcatalog-message-version` is defined on a message the schema is stored against that version', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const event = await getEvent('signupuser', 'latest');

        // custom version is used
        expect(event.version).toEqual('2.0.0');
        expect(event.schemaPath).toEqual('schema.json');
      });

      it('when the `x-eventcatalog-deprecated-date` is defined on a message, the message is deprecated in EventCatalog', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'simple.asyncapi.yml'), id: 'account-service' }] });

        const event = await getEvent('signupuser', 'latest');

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
        const event = await getEvent('usersignedup', '1.0.0');

        expect(event.owners).toEqual(['John Doe', 'Jane Doe']);
        expect(service.owners).toEqual(['John Doe', 'Jane Doe']);
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
          const event = await getEvent('usersignedup', '1.0.0');

          expect(event.schemaPath).toEqual('schema.json');
        });
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

        it('when a channel (root level) defines messages, these messages are linked to that channel', async () => {
          const { getEvent, getEvents } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(asyncAPIExamplesDir, 'streetlights-kafka-asyncapi.yml'), id: 'streetlights-service' }],
            parseChannels: true,
          });

          const event = await getEvent('lightmeasured', '1.0.0');

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
          const event = await getEvent('dimlight');

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
    });

    describe('$ref', () => {
      it('AsyncAPI files with $ref are resolved and added to the catalog', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(asyncAPIExamplesDir, 'ref-example.asyncapi.yml'), id: 'test-service' }] });

        const service = await getService('test-service', '1.1.0');
        const event = await getEvent('usersignup', '1.1.0');

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
        const event = await getEvent('lightmeasuredmessageavro', '1.0.0');

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

        // Normalize line endings
        const normalizeLineEndings = (str: string) => str.replace(/\r\n/g, '\n');

        expect(normalizeLineEndings(asyncAPIFile)).toEqual(normalizeLineEndings(expected));
      });
    });

    describe('asyncapi files with avro schemas', () => {
      it('parses the AsyncAPI file with avro schemas, and stores the avro schema against the event', async () => {
        const { getEvent, getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(asyncAPIExamplesDir, 'asyncapi-with-avro.asyncapi.yml'), id: 'user-signup-api' }],
        });

        const service = await getService('user-signup-api', '1.0.0');
        const event = await getEvent('usersignedup', '1.0.0');

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
        const event = await getEvent('userupdated', '1.0.0');

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

      const event = await getEvent('messageprojectdeleted', '1.0.0');
      expect(event).toEqual(
        expect.objectContaining({
          id: 'messageprojectdeleted',
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
    });
  });
});
