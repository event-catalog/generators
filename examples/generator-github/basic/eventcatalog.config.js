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
  generators: [
    [
      '@eventcatalog/generator-github',
      {
        source: 'https://github.com/event-catalog/eventcatalog',
        path: 'examples/default',
        branch: 'main',
        messages: [
          {
            id: 'order-amended',
            name: 'Order Amended',
            version: '1.0.0',
            schemaPath: 'domains/Orders/services/OrdersService/events/OrderAmended/schema.avro',
            type: 'event'
          },
          {
            id: 'order-cancelled',
            name: 'Order Cancelled',
            version: '2.0.0',
            schemaPath: 'domains/Orders/services/OrdersService/events/OrderCancelled/schema.json',
            type: 'event'
          },
          {
            id: 'place-order',
            name: 'Place Order',
            version: '1.0.0',
            schemaPath: 'domains/Orders/services/OrdersService/commands/PlaceOrder/schema.json',
            type: 'command'
          }
        ]
      },
    ]
  ],
};
