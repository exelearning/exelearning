---
id: ADR-0015
title: "Use opaque HTTP preview in privileged contexts and a trusted same-origin Service Worker in standalone static/PWA"
status: Proposed
date: 2026-07-11
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002, SDD-0003]
  adrs: [ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0011, ADR-0013]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0015: Use opaque HTTP preview in privileged contexts and a trusted same-origin Service Worker in standalone static/PWA

## Status

Proposed

<!-- This ADR refines, and does not overturn, ADR-0006 and ADR-0007. ADR-0006's
opaque-origin requirement and ADR-0007's deterministic, no-silent-downgrade
selection principle both stand; this record removes the `srcdoc` authored-content
transport and reduces the provider set. See the amendment notes on ADR-0006/0007. -->

## Context

The editor preview renders **untrusted, author-authored package HTML/JS**. ADR-0006
established that this content must run in a **browser-enforced opaque origin** so it
cannot reach the editor DOM, cookies, IndexedDB/Cache storage, the authenticated
session, or (in Electron) the preload bridge. ADR-0007 established that the transport
is chosen through a deterministic provider abstraction with **no silent downgrade**
to same-origin.

While implementing PR #1968 across the whole ecosystem (core, Electron, and the
Moodle/WordPress/Omeka S/Nextcloud/Procomún embedding hosts), four facts settled the
remaining transport questions:

- **A Service Worker cannot back an opaque origin.** It intercepts same-origin
  fetches, so any SW-served preview is same-origin by construction — it can never be
  the opaque sandbox ADR-0006 requires.
- **`srcdoc` required expensive, incomplete inlining.** Serving authored content
  through `iframe.srcdoc` meant rewriting every asset/document reference into inlined
  or blob form. It was lower-fidelity (no real per-page URLs, open-in-new-tab, or
  runtime-URL features), and every new authored construct risked a new inlining gap.
- **Server-backed environments give real URLs and a response-level sandbox.** A
  cloud/server editor, Electron (`app://`), and every embedding host with a backend
  can serve preview over a **real HTTP capability URL** and attach a `sandbox`-first
  CSP to every scriptable response (ADR-0008, ADR-0009). This is opaque, high-fidelity,
  and needs no second domain.
- **Standalone static/PWA has no backend.** A pure static build or an offline PWA has
  nothing that can mint a capability session or serve a response with headers. Its only
  local serving mechanism is a Service Worker — which is same-origin, hence not opaque.

This ADR records the final transport matrix that resolves those facts, superseding the
earlier assumption (carried in ADR-0006/0007) that `srcdoc` and an implicitly-selected
Service Worker were viable authored-content transports.

## Problem

Given the opaque-origin requirement (ADR-0006) and the no-silent-downgrade rule
(ADR-0007), which transport serves preview in each runtime — and what is the honest
security posture where no opaque transport is possible (standalone static/PWA)?

## Decision drivers

- Security: untrusted authored content must be isolated wherever the editor origin
  holds credentials or privileged capabilities.
- Fidelity: preview should match a real deployment (real URLs, navigation, runtime URLs).
- No silent downgrade: an unavailable opaque transport must fail closed, never quietly
  serve same-origin.
- No second domain / no bundled web server for static builds (ops and project constraints).
- Honesty: any residual same-origin exposure must be documented, not hidden.

## Options considered

### Option A (chosen): opaque HTTP in privileged contexts; trusted same-origin SW only in standalone static/PWA

Server/cloud, Electron, and embedded hosts serve preview over an **opaque HTTP
capability URL** (`http` provider) with a response `sandbox` CSP. Standalone static
and offline PWA builds — which have no backend — use a **same-origin Service Worker**
preview, explicitly labelled a **trusted-content compatibility mode**, not a security
boundary. `srcdoc` is removed as an authored-content transport. Embedded hosts **fail
closed** if the host does not supply a valid HTTP preview configuration. Selection is
deterministic; the Service Worker is **never** chosen automatically in an embedded or
server context.

