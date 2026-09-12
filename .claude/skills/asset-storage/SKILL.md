---
name: asset-storage
description: "Change eXeLearning asset paths, sharding, cache persistence, chunked imports, save/export file handling or cleanup."
---

# Asset storage and import files

Trace `src/utils/asset-paths.ts`, `src/services/file-helper.ts`, `src/db/queries/assets.ts`,
`public/app/yjs/AssetManager.js`, and the affected import/export caller.

- Resolve FILES_DIR through the helper (`ELYSIA_FILES_DIR` for tests takes precedence). Persist relative
  POSIX `assets/<shard>/<projectUuid>/...` paths, not absolute host paths or numeric project IDs.
- Reuse the existing path builders/resolvers and migration compatibility. Validate containment for
  user-derived paths; do not concatenate untrusted segments or silently reinterpret a rejected path.
- Browser Yjs metadata, Cache API blobs and server files have different lifetimes. Check reload/offline
  behavior and ownership before deleting shared/referenced assets. Do not treat derived caches as canonical data.
- Direct ELP/ELPX import happens in the browser. Chunked upload is a temporary server staging fallback;
  it does not make the server the normal package parser. Preserve cleanup-import and cancellation paths.
- Preserve previous usable content on failed replacement/save. Close handles/processes before deleting
  files on Windows; use isolated temp directories and clean up failed uploads/exports.
- Large packages need bounded processing. Use existing metadata APIs and profiling rather than loading
  every blob or base64 copy merely to count, list or locate assets.

Run affected path/helper/query tests plus frontend asset/import tests. Include subpaths, legacy stored
paths, invalid UUID/path input, failed replacement, reload and cleanup. Use disposable fixtures, never
live project data. Storage layout changes require the architecture procedure and `verify-change` gates.
