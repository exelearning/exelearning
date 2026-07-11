# Preview Serving Contract v2 — Host-Served Opaque HTTP Preview

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
- Session store (layered documents/assets/fixed refs, atomic revisions, TTL,
  budgets): [`src/services/preview-session-manager.ts`](../../src/services/preview-session-manager.ts)
- Reference HTTP adapter (Elysia routes):
  [`src/routes/preview-session.ts`](../../src/routes/preview-session.ts)
- Transport-agnostic client (talks to any endpoint implementing this contract):
  `public/app/workarea/interface/elements/preview/HttpPreviewProvider.js`

**Protocol version: 2.** Version 1 (full SHA-256 manifest + content-addressed
blob diff) was never consumed by a shipped host editor and is removed, not kept
alongside. A client that receives a create-session response without
`protocolVersion: 2` must surface an error (no silent fallback).

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

## Why v2 (the incremental model)

Protocol v1 treated the preview as a full export: every refresh regenerated and
SHA-256-hashed the complete file set client-side, serialized a full manifest,
and the server re-hashed every uploaded blob into a per-session
content-addressed store. That makes a one-word edit cost
`O(total project size)` in generation, hashing and serialization — dominated by
project media and by installation files (libraries, official themes, iDevice
runtimes) that are identical for every project on the host.

v2 splits the preview into **three layers with different lifecycles** so a
refresh costs `O(invalidated documents + new assets)`:

| Layer | Contents | Lifecycle | Transferred |
|---|---|---|---|
| **Fixed installation resources** | official libraries (jQuery, Bootstrap, MathJax, PDF.js…), official iDevice runtimes, official theme files, export scripts, logo, bundled fonts | immutable per installed eXe version | **never** — served from the host's installed editor distribution, gated by a build manifest |
| **Session project assets** | author images/audio/video/PDF/attachments — anything with an asset identity in the project model | immutable per `assetKey`; live for the whole preview session | **once per session** (again only if replaced → new key) |
| **Generated documents** | page HTML, navigation, generated CSS/JS, search index, user-theme and user-iDevice files, anything derived from the current Y.Doc | change with every edit | **only the changed files**, as an atomic revision delta |

Classification is by **provenance, not by name or path**: a resource is *fixed*
only when the client resolved it from an installation-immutable,
user-unshadowable source (the versioned resource bundles / base directories). A
custom theme, a user-installed iDevice, or any file embedded in an `.elpx` must
never be classified as fixed — they ride the session layers.

## Transport selection (client side)

The client selects the transport deterministically
(`public/app/core/previewTransport.js`). The server and Electron runtimes select
`http` automatically and derive today's same-origin endpoints from the app base
path (`{basePath}/api/preview-session` for management, `{basePath}/preview` for
serving). An **embedded** editor activates this contract by supplying a
`previewHttp` block in its `RuntimeConfig`/embedding config:

```jsonc
{
  "embeddingConfig": {
    "previewTransport": "http",       // optional: the client also fails closed
                                      // for an embedded editor without previewHttp
    "previewHttp": {
      "protocolVersion": 2,           // literal 2; anything else → clear client error
      // Authenticated management API base (create/assets/revisions/delete).
      "managementBaseUrl": "/mod/exelearning/editor/preview_session.php",  // example (Moodle)
      // Authless capability serving base (the opaque iframe reads from here).
      "servingBaseUrl": "/mod/exelearning/preview.php",
      // Optional CSRF/auth headers sent on EVERY management request.
      "managementHeaders": { },       // e.g. { "X-WP-Nonce": "…" } (WordPress)
      // Optional query params appended to EVERY management request URL.
      "managementQuery": { }          // e.g. { "cmid": "…", "sesskey": "…" } (Moodle)
    }
  }
}
```

The client validates `previewHttp` at provider construction and normalizes it
(bases parseable as URLs relative to the document, header/query values must be
strings). Management requests go to `managementBaseUrl` (`/{id}/assets`,
`/{id}/revisions`, `DELETE /{id}`) with `managementHeaders` + `managementQuery`
on every call and `credentials: 'same-origin'`; the opaque iframe and
client-initiated serving fetches use `servingBaseUrl/{id}/…` with
`credentials: 'omit'`. The provider carries **no** host-specific conditionals —
a host adapts its dispatcher to this shape server-side.

