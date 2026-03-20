import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import path, { join } from 'node:path';
import fs from 'fs/promises';
import { existsSync } from 'node:fs';
import { vi } from 'vitest';

// Add mock for the local checkLicense module
vi.mock('../../../../shared/checkLicense', () => ({
  default: () => Promise.resolve(),
}));

// Fake eventcatalog config
const config = {};

let catalogDir: string;
const graphQLExamples = join(__dirname, 'graphql-files');

function toPosix(p: string) {
  return p.split(path.sep).join('/');
}

describe('GraphQL EventCatalog Plugin', () => {
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
      it('if a domain is defined in the GraphQL plugin configuration and that domain does not exist, it is created', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
          domain: { id: 'users', name: 'Users Domain', version: '1.0.0' },
        });

        const domain = await getDomain('users', '1.0.0');

        expect(domain).toEqual(
          expect.objectContaining({
            id: 'users',
            name: 'Users Domain',
            version: '1.0.0',
            services: [{ id: 'user-service', version: '1.0.0' }],
          })
        );
      });

      it('if a domain is not defined in the GraphQL plugin configuration, the service is not added to any domains', async () => {
        const { getDomain } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
        });
        expect(await getDomain('users', '1.0.0')).toBeUndefined();
      });

      // persist domain markdown
      it('if the domain is already defined in EventCatalog and the versions match, the markdown, owners, badges and attachments are persisted and not overwritten', async () => {
        const { getDomain, writeDomain } = utils(catalogDir);

        await writeDomain({
          id: 'users',
          name: 'Users Domain',
          version: '1.0.0',
          markdown: 'This is my original markdown, please do not overwrite me',
          owners: ['John Doe', 'Jane Doe'],
          attachments: [{ title: 'Random', url: 'https://random.com' }],
          badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
        });

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
          domain: { id: 'users', name: 'Users Domain', version: '1.0.0' },
        });

        const domain = await getDomain('users', '1.0.0');
        expect(domain).toEqual(
          expect.objectContaining({
            id: 'users',
            name: 'Users Domain',
            version: '1.0.0',
            markdown: 'This is my original markdown, please do not overwrite me',
            owners: ['John Doe', 'Jane Doe'],
            attachments: [{ title: 'Random', url: 'https://random.com' }],
            badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
          })
        );
      });

      it(
        'if a domain is defined in the GraphQL file but the versions do not match, the existing domain is versioned and a new one is created',
        async () => {
          const { writeDomain, getDomain, getResourcePath } = utils(catalogDir);

          await writeDomain({
            id: 'users',
            name: 'Users Domain',
            version: '0.0.1',
            markdown: '',
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
            domain: { id: 'users', name: 'Users Domain', version: '1.0.0' },
          });

          const versionedDomain = await getDomain('users', '0.0.1');
          const newDomain = await getDomain('users', '1.0.0');

          expect(versionedDomain.version).toEqual('0.0.1');
          expect(newDomain.version).toEqual('1.0.0');
          expect(newDomain.services).toEqual([{ id: 'user-service', version: '1.0.0' }]);
        },
        { timeout: 10000 }
      );

      it('if a domain is defined in the GraphQL plugin configuration and that domain exists the GraphQL Service is added to that domain', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
          domain: { id: 'users', name: 'Users Domain', version: '1.0.0' },
        });

        const domain = await getDomain('users', '1.0.0');
        expect(domain.services).toEqual([{ id: 'user-service', version: '1.0.0' }]);
      });

      it('if multiple GraphQL files are processed, they are all added to the domain', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'petstore-service',
              version: '1.0.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
          domain: { id: 'api', name: 'API Domain', version: '1.0.0' },
        });

        const domain = await getDomain('api', 'latest');

        expect(domain.services).toHaveLength(2);
        expect(domain.services).toEqual([
          { id: 'user-service', version: '1.0.0' },
          { id: 'petstore-service', version: '1.0.0' },
        ]);
      });

      it('if the domain has owners, they are added to the domain', async () => {
        const { getDomain } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
          domain: { id: 'users', name: 'Users Domain', version: '1.0.0', owners: ['John Doe', 'Jane Doe'] },
        });

        const domain = await getDomain('users', '1.0.0');
        expect(domain.owners).toEqual(['John Doe', 'Jane Doe']);
      });

      it('if a domain is defined, the service is added into the domain folder', async () => {
        const { getResourcePath } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'petstore-service',
              version: '1.1.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
          domain: { id: 'users', name: 'Users Domain', version: '1.0.0' },
        });

        const path = await getResourcePath(catalogDir, 'petstore-service', '1.1.0');
        expect(toPosix(path?.relativePath || '')).toEqual('/domains/users/services/petstore-service/index.mdx');
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
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'User service',
              name: 'User Service',
            },
          ],
          domain: { id: 'Agency', name: 'Agency Domain', version: '1.0.0' },
        });

        const service = await getService('user-service', '1.0.0');
        expect(service).toBeDefined();

        const subdomainServicePath = join(catalogDir, 'domains', 'Buyer', 'subdomains', 'Agency', 'services', 'user-service');
        expect(existsSync(subdomainServicePath)).toBe(true);
      });
    });

    describe('services', () => {
      it('GraphQL spec is mapped into a service in EventCatalog when no service with this name is already defined', async () => {
        const { getService } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'petstore-service',
              version: '1.1.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
        });

        const service = await getService('petstore-service');

        expect(service).toEqual(
          expect.objectContaining({
            id: 'petstore-service',
            name: 'Petstore Service',
            version: '1.1.0',
            summary: 'This is a sample server Petstore server.',
          })
        );
      });

      it('when the GraphQL service is already defined in EventCatalog and the versions match, the markdown, writesTo, readsFrom, badges and attachments are persisted and not overwritten', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'petstore-service',
          version: '1.0.0',
          name: 'Random Name',
          markdown: 'Here is my original markdown, please do not override this!',
          badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
          attachments: [{ title: 'Random', url: 'https://random.com' }],
          writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
          readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
        });

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'petstore-service',
              version: '1.0.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
        });

        const service = await getService('petstore-service', '1.0.0');

        // console.log(service);

        expect(service).toEqual(
          expect.objectContaining({
            id: 'petstore-service',
            name: 'Petstore Service',
            version: '1.0.0',
            summary: 'This is a sample server Petstore server.',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
            attachments: [{ title: 'Random', url: 'https://random.com' }],
            writesTo: [{ id: 'usersignedup', version: '1.0.0' }],
            readsFrom: [{ id: 'usersignedup', version: '1.0.0' }],
          })
        );
      });

      it('when the GraphQL service is already defined in EventCatalog and the processed specification version is greater than the existing service version, a new service is created and the old one is versioned', async () => {
        // Create a service with the same name and version as the OpenAPI file for testing
        const { writeService, getService } = utils(catalogDir);

        await writeService({
          id: 'petstore-service',
          version: '0.0.1',
          name: 'Petstore Service',
          markdown: '',
        });

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'petstore-service',
              version: '1.0.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
        });

        const versionedService = await getService('petstore-service', '0.0.1');
        const newService = await getService('petstore-service', '1.0.0');
        expect(versionedService).toBeDefined();
        expect(newService).toBeDefined();
      });

      it('the GraphQL file is added to the service which can be downloaded in eventcatalog', async () => {
        const { getService } = utils(catalogDir);
        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'petstore.graphql'),
              id: 'swagger-petstore',
              version: '1.0.0',
              summary: 'This is a sample server Petstore server.',
              name: 'Petstore Service',
            },
          ],
        });

        const service = await getService('swagger-petstore', '1.0.0');

        expect(service.schemaPath).toEqual('petstore.graphql');
        expect(service.specifications).toEqual([
          {
            path: 'petstore.graphql',
            type: 'graphql',
            name: 'Petstore ServiceGraphQL API',
          },
        ]);

        const schema = await fs.readFile(join(catalogDir, 'services', 'swagger-petstore', 'petstore.graphql'));
        expect(schema).toBeDefined();
      });

      describe('service options', () => {
        it('if the `writesTo` option is provided, the service writesTo is set to the config value', async () => {
          const { getService } = utils(catalogDir);
          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'petstore.graphql'),
                id: 'swagger-petstore',
                version: '1.0.0',
                summary: 'This is a sample server Petstore server.',
                name: 'Petstore Service',
                writesTo: [{ id: 'Users Service', version: '1.0.0' }],
              },
            ],
          });

          const service = await getService('swagger-petstore');
          expect(service.writesTo).toEqual([{ id: 'Users Service', version: '1.0.0' }]);
        });

        it('if the `readsFrom` option is provided, the service readsFrom is set to the config value', async () => {
          const { getService } = utils(catalogDir);
          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'petstore.graphql'),
                id: 'swagger-petstore',
                version: '1.0.0',
                summary: 'This is a sample server Petstore server.',
                name: 'Petstore Service',
                readsFrom: [{ id: 'Users Service', version: '1.0.0' }],
              },
            ],
          });
          const service = await getService('swagger-petstore');
          expect(service.readsFrom).toEqual([{ id: 'Users Service', version: '1.0.0' }]);
        });
      });
    });

    describe('messages', () => {
      describe('queries', () => {
        it('maps all graphql queries into queries in EventCatalog and also maps them to the service receives', async () => {
          const { getQuery, getService } = utils(catalogDir);

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessage = await getQuery('getUser');
          const getUsersMessage = await getQuery('getUsers');
          const getProfileMessage = await getQuery('getProfile');
          const service = await getService('user-service', '1.0.0');

          expect(getUserMessage).toEqual(
            expect.objectContaining({
              id: 'getUser',
              name: 'getUser',
              version: '1.0.0',
              sidebar: {
                badge: 'Query',
              },
            })
          );

          expect(getUsersMessage).toEqual(
            expect.objectContaining({
              id: 'getUsers',
              name: 'getUsers',
              version: '1.0.0',
              sidebar: {
                badge: 'Query',
              },
            })
          );

          expect(getProfileMessage).toEqual(
            expect.objectContaining({
              id: 'getProfile',
              name: 'getProfile',
              version: '1.0.0',
              sidebar: {
                badge: 'Query',
              },
            })
          );

          expect(service.receives).toEqual(
            expect.arrayContaining([
              { id: 'getUser', version: '1.0.0' },
              { id: 'getUsers', version: '1.0.0' },
              { id: 'getProfile', version: '1.0.0' },
            ])
          );
        });

        it('if a query is already defined in EventCatalog and the versions match, the markdown, badges and attachments are persisted and not overwritten', async () => {
          const { writeQuery, getQuery } = utils(catalogDir);

          await writeQuery({
            id: 'getUser',
            name: 'getUser',
            version: '1.0.0',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
            attachments: [{ title: 'Random', url: 'https://random.com' }],
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessage = await getQuery('getUser', '1.0.0');
          expect(getUserMessage.markdown).toEqual('Here is my original markdown, please do not override this!');
          expect(getUserMessage.badges).toEqual([{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }]);
          expect(getUserMessage.attachments).toEqual([{ title: 'Random', url: 'https://random.com' }]);
        });

        it('if a query is already defined in EventCatalog and the versions do not match, the previous query is versioned', async () => {
          const { writeQuery, getQuery } = utils(catalogDir);

          await writeQuery({
            id: 'getUser',
            name: 'getUser',
            version: '0.0.1',
            markdown: 'I am a previous version of the query',
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessagePrevious = await getQuery('getUser', '0.0.1');
          expect(getUserMessagePrevious.markdown).toEqual('I am a previous version of the query');

          const latestQuery = await getQuery('getUser', '1.0.0');
          expect(latestQuery.version).toEqual('1.0.0');
        });
      });
      describe('mutations', () => {
        it('maps all graphql queries into queries in EventCatalog and also maps them to the service receives', async () => {
          const { getCommand, getService } = utils(catalogDir);

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const createUserMessage = await getCommand('createUser');
          const updateUserMessage = await getCommand('updateUser');
          const deleteUserMessage = await getCommand('deleteUser');
          const updateProfileMessage = await getCommand('updateProfile');

          const service = await getService('user-service', '1.0.0');

          expect(createUserMessage).toEqual(
            expect.objectContaining({
              id: 'createUser',
              name: 'createUser',
              version: '1.0.0',
              sidebar: {
                badge: 'Mutation',
              },
            })
          );

          expect(updateUserMessage).toEqual(
            expect.objectContaining({
              id: 'updateUser',
              name: 'updateUser',
              version: '1.0.0',
              sidebar: {
                badge: 'Mutation',
              },
            })
          );

          expect(deleteUserMessage).toEqual(
            expect.objectContaining({
              id: 'deleteUser',
              name: 'deleteUser',
              version: '1.0.0',
              sidebar: {
                badge: 'Mutation',
              },
            })
          );

          expect(updateProfileMessage).toEqual(
            expect.objectContaining({
              id: 'updateProfile',
              name: 'updateProfile',
              version: '1.0.0',
              sidebar: {
                badge: 'Mutation',
              },
            })
          );

          expect(service.receives).toEqual(
            expect.arrayContaining([
              { id: 'createUser', version: '1.0.0' },
              { id: 'updateUser', version: '1.0.0' },
              { id: 'deleteUser', version: '1.0.0' },
              { id: 'updateProfile', version: '1.0.0' },
            ])
          );
        });

        it('if a mutation is already defined in EventCatalog and the versions match, the markdown, badges and attachments are persisted and not overwritten', async () => {
          const { writeCommand, getCommand } = utils(catalogDir);

          await writeCommand({
            id: 'createUser',
            name: 'createUser',
            version: '1.0.0',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
            attachments: [{ title: 'Random', url: 'https://random.com' }],
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessage = await getCommand('createUser', '1.0.0');
          expect(getUserMessage.markdown).toEqual('Here is my original markdown, please do not override this!');
          expect(getUserMessage.badges).toEqual([{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }]);
          expect(getUserMessage.attachments).toEqual([{ title: 'Random', url: 'https://random.com' }]);
        });

        it('if a mutation is already defined in EventCatalog and the versions do not match, the previous mutation is versioned', async () => {
          const { writeCommand, getCommand } = utils(catalogDir);

          await writeCommand({
            id: 'createUser',
            name: 'createUser',
            version: '0.0.1',
            markdown: 'I am a previous version of the query',
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessagePrevious = await getCommand('createUser', '0.0.1');
          expect(getUserMessagePrevious.markdown).toEqual('I am a previous version of the query');

          const latestQuery = await getCommand('createUser', '1.0.0');
          expect(latestQuery.version).toEqual('1.0.0');
        });
      });

      describe('subscriptions', () => {
        it('maps all graphql subscriptions into events in EventCatalog and also maps them to the service sends', async () => {
          const { getEvent, getService } = utils(catalogDir);

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const userCreatedMessage = await getEvent('userCreated');
          const userUpdatedMessage = await getEvent('userUpdated');
          const userDeletedMessage = await getEvent('userDeleted');

          const service = await getService('user-service', '1.0.0');

          expect(userCreatedMessage).toEqual(
            expect.objectContaining({
              id: 'userCreated',
              name: 'userCreated',
              version: '1.0.0',
              sidebar: {
                badge: 'Subscription',
              },
            })
          );

          expect(userUpdatedMessage).toEqual(
            expect.objectContaining({
              id: 'userUpdated',
              name: 'userUpdated',
              version: '1.0.0',
              sidebar: {
                badge: 'Subscription',
              },
            })
          );

          expect(userDeletedMessage).toEqual(
            expect.objectContaining({
              id: 'userDeleted',
              name: 'userDeleted',
              version: '1.0.0',
              sidebar: {
                badge: 'Subscription',
              },
            })
          );

          expect(service.sends).toEqual(
            expect.arrayContaining([
              { id: 'userCreated', version: '1.0.0' },
              { id: 'userUpdated', version: '1.0.0' },
              { id: 'userDeleted', version: '1.0.0' },
            ])
          );
        });

        it('if a subscription is already defined in EventCatalog and the versions match, the markdown, badges and attachments are persisted and not overwritten', async () => {
          const { writeEvent, getEvent } = utils(catalogDir);

          await writeEvent({
            id: 'userCreated',
            name: 'userCreated',
            version: '1.0.0',
            markdown: 'Here is my original markdown, please do not override this!',
            badges: [{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }],
            attachments: [{ title: 'Random', url: 'https://random.com' }],
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessage = await getEvent('userCreated', '1.0.0');
          expect(getUserMessage.markdown).toEqual('Here is my original markdown, please do not override this!');
          expect(getUserMessage.badges).toEqual([{ content: 'Random', textColor: 'blue', backgroundColor: 'blue' }]);
          expect(getUserMessage.attachments).toEqual([{ title: 'Random', url: 'https://random.com' }]);
        });

        it('if a subscription is already defined in EventCatalog and the versions do not match, the previous subscription is versioned', async () => {
          const { writeEvent, getEvent } = utils(catalogDir);

          await writeEvent({
            id: 'userCreated',
            name: 'userCreated',
            version: '0.0.1',
            markdown: 'I am a previous version of the query',
          });

          await plugin(config, {
            services: [
              {
                path: join(graphQLExamples, 'simple.graphql'),
                id: 'user-service',
                version: '1.0.0',
                summary: 'This is a sample server User service.',
                name: 'User Service',
              },
            ],
          });

          const getUserMessagePrevious = await getEvent('userCreated', '0.0.1');
          expect(getUserMessagePrevious.markdown).toEqual('I am a previous version of the query');

          const latestQuery = await getEvent('userCreated', '1.0.0');
          expect(latestQuery.version).toEqual('1.0.0');
        });
      });

      it('if a service is defined, the messages are added into the service folder', async () => {
        const { getResourcePath } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
            },
          ],
        });

        const path = await getResourcePath(catalogDir, 'getUser', '1.0.0');
        expect(toPosix(path?.relativePath || '')).toEqual('/services/user-service/queries/getUser/index.mdx');
      });
    });

    describe('comment extraction from GraphQL schema', () => {
      it('extracts GraphQL field descriptions as summaries for queries, mutations, and subscriptions', async () => {
        const { getQuery, getCommand, getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: join(graphQLExamples, 'simple.graphql'),
              id: 'user-service',
              version: '1.0.0',
              summary: 'This is a sample server User service.',
              name: 'User Service',
            },
          ],
        });

        const getUserQuery = await getQuery('getUser');
        const getUsersQuery = await getQuery('getUsers');
        const getProfileQuery = await getQuery('getProfile');

        const createUserCommand = await getCommand('createUser');
        const updateUserCommand = await getCommand('updateUser');
        const deleteUserCommand = await getCommand('deleteUser');
        const updateProfileCommand = await getCommand('updateProfile');

        const userCreatedEvent = await getEvent('userCreated');
        const userUpdatedEvent = await getEvent('userUpdated');
        const userDeletedEvent = await getEvent('userDeleted');

        // Verify query summaries from GraphQL descriptions
        expect(getUserQuery.summary).toBe('Fetch a user by their unique ID');
        expect(getUsersQuery.summary).toBe('Retrieve all users from the system');
        expect(getProfileQuery.summary).toBe('Get user profile information by user ID');

        // Verify mutation/command summaries from GraphQL descriptions
        expect(createUserCommand.summary).toBe('Create a new user account');
        expect(updateUserCommand.summary).toBe("Update an existing user's information");
        expect(deleteUserCommand.summary).toBe('Delete a user from the system');
        expect(updateProfileCommand.summary).toBe('Update user profile details');

        // Verify subscription/event summaries from GraphQL descriptions
        expect(userCreatedEvent.summary).toBe('Subscribe to user creation events');
        expect(userUpdatedEvent.summary).toBe('Subscribe to user update events');
        expect(userDeletedEvent.summary).toBe('Triggered when a user is deleted');
      });

      it('falls back to default summary format when no GraphQL field description is provided', async () => {
        // Create a test schema without descriptions
        const schemaWithoutComments = `
          type Query {
            testQuery: String
          }

          type Mutation {
            testMutation: String
          }

          type Subscription {
            testSubscription: String
          }
        `;

        // Write test schema to a temporary file
        const tempSchemaPath = join(__dirname, 'temp-no-comments.graphql');
        await fs.writeFile(tempSchemaPath, schemaWithoutComments);

        const { getQuery, getCommand, getEvent } = utils(catalogDir);

        await plugin(config, {
          services: [
            {
              path: tempSchemaPath,
              id: 'test-service',
              version: '1.0.0',
              summary: 'Test service without comments',
              name: 'Test Service',
            },
          ],
        });

        const testQuery = await getQuery('testQuery');
        const testCommand = await getCommand('testMutation');
        const testEvent = await getEvent('testSubscription');

        // Verify fallback summaries
        expect(testQuery.summary).toBe('query operation: testQuery');
        expect(testCommand.summary).toBe('mutation operation: testMutation');
        expect(testEvent.summary).toBe('subscription operation: testSubscription');

        // Clean up temp file
        await fs.unlink(tempSchemaPath);
      });
    });
  });
});
