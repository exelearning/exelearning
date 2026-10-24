# Preview architecture and trust boundary

The editor preview renders a mix of two trust levels: **official** eXeLearning
runtime (themes, libraries, MathJax, iDevice runtimes — maintained by the
project) and **author-controlled** content (TinyMCE/HTML fields, component
properties, custom head/footer, custom CSS, imported `.elp`/`.elpx`). Official
runtime must keep working; author-controlled active content must not reach the
editor's DOM, storage, or session on the default path.

This page documents the **hybrid trust boundary**: source-filtered by default,
opaque-on-enable. See [ADR-2199-02](../architecture/adr/ADR-2199-02-hybrid-preview-trust-boundary.md)
for the decision, [ADR-2199-03](../architecture/adr/ADR-2199-03-preview-grant-revocation-under-collaboration.md)
for revocation under collaboration,
[ADR-2199-04](../architecture/adr/ADR-2199-04-self-hosted-capability-snapshots-for-editor-preview.md)
for the capability-snapshot server, and
[ADR-2199-16](../architecture/adr/ADR-2199-16-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)
for the backend-less (static/PWA) transport.

## Transport matrix

The transport is chosen by the **runtime**, never by content, and there is **no
silent fallback** between rows: an enable whose opaque transport cannot be
established fails visibly and stays filtered. **No row runs author code with the
editor's origin**: every enabled transport is a browser-enforced opaque origin,
or blocked.

| Runtime | Default preview | Active content detected | After explicit enable |
|---|---|---|---|
| Web / server | Same-origin SW, source-filtered | Indicator + dialog | **Opaque snapshot** served by eXe's server via a capability URL; iframe `sandbox` without `allow-same-origin` |
| Embedded LMS/CMS (Moodle, WordPress, …) | Same-origin SW, source-filtered | Indicator + dialog | **Opaque snapshot** via the **host's** capability routes; same sandbox |
| Static bundle / PWA / PHP-WASM (no backend) | Same-origin SW, source-filtered | Indicator + dialog | **Opaque `srcdoc` document**: the snapshot page is inlined (CSS, scripts, images, fonts, local media) and loaded through `srcdoc` into the same sandbox without `allow-same-origin`; no server, no network |
| Electron | Same-origin SW, source-filtered | Dialog explains restriction | **Blocked** (preview shares a renderer with the preload bridge) |

The canonical table is `src/shared/preview/preview-mode-matrix.ts`; the shipped
browser decision is `resolvePreviewTransport()` in
`public/app/utils/previewContentPolicy.js`, and
`preview-mode-matrix.consistency.spec.ts` executes the latter across every cell
and fails if the two disagree ([ADR-2199-10](../architecture/adr/ADR-2199-10-preview-transport-matrix-as-a-single-source.md)).

## Enable/disable state machine

```mermaid
stateDiagram-v2
    [*] --> filtered
    filtered --> opaque_enabled: enable (web/server, embedded, static/PWA)
    filtered --> filtered: enable blocked (Electron)
    opaque_enabled --> filtered: disable / revoke / session end
    note right of opaque_enabled
        Transport by runtime: capability URL
        (eXe or host routes) or sandboxed srcdoc.
        Revocation (D1): project replacement/import,
        explicit disable, session end, and any
        update not identified as local. Local edits keep it.
        On exit: dispose the server snapshot or
        unload the srcdoc document.
    end note
```

`filtered` is the default and the only other state is `opaque-enabled`; which
opaque transport delivers it is the runtime's decision. Electron blocks the
enable. Every exit edge returns to `filtered`: a capability-URL exit disposes the
server snapshot (best-effort client `DELETE` + guaranteed server-side TTL expiry),
a srcdoc exit removes the `srcdoc` attribute so the author code stops at once
rather than at the next navigation. The same-origin content policy
(`createPreviewContentPolicy()`) takes no runtime input and is always filtered:
the grant switches the transport, it never loosens what a same-origin document —
Service Worker preview, inlined fallback, print preview — is built with.

## Sequence — default (same-origin, source-filtered)

```mermaid
sequenceDiagram
    participant U as User
    participant P as PreviewPanel
    participant X as SharedExporters
    participant A as PreviewDocumentAdapter
    participant SW as Service Worker
    participant F as iframe (same-origin)

    U->>P: open / edit
    P->>X: generatePreviewForSW(policy = source-aware filter)
    X->>A: prepare author fields on a CLONE
    A-->>X: filtered file map + active-content report
    X-->>P: files, report
    P->>SW: postMessage(files)
    P->>F: load /viewer/index.html (SW-served)
    Note over F: official scripts run; author active content stripped
    P->>U: show active-content indicator if report.activeContentFound
```

## Sequence — enable → opaque snapshot (web/server)

