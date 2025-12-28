/**
 * Admin Templates Routes for Elysia
 * CRUD endpoints for admin-managed templates
 * Requires ROLE_ADMIN for all routes
 */
import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import * as fs from 'fs-extra';
import * as path from 'path';
import { db as defaultDb } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database, Template } from '../db/types';
import type { JwtPayload } from './auth';
import {
    getAllTemplates as getAllTemplatesDefault,
    getTemplatesByLocale as getTemplatesByLocaleDefault,
    getEnabledTemplatesByLocale as getEnabledTemplatesByLocaleDefault,
    findTemplateById as findTemplateByIdDefault,
    findTemplateByFilenameAndLocale as findTemplateByFilenameAndLocaleDefault,
    createTemplate as createTemplateDefault,
    updateTemplate as updateTemplateDefault,
    deleteTemplate as deleteTemplateDefault,
    toggleTemplateEnabled as toggleTemplateEnabledDefault,
    templateFilenameExists as templateFilenameExistsDefault,
    getNextTemplateSortOrder as getNextTemplateSortOrderDefault,
    getDistinctLocales as getDistinctLocalesDefault,
} from '../db/queries/templates';
import {
    validateTemplateZip as validateTemplateZipDefault,
    extractTemplate as extractTemplateDefault,
    slugify as slugifyDefault,
    SUPPORTED_LOCALES,
} from '../services/admin-upload-validator';
import { requireAdmin } from '../utils/guards';
import { getFilesDir as getFilesDirDefault, getJwtSecret, deleteFileIfExists } from '../utils/admin-route-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface AdminTemplatesQueries {
    getAllTemplates: typeof getAllTemplatesDefault;
    getTemplatesByLocale: typeof getTemplatesByLocaleDefault;
    getEnabledTemplatesByLocale: typeof getEnabledTemplatesByLocaleDefault;
    findTemplateById: typeof findTemplateByIdDefault;
    findTemplateByFilenameAndLocale: typeof findTemplateByFilenameAndLocaleDefault;
    createTemplate: typeof createTemplateDefault;
    updateTemplate: typeof updateTemplateDefault;
    deleteTemplate: typeof deleteTemplateDefault;
    toggleTemplateEnabled: typeof toggleTemplateEnabledDefault;
    templateFilenameExists: typeof templateFilenameExistsDefault;
    getNextTemplateSortOrder: typeof getNextTemplateSortOrderDefault;
    getDistinctLocales: typeof getDistinctLocalesDefault;
}

export interface AdminTemplatesValidatorDeps {
    validateTemplateZip: typeof validateTemplateZipDefault;
    extractTemplate: typeof extractTemplateDefault;
    slugify: typeof slugifyDefault;
}

export interface AdminTemplatesDependencies {
    db: Kysely<Database>;
    queries: AdminTemplatesQueries;
    validator: AdminTemplatesValidatorDeps;
    getFilesDir: () => string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const defaultDependencies: AdminTemplatesDependencies = {
    db: defaultDb,
    queries: {
        getAllTemplates: getAllTemplatesDefault,
        getTemplatesByLocale: getTemplatesByLocaleDefault,
        getEnabledTemplatesByLocale: getEnabledTemplatesByLocaleDefault,
        findTemplateById: findTemplateByIdDefault,
        findTemplateByFilenameAndLocale: findTemplateByFilenameAndLocaleDefault,
        createTemplate: createTemplateDefault,
        updateTemplate: updateTemplateDefault,
        deleteTemplate: deleteTemplateDefault,
        toggleTemplateEnabled: toggleTemplateEnabledDefault,
        templateFilenameExists: templateFilenameExistsDefault,
        getNextTemplateSortOrder: getNextTemplateSortOrderDefault,
        getDistinctLocales: getDistinctLocalesDefault,
    },
    validator: {
        validateTemplateZip: validateTemplateZipDefault,
        extractTemplate: extractTemplateDefault,
        slugify: slugifyDefault,
    },
    getFilesDir: getFilesDirDefault,
};

// ============================================================================
// HELPERS
// ============================================================================

function serializeTemplate(template: Template) {
    return {
        id: template.id,
        filename: template.filename,
        displayName: template.display_name,
        description: template.description,
        locale: template.locale,
        isEnabled: template.is_enabled === 1,
        sortOrder: template.sort_order,
        storagePath: template.storage_path,
        fileSize: template.file_size,
        previewImage: template.preview_image,
        uploadedBy: template.uploaded_by,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
    };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAdminTemplatesRoutes(deps: AdminTemplatesDependencies = defaultDependencies) {
    const { db: database, queries, validator, getFilesDir: filesDir } = deps;

    return (
        new Elysia({ name: 'admin-templates-routes' })
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                }),
            )
            .use(cookie())

