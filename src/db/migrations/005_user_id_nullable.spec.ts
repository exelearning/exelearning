/**
 * Tests for 005_user_id_nullable migration
 * Verifies that user_id column becomes nullable for local users
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down, configure, resetDependencies } from './005_user_id_nullable';

describe('005_user_id_nullable migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Create the users table as it would exist after 004_fix_user_foreign_keys
        // (user_id is NOT NULL at this point)
        await sql`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(180) NOT NULL UNIQUE,
                user_id VARCHAR(255) NOT NULL,
                password TEXT NOT NULL,
                roles TEXT NOT NULL DEFAULT '[]',
                is_lopd_accepted INTEGER NOT NULL DEFAULT 0,
                quota_mb INTEGER,
                external_identifier VARCHAR(180),
                api_token VARCHAR(255),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);
    });

    afterEach(async () => {
        resetDependencies();
        await db.destroy();
    });

    describe('up', () => {
        it('should run without errors on SQLite', async () => {
            await up(db);
            // If we get here without throwing, the test passes
            expect(true).toBe(true);
        });

        it('should allow NULL user_id after migration', async () => {
            // Insert user before migration (requires user_id)
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('before@example.com', 'test-user', 'hashedpw')
            `.execute(db);

            await up(db);

            // After migration, should allow NULL user_id
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('after@example.com', NULL, 'hashedpw')
            `.execute(db);

            const result = await sql<{ email: string; user_id: string | null }>`
                SELECT email, user_id FROM users WHERE email = 'after@example.com'
            `.execute(db);

            expect(result.rows[0].email).toBe('after@example.com');
            expect(result.rows[0].user_id).toBeNull();
        });

        it('should preserve existing user data', async () => {
            // Insert user before migration
            const existingUserId = 'oidc:ABC123XYZ';
            await sql`
                INSERT INTO users (email, user_id, password, roles, is_active)
                VALUES ('existing@example.com', ${existingUserId}, 'hashedpw', '["ROLE_USER"]', 1)
            `.execute(db);

            await up(db);

            // Verify data is preserved
            const result = await sql<{ email: string; user_id: string; roles: string }>`
                SELECT email, user_id, roles FROM users WHERE email = 'existing@example.com'
            `.execute(db);

            expect(result.rows[0].email).toBe('existing@example.com');
            expect(result.rows[0].user_id).toBe(existingUserId);
            expect(result.rows[0].roles).toBe('["ROLE_USER"]');
        });

        it('should skip migration if user_id column does not exist', async () => {
            // Create a table without user_id column (simulating legacy scenario)
            await db.schema.dropTable('users').execute();
            await sql`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(180) NOT NULL UNIQUE
                )
            `.execute(db);

            // Should not throw
            await up(db);

            // Table structure should remain unchanged
            const result = await sql<{ name: string }>`
                PRAGMA table_info(users)
            `.execute(db);

            const columns = result.rows.map(r => r.name);
            expect(columns).not.toContain('user_id');
        });

        it('should allow mixed NULL and non-NULL user_id values', async () => {
            await up(db);

            // Insert multiple users with different user_id states
            await sql`
                INSERT INTO users (email, user_id, password) VALUES
                ('local@example.com', NULL, 'hashedpw'),
                ('cas@example.com', 'cas:john.doe', 'hashedpw'),
                ('oidc@example.com', 'oidc:12345', 'hashedpw'),
                ('guest@example.com', 'guest:uuid-123', 'hashedpw')
            `.execute(db);

            const result = await sql<{ email: string; user_id: string | null }>`
                SELECT email, user_id FROM users ORDER BY email
            `.execute(db);

            expect(result.rows).toHaveLength(4);
            expect(result.rows.find(r => r.email === 'local@example.com')?.user_id).toBeNull();
            expect(result.rows.find(r => r.email === 'cas@example.com')?.user_id).toBe('cas:john.doe');
            expect(result.rows.find(r => r.email === 'oidc@example.com')?.user_id).toBe('oidc:12345');
            expect(result.rows.find(r => r.email === 'guest@example.com')?.user_id).toBe('guest:uuid-123');
        });
    });

    describe('down', () => {
        it('should run without errors on SQLite', async () => {
            await up(db);
            await down(db);
            // If we get here without throwing, the test passes
            expect(true).toBe(true);
        });

        it('should convert NULL user_id to email value', async () => {
            await up(db);

            // Insert user with NULL user_id
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('local@example.com', NULL, 'hashedpw')
            `.execute(db);

            await down(db);

            // NULL should be converted to email
            const result = await sql<{ email: string; user_id: string }>`
                SELECT email, user_id FROM users WHERE email = 'local@example.com'
            `.execute(db);

            expect(result.rows[0].user_id).toBe('local@example.com');
        });

        it('should preserve non-NULL user_id values during rollback', async () => {
            await up(db);

            // Insert users with various user_id states
            await sql`
                INSERT INTO users (email, user_id, password) VALUES
                ('cas@example.com', 'cas:john.doe', 'hashedpw'),
                ('local@example.com', NULL, 'hashedpw')
            `.execute(db);

            await down(db);

            const result = await sql<{ email: string; user_id: string }>`
                SELECT email, user_id FROM users ORDER BY email
            `.execute(db);

            // CAS user should keep original value
            expect(result.rows.find(r => r.email === 'cas@example.com')?.user_id).toBe('cas:john.doe');
            // Local user should now have email as user_id
            expect(result.rows.find(r => r.email === 'local@example.com')?.user_id).toBe('local@example.com');
        });

        it('should skip rollback if user_id column does not exist', async () => {
            // Create a table without user_id column
            await db.schema.dropTable('users').execute();
            await sql`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(180) NOT NULL UNIQUE
                )
            `.execute(db);

            // Should not throw
            await down(db);

            expect(true).toBe(true);
        });
    });

    describe('MySQL dialect', () => {
        beforeEach(() => {
            configure({ getDialect: () => 'mysql' });
        });

        it('should attempt to run MySQL ALTER TABLE syntax for up()', async () => {
            // SQLite will fail to parse MySQL syntax, but we verify the code path is taken
            let errorThrown = false;
            try {
                await up(db);
            } catch (err: any) {
                // Expected: SQLite doesn't understand MySQL MODIFY COLUMN syntax
                errorThrown = true;
                expect(err.message).toMatch(/MODIFY|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });

        it('should attempt to run MySQL ALTER TABLE syntax for down()', async () => {
            let errorThrown = false;
            try {
                await down(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/MODIFY|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });
    });

    describe('PostgreSQL dialect', () => {
        beforeEach(() => {
            configure({ getDialect: () => 'postgres' });
        });

        it('should attempt to run PostgreSQL ALTER TABLE syntax for up()', async () => {
            // SQLite will fail to parse PostgreSQL syntax, but we verify the code path is taken
            let errorThrown = false;
            try {
                await up(db);
            } catch (err: any) {
                // Expected: SQLite doesn't understand PostgreSQL DROP NOT NULL syntax
                errorThrown = true;
                expect(err.message).toMatch(/DROP|NOT NULL|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });

        it('should attempt to run PostgreSQL ALTER TABLE syntax for down()', async () => {
            let errorThrown = false;
            try {
                await down(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/SET|NOT NULL|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });
    });

    describe('column existence check', () => {
        it('should skip up() when column does not exist', async () => {
            // Mock columnExists to always return false
            configure({ columnExists: async () => false });

            // Should complete without error
            await up(db);

            expect(true).toBe(true);
        });

        it('should skip down() when column does not exist', async () => {
            // Mock columnExists to always return false
            configure({ columnExists: async () => false });

            // Should complete without error
            await down(db);

            expect(true).toBe(true);
        });
    });
});
