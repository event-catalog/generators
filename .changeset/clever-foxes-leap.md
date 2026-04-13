---
'@eventcatalog/generator-openapi': patch
---

Fix: schemas, parameters, and request bodies are now correctly generated per-operation when OpenAPI specs omit `operationId`. Previously all operation-id-less operations received the first such operation's schemas due to `undefined === undefined` matching.
