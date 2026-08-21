/**
 * Asset storage conflict service (issue #2287, ADR-2250-01).
 *
 * The startup migration (asset-storage-migration.ts) never overwrites: when a
 * row's legacy file and its canonical sharded destination both exist with
 * different content, both files are kept and the row is parked on its legacy
 * location. Those rows never converge on their own — resolving them requires
 * an explicit operator choice, which this service provides:
 *
 * - `listAssetStorageConflicts` finds every parked or legacy row whose two
 *   copies currently differ, with both absolute paths, sizes and mtimes.
 * - `resolveAssetStorageConflict` applies an explicit `keep-old` / `keep-new`
 *   choice to ONE asset. Nothing is ever deleted or overwritten without that
 *   choice; identical copies are converged with the same rule the startup
 *   migration applies automatically.
 *
 * Both operations reuse the migration's building blocks (`filesAreIdentical`,
 * `moveFile`, `rewriteRow`) so "conflict" and "move" mean exactly the same
 * thing at startup and in the CLI, and every step stays crash-safe: any
 * interruption leaves a state the next startup migration reconciles.
 */
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import type { Database } from '../db/types';
import { getFilesDir as defaultGetFilesDir } from './file-helper';
import { filesAreIdentical, moveFile, rewriteRow } from './asset-storage-migration';
import { deriveShardedAssetStoragePath, tryResolveAssetStoragePath } from '../utils/asset-paths';

const DEFAULT_BATCH_SIZE = 500;

/** One unresolved storage conflict, ready to display to an operator. */
export interface AssetStorageConflict {
    assetId: number;
    projectUuid: string;
    filename: string;
    /** Current database value (parked relative or legacy absolute form). */
    storedPath: string;
    /** Canonical sharded value the row converges to after resolution. */
    canonicalStoredPath: string;
    /** Absolute path of the copy the database currently points at. */
    legacyPath: string;
    /** Absolute path of the copy at the canonical sharded location. */
    canonicalPath: string;
    legacySize: number;
    canonicalSize: number;
    legacyMtime: string;
    canonicalMtime: string;
}

export type ConflictResolutionChoice = 'keep-old' | 'keep-new';

export interface ResolveConflictResult {
    success: boolean;
    /** True when files/rows were actually changed (false for dry-run). */
    resolved: boolean;
    message: string;
}

/**
 * Injectable dependencies (DI pattern used across src/services).
 */
export interface AssetConflictsDeps {
    db?: Kysely<Database>;
    fs?: typeof fsExtra;
    getFilesDir?: () => string;
    /** Rows fetched per query; bounds memory on large installations. */
    batchSize?: number;
}

interface CandidateRow {
    id: number;
    storage_path: string;
    filename: string;
    project_uuid: string;
}

type RowClassification =
    | { state: 'converged' | 'uninterpretable' | 'incomplete' }
    | { state: 'identical' | 'conflict'; src: string; dest: string; target: string };

/**
 * Classifies one row against the filesystem. Converged rows are recognized
 * with a pure string comparison, so they cost no I/O.
 */
async function classifyRow(fs: typeof fsExtra, filesDir: string, row: CandidateRow): Promise<RowClassification> {
    const target = deriveShardedAssetStoragePath(row.project_uuid, row.storage_path);
    if (!target) {
        return { state: 'uninterpretable' };
    }
    if (target === row.storage_path) {
        return { state: 'converged' };
    }
    const src = tryResolveAssetStoragePath(filesDir, row.storage_path);
    const dest = tryResolveAssetStoragePath(filesDir, target);
    if (!src || !dest) {
        return { state: 'uninterpretable' };
    }
    if (src === dest) {
        // Same physical file under a non-canonical representation; the
        // startup migration rewrites these rows without any file operation.
        return { state: 'converged' };
    }
    const [srcExists, destExists] = await Promise.all([fs.pathExists(src), fs.pathExists(dest)]);
    if (!srcExists || !destExists) {
        // Nothing to decide: the startup migration handles free destinations
        // and missing files on its own.
        return { state: 'incomplete' };
    }
    if (await filesAreIdentical(fs, src, dest)) {
        return { state: 'identical', src, dest, target };
    }
    return { state: 'conflict', src, dest, target };
}

function candidateQuery(db: Kysely<Database>) {
    return db
        .selectFrom('assets')
        .innerJoin('projects', 'assets.project_id', 'projects.id')
        .select([
            'assets.id as id',
            'assets.storage_path as storage_path',
            'assets.filename as filename',
            'projects.uuid as project_uuid',
        ]);
}

/**
 * Lists every unresolved storage conflict. Scans all asset rows in bounded
 * batches; rows already in canonical form are skipped with a string
 * comparison, so only non-canonical rows cost filesystem checks.
 */
