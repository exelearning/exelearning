/**
 * ELP Import Integration Tests
 * Tests the ELP import flow including elpImportPath response and cleanup
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Kysely } from 'kysely';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    createTestDb,
    closeTestDb,
    createTestUser,
    createTestFilesDir,
    cleanupTestFilesDir,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';

const TEST_JWT_SECRET = 'test_secret_for_elp_import_tests';
const TEST_ELP = 'test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx';

// In-memory session storage for tests
const testSessions = new Map<
    string,
    {
        sessionId: string;
        fileName: string;
        filePath: string;
        createdAt: Date;
        updatedAt: Date;
    }
>();

describe('ELP Import Flow Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let testUser: User;
    let filesDir: string;
    let authToken: string;

    beforeAll(async () => {
        // Check test fixture exists
        if (!(await fs.pathExists(TEST_ELP))) {
            console.warn(`Test ELP file not found: ${TEST_ELP}, skipping tests`);
            return;
        }

        // Create test database and files directory
        db = await createTestDb();
        filesDir = await createTestFilesDir();

        // Create test user
        testUser = await createTestUser(db, { email: 'elp_import_test@test.local' });

        // Create test app with required routes
        app = new Elysia({ name: 'elp-import-test' })
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
                    return { currentUser: null, testDb: db, filesDir };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null, testDb: db, filesDir };
                    }
                    const user = await db
                        .selectFrom('users')
                        .selectAll()
                        .where('id', '=', payload.sub)
                        .executeTakeFirst();
                    return {
                        currentUser: user ? { ...user, roles: JSON.parse(user.roles) } : null,
                        testDb: db,
                        filesDir,
                    };
                } catch {
                    return { currentUser: null, testDb: db, filesDir };
                }
            })
            // POST /api/ode-management/odes/ode/local/large/elp/open - Upload chunk
            .post('/api/ode-management/odes/ode/local/large/elp/open', async ({ body, filesDir }) => {
                const data = body as any;
                const odeFilePart = data.odeFilePart;
                const odeFileName = data.odeFileName;
                const odeSessionId = data.odeSessionId;

                if (!odeFilePart || !odeFileName || !odeSessionId) {
                    return {
                        responseMessage: 'error: odeFilePart, odeFileName, and odeSessionId are required',
                    };
                }

                // Ensure temp directory exists
                const tempDir = path.join(filesDir, 'tmp', odeSessionId);
                await fs.ensureDir(tempDir);

                const targetPath = path.join(tempDir, odeFileName);

                // Get chunk buffer
                let chunkBuffer: Buffer;
                if (odeFilePart instanceof Blob) {
                    chunkBuffer = Buffer.from(await odeFilePart.arrayBuffer());
                } else if (Buffer.isBuffer(odeFilePart)) {
                    chunkBuffer = odeFilePart;
                } else {
                    chunkBuffer = Buffer.from(odeFilePart);
                }

                // Write chunk
                await fs.appendFile(targetPath, chunkBuffer);

                return {
                    responseMessage: 'OK',
                    odeFilePath: targetPath,
                    odeFileName,
                };
            })
            // POST /api/ode-management/odes/ode/local/elp/open - Open ELP
            .post(
                '/api/ode-management/odes/ode/local/elp/open',
                async ({ body, currentUser, testDb, filesDir, set }) => {
                    if (!currentUser) {
                        set.status = 401;
                        return { responseMessage: 'error: Authentication required' };
                    }

                    const data = body as any;
                    const odeFilePath = Array.isArray(data.odeFilePath) ? data.odeFilePath[0] : data.odeFilePath;
                    const odeFileName = Array.isArray(data.odeFileName) ? data.odeFileName[0] : data.odeFileName;

                    if (!odeFilePath) {
                        set.status = 400;
                        return { responseMessage: 'error: odeFilePath is required' };
                    }

                    if (!(await fs.pathExists(odeFilePath))) {
                        set.status = 400;
                        return { responseMessage: `error: File not found: ${odeFilePath}` };
                    }

                    // Create project in database
                    const projectTitle = odeFileName?.replace('.elp', '').replace('.elpx', '') || 'Test Project';
                    const projectUuid = uuidv4();

                    const projectResult = await testDb
                        .insertInto('projects')
                        .values({
                            uuid: projectUuid,
                            title: projectTitle,
                            owner_id: currentUser.id,
                            saved_once: 0,
                            visibility: 'private',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .returning(['id', 'uuid'])
                        .executeTakeFirstOrThrow();

                    // Create session directory
                    const sessionId = projectResult.uuid;
                    const tempDir = path.join(filesDir, 'tmp', sessionId);
                    await fs.ensureDir(tempDir);

                    // Extract ZIP to session temp dir (simplified for test)
                    const { unzipSync } = await import('../../../src/shared/export');
                    const zipBuffer = await fs.readFile(odeFilePath);
                    const zip = unzipSync(new Uint8Array(zipBuffer));

                    // Extract all files (skip directory entries)
                    for (const [filePath, fileData] of Object.entries(zip)) {
                        // Skip directory entries (paths ending with /)
                        if (filePath.endsWith('/')) {
                            await fs.ensureDir(path.join(tempDir, filePath));
                            continue;
                        }
                        const outputPath = path.join(tempDir, filePath);
                        await fs.ensureDir(path.dirname(outputPath));
                        await fs.writeFile(outputPath, Buffer.from(fileData));
                    }

                    // Create session
                    testSessions.set(sessionId, {
                        sessionId,
                        fileName: odeFileName,
                        filePath: tempDir,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    // Copy ELP file to temp directory for frontend to fetch
                    const importFileName = `${sessionId}.elp`;
                    const importFilePath = path.join(tempDir, importFileName);
                    await fs.copy(odeFilePath, importFilePath);

                    // Clean up original uploaded file
                    await fs.remove(odeFilePath).catch(() => {});

                    // Return the import path for frontend to fetch ELP
                    const elpImportPath = `/files/tmp/${sessionId}/${importFileName}`;

                    return {
                        responseMessage: 'OK',
                        odeSessionId: sessionId,
                        odeName: odeFileName,
                        projectId: projectResult.id,
                        projectUuid: projectResult.uuid,
                        elpImportPath, // This is the critical field being tested
                    };
                },
            )
            // DELETE /api/project/cleanup-import - Cleanup temp import file
            .delete('/api/project/cleanup-import', async ({ query, filesDir }) => {
                const importPath = query.path as string;

                if (!importPath) {
                    return { success: false, message: 'No path provided' };
                }

                try {
                    const cleanPath = importPath.replace(/^\/files\//, '');
                    const fullPath = path.join(filesDir, cleanPath);

                    // Verify the path is within the allowed directory
                    const resolvedPath = path.resolve(fullPath);
                    const allowedBase = path.resolve(path.join(filesDir, 'tmp'));

                    if (!resolvedPath.startsWith(allowedBase)) {
                        return { success: false, message: 'Invalid path' };
                    }

                    // Only delete .elp/.elpx files
                    if (!resolvedPath.endsWith('.elp') && !resolvedPath.endsWith('.elpx')) {
                        return { success: false, message: 'Invalid file type' };
                    }

                    if (await fs.pathExists(fullPath)) {
                        await fs.remove(fullPath);
                    }

                    return { success: true, message: 'File cleaned up' };
                } catch (error: any) {
                    return { success: false, message: error.message };
                }
            })
            // GET /files/:path* - Static file serving for testing
            .get('/files/*', async ({ params, filesDir, set }) => {
                const filePath = (params as any)['*'];
                const fullPath = path.join(filesDir, filePath);

                if (!(await fs.pathExists(fullPath))) {
                    set.status = 404;
                    return { error: 'File not found' };
                }

                const content = await fs.readFile(fullPath);
                set.headers['content-type'] = 'application/octet-stream';
                return content;
            });

        // Generate auth token
        const _jwtInstance = jwt({
            name: 'jwt',
            secret: TEST_JWT_SECRET,
            exp: '1h',
        });

        // Create signed token
        authToken = await app.decorator.jwt.sign({
            sub: testUser.id,
            email: testUser.email,
        });
    });

    afterAll(async () => {
        if (db) {
            await closeTestDb(db);
        }
        if (filesDir) {
            await cleanupTestFilesDir(filesDir);
        }
        testSessions.clear();
    });

    it('should return elpImportPath when opening ELP file', async () => {
        if (!app) {
            return; // Skip if setup failed
        }

        // Check test fixture exists
        if (!(await fs.pathExists(TEST_ELP))) {
            console.warn('Test ELP file not found, skipping test');
            return;
        }

        const tempSessionId = uuidv4();
        const fileBuffer = await fs.readFile(TEST_ELP);
        const fileName = path.basename(TEST_ELP);

        // Step 1: Upload chunk
        const chunkForm = new FormData();
        chunkForm.append('odeFilePart', new Blob([fileBuffer]));
        chunkForm.append('odeFileName', fileName);
        chunkForm.append('odeSessionId', tempSessionId);

        const chunkRes = await app.handle(
            new Request('http://localhost/api/ode-management/odes/ode/local/large/elp/open', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
                body: chunkForm,
            }),
        );

        const chunkData = await chunkRes.json();
        expect(chunkData.responseMessage).toBe('OK');
        expect(chunkData.odeFilePath).toBeDefined();

        // Step 2: Open ELP
        const openForm = new FormData();
        openForm.append('odeFilePath', chunkData.odeFilePath);
        openForm.append('odeFileName', fileName);

        const openRes = await app.handle(
            new Request('http://localhost/api/ode-management/odes/ode/local/elp/open', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
                body: openForm,
            }),
        );

        const openData = await openRes.json();

        // Verify response includes elpImportPath
        expect(openData.responseMessage).toBe('OK');
        expect(openData.projectUuid).toBeDefined();
        expect(openData.elpImportPath).toBeDefined();
        expect(openData.elpImportPath).toContain('.elp');
        expect(openData.elpImportPath).toContain('/files/tmp/');
    });

    it('should be able to fetch ELP from elpImportPath', async () => {
        if (!app || testSessions.size === 0) {
            console.warn('Previous test must pass first');
            return;
        }

        // Get session from previous test
        const session = Array.from(testSessions.values())[0];
        if (!session) {
            console.warn('No session found from previous test');
            return;
        }

        const elpPath = `/files/tmp/${session.sessionId}/${session.sessionId}.elp`;

        const fetchRes = await app.handle(
            new Request(`http://localhost${elpPath}`, {
                method: 'GET',
            }),
        );

        expect(fetchRes.status).toBe(200);
        expect(fetchRes.headers.get('content-type')).toContain('octet-stream');
    });

    it('should cleanup import file on request', async () => {
        if (!app || testSessions.size === 0) {
            console.warn('Previous test must pass first');
            return;
        }

        // Get session from previous test
        const session = Array.from(testSessions.values())[0];
        if (!session) {
            console.warn('No session found from previous test');
            return;
        }

        const elpPath = `/files/tmp/${session.sessionId}/${session.sessionId}.elp`;

        const cleanupRes = await app.handle(
            new Request(`http://localhost/api/project/cleanup-import?path=${encodeURIComponent(elpPath)}`, {
                method: 'DELETE',
            }),
        );

        const cleanupData = await cleanupRes.json();
        expect(cleanupData.success).toBe(true);
    });

    it('should reject cleanup for paths outside tmp directory', async () => {
        if (!app) {
            return;
        }

        const badPath = '/files/perm/secret.txt';

        const cleanupRes = await app.handle(
            new Request(`http://localhost/api/project/cleanup-import?path=${encodeURIComponent(badPath)}`, {
                method: 'DELETE',
            }),
        );

        const cleanupData = await cleanupRes.json();
        expect(cleanupData.success).toBe(false);
        expect(cleanupData.message).toBe('Invalid path');
    });

    it('should reject cleanup for non-ELP files', async () => {
        if (!app || testSessions.size === 0) {
            return;
        }

        const session = Array.from(testSessions.values())[0];
        if (!session) {
            return;
        }

        const badPath = `/files/tmp/${session.sessionId}/content.xml`;

        const cleanupRes = await app.handle(
            new Request(`http://localhost/api/project/cleanup-import?path=${encodeURIComponent(badPath)}`, {
                method: 'DELETE',
            }),
        );

        const cleanupData = await cleanupRes.json();
        expect(cleanupData.success).toBe(false);
        expect(cleanupData.message).toBe('Invalid file type');
    });
});
