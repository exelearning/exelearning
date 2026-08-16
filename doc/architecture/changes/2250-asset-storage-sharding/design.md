---
tracking_issue: 2250
title: "Sharded, portable project asset storage"
status: accepted
date: 2026-08-15
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
implementation_prs: [2266]
related_adrs:
  - "ADR-2250-01"
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# Sharded, portable project asset storage — design

## Current state

- Physical layout (introduced by PR #788, lazy creation):
  `FILES_DIR/assets/<projectUuid>/<clientId>.<ext>` for uploads and
  `FILES_DIR/assets/<projectUuid>/<clientId>/<filename>` for ZIP extraction and
  file-manager duplication (`src/services/file-helper.ts:142`,
  `src/services/folder-manager.ts`).
- `assets.storage_path` holds **absolute host paths** written at upload time
  (`src/routes/assets.ts`, `src/routes/api/v1/assets.ts`, `src/routes/upload-session.ts`,
  `src/routes/project.ts` duplicate flow) and read verbatim by download/delete routes and
  `src/shared/export/providers/DatabaseAssetProvider.ts`.
- A legacy quirk: asset routes accepted numeric project ids in the URL and used the raw
  parameter as the directory name, so `assets/<numericId>/` directories can exist.
- `themes.storage_path` / `templates.storage_path` already store FILES_DIR-relative
  values — assets were the outlier.

## Technical design

Decisions and their rationale live in [ADR-2250-01](../../adr/ADR-2250-01-shard-project-asset-storage.md).
Summary of the implementation:

- **Pure path module** `src/utils/asset-paths.ts` — single source of truth:
  - `getAssetShard(id)` — first two hex chars of a canonical UUID, lowercased;
    deterministic 8-bit FNV-1a fallback for non-canonical identifiers.
  - `buildAssetStoragePath(uuid, ...segments)` — canonical stored value
    `assets/<shard>/<uuid>/<segments...>` (POSIX separators, validated segments).
  - `resolveAssetStoragePath(filesDir, stored)` / `tryResolveAssetStoragePath` — the
    only stored-value → physical-path conversion. Accepts canonical relative values
    and (transitionally) legacy absolute values via their `assets/…` suffix; rejects
    traversal, backslashes in relative values, control characters, and anything that
    would escape `FILES_DIR/assets`.
  - `getProjectAssetsDirCandidates(filesDir, uuid)` — sharded + legacy directory, for
    deletion/cleanup paths.
- **`src/services/file-helper.ts`** binds these to `getFilesDir()` and exposes them via
  the existing `FileHelper` interface (DI-friendly). `getProjectAssetsDir()` now returns
  the sharded directory.
- **Write sites** (upload, chunked finalize, `/sync`, `/stream`, upload-session batch,
  API v1 upload, ZIP extraction, asset duplication, project duplication) build the
  stored value with `buildAssetStoragePath` and derive the physical path from it via the
  resolver — the two can never diverge. Project identity is resolved to the canonical
  `projects.uuid` first, so numeric-id URLs no longer mint numeric directories.
- **Read/delete sites** resolve `storage_path` through `tryResolveAssetStoragePath`;
  an unresolvable value behaves exactly like a missing file.
- **Startup migration** `src/services/asset-storage-migration.ts` (see below).
- **Benchmark** `scripts/benchmark-asset-storage.ts` compares 0/1/2/3 shard levels.

## Data model

No schema change. `assets.storage_path` (TEXT) changes representation from absolute
host paths to FILES_DIR-relative POSIX paths starting with `assets/`. Old values remain
readable through the resolver's legacy fallback until migrated.

## Migration and compatibility

### What happens, and when

The migration runs automatically inside `bootstrap()` (`src/index.ts`) on **every
startup**, after database schema migrations and **before** the server starts listening.
It is idempotent and resumable; on a converged installation it performs one legacy-row
query and one `readdir` of the assets root, plus bounded content checks for existing
two-decimal shard buckets (`00`-`99`) to tell them apart from legacy numeric project-id
directories, then logs `[AssetStorage] Asset storage layout is up to date.` Re-checking
the filesystem on every startup is deliberate: it is what lets restored legacy data
converge automatically.

Phase 1 walks all rows whose `storage_path` is not yet relative (cursor-paged batches,
default 500). Per row it derives the target `assets/<shard>/<uuid>/…` path, then:

| State found | Action |
|---|---|
| file at legacy path, target free | move (rename; EXDEV → copy-tmp+rename+verify+remove), rewrite row |
| file already at target, legacy gone | rewrite row (crash recovery) |
| both exist, identical content (size + SHA-256) | remove legacy copy, rewrite row |
| both exist, different content | **keep both**, log conflict, park row on its legacy location in portable relative form |
| neither exists | log missing file, rewrite row to target (reads keep 404ing as before) |
| value uninterpretable (no `assets/…` suffix, traversal) | leave row untouched, log |

Row rewrites use an optimistic `WHERE storage_path = <old>` guard, so concurrent
startups of several instances (Redis HA) are safe.

Phase 2 lists the assets root: entries that are not two-hex shard buckets are legacy
leftovers (two-decimal bucket names, `00`-`99`, are ambiguous with legacy numeric
project-id directories, so each existing one gets a bounded content check every boot).
Directories identified as projects (by UUID, or by numeric id for the legacy
numeric-directory quirk) have their remaining files — orphans with no database row —
moved into the sharded layout with the same never-overwrite rules; emptied directories
are removed. Files still referenced by conflict rows are left in place (and re-reported
each boot). Unrecognized entries are reported and left alone.

### Administrator guide (upgrading an existing installation)

- **Back up first**: take a normal backup of the database **and** `FILES_DIR` before
  upgrading, as for any release that touches stored data.
- **Where files move**: `FILES_DIR/assets/<uuid>/…` → `FILES_DIR/assets/<xy>/<uuid>/…`
  where `<xy>` is the first two hex characters of the project UUID. Same filesystem →
  the moves are renames (no extra disk space, fast). `assets/` and its buckets are the
  only locations touched; `tmp/`, `dist/`, `themes/` are unaffected.
- **What is written to the database**: `assets.storage_path` becomes
  `assets/<xy>/<uuid>/<file…>` (relative to `FILES_DIR`, `/` separators).
- **Downtime**: the migration runs before the server accepts connections; startup is
  delayed once by roughly the time needed to rename the existing asset files (renames on
  one filesystem are metadata operations; expect seconds up to a few minutes for very
  large stores, longer on network storage). Subsequent startups repeat only the cheap,
  bounded convergence checks described above.
- **Failure reporting**: every anomaly is logged with the `[AssetStorage]` prefix, and a
  one-line summary (files moved, rows rewritten, missing, conflicts, errors) is printed
  at the end of the run. During a large migration a progress line is printed every 1,000
  processed rows, e.g.
  `[AssetStorage] Migration progress: 1,000/3,250 legacy row(s) processed, 2,250 pending.`
- **Retries**: yes — the migration re-runs on every startup and finishes whatever a
  previous interrupted run left over. Individual file errors never abort the run.
- **Verifying success**: after the upgrade boot, the log shows the summary; on the next
  boot it shows `Asset storage layout is up to date.` and
  `SELECT COUNT(*) FROM assets WHERE storage_path NOT LIKE 'assets/%'` returns 0.
  Remaining warnings identify conflict files; list and resolve them with
  `bun cli assets:conflicts` (issue #2287).
- **Rollback**: restore the pre-upgrade backup (database + `FILES_DIR`) and redeploy the
  previous release. Rolling back only the binary after migration is not supported —
  old releases cannot read relative paths.
- **Moving `FILES_DIR`** (after this change): move the directory, update the
  environment variable, restart — database rows no longer need rewriting.

### Compatibility rules

- All new writes emit only the new format; there is no dual-write.
- The resolver's legacy-absolute fallback exists only so unmigrated/conflict rows keep
  working; its removal is tracked as follow-up in ADR-2250-01 (issue #2288, a future
  major release).
- Deletion paths (cleanup scheduler, admin user deletion, `projects-cleanup` CLI) remove
  both the sharded and the legacy directory during the transition.

## Security and privacy

All stored-value resolution funnels through one hardened resolver: rejection of `..`
segments, separators inside segments, control characters/NUL, and a separator-aware
containment check under `FILES_DIR/assets` (reusing `isWithinBase`). The migration never
follows arbitrary absolute paths from the database — values without a safe `assets/…`
suffix are left untouched and reported. No user data is ever overwritten.

## Accessibility

Not applicable (server-side storage layout).

## Internationalization

Not applicable; filenames with non-ASCII characters are covered by tests.

## Performance

Runtime request paths gain one string operation per asset access (path build/parse) —
negligible against the accompanying file I/O. Startup adds a cheap, bounded no-op check
per boot after convergence (see "Migration and compatibility"). Benchmarking of layout
depths is provided by
`scripts/benchmark-asset-storage.ts`; see ADR-2250-01 ("Validation") for how and where
to run it. On the author's machine (macOS/APFS, Apple M5, Bun 1.3.14 — *not* the
production ext4 target) with 20,000 projects × 2 assets, one level was fastest overall
and full traversal got *slower* with each additional level (flat 1.21 s, 1 level 1.04 s,
2 levels 1.64 s, 3 levels 2.25 s), consistent with deeper trees adding directory visits.

## Testing strategy

- `src/utils/asset-paths.spec.ts` — shard/grammar/resolution/portability/traversal.
- `src/services/file-helper.spec.ts` — sharded dirs, resolver wrappers, FILES_DIR
  portability regression (same stored path valid under two FILES_DIR values).
- `src/services/asset-storage-migration.spec.ts` — all migration states, idempotency,
  batching, EXDEV fallback, orphan sweep, conflicts, traversal safety, unusual
  filenames, numeric legacy directories.
- Route/service/provider specs updated to assert relative sharded writes and
  legacy-read fallback: `src/routes/assets.spec.ts`, `src/routes/api/v1/assets.spec.ts`,
  `src/routes/upload-session.spec.ts`, `src/routes/project.spec.ts`,
  `src/routes/filemanager.spec.ts`, `src/services/folder-manager.spec.ts`,
  `src/services/cleanup-scheduler.spec.ts`, `src/routes/admin.spec.ts`,
  `src/cli/commands/projects-cleanup.spec.ts`,
  `src/shared/export/providers/DatabaseAssetProvider.spec.ts`.
- `scripts/benchmark-asset-storage.spec.ts` — benchmark harness correctness only (no
  timing assertions in CI).
- Existing Playwright E2E suites exercise upload/file-manager/import/export/duplicate
  flows end-to-end against the new layout.

## Rollout plan

Ships in one PR; the migration is automatic at first startup. No feature flag: the
resolver's legacy fallback is the safety net, and the migration converges the data.

## Risks and mitigations

See ADR-2250-01 ("Risks"): interrupted migration (re-run + fallback), conflicts (never
overwrite, keep both, re-report), concurrent instances (optimistic guards), rollback
(backup-based).

## ADRs required or referenced

| Decision | ADR |
|---|---|
| One 8-bit shard level; relative `storage_path`; migration strategy | [ADR-2250-01](../../adr/ADR-2250-01-shard-project-asset-storage.md) |
