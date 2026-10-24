---
id: ADR-2199-07
title: "Isolate the static/PWA preview in a sandboxed srcdoc document instead of consenting to same-origin execution"
status: Proposed
date: 2026-10-24
tracking_issue: 2199
deciders:
  - "@erseco"
reviewers: []
related:
  prs: [2199]
  changes: []
  adrs: [ADR-2199-02, ADR-2199-03, ADR-2199-05, ADR-2199-10]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2199-07: Isolate the static/PWA preview in a sandboxed srcdoc document instead of consenting to same-origin execution

## Context

The hybrid trust boundary ([ADR-2199-02](ADR-2199-02-hybrid-preview-trust-boundary.md))
filters author-controlled active content by default and, when the user enables it, moves
the unfiltered snapshot into an opaque origin: eXe's own capability routes in web/server
mode, the host's routes when embedded. Its static/PWA/PHP-WASM row was the exception —
`consented-same-origin`: after a warning dialog the author's JavaScript ran in the
Service-Worker-served preview iframe, which carries `allow-same-origin`, and therefore with
the editor's origin, DOM, IndexedDB and Service Worker messaging surface.

A draft record carried from PR #1968 (its ADR 0016, which held this sequence slot until
this record replaced it) justified that exception: a Service Worker cannot serve an opaque
frame (Phase 0 spike S3, three engines), OPFS is origin-scoped, and "`srcdoc`/`blob:`-based
transports either inherit the app origin or cannot carry a multi-file package with working
relative references". It concluded that "no client-only mechanism is claimed to isolate" the
static preview. The first two findings stand and are kept below; the third was wrong.

