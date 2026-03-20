# @eventcatalog/generator-graphql

## 0.1.0

### Minor Changes

- e87d4a3: Support generating services into subdomain folder structures. Generators now use getResourcePath to resolve the actual domain location on disk instead of hardcoding the path, enabling nested subdomain paths like domains/Buyer/subdomains/Agency/services/MyService.

## 0.0.9

### Patch Changes

- cac3de1: chore(core): updated packages

## 0.0.8

### Patch Changes

- 34448ab: chore(code): moving to npm OIDC

## 0.0.7

### Patch Changes

- 11dd0e9: chore(plugin): fixed chalk version for plugin

## 0.0.6

### Patch Changes

- 56a8964: fix(plugin): readsFrom and writesTo are now persisted between generat…

## 0.0.5

### Patch Changes

- 6e36874: fix(plugins): plugin now supports https proxy

## 0.0.4

### Patch Changes

- bb096f0: feat(plugins): added support for writesTo and readsFrom to attach data stores to them

## 0.0.3

### Patch Changes

- a3f3d69: fix(plugin): fixed graphql plugin error

## 0.0.2

### Patch Changes

- d5143c8: feat(generators): added GraphQL generator to EventCatalog
