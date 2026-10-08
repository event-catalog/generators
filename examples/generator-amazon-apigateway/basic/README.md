# EventCatalog Amazon API Gateway Example

This example documents APIS from Amazon API Gateway and maps them into services and messages in EventCatalog.

![EventCatalog Amazon API Gateway Example](../../../images/amazon-apigateway.png)

This example contains:

- Using the Amazon API Gateway generator to fetch OpenAPI files from AWS
- Assign owners to the APIs (services and messages)
- Using the OpenAPI generator to process the information into EventCatalog
- Assigning the APIs to Services and Domains in EventCatalog

### Getting Started

1. Clone this project
1. Deploy the demo API to AWS in the `/backend` folder
  - Go to the `backend` folder and run `npm install`
  - Then run `npm run build && cdk deploy`
  - This will create a basic API in your AWS account that this demo will use.
1. Go back to the root of this project and run `npm install`
1. Run the generators `npm run generate`
1. Run the catalog `npm run dev`
1. View your catalog at https://localhost:3000

### How the generator can help you

1. Document your APIs directly into EventCatalog
1. Assign owners to APIs
1. Assign routes to commands, queries and events
1. See the relationships between APIs, services and domains with the visualizer
1. Assign APIS to services and domains in your organization
1. Let your developers and teams quickly find APIS, how they work and who owns them.

### Features for Amazon API Gateway Plugin

- Map your routes into events, queries and commands
- Document events, queries and commands using custom extensions to OpenAPI
- Assign each route/message a version independent of your OpenAPI version
- Visually see OpenAPI files in your catalog.
- And much more...

To dive into how this plugin can help you, you can read the [Amazon API Gateway Plugin Docs](https://www.eventcatalog.dev/integrations/amazon-apigateway)

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
