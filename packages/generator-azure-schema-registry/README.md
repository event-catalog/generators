# @eventcatalog/generator-azure-schema-registry

Generate EventCatalog documentation from Azure Schema Registry schemas.

## Features

- Pull schemas from Azure Schema Registry
- Map schemas to EventCatalog domains and services
- Support for Avro, JSON Schema, and other schema types
- Automatic versioning of schemas

## Installation

```bash
npm install @eventcatalog/generator-azure-schema-registry
```

## Usage

Add the generator to your `eventcatalog.config.js` file:

```javascript
generators: [
  [
    '@eventcatalog/generator-azure-schema-registry',
    {
      schemaRegistryUrl: 'https://your-namespace.servicebus.windows.net',
      domain: {
        id: 'orders',
        name: 'Orders',
        version: '1.0.0',
      },
      services: [
        {
          id: 'Orders Service',
          version: '1.0.0',
          sends: [{ id: 'app.orders.created', schemaGroup: 'com.example.orders' }],
          receives: [{ id: 'app.orders.updated', schemaGroup: 'com.example.inventory' }],
        },
        {
          id: 'Inventory Service',
          version: '1.0.0',
          sends: [{ id: 'app.inventory.created', schemaGroup: 'com.example.inventory' }],
          receives: [{ id: 'app.inventory.updated', schemaGroup: 'com.example.orders' }],
        },
      ],
    },
  ],
];
```

### Advanced Configuration

You can customize schema names, message types, and override the registry URL per schema:

```javascript
generators: [
  [
    '@eventcatalog/generator-azure-schema-registry',
    {
      schemaRegistryUrl: 'https://your-namespace.servicebus.windows.net',
      services: [
        {
          id: 'Orders Service',
          version: '1.0.0',
          sends: [
            {
              id: 'app.orders.created',
              schemaGroup: 'com.example.orders',
              name: 'Order Created Event', // Custom display name in EventCatalog
              messageType: 'event', // Specify message type (event, command, or query)
            },
            {
              id: 'app.orders.create',
              schemaGroup: 'com.example.orders',
              name: 'Create Order Command',
              messageType: 'command', // This will be created as a command
            },
          ],
          receives: [
            {
              id: 'app.orders.get',
              schemaGroup: 'com.example.orders',
              name: 'Get Order Query',
              messageType: 'query', // This will be created as a query
            },
            {
              id: 'app.inventory.updated',
              schemaGroup: 'com.example.inventory',
              name: 'Inventory Updated Event',
              schemaRegistryUrl: 'https://different-namespace.servicebus.windows.net', // Override registry URL for this schema
            },
          ],
        },
      ],
    },
  ],
];
```

## Configuration

### Environment Variables

The generator uses `DefaultAzureCredential` from `@azure/identity` which automatically detects and uses available authentication methods in the following order:

1. **Environment variables** - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
2. **Managed Identity** - If running in Azure (App Service, Functions, VM, etc.)
3. **Azure CLI** - If you're logged in with `az login`
4. **Visual Studio Code** - If you're logged in with the Azure extension

### Options

- `schemaRegistryUrl` (required) - The URL of your Azure Schema Registry (e.g., `https://your-namespace.servicebus.windows.net`)
- `services` (required) - List of services and their schema mappings. **Note:** Unlike Confluent, Azure Schema Registry doesn't provide an API to list all schemas, so you must explicitly define which schemas to fetch.
  - Each schema in `sends` and `receives` can have:
    - `id` (required) - The schema name in the registry
    - `schemaGroup` (required) - The schema group name
    - `name` (optional) - Custom display name for the schema in EventCatalog (defaults to the schema `id`)
    - `schemaRegistryUrl` (optional) - Override the registry URL for this specific schema (useful when schemas are in different registries)
    - `messageType` (optional) - Set to `'event'`, `'command'`, or `'query'` (defaults to `'event'`)
- `domain` (optional) - Domain configuration to group services

## Authentication

This generator uses `DefaultAzureCredential` which supports multiple authentication methods:

- **For local development:** Run `az login` to authenticate via Azure CLI
- **For CI/CD:** Set environment variables for a service principal (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
- **For Azure-hosted applications:** Use Managed Identity (no credentials needed)

## Licence

This generator is source-available under the [Business Source License 1.1](../../LICENSE), the same licence as EventCatalog. Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
