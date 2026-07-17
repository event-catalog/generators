---
'@eventcatalog/generator-openapi': patch
---

Set the specification name on generated OpenAPI specs using the document's `info.title` (falling back to `OpenAPI` when the title is blank), and preserve explicitly configured specification metadata when deduplicating so existing catalog entries are not overwritten.
