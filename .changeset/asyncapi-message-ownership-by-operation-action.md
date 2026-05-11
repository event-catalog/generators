---
'@eventcatalog/generator-asyncapi': major
---

feat: derive AsyncAPI message ownership from operation action. The same message can appear on multiple services — typically one publishes and others subscribe — but the generator previously treated every service as the owner, so each run overwrote the message's catalog entry from whichever service was processed last. Ownership now follows the operation action: `send`/`publish` claims ownership, while `receive`/`subscribe` only references the existing message without overwriting markdown, badges, or attachments. A new `messageOwnership` config option (`'action-based'` default, `'all-owned'` legacy) preserves the previous behavior for users who relied on it, and an explicit `x-eventcatalog-role` extension still wins over both defaults.
