# Preview Architecture — Opaque Editor Preview Without a Separate Origin

The editor preview renders **untrusted authored content**: an imported `.elpx`
can carry arbitrary HTML/JS. To keep that content from reaching the editor
session (its DOM, cookies, IndexedDB with every project — and, when the editor
is embedded, the LMS/CMS admin origin), the preview iframe runs in an
**opaque origin**: `sandbox="allow-scripts allow-popups allow-forms"` with no
`allow-same-origin`. No separate subdomain is used — everything is same-origin.

The transport decision and the honest security posture per runtime are recorded
in [ADR-0015](../architecture/adr/ADR-0015-opaque-http-preview-in-privileged-contexts-and-trusted-static-service-worker.md)
(which refines ADR-0006 and ADR-0007). The one case that is **not** an opaque
origin — standalone static/PWA — is called out explicitly below.

## Why the Service Worker preview cannot serve an opaque iframe

The historical preview served a virtual `/viewer/*` filesystem from
`public/preview-sw.js`. That transport **cannot** back an opaque iframe, and
this is by design across browsers — not a fixable bug:

- `navigator.serviceWorker` is `undefined` inside a sandbox-without-
  `allow-same-origin` document (WPT `sandboxed-iframe-navigator-serviceworker`).
- The opaque document is never a *controlled client*, so its subresource
  requests (CSS/JS/img/fonts) bypass the Service Worker and hit the network.
  Chromium's own layout test (`sandboxed-iframe-fetch-event`) asserts no
  interception without `allow-same-origin`; Firefox never intercepts sandboxed
  iframes (Bugzilla 1279406); the spec gap is acknowledged in
  w3c/ServiceWorker#1390 and the only proposed fixes (whatwg/html#10585
  `inherit-controller`) are unimplemented.
- Navigation interception has historically been inconsistent (crbug 486308),
  producing the tell-tale symptom "HTML loads but CSS is missing".
- `credentialless`, the `csp` iframe attribute, and `srcdoc` do **not** change
  Service Worker controllability.

A prior attempt to flip the preview to opaque while keeping the Service Worker
was reverted for exactly this reason (the browser logs *"Service worker is
disabled because the context is sandboxed and lacks the allow-same-origin
flag"* and assets fall through to the network, receiving the SPA `index.html`
and failing strict MIME checks). `test/e2e/playwright/specs/preview-sw-opaque-negative.spec.ts`
documents this behavior as a permanent regression guard.

This is the central fact behind the transport matrix: **an opaque preview
requires a real serving backend** (a server, Electron `app://`, or a host
route). A build with no backend cannot produce an opaque preview at all — its
only local serving mechanism is a same-origin Service Worker, which is not
opaque. Two further constraints follow:

- An opaque-origin child **cannot load a parent-created `blob:` URL**, so there
  is no client-side, server-less way to bootstrap an opaque preview.
- An opaque iframe sends **no SameSite cookies**, so any HTTP serving route must
  be an authless capability URL.

## Transports (the provider abstraction)

`public/app/workarea/interface/elements/preview/` defines one provider per
transport; `PreviewPanelManager` stays the orchestrator (it owns the DOM and
the postMessage contract) and delegates transport to the selected provider.
Selection is deterministic (`public/app/core/previewTransport.js`) — there is
**no runtime probing and no fallback chain**: an unavailable or misconfigured
transport surfaces an error instead of silently downgrading to a same-origin
preview.

Two transports remain (`srcdoc` was removed):

