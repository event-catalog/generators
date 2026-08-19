---
'@eventcatalog/generator-asyncapi': patch
---

fix(asyncapi): stop `saveParsedSpecFile` producing invalid AsyncAPI v3 documents

Parsed AsyncAPI v3 documents contain shared (non-circular) object references, e.g.
each operation's dereferenced `channel` is the same object as the entry under the
root `channels` object. The circular-reference-safe serializer treated these shared
references as cycles and replaced them with `$ref: '#'`, producing a spec file that
fails AsyncAPI validation and renders as a blank page in EventCatalog. The serializer
now tracks ancestors instead of every object seen, so only true cycles are replaced
with a `$ref`.
