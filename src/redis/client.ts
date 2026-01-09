/**
 * Redis Client for High Availability
 *
 * Lazy initialization pattern (like db/client.ts).
 * Uses separate clients for pub/sub (ioredis requirement).
 *
 * Now supports ConfigContext for centralized configuration.
 * Falls back to getConfig() singleton for backward compatibility.
 *
 * Configuration via ConfigContext or environment variables:
 * - REDIS_HOST: Redis server hostname (empty = disabled)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 */
import Redis from 'ioredis';
import { getConfig, type ConfigContext } from '../contexts/config.context';
import { getLogger } from '../contexts/logger.context';

// Create logger for Redis module
const logger = getLogger().child({ component: 'redis' });

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
 * Check if Redis is enabled
 *
 * @param config - Optional ConfigContext. If not provided, uses getConfig() singleton.
 */
export function isRedisEnabled(config?: ConfigContext): boolean {
    const cfg = config ?? getConfig();
    return cfg.redis.enabled;
}

/**
 * Get Redis configuration from ConfigContext or environment
 *
 * @param config - Optional ConfigContext. If not provided, uses getConfig() singleton.
 */
export function getRedisConfig(config?: ConfigContext): RedisConfig | null {
    if (_config) return _config;

    const cfg = config ?? getConfig();
    if (!cfg.redis.enabled) {
        return null;
    }

    _config = {
        host: cfg.redis.host,
        port: cfg.redis.port,
        password: cfg.redis.password || undefined,
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
    const redisConfig = getRedisConfig();
    if (!redisConfig) return null;

    const appConfig = getConfig();
    const client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        lazyConnect: true,
        retryStrategy: (times: number) => {
            if (times > 10) {
                logger.error('Max retries reached, giving up', null, { role });
                return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        showFriendlyErrorStack: appConfig.env !== 'prod',
    });

    client.on('error', err => {
        logger.error('Connection error', err, { role });
    });

    client.on('connect', () => {
        logger.info('Connected', { role, host: redisConfig.host, port: redisConfig.port });
    });

    client.on('ready', () => {
        logger.debug('Ready', { role });
    });

    client.on('reconnecting', () => {
        logger.info('Reconnecting', { role });
    });

    client.on('close', () => {
        logger.info('Connection closed', { role });
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
        logger.debug('REDIS_HOST not set, running in single-instance mode');
        return false;
    }

    try {
        const publisher = getPublisher();
        const subscriber = getSubscriber();

        if (!publisher || !subscriber) {
            logger.error('Failed to create clients');
            return false;
        }

        // Connect both clients
        await Promise.all([publisher.connect(), subscriber.connect()]);

        _connected = true;
        logger.info('Pub/sub clients connected successfully');
        return true;
    } catch (err) {
        logger.error('Failed to connect', err instanceof Error ? err : new Error(String(err)));
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
    logger.debug('Disconnected');
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
