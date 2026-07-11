---
id: SDD-0002
title: "Opaque-origin editor preview and external-media relay"
status: In Review
date: 2026-07-09
authors:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  adrs: [ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0015]
  sdds: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# SDD-0002: Opaque-origin editor preview and external-media relay

## Status

In Review

<!-- The design is implemented on branch `fix/opaque-iframe-external-media`
(PR #1968) but not yet merged; it stays `In Review` until the PR is accepted,
after which it becomes `Implemented`. -->

> **Note — transport superseded by [ADR-0015](../adr/ADR-0015-opaque-http-preview-in-privileged-contexts-and-trusted-static-service-worker.md).**
> This design's Summary and provider description mention `srcdoc` as the
> no-backend transport. ADR-0015 **removed `srcdoc`** as an authored-content
> transport: privileged contexts (server, Electron, embedded) use opaque HTTP
> preview, and standalone static/PWA uses a same-origin `static-service-worker`
> transport documented as a trusted-content mode (not a security boundary). The
> opaque-origin isolation model and the external-media relay described below are
> unchanged; only the no-backend transport differs. The body below is preserved
> as the original design record and is not rewritten.

## Summary

The editor **preview** renders untrusted, author-authored package HTML/JS. This
design isolates that content in a **browser-enforced opaque origin**
(`sandbox="allow-scripts allow-popups allow-forms"`, never `allow-same-origin`,
plus a response-level `sandbox`-first CSP) so it cannot reach the editor DOM,
storage, app APIs, or the Electron preload bridge — **without** a separate
subdomain and **without** relying on a Service Worker to serve the frame. A
deterministic **provider** abstraction picks the transport per runtime (HTTP
capability URL on a server, `srcdoc` when there is no backend, `app://` in
Electron), and an **external-media relay** promotes cross-origin YouTube/Vimeo/PDF
embeds out of the opaque child to a trusted parent that overlays the real player
in place.

## Problem statement

Before this work the preview reused the same-origin Service Worker (`preview-sw.js`,
`/viewer/*`) to serve generated files into an iframe that kept `allow-same-origin`.
Author content therefore ran in the app origin and could read the editor DOM,
cookies, IndexedDB/Cache storage, the REST session, and — in Electron — the
`window.top.electronAPI` preload bridge (an arbitrary local-file read). A Service
Worker also **cannot** back an opaque-origin iframe (opaque origins are not
SW-controlled; the navigation and every subresource bypass it), so "just remove
`allow-same-origin`" was not possible with the SW transport. The goal is a
preview that is opaque by construction in every runtime, while external provider
embeds (which break under opacity) keep working.

## Goals

- Render preview content in an opaque origin in every context (cloud/server,
  Electron, embedded LMS, static/PWA), with no `allow-same-origin` in secure mode.
- No separate preview subdomain.
- No dependency on a Service Worker for opaque preview documents or subresources.
- Deterministic transport selection — no silent downgrade to same-origin.
- Keep external YouTube/Vimeo/Dailymotion/EducaMadrid/PDF embeds working via a
  trusted-parent relay, and keep the interactive-video/quick-questions-video
  programmatic media bridge working.
- Single source of truth for the sandbox tokens and CSP, mirrored to host plugins
  with a drift check.

## Non-goals

- Hardening **published/exported** package rendering inside host plugins (covered
  by the plugin secure-iframe PRs; this SDD is the editor-preview + relay contract
  those plugins consume).
- Solving SCORM/xAPI transport. The SCORM/xAPI bridge is maintained only in
  `mod_exelearning` and is explicitly out of scope of the embed-sync contract
  (`doc/development/EMBED-SYNC.md`).
- Replacing the Y.Doc HTML sanitizer; it is retained as defense-in-depth, not the
  sole isolation.
- A general third-party sandboxing library.

## Current state

Legacy preview (before this branch): `ServiceWorkerPreviewProvider` registered
`public/preview-sw.js` at `/viewer/*` and served generated files **same-origin**
with `allow-same-origin` on the iframe. That transport is now `opaqueSafe = false`
and reachable only via the explicit `legacy-sw` override
(`public/app/workarea/interface/elements/preview/ServiceWorkerPreviewProvider.js`
@ `7da657a31`). See the operational deep-dive in
[`doc/development/preview-architecture.md`](../../development/preview-architecture.md).

## Proposed design

Opacity is a property of the **iframe** (no `allow-same-origin`) reinforced by a
**response-level `Content-Security-Policy: sandbox …` header**, not of the
transport. One shared preview **client contract** + one **CSP source** are reused
across three opaque transports, selected deterministically:

| Runtime | Transport | Provider | Serving |
|---|---|---|---|
| Cloud / server editor | HTTP | `HttpPreviewProvider` | same-origin cookieless capability URL `/preview/{id}/*`, opaque via response CSP |
| Electron desktop | `app://` HTTP | `electron-preview-handler` | `app://localhost/preview/{id}/*` served in-process (no socket), cross-origin to the renderer |
| Embedded editor (LMS) | `srcdoc` (default) → HTTP (host opt-in) | `SrcdocPreviewProvider` / `HttpPreviewProvider` | self-contained opaque `srcdoc`, or a host-served endpoint per the serving contract |
| Static / PWA standalone | `srcdoc` | `SrcdocPreviewProvider` | self-contained opaque `srcdoc`, no server |
| Legacy (dev/interim) | Service Worker | `ServiceWorkerPreviewProvider` | same-origin, `opaqueSafe=false`, explicit `legacy-sw` override only |

See [ADR-0006](../adr/ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md)
(opaque sandbox) and
[ADR-0007](../adr/ADR-0007-provider-based-preview-transport-selection.md)
(provider selection).

## User experience

Preview looks and behaves as before: the panel renders the current page; intra-content
links navigate; "open in a new tab" works via a trusted host page; external videos
and PDFs play in place. The differences are invisible in the happy path; the
observable change is that preview content can no longer touch the editor and that
under `srcdoc` some runtime-URL features degrade (below).

## Technical design

- **Transport selection** — `public/app/core/previewTransport.js` +
  `selectPreviewProvider.js` (@ `7da657a31`): explicit `embeddingConfig.previewTransport`
  override → else `mode==='server'` → `http` → else Electron → `http` (`app://`) →
  else → `srcdoc`. Nothing returns `service-worker` except the `legacy-sw` override.
- **HTTP serving** — `src/routes/preview-session.ts` + `src/services/preview-session-manager.ts`:
  a content-addressed, per-session store behind an unguessable capability URL. See
  [ADR-0008](../adr/ADR-0008-serve-http-preview-via-cookieless-capability-sessions.md).
- **srcdoc fallback** — `SrcdocPreviewProvider.js` + `srcdocInliner.js`: each page's
  assets (CSS/JS/fonts/images/media/PDF) are inlined as `data:` URIs into one
  self-contained opaque document; multi-page navigation is parent-bridged via
  `postMessage` (`previewContentDecorators.js`, `previewPanel.js`).
- **Electron `app://`** — `src/services/electron-preview-handler.ts` + `app/main.js`:
  `protocol.handle('app', …)` routes `app://localhost/preview/{id}/*` and the
  management API to the same session manager, cross-origin to the `app://localhost`
  renderer. See [ADR-0011](../adr/ADR-0011-serve-electron-preview-over-app-opaque-transport.md).
- **Scriptable-type CSP** — `src/shared/security/previewSandbox.ts`
  (`previewCspHeader()`, `isScriptableDocumentType()`), emitted by both
  `preview-session.ts:214` and `electron-preview-handler.ts:93`. See
  [ADR-0009](../adr/ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md).
- **External-media relay** — `public/app/common/exe_embed_bridge/exe_embed_shim.js`
  (in the opaque child) + `exe_embed_relay.js` (in the trusted parent), started by
  `previewMediaHost.js` / `public/preview-tab.html`. See
  [ADR-0010](../adr/ADR-0010-promote-external-media-out-of-opaque-preview-frames.md).
- **Programmatic media bridge** — `public/app/common/exe_media_bridge/`
  (`exe_media_bridge.js`, `exe_media_policy.js`, `exe-media-host.js`) drives the
  interactive-video / quick-questions-video iDevices through a validated
  `MessageChannel` handshake.
- **Cross-repo canonical source + drift check** — `scripts/check-embed-sync.mjs`
  (bridge/shim/media + the `serving-contract` CSP parity). See
  [ADR-0012](../adr/ADR-0012-canonical-embed-bridge-and-serving-contract-with-drift-check.md).

### Preview session lifecycle, capability URL, manifest, verification

`preview-session-manager.ts` (@ `7da657a31`): `createSession` (per-owner LRU),
`stageManifest` (path normalization + traversal rejection → 400, file-count/byte
caps → 413), `storeBlobs` (**server-side SHA-256 re-hash of every blob**, drop on
mismatch, 409 on manifest race, per-session + global byte budgets with eviction),
atomic `promote` (active manifest swaps only when every blob is present), `getFile`
(active manifest only), and an idle-TTL sweeper. The capability URL is a
server-minted `crypto.randomUUID()`; the route is cookieless. See ADR-0008.

### External-media relay: shim / relay / new-tab / overlay

The shim self-activates only in an opaque origin, promotes each cross-origin-https
or `.pdf` iframe to a geometry placeholder, and reports geometry to the parent via
`postMessage({type:'exe-embed', action:'sync', …})`. The relay validates each URL
(strict allowlist + `open` mode), overlays the real player clamped to the
placeholder box, and tears down / reflows overlays on close, resize, and panel
slide. New-tab preview uses `public/preview-tab.html`, a same-origin host page that
frames the opaque content and runs the relay. Cross-origin PDFs are relayed into a
restricted `sandbox="allow-same-origin"` player; same-origin package PDFs render
unsandboxed. See ADR-0010.

## Data model

Preview session (in-memory, process-local): `{ id, ownerUserId, blobs: Map<sha256,
bytes>, activeManifest, pending, createdAt, lastAccessAt }`; manifest entries are
`{ sha256, size }` keyed by normalized content path. No DB or ELP/ELPX schema
changes.

## Migration and compatibility

Exported `.elpx`/website/SCORM packages are unchanged — preview-only decorators
(shim, teacher-mode) are injected into the preview HTML, never into real exports
(`previewContentDecorators.js`). The legacy Service Worker transport is retained
behind the `legacy-sw` override for the Electron interim and explicit opt-in; it is
never selected by default.

## Security and privacy

Threat model: preview renders **untrusted** author HTML/JS. The trust boundary is
the opaque origin — the browser denies the child same-origin DOM/storage/cookie
access and (in Electron) the preload bridge. Residual risks: (a) the `legacy-sw`
override and Electron interim are same-origin and must not ship enabled; (b) a
same-origin package PDF is served `application/pdf` + `nosniff`; (c) capability
URLs are unguessable + cookieless but process-local (multi-instance needs sticky
sessions). Every serving response sends `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Cache-Control: no-store`, a `Permissions-Policy`
deny-list, and `Access-Control-Allow-Origin: *` (sound only because the origin is
cookieless). Do **not** read the opaque frame from the parent via `contentDocument`.

## Accessibility

Promoted-embed placeholders preserve geometry so the overlaid player lands in place;
the media modal (`exe-media-host.js`) is an accessible `<dialog>`. Preview keeps the
editor's Teacher Mode selector available.

## Internationalization

No new user-facing strings of note; preview chrome reuses existing `_()`/`c_()`
strings.

## Performance

Content-addressed manifests re-upload only changed blobs; byte budgets bound a
session; `srcdoc` inlining is bounded by a per-page budget (over-budget assets keep
their original reference).

## Testing strategy

Unit: `previewTransport.test.js`, `selectPreviewProvider.test.js`, the three
provider tests, `fileManifest.test.js`, `srcdocInliner.test.js`,
`previewContentDecorators.test.js`, `previewMediaHost.test.js`,
`previewSandbox.spec.ts`, `preview-session-manager.spec.ts`,
`preview-session.spec.ts`, `electron-preview-handler.spec.ts`,
`exe_embed.test.js`, `exe_media_bridge.test.js`, `exe_media_policy.test.js`,
`exe-media-host.test.js`. E2E (Playwright): `opaque-preview.spec.ts`,
`preview-external-media-relay.spec.ts`, `preview-new-tab-srcdoc.spec.ts`,
`exe-media-bridge.spec.ts`. **Electron has a handler-level spec
(`electron-preview-handler.spec.ts`) but no full Electron E2E yet.**

## Rollout plan

Ship opaque HTTP (server) + `srcdoc` (embedded/static) + `app://` (Electron) as the
defaults on this branch; keep `legacy-sw` as an explicit, non-default override.
Host plugins adopt the serving contract on their own branches (see References).

## Risks and mitigations

- SW/opaque incompatibility in serverless php-wasm Playgrounds → documented; those
  demos use a dev-only same-origin hatch, not this opaque path.
- `srcdoc` fidelity gaps (runtime MathJax v4, 3D-STL fetch, unbudgeted media,
  no open-in-new-tab of a real URL) → HTTP transport avoids them; documented.
- Cross-repo CSP drift → `check-embed-sync.mjs` `serving-contract` check.

## Open questions

- When to retire the Electron interim same-origin path in favor of `app://` only.
- Whether to persist preview sessions for multi-instance HTTP deployments.

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Opaque-origin sandbox for preview content | [ADR-0006](../adr/ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) | Proposed |
| Provider-based transport selection | [ADR-0007](../adr/ADR-0007-provider-based-preview-transport-selection.md) | Proposed |
| Cookieless capability-URL HTTP session serving | [ADR-0008](../adr/ADR-0008-serve-http-preview-via-cookieless-capability-sessions.md) | Proposed |
| Sandbox CSP on every scriptable document type | [ADR-0009](../adr/ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) | Proposed |
| Promote external media to a trusted-parent relay | [ADR-0010](../adr/ADR-0010-promote-external-media-out-of-opaque-preview-frames.md) | Proposed |
| Electron `app://` opaque preview transport | [ADR-0011](../adr/ADR-0011-serve-electron-preview-over-app-opaque-transport.md) | Proposed |
| Canonical embed bridge + serving contract + drift check | [ADR-0012](../adr/ADR-0012-canonical-embed-bridge-and-serving-contract-with-drift-check.md) | Proposed |

## Evidence

All at `fix/opaque-iframe-external-media` @ `7da657a31`:
`public/app/core/previewTransport.js`, `.../preview/selectPreviewProvider.js`,
`HttpPreviewProvider.js`, `SrcdocPreviewProvider.js`, `ServiceWorkerPreviewProvider.js`,
`srcdocInliner.js`, `previewContentDecorators.js`, `previewMediaHost.js`,
`previewPanel.js`, `public/preview-tab.html`, `src/routes/preview-session.ts`,
`src/services/preview-session-manager.ts`, `src/services/electron-preview-handler.ts`,
`src/shared/security/previewSandbox.ts`, `app/main.js`,
`public/app/common/exe_embed_bridge/{exe_embed_shim.js,exe_embed_relay.js}`,
`public/app/common/exe_media_bridge/{exe_media_bridge.js,exe_media_policy.js,exe-media-host.js}`,
`scripts/check-embed-sync.mjs`. Operational docs:
`doc/development/preview-architecture.md`, `preview-serving-contract.md`,
`external-media-bridge.md`, `EMBED-SYNC.md`. Tests as listed under *Testing strategy*.

## Acceptance criteria

- [ ] Preview iframe carries no `allow-same-origin` in secure mode (all transports).
- [ ] HTTP/`app://` responses emit the sandbox CSP on every scriptable type.
- [ ] External YouTube/Vimeo/PDF embeds render via the relay; overlays tear down/reflow.
- [ ] `check-embed-sync.mjs` reports no drift (bridge + `serving-contract`).

## Implementation checklist

- [x] Provider transports + deterministic selection.
- [x] HTTP session manager + capability route + Electron `app://` handler.
- [x] srcdoc inliner + parent-bridged navigation.
- [x] Embed relay/shim + programmatic media bridge + new-tab host page.
- [x] Single-source CSP + scriptable-type detection + drift check.
- [ ] Full Electron E2E (follow-up).

## References

- PR #1968 (this branch).
- ADR/SDD workflow: PR #2149 (`docs/adr-sdd-workflow-proposal`).
- Related interactive-video design: SDD-0001 / PR #2147.
- Host-plugin serving-contract adopters: mod_exelearning #80, wp-exelearning #56,
  omeka-s-exelearning #21, nextcloud-exelearning #68, procomún #260.
- Operational docs under `doc/development/` (see *Evidence*).
