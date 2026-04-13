---
"@eventcatalog/generator-eventbridge": patch
---

Fix `writeToRoot` / `writeFilesToRoot`: when an existing service is nested under a domain or subdomain and the option is later enabled, the service is now moved to the root `/services` folder instead of leaving a stale copy behind.
