# Preview Serving Contract — Host-Served Opaque HTTP Preview

This document defines the **canonical contract** a host (an LMS/CMS plugin, the
Electron desktop app, or any embedder) implements so the eXeLearning editor can
render **untrusted author HTML/JS** in an **opaque origin** over a real,
same-origin capability URL — instead of the `srcdoc` fallback.

It is the single source of truth mirrored by the platform plugins
(`mod_exelearning`, `wp-exelearning`, `omeka-s-exelearning`,
`nextcloud-exelearning`, Procomún). The reference implementation lives in eXe
core:

- Isolation policy (tokens + CSP + Permissions-Policy):
  [`src/shared/security/previewSandbox.ts`](../../src/shared/security/previewSandbox.ts)
- Session store (content-addressed, TTL, budgets, server-side re-hash):
  [`src/services/preview-session-manager.ts`](../../src/services/preview-session-manager.ts)
- Reference HTTP adapter (Elysia routes):
  [`src/routes/preview-session.ts`](../../src/routes/preview-session.ts)
- Transport-agnostic client (talks to any endpoint implementing this contract):
  `public/app/workarea/interface/elements/preview/HttpPreviewProvider.js`

## Why this exists (the one-paragraph rationale)

The editor preview renders author-provided HTML/JS. When that content runs in the
**same origin** as the editor it can read the editor DOM, the `auth` cookie
surface, IndexedDB (every project), and — in an embedded editor — the **LMS/CMS
admin origin** (see the security study in
`lms-untrusted-content-security-paper`). The fix is a browser-enforced **opaque
origin**: a document served with a response-level
`Content-Security-Policy: sandbox …` (no `allow-same-origin`). A **Service Worker
cannot** back an opaque iframe (its subresources bypass the SW), so opacity in a
serverless context needs the `srcdoc` fallback; **wherever a server exists
(cloud, Electron, an LMS host) this HTTP contract is preferred** because it gives
real per-page URLs (working intra-content navigation and open-in-new-tab) *and*
an opaque origin at the same time.

## Transport selection (client side)

The client selects the transport deterministically
(`public/app/core/previewTransport.js`). A host activates this contract by
setting, in its `RuntimeConfig`/embedding config:

```jsonc
{
  "embeddingConfig": {
    "previewTransport": "http",
    // basePath the client prefixes to every request below; defaults to the app
    // base path. Point it at the host endpoint that implements this contract.
    "previewBasePath": "/mod/exelearning/preview"   // example (Moodle)
  }
}
```

There is **no silent fallback**: if `http` is selected and the endpoint is
missing, the preview surfaces an error rather than downgrading to a same-origin
document.

## The wire contract

All paths are relative to the host-provided `basePath`. Two concerns:

### A. Management API (authenticated — the author's session)

The client creates an ephemeral session, syncs a content manifest, and uploads
only the blobs the server is missing (content-addressed diff — a re-preview
re-uploads only the changed page, not the whole theme+libs bundle).

| Method & path | Body | Response |
|---|---|---|
| `POST /api/preview-session` | – | `{ previewId, limits: { maxFilesPerSession, maxBytesPerSession, recommendedBatchBytes } }` |
| `POST /api/preview-session/:previewId/manifest` | `{ files: { [path]: { sha256, size } } }` | `{ manifestId, missing: string[], active: boolean }` |
| `POST /api/preview-session/:previewId/blobs` | multipart: `manifestId`, `hashes` (JSON array), `files[]` (index-aligned) | `{ stored: string[], mismatched: string[], active: boolean }` |
| `DELETE /api/preview-session/:previewId` | – | `{ success: true }` |

Rules:

- **Authenticated & owner-scoped.** Only the author's own session may be created
  or mutated. Use the host's normal auth (session cookie / token). This is the
  *only* authenticated surface.
- **Content-addressed & re-hashed server-side.** Every uploaded blob is
  re-hashed; a blob whose recomputed SHA-256 differs from the declared hash is
  quarantined and dropped (a forged hash can only disqualify itself, never poison
  another path). Blobs not declared by the pending manifest are ignored.
- **Atomic swap.** A new manifest becomes active only once every missing blob is
  present; until then the previous manifest keeps serving.
- **Budgets & TTL (DoS bounds).** Enforce per-session file-count and byte caps, a
  global byte cap with LRU eviction, and an idle TTL sweeper. Reference defaults:
  30-min idle TTL, 5000 files/session, 200 MiB/session, 2 GiB global. Enforce the
  byte budget on *declared* sizes before buffering **and** on *actual* bytes while
  buffering (an under-reported size must not amplify memory).

### B. Serving route (authless capability URL — serves the opaque iframe)

```
GET  {basePath}/preview/{previewId}/*        → the previewed file
```

- **Authless capability URL.** The opaque iframe sends **no** SameSite cookies,
  so this route must not depend on the auth cookie. Gate it on the unguessable
  `previewId` (a server-minted UUID) + idle TTL, mirroring the host's existing
  cookieless file-serving primitive (e.g. Moodle `tokenpluginfile.php`).
- `previewId` **must** match `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`;
  anything else → 404.
- Resolve the path from the session's **active** manifest only; unknown/traversal
  paths → 404. Never touch the real filesystem (exact-key lookup in the store).

## Required response headers (the isolation policy)

