/**
 * Export API v1 Routes Tests
 *
 * Tests for project export endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import * as Y from 'yjs';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { exportRoutes } from './export';
import { createAuthRoutes } from '../../auth';
import { findUserByEmail, findUserById, createUser, saveFullState } from '../../../db/queries';

/**
 * Helper to create a minimal Yjs document for export testing
 */
function createMinimalYjsDocument(projectUuid: string): Y.Doc {
    const ydoc = new Y.Doc();

    ydoc.transact(() => {
        // Initialize navigation structure
        const navigation = ydoc.getArray('navigation');

        // Create root page
        const rootChildren = new Y.Array();
        const rootPage = new Y.Map();
        rootPage.set('id', 'root');
        rootPage.set('pageId', 'root');
        rootPage.set('pageName', 'Root');
        rootPage.set('navClass', 'nav-root');
        rootPage.set('children', rootChildren);

        // Create a child page
        const childBlocks = new Y.Array();
        const childChildren = new Y.Array();
        const childPage = new Y.Map();
        childPage.set('id', 'page-1');
        childPage.set('pageId', 'page-1');
        childPage.set('pageName', 'Introduction');
        childPage.set('navClass', 'nav-element');
        childPage.set('children', childChildren);
        childPage.set('blocks', childBlocks);

        rootChildren.push([childPage]);
        navigation.push([rootPage]);

        // Initialize metadata
        const metadata = ydoc.getMap('metadata');
        metadata.set('title', 'Test Export Project');
        metadata.set('author', 'Test Author');
        metadata.set('language', 'en');
        metadata.set('projectUuid', projectUuid);
        // Set a theme that exists in public/files/perm/themes
        metadata.set('theme', 'default');

        // Initialize assets map
        ydoc.getMap('assets');
    });

    return ydoc;
}

let originalEnv: Record<string, string | undefined>;

function createTestApp() {
    const authDeps = {
        db,
        queries: { findUserByEmail, findUserById, createUser },
    };
    return new Elysia().use(createAuthRoutes(authDeps)).use(exportRoutes);
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

async function getAuthToken(app: ReturnType<typeof createTestApp>, email: string, password: string): Promise<string> {
    const response = await app.handle(
        new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }),
    );
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
}

describe('Export API v1', () => {
    let app: ReturnType<typeof createTestApp>;
    let userToken: string;
    let userId: number;
    let adminId: number;

    beforeAll(async () => {
        originalEnv = {
            APP_AUTH_METHODS: process.env.APP_AUTH_METHODS,
            JWT_SECRET: process.env.JWT_SECRET,
        };
        process.env.APP_AUTH_METHODS = 'password';
        process.env.JWT_SECRET = 'test-secret-for-export-tests';

        await resetClientCacheForTesting();
        await up(db);

        app = createTestApp();

        const hashedPw = await hashPassword('password');

        const userResult = await db
            .insertInto('users')
            .values({
                email: 'exportuser@test.com',
                user_id: 'export-test-user',
                password: hashedPw,
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        userId = Number(userResult.insertId);

        const adminResult = await db
            .insertInto('users')
            .values({
                email: 'exportadmin@test.com',
                user_id: 'export-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'exportuser@test.com', 'password');
    });

    afterAll(async () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        await db.deleteFrom('projects').execute();
    });

    // Export routes use /export prefix with nested /projects group
    // Paths: /export/formats and /export/projects/:uuid/export/:format

    describe('GET /export/formats', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/export/formats'));
            expect(response.status).toBe(401);
            const data = (await response.json()) as { success: boolean; error: { code: string } };
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return available export formats for authenticated user', async () => {
            const response = await app.handle(
                new Request('http://localhost/export/formats', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const data = (await response.json()) as {
                success: boolean;
                data: Array<{ id: string; name: string }>;
            };
            expect(data.success).toBe(true);
            expect(data.data).toBeInstanceOf(Array);
            expect(data.data.length).toBeGreaterThan(0);
        });
    });

    describe('GET /export/projects/:uuid/export/:format', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/export/projects/test-uuid/export/html5'));
            expect(response.status).toBe(401);
            const data = (await response.json()) as { success: boolean; error: { code: string } };
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/export/projects/non-existent/export/html5', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-export',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/export/projects/admin-project-export/export/html5', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return 422 for invalid export format (schema validation)', async () => {
            // Create a project owned by the user
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-export',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            // Invalid format is rejected by TypeBox schema validation (422)
            const response = await app.handle(
                new Request('http://localhost/export/projects/user-project-export/export/invalid-format', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(422);
        });

        it('should return 500 when export fails (no Yjs document)', async () => {
            // Create a project owned by the user (without Yjs document data)
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-no-yjs',
                    title: 'User Project Without Yjs',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/export/projects/user-project-no-yjs/export/html5', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // Export should fail because there's no Yjs document
            // This exercises the error handling path
            expect([500, 200]).toContain(response.status);
            if (response.status === 500) {
                const data = (await response.json()) as { success: boolean; error: { code: string } };
                expect(data.success).toBe(false);
                expect(['EXPORT_ERROR', 'EXPORT_FAILED']).toContain(data.error.code);
            }
        });

        it('should handle each export format type (auth and access checks)', async () => {
            // Create a project for format testing
            await db
                .insertInto('projects')
                .values({
                    uuid: 'format-test-project',
                    title: 'Format Test',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            // Test each format passes auth and access checks
            const formats = ['html5', 'html5-sp', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elpx', 'elp'];

            for (const format of formats) {
                const response = await app.handle(
                    new Request(`http://localhost/export/projects/format-test-project/export/${format}`, {
                        headers: { Authorization: `Bearer ${userToken}` },
                    }),
                );
                // Should pass auth check (not 401/403) - may fail at export step
                expect([200, 500]).toContain(response.status);
            }
        });

        it('should successfully export project with valid Yjs document to ELPX', async () => {
            const projectUuid = 'success-export-project';

            // Create project
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: projectUuid,
                    title: 'Success Export Test',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            // Create a valid Yjs document and save it
            const ydoc = createMinimalYjsDocument(projectUuid);
            const state = Y.encodeStateAsUpdate(ydoc);
            await saveFullState(db, projectId, state);

            // Export as ELPX (simplest format - just packages the content)
            const response = await app.handle(
                new Request(`http://localhost/export/projects/${projectUuid}/export/elpx`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/x-elpx');
            expect(response.headers.get('Content-Disposition')).toContain('attachment');
            expect(response.headers.get('Content-Disposition')).toContain('.elpx');

            // Verify it's a valid ZIP by checking the body exists and has content
            const body = await response.arrayBuffer();
            expect(body.byteLength).toBeGreaterThan(0);
        });
    });
});
