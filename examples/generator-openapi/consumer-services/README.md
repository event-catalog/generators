# OpenAPI Generator - Consumer Services Example

This example shows how to define **consumer services** that receive messages generated from an OpenAPI spec.

## What this demonstrates

The `order-api.yml` spec defines an Order API with endpoints for orders, payments, shipments, and notifications. The config defines five consumer services, each consuming different subsets of the API:

| Consumer | Filter | What it receives |
|---|---|---|
| `payment-service` | `suffix: "/payments"` | Payment endpoints only |
| `shipping-service` | `suffix: "/shipments"` | Shipment endpoints only |
| `notification-service` | `path: "/orders/{orderId}/notifications"` | Exact notification endpoint |
| `analytics-service` | _(no filter)_ | All endpoints |
| `mobile-app` | `path: ["/orders", "/orders/{orderId}"]` | Order list and detail only |

## Route filter types

- **`path`** - exact match on the route path
- **`prefix`** - matches routes starting with the value
- **`suffix`** - matches routes ending with the value
- **`match`** - wildcard pattern where `*` matches any path segments

## Running the example

```bash
npm install
npm run generate
npm run dev
```
