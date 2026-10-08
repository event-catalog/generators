<div align="center">

<h1>🗃️ AWS Glue Schema Registry generator for EventCatalog</h1>
<p>Bring discoverability to your event-driven architectures with the AWS Glue Schema Registry plugin for EventCatalog</p>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-glue/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-BUSL--1.1-blue)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/glue.png?raw=true" />

<h4>Features: Generate EventCatalogs with your AWS Glue Schema Registry, Auto versioning, schema downloads, visualize your event-driven architectures, map schemas to domains and more... </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Document domains, services and event schemas from your AWS Glue Schema Registry
- Sync your schemas to EventCatalog with auto versioning from AWS Glue Schema Registry
- Map your schemas to your domains and services, and filter schemas using multiple criteria
- 📊 Visualise your event-driven architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your event schemas from EventCatalog (Avro, JSON Schema, Protocol Buffers) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your domains, services and events
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- 🔗 Direct links to AWS Glue console for schema management
- 🏷️ Support for schema evolution, compatibility modes, and metadata
- 📋 Support for multiple schema formats: Avro, JSON Schema, and Protocol Buffers
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).
Generators are scripts run during pre-build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this AWS Glue Schema Registry plugin you can connect your Glue Schema Registry to your catalog. You can map your schemas to your domains and services and also filter (prefix, suffix, exact matching, data format filtering) for your schemas.

This is done by defining your generators in your `eventcatalog.config.js` file.

```js
...
generators: [
    [
      '@eventcatalog/generator-aws-glue',
      {
        region: 'us-east-1',
        registryName: 'my-event-registry',
        services: [
          // Maps exact schemas to the service
          { id: 'Orders Service', version: '1.0.0', sends: [{ schemaName: ['OrderCreated', 'OrderUpdated'] }], receives: [{ schemaName: 'InventoryUpdated' }] },
          // Filter by schema name prefix (all schemas that match the prefix get assigned). This example shows any schema matching the prefix
          // "Customer" will be assigned to the customer service. The customer service will publish these schemas.
          { id: 'Customer Service', version: '1.0.0', sends: [{ prefix: "Customer" }], receives: [{ suffix: "Event" }] },
          // This service sends schemas that match certain data formats, and will receive schemas with specific tags
          { id: 'Analytics Service', version: '1.0.0', sends: [{ dataFormat: "AVRO" }], receives: [{ tags: { "team": "analytics" } }] }
        ],
        domain: { id: 'ecommerce', name: 'E-commerce', version: '1.0.0' },
      },
    ],
    // Example of saving all schemas directly into EventCatalog without services or domains
    // All schemas in registry will be added to the Catalog.
    [
      '@eventcatalog/generator-aws-glue',
      {
        region: 'us-east-1',
        registryName: 'central-event-registry'
      },
    ],
    // Example using registry ARN and credentials
    [
      '@eventcatalog/generator-aws-glue',
      {
        region: 'us-east-1',
        registryName: 'shared-registry',
        registryArn: 'arn:aws:glue:us-east-1:123456789012:registry/shared-registry',
        credentials: {
          accessKeyId: 'X',
          secretAccessKey: 'X',
        },
      },
    ],
  ],
...
```

In this example we have multiple use cases for the generator:

