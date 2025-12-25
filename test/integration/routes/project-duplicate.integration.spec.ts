/**
 * Project Duplication Integration Tests
 * Tests that duplicating a project correctly updates the title in both
 * the database and the YJS document
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import {
    createTestDb,
    closeTestDb,
    createTestUser,
    generateTestToken,
    createTestProject,
    testRequest,
    parseJsonResponse,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

describe('Project Duplication - YJS Title Update', () => {
    let db: Kysely<Database>;
    let testUser: User;
    let app: Elysia;

    beforeAll(async () => {
        // Create test database
        db = await createTestDb();

        // Create test user
        testUser = await createTestUser(db, { email: 'duplicate_test@test.local' });

        // Create a test app with the duplicate endpoint that uses our test db
        app = new Elysia({ name: 'project-duplicate-test' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: TEST_JWT_SECRET,
                    exp: '1h',
                }),
            )
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;

                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { currentUser: null, testDb: db };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null, testDb: db };
                    }
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return {
                        currentUser: user ? { ...user, roles: JSON.parse(user.roles) } : null,
                        testDb: db,
                    };
                } catch {
                    return { currentUser: null, testDb: db };
                }
            })
            // POST /api/projects/uuid/:uuid/duplicate - Duplicate project by UUID
            // This is a copy of the real endpoint logic to test with our test db
            .post('/api/projects/uuid/:uuid/duplicate', async ({ params, testDb, set }) => {
                const uuid = params.uuid;

                // Find project by UUID
                const project = await testDb
                    .selectFrom('projects')
                    .selectAll()
                    .where('uuid', '=', uuid)
                    .executeTakeFirst();

                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // Generate new UUID for the duplicate
                const newUuid = uuidv4();

                // Create duplicate project with new UUID
                const duplicateProject = await testDb
                    .insertInto('projects')
                    .values({
                        uuid: newUuid,
                        title: `${project.title} (copy)`,
                        owner_id: project.owner_id,
                        description: project.description || null,
                        visibility: project.visibility || 'private',
                        language: project.language || null,
                        author: project.author || null,
                        license: project.license || null,
                        status: 'active',
                        saved_once: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .returning(['id', 'uuid', 'title'])
                    .executeTakeFirstOrThrow();

                // Copy Yjs document state if exists, updating the title in metadata
                const snapshot = await testDb
                    .selectFrom('yjs_documents')
                    .select(['snapshot_data', 'snapshot_version'])
                    .where('project_id', '=', project.id)
                    .executeTakeFirst();

                if (snapshot) {
                    // Load snapshot into Y.Doc
                    const ydoc = new Y.Doc();
                    Y.applyUpdate(ydoc, new Uint8Array(snapshot.snapshot_data));

                    // Update title in metadata
                    const metadata = ydoc.getMap('metadata');
                    metadata.set('title', `${project.title} (copy)`);

                    // Encode modified state
                    const newState = Y.encodeStateAsUpdate(ydoc);
                    ydoc.destroy();

                    // Save with updated title
                    await testDb
                        .insertInto('yjs_documents')
                        .values({
                            project_id: duplicateProject.id,
                            snapshot_data: newState,
                            snapshot_version: Date.now().toString(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .execute();
                }

                return {
                    success: true,
                    message: 'Project duplicated',
                    newProjectId: newUuid,
                    project: {
                        id: duplicateProject.id,
                        uuid: newUuid,
                        title: duplicateProject.title,
                    },
                };
            });
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    /**
     * Helper: Create a YJS document with a title in metadata
     */
    function createYjsDocumentWithTitle(title: string): Uint8Array {
        const ydoc = new Y.Doc();
        const metadata = ydoc.getMap('metadata');
        metadata.set('title', title);
        metadata.set('author', 'Test Author');
        metadata.set('description', 'Test Description');
        metadata.set('language', 'en');

        const state = Y.encodeStateAsUpdate(ydoc);
        ydoc.destroy();
        return state;
    }

    /**
     * Helper: Read the title from a YJS document state
     */
    function readTitleFromYjsState(state: Uint8Array | Buffer): string {
        const ydoc = new Y.Doc();
        Y.applyUpdate(ydoc, new Uint8Array(state));
        const metadata = ydoc.getMap('metadata');
        const title = metadata.get('title') as string;
        ydoc.destroy();
        return title;
    }

    describe('POST /api/projects/uuid/:uuid/duplicate', () => {
        it('should update the title in the YJS document when duplicating', async () => {
            const originalTitle = 'My Original Project';

            // 1. Create a project with a YJS document containing a title
            const project = await createTestProject(db, testUser.id, {
                title: originalTitle,
            });

            // Mark as saved so it can be duplicated
            await db.updateTable('projects').set({ saved_once: 1 }).where('id', '=', project.id).execute();

            // Create YJS document with the title in metadata
            const yjsState = createYjsDocumentWithTitle(originalTitle);
            await db
                .insertInto('yjs_documents')
                .values({
                    project_id: project.id,
                    snapshot_data: yjsState,
                    snapshot_version: Date.now().toString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .execute();

            // 2. Duplicate the project via the API
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/uuid/${project.uuid}/duplicate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                success: boolean;
                newProjectId: string;
                project: { id: number; uuid: string; title: string };
            }>(response);

            expect(body.success).toBe(true);
            expect(body.project.title).toBe(`${originalTitle} (copy)`);

            // 3. Verify the duplicated project's YJS document has the updated title
            const duplicatedYjsDoc = await db
                .selectFrom('yjs_documents')
                .select(['snapshot_data'])
                .where('project_id', '=', body.project.id)
                .executeTakeFirst();

            expect(duplicatedYjsDoc).toBeDefined();
            expect(duplicatedYjsDoc!.snapshot_data).toBeDefined();

            const duplicatedTitle = readTitleFromYjsState(duplicatedYjsDoc!.snapshot_data);
            expect(duplicatedTitle).toBe(`${originalTitle} (copy)`);
        });

        it('should handle project without YJS document gracefully', async () => {
            // Create a project WITHOUT a YJS document
            const project = await createTestProject(db, testUser.id, {
                title: 'Project Without YJS',
            });

            // Mark as saved
            await db.updateTable('projects').set({ saved_once: 1 }).where('id', '=', project.id).execute();

            // Duplicate the project
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/uuid/${project.uuid}/duplicate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ success: boolean; project: { id: number; title: string } }>(
                response,
            );
            expect(body.success).toBe(true);
            expect(body.project.title).toBe('Project Without YJS (copy)');

            // Should not have created a YJS document for the duplicate
            const yjsDoc = await db
                .selectFrom('yjs_documents')
                .select(['id'])
                .where('project_id', '=', body.project.id)
                .executeTakeFirst();

            expect(yjsDoc).toBeUndefined();
        });

        it('should preserve other metadata fields when duplicating', async () => {
            const originalTitle = 'Project With Full Metadata';

            // Create project with YJS document containing full metadata
            const project = await createTestProject(db, testUser.id, {
                title: originalTitle,
            });

            await db.updateTable('projects').set({ saved_once: 1 }).where('id', '=', project.id).execute();

            // Create YJS document with full metadata
            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');
            metadata.set('title', originalTitle);
            metadata.set('author', 'John Doe');
            metadata.set('description', 'A comprehensive test project');
            metadata.set('language', 'es');
            metadata.set('license', 'CC BY-SA');
            metadata.set('theme', 'modern');

            const yjsState = Y.encodeStateAsUpdate(ydoc);
            ydoc.destroy();

            await db
                .insertInto('yjs_documents')
                .values({
                    project_id: project.id,
                    snapshot_data: yjsState,
                    snapshot_version: Date.now().toString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .execute();

            // Duplicate the project
            const token = await generateTestToken(testUser);
            const response = await testRequest(app, `/api/projects/uuid/${project.uuid}/duplicate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ project: { id: number } }>(response);

            // Read the duplicated YJS document
            const duplicatedYjsDoc = await db
                .selectFrom('yjs_documents')
                .select(['snapshot_data'])
                .where('project_id', '=', body.project.id)
                .executeTakeFirst();

            expect(duplicatedYjsDoc).toBeDefined();

            // Verify all metadata
            const dupDoc = new Y.Doc();
            Y.applyUpdate(dupDoc, new Uint8Array(duplicatedYjsDoc!.snapshot_data));
            const dupMetadata = dupDoc.getMap('metadata');

            // Title should be updated
            expect(dupMetadata.get('title')).toBe(`${originalTitle} (copy)`);

            // Other fields should be preserved
            expect(dupMetadata.get('author')).toBe('John Doe');
            expect(dupMetadata.get('description')).toBe('A comprehensive test project');
            expect(dupMetadata.get('language')).toBe('es');
            expect(dupMetadata.get('license')).toBe('CC BY-SA');
            expect(dupMetadata.get('theme')).toBe('modern');

            dupDoc.destroy();
        });
    });
});
