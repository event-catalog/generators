<div align="center">

<h1>⚡️ Apicurio Registry generator for EventCatalog</h1>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/apicurio.png?raw=true" />

<h4>Sync your schemas to your documentation, map to events, commands and queries, auto-versioning, schema downloads, map to domains, and more...</h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Sync your message schemas to services and domains from your Apicurio Registry
- ⭐ Go beyond a schema registry. Add semantic meaning to your schemas, business logic and much more. Help your developers understand the message schemas and their relationships.
- 📊 Visualise services and messages in your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your message schemas from EventCatalog (e.g Avro, Protobuf, JSON) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your schemas in EventCatalog
- ⭐ Attach OpenAPI and AsyncAPI specifications to services and auto-generate message documentation
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ Support for Apicurio Registry V2 and V3
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).

Generators are scripts that run pre-build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this Apicurio Registry plugin you can connect your schema registries to your catalog. You can map events and commands to your schemas and keep them in sync with your documentation.

This is done by defining your generators in your `eventcatalog.config.js` file.

```js
...
generators: [
    // Basic example mapping schemas from Apicurio Registry to services
    [
      '@eventcatalog/generator-apicurio',
      {
        // The URL of your Apicurio Registry
        registryUrl: 'http://localhost:8080/apis/registry/v2',
        services: [
          // Maps the exact artifact IDs to the service
          // In this example the Orders Service will publish the order-created event and receive the order-updated event
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ["order-created"] }],
            receives: [{ events: ["order-updated"] }]
          },
          // Filter by message name using prefix/suffix
          {
            id: 'Inventory Service',
            version: '1.0.0',
            sends: [{ events: [{ prefix: "inventory-" }] }],
            receives: [{ events: [{ suffix: "-updated" }] }]
          },
        ],
        // All the services are assigned to this domain
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // Example with OpenAPI and AsyncAPI specifications attached to services
    [
      '@eventcatalog/generator-apicurio',
      {
        registryUrl: 'http://localhost:8080/apis/registry/v2',
        services: [
          {
            id: 'Orders Service',
            version: '1.0.0',
            sends: [{ events: ["order-created"] }],
            // Attach specifications from Apicurio Registry
            specifications: [
              {
                type: 'openapi',
                artifactId: 'orders-service-openapi',
                // Optionally run a generator on the spec to create message documentation
                generator: ['@eventcatalog/generator-openapi', { debug: true }]
              },
              {
                type: 'asyncapi',
                artifactId: 'orders-service-asyncapi',
                generator: ['@eventcatalog/generator-asyncapi']
              }
            ]
          },
        ],
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // This example saves all schemas from the registry to EventCatalog without mapping to services or domains
    [
      '@eventcatalog/generator-apicurio',
      {
        registryUrl: 'http://localhost:8080/apis/registry/v2',
      },
    ],
    // Include all versions of schemas (not just the latest)
    [
      '@eventcatalog/generator-apicurio',
      {
        registryUrl: 'http://localhost:8080/apis/registry/v2',
        includeAllVersions: true,
      },
    ],
  ],
...

```

In the examples above we have different use cases for the generator:

1. Map schemas to events/commands and assign them to producers and consumers (services). Group services into a domain.
2. Attach OpenAPI and AsyncAPI specifications to services and optionally run generators to create message documentation.
3. Document all schemas from the registry without assigning them to services or domains.
4. Include all versions of schemas in EventCatalog, not just the latest.

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
npm install @eventcatalog/generator-apicurio
```

2. If you want to use OpenAPI or AsyncAPI generators with specifications, install them as well:

```sh
npm install @eventcatalog/generator-openapi @eventcatalog/generator-asyncapi
```

3. Configure your `eventcatalog.config.js` file

4. Run the generate command

```sh
npm run generate
```

5. See your new domains, services and messages, run

```sh
npm run dev
```

## Configuration Options

| Option               | Type        | Required | Description                                                                    |
| -------------------- | ----------- | -------- | ------------------------------------------------------------------------------ |
| `registryUrl`        | `string`    | Yes      | URL of the Apicurio Registry (e.g., `http://localhost:8080/apis/registry/v2`)  |
| `includeAllVersions` | `boolean`   | No       | Include all versions of schemas in the catalog (default: `false`, only latest) |
| `services`           | `Service[]` | No       | List of services to add to the catalog                                         |
| `domain`             | `Domain`    | No       | Domain to add to the catalog and attach services to                            |

### Service Configuration

| Option           | Type                     | Description                                            |
| ---------------- | ------------------------ | ------------------------------------------------------ |
| `id`             | `string`                 | Service identifier                                     |
| `name`           | `string`                 | Display name (defaults to id)                          |
| `version`        | `string`                 | Service version                                        |
| `sends`          | `Filter[]`               | Messages the service sends (events, commands, queries) |
| `receives`       | `Filter[]`               | Messages the service receives                          |
| `specifications` | `ServiceSpecification[]` | OpenAPI/AsyncAPI specs to attach                       |
| `summary`        | `string`                 | Service summary                                        |

### Filter Criteria

Filters support multiple matching strategies:

```js
// Exact match
sends: [{ events: ['order-created', 'order-updated'] }];

// Prefix match
sends: [{ events: [{ prefix: 'order-' }] }];

// Suffix match
receives: [{ events: [{ suffix: '-created' }] }];

// Contains match
receives: [{ events: [{ includes: 'order' }] }];
```

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

[license-badge]: https://img.shields.io/github/license/event-catalog/generators.svg?color=yellow
[license]: https://github.com/event-catalog/generators/blob/main/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[github-watch-badge]: https://img.shields.io/github/watchers/event-catalog/eventcatalog.svg?style=social
[github-watch]: https://github.com/event-catalog/eventcatalog/watchers
[github-star-badge]: https://img.shields.io/github/stars/event-catalog/eventcatalog.svg?style=social
[github-star]: https://github.com/event-catalog/eventcatalog/stargazers

# Licence

This generator is licensed under the [MIT licence](../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
