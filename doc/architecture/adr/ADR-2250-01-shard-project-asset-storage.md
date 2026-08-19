---
id: ADR-2250-01
title: "Shard project asset storage using a single 8-bit bucket level"
status: Accepted
date: 2026-08-15
tracking_issue: 2250
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2266]
  changes:
    - "2250-asset-storage-sharding"
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-2250-01: Shard project asset storage using a single 8-bit bucket level

## Context

Server-side project assets are stored under one directory per project:

```
FILES_DIR/assets/<projectUuid>/<clientId>.<ext>          (flat uploads)
FILES_DIR/assets/<projectUuid>/<clientId>/<filename>     (ZIP extraction / duplication)
```

This layout was introduced deliberately by PR #788, which replaced session/numeric-id
directories with UUID-based directories and lazy creation. It is an intentional design,
not an accident. Application code never enumerates the root of `assets/` at runtime —
all `readdir` calls are scoped to a single project directory (verified in issue #2250,
and consistent with issue #1842, where the only root-level reads are per-project
`FileSystemAssetProvider` scans of `FILES_DIR/assets/<uuid>`).

Two separate concerns were raised in issue #2250:

1. **Portability (a concrete defect):** `assets.storage_path` persisted **absolute host
   filesystem paths** such as `/mnt/data/assets/<uuid>/<clientId>.png`
   (`src/routes/assets.ts` @ `3c7c7e821`, write sites at lines 427/443/690/704/1159/1173/1314).
   This couples every database row to one specific `FILES_DIR` mount point. Moving,
   remounting or restoring the data directory to a different path silently invalidates
   every asset row. Notably, the `themes` and `templates` tables already store
   FILES_DIR-relative paths (`src/routes/admin-themes.ts:603`,
   `src/routes/admin-templates.ts:223`) — assets were the outlier.

2. **Scalability (a preventive concern):** the flat `assets/` root grows without bound —
   one subdirectory per project, forever. There is **no measured runtime failure at
   current scale** (see "Evidence"), but an ever-growing single directory is unnecessary,
   and changing the layout is far cheaper now than after years of data accumulation —
   especially because fixing concern 1 first decouples the database from the physical
   layout.

## Problem

Should project asset storage (a) keep absolute `storage_path` values, and (b) keep the
flat one-directory-per-project layout — and if not, how many shard levels should the new
layout use, and how do existing installations migrate safely?

## Decision drivers

- Database rows must survive a change of `FILES_DIR` (backup/restore, remount, Docker
  volume relocation, desktop-app data moves).
- Bounded directory sizes at plausible scales (tens of thousands to millions of
  projects) without adding depth or complexity that no evidence justifies.
