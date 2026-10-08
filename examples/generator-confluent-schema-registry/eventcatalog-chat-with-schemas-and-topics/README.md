# EventCatalog Confluent Schema Registry Example: Chat with Schemas and Topics

This example shows you how to ingest events from [Confluent Schema Registry](https://www.confluent.io/product/confluent-schema-registry/) into EventCatalog and talk to them using AI, ask questions and bring your own prompts for your teams.

This demo shows how you can use the EventCatalog AI Chat to:

- Discover what events are relevant to a given feature
- Discover what services produce and consume a given event
- Discover what topics there are in your architecture

## Prerequisites

- Docker
- Confluent Schema Registry API Key (optional, for local development)
- OpenAPI Key

## Setup

To run this example you will need to:

1. Run Confluent Schema Registry Locally
1. Add schemas into your local registry
1. Run EventCatalog

### Running Confluent Schema Registry Locally

The Confluent platform can be run locally on your machine thanks to Docker. To start, you need to clone this repository and run the docker file, to get a Confluent Schema Registry running.

1. Clone this project
1. Navigate to `examples/generator-confluent-schema-registry/basic`

1. Run Confluent Schema Registry Locally

```bash
cd setup
docker-compose up -d
```

_You can test to make sure the registry is running by going to `http://localhost:8081/schemas` and seeing a list of subjects. An empty list should be shown for now._

4. Add schemas into your registry using the `generate-test-data.ts` script. 

```bash
npx ts-node setup/generate-test-data.ts
```

_This script will add a handful of schemas into your registry, and you should see them when you go to `http://localhost:8081/schemas`._

### Running EventCatalog

Once you have the Confluent Schema Registry running, and you added the schemas into your registry, you can run EventCatalog.


1. Configure your `.env` file, copy the `.env-example` file to `.env` and set the environment variables.
1. Run `npm install`

2. Generate the catalog from the schema registry

```bash
npm run generate
```

3. Run the catalog locally

```bash
npm run dev
```

You can then view your catalog at http://localhost:3000

This generator is licensed under the [MIT licence](../../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
