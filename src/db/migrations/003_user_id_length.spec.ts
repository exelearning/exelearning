/**
 * Tests for 003_user_id_length migration
 * Verifies the user_id column can store OpenID identifiers (69+ chars)
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down, configure, resetDependencies } from './003_user_id_length';

describe('003_user_id_length migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Create the users table as it would exist after 001_initial (before this migration)
        await sql`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(180) NOT NULL UNIQUE,
                user_id VARCHAR(40) NOT NULL,
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
            // SQLite doesn't enforce varchar length, so migration is a no-op
            // but should complete successfully
            await up(db);
            // If we get here without throwing, the test passes
            expect(true).toBe(true);
        });

        it('should allow storing short user_id values', async () => {
            await up(db);

            const shortUserId = 'user123';
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', ${shortUserId}, 'hashedpw')
            `.execute(db);

            const result = await sql<{ user_id: string }>`
                SELECT user_id FROM users WHERE email = 'test@example.com'
            `.execute(db);

            expect(result.rows[0].user_id).toBe(shortUserId);
        });

        it('should allow storing OpenID user_id with SHA256 hash (69 chars)', async () => {
            await up(db);

            // Real OpenID subject from Google: SHA256 hash (64 chars) + "oidc:" prefix (5 chars) = 69 chars
            const openIdUserId = 'oidc:3DF1810653DE177C8FA46EDFEAD9C39275D0FE32BDB7416624C96653003343F1';
            expect(openIdUserId.length).toBe(69);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('google@example.com', ${openIdUserId}, 'hashedpw')
            `.execute(db);

            const result = await sql<{ user_id: string }>`
                SELECT user_id FROM users WHERE email = 'google@example.com'
            `.execute(db);

            expect(result.rows[0].user_id).toBe(openIdUserId);
        });

        it('should allow storing CAS user_id with long institution identifiers', async () => {
            await up(db);

            // CAS subjects can include institution identifiers
            const casUserId = 'cas:university.edu/faculty/department/john.doe.1234567890';
            expect(casUserId.length).toBeGreaterThan(40);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('cas@example.com', ${casUserId}, 'hashedpw')
            `.execute(db);

            const result = await sql<{ user_id: string }>`
                SELECT user_id FROM users WHERE email = 'cas@example.com'
            `.execute(db);

            expect(result.rows[0].user_id).toBe(casUserId);
        });

        it('should allow storing guest user_id with UUID', async () => {
            await up(db);

            // Guest users have format "guest:" + UUID
            const guestUserId = 'guest:a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            expect(guestUserId.length).toBe(42);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('guest@local', ${guestUserId}, 'hashedpw')
            `.execute(db);

            const result = await sql<{ user_id: string }>`
                SELECT user_id FROM users WHERE email = 'guest@local'
            `.execute(db);

            expect(result.rows[0].user_id).toBe(guestUserId);
        });

        it('should allow storing very long user_id values (up to 255 chars)', async () => {
            await up(db);

            // Test with a very long identifier (edge case)
            const longUserId = 'custom:' + 'x'.repeat(248); // 7 + 248 = 255 chars
            expect(longUserId.length).toBe(255);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('long@example.com', ${longUserId}, 'hashedpw')
            `.execute(db);

            const result = await sql<{ user_id: string }>`
                SELECT user_id FROM users WHERE email = 'long@example.com'
            `.execute(db);

            expect(result.rows[0].user_id).toBe(longUserId);
        });
    });

    describe('down', () => {
        it('should run without errors on SQLite', async () => {
            await up(db);
            // SQLite doesn't enforce varchar length, so migration is a no-op
            await down(db);
            // If we get here without throwing, the test passes
            expect(true).toBe(true);
        });

        it('should preserve existing user data', async () => {
            await up(db);

            // Insert a user with OpenID
            const openIdUserId = 'oidc:ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', ${openIdUserId}, 'hashedpw')
            `.execute(db);

            await down(db);

            // User should still exist with same data
            const result = await sql<{ email: string; user_id: string }>`
                SELECT email, user_id FROM users WHERE email = 'test@example.com'
            `.execute(db);

            expect(result.rows[0].email).toBe('test@example.com');
            expect(result.rows[0].user_id).toBe(openIdUserId);
        });
    });

    describe('user_id format validation', () => {
        it('should correctly calculate OpenID user_id length', () => {
            // This test documents the expected format and ensures our length is sufficient
            const prefix = 'oidc:'; // 5 chars
            const sha256Hash = '3DF1810653DE177C8FA46EDFEAD9C39275D0FE32BDB7416624C96653003343F1'; // 64 chars

            const fullUserId = prefix + sha256Hash;

            expect(prefix.length).toBe(5);
            expect(sha256Hash.length).toBe(64);
            expect(fullUserId.length).toBe(69);

            // Ensure 69 is less than the new column size (255)
            expect(fullUserId.length).toBeLessThan(255);

            // Ensure 69 was greater than the old column size (40) - this was the bug!
            expect(fullUserId.length).toBeGreaterThan(40);
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
                // Expected: SQLite doesn't understand PostgreSQL TYPE syntax
                errorThrown = true;
                expect(err.message).toMatch(/TYPE|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });

        it('should attempt to run PostgreSQL ALTER TABLE syntax for down()', async () => {
            let errorThrown = false;
            try {
                await down(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/TYPE|syntax/i);
            }
            expect(errorThrown).toBe(true);
        });
    });
});
