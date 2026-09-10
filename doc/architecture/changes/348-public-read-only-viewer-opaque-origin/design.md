---
tracking_issue: 348
title: "Public Read-Only Viewer with Opaque-Origin Untrusted-Content Isolation"
status: implemented
date: 2026-07-09
legacy_id: SDD-0004
authors:
  - "@erseco"
reviewers:
  - "@pabloamayab"
implementation_prs: [1425]
related_adrs: [ADR-348-01, ADR-348-02, ADR-348-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# Public Read-Only Viewer with Opaque-Origin Untrusted-Content Isolation — design

## Summary

This design adds a **public, no-login, read-only viewer** for a finished project
(issue #348). A project owner can enable a shareable link that renders the project's
HTML5 export to anyone, without granting edit access. Because the export is
author-provided HTML/JS and therefore **untrusted**, the content is served **from the
server** and rendered inside a sandboxed iframe **without** `allow-same-origin`, giving
it an **opaque origin** that cannot reach the authenticated application session,
cookies, storage, API, or the parent window. The isolation is reinforced by a
response-level `Content-Security-Policy: sandbox …` header so it holds even when the
content URL is opened directly. The link is addressed by a dedicated opaque
`public_view_id` (distinct from the project `uuid`) and gated by an independent
`public_view_enabled` flag; the rendered export is cached in memory keyed by the Yjs
document version and bounded to resist abuse.

## Problem statement

Educators need to share a finished eXeLearning resource as a plain web page that anyone
can open, without accounts and without exposing editing. eXeLearning already renders
exports for the author via a same-origin Service Worker preview, but that path is unsafe
for a public link: the resource's own scripts would run in the application origin and
could act as whoever opens the link — including a logged-in admin. The problem is to
publish untrusted content publicly while guaranteeing it cannot touch the app session,
and to do so on ordinary single-host installs without new DNS or a second deployment.

## Goals

- A public URL renders a project's export with no authentication.
- Untrusted content runs in an **opaque origin**: `window.origin === 'null'`, no
  `window.parent`/`top` access, no `auth` cookie, no `/api/...` as the viewer, no app
  IndexedDB/Cache access — even under fullscreen or when opened directly.
- The public link never exposes the internal editing `uuid`.
- Read-only publication is **independent** of edit `visibility`.
- The owner can enable, disable, and regenerate (revoke) the link.
- The public view reflects the latest persisted edit while avoiding a rebuild per
  request and resisting denial-of-service.
- Ships with unit, route, and E2E tests.

## Non-goals

- No public **editing** or collaboration on the public link (read-only only).
- No unauthenticated **bulk ZIP** download of the export.
- No separate user-content origin/subdomain (considered, deferred — ADR-348-01).
- No change to the workarea preview: it keeps its same-origin Service Worker because
  the author previews their own content.
- No per-IP rate limiting inside the route (delegated to the reverse proxy).

## Current state

- Author preview is same-origin via a Service Worker (`public/preview-sw.js`,
  `Html5Exporter.generateForPreview()`); see `doc/architecture.md` §8.1–8.5.
- Projects have an internal `uuid` and a `visibility` (`public`|`private`) column that
  governs **edit** access; `checkProjectAccess()` grants access to `public` projects
  (`src/db/queries/projects.ts`).
- Server-side export exists via the shared `Html5Exporter` and `YjsDocumentAdapter`
  (`src/shared/export`, used by CLI and the external API), and the authenticated export
  API lives at `src/routes/api/v1/export.ts`.
- Yjs persistence writes only to `yjs_documents` / `yjs_updates` and does **not** bump
  `projects.updated_at` (`src/db/queries/yjs.ts`).

Before this branch there was no public, unauthenticated viewer and no opaque-origin
serving path.

## Proposed design

Two server routes on the app origin (`src/routes/pages.ts`):

1. **Loader** — `GET /view/:publicViewId`: a trusted shell page
   (`views/viewer/viewer.njk`) that hosts the untrusted content in a sandboxed iframe.
2. **Content** — `GET /view/:publicViewId/_/*`: serves the individual files of the
   project's HTML5 export with isolation headers.

```
GET /view/:publicViewId            (trusted loader, app origin)
  views/viewer/viewer.njk
    └── <iframe sandbox="allow-scripts allow-popups allow-forms
                          allow-downloads allow-popups-to-escape-sandbox"   (NO same-origin)
                referrerpolicy="no-referrer"
                src="/view/:publicViewId/_/index.html">
                              │  (opaque origin)
                              ▼
GET /view/:publicViewId/_/*        (untrusted content)
  src/routes/pages.ts → getPublicViewFile(project, relPath)
    ├── buildHtml5PreviewExport()  (built once, cached by Yjs document version)
    ├── normalizePublicViewPath()  (path-traversal safe)
    └── headers: Content-Security-Policy: sandbox … ; Permissions-Policy ;
                 X-Content-Type-Options: nosniff ; Cache-Control: no-store
```

The sandbox tokens and header values are the single source of truth in
`src/shared/security/publicViewSandbox.ts`, consumed by both the iframe attribute
(via the loader view model) and the content response CSP. See ADR-348-01 for the
isolation decision, ADR-348-02 for the identifier/enablement model, and ADR-348-03 for
caching and cost guards. This design does **not** introduce a subdomain.

## User experience

- In the workarea **Share** modal, an owner sees an **Edit access** section (existing
  `visibility`) and a new, independent **public read-only link** section
  (`views/workarea/modals/pages/modalShare.njk`,
  `public/app/workarea/modals/modals/pages/modalShare.js`).
- Toggling the public read-only dropdown to *enabled* calls
  `apiCallManager.updatePublicViewAccess()`; a read-only link appears, built from the
  opaque `public_view_id` (`buildPublicViewerUrl()`), copyable via the copy button.
- A **Regenerate** action (with inline confirm) mints a new id, invalidating the old
  link. Non-owners see the controls disabled.
- Opening the link shows a brief loader, then the resource inside the sandboxed iframe.
  Only the owner's controls are gated; anyone can view when enabled.
- Edge cases: a disabled or unknown link returns **404** (not 403) so existence is not
  leaked; using the internal `uuid` at `/view/:uuid` also returns 404.

## Technical design

Components (all present on this branch):

| Concern | File | Notes |
|---|---|---|
| Isolation policy (tokens + headers) | `src/shared/security/publicViewSandbox.ts` | `PUBLIC_VIEW_SANDBOX` (no `allow-same-origin`), `publicViewCspHeader()`, `publicViewPermissionsPolicy()`, `resolvePublicViewCspProfile()` |
| Content service | `src/services/public-view-content.ts` | `buildHtml5PreviewExport()`, `getPublicViewFile()`, `normalizePublicViewPath()`, in-memory cache, in-flight coalescing, size bounds, DI hooks |
| Routes (loader + content) | `src/routes/pages.ts` | `GET /view/:publicViewId`, `GET /view/:publicViewId/_/*` |
| Owner controls (REST) | `src/routes/project.ts` | `PATCH …/public-view`, `POST …/public-view/regenerate` (+ `/uuid/:uuid/…` variants) |
| Queries | `src/db/queries/projects.ts`, `src/db/queries/yjs.ts` | `findProjectByPublicViewId`, `generatePublicViewId`, `setPublicViewEnabled(ByUuid)`, `regeneratePublicViewId(ByUuid)`, `getDocumentVersion` |
| Loader template | `views/viewer/viewer.njk` | Sandboxed iframe, `referrerpolicy="no-referrer"`, loader |
| Share UI | `views/workarea/modals/pages/modalShare.njk`, `public/app/workarea/modals/modals/pages/modalShare.js`, `assets/styles/components/_share.scss` | Independent public read-only section |
| REST client | `public/app/rest/apiCallManager.js` | `updatePublicViewAccess`, `regeneratePublicViewId` |

Data flow (content request): resolve project by `public_view_id`; 404 unless
`public_view_enabled`; `getPublicViewFile()` normalizes the path, obtains the unzipped
export from cache (keyed by `public_view_id` + `getDocumentVersion()`), building once if
missing and coalescing concurrent builds; return the file with isolation headers.
`buildHtml5PreviewExport()` reuses the shared `Html5Exporter` over a
`ServerYjsDocumentWrapper`/`YjsDocumentAdapter` and combined FS/DB asset providers, so
the public view and the export API share one exporter (single source of truth).

## Data model

Two new `projects` columns (`src/db/types.ts`, migrations 008/009):

- `public_view_id VARCHAR(36) NULL` — opaque public identifier, distinct from `uuid`,
  with a **unique** index `idx_projects_public_view_id` (multiple NULLs allowed on all
  three engines). Generated by `generatePublicViewId()` = `randomUUID()`.
- `public_view_enabled INTEGER NOT NULL DEFAULT 0` — 0/1 flag, independent of
  `visibility`.

No new tables; no ELP/ELPX shape change. The in-memory export cache
(`Map<public_view_id, { key, files }>`) is a runtime structure, not persisted; its key
is `${public_view_id}:${getDocumentVersion()}`.

## Migration and compatibility

- Forward migrations `008_project_public_view_id` and `009_project_public_view_enabled`
  are registered in `src/db/migrations/index.ts`; each has a `down()`. New columns
  default to "no public link", so existing projects are unaffected.
- `getDocumentVersion()` (`src/db/queries/yjs.ts`) is used for cache invalidation
  precisely because `projects.updated_at` is not bumped by Yjs persistence; this keeps
  the cache correct after compaction.
- The authenticated export API is unchanged and still owner-gated; there is
  intentionally **no** public bulk ZIP endpoint (`src/routes/api/v1/export.ts`).
- Rollback: disable the feature by leaving `public_view_enabled = 0`; `down()`
  migrations drop the columns/index.

## Security and privacy

- **Opaque origin (R1):** `PUBLIC_VIEW_SANDBOX` omits `allow-same-origin`; the iframe
  and the response CSP both carry the `sandbox` directive.
- **Single source of truth (R2):** tokens + headers in
  `src/shared/security/publicViewSandbox.ts`; a unit test asserts the CSP sandbox
  tokens equal the iframe tokens.
- **Sandbox in the response CSP (R3):** every `/_/*` response sets
  `Content-Security-Policy: sandbox …`, so isolation holds on direct/fullscreen loads.
- **Restrictive CSP + Permissions-Policy (R4):** `object-src 'none'`, `base-uri 'none'`,
  `frame-ancestors 'self'`, `X-Content-Type-Options: nosniff`, and
  camera/microphone/geolocation/payment disabled. `referrerpolicy="no-referrer"` avoids
  leaking the public URL to external resources.
- **CSP profiles:** `PUBLIC_VIEW_CSP_PROFILE` selects `compatible` (default; allows
  external `https:` assets) or `strict` (`connect-src 'none'`, no open `https:`,
  `'unsafe-eval'` dropped) for sensitive deployments.
- **Path safety:** `normalizePublicViewPath()` rejects traversal, encoded traversal,
  absolute paths, and NUL bytes.
- **No identifier disclosure / no enumeration:** links use the opaque `public_view_id`
  (random UUID); the internal `uuid` is never accepted; disabled/unknown → 404.
- **Owner-only mutations:** enable/disable/regenerate require auth and ownership.
- **Cost/DoS:** in-flight coalescing, 100 MB / 5000-file per-export bounds, 32-entry
  cache cap; `Cache-Control: no-store` (server holds the cache). Per-IP rate limiting is
  left to the reverse proxy.

## Accessibility

- The loader template exposes a spinner with `role="status"` and a screen-reader label,
  and localized "Loading preview…" text.
- The share modal's public read-only controls are standard form controls with help text
  and an `aria-live` region already present in the modal; copy/regenerate are buttons.
- Rendered resource accessibility is a property of the author's export (unchanged by
  this design).

## Internationalization

- New user-facing strings are wrapped: viewer loader uses `| trans` ("Loading
  preview…"); the share modal uses `_()` for the new public-link help strings (e.g.
  "Anyone with this link can view this resource, but not edit it.", "This resource has
  no public read-only link.", "Anyone with this link can open and edit in real time.").
- No files under `translations/` are modified here (key extraction is a separate
  process, per AGENTS.md).

## Performance

- Export built **once** per (project, Yjs document version); subsequent requests serve
  from the in-memory unzipped map.
- Concurrent first-time requests for the same key are **coalesced** onto one in-flight
  promise (no thundering herd).
- Per-export memory bounded (100 MB unzipped / 5000 files); cache size capped at 32
  projects with oldest-entry eviction.
- The build reuses the shared exporter (with server-side LaTeX pre-render hooks); no
  parallel renderer.

## Testing strategy

Implemented on this branch:

- **Isolation policy (unit):** `src/shared/security/publicViewSandbox.spec.ts` — no
  `allow-same-origin`; R3 token parity; R4 lockdown; compatible vs strict profile;
  `resolvePublicViewCspProfile`.
- **Content service (unit):** `src/services/public-view-content.spec.ts` — path
  normalization/traversal/encoded/NUL; content-type resolution; cache rebuild on Yjs
  version change; "stale-free after a persisted edit even when updated_at is unchanged";
  concurrent-build coalescing; size-limit rejection. DI via
  `configurePublicViewContent` / `resetPublicViewContent`.
- **Routes (unit):** `src/routes/pages.spec.ts` — `GET /view/:publicViewId` (404
  unknown/disabled, render when enabled without auth, render when edit-private
  [decoupled], does not expose uuid, 404 when uuid used as public id) and
  `GET /view/:publicViewId/_/*` (opaque-origin CSP, 404 missing file, 404 unknown id
  without leaking existence, 500 on build throw). `src/routes/project.spec.ts` —
  owner-only enable/regenerate. `src/routes/api/v1/export.spec.ts` — no public bypass.
- **Queries / migrations (unit):** `src/db/queries/projects.spec.ts`,
  `src/db/queries/yjs.spec.ts`, `src/db/migrations/008_project_public_view_id.spec.ts`,
  `src/db/migrations/009_project_public_view_enabled.spec.ts`,
  `src/db/migrations/index.spec.ts`.
- **Frontend (unit):** `public/app/workarea/modals/modals/pages/modalShare.test.js`,
  `public/app/rest/apiCallManager.test.js`.
- **E2E (Playwright):** `test/e2e/playwright/specs/public-view-sandbox.spec.ts` — real
  browser probe (`window.origin === 'null'`, blocked parent/cookie, content-response
  `sandbox allow-scripts` without `allow-same-origin`, `referrerpolicy` no-referrer);
  `test/e2e/playwright/specs/share-modal.spec.ts` with
  `test/e2e/playwright/pages/share-modal.page.ts` (`setPublicView`,
  `getPublicViewerLink`). Skipped in static mode (needs the server API).

Patch coverage target ≥ 90% per AGENTS.md.

## Rollout plan

1. Land migrations 008/009 (columns default to disabled — no behavior change).
2. Land queries, isolation policy, content service, routes, and share UI (PR #1425).
3. Feature is inert until an owner enables a public link per project.
4. Operators may set `PUBLIC_VIEW_CSP_PROFILE=strict` for sensitive deployments and add
   `/view/*` rate limiting at the reverse proxy.
5. Documentation reconciliation (`doc/architecture.md`, `AGENTS.md`) tracked under
   PR #2149.

## Risks and mitigations

- **CSP too permissive by default (exfiltration within opaque origin).** Mitigation:
  opaque origin protects the session; `strict` profile available. (ADR-348-03/ADR-348-01.)
- **Stale public view if cache keyed wrong.** Mitigation: keyed on
  `getDocumentVersion()`, not `updated_at`; regression test asserts freshness.
- **DoS via unauthenticated builds / oversized exports.** Mitigation: coalescing +
  size/count/entry bounds; reverse-proxy rate limiting.
- **Identifier leakage / enumeration.** Mitigation: opaque random id, uuid never
  accepted, 404 on disabled/unknown, regenerate to revoke.
- **In-process cache under horizontal scaling.** Mitigation: bounded per process;
  shared cache is a possible follow-up.
- **Doc drift:** `doc/architecture.md` §8.6 text says "updated_at" while code keys on
  the Yjs document version; code is authoritative, reconciliation tracked in PR #2149.

## Open questions

- Should `strict` become the default CSP profile, or be exposed as an admin/per-project
  setting?
- Is a shared/replicated export cache warranted for multi-process deployments?
- Should the reverse-proxy rate limit for `/view/*` be shipped as a documented default?

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Isolate untrusted public content in a server-served opaque origin | ADR-348-01 | Proposed |
| Distinct opaque public identifier gated by an independent enablement flag | ADR-348-02 | Proposed |
| Cache the export by Yjs document version, bound cost, no unauthenticated bulk ZIP | ADR-348-03 | Proposed |

## Evidence

Operational docs (linked, not duplicated):

- `doc/architecture.md` §8.6 "Public View (Read-Only) & Untrusted Content Isolation".
- `AGENTS.md` (backend route/service, i18n, testing conventions).

Code (present on this branch):

- `src/shared/security/publicViewSandbox.ts`; `src/services/public-view-content.ts`;
  `src/routes/pages.ts`; `src/routes/project.ts`; `src/routes/api/v1/export.ts`;
  `src/db/queries/projects.ts`; `src/db/queries/yjs.ts`; `src/db/queries/index.ts`;
  `src/db/types.ts`; `src/db/migrations/008_project_public_view_id.ts`;
  `src/db/migrations/009_project_public_view_enabled.ts`; `src/db/migrations/index.ts`;
  `views/viewer/viewer.njk`; `views/workarea/modals/pages/modalShare.njk`;
  `public/app/workarea/modals/modals/pages/modalShare.js`;
  `public/app/rest/apiCallManager.js`; `assets/styles/components/_share.scss`.

Tests (present on this branch):

- `src/shared/security/publicViewSandbox.spec.ts`;
  `src/services/public-view-content.spec.ts`; `src/routes/pages.spec.ts`;
  `src/routes/project.spec.ts`; `src/routes/api/v1/export.spec.ts`;
  `src/db/queries/projects.spec.ts`; `src/db/queries/yjs.spec.ts`;
  `src/db/migrations/008_project_public_view_id.spec.ts`;
  `src/db/migrations/009_project_public_view_enabled.spec.ts`;
  `public/app/workarea/modals/modals/pages/modalShare.test.js`;
  `public/app/rest/apiCallManager.test.js`;
  `test/e2e/playwright/specs/public-view-sandbox.spec.ts`;
  `test/e2e/playwright/specs/share-modal.spec.ts`;
  `test/e2e/playwright/pages/share-modal.page.ts`.

## Acceptance criteria

- [x] `GET /view/:publicViewId` renders the viewer with no auth when the link is
      enabled, and 404s when disabled/unknown or when the internal uuid is used.
- [x] `GET /view/:publicViewId/_/*` serves export files with
      `Content-Security-Policy: sandbox …` (no `allow-same-origin`),
      `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- [x] In a real browser, published content reports `window.origin === 'null'` and
      cannot reach `window.parent` or the `auth` cookie.
- [x] The public link uses the opaque `public_view_id`, never the project `uuid`.
- [x] `public_view_enabled` is independent of `visibility` (edit-private + publicly
      viewable is supported).
- [x] Owner-only enable/disable/regenerate; regenerate invalidates the old link.
- [x] The export cache invalidates on every persisted edit (keyed by
      `getDocumentVersion()`), coalesces concurrent builds, and rejects oversized
      exports.
- [x] No unauthenticated bulk ZIP endpoint.
- [x] New backend/frontend files ship with colocated tests; an E2E spec covers the
      public flow.

## Implementation checklist

- [x] Migrations 008/009 + registry + `src/db/types.ts` fields.
- [x] Project queries: find-by-public-id, generate, enable/disable, regenerate;
      `getDocumentVersion`.
- [x] Isolation policy module (`publicViewSandbox.ts`) + spec.
- [x] Content service (build/cache/coalesce/bounds/path-safety) + spec.
- [x] Loader + content routes in `pages.ts` + specs.
- [x] Owner-only REST routes in `project.ts` + spec; confirm no public bypass in export
      API.
- [x] Loader template + share modal UI + REST client + styles + specs.
- [x] E2E isolation and share-modal specs.
- [ ] (Follow-up / PR #2149) Reconcile `doc/architecture.md` §8.6 cache-key wording;
      docs/nav updates.
- [ ] (Follow-up) Reverse-proxy rate limiting for `/view/*`; consider `strict` default
      or per-project CSP profile.

## References

- Issue #348 — public read-only URL.
- PR #1425 — implementation; PR #2149 — documentation/architecture reconciliation.
- ADR-348-01, ADR-348-02, ADR-348-03.
- `doc/architecture.md` §8.6; `AGENTS.md`.
- Source and test paths listed under Evidence.
