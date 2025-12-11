/**
 * WebSocket Configuration for Yjs
 * Different settings for desktop (Electron) vs server deployments
 */

export interface WsConfig {
    /** Heartbeat ping interval in milliseconds */
    pingInterval: number;
    /** Pong timeout - how long to wait for pong response */
    pongTimeout: number;
    /** Room cleanup delay after last client disconnects */
    cleanupDelay: number;
    /** Number of incremental updates before compacting to snapshot */
    compactThresholdUpdates: number;
    /** Total bytes of updates before compacting to snapshot */
    compactThresholdBytes: number;
}

/**
 * Desktop configuration (Electron)
 * - Local connections only, no proxy concerns
 * - Faster cleanup since single user
 * - Higher thresholds since local disk I/O is fast
 */
const DESKTOP_CONFIG: WsConfig = {
    pingInterval: 60_000, // 60s - no proxy timeout concerns
    pongTimeout: 10_000, // 10s
    cleanupDelay: 5_000, // 5s - fast cleanup for desktop
    compactThresholdUpdates: 100, // More updates before compacting
    compactThresholdBytes: 1024 * 1024, // 1MB of updates
};

/**
 * Server configuration
 * - Multiple users, proxies involved
 * - Longer cleanup to allow reconnections
 * - Lower thresholds to free memory sooner
 */
const SERVER_CONFIG: WsConfig = {
    pingInterval: 30_000, // 30s - below typical proxy timeout (60s)
    pongTimeout: 10_000, // 10s
    cleanupDelay: 30_000, // 30s - allow reconnections
    compactThresholdUpdates: 50, // Compact more often
    compactThresholdBytes: 512 * 1024, // 512KB of updates
};

/**
 * Detect if running in desktop mode
 */
function isDesktopMode(): boolean {
    return process.env.ELECTRON === '1' || process.env.DESKTOP_MODE === '1' || process.env.TAURI === '1';
}

/**
 * Get configuration based on runtime environment
 */
export function getConfig(): WsConfig {
    return isDesktopMode() ? DESKTOP_CONFIG : SERVER_CONFIG;
}

/**
 * Get specific config value with optional override
 */
export function getConfigValue<K extends keyof WsConfig>(key: K, override?: WsConfig[K]): WsConfig[K] {
    if (override !== undefined) return override;
    return getConfig()[key];
}

/**
 * Debug flag (constant - evaluated at module load time)
 * Use isDebugEnabled() for testable debug checks
 */
export const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Debug flag function (evaluated at call time - testable)
 * Use this instead of DEBUG constant when you need testable debug branches
 */
export function isDebugEnabled(): boolean {
    return process.env.APP_DEBUG === '1';
}
