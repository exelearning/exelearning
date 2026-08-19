---
tracking_issue: 2287
title: "CLI resolution of asset storage conflicts"
status: accepted
date: 2026-08-16
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
implementation_prs: [2290]
related_adrs:
  - "ADR-2250-01"
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# CLI resolution of asset storage conflicts — design

## Current state

The startup migration introduced by #2250 (ADR-2250-01) applies a strict
never-overwrite rule: when a row's legacy file (`assets/<uuid>/…`) and its
canonical sharded destination (`assets/<shard>/<uuid>/…`) both exist with
different content (size + SHA-256), both files are kept and the row is parked
on its legacy location in portable relative form. Parked rows never converge:
the same warning is re-emitted on every boot, the phase 2 sweep leaves the
referenced legacy directory in place, and the only resolution is SSH-ing in and
comparing files by hand. The migration is correct to refuse the decision — but
the decision has no supported tool.

## Goals

- List every unresolved conflict with enough information to decide from the
  terminal: both absolute paths, file sizes, modification times.
- Resolve one conflict at a time with an **explicit operator choice**
  (`--keep-old` / `--keep-new`); never delete or overwrite either copy without
  that choice.
- Let the installation converge after resolution without further steps.
- Keep every operation crash-safe under the same reconciliation model as the
  startup migration.

## Non-goals

- **Phase 2 sweep conflicts** (orphan files without a database row whose
  sharded destination differs) are out of scope: with no row there is no
  stable identity to resolve by, and no convergence is blocked — the files are
  simply both kept. They remain reported by the per-boot warning.
- Bulk resolution (`--all`). Conflicts are expected to be rare; forcing one
  explicit choice per asset is the point of the tool.
- Any change to the migration's never-overwrite semantics.

## Design

### Detection (shared grammar, shared meaning)

A row is an unresolved conflict when all of the following hold:

1. `deriveShardedAssetStoragePath(projectUuid, storage_path)` — a new pure
   helper in `src/utils/asset-paths.ts` mirroring the migration's per-row
   derivation — yields a canonical target different from the stored value;
2. both the stored location and the target resolve safely under
   `FILES_DIR/assets` (`tryResolveAssetStoragePath`);
3. both files exist; and
4. their content differs, decided by the **same** `filesAreIdentical`
   (size + streamed SHA-256) the migration uses.

`listAssetStorageConflicts` (`src/services/asset-conflicts.ts`) scans all
asset rows in cursor-paged batches; rows already in canonical form are skipped
with a pure string comparison, so they cost no filesystem I/O. This is an
explicit admin command — a full table scan is acceptable and keeps the
detection free of extra bookkeeping state.

### Resolution

`resolveAssetStorageConflict(assetId, choice, {dryRun})` re-classifies the row
at resolution time (the listing may be stale) and then:

- `keep-new`: remove the legacy copy → rewrite the row to the canonical value.
- `keep-old`: remove the canonical copy → `moveFile` (rename, EXDEV-safe copy
  fallback) the legacy copy into its place → rewrite the row.
- Copies that turn out identical are converged with the exact rule the startup
  migration applies automatically (remove legacy copy, rewrite row) — that
  path is decision-free, so it does not require the choice to be meaningful.

Operation order is deliberate: a crash at any intermediate point leaves a
state (`file only at destination`, `row still legacy`, …) that the next
startup migration reconciles on its own. For that to hold, the migration's
phase 1 filter selects every non-canonical row (`NOT LIKE 'assets/__/%'`),
so parked conflict rows (`assets/<uuid>/...`) are re-examined at every
startup — an interrupted resolution self-heals, and an unresolved conflict is
re-reported without rewriting the row. Row rewrites reuse the migration's
`rewriteRow` with its optimistic `WHERE storage_path = <old>` guard, so a
concurrently starting instance can never be raced into a lost update; a failed
guard aborts with a clear message instead of resolving blindly.

The emptied legacy directory is intentionally **not** removed by the CLI —
the phase 2 sweep already owns that cleanup and runs on the next boot.

### CLI surface

`bun cli assets:conflicts` (`src/cli/commands/assets-conflicts.ts`):

- `list` (default): human-readable listing, or `--json` for scripting (printed
  raw, without the `SUCCESS` prefix, via a new optional `raw` field in the CLI
  command contract).
- `resolve <asset-id> --keep-old|--keep-new [--dry-run]`: refuses to act
  unless exactly one of the two choice flags is present.

### Startup warning

The per-boot conflict warnings (row conflicts and sweep conflicts) now print
both **absolute paths and file sizes**, and the row-conflict warning points at
`bun cli assets:conflicts`, so the operator can decide straight from the logs.

## Security and privacy

All path resolution stays inside the hardened resolver
(`tryResolveAssetStoragePath`); uninterpretable stored values are never
touched and resolution refuses them explicitly. No copy is ever deleted
without an explicit operator flag.

## Testing strategy

- `src/services/asset-conflicts.spec.ts`: real test database + temp
  `FILES_DIR` (same harness as the migration spec) covering listing (parked
  and absolute rows, free-destination/identical/uninterpretable non-conflicts,
  batching), both resolutions, dry-run, identical-copy convergence, unknown
  id, non-conflict rows, concurrent-guard failure, and an end-to-end
  "resolve then run the startup migration" convergence check.
- `src/cli/commands/assets-conflicts.spec.ts`: command contract (subcommands,
  flag validation, JSON output, delegation, exit codes) with injected service
  dependencies.
- `src/utils/asset-paths.spec.ts`: the derivation helper.
- `src/services/asset-storage-migration.spec.ts`: the enriched warnings.