Emit these on **every** serving response, **including 404s**:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cache-Control: no-store
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Access-Control-Allow-Origin: *
Content-Type: <the file's real MIME type>
```

`Access-Control-Allow-Origin: *` is safe here: the route is authless and
cookieless, and fonts/`fetch()` from an opaque frame are CORS-mode with
`Origin: null`. Do **not** combine `*` with `Access-Control-Allow-Credentials`.

And, **on every scriptable document type**, add the sandbox-first CSP so the
document stays opaque even when the capability URL is opened directly (new tab,
popup, raw URL):

```
Content-Security-Policy:
  sandbox allow-scripts allow-popups allow-forms;
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  media-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com;
  child-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com;
  object-src 'none';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'self';
```

This is exactly `previewCspHeader()` in
[`previewSandbox.ts`](../../src/shared/security/previewSandbox.ts) — emit the
string **verbatim** so it can never drift from core.

> **Scriptable document types — not just `text/html`.** Emit the sandbox CSP on
> `text/html`, **`image/svg+xml`**, `application/xml`, and
> `application/xhtml+xml`. An author-supplied SVG served without the sandbox CSP
> executes its inline `<script>` **same-origin** when opened top-level ("open
> image in new tab"), defeating the whole boundary. `nosniff` does not help —
> `image/svg+xml` is already a scriptable document type. (Core's Elysia adapter
> currently gates the CSP on `isHtml`; new adapters MUST cover all scriptable
> types, and core should follow.)

### Optional strict profile (higher-security deployments)

The `img-src`/`media-src` `https:` above lets authors hotlink external
images/audio/video. Because the frame is opaque and has **no ambient authority**,
an external GET can only leak the author's *own* content — a non-threat for the
editor preview. A deployment that also wants to cut that channel MAY drop
`https:` from `img-src`/`media-src`/`font-src` and `'unsafe-eval'` from
`script-src` (a "strict" profile). Document it as an admin opt-in; do not make it
the default, as it breaks legitimate external media.

## Security invariants (make them testable)

1. The served preview document has `window.origin === "null"` (opaque) — from the
   response CSP `sandbox`, independent of any iframe attribute.
2. The document cannot reach `window.parent.document` / `window.top.*`, the auth
   cookie, `localStorage`, `IndexedDB`, or the Cache API.
3. The serving route attaches **no** ambient credentials (authless capability
   URL); an authenticated request forged from the opaque frame reaches the server
   without the session cookie.
4. Opening a raw `{basePath}/preview/{id}/*.html` **or** `*.svg` top-level stays
   opaque (the CSP header is present on every scriptable type).
5. No configuration silently downgrades the preview to a same-origin document.

## Reference server logic (framework-agnostic)

```
serve(previewId, relPath):
  if not UUID_RE.test(previewId):            return 404 with baseHeaders
  session = store.getForServing(previewId)   # touches idle-TTL clock
  if not session:                            return 404 with baseHeaders
  file = session.activeManifest.get(normalize(relPath))   # exact key; traversal → null
  if not file:                               return 404 with baseHeaders
  headers = baseHeaders + { Content-Type: file.mime }
  if isScriptableDocument(file.mime):        headers += { Content-Security-Policy: PREVIEW_CSP }
  return 200 file.bytes with headers
```

`isScriptableDocument(mime)` ⇔ `mime` starts with `text/html`, or is
`image/svg+xml`, `application/xml`, or `application/xhtml+xml`.

## Per-host adapter notes

The **client is reused byte-for-byte**; each host reimplements the *server* side
to this contract on its own cookieless serving primitive:

- **Moodle (`mod_exelearning`)** — serve `/preview/{id}/*` via a
  `tokenpluginfile.php`-style capability URL (IP/idle-bound token); the session
  store + CSP live in the plugin (`classes/local/ui/player_iframe.php` already
  builds the sandbox/CSP for published content — reuse its CSP builder for the
  preview).
- **WordPress (`wp-exelearning`)** — a public REST route
  (`register_rest_route`) with `permission_callback` gating on the capability id,
  emitting the headers above; reuse `class-content-proxy.php`'s CSP builder.
- **Omeka S (`omeka-s-exelearning`)** — a `ContentController` action serving the
  capability path, reusing the module's opaque-iframe CSP.
- **Nextcloud (`nextcloud-exelearning`)** — a public `Controller` route
  (`#[PublicPage]`, `#[NoCSRFRequired]`) serving the capability path with the
  headers above.
- **Procomún** — `/api/v1/elpx/:hash/*`-style capability serving with the same
  headers.

Keep the emitted CSP string **byte-identical** to `previewCspHeader()` (add a
drift check, like `tools/check-embed-sync.mjs`).

## What stays on `srcdoc`

Pure **serverless static / PWA standalone** (opened from a CDN / GitHub Pages /
`file://`, no backend) has no server and no SW that can serve an opaque document,
so it keeps the self-contained `iframe.srcdoc` transport
([preview-architecture.md](preview-architecture.md)). Its lower fidelity
(parent-bridged intra-content navigation, no open-in-new-tab) is confined to that
one context. Every context with a server (cloud, Electron, embedded LMS) uses
this HTTP contract instead.

See also: [embedding.md](embedding.md),
[preview-architecture.md](preview-architecture.md),
[external-media-bridge.md](external-media-bridge.md).