| Runtime | Transport | Opaque | Notes |
|---|---|---|---|
| Server (web editor) | `HttpPreviewProvider` | yes | `previewHttp` defaults to `{basePath}/api/preview-session` (management) + `{basePath}/preview` (serving); iframe loads `/preview/{id}/index.html`. |
| Electron | `HttpPreviewProvider` (`app://localhost`) | yes | Main process serves `app://localhost/preview/{id}/*` (`protocol.handle` → `electron-preview-handler`), cross-origin to the `app://localhost` renderer, so author JS cannot reach `window.top.electronAPI` ([ADR-0011](../architecture/adr/ADR-0011-serve-electron-preview-over-app-opaque-transport.md)). |
| Embedded editor (Moodle/WP/Omeka/Nextcloud/Procomún) | `HttpPreviewProvider` via the host's injected `previewHttp` | yes | **Fails closed** when the host supplies no valid `previewHttp` block — the panel shows an error, never a same-origin preview. |
| Static / PWA standalone | `StaticServiceWorkerPreviewProvider` | **no** | Same-origin `/viewer/*` Service Worker. A **trusted-content compatibility mode, not a security boundary** (`opaqueSafe = false`). Never selected automatically for an embedded editor. |
| Explicit override | `embeddingConfig.previewTransport` = `http` \| `static-service-worker` | — | Unknown values throw (no fallback). `static-service-worker` inside an **embedded** editor is a **dev-only unsafe opt-in** (playground blueprints only): honored, but the panel renders a visible warning banner; hosts must never set it in production. |

### HTTP transport — opaque capability sessions (protocol v2)

- The preview is split into **three layers with different lifecycles**
  ([ADR-0013](../architecture/adr/ADR-0013-sync-http-preview-as-layered-resources-with-atomic-incremental-revisions.md),
  [preview-serving-contract.md](preview-serving-contract.md)):
  **fixed installation resources** (official libraries, base themes, base
  iDevice runtimes, PDF.js) are never uploaded — the serving route resolves
  them through a build-generated manifest (`preview-fixed-resources.json`) via
  the revision's `fixedRefs` map; **project assets** upload once per session
  under an immutable `{assetId}@{hashPrefix}` key taken from the asset
  metadata the Yjs model already stores (no per-refresh hashing); **generated
  documents** (page HTML, generated CSS/JS, user themes) are published as
  atomic incremental revisions (`baseRevision`/`nextRevision`/`writes`/
  `deletes`) — a text edit transfers roughly the changed page, nothing else.
- Authenticated **management** API and authless **serving** capability URL are
  configured by a normalized `previewHttp` block (two URLs + optional host CSRF
  via `managementHeaders`/`managementQuery`); the server and Electron derive the
  same-origin defaults automatically, and embedded hosts inject their own. The
  full wire contract — create/assets/revisions/delete, the `409` recovery with
  deletions, the bare-root `302` redirect, canonical `Range`, and the byte-
  identical sandbox CSP — lives in
  [preview-serving-contract.md](preview-serving-contract.md).
