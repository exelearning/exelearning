/**
 * Asset storage layout migration (issue #2250, ADR-2250-01).
 *
 * Converges existing installations from the legacy layout
 *
 *     FILES_DIR/assets/<projectUuid>/...        with absolute storage_path rows
 *
 * to the canonical sharded layout
 *
 *     FILES_DIR/assets/<shard>/<projectUuid>/... with FILES_DIR-relative rows
 *
 * Design constraints (see the ADR for the rationale):
 *
 * - This is deliberately NOT a Kysely schema migration. Filesystem moves and
 *   database updates cannot share one transaction, so the migration is written
 *   as an idempotent, resumable reconciliation that runs at every startup
 *   (after schema migrations, before the server starts listening) and is a
 *   fast no-op once everything has converged.
 * - Per-row protocol: move the file first, then rewrite the row with an
 *   optimistic `WHERE storage_path = <old>` guard. A crash between the two
 *   steps leaves a state ("file at destination, row still legacy") that the
 *   next run reconciles. The guard also makes concurrent execution by several
 *   app instances safe: exactly one instance wins each row, the others
 *   re-observe an already-converged state.
 * - Never overwrite: when source and destination both exist with different
 *   content, both files are kept, the conflict is reported, and the row is
 *   rewritten to the portable relative form of its CURRENT (legacy) location.
 * - Missing files are logged and the row is rewritten to the canonical target
 *   so the table converges; reads treat the row exactly like before (404).
 * - Rows whose stored value cannot be interpreted safely (no `assets/...`
 *   suffix, traversal attempts) are left untouched and reported.
 */
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import * as cryptoModule from 'crypto';
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import type { Database } from '../db/types';
import { now } from '../db/types';
import { getFilesDir as defaultGetFilesDir } from './file-helper';
import {
    ASSETS_ROOT_DIR_NAME,
    buildAssetStoragePath,
    extractAssetsRelativeSegments,
    getAssetShard,
    isCanonicalAssetStoragePath,
    tryResolveAssetStoragePath,
} from '../utils/asset-paths';

/**
 * Result counters for one migration run. All counters are 0 on a fully
 * converged installation.
 */
export interface AssetStorageMigrationSummary {
    /** Legacy rows (storage_path not in the canonical relative form) examined. */
    scannedRows: number;
    /** Files physically moved to the sharded location. */
    movedFiles: number;
    /** Rows rewritten to a FILES_DIR-relative storage_path. */
    rewrittenRows: number;
    /** Rows whose file was already at the destination (crash recovery). */
    alreadyMigrated: number;
    /** Rows whose file exists at neither the legacy nor the sharded location. */
    missingFiles: number;
    /** Source/destination pairs with different content; both kept. */
    conflicts: number;
    /** Rows left untouched because their stored value is uninterpretable. */
    skippedRows: number;
    /** Files without database rows swept into the sharded layout. */
    orphanedFilesMoved: number;
    /** Unrecognized assets-root entries left in place. */
    skippedEntries: number;
    /** I/O or database errors; the affected items are retried on next startup. */
    errors: number;
}

/**
 * Injectable dependencies (DI pattern used across src/services).
 */
export interface AssetStorageMigrationDeps {
    db?: Kysely<Database>;
    fs?: typeof fsExtra;
    getFilesDir?: () => string;
    log?: (message: string) => void;
    warn?: (message: string) => void;
    /** Rows fetched per query; bounds memory on large installations. */
    batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 500;

const SHARD_BUCKET = /^[0-9a-f]{2}$/;

/**
 * Move a file, preferring an atomic rename. On EXDEV (cross-device link, e.g.
 * bind mounts inside FILES_DIR) falls back to copy-to-temp + rename + verify +
 * remove, so the destination never holds a partially written file.
 */
async function moveFile(fs: typeof fsExtra, src: string, dest: string): Promise<void> {
    try {
        await fs.rename(src, dest);
        return;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EXDEV') {
            throw err;
        }
    }
    const tmp = `${dest}.migrate-tmp-${process.pid}-${cryptoModule.randomBytes(4).toString('hex')}`;
    try {
        await fs.copy(src, tmp);
        const [srcStat, tmpStat] = await Promise.all([fs.stat(src), fs.stat(tmp)]);
        if (srcStat.size !== tmpStat.size) {
            throw new Error(`copy size mismatch moving ${src}`);
        }
        await fs.rename(tmp, dest);
    } catch (err) {
        await fs.remove(tmp).catch(() => {});
        throw err;
    }
    await fs.remove(src);
}

/**
 * Compare two files by size and SHA-256 content hash (streamed).
 */
