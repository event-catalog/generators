---
'@eventcatalog/generator-openapi': major
---

**Breaking change:** configured consumer services are no longer created if they do not already exist in the catalog. Previously a missing consumer was created as a placeholder service (with `<NodeGraph />` markdown) and, when a domain was configured, added to the producer's domain. This could put duplicate placeholder services in the wrong domain when the consumer belonged to another domain or was generated later by a different generator.

Consumers that already exist are still updated in place with their `sends` merged, as before. To keep a consumer in your catalog, make sure it is generated or documented before the OpenAPI generator runs.