There is **no silent fallback**: if `http` is selected and the endpoint is
missing, `previewHttp` is malformed, or a create-session answers with the wrong
`protocolVersion`, the preview surfaces an error rather than downgrading to a
same-origin document. (`previewBasePath` was never implemented and is removed.)

## The fixed-resource manifest

The eXe build emits `public/bundles/preview-fixed-resources.json` (copied into
the static editor distribution every host already ships). It is the **only**
authority for what the serving route may resolve outside the session:

```jsonc
{
  "schemaVersion": 1,
  "buildVersion": "<app version at build time>",
  "resources": {
    // fixedResourceId → { path (relative to the distribution root), size }
    "libs/jquery/jquery.min.js":      { "path": "libs/jquery/jquery.min.js", "size": 89476 },
    "libs/pdfjs/pdf.min.mjs":         { "path": "libs/pdfjs/pdf.min.mjs", "size": 360448 },
    "idevices/text/export/text.js":   { "path": "files/perm/idevices/base/text/export/text.js", "size": 9184 },
    "theme:zen/content.css":          { "path": "files/perm/themes/base/zen/content.css", "size": 51200 },
    "content/css/base.css":           { "path": "style/workarea/base.css", "size": 40173 },
    "content/img/exe_powered_logo.png": { "path": "app/common/exe_powered_logo/exe_powered_logo.png", "size": 4906 }
  }
}
```

Rules:

- The manifest enumerates **base** (repo-shipped) resources only: base
  libraries and every content-detectable library, base iDevice `export/`
  runtimes, base theme files, PDF.js, the content CSS, the logo, global fonts.
  Site-admin themes, user themes and user-installed iDevices are **never**
  listed.
- `fixedResourceId` is an opaque key. The server resolves it by **exact map
  lookup** — never by path arithmetic on client input — and serves the file at
  `resources[id].path` under the distribution root. Unknown id → the revision
  is rejected (`422`), never a filesystem probe.
- A host may relocate files when installing the distribution; it then rewrites
  the `path` values in its manifest copy. Ids must not change.

## The wire contract

All paths are relative to the host-provided `basePath`. Two concerns: an
authenticated management API and an authless serving route.

### A. Management API (authenticated — the author's session)

| Method & path | Body | Success response |
|---|---|---|
| `POST /api/preview-session` | – | `201` `{ previewId, protocolVersion: 2, revision: 0, limits: { maxFilesPerSession, maxBytesPerSession, maxAssetBytes, recommendedBatchBytes } }` |
| `POST /api/preview-session/:previewId/assets` | multipart: `assets` (JSON array `[{ key, size }]`), `files[]` (index-aligned) | `200` `{ stored: string[], alreadyStored: string[], rejected: [{ key, reason }] }` |
| `POST /api/preview-session/:previewId/revisions` | multipart: `revision` (JSON, below), `files[]` (index-aligned with `writes`) | `200` `{ revision, active: true }` |
| `DELETE /api/preview-session/:previewId` | – | `200` `{ success: true }` |

Rules:

- **Authenticated & owner-scoped.** Only the author's own session may be created
  or mutated. Use the host's normal auth (session cookie / token / local trust in
  Electron). This is the *only* authenticated surface.
- **Asset uploads (`/assets`).**
  - `key` must match `^[0-9a-fA-F-]{36}@[0-9a-f]{8,64}$` — the project model's
    asset id plus a prefix of its content hash, both of which the editor already
    stores; the server treats the key as an **opaque validated token** and never
    hashes the bytes.
  - Keys are **immutable**: uploading a key the session already holds does not
    replace bytes — it is reported in `alreadyStored`. Replaced author files get
    a **new** key (their content hash changed), so different bytes can never
    hide behind an existing identity.
  - Enforce the byte budget twice: on **declared** sizes before buffering and on
    **actual** bytes while buffering (an under-reported size must not amplify
    memory). A per-entry declared/actual size mismatch rejects that entry.
  - Assets persist for the whole session (across revisions) until the session is
    deleted or expires. There is no per-revision garbage collection requirement.
