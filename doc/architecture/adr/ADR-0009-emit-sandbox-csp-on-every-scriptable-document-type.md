---
id: ADR-0009
title: "Emit the sandbox CSP on every scriptable preview document type, not just HTML"
status: Accepted
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002]
  adrs: [ADR-0006, ADR-0008, ADR-0011]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0009: Emit the sandbox CSP on every scriptable preview document type, not just HTML

## Status

Carried (historical). Retained from PR #1968; its insight is **applied on this
branch** by `isScriptableDocumentType()` in `src/shared/security/previewSandbox.ts`
and the serving route `src/routes/preview-snapshot.ts`, which emit the
`sandbox`-first CSP on HTML, XHTML, SVG, XML **and PDF** for eXe's own capability
snapshots (see [ADR-0004](ADR-0004-self-hosted-capability-snapshots-for-editor-preview.md)).

> Cross-references to ADR-0006/0008/0011 and SDD-0002 point to PR-branch records;
> ADR-0006 is carried here, the others are not (see ADR-0002's disposition table).

## Context

The opaque-origin guarantee (ADR-0006) is reinforced by a response-level
`sandbox`-first CSP so a preview document stays opaque even when its capability URL
is opened directly (new tab, popup, raw URL). If that CSP is applied only to
`text/html`, an author-controlled `image/svg+xml` (or XML with an
`xml-stylesheet`/PI, or XHTML) opened top-level executes its inline `<script>` in
the app origin. `X-Content-Type-Options: nosniff` does not help — SVG/XML are
already scriptable document types.

## Problem

Which served document types must carry the sandbox CSP so no author-controlled
scriptable document can execute in the app origin?

## Decision drivers

- Close the SVG/XML/XHTML top-level-open script vector.
- Keep detection central and identical across every serving path.

## Options considered

### Option 1: Central scriptable-type detection; CSP on html + svg + xml + xhtml

`isScriptableDocumentType()` returns true for `text/html`, `image/svg+xml`,
`application/xml`, `application/xhtml+xml`; every serving path emits the sandbox CSP
for those. Pros: closes the vector everywhere from one source. Cons: none material.

### Option 2: HTML-only CSP

Pros: simplest. Cons: leaves SVG/XML/XHTML able to run script in-origin when opened
top-level.

### Option 3: Rely on `nosniff` / content-type alone

Cons: `nosniff` does not stop a correctly-typed SVG/XML from executing script.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- `src/shared/security/previewSandbox.ts`: `isScriptableDocumentType()` (text/html,
  image/svg+xml, application/xml, application/xhtml+xml) + `previewCspHeader()`.
- Emitted on scriptable types by both serving paths:
  `src/routes/preview-session.ts:214` and
  `src/services/electron-preview-handler.ts:93`.
- Tests: `previewSandbox.spec.ts`; route/handler specs assert CSP present on
  HTML/SVG/XML and absent on passive assets.

## Decision

We will detect scriptable document types centrally and emit the sandbox-first CSP
on `text/html`, `image/svg+xml`, `application/xml` and `application/xhtml+xml` in
every preview serving path.

## Consequences

### Positive

- An author SVG/XML/XHTML opened top-level cannot execute in the app origin.
- One shared detector keeps HTTP and Electron paths identical.

### Negative

- Slightly broader CSP application (intended).

### Neutral

- Passive assets (CSS/JS/images) deliberately receive no CSP.

## Risks

- A new scriptable type could be missed. Mitigation: single detector to update;
  cross-repo CSP parity checked by `check-embed-sync.mjs` (ADR-0012).

## Validation

`previewSandbox.spec.ts` and the serving specs assert included vs excluded MIME
types.

## Follow-up work

- None; revisit the type list if new scriptable document types appear.

## References

- SDD-0002; ADR-0006, ADR-0008, ADR-0011. PR #1968.
