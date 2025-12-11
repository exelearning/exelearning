/**
 * AppLogger - Centralized logging utility for eXeLearning frontend
 *
 * Logging behavior is controlled by APP_DEBUG environment variable:
 * - APP_DEBUG=1: All logs (log, debug, info, warn, error) are shown
 * - APP_DEBUG=0: Only warn and error are shown (production mode)
 *
 * Usage:
 *   import AppLogger from './common/logger.js';
 *   AppLogger.log('Debug message');      // Only shown if APP_DEBUG=1
 *   AppLogger.debug('Debug info');       // Only shown if APP_DEBUG=1
 *   AppLogger.info('Info message');      // Only shown if APP_DEBUG=1
 *   AppLogger.warn('Warning message');   // Always shown
 *   AppLogger.error('Error message');    // Always shown
 */

const AppLogger = {
    /**
     * Check if debug mode is enabled
     * Reads from window.__APP_DEBUG__ set by the server
     */
    get isDebug() {
        return window.__APP_DEBUG__ === '1' || window.__APP_DEBUG__ === true;
    },

    /**
     * Log message (only in debug mode)
     */
    log(...args) {
        if (this.isDebug) {
            console.log('[App]', ...args);
        }
    },

    /**
     * Debug message (only in debug mode)
     */
    debug(...args) {
        if (this.isDebug) {
            console.debug('[App]', ...args);
        }
    },

    /**
     * Info message (only in debug mode)
     */
    info(...args) {
        if (this.isDebug) {
            console.info('[App]', ...args);
        }
    },

    /**
     * Warning message (always shown)
     */
    warn(...args) {
        console.warn('[App]', ...args);
    },

    /**
     * Error message (always shown)
     */
    error(...args) {
        console.error('[App]', ...args);
    },

    /**
     * Group logs (only in debug mode)
     */
    group(label) {
        if (this.isDebug) {
            console.group(label);
        }
    },

    /**
     * End group (only in debug mode)
     */
    groupEnd() {
        if (this.isDebug) {
            console.groupEnd();
        }
    },

    /**
     * Table output (only in debug mode)
     */
    table(data) {
        if (this.isDebug) {
            console.table(data);
        }
    },

    /**
     * Time measurement start (only in debug mode)
     */
    time(label) {
        if (this.isDebug) {
            console.time(label);
        }
    },

    /**
     * Time measurement end (only in debug mode)
     */
    timeEnd(label) {
        if (this.isDebug) {
            console.timeEnd(label);
        }
    },
};

// Make AppLogger available globally for non-module scripts (Yjs, etc.)
window.AppLogger = AppLogger;

export default AppLogger;
