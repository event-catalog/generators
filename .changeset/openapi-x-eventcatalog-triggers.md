---
'@eventcatalog/generator-openapi': minor
---

Add the `x-eventcatalog-triggers` operation extension. An operation that is received by the service can list the messages it triggers (e.g. a command published to a queue) by `id`, optional `version` and optional `condition`. They are added as `triggers` on the message pointer in the service, so the visualiser continues from the API to the triggered message. Messages are looked up in the catalog and skipped with a warning when not found.
