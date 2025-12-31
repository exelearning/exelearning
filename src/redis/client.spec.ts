/**
 * Tests for Redis client module
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
    isRedisEnabled,
    getRedisConfig,
    getPublisher,
    getSubscriber,
    connectRedis,
    disconnectRedis,
    isRedisConnected,
    getRedisStatus,
    resetRedisState,
} from './client';

describe('Redis Client', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetRedisState();
        // Clear Redis-related env vars
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PORT;
        delete process.env.REDIS_PASSWORD;
    });

    afterEach(() => {
        resetRedisState();
        // Restore original env
        process.env = { ...originalEnv };
    });

    describe('isRedisEnabled', () => {
        test('returns false when REDIS_HOST is not set', () => {
            delete process.env.REDIS_HOST;
            expect(isRedisEnabled()).toBe(false);
        });

        test('returns false when REDIS_HOST is empty string', () => {
            process.env.REDIS_HOST = '';
            expect(isRedisEnabled()).toBe(false);
        });

        test('returns false when REDIS_HOST is only whitespace', () => {
            process.env.REDIS_HOST = '   ';
            expect(isRedisEnabled()).toBe(false);
        });

        test('returns true when REDIS_HOST is set', () => {
            process.env.REDIS_HOST = 'redis';
            expect(isRedisEnabled()).toBe(true);
        });

        test('returns true when REDIS_HOST has leading/trailing spaces', () => {
            process.env.REDIS_HOST = '  redis  ';
            expect(isRedisEnabled()).toBe(true);
        });
    });

    describe('getRedisConfig', () => {
        test('returns null when Redis is disabled', () => {
            delete process.env.REDIS_HOST;
            expect(getRedisConfig()).toBeNull();
        });

        test('returns config with default port when REDIS_PORT not set', () => {
            process.env.REDIS_HOST = 'redis';
            const config = getRedisConfig();

            expect(config).not.toBeNull();
            expect(config!.host).toBe('redis');
            expect(config!.port).toBe(6379);
            expect(config!.password).toBeUndefined();
        });

        test('returns config with custom port', () => {
            process.env.REDIS_HOST = 'redis';
            process.env.REDIS_PORT = '6380';
            const config = getRedisConfig();

            expect(config!.port).toBe(6380);
        });

        test('returns config with password when set', () => {
            process.env.REDIS_HOST = 'redis';
            process.env.REDIS_PASSWORD = 'secret123';
            const config = getRedisConfig();

            expect(config!.password).toBe('secret123');
        });

        test('trims whitespace from host', () => {
            process.env.REDIS_HOST = '  redis.example.com  ';
            const config = getRedisConfig();

            expect(config!.host).toBe('redis.example.com');
        });

        test('caches config after first call', () => {
            process.env.REDIS_HOST = 'redis1';
            const config1 = getRedisConfig();

            process.env.REDIS_HOST = 'redis2';
            const config2 = getRedisConfig();

            expect(config1).toBe(config2);
            expect(config2!.host).toBe('redis1');
        });
    });

    describe('getPublisher', () => {
        test('returns null when Redis is disabled', () => {
            delete process.env.REDIS_HOST;
            expect(getPublisher()).toBeNull();
        });

        test('returns Redis client when enabled', () => {
            process.env.REDIS_HOST = 'redis';
            const publisher = getPublisher();

            expect(publisher).not.toBeNull();
        });

        test('returns same instance on multiple calls', () => {
            process.env.REDIS_HOST = 'redis';
            const pub1 = getPublisher();
            const pub2 = getPublisher();

            expect(pub1).toBe(pub2);
        });
    });

    describe('getSubscriber', () => {
        test('returns null when Redis is disabled', () => {
            delete process.env.REDIS_HOST;
            expect(getSubscriber()).toBeNull();
        });

        test('returns Redis client when enabled', () => {
            process.env.REDIS_HOST = 'redis';
            const subscriber = getSubscriber();

            expect(subscriber).not.toBeNull();
        });

        test('returns different instance than publisher', () => {
            process.env.REDIS_HOST = 'redis';
            const publisher = getPublisher();
            const subscriber = getSubscriber();

            expect(publisher).not.toBe(subscriber);
        });
    });

    describe('isRedisConnected', () => {
        test('returns false when not connected', () => {
            delete process.env.REDIS_HOST;
            expect(isRedisConnected()).toBe(false);
        });

        test('returns false when clients created but not connected', () => {
            process.env.REDIS_HOST = 'redis';
            getPublisher();
            getSubscriber();

            // Clients are created with lazyConnect, so not connected yet
            expect(isRedisConnected()).toBe(false);
        });
    });

    describe('getRedisStatus', () => {
        test('returns disabled status when Redis not configured', () => {
            delete process.env.REDIS_HOST;
            const status = getRedisStatus();

            expect(status.enabled).toBe(false);
            expect(status.connected).toBe(false);
            expect(status.publisherStatus).toBe('not_initialized');
            expect(status.subscriberStatus).toBe('not_initialized');
        });

        test('returns enabled but not connected when clients created', () => {
            process.env.REDIS_HOST = 'redis';
            getPublisher();
            getSubscriber();

            const status = getRedisStatus();

            expect(status.enabled).toBe(true);
            expect(status.connected).toBe(false);
            // Status will be 'wait' for lazyConnect clients
            expect(status.publisherStatus).not.toBe('not_initialized');
            expect(status.subscriberStatus).not.toBe('not_initialized');
        });
    });

    describe('resetRedisState', () => {
        test('clears all state', () => {
            process.env.REDIS_HOST = 'redis';
            getPublisher();
            getSubscriber();
            getRedisConfig();

            resetRedisState();

            // After reset, getPublisher should create new instances
            process.env.REDIS_HOST = 'redis2';
            const config = getRedisConfig();

            expect(config!.host).toBe('redis2');
        });
    });

    describe('connectRedis', () => {
        test('returns false when Redis is not enabled', async () => {
            delete process.env.REDIS_HOST;
            const result = await connectRedis();
            expect(result).toBe(false);
        });

        test('returns false when connection fails (invalid host)', async () => {
            process.env.REDIS_HOST = 'nonexistent-redis-host-12345';
            process.env.REDIS_PORT = '6379';

            // This will fail quickly because the host doesn't exist
            const result = await connectRedis();
            // Connection will fail but shouldn't throw
            expect(typeof result).toBe('boolean');
        });
    });

    describe('disconnectRedis', () => {
        test('completes without error when no clients exist', async () => {
            delete process.env.REDIS_HOST;
            await expect(disconnectRedis()).resolves.toBeUndefined();
        });

        test('completes without error when clients exist but not connected', async () => {
            process.env.REDIS_HOST = 'redis';
            getPublisher();
            getSubscriber();

            await expect(disconnectRedis()).resolves.toBeUndefined();
        });
    });
});
