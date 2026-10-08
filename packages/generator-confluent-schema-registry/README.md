<div align="center">

<h1>⚡️ Confluent Schema Registry generator for EventCatalog</h1>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-BUSL--1.1-blue)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/confluent.png?raw=true" />

<h4>Features: Generate EventCatalog from your Confluent Schema Registry. Sync your message schemas to services and domains, define topics and much more. </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Sync your message schemas to services and domains from your Confluent Schema Registry ([example](https://github.com/event-catalog/generators/tree/main/examples/generator-confluent-schema-registry))
- ⭐ Go beyond a schema registry. Add semantic meaning to your schemas, business logic and much more. Help you developers understand the message schemas and their relationships.
- 📊 Visualise services and topics in your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your message schemas from EventCatalog (e.g Avro, Protobuf, JSON) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your schemas in EventCatalog.
- ⭐ [Document your channels and protocols](https://www.eventcatalog.dev/docs/development/plugins/async-api/features#mapping-channels-into-eventcatalog)
- ⭐ [Document queries, commands and events with your AsyncAPI file using EventCatalog extensions](https://www.eventcatalog.dev/docs/development/plugins/async-api/features#mapping-messages-events-commands-or-queries)
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).

Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this Confluent Schema Registry plugin you can connect your schema registries to your catalog. You can map events and commands to your schemas and keep them in sync with your documentation. You can also define topics and visualize your architecture.

This is done by defining your generators in your `eventcatalog.config.js` file.

```js
...
generators: [
    // Basic example mapping schemas from confluent schema registry to services without any topics
    [
      '@eventcatalog/generator-confluent-schema-registry',
      {
        // The url of your Confluent Schema Registry
        schemaRegistryUrl: 'http://localhost:8081',
        services: [
          // Maps the exact schema names the service
          // In this example the Orders Service will publish the app.orders.created event and receive the app.orders.updated and app.orders.create commands
          { id: 'Orders Service', version: '1.0.0', sends: [{ events: ["app.orders.created"]}], receives:[{ events: ["app.orders.updated"]}, { commands: ["app.orders.create"]}] },
          // Filter by message (all messages that match the filter get assigned to the service). This example shows any event matching the topic
          { id: 'Inventory Service', version: '1.0.0', sends: [{ events: [{ prefix: "app.orders-"}]}], receives:[{ events: [{ suffix: "app.inventory-"}] }] },
          // Filter by message name (all messages that match the filter get assigned to the service). This example shows any event matching the topic
          { id: 'Payment Service', version: '1.0.0', sends: [{ events: [{ prefix: "app.orders-"}]}], receives:[{ events: [{ suffix: "app.inventory-" }] }] }
        ],
        // All the services are assigned to this domain
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // Example of mapping topics to services and domains
    [
      '@eventcatalog/generator-confluent-schema-registry',
      {
        // The url of your Confluent Schema Registry
        schemaRegistryUrl: 'http://localhost:8081',
        topics: [
          { id: 'orders', name: 'Orders Kafka Topic', address: 'broker1.example.com:9092' },
          { id: 'inventory', name: 'Inventory Kafka Topic', address: 'broker2.example.com:9092' },
        ],
        services: [
          // Maps the exact schema names the service
          // In this example the Orders Service will publish the app.orders.created event and receive the app.orders.updated and app.orders.create commands
          { id: 'Orders Service', version: '1.0.0', sends: [{ events: ["app.orders.created"], topic: 'orders' }], receives:[{ events: ["app.orders.updated"], topic: 'orders' }, { commands: ["app.orders.create"], topic: 'orders' }] },
          // Filter by message (all messages that match the filter get assigned to the service). This example shows any event matching the topic
          { id: 'Inventory Service', version: '1.0.0', sends: [{ events: [{ prefix: "app.orders-"}, { topic: 'inventory' }] }], receives:[{ events: [{ suffix: "app.inventory-"}] }] },
          // Filter by message name (all messages that match the filter get assigned to the service). This example shows any event matching the topic
          { id: 'Payment Service', version: '1.0.0', sends: [{ events: [{ prefix: "app.orders-"}, { topic: 'inventory' }] }], receives:[{ events: [{ suffix: "app.inventory-" }] }] }
        ],
        // All the services are assigned to this domain
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // This example saves all messages (schemas) from the registry to EventCatalog without mapping to services or domains
    [
      '@eventcatalog/generator-confluent-schema-registry',
      {
        // The url of your Confluent Schema Registry
        schemaRegistryUrl: 'http://localhost:8081',
      },
    ],
  ],
...

```

In the example above we have three types of usecases for the generator:

1. Map schemas to events/commands and assign them to producers and consumers (services). Group services into a domain or subdomain.
1. Same as number 1, but we also create topics in EventCatalog (channels) and document them.
1. Example number 3, we dont' assign any schemas to services or topics. We just add all schemas to EventCatalog regardless of the service or domain.

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
@eventcatalog/generator-confluent-schema-registry
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/generators/tree/main/examples/generator-confluent-schema-registry/blob/main/eventcatalog.config.js)

3. Set credentials for your Confluent Schema Registry. Create a `.env` file in the root of your project and add the following:

```sh
# From Confluent Schema Registry
CONFLUENT_SCHEMA_REGISTRY_KEY=
CONFLUENT_SCHEMA_REGISTRY_SECRET=
```

4. Run the generate command

```sh
npm run generate
```

5. See your new domains, services and messages, run

```sh
npm run dev
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

This generator is source-available under the [Business Source License 1.1](../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
