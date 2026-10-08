# EventCatalog OpenAPI Example with EventCatalog Chat (OpenAI models)

This is an example project for EventCatalog with the OpenAPI generator plugin.

This example contains

- Using EventCatalog with many OpenAPI Files
- Assigning OpenAPI files to domains in the eventcatalog.config.js file
- Chat with your OpenAPI files using OpenAI models (you can choose from a list of models)

# Prerequisites

- Node.js 18+

### Getting Started

1. Clone this project
1. Run `npm install`
1. Add your OpenAI API key to a `.env` file
1. Run the generators `npm run generate`
1. Run the catalog `npm run dev`
1. View your catalog at http://localhost:3000
1. Chat with your architecture (powered by your OpenAPI files) at http://localhost:3000/chat

### Features for OpenAPI Plugin

- Auto versioning of domains, services and messages
- Document events, queries and commands using custom extensions to OpenAPI
- Assign each route/message a version independent of your OpenAPI version
- Visually see OpenAPI files in your catalog.
- And much more...

To dive into how this plugin can help you, you can read the [OpenAPI Plugin Docs](https://www.eventcatalog.dev/integrations/openapi)

This generator is licensed under the [MIT licence](../../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
