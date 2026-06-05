/**
 * Message Parser for WebSocket Messages
 * Safely distinguishes between binary Yjs messages and JSON asset coordination messages
 *
 * Purpose:
 * - Robust detection of message type (no fragile byte checks)
 * - Type-safe parsing with proper error handling
 * - Clear separation between Yjs sync and asset coordination
 */
import type { AssetMessage, AssetMessageType } from './types';
import { DEBUG } from './config';

/**
 * All valid asset message types
 */
const ASSET_MESSAGE_TYPES: Set<string> = new Set([
    'awareness-update',
    'request-asset',
    'asset-uploaded',
    'prefetch-progress',
    'bulk-upload-progress',
    'upload-request',
    'bulk-upload-request',
    'asset-ready',
    'asset-not-found',
    'request-prefetch',
    'asset-available',
    'bulk-upload-complete',
    // Priority queue messages
    'priority-update',
    'priority-ack',
    'navigation-hint',
    'preempt-upload',
    'resume-upload',
    'slot-available',
    'request-sync-state',
    'access-revoked',
    // Upload session messages
    'upload-session-create',
    'upload-session-ready',
    'upload-file-progress',
    'upload-batch-complete',
    // Collaboration resync messages
    'trigger-resync',
]);

/**
 * Check if a message type is an asset coordination message
 */
export function isAssetMessageType(type: unknown): type is AssetMessageType {
    return typeof type === 'string' && ASSET_MESSAGE_TYPES.has(type);
}

/**
 * Parsed message result types
 */
export type ParsedMessage =
    | { kind: 'yjs'; data: Uint8Array }
    | { kind: 'asset'; message: AssetMessage }
    | { kind: 'unknown'; raw: Buffer | string };

/**
 * Parse an incoming WebSocket message
 * Safely determines if it's a Yjs binary message or JSON asset message
 *
 * @param message - Raw message from WebSocket (Buffer or string)
 * @returns Parsed message with type discrimination
 */
export function parseMessage(message: Buffer | string): ParsedMessage {
    // String messages are always JSON attempts
    if (typeof message === 'string') {
        return parseJsonString(message);
    }

    // Buffer: check if it could be JSON
    // Yjs messages start with specific bytes (sync protocol)
    // JSON messages start with '{' (0x7b) but we use try-catch for safety
    return parseBuffer(message);
}

/**
 * Parse a string message (always attempt JSON)
 */
function parseJsonString(message: string): ParsedMessage {
    // Quick check - JSON objects start with {
    if (!message.startsWith('{')) {
        return { kind: 'unknown', raw: message };
    }

    try {
        const parsed = JSON.parse(message);

        // Validate it's an asset message
        if (parsed && typeof parsed === 'object' && isAssetMessageType(parsed.type)) {
            return {
                kind: 'asset',
                message: parsed as AssetMessage,
            };
        }

        // Valid JSON but not an asset message
        if (DEBUG) {
            console.log(`[MessageParser] Unknown JSON message type: ${parsed.type}`);
        }
        return { kind: 'unknown', raw: message };
    } catch {
        // Invalid JSON string
        return { kind: 'unknown', raw: message };
    }
}

/**
 * Asset message prefix byte (0xFF)
 * Messages from clients with this prefix are asset coordination messages
 * Format: [0xFF][JSON bytes]
 */
const ASSET_MESSAGE_PREFIX = 0xff;

/**
 * Parse a Buffer message
 * Could be binary Yjs or JSON asset message (with 0xFF prefix)
 */
function parseBuffer(message: Buffer): ParsedMessage {
    if (message.length === 0) {
        return { kind: 'unknown', raw: message };
    }

    // Check for asset message prefix (0xFF)
    // This is the new binary protocol for asset messages
    if (message[0] === ASSET_MESSAGE_PREFIX && message.length > 1) {
        try {
            const jsonBytes = message.subarray(1);
            const str = jsonBytes.toString('utf8');
            const parsed = JSON.parse(str);

            if (parsed && typeof parsed === 'object' && isAssetMessageType(parsed.type)) {
                return {
                    kind: 'asset',
                    message: parsed as AssetMessage,
                };
            }

            // Valid JSON but not asset message - treat as unknown
            if (DEBUG) {
                console.log(`[MessageParser] Unknown JSON message type in 0xFF message: ${parsed.type}`);
            }
            return { kind: 'unknown', raw: message };
        } catch {
            // Not valid JSON after 0xFF prefix - treat as unknown
            if (DEBUG) {
                console.log('[MessageParser] Invalid JSON after 0xFF prefix');
            }
            return { kind: 'unknown', raw: message };
        }
    }

    // Legacy: Check if first byte suggests JSON ('{' = 0x7b = 123)
    // This handles old clients that might still send plain JSON
    if (message[0] === 123) {
        try {
            const str = message.toString('utf8');
            const parsed = JSON.parse(str);

            if (parsed && typeof parsed === 'object' && isAssetMessageType(parsed.type)) {
                return {
                    kind: 'asset',
                    message: parsed as AssetMessage,
                };
            }

            if (DEBUG) {
                console.log(`[MessageParser] Unknown JSON message type in buffer: ${parsed.type}`);
            }
            return { kind: 'unknown', raw: message };
        } catch {
            // Not valid JSON despite starting with {
            // Could be binary data that happens to start with 123
            // Fall through to treat as Yjs
        }
    }

    // Yjs sync messages start with specific bytes
    // - 0: sync step 1 (SyncStep1)
    // - 1: sync step 2 (SyncStep2)
    // - 2: update (SyncUpdate)
    // Common values: 0 (sync), 1 (awareness)
    if (message[0] <= 2) {
        // Definitely a Yjs sync message
        return { kind: 'yjs', data: new Uint8Array(message) };
    }

    // Default: treat as Yjs binary message
    // This is safe because Yjs handles invalid updates gracefully
    return { kind: 'yjs', data: new Uint8Array(message) };
}

/**
 * Serialize an asset message for sending
 */
export function serializeAssetMessage(message: AssetMessage): string {
    return JSON.stringify(message);
}

/**
 * Create a typed asset message
 */
export function createAssetMessage<T extends AssetMessageType>(
    type: T,
    projectId: string,
    clientId: string,
    data: unknown,
): AssetMessage {
    return {
        type,
        projectId,
        clientId,
        data,
    };
}
