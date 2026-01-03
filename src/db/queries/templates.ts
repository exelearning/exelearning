/**
 * Template Queries - Kysely ORM
 * Type-safe queries for project templates
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, Template, NewTemplate, TemplateUpdate } from '../types';
import { now } from '../types';
import { insertAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findTemplateById(db: Kysely<Database>, id: number): Promise<Template | undefined> {
    return db.selectFrom('templates').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findTemplateByFilenameAndLocale(
    db: Kysely<Database>,
    filename: string,
    locale: string,
): Promise<Template | undefined> {
    return db
        .selectFrom('templates')
        .selectAll()
        .where('filename', '=', filename)
        .where('locale', '=', locale)
        .executeTakeFirst();
}

export async function getAllTemplates(db: Kysely<Database>): Promise<Template[]> {
    return db
        .selectFrom('templates')
        .selectAll()
        .orderBy('locale', 'asc')
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function getTemplatesByLocale(db: Kysely<Database>, locale: string): Promise<Template[]> {
    return db
        .selectFrom('templates')
        .selectAll()
        .where('locale', '=', locale)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function getEnabledTemplatesByLocale(db: Kysely<Database>, locale: string): Promise<Template[]> {
    return db
        .selectFrom('templates')
        .selectAll()
        .where('locale', '=', locale)
        .where('is_enabled', '=', 1)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function countTemplates(db: Kysely<Database>): Promise<number> {
    const result = await db
        .selectFrom('templates')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .executeTakeFirst();
    return result?.count ?? 0;
}

export async function countTemplatesByLocale(db: Kysely<Database>, locale: string): Promise<number> {
    const result = await db
        .selectFrom('templates')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('locale', '=', locale)
        .executeTakeFirst();
    return result?.count ?? 0;
}

export async function getDistinctLocales(db: Kysely<Database>): Promise<string[]> {
    const results = await db.selectFrom('templates').select('locale').distinct().orderBy('locale', 'asc').execute();
    return results.map(r => r.locale);
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createTemplate(db: Kysely<Database>, data: NewTemplate): Promise<Template> {
    const timestamp = now();
    return insertAndReturn(db, 'templates', {
        ...data,
        is_enabled: data.is_enabled ?? 1,
        sort_order: data.sort_order ?? 0,
        created_at: timestamp,
        updated_at: timestamp,
    });
}

export async function updateTemplate(
    db: Kysely<Database>,
    id: number,
    data: TemplateUpdate,
): Promise<Template | undefined> {
    return updateByIdAndReturn(db, 'templates', id, {
        ...data,
        updated_at: now(),
    });
}

export async function deleteTemplate(db: Kysely<Database>, id: number): Promise<void> {
    await db.deleteFrom('templates').where('id', '=', id).execute();
}

// ============================================================================
// SPECIALIZED QUERIES
// ============================================================================

/**
 * Toggle enabled status
 */
export async function toggleTemplateEnabled(
    db: Kysely<Database>,
    id: number,
    isEnabled: boolean,
): Promise<Template | undefined> {
    return updateByIdAndReturn(db, 'templates', id, {
        is_enabled: isEnabled ? 1 : 0,
        updated_at: now(),
    });
}

/**
 * Check if a filename/locale combination already exists (for validation)
 */
export async function templateFilenameExists(db: Kysely<Database>, filename: string, locale: string): Promise<boolean> {
    const result = await db
        .selectFrom('templates')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('filename', '=', filename)
        .where('locale', '=', locale)
        .executeTakeFirst();
    return (result?.count ?? 0) > 0;
}

/**
 * Get the next sort order value for a specific locale
 */
export async function getNextTemplateSortOrder(db: Kysely<Database>, locale: string): Promise<number> {
    const result = await db
        .selectFrom('templates')
        .select(eb => eb.fn.max<number>('sort_order').as('max_order'))
        .where('locale', '=', locale)
        .executeTakeFirst();
    return (result?.max_order ?? 0) + 1;
}
