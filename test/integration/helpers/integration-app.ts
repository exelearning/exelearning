/**
 * Integration Test App Helper
 * Creates Elysia app with in-memory SQLite for integration tests
 */
import { Elysia } from 'elysia';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Database, User, NewUser } from '../../../src/db/types';
import { migrateToLatest } from '../../../src/db/migrations';

// ============================================================================
// TEST DATABASE
// ============================================================================

/**
 * Create an in-memory SQLite database for tests
 */
export async function createTestDb(): Promise<Kysely<Database>> {
    const db = new Kysely<Database>({
        dialect: new BunSqliteDialect({
            url: ':memory:',
        }),
    });

    // Run all migrations using the new migration system
    await migrateToLatest(db);

    return db;
}

/**
 * Create a temporary directory for test files
 */
export async function createTestFilesDir(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'test', 'temp', `files-${uuidv4()}`);
    await fs.ensureDir(tempDir);
    await fs.ensureDir(path.join(tempDir, 'tmp'));
    await fs.ensureDir(path.join(tempDir, 'dist'));
    await fs.ensureDir(path.join(tempDir, 'perm'));
    return tempDir;
}

/**
 * Cleanup test files directory
 */
export async function cleanupTestFilesDir(dir: string): Promise<void> {
    if (dir.includes('test/temp')) {
        await fs.remove(dir);
    }
}

// ============================================================================
// TEST USER MANAGEMENT
// ============================================================================

/**
 * Create a test user in the database
 */
export async function createTestUser(db: Kysely<Database>, userData: Partial<NewUser> = {}): Promise<User> {
    const email = userData.email || `test_${uuidv4().slice(0, 8)}@test.local`;
    const password = userData.password || 'test1234';
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db
        .insertInto('users')
        .values({
            email,
            user_id: userData.user_id || `test_${uuidv4().slice(0, 32)}`,
            password: hashedPassword,
            roles: userData.roles || '["ROLE_USER"]',
            is_lopd_accepted: userData.is_lopd_accepted ?? 1,
            quota_mb: userData.quota_mb ?? 4096,
            is_active: userData.is_active ?? 1,
            created_at: Date.now(),
            updated_at: Date.now(),
        })
        .returning([
            'id',
            'email',
            'user_id',
            'password',
            'roles',
            'is_lopd_accepted',
            'quota_mb',
            'external_identifier',
            'api_token',
            'is_active',
            'created_at',
            'updated_at',
        ])
        .executeTakeFirstOrThrow();

    return {
        ...result,
        roles: JSON.parse(result.roles),
    } as User;
}

/**
 * Find user by email
 */
export async function findTestUser(db: Kysely<Database>, email: string): Promise<User | null> {
    const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();

    if (!user) return null;

    return {
        ...user,
        roles: JSON.parse(user.roles),
    } as User;
}

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

export interface TestJwtPayload {
    sub: number;
    email: string;
    roles: string[];
    isGuest?: boolean;
    authMethod?: 'local' | 'cas' | 'openid' | 'saml' | 'guest';
}

/**
 * Generate a JWT token for a test user
 */
export async function generateTestToken(user: User): Promise<string> {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);

    const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        roles: user.roles,
        isGuest: false,
        authMethod: 'local',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);

    return token;
}

/**
 * Generate a guest JWT token
 */
export async function generateGuestToken(user: User): Promise<string> {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);

    const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        roles: ['ROLE_GUEST'],
        isGuest: true,
        authMethod: 'guest',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);

    return token;
}

// ============================================================================
// TEST APP CREATION
// ============================================================================

export interface TestAppContext {
    app: Elysia;
    db: Kysely<Database>;
    filesDir: string;
    cleanup: () => Promise<void>;
}

/**
 * Create a minimal test app with auth derive context
 * This is useful for testing routes that need authentication
 */
export function createMinimalTestApp(db: Kysely<Database>): Elysia {
    return new Elysia({ name: 'test-app' })
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

            // Get token from Authorization header
            const authHeader = request.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            } else if (cookie.auth?.value) {
                token = cookie.auth.value;
            }

            if (!token) {
                return {
                    auth: { user: null, isAuthenticated: false, isGuest: false },
                    testDb: db,
                };
            }

            try {
                const payload = (await jwt.verify(token)) as TestJwtPayload | false;

                if (!payload || !payload.sub) {
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        testDb: db,
                    };
                }

                const user = await db.selectFrom('users').selectAll().where('id', '=', payload.sub).executeTakeFirst();

                if (!user) {
                    return {
                        auth: { user: null, isAuthenticated: false, isGuest: false },
                        testDb: db,
                    };
                }

                const parsedUser = {
                    ...user,
                    roles: JSON.parse(user.roles),
                } as User;

                return {
                    auth: {
                        user: parsedUser,
                        isAuthenticated: true,
                        isGuest: payload.isGuest || false,
                    },
                    testDb: db,
                };
            } catch {
                return {
                    auth: { user: null, isAuthenticated: false, isGuest: false },
                    testDb: db,
                };
            }
        });
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Make a test request to the app
 */
export async function testRequest(app: Elysia, path: string, options: RequestInit = {}): Promise<Response> {
    return app.handle(new Request(`http://localhost${path}`, options));
}

/**
 * Make an authenticated test request
 */
export async function authenticatedRequest(
    app: Elysia,
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<Response> {
    return testRequest(app, path, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    });
}

/**
 * Make a JSON POST request
 */
export async function jsonPost(
    app: Elysia,
    path: string,
    body: unknown,
    options: { token?: string } = {},
): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }

    return testRequest(app, path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

/**
 * Parse JSON response
 */
export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
    const text = await response.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`Failed to parse JSON response: ${text}`);
    }
}

// ============================================================================
// PROJECT HELPERS
// ============================================================================

/**
 * Create a test project in the database
 */
export async function createTestProject(
    db: Kysely<Database>,
    ownerId: number,
    data: Partial<{
        uuid: string;
        title: string;
        description: string;
        status: string;
        visibility: string;
        language: string;
    }> = {},
): Promise<{ id: number; uuid: string }> {
    const uuid = data.uuid || uuidv4();

    const result = await db
        .insertInto('projects')
        .values({
            uuid,
            title: data.title || 'Test Project',
            description: data.description || null,
            owner_id: ownerId,
            status: data.status || 'active',
            visibility: data.visibility || 'private',
            language: data.language || 'en',
            author: null,
            license: null,
            last_accessed_at: null,
            saved_once: 0,
            created_at: Date.now(),
            updated_at: Date.now(),
        })
        .returning(['id', 'uuid'])
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Create a Yjs document for a project
 */
export async function createTestYjsDocument(
    db: Kysely<Database>,
    projectId: number,
    snapshotData: Uint8Array = new Uint8Array([0]),
): Promise<number> {
    const result = await db
        .insertInto('yjs_documents')
        .values({
            project_id: projectId,
            snapshot_data: snapshotData,
            snapshot_version: '1',
            created_at: Date.now(),
            updated_at: Date.now(),
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

    return result.id;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close database connection
 */
export async function closeTestDb(db: Kysely<Database>): Promise<void> {
    await db.destroy();
}

/**
 * Full cleanup for test context
 */
export async function cleanupTestContext(ctx: TestAppContext): Promise<void> {
    await closeTestDb(ctx.db);
    await cleanupTestFilesDir(ctx.filesDir);
}
