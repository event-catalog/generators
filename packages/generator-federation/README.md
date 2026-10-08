<div align="center">

<h1>⚡️ EventCatalog Federation: Merging multiple catalogs into one</h1>
<p>Keep your documentation close to your teams and code, use this generator to merge multiple catalogs into one master catalog.  </p>

[![PRs Welcome][prs-badge]][prs]
<img src="https://img.shields.io/github/actions/workflow/status/event-catalog/generator-asyncapi/verify-build.yml"/>
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/3rjaZMmrAm?style=flat)](https://discord.gg/3rjaZMmrAm) [<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/david-boyne/) [![license](https://img.shields.io/badge/license-MIT-brightgreen)](https://github.com/event-catalog/generators/blob/main/LICENSE)

<img alt="header" src="https://github.com/event-catalog/generators/blob/main/images/federation.png?raw=true" />

<h4>Features: Merge multiple catalogs into one, teams own their own catalogs, supports any git repo (e.g GitHub, GitLab, Bitbucket) </h4>

[Read the Docs](https://eventcatalog.dev/) | [Edit the Docs](https://github.com/event-catalog/docs) | [View Demo](https://demo.eventcatalog.dev/docs)

</div>

<hr/>

# Core Features

- 🕋 Federation for EventCatalog. Merge many catalogs into one master catalog
- 🧑🏻‍💻 Let your teams control their own catalogs, and merge them into a master catalog
- ⚡️ Git based generator, supports any git repo (e.g GitHub, GitLab, Bitbucket)
- Specify the git repo, it's branch and the files you want to merge into your master catalog
- ✅ Configuration to override files and ensure all files in the catalog are unique

# How it works

[EventCatalog](https://www.eventcatalog.dev/) is technology agnostic, meaning it can integrate with any schemas, specs or brokers.

EventCatalog supports [generators](https://www.eventcatalog.dev/docs/development/plugins/generators).
Generators are scripts are run to pre build to generate content in your catalog. Generators can use the [EventCatalog SDK](https://www.eventcatalog.dev/docs/sdk).

With this git generator you can connect to many git repos, and merge them into a master catalog.

This let's your teams control their own catalogs, and merge them into a master catalog, keeping the documentation close to the their code.

```js
...
generators: [
    [
      '@eventcatalogtest/generator-federation',
      {
        // The git repo to clone
        source: 'https://github.com/event-catalog/eventcatalog.git',

        // The branch to clone, defaults to main
        branch: 'main',

        // Array of copy configurations - specify what content to copy and where to put it
        copy: [
          {
            // The content to clone, this can be a single file or an array of files
            content: ['/domains'],
            // The destination to clone the content to
            destination: path.join(catalogDir, 'domains'),
          },
          {
            // You can have multiple copy configurations
            content: '/services',
            destination: path.join(catalogDir, 'services'),
          }
        ],

        // Optional: Override existing files (default: false)
        override: false,

        // Optional: Ensure all resources have unique IDs (default: false)
        enforceUniqueResources: false,
      },
    ],
  ],
...
```

In this example we are:

1. Cloning "domains" from the git repo and merging them into the catalog's domains directory
2. Cloning "services" and merging them into the catalog's services directory

When merging many repositories you can use the `override` option to override files in the catalog.
You can also use the `enforceUniqueResources` option to ensure all resources in the catalog are unique (to help with naming conflicts).

# Getting started

## Installation and configuration

_Make sure you are on the latest version of EventCatalog_.

1. Install the package

```sh
@eventcatalog/generator-federation
```

2. Configure your `eventcatalog.config.js` file [(see example)](https://github.com/event-catalog/eventcatalog-openapi-example/blob/main/eventcatalog.config.js)

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
