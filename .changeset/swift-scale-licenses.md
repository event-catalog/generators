---
'@eventcatalog/generator-amazon-apigateway': patch
'@eventcatalog/generator-apicurio': patch
'@eventcatalog/generator-asyncapi': patch
'@eventcatalog/generator-aws-glue': patch
'@eventcatalog/generator-azure-schema-registry': patch
'@eventcatalog/generator-confluent-schema-registry': patch
'@eventcatalog/generator-eventbridge': patch
'@eventcatalog/generator-github': patch
'@eventcatalog/generator-graphql': patch
'@eventcatalog/generator-openapi': patch
---

Allow generators to authenticate using an EventCatalog Scale license key. License checking now accepts a Scale license (via `EVENTCATALOG_SCALE_LICENSE_KEY` or an offline license) in addition to per-plugin license keys, and surfaces clearer messaging when verification fails.
