# @eventcatalog/generator-amazon-apigateway

## 1.3.1

### Patch Changes

- 0574d91: fix: update dependencies with known vulnerabilities (GHSA-v4v9-w7cf-4c6q). `@changesets/cli` moves from `dependencies` to `devDependencies`, so it (and the braces, sprintf-js, tmp and picomatch it pulled in) is no longer installed with the generators. The AWS generators need AWS SDK 3.1154.0 or later, which no longer uses fast-xml-parser. The schema registry and Apicurio generators need axios 1.20.0 or later. The AsyncAPI and OpenAPI generators need js-yaml 4.3.2 or later, and the AsyncAPI generator moves to `@asyncapi/parser` 3.6.6 and lodash 4.18.1. The lockfile also picks up fixed versions of fast-uri, ajv, minimatch, brace-expansion and others that the existing ranges already allowed

## 1.3.0

### Minor Changes

- 8a7c2aa: chore(license): generators are now MIT licensed and no longer require a license key

## 1.2.8

### Patch Changes

- 209f6ec: Allow generators to authenticate using an EventCatalog Scale license key. License checking now accepts a Scale license (via `EVENTCATALOG_SCALE_LICENSE_KEY` or an offline license) in addition to per-plugin license keys, and surfaces clearer messaging when verification fails.

## 1.2.7

### Patch Changes

- 0d327ce: [Snyk] Fix for 1 vulnerabilities

## 1.2.6

### Patch Changes

- 9cdd0a8: [Snyk] Upgrade aws-cdk-lib from 2.172.0 to 2.227.0

## 1.2.5

### Patch Changes

- cac3de1: chore(core): updated packages

## 1.2.4

### Patch Changes

- 34448ab: chore(code): moving to npm OIDC

## 1.2.3

### Patch Changes

- 11dd0e9: chore(plugin): fixed chalk version for plugin

## 1.2.2

### Patch Changes

- 6e36874: fix(plugins): plugin now supports https proxy

## 1.2.1

### Patch Changes

- bb096f0: feat(plugins): added support for writesTo and readsFrom to attach data stores to them

## 1.2.0

### Minor Changes

- 4d496cb: feat(plugins): added support for offline license checks

## 1.1.0

### Minor Changes

- 21100a2: feat(plugin): add support proxy server for all plugins

## 1.0.6

### Patch Changes

- 5d4e9fc: fix(plugin): added missing dependency for apigateway
- 4cf652d: fix(plugin): removed lock file for api gateway plugin

## 1.0.5

### Patch Changes

- b9735ff: fix(plugins): fixed bug for checking for latest version

## 1.0.4

### Patch Changes

- bab80ff: feat(core): added cli logs to let users know about updates

## 1.0.3

### Patch Changes

- b2e31c4: feat(plugin): setup licenses for apigateway

## 1.0.2

### Patch Changes

- dc1b589: feat(plugin): if apigateway schemas are empty the render-schema-viewe…

## 1.0.1

### Patch Changes

- ecbc1d1: fix(plugin): fixed output path of spec files

## 1.0.0

### Major Changes

- 3ebc99b: feat(plugin): new generator for amazon api gateway

### Patch Changes

- 47da1d6: feat(plugin): new generator for amazon api gateway