Pros: opaque isolation everywhere a backend exists; high fidelity; no second domain;
no bundled server; the one unavoidable same-origin case is isolated to standalone
static/PWA and documented. Cons: standalone static/PWA does not isolate malicious
authored scripts (accepted, documented, and constrained to trusted content).

### Option B: `srcdoc` full inlining everywhere without a backend

Reject. Lower fidelity, perpetually incomplete inlining, and it still would not help
the embedded case where a real URL and host auth are wanted.

### Option C: a dedicated second preview origin/subdomain

Reject. DNS/cert/ops burden, still same-site cookie exposure risk, and rejected as a
standing project constraint (ADR-0006 Option 3).

### Option D: a WASM/php-wasm web server inside the static build

Reject. Large runtime, complex, and php-wasm playgrounds are served by a Service
Worker — so the served frame is same-origin anyway; it does not produce an opaque
origin.

### Option E: a JavaScript HTTP server in the page (e.g. the SW acting as a pseudo-server)

Reject. Same fundamental limit as Option D/the SW: anything the page or its Service
Worker serves is same-origin and cannot be opaque.

### Option F: per-iDevice JavaScript sandboxes (sanitize/wrap each script)

Reject. Sanitizer/wrapper bypasses are a moving target; not a browser-enforced
boundary. The Y.Doc sanitizer is retained as defense-in-depth only (ADR-0006).

### Option G: a Service-Worker-controlled opaque iframe

Reject as impossible. A Service Worker only controls same-origin clients; an opaque
(cross-origin/sandboxed-without-`allow-same-origin`) frame is outside its scope, so it
can neither be intercepted nor served by the SW.

## Evidence

At `fix/opaque-iframe-external-media` (transport simplification landed in
`4e2f5dd8`..`cfde1340`; normalized HTTP config in `2737dcf0`; canonical Range +
bare-root redirect in `36f2787d`):

- Deterministic selection with `srcdoc` removed and the SW constrained to standalone
  static/PWA: `public/app/core/previewTransport.js`,
  `public/app/workarea/interface/elements/preview/selectPreviewProvider.js`
  (`validatePreviewHttpConfig`; embedded fail-closed; `static-service-worker` only for
  standalone static/PWA).
- Providers: `HttpPreviewProvider.js` (opaque HTTP, protocol v2),
  `StaticServiceWorkerPreviewProvider.js` (`opaqueSafe = false`, standalone static/PWA
  only); the former `SrcdocPreviewProvider` is deleted (grep-clean in `public/app/`).
- Opaque sandbox tokens + response `sandbox` CSP:
  `src/shared/security/previewSandbox.ts`, emitted by
  `src/routes/preview-session.ts` and `src/services/electron-preview-handler.ts`.
- Normalized host HTTP contract, per-host management CSRF, bare-root 302, and canonical
  Range: `doc/development/preview-serving-contract.md`; PR #1968 and the host PRs
  mod_exelearning#80, wp-exelearning#56, omeka-s-exelearning#21,
  nextcloud-exelearning#68, procomun#260.
- Layered incremental sync and cookieless capability sessions: ADR-0013 / SDD-0003,
  ADR-0008.

## Decision

We will select the preview transport as follows and remove `srcdoc` as an
authored-content transport:

| Runtime | Transport | Posture |
|---|---|---|
| Cloud / server editor | opaque HTTP preview (v2), `previewHttp` | opaque |
| Electron | `app://` opaque HTTP-equivalent (v2) | opaque / cross-origin |
| Embedded (Moodle / WordPress / Omeka S / Nextcloud / Procomún) | host HTTP preview (v2) via injected `previewHttp` | opaque; **fail closed** if config is missing or invalid |
| Standalone static build / offline PWA | same-origin Service Worker (`static-service-worker`) | **trusted-content mode — not a security boundary**; `opaqueSafe = false` |
| php-wasm playgrounds | disabled, or an explicit dev-only unsafe opt-in with a visible warning | never silent |

