/**
 * Tests for Admin Themes Routes
 * Tests the route handlers with mocked dependencies
 */
import { describe, expect, test, beforeEach, beforeAll, afterAll, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { createAdminThemesRoutes, type ThemesDependencies } from './admin-themes';
import type { Theme } from '../db/types';

// JWT secret for testing - MUST be set before creating app
const TEST_JWT_SECRET = 'test-secret-for-admin-themes';

// Store original env
let originalJwtSecret: string | undefined;

beforeAll(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterAll(() => {
    if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalJwtSecret;
    }
});

// Mock data for site theme (is_builtin=0)
const mockTheme: Theme = {
    id: 1,
    dir_name: 'test-theme',
    display_name: 'Test Theme',
    description: 'A test theme',
    version: '1.0.0',
    author: 'Test Author',
    license: 'MIT',
    is_builtin: 0,
    is_enabled: 1,
    is_default: 0,
    sort_order: 1,
    storage_path: 'themes/site/test-theme',
    file_size: 12345,
    uploaded_by: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
};

// Mock base theme (is_builtin=1)
const mockBaseTheme: Theme = {
    id: 2,
    dir_name: 'base',
    display_name: 'Base Theme',
    description: 'Built-in base theme',
    version: '1.0.0',
    author: 'eXeLearning',
    license: 'GPL',
    is_builtin: 1,
    is_enabled: 1,
    is_default: 1,
    sort_order: 0,
    storage_path: null,
    file_size: null,
    uploaded_by: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
};

// Create mock dependencies
function createMockDeps(overrides?: Partial<ThemesDependencies['queries']>): ThemesDependencies {
    return {
        db: {} as ThemesDependencies['db'],
        queries: {
            getSiteThemes: mock(() => Promise.resolve([mockTheme])),
            getEnabledSiteThemes: mock(() => Promise.resolve([mockTheme])),
            getBaseThemes: mock(() => Promise.resolve([mockBaseTheme])),
            findThemeById: mock(() => Promise.resolve(mockTheme)),
            findThemeByDirName: mock(() => Promise.resolve(mockTheme)),
            createTheme: mock(() => Promise.resolve(mockTheme)),
            updateTheme: mock(() => Promise.resolve(mockTheme)),
            deleteTheme: mock(() => Promise.resolve()),
            setDefaultThemeById: mock(() => Promise.resolve({ ...mockTheme, is_default: 1 })),
            clearDefaultTheme: mock(() => Promise.resolve()),
            toggleThemeEnabled: mock(() => Promise.resolve({ ...mockTheme, is_enabled: 0 })),
            themeDirNameExists: mock(() => Promise.resolve(false)),
            getNextSiteThemeSortOrder: mock(() => Promise.resolve(1)),
            getDefaultThemeRecord: mock(() => Promise.resolve(mockTheme)),
            upsertBaseTheme: mock(() => Promise.resolve(mockBaseTheme)),
            getDefaultTheme: mock(() => Promise.resolve({ type: 'base', dirName: 'base' })),
            setDefaultTheme: mock(() => Promise.resolve()),
            ...overrides,
        },
        validator: {
            validateThemeZip: mock(() =>
                Promise.resolve({
                    valid: true,
                    metadata: {
                        name: 'test-theme',
                        title: 'Test Theme',
                        version: '1.0.0',
                        author: 'Test Author',
                        license: 'MIT',
                        description: 'A test theme',
                    },
                }),
            ),
            extractTheme: mock(() => Promise.resolve()),
            slugify: mock((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
        },
        getFilesDir: () => '/tmp/test-files',
    };
}

// Generate a valid admin JWT token
async function generateAdminToken(): Promise<string> {
    const jwtPlugin = jwt({ name: 'jwt', secret: TEST_JWT_SECRET });
    const app = new Elysia().use(jwtPlugin);

    let token = '';
    await app
        .get('/generate', async ({ jwt }) => {
            token = await jwt.sign({
                sub: 1,
                email: 'admin@test.com',
                roles: ['ROLE_ADMIN'],
                isGuest: false,
                exp: Math.floor(Date.now() / 1000) + 3600,
            });
            return token;
        })
        .handle(new Request('http://localhost/generate'));

    return token;
}

// Create test app with routes
function createTestApp(deps: ThemesDependencies) {
    const routes = createAdminThemesRoutes(deps);
    return new Elysia().use(routes);
}

// Create authenticated request
function createAuthRequest(url: string, token: string, options: RequestInit = {}): Request {
    const headers = new Headers(options.headers);
    headers.set('Cookie', `auth=${token}`);
    return new Request(url, { ...options, headers });
}

describe('Admin Themes Routes', () => {
    let mockDeps: ThemesDependencies;
    let app: ReturnType<typeof createTestApp>;
    let adminToken: string;

    beforeEach(async () => {
        mockDeps = createMockDeps();
        app = createTestApp(mockDeps);
        adminToken = await generateAdminToken();
    });

    describe('GET /api/admin/themes', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/themes'));
            expect(response.status).toBe(401);
        });

        test('should return themes list with valid auth', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.themes).toBeDefined();
            expect(Array.isArray(data.themes)).toBe(true);
        });

        test('should return base themes and site themes', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            // Base theme + site theme
            expect(data.themes.length).toBe(2);
        });

        test('should handle getDefaultTheme error gracefully', async () => {
            mockDeps.queries.getDefaultTheme = mock(() => {
                throw new Error('Table not found');
            });
            app = createTestApp(mockDeps);

            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes', adminToken));
            expect(response.status).toBe(200);
        });
    });

    describe('GET /api/admin/themes/default', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/themes/default'));
            expect(response.status).toBe(401);
        });

        test('should return default theme with valid auth', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/default', adminToken),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.type).toBe('base');
            expect(data.dirName).toBe('base');
        });

        test('should return fallback when getDefaultTheme throws', async () => {
            mockDeps.queries.getDefaultTheme = mock(() => {
                throw new Error('Table not found');
            });
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/default', adminToken),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.type).toBe('base');
            expect(data.dirName).toBe('base');
        });
    });

    describe('GET /api/admin/themes/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/themes/1'));
            expect(response.status).toBe(401);
        });

        test('should return theme by ID with valid auth', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes/1', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.id).toBe(1);
            expect(data.dirName).toBe('test-theme');
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/invalid', adminToken),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when theme not found', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes/999', adminToken));
            expect(response.status).toBe(404);
        });

        test('should return correct source for base theme', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(mockBaseTheme));
            app = createTestApp(mockDeps);

            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes/2', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.source).toBe('base');
        });
    });

    describe('POST /api/admin/themes/upload', () => {
        test('should return 401 without auth token', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/upload', {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should upload theme successfully', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.id).toBe(1);
        });

        test('should return 400 when validation fails', async () => {
            mockDeps.validator.validateThemeZip = mock(() => Promise.resolve({ valid: false, error: 'Invalid ZIP' }));
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toBe('Invalid ZIP');
        });

        test('should return 400 when slugify returns empty', async () => {
            mockDeps.validator.slugify = mock(() => '');
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Could not generate valid directory name');
        });

        test('should return 400 when theme name conflicts with base theme', async () => {
            mockDeps.validator.slugify = mock(() => 'base'); // BASE_THEME_NAMES includes 'base'
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('conflicts with a built-in theme');
        });

        test('should return 400 when theme already exists', async () => {
            mockDeps.queries.themeDirNameExists = mock(() => Promise.resolve(true));
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('already exists');
        });

        test('should return 500 when extractTheme throws error', async () => {
            mockDeps.validator.extractTheme = mock(() => {
                throw new Error('Disk full');
            });
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.message).toBe('Disk full');
        });

        test('should return 500 with unknown error message', async () => {
            mockDeps.validator.extractTheme = mock(() => {
                throw 'non-error object';
            });
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.zip');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.message).toBe('Unknown error');
        });
    });

    describe('PATCH /api/admin/themes/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/1', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/invalid', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when theme not found', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/999', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should update theme successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name', description: 'New desc', sortOrder: 5 }),
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should return 500 when update fails', async () => {
            mockDeps.queries.updateTheme = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(500);
        });

        test('should return correct source for updated base theme', async () => {
            mockDeps.queries.updateTheme = mock(() => Promise.resolve(mockBaseTheme));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/2', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.source).toBe('base');
        });
    });

    describe('PATCH /api/admin/themes/:id/enabled', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/1/enabled', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/invalid/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when theme not found', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/999/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should toggle enabled successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should return 500 when toggle fails', async () => {
            mockDeps.queries.toggleThemeEnabled = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(500);
        });
    });

    describe('PATCH /api/admin/themes/:id/default', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/1/default', {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/invalid/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when theme not found', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/999/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should return 400 when trying to set disabled theme as default', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve({ ...mockTheme, is_enabled: 0 }));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Cannot set disabled theme as default');
        });

        test('should set theme as default successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should return 500 when setDefaultThemeById fails', async () => {
            mockDeps.queries.setDefaultThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(500);
        });

        test('should set base theme type when is_builtin=1', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(mockBaseTheme));
            mockDeps.queries.setDefaultThemeById = mock(() => Promise.resolve({ ...mockBaseTheme, is_default: 1 }));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/2/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.source).toBe('base');
        });
    });

    describe('DELETE /api/admin/themes/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/1', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/invalid', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when theme not found', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/999', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should return 400 when trying to delete built-in theme', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve(mockBaseTheme));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/2', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Cannot delete built-in themes');
        });

        test('should delete theme successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        test('should reset default to base when deleting default site theme', async () => {
            mockDeps.queries.getDefaultTheme = mock(() => Promise.resolve({ type: 'site', dirName: 'test-theme' }));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(200);
            expect(mockDeps.queries.setDefaultTheme).toHaveBeenCalled();
        });

        test('should handle getDefaultTheme error during delete', async () => {
            mockDeps.queries.getDefaultTheme = mock(() => {
                throw new Error('Table not found');
            });
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should handle theme without storage_path', async () => {
            mockDeps.queries.findThemeById = mock(() => Promise.resolve({ ...mockTheme, storage_path: null }));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/1', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/admin/themes/default', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/default', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });
    });

    describe('PATCH /api/admin/themes/builtin/:dirName/enabled', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/builtin/base/enabled', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 404 when base theme not found', async () => {
            mockDeps.queries.getBaseThemes = mock(() => Promise.resolve([]));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/nonexistent/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should return 400 when trying to disable default theme', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/base/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Cannot disable the default theme');
        });

        test('should toggle base theme enabled successfully', async () => {
            // Non-default theme
            mockDeps.queries.getDefaultTheme = mock(() => Promise.resolve({ type: 'site', dirName: 'other-theme' }));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/base/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: true }),
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        test('should handle getDefaultTheme error and reject disabling base', async () => {
            mockDeps.queries.getDefaultTheme = mock(() => {
                throw new Error('Table not found');
            });
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/base/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should allow disabling non-base theme when getDefaultTheme throws', async () => {
            // Add a non-base theme
            mockDeps.queries.getBaseThemes = mock(() =>
                Promise.resolve([mockBaseTheme, { ...mockBaseTheme, id: 3, dir_name: 'other' }]),
            );
            mockDeps.queries.getDefaultTheme = mock(() => {
                throw new Error('Table not found');
            });
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/other/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(200);
        });
    });

    describe('PATCH /api/admin/themes/builtin/:dirName/default', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/builtin/base/default', {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 404 when base theme not found', async () => {
            mockDeps.queries.getBaseThemes = mock(() => Promise.resolve([]));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/nonexistent/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should return 400 when trying to set disabled theme as default', async () => {
            mockDeps.queries.getBaseThemes = mock(() => Promise.resolve([{ ...mockBaseTheme, is_enabled: 0 }]));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/base/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Cannot set disabled theme as default');
        });

        test('should set base theme as default successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/themes/builtin/base/default', adminToken, {
                    method: 'PATCH',
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.type).toBe('base');
            expect(data.dirName).toBe('base');
        });
    });

    describe('serializeTheme', () => {
        test('mock theme should have all required fields', () => {
            expect(mockTheme.id).toBe(1);
            expect(mockTheme.dir_name).toBe('test-theme');
            expect(mockTheme.display_name).toBe('Test Theme');
            expect(mockTheme.is_enabled).toBe(1);
            expect(mockTheme.is_default).toBe(0);
        });
    });

    describe('Factory function', () => {
        test('createAdminThemesRoutes should create routes with custom dependencies', () => {
            const customDeps = createMockDeps();
            const routes = createAdminThemesRoutes(customDeps);
            expect(routes).toBeDefined();
        });

        test('createAdminThemesRoutes should work with default dependencies', () => {
            expect(() => createAdminThemesRoutes()).not.toThrow();
        });
    });

    describe('Guard middleware', () => {
        test('should return 401 for invalid token', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes', 'invalid-token'));
            expect(response.status).toBe(401);
        });

        test('should return 403 for non-admin user', async () => {
            const jwtPlugin = jwt({ name: 'jwt', secret: TEST_JWT_SECRET });
            const tokenApp = new Elysia().use(jwtPlugin);
            let userToken = '';
            await tokenApp
                .get('/generate', async ({ jwt }) => {
                    userToken = await jwt.sign({
                        sub: 2,
                        email: 'user@test.com',
                        roles: ['ROLE_USER'],
                        isGuest: false,
                        exp: Math.floor(Date.now() / 1000) + 3600,
                    });
                    return userToken;
                })
                .handle(new Request('http://localhost/generate'));

            const response = await app.handle(createAuthRequest('http://localhost/api/admin/themes', userToken));
            expect(response.status).toBe(403);
        });
    });
});
