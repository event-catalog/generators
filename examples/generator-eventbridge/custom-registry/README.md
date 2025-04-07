# EventCatalog EventBridge Example - Custom Registry

This example shows you how to ingest events from EventBridge into EventCatalog using a custom registry.

EventBridge Schema Registry lets you define your own registry and upload schemas into it. 

This example shows you how to connect to that schema registry and import the schemas into EventCatalog.

## Prerequisites

- AWS Account

## Setup

1. Clone this project
1. Run `npm install`
1. Get a EventCatalog license key from [EventCatalog](https://eventcatalog.cloud) (14 day free trial)
1. Run the init.sh script to create a custom schema registry in EventBridge
1. Run the upload-schemas.sh script to upload the schemas to the custom schema registry
1. Run the `npm run generate` command to generate EventCatalog from EventBridge (events mapped to schemas in eventcatalog.config.js)
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




