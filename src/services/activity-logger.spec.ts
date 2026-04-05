/**
 * Tests for Activity Logger Service
 */
import { describe, it, expect, afterEach } from 'bun:test';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { logActivity, configure, resetDependencies } from './activity-logger';

const mockDb = {} as Kysely<Database>;

describe('activity-logger service', () => {
    afterEach(() => {
        resetDependencies();
    });

    describe('logActivity', () => {
        it('calls insertActivityEvent with correct fields', async () => {
            const calls: unknown[] = [];
            configure({
                insertActivityEvent: async (_db, event) => {
                    calls.push(event);
                },
            });

            await logActivity(mockDb, {
                eventType: 'auth.login',
                userId: 1,
            });

            expect(calls).toHaveLength(1);
            const event = calls[0] as Record<string, unknown>;
            expect(event.event_type).toBe('auth.login');
            expect(event.user_id).toBe(1);
            expect(typeof event.created_at).toBe('number');
        });

        it('stores null for userId when not provided', async () => {
            const calls: unknown[] = [];
            configure({
                insertActivityEvent: async (_db, event) => {
                    calls.push(event);
                },
            });

            await logActivity(mockDb, { eventType: 'auth.login' });

            const event = calls[0] as Record<string, unknown>;
            expect(event.user_id).toBeNull();
        });

        it('does not throw when insertActivityEvent rejects', async () => {
            configure({
                insertActivityEvent: async () => {
                    throw new Error('DB connection lost');
                },
            });

            await expect(logActivity(mockDb, { eventType: 'auth.login' })).resolves.toBeUndefined();
        });
    });
});
