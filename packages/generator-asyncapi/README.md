<div align="center">

<h1>⚡️ AsyncAPI generator for EventCatalog</h1>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/asyncapi.jpeg?raw=true" />

<h4>Features: Generate EventCatalogs with your AsyncAPI files, Auto versioning, schema downloads, map to domains, custom AsyncAPI extensions and more... </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Document domains, services and messages from your AsyncAPI file ([example](https://github.com/event-catalog/generators/tree/main/examples/generator-asyncapi))
- 📊 Visualise your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- ⭐ Download your AsyncAPI files and message schemas form EventCatalog (e.g Avro, JSON) ([demo](https://demo.eventcatalog.dev/docs/events/InventoryAdjusted/0.0.4))
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your domains, services and messages
- ⭐ [Document your channels and protocols](https://www.eventcatalog.dev/docs/development/plugins/async-api/features#mapping-channels-into-eventcatalog)
- ⭐ [Document queries, commands and events with your AsyncAPI file using EventCatalog extensions](https://www.eventcatalog.dev/docs/development/plugins/async-api/features#mapping-messages-events-commands-or-queries)
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).
Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this AsyncAPI plugin you can connect your AsyncAPI files to your catalog. This is done by defining your generators in your `eventcatlaog.config.js` file.

```js
...
generators: [
    [
      '@eventcatalog/generator-asyncapi',
      {
        services: [
          { path: path.join(__dirname, 'asyncapi-files', 'orders-service.asyncapi.yml'), id: 'Orders Service'},
          { path: path.join(__dirname, 'asyncapi-files', 'accounts-service.asyncapi.yml'), id: 'Accounts Service', name: 'Awesome Accounts Service')},
          // Fetch AsyncAPI file from an external URL
          { path: "https://raw.githubusercontent.com/event-catalog/generator-asyncapi/refs/heads/main/src/test/asyncapi-files/simple.asyncapi.yml", id: 'Payment Service', name: 'Payment Service')}
        ],
        domain: { id: 'orders', name: 'Orders', version: '0.0.1' },
      },
    ],
  ],
...
```

In this example the generator will read the `orders-service.asyncapi.yml` file and also fetch AsyncAPI files from an external URL and populate services and messages inside your catalog. It will add the services to the domain `Orders`.

You can see an example in the [eventcatalog-asyncapi-example](https://github.com/event-catalog/generators/tree/main/examples/generator-asyncapi/blob/main/eventcatalog.config.js) repo

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
@eventcatalog/generator-asyncapi
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/generators/tree/main/examples/generator-asyncapi/blob/main/eventcatalog.config.js)

3. Run the generate command

```sh
npm run generate
```

4. See your new domains, services and messages, run

```sh
npm run dev
```

### Proxy Server setup

Configure environment variable `PROXY_SERVER_URI` to use a proxy server.
You can define proxy settings in URI format example below:

You can also put the variable in the `.env` file.

```sh
PROXY_SERVER_URI="http://username:password@your-proxy.company.local" npm run generate
```

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

## Running the project locally

1. Clone the repo
1. Install required dependencies `pnpm i`
1. Run the examples `npx tsx examples/streelights-mqtt/index.ts
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

This generator is licensed under the [MIT licence](../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
