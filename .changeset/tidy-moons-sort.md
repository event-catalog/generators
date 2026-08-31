---
'@eventcatalog/generator-asyncapi': patch
---

fix(asyncapi): escape angle brackets and curly braces in service and channel descriptions

AsyncAPI info and channel descriptions were written into the generated markdown
unescaped. A description containing angle brackets, e.g. `<fieldname>,<asc/desc>`,
is parsed by MDX as a JSX tag and breaks the EventCatalog build with errors like
"Unexpected character `d` (U+0064) after self-closing slash, expected `>` to end
the tag"; curly braces are parsed as JSX expressions and fail similarly. These
characters are now escaped in service and channel descriptions, while content
inside fenced code blocks and inline code spans is left untouched.
