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

chore: update @eventcatalog/sdk to 2.32.1, which keeps its file cache up to date instead of rebuilding it, so generators importing into an existing catalog run about 10x faster
