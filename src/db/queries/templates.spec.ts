/**
 * Tests for Templates Queries
 * Uses real in-memory SQLite database (no mocks)
 */
import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    getAllTemplates,
    getTemplatesByLocale,
    getEnabledTemplatesByLocale,
    countTemplates,
    countTemplatesByLocale,
    findTemplateById,
    findTemplateByFilenameAndLocale,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateEnabled,
    templateFilenameExists,
    getNextTemplateSortOrder,
    getDistinctLocales,
} from './templates';

describe('Templates Queries', () => {
    let db: Kysely<Database>;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
    });

    describe('createTemplate', () => {
        test('should create a new template', async () => {
            const template = await createTemplate(db, {
                filename: 'test-template',
                display_name: 'Test Template',
                description: 'A test template',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/test-template.elpx',
                file_size: 54321,
                uploaded_by: null,
            });

            expect(template.id).toBeDefined();
            expect(template.filename).toBe('test-template');
            expect(template.locale).toBe('es');
            expect(template.is_enabled).toBe(1);
        });
    });

    describe('getAllTemplates', () => {
        test('should return all templates sorted by locale and sort_order', async () => {
            await createTemplate(db, {
                filename: 'template-en',
                display_name: 'English Template',
                locale: 'en',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/en/template-en.elpx',
            });
            await createTemplate(db, {
                filename: 'template-es',
                display_name: 'Spanish Template',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/template-es.elpx',
            });

            const templates = await getAllTemplates(db);
            expect(templates.length).toBe(2);
        });

        test('should return empty array when no templates', async () => {
            const templates = await getAllTemplates(db);
            expect(templates).toEqual([]);
        });
    });

    describe('getTemplatesByLocale', () => {
        test('should filter templates by locale', async () => {
            await createTemplate(db, {
                filename: 'en-template',
                display_name: 'English',
                locale: 'en',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/en/en-template.elpx',
            });
            await createTemplate(db, {
                filename: 'es-template',
                display_name: 'Spanish',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/es-template.elpx',
            });

            const esTemplates = await getTemplatesByLocale(db, 'es');
            expect(esTemplates.length).toBe(1);
            expect(esTemplates[0].locale).toBe('es');
        });
    });

    describe('getEnabledTemplatesByLocale', () => {
        test('should return only enabled templates for locale', async () => {
            await createTemplate(db, {
                filename: 'enabled',
                display_name: 'Enabled',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/enabled.elpx',
            });
            await createTemplate(db, {
                filename: 'disabled',
                display_name: 'Disabled',
                locale: 'es',
                is_enabled: 0,
                sort_order: 2,
                storage_path: 'templates/es/disabled.elpx',
            });

            const templates = await getEnabledTemplatesByLocale(db, 'es');
            expect(templates.length).toBe(1);
            expect(templates[0].filename).toBe('enabled');
        });
    });

    describe('countTemplates', () => {
        test('should return 0 when no templates exist', async () => {
            const count = await countTemplates(db);
            expect(count).toBe(0);
        });

        test('should count all templates', async () => {
            await createTemplate(db, {
                filename: 'count-1',
                display_name: 'Count 1',
                locale: 'en',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/en/count-1.elpx',
            });
            await createTemplate(db, {
                filename: 'count-2',
                display_name: 'Count 2',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/count-2.elpx',
            });

            const count = await countTemplates(db);
            expect(count).toBe(2);
        });
    });

    describe('countTemplatesByLocale', () => {
        test('should count templates for a locale', async () => {
            await createTemplate(db, {
                filename: 'locale-1',
                display_name: 'Locale 1',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/locale-1.elpx',
            });
            await createTemplate(db, {
                filename: 'locale-2',
                display_name: 'Locale 2',
                locale: 'es',
                is_enabled: 1,
                sort_order: 2,
                storage_path: 'templates/es/locale-2.elpx',
            });

            const countEs = await countTemplatesByLocale(db, 'es');
            const countEn = await countTemplatesByLocale(db, 'en');
            expect(countEs).toBe(2);
            expect(countEn).toBe(0);
        });
    });

    describe('findTemplateById', () => {
        test('should find template by id', async () => {
            const created = await createTemplate(db, {
                filename: 'findable',
                display_name: 'Findable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/findable.elpx',
            });

            const found = await findTemplateById(db, created.id);
            expect(found).not.toBeNull();
            expect(found?.filename).toBe('findable');
        });

        test('should return undefined for non-existent id', async () => {
            const found = await findTemplateById(db, 999);
            expect(found).toBeUndefined();
        });
    });

    describe('findTemplateByFilenameAndLocale', () => {
        test('should find template by filename and locale', async () => {
            await createTemplate(db, {
                filename: 'unique',
                display_name: 'Unique',
                locale: 'fr',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/fr/unique.elpx',
            });

            const found = await findTemplateByFilenameAndLocale(db, 'unique', 'fr');
            expect(found).not.toBeNull();
            expect(found?.display_name).toBe('Unique');
        });

        test('should return undefined if locale does not match', async () => {
            await createTemplate(db, {
                filename: 'localized',
                display_name: 'Localized',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/localized.elpx',
            });

            const found = await findTemplateByFilenameAndLocale(db, 'localized', 'en');
            expect(found).toBeUndefined();
        });
    });

    describe('updateTemplate', () => {
        test('should update template properties', async () => {
            const created = await createTemplate(db, {
                filename: 'updateable',
                display_name: 'Original',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/updateable.elpx',
            });

            const updated = await updateTemplate(db, created.id, {
                display_name: 'Updated',
                description: 'New description',
            });

            expect(updated?.display_name).toBe('Updated');
            expect(updated?.description).toBe('New description');
        });
    });

    describe('toggleTemplateEnabled', () => {
        test('should toggle template enabled status', async () => {
            const created = await createTemplate(db, {
                filename: 'toggleable',
                display_name: 'Toggleable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/toggleable.elpx',
            });

            const disabled = await toggleTemplateEnabled(db, created.id, false);
            expect(disabled?.is_enabled).toBe(0);

            const enabled = await toggleTemplateEnabled(db, created.id, true);
            expect(enabled?.is_enabled).toBe(1);
        });
    });

    describe('templateFilenameExists', () => {
        test('should return true for existing filename in same locale', async () => {
            await createTemplate(db, {
                filename: 'existing',
                display_name: 'Existing',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/existing.elpx',
            });

            const exists = await templateFilenameExists(db, 'existing', 'es');
            expect(exists).toBe(true);
        });

        test('should return false for same filename in different locale', async () => {
            await createTemplate(db, {
                filename: 'existing',
                display_name: 'Existing',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/existing.elpx',
            });

            const exists = await templateFilenameExists(db, 'existing', 'en');
            expect(exists).toBe(false);
        });

        test('should return false for non-existing filename', async () => {
            const exists = await templateFilenameExists(db, 'non-existing', 'es');
            expect(exists).toBe(false);
        });
    });

    describe('getNextTemplateSortOrder', () => {
        test('should return 1 when no templates for locale', async () => {
            const nextOrder = await getNextTemplateSortOrder(db, 'es');
            expect(nextOrder).toBe(1);
        });

        test('should return max + 1 for locale', async () => {
            await createTemplate(db, {
                filename: 'high-order',
                display_name: 'High Order',
                locale: 'es',
                is_enabled: 1,
                sort_order: 10,
                storage_path: 'templates/es/high-order.elpx',
            });

            const nextOrder = await getNextTemplateSortOrder(db, 'es');
            expect(nextOrder).toBe(11);
        });

        test('should be independent per locale', async () => {
            await createTemplate(db, {
                filename: 'es-template',
                display_name: 'ES Template',
                locale: 'es',
                is_enabled: 1,
                sort_order: 5,
                storage_path: 'templates/es/es-template.elpx',
            });

            const nextOrderEn = await getNextTemplateSortOrder(db, 'en');
            expect(nextOrderEn).toBe(1);
        });
    });

    describe('getDistinctLocales', () => {
        test('should return unique locales', async () => {
            await createTemplate(db, {
                filename: 'es-1',
                display_name: 'ES 1',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/es-1.elpx',
            });
            await createTemplate(db, {
                filename: 'es-2',
                display_name: 'ES 2',
                locale: 'es',
                is_enabled: 1,
                sort_order: 2,
                storage_path: 'templates/es/es-2.elpx',
            });
            await createTemplate(db, {
                filename: 'en-1',
                display_name: 'EN 1',
                locale: 'en',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/en/en-1.elpx',
            });

            const locales = await getDistinctLocales(db);
            expect(locales).toContain('es');
            expect(locales).toContain('en');
            expect(locales.length).toBe(2);
        });

        test('should return empty array when no templates', async () => {
            const locales = await getDistinctLocales(db);
            expect(locales).toEqual([]);
        });
    });

    describe('deleteTemplate', () => {
        test('should delete template by id', async () => {
            const created = await createTemplate(db, {
                filename: 'deletable',
                display_name: 'Deletable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'templates/es/deletable.elpx',
            });

            await deleteTemplate(db, created.id);

            const found = await findTemplateById(db, created.id);
            expect(found).toBeUndefined();
        });
    });
});
