# Preview Architecture — Opaque Editor Preview Without a Separate Origin

The editor preview renders **untrusted authored content**: an imported `.elpx`
can carry arbitrary HTML/JS. To keep that content from reaching the editor
session (its DOM, cookies, IndexedDB with every project — and, when the editor
is embedded, the LMS/CMS admin origin), the preview iframe runs in an
**opaque origin**: `sandbox="allow-scripts allow-popups allow-forms"` with no
`allow-same-origin`. No separate subdomain is used — everything is same-origin.

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

Two further constraints shape the design:

- An opaque-origin child **cannot load a parent-created `blob:` URL**, so the
  only client-side bootstrap that works is `iframe.srcdoc`.
- An opaque iframe sends **no SameSite cookies**, so any HTTP serving route
  must be an authless capability URL.

## Transports (the provider abstraction)

`public/app/workarea/interface/elements/preview/` defines one provider per
transport; `PreviewPanelManager` stays the orchestrator (it owns the DOM and
the postMessage contract) and delegates transport to the selected provider.
Selection is deterministic (`public/app/core/previewTransport.js`) — there is
**no runtime probing and no fallback chain**: an unavailable transport
surfaces an error instead of silently downgrading to a same-origin preview.

| Runtime | Transport | Opaque-safe | Notes |
|---|---|---|---|
| Server (web editor) | `HttpPreviewProvider` | yes | Uploads files to an ephemeral same-origin session, iframe loads `/preview/{id}/index.html`. |
| Embedded editor (Moodle/WP/Omeka/Procomún) | `SrcdocPreviewProvider` | yes | No backend; self-contained `srcdoc` with inlined assets + postMessage navigation. |
| Static / PWA standalone | `ServiceWorkerPreviewProvider` (phase 1) → `SrcdocPreviewProvider` (phase 2) | phase-dependent | SW preview is same-origin, not opaque; the phase-2 flag switches the default to srcdoc. |
| Electron | `ServiceWorkerPreviewProvider` (interim) | no | Renderer is `app://localhost` with `contextIsolation`, not LMS-exposed. A future `ElectronPreviewProvider` will serve `app://localhost/preview/{id}/*`. |
| Explicit override | `embeddingConfig.previewTransport` = `http` \| `srcdoc` \| `legacy-sw` | — | Escape hatch for hosts; `legacy-sw` restores the old same-origin SW preview. |

### HTTP transport — same-origin ephemeral sessions

- Authenticated API (`/api/preview-session`): create a session, sync a content
  manifest (`{path → {sha256, size}}`), upload only the blobs the server is
  missing, delete on `pagehide`. The content-addressed store means the
  debounced auto-refresh re-uploads only the edited page (KBs), not the whole
  theme+libs bundle.