async function filesAreIdentical(fs: typeof fsExtra, a: string, b: string): Promise<boolean> {
    const [statA, statB] = await Promise.all([fs.stat(a), fs.stat(b)]);
    if (statA.size !== statB.size) {
        return false;
    }
    const hashFile = (filePath: string): Promise<string> =>
        new Promise((resolve, reject) => {
            const hash = cryptoModule.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('error', reject);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    const [hashA, hashB] = await Promise.all([hashFile(a), hashFile(b)]);
    return hashA === hashB;
}

/**
 * Rewrite one row's storage_path with an optimistic concurrency guard.
 * Returns true when this call performed the update.
 */
async function rewriteRow(db: Kysely<Database>, id: number, oldPath: string, newPath: string): Promise<boolean> {
    const result = await db
        .updateTable('assets')
        .set({ storage_path: newPath, updated_at: now() })
        .where('id', '=', id)
        .where('storage_path', '=', oldPath)
        .execute();
    return Number(result[0]?.numUpdatedRows ?? 0) > 0;
}

/**
 * Remove a directory tree that contains no files (post-order). Leaves the
 * tree untouched if any file remains anywhere inside it.
 */
async function removeDirIfEmpty(fs: typeof fsExtra, path: typeof pathModule, dir: string): Promise<boolean> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let empty = true;
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const removed = await removeDirIfEmpty(fs, path, path.join(dir, entry.name));
            if (!removed) {
                empty = false;
            }
        } else {
            empty = false;
        }
    }
    if (empty) {
        await fs.rmdir(dir);
    }
    return empty;
}

/**
 * Recursively list files under `dir` as relative segment arrays.
 */
async function listFilesRecursive(
    fs: typeof fsExtra,
    path: typeof pathModule,
    dir: string,
    prefix: string[] = [],
): Promise<string[][]> {
    const files: string[][] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            files.push(...(await listFilesRecursive(fs, path, path.join(dir, entry.name), [...prefix, entry.name])));
        } else if (entry.isFile()) {
            files.push([...prefix, entry.name]);
        }
    }
    return files;
}

interface LegacyRow {
    id: number;
    storage_path: string;
    project_uuid: string;
}

/**
 * Run the asset storage layout migration. Idempotent, resumable, safe to run
 * concurrently, and a fast no-op once the installation has converged.
 */
