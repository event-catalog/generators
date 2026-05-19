---
'@eventcatalog/generator-openapi': patch
---

fix: handle circular references when writing request body schemas to disk. The OpenAPI generator previously wrapped only response schema serialization with a circular-safe `JSON.stringify` replacer, so request bodies containing circular `$ref`s (e.g. self-referencing `oneOf`/`allOf` constructs) would throw and abort schema file generation. Request body and response serialization now share a single circular-safe stringifier that marks cycles with `"[Circular]"`, so messages with recursive schemas still get a `request-body.json` / `response-*.json` written out.
