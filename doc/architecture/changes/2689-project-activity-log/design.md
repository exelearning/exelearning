---
tracking_issue: 2689
title: "Per-project activity log"
date: 2026-11-03
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# Per-project activity log — design

## Current state

- Sharing routes: `src/routes/project.ts` (numeric-id family at `/api/projects/:projectId/*` and uuid family
  at `/api/projects/uuid/:uuid/*`), owner-only, with `accessNotifier` kicking revoked sockets.
- Saves: `src/routes/yjs.ts` `POST /api/projects/uuid/:uuid/yjs-document` (compare-and-set loop, stale
  merge, `markSaved` → `saved_once`). Clients: `SaveManager.saveYjsState()` (manual and autosave, always
  `markSaved=true`), `YjsDocumentManager._saveSync()` (`sendBeacon`, no headers, no `markSaved`),
  `YjsDocumentManager.saveToServer()` (no `markSaved`).
- Sessions: `src/websocket/yjs-websocket.ts` `handleWebSocketOpen()` authenticates and authorizes before
  `roomManager.addConnection()`; `clientMetaMap` tracks `userId`, `projectUuid`, `connectedAt`.
- Browser mutations: `public/app/yjs/YjsStructureBinding.js` (origin `clientID`), `YjsPropertiesBinding.js`
  and `odeTitleElement.js` (origin `clientID`), `YjsProjectBridge.setComponentHtml()`/`updateMetadata()` (no
  origin), lock bookkeeping via `updateComponent()`, `ElpxImporter` (origin `clientID`),
  `ComponentImporter`, `createBlankProjectStructure()` (origin `system`), snapshot merge (origin `initial`).
- Cleanup: `src/services/cleanup-scheduler.ts` deletes unsaved and guest projects when `CLEANUP_ENABLED`.

## Technical design

### Data flow

```
 Browser (per tab, sessionId)                         Server (stateless relay + REST)              Database
 ───────────────────────────                          ───────────────────────────────              ────────
 YjsStructureBinding ──hint──┐
 local transactions ─────────┼─> ProjectActivityReporter ──POST /activity/events──> validate ──> insert (dedupe key)
 UndoManager pops ───────────┤   (classify, aggregate,       (auth + edit access,     normalize    project_activity
 import flows ──scope/event──┘    flush, retry)               allow-lists, limits)
 SaveManager ──X-Save-Kind──────> POST /yjs-document ──CAS write ok──> recordSave ─────────────> insert / coalesce
 WebsocketProvider ?session=id ─> ws open (auth+access) ─────────────> recordSessionOpened ─────> insert if new
 Share modal ───────────────────> PATCH/POST/DELETE sharing ──state changed──> record ─────────> insert
 Activity modal / admin panel <── GET /activity (owner|admin|editor*) <── list + actor resolution <── keyset query
                                                      retention runner (daily) ───────────────> delete batches
```

### Modules

| Module | Responsibility |
|---|---|
| `src/db/migrations/011_project_activity.ts` | creates `project_activity` and its indexes |
| `src/db/queries/project-activity.ts` | insert, coalesce, dedupe lookup, session lookup, keyset list, actors, retention delete |
| `src/shared/project-activity/events.ts` | event codes, provenance map, client-reportable set, limits, details allow-lists |
| `src/config/project-activity.ts` | env parsing: retention days, editor access |
| `src/services/project-activity.ts` | `createProjectActivityService()`: `record()`, `recordSave()`, `recordSessionOpened()`, `recordClientEvents()`, `canViewActivity()`, `listActivity()`, `listActors()`; never throws from recorders |
| `src/services/project-activity-retention.ts` | bounded daily pruning with injectable timers and clock |
| `src/routes/project-activity.ts` | internal read/write endpoints under `/api/projects` |
| `src/routes/project.ts`, `src/routes/yjs.ts`, `src/routes/admin.ts`, `src/websocket/yjs-websocket.ts` | call sites, all with an optional injected `activity` dependency |
| `public/app/yjs/ProjectActivityReporter.js` | browser capture, classification, aggregation, flush |
| `public/app/activity/activityLogView.js` | shared read-only list renderer (workarea modal and admin) |
| `public/app/workarea/modals/modals/pages/modalActivity.js` + `views/workarea/modals/pages/modalActivity.njk` | owner/editor Activity modal, opened from the share modal |
| `public/app/admin/project-activity.js` | admin Activity panel for any project |

