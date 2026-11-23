---
id: ADR-2689-01
title: "Attribute project activity from authenticated operations and validated client-reported semantic events, without server-side Yjs state"
status: Proposed
date: 2026-11-03
tracking_issue: 2689
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: []
  changes:
    - 2689-project-activity-log
  adrs:
    - ADR-2615-01
    - ADR-2006-03
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2689-01: Attribute project activity from authenticated operations and validated client-reported semantic events, without server-side Yjs state

## Context

Administrators of collaboratively edited projects ask who edited, added or deleted content in a project, not
only who owns it (issue #2689). Today the server cannot answer that question:

- `activity_log` (migration `007_activity_log`) records only site-wide analytics events without a project
  column (`src/db/migrations/007_activity_log.ts` @ `eb744801c`).
- The WebSocket relay is stateless: it authenticates the connection, resolves project access and forwards
  binary Yjs frames without decoding them (`src/websocket/yjs-websocket.ts` `handleWebSocketOpen()` and
  `handleWebSocketMessage()` @ `eb744801c`). `yjs_updates.client_id` is a Yjs client id, never a user.
- Saves arrive through one REST endpoint that validates the posted state against the stored version and
  merges stale saves (ADR-2615-01, `src/routes/yjs.ts` @ `eb744801c`). The authenticated saver is known; the
  authors of the edits inside the snapshot are not.
- All browser structural mutations go through `public/app/yjs/YjsStructureBinding.js`, in transactions whose
  origin is the local `clientID`; the ELPX importer uses the same origin
  (`src/shared/import/ElpxImporter.ts` @ `eb744801c`), lock bookkeeping is written through
  `updateComponent()`, undo and redo carry the `UndoManager` origin, and every remote update, IndexedDB replay
  and stored-snapshot merge is applied with `transaction.local === false` (`Y.applyUpdate` always creates a
  non-local transaction, `node_modules/yjs/dist/yjs.mjs` `readUpdateV2`).
- Issue #2163 / PR #2164 add database-backed version history for administrator recovery. A historical
  snapshot is a document state, not an attributable edit.

## Problem

Which facts about project activity can the server record with its own authority, which must be reported by
the browser, how are client reports made trustworthy enough to be useful, and where is the record stored, so
that owners and administrators can answer "who did what, to which page or iDevice, and when" without turning
the relay into a stateful document server?

## Decision drivers

- The browser Y.Doc remains the editing source of truth and WebSocket rooms remain lightweight relays
  (AGENTS.md constraints); no long-lived server Y.Doc, no per-keystroke decoding.
- Identity must come from the authenticated request or socket, never from Yjs client ids or awareness.
- Save-safety guarantees of ADR-2615-01 (compare-and-set, stale merge) must not change; a failed save must
  not produce a success event.
- Readable log: aggregated entries ("edited page X, 14 changes between 10:02 and 10:31"), not one row per
  Yjs transaction.
- SQLite, PostgreSQL and MySQL/MariaDB; nullable actor on user deletion; cascade on project deletion.
- Privacy by design: minimal personal data, configurable retention, `0` disables recording.
- Independent of version history (#2163) and of its unmerged pull request (#2164).

## Options considered

### Option A: Client-side semantic event collection only

Observe local Yjs transactions in the browser, map them to pages/blocks/iDevices, aggregate, and post to an
authenticated endpoint. Pros: exact semantics are available only where the mutation happens (create vs clone,
move vs delete+insert, lock bookkeeping vs edit); no server decoding. Cons: a hostile client can report false
content events for itself; the server cannot verify that the described edit really happened; events are
lost if the tab dies before a flush.

### Option B: Server-side semantic inspection

Reconstruct the document on the server (per save or per update) and diff states. Pros: no trust in the
client. Cons: decoding multi-megabyte documents costs hundreds of milliseconds (ADR-2615-01 measured the save
decode); diffing two snapshots attributes everything to the saver, which is wrong for a merged save that
carries other users' edits; per-frame inspection would make the relay stateful and CPU-bound.

### Option C: Authenticated WebSocket transport attribution

Count or timestamp the binary frames each authenticated connection sends. Pros: cheap and server-trusted.
Cons: a frame is opaque; it carries no page or iDevice identity, and a sync step or awareness frame is not an
edit. It can establish that a user was connected and sent updates, nothing more.

### Option D: Hybrid (chosen)

Server-authoritative events for everything the server performs itself (sharing and access changes, editing
sessions from the authenticated socket, canonical saves after the ADR-2615-01 write succeeds, restorations).
Client-reported semantic events for content changes, captured in the browser from local user-origin
transactions with explicit hints from the structure binding, aggregated per target, and accepted by the
server only after authentication, project edit access, strict schema and size validation and idempotent
deduplication. Each stored event carries a provenance derived from its type, and the UI reports it.

## Evidence

- Relay without document state and connection identity: `src/websocket/yjs-websocket.ts` @ `eb744801c`.
- Save validation and merge: ADR-2615-01; `src/routes/yjs.ts` and `replaceSnapshotIfVersion()` in
  `src/db/queries/yjs.ts` @ `eb744801c`.
- Mutation funnel and origins: `public/app/yjs/YjsStructureBinding.js` (`transact(fn, clientID)` in every
  create/update/move/delete/clone method), lock writes through `updateComponent()` in
  `public/app/workarea/project/idevices/content/ideviceNode.js`, importer origin `this.ydoc.clientID` in
  `src/shared/import/ElpxImporter.ts`, `createBlankProjectStructure()` origin `system` and stored-snapshot
  merge origin `initial` in `public/app/yjs/YjsDocumentManager.js`, all @ `eb744801c`.
- `transaction.local` semantics: Yjs `Transaction` constructor and `readUpdateV2()` (`transact(..., origin,
  false)`), `node_modules/yjs/dist/yjs.mjs` (yjs 13.6.x); UndoManager tracked origins:
  https://docs.yjs.dev/api/undo-manager.
- Autosave intent is lost on the wire: `CollaborativeAutosaveManager._runAutosave()` passes
  `reason: 'collaborative-autosave'` but `SaveManager.saveYjsState()` always posts `?markSaved=true`
  (`public/app/yjs/SaveManager.js` @ `eb744801c`); PR #2164 head `8ec5b700e` keys version history on
  `markSaved`.
- Comparable systems: see `doc/architecture/changes/2689-project-activity-log/research.md`.

## Decision

We will implement Option D.

1. **Server-authoritative events.** Sharing routes (`src/routes/project.ts`, both the numeric-id and the
   uuid families) record `access.*` events after the state change succeeds and only for real transitions.
   The WebSocket `open` handler records one `session.opened` per client editor session for persisted
   projects, deduplicated by a client-generated session correlation id (never used for authorization). The
   save endpoint records `save.manual`, `save.autosave` or `save.unload` after the canonical write of
   ADR-2615-01 succeeds, with the resulting document version and whether a merge happened; a validated
   `X-Save-Kind` header carries the intent and `markSaved` keeps its existing meaning. Consecutive automatic
   saves by the same user are coalesced into one row with a counter.
2. **Client-reported semantic events.** A browser reporter observes local transactions whose origin is the
   user's `clientID` or the `UndoManager`, ignores `initial`/`system` origins and every non-local
   transaction, suppresses transactions covered by an import scope, ignores lock-only key changes, and uses
   hints emitted by `YjsStructureBinding` for moves and clones. Events are aggregated per (type, target) with
   first/last timestamps and a count, flushed after inactivity, after a maximum window, before a save and on
   page hide, and posted with a per-session dedupe key. The server accepts them only from an authenticated
   user with edit access to that project, validates type, identifiers, labels, counts, timestamps and
   details against allow-lists and size limits, assigns the actor from the JWT, clamps client timestamps and
   inserts idempotently. Imports produce one summary event per logical import.
3. **Storage.** A dedicated `project_activity` table (migration `011_project_activity`) with
   `project_id ON DELETE CASCADE`, nullable `user_id ON DELETE SET NULL`, a stable event code, target type,
   id and short label, JSON details as text, first/last occurrence timestamps, a counter, a session
   correlation id and a per-project unique dedupe key. No email or name snapshots; actors and affected users
   are resolved at read time and shown as "deleted user" when gone.
4. **Configuration and retention.** `PROJECT_ACTIVITY_RETENTION_DAYS` (default 90) bounds retention; `0`
   disables recording and the retention job while keeping existing rows readable.
   `PROJECT_ACTIVITY_EDITOR_ACCESS` (default `false`) lets explicit collaborators read the log. Both are
   installation-level environment settings, independent of `YJS_VERSION_HISTORY_LIMIT`.
5. **Provenance.** Every event type belongs to exactly one provenance class, `server` or `client`; the API
   returns it and the UI labels client-reported entries. The log is best-effort traceability, not a
   tamper-proof audit trail.

## Consequences

### Positive

- Owners and administrators can see who shared, opened, saved, edited, moved, deleted or imported content,
  with readable aggregated entries, without any change to the collaboration protocol.
- Server-performed operations are attributed with server authority; the save path keeps its exact
  compare-and-set semantics and gains an explicit save-intent contract that #2164 can reuse.
- Deleting a user anonymizes their rows; deleting a project removes them; retention is bounded.

### Negative

- Content events are client-reported: a modified client can omit or invent content events about itself. It
  cannot attribute events to another user, write to another project or exceed the validated limits.
- Events pending in the browser are lost if the tab dies before a flush (bounded by the flush windows).
- One more write per sharing change, per session open and per save; one small batch request per flush.

### Neutral

- Static, offline and Electron modes record nothing (single user, no server).
- Version history (#2163) stays responsible for recovering document states; activity rows only reference the
  canonical document version returned by the save, never a history row id.

## Risks

- Flooding by a hostile editor: bounded by per-request limits, per-user rate limiting and retention.
- Clock skew in client timestamps: clamped to a window around server time; the server insert time is stored
  separately.
- Multi-instance deployments: deduplication relies on the database, not on in-process state; rate limiting
  is per instance and documented as such.

## Validation

- Unit and database tests on real SQLite for migration, queries, pagination, cascades, retention and
  deduplication; the existing PostgreSQL/MariaDB end-to-end matrix for dialect behavior.
- Route tests for every authorization path and for the save-kind contract, including the real
  collaborative-autosave call chain.
- Vitest tests with real Y.Docs for every structural operation, undo/redo, remote updates, initial load and
  imports.
- Playwright journey: owner invites a collaborator, collaborator edits and saves, owner and administrator
  read and filter the log, an unrelated user is refused.

## Follow-up work

- PR #2164: key version history on the validated save kind instead of `markSaved`, and record
  `version.restored` through the activity service after a successful restore (see the change design).
- End-to-end restoration test with connected clients and IndexedDB copies (#2164).
- Administrator override of the two settings from `/admin`, if operators ask for it.

## References

- Issue #2689; issue #2163; PR #2164; issue #2615; PR #2618.
- ADR-2615-01 (merge stored snapshot on open and validate saves); ADR-2006-03 (database-backed project
  authorization).
- `doc/architecture/changes/2689-project-activity-log/`.
- Yjs documentation: https://docs.yjs.dev/api/y.event, https://docs.yjs.dev/api/undo-manager,
  https://docs.yjs.dev/api/document-updates.