- **Revisions (`/revisions`).** The `revision` JSON field:

  ```jsonc
  {
    "baseRevision": 17,          // the revision the client believes is active
    "nextRevision": 18,          // must be baseRevision + 1
    "writes": ["index.html", "html/page-2.html"],   // aligned with files[]
    "deletes": ["html/removed-page.html"],
    "assetRefs": {               // FULL map: served path → assetKey
      "content/resources/photo.png": "3f2a…-…@9c41d2e8a1b03f57"
    },
    "fixedRefs": {               // FULL map: served path → fixedResourceId
      "libs/jquery/jquery.min.js": "libs/jquery/jquery.min.js",
      "theme/content.css": "theme:zen/content.css"
    }
  }
  ```

  - `writes`/`deletes` are **deltas** over the session's document set;
    `assetRefs`/`fixedRefs` are **full replacement maps** (small — one line per
    referenced file — and they make conflict recovery stateless).
  - Validation order: session exists (`404`) → `baseRevision` equals the active
    revision **and** `nextRevision` is `baseRevision + 1`, else
    `409` `{ reason: "revision-conflict", currentRevision }` → every path in
    `writes`/`deletes`/`assetRefs`/`fixedRefs` is normalized and safe, else
    `400` → every `assetRefs` value exists in the session asset store, else
    `422` `{ reason: "missing-assets", missing: [keys] }` → every `fixedRefs`
    value exists in the fixed-resource manifest, else
    `422` `{ reason: "unknown-fixed-resources", resources: [ids] }` → file
    count/byte budgets, else `413`.
  - **Atomicity.** Buffer all bytes first, re-validate the revision (an upload
    may have raced), then publish documents + both ref maps + the revision
    number in one atomic swap. A concurrent `GET` observes revision *N* or
    *N+1*, never a mixture. Until the first revision is published, the serving
    route returns `404` for every path.
  - **Conflict recovery (client).** On `409` the client re-sends a **full
    snapshot of the generated-document layer** (writes = every document,
    `deletes: []`, full ref maps) using the `currentRevision` from the response
    as `baseRevision`. It does **not** re-upload assets (`422 missing-assets`
    lists any the server actually lost; upload those, then retry once). On
    `404` it recreates the session from scratch (new session ⇒ empty asset
    store ⇒ clear the client's `uploadedAssetKeys` set).
- **Budgets & TTL (DoS bounds).** Enforce per-session file-count and byte caps
  (documents + assets combined), a per-asset byte cap, a global byte cap with
  LRU eviction, per-user session caps, and an idle TTL sweeper. Reference
  defaults: 30-min idle TTL, 4 sessions/user, 5000 files/session, 200 MiB
  /session, 128 MiB/asset, 2 GiB global.

### B. Serving route (authless capability URL — serves the opaque iframe)

```
GET  {basePath}/preview/{previewId}/{path}
```

- **Authless capability URL.** The opaque iframe sends **no** SameSite cookies,
  so this route must not depend on the auth cookie. Gate it on the unguessable
  `previewId` (a server-minted UUID) + idle TTL, mirroring the host's existing
  cookieless file-serving primitive (e.g. Moodle `tokenpluginfile.php`).
- `previewId` **must** match `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`;
  anything else → 404.
- **Bare root → redirect.** `GET {basePath}/preview/{previewId}` and
  `.../{previewId}/` **must** `302`-redirect to the entry document with a
  **relative** `Location` (`index.html` for the trailing-slash form,
  `{previewId}/index.html` otherwise) so it survives `BASE_PATH` and the Electron
  `app://` origin. Never serve `index.html` bytes from the bare URL — one
  canonical document URL keeps its relative asset references resolving. The
  redirect is stateless (a valid-UUID bare URL for an unpublished or unknown
  session redirects to a target that then 404s).
- **Resolution order** (exact-key lookups against the **active revision** only):

  ```
  1. documents[path]                     → generated document bytes
  2. assets[assetRefs[path]]             → session project asset bytes
  3. manifest[fixedRefs[path]]           → fixed installation file
  4. 404
  ```

  Never touch the real filesystem from `path` itself; only
  `manifest[id].path` (server-controlled data) reaches the filesystem, resolved
  under the distribution root with containment checks.
- **Range requests.** Session-asset responses advertise `Accept-Ranges: bytes`
  and honor single-range requests so large audio/video seeks avoid a full
  re-download. Classification is canonical (RFC 9110 §14.1.2): a valid
  satisfiable single range → `206`; a valid but **unsatisfiable** single range
  (first-byte-pos ≥ length such as `bytes=99-`, or a zero-length suffix
  `bytes=-0`) → `416` with `Content-Range: bytes */<len>`; and any
  **syntactically invalid or unsupported** spec (non-`bytes` unit, multi-range,
  unparseable, or inverted last-byte-pos < first-byte-pos such as `bytes=5-2`)
  **MUST be ignored** → the full `200` body. Structural validity is checked
  **before** satisfiability, so `bytes=15-2` (inverted *and* past EOF) is ignored
  (`200`), never `416`. Documents and fixed resources ignore Range entirely.
- **Conditional requests.** Session-asset responses carry
  `ETag: "<assetKey>"` and honor `If-None-Match` with `304` (an unchanged asset
  re-referenced across revisions revalidates without a byte transfer).

## Required response headers (the isolation policy)

Emit these on **every** serving response, **including 404s**:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Access-Control-Allow-Origin: *
Content-Type: <the file's real MIME type>
```

`Cache-Control` is **tiered by layer** — do not apply `no-store` uniformly:

| Response | Cache-Control |
|---|---|
| Generated document (layer 3) | `no-store` |
| Session project asset (layer 2) | `no-cache` (+ `ETag`, honor `If-None-Match`) |
| Fixed installation resource (layer 1) | `private, max-age=31536000` |
| 404 / errors | `no-store` |

The fixed tier is safe to cache aggressively because the bytes are immutable for
the installed version and the URL is scoped to a short-lived capability session
(an app upgrade mints new sessions). `private` keeps capability URLs out of
shared caches. The asset tier must **revalidate** (`no-cache`) because the same
served path can be remapped to a different `assetKey` when the author replaces a
file; the `ETag` turns the common unchanged case into a `304`.

`Access-Control-Allow-Origin: *` is safe here: the route is authless and
cookieless, and fonts/`fetch()`/ES-module loads from an opaque frame are
CORS-mode with `Origin: null`. Do **not** combine `*` with
`Access-Control-Allow-Credentials`.

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
> `text/html`, **`image/svg+xml`**, `application/xml`, `text/xml`, and
> `application/xhtml+xml` — whatever layer resolves the response, session or
> fixed. An author-supplied SVG served without the sandbox CSP executes its
> inline `<script>` **same-origin** when opened top-level ("open image in new
> tab"), defeating the whole boundary. `nosniff` does not help —
> `image/svg+xml` is already a scriptable document type.

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
   opaque (the CSP header is present on every scriptable type, from every
   resolution layer).
5. No configuration silently downgrades the preview to a same-origin document.
6. The serving route can reach **only** (a) documents and assets the session
   owner uploaded to that session and (b) files enumerated by the fixed-resource
   manifest — never other application routes, other sessions, or arbitrary
   installation files.
7. A revision is observed atomically: no interleaving of revision *N* and *N+1*.
8. An `assetKey`'s bytes are immutable for the session lifetime.

## Reference server logic (framework-agnostic)

```
serve(previewId, relPath):
  if not UUID_RE.test(previewId):            return 404 with baseHeaders
  session = store.getForServing(previewId)   # touches idle-TTL clock
  if not session or session.revision == 0:   return 404 with baseHeaders
  path = normalize(relPath)                  # traversal/backslash/NUL → null
  if path is null:                           return 404 with baseHeaders

  if path in session.documents:
      body, cache = session.documents[path], "no-store"
  elif path in session.assetRefs and session.assetRefs[path] in session.assets:
      key  = session.assetRefs[path]
      if request.ifNoneMatch == key:         return 304 with baseHeaders
      body, cache = session.assets[key], "no-cache"   # + ETag: key, Accept-Ranges/206
  elif path in session.fixedRefs and session.fixedRefs[path] in manifest:
      body  = readUnderDistRoot(manifest[session.fixedRefs[path]].path)
      cache = "private, max-age=31536000"
  else:                                      return 404 with baseHeaders

  headers = baseHeaders + { Content-Type: mimeFor(path), Cache-Control: cache }
  if isScriptableDocument(mimeFor(path)):    headers += { Content-Security-Policy: PREVIEW_CSP }
  return 200 body with headers
```

`isScriptableDocument(mime)` ⇔ `mime` starts with `text/html`, or is
`image/svg+xml`, `application/xml`, `text/xml`, or `application/xhtml+xml`.

## Per-host adapter notes

The **client is reused byte-for-byte**; each host reimplements the *server* side
to this contract on its own cookieless serving primitive:

- **Moodle (`mod_exelearning`)** — serve `/preview/{id}/*` via the existing
  `preview.php` capability endpoint (NO_MOODLE_COOKIES); the management API uses
  sesskey-gated endpoints like `editor/save.php`; the fixed manifest ships with
  the installed static editor and resolves under its install dir; cleanup via a
  scheduled task.
- **WordPress (`wp-exelearning`)** — public REST route for serving
  (`permission_callback` gating on the capability id only), authenticated REST
  routes (`current_user_can` + ownership) for management; session storage under
  the uploads dir; cleanup via WP-Cron **plus** request-time TTL checks
  (WP-Cron is traffic-dependent).
- **Omeka S (`omeka-s-exelearning`)** — `PreviewController` serving action +
  authenticated management controller (CSRF like `ApiController`); file-backed
  session store (PHP is request-scoped — an in-memory map does not survive
  requests).
- **Nextcloud (`nextcloud-exelearning`)** — `#[PublicPage]` +
  `#[NoCSRFRequired]` serving controller; authenticated management controller;
  IAppData-backed store; background job for TTL cleanup.
- **Procomún** — port of the reference Bun implementation (Hono adapter),
  already structured this way for v1; update store + routes to v2.

**Atomic publish on file-backed stores (PHP hosts).** Stage the incoming
revision in a temp dir, then publish with an atomic pointer swap (rename a
`current` symlink/marker file). Serve strictly through the pointer read at
request start so a request never mixes two revisions.

Keep the emitted CSP string **byte-identical** to `previewCspHeader()`. This is
enforced by the **`serving-contract`** kind in
[`scripts/check-embed-sync.mjs`](../../scripts/check-embed-sync.mjs) (see
[EMBED-SYNC.md](EMBED-SYNC.md)), which asserts every host's preview endpoint carries
the canonical CSP directives.

## Conformance

Beyond the CSP drift-check, hosts should validate against the shared test
vectors in
[`test/fixtures/preview-contract/`](../../test/fixtures/preview-contract/):
a canned session (assets + two revisions + a conflict + traversal and
scriptable-SVG probes) with the expected status codes and headers, so protocol
semantics — not just the CSP string — stay aligned across hosts.

## What stays on `srcdoc`

Pure **serverless static / PWA standalone** (opened from a CDN / GitHub Pages /
`file://`, no backend) has no server and no SW that can serve an opaque document,
so it keeps the self-contained `iframe.srcdoc` transport
([preview-architecture.md](preview-architecture.md)). Its lower fidelity
(parent-bridged intra-content navigation, no open-in-new-tab) is confined to that
one context. Every context with a server (cloud, Electron, embedded LMS) uses
this HTTP contract instead. The srcdoc transport keeps consuming the full
in-memory file map (`generateForPreview`) — the layered pipeline is specific to
this HTTP contract and must not change srcdoc/static behavior.

## php-wasm Playgrounds (demo environments) — the dev-only escape hatch

Plugin **Playgrounds** (WordPress / Moodle / Omeka S / Nextcloud running the whole
CMS in the browser via php-wasm) are a special serverless case: there is **no real
HTTP server** — the entire site is emulated by a **Service Worker**. An opaque iframe
bypasses that SW (opaque origins are not SW-controlled — the same reason a SW cannot
serve preview), so neither this HTTP contract nor a plugin's real serving route can
deliver opaque content there.

For **published-content** demos, whose flows point an iframe at a server URL (not a
client-inlined `srcdoc`), Playgrounds therefore fall back to a **dev-only escape
hatch** — `EXELEARNING_UNSAFE_LEGACY_IFRAME`, which renders same-origin. This hatch
**must**: be off by default, never be exposed as a normal admin/UI setting, be loudly
documented as unsafe, and be covered by a test proving it is not enabled by default.
It exists **only** for php-wasm demo environments; every real deployment (cloud,
Electron, embedded LMS, static/PWA) stays opaque. Editor *preview* is unaffected —
embedded editors already pick the opaque `srcdoc` transport, which needs no server.

See also: [embedding.md](embedding.md),
[preview-architecture.md](preview-architecture.md),
[external-media-bridge.md](external-media-bridge.md).
