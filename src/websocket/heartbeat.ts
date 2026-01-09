/**
 * Heartbeat Manager for WebSocket Connections
 * Uses Bun's native WebSocket ping/pong support
 *
 * Purpose:
 * - Keep connections alive behind proxies (which typically timeout at ~60s)
 * - Detect dead connections and clean them up
 * - Uses AbortController for safe cleanup (no orphan timers)
 */
import type { ServerWebSocket } from 'bun';
import { getConfig, isDebugEnabled } from './config';
import { getLogger } from '../contexts/logger.context';

// Create logger for heartbeat module
const logger = getLogger().child({ component: 'heartbeat' });

/**
 * WebSocket data interface (must match yjs-websocket.ts)
 */
interface WsData {
    clientId: string;
    userId: number;
    projectUuid: string;
    docName: string;
}

/**
 * State tracked per client for heartbeat
 */
interface HeartbeatState {
    timer: Timer;
    lastPong: number;
    abortController: AbortController;
    ws: ServerWebSocket<WsData>;
}

/**
 * Active heartbeat states by client ID
 */
const heartbeats = new Map<string, HeartbeatState>();

/**
 * Start heartbeat monitoring for a client
 * Sends periodic pings and expects pong responses
 *
 * @param clientId - Unique client identifier
 * @param ws - Bun ServerWebSocket instance
 */
export function startHeartbeat(clientId: string, ws: ServerWebSocket<WsData>): void {
    // Clean up any existing heartbeat for this client
    stopHeartbeat(clientId);

    const config = getConfig();
    const abortController = new AbortController();

    const timer = setInterval(() => {
        // Check if aborted (cleanup was called)
        if (abortController.signal.aborted) {
            return;
        }

        const state = heartbeats.get(clientId);
        if (!state) {
            return;
        }

        // Check if pong was received within timeout
        const timeSinceLastPong = Date.now() - state.lastPong;
        if (timeSinceLastPong > config.pingInterval + config.pongTimeout) {
            if (isDebugEnabled()) {
                logger.debug('Client timed out', { clientId, timeSinceLastPong });
            }
            ws.close(4008, 'Heartbeat timeout');
            stopHeartbeat(clientId);
            return;
        }

        // Send ping - Bun's ServerWebSocket supports native ping()
        try {
            ws.ping();
            if (isDebugEnabled()) {
                logger.debug('Sent ping', { clientId });
            }
        } catch (err) {
            if (isDebugEnabled()) {
                logger.error('Failed to send ping', err instanceof Error ? err : null, { clientId });
            }
            // Connection likely closed, cleanup will happen via close handler
        }
    }, config.pingInterval);

    heartbeats.set(clientId, {
        timer,
        lastPong: Date.now(),
        abortController,
        ws,
    });

    if (isDebugEnabled()) {
        logger.debug('Started', { clientId, interval: config.pingInterval });
    }
}

/**
 * Handle pong response from client
 * Updates the last pong timestamp
 *
 * @param clientId - Client that sent the pong
 */
export function onPong(clientId: string): void {
    const state = heartbeats.get(clientId);
    if (state) {
        state.lastPong = Date.now();
        if (isDebugEnabled()) {
            logger.debug('Received pong', { clientId });
        }
    }
}

/**
 * Stop heartbeat monitoring for a client
 * Safe to call multiple times
 *
 * @param clientId - Client to stop monitoring
 */
export function stopHeartbeat(clientId: string): void {
    const state = heartbeats.get(clientId);
    if (state) {
        // Signal abort to prevent any pending callbacks
        state.abortController.abort();
        // Clear the interval timer
        clearInterval(state.timer);
        // Remove from map
        heartbeats.delete(clientId);

        if (isDebugEnabled()) {
            logger.debug('Stopped', { clientId });
        }
    }
}

/**
 * Get heartbeat stats for monitoring
 */
export function getHeartbeatStats(): { activeClients: number; clientIds: string[] } {
    return {
        activeClients: heartbeats.size,
        clientIds: Array.from(heartbeats.keys()),
    };
}

/**
 * Stop all heartbeats (for graceful shutdown)
 */
export function stopAllHeartbeats(): void {
    for (const clientId of heartbeats.keys()) {
        stopHeartbeat(clientId);
    }
    if (isDebugEnabled()) {
        logger.debug('Stopped all heartbeats');
    }
}