Rules: selection is deterministic; an embedded editor **never** selects the Service
Worker automatically; a missing/invalid embedded `previewHttp` **fails closed** with a
clear error and no fallback; there is **no silent downgrade** to same-origin anywhere.
Trusted, escaped, script-free error markup in `iframe.srcdoc` is permitted and is not a
transport.

## Security statement (standalone static/PWA)

**The standalone static/PWA Service Worker preview is not a security sandbox. It is
intended for trusted projects. An imported ELPX containing malicious JavaScript may be
able to access or modify data belonging to the editor origin.**

Because this transport is same-origin, the preview additionally renders external media
**directly** (there is no opaque media relay — the relay exists only for the opaque
transports; ADR-0010), which is consistent with, and part of, the trusted-content
posture.

## Deployment guidance

- Prefer a **dedicated origin** for a standalone static/PWA editor when practical.
- **Never** serve a standalone static/PWA editor from an origin shared with an
  authenticated application: in Service-Worker (static) mode, authored scripts run
  same-origin and can reach that origin's data.
- **Warn the user before opening an untrusted ELPX** in a standalone static/PWA build.
- **Service-Worker mode is not opaque mode.** Do not treat the two as equivalent when
  reasoning about isolation.
- **"No login" does not eliminate the risk.** An origin without authentication can
  still hold IndexedDB/Cache/localStorage data belonging to the editor that malicious
  authored scripts could read or modify.

## Consequences

### Positive

- Less code and fewer hacks: one opaque HTTP path replaces the `srcdoc` inlining
  machinery (the preview panel shed a large amount of transport-specific code in
  PR #1968).
- Higher static fidelity everywhere a backend exists: real per-page URLs,
  open-in-new-tab, and runtime-URL features.
- Real capability URLs plus a response-level `sandbox` CSP give strong,
  browser-enforced isolation in every context that holds credentials.

### Negative

- Standalone static/PWA does **not** isolate malicious authored scripts; the
  trusted-content policy must be communicated to deployers and users.
- The php-wasm playground preview is either unavailable or available only behind an
  explicit, visibly-warned unsafe opt-in.

### Neutral

- The Service Worker preview survives, renamed and constrained (`static-service-worker`,
  `opaqueSafe = false`), as a documented compatibility mode rather than a default.
- Electron `app://` and cookieless HTTP capability sessions remain first-class opaque
  transports (ADR-0008, ADR-0011).

## Risks

- A deployer could host a standalone static/PWA editor on a shared authenticated origin
  and open untrusted content. Mitigation: the security statement and deployment guidance
  above; `opaqueSafe = false` surfaced in the client; a visible warning banner when the
  `static-service-worker` transport is forced in an embedded context.
- A future contributor could reintroduce `srcdoc` or an implicit SW selection.
  Mitigation: grep-clean removal, deterministic selection tests, and this ADR.

## Validation

- Transport selection unit tests (`previewTransport.test.js`,
  `selectPreviewProvider.test.js`) assert `srcdoc` is gone, embedded fails closed, and
  the Service Worker is never selected implicitly.
- The static-transport E2E suite exercises the `static-service-worker` path.
- Host PRs demonstrate opaque HTTP serving and fail-closed embedded selection.

## Follow-up work

- Ship a core editor release carrying `HttpPreviewProvider` +
  `bundles/preview-fixed-resources.json` so hosts can activate HTTP preview end-to-end.
- Re-vendor the conformance vectors into the hosts for the serving-contract §4 deltas
  (bare-root 302, canonical Range).

## References

- ADR-0006 (opaque-origin sandbox — refined here for the transport matrix),
  ADR-0007 (provider selection — refined here: `srcdoc` removed, SW constrained),
  ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0013.
- SDD-0002 (threat model; its `srcdoc` transport is removed by this ADR), SDD-0003.
- PR #1968 and host PRs mod_exelearning#80, wp-exelearning#56,
  omeka-s-exelearning#21, nextcloud-exelearning#68, procomun#260.
- `doc/development/preview-architecture.md`, `doc/development/preview-serving-contract.md`.
