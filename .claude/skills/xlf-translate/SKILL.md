---
name: xlf-translate
description: "Fill empty non-English XLF targets only when explicitly asked to translate selected locales/ranges; preserve reviewed strings and mark machine drafts with ~."
---

# Requested XLF translation

This task is separate from code localization. Do not activate it for adding `_()`/`c_()` strings.
Use locales and line range already provided by the user; ask only for missing scope. Discover locale
files on disk and exclude `messages.en.xlf`. Never run `make translations`.

Read [the detailed procedure](references/procedure.md) before translating. Preserve terminology,
locale distinctions, placeholders, source/IDs and nonempty targets; prefix new machine drafts with `~`.
Keep unchanged bytes, newline style and encoding intact. Report existing translation defects instead
of silently expanding the edit scope. Verify the actual changed target count and UTF-8 bytes/XML validity.

The procedure's inline PowerShell route is for Windows PowerShell 5.1 encoding safety. On other hosts,
use an available UTF-8-safe text tool with the same bounded, source-anchored replacements and byte/diff
checks; do not install PowerShell solely to translate. Never reserialize the entire XML document.
Revert only this run's substitutions on encoding failure, preserving pre-existing work.
