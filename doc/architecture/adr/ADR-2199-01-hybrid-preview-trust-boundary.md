---
id: ADR-2199-01
title: "Hybrid preview trust boundary: source-filtered by default, opaque on enable, transport decided by the runtime"
status: Accepted
date: 2026-10-24
tracking_issue: 2199
deciders:
  - "@erseco"
related:
  prs: [1968, 2199]
  changes: []
  adrs: [ADR-2199-02, ADR-2199-03, ADR-2199-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2199-01: Hybrid preview trust boundary: source-filtered by default, opaque on enable, transport decided by the runtime

> Consolidates three drafts of this branch: *source-aware preview filtering and opaque
> embedded isolation* (2026-07-14, OpenAI Codex / GPT-5), *hybrid preview trust boundary*
> (2026-07-22, Claude Code / Claude Fable 5) and *the transport matrix is a single source with
> a consistency gate* (2026-07-26, Claude Code / Claude Opus 5). Their decisions are kept;
> the static row now points at [ADR-2199-04](ADR-2199-04-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)
> instead of a same-origin consent path.

## Context

The editor preview combines two trust levels. Official themes, libraries, MathJax and
iDevice runtimes are maintained by the project and must keep working. Authors add active
HTML through TinyMCE and HTML fields, component properties, custom head/footer and CSS,
imported `.elp`/`.elpx` projects and custom iDevices. On `main` all of it rendered in a
Service-Worker-served iframe that carries `allow-same-origin`: author JavaScript ran with
the editor's origin — DOM, Yjs state, IndexedDB, session cookies, and in Electron the
`preload.js` bridge.

Two prior efforts sat at opposite ends of a cost/safety trade-off:

- **PR #1968 (maximal).** Every refresh in every runtime goes through an opaque-origin HTTP
  sandbox: cookieless capability sessions, layered fixed/session/generated resources,
  incremental revisions, a provider abstraction, an Electron `app://` transport and an
  external-media bridge. Browser-enforced and strong, but every refresh becomes a server
  round-trip, the first upload is MiBs, and the operational surface is disproportionate to
  the threat in the ordinary editor.
- **Filtering only (first draft of this branch).** Keep `main`'s zero-network preview and
  disable author active content by default through a parser-based, source-aware policy.
  Fast and simple, but its enable path ran author JavaScript same-origin — "to view this
  content, click enable" is classic social engineering.

## Problem

How should the editor preview isolate author-controlled active content so that (a) the
default experience stays as fast as `main`, (b) a user who opts into author JavaScript does
not thereby expose the editor's origin in any runtime, and (c) runtimes that cannot isolate
are handled honestly rather than pretending to?

## Decision drivers

- Default preview at parity with `main`: zero network, no server round trip.
- No author JavaScript with the editor's origin, in any runtime, even after enabling.
  Consent is a trust decision, not an origin boundary.
- Fail closed: an opaque transport that cannot be established leaves the preview filtered
  and says so; never a silent same-origin fallback.
- Never mutate Yjs data or saved exports; the policy applies to generated preview files only.
- Reuse what exists (the embedded-host snapshot client, the panel's inlined fallback).
- One place owns the transport decision, with a gate that fails when a second copy drifts.

## Options considered

### Filter all final preview HTML

Rejected. A whole-document sanitizer cannot tell official eXeLearning scripts from author
content and would break maintained iDevice and theme behaviour.

### Route every runtime through PR #1968's opaque HTTP protocol

Rejected for the ordinary editor: a browser-enforced boundary, but layered resources,
revision synchronization, providers and Electron serving for a cost the default preview
does not need to pay. Its capability-serving core is kept as a minimal subset
([ADR-2199-02](ADR-2199-02-serve-the-enabled-preview-from-an-opaque-capability-snapshot.md)).

### Filter by default, consent to same-origin execution on enable

Rejected. It is exactly the exposure ateeducacion/exelearning#48 measured (an imported
script reading an editor-origin IndexedDB sentinel), and it makes the matrix a filter rather
than a boundary in the one runtime that will one day hold file capabilities.

### Hybrid: filter by default, opaque origin on enable, transport by runtime (chosen)

## Evidence

- `src/shared/export/exporters/Html5Exporter.ts::generateForPreview` produces the preview
  file map; author fields enter through `src/shared/export/adapters/YjsDocumentAdapter.ts`
  and official resources through `PageRenderer`/`BrowserResourceProvider`, so a document
  adapter can filter by provenance. `PreviewDocumentAdapter` classifies every metadata
  field and fails closed on an unclassified one (`PreviewDocumentAdapter.spec.ts`).
- The policy's cost was measured in a real-browser three-way benchmark during development
  (`main` vs filtered vs opaque, 25 samples): +1.4 / +2.9 / +4.4 ms on a 7–8 ms generation
  for 3/25/50-page fixtures (2026-10-24, Apple M5, Chromium). The harness was not kept; the
  numbers are informational.
- A sandboxed frame without `allow-same-origin` is never Service-Worker controlled in
  Chromium, Firefox or WebKit (Phase 0 spike S3, re-verified by
  `test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts`). This is why the static
  runtime cannot reuse the Service Worker transport once isolated, and it is not caused by
  HTTP headers.
- `app/main.js` configures the Electron renderer with `preload.js`; a same-origin preview
  can reach its parent's exposed bridge even with Node integration disabled.
- Yjs `origin` attribution separates local edits from remote updates
  ([ADR-2199-03](ADR-2199-03-preview-grant-revocation-under-collaboration.md)).

## Decision

### Default: source-aware filtering of author content only

The normal preview keeps the Service Worker transport. A preview-only, parser-based policy
(`public/app/utils/previewContentPolicy.js`, applied by `PreviewDocumentAdapter` on a clone)
disables author-controlled active content — scripts, inline `on*` handlers,
`javascript:`/active `data:` URLs, `srcdoc`, `base`, `meta refresh`, HTML imports,
`form action`, SVG scripts/handlers, active XML processing instructions, a `</style>`
breakout in author CSS — in component HTML, component properties, custom head, footer and
styles. Official scripts, themes, MathJax and iDevice runtimes are never filtered.
`<object>`/`<embed>` are decided per element (PDF/media kept, scriptable documents removed).
Iframes of trusted embed hosts (`public/app/utils/trustedEmbedHosts.js`) keep a
cross-origin video sandbox and play inline. The UI shows an indicator when something was
disabled and requires an explicit enable action. Stored Yjs content and saved exports are
untouched.

### Enable: an opaque origin, chosen by the runtime

| Runtime | Default | Active content enabled |
|---|---|---|
| Web / server | Same-origin SW, filtered | **Opaque snapshot** on eXe's own capability URL, iframe `sandbox` without `allow-same-origin` ([ADR-2199-02](ADR-2199-02-serve-the-enabled-preview-from-an-opaque-capability-snapshot.md)) |
| Embedded LMS/CMS | Same-origin SW, filtered | **Opaque snapshot** on the **host's** capability routes, same client and sandbox |
| Static bundle / PWA / PHP-WASM | Same-origin SW, filtered | **Opaque `srcdoc` document**, fully inlined, no server ([ADR-2199-04](ADR-2199-04-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)) |
| Electron | Same-origin SW, filtered | **Blocked**: the preview shares a renderer with the preload bridge |

No row runs author code with the editor's origin. There is no fallback between rows: when
an opaque transport cannot be established the grant is dropped, the user is told, and the
filtered preview stays. The same-origin content policy takes no runtime or project input
and is always filtered; a grant switches the transport, it never loosens the policy.

The grant is per project and editor session, cleared on project replacement and revoked by
any document update not positively identified as local
([ADR-2199-03](ADR-2199-03-preview-grant-revocation-under-collaboration.md)). Leaving an
opaque transport disposes the server snapshot or unloads the `srcdoc` document and restores
the template's own iframe sandbox.

### One table, one gate

The matrix is declared once in `src/shared/preview/preview-mode-matrix.ts`, modelling only
what the code can produce (no `dedicated-origin`: Electron's custom scheme fails provider
embedder checks; no `playground` runtime: `RuntimeConfig` only knows `static`/`server`,
and backend-less resolves as `static`). The shipped browser decision
(`resolvePreviewTransport()` in `previewContentPolicy.js`) is a second implementation,
pinned by `preview-mode-matrix.consistency.spec.ts`, which executes it across every cell
and fails on disagreement, on a runtime-dependent loosening of the filtered policy, or on a
second owner of the sandbox tokens (`src/shared/security/previewSandbox.ts` owns them).
An unmodelled runtime throws; guessing is the silent degradation the matrix exists to
prevent.

### Threat model

Assets: the editor DOM and JS context, Yjs project state, eXe session cookies, host LMS
credentials (embedded), editor-origin storage (IndexedDB, Cache Storage, OPFS), any file
capability the static editor may one day hold, the user's machine (Electron). Adversary: a
malicious `.elpx`/`.elp`, or a collaborator injecting active content mid-session; in the
opaque transports their script runs and can forge any `postMessage`, so the parent trusts
only its two preview frames by window identity (never `event.origin`, which is `"null"`
for an opaque document) and never mints a scriptable editor-origin blob on request.
In scope: author code reaching those assets during preview. Out of scope: network egress
from the opaque frame (hence a `sandbox`-only CSP that does not restrict
`frame-src`/`connect-src`, which would break H5P, maps, GeoGebra for no in-scope gain),
deceptive content, and the trust model of published exports.

## Consequences

### Positive

- Default preview at `main` parity; isolation cost is opt-in and temporary.
- The matrix is a boundary in every row, not a filter in one of them.
- One snapshot client (`EmbeddedPreviewSnapshot`) for hosts and the editor; one inlining
  pipeline for the same-origin fallback and the static opaque transport.
- A second, disagreeing copy of the decision cannot appear quietly.

### Negative

- Default-preview safety rests on a complete inventory of author-controlled fields and
  on DOMPurify plus the policy — enforced by the adapter's unclassified-field failure, but
  a sanitizer boundary all the same.
- Enabled previews pay a full snapshot upload or a full inlining per refresh.
- Electron users cannot run author active content in the preview without an
  isolated-renderer design.
- The shipped policy remains a second implementation of the matrix until a later change
  makes it derive from the module.

### Neutral

- Published/exported content keeps author JavaScript and its own delivery trust model.

## Risks

- A new author-editable HTML field added without classification is caught by
  `PreviewDocumentAdapter.spec.ts`; a new same-origin sink (an `innerHTML` of author
  content outside the preview) is not — those surfaces are audited separately
  (`hotfix/idevice-render-xss`).
- Changing a transport does not revoke what a stale tab or installed PWA executes with
  older code; persistent file capabilities need a deployment boundary on top of this.
- The runtime→`runtimeConfig` mapping could drift; it lives in the consistency spec beside
  the assertions that use it.

## Validation

- `public/app/utils/previewContentPolicy.test.js` — detection corpus, transport
  resolution, state machine, always-filtered same-origin policy.
- `src/shared/preview/preview-mode-matrix.spec.ts` and
  `preview-mode-matrix.consistency.spec.ts` — totality, no same-origin enabled cell,
  agreement with the shipped policy, visible failure paths, one sandbox owner.
- `src/shared/export/adapters/PreviewDocumentAdapter.spec.ts` — classification inventory
  and non-mutation.
- `test/e2e/playwright/specs/preview-active-content.spec.ts` (server),
  `preview-active-content-static.spec.ts` (static build), `preview-srcdoc-isolation.spec.ts`
  (browser facts).

## Follow-up work

- Make `previewContentPolicy.js` derive from `preview-mode-matrix.ts`.
- Isolated-renderer design before Electron can enable author active content.
- Deployment boundary and stale-context policy before ateeducacion/exelearning#48 stores
  any file handle.

## References

- `public/app/utils/previewContentPolicy.js`,
  `public/app/workarea/interface/elements/previewPanel.js`,
  `src/shared/export/adapters/PreviewDocumentAdapter.ts`,
  `src/shared/preview/preview-mode-matrix.ts`, `src/shared/security/previewSandbox.ts`
- `doc/development/preview-architecture.md`
- [Core PR #1968](https://github.com/exelearning/exelearning/pull/1968),
  [ateeducacion/exelearning#48](https://github.com/ateeducacion/exelearning/pull/48)