1. Map schemas to services and domains using custom filters.
2. Add all schemas to EventCatalog regardless of the service or domain.
3. Use cross-account registry access with registryArn.

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
npm install @eventcatalog/generator-aws-glue
```

2. Configure your `eventcatalog.config.js` file

3. Run the generate command

```sh
npm run generate
```

4. See your new domains, services and messages, run

```sh
npm run dev
```

# Configuration Options

## Required Options

- `region` (string): AWS region where your Glue Schema Registry is located
- `registryName` (string): Name of the Glue Schema Registry to scan for schemas

## Optional Options

- `registryArn` (string): ARN of the Schema Registry (for cross-account access)
- `services` (array): Map schemas to specific services using filters
- `domain` (object): Optional domain to group your services under
- `credentials` (object): AWS credential override (accessKeyId, secretAccessKey)
- `writeFilesToRoot` (boolean): Write files to root instead of domain/service folders
- `format` ('md' | 'mdx'): Output format for generated files

## Service Configuration

Each service can define `sends` and `receives` arrays with filter objects:

### Filter Options

- `schemaName`: Exact schema name(s) to match
- `prefix`: Schemas starting with this prefix
- `suffix`: Schemas ending with this suffix
- `includes`: Schemas containing this substring
- `dataFormat`: Schemas with specific format (AVRO, JSON, PROTOBUF)
- `registryName`: Filter by specific registry name
- `tags`: Object with key-value pairs that must match schema tags

### Example Service Configuration

```js
{
  id: 'Event Processing Service',
  version: '1.0.0',
  sends: [
    { prefix: 'Order' },                // Schemas starting with 'Order'
    { dataFormat: 'AVRO' },            // All Avro schemas
    { schemaName: ['UserEvent'] }      // Specific schema
  ],
  receives: [
    { suffix: 'Command' },              // Schemas ending with 'Command'
    { tags: { source: 'kafka' } },     // Schemas tagged with source=kafka
    { includes: 'Customer' }            // Schemas containing 'Customer'
  ]
}
```

## Schema Formats

The generator supports three schema formats:

- **AVRO**: Apache Avro schemas (.avsc files)
- **JSON**: JSON Schema definitions (.json files)
- **PROTOBUF**: Protocol Buffer definitions (.proto files)

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

# Sponsors

Thank you to our project sponsors.

## Gold sponsors

<div align="center">
  <img alt="gravitee" src="../../images/sponsors/gravitee-logo-black.svg" width="50%" />
  <p style="margin: 0; padding: 0;">Manage, secure, and govern every API in your organization</p>
  <a href="https://gravitee.io?utm_source=eventcatalog&utm_medium=web&utm_campaign=sponsorship" target="_blank" >Learn more</a>
</div>

<hr />

<div align="center">
  <img alt="oso" src="../../images/sponsors/oso-logo-green.png" width="40%" />
  <p style="margin: 0; padding: 0;">Delivering Apache Kafka professional services to your business</p>
  <a href="https://oso.sh/?utm_source=eventcatalog&utm_medium=web&utm_campaign=sponsorship" target="_blank" >Learn more</a>
</div>

<hr />

_Sponsors help make EventCatalog sustainable, want to help the project? Get in touch! Or [visit our sponsor page](https://www.eventcatalog.dev/support)._

# Enterprise support

Interested in collaborating with us? Our offerings include dedicated support, priority assistance, feature development, custom integrations, and more.

Find more details on our [services page](https://eventcatalog.dev/services).

# Contributing

If you have any questions, features or issues please raise any issue or pull requests you like. We will try my best to get back to you.

You can find the [contributing guidelines here](https://eventcatalog.dev/docs/contributing/overview).

## Running the project locally

1. Clone the repo
1. Install required dependencies `pnpm i`
1. Run tests `pnpm run tests`

[license-badge]: https://img.shields.io/github/license/event-catalog/generators.svg?color=yellow
[license]: https://github.com/event-catalog/generators/blob/main/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[github-watch-badge]: https://img.shields.io/github/watchers/event-catalog/eventcatalog.svg?style=social
[github-watch]: https://github.com/event-catalog/eventcatalog/watchers
[github-star-badge]: https://img.shields.io/github/stars/event-catalog/eventcatalog.svg?style=social
[github-star]: https://github.com/event-catalog/eventcatalog/stargazers

# Licence

This generator is source-available under the [Business Source License 1.1](../../LICENSE), the same licence as [EventCatalog](https://github.com/event-catalog/eventcatalog/blob/main/LICENSE). Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
