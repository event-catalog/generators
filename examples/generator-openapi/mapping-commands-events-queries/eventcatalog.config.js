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
  docs: {
    sidebar: {
      // Should the sub heading be rendered in the docs sidebar?
      showPageHeadings: true,
    },
  },
  generators: [
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          { path: path.join(__dirname, "openapi-files", "product-api.yml") },
        ],
        domain: { id: "products", name: "Products", version: "0.0.1" },
        // This is an optional mapping of http methods to event types.
        // e.g All GET requests will be mapped to queries and all POST requests will be mapped to commands.

        // If you specify the `x-eventcatalog-message-type` header then it will be used instead.
        httpMethodsToMessages: {
          GET: 'query',
          POST: 'command',
          PUT: 'command',
          DELETE: 'command',
        }
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          { path: path.join(__dirname, "openapi-files", "order-api.yml"), id: 'order-service' },
          { path: path.join(__dirname, "openapi-files", "order-history.yml"), id: 'order-history' },
        ],
        domain: {
          id: "order-management",
          name: "Order management",
          version: "0.0.1",
        },
      },
    ],
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          { path: path.join(__dirname, "openapi-files", "payment-api.yml"), id: 'payment-service' },
        ],
        domain: { id: "payment", name: "Payment", version: "0.0.1" },
      },
    ],
  ],
};
