---
id: ADR-0006
title: "Render editor preview content in an opaque-origin sandbox"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002]
  adrs: [ADR-0007, ADR-0009, ADR-0010, ADR-0011, ADR-0015]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0006: Render editor preview content in an opaque-origin sandbox

## Status

Proposed

> **Amended by [ADR-0015](ADR-0015-opaque-http-preview-in-privileged-contexts-and-trusted-static-service-worker.md):**
> the `srcdoc` authored-content transport this record listed (Consequences →
> Neutral) was removed by ADR-0015; the opaque-origin requirement stands.

## Context

The editor preview renders untrusted, author-authored package HTML/JS. Before this
work it was served same-origin by a Service Worker (`preview-sw.js`, `/viewer/*`)
into an iframe that kept `allow-same-origin`, so preview content executed in the
app origin. It could reach the editor DOM, cookies, IndexedDB/Cache storage, the
authenticated REST session and — in Electron — the `window.top.electronAPI` preload
bridge (an arbitrary local-file read).

## Problem

How should preview isolate untrusted authored content from the editor and host
capabilities, without a separate subdomain?

## Decision drivers

- Security: untrusted content must not reach editor DOM/storage/APIs or Electron
  preload bridges.
- No separate subdomain (ops/DNS/cert burden, and still same-site).
- Must work across cloud, Electron, embedded LMS and static/PWA.
- Backward compatibility for exported packages.

## Options considered

### Option 1: Opaque-origin sandbox (no `allow-same-origin`) + response `sandbox` CSP

Serve preview into an iframe sandboxed without `allow-same-origin`, reinforced by a
response-level `Content-Security-Policy: sandbox …` so the document stays opaque
even when the capability URL is opened top-level. Pros: browser-enforced isolation;
no subdomain; works with any real serving transport. Cons: breaks direct external
embeds (needs a relay, ADR-0010); cannot use a Service Worker to serve (ADR-0007).

### Option 2: Keep the same-origin Service Worker preview

Pros: no relay needed; existing code. Cons: content stays same-origin — does not
solve the threat; a SW cannot serve an opaque frame anyway.

### Option 3: Separate preview subdomain

Pros: cross-origin isolation. Cons: DNS/cert/ops burden, still same-site cookie
exposure risk, and rejected as a project constraint.

### Option 4: Re-add `allow-same-origin` with a JS sanitizer only

Pros: simplest. Cons: sanitizer bypasses are a moving target; not a browser-enforced
boundary.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- Secure sandbox tokens `['allow-scripts','allow-popups','allow-forms']` (no
  `allow-same-origin`): `src/shared/security/previewSandbox.ts`.
- Response `sandbox`-first CSP: `previewCspHeader()` in the same file, emitted by
  `src/routes/preview-session.ts:214` and `src/services/electron-preview-handler.ts:93`.
- Legacy same-origin SW demoted to `opaqueSafe = false`:
  `public/app/workarea/interface/elements/preview/ServiceWorkerPreviewProvider.js`.
- Rationale + WPT/spec background: `doc/development/preview-architecture.md`.

## Decision

We will render preview content in a **browser-enforced opaque origin**: the iframe
is sandboxed without `allow-same-origin`, and every scriptable serving response
carries a `sandbox`-first CSP. Same-origin rendering is retained only behind an
explicit, non-default legacy override and the Electron interim, and the Y.Doc
sanitizer remains as defense-in-depth, not the primary boundary.

## Consequences

### Positive

- Untrusted preview content cannot reach editor DOM/storage/APIs or the Electron
  preload bridge in secure mode.
- No subdomain; opacity holds even if the capability URL is opened top-level.

### Negative

- External provider embeds break under opacity and need a trusted-parent relay
  (ADR-0010).
- The Service Worker can no longer serve preview (ADR-0007); transports change.

### Neutral

- `srcdoc` and Electron `app://` become first-class opaque transports.

## Risks

- The legacy same-origin override and the Electron interim are not opaque; if
  shipped enabled they reintroduce the exposure. Mitigation: off by default,
  documented, and (in hosts) test-covered as off-by-default.
- Opacity is not "secure in all contexts": the guarantee holds only where the
  opaque transport is used; see SDD-0002 threat model for residual risks.

## Validation

Provider/CSP unit tests and the `opaque-preview.spec.ts` Playwright spec assert the
absence of `allow-same-origin` and that the parent cannot read the child document.

## Follow-up work

- Retire the Electron interim same-origin path in favor of `app://` (ADR-0011).

## References

- SDD-0002; ADR-0007, ADR-0009, ADR-0010, ADR-0011.
- PR #1968. `doc/development/preview-architecture.md`.
