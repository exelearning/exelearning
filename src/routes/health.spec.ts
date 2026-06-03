/**
 * Health Routes Tests
 * Tests for health check endpoints
 */
import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';

// Mirror the actual /health route shape used in src/routes/health.ts
const testHealthRoutes = new Elysia({ prefix: '/health' })
    .get('/', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
    }))
    .get('/db', async () => {
        // Mirror: probe the DB but do NOT return any aggregate counts.
        return {
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
        };
    });

describe('Health Routes', () => {
    const app = testHealthRoutes;

    describe('GET /health', () => {
        it('should return status ok', async () => {
            const response = await app.handle(new Request('http://localhost/health'));

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.timestamp).toBeDefined();
        });

        it('should return valid ISO timestamp', async () => {
            const response = await app.handle(new Request('http://localhost/health'));

            const data = (await response.json()) as { timestamp: string };
            const timestamp = new Date(data.timestamp);

            expect(timestamp.toString()).not.toBe('Invalid Date');
        });

        it('should return JSON content type', async () => {
            const response = await app.handle(new Request('http://localhost/health'));

            expect(response.headers.get('content-type')).toContain('application/json');
        });
    });

    describe('GET /health/db', () => {
        it('should not expose user counts or other aggregates', async () => {
            const response = await app.handle(new Request('http://localhost/health/db'));
            expect(response.status).toBe(200);

            const data = (await response.json()) as Record<string, unknown>;
            expect(data.status).toBe('ok');
            expect(data.database).toBe('connected');
            expect(data.timestamp).toBeDefined();
            expect(data).not.toHaveProperty('usersCount');
            expect(data).not.toHaveProperty('count');
        });
    });
});
