/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConnectionMonitor from './connectionMonitor.js';

/**
 * Mock wsProvider that simulates y-websocket WebsocketProvider
 */
function createMockWsProvider() {
    const listeners = {
        status: [],
        'connection-error': [],
        'connection-close': [],
    };

    return {
        on(event, callback) {
            if (listeners[event]) {
                listeners[event].push(callback);
            }
        },
        off(event, callback) {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter((cb) => cb !== callback);
            }
        },
        disconnect: vi.fn(),
        // Helper to emit events in tests
        _emit(event, data) {
            if (listeners[event]) {
                listeners[event].forEach((cb) => cb(data));
            }
        },
        _getListenerCount(event) {
            return listeners[event]?.length || 0;
        },
    };
}

/**
 * Mock toast manager
 */
function createMockToastsManager() {
    const toasts = [];

    return {
        createToast: vi.fn((data) => {
            const toast = {
                id: `toast-${toasts.length}`,
                data,
                toastBody: { innerHTML: data.body },
                remove: vi.fn(),
            };
            toasts.push(toast);
            return toast;
        }),
        _getToasts() {
            return toasts;
        },
        _clear() {
            toasts.length = 0;
        },
    };
}

/**
 * Mock session monitor
 */
function createMockSessionMonitor() {
    return {
        handleYjsConnectionError: vi.fn(),
    };
}

