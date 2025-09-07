import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import { vi } from 'vitest';
import { existsSync } from 'node:fs';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Fake eventcatalog config
const config = {};

let catalogDir: string;
const openAPIExamples = join(__dirname, 'openapi-files');

describe('OpenAPI EventCatalog Plugin', () => {
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

  describe('service generation', () => {
    describe('domains', () => {
      it('if a domain is defined in the OpenAPI plugin configuration and that domain does not exist, it is created', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const domain = await getDomain('orders', '1.0.0');

        expect(domain).toEqual(
          expect.objectContaining({
            id: 'orders',
            name: 'Orders Domain',
            version: '1.0.0',
            services: [{ id: 'swagger-petstore', version: '1.0.0' }],
          })
        );
      });

      it('if a domain is not defined in the OpenAPI plugin configuration, the service is not added to any domains', async () => {
        const { getDomain } = utils(catalogDir);
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
        });
        expect(await getDomain('orders', '1.0.0')).toBeUndefined();
      });

      it('if a domain is defined in the OpenAPI file but the versions do not match, the existing domain is versioned and a new one is created', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders',
          name: 'Orders Domain',
          version: '0.0.1',
          markdown: '',
        });

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const versionedDomain = await getDomain('orders', '0.0.1');
        const newDomain = await getDomain('orders', '1.0.0');

        expect(versionedDomain.version).toEqual('0.0.1');
        expect(newDomain.version).toEqual('1.0.0');
        expect(newDomain.services).toEqual([{ id: 'swagger-petstore', version: '1.0.0' }]);
      });

      it('if a domain is defined in the OpenAPI plugin configuration and that domain exists the OpenAPI Service is added to that domain', async () => {
        const { writeDomain, getDomain } = utils(catalogDir);

        await writeDomain({
          id: 'orders',
          name: 'Orders Domain',
          version: '1.0.0',
          markdown: '',
        });

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0' },
        });

        const domain = await getDomain('orders', '1.0.0');
        expect(domain.services).toEqual([{ id: 'swagger-petstore', version: '1.0.0' }]);
      });

      it('if multiple OpenAPI files are processed, they are all added to the domain', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            { path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' },
            { path: join(openAPIExamples, 'simple.yml'), id: 'simple-api-overview' },
          ],
          domain: { id: 'orders', name: 'Orders', version: '1.0.0' },
        });

        const domain = await getDomain('orders', 'latest');

        expect(domain.services).toHaveLength(2);
        expect(domain.services).toEqual([
          { id: 'swagger-petstore', version: '1.0.0' },
          { id: 'simple-api-overview', version: '2.0.0' },
        ]);
      });

      it('if the domain has owners, they are added to the domain', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          domain: { id: 'orders', name: 'Orders', version: '1.0.0', owners: ['John Doe', 'Jane Doe'] },
        });

        const domain = await getDomain('orders', '1.0.0');

        expect(domain.owners).toEqual(['John Doe', 'Jane Doe']);
      });

      describe('domain options', () => {
        describe('config option: template', () => {
          it('if a `template` value is given in the domain config options, then the generator uses that template to generate the domain markdown', async () => {
            const { getDomain } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
              domain: {
                id: 'orders',
                name: 'Orders',
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

            expect(domain.owners).toEqual(['John Doe', 'Jane Doe']);

            expect(domain.markdown).toContain('# My custom template');
            expect(domain.markdown).toContain('The domain is Orders');

            // The default markdown should be included as we added it in our custom template
            expect(domain.markdown).toContain('## Architecture diagram');
          });
          it('it no template is given, the default markdown is used', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'my-custom-service-name' }],
            });

            const service = await getService('my-custom-service-name', '1.0.0');

            expect(service).toBeDefined();

            expect(service.markdown).toContain('## Architecture diagram');
            expect(service.markdown).toContain('<NodeGraph />');
          });
        });
        describe('config option: draft', () => {
          it('if a `draft` value is given in the domain config options, then the domain, services and all messages are added as `draft`', async () => {
            const { getDomain, getService, getEvent, getEvents } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
              domain: { id: 'orders', name: 'Orders Domain', version: '1.0.0', draft: true },
            });

            const domain = await getDomain('orders', '1.0.0');
            expect(domain.draft).toEqual(true);

            const service = await getService('swagger-petstore', '1.0.0');
            expect(service.draft).toEqual(true);

            const event = await getEvent('petAdopted');
            expect(event.draft).toEqual(true);
          });
        });
      });
    });

    describe('services', () => {
      it('OpenAPI spec is mapped into a service in EventCatalog when no service with this name is already defined', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore',
            name: 'Swagger Petstore',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
            badges: [
              {
                content: 'Pets',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
          })
        );
      });

      it('when the OpenaPI service is already defined in EventCatalog and the versions match, only metadata is updated', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore',
            version: '1.0.0',
            name: 'Random Name',
            markdown: '# Old markdown',
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore',
            name: 'Swagger Petstore',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
            markdown: '# Old markdown',
            badges: [
              {
                content: 'Pets',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
          })
        );
      });

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the markdown is persisted and not overwritten', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-2',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-2' }] });

        const service = await getService('swagger-petstore-2', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-2',
            name: 'Swagger Petstore',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [
              {
                content: 'Pets',
                textColor: 'blue',
                backgroundColor: 'blue',
              },
            ],
          })
        );
      });

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the `sends` list of messages is persisted, as the plugin does not create them', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            sends: [{ id: 'usersignedup', version: '1.0.0' }],
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            sends: [{ id: 'usersignedup', version: '1.0.0' }],
          })
        );
      });

      it('when the OpenAPI service is already defined in EventCatalog and the processed specification version is greater than the existing service version, a new service is created and the old one is versioned', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'swagger-petstore',
          version: '0.0.1',
          name: 'Swagger Petstore',
          markdown: '',
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const versionedService = await getService('swagger-petstore', '0.0.1');
        const newService = await getService('swagger-petstore', '1.0.0');
        expect(versionedService).toBeDefined();
        expect(newService).toBeDefined();
      });

      it('when the OpenAPI service is already defined in EventCatalog and the processed specification version is less than the existing service version, the existing service is not versioned, and the new one is written to the versioned folder', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'swagger-petstore',
          version: '2.0.0',
          name: 'Swagger Petstore',
          markdown: '',
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const versionedService = await getService('swagger-petstore', '1.0.0');
        const currentService = await getService('swagger-petstore', '2.0.0');

        expect(currentService).toBeDefined();
        expect(versionedService).toBeDefined();

        const versionedServicePath = join(catalogDir, 'services', 'swagger-petstore', 'versioned', '1.0.0');
        const commandsPath = join(versionedServicePath, 'commands');
        const eventsPath = join(versionedServicePath, 'events');
        const queriesPath = join(versionedServicePath, 'queries');
        expect(existsSync(versionedServicePath)).toBe(true);
        expect(existsSync(commandsPath)).toBe(true);

        // expect commands path to have 2 files
        const commands = await fs.readdir(commandsPath);
        expect(commands).toHaveLength(3);

        const events = await fs.readdir(eventsPath);
        expect(events).toHaveLength(1);

        const queries = await fs.readdir(queriesPath);
        expect(queries).toHaveLength(3);
      });

      it('the openapi file is added to the service which can be downloaded in eventcatalog', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.schemaPath).toEqual('petstore.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'));
        expect(schema).toBeDefined();
      });

      it('if the openapi file is a URL, the file is downloaded and added to the service', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: 'https://raw.githubusercontent.com/event-catalog/generator-openapi/refs/heads/main/examples/petstore/openapi.yml',
              id: 'cart-service',
            },
          ],
        });

        const service = await getService('cart-service', '3.0.0');

        expect(service.schemaPath).toEqual('openapi.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'cart-service', 'openapi.yml'));
        expect(schema).toBeDefined();
      });

      it('the original openapi file is added to the service by default instead of parsed version', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.schemaPath).toEqual('petstore.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'), 'utf8');
        expect(schema).toBeDefined();
      });

      it('the original openapi file is added to the service instead of parsed version', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          saveParsedSpecFile: false,
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.schemaPath).toEqual('petstore.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'), 'utf8');
        expect(schema).toBeDefined();
      });

      it('when saveParsedSpecFile is true, the openapi is parsed and refs are resolved', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          saveParsedSpecFile: true,
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.schemaPath).toEqual('petstore.yml');

        const schema = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'), 'utf8');
        expect(schema).toBeDefined();
      });

      it('the openapi file is added to the specifications list in eventcatalog', async () => {
        const { getService, writeService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.specifications?.openapiPath).toEqual('petstore.yml');
      });

      it('if the service already has specifications they are persisted and the openapi one is added on', async () => {
        const { getService, writeService, addFileToService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore',
            version: '0.0.1',
            name: 'Swagger Petstore',
            specifications: {
              asyncapiPath: 'asyncapi.yml',
            },
            markdown: '',
          },
          { path: 'Swagger Petstore' }
        );

        await addFileToService(
          'swagger-petstore',
          {
            fileName: 'asyncapi.yml',
            content: 'Some content',
          },
          '0.0.1'
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.specifications?.asyncapiPath).toEqual('asyncapi.yml');
        expect(service.specifications?.openapiPath).toEqual('petstore.yml');
      });

      it('if the service already has specifications attached to it, the openapi spec file is added to this list', async () => {
        const { writeService, getService, addFileToService, getSpecificationFilesForService } = utils(catalogDir);

        const existingVersion = '1.0.0';
        await writeService({
          id: 'swagger-petstore',
          version: existingVersion,
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          specifications: { asyncapiPath: 'simple.asyncapi.yml' },
        });

        await addFileToService(
          'swagger-petstore',
          {
            fileName: 'simple.asyncapi.yml',
            content: 'Some content',
          },
          existingVersion
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');
        const specs = await getSpecificationFilesForService('swagger-petstore', existingVersion);

        expect(specs).toHaveLength(2);
        expect(specs[0]).toEqual({
          key: 'openapiPath',
          content: expect.anything(),
          fileName: 'petstore.yml',
          path: expect.anything(),
        });
        expect(specs[1]).toEqual({
          key: 'asyncapiPath',
          content: 'Some content',
          fileName: 'simple.asyncapi.yml',
          path: expect.anything(),
        });

        expect(service.specifications).toEqual({
          openapiPath: 'petstore.yml',
          asyncapiPath: 'simple.asyncapi.yml',
        });
      });

      it('if the service already has specifications attached to it including an AsyncAPI spec file the asyncapi file is overridden', async () => {
        const { writeService, getService, addFileToService, getSpecificationFilesForService } = utils(catalogDir);

        const existingVersion = '1.0.0';
        await writeService({
          id: 'swagger-petstore',
          version: existingVersion,
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          specifications: { asyncapiPath: 'simple.asyncapi.yml', openapiPath: 'petstore.yml' },
        });

        await addFileToService(
          'swagger-petstore',
          {
            fileName: 'simple.asyncapi.yml',
            content: 'Some content',
          },
          existingVersion
        );
        await addFileToService(
          'swagger-petstore',
          {
            fileName: 'petstore.yml',
            content: 'old contents',
          },
          existingVersion
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');
        const specs = await getSpecificationFilesForService('swagger-petstore', existingVersion);

        expect(specs).toHaveLength(2);
        expect(specs[0]).toEqual({
          key: 'openapiPath',
          content: expect.anything(),
          fileName: 'petstore.yml',
          path: expect.anything(),
        });
        expect(specs[1]).toEqual({
          key: 'asyncapiPath',
          content: 'Some content',
          fileName: 'simple.asyncapi.yml',
          path: expect.anything(),
        });

        // Verify that the asyncapi file is overriden content
        expect(specs[0].content).not.toEqual('old contents');

        expect(service.specifications).toEqual({
          openapiPath: 'petstore.yml',
          asyncapiPath: 'simple.asyncapi.yml',
        });
      });

      it('all endpoints in the OpenAPI spec are messages the service receives', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.receives).toHaveLength(6);
        expect(service.receives).toEqual([
          { id: 'list-pets', version: '5.0.0' },
          { id: 'createPets', version: '1.0.0' },
          { id: 'showPetById', version: '1.0.0' },
          { id: 'updatePet', version: '1.0.0' },
          { id: 'deletePet', version: '1.0.0' },
          { id: 'petAdopted', version: '1.0.0' },
        ]);
      });

      it('all the endpoints in the OpenAPI spec are messages the service `receives`. If the version matches the latest the receives are persisted', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        //sleep
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-3',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            receives: [{ id: 'userloggedin', version: '1.0.0' }],
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-3' }] });

        const service = await getService('swagger-petstore-3', '1.0.0');
        expect(service.receives).toHaveLength(7);
        expect(service.receives).toEqual([
          { id: 'userloggedin', version: '1.0.0' },
          { id: 'list-pets', version: '5.0.0' },
          { id: 'createPets', version: '1.0.0' },
          { id: 'showPetById', version: '1.0.0' },
          { id: 'updatePet', version: '1.0.0' },
          { id: 'deletePet', version: '1.0.0' },
          { id: 'petAdopted', version: '1.0.0' },
        ]);
      });

      it('all the endpoints in the OpenAPI spec are messages the service `receives`. If the version matches the latest the receives are persisted, any duplicated are removed', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-5',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            receives: [
              { id: 'list-pets', version: '5.0.0' },
              { id: 'createPets', version: '1.0.0' },
            ],
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-5' }] });

        const service = await getService('swagger-petstore-5', '1.0.0');
        expect(service.receives).toHaveLength(6);

        expect(service.receives).toEqual([
          { id: 'list-pets', version: '5.0.0' },
          { id: 'createPets', version: '1.0.0' },
          { id: 'showPetById', version: '1.0.0' },
          { id: 'updatePet', version: '1.0.0' },
          { id: 'deletePet', version: '1.0.0' },
          { id: 'petAdopted', version: '1.0.0' },
        ]);
      });

      it('if the service has owners, they are added to the service', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore', owners: ['John Doe', 'Jane Doe'] }],
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.owners).toEqual(['John Doe', 'Jane Doe']);
      });

      it('if the service has `x-eventcatalog-draft` header set to true, the service is added as `draft` and all the messages are added as `draft`', async () => {
        const { getService, getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-draft.yml'), id: 'swagger-petstore' }],
        });

        const service = await getService('swagger-petstore', '1.0.0');
        expect(service.draft).toEqual(true);

        const event = await getEvent('petAdopted');
        expect(event.draft).toEqual(true);
      });

      it('the service has no draft settings, all resources do not have a draft value', async () => {
        const { getService, getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
        });

        const service = await getService('swagger-petstore', '1.0.0');
        expect(service.draft).toEqual(undefined);

        const event = await getEvent('petAdopted');
        expect(event.draft).toEqual(undefined);
      });

      describe('service options', () => {
        describe('config option: id', () => {
          it('if an `id` value is given in the service config options, then the generator uses that id and does not generate one from the title', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'my-custom-service-name' }],
            });

            const service = await getService('my-custom-service-name', '1.0.0');

            expect(service).toBeDefined();
          });
        });
        describe('config option: template', () => {
          it('if a `template` value is given in the service config options, then the generator uses that template to generate the service markdown', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [
                {
                  path: join(openAPIExamples, 'petstore.yml'),
                  id: 'my-custom-service-name',
                  generateMarkdown: ({ document, markdown }) => {
                    return `
                # My custom template

                ${markdown}
                  ${document.info.description}
                `;
                  },
                },
              ],
            });

            const service = await getService('my-custom-service-name', '1.0.0');

            expect(service).toBeDefined();

            expect(service.markdown).toContain('# My custom template');
            expect(service.markdown).toContain('This is a sample server Petstore server');

            // The default markdown should be included as we added it in our custom template
            expect(service.markdown).toContain('## Architecture diagram');
          });
          it('it no template is given, the default markdown is used', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'my-custom-service-name' }],
            });

            const service = await getService('my-custom-service-name', '1.0.0');

            expect(service).toBeDefined();

            expect(service.markdown).toContain('## Architecture diagram');
            expect(service.markdown).toContain('<NodeGraph />');
          });
        });
        describe('config option: draft', () => {
          it('if a `draft` value is given in the service config options, then the service and all messages are added as `draft`', async () => {
            const { getService, getEvent } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore', draft: true }],
            });

            const service = await getService('swagger-petstore', '1.0.0');
            expect(service.draft).toEqual(true);

            const event = await getEvent('petAdopted');
            expect(event.draft).toEqual(true);
          });
        });
      });
    });

    describe('messages', () => {
      it('messages that do not have an `x-eventcatalog-message-type` header defined are documented as queries by default in EventCatalog', async () => {
        const { getQuery } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getQuery('list-pets');

        const file = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'queries', 'list-pets', 'index.mdx'));
        expect(file).toBeDefined();

        expect(command).toEqual(
          expect.objectContaining({
            id: 'list-pets',
            version: '5.0.0',
            name: 'List Pets',
            summary: 'List all pets',
            badges: [
              { content: 'GET', textColor: 'blue', backgroundColor: 'blue' },
              { content: 'tag:pets', textColor: 'blue', backgroundColor: 'blue' },
            ],
          })
        );
      });

      it('if the message description has curly braces, they are escaped in the markdown', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-special-characters.yml'), id: 'swagger-petstore' }],
        });

        const event = await getEvent('list-pets');
        expect(event.markdown).toContain('example: \\{ true: false \\}');
      });

      it('if the message description has code blocks, the curly braces are not escaped', async () => {
        const { getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-special-characters.yml'), id: 'swagger-petstore' }],
        });

        const event = await getEvent('list-pets');
        // Get the code block from the markdown
        const codeBlock = event.markdown.match(/```json\n([\s\S]*?)\n```/);
        expect(codeBlock).toBeDefined();
        expect(codeBlock?.[1]).toContain('"this should not be escaped"');

        // Verify that curly braces in the code block are NOT escaped
        expect(codeBlock?.[1]).toContain('{');
        expect(codeBlock?.[1]).toContain('}');
        expect(codeBlock?.[1]).not.toContain('\\{');
        expect(codeBlock?.[1]).not.toContain('\\}');
      });

      describe('OpenAPI eventcatalog extensions', () => {
        it('messages marked as "events" using the custom `x-eventcatalog-message-type` header in an OpenAPI are documented in EventCatalog as events ', async () => {
          const { getEvent } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getEvent('petAdopted');

          expect(event).toEqual(
            expect.objectContaining({
              id: 'petAdopted',
              name: 'petAdopted',
              version: '1.0.0',
              summary: 'Notify that a pet has been adopted',
            })
          );
        });

        it('messages marked as "commands" using the custom `x-eventcatalog-message-type` header in an OpenAPI are documented in EventCatalog as commands ', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getCommand('createPets');

          expect(event).toEqual(
            expect.objectContaining({
              id: 'createPets',
              name: 'createPets',
              version: '1.0.0',
              summary: 'Create a pet',
            })
          );
        });

        it('messages marked as "query" using the custom `x-eventcatalog-message-type` header in an OpenAPI are documented in EventCatalog as commands ', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getCommand('showPetById');

          expect(event).toEqual(
            expect.objectContaining({
              id: 'showPetById',
              name: 'showPetById',
              version: '1.0.0',
              summary: 'Info for a specific pet',
            })
          );
        });

        it('messages marked as "draft" using the custom `x-eventcatalog-draft` header in an OpenAPI are documented in EventCatalog as draft', async () => {
          const { getEvent } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(openAPIExamples, 'petstore-draft-messages.yml'), id: 'swagger-petstore' }],
          });

          const event = await getEvent('petAdopted');
          expect(event.draft).toEqual(true);
        });

        it('messages marked as "sends" using the custom `x-eventcatalog-message-action` header in an OpenAPI are mapped against the service as messages the service sends ', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const service = await getService('swagger-petstore');

          expect(service.sends).toHaveLength(1);
          expect(service.sends).toEqual([{ id: 'petVaccinated', version: '1.0.0' }]);
        });

        it('when messages have the `x-eventcatalog-message-name` extension defined, this value is used for the message name', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getQuery('list-pets');

          expect(event).toEqual(
            expect.objectContaining({
              id: 'list-pets',
              name: 'List Pets',
              version: '5.0.0',
              summary: 'List all pets',
            })
          );
        });
        it('when messages have the `x-eventcatalog-message-id` extension defined, this value is used for the message id', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getQuery('list-pets');
          expect(event.id).toEqual('list-pets');
        });

        it('when messages have the `x-eventcatalog-message-version` extension defined, this value is used for the message version', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getQuery('list-pets');
          expect(event.version).toEqual('5.0.0');
        });
      });

      it('when the message already exists in EventCatalog but the versions do not match, the existing message is versioned', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'createPets',
          name: 'createPets',
          version: '0.0.1',
          summary: 'Create a pet',
          markdown: '',
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const versionedEvent = await getCommand('createPets', '0.0.1');
        const newEvent = await getCommand('createPets', '1.0.0');

        expect(versionedEvent).toBeDefined();
        expect(newEvent).toBeDefined();
      });

      it('when a the message already exists in EventCatalog the markdown is persisted and not overwritten by default', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'createPets',
          name: 'createPets',
          version: '0.0.1',
          summary: 'Create a pet',
          markdown: 'please dont override me!',
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getCommand('createPets', '1.0.0');
        expect(command.markdown).toEqual('please dont override me!');
      });

      it('when preserveExistingMessages is set to false, the markdown is not persisted and overwritten  ', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'createPets',
          name: 'createPets',
          version: '1.0.0',
          summary: 'Create a pet',
          markdown: 'This markdown is already in the catalog',
        });

        await plugin(config, {
          preserveExistingMessages: false,
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
        });

        const command = await getCommand('createPets', '1.0.0');
        expect(command.markdown).not.toContain('This markdown is already in the catalog');
        expect(command.markdown).toContain('<SchemaViewer file="response-default.json" maxHeight="500" id="response-default" />');
      });

      it('when a message already exists in EventCatalog with the same version the metadata is updated', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'createPets',
          name: 'Random Name value',
          version: '1.0.0',
          summary: 'Create a pet',
          markdown: '',
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getCommand('createPets', '1.0.0');
        expect(command.name).toEqual('createPets');
      });

      it('when the message (operation) does not have a operationId, the path and status code is used to uniquely identify the message', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'without-operationIds.yml'), id: 'product-api' }] });

        const getCommandByProductId = await getCommand('product-api_GET_{productId}');
        const getCommandMessage = await getCommand('product-api_GET');

        expect(getCommandByProductId).toBeDefined();
        expect(getCommandMessage).toBeDefined();
      });

      it('when the service has owners, the messages are given the same owners', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [
            { path: join(openAPIExamples, 'without-operationIds.yml'), id: 'product-api', owners: ['John Doe', 'Jane Doe'] },
          ],
        });

        const getCommandByProductId = await getCommand('product-api_GET_{productId}');
        const getCommandMessage = await getCommand('product-api_GET');

        expect(getCommandByProductId).toBeDefined();
        expect(getCommandMessage).toBeDefined();
        expect(getCommandByProductId.owners).toEqual(['John Doe', 'Jane Doe']);
        expect(getCommandMessage.owners).toEqual(['John Doe', 'Jane Doe']);
      });

      it('when the message has been marked as deprecated (with x-eventcatalog-deprecated-date and x-eventcatalog-deprecated-message), the message is marked as deprecated in EventCatalog', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getCommand('list-pets');
        expect(command.deprecated).toEqual({
          date: '2025-04-09',
          message: 'This operation is deprecated because it is not used in the codebase',
        });
      });

      it('when the message has been marked as deprecated (native support as boolean), the message is marked as deprecated in EventCatalog', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getCommand('createPets');

        expect(command.deprecated).toEqual(true);
      });

      describe('schemas', () => {
        it('when a message has a request body, the request body is the schema of the message', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets');

          // Can the schema be something else than JSON schema?
          expect(command.schemaPath).toEqual('request-body.json');

          const schema = await fs.readFile(
            join(catalogDir, 'services', 'swagger-petstore', 'commands', 'createPets', 'request-body.json')
          );
          expect(schema).toBeDefined();
        });

        it('when a message has a request body, the markdown contains the request body', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets');

          expect(command.markdown).toContain(`## Request Body
<SchemaViewer file="request-body.json" maxHeight="500" id="request-body" />`);
        });

        it('when a message has a response, the response is stored as a schema against the message', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const schema = await fs.readFile(
            join(catalogDir, 'services', 'swagger-petstore', 'commands', 'createPets', 'response-default.json')
          );
          expect(schema).toBeDefined();
        });

        it('when a message has a response, the response is shown in the markdown file', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets');

          expect(command.markdown).toContain(`### Responses

#### <span className="text-gray-500">default</span>
<SchemaViewer file="response-default.json" maxHeight="500" id="response-default" />`);
        });

        it('when a message has parameters they are added to the markdown file when the message is new in the catalog', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('list-pets');

          expect(command.markdown).toContain(`### Parameters
- **limit** (query): How many items to return at one time (max 100)`);
        });
      });

      describe('config option: generateMarkdown', () => {
        it('if a `generateMarkdown` value is given in the message config options, then the generator uses that function to generate the message markdown', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, {
            messages: {
              generateMarkdown: ({ operation, markdown }) => {
                return `
              ## My custom template
              ${markdown}
            `;
              },
            },
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          });

          const command = await getCommand('createPets');

          expect(command.markdown).toContain('## My custom template');

          // The default markdown should be included as we added it in our custom template
          expect(command.markdown).toContain('### Request Body');
        });

        it('if no `generateMarkdown` value is given in the message config options, then the default markdown is used', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets');

          expect(command.markdown).toContain('### Request Body');
        });
      });
    });

    describe('$ref', () => {
      it('when saveParsedSpecFile is set, the OpenAPI files with $ref are resolved and added to the catalog', async () => {
        const { getService, getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'ref-example.yml'), id: 'test-service' }],
          saveParsedSpecFile: true,
        });

        const service = await getService('test-service', '1.1.0');
        const event = await getCommand('usersignup', '1.1.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();
        expect(event.schemaPath).toEqual('request-body.json');
      });

      it('when saveParsedSpecFile is set, the OpenApi saved to the service $ref values are resolved', async () => {
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'ref-example.yml'), id: 'Test Service' }],
          saveParsedSpecFile: true,
        });

        const asyncAPIFile = (await fs.readFile(join(catalogDir, 'services', 'Test Service', 'ref-example.yml'))).toString();
        const expected = (await fs.readFile(join(openAPIExamples, 'ref-example-with-resolved-refs.yml'))).toString();

        // Normalize line endings
        const normalizeLineEndings = (str: string) => str.replace(/\r\n/g, '\n');

        expect(normalizeLineEndings(asyncAPIFile).trim()).toEqual(normalizeLineEndings(expected).trim());
      });

      it('when saveParsedSpecFile is set, the OpenAPI files with $ref are resolved and added to the catalog', async () => {
        const { getService, getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'ref-example.json'), id: 'test-service' }],
          saveParsedSpecFile: true,
        });

        const service = await getService('test-service', '1.1.0');
        const event = await getCommand('usersignup', '1.1.0');

        expect(service).toBeDefined();
        expect(event).toBeDefined();
        expect(event.schemaPath).toEqual('request-body.json');
      });

      it('when saveParsedSpecFile is set, the OpenApi has any $ref these are not saved to the service. The servive AsyncAPI is has no $ref', async () => {
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'ref-example.json'), id: 'Test Service' }],
          saveParsedSpecFile: true,
        });

        const asyncAPIFile = (await fs.readFile(join(catalogDir, 'services', 'Test Service', 'ref-example.json'))).toString();
        const expected = (await fs.readFile(join(openAPIExamples, 'ref-example-with-resolved-refs.json'))).toString();

        // Normalize line endings
        const normalizeLineEndings = (str: string) => str.replace(' ', '').replace(/\r\n/g, '\n').replace(/\s+/g, '');

        expect(normalizeLineEndings(asyncAPIFile)).toEqual(normalizeLineEndings(expected));
      });
    });

    describe('writeFilesToRoot', () => {
      it('when writeFilesToRoot is set to true, the files are written to the root of the catalog and not inside the service folder', async () => {
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          writeFilesToRoot: true,
        });

        //  Read events directory
        const eventsDir = await fs.readdir(join(catalogDir, 'events'));
        expect(eventsDir).toEqual(['petAdopted']);

        const eventFiles = await fs.readdir(join(catalogDir, 'events', 'petAdopted'));
        expect(eventFiles).toEqual(['index.mdx', 'request-body.json', 'response-default.json']);

        const commandsDir = await fs.readdir(join(catalogDir, 'commands'));
        expect(commandsDir).toEqual(['createPets', 'deletePet', 'updatePet']);

        const commandFiles = await fs.readdir(join(catalogDir, 'commands', 'createPets'));
        expect(commandFiles).toEqual(['index.mdx', 'request-body.json', 'response-default.json']);

        const queriesDir = await fs.readdir(join(catalogDir, 'queries'));
        expect(queriesDir).toEqual(['list-pets', 'petVaccinated', 'showPetById']);

        const queryFiles = await fs.readdir(join(catalogDir, 'queries', 'list-pets'));
        expect(queryFiles).toEqual(['index.mdx', 'response-200.json', 'response-default.json']);

        const serviceFiles = await fs.readdir(join(catalogDir, 'services', 'swagger-petstore'));
        expect(serviceFiles).toEqual(['index.mdx', 'petstore.yml']);
      });
    });

    describe('sidebarBadgeType', () => {
      it('if no sidebarBadgeType is set, the default is `HTTP_METHOD`', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
        });

        const createPets = await getCommand('createPets');
        expect(createPets.sidebar?.badge).toEqual('POST');
      });

      it('when sidebarBadgeType is set to `HTTP_METHOD`, the http methods are added to the messages as sidebar badges', async () => {
        const { getCommand, getQuery } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          sidebarBadgeType: 'HTTP_METHOD',
        });

        const createPets = await getCommand('createPets');
        const deletePet = await getCommand('deletePet');
        const putPet = await getCommand('updatePet');
        const listPets = await getQuery('list-pets');

        expect(createPets.sidebar?.badge).toEqual('POST');
        expect(deletePet.sidebar?.badge).toEqual('DELETE');
        expect(putPet.sidebar?.badge).toEqual('PUT');
        expect(listPets.sidebar?.badge).toEqual('GET');
      });

      it('when sidebarBadgeType is set to `MESSAGE_TYPE`, no sidebar badge is added (EventCatalog handles messages by default)', async () => {
        const { getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          sidebarBadgeType: 'MESSAGE_TYPE',
        });

        const createPets = await getCommand('createPets');
        expect(createPets.sidebar?.badge).toBeUndefined();
      });
    });

    describe('httpMethodsToMessages', () => {
      it('when httpMethodsToMessages is set, the HTTP methods are mapped to the given message type', async () => {
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-without-extensions.yml'), id: 'swagger-petstore' }],
          httpMethodsToMessages: {
            GET: 'query',
            POST: 'command',
            PUT: 'command',
            DELETE: 'command',
            PATCH: 'command',
            HEAD: 'command',
          },
        });

        //createPets (POST)
        const createPetsFile = await fs.readFile(
          join(catalogDir, 'services', 'swagger-petstore', 'commands', 'createPets', 'index.mdx')
        );
        expect(createPetsFile).toBeDefined();

        //listPets (GET)
        const listPetsFile = await fs.readFile(
          join(catalogDir, 'services', 'swagger-petstore', 'queries', 'listPets', 'index.mdx')
        );
        expect(listPetsFile).toBeDefined();

        //petAdopted (PUT)
        const updatePetFile = await fs.readFile(
          join(catalogDir, 'services', 'swagger-petstore', 'commands', 'updatePet', 'index.mdx')
        );
        expect(updatePetFile).toBeDefined();

        // deletePet (DELETE)
        const deletePetFile = await fs.readFile(
          join(catalogDir, 'services', 'swagger-petstore', 'commands', 'deletePet', 'index.mdx')
        );
        expect(deletePetFile).toBeDefined();

        //patchPet (PATCH)
        const patchPetFile = await fs.readFile(
          join(catalogDir, 'services', 'swagger-petstore', 'commands', 'patchPet', 'index.mdx')
        );
        expect(patchPetFile).toBeDefined();
      });
    });

    it('when the OpenAPI service is already defined in the EventCatalog and the versions match, the owners and repository are persisted', async () => {
      // Create a service with the same name and version as the OpenAPI file for testing
      const { writeService, getService } = utils(catalogDir);

      await writeService(
        {
          id: 'swagger-petstore',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          owners: ['dboyne'],
          repository: { language: 'typescript', url: 'https://github.com/dboyne/eventcatalog-plugin-openapi' },
        },
        { path: 'Swagger Petstore' }
      );

      await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

      const service = await getService('swagger-petstore', '1.0.0');
      expect(service).toEqual(
        expect.objectContaining({
          id: 'swagger-petstore',
          name: 'Swagger Petstore',
          version: '1.0.0',
          summary: 'This is a sample server Petstore server.',
          markdown: 'Here is my original markdown, please do not override this!',
          owners: ['dboyne'],
          repository: { language: 'typescript', url: 'https://github.com/dboyne/eventcatalog-plugin-openapi' },
          badges: [
            {
              content: 'Pets',
              textColor: 'blue',
              backgroundColor: 'blue',
            },
          ],
        })
      );
    });

    it('when a spec file contains circular references, the plugin adds [Circular] to the schema', async () => {
      await plugin(config, {
        services: [{ path: join(openAPIExamples, 'circlular-ref.yml'), id: 'circular-ref-service' }],
      });

      const schema = await fs.readFile(
        join(catalogDir, 'services', 'circular-ref-service', 'queries', 'employees-api_GET_employees', 'response-200.json'),
        'utf8'
      );
      expect(schema).toEqual(`{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "manager": "[Circular]"
    }
  },
  "isSchema": true
}`);
    });

    describe('persisted data', () => {
      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the styles are persisted and not overwritten', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-2',
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
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-2' }] });

        const service = await getService('swagger-petstore-2', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-2',
            name: 'Swagger Petstore',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [
              {
                content: 'Pets',
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

    describe('path-level parameters handling', () => {
      it('should not create redundant PARAMETERS folders when OpenAPI spec has path-level parameters', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'path-parameters-example.yml'), id: 'generic-api' }],
        });

        const service = await getService('generic-api', '1.0.0');
        expect(service).toBeDefined();

        // Check that only legitimate query folders are created
        const queriesDir = join(catalogDir, 'services', 'generic-api', 'queries');
        const queriesFolders = await fs.readdir(queriesDir);
        
        // Should only have the actual operations, not PARAMETERS folders
        expect(queriesFolders).toEqual(['getItem', 'updateItem']);
        
        // Verify no PARAMETERS folders exist
        const parametersFolder = queriesFolders.filter(folder => folder.includes('PARAMETERS'));
        expect(parametersFolder).toHaveLength(0);

        // Verify the actual operations are properly created
        expect(queriesFolders).not.toContain('generic-api_PARAMETERS_v0_items_{itemId}');
        expect(queriesFolders).toContain('getItem');
        expect(queriesFolders).toContain('updateItem');
      });
    });

    describe('parsing multiple OpenAPI files to the same service', () => {
      it('when multiple OpenAPI files are parsed to the same service, the services and messages are written to the correct locations', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: [
                join(openAPIExamples, 'petstore-v2-no-extensions.yml'),
                join(openAPIExamples, 'petstore-v1-no-extensions.yml'),
              ],
              id: 'swagger-petstore-2',
            },
          ],
        });

        const previousService = await getService('swagger-petstore-2', '1.0.0');
        const service = await getService('swagger-petstore-2', '2.0.0');

        expect(service).toBeDefined();
        expect(previousService).toBeDefined();

        // Expect versioned folder for 1.0.0 and all files are present
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0'))).toBe(true);
        expect(
          existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'petstore-v1-no-extensions.yml'))
        ).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'queries'))).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'index.mdx'))).toBe(true);

        // Expect 2.0.0 to be the latest version with expected files
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'petstore-v2-no-extensions.yml'))).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'petstore-v1-no-extensions.yml'))).toBe(false);

        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-2',
            version: '2.0.0',
            specifications: {
              openapiPath: 'petstore-v2-no-extensions.yml',
            },
            sends: [],
            receives: [
              { id: 'listPets', version: '2.0.0' },
              { id: 'createPets', version: '2.0.0' },
              { id: 'updatePet', version: '2.0.0' },
              { id: 'deletePet', version: '2.0.0' },
              { id: 'petAdopted', version: '2.0.0' },
              { id: 'petVaccinated', version: '2.0.0' },
            ],
          })
        );

        expect(previousService).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-2',
            version: '1.0.0',
            specifications: {
              openapiPath: 'petstore-v1-no-extensions.yml',
            },
            sends: [],
            receives: [
              { id: 'listPets', version: '1.0.0' },
              { id: 'createPets', version: '1.0.0' },
              { id: 'showPetById', version: '1.0.0' },
              { id: 'updatePet', version: '1.0.0' },
              { id: 'deletePet', version: '1.0.0' },
              { id: 'petAdopted', version: '1.0.0' },
              { id: 'petVaccinated', version: '1.0.0' },
            ],
          })
        );
      });

      it('when multiple OpenAPI files are processed, the messages for each spec file are written to the correct locations', async () => {
        await plugin(config, {
          services: [
            {
              path: [
                join(openAPIExamples, 'petstore-v2-no-extensions.yml'),
                join(openAPIExamples, 'petstore-v1-no-extensions.yml'),
              ],
              id: 'swagger-petstore-2',
            },
          ],
        });

        expect(
          existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'queries', 'showPetById'))
        ).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'queries', 'showPetById'))).toBe(false);

        // Get all the folder names in the queries folder for v2
        const queries = await fs.readdir(join(catalogDir, 'services', 'swagger-petstore-2', 'queries'));
        expect(queries).toEqual(['createPets', 'deletePet', 'listPets', 'petAdopted', 'petVaccinated', 'updatePet']);

        const versionedQueries = await fs.readdir(
          join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'queries')
        );
        expect(versionedQueries).toEqual([
          'createPets',
          'deletePet',
          'listPets',
          'petAdopted',
          'petVaccinated',
          'showPetById',
          'updatePet',
        ]);
      });
    });
  });
});
