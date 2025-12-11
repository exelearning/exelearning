/**
 * Health Check Routes
 */
import { Elysia } from 'elysia';
import { db } from '../db/client';

export const healthRoutes = new Elysia({ prefix: '/health' })
    .get('/', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
    }))
    .get('/db', async () => {
        try {
            // Test database connection by counting users
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

// Alias for /healthcheck (backwards compatibility with Electron main.js)
export const healthCheckAlias = new Elysia().get('/healthcheck', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
}));
