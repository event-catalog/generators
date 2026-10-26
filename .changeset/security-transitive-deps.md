---
'@eventcatalog/generator-amazon-apigateway': patch
'@eventcatalog/generator-apicurio': patch
'@eventcatalog/generator-asyncapi': patch
'@eventcatalog/generator-aws-glue': patch
'@eventcatalog/generator-azure-schema-registry': patch
'@eventcatalog/generator-confluent-schema-registry': patch
'@eventcatalog/generator-eventbridge': patch
'@eventcatalog/generator-openapi': patch
---

fix: update dependencies with known vulnerabilities (GHSA-v4v9-w7cf-4c6q). `@changesets/cli` moves from `dependencies` to `devDependencies`, so it (and the braces, sprintf-js, tmp and picomatch it pulled in) is no longer installed with the generators. The AWS generators need AWS SDK 3.1154.0 or later, which no longer uses fast-xml-parser. The schema registry and Apicurio generators need axios 1.20.0 or later. The AsyncAPI and OpenAPI generators need js-yaml 4.3.2 or later, and the AsyncAPI generator moves to `@asyncapi/parser` 3.6.6 and lodash 4.18.1. The lockfile also picks up fixed versions of fast-uri, ajv, minimatch, brace-expansion and others that the existing ranges already allowed