That conclusion blocks [ateeducacion/exelearning#48](https://github.com/ateeducacion/exelearning/pull/48)
(direct ELPX Save/Save As in the static editor): an editor origin that can be made to run
imported JavaScript must never hold a reusable file-write capability (ADR-48-01). Its browser
characterization read an app-origin IndexedDB sentinel from imported content through an
editor-origin blob sink. An explicit user confirmation is a trust decision, not an origin
boundary, and the same-origin row made the whole runtime matrix a filter rather than a
boundary.

## Problem

Can the static/PWA editor isolate enabled author code in a browser-enforced opaque origin
with no backend, online and offline, while keeping multi-page navigation and the project's
own resources working — and if so, what is the smallest transport that does it?

## Decision drivers

- No author JavaScript may execute with the editor's origin, in any runtime, even after
  the user enables it. Consent does not substitute for an origin boundary.
- Fail closed: where isolation cannot be delivered, keep the filtered preview and block
  activation visibly. No silent downgrade to same-origin execution.
- Static/PWA has no server and must work offline, including as an installed PWA.
- Reuse what exists: the panel already inlines resources and bridges page navigation for
  its same-origin fallback (used where a Service Worker cannot register).
- Keep the default preview at its current cost: the Service Worker path and the content
  policy are untouched.

## Options considered

### Option 1: Keep `consented-same-origin` with a stronger warning or a feature flag

Rejected. Neither changes what the code can reach once it runs; the exposure measured in
PR #48 stays. The task brief rules this out explicitly, and so does ADR-48-01.

### Option 2: Sandboxed iframe navigated to the same-origin Service Worker URL

Rejected by measurement. A frame sandboxed without `allow-same-origin` is never controlled
by the Service Worker in Chromium, Firefox or WebKit (S3, re-verified below), so `/viewer/*`
would reach the static host and 404. There is nothing to serve from.

### Option 3: Sandboxed iframe navigated to a `blob:` URL minted by the editor

Measured: the navigation works and the document is opaque, but relative URLs resolve
against the `blob:` URL and break, so every resource must be inlined anyway; and
sub-resources that are themselves editor-minted `blob:` URLs are refused by the opaque
origin. It buys nothing over `srcdoc` and adds a dependency on blob-URL partitioning
behaviour that is still changing across engines.

### Option 4: Sandboxed `srcdoc` document with fully inlined resources (chosen)

Load the unfiltered snapshot page through the iframe's `srcdoc` attribute with the same
sandbox token set the capability-URL transports use (`allow-scripts allow-forms allow-popups
allow-downloads allow-presentation allow-popups-to-escape-sandbox`, never
`allow-same-origin`). The browser gives the document an opaque origin on its own; no header
and no server is involved. Stylesheets, scripts, images, fonts and local media are inlined
(the existing same-origin fallback already did this for everything but media), so the
document needs no network — it works offline and inside an installed PWA. Page navigation
and opening project files stay parent-bridged through the existing `postMessage` handlers,
which trust only the two preview frames by window identity.

### Option 5: A separate preview origin

Not pursued: static deployments are a single origin by contract (Cloudflare Pages, nginx,
`file://`-adjacent PWA installs), it would silently add a deployment dependency, and
Option 4 already gives a browser-enforced opaque origin.

### Option 6: Block activation in static/PWA

The fallback if Option 4 could not be demonstrated. Kept as the fail-closed path: when the
inlined snapshot cannot be built, the grant is dropped, the user is told, and the filtered
preview stays.

## Evidence

All measurements at `feature/preview-trust-boundary` (this record's commit), real browsers,
Playwright. The executable form is
`test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts` (Chromium and Firefox in the
suite); the same probe was run in WebKit 26 with a scratch Playwright 1.64.1 install on
2026-10-24 with identical results, except the `document.cookie` nuance noted below.

| Probe inside the frame | sandboxed `srcdoc` (no `allow-same-origin`) | `srcdoc` + `allow-same-origin` (control) |
|---|---|---|
| `window.origin` | `"null"` (all three engines) | the editor origin |
| `parent.document`, `top.location` | `SecurityError` | accessible |
| `document.cookie` | `SecurityError` (Chromium, Firefox); `""` (WebKit) | `spike=secret` |
| `localStorage`, `indexedDB.open` | `SecurityError` | accessible |
| `navigator.serviceWorker` | throws (Chromium, WebKit); exposed, `controller === null` (Firefox) | controlled |
| `fetch('/sw-only.html')` (SW-synthesised) | `TypeError` — not served, host not even fetchable | served by the SW |
| `fetch(blob:)` / `<img src=blob:>` minted by the parent | `TypeError` / `error` | 200 / loaded |
| nested `srcdoc` iframe reaching `parent.parent` | `SecurityError` | accessible |
| `document.baseURI` | the editor's URL | the editor's URL |
| classic `<script src>` / `<link rel=stylesheet>` relative to the host | load (no-CORS) | load |
| module `<script type=module src>` relative to the host | blocked (CORS, `Origin: null`) | loads |

S3 reproduced in the same run: a `sandbox="allow-scripts"` frame navigated to a URL only
the Service Worker answers renders the origin server's 404 body; the same frame with
`allow-same-origin` renders the Service Worker's body (Chromium, Firefox, WebKit).

Consequences drawn from the table and built into the transport:

- the document is isolated by origin, not by filtering — the author's `<script>` runs
  (`data-marker="ran"` is asserted in the static E2E) and still reaches nothing;
- `blob:` URLs minted by the editor are unusable inside it, so PDF embeds become links
  that the editor turns into a PDF.js tab (the same `exe-blob-open-document` path the
  same-origin fallback uses), and media is inlined as `data:` URIs up to 25 MiB per file;
- the opaque document cannot fetch the editor host, so everything it needs is inlined;
  the leftover relative URLs resolve against the editor's base URL and simply 404.

Code: `public/app/utils/previewContentPolicy.js` (`PREVIEW_TRANSPORTS.SRCDOC_OPAQUE`, the
`consented-same-origin` state removed, `createPreviewContentPolicy()` always filtered),
`public/app/workarea/interface/elements/previewPanel.js` (`refreshWithSrcdocSnapshot`,
`_refreshSrcdocOpaqueOrStayFiltered`, `_replacePdfEmbedsWithLinks`, media inlining,
strict `_isPreviewIframeSource`), `src/shared/preview/preview-mode-matrix.ts`
(`opaque-srcdoc`), with the consistency spec pinning the shipped policy to the matrix.

## Decision

We will isolate the static/PWA/PHP-WASM preview, once the user enables author active
content, in an iframe sandboxed without `allow-same-origin` whose document is loaded
through `srcdoc` with every resource inlined. The transport matrix becomes:

| Runtime | Default | Active content enabled |
|---|---|---|
| Web / server | Same-origin SW, source-filtered | Opaque capability URL (eXe routes) — unchanged |
| Embedded LMS/CMS | Same-origin SW, source-filtered | Opaque capability URL (host routes) — unchanged |
| **Static bundle / PWA / PHP-WASM** | Same-origin SW, source-filtered | **Opaque `srcdoc` document, fully inlined** |
| Electron | Same-origin SW, source-filtered | Blocked — unchanged |

No row runs author code with the editor's origin. The `consented-same-origin` transport,
trust state and its consent dialog are removed, not renamed. The same-origin content policy
(`createPreviewContentPolicy`) no longer takes a runtime or project: it is always filtered,
so a same-origin surface — Service Worker preview, inlined fallback, print preview — can
never be loosened by a grant. ADR-2199-02 and ADR-2199-10 carry this static row directly
(all three are drafts on the same branch); their other decisions — hybrid boundary, D1
revocation, single-source matrix with a consistency gate — stand. The earlier draft
conclusion that no client-only mechanism can isolate the static preview was wrong on
`srcdoc`: a sandboxed `srcdoc` document does get an opaque origin, and inlining removes the
need for relative references to a server.

Alongside, two same-origin sinks reachable from the opaque document are hardened: the
parent's `message` handlers accept only events whose `source` is one of the two preview
frames (a sourceless message is no longer accepted), and the "open this project file in a
new tab" handler never mints a scriptable blob (`image/svg+xml` dropped; unknown types
download as `application/octet-stream`), because an author script in the opaque frame can
forge that message and an editor-origin SVG blob opened top-level would run its script with
the editor's authority. The inlined same-origin fallback now loads through `srcdoc` too
(no sandbox, so it keeps the editor origin as before); the editor-origin `blob:` page URLs
are gone, which removes the sink PR #48 used for its characterization.

## Consequences

### Positive

- Static/PWA enabled previews are isolated by a browser-enforced opaque origin, offline
  too; the matrix is a boundary in every row, not a filter in one of them.
- One inlining pipeline serves both the same-origin fallback and the opaque transport; the
  difference is the sandbox attribute set before the load.
- Less code: the `consented-same-origin` transport and dialog branch, the
  `Capabilities.preview` mirror (a third copy of the matrix with no product consumer) and
  the per-page `blob:` URL bookkeeping are deleted.
- The first prerequisite of ADR-48-01 — no same-origin execution path through preview
  activation — is met for the authoring preview surfaces this record covers.

### Negative

- While enabled in static/PWA, every refresh re-inlines the snapshot page: base64 for
  images, fonts and media (1.33× their size, capped at 25 MiB per media file). Opt-in and
  temporary, like the capability-URL upload it mirrors.
- In the opaque static document: PDF embeds render as "open in a new tab" links rather
  than in place (an editor-minted `blob:` cannot be fetched, and PDF.js cannot be imported
  cross-origin); local media above the cap does not play; module scripts and fonts that an
  author page loads from the editor host by relative URL fail CORS. **MathJax does not
  typeset**: MathJax 4 loads components and font ranges at runtime by URL relative to the
  page, and an inlined document has no server to answer them (measured on the static
  build). The same holds for anything an iDevice fetches at runtime by relative URL. The
  inliner is a regex pass over the generated HTML (`<link>`, `<script src>`, `<img>`,
  media, CSS and `style="url()"`); it resolves what is referenced statically, not what
  code requests later. The inlined page weighs ~2.6 MB per refresh for an empty project.
  The default filtered preview is unaffected by all of this.
- "Open in a new tab" while enabled in static shows the filtered Service Worker preview:
  a `srcdoc` document has no URL, and an unfiltered editor-origin blob is exactly what must
  not exist.
- Author pages that resolve relative URLs against the document location (rather than
  through inlined resources) see the editor's base URL, as they already did in the
  same-origin fallback.

### Neutral

- Web/server, embedded and Electron behaviour is unchanged.
- Stored project data and saved exports are untouched: the preview policy and the inlining
  operate on generated preview files only.

## Risks

- **Already-running contexts.** Changing the transport does not revoke anything a stale
  tab or installed PWA is executing with old code; an older same-origin preview document
  keeps its powers until that context is reloaded. Enabling persistent file capabilities
  (PR #48) therefore needs a deployment boundary: all static clients on this code, and old
  tabs reloaded, before a handle is ever stored. This record does not provide that.
- **Other editor-origin surfaces.** The editor still renders iDevice `htmlView` into its
  own DOM via `innerHTML` and renders the screenshot page in a hidden iframe; those are
  separate execution surfaces outside this record, addressed by the in-flight
  `hotfix/idevice-render-xss` branch (sanitised `exportHtmlView`, script-less screenshot
  frame). PR #48 remains blocked until that lands.
- **The default preview remains a filter.** The Service Worker preview keeps
  `allow-same-origin` because S3 leaves no alternative for a Service Worker transport; its
  safety is the content policy plus DOMPurify, exactly as ADR-2199-02 accepted. This record
  changes the *enabled* path only.
- **Engine drift.** The facts in Evidence are measured, and the spec that measures them is
  in the suite, so a browser change that broke the boundary would fail CI rather than
  silently weaken it.

## Validation

- `src/shared/preview/preview-mode-matrix.spec.ts` — the matrix has no same-origin
  enabled cell; `preview-mode-matrix.consistency.spec.ts` — the shipped policy agrees
  cell by cell and its source contains no consent state.
- `public/app/utils/previewContentPolicy.test.js` — `createPreviewContentPolicy()` filters
  regardless of grant; `PREVIEW_TRUST_STATES` is exactly `filtered`/`opaque-enabled`.
- `public/app/workarea/interface/elements/previewPanel.test.js` — sandbox set before the
  srcdoc load, report-only generation, inlined CSS/images/media, PDF links in the opaque
  document vs PDF.js placeholders in the same-origin fallback, fail-closed path, D1
  revocation unloading the opaque document, strict message source, no scriptable blob for
  a forged open-document request, filtered new tab.
- `test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts` — the browser facts above,
  with a same-origin control, in Chromium and Firefox.
- `test/e2e/playwright/specs/preview-active-content-static.spec.ts` — against the built
  static distribution: filtered default, enable → `srcdoc` + sandbox without
  `allow-same-origin`, the author script runs and cannot read an editor-origin IndexedDB
  sentinel, cookies or storage, cannot reach the parent or the Service Worker; navigation
  between pages; pinned frame; "open in a new tab" is filtered; disable returns to the
  Service Worker preview.

## Follow-up work

- Deployment boundary and stale-context policy before PR #48 stores any file handle
  (ADR-48-01 follow-up).
- Embedded hosts without snapshot routes could use the same `srcdoc` transport instead of
  failing closed; deliberately not changed here to keep the host contract stable.
- Revisit in-place PDF rendering in the opaque static document if a CORS-enabled asset
  origin or an inlined PDF.js build becomes acceptable.

## References

- `test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts`,
  `test/e2e/playwright/specs/preview-active-content-static.spec.ts`
- `public/app/utils/previewContentPolicy.js`,
  `public/app/workarea/interface/elements/previewPanel.js`,
  `src/shared/preview/preview-mode-matrix.ts`, `src/shared/security/previewSandbox.ts`
- `doc/development/preview-architecture.md`, `doc/development/external-media-inventory.md`
  (spike S3)
- [ADR-2199-02](ADR-2199-02-hybrid-preview-trust-boundary.md),
  [ADR-2199-10](ADR-2199-10-preview-transport-matrix-as-a-single-source.md)
- [ateeducacion/exelearning#48](https://github.com/ateeducacion/exelearning/pull/48) and its
  ADR-48-01 (content isolation before file capabilities)
- [HTML: iframe sandbox and the sandboxed origin browsing context flag](https://html.spec.whatwg.org/multipage/browsers.html#sandboxed-origin-browsing-context-flag)