export async function migrateAssetStorage(deps: AssetStorageMigrationDeps = {}): Promise<AssetStorageMigrationSummary> {
    const db = deps.db ?? defaultDb;
    const fs = deps.fs ?? fsExtra;
    const path = pathModule;
    const getFilesDir = deps.getFilesDir ?? defaultGetFilesDir;
    const log = deps.log ?? ((message: string) => console.log(message));
    const warn = deps.warn ?? ((message: string) => console.warn(message));
    const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;

    const filesDir = getFilesDir();
    const assetsRoot = path.join(filesDir, ASSETS_ROOT_DIR_NAME);

    const summary: AssetStorageMigrationSummary = {
        scannedRows: 0,
        movedFiles: 0,
        rewrittenRows: 0,
        alreadyMigrated: 0,
        missingFiles: 0,
        conflicts: 0,
        skippedRows: 0,
        orphanedFilesMoved: 0,
        skippedEntries: 0,
        errors: 0,
    };

    // =========================================================================
    // Phase 1: row-driven migration.
    // Every row whose storage_path is not FILES_DIR-relative is legacy.
    // Cursor pagination (id > lastId) guarantees termination even for rows
    // that are skipped without being rewritten.
    // =========================================================================
    let lastId = 0;
    for (;;) {
        const rows: LegacyRow[] = await db
            .selectFrom('assets')
            .innerJoin('projects', 'assets.project_id', 'projects.id')
            .select(['assets.id as id', 'assets.storage_path as storage_path', 'projects.uuid as project_uuid'])
            .where('assets.storage_path', 'not like', `${ASSETS_ROOT_DIR_NAME}/%`)
            .where('assets.id', '>', lastId)
            .orderBy('assets.id', 'asc')
            .limit(batchSize)
            .execute();

        if (rows.length === 0) {
            break;
        }

        for (const row of rows) {
            lastId = row.id;
            summary.scannedRows++;
            try {
                await migrateRow(row);
            } catch (err) {
                summary.errors++;
                warn(`[AssetStorage] Failed to migrate asset ${row.id} (${row.storage_path}): ${err}`);
            }
        }
    }

    async function migrateRow(row: LegacyRow): Promise<void> {
        const segments = extractAssetsRelativeSegments(row.storage_path);
        if (!segments || segments.length < 2) {
            // No safe `assets/...` suffix (arbitrary absolute path, traversal
            // attempt, or a file directly under the assets root). Leave the row
            // untouched for the operator to inspect.
            summary.skippedRows++;
            warn(`[AssetStorage] Leaving uninterpretable storage_path on asset ${row.id}: ${row.storage_path}`);
            return;
        }

        const uuid = row.project_uuid;
        const shard = getAssetShard(uuid);

        // A row may already point (absolutely) at the sharded location, e.g.
        // after a crash in an older run. Then the target IS the current
        // location and only the row needs rewriting.
        const alreadySharded = segments.length >= 3 && segments[0] === shard && segments[1] === uuid;
        const relWithinProject = alreadySharded ? segments.slice(2) : segments.slice(1);
        const targetStored = buildAssetStoragePath(uuid, ...relWithinProject);
        if (!isCanonicalAssetStoragePath(targetStored)) {
            summary.skippedRows++;
            warn(`[AssetStorage] Could not derive a canonical path for asset ${row.id}: ${row.storage_path}`);
            return;
        }

        const src = tryResolveAssetStoragePath(filesDir, row.storage_path);
        const dest = tryResolveAssetStoragePath(filesDir, targetStored);
        if (!src || !dest) {
            summary.skippedRows++;
            warn(`[AssetStorage] Could not resolve paths for asset ${row.id}: ${row.storage_path}`);
            return;
        }

        if (src === dest) {
            // Already at the sharded location; only the representation changes.
            if (await rewriteRow(db, row.id, row.storage_path, targetStored)) {
                summary.rewrittenRows++;
            }
            return;
        }

        const [srcExists, destExists] = await Promise.all([fs.pathExists(src), fs.pathExists(dest)]);

        if (srcExists && !destExists) {
            await fs.ensureDir(path.dirname(dest));
            await moveFile(fs, src, dest);
            summary.movedFiles++;
            if (await rewriteRow(db, row.id, row.storage_path, targetStored)) {
                summary.rewrittenRows++;
            }
            return;
        }

        if (!srcExists && destExists) {
            // Crash recovery: the file was moved but the row was not rewritten.
            summary.alreadyMigrated++;
            if (await rewriteRow(db, row.id, row.storage_path, targetStored)) {
                summary.rewrittenRows++;
            }
            return;
        }

        if (srcExists && destExists) {
            if (await filesAreIdentical(fs, src, dest)) {
                // Same content on both sides: keep the destination, drop the
                // legacy copy, point the row at the canonical location.
                await fs.remove(src);
                summary.alreadyMigrated++;
                if (await rewriteRow(db, row.id, row.storage_path, targetStored)) {
                    summary.rewrittenRows++;
                }
                return;
            }
            // Different content: never overwrite. Keep BOTH files, report the
            // conflict, and rewrite the row to the portable relative form of
            // its current (legacy) location so it stays valid and portable.
            summary.conflicts++;
            const legacyStored = [ASSETS_ROOT_DIR_NAME, ...segments].join('/');
            warn(
                `[AssetStorage] Conflict for asset ${row.id}: '${legacyStored}' and '${targetStored}' differ. ` +
                    `Keeping both; the database keeps pointing at the legacy location. Resolve manually.`,
            );
            if (isCanonicalAssetStoragePath(legacyStored)) {
                if (await rewriteRow(db, row.id, row.storage_path, legacyStored)) {
                    summary.rewrittenRows++;
                }
            }
            return;
        }

        // Neither location has the file: record it and rewrite the row to the
        // canonical target so the table converges. Reads behave exactly as
        // before (missing file), matching the existing missing-asset policy.
        summary.missingFiles++;
        warn(`[AssetStorage] Asset file missing for asset ${row.id}: ${row.storage_path}`);
        if (await rewriteRow(db, row.id, row.storage_path, targetStored)) {
            summary.rewrittenRows++;
        }
    }

    // =========================================================================
    // Phase 2: filesystem sweep.
    // Any assets-root entry that is not a two-hex shard bucket is a legacy
    // leftover: orphan files (no DB row) are moved into the sharded layout,
    // emptied directories are removed, unidentifiable entries are reported and
    // left in place.
    // =========================================================================
    if (await fs.pathExists(assetsRoot)) {
        let rootEntries: fsExtra.Dirent[] = [];
        try {
            rootEntries = await fs.readdir(assetsRoot, { withFileTypes: true });
        } catch (err) {
            summary.errors++;
            warn(`[AssetStorage] Could not read assets root ${assetsRoot}: ${err}`);
        }

        for (const entry of rootEntries) {
            const entryName = entry.name;
            if (entry.isDirectory() && SHARD_BUCKET.test(entryName)) {
                continue; // canonical shard bucket
            }
            if (!entry.isDirectory()) {
                summary.skippedEntries++;
                warn(`[AssetStorage] Leaving unexpected file in assets root: ${entryName}`);
                continue;
            }

            // Identify the project this legacy directory belongs to: directory
            // names are project UUIDs, or numeric project ids (legacy quirk).
            let uuid: string | null = null;
            const byUuid = await db
                .selectFrom('projects')
                .select('uuid')
                .where('uuid', '=', entryName)
                .executeTakeFirst();
            if (byUuid) {
                uuid = byUuid.uuid;
            } else if (/^\d+$/.test(entryName)) {
                const byId = await db
                    .selectFrom('projects')
                    .select('uuid')
                    .where('id', '=', parseInt(entryName, 10))
                    .executeTakeFirst();
                uuid = byId?.uuid ?? null;
            }

            const legacyDir = path.join(assetsRoot, entryName);
            if (!uuid) {
                summary.skippedEntries++;
                warn(`[AssetStorage] Leaving unrecognized assets directory in place: ${entryName}`);
                continue;
            }

            try {
                // Files still referenced by database rows (e.g. conflict rows
                // rewritten to their legacy-relative location in phase 1) are
                // live data, not orphans: never move them out from under a row.
                const referencedPaths = new Set<string>();
                const projectRow = await db
                    .selectFrom('projects')
                    .select('id')
                    .where('uuid', '=', uuid)
                    .executeTakeFirst();
                if (projectRow) {
                    const projectAssets = await db
                        .selectFrom('assets')
                        .select('storage_path')
                        .where('project_id', '=', projectRow.id)
                        .execute();
                    for (const assetRow of projectAssets) {
                        const resolved = assetRow.storage_path
                            ? tryResolveAssetStoragePath(filesDir, assetRow.storage_path)
                            : null;
                        if (resolved && resolved.startsWith(legacyDir + path.sep)) {
                            referencedPaths.add(resolved);
                        }
                    }
                }

                let referencedLeft = 0;
                const files = await listFilesRecursive(fs, path, legacyDir);
                for (const relSegments of files) {
                    try {
                        if (referencedPaths.has(path.join(legacyDir, ...relSegments))) {
                            referencedLeft++;
                            continue;
                        }
                        const targetStored = buildAssetStoragePath(uuid, ...relSegments);
                        const dest = tryResolveAssetStoragePath(filesDir, targetStored);
                        if (!dest) {
                            summary.skippedEntries++;
                            continue;
                        }
                        const src = path.join(legacyDir, ...relSegments);
                        if (!(await fs.pathExists(dest))) {
                            await fs.ensureDir(path.dirname(dest));
                            await moveFile(fs, src, dest);
                            summary.orphanedFilesMoved++;
                        } else if (await filesAreIdentical(fs, src, dest)) {
                            await fs.remove(src);
                        } else {
                            summary.conflicts++;
                            warn(
                                `[AssetStorage] Conflict sweeping '${src}': destination '${dest}' differs. ` +
                                    `Keeping both. Resolve manually.`,
                            );
                        }
                    } catch (err) {
                        summary.errors++;
                        warn(`[AssetStorage] Failed to sweep '${relSegments.join('/')}' in ${entryName}: ${err}`);
                    }
                }
                if (referencedLeft > 0) {
                    warn(
                        `[AssetStorage] ${referencedLeft} file(s) under legacy directory '${entryName}' are still ` +
                            `referenced by unresolved conflict rows and were left in place.`,
                    );
                } else {
                    await removeDirIfEmpty(fs, path, legacyDir);
                }
            } catch (err) {
                summary.errors++;
                warn(`[AssetStorage] Failed to sweep legacy directory ${entryName}: ${err}`);
            }
        }
    }

    const didWork =
        summary.scannedRows > 0 || summary.orphanedFilesMoved > 0 || summary.skippedEntries > 0 || summary.errors > 0;
    if (didWork) {
        log(
            `[AssetStorage] Migration summary: ${summary.movedFiles} file(s) moved, ` +
                `${summary.rewrittenRows} row(s) rewritten, ${summary.alreadyMigrated} already migrated, ` +
                `${summary.missingFiles} missing, ${summary.conflicts} conflict(s), ` +
                `${summary.orphanedFilesMoved} orphan(s) moved, ${summary.skippedRows} row(s) skipped, ` +
                `${summary.skippedEntries} entr(ies) left in place, ${summary.errors} error(s).`,
        );
    } else {
        log('[AssetStorage] Asset storage layout is up to date.');
    }

    return summary;
}
