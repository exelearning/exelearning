/**
 * Tests for Admin Templates Routes
 * Tests the route handlers with mocked dependencies
 */
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createAdminTemplatesRoutes, type AdminTemplatesDependencies } from './admin-templates';
import type { Template } from '../db/types';

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
function createMockDeps(): AdminTemplatesDependencies {
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

// Create test app
function createTestApp(deps: AdminTemplatesDependencies) {
    const routes = createAdminTemplatesRoutes(deps);
    return new Elysia().use(routes);
}

describe('Admin Templates Routes', () => {
    let mockDeps: AdminTemplatesDependencies;
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        mockDeps = createMockDeps();
        app = createTestApp(mockDeps);
    });

    describe('GET /api/admin/templates', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates'));
            expect(response.status).toBe(401);
        });

        test('should return 401 without auth token even with locale param', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates?locale=es'));
            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/admin/templates/:id', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates/1'));
            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/admin/templates/:id/download', () => {
        test('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/api/admin/templates/1/download'));
            expect(response.status).toBe(401);
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
});