```mermaid
sequenceDiagram
    participant U as User
    participant P as PreviewPanel
    participant X as SharedExporters
    participant S as EmbeddedPreviewSnapshot
    participant R as /api/preview-snapshot (auth)
    participant C as /preview-snapshot/{id} (capability, authless)
    participant F as iframe (opaque origin)

    U->>P: click enable (dialog explains isolated reload)
    P->>X: generatePreviewForSW(report-only policy)  %% author bytes intact
    X-->>P: unfiltered file map
    P->>P: applyPreviewExternalMediaFallback (YouTube/Vimeo → placeholder)
    P->>S: replace(files)  %% ZIP
    S->>R: POST snapshot (JWT + Sec-Fetch-Site check)
    R-->>S: { previewId, previewUrl }
    S->>F: sandbox = allow-scripts … (NO allow-same-origin)
    P->>F: src = capability URL
    F->>C: GET files (NO cookies)
    C-->>F: bytes + sandbox-first CSP on scriptable types
    Note over F: opaque origin — cannot reach editor DOM/cookies/storage
```

## Sequence — embedded LMS/CMS host (unchanged)

```mermaid
sequenceDiagram
    participant P as PreviewPanel (embedded)
    participant S as EmbeddedPreviewSnapshot
    participant H as Host capability routes
    participant F as iframe (opaque origin)

    P->>S: replace(full authored files)  %% no filtering; origin is the control
    S->>H: POST snapshot (host auth/CSRF)
    H-->>S: { previewId, previewUrl }
    S->>F: sandbox without allow-same-origin
    P->>F: src = host capability URL
    Note over F: full authored content, isolated by origin
```

## Sequence — enable → opaque srcdoc (static/PWA, no backend)

```mermaid
sequenceDiagram
    participant U as User
    participant P as PreviewPanel
    participant X as SharedExporters
    participant F as iframe (opaque origin)

    U->>P: click enable (dialog explains isolated reload)
    P->>X: generatePreviewForSW(report-only policy)  %% author bytes intact
    X-->>P: unfiltered file map
    P->>P: inject embed shim; inline CSS/JS/images/fonts/media; PDF embeds → links
    P->>F: sandbox = allow-scripts … (NO allow-same-origin), set BEFORE the load
    P->>F: srcdoc = self-contained page
    Note over F: opaque origin: no parent, cookies, storage, IndexedDB or SW; no network needed
    F->>P: postMessage(exe-blob-navigate | exe-blob-open-document)
    P->>P: accept only if event.source IS a preview frame
    P->>F: srcdoc = next inlined page / open inert file in a new tab
```

The panel reuses the inlining pipeline of its same-origin fallback (the path used
where a Service Worker cannot register); the difference between the two is only
the sandbox attribute present when `srcdoc` is set. Measured browser facts behind
this transport — opaque origin, no Service Worker control, editor-minted `blob:`
URLs unreachable, relative classic resources still loading — are in
`test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts`; the end-to-end
boundary on the built static distribution is in
`test/e2e/playwright/specs/preview-active-content-static.spec.ts`.

## Serving contract (capability route)

`/preview-snapshot/{previewId}/{path}` is authless and cookieless — the
unguessable id plus the TTL is the whole credential. Host adapters implement the
same contract against their own storage, so this table is the canonical version
they conform to; the CSP in particular must stay **byte-identical** to
`previewSnapshotCspHeader()` (one line, directives joined by `"; "`, no trailing
semicolon), because a divergent sandbox silently changes what author code can do.

