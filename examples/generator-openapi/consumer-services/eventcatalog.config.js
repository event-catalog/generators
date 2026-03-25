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
  trailingSlash: false,
  base: "/",
  logo: {
    alt: "EventCatalog Logo",
    src: "/logo.png",
    text: "EventCatalog",
  },
  docs: {
    sidebar: {
      showPageHeadings: true,
    },
  },
  generators: [
    [
      "@eventcatalog/generator-openapi",
      {
        services: [
          {
            path: path.join(__dirname, "openapi-files", "order-api.yml"),
            id: "order-api",
            consumers: [
              // The payment service only cares about payment-related endpoints
              {
                id: "payment-service",
                version: "1.0.0",
                routes: [{ suffix: "/payments" }],
              },
              // The shipping service only consumes shipment-related endpoints
              {
                id: "shipping-service",
                version: "1.0.0",
                routes: [{ suffix: "/shipments" }],
              },
              // The notification service consumes notification endpoints
              {
                id: "notification-service",
                version: "1.0.0",
                routes: [{ path: "/orders/{orderId}/notifications" }],
              },
              // The analytics service consumes ALL endpoints (no route filter)
              {
                id: "analytics-service",
                version: "1.0.0",
              },
              // The mobile app only consumes read (query) endpoints using a wildcard
              {
                id: "mobile-app",
                version: "2.0.0",
                routes: [{ path: ["/orders", "/orders/{orderId}"] }],
              },
            ],
          },
        ],
        domain: {
          id: "order-management",
          name: "Order Management",
          version: "0.0.1",
        },
      },
    ],
  ],
};
