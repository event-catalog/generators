---
'@eventcatalog/generator-openapi': patch
---

Fix `setMessageOwnersToServiceOwners` option being ignored and leaking as a service property. The option now correctly defaults to `true`, respects `false` to prevent service owners being applied to messages, and is no longer written onto the generated service. Resolves https://github.com/event-catalog/eventcatalog/issues/2721
