---
'@eventcatalog/generator-openapi': patch
---

Allow OpenAPI 3.1 specs with an `info.license` object that only defines a `name` (no `url` or `identifier`), which is valid per the OpenAPI 3.1 spec but was previously rejected during validation.
