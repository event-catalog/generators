---
'@eventcatalog/generator-openapi': patch
---

fix: preserve `group` fields on `sends`/`receives` when regenerating against an existing service. Previously, running the generator a second time against a service already in the catalog would drop `group` values derived from `groupMessagesBy` (e.g. `path-prefix`, `single-group`). Freshly-generated pointers now win over stale catalog pointers on id+version collisions, while catalog-only pointers (e.g. hand-added) are preserved.
