---
id: ADR-348-01
title: "Isolate untrusted public viewer content in a server-served opaque origin"
status: Proposed
date: 2026-07-09
tracking_issue: 348
legacy_id: ADR-0017
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
related:
  prs: [1425]
  changes: ["348-public-read-only-viewer-opaque-origin"]
  adrs: [ADR-348-02, ADR-348-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-348-01: Isolate untrusted public viewer content in a server-served opaque origin

## Context

Issue #348 asks for a public, no-login, read-only URL that lets a teacher share a
finished resource so anyone can open it. The resource is a full HTML5 export:
author-provided HTML, CSS and JavaScript. That content is **untrusted** — a teacher
can paste AI-generated, copied, or hand-written scripts, and iDevices legitimately
ship JavaScript. The shared link can be opened by anyone, including a logged-in
administrator of the same eXeLearning instance.

eXeLearning already renders exported content for the author inside the workarea via a
**same-origin Service Worker** preview (`public/preview-sw.js`,
`Html5Exporter.generateForPreview()`; see `doc/architecture.md` §8.1–8.5). That model
is safe for the *editor* previewing their *own* content, but reusing it for a public
link is not: same-origin content shares the application's origin and can therefore
reach the viewer's authenticated session.

The "untrusted content in educational resources" security study (§4.5, §6.2) that
motivated this work describes exactly this same-origin failure mode: content running
in the app origin can read the `auth` cookie surface, call the authenticated API with
the viewer's session, reach `window.parent`/`window.top`, and open the application's
IndexedDB and Cache API. The blast radius scales with the role of whoever opens the
link.

## Problem

How should the public read-only viewer serve untrusted author HTML/JS so that it can
never reach the authenticated application session, cookies, storage, API, or the
parent window — even when the content URL is opened directly (new tab, popup,
fullscreen, raw URL), and without requiring new DNS records or a second deployment?

## Decision drivers

- **Security (primary):** untrusted content must not be able to act as the logged-in
  viewer or read app-origin state.
- **Robustness:** isolation must hold even if the content URL is loaded outside the
  loader iframe (directly, popup, fullscreen).
- **Deployment simplicity:** must work on a single-origin install with no extra DNS,
  TLS certificates, or infrastructure.
- **Content compatibility:** legitimate resources (external images, CDN scripts,
  MathJax, YouTube/Vimeo embeds) should keep working by default.
- **Single source of truth:** the isolation tokens must not drift between the iframe
  attribute and the response headers.
- **Reuse:** the export pipeline should be shared with the existing exporters, not
  reimplemented.

## Options considered

### Option 1: Reuse the same-origin Service Worker preview for public links

Serve public content the same way the workarea preview does — from the app origin via
`public/preview-sw.js`.

- Pros: zero new serving code; reuses the existing preview path.
- Cons: **unsafe.** Same-origin content can read the `auth` cookie surface, call
  `/api/...` as the viewer, reach `window.parent`, and open the app's IndexedDB / Cache
  API (study §4.5, §6.2). Additionally, a `sandbox` without `allow-same-origin` gives
  the document an *opaque* origin, and a Service Worker **cannot control
  opaque-origin clients**, so the content would never load. Rejected.

### Option 2: Serve public content from a separate origin / subdomain

Host untrusted content on a distinct origin (e.g. `usercontent.example.org`) so the
browser's same-origin policy isolates it, as large platforms do for user content.

- Pros: strong, well-understood isolation; the classic pattern.
- Cons: requires a second origin — extra DNS, TLS certificates, reverse-proxy routing,
  and configuration — for every self-hosted install (eXeLearning ships to many small,
  single-host deployments). Heavy operational burden for the goal. Deferred as
  overkill; kept as a possible future hardening.

### Option 3 (chosen): Server-served content in a sandboxed opaque origin, same host

Serve the export files **from the server** at `/view/:publicViewId/_/*` and render
them inside a sandboxed iframe **without** `allow-same-origin`, which places the
document in an **opaque origin**. Emit the `sandbox` directive **both** as the iframe
attribute **and** in the response `Content-Security-Policy`, so the document stays
opaque even when opened directly. Serving from the server (not the SW) is what makes
the opaque origin loadable.

- Pros: no extra origin/DNS; strong isolation (opaque origin severs session, cookies,
  storage, parent access); isolation is a property of the document itself, so it
  survives fullscreen and direct navigation; reuses the shared `Html5Exporter`.
- Cons: the export must be built and served server-side (cost handled in ADR-348-03);
  opaque origin means the content cannot use same-origin storage (acceptable for a
  read-only viewer).

## Evidence

- Isolation policy (single source of truth for tokens + headers):
  `src/shared/security/publicViewSandbox.ts` — `PUBLIC_VIEW_SANDBOX` deliberately omits
  `allow-same-origin`; `publicViewCspHeader()` prepends a `sandbox …` directive (R3)
  and locks `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'self'` (R4);
  `publicViewPermissionsPolicy()` disables camera/microphone/geolocation/payment.
- Content serving with isolation headers: `src/routes/pages.ts` — route
  `GET /view/:publicViewId/_/*` returns each export file with `Content-Security-Policy`
  = `publicViewCspHeader(resolvePublicViewCspProfile())`, `Permissions-Policy`,
  `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. The loader route
  `GET /view/:publicViewId` renders the shell.
- Loader template (sandboxed iframe, no same-origin): `views/viewer/viewer.njk` —
  `<iframe sandbox="{{ sandboxTokens }}" referrerpolicy="no-referrer" allowfullscreen>`
  pointing at `/view/:publicViewId/_/index.html`; the tokens come from
  `PUBLIC_VIEW_SANDBOX`.
- Shared export pipeline: `src/services/public-view-content.ts` →
  `buildHtml5PreviewExport()` builds the multi-page HTML5 export via the shared
  `Html5Exporter`, `ServerYjsDocumentWrapper`, asset/resource providers from
  `src/shared/export`.
- Unit tests (isolation policy): `src/shared/security/publicViewSandbox.spec.ts` —
  "grants scripts but never allow-same-origin (opaque origin)", "emits the sandbox
  directive with the same tokens as the iframe attribute (R3)", "locks down object-src,
  base-uri and frame-ancestors (R4)".
- Unit tests (content route): `src/routes/pages.spec.ts` — describe
  `GET /view/:publicViewId/_/* (isolated public content)`: "serves index.html in an
  opaque origin via the response CSP sandbox directive".
- E2E test (real browser isolation): `test/e2e/playwright/specs/public-view-sandbox.spec.ts`
  — probes from inside the content frame that `window.origin === 'null'`, reaching
  `window.parent.location` throws, `document.cookie` is blocked, and the content
  response carries `Content-Security-Policy: sandbox allow-scripts` without
  `allow-same-origin`.
- Operational description: `doc/architecture.md` §8.6 "Public View (Read-Only) &
  Untrusted Content Isolation".

## Decision

We will serve the public read-only viewer's untrusted content **from the server** as
individual export files at `/view/:publicViewId/_/*`, rendered inside a sandboxed
iframe **without** `allow-same-origin` so the document runs in an **opaque origin**.
The `sandbox` directive is emitted both in the iframe `sandbox` attribute and in the
response `Content-Security-Policy` header, backed by a restrictive CSP and
Permissions-Policy. The sandbox tokens and header values live in one module
(`src/shared/security/publicViewSandbox.ts`) so the attribute and the header can never
drift apart. We do not introduce a separate origin/subdomain.

## Consequences

### Positive

- Untrusted content cannot reach `window.parent`/`top`, read or send the `auth`
  cookie, call `/api/...` as the viewer, or open the app's IndexedDB / Cache API.
- Isolation is a property of the document (opaque origin), so it holds under
  fullscreen and when the content URL is opened directly, not only inside the loader.
- No new DNS, TLS, or deployment topology; works on single-host installs.
- The export pipeline is the shared `Html5Exporter`, avoiding a parallel renderer.

### Negative

- The server must build and serve the export (CPU/memory cost), addressed by the
  caching and cost guards in ADR-348-03.
- Opaque-origin content cannot use same-origin persistent storage; acceptable for a
  read-only viewer but a constraint for any future interactive public feature.

### Neutral

- A `compatible` CSP profile is the default; a `strict` profile is available as an
  opt-in (see Follow-up and ADR-348-03 references).
- The workarea preview keeps its same-origin Service Worker; only the public view is
  isolated.

## Risks

- **CSP too permissive by default (data exfiltration).** The `compatible` profile
  still allows external `https:` resources, so untrusted content could exfiltrate data
  it can already see within the opaque origin. Mitigation: the opaque origin already
  protects the *session*; a `strict` profile (`connect-src 'none'`, no open `https:`)
  is available for sensitive deployments.
- **Escaped popups.** `allow-popups-to-escape-sandbox` lets external links open
  un-sandboxed top-level windows; an escaped popup is a separate browsing context the
  opaque opener cannot script, so it does not reach the app origin.
- **Header/attribute drift.** Mitigated by the single-source-of-truth module and a
  unit test asserting the CSP `sandbox` tokens equal the iframe tokens.

## Validation

- Unit suites `src/shared/security/publicViewSandbox.spec.ts` and the
  `/view/:publicViewId/_/*` block in `src/routes/pages.spec.ts` are green.
- The E2E spec `test/e2e/playwright/specs/public-view-sandbox.spec.ts` asserts
  `window.origin === 'null'`, blocked parent access, and blocked cookies in a real
  browser.
- Manual check: opening `/view/:publicViewId/_/index.html` directly still returns the
  `Content-Security-Policy: sandbox …` header (R3).

## Follow-up work

- Consider promoting the `strict` CSP profile to default, or exposing it as an
  admin/per-project setting (study §6.3).
- Re-evaluate a dedicated user-content origin (Option 2) if a future public feature
  needs same-origin storage or stronger isolation.
- Per-IP rate limiting for the content route is left to the reverse proxy / dedicated
  middleware (see ADR-348-03).

## References

- Issue #348 — public read-only URL.
- PR #1425 — implementation.
- the change design — Public Read-Only Viewer with Opaque-Origin Untrusted-Content Isolation.
- ADR-348-02 — public view identifier and independent enablement flag.
- ADR-348-03 — export caching by Yjs document version and cost guards.
- `src/shared/security/publicViewSandbox.ts`, `src/routes/pages.ts`,
  `src/services/public-view-content.ts`, `views/viewer/viewer.njk`.
- `doc/architecture.md` §8.6.
