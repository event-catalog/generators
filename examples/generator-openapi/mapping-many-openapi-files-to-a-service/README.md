# EventCatalog OpenAPI Example: Mapping many OpenAPI files to a service

In this example we map many OpenAPI specification files to a single service (orders service).

This pattern can be useful when you have a single service that is versioned and you want to map many OpenAPI specification files to it.

For example, your service many expose many versions to your users, but you represent these in different OpenAPI specification files.

This example: 

- Processed many OpenAPI specification files and mapped them to a single service
- The latest version of the specification files is the root spec that is used.
- Any previous versions of the specification files are stored in the `versioned` folder.

### Getting Started

1. Clone this project
1. Run `npm install`
1. Run the generators `npm run generate`
1. Run the catalog `npm run dev`
1. View your catalog at https://localhost:3000

To dive into how this plugin can help you, you can read the [OpenAPI Plugin Docs](https://www.eventcatalog.dev/integrations/openapi)

This generator is licensed under the [MIT licence](../../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
