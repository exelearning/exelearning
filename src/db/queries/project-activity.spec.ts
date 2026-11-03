/**
 * Project activity queries — real isolated SQLite database.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../../test/helpers/test-db';
import {
    countProjectActivity,
    deleteProjectActivityBefore,
    deleteProjectActivityForProject,
    findLatestProjectActivityForCoalesce,
    findUserEmailsByIds,
    hasProjectActivityDedupeKey,
    hasProjectSessionOpened,
    incrementProjectActivity,
    insertProjectActivity,
    listProjectActivity,
    listProjectActivityActors,
} from './project-activity';
import { deleteProjectWithRelatedData } from './projects';

describe('project activity queries', () => {
    let db: Kysely<Database>;
    let ownerId: number;
    let editorId: number;
    let projectId: number;
    let otherProjectId: number;
    let seq = 0;

    beforeAll(async () => {
        db = await createTestDb();
        await sql`PRAGMA foreign_keys = ON`.execute(db);
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        ownerId = await seedTestUser(db, { email: `owner-${Date.now()}@test.local` });
        editorId = await seedTestUser(db, { email: `editor-${Date.now()}@test.local`, user_id: `e-${Date.now()}` });
        projectId = await seedTestProject(db, ownerId, { uuid: `uuid-a-${Date.now()}` });
        otherProjectId = await seedTestProject(db, ownerId, { uuid: `uuid-b-${Date.now()}` });
    });

    function event(overrides: Partial<Parameters<typeof insertProjectActivity>[1]> = {}) {
        const at = 1_700_000_000_000 + seq++ * 1000;
        return {
            project_id: projectId,
            user_id: ownerId,
            event_type: 'page.edited',
            target_type: 'page',
            target_id: 'page-1',
            target_label: 'Intro',
            details: null,
            session_id: null,
            dedupe_key: null,
            first_occurred_at: at,
            occurred_at: at,
            created_at: at,
            ...overrides,
        };
    }

    it('inserts rows and reads them back with the actor email', async () => {
        const id = await insertProjectActivity(db, event());
        expect(typeof id).toBe('number');
        const { rows, nextCursor } = await listProjectActivity(db, projectId, { limit: 10 });
        expect(rows).toHaveLength(1);
        expect(rows[0].actor_email).toContain('owner-');
        expect(rows[0].event_count).toBe(1);
        expect(nextCursor).toBeNull();
    });

    it('orders newest first and paginates with a stable keyset cursor', async () => {
        const base = 1_700_000_000_000;
        // Two rows share the same timestamp to exercise the id tie-breaker.
        await insertProjectActivity(db, event({ occurred_at: base, first_occurred_at: base, target_id: 'a' }));
        await insertProjectActivity(db, event({ occurred_at: base, first_occurred_at: base, target_id: 'b' }));
        await insertProjectActivity(db, event({ occurred_at: base + 5, first_occurred_at: base + 5, target_id: 'c' }));
        await insertProjectActivity(db, event({ occurred_at: base + 9, first_occurred_at: base + 9, target_id: 'd' }));
        await insertProjectActivity(db, event({ project_id: otherProjectId, target_id: 'other' }));

        const page1 = await listProjectActivity(db, projectId, { limit: 2 });
        expect(page1.rows.map(r => r.target_id)).toEqual(['d', 'c']);
        expect(page1.nextCursor).not.toBeNull();

        const page2 = await listProjectActivity(db, projectId, { limit: 2, cursor: page1.nextCursor! });
        expect(page2.rows.map(r => r.target_id)).toEqual(['b', 'a']);
        expect(page2.nextCursor).toBeNull();

        // Inserting a newer row never disturbs an older page.
        await insertProjectActivity(
            db,
            event({ occurred_at: base + 20, first_occurred_at: base + 20, target_id: 'e' }),
        );
        const page2Again = await listProjectActivity(db, projectId, { limit: 2, cursor: page1.nextCursor! });
        expect(page2Again.rows.map(r => r.target_id)).toEqual(['b', 'a']);
    });

    it('filters by actor and by inclusive/exclusive time bounds', async () => {
        const base = 1_700_000_000_000;
        await insertProjectActivity(db, event({ user_id: ownerId, occurred_at: base, first_occurred_at: base }));
        await insertProjectActivity(
            db,
            event({ user_id: editorId, occurred_at: base + 10, first_occurred_at: base + 10 }),
        );
        await insertProjectActivity(
            db,
            event({ user_id: editorId, occurred_at: base + 20, first_occurred_at: base + 20 }),
        );

        const byEditor = await listProjectActivity(db, projectId, { limit: 10, userId: editorId });
        expect(byEditor.rows).toHaveLength(2);

        const window = await listProjectActivity(db, projectId, { limit: 10, since: base + 10, until: base + 20 });
        expect(window.rows).toHaveLength(1);
        expect(Number(window.rows[0].occurred_at)).toBe(base + 10);

        const empty = await listProjectActivity(db, projectId, { limit: 10, since: base + 100 });
        expect(empty.rows).toEqual([]);
        expect(empty.nextCursor).toBeNull();
    });

    it('lists distinct actors including deleted accounts as null', async () => {
        await insertProjectActivity(db, event({ user_id: ownerId }));
        await insertProjectActivity(db, event({ user_id: editorId }));
        await insertProjectActivity(db, event({ user_id: editorId }));
        await db.deleteFrom('users').where('id', '=', editorId).execute();

        const actors = await listProjectActivityActors(db, projectId);
        expect(actors).toHaveLength(2);
        expect(actors.some(a => a.user_id === ownerId && a.email?.includes('owner-'))).toBe(true);
        expect(actors.some(a => a.user_id === null && a.email === null)).toBe(true);

        const rows = (await listProjectActivity(db, projectId, { limit: 10 })).rows;
        expect(rows.filter(r => r.user_id === null)).toHaveLength(2);
    });

    it('detects dedupe keys per project only', async () => {
        await insertProjectActivity(db, event({ dedupe_key: 's1:1' }));
        expect(await hasProjectActivityDedupeKey(db, projectId, 's1:1')).toBe(true);
        expect(await hasProjectActivityDedupeKey(db, projectId, 's1:2')).toBe(false);
        expect(await hasProjectActivityDedupeKey(db, otherProjectId, 's1:1')).toBe(false);
        // The same key is legal in another project.
        await insertProjectActivity(db, event({ project_id: otherProjectId, dedupe_key: 's1:1' }));
        expect(await countProjectActivity(db, otherProjectId)).toBe(1);
    });

    it('coalesces repeated automatic saves through find + increment', async () => {
        const base = 1_700_000_000_000;
        const id = await insertProjectActivity(
            db,
            event({
                event_type: 'save.autosave',
                target_type: 'project',
                target_id: null,
                occurred_at: base,
                first_occurred_at: base,
            }),
        );
        const found = await findLatestProjectActivityForCoalesce(db, projectId, ownerId, 'save.autosave', base - 1000);
        expect(found?.id).toBe(id);
        expect(
            await findLatestProjectActivityForCoalesce(db, projectId, ownerId, 'save.autosave', base + 1),
        ).toBeUndefined();
        expect(
            await findLatestProjectActivityForCoalesce(db, projectId, editorId, 'save.autosave', base - 1000),
        ).toBeUndefined();
        expect(
            await findLatestProjectActivityForCoalesce(db, projectId, ownerId, 'save.manual', base - 1000),
        ).toBeUndefined();

        expect(await incrementProjectActivity(db, id!, base + 500, '{"documentVersion":"2"}')).toBe(true);
        expect(await incrementProjectActivity(db, 999_999, base + 500, null)).toBe(false);
        const row = (await listProjectActivity(db, projectId, { limit: 1 })).rows[0];
        expect(row.event_count).toBe(2);
        expect(Number(row.occurred_at)).toBe(base + 500);
        expect(Number(row.first_occurred_at)).toBe(base);
        expect(row.details).toBe('{"documentVersion":"2"}');
    });

    it('remembers opened sessions per project, user and session id', async () => {
        await insertProjectActivity(
            db,
            event({
                event_type: 'session.opened',
                target_type: 'project',
                target_id: null,
                session_id: 'sess-aaaaaaaa',
            }),
        );
        expect(await hasProjectSessionOpened(db, projectId, ownerId, 'sess-aaaaaaaa')).toBe(true);
        expect(await hasProjectSessionOpened(db, projectId, ownerId, 'sess-bbbbbbbb')).toBe(false);
        expect(await hasProjectSessionOpened(db, projectId, editorId, 'sess-aaaaaaaa')).toBe(false);
        expect(await hasProjectSessionOpened(db, otherProjectId, ownerId, 'sess-aaaaaaaa')).toBe(false);
    });

    it('resolves target user emails in one query', async () => {
        const map = await findUserEmailsByIds(db, [ownerId, editorId, 424242]);
        expect(map.get(ownerId)).toContain('owner-');
        expect(map.get(editorId)).toContain('editor-');
        expect(map.has(424242)).toBe(false);
        expect((await findUserEmailsByIds(db, [])).size).toBe(0);
    });

    it('prunes old rows in bounded batches and leaves newer rows alone', async () => {
        const base = 1_700_000_000_000;
        for (let i = 0; i < 5; i++) {
            await insertProjectActivity(db, event({ occurred_at: base + i, first_occurred_at: base + i }));
        }
        await insertProjectActivity(db, event({ occurred_at: base + 1000, first_occurred_at: base + 1000 }));

        expect(await deleteProjectActivityBefore(db, base + 100, 2)).toBe(2);
        expect(await deleteProjectActivityBefore(db, base + 100, 2)).toBe(2);
        expect(await deleteProjectActivityBefore(db, base + 100, 2)).toBe(1);
        expect(await deleteProjectActivityBefore(db, base + 100, 2)).toBe(0);
        expect(await countProjectActivity(db, projectId)).toBe(1);
    });

    it('is removed by the explicit project cleanup and by the FK cascade', async () => {
        await insertProjectActivity(db, event());
        await insertProjectActivity(db, event({ project_id: otherProjectId }));

        await deleteProjectWithRelatedData(db, projectId);
        expect(await countProjectActivity(db, projectId)).toBe(0);
        expect(await countProjectActivity(db, otherProjectId)).toBe(1);

        await db.deleteFrom('projects').where('id', '=', otherProjectId).execute();
        expect(await countProjectActivity(db, otherProjectId)).toBe(0);

        const thirdProject = await seedTestProject(db, ownerId, { uuid: `uuid-c-${Date.now()}` });
        await insertProjectActivity(db, event({ project_id: thirdProject }));
        await deleteProjectActivityForProject(db, thirdProject);
        expect(await countProjectActivity(db, thirdProject)).toBe(0);
    });
});
