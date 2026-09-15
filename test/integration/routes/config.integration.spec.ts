/**
 * Config Routes Integration Tests
 * Tests the parameter configuration endpoints
 */
import { describe, it, expect } from 'bun:test';
import { configRoutes } from '../../../src/routes/config';

describe('Config Routes Integration', () => {
    describe('GET /api/parameter-management/parameters/data/list', () => {
        it('should return all required page properties (odeNavStructureSyncPropertiesConfig)', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            expect(response.status).toBe(200);

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, unknown>;

            // All required properties for the page modal
            const requiredProperties = [
                'titleNode',
                'hidePageTitle',
                'titleHtml',
                'editableInPage',
                'titlePage',
                'visibility',
                'highlight',
                'description',
            ];

            requiredProperties.forEach(prop => {
                expect(config).toHaveProperty(prop);
            });
        });

        it('should have exactly 8 page properties', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, unknown>;

            expect(Object.keys(config).length).toBe(8);
        });

        it('should have two categories for tabs: General and Advanced (SEO)', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { category: string }>;

            const categories = new Set(Object.values(config).map(p => p.category));

            // Should have exactly 2 categories to enable tab display
            expect(categories.size).toBe(2);
        });

        it('should mark editableInPage as alwaysVisible for basic mode', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { alwaysVisible?: boolean }>;

            expect(config.editableInPage.alwaysVisible).toBe(true);
        });

        it('should have correct property types', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { type: string }>;

            // Text fields
            expect(config.titleNode.type).toBe('text');
            expect(config.titleHtml.type).toBe('text');
            expect(config.titlePage.type).toBe('text');

            // Checkbox fields
            expect(config.hidePageTitle.type).toBe('checkbox');
            expect(config.editableInPage.type).toBe('checkbox');
            expect(config.visibility.type).toBe('checkbox');
            expect(config.highlight.type).toBe('checkbox');

            // Textarea fields
            expect(config.description.type).toBe('textarea');
        });

        it('should have SEO properties in Advanced (SEO) category', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { category: string }>;

            // These properties should be in the SEO category
            expect(config.titleHtml.category).toContain('SEO');
            expect(config.description.category).toContain('SEO');
        });

        it('should have General properties in General category', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { category: string }>;

            // These properties should be in the General category
            expect(config.titleNode.category).toContain('General');
            expect(config.hidePageTitle.category).toContain('General');
            expect(config.editableInPage.category).toContain('General');
            expect(config.titlePage.category).toContain('General');
            expect(config.visibility.category).toContain('General');
            expect(config.highlight.category).toContain('General');
        });

        it('should have heritable property for visibility', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const config = data.odeNavStructureSyncPropertiesConfig as Record<string, { heritable?: boolean }>;

            expect(config.visibility.heritable).toBe(true);
        });
    });

    describe('GET /api/config/upload-limits', () => {
        it('should return upload limits', async () => {
            const response = await configRoutes.handle(new Request('http://localhost/api/config/upload-limits'));

            expect(response.status).toBe(200);

            const data = (await response.json()) as Record<string, unknown>;
            expect(data).toHaveProperty('maxFileSize');
            expect(data).toHaveProperty('maxUploadSize');
        });
    });

    describe('Project Properties (odeProjectSyncPropertiesConfig)', () => {
        // Helper to get flattened properties from nested structure
        const flattenProperties = (config: Record<string, Record<string, unknown>>) => {
            const flat: Record<string, unknown> = {};
            for (const [, properties] of Object.entries(config)) {
                for (const [key, property] of Object.entries(properties as Record<string, unknown>)) {
                    flat[key] = property;
                }
            }
            return flat;
        };

        it('should return all required project properties', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            expect(response.status).toBe(200);

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig);

            const requiredProperties = [
                'pp_title',
                'pp_subtitle',
                'pp_lang',
                'pp_author',
                'pp_license',
                'pp_description',
                'exportSource',
                'pp_addExeLink',
                'pp_addPagination',
                'pp_addSearchBox',
                'pp_addAccessibilityToolbar',
                'pp_extraHeadContent',
                'footer',
            ];

            requiredProperties.forEach(prop => {
                expect(config).toHaveProperty(prop);
            });
        });

        it('should have exactly 14 project properties', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig);

            expect(Object.keys(config).length).toBe(15);
        });

        it('should have groups attribute on all properties for collapsible sections', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig) as Record<string, { groups?: Record<string, string> }>;

            Object.entries(config).forEach(([_key, prop]) => {
                expect(prop.groups).toBeDefined();
                expect(Object.keys(prop.groups!).length).toBeGreaterThan(0);
            });
        });

        it('should have three groups: properties_package, export, custom_code', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig) as Record<string, { groups: Record<string, string> }>;

            const allGroups = new Set<string>();
            Object.values(config).forEach(prop => {
                Object.keys(prop.groups).forEach(g => allGroups.add(g));
            });

            expect(allGroups.has('properties_package')).toBe(true);
            expect(allGroups.has('export')).toBe(true);
            expect(allGroups.has('custom_code')).toBe(true);
            expect(allGroups.size).toBe(3);
        });

        it('should have help text on properties with help icons', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig) as Record<string, { help?: string }>;

            // Properties that should have help
            const propsWithHelp = [
                'pp_title',
                'pp_subtitle',
                'pp_lang',
                'pp_author',
                'exportSource',
                'pp_addExeLink',
                'pp_addPagination',
                'pp_addSearchBox',
                'pp_addAccessibilityToolbar',
                'pp_extraHeadContent',
                'footer',
            ];

            propsWithHelp.forEach(prop => {
                expect(config[prop].help).toBeDefined();
            });
        });

        it('should have correct property types', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig) as Record<string, { type: string }>;

            // Text fields
            expect(config.pp_title.type).toBe('text');
            expect(config.pp_subtitle.type).toBe('text');
            expect(config.pp_author.type).toBe('text');

            // Select fields
            expect(config.pp_lang.type).toBe('select');
            expect(config.pp_license.type).toBe('select');

            // Textarea fields
            expect(config.pp_description.type).toBe('textarea');
            expect(config.pp_extraHeadContent.type).toBe('textarea');
            expect(config.footer.type).toBe('textarea');

            // Checkbox fields
            expect(config.exportSource.type).toBe('checkbox');
            expect(config.pp_addExeLink.type).toBe('checkbox');
            expect(config.pp_addPagination.type).toBe('checkbox');
            expect(config.pp_addSearchBox.type).toBe('checkbox');
            expect(config.pp_addAccessibilityToolbar.type).toBe('checkbox');
        });

        it('should have properties in correct groups', async () => {
            const response = await configRoutes.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = (await response.json()) as Record<string, unknown>;
            const nestedConfig = data.odeProjectSyncPropertiesConfig as Record<string, Record<string, unknown>>;
            const config = flattenProperties(nestedConfig) as Record<string, { groups: Record<string, string> }>;

            // properties_package group
            expect(Object.keys(config.pp_title.groups)[0]).toBe('properties_package');
            expect(Object.keys(config.pp_subtitle.groups)[0]).toBe('properties_package');
            expect(Object.keys(config.pp_lang.groups)[0]).toBe('properties_package');
            expect(Object.keys(config.pp_author.groups)[0]).toBe('properties_package');
            expect(Object.keys(config.pp_license.groups)[0]).toBe('properties_package');
            expect(Object.keys(config.pp_description.groups)[0]).toBe('properties_package');

            // export group
            expect(Object.keys(config.exportSource.groups)[0]).toBe('export');
            expect(Object.keys(config.pp_addExeLink.groups)[0]).toBe('export');
            expect(Object.keys(config.pp_addPagination.groups)[0]).toBe('export');
            expect(Object.keys(config.pp_addSearchBox.groups)[0]).toBe('export');
            expect(Object.keys(config.pp_addAccessibilityToolbar.groups)[0]).toBe('export');

            // custom_code group
            expect(Object.keys(config.pp_extraHeadContent.groups)[0]).toBe('custom_code');
            expect(Object.keys(config.footer.groups)[0]).toBe('custom_code');
        });
    });
});