- Lazy directory creation (established by PR #788) must be preserved.
- The migration must be idempotent, resumable, crash-safe, safe under multi-instance
  startup, and must never silently overwrite user data.
- One canonical layout long-term; no permanent dual-write or dual-layout support.
- Cross-platform correctness: the same backend runs on Linux servers and inside the
  Electron desktop app on Windows/macOS (`AGENTS.md` §1: EBUSY file locks, `path.join`).

## Options considered

### Sharding depth

Assuming two hexadecimal characters per level, average **bucket-namespace** occupancy
(directories are created lazily, so unused buckets never physically exist):

| Projects | 0 levels (1 dir) | 1 level (256 buckets) | 2 levels (65,536) | 3 levels (16,777,216) |
|---:|---:|---:|---:|---:|
| 20,000 | 20,000 | ≈ 78 | ≈ 0.31 | ≈ 0.0012 |
| 200,000 | 200,000 | ≈ 781 | ≈ 3.05 | ≈ 0.0119 |
| 1,000,000 | 1,000,000 | ≈ 3,906 | ≈ 15.26 | ≈ 0.0596 |
| 10,000,000 | 10,000,000 | ≈ 39,063 | ≈ 152.59 | ≈ 0.5960 |

**Option A — 0 levels (status quo):** no migration cost; but the root keeps growing
unbounded, and retrofitting later means migrating much more data.

**Option B — 1 level (`assets/aa/<uuid>/`), chosen:** caps per-bucket project counts
very effectively at plausible scales (≈ 781 per bucket at 200k projects; even at 10M
projects a bucket averages ≈ 39k entries — a size ext4's htree handles for lookups, and
far from any structural limit). Minimal path depth, minimal intermediate directories,
one readable hop (`assets/ab/ab12…`). Precedent: Git loose objects use exactly one
two-hex-character level (see "Evidence").

**Option C — 2 levels (`assets/aa/bb/<uuid>/`, the issue's original proposal):**
65,536 possible buckets is disproportionate: at 1M projects the average bucket would
hold ≈ 15 directories, i.e. the intermediate level does almost nothing except add
depth and intermediate directories. No measurement indicates it is needed. (The issue
described two levels as "the scheme used by Git"; Git actually uses **one** level —
see "Evidence".)

**Option D — 3 levels:** ≈ 0.06 projects per leaf bucket at 1M projects; pure overhead
at any plausible eXeLearning scale.

We do **not** claim one level is universally optimal — it is the proportional choice for
the expected scale and current evidence, and the path portability work (below) makes a
future re-shard cheap if measurements ever justify it.

### Stored-path representation

**Chosen:** `storage_path` is a normalized POSIX-style path **relative to `FILES_DIR`,
including the `assets/` component**: `assets/ab/<uuid>/<clientId>.png` (nested form:
`assets/ab/<uuid>/<clientId>/<filename>`). This matches the existing themes/templates
convention, is unambiguous (no implicit `assets/` root to remember), and is portable
across hosts and path-separator conventions.

Rejected: keeping absolute paths (the defect being fixed), and prefix-free relative
paths (`ab/<uuid>/…`) which hide the storage root and invite `path.join(filesDir, …)`
mistakes.

### Shard algorithm

**Chosen:** for canonical UUIDs (8-4-4-4-12 hex), the shard is the **lowercased first
two hex characters**. Project UUIDs are generated with `uuid.v4()`
(`src/db/queries/projects.ts:302`) or `crypto.randomUUID()`
(`src/services/session-manager.ts:48`), whose first byte is uniformly random, so the
256 buckets are uniformly filled and an operator can find a project's directory by
reading its UUID.

However, `projects.uuid` is **not format-validated at every creation site** — e.g.
`createProjectWithUuid` accepts a client-supplied identifier verbatim
(`src/routes/project.ts:1251`). For any non-canonical identifier the shard falls back to
a deterministic, stable 8-bit **FNV-1a** hash rendered as two lowercase hex characters,
so the mapping is total and stable for arbitrary strings. Both branches are golden-tested
in `src/utils/asset-paths.spec.ts`.

Caveat recorded for the future: if project ID generation ever switches to a time-ordered
scheme (e.g. UUIDv7, whose leading bits are a timestamp), the first-two-hex prefix would
stop being uniform and this ADR must be revisited (worst case degrades toward today's
flat layout, not below it).

### Migration / compatibility strategy

Evaluated:

- **(a) Permanent support for both layouts** — rejected: two storage architectures
  forever, every reader forked.
- **(b) Temporary legacy-read compatibility + convergent migration** — **chosen**: the
  shared resolver re-roots legacy absolute values via their `assets/…` suffix under the
  *current* `FILES_DIR`, so not-yet-migrated (or conflict-parked) rows keep working —
  and, as a side effect, legacy rows become FILES_DIR-portable even before migration.
  All **new writes emit only the new format**; there is **no dual-write**.
- **(c) Immediate hard cut-over** — rejected: a failed or interrupted move would break
  reads with no fallback; unacceptable for user data.

The migration is **deliberately not a Kysely schema migration**: a filesystem move and a
database update cannot share one transaction, Kysely migrations run exactly once, and a
partially applied filesystem state must be re-checked on every startup. Instead a
dedicated idempotent service (`src/services/asset-storage-migration.ts`) runs in
`bootstrap()` after schema migrations and before `app.listen()`. Per row it moves the
file first, then rewrites the row under an optimistic
`WHERE id = ? AND storage_path = <old>` guard (crash-safe; safe when several app
instances start concurrently — one instance wins each row, the others reconcile). It
handles: source-only (move), destination-only (crash recovery: rewrite), both-identical
(drop legacy copy), both-different (**never overwrite** — keep both, report, park the row
on its legacy location in portable relative form), neither (log, rewrite so the table
converges, reads keep returning 404 as before), uninterpretable values (leave untouched,
report). A second phase sweeps orphan files (on disk, no row) from legacy directories
into the sharded layout and removes emptied directories; unrecognized entries are
reported and left in place. Cross-device moves fall back to copy-to-temp + rename +
size-verify + remove, so a destination never holds a partial file (`EXDEV`, bind mounts).

## Evidence

- Current flat layout and lazy creation are intentional: PR #788
  (<https://github.com/exelearning/exelearning/pull/788>); no runtime enumeration of the
  assets root: issue #2250 review of all `readdir`/`listFiles` call sites; per-project
  scoping also visible in issue #1842
  (<https://github.com/exelearning/exelearning/issues/1842>).
- Absolute write sites / read sites: `src/routes/assets.ts`, `src/routes/api/v1/assets.ts`,
  `src/routes/upload-session.ts`, `src/services/folder-manager.ts`,
  `src/routes/project.ts` @ `3c7c7e821`.
- **ext4 known-name lookup is indexed, not linear:** with `EXT4_INDEX_FL` set, "this
  directory uses a hashed btree (htree) to organize and find directory entries"; htree
  depth "cannot be larger than 3 if the INCOMPAT_LARGEDIR feature is set; cannot be
  larger than 2 otherwise" — Linux kernel ext4 directory documentation
  (<https://docs.kernel.org/filesystems/ext4/directory.html>; inode flags:
  <https://docs.kernel.org/filesystems/ext4/inodes.html>).
- ext4 feature semantics: `dir_index` ("Use hashed b-trees to speed up name lookups in
  large directories"), `dir_nlink` (lifts the ~65k-subdirectory link-count limit),
  `large_dir` (raises maximum directory size and htree height) — ext4(5) man page
  (<https://man7.org/linux/man-pages/man5/ext4.5.html>).
- **Git precedent (one level, not two):** loose objects are stored "with the first two
  hex characters of the object ID being the directory and the remaining characters being
  the file name … to shard the data and avoid too many files being in one directory,
  since some file systems perform poorly with many items in a directory"
  (<https://git-scm.com/docs/gitformat-loose>); "objects are splayed over 256
  subdirectories using the first two characters of the sha1 object name"
  (<https://git-scm.com/docs/gitrepository-layout>).
- Docker storage semantics (see "Consequences" for the operational guidance):
  volumes "write directly to the host filesystem", bypassing the storage-driver
  union-filesystem overhead of the container writable layer, and the local volume
  driver supports NFS mounts (<https://docs.docker.com/engine/storage/>,
  <https://docs.docker.com/engine/storage/volumes/>,
  <https://docs.docker.com/engine/storage/bind-mounts/>).
- Reproducible benchmark harness: `scripts/benchmark-asset-storage.ts` (correctness
  tests in `scripts/benchmark-asset-storage.spec.ts`); see "Validation".

Facts this decision explicitly does **not** rest on:

- **The flat layout is not a demonstrated runtime bug at current scale.** Known-path
  lookup on modern ext4 with `dir_index` is htree-indexed; nothing in the application
  enumerates the assets root at runtime. Sharding here is **low-cost preventive
  hardening**, adopted while it is cheap, not a fix for a measured failure.
- **Sharding does not make full-tree operations free.** A complete recursive traversal
  (full backup, `du`, `find`, `tar`, `rsync` file-list generation) still visits every
  filesystem object; sharding *redistributes* entries into smaller directories and adds
  intermediate directories. Its benefits are bounded directory sizes, avoidance of
  pathological single-directory extremes, predictable organization, and easier future
  partitioning — any claim that specific tools get materially faster must come from
  measurements on the actual storage backend.
- Historical large-directory folklore (early-2000s ext2/ext3 on spinning disks) is not
  evidence about modern Linux + SSD/NVMe behavior.
- NTFS behavior is **not** part of this server-side justification: the production
  server target is Linux. (The same storage code does run inside the Electron desktop
  app on Windows, which constrains the *migration* — EBUSY tolerance, `path.join` — but
  not the sharding decision.)

## Decision

We will:

1. Store project assets under **one 8-bit shard level**:
   `FILES_DIR/assets/<shard>/<projectUuid>/…`, where `<shard>` is the lowercased first
   two hex characters of the canonical project UUID (FNV-1a 8-bit fallback for
   non-canonical identifiers). 256 possible buckets, created **lazily**.
2. Persist `assets.storage_path` as a **POSIX-style path relative to `FILES_DIR`**,
   always starting with `assets/`. Absolute paths are no longer written.
3. Centralize the path grammar in `src/utils/asset-paths.ts`
   (`getAssetShard`, `buildAssetStoragePath`, `resolveAssetStoragePath`,
   `tryResolveAssetStoragePath`, `getProjectAssetsDirCandidates`) with FILES_DIR-bound
   wrappers in `src/services/file-helper.ts`; **every** conversion between a stored
   value and a physical path goes through this resolver (absolute-input rejection for
   new-format paths, `..`/separator/control-character rejection, containment check
   under `FILES_DIR/assets`).
4. Migrate existing installations at startup via the idempotent, resumable
   reconciliation described above, with a **temporary** legacy-read fallback in the
   resolver (accepting old absolute values via their `assets/…` suffix) that exists only
   to make deployment safe while rows converge.

## Consequences

### Positive

- Database asset rows survive any change of `FILES_DIR`; restoring a backup to a
  different mount no longer requires rewriting rows (regression-tested).
- Directory sizes are bounded (≈ N/256 project directories per bucket); the assets root
  itself holds at most 256 entries.
- One shared, hardened resolver replaces scattered `path.join` logic; storage layout can
  change again in the future by touching one module plus a migration.
- Assets now follow the same relative-path convention as themes and templates.
- Deletion paths (cleanup scheduler, admin user deletion, CLI cleanup) remove both the
  sharded and the legacy directory, so pre-migration leftovers cannot linger.

### Negative

- One extra directory level in every asset path.
- A transitional legacy-read fallback exists in the resolver until installations
  converge; it must eventually be removed (see "Follow-up work").
- Startup performs a cheap, bounded check per boot even on converged installations: one
  indexed-free `NOT LIKE 'assets/__/%'` query, one readdir of the assets root, and a
  content check (`readdir`) of each existing two-decimal shard bucket (`00`-`99`) to
  distinguish it from a legacy numeric project-id directory.

### Neutral

- Full-tree operations (backup, `du`, `find`) still scale with total object count.
- Operators may use Docker named volumes, bind mounts, NFS-backed volumes, SAN/CSI
  storage, etc.; the requirement is only that persistent `FILES_DIR` data live outside
  the container writable layer. Docker named volumes are not inherently a performance
  problem. NFS/SAN/network storage behaves differently from local ext4 and should be
  benchmarked on the actual deployment; local results must not be extrapolated to
  network filesystems.
- Very large deployments should choose their storage backend (ext4, XFS, Btrfs,
  OpenZFS, NFS-backed, SAN/block, or object storage if the architecture evolves) from
  operational requirements and measured workloads — ext4 is **not** declared unsuitable
  for large installations, and no alternative filesystem is recommended solely for
  being perceived as "large-scale". Btrfs, for example, offers snapshots, checksums and
  send/receive (<https://docs.kernel.org/filesystems/btrfs.html>), which are operational
  features, not automatic performance wins for this workload.

## Risks

- **Interrupted migration** (crash, power loss, EBUSY on Windows desktops): mitigated by
  the move-then-rewrite protocol, per-row optimistic guards, per-row error isolation
  (one failure never aborts the run) and re-execution on every startup; unmigrated rows
  keep resolving through the legacy fallback in the meantime.
- **Conflicting files** (both legacy and sharded location populated with different
  content, e.g. after a crashed replace-upload): never overwritten; both copies are
  kept, the row is parked on its legacy location in portable relative form, and the
  situation is re-reported on every boot until an operator resolves it.
- **Concurrent multi-instance startup** (Redis HA): both instances run the migration;
  the optimistic row guard and existence checks make the race benign (worst case: a
  redundant identical copy attempt).
- **Rollback:** rolling back the application binary alone is safe *before* migration has
  run. After migration, old binaries cannot read relative paths — so the operational
  rollback path is restoring the pre-upgrade backup of `FILES_DIR` + database (the
  change document's deployment guide requires taking one). No `down()` script is
  provided on purpose: reverse-moving user files would recreate the risk the forward
  migration is designed to manage, for no product benefit.

## Validation

- Unit specs: `src/utils/asset-paths.spec.ts` (grammar, shard, traversal rejection,
  FILES_DIR portability), `src/services/asset-storage-migration.spec.ts` (all seven
  migration states, idempotency, EXDEV fallback, orphan sweep, conflict handling),
  plus updated route/service/provider specs asserting relative sharded writes and
  legacy-read fallback.
- `scripts/benchmark-asset-storage.ts` provides a reproducible comparison of 0/1/2/3
  levels (creation, known-path stat, root/bucket readdir, full traversal) at
  configurable scale (20k/200k/1M project targets). It is **not** run in CI (its spec
  only checks harness correctness; timing thresholds do not belong in CI). Operators
  should run it on local ext4 SSD/NVMe, on the actual production backend, and on
  NFS/SAN if used, recording kernel version, filesystem type, mount options and
  container context. Benchmark results at larger scales may justify revisiting the
  shard depth; the resolver abstraction keeps that change cheap.

## Follow-up work

- Remove the legacy absolute-path read fallback from the resolver once field
  installations have converged (tracked in
  <https://github.com/exelearning/exelearning/issues/2288> for a future major release;
  the migration's per-boot summary tells operators when their installation is clean).
- Provide a CLI subcommand that lists parked migration conflicts and resolves them
  with an explicit keep-old / keep-new choice
  (<https://github.com/exelearning/exelearning/issues/2287>, implemented as
  `assets:conflicts` — see the change document for #2287).
- Consider validating client-supplied project identifiers at creation time so the
  FNV-1a fallback becomes purely defensive.

## References

- Issue <https://github.com/exelearning/exelearning/issues/2250> (tracking);
  PR #788 <https://github.com/exelearning/exelearning/pull/788>;
  issue #1842 <https://github.com/exelearning/exelearning/issues/1842>.
- Linux kernel ext4 documentation: directories
  <https://docs.kernel.org/filesystems/ext4/directory.html>, inodes
  <https://docs.kernel.org/filesystems/ext4/inodes.html>; ext4(5)
  <https://man7.org/linux/man-pages/man5/ext4.5.html>.
- Git: <https://git-scm.com/docs/gitformat-loose>,
  <https://git-scm.com/docs/gitrepository-layout>.
- Docker: <https://docs.docker.com/engine/storage/>,
  <https://docs.docker.com/engine/storage/volumes/>,
  <https://docs.docker.com/engine/storage/bind-mounts/>.
- Btrfs: <https://docs.kernel.org/filesystems/btrfs.html>.
- Change document: `doc/architecture/changes/2250-asset-storage-sharding/design.md`.
