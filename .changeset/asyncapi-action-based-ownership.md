---
'@eventcatalog/generator-asyncapi': major
---

Derive message ownership from the AsyncAPI operation action when no explicit `x-eventcatalog-role` is set. Sending services own shared contracts, while receiving services create a fallback only when the message is missing and otherwise reference the existing contract without overwriting it.

This changes the default behavior of unannotated `receive` and `subscribe` operations, which previously owned and overwrote message documentation. Set `x-eventcatalog-role: provider` on the operation or message to retain that ownership behavior.
