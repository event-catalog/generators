import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  cId: "10b46030-5736-4600-8254-421c3ed56e47",
  title: "MetaRetail Inc",
  tagline: "Fake Retail Company for EventCatalog Demo",
  organizationName: "MetaRetail Inc",
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
    text: "MetaRetail Inc",
  },
  docs: {
    sidebar: {
      // Should the sub heading be rendered in the docs sidebar?
      showPageHeadings: true,
    },
  },
  generators: [
    [
      '@eventcatalog/generator-federation',
      {
        // Pulling information from a GitHub repository
        source: 'git@github.com:event-catalog/generators.git',

        // specifying the branch to pull from (default is main)
        branch: 'main',

        // specify which files you want to copy from the repository
        copy: [
          {
            // importing content from the customer-experience-team catalog
            content: 'examples/generator-federation/basic/customer-experience-team/services',
            // specify the target path in your main catalog, here we are importing the services from the customer-experience-team catalog
            destination: path.resolve(__dirname, 'services')
          },
          {
            // importing content from the customer-experience-team catalog
            content: 'examples/generator-federation/basic/customer-experience-team/teams',
            // specify the target path in your main catalog, here we are importing the services from the customer-experience-team catalog
            destination: path.resolve(__dirname, 'teams')
          },
          {
            // importing content from the customer-experience-team catalog
            content: 'examples/generator-federation/basic/customer-experience-team/users',
            // specify the target path in your main catalog, here we are importing the services from the customer-experience-team catalog
            destination: path.resolve(__dirname, 'users')
          }
        ],

        // optional, if you want to merge and override any conflicts then set to true (default is false)
        override: true,

        // optional, if you want the plugin to error 
        // if there are duplicate resources in your 
        // main catalog then set to true (default is false)
        enforceUniqueResources: true
      },
    ],
    // Payment Team
    [
      '@eventcatalog/generator-federation',
      {
        // Pulling information from a GitHub repository
        source: 'git@github.com:event-catalog/generators.git',

        // specifying the branch to pull from (default is main)
        branch: 'main',

        // specify which files you want to copy from the repository
        copy: [
          {
            // importing content from the payment-team catalog
            content: 'examples/generator-federation/basic/payment-team/services',
            // specify the target path in your main catalog, here we are importing the services from the payment-team catalog
            destination: path.resolve(__dirname, 'services')
          },
          {
            // importing content from the payment-team catalog
            content: 'examples/generator-federation/basic/payment-team/teams',
            // specify the target path in your main catalog, here we are importing the services from the payment-team catalog
            destination: path.resolve(__dirname, 'teams')
          },
          {
            // importing content from the payment-team catalog
            content: 'examples/generator-federation/basic/payment-team/users',
            // specify the target path in your main catalog, here we are importing the services from the payment-team catalog
            destination: path.resolve(__dirname, 'users')
          }
        ],

        // optional, if you want to merge and override any conflicts then set to true (default is false)
        override: true,

        // optional, if you want the plugin to error 
        // if there are duplicate resources in your 
        // main catalog then set to true (default is false)
        enforceUniqueResources: true
      },
    ],
    [
      '@eventcatalog/generator-federation',
      {
        // Pulling information from a GitHub repository
        source: 'git@github.com:event-catalog/generators.git',

        // specifying the branch to pull from (default is main)
        branch: 'main',

        // specify which files you want to copy from the repository
        copy: [
          {
            // importing content from the order-management-team catalog
            content: 'examples/generator-federation/basic/order-management-team/services',
            // specify the target path in your main catalog, here we are importing the services from the order-management-team catalog
            destination: path.resolve(__dirname, 'services')
          },
          {
            // importing content from the order-management-team catalog
            content: 'examples/generator-federation/basic/order-management-team/teams',
            // specify the target path in your main catalog, here we are importing the services from the order-management-team catalog
            destination: path.resolve(__dirname, 'teams')
          },
          {
            // importing content from the order-management-team catalog
            content: 'examples/generator-federation/basic/order-management-team/users',
            // specify the target path in your main catalog, here we are importing the services from the order-management-team catalog
            destination: path.resolve(__dirname, 'users')
          }
        ],

        // optional, if you want to merge and override any conflicts then set to true (default is false)
        override: true,

        // optional, if you want the plugin to error 
        // if there are duplicate resources in your 
        // main catalog then set to true (default is false)
        enforceUniqueResources: true
      },
    ],
  ],
};
