---
id: ADR-2620-01
title: "Serve the enabled Electron preview from the main process on a preview:// scheme"
status: Proposed
date: 2026-10-25
tracking_issue: 2620
deciders:
  - "@erseco"
reviewers: []
related:
  prs: [2620, 2199]
  changes: []
  adrs: [ADR-2199-01, ADR-2199-02, ADR-2199-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2620-01: Serve the enabled Electron preview from the main process on a preview:// scheme

## Context

The hybrid preview trust boundary ([ADR-2199-01](ADR-2199-01-hybrid-preview-trust-boundary.md))
isolates enabled author active content in an opaque origin: a capability URL served by eXe
or by the embedding host ([ADR-2199-02](ADR-2199-02-serve-the-enabled-preview-from-an-opaque-capability-snapshot.md)),
or a sandboxed `srcdoc` document where there is no server
([ADR-2199-04](ADR-2199-04-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)).
Electron was the one runtime where enabling stayed **blocked**: the editor window is loaded
from `app://localhost` with a preload that exposes `electronAPI` (file dialogs, file reads
under grants, print, link checks), and the preview iframe shared that window's renderer
process. By DOM rules a cross-origin frame cannot reach `top.electronAPI`, and the preload is
injected only in the main frame; the residual concern was a renderer compromise in the
preview reaching the main process over IPC from the same process family.

Authors do need to see their scripts run on the desktop, and the desktop is also the
runtime where the inlined `srcdoc` transport has the least to offer: MathJax does not
typeset in an inlined document, PDFs become links, and every refresh re-inlines ~2.6 MB.

## Problem

How can the Electron preview run author active content in a browser-enforced opaque origin,
served with full fidelity, without exposing the preload bridge or any privileged IPC channel
to that content — even if the preview renderer is compromised?

## Decision drivers

- No author JavaScript with the editor's origin or with access to `electronAPI`, in the
  iframe or in any window it opens.
- Full-fidelity serving (relative URLs, runtime-loaded components such as MathJax, PDFs)
  rather than inlining.
- Reuse the capability-snapshot contract: same client lifecycle, same headers, same sandbox
  tokens as the HTTP route.
- Process isolation on top of origin isolation where the platform gives it.
- Fail closed for an older preload that lacks the bridge.

## Options considered

### Keep Electron blocked

The safe default, but it leaves the desktop — the most common authoring runtime — unable to
show author scripts at all. Rejected now that an isolating transport exists.

### Reuse the `srcdoc` transport in Electron

Zero new infrastructure and the same DOM-level boundary (`about:srcdoc` sandboxed is opaque
to `app://localhost`). Rejected as the primary transport: it inherits the inlining limits
(MathJax, PDFs, size) in the runtime with the most to lose, and a sandboxed `srcdoc` frame is
not guaranteed its own renderer process.

### Same-origin execution after consent

Rejected, as everywhere else in the boundary: consent is not an origin, and in Electron the
editor origin holds the preload.

### A second privileged scheme served by the main process (chosen)

The main process is a server. Register `preview` as a `standard`, `secure` scheme, answer
`preview://{id}/{path}` from an in-memory snapshot with the capability route's headers, and
hand the renderer a `preview://{id}/index.html` URL for the same sandboxed iframe. The origin
differs from `app://localhost` by scheme and by host; the sandbox makes the document opaque
on top; and Chromium's site isolation places the cross-origin frame in another renderer
process.

## Evidence

Measured with Playwright `_electron` on Electron 44.8.0 (macOS, 2026-10-25;
`test/e2e/electron/preview-scheme.spec.ts`, `make test-e2e-electron`):

| Probe | Result |
|---|---|
| iframe `src` after enabling | `preview://{32 hex}/index.html`; `sandbox` without `allow-same-origin` |
| author `<script>` and `onerror` handler | run (`data-marker`, `data-handler` set) |
| MathJax in the author content | typesets (`mjx-container` present) — the loader's runtime fetches are served by the scheme |
| `location.href` / `window.origin` inside the frame | `preview://…/index.html` / `"null"` (opaque) |
| `typeof window.electronAPI` / `typeof top.electronAPI` | `undefined` / `SecurityError` |
| `parent.document`, `localStorage`, editor-origin IndexedDB sentinel | `SecurityError` / unreadable |
| renderer process ids (`webFrameMain.processId`) | editor `app://localhost` → **4**, preview frame → **5** |
| "open in a new tab" window | URL `preview://…`, `window.origin === "null"` (response CSP `sandbox`), `typeof electronAPI === "undefined"`, `window.opener === null` |
| capability URL after disabling (`net.fetch` from the main process) | `404` |

Code: `app/preview-snapshot-scheme.js` (store + response builder, pure; its spec asserts the
sandbox tokens and scriptable types equal `src/shared/security/previewSandbox.ts`),
`app/ipc-sender-guard.js` (sender validation), `app/main.js` (scheme privileges,
`protocol.handle`, IPC channels, window policy), `app/preload.js`
(`electronAPI.previewSnapshot`), `public/app/workarea/interface/elements/preview/ElectronPreviewSnapshot.js`
(renderer client), `public/app/utils/previewContentPolicy.js` (`ELECTRON_OPAQUE`),
`src/shared/preview/preview-mode-matrix.ts` (electron → `opaque-capability`).

## Decision

We will serve the enabled Electron preview from the main process on the `preview://` scheme,
with the following contract:

- **Scheme.** `preview` is registered privileged with `standard`, `secure`, `supportFetchAPI`
  and `stream`; no Service Workers, no CORS. `preview://{id}` is therefore a real origin,
  distinct from `app://localhost`.
- **Snapshot store.** One snapshot per window (`WebContents` id as owner), 128-bit random id,
  files materialized before an atomic swap, a replace keeps the id so the iframe URL stays
  valid, a size cap, disposal on request and when the owning `WebContents` is destroyed.
- **Responses.** Same hardening as the HTTP capability route: `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cache-Control: no-store`,
  and `Content-Security-Policy: sandbox …` on every scriptable type (HTML, XHTML, SVG, XML,
  PDF) so a snapshot opened in its own window stays opaque. The token list is asserted equal
  to the TypeScript owner.
- **Renderer.** `electronAPI.previewSnapshot.replace(previewId, files)` /
  `dispose(previewId)` over IPC; `ElectronPreviewSnapshot` validates that the returned URL is
  `preview://{previewId}/…` and applies the shared sandbox tokens. The transport is
  `electron-opaque`; a preload without the bridge resolves to `electron-blocked` and the
  grant is refused (fail closed, same dialog as before).
- **IPC guard.** Every `ipcMain` registration (`handle`, `on`, `once`) goes through
  `guardIpcMain`: the sender must be the main frame of a window whose URL origin is
  `app://localhost`. A preview document never holds `ipcRenderer`; the guard covers a
  compromised process addressing channels directly.
- **Windows.** `setWindowOpenHandler` creates a `preview://` target itself as a sandboxed
  window **without the preload** (whatever opened it), confines its navigation to the scheme
  and sends external links to the system browser; anything the opaque preview tries to open
  that is not external is denied, so no window with the preload is ever handed to author
  content. YouTube's referer rewrite covers `preview://` like `app://`.

## Consequences

### Positive

- Desktop authors see their scripts run, with the fidelity of a served snapshot (MathJax,
  PDFs, relative URLs) rather than an inlined page.
- Three boundaries stack: scheme+host origin, iframe/CSP sandbox, renderer process.
- Every IPC channel is now sender-checked, independent of the preview.

### Negative

- The main process holds the snapshot in memory for as long as the preview is enabled
  (bounded by the cap and by the window's life).
- A full snapshot crosses IPC on every refresh while enabled (structured clone of the file
  map); acceptable for an opt-in, temporary transport.
- `Range` requests are answered with the whole body; large local video seeks re-download.

### Neutral

- The default filtered Service Worker preview is unchanged.
- Web/server, embedded and static transports are unchanged.

## Risks

- **Scheme privileges drift.** Adding `allowServiceWorkers` or `corsEnabled` to the scheme
  would widen what the snapshot origin can do; the registration is documented in place.
- **Window policy drift.** A future `setWindowOpenHandler` branch that allows a preview
  opener to get a preload-bearing window reopens the bridge; the policy is one function with
  comments, and the E2E asserts `typeof electronAPI === 'undefined'` in the popup.
- **Guard bypass by a trusted window.** The guard trusts the main frame of `app://localhost`
  windows; author content never runs there (the filtered preview strips it), and the
  editor-DOM render surfaces are the subject of `hotfix/idevice-render-xss`.

## Validation

- `app/preview-snapshot-scheme.spec.ts` — store ownership, replace/dispose, caps, 404s,
  headers, CSP per type, token/type drift against `previewSandbox.ts`.
- `app/ipc-sender-guard.spec.ts` — main-frame/origin acceptance, rejection of subframes,
  `preview://`, `about:srcdoc`, blob, one-shot survival.
- `app/preload.spec.js` — channel names.
- `public/app/workarea/interface/elements/preview/ElectronPreviewSnapshot.test.js`,
  `previewPanel.test.js`, `previewContentPolicy.test.js`,
  `src/shared/preview/preview-mode-matrix*.spec.ts` — transport resolution, fail-closed,
  dispose paths, matrix agreement.
- `test/e2e/electron/preview-scheme.spec.ts` — the table above, in the real app.

## Follow-up work

- Honour single-byte `Range` requests in `serve()` for large local media.
- Consider `nodeIntegrationInSubFrames`-style assertions in CI if the window creation code
  grows.

## References

- `app/preview-snapshot-scheme.js`, `app/ipc-sender-guard.js`, `app/main.js`, `app/preload.js`
- `public/app/workarea/interface/elements/preview/ElectronPreviewSnapshot.js`
- `test/e2e/electron/preview-scheme.spec.ts`, `playwright.electron.config.ts`
- [ADR-2199-01](ADR-2199-01-hybrid-preview-trust-boundary.md),
  [ADR-2199-02](ADR-2199-02-serve-the-enabled-preview-from-an-opaque-capability-snapshot.md),
  [ADR-2199-04](ADR-2199-04-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)
- [Electron: `protocol.registerSchemesAsPrivileged`](https://www.electronjs.org/docs/latest/api/protocol#protocolregisterschemesasprivilegedcustomschemes),
  [Electron security: IPC sender validation](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages)