### Save intent

`SaveManager.saveYjsState()` receives the `reason` of `save()` and sends `X-Save-Kind:
collaborative-autosave` for autosaves and `manual` otherwise; the beacon path sends no header. The route
maps header → `saveKind` (allow-list) with the fallback of spec R4, records the event after the successful
write, returns `saveKind` in the response and leaves `markSaved`/`saved_once` untouched.

### Browser capture

`ProjectActivityReporter` is created by `YjsProjectBridge.initialize()` only when the runtime has remote
storage and the API URL (never in static/Electron). It:

1. Builds a shadow tree `{ pages: [{id, blocks: [{id, components: [id]}]}] }` plus a label cache
   (`id → { kind, label, parentId, pageId, blockId, ideviceType }`) by walking `navigation` once and keeps
   it in sync from every transaction (local and remote); deleted items are therefore still nameable.
2. Observes `navigation.observeDeep`, `metadata.observe` and `undoManager` events. A transaction is
   considered a user action when `transaction.local === true` and its origin is the document `clientID`, the
   `UndoManager`, or `null`; origins `initial`, `system` and `import` and any non-local transaction are
   ignored. While an import scope is active, local transactions are ignored too.
3. Reads `documentManager.activityHint` (set synchronously by `YjsStructureBinding._withActivity()` around
   its transaction) to classify moves, clones, deletes (label, descendant count) and renames exactly. Without
   a hint it classifies from Yjs events: array insertions → `created`, array deletions → `deleted` (ids from
   the shadow tree delta), same id deleted and inserted in one transaction → `moved`, map key changes →
   `renamed` (`pageName`/`blockName`) or `edited`, lock-only key sets → nothing.
4. Aggregates by `type|targetType|targetId`: count, first/last timestamp, latest label and details. Flushes
   per spec R9 using `fetch` with `keepalive` on page hide, with dedupe keys `${sessionId}:${seq}` and bounded
   retry/backoff; drops the oldest keys beyond 500 pending with a console warning.

Import flows call `reporter.beginScope('import')` / `endScope()` around `ElpxImporter`/`ComponentImporter`
and then `reporter.reportImport({format, mode, counts})`; `importConvertedStructure` (legacy `.elp`) does the
same.

### Server validation of client events

Per event: `type` ∈ client-reportable set; `targetType` ∈ {page, block, idevice, project}; `targetId`
`^[A-Za-z0-9_.:-]{1,64}$` (or `project`); `label` trimmed to 160 chars; `count` integer 1–100000;
`firstAt ≤ lastAt` clamped to [now−24h, now+5min], else server time; `details` object with allow-listed
keys per type, strings ≤ 160, numbers finite, serialized ≤ 1 KiB; `key` `^[A-Za-z0-9_:-]{1,96}$`;
`sessionId` `^[A-Za-z0-9_-]{8,64}$`. Invalid events are rejected individually (reported as `rejected`),
duplicates are skipped (`duplicates`), valid ones inserted (`accepted`). Requests: body ≤ 256 KiB, ≤ 100
events, per-user sliding window of 120 requests/min per instance.

## Data model

```sql
CREATE TABLE project_activity (
  id            integer/serial PRIMARY KEY,
  project_id    integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       integer NULL REFERENCES users(id) ON DELETE SET NULL,
  event_type    varchar(50) NOT NULL,
  target_type   varchar(20) NULL,
  target_id     varchar(64) NULL,
  target_label  varchar(160) NULL,
  details       text NULL,                -- JSON, allow-listed keys only
  session_id    varchar(64) NULL,
  dedupe_key    varchar(96) NULL,         -- unique per project
  event_count   integer NOT NULL DEFAULT 1,
  first_occurred_at bigint NOT NULL,      -- ms UTC
  occurred_at   bigint NOT NULL,          -- last occurrence, ms UTC; ordering key
  created_at    bigint NOT NULL           -- server insert time, ms UTC
);
CREATE INDEX idx_project_activity_project_occurred ON project_activity (project_id, occurred_at, id);
CREATE INDEX idx_project_activity_project_user ON project_activity (project_id, user_id, occurred_at);
CREATE INDEX idx_project_activity_occurred ON project_activity (occurred_at);
CREATE UNIQUE INDEX uq_project_activity_dedupe ON project_activity (project_id, dedupe_key);
```

