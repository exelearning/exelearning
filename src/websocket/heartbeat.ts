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
                console.log(`[Heartbeat] Client ${clientId} timed out (${timeSinceLastPong}ms since last pong)`);
            }
            ws.close(4008, 'Heartbeat timeout');
            stopHeartbeat(clientId);
            return;
        }

        // Send ping - Bun's ServerWebSocket supports native ping()
        try {
            ws.ping();
            if (isDebugEnabled()) {
                console.log(`[Heartbeat] Sent ping to ${clientId}`);
            }
        } catch (err) {
            if (isDebugEnabled()) {
                console.error(`[Heartbeat] Failed to send ping to ${clientId}:`, err);
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
        console.log(`[Heartbeat] Started for ${clientId} (interval: ${config.pingInterval}ms)`);
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
            console.log(`[Heartbeat] Received pong from ${clientId}`);
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
            console.log(`[Heartbeat] Stopped for ${clientId}`);
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
        console.log('[Heartbeat] Stopped all heartbeats');
    }
}
