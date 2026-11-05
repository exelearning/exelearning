/**
 * Project activity routes — authorization matrix, validation and client events.
 * Real in-memory SQLite, real queries, real service with injected config/clock.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import {
    findProjectById,
    findProjectByUuid,
    checkProjectAccess,
    addCollaborator,
    removeCollaborator,
} from '../db/queries/projects';
import { countProjectActivity } from '../db/queries/project-activity';
import { createProjectActivityService } from '../services/project-activity';
import type { ProjectActivityConfig } from '../config/project-activity';
import { createProjectActivityRoutes, SlidingWindowRateLimiter } from './project-activity';
import { getJwtSecret } from '../utils/jwt-secret';

const TEST_SECRET = getJwtSecret();

async function signToken(sub: number, roles: string[] = ['ROLE_USER']): Promise<string> {
    const secret = new TextEncoder().encode(TEST_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

describe('project activity routes', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let clock: number;
    let config: ProjectActivityConfig;
    let ownerId: number;
    let editorId: number;
    let strangerId: number;
    let adminId: number;
    let projectId: number;
    let projectUuid: string;
    let tokens: Record<string, string>;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        clock = 1_700_000_000_000;
        config = { retentionDays: 90, recordingEnabled: true, editorAccess: false };
        ownerId = await seedTestUser(db, { email: 'owner@test.local', user_id: 'owner' });
        editorId = await seedTestUser(db, { email: 'editor@test.local', user_id: 'editor' });
        strangerId = await seedTestUser(db, { email: 'stranger@test.local', user_id: 'stranger' });
        adminId = await seedTestUser(db, {
            email: 'admin@test.local',
            user_id: 'admin',
            roles: '["ROLE_USER","ROLE_ADMIN"]',
        });
        projectUuid = '11111111-2222-4333-8444-555555555555';
        projectId = await seedTestProject(db, ownerId, { uuid: projectUuid });
        await addCollaborator(db, projectId, editorId);
        tokens = {
            owner: await signToken(ownerId),
            editor: await signToken(editorId),
            stranger: await signToken(strangerId),
            admin: await signToken(adminId, ['ROLE_USER', 'ROLE_ADMIN']),
        };
        const activity = createProjectActivityService({
            getConfig: () => config,
            now: () => clock,
            logger: { warn: () => {} },
        });
        app = new Elysia().use(
            createProjectActivityRoutes({
                db,
                queries: { findProjectById, findProjectByUuid, checkProjectAccess },
                activity,
                now: () => clock,
            }),
        );
        // Seed one server event so readers have something to see.
        await activity.record(db, {
            projectId,
            userId: ownerId,
            type: 'access.collaborator_added',
            targetType: 'user',
            targetId: editorId,
        });
    });

    const get = (path: string, token?: string) =>
        app.handle(
            new Request(`http://localhost${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        );

    const post = (path: string, body: unknown, token?: string, headers: Record<string, string> = {}) =>
        app.handle(
            new Request(`http://localhost${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...headers,
                },
                body: typeof body === 'string' ? body : JSON.stringify(body),
            }),
        );

    describe('reading the log (authorization matrix)', () => {
        it('requires authentication', async () => {
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`)).status).toBe(401);
            expect((await get(`/api/projects/${projectId}/activity/actors`)).status).toBe(401);
        });

        it('allows the owner on both route families', async () => {
            const byUuid = await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner);
            expect(byUuid.status).toBe(200);
            const body = await byUuid.json();
            expect(body.events).toHaveLength(1);
            expect(body.events[0].type).toBe('access.collaborator_added');
            expect(body.events[0].target.label).toBe('editor@test.local');
            expect(body.recordingEnabled).toBe(true);
            expect(body.nextCursor).toBeNull();

            const byId = await get(`/api/projects/${projectId}/activity`, tokens.owner);
            expect(byId.status).toBe(200);
            expect((await byId.json()).events).toHaveLength(1);
        });

        it('allows administrators', async () => {
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.admin)).status).toBe(200);
            const actors = await get(`/api/projects/uuid/${projectUuid}/activity/actors`, tokens.admin);
            expect(actors.status).toBe(200);
            expect((await actors.json()).actors).toEqual([{ id: ownerId, email: 'owner@test.local' }]);
        });

        it('denies collaborators by default and allows them with editor access enabled', async () => {
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.editor)).status).toBe(403);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity/actors`, tokens.editor)).status).toBe(403);
            config = { ...config, editorAccess: true };
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.editor)).status).toBe(200);
            // A former collaborator loses access again.
            await removeCollaborator(db, projectId, editorId);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.editor)).status).toBe(403);
        });

        it('denies unrelated users, even on public-edit projects', async () => {
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.stranger)).status).toBe(403);
            await db.updateTable('projects').set({ visibility: 'public' }).where('id', '=', projectId).execute();
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.stranger)).status).toBe(403);
            config = { ...config, editorAccess: true };
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.stranger)).status).toBe(403);
        });

        it('returns 404 for unknown projects and malformed ids', async () => {
            expect(
                (await get('/api/projects/uuid/00000000-0000-4000-8000-000000000000/activity', tokens.owner)).status,
            ).toBe(404);
            expect((await get('/api/projects/999999/activity', tokens.owner)).status).toBe(404);
            expect((await get('/api/projects/not-a-number/activity', tokens.owner)).status).toBe(404);
        });

        it('keeps access after an ownership transfer and denies the previous owner', async () => {
            await db.updateTable('projects').set({ owner_id: editorId }).where('id', '=', projectId).execute();
            await removeCollaborator(db, projectId, editorId);
            await addCollaborator(db, projectId, ownerId);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.editor)).status).toBe(200);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner)).status).toBe(403);
        });

        it('denies owners on inactive projects but still serves administrators; archived stays readable', async () => {
            await db.updateTable('projects').set({ status: 'inactive' }).where('id', '=', projectId).execute();
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner)).status).toBe(403);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.admin)).status).toBe(200);
            await db.updateTable('projects').set({ status: 'archived' }).where('id', '=', projectId).execute();
            expect((await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner)).status).toBe(200);
        });

        it('validates query parameters and paginates', async () => {
            expect((await get(`/api/projects/uuid/${projectUuid}/activity?limit=0`, tokens.owner)).status).toBe(400);
            expect((await get(`/api/projects/uuid/${projectUuid}/activity?since=yesterday`, tokens.owner)).status).toBe(
                400,
            );
            expect((await get(`/api/projects/uuid/${projectUuid}/activity?cursor=zzz`, tokens.owner)).status).toBe(400);
            const bad = await get(`/api/projects/uuid/${projectUuid}/activity?userId=-3`, tokens.owner);
            expect(bad.status).toBe(400);
            expect((await bad.json()).error).toBe('INVALID_USER');

            for (let i = 0; i < 3; i++) {
                clock += 1000;
                await post(
                    `/api/projects/uuid/${projectUuid}/activity/events`,
                    { sessionId: 'session-editor-1', events: [{ type: 'page.edited', targetId: `page-${i}`, seq: i }] },
                    tokens.editor,
                );
            }
            const page1 = await (await get(`/api/projects/uuid/${projectUuid}/activity?limit=2`, tokens.owner)).json();
            expect(page1.events).toHaveLength(2);
            expect(page1.nextCursor).toBeTruthy();
            const page2 = await (
                await get(`/api/projects/uuid/${projectUuid}/activity?limit=2&cursor=${page1.nextCursor}`, tokens.owner)
            ).json();
            expect(page2.events).toHaveLength(2);
            expect(page2.nextCursor).toBeNull();
            const filtered = await (
                await get(`/api/projects/uuid/${projectUuid}/activity?userId=${editorId}`, tokens.owner)
            ).json();
            expect(filtered.events.every((e: { actor: { id: number } }) => e.actor.id === editorId)).toBe(true);
            expect(filtered.events).toHaveLength(3);
        });

        it('still serves existing rows when recording is disabled and says so', async () => {
            config = { retentionDays: 0, recordingEnabled: false, editorAccess: false };
            const res = await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.events).toHaveLength(1);
            expect(body.recordingEnabled).toBe(false);
        });
    });

    describe('posting client events', () => {
        const batch = (events: unknown[] = [{ type: 'page.edited', targetId: 'page-1', label: 'Intro', seq: 1 }]) => ({
            sessionId: 'session-editor-1',
            events,
        });

        it('requires authentication and edit access, and never writes when denied', async () => {
            expect((await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch())).status).toBe(401);
            expect(
                (await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.stranger)).status,
            ).toBe(403);
            expect(
                (
                    await post(
                        '/api/projects/uuid/00000000-0000-4000-8000-000000000000/activity/events',
                        batch(),
                        tokens.editor,
                    )
                ).status,
            ).toBe(404);
            expect(await countProjectActivity(db, projectId)).toBe(1);
        });

        it('accepts events from collaborators and from editors of public projects, attributing them to the caller', async () => {
            const res = await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.editor);
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                success: true,
                accepted: 1,
                duplicates: 0,
                rejected: 0,
                failed: 0,
                recordingEnabled: true,
            });

            await db.updateTable('projects').set({ visibility: 'public' }).where('id', '=', projectId).execute();
            const publicRes = await post(
                `/api/projects/uuid/${projectUuid}/activity/events`,
                {
                    sessionId: 'session-stranger',
                    events: [
                        { type: 'idevice.created', targetId: 'idevice-1', seq: 1, details: { ideviceType: 'text' } },
                    ],
                },
                tokens.stranger,
            );
            expect(publicRes.status).toBe(200);

            const log = await (await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner)).json();
            const byStranger = log.events.find((e: { type: string }) => e.type === 'idevice.created');
            expect(byStranger.actor.id).toBe(strangerId);
            expect(byStranger.provenance).toBe('client');
        });

        it('cannot impersonate another user through the payload', async () => {
            const res = await post(
                `/api/projects/uuid/${projectUuid}/activity/events`,
                {
                    sessionId: 'session-editor-1',
                    userId: ownerId,
                    actor: ownerId,
                    events: [{ type: 'page.deleted', targetId: 'page-1', seq: 1, userId: ownerId }],
                },
                tokens.editor,
            );
            expect(res.status).toBe(200);
            const log = await (await get(`/api/projects/uuid/${projectUuid}/activity`, tokens.owner)).json();
            expect(log.events[0].actor.id).toBe(editorId);
        });

        it('rejects malformed envelopes with 400 and oversized bodies with 413', async () => {
            expect(
                (await post(`/api/projects/uuid/${projectUuid}/activity/events`, { events: [] }, tokens.editor)).status,
            ).toBe(400);
            expect(
                (
                    await post(
                        `/api/projects/uuid/${projectUuid}/activity/events`,
                        { sessionId: 'session-editor-1', events: [] },
                        tokens.editor,
                    )
                ).status,
            ).toBe(400);
            const tooMany = batch(
                Array.from({ length: 101 }, (_, i) => ({ type: 'page.edited', targetId: 'p', seq: i })),
            );
            const res = await post(`/api/projects/uuid/${projectUuid}/activity/events`, tooMany, tokens.editor);
            expect(res.status).toBe(400);
            expect((await res.json()).error).toBe('TOO_MANY_EVENTS');
            const big = await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.editor, {
                'Content-Length': String(300 * 1024),
            });
            expect(big.status).toBe(413);
        });

        it('is idempotent on retries', async () => {
            await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.editor);
            const retry = await (
                await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.editor)
            ).json();
            expect(retry.duplicates).toBe(1);
            expect(await countProjectActivity(db, projectId)).toBe(2);
        });

        it('rate-limits a flooding client per user', async () => {
            let status = 200;
            for (let i = 0; i < 121 && status === 200; i++) {
                status = (
                    await post(
                        `/api/projects/uuid/${projectUuid}/activity/events`,
                        batch([{ type: 'page.edited', targetId: 'p', seq: i }]),
                        tokens.editor,
                    )
                ).status;
            }
            expect(status).toBe(429);
            // Another user is not affected, and the window slides.
            expect(
                (await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.owner)).status,
            ).toBe(200);
            clock += 61_000;
            expect(
                (
                    await post(
                        `/api/projects/uuid/${projectUuid}/activity/events`,
                        batch([{ type: 'page.edited', targetId: 'p', seq: 999 }]),
                        tokens.editor,
                    )
                ).status,
            ).toBe(200);
        });

        it('reports disabled recording without storing anything', async () => {
            config = { retentionDays: 0, recordingEnabled: false, editorAccess: false };
            const res = await post(`/api/projects/uuid/${projectUuid}/activity/events`, batch(), tokens.editor);
            expect(res.status).toBe(200);
            expect((await res.json()).recordingEnabled).toBe(false);
            expect(await countProjectActivity(db, projectId)).toBe(1);
        });
    });

    describe('SlidingWindowRateLimiter', () => {
        it('bounds tracked users and resets', () => {
            const limiter = new SlidingWindowRateLimiter(2, 1000, 2);
            expect(limiter.allow(1, 0)).toBe(true);
            expect(limiter.allow(1, 1)).toBe(true);
            expect(limiter.allow(1, 2)).toBe(false);
            expect(limiter.allow(2, 2)).toBe(true);
            expect(limiter.allow(3, 2)).toBe(true); // evicts the oldest tracked user
            expect(limiter.allow(1, 3)).toBe(true);
            limiter.reset();
            expect(limiter.allow(1, 1001)).toBe(true);
        });
    });
});
