/**
 * Tests for the asset storage layout migration (issue #2250).
 *
 * Covers the one-time (but idempotent, restart-safe) startup migration from
 * the legacy layout
 *
 *     FILES_DIR/assets/<projectUuid>/...        + absolute storage_path
 *
 * to the sharded layout
 *
 *     FILES_DIR/assets/<shard>/<projectUuid>/...  + FILES_DIR-relative storage_path
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { now } from '../db/types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import * as assetQueries from '../db/queries/assets';
import { getAssetShard, tryResolveAssetStoragePath } from '../utils/asset-paths';
import { migrateAssetStorage, type AssetStorageMigrationSummary } from './asset-storage-migration';

describe('asset-storage-migration', () => {
    let db: Kysely<Database>;
    let filesDir: string;
    let userId: number;
    let logMessages: string[];
    let warnMessages: string[];

    const PROJECT_UUID = 'ab12cd34-1234-4abc-8def-1234567890ab';
    const SHARD = getAssetShard(PROJECT_UUID); // 'ab'

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        userId = await seedTestUser(db);
        filesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-migration-test-'));
        logMessages = [];
        warnMessages = [];
    });

    async function runMigration(overrides: Record<string, unknown> = {}): Promise<AssetStorageMigrationSummary> {
        return migrateAssetStorage({
            db,
            getFilesDir: () => filesDir,
            log: (message: string) => logMessages.push(message),
            warn: (message: string) => warnMessages.push(message),
            ...overrides,
        });
    }

    async function seedProject(uuid: string = PROJECT_UUID): Promise<number> {
        return seedTestProject(db, userId, { uuid, title: `Project ${uuid}` });
    }

    async function writeLegacyFile(uuid: string, relSegments: string[], content: string): Promise<string> {
        const abs = path.join(filesDir, 'assets', uuid, ...relSegments);
        await fs.ensureDir(path.dirname(abs));
        await fs.writeFile(abs, content);
        return abs;
    }

    async function seedLegacyAsset(
        projectId: number,
        uuid: string,
        relSegments: string[],
        content: string,
        overrides: Record<string, unknown> = {},
    ) {
        const abs = await writeLegacyFile(uuid, relSegments, content);
        return assetQueries.createAsset(db, {
            project_id: projectId,
            filename: relSegments[relSegments.length - 1],
            storage_path: abs,
            mime_type: 'application/octet-stream',
            file_size: String(content.length),
            client_id: relSegments[0].replace(/\..*$/, ''),
            folder_path: '',
            ...overrides,
        });
    }

    function shardedPath(uuid: string, ...relSegments: string[]): string {
        return path.join(filesDir, 'assets', getAssetShard(uuid), uuid, ...relSegments);
    }

    // =========================================================================
    // Normal migration
    // =========================================================================

    it('migrates a flat legacy asset: moves the file and rewrites the row to a relative path', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['client-1.png'], 'flat bytes');

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(1);
        expect(summary.rewrittenRows).toBe(1);
        expect(summary.errors).toBe(0);

        // File moved to the sharded location; legacy location gone.
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'client-1.png'))).toBe(true);
        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID, 'client-1.png'))).toBe(false);
        expect((await fs.readFile(shardedPath(PROJECT_UUID, 'client-1.png'))).toString()).toBe('flat bytes');

        // Row rewritten to the canonical relative representation.
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/client-1.png`);
        expect(path.isAbsolute(row!.storage_path)).toBe(false);

        // The rewritten row resolves through the shared resolver.
        expect(tryResolveAssetStoragePath(filesDir, row!.storage_path)).toBe(shardedPath(PROJECT_UUID, 'client-1.png'));
    });

    it('migrates the nested ZIP-extraction layout (clientId/filename)', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['client-zip-1', 'index.html'], '<html></html>');

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(1);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'client-zip-1', 'index.html'))).toBe(true);

        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/client-zip-1/index.html`);
    });

    it('empties and removes the legacy project directory after migration', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['client-1.png'], 'a');
        await seedLegacyAsset(projectId, PROJECT_UUID, ['client-2', 'page.html'], 'b');

        await runMigration();

        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID))).toBe(false);
    });

    it('migrates filenames containing spaces, parentheses and unicode', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(
            projectId,
            PROJECT_UUID,
            ['client-x', 'imágen ñ (copy 2).png'],
            'unicode bytes',
        );

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(1);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/client-x/imágen ñ (copy 2).png`);
        const resolved = tryResolveAssetStoragePath(filesDir, row!.storage_path);
        expect(resolved).not.toBeNull();
        expect((await fs.readFile(resolved!)).toString()).toBe('unicode bytes');
    });

    it('migrates multiple projects in one run', async () => {
        const uuidB = 'ffe0d5aa-d8d2-4a7b-bf6d-c809321ccc2a';
        const projectA = await seedProject();
        const projectB = await seedProject(uuidB);
        await seedLegacyAsset(projectA, PROJECT_UUID, ['a.png'], 'aa');
        await seedLegacyAsset(projectB, uuidB, ['b.png'], 'bb', { client_id: 'b-client' });

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(2);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'a.png'))).toBe(true);
        expect(await fs.pathExists(shardedPath(uuidB, 'b.png'))).toBe(true);
    });

    it('processes rows in bounded batches', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['batch-1.png'], '1', { client_id: 'c1' });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['batch-2.png'], '2', { client_id: 'c2' });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['batch-3.png'], '3', { client_id: 'c3' });

        const summary = await runMigration({ batchSize: 1 });

        expect(summary.movedFiles).toBe(3);
        expect(summary.rewrittenRows).toBe(3);
    });

    it('migrates a numeric legacy directory (rows written via numeric project id URLs)', async () => {
        const projectId = await seedProject();
        // Legacy quirk: uploads addressed by numeric id created assets/<numericId>/.
        const abs = path.join(filesDir, 'assets', String(projectId), 'client-n.png');
        await fs.ensureDir(path.dirname(abs));
        await fs.writeFile(abs, 'numeric dir bytes');
        const asset = await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'client-n.png',
            storage_path: abs,
            mime_type: 'image/png',
            file_size: '17',
            client_id: 'client-n',
            folder_path: '',
        });

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(1);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/client-n.png`);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'client-n.png'))).toBe(true);
    });

    // =========================================================================
    // Idempotency / resumability
    // =========================================================================

    it('is idempotent: a second run makes no changes', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['idem.png'], 'idem');

        await runMigration();
        const second = await runMigration();

        expect(second.scannedRows).toBe(0);
        expect(second.movedFiles).toBe(0);
        expect(second.rewrittenRows).toBe(0);
        expect(second.errors).toBe(0);
    });

    it('reconciles a row whose file was already moved (crash between move and rewrite)', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['half.png'], 'half');
        // Simulate the interrupted state: file at destination, row still legacy.
        const dest = shardedPath(PROJECT_UUID, 'half.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.move(path.join(filesDir, 'assets', PROJECT_UUID, 'half.png'), dest);

        const summary = await runMigration();

        expect(summary.alreadyMigrated).toBe(1);
        expect(summary.rewrittenRows).toBe(1);
        expect(summary.movedFiles).toBe(0);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/half.png`);
    });

    it('continues a partially migrated project (some rows migrated, some not)', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['done.png'], 'done', { client_id: 'done-c' });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['todo.png'], 'todo', { client_id: 'todo-c' });

        // Fully migrate the first asset by hand (file + row).
        const dest = shardedPath(PROJECT_UUID, 'done.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.move(path.join(filesDir, 'assets', PROJECT_UUID, 'done.png'), dest);
        const doneRow = await assetQueries.findAssetByClientId(db, 'done-c', projectId);
        await db
            .updateTable('assets')
            .set({ storage_path: `assets/${SHARD}/${PROJECT_UUID}/done.png` })
            .where('id', '=', doneRow!.id)
            .execute();

        const summary = await runMigration();

        expect(summary.scannedRows).toBe(1);
        expect(summary.movedFiles).toBe(1);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'todo.png'))).toBe(true);
    });

    it('rewrites a row that already points at the sharded location with an absolute path', async () => {
        const projectId = await seedProject();
        const dest = shardedPath(PROJECT_UUID, 'abs-sharded.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'abs sharded');
        const asset = await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'abs-sharded.png',
            storage_path: dest,
            mime_type: 'image/png',
            file_size: '11',
            client_id: 'abs-sharded',
            folder_path: '',
        });

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(0);
        expect(summary.rewrittenRows).toBe(1);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/abs-sharded.png`);
        expect(await fs.pathExists(dest)).toBe(true);
    });

    // =========================================================================
    // Missing files and conflicts
    // =========================================================================

    it('logs missing source files and continues instead of aborting', async () => {
        const projectId = await seedProject();
        const missing = await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'ghost.png',
            storage_path: path.join(filesDir, 'assets', PROJECT_UUID, 'ghost.png'),
            mime_type: 'image/png',
            file_size: '0',
            client_id: 'ghost',
            folder_path: '',
        });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['real.png'], 'real', { client_id: 'real-c' });

        const summary = await runMigration();

        expect(summary.missingFiles).toBe(1);
        expect(summary.movedFiles).toBe(1);
        expect(summary.errors).toBe(0);

        // The missing row is still rewritten so the table converges.
        const row = await assetQueries.findAssetById(db, missing.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/ghost.png`);
        expect(warnMessages.join('\n')).toContain('ghost.png');
    });

    it('removes the legacy copy when source and destination are identical', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['same.png'], 'identical bytes');
        const dest = shardedPath(PROJECT_UUID, 'same.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'identical bytes');

        const summary = await runMigration();

        expect(summary.conflicts).toBe(0);
        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID, 'same.png'))).toBe(false);
        expect(await fs.pathExists(dest)).toBe(true);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/same.png`);
    });

    it('never overwrites when source and destination differ: keeps both and reports the conflict', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['conflict.png'], 'legacy content');
        const dest = shardedPath(PROJECT_UUID, 'conflict.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'different content');

        const summary = await runMigration();

        expect(summary.conflicts).toBe(1);
        // Both files survive untouched.
        const legacyFile = path.join(filesDir, 'assets', PROJECT_UUID, 'conflict.png');
        expect((await fs.readFile(legacyFile)).toString()).toBe('legacy content');
        expect((await fs.readFile(dest)).toString()).toBe('different content');
        // The row is rewritten to the portable relative form of the legacy
        // location, so it keeps pointing at the file it pointed at before.
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${PROJECT_UUID}/conflict.png`);
        expect(tryResolveAssetStoragePath(filesDir, row!.storage_path)).toBe(legacyFile);
        // The warning must carry both absolute paths and both sizes so the
        // operator can decide without hunting for the files (issue #2287).
        const conflictWarn = warnMessages.find(message => message.includes('Conflict for asset'));
        expect(conflictWarn).toContain(legacyFile);
        expect(conflictWarn).toContain(dest);
        expect(conflictWarn).toContain(`(${'legacy content'.length} bytes)`);
        expect(conflictWarn).toContain(`(${'different content'.length} bytes)`);
        expect(conflictWarn).toContain('assets:conflicts');
    });

    it('reports sweep conflicts with both absolute paths and sizes, keeping both files', async () => {
        await seedProject();
        // Orphan file (no database row) in the legacy directory, with a
        // DIFFERENT file already at the sharded destination.
        const orphanSrc = await writeLegacyFile(PROJECT_UUID, ['sweep-conflict.png'], 'orphan bytes');
        const dest = shardedPath(PROJECT_UUID, 'sweep-conflict.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'existing different bytes');

        const summary = await runMigration();

        expect(summary.conflicts).toBe(1);
        expect((await fs.readFile(orphanSrc)).toString()).toBe('orphan bytes');
        expect((await fs.readFile(dest)).toString()).toBe('existing different bytes');
        const sweepWarn = warnMessages.find(message => message.includes('Conflict sweeping'));
        expect(sweepWarn).toContain(orphanSrc);
        expect(sweepWarn).toContain(dest);
        expect(sweepWarn).toContain(`(${'orphan bytes'.length} bytes)`);
        expect(sweepWarn).toContain(`(${'existing different bytes'.length} bytes)`);
        // Sweep conflicts have no database row, so the assets:conflicts CLI
        // cannot resolve them; the warning must say WHY it is manual instead
        // of looking inconsistent with the phase 1 conflict warning.
        expect(sweepWarn).toContain('No database row references this file');
    });

    // =========================================================================
    // Parked conflict rows (assets/<uuid>/... written by the conflict branch)
    // =========================================================================

    async function seedParkedRow(projectId: number, filename: string) {
        return assetQueries.createAsset(db, {
            project_id: projectId,
            filename,
            storage_path: `assets/${PROJECT_UUID}/${filename}`,
            mime_type: 'application/octet-stream',
            file_size: '0',
            client_id: filename.replace(/\..*$/, ''),
            folder_path: '',
        });
    }

    it('converges a parked row whose legacy copy is gone (interrupted keep-new resolution)', async () => {
        const projectId = await seedProject();
        const asset = await seedParkedRow(projectId, 'parked-new.png');
        // Crash state after `assets:conflicts resolve --keep-new`: the legacy
        // copy was removed but the row was not rewritten yet.
        const dest = shardedPath(PROJECT_UUID, 'parked-new.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'kept canonical bytes');

        const summary = await runMigration();

        expect(summary.alreadyMigrated).toBe(1);
        expect(summary.rewrittenRows).toBe(1);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/parked-new.png`);
    });

    it('completes an interrupted keep-old resolution: parked row with a free destination', async () => {
        const projectId = await seedProject();
        const asset = await seedParkedRow(projectId, 'parked-old.png');
        // Crash state after `assets:conflicts resolve --keep-old` removed the
        // canonical copy but before the legacy copy was moved into its place.
        await writeLegacyFile(PROJECT_UUID, ['parked-old.png'], 'kept legacy bytes');

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(1);
        expect(summary.rewrittenRows).toBe(1);
        const dest = shardedPath(PROJECT_UUID, 'parked-old.png');
        expect((await fs.readFile(dest)).toString()).toBe('kept legacy bytes');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/parked-old.png`);
    });

    it('re-reports an unresolved parked conflict on every run without rewriting the row', async () => {
        const projectId = await seedProject();
        const asset = await seedParkedRow(projectId, 'parked-live.png');
        await writeLegacyFile(PROJECT_UUID, ['parked-live.png'], 'legacy content');
        const dest = shardedPath(PROJECT_UUID, 'parked-live.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'different content');
        const before = await assetQueries.findAssetById(db, asset.id);

        const summary = await runMigration();

        expect(summary.conflicts).toBe(1);
        // No churn: the row already holds the parked value, so it must not be
        // rewritten (updated_at untouched) just to re-report the conflict.
        expect(summary.rewrittenRows).toBe(0);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${PROJECT_UUID}/parked-live.png`);
        expect(row!.updated_at).toEqual(before!.updated_at);
        // Both copies survive and the operator is pointed at the CLI.
        expect((await fs.readFile(path.join(filesDir, 'assets', PROJECT_UUID, 'parked-live.png'))).toString()).toBe(
            'legacy content',
        );
        expect((await fs.readFile(dest)).toString()).toBe('different content');
        expect(warnMessages.find(message => message.includes('Conflict for asset'))).toContain('assets:conflicts');
    });

    it('skips migration when parked rows exist but the assets root is missing (unmounted volume)', async () => {
        const projectId = await seedProject();
        const asset = await seedParkedRow(projectId, 'parked-unmounted.png');
        // No file is written: filesDir/assets does not exist at all. Without
        // the safety latch the row would be "missing" on both sides and get
        // rewritten to the sharded target, losing its parked pointer.
        const summary = await runMigration();

        expect(summary.scannedRows).toBe(0);
        expect(summary.rewrittenRows).toBe(0);
        expect(warnMessages.join('\n')).toContain('assets root');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${PROJECT_UUID}/parked-unmounted.png`);
    });

    // =========================================================================
    // Safety
    // =========================================================================

    it('skips rows whose stored path cannot be interpreted, without touching the filesystem', async () => {
        const projectId = await seedProject();
        await fs.ensureDir(path.join(filesDir, 'assets')); // storage is mounted
        await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'weird.bin',
            storage_path: '/etc/passwd',
            mime_type: 'application/octet-stream',
            file_size: '0',
            client_id: 'weird',
            folder_path: '',
        });

        const summary = await runMigration();

        expect(summary.skippedRows).toBe(1);
        expect(summary.movedFiles).toBe(0);
        expect(warnMessages.length).toBeGreaterThan(0);
        // The row is left untouched for the operator to inspect.
        const row = await assetQueries.findAssetByClientId(db, 'weird', projectId);
        expect(row!.storage_path).toBe('/etc/passwd');
    });

    it('rejects traversal attempts embedded in stored paths', async () => {
        const projectId = await seedProject();
        await fs.ensureDir(path.join(filesDir, 'assets')); // storage is mounted
        await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'evil.png',
            storage_path: `/mnt/data/assets/${PROJECT_UUID}/../../../etc/passwd`,
            mime_type: 'image/png',
            file_size: '0',
            client_id: 'evil',
            folder_path: '',
        });

        const summary = await runMigration();

        expect(summary.skippedRows).toBe(1);
        expect(summary.movedFiles).toBe(0);
        const row = await assetQueries.findAssetByClientId(db, 'evil', projectId);
        expect(row!.storage_path).toContain('..');
    });

    it('falls back to copy+verify+remove when rename fails with EXDEV', async () => {
        const projectId = await seedProject();
        const asset = await seedLegacyAsset(projectId, PROJECT_UUID, ['xdev.png'], 'cross-device bytes');

        // Simulate a cross-device boundary: the first rename of the real file
        // fails with EXDEV; the temp-file rename that finalizes the copy is
        // allowed through.
        let exdevThrown = false;
        const fsWithExdev = {
            ...fs,
            rename: async (src: string, dest: string) => {
                if (!exdevThrown && !src.includes('.migrate-tmp-')) {
                    exdevThrown = true;
                    const err = new Error('EXDEV: cross-device link not permitted') as NodeJS.ErrnoException;
                    err.code = 'EXDEV';
                    throw err;
                }
                return fs.rename(src, dest);
            },
        } as typeof fs;

        const summary = await runMigration({ fs: fsWithExdev });

        expect(exdevThrown).toBe(true);
        expect(summary.movedFiles).toBe(1);
        expect(summary.errors).toBe(0);
        expect((await fs.readFile(shardedPath(PROJECT_UUID, 'xdev.png'))).toString()).toBe('cross-device bytes');
        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID, 'xdev.png'))).toBe(false);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/xdev.png`);
    });

    // =========================================================================
    // Orphan sweep (files on disk without database rows)
    // =========================================================================

    it('sweeps orphaned files from a legacy project directory into the sharded layout', async () => {
        await seedProject();
        await writeLegacyFile(PROJECT_UUID, ['orphan.css'], 'orphan bytes');

        const summary = await runMigration();

        expect(summary.orphanedFilesMoved).toBe(1);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'orphan.css'))).toBe(true);
        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID))).toBe(false);
    });

    it('removes an empty legacy project directory', async () => {
        await seedProject();
        await fs.ensureDir(path.join(filesDir, 'assets', PROJECT_UUID));

        const summary = await runMigration();

        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID))).toBe(false);
        expect(summary.errors).toBe(0);
    });

    it('leaves unrecognized entries in the assets root untouched', async () => {
        await seedProject();
        const strayDir = path.join(filesDir, 'assets', 'not-a-project-dir');
        await fs.ensureDir(strayDir);
        await fs.writeFile(path.join(strayDir, 'stray.txt'), 'stray');
        const strayFile = path.join(filesDir, 'assets', 'loose-file.txt');
        await fs.writeFile(strayFile, 'loose');

        const summary = await runMigration();

        expect(summary.skippedEntries).toBe(2);
        expect(await fs.pathExists(path.join(strayDir, 'stray.txt'))).toBe(true);
        expect(await fs.pathExists(strayFile)).toBe(true);
    });

    it('does not descend into shard bucket directories during the sweep', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['once.png'], 'once');

        await runMigration();
        const second = await runMigration();

        // The sharded content produced by the first run is not re-processed.
        expect(second.orphanedFilesMoved).toBe(0);
        expect(second.skippedEntries).toBe(0);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'once.png'))).toBe(true);
    });

    it('sweeps a two-digit legacy numeric directory (project ids 10-99) that is not a real bucket', async () => {
        // Force a two-digit project id so the legacy directory name collides
        // with the two-hex shard bucket namespace.
        const projectId = await seedProject();
        await db.updateTable('projects').set({ id: 42 }).where('id', '=', projectId).execute();

        const orphan = path.join(filesDir, 'assets', '42', 'orphan.png');
        await fs.ensureDir(path.dirname(orphan));
        await fs.writeFile(orphan, 'numeric orphan');

        const summary = await runMigration();

        expect(summary.orphanedFilesMoved).toBe(1);
        expect(await fs.pathExists(shardedPath(PROJECT_UUID, 'orphan.png'))).toBe(true);
        expect(await fs.pathExists(path.join(filesDir, 'assets', '42'))).toBe(false);
    });

    it('does not mistake a genuine two-digit shard bucket for a legacy numeric directory', async () => {
        const projectId = await seedProject();
        await db.updateTable('projects').set({ id: 42 }).where('id', '=', projectId).execute();

        // A real bucket '42' containing a project directory that shards to '42'.
        const bucketUuid = '42aabbcc-1234-4abc-8def-1234567890ab';
        const inBucket = path.join(filesDir, 'assets', '42', bucketUuid, 'f.png');
        await fs.ensureDir(path.dirname(inBucket));
        await fs.writeFile(inBucket, 'sharded bytes');

        const summary = await runMigration();

        expect(summary.orphanedFilesMoved).toBe(0);
        expect(await fs.pathExists(inBucket)).toBe(true);
    });

    it('skips migration entirely when legacy rows exist but the assets root is missing (unmounted volume)', async () => {
        const projectId = await seedProject();
        const row = await assetQueries.createAsset(db, {
            project_id: projectId,
            filename: 'unmounted.png',
            storage_path: `/mnt/data/assets/${PROJECT_UUID}/unmounted.png`,
            mime_type: 'image/png',
            file_size: '4',
            client_id: 'unmounted',
            folder_path: '',
        });
        // No file is written: filesDir/assets does not exist at all.

        const summary = await runMigration();

        expect(summary.scannedRows).toBe(0);
        expect(summary.rewrittenRows).toBe(0);
        expect(summary.missingFiles).toBe(0);
        expect(warnMessages.join('\n')).toContain('assets root');
        // The row keeps its original pointer for the next (mounted) startup.
        const after = await assetQueries.findAssetById(db, row.id);
        expect(after!.storage_path).toBe(`/mnt/data/assets/${PROJECT_UUID}/unmounted.png`);
    });

    // =========================================================================
    // Progress logging
    // =========================================================================

    /**
     * Bulk-insert legacy asset rows WITHOUT files on disk. The missing-file
     * path is the cheapest way to drive row volume through phase 1: every row
     * is scanned, counted as missing and rewritten, with no filesystem moves.
     * Mirrors the column set used by assetQueries.createAsset (timestamps
     * included) so the rows are valid for every dialect.
     */
    async function bulkInsertLegacyAssets(projectId: number, count: number): Promise<void> {
        const timestamp = now();
        const rows = Array.from({ length: count }, (_, i) => ({
            project_id: projectId,
            filename: `bulk-${i}.png`,
            storage_path: path.join(filesDir, 'assets', PROJECT_UUID, `bulk-${i}.png`),
            mime_type: 'image/png',
            file_size: '0',
            client_id: `bulk-client-${i}`,
            folder_path: '',
            created_at: timestamp,
            updated_at: timestamp,
        }));
        const chunkSize = 500;
        for (let offset = 0; offset < rows.length; offset += chunkSize) {
            await db
                .insertInto('assets')
                .values(rows.slice(offset, offset + chunkSize))
                .execute();
        }
    }

    it('emits a progress line every 1,000 processed rows during a large migration', async () => {
        const projectId = await seedProject();
        // The assets root must exist or the missing-assets-root safety latch
        // skips the whole run.
        await fs.ensureDir(path.join(filesDir, 'assets'));
        await bulkInsertLegacyAssets(projectId, 1500);

        const summary = await runMigration();

        const progressLines = logMessages.filter(message => message.includes('Migration progress'));
        expect(progressLines).toEqual([
            '[AssetStorage] Migration progress: 1,000/1,500 legacy row(s) processed, 500 pending.',
        ]);
        expect(summary.scannedRows).toBe(1500);
        expect(summary.missingFiles).toBe(1500);
        expect(logMessages.join('\n')).toContain('Migration summary');
    });

    it('emits a progress line with zero pending at an exact interval boundary', async () => {
        const projectId = await seedProject();
        await fs.ensureDir(path.join(filesDir, 'assets'));
        await bulkInsertLegacyAssets(projectId, 1000);

        await runMigration();

        const progressLines = logMessages.filter(message => message.includes('Migration progress'));
        expect(progressLines).toEqual([
            '[AssetStorage] Migration progress: 1,000/1,000 legacy row(s) processed, 0 pending.',
        ]);
    });

    it('runs a single legacy-row query on a converged startup (the total count is lazy)', async () => {
        await seedProject();
        await fs.ensureDir(path.join(filesDir, 'assets'));

        let selectQueries = 0;
        const countingDb = new Proxy(db, {
            get(target, prop) {
                if (prop === 'selectFrom') {
                    return (...args: unknown[]) => {
                        selectQueries++;
                        return (target.selectFrom as (...a: unknown[]) => unknown).apply(target, args);
                    };
                }
                const value = Reflect.get(target, prop, target);
                return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
            },
        }) as Kysely<Database>;

        const summary = await runMigration({ db: countingDb });

        expect(summary.scannedRows).toBe(0);
        // Only the (empty) phase 1 batch query; the progress total COUNT must
        // not run when there is no legacy work.
        expect(selectQueries).toBe(1);
    });

    it('does not emit progress below the interval', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['small-1.png'], 'one', { client_id: 'small-1' });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['small-2.png'], 'two', { client_id: 'small-2' });

        const summary = await runMigration();

        expect(summary.movedFiles).toBe(2);
        expect(logMessages.filter(message => message.includes('Migration progress'))).toHaveLength(0);
        expect(logMessages.join('\n')).toContain('Migration summary');
    });

    it('does not emit progress on a converged installation', async () => {
        const projectId = await seedProject();
        await seedLegacyAsset(projectId, PROJECT_UUID, ['conv-1.png'], 'one', { client_id: 'conv-1' });
        await seedLegacyAsset(projectId, PROJECT_UUID, ['conv-2.png'], 'two', { client_id: 'conv-2' });
        await runMigration();

        // Second run over the converged installation.
        logMessages.length = 0;
        await runMigration();
        expect(logMessages.filter(message => message.includes('Migration progress'))).toHaveLength(0);
        expect(logMessages.join('\n')).toContain('up to date');

        // A completely fresh installation (no rows, no assets root) is silent too.
        await cleanTestDb(db);
        const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-migration-fresh-'));
        logMessages.length = 0;
        await runMigration({ getFilesDir: () => freshDir });
        expect(logMessages.filter(message => message.includes('Migration progress'))).toHaveLength(0);
        expect(logMessages.join('\n')).toContain('up to date');
    });

    // =========================================================================
    // No-op behavior
    // =========================================================================

    it('does nothing on a fresh installation (no assets root, no rows)', async () => {
        const summary = await runMigration();

        expect(summary.scannedRows).toBe(0);
        expect(summary.movedFiles).toBe(0);
        expect(summary.errors).toBe(0);
        // Lazy creation: the migration must not create the assets root.
        expect(await fs.pathExists(path.join(filesDir, 'assets'))).toBe(false);
    });

    it('does nothing for a project with no assets', async () => {
        await seedProject();

        const summary = await runMigration();

        expect(summary.scannedRows).toBe(0);
        expect(summary.movedFiles).toBe(0);
        expect(await fs.pathExists(path.join(filesDir, 'assets'))).toBe(false);
    });
});
