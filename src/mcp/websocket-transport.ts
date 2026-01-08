/**
 * WebSocket Transport for MCP Server
 *
 * Implements the MCP Transport interface for WebSocket connections.
 * This allows MCP clients (like LM Studio) to connect via WebSocket.
 */
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ServerWebSocket } from 'bun';

/**
 * WebSocket data attached to each connection
 */
export interface McpWebSocketData {
    sessionId: string;
    transport: WebSocketServerTransport;
}

/**
 * WebSocket Server Transport for MCP
 *
 * Wraps a Bun ServerWebSocket to implement the MCP Transport interface.
 */
export class WebSocketServerTransport implements Transport {
    private _sessionId: string;
    private _ws: ServerWebSocket<McpWebSocketData> | null = null;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: <T extends JSONRPCMessage>(message: T) => void;

    constructor(sessionId?: string) {
        this._sessionId = sessionId ?? crypto.randomUUID();
    }

    get sessionId(): string {
        return this._sessionId;
    }

    /**
     * Attach a WebSocket connection to this transport.
     */
    attachWebSocket(ws: ServerWebSocket<McpWebSocketData>): void {
        this._ws = ws;
    }

    /**
     * Start the transport. For WebSocket, this is a no-op since
     * the connection is already established when attachWebSocket is called.
     */
    async start(): Promise<void> {
        // No-op: WebSocket connection is established via attachWebSocket
    }

    /**
     * Send a JSON-RPC message over the WebSocket.
     */
    async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
        if (!this._ws) {
            throw new Error('WebSocket not attached');
        }

        try {
            const data = JSON.stringify(message);
            this._ws.send(data);
        } catch (error) {
            this.onerror?.(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Close the WebSocket connection.
     */
    async close(): Promise<void> {
        if (this._ws) {
            try {
                this._ws.close(1000, 'Transport closed');
            } catch {
                // Ignore errors during close
            }
            this._ws = null;
        }
        this.onclose?.();
    }

    /**
     * Handle incoming WebSocket message.
     * Called by the WebSocket handler when a message is received.
     */
    handleMessage(data: string | Buffer): void {
        try {
            const text = typeof data === 'string' ? data : data.toString('utf-8');
            const message = JSON.parse(text) as JSONRPCMessage;
            this.onmessage?.(message);
        } catch (error) {
            this.onerror?.(error instanceof Error ? error : new Error(`Failed to parse message: ${error}`));
        }
    }

    /**
     * Handle WebSocket close event.
     */
    handleClose(): void {
        this._ws = null;
        this.onclose?.();
    }

    /**
     * Handle WebSocket error event.
     */
    handleError(error: Error): void {
        this.onerror?.(error);
    }
}