describe('ConnectionMonitor', () => {
    let wsProvider;
    let toastsManager;
    let sessionMonitor;
    let monitor;

    beforeEach(() => {
        wsProvider = createMockWsProvider();
        toastsManager = createMockToastsManager();
        sessionMonitor = createMockSessionMonitor();

        monitor = new ConnectionMonitor({
            wsProvider,
            toastsManager,
            sessionMonitor,
            maxReconnectAttempts: 5,
            graceFailures: 2,
        });
    });

    afterEach(() => {
        if (monitor) {
            monitor.destroy();
        }
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const m = new ConnectionMonitor({});
            expect(m.maxReconnectAttempts).toBe(5);
            expect(m.graceFailures).toBe(2);
            expect(m.consecutiveFailures).toBe(0);
            expect(m.isGivingUp).toBe(false);
            expect(m.isConnected).toBe(false);
            m.destroy();
        });

        it('should accept custom configuration', () => {
            const m = new ConnectionMonitor({
                maxReconnectAttempts: 10,
                graceFailures: 5,
            });
            expect(m.maxReconnectAttempts).toBe(10);
            expect(m.graceFailures).toBe(5);
            m.destroy();
        });
    });

    describe('start()', () => {
        it('should subscribe to wsProvider events', () => {
            monitor.start();
            expect(wsProvider._getListenerCount('status')).toBe(1);
            expect(wsProvider._getListenerCount('connection-error')).toBe(1);
            expect(wsProvider._getListenerCount('connection-close')).toBe(1);
        });

        it('should not subscribe multiple times', () => {
            monitor.start();
            monitor.start();
            expect(wsProvider._getListenerCount('status')).toBe(1);
        });

        it('should do nothing without wsProvider', () => {
            const m = new ConnectionMonitor({});
            m.start(); // Should not throw
            expect(m.started).toBe(false);
            m.destroy();
        });
    });

    describe('stop()', () => {
        it('should unsubscribe from wsProvider events', () => {
            monitor.start();
            monitor.stop();
            expect(wsProvider._getListenerCount('status')).toBe(0);
            expect(wsProvider._getListenerCount('connection-error')).toBe(0);
            expect(wsProvider._getListenerCount('connection-close')).toBe(0);
        });

        it('should dismiss all toasts', () => {
            monitor.start();
            // Trigger enough errors to show toast
            for (let i = 0; i < 4; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(monitor.connectionLostToast).not.toBeNull();

            monitor.stop();
            expect(monitor.connectionLostToast).toBeNull();
        });
    });

    describe('connection status handling', () => {
        beforeEach(() => {
            monitor.start();
        });

        it('should reset failures on successful connection', () => {
            // Simulate some failures
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});
            expect(monitor.consecutiveFailures).toBe(2);

            // Simulate successful connection
            wsProvider._emit('status', { status: 'connected' });
            expect(monitor.consecutiveFailures).toBe(0);
            expect(monitor.isConnected).toBe(true);
        });

        it('should dismiss connection lost toast on reconnection', () => {
            // Trigger enough errors to show toast
            for (let i = 0; i < 4; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(monitor.connectionLostToast).not.toBeNull();

            // Reconnect
            wsProvider._emit('status', { status: 'connected' });
            expect(monitor.connectionLostToast).toBeNull();
        });

        it('should update isConnected on disconnection', () => {
            wsProvider._emit('status', { status: 'connected' });
            expect(monitor.isConnected).toBe(true);

            wsProvider._emit('status', { status: 'disconnected' });
            expect(monitor.isConnected).toBe(false);
        });
    });

    describe('connection error handling', () => {
        beforeEach(() => {
            monitor.start();
        });

        it('should increment consecutive failures', () => {
            wsProvider._emit('connection-error', {});
            expect(monitor.consecutiveFailures).toBe(1);

            wsProvider._emit('connection-error', {});
            expect(monitor.consecutiveFailures).toBe(2);
        });

        it('should not show toast during grace period', () => {
            // 2 failures = within grace period (graceFailures = 2)
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});
            expect(toastsManager.createToast).not.toHaveBeenCalled();
        });

        it('should show toast after grace period', () => {
            // 3 failures = exceeds grace period
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});
            expect(toastsManager.createToast).toHaveBeenCalledTimes(1);
            expect(toastsManager.createToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    icon: 'warning',
                    title: 'Connection lost',
                    body: 'Attempting to reconnect...',
                    error: true,
                })
            );
        });

        it('should give up after max attempts', () => {
            for (let i = 0; i < 5; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(monitor.isGivingUp).toBe(true);
            expect(wsProvider.disconnect).toHaveBeenCalled();
        });

        it('should update toast message when giving up', () => {
            for (let i = 0; i < 5; i++) {
                wsProvider._emit('connection-error', {});
            }
            // The toast should be updated to permanent message
            expect(monitor.connectionLostToast.toastBody.innerHTML).toBe(
                'Please refresh the page to try to reconnect to the server...'
            );
        });

        it('should notify session monitor on error', () => {
            wsProvider._emit('connection-error', { type: 'error' });
            expect(sessionMonitor.handleYjsConnectionError).toHaveBeenCalledWith({ type: 'error' });
        });

        it('should not process errors after giving up', () => {
            for (let i = 0; i < 5; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(monitor.consecutiveFailures).toBe(5);

            // Additional errors should be ignored
            wsProvider._emit('connection-error', {});
            expect(monitor.consecutiveFailures).toBe(5);
        });
    });

    describe('access revocation handling', () => {
        beforeEach(() => {
            monitor.start();
        });

        it('should handle 4001 (unauthorized) close code', () => {
            wsProvider._emit('connection-close', { code: 4001 });
            expect(monitor.isGivingUp).toBe(true);
            expect(wsProvider.disconnect).toHaveBeenCalled();
            expect(toastsManager.createToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    icon: 'error',
                    title: 'Access denied',
                    body: 'Your access to this project has been revoked.',
                    error: true,
                })
            );
        });

        it('should handle 4003 (access denied) close code with redirect', () => {
            // 4003 = access denied/revoked (visibility changed or collaborator removed)
            // Should disconnect and redirect to /access-denied page
            vi.useFakeTimers();

            wsProvider._emit('connection-close', { code: 4003 });

            expect(monitor.isGivingUp).toBe(true);
            // Should NOT create a toast for 4003 (we redirect instead)
            expect(monitor.accessDeniedToast).toBeNull();
            // Should disconnect to stop reconnection attempts
            expect(wsProvider.disconnect).toHaveBeenCalled();
            // Should set shouldConnect to false
            expect(wsProvider.shouldConnect).toBe(false);
            // Should redirect after delay
            vi.advanceTimersByTime(150);
            expect(global.window.location.href).toBe('/access-denied');

            vi.useRealTimers();
        });

        it('should handle 4003 with basePath configured', () => {
            // Setup basePath
            global.window.eXeLearning = { config: { basePath: '/web/exelearning' } };
            vi.useFakeTimers();

            wsProvider._emit('connection-close', { code: 4003 });

            vi.advanceTimersByTime(150);
            expect(global.window.location.href).toBe('/web/exelearning/access-denied');

            vi.useRealTimers();
            delete global.window.eXeLearning;
        });

        it('should not show access denied toast for normal close', () => {
            wsProvider._emit('connection-close', { code: 1006 });
            expect(monitor.accessDeniedToast).toBeNull();
            expect(monitor.isGivingUp).toBe(false);
        });

        it('should not show duplicate access denied toast', () => {
            // 4001 shows toast, 4003 does not (redirect handled elsewhere)
            wsProvider._emit('connection-close', { code: 4001 });
            wsProvider._emit('connection-close', { code: 4001 });
            expect(toastsManager.createToast).toHaveBeenCalledTimes(1);
        });

        it('should handle 4001 then 4003 correctly', () => {
            vi.useFakeTimers();

            // 4001 shows toast
            wsProvider._emit('connection-close', { code: 4001 });
            expect(monitor.accessDeniedToast).not.toBeNull();
            toastsManager.createToast.mockClear();
            wsProvider.disconnect.mockClear();

            // 4003 does not show additional toast but still redirects
            wsProvider._emit('connection-close', { code: 4003 });
            expect(toastsManager.createToast).not.toHaveBeenCalled();
            // 4003 still disconnects (idempotent operation)
            expect(wsProvider.disconnect).toHaveBeenCalled();

            vi.useRealTimers();
        });
    });

    describe('getState()', () => {
        it('should return current state', () => {
            monitor.start();
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});
            wsProvider._emit('connection-error', {});

            const state = monitor.getState();
            expect(state).toEqual({
                consecutiveFailures: 3,
                isGivingUp: false,
                isConnected: false,
                hasConnectionLostToast: true,
                hasAccessDeniedToast: false,
            });
        });
    });

    describe('destroy()', () => {
        it('should cleanup all resources', () => {
            monitor.start();
            monitor.destroy();

            expect(monitor.wsProvider).toBeNull();
            expect(monitor.toastsManager).toBeNull();
            expect(monitor.sessionMonitor).toBeNull();
            expect(monitor.started).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle missing toastsManager gracefully', () => {
            const m = new ConnectionMonitor({
                wsProvider,
                toastsManager: null,
            });
            m.start();

            // Should not throw
            for (let i = 0; i < 5; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(m.connectionLostToast).toBeNull();
            m.destroy();
        });

        it('should handle missing sessionMonitor gracefully', () => {
            const m = new ConnectionMonitor({
                wsProvider,
                toastsManager,
                sessionMonitor: null,
            });
            m.start();

            // Should not throw
            wsProvider._emit('connection-error', {});
            expect(m.consecutiveFailures).toBe(1);
            m.destroy();
        });

        it('should handle wsProvider.disconnect() errors', () => {
            wsProvider.disconnect = vi.fn(() => {
                throw new Error('Disconnect failed');
            });
            monitor.start();

            // Should not throw
            for (let i = 0; i < 5; i++) {
                wsProvider._emit('connection-error', {});
            }
            expect(monitor.isGivingUp).toBe(true);
        });
    });
});
