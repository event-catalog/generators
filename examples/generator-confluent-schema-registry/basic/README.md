# EventCatalog Confluent Schema Registry Example

This example shows you how to ingest events from [Confluent Schema Registry](https://www.confluent.io/product/confluent-schema-registry/) into EventCatalog.

This gives you the ability to add semantic meaning to your schemas in Confluent Schema Registry, assign them to topics, services and domains.

Get control over your Kafka topics and schemas, and add documentation to them for discoverability and governance.

### Features of the Confluent Schema Registry Generator

- Add semantic meaning to your schemas
    - Import schemas, and add markdown to them. Between builds the markdown will be persisted.
    - This allows you to add documentation to your schemas and give them business meaning
- Assign schemas to topics, services and domains
- Assign ownership to your schemas
- Visualize your messages, topics, services and domains in a graph
- Assign your schemas as commands or events in EventCatalog.
- Downloads schemas directly from EventCatalog
- Use filters to only parse certain messages you want.
- Sync your schemas from Confluent Schema Registry to EventCatalog
- And much more...

To dive into how this plugin can help you, you can read the [Confluent Schema Registry Plugin Docs](https://www.eventcatalog.dev/integrations/confluent-schema-registry)

## Prerequisites

- Docker
- Confluent Schema Registry API Key (optional, for local development)


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


1. Run `npm install`
1. Generate the catalog from the schema registry

```bash
npm run generate
```

1. Run the catalog locally

```bash
npm run dev
```

You can then view your catalog at http://localhost:3000

This generator is licensed under the [MIT licence](../../../LICENSE). It works with EventCatalog. EventCatalog's own licence terms apply to EventCatalog itself. Pricing for EventCatalog is on the [pricing page](https://www.eventcatalog.dev/pricing).
