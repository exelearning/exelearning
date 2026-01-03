/**
 * Redis Client for High Availability
 *
 * Lazy initialization pattern (like db/client.ts).
 * Uses separate clients for pub/sub (ioredis requirement).
 *
 * Configuration via environment variables:
 * - REDIS_HOST: Redis server hostname (empty = disabled)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 */
import Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
}

// ============================================================================
// MODULE STATE
// ============================================================================

let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;
let _config: RedisConfig | null = null;
let _connected = false;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check if Redis is enabled (REDIS_HOST is set)
 */
export function isRedisEnabled(): boolean {
    const host = process.env.REDIS_HOST?.trim();
    return !!host && host.length > 0;
}

/**
 * Get Redis configuration from environment
 */
export function getRedisConfig(): RedisConfig | null {
    if (_config) return _config;

    if (!isRedisEnabled()) {
        return null;
    }

    _config = {
        host: process.env.REDIS_HOST!.trim(),
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD?.trim() || undefined,
    };

    return _config;
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Create a Redis client with standard options
 */
function createRedisClient(role: 'pub' | 'sub'): Redis | null {
    const config = getRedisConfig();
    if (!config) return null;

    const client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        lazyConnect: true,
        retryStrategy: (times: number) => {
            if (times > 10) {
                console.error(`[Redis-${role}] Max retries reached, giving up`);
                return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        showFriendlyErrorStack: process.env.APP_ENV !== 'prod',
    });

    client.on('error', err => {
        console.error(`[Redis-${role}] Error:`, err.message);
    });

    client.on('connect', () => {
        console.log(`[Redis-${role}] Connected to ${config.host}:${config.port}`);
    });

    client.on('ready', () => {
        console.log(`[Redis-${role}] Ready`);
    });

    client.on('reconnecting', () => {
        console.log(`[Redis-${role}] Reconnecting...`);
    });

    client.on('close', () => {
        console.log(`[Redis-${role}] Connection closed`);
    });

    return client;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the publisher client (for PUBLISH commands)
 */
export function getPublisher(): Redis | null {
    if (!isRedisEnabled()) return null;

    if (!_publisher) {
        _publisher = createRedisClient('pub');
    }
    return _publisher;
}

/**
 * Get the subscriber client (for SUBSCRIBE commands)
 * Note: ioredis requires separate client for subscriptions
 */
export function getSubscriber(): Redis | null {
    if (!isRedisEnabled()) return null;

    if (!_subscriber) {
        _subscriber = createRedisClient('sub');
    }
    return _subscriber;
}

/**
 * Connect both Redis clients
 * Returns true if successfully connected, false otherwise
 */
export async function connectRedis(): Promise<boolean> {
    if (!isRedisEnabled()) {
        console.log('[Redis] REDIS_HOST not set, running in single-instance mode');
        return false;
    }

    try {
        const publisher = getPublisher();
        const subscriber = getSubscriber();

        if (!publisher || !subscriber) {
            console.error('[Redis] Failed to create clients');
            return false;
        }

        // Connect both clients
        await Promise.all([publisher.connect(), subscriber.connect()]);

        _connected = true;
        console.log('[Redis] Pub/sub clients connected successfully');
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Redis] Failed to connect:', message);
        _connected = false;
        return false;
    }
}

/**
 * Disconnect both Redis clients gracefully
 */
export async function disconnectRedis(): Promise<void> {
    if (_publisher) {
        try {
            await _publisher.quit();
        } catch {
            // Ignore quit errors
        }
        _publisher = null;
    }

    if (_subscriber) {
        try {
            await _subscriber.quit();
        } catch {
            // Ignore quit errors
        }
        _subscriber = null;
    }

    _connected = false;
    _config = null;
    console.log('[Redis] Disconnected');
}

/**
 * Check if Redis is currently connected and ready
 */
export function isRedisConnected(): boolean {
    if (!_connected) return false;

    const pubReady = _publisher?.status === 'ready';
    const subReady = _subscriber?.status === 'ready';

    return pubReady === true && subReady === true;
}

/**
 * Get Redis status for health checks
 */
export function getRedisStatus(): {
    enabled: boolean;
    connected: boolean;
    publisherStatus: string;
    subscriberStatus: string;
} {
    return {
        enabled: isRedisEnabled(),
        connected: isRedisConnected(),
        publisherStatus: _publisher?.status || 'not_initialized',
        subscriberStatus: _subscriber?.status || 'not_initialized',
    };
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Reset module state (for testing only)
 */
export function resetRedisState(): void {
    _publisher = null;
    _subscriber = null;
    _config = null;
    _connected = false;
}
