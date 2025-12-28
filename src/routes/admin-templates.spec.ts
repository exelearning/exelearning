/**
 * Tests for Admin Templates Routes
 * Tests the route handlers with mocked dependencies
 */
import { describe, expect, test, beforeEach, beforeAll, afterAll, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { createAdminTemplatesRoutes, type AdminTemplatesDependencies } from './admin-templates';
import type { Template } from '../db/types';

// JWT secret for testing - MUST be set before creating app
const TEST_JWT_SECRET = 'test-secret-for-admin-templates';

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

// Mock data
const mockTemplate: Template = {
    id: 1,
    filename: 'test-template',
    display_name: 'Test Template',
    description: 'A test template',
    locale: 'es',
    is_enabled: 1,
    sort_order: 1,
    storage_path: 'templates/es/test-template.elpx',
    file_size: 54321,
    preview_image: null,
    uploaded_by: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
};

// Create mock dependencies
function createMockDeps(overrides?: Partial<AdminTemplatesDependencies['queries']>): AdminTemplatesDependencies {
    return {
        db: {} as AdminTemplatesDependencies['db'],
        queries: {
            getAllTemplates: mock(() => Promise.resolve([mockTemplate])),
            getTemplatesByLocale: mock(() => Promise.resolve([mockTemplate])),
            getEnabledTemplatesByLocale: mock(() => Promise.resolve([mockTemplate])),
            findTemplateById: mock(() => Promise.resolve(mockTemplate)),
            findTemplateByFilenameAndLocale: mock(() => Promise.resolve(mockTemplate)),
            createTemplate: mock(() => Promise.resolve(mockTemplate)),
            updateTemplate: mock(() => Promise.resolve(mockTemplate)),
            deleteTemplate: mock(() => Promise.resolve()),
            toggleTemplateEnabled: mock(() => Promise.resolve({ ...mockTemplate, is_enabled: 0 })),
            templateFilenameExists: mock(() => Promise.resolve(false)),
            getNextTemplateSortOrder: mock(() => Promise.resolve(1)),
            getDistinctLocales: mock(() => Promise.resolve(['es', 'en'])),
            ...overrides,
        },
        validator: {
            validateTemplateZip: mock(() =>
                Promise.resolve({
                    valid: true,
                }),
            ),
            extractTemplate: mock(() => Promise.resolve()),
            slugify: mock((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
        },
        getFilesDir: () => '/tmp/test-files',
    };
}

// Generate a valid admin JWT token
async function generateAdminToken(): Promise<string> {
    const jwtPlugin = jwt({ name: 'jwt', secret: TEST_JWT_SECRET });
    const app = new Elysia().use(jwtPlugin);

    // Access jwt through derive
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
function createTestApp(deps: AdminTemplatesDependencies) {
    const routes = createAdminTemplatesRoutes(deps);
    return new Elysia().use(routes);
}

// Create authenticated request
function createAuthRequest(url: string, token: string, options: RequestInit = {}): Request {
    const headers = new Headers(options.headers);
    headers.set('Cookie', `auth=${token}`);
    return new Request(url, { ...options, headers });
}

describe('Admin Templates Routes', () => {
    let mockDeps: AdminTemplatesDependencies;
    let app: ReturnType<typeof createTestApp>;
    let adminToken: string;

    beforeEach(async () => {
        mockDeps = createMockDeps();
        app = createTestApp(mockDeps);
        adminToken = await generateAdminToken();
    });

    describe('GET /api/admin/templates', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates'));
            expect(response.status).toBe(401);
        });

        test('should return templates list with valid auth', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/templates', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.templates).toHaveLength(1);
            expect(data.templates[0].filename).toBe('test-template');
            expect(data.locales).toEqual(['es', 'en']);
        });

        test('should filter by locale when provided', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates?locale=es', adminToken),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.templates).toHaveLength(1);
        });
    });

    describe('GET /api/admin/templates/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates/1'));
            expect(response.status).toBe(401);
        });

        test('should return template by ID with valid auth', async () => {
            const response = await app.handle(createAuthRequest('http://localhost/api/admin/templates/1', adminToken));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.id).toBe(1);
            expect(data.filename).toBe('test-template');
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/invalid', adminToken),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when template not found', async () => {
            mockDeps.queries.findTemplateById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/999', adminToken),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/admin/templates/:id/download', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates/1/download'));
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/invalid/download', adminToken),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when template not found', async () => {
            mockDeps.queries.findTemplateById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/999/download', adminToken),
            );
            expect(response.status).toBe(404);
        });

        test('should return 404 when template file not found on disk', async () => {
            // Template exists in DB but file is missing
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1/download', adminToken),
            );
            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.message).toBe('Template file not found');
        });

        test('should download template successfully when file exists', async () => {
            const fs = require('fs-extra');
            const path = require('path');

            // Create a test file
            const testFilePath = path.join('/tmp/test-files', mockTemplate.storage_path);
            await fs.ensureDir(path.dirname(testFilePath));
            await fs.writeFile(testFilePath, Buffer.from('test content'));

            try {
                const response = await app.handle(
                    createAuthRequest('http://localhost/api/admin/templates/1/download', adminToken),
                );
                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toBe('application/zip');
                expect(response.headers.get('content-disposition')).toContain('test-template.elpx');

                const buffer = await response.arrayBuffer();
                expect(buffer.byteLength).toBeGreaterThan(0);
            } finally {
                // Cleanup
                await fs.remove(testFilePath);
            }
        });
    });

    describe('POST /api/admin/templates/upload', () => {
        test('should return 401 without auth token', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                new Request('http://localhost/api/admin/templates/upload', {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid locale', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'invalid-locale');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Invalid locale');
        });

        test('should return 400 when validation fails', async () => {
            mockDeps.validator.validateTemplateZip = mock(() =>
                Promise.resolve({ valid: false, error: 'Invalid ZIP' }),
            );
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 400 when slugify returns empty', async () => {
            mockDeps.validator.slugify = mock(() => '');
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Could not generate valid filename');
        });

        test('should return 400 when template already exists', async () => {
            mockDeps.queries.templateFilenameExists = mock(() => Promise.resolve(true));
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('already exists');
        });

        test('should create template successfully', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');
            formData.append('displayName', 'My Template');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.id).toBe(1);
        });

        test('should return 500 when extractTemplate throws error', async () => {
            mockDeps.validator.extractTemplate = mock(() => {
                throw new Error('Disk full');
            });
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Internal Server Error');
            expect(data.message).toBe('Disk full');
        });

        test('should return 500 with unknown error message', async () => {
            mockDeps.validator.extractTemplate = mock(() => {
                throw 'non-error object';
            });
            app = createTestApp(mockDeps);

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.elpx');
            formData.append('locale', 'es');

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/upload', adminToken, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.message).toBe('Unknown error');
        });
    });

    describe('PATCH /api/admin/templates/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/templates/1', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/invalid', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when template not found', async () => {
            mockDeps.queries.findTemplateById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/999', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should update template successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name', description: 'New desc', sortOrder: 5 }),
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should return 500 when update fails', async () => {
            mockDeps.queries.updateTemplate = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: 'New Name' }),
                }),
            );
            expect(response.status).toBe(500);
        });
    });

    describe('PATCH /api/admin/templates/:id/enabled', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/templates/1/enabled', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/invalid/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when template not found', async () => {
            mockDeps.queries.findTemplateById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/999/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should toggle enabled successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(200);
        });

        test('should return 500 when toggle fails', async () => {
            mockDeps.queries.toggleTemplateEnabled = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1/enabled', adminToken, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: false }),
                }),
            );
            expect(response.status).toBe(500);
        });
    });

    describe('DELETE /api/admin/templates/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/admin/templates/1', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });

        test('should return 400 for invalid ID', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/invalid', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(400);
        });

        test('should return 404 when template not found', async () => {
            mockDeps.queries.findTemplateById = mock(() => Promise.resolve(undefined));
            app = createTestApp(mockDeps);

            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/999', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(404);
        });

        test('should delete template successfully', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates/1', adminToken, {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('serializeTemplate', () => {
        test('mock template should have all required fields', () => {
            // Verify mock template has all required fields for serialization
            expect(mockTemplate.id).toBe(1);
            expect(mockTemplate.filename).toBe('test-template');
            expect(mockTemplate.display_name).toBe('Test Template');
            expect(mockTemplate.locale).toBe('es');
            expect(mockTemplate.is_enabled).toBe(1);
            expect(mockTemplate.sort_order).toBe(1);
            expect(mockTemplate.storage_path).toBe('templates/es/test-template.elpx');
        });
    });

    describe('Factory function', () => {
        test('createAdminTemplatesRoutes should create routes with custom dependencies', () => {
            const customDeps = createMockDeps();
            const routes = createAdminTemplatesRoutes(customDeps);
            expect(routes).toBeDefined();
        });

        test('createAdminTemplatesRoutes should work with default dependencies', () => {
            // Verify it doesn't throw when using defaults
            expect(() => createAdminTemplatesRoutes()).not.toThrow();
        });
    });

    describe('Locale validation', () => {
        test('supported locales constant should include common languages', () => {
            // Import and verify SUPPORTED_LOCALES
            const { SUPPORTED_LOCALES } = require('../services/admin-upload-validator');
            expect(SUPPORTED_LOCALES).toContain('es');
            expect(SUPPORTED_LOCALES).toContain('en');
            expect(SUPPORTED_LOCALES).toContain('fr');
        });
    });

    describe('Guard middleware', () => {
        test('should return 401 for invalid token', async () => {
            const response = await app.handle(
                createAuthRequest('http://localhost/api/admin/templates', 'invalid-token'),
            );
            expect(response.status).toBe(401);
        });

        test('should return 403 for non-admin user', async () => {
            // Generate a non-admin token
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

            const response = await app.handle(createAuthRequest('http://localhost/api/admin/templates', userToken));
            expect(response.status).toBe(403);
        });
    });
});
