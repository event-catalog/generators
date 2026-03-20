---
'@eventcatalog/generator-openapi': minor
'@eventcatalog/generator-asyncapi': minor
'@eventcatalog/generator-eventbridge': minor
'@eventcatalog/generator-aws-glue': minor
'@eventcatalog/generator-azure-schema-registry': minor
'@eventcatalog/generator-apicurio': minor
'@eventcatalog/generator-github': minor
'@eventcatalog/generator-confluent-schema-registry': minor
'@eventcatalog/generator-graphql': minor
---

Support generating services into subdomain folder structures. Generators now use getResourcePath to resolve the actual domain location on disk instead of hardcoding the path, enabling nested subdomain paths like domains/Buyer/subdomains/Agency/services/MyService.
