import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  cId: "10b46030-5736-4600-8254-421c3ed56e47",
  title: "EventCatalog",
  tagline: "Discover, Explore and Document your Event Driven Architectures",
  organizationName: "Your Company",
  homepageLink: "https://eventcatalog.dev/",
  editUrl: "https://github.com/boyney123/eventcatalog-demo/edit/master",
  // By default set to false, add true to get urls ending in /
  trailingSlash: false,
  // Change to make the base url of the site different, by default https://{website}.com/docs,
  // changing to /company would be https://{website}.com/company/docs,
  base: "/",
  // Customize the logo, add your logo to public/ folder
  logo: {
    alt: "EventCatalog Logo",
    src: "/logo.png",
    text: "EventCatalog",
  },
  llmsTxt: {
    enabled: true,
  },
  generators: [
    [
      '@eventcatalog/generator-github',
      {
        source: 'https://github.com/event-catalog/flowmart-schema-registry.git',
        path: 'domains',
        branch: 'main',
        messages: [
          {
            id: 'out-of-stock',
            name: 'Out of Stock',
            version: '1.0.0',
            schemaPath: 'inventory/schemas/out_of_stock_alert_v1.proto',
            type: 'event'
          },
          {
            id: 'stock-level-updated',
            name: 'Stock Level Updated',
            version: '1.0.0',
            schemaPath: 'inventory/schemas/stock_level_updated_v1.avsc',
            type: 'event'
          },
          {
            id: 'order-cancelled',
            name: 'Order Cancelled',
            version: '1.0.0',
            schemaPath: 'orders/schemas/order_cancelled_v1.json',
            type: 'event'
          },
          {
            id: 'order-created',
            name: 'Order Created',
            version: '1.0.0',
            schemaPath: 'orders/schemas/order_created_v1.avsc',
            type: 'event'
          },
          {
            id: 'order-shipped',
            name: 'Order Shipped',
            version: '1.0.0',
            schemaPath: 'orders/schemas/order_shipped_v1.proto',
            type: 'event'
          },
          {
            id: 'place-order',
            name: 'Place Order',
            version: '1.0.0',
            schemaPath: 'orders/schemas/place_order_v1.proto',
            type: 'command'
          },
          {
            id: 'update-order',
            name: 'Update Order',
            version: '1.0.0',
            schemaPath: 'orders/schemas/update_order_v1.proto',
            type: 'command'
          }
        ]
      },
    ]
  ],
};