            // Global guard for admin routes
            .guard({
                async beforeHandle({ jwt, cookie, set }) {
                    const token = cookie.auth?.value;
                    if (!token) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'No authentication token' };
                    }

                    const payload = (await jwt.verify(token)) as JwtPayload | false;
                    if (!payload) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid token' };
                    }

                    const authError = requireAdmin(payload);
                    if (authError) {
                        set.status = 403;
                        return { error: authError.error, message: authError.message };
                    }
                },
            })

            // =====================================================
            // GET /api/admin/templates - List all admin templates
            // =====================================================
            .get(
                '/api/admin/templates',
                async ({ query }) => {
                    let templates: Template[];

                    if (query.locale) {
                        templates = await queries.getTemplatesByLocale(database, query.locale);
                    } else {
                        templates = await queries.getAllTemplates(database);
                    }

                    return {
                        templates: templates.map(serializeTemplate),
                        locales: await queries.getDistinctLocales(database),
                        supportedLocales: SUPPORTED_LOCALES,
                    };
                },
                {
                    query: t.Object({
                        locale: t.Optional(t.String()),
                    }),
                },
            )

            // =====================================================
            // GET /api/admin/templates/:id - Get template by ID
            // =====================================================
            .get('/api/admin/templates/:id', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid template ID' };
                }

                const template = await queries.findTemplateById(database, id);
                if (!template) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Template not found' };
                }

                return serializeTemplate(template);
            })

            // =====================================================
            // GET /api/admin/templates/:id/download - Download template
            // =====================================================
            .get('/api/admin/templates/:id/download', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid template ID' };
                }

                const template = await queries.findTemplateById(database, id);
                if (!template) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Template not found' };
                }

                const filePath = path.join(filesDir(), template.storage_path);
                if (!(await fs.pathExists(filePath))) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Template file not found' };
                }

                const fileBuffer = await fs.readFile(filePath);
                set.headers['content-type'] = 'application/zip';
                set.headers['content-disposition'] = `attachment; filename="${template.filename}.elpx"`;

                return fileBuffer;
            })

            // =====================================================
            // POST /api/admin/templates/upload - Upload new template
            // =====================================================
            .post(
                '/api/admin/templates/upload',
                async ({ body, set, jwt, cookie }) => {
                    try {
                        const { file, locale, displayName, description, isEnabled } = body;

                        if (!file) {
                            set.status = 400;
                            return { error: 'Bad Request', message: 'No file uploaded' };
                        }

                        if (!locale) {
                            set.status = 400;
                            return { error: 'Bad Request', message: 'Locale is required' };
                        }

                        // Validate locale
                        if (!SUPPORTED_LOCALES.includes(locale)) {
                            set.status = 400;
                            return {
                                error: 'Bad Request',
                                message: `Invalid locale. Supported: ${SUPPORTED_LOCALES.join(', ')}`,
                            };
                        }

                        // Get file buffer
                        const fileBuffer = Buffer.from(await file.arrayBuffer());

                        // Validate template ZIP
                        const validation = await validator.validateTemplateZip(fileBuffer);
                        if (!validation.valid) {
                            set.status = 400;
                            return { error: 'Bad Request', message: validation.error };
                        }

                        // Get original filename and generate slug
                        const originalName = (file as { name?: string }).name || 'template';
                        const baseName = path.basename(originalName, path.extname(originalName));
                        const filename = validator.slugify(baseName);

                        if (!filename) {
                            set.status = 400;
                            return { error: 'Bad Request', message: 'Could not generate valid filename' };
                        }

                        // Check if filename already exists for this locale
                        const exists = await queries.templateFilenameExists(database, filename, locale);
                        if (exists) {
                            set.status = 400;
                            return {
                                error: 'Bad Request',
                                message: `Template "${filename}" already exists for locale "${locale}"`,
                            };
                        }

                        // Determine storage path
                        const storagePath = `templates/${locale}/${filename}.elpx`;
                        const targetPath = path.join(filesDir(), storagePath);

                        // Save template (as ELPX file, not extracted)
                        await validator.extractTemplate(fileBuffer, targetPath);

                        // Get current user ID from JWT
                        const token = cookie.auth?.value;
                        const payload = (await jwt.verify(token!)) as JwtPayload;

                        // Get next sort order
                        const sortOrder = await queries.getNextTemplateSortOrder(database, locale);

                        // Create database record
                        const template = await queries.createTemplate(database, {
                            filename,
                            display_name: displayName || baseName,
                            description: description || null,
                            locale,
                            is_enabled: isEnabled === false ? 0 : 1,
                            sort_order: sortOrder,
                            storage_path: storagePath,
                            file_size: fileBuffer.length,
                            preview_image: null,
                            uploaded_by: payload.sub,
                        });

                        set.status = 201;
                        return serializeTemplate(template);
                    } catch (error) {
                        set.status = 500;
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        return { error: 'Internal Server Error', message };
                    }
                },
                {
                    body: t.Object({
                        file: t.File(),
                        locale: t.String(),
                        displayName: t.Optional(t.String()),
                        description: t.Optional(t.String()),
                        isEnabled: t.Optional(t.Boolean()),
                    }),
                },
            )

            // =====================================================
            // PATCH /api/admin/templates/:id - Update template metadata
            // =====================================================
            .patch(
                '/api/admin/templates/:id',
                async ({ params, body, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid template ID' };
                    }

                    const template = await queries.findTemplateById(database, id);
                    if (!template) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Template not found' };
                    }

                    const updates: Parameters<typeof queries.updateTemplate>[2] = {};

                    if (body.displayName !== undefined) {
                        updates.display_name = body.displayName;
                    }
                    if (body.description !== undefined) {
                        updates.description = body.description;
                    }
                    if (body.sortOrder !== undefined) {
                        updates.sort_order = body.sortOrder;
                    }

                    const updatedTemplate = await queries.updateTemplate(database, id, updates);
                    if (!updatedTemplate) {
                        set.status = 500;
                        return { error: 'Internal Server Error', message: 'Failed to update template' };
                    }

                    return serializeTemplate(updatedTemplate);
                },
                {
                    body: t.Object({
                        displayName: t.Optional(t.String()),
                        description: t.Optional(t.String()),
                        sortOrder: t.Optional(t.Number()),
                    }),
                },
            )

            // =====================================================
            // PATCH /api/admin/templates/:id/enabled - Toggle enabled
            // =====================================================
            .patch(
                '/api/admin/templates/:id/enabled',
                async ({ params, body, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid template ID' };
                    }

                    const template = await queries.findTemplateById(database, id);
                    if (!template) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Template not found' };
                    }

                    const updatedTemplate = await queries.toggleTemplateEnabled(database, id, body.isEnabled);
                    if (!updatedTemplate) {
                        set.status = 500;
                        return { error: 'Internal Server Error', message: 'Failed to update template' };
                    }

                    return serializeTemplate(updatedTemplate);
                },
                {
                    body: t.Object({
                        isEnabled: t.Boolean(),
                    }),
                },
            )

            // =====================================================
            // DELETE /api/admin/templates/:id - Delete template
            // =====================================================
            .delete('/api/admin/templates/:id', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid template ID' };
                }

                const template = await queries.findTemplateById(database, id);
                if (!template) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Template not found' };
                }

                // Delete file
                const filePath = path.join(filesDir(), template.storage_path);
                await deleteFileIfExists(filePath);

                // Delete database record
                await queries.deleteTemplate(database, id);

                return { success: true, message: 'Template deleted' };
            })
    );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export const adminTemplatesRoutes = createAdminTemplatesRoutes();
