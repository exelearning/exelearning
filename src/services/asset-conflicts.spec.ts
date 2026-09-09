/**
 * Tests for the asset storage conflict service (issue #2287).
 *
 * A conflict is a row whose storage_path is not the canonical sharded form
 * AND whose current file and canonical destination both exist with different
 * content. The service lists such rows and resolves them only with an
 * explicit keep-old / keep-new operator choice.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import * as assetQueries from '../db/queries/assets';
import { getAssetShard } from '../utils/asset-paths';
import { migrateAssetStorage } from './asset-storage-migration';
import { listAssetStorageConflicts, resolveAssetStorageConflict } from './asset-conflicts';

describe('asset-conflicts', () => {
    let db: Kysely<Database>;
    let filesDir: string;
    let userId: number;

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
        filesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-conflicts-test-'));
    });

    function deps(overrides: Record<string, unknown> = {}) {
        return { db, getFilesDir: () => filesDir, ...overrides };
    }

    function legacyPath(uuid: string, ...relSegments: string[]): string {
        return path.join(filesDir, 'assets', uuid, ...relSegments);
    }

    function shardedPath(uuid: string, ...relSegments: string[]): string {
        return path.join(filesDir, 'assets', getAssetShard(uuid), uuid, ...relSegments);
    }

    async function seedProject(uuid: string = PROJECT_UUID): Promise<number> {
        return seedTestProject(db, userId, { uuid, title: `Project ${uuid}` });
    }

    async function seedAssetRow(projectId: number, storedPath: string, filename: string, clientId: string) {
        return assetQueries.createAsset(db, {
            project_id: projectId,
            filename,
            storage_path: storedPath,
            mime_type: 'application/octet-stream',
            file_size: '0',
            client_id: clientId,
            folder_path: '',
        });
    }

    /**
     * Seeds the canonical parked-conflict state produced by the startup
     * migration: a row pointing (relative form) at the legacy location, the
     * legacy file, and a DIFFERENT file at the sharded destination.
     */
    async function seedParkedConflict(
        filename = 'conflict.png',
        legacyContent = 'legacy content',
        canonicalContent = 'different content',
        clientId = 'conflict-c',
    ) {
        const projectId = await seedProject();
        const src = legacyPath(PROJECT_UUID, filename);
        await fs.ensureDir(path.dirname(src));
        await fs.writeFile(src, legacyContent);
        const dest = shardedPath(PROJECT_UUID, filename);
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, canonicalContent);
        const asset = await seedAssetRow(projectId, `assets/${PROJECT_UUID}/${filename}`, filename, clientId);
        return { projectId, asset, src, dest };
    }

    // =========================================================================
    // Listing
    // =========================================================================

    it('returns no conflicts on a fresh installation', async () => {
        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('returns no conflicts when every row is canonical', async () => {
        const projectId = await seedProject();
        const dest = shardedPath(PROJECT_UUID, 'ok.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'ok bytes');
        await seedAssetRow(projectId, `assets/${SHARD}/${PROJECT_UUID}/ok.png`, 'ok.png', 'ok-c');

        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('lists a parked conflict with both absolute paths, sizes and mtimes', async () => {
        const { asset, src, dest } = await seedParkedConflict();

        const conflicts = await listAssetStorageConflicts(deps());

        expect(conflicts).toHaveLength(1);
        const conflict = conflicts[0];
        expect(conflict.assetId).toBe(asset.id);
        expect(conflict.projectUuid).toBe(PROJECT_UUID);
        expect(conflict.filename).toBe('conflict.png');
        expect(conflict.storedPath).toBe(`assets/${PROJECT_UUID}/conflict.png`);
        expect(conflict.canonicalStoredPath).toBe(`assets/${SHARD}/${PROJECT_UUID}/conflict.png`);
        expect(conflict.legacyPath).toBe(src);
        expect(conflict.canonicalPath).toBe(dest);
        expect(conflict.legacySize).toBe('legacy content'.length);
        expect(conflict.canonicalSize).toBe('different content'.length);
        expect(Date.parse(conflict.legacyMtime)).not.toBeNaN();
        expect(Date.parse(conflict.canonicalMtime)).not.toBeNaN();
    });

    it('lists a conflict for a legacy absolute row as well', async () => {
        const projectId = await seedProject();
        const src = legacyPath(PROJECT_UUID, 'abs.png');
        await fs.ensureDir(path.dirname(src));
        await fs.writeFile(src, 'old bytes');
        const dest = shardedPath(PROJECT_UUID, 'abs.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'newer bytes!');
        await seedAssetRow(projectId, src, 'abs.png', 'abs-c');

        const conflicts = await listAssetStorageConflicts(deps());

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].legacyPath).toBe(src);
        expect(conflicts[0].canonicalPath).toBe(dest);
    });

    it('does not list rows whose destination is free (normal migration territory)', async () => {
        const projectId = await seedProject();
        const src = legacyPath(PROJECT_UUID, 'pending.png');
        await fs.ensureDir(path.dirname(src));
        await fs.writeFile(src, 'pending bytes');
        await seedAssetRow(projectId, `assets/${PROJECT_UUID}/pending.png`, 'pending.png', 'pending-c');

        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('does not list rows whose two copies are identical', async () => {
        const { src, dest } = await seedParkedConflict('same.png', 'same bytes', 'same bytes', 'same-c');
        expect(await fs.pathExists(src)).toBe(true);
        expect(await fs.pathExists(dest)).toBe(true);

        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('does not list an absolute row that already points at the sharded location', async () => {
        const projectId = await seedProject();
        const dest = shardedPath(PROJECT_UUID, 'abs-sharded.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'abs sharded bytes');
        await seedAssetRow(projectId, dest, 'abs-sharded.png', 'abs-sharded-c');

        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('does not list uninterpretable rows', async () => {
        const projectId = await seedProject();
        await seedAssetRow(projectId, '/etc/passwd', 'passwd', 'weird-c');

        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('paginates candidates in bounded batches', async () => {
        const projectId = await seedProject();
        for (const name of ['a.png', 'b.png', 'c.png']) {
            const src = legacyPath(PROJECT_UUID, name);
            await fs.ensureDir(path.dirname(src));
            await fs.writeFile(src, `legacy ${name}`);
            const dest = shardedPath(PROJECT_UUID, name);
            await fs.ensureDir(path.dirname(dest));
            await fs.writeFile(dest, `canonical ${name}!`);
            await seedAssetRow(projectId, `assets/${PROJECT_UUID}/${name}`, name, `c-${name}`);
        }

        const conflicts = await listAssetStorageConflicts(deps({ batchSize: 1 }));

        expect(conflicts).toHaveLength(3);
    });

    // =========================================================================
    // Resolution
    // =========================================================================

    it('keep-new removes the legacy copy and rewrites the row to the canonical location', async () => {
        const { asset, src, dest } = await seedParkedConflict();

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps());

        expect(result.success).toBe(true);
        expect(result.resolved).toBe(true);
        expect(await fs.pathExists(src)).toBe(false);
        expect((await fs.readFile(dest)).toString()).toBe('different content');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/conflict.png`);
        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('keep-old moves the legacy copy over the canonical location and rewrites the row', async () => {
        const { asset, src, dest } = await seedParkedConflict();

        const result = await resolveAssetStorageConflict(asset.id, 'keep-old', {}, deps());

        expect(result.success).toBe(true);
        expect(result.resolved).toBe(true);
        expect(await fs.pathExists(src)).toBe(false);
        expect((await fs.readFile(dest)).toString()).toBe('legacy content');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/conflict.png`);
        expect(await listAssetStorageConflicts(deps())).toEqual([]);
    });

    it('lets the installation converge after resolution (startup migration removes the legacy dir)', async () => {
        const { asset } = await seedParkedConflict();

        await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps());
        const summary = await migrateAssetStorage(deps({ log: () => {}, warn: () => {} }));

        expect(summary.conflicts).toBe(0);
        expect(summary.errors).toBe(0);
        expect(await fs.pathExists(path.join(filesDir, 'assets', PROJECT_UUID))).toBe(false);
    });

    it('dry-run reports the actions without touching files or rows', async () => {
        const { asset, src, dest } = await seedParkedConflict();

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', { dryRun: true }, deps());

        expect(result.success).toBe(true);
        expect(result.resolved).toBe(false);
        expect(result.message).toContain(src);
        expect(result.message).toContain(dest);
        expect((await fs.readFile(src)).toString()).toBe('legacy content');
        expect((await fs.readFile(dest)).toString()).toBe('different content');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${PROJECT_UUID}/conflict.png`);
    });

    it('converges identical copies safely (same rule as the startup migration)', async () => {
        const { asset, src, dest } = await seedParkedConflict('same.png', 'equal', 'equal', 'same-c');

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps());

        expect(result.success).toBe(true);
        expect(result.resolved).toBe(true);
        expect(result.message).toContain('identical');
        expect(await fs.pathExists(src)).toBe(false);
        expect((await fs.readFile(dest)).toString()).toBe('equal');
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${SHARD}/${PROJECT_UUID}/same.png`);
    });

    it('dry-run on identical copies reports the convergence without touching anything', async () => {
        const { asset, src, dest } = await seedParkedConflict('same.png', 'equal', 'equal', 'same-c');

        const result = await resolveAssetStorageConflict(asset.id, 'keep-old', { dryRun: true }, deps());

        expect(result.success).toBe(true);
        expect(result.resolved).toBe(false);
        expect(result.message).toContain('identical');
        expect(await fs.pathExists(src)).toBe(true);
        expect(await fs.pathExists(dest)).toBe(true);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe(`assets/${PROJECT_UUID}/same.png`);
    });

    it('refuses to resolve a row whose destination is free (startup migration territory)', async () => {
        const projectId = await seedProject();
        const src = legacyPath(PROJECT_UUID, 'pending.png');
        await fs.ensureDir(path.dirname(src));
        await fs.writeFile(src, 'pending bytes');
        const asset = await seedAssetRow(projectId, `assets/${PROJECT_UUID}/pending.png`, 'pending.png', 'pending-c');

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps());

        expect(result.success).toBe(false);
        expect(result.message).toContain('startup migration');
        expect((await fs.readFile(src)).toString()).toBe('pending bytes');
    });

    it('fails clearly for an unknown asset id', async () => {
        const result = await resolveAssetStorageConflict(99999, 'keep-new', {}, deps());

        expect(result.success).toBe(false);
        expect(result.message).toContain('99999');
    });

    it('fails clearly when the row is not an unresolved conflict', async () => {
        const projectId = await seedProject();
        const dest = shardedPath(PROJECT_UUID, 'ok.png');
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, 'ok');
        const asset = await seedAssetRow(projectId, `assets/${SHARD}/${PROJECT_UUID}/ok.png`, 'ok.png', 'ok-c');

        const result = await resolveAssetStorageConflict(asset.id, 'keep-old', {}, deps());

        expect(result.success).toBe(false);
        expect(result.resolved).toBe(false);
        expect(await fs.pathExists(dest)).toBe(true);
    });

    it('fails clearly for an uninterpretable row without touching anything', async () => {
        const projectId = await seedProject();
        const asset = await seedAssetRow(projectId, '/etc/passwd', 'passwd', 'weird-c');

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps());

        expect(result.success).toBe(false);
        const row = await assetQueries.findAssetById(db, asset.id);
        expect(row!.storage_path).toBe('/etc/passwd');
    });

    it('reports a concurrent row change instead of resolving blindly', async () => {
        const { asset, src, dest } = await seedParkedConflict();

        // Stub updateTable so the optimistic guard reports zero updated rows,
        // as if another instance had rewritten the row concurrently.
        const guardFailingDb = new Proxy(db, {
            get(target, prop) {
                if (prop === 'updateTable') {
                    const chain = {
                        set: () => chain,
                        where: () => chain,
                        execute: async () => [{ numUpdatedRows: BigInt(0) }],
                    };
                    return () => chain;
                }
                const value = Reflect.get(target, prop, target);
                return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
            },
        }) as Kysely<Database>;

        const result = await resolveAssetStorageConflict(asset.id, 'keep-new', {}, deps({ db: guardFailingDb }));

        expect(result.success).toBe(false);
        expect(result.message).toContain('concurrently');
        // keep-new removes the legacy file before rewriting; the canonical
        // copy must never be touched by a failed guard.
        expect(await fs.pathExists(src)).toBe(false);
        expect((await fs.readFile(dest)).toString()).toBe('different content');
    });
});
