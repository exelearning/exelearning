/**
 * Project activity service — real isolated SQLite, injected clock and config.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import {
    createProjectActivityService,
    ProjectActivityValidationError,
    type ProjectActivityService,
} from './project-activity';
import type { ProjectActivityConfig } from '../config/project-activity';
import { countProjectActivity, listProjectActivity } from '../db/queries/project-activity';
import { addCollaborator } from '../db/queries/projects';

describe('project activity service', () => {
    let db: Kysely<Database>;
    let ownerId: number;
    let editorId: number;
    let projectId: number;
    let clock: number;
    let config: ProjectActivityConfig;
    let warnings: string[];
    let service: ProjectActivityService;

    const project = () => ({ id: projectId, owner_id: ownerId, status: 'active' });

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        ownerId = await seedTestUser(db, { email: `owner-${Date.now()}@test.local` });
        editorId = await seedTestUser(db, { email: `editor-${Date.now()}@test.local`, user_id: `e-${Date.now()}` });
        projectId = await seedTestProject(db, ownerId, { uuid: `uuid-${Date.now()}` });
        clock = 1_700_000_000_000;
        config = { retentionDays: 90, recordingEnabled: true, editorAccess: false };
        warnings = [];
        service = createProjectActivityService({
            getConfig: () => config,
            now: () => clock,
            logger: { warn: (message: string) => warnings.push(message) },
        });
    });

    const all = async () => (await listProjectActivity(db, projectId, { limit: 100 })).rows;

    describe('record (server events)', () => {
        it('stores a sharing event with the actor and the affected user as target', async () => {
            await service.record(db, {
                projectId,
                userId: ownerId,
                type: 'access.collaborator_added',
                targetType: 'user',
                targetId: editorId,
            });
            const rows = await all();
            expect(rows).toHaveLength(1);
            expect(rows[0].event_type).toBe('access.collaborator_added');
            expect(rows[0].target_type).toBe('user');
            expect(rows[0].target_id).toBe(String(editorId));
            expect(Number(rows[0].occurred_at)).toBe(clock);
        });

        it('does nothing when recording is disabled', async () => {
            config = { ...config, retentionDays: 0, recordingEnabled: false };
            await service.record(db, { projectId, userId: ownerId, type: 'access.visibility_changed' });
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'manual',
                documentVersion: '1',
                merged: false,
            });
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'session-aaaaaaaa' });
            expect(await countProjectActivity(db, projectId)).toBe(0);
            expect(service.isEnabled()).toBe(false);
        });

        it('never throws when the insert fails, and reports it', async () => {
            const failing = createProjectActivityService({
                getConfig: () => config,
                now: () => clock,
                logger: { warn: (message: string) => warnings.push(message) },
                queries: {
                    insertProjectActivity: async () => {
                        throw new Error('disk full');
                    },
                },
            });
            await failing.record(db, { projectId, userId: ownerId, type: 'access.visibility_changed' });
            await failing.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'manual',
                documentVersion: '1',
                merged: false,
            });
            await failing.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'unload',
                documentVersion: '1',
                merged: false,
            });
            await failing.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'session-aaaaaaaa' });
            expect(warnings.length).toBe(4);
            expect(warnings[0]).toContain('disk full');
            expect(warnings[0]).not.toContain('@'); // no identities in the warning
        });

        it('truncates labels and drops oversized details', async () => {
            await service.record(db, {
                projectId,
                userId: ownerId,
                type: 'access.visibility_changed',
                targetLabel: `  ${'x'.repeat(500)}  `,
                details: { blob: 'y'.repeat(5000) },
            });
            const [row] = await all();
            expect(row.target_label?.length).toBe(160);
            expect(row.details).toBeNull();
        });
    });

    describe('recordSave', () => {
        it('records manual saves individually with version and merge flag', async () => {
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'manual',
                documentVersion: '100',
                merged: false,
            });
            clock += 1000;
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'manual',
                documentVersion: '101',
                merged: true,
            });
            const rows = await all();
            expect(rows).toHaveLength(2);
            expect(rows.map(r => r.event_type)).toEqual(['save.manual', 'save.manual']);
            expect(JSON.parse(rows[0].details!)).toEqual({ documentVersion: '101', merged: true });
        });

        it('coalesces consecutive autosaves by the same user inside the window', async () => {
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'collaborative-autosave',
                documentVersion: '1',
                merged: false,
            });
            clock += 60_000;
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'collaborative-autosave',
                documentVersion: '2',
                merged: false,
            });
            clock += 60_000;
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'collaborative-autosave',
                documentVersion: '3',
                merged: false,
            });
            const rows = await all();
            expect(rows).toHaveLength(1);
            expect(rows[0].event_type).toBe('save.autosave');
            expect(rows[0].event_count).toBe(3);
            expect(Number(rows[0].first_occurred_at)).toBe(1_700_000_000_000);
            expect(Number(rows[0].occurred_at)).toBe(clock);
            expect(JSON.parse(rows[0].details!).documentVersion).toBe('3');
        });

        it('does not coalesce across users, kinds or beyond the window', async () => {
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'collaborative-autosave',
                documentVersion: '1',
                merged: false,
            });
            await service.recordSave(db, {
                projectId,
                userId: editorId,
                kind: 'collaborative-autosave',
                documentVersion: '2',
                merged: false,
            });
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'unload',
                documentVersion: '3',
                merged: false,
            });
            clock += 11 * 60_000;
            await service.recordSave(db, {
                projectId,
                userId: ownerId,
                kind: 'collaborative-autosave',
                documentVersion: '4',
                merged: false,
            });
            const rows = await all();
            expect(rows).toHaveLength(4);
            expect(rows.every(r => r.event_count === 1)).toBe(true);
        });
    });

    describe('recordSessionOpened', () => {
        it('records one event per client session and ignores reconnections', async () => {
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'session-aaaaaaaa' });
            clock += 5000;
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'session-aaaaaaaa' });
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'session-bbbbbbbb' });
            await service.recordSessionOpened(db, { projectId, userId: editorId, sessionId: 'session-aaaaaaaa' });
            const rows = await all();
            expect(rows).toHaveLength(3);
            expect(rows.every(r => r.event_type === 'session.opened')).toBe(true);
        });

        it('coalesces recent opens when the client sent no usable session id', async () => {
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: null });
            clock += 1000;
            await service.recordSessionOpened(db, { projectId, userId: ownerId, sessionId: 'bad id!' });
            const rows = await all();
            expect(rows).toHaveLength(1);
            expect(rows[0].event_count).toBe(2);
        });
    });

    describe('recordVersionRestored', () => {
        it('records the administrator restoration with both versions', async () => {
            await service.recordVersionRestored(db, {
                projectId,
                userId: ownerId,
                restoredVersionId: 7,
                restoredVersion: '1699',
                resultingVersion: '1700',
            });
            const [row] = await all();
            expect(row.event_type).toBe('version.restored');
            expect(JSON.parse(row.details!)).toEqual({
                restoredVersionId: 7,
                restoredVersion: '1699',
                documentVersion: '1700',
            });
        });
    });

    describe('recordClientEvents', () => {
        const batch = (events: unknown[], sessionId = 'session-aaaaaaaa') => ({ sessionId, events });

        it('rejects malformed envelopes with a validation error', async () => {
            await expect(service.recordClientEvents(db, projectId, editorId, null)).rejects.toBeInstanceOf(
                ProjectActivityValidationError,
            );
            await expect(service.recordClientEvents(db, projectId, editorId, { events: [] })).rejects.toThrow(
                /sessionId/,
            );
            await expect(service.recordClientEvents(db, projectId, editorId, batch([]))).rejects.toThrow(/non-empty/);
            await expect(service.recordClientEvents(db, projectId, editorId, batch([], 'short'))).rejects.toThrow(
                /sessionId/,
            );
            const tooMany = batch(
                Array.from({ length: 101 }, (_, i) => ({ type: 'page.edited', targetId: 'p', seq: i })),
            );
            await expect(service.recordClientEvents(db, projectId, editorId, tooMany)).rejects.toThrow(/At most 100/);
        });

        it('accepts valid events, attributes them to the reporter and ignores retries', async () => {
            const events = [
                {
                    type: 'page.edited',
                    targetType: 'page',
                    targetId: 'page-1',
                    label: 'Intro',
                    count: 14,
                    firstAt: clock - 30 * 60_000,
                    lastAt: clock - 60_000,
                    seq: 1,
                    details: { keys: ['pageName'], ignored: 'x' },
                },
                {
                    type: 'idevice.created',
                    targetId: 'idevice-1',
                    label: 'Box',
                    seq: 2,
                    details: { ideviceType: 'text', pageId: 'page-1' },
                },
                { type: 'import.elpx', seq: 3, details: { format: 'elpx', mode: 'merge', pages: 3, components: 10 } },
            ];
            const first = await service.recordClientEvents(db, projectId, editorId, batch(events));
            expect(first).toEqual({ accepted: 3, duplicates: 0, rejected: 0, failed: 0, recordingEnabled: true });

            const retry = await service.recordClientEvents(db, projectId, editorId, batch(events));
            expect(retry.duplicates).toBe(3);
            expect(retry.accepted).toBe(0);
            expect(await countProjectActivity(db, projectId)).toBe(3);

            const rows = await all();
            const edited = rows.find(r => r.event_type === 'page.edited')!;
            expect(edited.user_id).toBe(editorId);
            expect(edited.event_count).toBe(14);
            expect(Number(edited.first_occurred_at)).toBe(clock - 30 * 60_000);
            expect(Number(edited.occurred_at)).toBe(clock - 60_000);
            expect(edited.dedupe_key).toBe('session-aaaaaaaa:1');
            expect(JSON.parse(edited.details!)).toEqual({ keys: ['pageName'] });
            const imported = rows.find(r => r.event_type === 'import.elpx')!;
            expect(imported.target_type).toBe('project');
            expect(imported.target_id).toBeNull();
        });

        it('rejects individual invalid events without dropping the valid ones', async () => {
            const result = await service.recordClientEvents(
                db,
                projectId,
                editorId,
                batch([
                    { type: 'save.manual', seq: 1 }, // server-only code
                    { type: 'page.edited', targetId: '../etc', seq: 2 }, // bad id
                    { type: 'page.edited', targetType: 'idevice', targetId: 'p', seq: 3 }, // wrong target type
                    { type: 'page.edited', targetId: 'p', count: 0, seq: 4 },
                    { type: 'page.edited', targetId: 'p', count: 1_000_000, seq: 5 },
                    { type: 'page.edited', targetId: 'p', seq: -1 },
                    { type: 'page.edited', targetId: 'p', seq: 'x' },
                    'not-an-object',
                    { type: 'page.edited', targetId: 'ok-1', seq: 9 },
                ]),
            );
            expect(result.accepted).toBe(1);
            expect(result.rejected).toBe(8);
            expect(await countProjectActivity(db, projectId)).toBe(1);
        });

        it('clamps client timestamps outside the accepted skew to server time', async () => {
            await service.recordClientEvents(
                db,
                projectId,
                editorId,
                batch([
                    {
                        type: 'page.edited',
                        targetId: 'p',
                        seq: 1,
                        firstAt: clock - 48 * 3600_000,
                        lastAt: clock + 3600_000,
                    },
                    { type: 'page.edited', targetId: 'q', seq: 2, firstAt: 'soon', lastAt: Number.NaN },
                    { type: 'page.edited', targetId: 'r', seq: 3, firstAt: clock - 1000, lastAt: clock - 5000 },
                ]),
            );
            const rows = await all();
            const p = rows.find(r => r.target_id === 'p')!;
            expect(Number(p.first_occurred_at)).toBe(clock);
            expect(Number(p.occurred_at)).toBe(clock);
            const q = rows.find(r => r.target_id === 'q')!;
            expect(Number(q.occurred_at)).toBe(clock);
            const r = rows.find(r => r.target_id === 'r')!;
            expect(Number(r.first_occurred_at)).toBeLessThanOrEqual(Number(r.occurred_at));
        });

        it('truncates labels, sanitises details and never stores unknown keys', async () => {
            await service.recordClientEvents(
                db,
                projectId,
                editorId,
                batch([
                    {
                        type: 'idevice.edited',
                        targetId: 'i',
                        label: `<img src=x onerror=alert(1)>${'a'.repeat(300)}`,
                        seq: 1,
                        details: {
                            ideviceType: 'text',
                            html: '<b>no</b>',
                            pageLabel: 'b'.repeat(400),
                            pageId: 42,
                            keys: ['htmlContent', 1, 'x'.repeat(100)],
                        },
                    },
                ]),
            );
            const [row] = await all();
            expect(row.target_label?.length).toBe(160);
            expect(row.target_label?.startsWith('<img')).toBe(true); // stored as text, rendered as text
            const details = JSON.parse(row.details!);
            expect(details.html).toBeUndefined();
            expect(details.ideviceType).toBe('text');
            expect(details.pageLabel.length).toBe(160);
            expect(details.pageId).toBe(42);
            expect(details.keys).toEqual(['htmlContent', 'x'.repeat(64)]);
        });

        it('returns counts without touching the database when recording is disabled', async () => {
            config = { ...config, retentionDays: 0, recordingEnabled: false };
            const result = await service.recordClientEvents(
                db,
                projectId,
                editorId,
                batch([{ type: 'page.edited', targetId: 'p', seq: 1 }]),
            );
            expect(result).toEqual({ accepted: 0, duplicates: 0, rejected: 0, failed: 0, recordingEnabled: false });
            expect(await countProjectActivity(db, projectId)).toBe(0);
        });

        it('counts storage failures without throwing', async () => {
            let calls = 0;
            const flaky = createProjectActivityService({
                getConfig: () => config,
                now: () => clock,
                logger: { warn: (message: string) => warnings.push(message) },
                queries: {
                    insertProjectActivity: async () => {
                        calls++;
                        throw new Error('boom');
                    },
                },
            });
            const result = await flaky.recordClientEvents(
                db,
                projectId,
                editorId,
                batch([{ type: 'page.edited', targetId: 'p', seq: 1 }]),
            );
            expect(calls).toBe(1);
            expect(result.failed).toBe(1);
            expect(warnings).toHaveLength(1);
        });
    });

    describe('canViewActivity', () => {
        it('allows admins and owners, denies strangers and editors by default', async () => {
            await addCollaborator(db, projectId, editorId);
            const stranger = await seedTestUser(db, {
                email: `s-${Date.now()}@test.local`,
                user_id: `s-${Date.now()}`,
            });
            expect(await service.canViewActivity(db, { project: project(), userId: ownerId, isAdmin: false })).toBe(
                true,
            );
            expect(await service.canViewActivity(db, { project: project(), userId: stranger, isAdmin: true })).toBe(
                true,
            );
            expect(await service.canViewActivity(db, { project: project(), userId: stranger, isAdmin: false })).toBe(
                false,
            );
            expect(await service.canViewActivity(db, { project: project(), userId: editorId, isAdmin: false })).toBe(
                false,
            );
        });

        it('allows explicit collaborators only when editor access is enabled', async () => {
            await addCollaborator(db, projectId, editorId);
            config = { ...config, editorAccess: true };
            expect(await service.canViewActivity(db, { project: project(), userId: editorId, isAdmin: false })).toBe(
                true,
            );
            const stranger = await seedTestUser(db, {
                email: `s-${Date.now()}@test.local`,
                user_id: `s2-${Date.now()}`,
            });
            expect(await service.canViewActivity(db, { project: project(), userId: stranger, isAdmin: false })).toBe(
                false,
            );
        });

        it('denies non-admins on inactive projects', async () => {
            const inactive = { id: projectId, owner_id: ownerId, status: 'inactive' };
            expect(await service.canViewActivity(db, { project: inactive, userId: ownerId, isAdmin: false })).toBe(
                false,
            );
            expect(await service.canViewActivity(db, { project: inactive, userId: ownerId, isAdmin: true })).toBe(true);
        });
    });

    describe('listActivity', () => {
        it('serialises entries with provenance, actor, resolved user targets and pagination', async () => {
            await service.record(db, {
                projectId,
                userId: ownerId,
                type: 'access.collaborator_added',
                targetType: 'user',
                targetId: editorId,
            });
            clock += 1000;
            await service.recordClientEvents(db, projectId, editorId, {
                sessionId: 'session-aaaaaaaa',
                events: [
                    { type: 'page.deleted', targetId: 'page-9', label: 'Old', seq: 1, details: { descendants: 2 } },
                ],
            });
            clock += 1000;
            await service.record(db, {
                projectId,
                userId: ownerId,
                type: 'access.collaborator_removed',
                targetType: 'user',
                targetId: 999_999,
            });

            const page1 = await service.listActivity(db, projectId, { limit: '2' });
            expect(page1.events).toHaveLength(2);
            expect(page1.nextCursor).toMatch(/^\d+_\d+$/);
            expect(page1.recordingEnabled).toBe(true);
            expect(page1.retentionDays).toBe(90);

            const removed = page1.events[0];
            expect(removed.type).toBe('access.collaborator_removed');
            expect(removed.provenance).toBe('server');
            expect(removed.actor?.id).toBe(ownerId);
            expect(removed.target).toEqual({ type: 'user', id: '999999', label: null, deleted: true });

            const deleted = page1.events[1];
            expect(deleted.provenance).toBe('client');
            expect(deleted.actor?.email).toContain('editor-');
            expect(deleted.target).toEqual({ type: 'page', id: 'page-9', label: 'Old' });
            expect(deleted.details).toEqual({ descendants: 2 });
            expect(deleted.sessionId).toBe('session-aaaaaaaa');

            const page2 = await service.listActivity(db, projectId, { limit: 2, cursor: page1.nextCursor! });
            expect(page2.events).toHaveLength(1);
            expect(page2.events[0].target).toEqual({
                type: 'user',
                id: String(editorId),
                label: expect.stringContaining('editor-'),
                deleted: false,
            });
            expect(page2.nextCursor).toBeNull();
        });

        it('shows deleted actors as null and keeps the row readable', async () => {
            await service.record(db, { projectId, userId: editorId, type: 'save.manual' });
            await db.deleteFrom('users').where('id', '=', editorId).execute();
            const page = await service.listActivity(db, projectId, {});
            expect(page.events[0].actor).toBeNull();
            expect(page.events[0].type).toBe('save.manual');
        });

        it('validates query parameters strictly', async () => {
            const bad = async (params: Record<string, string>, code: string) => {
                try {
                    await service.listActivity(db, projectId, params);
                    throw new Error('expected failure');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectActivityValidationError);
                    expect((error as ProjectActivityValidationError).code).toBe(code);
                }
            };
            await bad({ limit: '0' }, 'INVALID_LIMIT');
            await bad({ limit: '101' }, 'INVALID_LIMIT');
            await bad({ limit: 'ten' }, 'INVALID_LIMIT');
            await bad({ userId: '-1' }, 'INVALID_USER');
            await bad({ userId: '0' }, 'INVALID_USER');
            await bad({ since: '2024-01-01' }, 'INVALID_RANGE');
            await bad({ since: '10', until: '10' }, 'INVALID_RANGE');
            await bad({ cursor: 'abc' }, 'INVALID_CURSOR');
            const ok = await service.listActivity(db, projectId, { since: '0', until: '1', limit: '100' });
            expect(ok.events).toEqual([]);
        });

        it('lists actors for the filter', async () => {
            await service.record(db, { projectId, userId: ownerId, type: 'save.manual' });
            await service.record(db, { projectId, userId: null, type: 'save.manual' });
            const actors = await service.listActors(db, projectId);
            expect(actors).toHaveLength(2);
            expect(actors.some(a => a.id === ownerId)).toBe(true);
            expect(actors.some(a => a.id === null)).toBe(true);
        });
    });
});
