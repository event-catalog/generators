---
'@eventcatalog/generator-openapi': major
---

feat(openapi): multiple OpenAPI files now attach to a single service version

Breaking change to how multiple OpenAPI files map to service versions:

- When a service entry has multiple `path` values, all specifications are now attached to one service version instead of each spec file creating its own historical service version.
- When no `version` is configured, the service version is inferred from the highest OpenAPI `info.version` (semver-aware ordering).
- Previous specification files are now preserved when multiple paths target the same service version, while OpenAPI specs from older service versions stay with the version that produced them.
- To create separate service version records, configure separate `services` entries with explicit `version` values.
