<div align="center">

<h1>⚡️ GitHub Generator for EventCatalog</h1>
<p>Pull and sync your schemas (e.g Avro, Protobuf, JSON) from GitHub to EventCatalog</p>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![blog](https://img.shields.io/badge/license-Dual--License-brightgreen)](https://github.com/event-catalog/generator-asyncapi/blob/main/LICENSE.md)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/github-generator.png?raw=true" />

<h4>Features: Sync your schemas from GitHub to EventCatalog. Keep schemas in sync with your producers and consumers documentation, attach them to domains, assign owners to your schemas and much more. </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Pull and sync your schemas from your GitHub repository to EventCatalog
- 📃 Keep your schemas in sync with your producers and consumers documentation
- 📃 Supports any schema format (e.g Avro, Protobuf, JSON)
- 📃 Import all schemas, or specific folders/files
- ⭐ **Go beyond a schema.** Add semantic meaning to your schemas, business logic and much more. Help your developers and teams understand the meaning behind the schemas with clear documentation and visualisations.
- 📊 Visualise producers and consumers in your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download synced schemas from EventCatalog (e.g Avro, Protobuf, JSON) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 📃 Assign schemas to **events**, **commands** and **queries**
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).

Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

Many teams keep there schemas in GitHub. This is great as it allows you to version control your schemas and follow best practices (e.g pull requests, code reviews, etc).

Using this plugin you can pull your schemas from any GitHub repository and keep them in sync with your documentation. This let's you document your schemas, and architecture whilst keeping your schemas in your documentation up to date.

This is done by defining your generators in your `eventcatalog.config.js` file.

```js
...
generators: [
    // Basic example mapping schemas from confluent schema registry to services without any topics
    [
      '@eventcatalog/generator-github',
      {
        // The GitHub repository to pull the schemas from
        repo: 'event-catalog/eventcatalog',
        // The path to the folder containing the schemas
        path: 'examples/default',
        // Here we define the services, we want to map the schemas to (producers/consumer relationships)
        services: [
          {
            id: 'Inventory Service',
            version: '1.0.0',
            sends: [{
              id: 'app.orders.created',
              version: '1.0.0', // optional, defaults to latest
              type: 'event', // event, command or query
              //  The path in your github repository to the schema
              schemaPath: 'domains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
            }],
            receives:[{
              id: 'app.orders.updated',
              version: '1.0.0', // optional, defaults to latest
              type: 'command', // command, query or event
              //  The path in your github repository to the schema
              schemaPath: 'domains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
            }]
          },
        ],
        // All the services are assigned to this domain (optional)
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
    // Example of just mapping schemas to events, commands and queries (without services or domains)
    [
      '@eventcatalog/generator-github',
      {
        // The url of your Confluent Schema Registry
        repo: 'event-catalog/eventcatalog',
        path: 'examples/default',
        messages: [
          {
            id: 'app.orders.created',
            version: '1.0.0',
            type: 'event',
            // The path in your github repository to the schema
            schemaPath: 'domains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
          },
          {
            id: 'app.orders.updated',
            version: '1.0.0',
            type: 'command',
            schemaPath: 'domains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
          },
          {
            id: 'app.orders.create',
            version: '1.0.0',
            type: 'query',
            schemaPath: 'domains/Orders/services/InventoryService/events/InventoryAdjusted/schema.avro',
          },
        ],
      },
    ]
  ],
...

```

In the example above we have two types of usecases for the generator:

1. Map schemas from GitHub to Services (producers/consumers), if services or messages do not exist in EventCatalog they are created, the schema is always kept in sync.
1. We don't map any schemas to services or domains, we just map schemas to events, commands and queries, we prefer to map things ourself in our EventCatalog.

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
npm i @eventcatalog/generator-github
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/generators/tree/main/examples/generator-github/blob/main/eventcatalog.config.js)

3. Set credentials for your GitHub. Create a `.env` file in the root of your project and add the following:

**The machine you are running the generator on needs to have access to the GitHub repository**.

```sh
# From eventcatalog.cloud (14 day free trial)
EVENTCATALOG_LICENSE_KEY_GITHUB=
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

[license-badge]: https://img.shields.io/github/license/event-catalog/eventcatalog.svg?color=yellow
[license]: https://github.com/event-catalog/eventcatalog/blob/main/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[github-watch-badge]: https://img.shields.io/github/watchers/event-catalog/eventcatalog.svg?style=social
[github-watch]: https://github.com/event-catalog/eventcatalog/watchers
[github-star-badge]: https://img.shields.io/github/stars/event-catalog/eventcatalog.svg?style=social
[github-star]: https://github.com/event-catalog/eventcatalog/stargazers

# Commercial Use

This generator requires a license to be used with EventCatalog. You can get a 14 day free trial at https://eventcatalog.cloud or email us at `hello@eventcatalog.dev`.
