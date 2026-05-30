/**
 * Tests for 008_asset_metadata migration
 * Verifies the centralized metadata columns are added to the assets table and
 * that existing rows remain valid (additive, nullable, no defaults).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down } from './008_asset_metadata';

const NEW_COLUMNS = ['description', 'alt_text', 'title', 'license', 'author'];

describe('008_asset_metadata migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Assets table as it exists after 002_asset_folder_path
        await sql`
            CREATE TABLE assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                storage_path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100),
                file_size TEXT,
                client_id VARCHAR(36),
                component_id VARCHAR(255),
                content_hash VARCHAR(64),
                folder_path VARCHAR(500) NOT NULL DEFAULT '',
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);
    });

    afterEach(async () => {
        await db.destroy();
    });

    describe('up', () => {
        it('adds all metadata columns', async () => {
            await up(db);

            await sql`
                INSERT INTO assets (project_id, filename, storage_path, description, alt_text, title, license, author)
                VALUES (1, 'a.jpg', '/a.jpg', 'desc', 'alt', 'ttl', 'Creative Commons BY', 'Ada')
            `.execute(db);

            const result = await sql<{
                description: string;
                alt_text: string;
                title: string;
                license: string;
                author: string;
            }>`
                SELECT description, alt_text, title, license, author FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0]).toEqual({
                description: 'desc',
                alt_text: 'alt',
                title: 'ttl',
                license: 'Creative Commons BY',
                author: 'Ada',
            });
        });

        it('leaves existing rows with NULL metadata (backward compatible)', async () => {
            // Row inserted before the migration ran
            await sql`
                INSERT INTO assets (project_id, filename, storage_path)
                VALUES (1, 'legacy.png', '/legacy.png')
            `.execute(db);

            await up(db);

            const result = await sql<Record<string, unknown>>`
                SELECT description, alt_text, title, license, author FROM assets WHERE id = 1
            `.execute(db);

            for (const col of NEW_COLUMNS) {
                expect(result.rows[0][col]).toBeNull();
            }
        });
    });

    describe('down', () => {
        it('removes all metadata columns', async () => {
            await up(db);
            await down(db);

            const info = await sql<{ name: string }>`PRAGMA table_info(assets)`.execute(db);
            const columnNames = info.rows.map(r => r.name);
            for (const col of NEW_COLUMNS) {
                expect(columnNames).not.toContain(col);
            }
        });

        it('preserves pre-existing columns and data', async () => {
            await up(db);
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path)
                VALUES (1, 'keep.jpg', '/keep.jpg', 'images')
            `.execute(db);

            await down(db);

            const result = await sql<{ filename: string; folder_path: string }>`
                SELECT filename, folder_path FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0].filename).toBe('keep.jpg');
            expect(result.rows[0].folder_path).toBe('images');
        });
    });
});
