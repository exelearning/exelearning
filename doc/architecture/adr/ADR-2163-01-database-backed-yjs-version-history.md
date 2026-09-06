---
id: ADR-2163-01
title: "Store limited Yjs version history in the database"
status: Proposed
date: 2026-07-13
tracking_issue: 2163
legacy_id: ADR-0001
deciders:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "ChatGPT"
  model: "GPT-5.6 Thinking"
---

# ADR-2163-01: Store limited Yjs version history in the database

## Context

eXeLearning server installations persist the current canonical document state as a binary Yjs snapshot in
`yjs_documents`. The normal save path replaces that row, so the previous canonical state is no longer available after
a later save.

The existing database schema already contains `yjs_version_history`, including project and user relationships, and the
query layer already supports creating, listing, retrieving, and pruning version snapshots. Assets are stored separately
and are not duplicated by this proposal.

## Problem

Where should server/cloud installations keep a small recovery history of previous Yjs snapshots: in the database, in
the server filesystem, or as complete `.elpx` packages?

## Decision drivers

- Keep the first implementation small and compatible with SQLite, PostgreSQL, and MySQL.
- Preserve the previous state atomically with replacement of the canonical snapshot.
- Avoid database/filesystem consistency failures and orphaned backup files.
- Avoid duplicating project assets and generated export files.
- Support administrator-only recovery before exposing any end-user version-history feature.
- Bound storage growth with configurable retention.

## Options considered

### Option 1: Store Yjs snapshots in the database

Store previous binary Yjs states in `yjs_version_history` and prune older rows.

Pros:

- Reuses the existing schema and query layer.
- Allows snapshot preservation, canonical replacement, and pruning in one database transaction.
- Requires no deployment-specific shared filesystem or object storage.
- Stores only editable document state, not duplicate assets or generated exports.

Cons:

- Increases database size.
- Database backups include both current and historical document states.

### Option 2: Store snapshots in the server filesystem

Store compressed Yjs snapshots as files and keep metadata in the database.

Pros:

- Keeps large binary values outside the main database.
- Could later map naturally to object storage.

Cons:

- Requires coordination between database transactions and filesystem writes.
- Can produce missing files or orphaned files after partial failures.
- Requires shared storage for multi-instance deployments.
- Adds path, permissions, cleanup, and backup-policy concerns.

### Option 3: Store complete `.elpx` packages

Generate and retain a complete project package for each version.

Pros:

- Produces a directly downloadable recovery artifact.
- Includes rendered output and project assets.

Cons:

- Repeats unchanged assets, themes, libraries, and generated HTML.
- Adds client/server export work to the save path.
- Has substantially higher CPU and storage cost than retaining Yjs state.

## Evidence

- `src/db/migrations/001_initial.ts` at `f3a32e774384fdf6235777b62ace64f20984cb33` defines `yjs_documents` and
  `yjs_version_history` with cascading project relationships.
- `src/db/queries/yjs.ts` at `f3a32e774384fdf6235777b62ace64f20984cb33` implements version creation,
  listing, retrieval, counting, and pruning.
- `src/routes/yjs.ts` at `f3a32e774384fdf6235777b62ace64f20984cb33` replaces the canonical snapshot on
  save through `upsertSnapshot()`.
- `doc/architecture.md` at `f3a32e774384fdf6235777b62ace64f20984cb33` documents server database snapshots
  and separate permanent asset storage.
- Proposal issue: #2163.

## Decision

Server/cloud installations will keep previous Yjs snapshots in the database table `yjs_version_history`.

Automatic history creation will initially occur only for explicit saves. The default retention is five previous
snapshots per project and is configurable through `YJS_VERSION_HISTORY_LIMIT`; zero disables automatic history
creation. Consecutive identical snapshots will not create duplicate history entries.

History metadata and restoration endpoints will initially be restricted to administrators. Restoration will preserve
the current canonical snapshot as a safety version before replacing it with the selected historical state.

Desktop/Electron recovery remains a separate concern and may use platform-appropriate local files.

## Consequences

### Positive

- Recovery is available without generating `content.xml` or `.elpx` packages on every save.
- The canonical snapshot and its previous version can be updated atomically.
- Retention bounds database growth.
- Multi-instance deployments do not require shared backup directories.

### Negative

- Database storage grows by up to the configured number of snapshots per project.
- Restoring only the Yjs state cannot recover an asset that has already been physically deleted.

### Neutral

- Historical snapshots use the same binary Yjs representation as the canonical document.
- Existing project deletion cascades remove its version history.

## Risks

- Large projects can increase database backup size. Retention defaults to five and can be disabled or reduced.
- Historical Yjs state may reference assets removed by a future cleanup policy. Asset retention must account for
  recoverable versions before destructive asset cleanup is introduced.
- A stale client can still attempt to overwrite a newer canonical snapshot. Version history reduces recovery impact but
  does not replace optimistic concurrency control.

## Validation

- Unit tests verify first save, duplicate suppression, disabled history, retention pruning, transaction rollback, and
  restoration safety snapshots.
- Route tests verify that automatic persistence does not create versions and that history endpoints require an
  administrator role.
- CI must run formatting, unit, integration, and end-to-end test suites.
- Storage size should be reviewed after representative cloud usage data is available.

## Follow-up work

- Add an administrator UI for inspecting and restoring versions.
- Evaluate optimistic concurrency control for stale snapshot writes.
- Define asset retention rules that account for historical references.
- Evaluate filesystem or object-storage offloading only if measured database growth warrants it.
- Design desktop/Electron rotating local backups separately.

## References

- #2163
- `src/db/migrations/001_initial.ts`
- `src/db/queries/yjs.ts`
- `src/routes/yjs.ts`
- `doc/architecture.md`
