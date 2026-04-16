---
'@eventcatalog/generator-openapi': patch
'@eventcatalog/generator-asyncapi': patch
---

fix: preserve existing service location when re-running the generator without a `domain` configured. Previously, if a service already existed inside a domain (e.g. `domains/orders/services/my-service`) and the generator was re-run without the `domain` option set, the generator would write a duplicate copy of the service to the catalog root at `services/my-service`. The generators now resolve the existing service's on-disk location via `getResourcePath` and write back in-place, matching the behaviour already used for consumer services.
