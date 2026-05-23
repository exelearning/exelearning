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
            // Probe the database with a minimal query. We intentionally do NOT
            // return any aggregate counts (e.g. user count) on this public
            // endpoint — that information is available to admins via
            // /api/admin/stats.
            await db
                .selectFrom('users')
                .select(({ fn }) => fn.countAll().as('count'))
                .executeTakeFirst();
            return {
                status: 'ok',
                database: 'connected',
                timestamp: new Date().toISOString(),
            };
        } catch {
            return {
                status: 'error',
                database: 'disconnected',
                timestamp: new Date().toISOString(),
            };
        }
    });

// Alias for /healthcheck (backwards compatibility with Electron main.js)
export const healthCheckAlias = new Elysia().get('/healthcheck', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
}));
