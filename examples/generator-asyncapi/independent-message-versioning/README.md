# EventCatalog AsyncAPI Example - Independent Message Versioning

This example shows you how you can use the `x-eventcatalog-message-version` extension to assign a version to each message in your AsyncAPI file.

By default EventCatalog will use the version of your AsyncAPI file for all messages in that specification. 

If you prefer to assign a version to each message, you can use the `x-eventcatalog-message-version` extension.

This example contains:

- Assigning a version to each message in an AsyncAPI file
- Using EventCatalog with many AsyncAPI Files
- Mapping AsyncAPI files to domains in the eventcatalog.config.js file

### Getting Started

1. Clone this project
1. Run `npm install`
1. Run the generators `npm run generate`
1. Run the catalog `npm run dev`
1. View your catalog at https://localhost:3000

### Features for OpenAPI Plugin

- Auto versioning of domains, services and messages
- Document events, queries and commands using custom extensions to AsyncAPI
- Assign each route/message a version independent of your AsyncAPI version
- Visually see AsyncAPI files in your catalog.
- And much more...

To dive into how this plugin can help you, you can read the [AsyncAPI Plugin Docs](https://www.eventcatalog.dev/integrations/asyncapi)

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
