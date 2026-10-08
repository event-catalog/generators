<div align="center">

<h1>⚡️ Amazon EventBridge generator for EventCatalog</h1>
<p>Bring discoverability to teams with the Amazon EventBridge plugin for EventCatalog</p>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-eventbridge/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-BUSL--1.1-blue)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/eventbridge.png?raw=true" />

<h4>Features: Generate EventCatalogs with your EventBridge schema registries, Auto versioning, download schema downloads, open AWS console directly from your catalogs, map to domains and more... </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Document domains, services and messages from your Amazon EventBridge schema registries ([example](https://github.com/event-catalog/eventcatalog-eventbridge-example))
- 📊 Visualise your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your event schemas from EventCatalog (e.g JSONDraft, OpenAPI) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your domains, services and events
- 🗄️ Matches versioning from your EventBridge registry
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).
Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this EventBridge plugin you can connect your schema registries to your catalog. You can map your events to your domains and services and also filter (suffix, prefix, exact matching, source filtering) for your events.

This is done by defining your generators in your `eventcatlaog.config.js` file.

```js
...
generators: [
    [
      '@eventcatalog/generator-eventbridge',
      {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        services: [
          // Maps exact events to the service
          { id: 'Orders Service', version: '1.0.0', sends: [{ detailType: ['OrderPlaced', 'OrderUpdated'], receives:["InventoryAdjusted"]}] },
          // Filter by source (all events that match the source get assigned). This example shows any event matching the source
          // "myapp.orders" will be assigned to the inventory service. The inventory service will publish these events.
          { id: 'Inventory Service', version: '1.0.0', sends: [{ source: "myapp.orders"}], receives:[{ detailType: "UserCheckedOut"}] },
          // This service sends events that match the SchemaName prefixing myapp, and will receive events that end with Payment
          { id: 'Payment Service', version: '1.0.0', sends: [{ prefix: "myapp"}], receives:[{ suffix: "Payment" }] }
        ],
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // Example of saving all messages directly into EventCatalog without services or domains
    // All events in registry will be added to the Catalog.
    [
      '@eventcatalog/generator-eventbridge',
      {
        region: 'us-east-1',
        registryName: 'discovered-schemas'
      },
    ],
    // Example using optional credentials
    [
      '@eventcatalog/generator-eventbridge',
      {
        region: 'us-east-1',
        registryName: 'discovered-schemas',
        credentials: {
          accessKeyId: 'X',
          secretAccessKey: 'X',
          accountId: 'X',
        },
      },
    ],
  ],
...
```

In this example we have two types of usecases for the generator:

1. Map events to services and domains using custom filters.
2. Add all events to EventCatalog regardless of the service or domain.

You can see an example in the [eventcatalog-eventbridge-example](https://github.com/event-catalog/eventcatalog-eventbridge-example/blob/main/eventcatalog.config.js) repo

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
@eventcatalog/generator-eventbridge
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/eventcatalog-eventbridge-example/blob/main/eventcatalog.config.js)

3. Run the generate command

```sh
npm run generate
```

4. See your new domains, services and messages, run

```sh
npm run dev
```

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
