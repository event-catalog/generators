---
'@eventcatalog/generator-openapi': patch
---

fix(openapi): escape angle brackets in parameter and schema descriptions

OpenAPI parameter and response schema descriptions were written into the
generated markdown unescaped. A description containing angle brackets, e.g.
`<veldnaam>,<asc/desc>`, is parsed by MDX as a JSX tag and breaks the
EventCatalog build with errors like "Unexpected character `d` (U+0064) after
self-closing slash, expected `>` to end the tag". Angle brackets and curly
braces are now escaped in these descriptions, while content inside fenced
code blocks and inline code spans is left untouched.
