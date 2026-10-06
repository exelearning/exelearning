---
name: mkdocs-nav
description: "Update published MkDocs navigation for added, moved or removed public documentation, respecting excluded contributor records."
---

# MkDocs navigation

Read `mkdocs.yml` and the changed documentation. Inventory Markdown paths under `doc/`, then apply
`exclude_docs` and existing publication rules before identifying navigation gaps.
Contributor-facing `doc/architecture/` records/templates are deliberately excluded; do not add them
or `.agents/` references merely to make every Markdown file appear in navigation.

Preserve sections/order and all configuration outside the affected `nav` entries. Read new files for
their titles and intended audience rather than inventing a new complete navigation tree. Remove stale
links when a published page moves; use MkDocs paths relative to `docs_dir`.

Quote mapping labels containing a colon, e.g. `"Deploy: Sample Configs"`; a backslash does not escape
an unquoted YAML colon. Validate YAML and run the existing docs build when changing `mkdocs.yml`.
Report added/moved/removed entries and deliberate exclusions. A nav task does not authorize publishing,
rewriting historical architecture records or editing unrelated site configuration.
