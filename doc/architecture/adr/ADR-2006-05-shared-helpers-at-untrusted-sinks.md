---
id: ADR-2006-05
title: "Untrusted input crosses filesystem and HTML/inline-JS sinks only through shared validation and encoding helpers"
status: Proposed
date: 2026-07-09
tracking_issue: 2006
legacy_id: ADR-0024
deciders:
  - "@erseco"
related:
  prs: [2007]
  changes: ["2006-backend-security-audit-hardening"]
  adrs: [ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2006-05: Untrusted input crosses filesystem and HTML/inline-JS sinks only through shared validation and encoding helpers

## Context

Two families of injection findings in the security audit (issue #2006) shared a
root cause: attacker-controlled values reached a dangerous sink through ad-hoc,
per-call-site handling instead of one hardened helper.

- Path traversal: several upload/export/theme/resource endpoints concatenated
  attacker-controlled identifiers (`clientId`, `resumableIdentifier`,
  `odeSessionId`, `themeName`, `ideviceId`) straight into `path.join(...)`.
  Because `path.join` collapses `..`, this allowed arbitrary file read/write
  outside the intended base directory (one write primitive was rated HIGH). A
  naive `startsWith` containment check also mis-classified `/data/assets-evil`
  as inside `/data/assets`.
- Stored/rendered XSS: user-controlled values were interpolated into HTML and
  into inline `<script>` JSON. The admin console built table rows with
  `innerHTML` from asset filenames/URLs, and the workarea template embedded the
  user object and config into a single-quoted inline JS string —
  `JSON.stringify` does not escape the `'` delimiter, `` ` ``/`${`, `</script>`,
  or U+2028/U+2029, so a crafted saved value (e.g. a locale preference) could
  break out and execute (two HIGH findings).

This ADR records the decision to funnel these sinks through shared helpers.

## Problem

How do we ensure every filesystem path built from user input, and every HTML /
inline-JS sink fed user input, is validated or encoded by one shared, tested
helper rather than by hand at each call site?

## Decision drivers

- Security: eliminate path traversal and stored/reflected XSS at the sink.
- Single source of truth: one path guard, one inline-JS encoder, one HTML
  escaper — reused everywhere, testable once.
- Correctness of containment: separator-aware base check, not `startsWith`.
- No feature regression: legitimate filenames, extensions, and locale values
  must still round-trip.

## Options considered

### Option 1: Per-endpoint sanitization and per-template escaping

Fix each call site independently. Rejected: this is the pattern that produced
the gaps; it drifts and new endpoints forget it.

### Option 2: Blocklist dangerous characters / regex-scrub HTML

Rejected: character blocklists and regex HTML scrubbing are bypass-prone (and,
per prior project experience, re-trigger static-analysis findings). Allow-listed
segments and correct contextual encoding are the robust approach.

### Option 3 (chosen): Shared `safe-path` validators at every filesystem sink; contextual encoders (`jsonScript` filter, one quote-safe `escapeHtml`) at every HTML/inline-JS sink

`src/utils/safe-path.ts` provides allow-listed segment validation, a
separator-aware containment check, and a `safeJoin` that asserts containment; a
Nunjucks `jsonScript` filter encodes values embedded in inline JS; a single
quote-safe `escapeHtml` guards admin `innerHTML` writes.

## Evidence

- Path helpers: `src/utils/safe-path.ts` — `isSafePathSegment` /
  `assertSafePathSegment` (allow-listed `[A-Za-z0-9_-]`, optional dots; rejects
  empty, over-long, `.`/`..`, separators, and NUL/control chars), `isWithinBase`
  (separator-aware: `resolvedTarget === base || startsWith(base + sep)`, so
  `/data/assets-evil` is NOT inside `/data/assets`), `safeJoin` (validates each
  segment then asserts containment), `sanitizeFileExtension`, and
  `UnsafePathError`.
- Filesystem sinks routed through the helpers:
  `src/routes/idevices.ts`, `src/routes/project.ts`, `src/routes/resources.ts`,
  `src/routes/assets.ts`, `src/routes/upload-session.ts`,
  `src/routes/convert.ts`, `src/routes/api/v1/assets.ts`, `src/routes/themes.ts`,
  and `src/services/link-validator.ts`.
- Inline-JS encoder: `src/services/template.ts` — the `jsonScript` Nunjucks
  filter `JSON.stringify(value)` then escapes `\`, `'`, `<` (the `<`
  becomes `\u003c`, neutralising `</script>`), and U+2028/U+2029; it round-trips via
  `JSON.parse`. Applied in `views/workarea/workarea.njk` (`user | jsonScript |
  safe`, `config | jsonScript | safe`, lines 58-59).
- HTML escaper: `views/admin/index.njk` defines a single quote-safe
  `escapeHtml` (escapes `&`, `<`, `>`, `"`, `'`) at ~line 2524, used at the
  `innerHTML` sinks that render asset filename/URL cells and error text
  (~lines 2563-2581). The two earlier shadowing definitions (one of which did
  not escape quotes) were collapsed into this one.
- Tests: `src/utils/safe-path.spec.ts` (segment validation, separator-aware
  containment, `safeJoin` escape, extension sanitisation),
  `src/services/template.spec.ts` (`jsonScript` breakout/round-trip),
  `src/routes/resources.spec.ts` and `src/routes/filemanager.spec.ts` (traversal
  rejection at the routes). The admin quote-breakout path is covered by a
  Playwright impersonation test.

## Decision

We will require that any on-disk path built from user-supplied input is
constructed with the shared `src/utils/safe-path.ts` helpers (`safeJoin` /
`assertSafePathSegment` / `isWithinBase`), and that any user-controlled value
rendered into HTML or an inline `<script>` is passed through the shared
contextual encoder for that sink — the `jsonScript` Nunjucks filter for inline
JS and the single quote-safe `escapeHtml` for admin `innerHTML`. No call site
concatenates untrusted input into a path or interpolates it into markup without
these helpers.

## Consequences

### Positive

- Path traversal (including the HIGH write primitive) and the inline-JS /
  `innerHTML` XSS (two HIGH) are closed at the sink with tested, reusable
  helpers.
- The separator-aware containment check removes the `startsWith` sibling-prefix
  bug.
- New endpoints/templates get correct behaviour by reusing the helpers.

### Negative

- Segment validation is allow-list based, so genuinely unusual-but-legal names
  (characters outside `[A-Za-z0-9._-]`) are rejected; this is a deliberate
  tightening that could affect edge-case filenames.
- The policy is enforced by convention + tests, not by the type system; a new
  sink that skips the helper is still a latent gap.

### Neutral

- `escapeHtml` and `jsonScript` are context-specific by design; the right helper
  must be chosen per sink (HTML vs. inline JS).

## Risks

- A future template or route could interpolate untrusted input without the
  helper and re-introduce a sink; mitigated by tests and review, not statically
  prevented.
- Over-strict segment rules could reject a legitimate identifier; covered by the
  `safe-path` spec's positive cases.

## Validation

- `src/utils/safe-path.spec.ts` and `src/services/template.spec.ts` assert the
  helpers reject traversal/breakout and round-trip legitimate values.
- Route specs (`resources`, `filemanager`) assert traversal is rejected at the
  endpoint; a Playwright test asserts the admin quote-breakout no longer
  executes.

## Follow-up work

- Consider a lint rule or wrapper type that flags raw `path.join` on
  request-derived values and raw `innerHTML`/inline-JS interpolation, so the
  convention is mechanically enforced.

## References

- Issue #2006, PR #2007.
- the change design — Backend Security Audit Hardening.
- Sibling ADRs: ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-04.
- Code: `src/utils/safe-path.ts`, `src/services/template.ts`,
  `views/workarea/workarea.njk`, `views/admin/index.njk`, and the routed sinks
  in `src/routes/{idevices,project,resources,assets,upload-session,convert,
  themes}.ts`, `src/routes/api/v1/assets.ts`.
- Tests: `src/utils/safe-path.spec.ts`, `src/services/template.spec.ts`,
  `src/routes/resources.spec.ts`, `src/routes/filemanager.spec.ts`.
- Related: `doc/architecture.md` (§7.3 file storage, §7.4 frontend patterns).