- Authless serving (`/preview/{previewId}/*`): capability URL (server-minted
  `crypto.randomUUID()`, idle TTL). Every response carries
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store`, a `Permissions-Policy` deny-list, and
  `Access-Control-Allow-Origin: *` (opaque frames make CORS-mode requests with
  `Origin: null` — the route is already authless/cookieless, so this adds no
  exposure). HTML responses additionally get
  `Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms; …`
  so the document stays opaque even if the capability URL is opened directly.
- Sessions are process-local and die on restart; the client transparently
  recreates a session on any `404`. Under a future multi-instance deployment
  this requires sticky sessions.
- The sandbox tokens and CSP live in `src/shared/security/previewSandbox.ts`
  (re-exported into the browser bundle so the iframe attribute and the response
  header never drift). PR #1425 (public viewer) should refactor its
  `publicViewSandbox.ts` onto this shared module when it lands.

### Srcdoc transport — self-contained pages

`SrcdocPreviewProvider` inlines each page (`srcdocInliner.js`): stylesheets and
their `@import`/`url()` assets (fonts + images, resolved relative to the CSS
file), scripts, `img`/`srcset`/media/`poster`/`track` sources, and PDF embeds
(as `data:` URIs rendered by PDF.js). Byte budgets bound the page; over-budget
assets keep their original reference (they 404 quietly, as before) and a
dismissible notice is shown. Navigation and document opening use validated
`postMessage` because there are no real URLs. The editor preview always makes
Teacher Mode available; since srcdoc has no URL to carry `?exe-teacher=1`, the
decorator sets `window.__EXE_TEACHER_MODE__ = true` in `<head>` before
`exe_export.js` runs.

**Srcdoc fidelity limits.** A srcdoc document has no base URL pointing at the
preview session, and in pure static/PWA mode there is no server (nor a Service
Worker) hosting the preview files at a fetchable URL. So anything that loads
resources **at runtime by relative/absolute URL** cannot work in srcdoc:
- **Runtime MathJax** (`addMathJax = true`): MathJax v4 injects component
  `<script>`s at runtime whose paths resolve against the (absent) document base.
  LaTeX still renders in server (HTTP) mode and in exports (server-side
  pre-rendering); in srcdoc the author should rely on pre-rendered LaTeX.
- **3D viewer** STL fetch, and other iDevices that `fetch()` relative asset
  paths at runtime, degrade to their documented fallbacks.
- Large media beyond the inline budget (see above).

These are inherent to a server-less, opaque, self-contained document. The HTTP
transport (server mode) has none of them because every resource is served
same-origin under the session prefix.

## Script-injection parity

The Service Worker injected external-link/PDF/navigation scripts at serve time.
Opaque transports have no Service Worker, so `previewContentDecorators.js`
bakes the equivalents into the HTML client-side — for HTTP **before** hashing
(so served bytes match the manifest), for srcdoc at render time (the page path
is baked per page). The shared `Html5Exporter.generateForPreview` output is
left untouched, so real exports never carry preview-only scripts.

## postMessage contract

The preview renders untrusted content, so every message is gated on the
browser-enforced **source-window identity** (`event.source ===
iframe.contentWindow`) — never on `event.origin`, which is `'null'` for opaque
frames — and every field is validated (`providerContract.sanitizePagePath`
rejects protocol URLs, protocol-relative URLs, oversized values and
root-escaping paths). Message types: `exe-preview-nav` (child→parent, reports
the rendered page so auto-refresh reloads the same page), `exe-preview-navigate`
and `exe-preview-open-document` (srcdoc navigation / document opening),
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
they are relayed to the trusted parent (the editor) — automatically, **with no
click**, exactly like the host plugins. Two cooperating mechanisms, both with
their canonical source in eXe core (`public/app/common/exe_embed_bridge/` and
`.../exe_media_bridge/`); the plugins mirror them:

- **Declarative embeds** (plain `<iframe src="youtube…">` in the content) use the
  **embed relay**: `exe_embed_shim.js` runs inside the opaque preview iframe and
  replaces each cross-origin/PDF iframe with a geometry-reporting placeholder;
  `exe_embed_relay.js` (started once by `previewMediaHost.js` in the editor)
  overlays the real player positioned over that placeholder, tracking scroll and
  resize. No click, in-place — the plugin behavior. The shim is injected into
  preview pages by the decorators (a same-origin `<script src>` for the HTTP
  transport; inlined for srcdoc). `exe_media_bridge.js` detects the shim
  (`window.exeEmbedShim`) and defers, so declarative embeds are never turned into
  click-placeholders.
- **Programmatic media** (the interactive-video iDevice, which drives question
  timing) keeps using the **media bridge** (`exe_media_bridge.js` +
  `exe-media-host.js`) over a `MessageChannel` to a parent-side player. See
  [external-media-bridge.md](external-media-bridge.md).

Because declarative embeds are promoted OUT of the opaque child to the parent,
the preview response CSP `frame-src` stays minimal (only the interactive-video
fallback hosts `youtube-nocookie` / `player.vimeo.com`); the raw embed is never
framed in the opaque child.

## Roadmap

- **Phase 2**: flip the static bundle sandbox and the `phase2SrcdocDefault`
  flag so static/PWA standalone uses srcdoc; add a teacher-mode flag for srcdoc
  (there is no URL to carry `?exe-teacher=1`).
- **Phase 3**: `ElectronPreviewProvider` serving `app://localhost/preview/{id}/*`.
- **Plugins**: hosts already ship the same-origin cookieless serving primitive
  (Moodle `tokenpluginfile.php`, WP public content REST, Omeka `ContentController`,
  Procomún `/api/v1/elpx/:hash/*`); they can later opt into
  `previewTransport: 'http'` with a host endpoint instead of srcdoc.
