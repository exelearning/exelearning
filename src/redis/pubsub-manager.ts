/**
 * Pub/Sub Manager for Cross-Instance Message Relay
 *
 * Handles Yjs WebSocket message synchronization between multiple
 * eXeLearning server instances via Redis pub/sub.
 *
 * Key features:
 * - Instance ID for message deduplication
 * - Base64 encoding for binary Yjs messages
 * - Channel-per-document pattern
 */
import { randomUUID } from 'crypto';
import { getPublisher, getSubscriber, isRedisEnabled, isRedisConnected } from './client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message format for cross-instance communication
 */
export interface CrossInstanceMessage {
    /** Unique instance identifier (for deduplication) */
    instanceId: string;
    /** Message timestamp */
    timestamp: number;
    /** Document/room name */
    docName: string;
    /** Message type */
    messageType: 'yjs' | 'asset';
    /** Base64-encoded payload */
    payload: string;
    /** Optional client ID (for asset messages) */
    clientId?: string;
    /** Optional project UUID */
    projectUuid?: string;
}

/**
 * Message metadata
 */
export interface MessageMeta {
    isAsset?: boolean;
    clientId?: string;
    projectUuid?: string;
}

/**
 * Handler for incoming cross-instance messages
 */
export type CrossInstanceMessageHandler = (
    docName: string,
    message: Buffer,
    meta: { isAsset: boolean; clientId?: string },
) => void;

/**
 * Dependencies for PubSubManager (for testing)
 */
export interface PubSubManagerDependencies {
    instanceId?: string;
    getPublisher?: typeof getPublisher;
    getSubscriber?: typeof getSubscriber;
    isRedisEnabled?: typeof isRedisEnabled;
    isRedisConnected?: typeof isRedisConnected;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Channel prefix for Yjs documents */
const CHANNEL_PREFIX = 'exe:yjs:';

/** Generate channel name from document name */
function getChannelName(docName: string): string {
    return `${CHANNEL_PREFIX}${docName}`;
}

// ============================================================================
// MODULE STATE
// ============================================================================

/** Unique instance ID (generated at startup) */
const INSTANCE_ID = randomUUID();

/** Set of subscribed channels */
const subscribedChannels = new Set<string>();

/** Message handler callback */
let messageHandler: CrossInstanceMessageHandler | null = null;

/** Whether the subscriber listener is set up */
let listenerInitialized = false;

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Initialize the subscriber message listener
 * Must be called after Redis is connected
 */
function initializeListener(): void {
    if (listenerInitialized) return;

    const subscriber = getSubscriber();
    if (!subscriber) return;

    subscriber.on('message', (channel: string, rawMessage: string) => {
        try {
            const msg: CrossInstanceMessage = JSON.parse(rawMessage);

            // Skip messages from this instance (deduplication)
            if (msg.instanceId === INSTANCE_ID) {
                return;
            }

            // Decode base64 payload
            const payload = Buffer.from(msg.payload, 'base64');

            // Call handler if set
            if (messageHandler) {
                messageHandler(msg.docName, payload, {
                    isAsset: msg.messageType === 'asset',
                    clientId: msg.clientId,
                });
            }
        } catch (err) {
            console.error('[PubSubManager] Failed to parse message:', err);
        }
    });

    listenerInitialized = true;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the unique instance ID
 */
export function getInstanceId(): string {
    return INSTANCE_ID;
}

/**
 * Set the handler for incoming cross-instance messages
 */
export function setMessageHandler(handler: CrossInstanceMessageHandler): void {
    messageHandler = handler;
    initializeListener();
}

/**
 * Check if pub/sub is enabled and connected
 */
export function isPubSubEnabled(): boolean {
    return isRedisEnabled() && isRedisConnected();
}

/**
 * Publish a message to other instances
 *
 * @param docName - Document/room name
 * @param message - Raw message (Buffer or string)
 * @param meta - Optional message metadata
 */
export async function publish(docName: string, message: Buffer | string, meta?: MessageMeta): Promise<void> {
    if (!isPubSubEnabled()) {
        return; // Single-instance mode or Redis down
    }

    const publisher = getPublisher();
    if (!publisher) return;

    const channel = getChannelName(docName);

    // Encode message as base64
    const payload = Buffer.isBuffer(message) ? message.toString('base64') : Buffer.from(message).toString('base64');

    const crossMsg: CrossInstanceMessage = {
        instanceId: INSTANCE_ID,
        timestamp: Date.now(),
        docName,
        messageType: meta?.isAsset ? 'asset' : 'yjs',
        payload,
        clientId: meta?.clientId,
        projectUuid: meta?.projectUuid,
    };

    try {
        await publisher.publish(channel, JSON.stringify(crossMsg));
    } catch (err) {
        console.error(`[PubSubManager] Failed to publish to ${channel}:`, err);
    }
}

/**
 * Subscribe to a document channel
 *
 * @param docName - Document/room name
 */
export async function subscribe(docName: string): Promise<void> {
    if (!isPubSubEnabled()) {
        return;
    }

    const subscriber = getSubscriber();
    if (!subscriber) return;

    const channel = getChannelName(docName);

    if (subscribedChannels.has(channel)) {
        return; // Already subscribed
    }

    try {
        await subscriber.subscribe(channel);
        subscribedChannels.add(channel);
        console.log(`[PubSubManager] Subscribed to ${channel}`);
    } catch (err) {
        console.error(`[PubSubManager] Failed to subscribe to ${channel}:`, err);
    }
}

/**
 * Unsubscribe from a document channel
 *
 * @param docName - Document/room name
 */
export async function unsubscribe(docName: string): Promise<void> {
    if (!isRedisEnabled()) {
        return;
    }

    const subscriber = getSubscriber();
    if (!subscriber) return;

    const channel = getChannelName(docName);

    if (!subscribedChannels.has(channel)) {
        return; // Not subscribed
    }

    try {
        await subscriber.unsubscribe(channel);
        subscribedChannels.delete(channel);
        console.log(`[PubSubManager] Unsubscribed from ${channel}`);
    } catch (err) {
        console.error(`[PubSubManager] Failed to unsubscribe from ${channel}:`, err);
    }
}

/**
 * Get pub/sub statistics
 */
export function getPubSubStats(): {
    enabled: boolean;
    connected: boolean;
    instanceId: string;
    subscribedChannels: number;
} {
    return {
        enabled: isRedisEnabled(),
        connected: isRedisConnected(),
        instanceId: INSTANCE_ID,
        subscribedChannels: subscribedChannels.size,
    };
}

/**
 * Unsubscribe from all channels (for graceful shutdown)
 */
export async function unsubscribeAll(): Promise<void> {
    const subscriber = getSubscriber();
    if (!subscriber) return;

    for (const channel of subscribedChannels) {
        try {
            await subscriber.unsubscribe(channel);
        } catch {
            // Ignore errors during shutdown
        }
    }

    subscribedChannels.clear();
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Reset module state (for testing only)
 */
export function resetPubSubState(): void {
    subscribedChannels.clear();
    messageHandler = null;
    listenerInitialized = false;
}

/**
 * Get subscribed channels (for testing)
 */
export function getSubscribedChannels(): string[] {
    return Array.from(subscribedChannels);
}
