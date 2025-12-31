/**
 * Tests for Redis pub/sub manager module
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
    getInstanceId,
    setMessageHandler,
    isPubSubEnabled,
    publish,
    subscribe,
    unsubscribe,
    getPubSubStats,
    unsubscribeAll,
    resetPubSubState,
    getSubscribedChannels,
} from './pubsub-manager';
import { resetRedisState } from './client';

describe('PubSub Manager', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetPubSubState();
        resetRedisState();
        // Clear Redis-related env vars
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PORT;
        delete process.env.REDIS_PASSWORD;
    });

    afterEach(() => {
        resetPubSubState();
        resetRedisState();
        // Restore original env
        process.env = { ...originalEnv };
    });

    describe('getInstanceId', () => {
        test('returns a UUID string', () => {
            const id = getInstanceId();

            expect(id).toBeDefined();
            expect(typeof id).toBe('string');
            // UUID v4 format
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        test('returns same ID on multiple calls', () => {
            const id1 = getInstanceId();
            const id2 = getInstanceId();

            expect(id1).toBe(id2);
        });
    });

    describe('isPubSubEnabled', () => {
        test('returns false when Redis is not configured', () => {
            delete process.env.REDIS_HOST;
            expect(isPubSubEnabled()).toBe(false);
        });

        test('returns false when Redis is configured but not connected', () => {
            process.env.REDIS_HOST = 'redis';
            // Not connected, so should return false
            expect(isPubSubEnabled()).toBe(false);
        });
    });

    describe('getPubSubStats', () => {
        test('returns disabled stats when Redis not configured', () => {
            delete process.env.REDIS_HOST;
            const stats = getPubSubStats();

            expect(stats.enabled).toBe(false);
            expect(stats.connected).toBe(false);
            expect(stats.subscribedChannels).toBe(0);
            expect(stats.instanceId).toBeDefined();
        });

        test('returns enabled but not connected when configured', () => {
            process.env.REDIS_HOST = 'redis';
            const stats = getPubSubStats();

            expect(stats.enabled).toBe(true);
            expect(stats.connected).toBe(false);
            expect(stats.subscribedChannels).toBe(0);
        });
    });

    describe('setMessageHandler', () => {
        test('accepts a handler function', () => {
            const handler = (docName: string, message: Buffer, meta: { isAsset: boolean }) => {
                // Handler implementation
            };

            // Should not throw
            expect(() => setMessageHandler(handler)).not.toThrow();
        });
    });

    describe('publish', () => {
        test('returns without error when Redis not enabled', async () => {
            delete process.env.REDIS_HOST;

            // Should not throw
            await expect(publish('test-doc', Buffer.from('test'))).resolves.toBeUndefined();
        });

        test('returns without error when Redis configured but not connected', async () => {
            process.env.REDIS_HOST = 'redis';

            // Should not throw (just returns early)
            await expect(publish('test-doc', Buffer.from('test'))).resolves.toBeUndefined();
        });
    });

    describe('subscribe', () => {
        test('returns without error when Redis not enabled', async () => {
            delete process.env.REDIS_HOST;

            await expect(subscribe('test-doc')).resolves.toBeUndefined();
        });

        test('returns without error when Redis configured but not connected', async () => {
            process.env.REDIS_HOST = 'redis';

            await expect(subscribe('test-doc')).resolves.toBeUndefined();
        });
    });

    describe('unsubscribe', () => {
        test('returns without error when Redis not enabled', async () => {
            delete process.env.REDIS_HOST;

            await expect(unsubscribe('test-doc')).resolves.toBeUndefined();
        });
    });

    describe('unsubscribeAll', () => {
        test('clears all subscriptions', async () => {
            // Even without Redis connected, this should work
            await expect(unsubscribeAll()).resolves.toBeUndefined();

            const channels = getSubscribedChannels();
            expect(channels).toHaveLength(0);
        });
    });

    describe('getSubscribedChannels', () => {
        test('returns empty array initially', () => {
            const channels = getSubscribedChannels();
            expect(channels).toEqual([]);
        });
    });

    describe('resetPubSubState', () => {
        test('clears subscribed channels', () => {
            // Internal state, but we can verify through getSubscribedChannels
            resetPubSubState();
            expect(getSubscribedChannels()).toEqual([]);
        });
    });

    describe('publish with message types', () => {
        test('handles Buffer message', async () => {
            delete process.env.REDIS_HOST;
            const buffer = Buffer.from([0x01, 0x02, 0x03]);
            await expect(publish('test-doc', buffer)).resolves.toBeUndefined();
        });

        test('handles string message', async () => {
            delete process.env.REDIS_HOST;
            await expect(publish('test-doc', 'string message')).resolves.toBeUndefined();
        });

        test('handles message with asset metadata', async () => {
            delete process.env.REDIS_HOST;
            await expect(
                publish('test-doc', Buffer.from('test'), {
                    isAsset: true,
                    clientId: 'client-123',
                    projectUuid: 'project-456',
                }),
            ).resolves.toBeUndefined();
        });

        test('handles message with yjs metadata', async () => {
            delete process.env.REDIS_HOST;
            await expect(
                publish('test-doc', Buffer.from('test'), {
                    isAsset: false,
                }),
            ).resolves.toBeUndefined();
        });
    });

    describe('subscribe edge cases', () => {
        test('handles multiple subscribe calls for same doc', async () => {
            delete process.env.REDIS_HOST;
            await subscribe('test-doc');
            await subscribe('test-doc'); // Should not error
            await expect(subscribe('test-doc')).resolves.toBeUndefined();
        });
    });

    describe('unsubscribe edge cases', () => {
        test('handles unsubscribe for non-subscribed doc', async () => {
            delete process.env.REDIS_HOST;
            await expect(unsubscribe('never-subscribed-doc')).resolves.toBeUndefined();
        });
    });

    describe('setMessageHandler edge cases', () => {
        test('can be called multiple times', () => {
            const handler1 = () => {};
            const handler2 = () => {};

            expect(() => {
                setMessageHandler(handler1);
                setMessageHandler(handler2);
            }).not.toThrow();
        });
    });

    describe('getInstanceId consistency', () => {
        test('returns consistent ID within same process', () => {
            const ids = [getInstanceId(), getInstanceId(), getInstanceId()];
            expect(new Set(ids).size).toBe(1);
        });
    });
});
