---
'@eventcatalog/generator-openapi': patch
---

Fix consumer route wildcard matching so patterns with a leading `*` (e.g. `*/adopted`) correctly match OpenAPI paths that start with `/`.
