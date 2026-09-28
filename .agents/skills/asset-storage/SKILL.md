---
name: asset-storage
description: "Change eXeLearning asset paths, sharding, cache persistence, chunked imports, save/export file handling or cleanup."
---

# Asset storage and import files

Trace `src/utils/asset-paths.ts`, `src/services/file-helper.ts`, `src/db/queries/assets.ts`,
`public/app/yjs/AssetManager.js`, and the affected import/export caller.

- Resolve FILES_DIR through the helper (`ELYSIA_FILES_DIR` for tests, then `FILES_DIR`, then `./data/`).
  Persist relative POSIX `assets/<shard>/<projectUuid>/...` paths (shard = first two hex characters of the
  UUID, ADR-2250-01), not absolute host paths or numeric project IDs. FILES_DIR also holds `tmp/` and
  `dist/` (dated subdirectories), `chunks/`, `themes/site/` and the SQLite database; create them lazily.
- Reuse the existing path builders/resolvers and migration compatibility. Validate user-derived paths with
  `isPathSafe()` (`src/services/file-helper.ts`); do not concatenate untrusted segments or silently
  reinterpret a rejected path. Build paths with `path.join()`, never string concatenation.
- Browser Yjs metadata, Cache API blobs and server files have different lifetimes. Check reload/offline
  behavior and ownership before deleting shared/referenced assets. Do not treat derived caches as canonical data.
- Direct ELP/ELPX import happens in the browser: `importElpDirectly` → `importFromElpxViaYjs`, then the
  UI refreshes from the Y.Doc and saves on explicit save/autosave. The fallback uploads chunks to
  `POST /api/project/upload-chunk`, the server only concatenates them into a temp file, the workarea
  reloads with `?import=...` and imports client-side, then calls `DELETE /api/project/cleanup-import`.
  The server is never the normal package parser. Preserve cleanup-import and cancellation paths.
- Preserve previous usable content on failed replacement/save. Close handles/kill processes before deleting
  their files (Windows raises `EBUSY` on locked files); use isolated temp directories and clean up failed uploads/exports.
- Large packages need bounded processing. Use existing metadata APIs and profiling rather than loading
  every blob or base64 copy merely to count, list or locate assets.

Run affected path/helper/query tests plus frontend asset/import tests. Include subpaths, legacy stored
paths, invalid UUID/path input, failed replacement, reload and cleanup. Use disposable fixtures, never
live project data. Storage layout changes require the architecture procedure and `verify-change` gates.
