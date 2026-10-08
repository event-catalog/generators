# EventCatalog GraphQL Example

This is an example project for EventCatalog with the GraphQL generator plugin.

This example contains

- Using EventCatalog with many GraphQL Files
- Assigning GraphQL files to domains in the eventcatalog.config.js file

### Getting Started

1. Clone this project
1. Run `npm install`
1. Run the generators `npm run generate`
1. Run the catalog `npm run dev`
1. View your catalog at https://localhost:3000

### Features for GraphQL Plugin

- Auto versioning of domains, services and messages
- Document events, queries and commands using custom extensions to GraphQL
- Assign each route/message a version independent of your GraphQL version
- Visually see GraphQL files in your catalog.
- And much more...

To dive into how this plugin can help you, you can read the [GraphQL Plugin Docs](https://www.eventcatalog.dev/integrations/graphql).

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