Every response, 404s included, carries `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, the preview `Permissions-Policy` and
`Access-Control-Allow-Origin: *` — sound only because the route is authless, and
never to be paired with credentials.

Caching is tiered on the scriptable/non-scriptable split, the same split that
decides the CSP:

| | Scriptable document (`text/html`, XHTML, SVG, XML, PDF) | Everything else |
|---|---|---|
| `Content-Security-Policy` | `sandbox …` | absent |
| `Cache-Control` | `no-store` | `no-cache` |
| `ETag` / `Accept-Ranges` | absent | `"{previewId}-{publishSeq}-{path}"` / `bytes` |
| Conditional / partial | — | `If-None-Match` → 304; single range → 206/416 |

A scriptable document is rewritten on every refresh and is the thing the sandbox
guards, so it is never cached or sliced. Everything else revalidates, which is
what lets a video or audio track inside the snapshot seek instead of
re-downloading on every scrub.

Two details are easy to get wrong and are covered by tests:

- **The ETag must fold in a publish counter.** A replace keeps the capability id
  so the iframe URL stays valid; an ETag derived from the id and path alone
  answers 304 with the *previous* bytes whenever the refreshed asset happens to
  be the same length. The tag never hashes bytes — serving a 200 MB video must
  not cost a hash.
- **An invalid `Range` is ignored, not rejected** (RFC 9110). `bytes=15-2`, a
  multi-range list and a non-`bytes` unit all answer `200` with the full body.
  Only a *valid but unsatisfiable* range (`bytes=99-` past EOF, `bytes=-0`, an
  empty body) answers `416` with `Content-Range: bytes */{size}`.

The bare capability root answers `302` with a **relative** `Location` — no
trailing slash → `{previewId}/index.html`, trailing slash → `index.html` — so the
iframe's relative-URL base is correct under any `BASE_PATH`.

## Threat model

- **Assets:** editor DOM and JS context, Yjs project state, eXe server session
  cookies, host LMS credentials (embedded), editor-origin storage (IndexedDB,
  Cache Storage, OPFS) and any file capability the static editor may one day
  hold, the user's machine (Electron).
- **Adversary:** a malicious `.elpx`/`.elp` project, or a malicious collaborator
  injecting active content mid-session. In the opaque transports the adversary's
  script runs and can forge any `postMessage` to the editor, so the parent's
  handlers trust only the two preview frames (by window identity, never
  `event.origin`, which is `"null"` for an opaque document) and never mint a
  scriptable editor-origin blob from a request.
- **In scope:** preventing author-controlled code from reaching those assets
  during preview.
- **Out of scope:** network requests initiated from inside the opaque frame,
  deceptive content, and the trust semantics of *published* exports (unchanged —
  exports have their own delivery model). This is why the opaque serving CSP is
  `sandbox`-only and does not restrict `frame-src`/`connect-src`.

## What the default filter removes

The source-aware policy disables author-controlled **active** content only:
scripts, inline `on*` handlers, `javascript:`/active `data:` URLs, `srcdoc`,
`base`, `meta refresh`, HTML imports, `form action`, SVG scripts/handlers, and
active XML processing instructions. Official eXe scripts/themes/MathJax/iDevice
runtimes are never filtered.

`<object>`/`<embed>` are **dual-use** and decided per element: a PDF or media
resource (`type` of `application/pdf`, `audio/*`, `video/*`, non-SVG `image/*`,
or a media/PDF file extension when untyped) is **kept** — it renders in the
browser's own isolated PDF/media context and cannot reach the editor, exactly
like a sandboxed `<iframe>` pointing at a PDF. An `<object>`/`<embed>` that loads
a **scriptable document** (HTML/XHTML/SVG/XML, a dangerous scheme, or an active
`data:` URL) runs in a nested same-origin context that could reach the parent,
so it is removed. `<applet>` is always removed. Fail closed: an untyped embed
with an unknown resource is removed.

## Non-mutation guarantee

No preview path mutates the Yjs document or stored project data. The
`PreviewDocumentAdapter` operates on a clone; save and export use the original
`YjsDocumentAdapter`. A spec asserts the source document is deep-equal before and
after a full adapter pass.

## Known limitations

- **YouTube/Vimeo in opaque-enabled mode** become an accessible "open in a new
  tab" placeholder (`previewExternalMediaFallback.js`) — an opaque frame cannot
  satisfy the providers' embedder-identity checks. The full media bridge (relay +
  trusted-parent modal) is follow-up work for embedded hosts.
- **Electron:** custom active content cannot be enabled — the preview shares a
  renderer with the `preload.js` bridge. Revisiting needs an isolated-renderer
  design.
- **Static bundle / PWA / PHP-WASM, while enabled** (the srcdoc transport,
  [ADR-2199-16](../architecture/adr/ADR-2199-16-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)):
  PDF embeds render as "open in a new tab" links (an editor-minted `blob:` URL
  cannot be fetched from an opaque origin, and PDF.js cannot be imported into it
  cross-origin); local media is inlined as `data:` URIs up to 25 MiB per file and
  larger files do not play; "open in a new tab" shows the **filtered** Service
  Worker preview because a `srcdoc` document has no URL. None of this affects the
  default filtered preview.
- **Full-snapshot refresh while opaque-enabled:** each scheduled refresh
  re-uploads the whole snapshot (capability URL) or re-inlines the page (srcdoc).
  Acceptable because it is opt-in and temporary; see the
  [benchmark](../../test/benchmarks/preview/README.md) for the payload size
  (~400 KiB for text projects).
- **Already-running contexts:** changing the transport does not revoke what a
  stale tab or an installed PWA is executing with older code. Persistent file
  capabilities (ateeducacion/exelearning#48) need a deployment boundary on top of
  this: all static clients on this code, old tabs reloaded.

## YouTube "Error 153" and `referrerpolicy`

Independent of sandboxing, YouTube's embedded player returns Error 153 when it
cannot read the HTTP `Referer` header. eXeLearning preserves and stamps
`referrerpolicy="strict-origin-when-cross-origin"` on YouTube/Vimeo iframes in
both the sanitizer and the export/preview renderer. Full details, including the
host-side `Referrer-Policy` header and the WordPress/Jetpack note, are in
[embedding.md](embedding.md#youtube-error-153-and-referrerpolicy).

## Benchmark

`test/benchmarks/preview/` runs a three-way, real-browser comparison — `main` vs
this branch's filtered default vs opaque-enabled — with a gate that the default
mode stays within 10% of `main`. See the
[benchmark README](../../test/benchmarks/preview/README.md) and
[committed results](../../test/benchmarks/preview/results/comparison.md).
