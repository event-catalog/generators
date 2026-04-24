---
'@eventcatalog/generator-eventbridge': patch
'@eventcatalog/generator-asyncapi': patch
'@eventcatalog/generator-openapi': patch
---

fix: stop demoting newer cataloged messages when the generator is re-run against an older spec. The EventBridge, AsyncAPI and OpenAPI generators previously used a plain `!==` version check before calling `versionEvent` / `versionMessage`, which meant any version difference would move the cataloged entry into `versioned/` and write the incoming one at the root — even when the incoming version was older. The generators now use a semver-aware comparison (with `semver.coerce` so non-semver versions like EventBridge's integer counters still sort numerically) and only demote the cataloged entry when the incoming version is strictly newer. When the incoming version is older or cannot be confidently compared, the generator logs a warning, leaves the cataloged entry untouched, and points the service's `sends`/`receives` at the existing cataloged version.
