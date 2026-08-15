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
        expect(warnMessages.join('\n')).toContain('conflict.png');
    });

    // =========================================================================
    // Safety
    // =========================================================================

    it('skips rows whose stored path cannot be interpreted, without touching the filesystem', async () => {
        const projectId = await seedProject();
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
