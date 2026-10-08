<div align="center">

<h1>⚡️ GraphQL generator for EventCatalog</h1>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-graphql/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![license](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/graphql.png?raw=true" />

<h4>Features: Generate EventCatalog with your GraphQL schemas, map to events, commands and queries, Auto versioning, schema downloads, map to domains,  and more... </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Document domains, services and messages from your GraphQL schema files ([example](https://github.com/event-catalog/generators/tree/main/examples/generator-graphql))
- 📊 Visualise your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your GraphQL schema files from EventCatalog ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your domains, services and messages
- ⭐ Document queries, mutations, and subscriptions from your GraphQL schema
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).
Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this GraphQL plugin you can connect your GraphQL schema files to your catalog. This is done by defining your generators in your `eventcatlaog.config.js` file.

```js
...
generators: [
    [
      '@eventcatalog/generator-graphql',
      {
        services: [
          {
            id: 'User Service',
            version: '1.0.0',
            name: 'User Service',
            // Path to your GraphQL schema file
            path: path.join(__dirname, 'graphql-schemas', 'user-service.graphql'),
          },
          {
            id: 'Order Service',
            version: '1.0.0',
            name: 'Order Service',
            // Path to your GraphQL schema file
            path: path.join(__dirname, 'graphql-schemas', 'order-service.graphql'),
          },
        ],
        // Maps the user service to the orders domain to the E-Commerce domain
        domain: { id: 'e-commerce', name: 'E-Commerce', version: '0.0.1' },
      },
    ],
  ],
...
```

In this example the generator will read the `user-service.graphql` and `order-service.graphql` files and populate services and messages inside your catalog. It will add the services to the domain `E-Commerce`.

You can see an example in the [eventcatalog-graphql-example](https://github.com/event-catalog/generators/tree/main/examples/generator-graphql) repo

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
@eventcatalog/generator-graphql
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/generators/tree/main/examples/generator-graphql/eventcatalog.config.js)

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

## Running the project locally

1. Clone the repo
1. Install required dependencies `pnpm i`
1. Run the examples `npx tsx examples/basic-graphql/index.ts`
1. Run tests `pnpm run test`

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
