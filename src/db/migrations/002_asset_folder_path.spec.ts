/**
 * Tests for 002_asset_folder_path migration
 * Verifies the folder_path column is correctly added to assets table
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down } from './002_asset_folder_path';

describe('002_asset_folder_path migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Create the assets table as it would exist after 001_initial
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
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);
    });

    afterEach(async () => {
        await db.destroy();
    });

    describe('up', () => {
        it('should add folder_path column to assets table', async () => {
            await up(db);

            // Verify column exists by inserting data with folder_path
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path)
                VALUES (1, 'test.jpg', '/path/to/test.jpg', 'images/photos')
            `.execute(db);

            const result = await sql<{ folder_path: string }>`
                SELECT folder_path FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0].folder_path).toBe('images/photos');
        });

        it('should set empty string as default for folder_path', async () => {
            await up(db);

            // Insert without folder_path
            await sql`
                INSERT INTO assets (project_id, filename, storage_path)
                VALUES (1, 'test.jpg', '/path/to/test.jpg')
            `.execute(db);

            const result = await sql<{ folder_path: string }>`
                SELECT folder_path FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0].folder_path).toBe('');
        });

        it('should create idx_assets_folder_path index', async () => {
            await up(db);

            const indexes = await sql<{ name: string }>`
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_assets_folder_path'
            `.execute(db);

            expect(indexes.rows.length).toBe(1);
        });

        it('should support nested folder paths', async () => {
            await up(db);

            // Insert with deeply nested path
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path)
                VALUES (1, 'style.css', '/path/style.css', 'website/assets/css/vendor')
            `.execute(db);

            const result = await sql<{ folder_path: string }>`
                SELECT folder_path FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0].folder_path).toBe('website/assets/css/vendor');
        });

        it('should allow querying by folder_path', async () => {
            await up(db);

            // Insert multiple assets in different folders
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path) VALUES
                (1, 'a.jpg', '/a.jpg', 'images'),
                (1, 'b.jpg', '/b.jpg', 'images'),
                (1, 'c.css', '/c.css', 'css'),
                (1, 'd.jpg', '/d.jpg', 'images/icons')
            `.execute(db);

            // Query assets in 'images' folder (exact match)
            const result = await sql<{ filename: string }>`
                SELECT filename FROM assets
                WHERE project_id = 1 AND folder_path = 'images'
                ORDER BY filename
            `.execute(db);

            expect(result.rows.length).toBe(2);
            expect(result.rows[0].filename).toBe('a.jpg');
            expect(result.rows[1].filename).toBe('b.jpg');
        });

        it('should allow querying subfolders with LIKE', async () => {
            await up(db);

            // Insert assets in nested structure
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path) VALUES
                (1, 'root.jpg', '/root.jpg', ''),
                (1, 'img.jpg', '/img.jpg', 'images'),
                (1, 'icon.png', '/icon.png', 'images/icons'),
                (1, 'big.png', '/big.png', 'images/icons/large')
            `.execute(db);

            // Query all assets under 'images' (including subfolders)
            const result = await sql<{ filename: string }>`
                SELECT filename FROM assets
                WHERE project_id = 1 AND (folder_path = 'images' OR folder_path LIKE 'images/%')
                ORDER BY folder_path, filename
            `.execute(db);

            expect(result.rows.length).toBe(3);
            expect(result.rows.map(r => r.filename)).toEqual(['img.jpg', 'icon.png', 'big.png']);
        });
    });

    describe('down', () => {
        it('should remove folder_path column', async () => {
            // First run up
            await up(db);

            // Then rollback
            await down(db);

            // Try to select folder_path - should fail
            let errorThrown = false;
            try {
                await sql`SELECT folder_path FROM assets`.execute(db);
            } catch {
                errorThrown = true;
            }

            expect(errorThrown).toBe(true);
        });

        it('should remove idx_assets_folder_path index', async () => {
            await up(db);
            await down(db);

            const indexes = await sql<{ name: string }>`
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_assets_folder_path'
            `.execute(db);

            expect(indexes.rows.length).toBe(0);
        });

        it('should preserve other columns', async () => {
            await up(db);

            // Insert data
            await sql`
                INSERT INTO assets (project_id, filename, storage_path, folder_path)
                VALUES (1, 'test.jpg', '/path/test.jpg', 'images')
            `.execute(db);

            await down(db);

            // Other columns should still exist
            const result = await sql<{ filename: string; storage_path: string }>`
                SELECT filename, storage_path FROM assets WHERE id = 1
            `.execute(db);

            expect(result.rows[0].filename).toBe('test.jpg');
            expect(result.rows[0].storage_path).toBe('/path/test.jpg');
        });
    });
});
