# @eventcatalog/generator-openapi

## 7.8.0

### Minor Changes

- c1e9721: Add operation frontmatter (method, path, statusCodes) to OpenAPI-generated messages

## 7.7.2

### Patch Changes

- 5e106e2: feat(generator-openapi): preserve AsyncAPI specs and support multi-OpenAPI specifications

## 7.7.1

### Patch Changes

- 5650b9d: Persist diagrams property during service regeneration (fixes event-catalog/eventcatalog#2056)

## 7.7.0

### Minor Changes

- 6f65dee: Add headers support for authenticated URL fetching in OpenAPI and AsyncAPI generators. This enables fetching specs from protected endpoints like SwaggerHub with API keys.

### Patch Changes

- ed07a6e: chore: removed meow console log....

## 7.6.5

### Patch Changes

- 7737ad7: fix(plugin): fixed issue with specification parsed 286

## 7.6.4

### Patch Changes

- cac3de1: chore(core): updated packages

## 7.6.3

### Patch Changes

- 740d1dd: fix(plugin): fixed overriding issue for readsFrom and writesTo for th…

## 7.6.2

### Patch Changes

- 34448ab: chore(code): moving to npm OIDC

## 7.6.1

### Patch Changes

- edad6da: feat(plugin): added ability to specify version of service through con…

## 7.6.0

### Minor Changes

- 77a7fbb: feat(plugin): added ability to specify version of service through configuration for asyncapi and openapi

## 7.5.5

### Patch Changes

- 0f79f83: feat(plugin): added new azure schema registry plugin

## 7.5.4

### Patch Changes

- 11dd0e9: chore(plugin): fixed chalk version for plugin

## 7.5.3

### Patch Changes

- 56a8964: fix(plugin): readsFrom and writesTo are now persisted between generat…

## 7.5.2

### Patch Changes

- 6e36874: fix(plugins): plugin now supports https proxy

## 7.5.1

### Patch Changes

- edb8da3: fix(plugin): openapi plugin no longer prefixes the name value

## 7.5.0

### Minor Changes

- bb096f0: feat(plugins): added support for writesTo and readsFrom to attach data stores to them

## 7.4.5

### Patch Changes

- e87abdf: fix(openapi): folder names for messages are now correct

## 7.4.4

### Patch Changes

- 4023ac0: fix(plugin): openapi now prefixes with the correct service id

## 7.4.3

### Patch Changes

- fdffef6: feat(plugin): asyncpi and openapi now support name and summary override

## 7.4.2

### Patch Changes

- ece0c47: fix(plugins): badges and attachments are now persisted between genera…

## 7.4.1

### Patch Changes

- 001e0ed: feat(core): added ability to add prefix to messages

## 7.4.0

### Minor Changes

- 4d496cb: feat(plugins): added support for offline license checks

## 7.3.1

### Patch Changes

- f9d9464: fix(plugin): openapi plugin now esacpes curly brackets for markdown

## 7.3.0

### Minor Changes

- f74f9b3: feat(plugin): added ability to mark resources as drafts

## 7.2.1

### Patch Changes

- ac0fc47: feat(core): openapi/asyncapi plugin now supports custom markdown for …

## 7.2.0

### Minor Changes

- f12284f: feat(core): openapi plugin now supports custom markdown for services

## 7.1.1

### Patch Changes

- 0e53c82: chore(plugins): ignore types in sends/recieves for now to fix build

## 7.1.0

### Minor Changes

- 21100a2: feat(plugin): add support proxy server for all plugins

## 7.0.0

### Major Changes

- 6e322ef: fix(plugin): openapi plugin now checks versions before versioning

## 6.0.1

### Patch Changes

- cecee03: feat(plugin): openapi file supports many openapi files for service

## 6.0.0

### Major Changes

- 427d2bf: feat(plugin): openapi file supports many openapi files for service

## 5.0.5

### Patch Changes

- c3447b2: feat(core): added preserveExistingMessages flag to openapi plugin

## 5.0.4

### Patch Changes

- 48de722: feat(plugin): openapi now supports deprecated fields

## 5.0.3

### Patch Changes

- 45d277a: feat(plugin): plugins now persist styles between generation

## 5.0.2

### Patch Changes

- b963b45: feat(plugin): openapi - can now map http methods to message types

## 5.0.1

### Patch Changes

- 1343149: feat(plugin): openapi plugin now renders sidebar badges as http methods

## 5.0.0

### Major Changes

- 49cb626: chore(plugin): updated to sdk v2

## 4.0.7

### Patch Changes

- c1c21e6: fix(plugin): openapi plugin now supports circular references in respo…

## 4.0.6

### Patch Changes

- b9735ff: fix(plugins): fixed bug for checking for latest version

## 4.0.5

### Patch Changes

- 69d1698: fix(plugins): fixed broken checks for newest version

## 4.0.4

### Patch Changes

- bab80ff: feat(core): added cli logs to let users know about updates

## 4.0.3

### Patch Changes

- 9707921: feat(plugin): added ability to set owners on your openapi files

## 4.0.2

### Patch Changes

- 741afb2: feat(plugin): change style of HTTP data from OpenAPI

## 4.0.1

### Patch Changes

- 47d09d9: chore(plugin): changed default markdown for messages

## 4.0.0

### Major Changes

- c04dbe8: feat(plugin): openapi plugin now groups by service

## 3.3.3

### Patch Changes

- 600fe8a: fix(plugin): fixed message version logging

## 3.3.2

### Patch Changes

- f7b8f68: feat(plugin): now supports x-eventcatalog-message-version

## 3.3.1

### Patch Changes

- 3cded09: chore(project): sharing files between plugins

## 3.3.0

### Minor Changes

- 563ff8f: chore(plugin): force minor version for openapi

## 3.1.2

### Patch Changes

- 75cda70: chore(plugin): force minor version for openapi

## 3.1.1

### Patch Changes

- aef86c0: chore(plugin): testing CI/CD

## 3.1.0

### Minor Changes

- bdbf298: feat(core): added ability to add files from remote urls

### Patch Changes

- f0a4149: fix(plugin): owner and repoistory are now persisted between versioning

## 3.0.1

### Patch Changes

- 2b28973: fix(plugin): set default value for plugin DIR

## 3.0.0

### Major Changes

- 73edb5e: feat(core): added new extensions for name and id in openapi
- 6a07de0: feat(plugin): all messages are now queries by default

### Patch Changes

- 1fd9adc: fix(core): added message description to markdown contents

## 2.3.1

### Patch Changes

- 31f193f: chore(plugin):added dashboard link to generator

## 2.3.0

### Minor Changes

- 7820a6f: feat(plugin): added new optional extention x-eventcatalog-message-action

## 2.2.0

### Minor Changes

- 3de119a: chore(plugin): updated eventcatalog sdk version

## 2.1.2

### Patch Changes

- cade528: feat(plugin): added ability to resolve $ref values when saving OpenAPI files to the catalog

## 2.1.1

### Patch Changes

- 6fb2a83: chore(plugin): removed code to set unique messages as sdk now does this

## 2.1.0

### Minor Changes

- d7ed60c: chore(plugin): fixed issues with windows OS

## 2.0.1

### Patch Changes

- a5a87ff: feat(plugin): persist messages the service receives and sends

## 2.0.0

### Major Changes

- 4e3ed77: feat(plugin): breaking change - persist spec files between services a…

## 1.0.0

### Major Changes

- a7dd194: feat(plugin): plugin now accepts services, path, id and folderName

## 0.0.5

### Patch Changes

- 2d97a98: chore(plugin): removed old MDX component

## 0.0.4

### Patch Changes

- 025892f: feat(plugin): openapi spec file is now added to the specifications in…

## 0.0.3

### Patch Changes

- e126929: chore(plugin): update to license

## 0.0.2

### Patch Changes

- 76435ad: fix(plugin): message ids are now generated if no operationId is set
