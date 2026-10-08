# EventCatalog AWS Glue Registry - Basic Example

This example shows you how to pull and sync schemas from AWS Glue Registry into EventCatalog (without domains or services, just a direct map.)

This gives you the ability to add semantic meaning to your schemas, assign them to services and domains.

## Prerequisites

- AWS Account
- AWS Glue Registry

## Setup

1. Clone this example
1. Run `npm install`
1. Run the `scripts/create-test-registry.sh` script to create a test registry with a few schemas
    - This will create a test registry called `eventcatalog-test-registry` in the `us-east-1` region
    - It will also create a few schemas in the registry
1. Run the `npm run generate` command to generate EventCatalog from the registry
    - In the `eventcatalog.config.js` file we have configured to pull all schemas from the registry into EventCatalog.
1. After the generation has finished, Run the catalog `npm run dev`
1. View your catalog at http://localhost:3000

### Features of the Glue Registry Generator

- Import schemas into your EventCatalog
- Use filters to pick and choose which schemas to import
- Assign schemas to domains and services (producers and consumers).
- Automatically version your messages.
- Auto versioning of domains, services and messages
- Add semantic meaning to your schemas
- And much more...

To dive into how this plugin can help you, you can read the [Glue Registry Plugin Docs](https://www.eventcatalog.dev/integrations/aws-glue-registry)

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as [EventCatalog](https://github.com/event-catalog/eventcatalog/blob/main/LICENSE). Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
