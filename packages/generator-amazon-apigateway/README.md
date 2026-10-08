<div align="center">

<h1>⚡️ Amazon API Gateway generator for EventCatalog</h1>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![blog](https://img.shields.io/badge/blog-EDA--Visuals-brightgreen)](https://eda-visuals.boyney.io/?utm_source=event-catalog-gihub) [![license](https://img.shields.io/badge/license-BUSL--1.1-blue)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/amazon-apigateway.png?raw=true" />

<h4>Features: Generate EventCatalogs with your Amazon API Gateway OpenAPI files, Map routes to commands, queries and events, Auto versioning of your domains, services and messages, Add Semantic meanings to your APIS</h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 📃 Document domains, services and messages from your APIs
- 📊 Visualise your architecture ([demo](https://demo.eventcatalog.dev/visualiser))
- View your OpenAPI files in EventCatalog and download schemas
- 💅 Custom MDX components ([read more](https://eventcatalog.dev/docs/development/components/using-components))
- 🗄️ Auto versioning of your domains, services and messages
- ⭐ Map routes to commands, queries and events in EventCatalog
- ⭐ Discoverability feature (search, filter and more) ([demo](https://demo.eventcatalog.dev/discover/events))
- ⭐ And much more...

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

The generator requires the [OpenAPI Generator](https://github.com/event-catalog/generators/tree/main/packages/generator-openapi).

1. Install the Amazon API Gateway Generator
2. Configure your generator in your `eventcatalog.config.js` file.
3. This will turn your API Gateway OpenAPI speciifcation files into EventCatalog ready files.
4. Install the OpenAPI Generator
5. Configure the OpenAPI generator to read and process files from your output of Amazon API Gateway Generator.
6. View your APIs, messages, services and domains in EventCatalog.

### Example

This example:

1. Downloads the `Store API` from Amazon API Gateway
1. Hydrates the OpenAPI file with EventCatalog extensions
1. Outputs the generated OpenAPI files to `amazon-apigateway-specs`

1. Runs the OpenAPI generator
1. Processes the generated OpenAPI files into EventCatalog

```js
...
generators: [
    [
      '@eventcatalogtest/generator-amazon-apigateway',
      {
        output: 'amazon-apigateway-specs',
        apis: [
          {
            name: 'Store API',
            region: 'us-east-1',
            stageName: 'prod',
            routes: {
              'post /users': {
                type: 'command',
              }
            }
          }
        ]
      },
    ],
    [
      '@eventcatalogtest/generator-openapi',
      {
        services: [
          { path: [path.join(__dirname, 'amazon-apigateway-specs', 'Store API.json'), id: 'store' },
        ],
        domain: { id: 'Shopping Cart', name: 'Shopping Cart', version: '0.0.1' },
      },
    ],
  ],
...
```

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the packages

```sh
@eventcatalog/generator-amazon-apigateway
@eventcatalog/generator-openapi
```

2. Configure your `eventcatalog.config.js` file

- First configure the API Gateway Geneartor
- Then configure the OpenAPI generator

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
