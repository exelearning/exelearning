/**
 * Project activity integration tests (issue #2689)
 *
 * Real in-memory database, real routes and real service wired together:
 * sharing changes, the three save paths including the collaborative-autosave
 * call chain, failed saves, ownership transfer visibility, disabled recording
 * and retention.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import type { Kysely } from 'kysely';
import * as Y from 'yjs';
import { createTestDb, closeTestDb, createTestUser, createTestProject } from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';
import * as queries from '../../../src/db/queries';
import { createProjectRoutes, createSymfonyCompatProjectRoutes } from '../../../src/routes/project';
import { createYjsRoutes } from '../../../src/routes/yjs';
import { createProjectActivityRoutes } from '../../../src/routes/project-activity';
import { createProjectActivityService } from '../../../src/services/project-activity';
import { runProjectActivityRetention } from '../../../src/services/project-activity-retention';
import { countProjectActivity, listProjectActivity } from '../../../src/db/queries/project-activity';
import type { ProjectActivityConfig } from '../../../src/config/project-activity';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';
process.env.API_JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_SECRET = TEST_JWT_SECRET;

async function tokenFor(user: User): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    const roles = Array.isArray(user.roles) ? user.roles : JSON.parse(user.roles);
    return new SignJWT({ sub: user.id, email: user.email, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function encodeDoc(title: string): Uint8Array {
    const doc = new Y.Doc();
    doc.getMap('metadata').set('title', title);
    doc.getArray('navigation').push([new Y.Map()]);
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();
    return state;
}

describe('Project activity integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let owner: User;
    let editor: User;
    let stranger: User;
    let admin: User;
    let clock: number;
    let config: ProjectActivityConfig;
    let projectId: number;
    let projectUuid: string;

    const auth = (token: string, extra: Record<string, string> = {}) => ({
        Authorization: `Bearer ${token}`,
        ...extra,
    });

    beforeAll(async () => {
        db = await createTestDb();
        owner = await createTestUser(db, { email: 'owner@integration.test' });
        editor = await createTestUser(db, { email: 'editor@integration.test' });
        stranger = await createTestUser(db, { email: 'stranger@integration.test' });
        admin = await createTestUser(db, { email: 'admin@integration.test', roles: '["ROLE_USER","ROLE_ADMIN"]' });
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    beforeEach(async () => {
        await db.deleteFrom('project_activity').execute();
        await db.deleteFrom('project_collaborators').execute();
        await db.deleteFrom('yjs_documents').execute();
        await db.deleteFrom('projects').execute();
        clock = 1_700_000_000_000;
        config = { retentionDays: 90, recordingEnabled: true, editorAccess: false };
        const activity = createProjectActivityService({
            getConfig: () => config,
            now: () => clock,
            logger: { warn: () => {} },
        });
        app = new Elysia()
            .use(createProjectRoutes({ db, activity }))
            .use(createSymfonyCompatProjectRoutes({ db, activity }))
            .use(createYjsRoutes({ db, queries: queries as never, activity }))
            .use(
                createProjectActivityRoutes({
                    db,
                    queries: {
                        findProjectById: queries.findProjectById,
                        findProjectByUuid: queries.findProjectByUuid,
                        checkProjectAccess: queries.checkProjectAccess,
                    },
                    activity,
                    now: () => clock,
                }),
            );
        const project = await createTestProject(db, owner.id, { title: 'Audited project' });
        projectId = project.id;
        projectUuid = project.uuid;
    });

    const rows = () => listProjectActivity(db, projectId, { limit: 100 }).then(r => r.rows);

    describe('sharing changes', () => {
        it('records exactly one event per real transition, on both route families', async () => {
            const ownerToken = await tokenFor(owner);
            // Invite (uuid family), then invite again (no second event).
            const invite = await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/collaborators`, {
                    method: 'POST',
                    headers: auth(ownerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ email: editor.email }),
                }),
            );
            expect((await invite.json()).responseMessage).toBe('OK');
            await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/collaborators`, {
                    method: 'POST',
                    headers: auth(ownerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ email: editor.email }),
                }),
            );
            expect((await rows()).filter(r => r.event_type === 'access.collaborator_added')).toHaveLength(1);

            // Visibility unchanged (private → private) records nothing; a change records one event (numeric family).
            await app.handle(
                new Request(`http://localhost/api/projects/${projectId}/visibility`, {
                    method: 'PATCH',
                    headers: auth(ownerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ visibility: 'private' }),
                }),
            );
            await app.handle(
                new Request(`http://localhost/api/projects/${projectId}/visibility`, {
                    method: 'PATCH',
                    headers: auth(ownerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ visibility: 'public' }),
                }),
            );
            const visibility = (await rows()).filter(r => r.event_type === 'access.visibility_changed');
            expect(visibility).toHaveLength(1);
            expect(JSON.parse(visibility[0].details!)).toEqual({ from: 'private', to: 'public' });

            // Removing a non-collaborator records nothing; removing a real one records once.
            await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/collaborators/${stranger.id}`, {
                    method: 'DELETE',
                    headers: auth(ownerToken),
                }),
            );
            await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/collaborators/${editor.id}`, {
                    method: 'DELETE',
                    headers: auth(ownerToken),
                }),
            );
            const removed = (await rows()).filter(r => r.event_type === 'access.collaborator_removed');
            expect(removed).toHaveLength(1);
            expect(removed[0].target_id).toBe(String(editor.id));
            expect(removed[0].user_id).toBe(owner.id);
        });

        it('denied sharing mutations record nothing', async () => {
            const strangerToken = await tokenFor(stranger);
            const res = await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/visibility`, {
                    method: 'PATCH',
                    headers: auth(strangerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ visibility: 'public' }),
                }),
            );
            expect(res.status).toBe(403);
            expect(await countProjectActivity(db, projectId)).toBe(0);
        });

        it('ownership transfer records both parties and moves read access to the new owner', async () => {
            const ownerToken = await tokenFor(owner);
            const editorToken = await tokenFor(editor);
            await queries.addCollaborator(db, projectId, editor.id);
            const res = await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/owner`, {
                    method: 'PATCH',
                    headers: auth(ownerToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ newOwnerId: editor.id }),
                }),
            );
            expect(res.status).toBe(200);
            const transfer = (await rows()).find(r => r.event_type === 'access.ownership_transferred')!;
            expect(transfer.user_id).toBe(owner.id);
            expect(transfer.target_id).toBe(String(editor.id));
            expect(JSON.parse(transfer.details!)).toEqual({ previousOwnerId: owner.id, newOwnerId: editor.id });

            // The new owner reads the log; the previous owner (now an editor) does not by default.
            expect(
                (
                    await app.handle(
                        new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity`, {
                            headers: auth(editorToken),
                        }),
                    )
                ).status,
            ).toBe(200);
            expect(
                (
                    await app.handle(
                        new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity`, {
                            headers: auth(ownerToken),
                        }),
                    )
                ).status,
            ).toBe(403);
        });

        it('exposes the activity capability in the sharing payload', async () => {
            const ownerToken = await tokenFor(owner);
            const editorToken = await tokenFor(editor);
            await queries.addCollaborator(db, projectId, editor.id);
            const ownerView = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/uuid/${projectUuid}/sharing`, {
                        headers: auth(ownerToken),
                    }),
                )
            ).json();
            expect(ownerView.project.activity).toEqual({ recordingEnabled: true, canView: true });
            const editorView = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/uuid/${projectUuid}/sharing`, {
                        headers: auth(editorToken),
                    }),
                )
            ).json();
            expect(editorView.project.activity).toEqual({ recordingEnabled: true, canView: false });
            config = { ...config, editorAccess: true };
            const editorView2 = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/uuid/${projectUuid}/sharing`, {
                        headers: auth(editorToken),
                    }),
                )
            ).json();
            expect(editorView2.project.activity.canView).toBe(true);
        });
    });

    describe('saves', () => {
        const saveUrl = () => `http://localhost/api/projects/uuid/${projectUuid}/yjs-document`;

        it('classifies the manual, collaborative-autosave and unload paths and records them after persistence', async () => {
            const ownerToken = await tokenFor(owner);
            const headers = (extra: Record<string, string> = {}) =>
                auth(ownerToken, { 'Content-Type': 'application/octet-stream', ...extra });

            // Manual save: SaveManager.saveYjsState with the manual kind.
            const manual = await app.handle(
                new Request(`${saveUrl()}?markSaved=true`, {
                    method: 'POST',
                    headers: headers({ 'X-Save-Kind': 'manual' }),
                    body: encodeDoc('v1'),
                }),
            );
            expect((await manual.json()).saveKind).toBe('manual');

            // The real collaborative-autosave chain: same endpoint, markSaved=true, autosave kind.
            clock += 10_000;
            const auto1 = await app.handle(
                new Request(`${saveUrl()}?markSaved=true`, {
                    method: 'POST',
                    headers: headers({ 'X-Save-Kind': 'collaborative-autosave' }),
                    body: encodeDoc('v2'),
                }),
            );
            expect((await auto1.json()).markedAsSaved).toBe(true);
            clock += 10_000;
            await app.handle(
                new Request(`${saveUrl()}?markSaved=true`, {
                    method: 'POST',
                    headers: headers({ 'X-Save-Kind': 'collaborative-autosave' }),
                    body: encodeDoc('v3'),
                }),
            );

            // Unload persistence: sendBeacon has no headers and no markSaved.
            clock += 10_000;
            const unload = await app.handle(
                new Request(saveUrl(), { method: 'POST', headers: headers(), body: encodeDoc('v4') }),
            );
            expect((await unload.json()).saveKind).toBe('unload');

            const saves = (await rows()).filter(r => r.event_type.startsWith('save.'));
            expect(saves.map(r => [r.event_type, r.event_count])).toEqual([
                ['save.unload', 1],
                ['save.autosave', 2],
                ['save.manual', 1],
            ]);
            expect(saves.every(r => r.user_id === owner.id)).toBe(true);
            const project = await queries.findProjectById(db, projectId);
            expect(project?.saved_once).toBe(1);
        });

        it('records nothing for a rejected save and one merged event for a stale save', async () => {
            const ownerToken = await tokenFor(owner);
            const strangerToken = await tokenFor(stranger);
            const headers = (token: string, extra: Record<string, string> = {}) =>
                auth(token, { 'Content-Type': 'application/octet-stream', ...extra });

            const denied = await app.handle(
                new Request(`${saveUrl()}?markSaved=true`, {
                    method: 'POST',
                    headers: headers(strangerToken),
                    body: encodeDoc('x'),
                }),
            );
            expect(denied.status).toBe(403);
            expect(await countProjectActivity(db, projectId)).toBe(0);

            const first = await (
                await app.handle(
                    new Request(`${saveUrl()}?markSaved=true`, {
                        method: 'POST',
                        headers: headers(ownerToken, { 'X-Save-Kind': 'manual' }),
                        body: encodeDoc('base'),
                    }),
                )
            ).json();
            clock += 1000;
            const stale = await (
                await app.handle(
                    new Request(`${saveUrl()}?markSaved=true`, {
                        method: 'POST',
                        headers: headers(ownerToken, {
                            'X-Save-Kind': 'manual',
                            'X-Base-Version': String(Number(first.version) - 5),
                        }),
                        body: encodeDoc('stale'),
                    }),
                )
            ).json();
            expect(stale.merged).toBe(true);
            const saves = (await rows()).filter(r => r.event_type === 'save.manual');
            expect(saves).toHaveLength(2);
            expect(JSON.parse(saves[0].details!)).toEqual({ documentVersion: stale.version, merged: true });
        });

        it('keeps saving when recording is disabled and writes no rows', async () => {
            config = { retentionDays: 0, recordingEnabled: false, editorAccess: false };
            const ownerToken = await tokenFor(owner);
            const res = await app.handle(
                new Request(`${saveUrl()}?markSaved=true`, {
                    method: 'POST',
                    headers: auth(ownerToken, { 'Content-Type': 'application/octet-stream' }),
                    body: encodeDoc('v'),
                }),
            );
            expect(res.status).toBe(200);
            expect(await countProjectActivity(db, projectId)).toBe(0);
        });
    });

    describe('client events, administrators and retention', () => {
        it('accepts collaborator reports, lets the owner and an administrator read them, and prunes by age', async () => {
            const editorToken = await tokenFor(editor);
            const ownerToken = await tokenFor(owner);
            const adminToken = await tokenFor(admin);
            await queries.addCollaborator(db, projectId, editor.id);

            const post = await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity/events`, {
                    method: 'POST',
                    headers: auth(editorToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        sessionId: 'session-editor-01',
                        events: [
                            { type: 'page.created', targetId: 'page-1', label: 'Intro', seq: 1 },
                            {
                                type: 'page.edited',
                                targetId: 'page-1',
                                label: 'Intro',
                                count: 14,
                                firstAt: clock - 29 * 60_000,
                                lastAt: clock,
                                seq: 2,
                            },
                        ],
                    }),
                }),
            );
            expect((await post.json()).accepted).toBe(2);

            const ownerLog = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity`, {
                        headers: auth(ownerToken),
                    }),
                )
            ).json();
            expect(ownerLog.events.map((e: { type: string }) => e.type)).toEqual(['page.edited', 'page.created']);
            expect(ownerLog.events[0].count).toBe(14);
            expect(ownerLog.events[0].actor.email).toBe(editor.email);

            const adminLog = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/${projectId}/activity`, { headers: auth(adminToken) }),
                )
            ).json();
            expect(adminLog.events).toHaveLength(2);

            const strangerToken = await tokenFor(stranger);
            expect(
                (
                    await app.handle(
                        new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity`, {
                            headers: auth(strangerToken),
                        }),
                    )
                ).status,
            ).toBe(403);

            // Retention: 91 days later everything older than 90 days is gone, newer rows stay.
            clock += 91 * 24 * 60 * 60 * 1000;
            await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity/events`, {
                    method: 'POST',
                    headers: auth(editorToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        sessionId: 'session-editor-02',
                        events: [{ type: 'page.deleted', targetId: 'page-1', label: 'Intro', seq: 1 }],
                    }),
                }),
            );
            const result = await runProjectActivityRetention({
                db,
                getConfig: () => config,
                now: () => clock,
                logger: { log: () => {}, error: () => {} },
            });
            expect(result.deleted).toBe(2);
            const remaining = await rows();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].event_type).toBe('page.deleted');
        });

        it('removes the log with the project and anonymises deleted actors', async () => {
            const victim = await createTestUser(db, { email: `victim-${Date.now()}@integration.test` });
            await queries.addCollaborator(db, projectId, victim.id);
            const victimToken = await tokenFor(victim);
            await app.handle(
                new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity/events`, {
                    method: 'POST',
                    headers: auth(victimToken, { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        sessionId: 'session-victim-01',
                        events: [{ type: 'idevice.created', targetId: 'idevice-1', seq: 1 }],
                    }),
                }),
            );
            await db.deleteFrom('project_collaborators').where('user_id', '=', victim.id).execute();
            await queries.deleteUser(db, victim.id);
            const ownerToken = await tokenFor(owner);
            const log = await (
                await app.handle(
                    new Request(`http://localhost/api/projects/uuid/${projectUuid}/activity`, {
                        headers: auth(ownerToken),
                    }),
                )
            ).json();
            expect(log.events[0].actor).toBeNull();

            await queries.deleteProjectWithRelatedData(db, projectId);
            expect(await countProjectActivity(db, projectId)).toBe(0);
        });
    });
});
