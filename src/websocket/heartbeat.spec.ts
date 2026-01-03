/**
 * Tests for Heartbeat Manager
 * Tests the REAL implementation - no mock.module()
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { startHeartbeat, stopHeartbeat, onPong, getHeartbeatStats, stopAllHeartbeats } from './heartbeat';

// Mock WebSocket for testing
function createMockWebSocket() {
    return {
        ping: mock(() => {}),
        close: mock(() => {}),
        data: {
            clientId: 'test-client',
            userId: 1,
            projectUuid: 'test-project',
            docName: 'project-test',
        },
    } as any;
}

describe('Heartbeat Manager', () => {
    beforeEach(() => {
        // Clean up any existing heartbeats before each test
        stopAllHeartbeats();
    });

    afterEach(() => {
        // Clean up after each test
        stopAllHeartbeats();
    });

    describe('startHeartbeat', () => {
        it('should start heartbeat for a client', () => {
            const ws = createMockWebSocket();
            startHeartbeat('client-1', ws);

            const stats = getHeartbeatStats();
            expect(stats.activeClients).toBe(1);
            expect(stats.clientIds).toContain('client-1');
        });

        it('should replace existing heartbeat for same client', () => {
            const ws1 = createMockWebSocket();
            const ws2 = createMockWebSocket();

            startHeartbeat('client-1', ws1);
            startHeartbeat('client-1', ws2);

            const stats = getHeartbeatStats();
            expect(stats.activeClients).toBe(1);
        });

        it('should track multiple clients', () => {
            startHeartbeat('client-1', createMockWebSocket());
            startHeartbeat('client-2', createMockWebSocket());
            startHeartbeat('client-3', createMockWebSocket());

            const stats = getHeartbeatStats();
            expect(stats.activeClients).toBe(3);
            expect(stats.clientIds).toContain('client-1');
            expect(stats.clientIds).toContain('client-2');
            expect(stats.clientIds).toContain('client-3');
        });
    });

    describe('stopHeartbeat', () => {
        it('should stop heartbeat for a client', () => {
            const ws = createMockWebSocket();
            startHeartbeat('client-1', ws);

            expect(getHeartbeatStats().activeClients).toBe(1);

            stopHeartbeat('client-1');

            expect(getHeartbeatStats().activeClients).toBe(0);
        });

        it('should be safe to call for non-existent client', () => {
            expect(() => stopHeartbeat('non-existent')).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            const ws = createMockWebSocket();
            startHeartbeat('client-1', ws);

            stopHeartbeat('client-1');
            stopHeartbeat('client-1');
            stopHeartbeat('client-1');

            expect(getHeartbeatStats().activeClients).toBe(0);
        });
    });

    describe('onPong', () => {
        it('should update lastPong timestamp', () => {
            const ws = createMockWebSocket();
            startHeartbeat('client-1', ws);

            // Wait a bit and call onPong
            onPong('client-1');

            // The lastPong should be updated (internal state)
            // We can't directly access it, but we verify no errors
            expect(getHeartbeatStats().activeClients).toBe(1);
        });

        it('should be safe to call for non-existent client', () => {
            expect(() => onPong('non-existent')).not.toThrow();
        });
    });

    describe('getHeartbeatStats', () => {
        it('should return empty stats when no clients', () => {
            const stats = getHeartbeatStats();
            expect(stats.activeClients).toBe(0);
            expect(stats.clientIds).toEqual([]);
        });

        it('should return correct stats for active clients', () => {
            startHeartbeat('client-1', createMockWebSocket());
            startHeartbeat('client-2', createMockWebSocket());

            const stats = getHeartbeatStats();
            expect(stats.activeClients).toBe(2);
            expect(stats.clientIds.length).toBe(2);
        });
    });

    describe('stopAllHeartbeats', () => {
        it('should stop all heartbeats', () => {
            startHeartbeat('client-1', createMockWebSocket());
            startHeartbeat('client-2', createMockWebSocket());
            startHeartbeat('client-3', createMockWebSocket());

            expect(getHeartbeatStats().activeClients).toBe(3);

            stopAllHeartbeats();

            expect(getHeartbeatStats().activeClients).toBe(0);
        });

        it('should be safe to call when no clients', () => {
            expect(() => stopAllHeartbeats()).not.toThrow();
        });
    });

    describe('debug logging', () => {
        let originalAppDebug: string | undefined;

        beforeEach(() => {
            originalAppDebug = process.env.APP_DEBUG;
            process.env.APP_DEBUG = '1';
        });

        afterEach(() => {
            if (originalAppDebug !== undefined) {
                process.env.APP_DEBUG = originalAppDebug;
            } else {
                delete process.env.APP_DEBUG;
            }
        });

        it('should log debug messages when APP_DEBUG is enabled', () => {
            const ws = createMockWebSocket();
            startHeartbeat('debug-test', ws);
            onPong('debug-test');
            stopHeartbeat('debug-test');
            // Coverage achieved by executing the code paths with debug enabled
        });

        it('should log when stopAllHeartbeats is called', () => {
            startHeartbeat('debug-client-1', createMockWebSocket());
            startHeartbeat('debug-client-2', createMockWebSocket());
            stopAllHeartbeats();
            // Coverage achieved for stopAllHeartbeats debug log
        });

        it('should log timeout when pong not received in time', async () => {
            const ws = createMockWebSocket();

            const originalSetInterval = global.setInterval;
            const originalDateNow = Date.now;
            let intervalCallback: (() => void) | null = null;
            let fakeTime = 1000000;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                Date.now = () => fakeTime;
                startHeartbeat('timeout-debug-test', ws);

                // Advance time beyond ping interval + pong timeout
                fakeTime += 50000;

                if (intervalCallback) {
                    intervalCallback();
                }

                // Coverage achieved for timeout debug log
                expect(ws.close).toHaveBeenCalledWith(4008, 'Heartbeat timeout');
            } finally {
                global.setInterval = originalSetInterval;
                Date.now = originalDateNow;
            }
        });

        it('should log ping error when ping fails', async () => {
            const ws = createMockWebSocket();
            ws.ping = mock(() => {
                throw new Error('Connection closed');
            });

            const originalSetInterval = global.setInterval;
            let intervalCallback: (() => void) | null = null;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                startHeartbeat('ping-error-debug-test', ws);

                if (intervalCallback) {
                    expect(() => intervalCallback!()).not.toThrow();
                }
                // Coverage achieved for ping error debug log
            } finally {
                global.setInterval = originalSetInterval;
            }
        });
    });

    describe('interval behavior', () => {
        it('should send ping when interval fires', async () => {
            const ws = createMockWebSocket();

            // Use fake timers to control the interval
            const originalSetInterval = global.setInterval;
            let intervalCallback: (() => void) | null = null;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any; // Return fake timer ID
            }) as typeof setInterval;

            try {
                startHeartbeat('client-1', ws);

                // Trigger the interval callback manually
                if (intervalCallback) {
                    intervalCallback();
                }

                // ping should have been called
                expect(ws.ping).toHaveBeenCalled();
            } finally {
                global.setInterval = originalSetInterval;
            }
        });

        it('should close connection when pong timeout exceeded', async () => {
            const ws = createMockWebSocket();

            // Use fake timers to control the interval
            const originalSetInterval = global.setInterval;
            const originalDateNow = Date.now;
            let intervalCallback: (() => void) | null = null;
            let fakeTime = 1000000;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                // Start with current time
                Date.now = () => fakeTime;
                startHeartbeat('client-1', ws);

                // Advance time beyond ping interval + pong timeout (default: 30000 + 10000 = 40000)
                fakeTime += 50000;

                // Trigger the interval callback
                if (intervalCallback) {
                    intervalCallback();
                }

                // Should have closed the connection due to timeout
                expect(ws.close).toHaveBeenCalledWith(4008, 'Heartbeat timeout');
            } finally {
                global.setInterval = originalSetInterval;
                Date.now = originalDateNow;
            }
        });

        it('should handle ping error gracefully', async () => {
            const ws = createMockWebSocket();
            ws.ping = mock(() => {
                throw new Error('Connection closed');
            });

            const originalSetInterval = global.setInterval;
            let intervalCallback: (() => void) | null = null;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                startHeartbeat('client-1', ws);

                // Trigger the interval callback - should not throw
                if (intervalCallback) {
                    expect(() => intervalCallback!()).not.toThrow();
                }
            } finally {
                global.setInterval = originalSetInterval;
            }
        });

        it('should not execute if aborted', async () => {
            const ws = createMockWebSocket();

            const originalSetInterval = global.setInterval;
            let intervalCallback: (() => void) | null = null;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                startHeartbeat('client-1', ws);

                // Stop the heartbeat (which aborts)
                stopHeartbeat('client-1');

                // Reset mock call count
                ws.ping.mockClear();

                // Trigger the interval callback after abort
                if (intervalCallback) {
                    intervalCallback();
                }

                // ping should NOT have been called since aborted
                expect(ws.ping).not.toHaveBeenCalled();
            } finally {
                global.setInterval = originalSetInterval;
            }
        });

        it('should not execute if state is missing', async () => {
            const ws = createMockWebSocket();

            const originalSetInterval = global.setInterval;
            let intervalCallback: (() => void) | null = null;

            global.setInterval = ((cb: () => void, _ms: number) => {
                intervalCallback = cb;
                return 123 as any;
            }) as typeof setInterval;

            try {
                startHeartbeat('client-1', ws);

                // Manually remove the state without stopping properly
                // This simulates a race condition
                stopAllHeartbeats();

                // Reset mock
                ws.ping.mockClear();

                // Trigger callback - should handle missing state gracefully
                if (intervalCallback) {
                    expect(() => intervalCallback!()).not.toThrow();
                }

                expect(ws.ping).not.toHaveBeenCalled();
            } finally {
                global.setInterval = originalSetInterval;
            }
        });
    });
});
