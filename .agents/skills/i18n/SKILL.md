---
name: i18n
description: Adding translatable strings or modifying translations with _() / c_() helpers. Every change must run `make translations` to sync keys, keep existing unit/integration/E2E suites green, maintain patch coverage ≥ 90% on any touched code, and pass `make fix`, `make test-unit`, `make test-integration`, and `make test-e2e` before submission.
---

# Skill: Internationalization (i18n)

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [frontend-module](../frontend-module/SKILL.md)

## When to Use

Adding translatable strings, modifying translations, or working with localized content.

## Key Files

- `translations/messages.*.xlf` — translation files (en, es, ca, va, eu, gl, pt, eo, ro, etc.)
- `src/services/translation.ts` — server-side translation service
- `public/app/locate/` — client-side localization helpers
- `views/*.njk` — Nunjucks templates (use `| trans` filter)

**Documentation:** [doc/development/internationalization.md](../../../doc/development/internationalization.md)

## Patterns

**JavaScript (`public/app/`):**
```javascript
button.title = `${_('Undo')} (Ctrl+Z)`;      // GUI string — translated per user's locale
const label = c_('Learning objectives');        // Content string — translated per content locale
```

**Nunjucks (`views/`):**
```nunjucks
<button>{{ 'Save' | trans }}</button>
```

### `_()` vs `c_()` — When to Use Which

| Function | Context | Example |
|----------|---------|---------|
| `_()` | GUI strings (menus, tooltips, buttons) | `_('Save')`, `_('Undo')` |
| `c_()` | Content strings (exported with the project) | `c_('Learning objectives')` |

The distinction matters because the GUI language and the content language can differ (e.g., Spanish teacher creating English-language content).

## Commands

```bash
make fix                                 # Lint (the only command this skill ever runs)
```

> `make translations` and `make translations-cleanup` are **never run by agents**. Key extraction and all XLF changes are managed by a dedicated separate process. See the prohibition below.

## Gotchas

- **NEVER touch any file under `translations/`.** This is a hard rule. Do not run `make translations`, do not add or remove `<trans-unit>` elements, do not write or edit `<target>` values. A PR that modifies `translations/**` in any way will be rejected. Translation key extraction is handled by a separate automated process outside of code PRs.
- **Never hardcode English strings** in UI code — even "OK" or "Cancel" must use `_()`.
- **`_()` vs `c_()` confusion** — using the wrong function means the string is translated in the wrong context. GUI strings → `_()`, content strings → `c_()`.
- **Forgetting `| trans` in Nunjucks** — raw English strings will appear in the UI for non-English users.
- **Static build config drift** — if translated strings appear in config parameters, ensure both server and static builder use the same shared function. Duplicated config leads to untranslated strings in one of the two builds. _Example: PR #1564._

## Done When

- [ ] All user-facing strings use `_()` / `c_()` / `| trans`
- [ ] No file under `translations/` has been modified
- [ ] `make translations` has NOT been run
- [ ] No hardcoded English in UI
- [ ] `make fix` passes clean
