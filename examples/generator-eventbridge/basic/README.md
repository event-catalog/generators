# EventCatalog EventBridge Example

This example shows you how to ingest events from EventBridge into EventCatalog.
With [schema discovery enabled](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema-registry.html), you can discover schemas in your event bus and import them into EventCatalog.

This gives you the ability to add semantic meaning to your events in EventBridge, assign them to services and domains.

## Prerequisites

- AWS Account

## Setup

1. Clone this project
1. Run `npm install`
1. Run the init.sh script to create the EventBridge bus and start the schema discovery
1. Run the send-events.sh script to send events to EventBridge
1. Wait 5 minutes for the schemas to be discovered (AWS takes a while to discover the schemas)
1. Run the `npm run generate` command to generate EventCatalog from EventBridge
1. Run the catalog `npm run dev`
1. View your catalog at http://localhost:3000

### Features of the EventBridge Generator

- Add semantic meaning to your schemas
    - Import schemas, and add markdown to them. Between builds the markdown will be persisted.
    - This allows you to add documentation to your schemas and give them business meaning
- Document your event bus as a channel
    - View all messages going through your event bus
- Map events from EventBridge to domains, services and messages
- Downloads schemas directly into EventCatalog
- Use filters to only parse certain events you want.
- Auto versioning of domains, services and messages
- And much more...

To dive into how this plugin can help you, you can read the [EventBridge Plugin Docs](https://www.eventcatalog.dev/integrations/amazon-eventbridge)

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
