---
'@eventcatalog/generator-asyncapi': minor
---

feat(asyncapi): take the operation action into account when deciding message ownership. Previously every service overwrote the message it referenced, so a subscriber could clobber the publisher's catalog entry. Now, when no explicit `x-eventcatalog-role` is set, a `send`/`publish` operation owns the message (and overwrites it), while a `receive`/`subscribe` operation only references it - it is still documented if missing, but never overwrites an entry owned by another service. Existing behaviour is preserved: explicit `x-eventcatalog-role` (`provider`/`client`) still wins, and single-service catalogs are unaffected.
