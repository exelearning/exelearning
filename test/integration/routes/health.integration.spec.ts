/**
 * Health Routes Integration Tests
 * Tests the health check endpoints with an in-memory database
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { Kysely } from 'kysely';
import { createTestDb, closeTestDb, testRequest, parseJsonResponse, createTestUser } from '../helpers/integration-app';
import type { Database } from '../../../src/db/types';

describe('Health Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;

    beforeAll(async () => {
        // Create test database
        db = await createTestDb();

        // Create health routes that use test db
        app = new Elysia()
            .get('/health', () => ({
                status: 'ok',
                timestamp: new Date().toISOString(),
            }))
            .get('/health/db', async () => {
                try {
                    const result = await db
                        .selectFrom('users')
                        .select(({ fn }) => fn.countAll().as('count'))
                        .executeTakeFirst();
                    return {
                        status: 'ok',
                        database: 'connected',
                        usersCount: Number(result?.count ?? 0),
                        timestamp: new Date().toISOString(),
                    };
                } catch (error) {
                    return {
                        status: 'error',
                        database: 'disconnected',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date().toISOString(),
                    };
                }
            });
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    describe('GET /health', () => {
        it('should return ok status', async () => {
            const response = await testRequest(app, '/health');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{ status: string; timestamp: string }>(response);
            expect(body.status).toBe('ok');
            expect(body.timestamp).toBeDefined();
        });

        it('should return valid ISO timestamp', async () => {
            const response = await testRequest(app, '/health');
            const body = await parseJsonResponse<{ timestamp: string }>(response);

            const timestamp = new Date(body.timestamp);
            expect(timestamp.toISOString()).toBe(body.timestamp);
        });
    });

    describe('GET /health/db', () => {
        it('should return database connected status', async () => {
            const response = await testRequest(app, '/health/db');

            expect(response.status).toBe(200);

            const body = await parseJsonResponse<{
                status: string;
                database: string;
                usersCount: number;
            }>(response);

            expect(body.status).toBe('ok');
            expect(body.database).toBe('connected');
            expect(typeof body.usersCount).toBe('number');
        });

        it('should count users correctly', async () => {
            // Create some test users
            await createTestUser(db, { email: 'health1@test.local' });
            await createTestUser(db, { email: 'health2@test.local' });

            const response = await testRequest(app, '/health/db');
            const body = await parseJsonResponse<{ usersCount: number }>(response);

            // Should have at least 2 users
            expect(body.usersCount).toBeGreaterThanOrEqual(2);
        });
    });
});