- Every serving response carries `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, a `Permissions-Policy` deny-list, and
  `Access-Control-Allow-Origin: *` (opaque frames make CORS-mode requests with
  `Origin: null`; the route is authless/cookieless, so this adds no exposure).
  `Cache-Control` is tiered (documents `no-store`; assets `no-cache` + `ETag`
  with `304` revalidation and `Range`; fixed resources
  `private, max-age=31536000`). Scriptable responses (HTML, SVG, XML, XHTML)
  additionally get
  `Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms; …`
  so the document stays opaque even if the capability URL is opened directly.
- Client-side, refreshes are incremental: Yjs change events are classified
  (page-content vs structure vs theme vs metadata vs assets) into a dirty
  scope, only invalidated documents are regenerated (byte-diffed against the
  previous revision before upload), and the refresh queue is single-flight
  with coalescing — an edit landing mid-refresh marks a pending rerun instead
  of being dropped. Adding a new asset (a new export path) invalidates all
  rendered pages; a same-path content replacement stays asset-only.
- Sessions are process-local and die on restart; the client transparently
  recreates a session on any `404` (clearing its uploaded-asset bookkeeping).
  Under a future multi-instance deployment this requires sticky sessions.
- The sandbox tokens and CSP live in `src/shared/security/previewSandbox.ts`
  (re-exported into the browser bundle so the iframe attribute and the response
  header never drift).

### Static / PWA standalone — trusted-content Service Worker mode

A pure static build or an offline PWA has **no backend**, so — per the section
above — it cannot produce an opaque preview. Its only local serving mechanism is
the same-origin `/viewer/*` Service Worker (`StaticServiceWorkerPreviewProvider`,
`opaqueSafe = false`). This is a **trusted-content compatibility mode, not a
security boundary**:

> **The standalone static/PWA Service Worker preview is not a security sandbox.
> It is intended for trusted projects. An imported ELPX containing malicious
> JavaScript may be able to access or modify data belonging to the editor
> origin.** (ADR-0015)

Because this transport is same-origin, the Y.Doc sanitizer is the only isolation
there, and **external media renders directly** — there is no relay (the relay
exists only for the opaque transports; see [External media](#external-media)).
Deployment guidance (dedicated origin where practical; never a shared
authenticated origin; warn before opening untrusted ELPX; "no login" does not
remove the risk) is in ADR-0015. This transport is **never** selected
automatically for an embedded editor; forcing it there via
`previewTransport: 'static-service-worker'` is a dev-only unsafe opt-in that
raises a visible warning banner (`isUnsafeEmbeddedServiceWorker`).

### Serverless & php-wasm Playgrounds (demo environments)

Plugin **Playgrounds** — WordPress / Moodle / Omeka S / Nextcloud running the whole
CMS in the browser via **php-wasm** — are the extreme serverless case: there is **no
real HTTP server at all**; the entire site (including any plugin serving route) is
emulated by a **Service Worker**. Since a Service Worker cannot serve or control an
opaque-origin document or its subresources (the same limitation as §"Why the Service
Worker preview cannot serve an opaque iframe"), an opaque iframe pointed at a
host capability URL simply **bypasses the SW and 404s** against the static host.

The environment map is therefore:

- **Editor preview** — an embedded editor in a Playground has no opaque backend, so
  it either omits `previewHttp` (and the panel fails closed) or, for a demo only, is
  pointed at the dev-only `static-service-worker` opt-in with its visible warning
  banner. Never in production.
- **Published content** — the CMS flows point an iframe at a host serving route the
  Playground cannot serve opaquely. For the demo only, the **host plugins** fall back
  to a plugin-side, published-viewer escape hatch (`EXELEARNING_UNSAFE_LEGACY_IFRAME`)
  that renders same-origin. This constant is **plugin-side only — eXe core defines no
  such flag** — and it must be off by default, never a normal admin/UI setting, loudly
  documented as unsafe, and covered by a test proving it is not enabled by default.
  Every real deployment (cloud, Electron, embedded LMS) stays opaque and never uses it.

See the host contract in
[preview-serving-contract.md](preview-serving-contract.md); the shared preview CSP is
drift-checked across every host by the `serving-contract` kind in
[EMBED-SYNC.md](EMBED-SYNC.md).

## Script-injection parity

The Service Worker injected external-link/PDF/navigation scripts at serve time.
The opaque HTTP transport has no Service Worker, so `previewContentDecorators.js`
bakes the equivalents into the HTML client-side, **before** the upload diff
(decoration only runs for regenerated documents; decorated bytes are what the
delta compares and the session serves). On the static/PWA `static-service-worker`
transport the Service Worker still serves the pages, so `preview-sw.js` injects
the same-origin navigation reporter (`exe-preview-nav`) for parity. The shared
exporter output is left untouched, so real exports never carry preview-only
scripts.

## postMessage contract

The preview renders untrusted content, so every message is gated on the
browser-enforced **source-window identity** (`event.source ===
iframe.contentWindow`) — never on `event.origin`, which is `'null'` for opaque
frames — and every field is validated (`providerContract.sanitizePagePath`
rejects protocol URLs, protocol-relative URLs, oversized values and
root-escaping paths). Message types: `exe-preview-nav` (child→parent, reports
the rendered page so auto-refresh reloads the same page), `exe-preview-navigate`
and `exe-preview-open-document` (in-frame navigation / document opening),
`exe-download-elpx` (existing), and `exe-print` (parent→child, print modal).

## Dropped sandbox tokens

Relative to the old same-origin preview, the opaque sandbox drops:

- `allow-same-origin` — the whole point (isolates untrusted content).
- `allow-modals` — content `alert()`/`confirm()` become no-ops (accepted). The
  **print-preview** modal keeps `allow-modals` solely so `window.print()` works,
  triggered by an in-frame `exe-print` postMessage bridge.
- `allow-downloads` — in-content `<a download>` and the in-frame PDF.js download
  button are blocked. The parent-side `exe-download-elpx` flow is unaffected.
- `allow-presentation` — accepted.

## External media

Cross-origin embeds (YouTube, Vimeo, …) cannot render inside an opaque frame, so
on the **opaque transports** they are relayed to the trusted parent (the editor)
— automatically, **with no click**, exactly like the host plugins. (On the
same-origin `static-service-worker` transport there is no opacity to defeat, so
external media renders directly and no relay runs — part of that transport's
trusted-content posture.) Two cooperating mechanisms, both with their canonical
source in eXe core (`public/app/common/exe_embed_bridge/` and
`.../exe_media_bridge/`); the plugins mirror them:

- **Declarative embeds** (plain `<iframe src="youtube…">` in the content) use the
  **embed relay**: `exe_embed_shim.js` runs inside the opaque preview iframe and
  replaces each cross-origin/PDF iframe with a geometry-reporting placeholder;
  `exe_embed_relay.js` (started once by `previewMediaHost.js` in the editor)
  overlays the real player positioned over that placeholder, tracking scroll and
  resize. No click, in-place — the plugin behavior. The shim is injected into
  preview pages by the decorators as a same-origin `<script src>`.
  `exe_media_bridge.js` detects the shim (`window.exeEmbedShim`) and defers, so
  declarative embeds are never turned into click-placeholders.
- **Programmatic media** (the interactive-video iDevice, which drives question
  timing) keeps using the **media bridge** (`exe_media_bridge.js` +
  `exe-media-host.js`) over a `MessageChannel` to a parent-side player. See
  [external-media-bridge.md](external-media-bridge.md).

Because declarative embeds are promoted OUT of the opaque child to the parent,
the preview response CSP `frame-src` stays minimal (only the interactive-video
fallback hosts `youtube-nocookie` / `player.vimeo.com`); the raw embed is never
framed in the opaque child.

## Open preview in a new tab

Opening the opaque preview **content** directly as a top-level document breaks
external media: the embed shim only runs when it has a parent
(`window.parent !== window`), so a standalone tab leaves the raw cross-origin
iframe (CSP-blocked). So "open in new tab" instead opens a same-origin
**preview-host page** — `preview-tab.html` (source:
`public/app/common/preview-tab/preview-tab.html`, served verbatim by an explicit
route so no dev-server bundler rewrites its classic bridge scripts), served at
root by the static plugin and copied into static/PWA builds — that frames the
opaque content in one sandboxed iframe and runs the embed relay, becoming the
trusted parent that overlays the real player in-place (same topology as the
editor panel). Being a plain app page it carries **no CSP**, so the relay frames
the player freely; the framed content stays opaque via its own response CSP.
Selection mirrors the transport (`previewPanel.extractToNewTab`):

- **HTTP** (server / Electron / embedded): `preview-tab.html?session={previewId}`
  — the page frames the capability URL `preview/{previewId}/index.html` directly
  (the session lives server-side).
- **static-service-worker** (static / PWA standalone): the transport is already
  same-origin (not opaque), so the tab opens the session's `/viewer` entry URL
  directly; video plays inline with no relay needed.

The relay is started on the framed iframe's first `load` (like the panel, which
attaches the relay after the iframe has content) and re-pinged on every (re)load.

## Roadmap

- **Static/PWA standalone** already runs on the `static-service-worker`
  transport (trusted-content mode). If a future static deployment needs opaque
  isolation, it must add a real serving backend (there is no server-less opaque
  transport).
- **Hosts** inject `previewHttp` to activate the opaque HTTP transport;
  end-to-end activation waits on a core editor release that ships
  `HttpPreviewProvider` + `bundles/preview-fixed-resources.json` (see
  [preview-serving-contract.md](preview-serving-contract.md)).