Rationale: `details` as JSON text is portable; timestamps are millisecond integers like every other table;
no `RETURNING` is required (plain inserts, conditional `UPDATE ... WHERE id = ?` for coalescing); multiple
NULL `dedupe_key` values are allowed on all three engines; `down` drops the table and is documented as lossy.

## Migration and compatibility

Fresh installs and upgrades run `011_project_activity` after `010_project_platform_binding`.
`deleteProjectWithRelatedData()`, `projects:purge` and `test/helpers/test-db.ts` delete `project_activity`
explicitly before projects, matching the existing explicit cleanup paths. No API contract changes for
external integrations (`/api/v1/*` is untouched).

## Security and privacy

- Reads: owner, admin, or explicit collaborator when `PROJECT_ACTIVITY_EDITOR_ACCESS=true`; public edit
  visibility never grants reads; inactive projects follow the existing `checkProjectAccess` denial; missing
  projects → 404, denied → 403 (same convention as the yjs-document routes).
- Writes of client events require edit access; the actor is the JWT subject; cross-project injection is
  impossible because the project comes from the URL and is authorized first.
- No emails, names, tokens, public link ids, IP addresses or content are stored. Labels are truncated user
  text and rendered with `textContent`. Actors and affected users are resolved at read time.
- Retention is a legal-design aid, not a compliance claim; `doc/development/project-activity.md` lists what
  an installation's transparency notice should mention.

## Accessibility

Filters are labelled form controls; the list is a `<ul>` with one `<li>` per entry; loading, empty, error and
disabled states live in a polite live region; focus returns to the opener on close; keyboard operation
through native controls; dates rendered with `Intl.DateTimeFormat` in the user's locale.

## Internationalization

All workarea strings use `_()`; admin strings are added to `buildAdminTranslations()`; event labels are
generated from the stable code in the UI. No file under `translations/` changes.

## Performance

The save path gains one insert (or one indexed select + update for coalesced autosaves) after the canonical
write; sockets gain one indexed select + insert per editor session open, never per frame; the browser batches
content events (one request per flush); reads are keyset-paginated on `(project_id, occurred_at, id)`;
retention deletes in batches of 1000 ids. Numbers are recorded in `tasks.md`.

## Testing strategy

- `src/db/migrations/011_project_activity.spec.ts`, `src/db/queries/project-activity.spec.ts` (real SQLite:
  cascade, set null, ordering, filters, cursor, dedupe, retention).
- `src/config/project-activity.spec.ts`, `src/shared/project-activity/events.spec.ts`,
  `src/services/project-activity.spec.ts`, `src/services/project-activity-retention.spec.ts`.
- `src/routes/project-activity.spec.ts` (authorization matrix, validation), additions to
  `src/routes/yjs.spec.ts` (save kinds, CAS retry, failure), `src/routes/project.spec.ts` (sharing events,
  unchanged state), `src/routes/admin.spec.ts`, `src/websocket/yjs-websocket.spec.ts`.
- `test/integration/routes/project-activity.integration.spec.ts` (real DB, real routes, autosave chain).
- Vitest: `ProjectActivityReporter.test.js` (real Y.Docs: every operation, undo/redo, remote, initial,
  import scope, flush/retry), `SaveManager.test.js` (header), `modalActivity.test.js`,
  `activityLogView.test.js`, `admin/project-activity.test.js`.
- Playwright: `test/e2e/playwright/specs/project-activity.spec.ts` with the collaboration fixture.

## Rollout plan

Ships enabled with a 90-day retention; operators set `PROJECT_ACTIVITY_RETENTION_DAYS=0` to opt out. No data
backfill: history starts when the migration runs.

## Risks and mitigations

See ADR-2689-01 "Risks". Additionally: the share-modal button only renders when the sharing endpoint reports
`activity.canView`; the server re-checks on every request.

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Attribution model, storage and provenance | ADR-2689-01 |
| Save validation that activity must not bypass | ADR-2615-01 |
| Database-backed project authorization reused for reads and writes | ADR-2006-03 |
