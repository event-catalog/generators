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

      describe('subdomains', () => {
        it('services can be generated into a subdomain folder structure (e.g. domains/Buyer/subdomains/Agency/services/AgencyLeadsService)', async () => {
          const { writeDomain, getDomain, getService, addSubDomainToDomain } = utils(catalogDir);

          // Create the subdomain directory structure on disk to simulate
          // an existing catalog with subdomains (e.g. created via EventCatalog UI)
          const subdomainDir = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency');
          await fs.mkdir(subdomainDir, { recursive: true });
          await fs.writeFile(join(subdomainDir, 'index.mdx'), '---\nid: Agency\nname: Agency Domain\nversion: 1.0.0\n---\n');

          // Create the parent domain "Buyer"
          await writeDomain({
            id: 'Buyer',
            name: 'Buyer Domain',
            version: '1.0.0',
            markdown: '',
          });

          await addSubDomainToDomain('Buyer', { id: 'Agency', version: '1.0.0' });

          // Generate service into the "Agency" subdomain under "Buyer"
          // The generator should resolve that Agency lives at domains/Buyer/subdomains/Agency
          await plugin(config, {
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
            domain: { id: 'Agency', name: 'Agency Domain', version: '1.0.0' },
          });

          // Verify the service was created
          const service = await getService('swagger-petstore', '1.0.0');
          expect(service).toBeDefined();

          // Verify the parent domain still exists
          const parentDomain = await getDomain('Buyer', '1.0.0');
          expect(parentDomain).toBeDefined();

          // The service files should be under the subdomain path:
          // domains/Buyer/subdomains/Agency/services/swagger-petstore
          const subdomainServicePath = join(
            catalogDir,
            'domains',
            'Buyer',
            'subdomains',
            'Agency',
            'services',
            'swagger-petstore'
          );
          expect(existsSync(subdomainServicePath)).toBe(true);
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

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the markdown, writesTo, readsFrom, badges and attachments are persisted and not overwritten', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-2',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
            attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
            writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
            readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
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
            badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
            attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
            writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
            readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
          })
        );
      });

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, pre-existing `sends` pointers are preserved alongside any `sends` generated from the spec', async () => {
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
        // petVaccinated is generated from the spec (x-eventcatalog-message-action: sends);
        // usersignedup was added by hand and should be preserved.
        expect(service.sends).toEqual(
          expect.arrayContaining([
            { id: 'petVaccinated', version: '1.0.0' },
            { id: 'usersignedup', version: '1.0.0' },
          ])
        );
        expect(service.sends).toHaveLength(2);
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

      describe('headers option', () => {
        it('passes headers to fetch when fetching authenticated URLs', async () => {
          const yamlContent = await fs.readFile(join(openAPIExamples, 'petstore.yml'), 'utf8');
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(yamlContent),
            headers: new Headers({ 'content-type': 'application/yaml' }),
          });
          const originalFetch = global.fetch;
          global.fetch = mockFetch;

          try {
            const { getService } = utils(catalogDir);
            await plugin(config, {
              services: [
                {
                  path: 'https://api.example.com/specs/openapi',
                  id: 'authenticated-service',
                  headers: {
                    Authorization: 'Bearer test-token',
                    'X-Custom-Header': 'custom-value',
                  },
                },
              ],
            });

            const service = await getService('authenticated-service', '1.0.0');
            expect(service).toBeDefined();

            // Verify fetch was called with headers
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

        it('parses JSON content when Content-Type is application/json', async () => {
          const jsonContent = JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'JSON API', version: '2.0.0' },
            paths: {},
          });
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(jsonContent),
            headers: new Headers({ 'content-type': 'application/json' }),
          });
          const originalFetch = global.fetch;
          global.fetch = mockFetch;

          try {
            const { getService } = utils(catalogDir);
            await plugin(config, {
              services: [
                {
                  path: 'https://api.example.com/specs/openapi.json',
                  id: 'json-service',
                  headers: { Authorization: 'Bearer token' },
                },
              ],
            });

            const service = await getService('json-service', '2.0.0');
            expect(service).toBeDefined();
            expect(service.name).toEqual('JSON API');
          } finally {
            global.fetch = originalFetch;
          }
        });

        it('parses YAML content when Content-Type includes yaml', async () => {
          const yamlContent = await fs.readFile(join(openAPIExamples, 'petstore.yml'), 'utf8');
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(yamlContent),
            headers: new Headers({ 'content-type': 'text/yaml' }),
          });
          const originalFetch = global.fetch;
          global.fetch = mockFetch;

          try {
            const { getService } = utils(catalogDir);
            await plugin(config, {
              services: [
                {
                  path: 'https://api.example.com/specs/openapi',
                  id: 'yaml-service',
                  headers: { Authorization: 'Bearer token' },
                },
              ],
            });

            const service = await getService('yaml-service', '1.0.0');
            expect(service).toBeDefined();
          } finally {
            global.fetch = originalFetch;
          }
        });

        it('falls back to trying JSON then YAML when Content-Type is not set', async () => {
          const yamlContent = await fs.readFile(join(openAPIExamples, 'petstore.yml'), 'utf8');
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(yamlContent),
            headers: new Headers({}), // No content-type
          });
          const originalFetch = global.fetch;
          global.fetch = mockFetch;

          try {
            const { getService } = utils(catalogDir);
            await plugin(config, {
              services: [
                {
                  path: 'https://api.example.com/specs/openapi',
                  id: 'fallback-service',
                  headers: { Authorization: 'Bearer token' },
                },
              ],
            });

            const service = await getService('fallback-service', '1.0.0');
            expect(service).toBeDefined();
          } finally {
            global.fetch = originalFetch;
          }
        });
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
        const { getService } = utils(catalogDir);

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.specifications).toEqual([{ type: 'openapi', path: 'petstore.yml' }]);
      });

      it('when processing multiple OpenAPI contracts for the same service, all OpenAPI specifications are preserved', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            { path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' },
            { path: join(openAPIExamples, 'without-operationIds.yml'), id: 'swagger-petstore' },
          ],
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.specifications).toEqual([
          { type: 'openapi', path: 'petstore.yml' },
          { type: 'openapi', path: 'without-operationIds.yml' },
        ]);
      });

      it('when a service already has one or many AsyncAPI specs, they are preserved while adding OpenAPI specs', async () => {
        const { getService, writeService, addFileToService } = utils(catalogDir);

        await writeService({
          id: 'swagger-petstore',
          version: '1.0.0',
          name: 'Swagger Petstore',
          specifications: [
            { type: 'asyncapi', path: 'asyncapi-1.yml' },
            { type: 'asyncapi', path: 'asyncapi-2.yml' },
          ],
          markdown: '',
        });

        await addFileToService('swagger-petstore', { fileName: 'asyncapi-1.yml', content: 'Async API 1' }, '1.0.0');
        await addFileToService('swagger-petstore', { fileName: 'asyncapi-2.yml', content: 'Async API 2' }, '1.0.0');

        await plugin(config, {
          services: [
            { path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' },
            { path: join(openAPIExamples, 'without-operationIds.yml'), id: 'swagger-petstore' },
          ],
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.specifications).toEqual([
          { type: 'asyncapi', path: 'asyncapi-1.yml' },
          { type: 'asyncapi', path: 'asyncapi-2.yml' },
          { type: 'openapi', path: 'petstore.yml' },
          { type: 'openapi', path: 'without-operationIds.yml' },
        ]);
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

        expect(service.specifications).toEqual([
          { type: 'asyncapi', path: 'asyncapi.yml' },
          { type: 'openapi', path: 'petstore.yml' },
        ]);
      });

      it('if the service already has specifications attached to it, the openapi spec file is added to this list', async () => {
        const { writeService, getService, addFileToService } = utils(catalogDir);

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
        const [openapiContent, asyncapiContent] = await Promise.all([
          fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'), 'utf8'),
          fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'simple.asyncapi.yml'), 'utf8'),
        ]);

        expect(openapiContent).toBeTruthy();
        expect(asyncapiContent).toEqual('Some content');

        expect(service.specifications).toEqual(
          expect.arrayContaining([
            { type: 'asyncapi', path: 'simple.asyncapi.yml' },
            { type: 'openapi', path: 'petstore.yml' },
          ])
        );
      });

      it('if the service already has specifications attached to it including an AsyncAPI spec file the asyncapi file is overridden', async () => {
        const { writeService, getService, addFileToService } = utils(catalogDir);

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
        const [openapiContent, asyncapiContent] = await Promise.all([
          fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.yml'), 'utf8'),
          fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'simple.asyncapi.yml'), 'utf8'),
        ]);

        expect(asyncapiContent).toEqual('Some content');

        // Verify that the openapi file content is overridden
        expect(openapiContent).not.toEqual('old contents');

        expect(service.specifications).toEqual(
          expect.arrayContaining([
            { type: 'asyncapi', path: 'simple.asyncapi.yml' },
            { type: 'openapi', path: 'petstore.yml' },
          ])
        );
      });

      it('if the service already has specifications in array format, the array format is preserved and openapi file is updated', async () => {
        const { writeService, getService, addFileToService, getSpecificationFilesForService } = utils(catalogDir);

        const existingVersion = '1.0.0';
        await writeService({
          id: 'swagger-petstore',
          version: existingVersion,
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          // Test with array format for specifications (new format)
          specifications: [
            { type: 'asyncapi', path: 'simple.asyncapi.yml' },
            { type: 'openapi', path: 'old.openapi.yml' },
          ],
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
            fileName: 'old.openapi.yml',
            content: 'old contents',
          },
          existingVersion
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const service = await getService('swagger-petstore', '1.0.0');
        const specs = await getSpecificationFilesForService('swagger-petstore', existingVersion);

        expect(specs).toHaveLength(3);
        expect(specs).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'asyncapi',
              content: 'Some content',
              fileName: 'simple.asyncapi.yml',
            }),
            expect.objectContaining({
              key: 'openapi',
              content: 'old contents',
              fileName: 'old.openapi.yml',
            }),
            expect.objectContaining({
              key: 'openapi',
              content: expect.anything(),
              fileName: 'petstore.yml',
            }),
          ])
        );

        // Array format is preserved
        expect(service.specifications).toEqual(
          expect.arrayContaining([
            { type: 'asyncapi', path: 'simple.asyncapi.yml' },
            { type: 'openapi', path: 'petstore.yml' },
          ])
        );
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
        expect(service.receives).toEqual(
          expect.arrayContaining([
            { id: 'userloggedin', version: '1.0.0' },
            { id: 'list-pets', version: '5.0.0' },
            { id: 'createPets', version: '1.0.0' },
            { id: 'showPetById', version: '1.0.0' },
            { id: 'updatePet', version: '1.0.0' },
            { id: 'deletePet', version: '1.0.0' },
            { id: 'petAdopted', version: '1.0.0' },
          ])
        );
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

        describe('config option: version', () => {
          it('when the version is given to the service through the configuration, the service version is used over the OpenAPI version', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore', version: '5.0.0' }],
            });

            const service = await getService('swagger-petstore', '5.0.0');
            expect(service.version).toEqual('5.0.0');
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
        describe('config option: name', () => {
          it('if a `name` value is given in the service config options, then the generator uses that name as the service name', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore', name: 'My Custom Name' }],
            });

            const service = await getService('swagger-petstore', '1.0.0');
            expect(service.name).toEqual('My Custom Name');
          });
        });
        describe('config option: summary', () => {
          it('if a `summary` value is given in the service config options, then the generator uses that summary as the service summary', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore', summary: 'My Custom Summary' }],
            });

            const service = await getService('swagger-petstore', '1.0.0');
            expect(service.summary).toEqual('My Custom Summary');
          });
        });
        describe('config option: writesTo', () => {
          it('if a `writesTo` or `readsFrom` value is given in the service config options, then the service is created with that writesTo or readsFrom value', async () => {
            const { getService } = utils(catalogDir);

            await plugin(config, {
              services: [
                {
                  path: join(openAPIExamples, 'petstore.yml'),
                  id: 'swagger-petstore',
                  writesTo: [{ id: 'orders-db', version: '1.0.0' }],
                  readsFrom: [{ id: 'users-db', version: '1.0.0' }],
                },
              ],
            });

            const service = await getService('swagger-petstore', '1.0.0');
            expect(service.writesTo).toEqual([{ id: 'orders-db', version: '1.0.0' }]);
            expect(service.readsFrom).toEqual([{ id: 'users-db', version: '1.0.0' }]);
          });
        });

        it('if the service already has writesTo and readsFrom, the are merged with any new values being added and unique values are kept', async () => {
          const { getService } = utils(catalogDir);

          await plugin(config, {
            services: [
              {
                path: join(openAPIExamples, 'petstore.yml'),
                id: 'swagger-petstore',
                writesTo: [{ id: 'orders-db', version: '1.0.0' }],
                readsFrom: [{ id: 'users-db', version: '1.0.0' }],
              },
            ],
          });

          const service = await getService('swagger-petstore', '1.0.0');
          expect(service.writesTo).toEqual([{ id: 'orders-db', version: '1.0.0' }]);
          expect(service.readsFrom).toEqual([{ id: 'users-db', version: '1.0.0' }]);

          // Now we add a new writesTo and readsFrom, but the values are different
          await plugin(config, {
            services: [
              {
                path: join(openAPIExamples, 'petstore.yml'),
                id: 'swagger-petstore',
                writesTo: [{ id: 'orders-db-2', version: '1.0.0' }],
                readsFrom: [{ id: 'users-db-2', version: '1.0.0' }],
              },
            ],
          });

          const serviceUpdated = await getService('swagger-petstore', '1.0.0');

          expect(serviceUpdated.writesTo).toEqual([
            { id: 'orders-db', version: '1.0.0' },
            { id: 'orders-db-2', version: '1.0.0' },
          ]);
          expect(serviceUpdated.readsFrom).toEqual([
            { id: 'users-db', version: '1.0.0' },
            { id: 'users-db-2', version: '1.0.0' },
          ]);
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

        it('when messages does not have the `x-eventcatalog-message-version` but the service id is provided in the configuration that value is used for the message version', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, {
            services: [
              { path: join(openAPIExamples, 'petstore-with-special-characters.yml'), id: 'swagger-petstore', version: '10.0.0' },
            ],
          });

          const event = await getQuery('showPetById');
          expect(event.version).toEqual('10.0.0');
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

      it('when a the message already exists in EventCatalog the markdown, badges and attachments are persisted and not overwritten by default', async () => {
        const { writeCommand, getCommand } = utils(catalogDir);

        await writeCommand({
          id: 'createPets',
          name: 'createPets',
          version: '0.0.1',
          summary: 'Create a pet',
          markdown: 'please dont override me!',
          badges: [{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }],
          attachments: ['https://github.com/dboyne/eventcatalog/blob/main/README.md'],
        });

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

        const command = await getCommand('createPets', '1.0.0');
        expect(command.markdown).toEqual('please dont override me!');
        expect(command.badges).toEqual([{ backgroundColor: 'red', textColor: 'white', content: 'Custom Badge' }]);
        expect(command.attachments).toEqual(['https://github.com/dboyne/eventcatalog/blob/main/README.md']);
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

        // Regression test for https://github.com/event-catalog/generators/issues/219
        it('when operations have no operationId, each message still gets its own schemas, parameters, and request bodies', async () => {
          const { getQuery, getCommand } = utils(catalogDir);

          await plugin(config, {
            services: [{ path: join(openAPIExamples, 'without-operationIds.yml'), id: 'product-api' }],
          });

          // GET /{productId} — should expose its productId path parameter
          const getProductById = await getQuery('product-api_GET_{productId}');
          expect(getProductById.markdown).toContain('- **productId** (path)');

          // GET /{productId}/reviews — should expose productId parameter too
          const getReviews = await getQuery('product-api_GET_{productId}_reviews');
          expect(getReviews.markdown).toContain('- **productId** (path)');

          // POST /{productId}/reviews — should have a request body schema file
          const submitReview = await getCommand('product-api_POST_{productId}_reviews');
          expect(submitReview.schemaPath).toEqual('request-body.json');
          const requestBodyPath = join(
            catalogDir,
            'services',
            'product-api',
            'commands',
            'product-api_POST_{productId}_reviews',
            'request-body.json'
          );
          const requestBody = await fs.readFile(requestBodyPath, 'utf8');
          expect(requestBody).toContain('productId');

          // GET /{productId} 200 response should reference the Product schema (not the root GET array)
          const productByIdResponsePath = join(
            catalogDir,
            'services',
            'product-api',
            'queries',
            'product-api_GET_{productId}',
            'response-200.json'
          );
          const productByIdResponse = await fs.readFile(productByIdResponsePath, 'utf8');
          const parsed = JSON.parse(productByIdResponse);
          // Single Product object, not an array — proves it's this operation's schema, not /'s
          expect(parsed.type).toEqual('object');
          expect(parsed.properties).toHaveProperty('id');
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

      describe('config option: id', () => {
        it('if a `messages.id.prefix` value is given then the id of the message is prefixed with that value', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, {
            messages: {
              id: {
                prefix: 'hello',
              },
            },
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          });

          const command = await getCommand('hello-createPets');

          expect(command.id).toEqual('hello-createPets');
        });

        it('if `messages.id.prefixWithServiceId` is set to true then the id of the message is prefixed with the service id', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, {
            messages: { id: { prefixWithServiceId: true } },
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'petstore' }],
          });

          const command = await getCommand('petstore-createPets');

          expect(command.id).toEqual('petstore-createPets');

          // Make sure folder name is also prefixed with the service id
          expect(existsSync(join(catalogDir, 'services', 'petstore', 'commands', 'createPets'))).toBe(true);
        });

        it('if `messages.id.prefixWithServiceId` only the id  is prefixed with the service id and nothing else (e.g name)', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, {
            messages: { id: { prefixWithServiceId: true } },
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'petstore' }],
          });

          const command = await getCommand('petstore-createPets');

          expect(command.id).toEqual('petstore-createPets');
          expect(command.name).toEqual('createPets');
        });

        it('if a `messages.id.separator` value is given then the that separator is used to join the prefix and the message id', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, {
            messages: { id: { separator: '_', prefix: 'hello' } },
            services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
          });

          const command = await getCommand('hello_createPets');

          expect(command.id).toEqual('hello_createPets');
        });
      });

      describe('operation frontmatter', () => {
        it('messages are generated with the operation frontmatter containing method, path, and statusCodes', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets');

          expect((command as any).operation).toEqual({
            method: 'POST',
            path: '/pets',
          });
        });

        it('messages with response status codes include statusCodes in the operation frontmatter', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('updatePet');

          expect((command as any).operation).toEqual({
            method: 'PUT',
            path: '/pets/{petId}',
            statusCodes: ['200', '400', '404'],
          });
        });

        it('GET messages include the operation frontmatter with method and path', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const query = await getQuery('list-pets');

          expect((query as any).operation).toEqual({
            method: 'GET',
            path: '/pets',
            statusCodes: ['200'],
          });
        });

        it('DELETE messages include the operation frontmatter with method and path', async () => {
          const { getCommand } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('deletePet');

          expect((command as any).operation).toEqual({
            method: 'DELETE',
            path: '/pets/{petId}',
            statusCodes: ['400', '404'],
          });
        });

        it('operation frontmatter is always overridden and not persisted from existing messages', async () => {
          const { writeCommand, getCommand } = utils(catalogDir);

          // Write a message with a different operation value
          await writeCommand({
            id: 'createPets',
            name: 'createPets',
            version: '1.0.0',
            summary: 'Create a pet',
            markdown: '',
            operation: {
              method: 'GET',
              path: '/old-path',
              statusCodes: ['999'],
            },
          } as any);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const command = await getCommand('createPets', '1.0.0');

          // Operation should be overridden with the value from the OpenAPI spec, not persisted
          expect((command as any).operation).toEqual({
            method: 'POST',
            path: '/pets',
          });
        });

        it('event messages include the operation frontmatter', async () => {
          const { getEvent } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const event = await getEvent('petAdopted');

          expect((event as any).operation).toEqual({
            method: 'POST',
            path: '/pets/{petId}/adopted',
          });
        });

        it('statusCodes does not include the "default" response code', async () => {
          const { getQuery } = utils(catalogDir);

          await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }] });

          const query = await getQuery('showPetById');

          // showPetById has responses: 200 and default - default should be excluded
          expect((query as any).operation).toEqual({
            method: 'GET',
            path: '/pets/{petId}',
            statusCodes: ['200'],
          });
          expect((query as any).operation.statusCodes).not.toContain('default');
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

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the diagrams are persisted and not overwritten', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-diagrams',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            diagrams: [
              {
                id: 'my-custom-diagram',
                title: 'My Custom Diagram',
              },
            ],
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, { services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-diagrams' }] });

        const service = await getService('swagger-petstore-diagrams', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-diagrams',
            name: 'Swagger Petstore',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
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

      it('when the OpenAPI service is already defined in EventCatalog and the versions match, the flows and entities are persisted and not overwritten', async () => {
        const { writeService, getService } = utils(catalogDir);

        await writeService(
          {
            id: 'swagger-petstore-flows-entities',
            version: '1.0.0',
            name: 'Random Name',
            markdown: 'Here is my original markdown, please do not override this!',
            flows: [
              { id: 'AgencySelfServeBusinessProcessFlow', version: '1.0.0' },
              { id: 'BiddingFlow', version: '1.0.0' },
              { id: 'CampaignSetupFlow', version: '1.0.0' },
            ],
            entities: [
              { id: 'LeadType', version: '1.0.0' },
              { id: 'ProductCatalog', version: '1.0.0' },
              { id: 'ProductGroup', version: '1.0.0' },
            ],
          },
          { path: 'Swagger Petstore' }
        );

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore-flows-entities' }],
        });

        const service = await getService('swagger-petstore-flows-entities', '1.0.0');
        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-flows-entities',
            name: 'Swagger Petstore',
            version: '1.0.0',
            flows: [
              { id: 'AgencySelfServeBusinessProcessFlow', version: '1.0.0' },
              { id: 'BiddingFlow', version: '1.0.0' },
              { id: 'CampaignSetupFlow', version: '1.0.0' },
            ],
            entities: [
              { id: 'LeadType', version: '1.0.0' },
              { id: 'ProductCatalog', version: '1.0.0' },
              { id: 'ProductGroup', version: '1.0.0' },
            ],
          })
        );
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

        expect(
          existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'queries', 'createPets', 'versioned', '1.0.0'))
        ).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'versioned', '1.0.0', 'index.mdx'))).toBe(true);

        // Expect 2.0.0 to be the latest version with expected files
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'petstore-v2-no-extensions.yml'))).toBe(true);
        expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'petstore-v1-no-extensions.yml'))).toBe(false);

        expect(service).toEqual(
          expect.objectContaining({
            id: 'swagger-petstore-2',
            version: '2.0.0',
            specifications: [{ type: 'openapi', path: 'petstore-v2-no-extensions.yml' }],
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
            specifications: [{ type: 'openapi', path: 'petstore-v1-no-extensions.yml' }],
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

        // Get all the folder names in the queries folder for v2
        const queries = await fs.readdir(join(catalogDir, 'services', 'swagger-petstore-2', 'queries'));
        expect(queries).toEqual([
          'createPets',
          'deletePet',
          'listPets',
          'petAdopted',
          'petVaccinated',
          'showPetById',
          'updatePet',
        ]);

        const expectedVersionedQueries = ['createPets', 'deletePet', 'listPets', 'updatePet', 'petAdopted', 'petVaccinated'];

        for (const query of expectedVersionedQueries) {
          expect(existsSync(join(catalogDir, 'services', 'swagger-petstore-2', 'queries', query, 'versioned', '1.0.0'))).toBe(
            true
          );
        }
      });
    });

    describe('examples', () => {
      it('when parseExamples is true (default), request body examples (single example) are added to the message', async () => {
        const { getExamplesFromEvent } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-examples.yml'), id: 'swagger-petstore' }],
        });

        const examples = await getExamplesFromEvent('petAdopted', '1.0.0');

        expect(examples).toHaveLength(1);
        expect(examples).toEqual([
          {
            fileName: 'example.json',
            content: JSON.stringify({ petId: 1, adopterName: 'John Doe' }, null, 2),
          },
        ]);
      });

      it('when parseExamples is true (default), request body named examples are added to the message', async () => {
        const { getExamplesFromCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-examples.yml'), id: 'swagger-petstore' }],
        });

        const examples = await getExamplesFromCommand('createPets', '1.0.0');

        expect(examples).toHaveLength(2);
        expect(examples).toEqual(
          expect.arrayContaining([
            {
              fileName: 'dog.json',
              content: JSON.stringify({ id: 1, name: 'Fido', tag: 'dog' }, null, 2),
            },
            {
              fileName: 'cat.json',
              content: JSON.stringify({ id: 2, name: 'Whiskers', tag: 'cat' }, null, 2),
            },
          ])
        );
      });

      it('when parseExamples is true (default), response examples are added to the message', async () => {
        const { getExamplesFromQuery } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-examples.yml'), id: 'swagger-petstore' }],
        });

        const examples = await getExamplesFromQuery('listPets', '1.0.0');

        expect(examples).toHaveLength(1);
        expect(examples).toEqual([
          {
            fileName: 'response-200.json',
            content: JSON.stringify(
              [
                { id: 1, name: 'Fido', tag: 'dog' },
                { id: 2, name: 'Whiskers', tag: 'cat' },
              ],
              null,
              2
            ),
          },
        ]);
      });

      it('when parseExamples is false, no examples are added to messages', async () => {
        const { getExamplesFromCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-examples.yml'), id: 'swagger-petstore' }],
          parseExamples: false,
        });

        const examples = await getExamplesFromCommand('createPets', '1.0.0');

        expect(examples).toHaveLength(0);
      });

      it('when messages have no examples, no examples are added', async () => {
        const { getExamplesFromQuery } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore.yml'), id: 'swagger-petstore' }],
        });

        // showPetById has no examples defined in petstore.yml
        const examples = await getExamplesFromQuery('showPetById', '1.0.0');

        expect(examples).toHaveLength(0);
      });
    });

    describe('responses with empty content objects', () => {
      it('handles responses and requestBody with content: {} without crashing and generates all messages', async () => {
        const { getQuery, getCommand } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'empty-content-responses.yml'), id: 'empty-content-api' }],
        });

        // All messages should be generated despite content: {} in some responses
        const listItems = await getQuery('listItems', '1.0.0');
        const createItem = await getCommand('createItem', '1.0.0');
        const getItem = await getQuery('getItem', '1.0.0');

        expect(listItems).toBeDefined();
        expect(listItems?.id).toEqual('listItems');
        expect(createItem).toBeDefined();
        expect(createItem?.id).toEqual('createItem');
        expect(getItem).toBeDefined();
        expect(getItem?.id).toEqual('getItem');

        // The 200 and 400 responses have valid schemas so statusCodes should include them.
        // The 416 response with content: {} should be skipped (no schema extracted).
        expect(listItems?.operation?.statusCodes).toContain('200');
        expect(listItems?.operation?.statusCodes).toContain('400');
        expect(listItems?.operation?.statusCodes).not.toContain('416');
      });
    });
  });

  describe('consumer services', () => {
    describe('basic consumer configuration', () => {
      it('creates a consumer service that sends to ALL messages from the OpenAPI spec when no route filters are provided', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer).toBeDefined();
        expect(consumer.id).toEqual('orders-service');
        expect(consumer.version).toEqual('1.0.0');

        // petstore.yml has 7 operations, consumer should send to all of them
        expect(consumer.sends).toHaveLength(7);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'list-pets' }),
            expect.objectContaining({ id: 'createPets' }),
            expect.objectContaining({ id: 'showPetById' }),
            expect.objectContaining({ id: 'updatePet' }),
            expect.objectContaining({ id: 'deletePet' }),
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });

      it('creates multiple consumer services for the same OpenAPI spec', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                { id: 'orders-service', version: '1.0.0' },
                { id: 'notifications-service', version: '2.0.0' },
              ],
            },
          ],
        });

        const ordersConsumer = await getService('orders-service', '1.0.0');
        const notificationsConsumer = await getService('notifications-service', '2.0.0');

        expect(ordersConsumer).toBeDefined();
        expect(notificationsConsumer).toBeDefined();

        // Both should receive all messages when no filters
        expect(ordersConsumer.sends).toHaveLength(7);
        expect(notificationsConsumer.sends).toHaveLength(7);
      });

      it('consumer service defaults to version 1.0.0 when no version is specified', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer).toBeDefined();
        expect(consumer.version).toEqual('1.0.0');
      });

      it('does not overwrite an existing consumer service, only updates its sends', async () => {
        const { writeService, getService } = utils(catalogDir);

        // Pre-create the consumer service with custom markdown and existing sends
        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: '# My custom markdown',
          sends: [{ id: 'OrderPlaced', version: '1.0.0' }],
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer).toBeDefined();
        expect(consumer.name).toEqual('Orders Service');
        expect(consumer.markdown).toEqual('# My custom markdown');
        // Existing sends should be preserved
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'OrderPlaced' })]));
        // New sends should be merged (1 existing + 7 from petstore)
        expect(consumer.sends).toHaveLength(8);
      });

      it('does not create a duplicate service when consumer already exists with a different version than the default', async () => {
        const { writeService, getService } = utils(catalogDir);

        // Pre-create the consumer service with a non-default version (not 1.0.0)
        await writeService({
          id: 'public-website',
          version: '0.0.1',
          name: 'Public Website',
          markdown: '# Public Website',
          sends: [],
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              // Consumer does NOT specify a version — the generator should find the existing service
              consumers: [{ id: 'public-website' }],
            },
          ],
        });

        // The existing service should be updated with sends, not a new one created
        const consumer = await getService('public-website', '0.0.1');

        expect(consumer).toBeDefined();
        expect(consumer.name).toEqual('Public Website');
        expect(consumer.markdown).toEqual('# Public Website');
        // Should have the sends from the petstore spec merged in
        expect(consumer.sends).toHaveLength(7);
      });

      it('merges sends with existing sends on the consumer service without duplicates', async () => {
        const { writeService, getService } = utils(catalogDir);

        // Pre-create consumer with some existing sends
        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: '',
          sends: [
            { id: 'list-pets', version: '5.0.0' },
            { id: 'SomeOtherMessage', version: '1.0.0' },
          ],
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // Should have the existing SomeOtherMessage + all 7 petstore messages (list-pets deduplicated)
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'SomeOtherMessage', version: '1.0.0' }),
            expect.objectContaining({ id: 'list-pets' }),
            expect.objectContaining({ id: 'createPets' }),
            expect.objectContaining({ id: 'showPetById' }),
            expect.objectContaining({ id: 'updatePet' }),
            expect.objectContaining({ id: 'deletePet' }),
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );

        // list-pets should not be duplicated
        const listPetsEntries = consumer.sends.filter((r: any) => r.id === 'list-pets');
        expect(listPetsEntries).toHaveLength(1);
      });

      it('when a consumer already has a send with an older version, the version is updated to the latest generated version', async () => {
        const { writeService, getService } = utils(catalogDir);

        // Pre-create consumer with an outdated version of list-pets
        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: '',
          sends: [
            { id: 'list-pets', version: '0.0.1' },
            { id: 'createPets', version: '0.5.0' },
          ],
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // list-pets should be updated to the version from the OpenAPI spec (5.0.0 via x-eventcatalog-message-version)
        const listPets = consumer.sends.find((r: any) => r.id === 'list-pets');
        expect(listPets).toBeDefined();
        expect(listPets.version).toEqual('5.0.0');

        // createPets should be updated to the version from the OpenAPI spec (1.0.0)
        const createPets = consumer.sends.find((r: any) => r.id === 'createPets');
        expect(createPets).toBeDefined();
        expect(createPets.version).toEqual('1.0.0');

        // No duplicates
        const listPetsEntries = consumer.sends.filter((r: any) => r.id === 'list-pets');
        expect(listPetsEntries).toHaveLength(1);
        const createPetsEntries = consumer.sends.filter((r: any) => r.id === 'createPets');
        expect(createPetsEntries).toHaveLength(1);
      });

      it('when a consumer has a send without a version, it is left as-is (already latest)', async () => {
        const { writeService, getService } = utils(catalogDir);

        // Pre-create consumer with a send that has no version (meaning "latest")
        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: '',
          sends: [{ id: 'SomeExternalMessage' }],
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // SomeExternalMessage should still be there without a version (untouched)
        const externalMsg = consumer.sends.find((r: any) => r.id === 'SomeExternalMessage');
        expect(externalMsg).toBeDefined();
        expect(externalMsg.version).toBeUndefined();
      });

      it('the producer service sends array is not affected by consumer configuration', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
        });

        const producer = await getService('swagger-petstore', '1.0.0');

        // Producer service should still have its normal sends/receives unchanged
        expect(producer).toBeDefined();
        expect(producer.sends).toBeDefined();
      });
    });

    describe('route filtering - exact path match', () => {
      it('consumer sends only messages matching the exact path', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ path: '/pets' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // /pets has GET (listPets) and POST (createPets)
        expect(consumer.sends).toHaveLength(2);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: 'list-pets' }), expect.objectContaining({ id: 'createPets' })])
        );
      });

      it('consumer sends messages matching multiple exact paths', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ path: ['/pets', '/pets/{petId}/adopted'] }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // /pets has listPets + createPets, /pets/{petId}/adopted has petAdopted
        expect(consumer.sends).toHaveLength(3);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'list-pets' }),
            expect.objectContaining({ id: 'createPets' }),
            expect.objectContaining({ id: 'petAdopted' }),
          ])
        );
      });

      it('consumer sends no messages when exact path does not match any route', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ path: '/nonexistent' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer).toBeDefined();
        expect(consumer.sends).toBeUndefined();
      });
    });

    describe('route filtering - prefix match', () => {
      it('consumer sends messages from paths starting with the given prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ prefix: '/pets/{petId}' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // Paths starting with /pets/{petId}: /pets/{petId}, /pets/{petId}/adopted, /pets/{petId}/vaccinated
        expect(consumer.sends).toHaveLength(5);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'showPetById' }),
            expect.objectContaining({ id: 'updatePet' }),
            expect.objectContaining({ id: 'deletePet' }),
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });

      it('consumer sends messages from paths matching multiple prefixes', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ prefix: ['/pets/{petId}/adopted', '/pets/{petId}/vaccinated'] }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer.sends).toHaveLength(2);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });
    });

    describe('route filtering - suffix match', () => {
      it('consumer sends messages from paths ending with the given suffix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ suffix: '/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer.sends).toHaveLength(1);
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });

      it('consumer sends messages from paths matching multiple suffixes', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ suffix: ['/adopted', '/vaccinated'] }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer.sends).toHaveLength(2);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });

      it('suffix matching works with path segments (e.g. matching /{petId})', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ suffix: '/{petId}' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // Only /pets/{petId} ends with /{petId}
        expect(consumer.sends).toHaveLength(3);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'showPetById' }),
            expect.objectContaining({ id: 'updatePet' }),
            expect.objectContaining({ id: 'deletePet' }),
          ])
        );
      });
    });

    describe('route filtering - wildcard match', () => {
      it('wildcard * at the start matches paths with leading segments', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ match: '*/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // */adopted should match /pets/{petId}/adopted
        expect(consumer.sends).toHaveLength(1);
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });

      it('wildcard * matches any path segments', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ match: '/pets/*/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // /pets/{petId}/adopted matches /pets/*/adopted
        expect(consumer.sends).toHaveLength(1);
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });

      it('wildcard * at the end matches all sub-paths', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ match: '/pets/*' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // /pets/* should match /pets/{petId}, /pets/{petId}/adopted, /pets/{petId}/vaccinated
        expect(consumer.sends).toHaveLength(5);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'showPetById' }),
            expect.objectContaining({ id: 'updatePet' }),
            expect.objectContaining({ id: 'deletePet' }),
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });

      it('multiple wildcard patterns can be provided', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ match: ['/pets/*/adopted', '/pets/*/vaccinated'] }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer.sends).toHaveLength(2);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'petAdopted' }),
            expect.objectContaining({ id: 'petVaccinated' }),
          ])
        );
      });
    });

    describe('route filtering - combining filters', () => {
      it('multiple route filter objects are combined (union of matches)', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ path: '/pets' }, { suffix: '/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // /pets (listPets, createPets) + /pets/{petId}/adopted (petAdopted)
        expect(consumer.sends).toHaveLength(3);
        expect(consumer.sends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'list-pets' }),
            expect.objectContaining({ id: 'createPets' }),
            expect.objectContaining({ id: 'petAdopted' }),
          ])
        );
      });

      it('duplicate messages across filters are deduplicated', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ path: '/pets/{petId}/adopted' }, { suffix: '/adopted' }, { match: '/pets/*/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        // All three filters match petAdopted, but it should appear only once
        expect(consumer.sends).toHaveLength(1);
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });

      it('different filter types within the same route object are intersected', async () => {
        const { getService } = utils(catalogDir);

        // prefix /pets/{petId} AND suffix /adopted — should only match /pets/{petId}/adopted
        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ prefix: '/pets/{petId}', suffix: '/adopted' }],
                },
              ],
            },
          ],
        });

        const consumer = await getService('orders-service', '1.0.0');

        expect(consumer.sends).toHaveLength(1);
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });
    });

    describe('consumer with domain configuration', () => {
      it('when a domain is configured and the consumer service does not exist, the consumer is created inside that domain', async () => {
        const { getService, getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
          domain: { id: 'pets', name: 'Pets Domain', version: '1.0.0' },
        });

        const consumer = await getService('orders-service', '1.0.0');
        const domain = await getDomain('pets', '1.0.0');

        expect(consumer).toBeDefined();
        expect(consumer.sends).toHaveLength(7);

        // The consumer service should be listed in the domain alongside the producer
        expect(domain.services).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'swagger-petstore' }),
            expect.objectContaining({ id: 'orders-service', version: '1.0.0' }),
          ])
        );
      });

      it('when a domain is configured but the consumer service already exists outside it, the consumer is not moved into the domain', async () => {
        const { writeService, getService, getDomain } = utils(catalogDir);

        // Pre-create consumer outside any domain
        await writeService({
          id: 'orders-service',
          version: '1.0.0',
          name: 'Orders Service',
          markdown: '',
        });

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
          domain: { id: 'pets', name: 'Pets Domain', version: '1.0.0' },
        });

        const consumer = await getService('orders-service', '1.0.0');
        const domain = await getDomain('pets', '1.0.0');

        // Consumer should still get its sends updated
        expect(consumer).toBeDefined();
        expect(consumer.sends).toHaveLength(7);

        // Verify the domain file on disk does not contain the consumer service
        // (SDK getDomain may return cached results from prior tests, so check the file directly)
        const domainFilePath = join(catalogDir, 'domains', 'pets', 'index.mdx');
        const domainFileContent = await fs.readFile(domainFilePath, 'utf-8');
        expect(domainFileContent).not.toContain('orders-service');
      });

      it('when a consumer service already exists inside another domain, it stays in that domain and its sends are updated', async () => {
        const { writeDomain, addServiceToDomain, writeService, getService } = utils(catalogDir);

        // Create another domain and place the consumer inside it
        await writeDomain({
          id: 'orders',
          name: 'Orders Domain',
          version: '1.0.0',
          markdown: '',
        });

        await writeService(
          {
            id: 'orders-service',
            version: '1.0.0',
            name: 'Orders Service',
            markdown: '# Orders',
            sends: [{ id: 'OrderPlaced', version: '1.0.0' }],
          },
          { path: join('../', 'domains', 'orders', 'services', 'orders-service') }
        );

        await addServiceToDomain('orders', { id: 'orders-service', version: '1.0.0' }, '1.0.0');

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [{ id: 'orders-service', version: '1.0.0' }],
            },
          ],
          domain: { id: 'pets', name: 'Pets Domain', version: '1.0.0' },
        });

        const consumer = await getService('orders-service', '1.0.0');

        // Sends should be updated (1 existing + 7 from petstore)
        expect(consumer).toBeDefined();
        expect(consumer.sends).toHaveLength(8);

        // Existing data should be preserved
        expect(consumer.name).toEqual('Orders Service');
        expect(consumer.markdown).toEqual('# Orders');
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'OrderPlaced' })]));

        // Consumer should still live inside the orders domain on disk, not moved to pets
        const ordersServiceInOrdersDomain = existsSync(
          join(catalogDir, 'domains', 'orders', 'services', 'orders-service', 'index.mdx')
        );
        expect(ordersServiceInOrdersDomain).toBe(true);

        // Pets domain should NOT contain the consumer
        const petsDomainFilePath = join(catalogDir, 'domains', 'pets', 'index.mdx');
        const petsDomainFileContent = await fs.readFile(petsDomainFilePath, 'utf-8');
        expect(petsDomainFileContent).not.toContain('orders-service');
      });
    });

    describe('consumers with multiple OpenAPI services', () => {
      it('each service can have its own independent consumer configuration', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'orders-service',
                  version: '1.0.0',
                  routes: [{ suffix: '/adopted' }],
                },
              ],
            },
            {
              path: join(openAPIExamples, 'simple.yml'),
              id: 'simple-api',
              consumers: [
                {
                  id: 'notifications-service',
                  version: '1.0.0',
                },
              ],
            },
          ],
        });

        const ordersConsumer = await getService('orders-service', '1.0.0');
        const notificationsConsumer = await getService('notifications-service', '1.0.0');

        expect(ordersConsumer).toBeDefined();
        expect(ordersConsumer.sends).toHaveLength(1);
        expect(ordersConsumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));

        expect(notificationsConsumer).toBeDefined();
        expect(notificationsConsumer.sends).toBeDefined();
      });

      it('the same consumer service can consume from multiple OpenAPI services', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(openAPIExamples, 'petstore.yml'),
              id: 'swagger-petstore',
              consumers: [
                {
                  id: 'shared-consumer',
                  version: '1.0.0',
                  routes: [{ suffix: '/adopted' }],
                },
              ],
            },
            {
              path: join(openAPIExamples, 'simple.yml'),
              id: 'simple-api',
              consumers: [
                {
                  id: 'shared-consumer',
                  version: '1.0.0',
                },
              ],
            },
          ],
        });

        const consumer = await getService('shared-consumer', '1.0.0');

        expect(consumer).toBeDefined();
        // Should have sends from petstore (/adopted) AND all from simple.yml, merged
        expect(consumer.sends).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'petAdopted' })]));
      });
    });
  });

  describe('message grouping (groupMessagesBy)', () => {
    describe('x-extension', () => {
      it('listPets (GET /pets) receives group "Pet Management" from its x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const listPets = service.receives?.find((r: any) => r.id === 'listPets');

        expect(listPets).toEqual(expect.objectContaining({ id: 'listPets', group: 'Pet Management' }));
      });

      it('adoptPet (POST /pets/{petId}/adopt) receives group "Adoptions" from its x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const adoptPet = service.receives?.find((r: any) => r.id === 'adoptPet');

        expect(adoptPet).toEqual(expect.objectContaining({ id: 'adoptPet', group: 'Adoptions' }));
      });

      it('getOrderById (GET /orders/{orderId}) receives group "Orders" from its x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const getOrderById = service.receives?.find((r: any) => r.id === 'getOrderById');

        expect(getOrderById).toEqual(expect.objectContaining({ id: 'getOrderById', group: 'Orders' }));
      });

      it('listInvoices (GET /api/v1/billing/invoices) receives group "Billing" from its x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const listInvoices = service.receives?.find((r: any) => r.id === 'listInvoices');

        expect(listInvoices).toEqual(expect.objectContaining({ id: 'listInvoices', group: 'Billing' }));
      });

      it('sendNotification (POST /notifications/send, action=sends) is placed in sends with group "Notifications"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const sendNotification = service.sends?.find((s: any) => s.id === 'sendNotification');

        expect(sendNotification).toEqual(expect.objectContaining({ id: 'sendNotification', group: 'Notifications' }));
      });

      it('healthCheck (GET /health) has no group because it has no x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const healthCheck = service.receives?.find((r: any) => r.id === 'healthCheck');

        expect(healthCheck).toBeDefined();
        expect(healthCheck).not.toHaveProperty('group');
      });

      it('getStatus (GET /status) has no group because it has no x-eventcatalog-group extension', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-grouped' }],
          groupMessagesBy: 'x-extension',
        });

        const service = await getService('petstore-grouped', '1.0.0');
        const getStatus = service.receives?.find((r: any) => r.id === 'getStatus');

        expect(getStatus).toBeDefined();
        expect(getStatus).not.toHaveProperty('group');
      });
    });

    describe('path-prefix', () => {
      it('showPetById (GET /pets/{petId}) receives group "/pets"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const showPetById = service.receives?.find((r: any) => r.id === 'showPetById');

        expect(showPetById).toEqual(expect.objectContaining({ id: 'showPetById', group: '/pets' }));
      });

      it('adoptPet (POST /pets/{petId}/adopt) receives group "/pets"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const adoptPet = service.receives?.find((r: any) => r.id === 'adoptPet');

        expect(adoptPet).toEqual(expect.objectContaining({ id: 'adoptPet', group: '/pets' }));
      });

      it('listVaccinations (GET /pets/{petId}/vaccinations) receives group "/pets"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const listVaccinations = service.receives?.find((r: any) => r.id === 'listVaccinations');

        expect(listVaccinations).toEqual(expect.objectContaining({ id: 'listVaccinations', group: '/pets' }));
      });

      it('getOrderById (GET /orders/{orderId}) receives group "/orders"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const getOrderById = service.receives?.find((r: any) => r.id === 'getOrderById');

        expect(getOrderById).toEqual(expect.objectContaining({ id: 'getOrderById', group: '/orders' }));
      });

      it('cancelOrder (POST /orders/{orderId}/cancel) receives group "/orders"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const cancelOrder = service.receives?.find((r: any) => r.id === 'cancelOrder');

        expect(cancelOrder).toEqual(expect.objectContaining({ id: 'cancelOrder', group: '/orders' }));
      });

      it('listInvoices (GET /api/v1/billing/invoices) receives group "/billing" — skips "api" and "v1" prefixes', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const listInvoices = service.receives?.find((r: any) => r.id === 'listInvoices');

        expect(listInvoices).toEqual(expect.objectContaining({ id: 'listInvoices', group: '/billing' }));
      });

      it('sendNotification (POST /notifications/send) has no group because no other paths share the /notifications prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const sendNotification = service.sends?.find((s: any) => s.id === 'sendNotification');

        expect(sendNotification).toBeDefined();
        expect(sendNotification).not.toHaveProperty('group');
      });

      it('listPets (GET /pets) receives group "/pets" because other paths share the /pets prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const listPets = service.receives?.find((r: any) => r.id === 'listPets');

        expect(listPets).toEqual(expect.objectContaining({ id: 'listPets', group: '/pets' }));
      });

      it('placeOrder (POST /orders) receives group "/orders" because other paths share the /orders prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const placeOrder = service.receives?.find((r: any) => r.id === 'placeOrder');

        expect(placeOrder).toEqual(expect.objectContaining({ id: 'placeOrder', group: '/orders' }));
      });

      it('healthCheck (GET /health) has no group because no other paths share the /health prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const healthCheck = service.receives?.find((r: any) => r.id === 'healthCheck');

        expect(healthCheck).toBeDefined();
        expect(healthCheck).not.toHaveProperty('group');
      });

      it('getStatus (GET /status) has no group because no other paths share the /status prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');
        const getStatus = service.receives?.find((r: any) => r.id === 'getStatus');

        expect(getStatus).toBeDefined();
        expect(getStatus).not.toHaveProperty('group');
      });

      it('POST/GET/PUT on the same /basket path all receive group "/basket" even though only one distinct path uses that prefix', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-path' }],
          groupMessagesBy: 'path-prefix',
        });

        const service = await getService('petstore-path', '1.0.0');

        const createBasket = service.receives?.find((r: any) => r.id === 'createBasket');
        const showBasket = service.receives?.find((r: any) => r.id === 'showBasket');
        const updateBasket = service.receives?.find((r: any) => r.id === 'updateBasket');

        expect(createBasket).toEqual(expect.objectContaining({ id: 'createBasket', group: '/basket' }));
        expect(showBasket).toEqual(expect.objectContaining({ id: 'showBasket', group: '/basket' }));
        expect(updateBasket).toEqual(expect.objectContaining({ id: 'updateBasket', group: '/basket' }));
      });

      it('groups remain on receives across consecutive runs with the same groupMessagesBy config', async () => {
        const { getService } = utils(catalogDir);

        // First run — groups should be written
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-rerun' }],
          groupMessagesBy: 'path-prefix',
        });

        let service = await getService('petstore-rerun', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).toEqual(
          expect.objectContaining({ id: 'showPetById', group: '/pets' })
        );
        expect(service.receives?.find((r: any) => r.id === 'createBasket')).toEqual(
          expect.objectContaining({ id: 'createBasket', group: '/basket' })
        );

        // Second run — groups should still be present
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-rerun' }],
          groupMessagesBy: 'path-prefix',
        });

        service = await getService('petstore-rerun', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).toEqual(
          expect.objectContaining({ id: 'showPetById', group: '/pets' })
        );
        expect(service.receives?.find((r: any) => r.id === 'createBasket')).toEqual(
          expect.objectContaining({ id: 'createBasket', group: '/basket' })
        );
      });

      it('groups are applied on a second run when the service was originally generated without groupMessagesBy', async () => {
        const { getService } = utils(catalogDir);

        // First run — no groupMessagesBy, service written without group fields
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-add-groups' }],
        });

        let service = await getService('petstore-add-groups', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).not.toHaveProperty('group');

        // Second run — user adds groupMessagesBy: 'path-prefix', groups should now be applied
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-add-groups' }],
          groupMessagesBy: 'path-prefix',
        });

        service = await getService('petstore-add-groups', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).toEqual(
          expect.objectContaining({ id: 'showPetById', group: '/pets' })
        );
      });
    });

    describe('single-group', () => {
      it('every message gets the single group labelled "operations"', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-single-group' }],
          groupMessagesBy: 'single-group',
        });

        const service = await getService('petstore-single-group', '1.0.0');
        const allMessages = [...(service.receives || []), ...(service.sends || [])];

        expect(allMessages.length).toBeGreaterThan(0);
        for (const msg of allMessages) {
          expect(msg).toEqual(expect.objectContaining({ group: 'operations' }));
        }
      });

      it('getStatus (GET /status) receives group "operations" even though path-prefix would not group it', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-single-group-lone' }],
          groupMessagesBy: 'single-group',
        });

        const service = await getService('petstore-single-group-lone', '1.0.0');
        const getStatus = service.receives?.find((r: any) => r.id === 'getStatus');

        expect(getStatus).toEqual(expect.objectContaining({ id: 'getStatus', group: 'operations' }));
      });

      it('groups on sends are applied on a second run when the service was originally generated without groupMessagesBy', async () => {
        const { getService } = utils(catalogDir);

        // First run — no groupMessagesBy, sends written without group fields
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-sends-add-groups' }],
        });

        let service = await getService('petstore-sends-add-groups', '1.0.0');
        expect(service.sends?.find((s: any) => s.id === 'sendNotification')).not.toHaveProperty('group');

        // Second run — user adds groupMessagesBy: 'single-group', groups should now be applied to sends
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-sends-add-groups' }],
          groupMessagesBy: 'single-group',
        });

        service = await getService('petstore-sends-add-groups', '1.0.0');
        expect(service.sends?.find((s: any) => s.id === 'sendNotification')).toEqual(
          expect.objectContaining({ id: 'sendNotification', group: 'operations' })
        );
      });
    });

    describe('switching grouping strategy across runs', () => {
      it('switching from path-prefix to single-group replaces the group values on re-run', async () => {
        const { getService } = utils(catalogDir);

        // First run — path-prefix assigns "/pets" to showPetById
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-switch-strategy' }],
          groupMessagesBy: 'path-prefix',
        });

        let service = await getService('petstore-switch-strategy', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).toEqual(
          expect.objectContaining({ id: 'showPetById', group: '/pets' })
        );

        // Second run — user switches to single-group, groups should become "operations"
        await plugin(config, {
          services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-switch-strategy' }],
          groupMessagesBy: 'single-group',
        });

        service = await getService('petstore-switch-strategy', '1.0.0');
        expect(service.receives?.find((r: any) => r.id === 'showPetById')).toEqual(
          expect.objectContaining({ id: 'showPetById', group: 'operations' })
        );
      });
    });

    describe('large-spec warning', () => {
      const buildLargeSpec = async (operationCount: number): Promise<string> => {
        const paths: Record<string, any> = {};
        for (let i = 0; i < operationCount; i++) {
          paths[`/thing-${i}`] = {
            get: {
              summary: `get thing ${i}`,
              operationId: `getThing${i}`,
              responses: { '200': { description: 'ok' } },
            },
          };
        }
        const spec = {
          openapi: '3.0.0',
          info: { title: 'Large', version: '1.0.0' },
          paths,
        };
        const specPath = join(catalogDir, 'large-spec.json');
        await fs.writeFile(specPath, JSON.stringify(spec));
        return specPath;
      };

      it('warns when the spec has 50+ operations and groupMessagesBy is not set', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const specPath = await buildLargeSpec(50);

        await plugin(config, {
          services: [{ path: specPath, id: 'large-no-group' }],
        });

        const warned = warn.mock.calls.some((args) => String(args[0]).includes('50 operations'));
        expect(warned).toBe(true);
        warn.mockRestore();
      });

      it('does not warn when groupMessagesBy is set, even for large specs', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const specPath = await buildLargeSpec(50);

        await plugin(config, {
          services: [{ path: specPath, id: 'large-with-group' }],
          groupMessagesBy: 'single-group',
        });

        const warned = warn.mock.calls.some((args) => String(args[0]).includes('operations'));
        expect(warned).toBe(false);
        warn.mockRestore();
      });

      it('does not warn for specs under the threshold', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const specPath = await buildLargeSpec(10);

        await plugin(config, {
          services: [{ path: specPath, id: 'small-no-group' }],
        });

        const warned = warn.mock.calls.some((args) => String(args[0]).includes('operations'));
        expect(warned).toBe(false);
        warn.mockRestore();
      });
    });

    it('no messages have a group property when groupMessagesBy is not configured', async () => {
      const { getService } = utils(catalogDir);

      await plugin(config, {
        services: [{ path: join(openAPIExamples, 'petstore-with-groups.yml'), id: 'petstore-no-group' }],
      });

      const service = await getService('petstore-no-group', '1.0.0');

      const allMessages = [...(service.receives || []), ...(service.sends || [])];
      for (const msg of allMessages) {
        expect(msg).not.toHaveProperty('group');
      }
    });
  });
});
