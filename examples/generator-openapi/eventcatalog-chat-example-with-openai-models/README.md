# EventCatalog OpenAPI Example with EventCatalog Chat (OpenAI models)

This is an example project for EventCatalog with the OpenAPI generator plugin.

This example contains

- Using EventCatalog with many OpenAPI Files
- Assigning OpenAPI files to domains in the eventcatalog.config.js file
- Chat with your OpenAPI files using OpenAI models (you can choose from a list of models)

# Prerequisites

- Node.js 18+
- EventCatalog Starter Plan (get 14 day free trial at https://eventcatalog.cloud)

### Getting Started

1. Clone this project
1. Run `npm install`
1. Create a `.env` file and add your EventCatalog license key and OpenAI API key (14 day free trial keys from [EventCatalog Cloud](https://eventcatalog.cloud))
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