export async function listAssetStorageConflicts(deps: AssetConflictsDeps = {}): Promise<AssetStorageConflict[]> {
    const db = deps.db ?? defaultDb;
    const fs = deps.fs ?? fsExtra;
    const getFilesDir = deps.getFilesDir ?? defaultGetFilesDir;
    const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
    const filesDir = getFilesDir();

    const conflicts: AssetStorageConflict[] = [];
    let lastId = 0;
    for (;;) {
        const rows: CandidateRow[] = await candidateQuery(db)
            .where('assets.id', '>', lastId)
            .orderBy('assets.id', 'asc')
            .limit(batchSize)
            .execute();
        if (rows.length === 0) {
            break;
        }
        for (const row of rows) {
            lastId = row.id;
            const classified = await classifyRow(fs, filesDir, row);
            if (classified.state !== 'conflict') {
                continue;
            }
            const [srcStat, destStat] = await Promise.all([fs.stat(classified.src), fs.stat(classified.dest)]);
            conflicts.push({
                assetId: row.id,
                projectUuid: row.project_uuid,
                filename: row.filename,
                storedPath: row.storage_path,
                canonicalStoredPath: classified.target,
                legacyPath: classified.src,
                canonicalPath: classified.dest,
                legacySize: srcStat.size,
                canonicalSize: destStat.size,
                legacyMtime: srcStat.mtime.toISOString(),
                canonicalMtime: destStat.mtime.toISOString(),
            });
        }
    }
    return conflicts;
}

/**
 * Resolves ONE conflict with an explicit operator choice.
 *
 * - `keep-new`: the canonical copy wins — the legacy copy is removed, then
 *   the row is rewritten to the canonical location.
 * - `keep-old`: the legacy copy wins — the canonical copy is removed, the
 *   legacy file is moved into its place, then the row is rewritten.
 *
 * Operation order is chosen so a crash at any point leaves a state the next
 * startup migration converges on its own. Row rewrites keep the migration's
 * optimistic `WHERE storage_path = <old>` guard, so a concurrently starting
 * instance can never be raced into losing an update.
 */
export async function resolveAssetStorageConflict(
    assetId: number,
    choice: ConflictResolutionChoice,
    options: { dryRun?: boolean } = {},
    deps: AssetConflictsDeps = {},
): Promise<ResolveConflictResult> {
    const db = deps.db ?? defaultDb;
    const fs = deps.fs ?? fsExtra;
    const getFilesDir = deps.getFilesDir ?? defaultGetFilesDir;
    const filesDir = getFilesDir();
    const dryRun = options.dryRun === true;

    const row: CandidateRow | undefined = await candidateQuery(db).where('assets.id', '=', assetId).executeTakeFirst();
    if (!row) {
        return { success: false, resolved: false, message: `Asset ${assetId} does not exist.` };
    }

    const classified = await classifyRow(fs, filesDir, row);
    if (classified.state === 'converged') {
        return {
            success: false,
            resolved: false,
            message: `Asset ${assetId} is already at its canonical location; nothing to resolve.`,
        };
    }
    if (classified.state === 'uninterpretable') {
        return {
            success: false,
            resolved: false,
            message:
                `Asset ${assetId} has an uninterpretable storage_path (${row.storage_path}); ` +
                `it is not a storage conflict. Inspect the row manually.`,
        };
    }
    if (classified.state === 'incomplete') {
        return {
            success: false,
            resolved: false,
            message:
                `Asset ${assetId} is not an unresolved conflict (one of the two locations has no file); ` +
                `the startup migration will converge it automatically.`,
        };
    }

    const { src, dest, target } = classified;

    if (classified.state === 'identical') {
        // Both copies have the same content: converging is decision-free and
        // matches what the startup migration does on every boot.
        if (dryRun) {
            return {
                success: true,
                resolved: false,
                message: `[dry-run] Copies are identical; would remove '${src}' and point the row at '${dest}'.`,
            };
        }
        await fs.remove(src);
        if (!(await rewriteRow(db, row.id, row.storage_path, target))) {
            return concurrentChange(assetId);
        }
        return {
            success: true,
            resolved: true,
            message: `Copies were identical; removed '${src}' and pointed asset ${assetId} at '${dest}'.`,
        };
    }

    if (dryRun) {
        const plan =
            choice === 'keep-new'
                ? `remove legacy '${src}' and keep canonical '${dest}'`
                : `remove canonical '${dest}' and move legacy '${src}' into its place`;
        return { success: true, resolved: false, message: `[dry-run] Would ${plan}, then rewrite the row.` };
    }

    if (choice === 'keep-new') {
        await fs.remove(src);
    } else {
        await fs.remove(dest);
        await fs.ensureDir(pathModule.dirname(dest));
        await moveFile(fs, src, dest);
    }
    if (!(await rewriteRow(db, row.id, row.storage_path, target))) {
        return concurrentChange(assetId);
    }
    const kept = choice === 'keep-new' ? 'canonical' : 'legacy';
    return {
        success: true,
        resolved: true,
        message:
            `Kept the ${kept} copy for asset ${assetId}; the row now points at '${dest}'. ` +
            `The next startup migration tidies any emptied legacy directory.`,
    };
}

function concurrentChange(assetId: number): ResolveConflictResult {
    return {
        success: false,
        resolved: false,
        message:
            `The database row for asset ${assetId} changed concurrently (another instance may be ` +
            `migrating); re-run 'assets:conflicts list' and try again.`,
    };
}
