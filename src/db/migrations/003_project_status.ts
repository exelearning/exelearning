import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    try {
        await db
            .updateTable('projects')
            .set({ status: 'inactive' })
            .where('status', '=', 'active')
            .where('is_active', '=', 0)
            .execute();
    } catch {
        // Ignore if column is missing or table is empty
    }

    try {
        await db.updateTable('projects').set({ status: 'inactive' }).where('status', '=', 'deleted').execute();
    } catch {
        // Ignore if status column is missing
    }

    await db.schema.alterTable('projects').dropColumn('is_active').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('projects')
        .addColumn('is_active', 'integer', col => col.notNull().defaultTo(1))
        .execute();

    try {
        await db.updateTable('projects').set({ is_active: 0 }).where('status', '=', 'inactive').execute();
    } catch {
        // Ignore if status column is missing
    }
}
