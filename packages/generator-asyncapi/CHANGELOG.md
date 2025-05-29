# @eventcatalog/sdk

## 4.2.1

### Patch Changes

- e586753: fix(plugin): asyncapi plugin now parses and supports special characters

## 4.2.0

### Minor Changes

- 21100a2: feat(plugin): add support proxy server for all plugins

## 4.1.0

### Minor Changes

- e0f2cf2: feat(plugin) asyncapi add support for proxy server

## 4.0.3

### Patch Changes

- c3c6310: feat(plugin): asyncapi now supports deprecated fields

## 4.0.2

### Patch Changes

- 45d277a: feat(plugin): plugins now persist styles between generation

## 4.0.1

### Patch Changes

- 28409cf: fix(plugin): fixed issue with broken schema in EventCatalog if schema…

## 4.0.0

### Major Changes

- 49cb626: chore(plugin): updated to sdk v2

## 3.0.5

### Patch Changes

- 8d61f9f: fix(plugin): asyncapi plugin now parses messages without payloads

## 3.0.4

### Patch Changes

- b9735ff: fix(plugins): fixed bug for checking for latest version

## 3.0.3

### Patch Changes

- 69d1698: fix(plugins): fixed broken checks for newest version

## 3.0.2

### Patch Changes

- bab80ff: feat(core): added cli logs to let users know about updates

## 3.0.1

### Patch Changes

- 63dcc36: feat(plugin): added ability to add owners to asyncapi plugin

## 3.0.0

### Major Changes

- c9ad7b7: feat(plugin): asyncapi plugin now groups by service

## 2.8.2

### Patch Changes

- 3890544: fix(plugin): no longer added empty owners

## 2.8.1

### Patch Changes

- 3cded09: chore(project): sharing files between plugins

## 2.8.0

### Minor Changes

- a80bca6: chore(plugin): updated sdk version

## 2.7.3

### Patch Changes

- 8e1b041: chore(plugin): added checks for license

## 2.7.2

### Patch Changes

- 0c120fb: fix(plugin): owner and repo are now persisted between builds versions

## 2.7.1

### Patch Changes

- 7f0e0ce: fix(plugin): set default value for plugin DIR

## 2.7.0

### Minor Changes

- 9386b80: feat(plugin): added feature to map channels to EventCatalog

## 2.6.0

### Minor Changes

- 40b90c9: fix(plugin): added support for AsyncAPI v2 files, pub/sub messages now matched correctly

## 2.5.2

### Patch Changes

- d6c0491: chore(plugin):added dashboard link to generator

## 2.5.1

### Patch Changes

- df75c7b: feat(plugin): added optional field to not parse schemas when parsing …

## 2.5.0

### Minor Changes

- 8effb57: fix(plugin): the original schema is now stored against the message

## 2.4.2

### Patch Changes

- f2e3908: feat(plugin): added support for versioning messages

## 2.4.1

### Patch Changes

- 3995b89: chore(plugin): upgrade eventcatalog sdk version

## 2.4.0

### Minor Changes

- ec93417: feat(plugin): added new extension x-eventcatalog-role

## 2.3.1

### Patch Changes

- 1579b34: feat(plugin): added support for queries in messages

## 2.3.0

### Minor Changes

- 157a0e3: feat(plugin): asyncapi paths can now be urls

## 2.2.1

### Patch Changes

- 538f88e: chore(plugin): updated deps

## 2.2.0

### Minor Changes

- 0334b93: chore(plugin): updated eventcatalog sdk version

## 2.1.2

### Patch Changes

- cce1dd0: chore(plugin): added validation for CLI inputs using zod

## 2.1.1

### Patch Changes

- 9ee9650: chore(plugin): removed code to set unique messages as sdk now does this

## 2.1.0

### Minor Changes

- 542aaed: chore(plugin): added windows tests to cicd

### Patch Changes

- 4985626: chore(plugin): fixed path issues with windows

## 2.0.2

### Patch Changes

- 1c3ee0a: feat(plugin): persist messages the service receives and sends

## 2.0.1

### Patch Changes

- d47ce74: feat(plugin): persist messages the service receives and sends

## 2.0.0

### Major Changes

- f269307: feat(plugin): breaking change - service id is mandatory and foldernam…
- 477c55e: feat(plugin): asyncapi files are now raw by default, users have to opt into parsed outputs
  feat(plugin): specifications for services are now persisted on services.

## 1.0.5

### Patch Changes

- 1968f1c: fix(plugin): when refreshing service definitions the folder name is taken into consideration

## 1.0.4

### Patch Changes

- ebc881e: feat(plugin): added new folderName property for services

## 1.0.3

### Patch Changes

- 77e9a8a: feat(plugin): setting the service id on the plugin now uses that id f…

## 1.0.2

### Patch Changes

- 579aa26: feat(plugin): added support for json asyncapi files, now write json b…

## 1.0.1

### Patch Changes

- f769fa8: chore(plugin): changed asyncapi test file names

## 1.0.0

### Major Changes

- adea394: feat(plugin): added support to specify custom service ids

## 0.1.4

### Patch Changes

- 4ceb838: feat(plugin): added support for avro schemas

## 0.1.3

### Patch Changes

- bf14d91: chore(plugin): removed logs - forced build

## 0.1.2

### Patch Changes

- 5a66746: feat(plugin): asyncapi written to service does not contain any refs

## 0.1.1

### Patch Changes

- 072f627: feat(plugin): added external file support using refs

## 0.1.0

### Minor Changes

- 8ddd7f6: Generator will integrate automatically the specifications frontmatter for services generated

## 0.0.4

### Patch Changes

- 6f28a9a: bug(plugin): reverted back to asyncapi plugin

## 0.0.3

### Patch Changes

- d89c37d: chore(plugin): update to license

## 0.0.2

### Patch Changes

- c691069: chore(plugin): release

## 0.0.3

### Patch Changes

- 4e5acb3: chore(plugin): fixing chalk version

## 0.0.2

### Patch Changes

- 572d121: feat(generator): core features

## 0.0.1

### Patch Changes

- 6e831f6: test
- c6e2991: fixing deployment

## 0.0.7

### Patch Changes

- dd2f78e: feat(sdk): added domains to sdk

## 0.0.6

### Patch Changes

- e925200: feat(sdk): added commands to sdk

## 0.0.5

### Patch Changes

- e060c21: chore(sdk): refactored code to new resource internal lib

## 0.0.4

### Patch Changes

- fcd03f6: feat(sdk): added support for services

## 0.0.3

### Patch Changes

- e41c8af: docs(sdk): adding docs to events

## 0.0.2

### Patch Changes

- 323eb10: fix(sdk): fixing build on github
