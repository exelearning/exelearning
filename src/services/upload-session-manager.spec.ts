/**
 * Upload Session Manager Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SignJWT } from 'jose';
import {
    createUploadSessionManager,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    CLEANUP_INTERVAL_MS,
    startCleanupScheduler,
    stopCleanupScheduler,
} from './upload-session-manager';

// Helper to get JWT secret as Uint8Array (for test token generation)
const getJwtSecretEncoded = (): Uint8Array => {
    const secret = process.env.API_JWT_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
    return new TextEncoder().encode(secret);
};

describe('UploadSessionManager', () => {
    let manager: ReturnType<typeof createUploadSessionManager>;

    beforeEach(() => {
        // Create fresh manager for each test
        manager = createUploadSessionManager();
    });

    describe('createSession', () => {
        it('should create a session with a valid token', async () => {
            const result = await manager.createSession({
                projectId: 'project-uuid-123',
                projectIdNum: 1,
                userId: 42,
                clientId: 'client-abc',
                totalFiles: 10,
                totalBytes: 1024 * 1024,
            });

            expect(result.sessionToken).toBeDefined();
            expect(typeof result.sessionToken).toBe('string');
            expect(result.sessionToken.length).toBeGreaterThan(50);
            expect(result.expiresAt).toBeGreaterThan(Date.now());
        });

        it('should create sessions with unique tokens', async () => {
            const result1 = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 500,
            });

            const result2 = await manager.createSession({
                projectId: 'project-2',
                projectIdNum: 2,
                userId: 2,
                clientId: 'client-2',
                totalFiles: 5,
                totalBytes: 500,
            });

            expect(result1.sessionToken).not.toBe(result2.sessionToken);
        });

        it('should set expiration 30 minutes in the future', async () => {
            const result = await manager.createSession({
                projectId: 'test-project',
                projectIdNum: 1,
                userId: 1,
                clientId: 'test-client',
                totalFiles: 1,
                totalBytes: 100,
            });

            const now = Date.now();
            const expectedExpiry = now + 30 * 60 * 1000;

            // Allow 10 second tolerance
            expect(result.expiresAt).toBeGreaterThan(expectedExpiry - 10000);
            expect(result.expiresAt).toBeLessThan(expectedExpiry + 10000);
        });
    });

    describe('validateSession', () => {
        it('should validate a valid session token', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-uuid',
                projectIdNum: 42,
                userId: 123,
                clientId: 'client-id',
                totalFiles: 5,
                totalBytes: 1000,
            });

            const payload = await manager.validateSession(sessionToken);

            expect(payload).not.toBeNull();
            expect(payload!.projectId).toBe('project-uuid');
            expect(payload!.projectIdNum).toBe(42);
            expect(payload!.userId).toBe(123);
            expect(payload!.clientId).toBe('client-id');
            expect(payload!.totalFiles).toBe(5);
            expect(payload!.totalBytes).toBe(1000);
        });

        it('should return null for invalid token', async () => {
            const payload = await manager.validateSession('invalid-token');
            expect(payload).toBeNull();
        });

        it('should return null for malformed JWT', async () => {
            const payload = await manager.validateSession('aaa.bbb.ccc');
            expect(payload).toBeNull();
        });
    });

    describe('getSession', () => {
        it('should return active session by ID', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 10,
                totalBytes: 5000,
            });

            const payload = await manager.validateSession(sessionToken);
            const session = manager.getSession(payload!.sessionId);

            expect(session).not.toBeNull();
            expect(session!.projectId).toBe('project-1');
            expect(session!.totalFiles).toBe(10);
            expect(session!.uploadedFiles).toBe(0);
        });

        it('should return null for non-existent session', () => {
            const session = manager.getSession('non-existent-id');
            expect(session).toBeNull();
        });
    });

    describe('updateProgress', () => {
        it('should update session progress', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 10,
                totalBytes: 5000,
            });

            const payload = await manager.validateSession(sessionToken);
            manager.updateProgress(payload!.sessionId, 5, 2500);

            const session = manager.getSession(payload!.sessionId);
            expect(session!.uploadedFiles).toBe(5);
            expect(session!.uploadedBytes).toBe(2500);
        });
    });

    describe('onProgress and emitProgress', () => {
        it('should call registered callback on progress', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 10,
                totalBytes: 5000,
            });

            const payload = await manager.validateSession(sessionToken);
            let callbackCalled = false;
            let callbackData: unknown = null;

            manager.onProgress(payload!.sessionId, progress => {
                callbackCalled = true;
                callbackData = progress;
            });

            manager.emitProgress(payload!.sessionId, {
                clientId: 'asset-1',
                bytesWritten: 500,
                totalBytes: 1000,
                status: 'writing',
            });

            expect(callbackCalled).toBe(true);
            expect(callbackData).toEqual({
                clientId: 'asset-1',
                bytesWritten: 500,
                totalBytes: 1000,
                status: 'writing',
            });
        });
    });

    describe('onBatchComplete and emitBatchComplete', () => {
        it('should call registered callback on batch complete', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 10,
                totalBytes: 5000,
            });

            const payload = await manager.validateSession(sessionToken);
            let callbackCalled = false;
            let callbackData: unknown = null;

            manager.onBatchComplete(payload!.sessionId, result => {
                callbackCalled = true;
                callbackData = result;
            });

            manager.emitBatchComplete(payload!.sessionId, {
                uploaded: 8,
                failed: 2,
                results: [
                    { clientId: 'asset-1', success: true, serverId: 100 },
                    { clientId: 'asset-2', success: false, error: 'Test error' },
                ],
            });

            expect(callbackCalled).toBe(true);
            expect(callbackData).toEqual({
                uploaded: 8,
                failed: 2,
                results: [
                    { clientId: 'asset-1', success: true, serverId: 100 },
                    { clientId: 'asset-2', success: false, error: 'Test error' },
                ],
            });
        });
    });

    describe('deleteSession', () => {
        it('should delete session and its callbacks', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 10,
                totalBytes: 5000,
            });

            const payload = await manager.validateSession(sessionToken);
            let callbackCalled = false;

            manager.onProgress(payload!.sessionId, () => {
                callbackCalled = true;
            });

            // Delete session
            manager.deleteSession(payload!.sessionId);

            // Session should be gone
            const session = manager.getSession(payload!.sessionId);
            expect(session).toBeNull();

            // Callback should NOT be called after deletion
            manager.emitProgress(payload!.sessionId, {
                clientId: 'test',
                bytesWritten: 0,
                totalBytes: 0,
                status: 'complete',
            });
            expect(callbackCalled).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return correct stats', async () => {
            // Create some sessions
            await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 1000,
            });

            await manager.createSession({
                projectId: 'project-2',
                projectIdNum: 2,
                userId: 2,
                clientId: 'client-2',
                totalFiles: 10,
                totalBytes: 2000,
            });

            const stats = manager.getStats();

            expect(stats.activeSessions).toBe(2);
            expect(stats.oldestSession).toBeDefined();
            expect(stats.oldestSession).toBeLessThanOrEqual(Date.now());
        });

        it('should return null for oldestSession when no sessions exist', () => {
            const stats = manager.getStats();
            expect(stats.activeSessions).toBe(0);
            expect(stats.oldestSession).toBeNull();
        });
    });

    describe('cleanupExpired', () => {
        it('should clean up expired sessions', async () => {
            // Create a session
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 1000,
            });

            // Manually expire the session (hack for testing)
            const payload = await manager.validateSession(sessionToken);
            const session = manager.getSession(payload!.sessionId);
            if (session) {
                // @ts-expect-error - accessing private property for testing
                session.expiresAt = Date.now() - 1000;
            }

            // Cleanup should remove expired session
            const cleaned = manager.cleanupExpired();
            expect(cleaned).toBe(1);

            // Session should be gone
            expect(manager.getSession(payload!.sessionId)).toBeNull();
        });

        it('should not clean up non-expired sessions', async () => {
            await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 1000,
            });

            const cleaned = manager.cleanupExpired();
            expect(cleaned).toBe(0);
            expect(manager.getStats().activeSessions).toBe(1);
        });

        it('should free registered callbacks for expired sessions while keeping fresh ones', async () => {
            // Expired session with a registered progress callback.
            const { sessionToken: expiredToken } = await manager.createSession({
                projectId: 'expired-project',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-expired',
                totalFiles: 5,
                totalBytes: 1000,
            });
            const expiredPayload = await manager.validateSession(expiredToken);
            let expiredCallbackCalled = false;
            manager.onProgress(expiredPayload!.sessionId, () => {
                expiredCallbackCalled = true;
            });

            // Fresh session that must survive cleanup with its callback intact.
            const { sessionToken: freshToken } = await manager.createSession({
                projectId: 'fresh-project',
                projectIdNum: 2,
                userId: 2,
                clientId: 'client-fresh',
                totalFiles: 5,
                totalBytes: 1000,
            });
            const freshPayload = await manager.validateSession(freshToken);
            let freshCallbackCalled = false;
            manager.onProgress(freshPayload!.sessionId, () => {
                freshCallbackCalled = true;
            });

            // Force the first session to be expired.
            const expiredSession = manager.getSession(expiredPayload!.sessionId);
            if (expiredSession) {
                // @ts-expect-error - accessing private property for testing
                expiredSession.expiresAt = Date.now() - 1000;
            }

            const cleaned = manager.cleanupExpired();
            expect(cleaned).toBe(1);

            // Expired session and its callback are gone: emitting must not fire it.
            manager.emitProgress(expiredPayload!.sessionId, {
                clientId: 'x',
                bytesWritten: 0,
                totalBytes: 0,
                status: 'complete',
            });
            expect(expiredCallbackCalled).toBe(false);

            // Fresh session and its callback are preserved.
            expect(manager.getSession(freshPayload!.sessionId)).not.toBeNull();
            manager.emitProgress(freshPayload!.sessionId, {
                clientId: 'y',
                bytesWritten: 100,
                totalBytes: 1000,
                status: 'writing',
            });
            expect(freshCallbackCalled).toBe(true);
        });
    });

    describe('cleanup scheduler', () => {
        afterEach(() => {
            // Always stop the singleton scheduler so tests do not leak timers.
            stopCleanupScheduler();
        });

        it('should expose a sane default interval (5 minutes)', () => {
            expect(CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
        });

        it('should register one timer on start and clear it on stop', () => {
            const realSetInterval = globalThis.setInterval;
            const realClearInterval = globalThis.clearInterval;
            let registered = 0;
            let cleared = 0;

            // @ts-expect-error - test override of global setInterval
            globalThis.setInterval = (fn: () => void, ms?: number) => {
                registered++;
                return realSetInterval(fn, ms);
            };
            // @ts-expect-error - test override of global clearInterval
            globalThis.clearInterval = (handle: ReturnType<typeof setInterval>) => {
                cleared++;
                return realClearInterval(handle);
            };

            try {
                startCleanupScheduler(60000);
                expect(registered).toBe(1);

                stopCleanupScheduler();
                expect(cleared).toBe(1);

                // Calling stop again is a safe no-op (no extra clearInterval).
                stopCleanupScheduler();
                expect(cleared).toBe(1);
            } finally {
                globalThis.setInterval = realSetInterval;
                globalThis.clearInterval = realClearInterval;
            }
        });

        it('should replace an existing timer when started again (no leak)', () => {
            const realSetInterval = globalThis.setInterval;
            const realClearInterval = globalThis.clearInterval;
            let registered = 0;
            let cleared = 0;

            // @ts-expect-error - test override of global setInterval
            globalThis.setInterval = (fn: () => void, ms?: number) => {
                registered++;
                return realSetInterval(fn, ms);
            };
            // @ts-expect-error - test override of global clearInterval
            globalThis.clearInterval = (handle: ReturnType<typeof setInterval>) => {
                cleared++;
                return realClearInterval(handle);
            };

            try {
                startCleanupScheduler(60000);
                startCleanupScheduler(60000);
                // Second start must clear the first timer before registering the new one.
                expect(registered).toBe(2);
                expect(cleared).toBe(1);

                stopCleanupScheduler();
                expect(cleared).toBe(2);
            } finally {
                globalThis.setInterval = realSetInterval;
                globalThis.clearInterval = realClearInterval;
            }
        });

        it('should invoke cleanupExpired and cleanupStaleSlots on each scheduled pass', () => {
            const realSetInterval = globalThis.setInterval;
            const realClearInterval = globalThis.clearInterval;
            let capturedCallback: (() => void) | null = null;

            // Capture the scheduled callback without arming a real timer.
            // @ts-expect-error - test override of global setInterval
            globalThis.setInterval = (fn: () => void) => {
                capturedCallback = fn;
                return 0 as unknown as ReturnType<typeof setInterval>;
            };
            // @ts-expect-error - test override of global clearInterval
            globalThis.clearInterval = () => {};

            try {
                startCleanupScheduler(60000);
                expect(capturedCallback).not.toBeNull();

                // Invoking the captured pass must not throw and must reclaim
                // expired singleton sessions via cleanupExpired().
                expect(() => capturedCallback!()).not.toThrow();
            } finally {
                globalThis.setInterval = realSetInterval;
                globalThis.clearInterval = realClearInterval;
                stopCleanupScheduler();
            }
        });
    });

    describe('emitProgress without callback', () => {
        it('should not throw when emitting progress without callback', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 1000,
            });

            const payload = await manager.validateSession(sessionToken);

            // Should not throw even without callback
            expect(() => {
                manager.emitProgress(payload!.sessionId, {
                    clientId: 'test',
                    bytesWritten: 100,
                    totalBytes: 1000,
                    status: 'writing',
                });
            }).not.toThrow();
        });
    });

    describe('emitBatchComplete without callback', () => {
        it('should not throw when emitting batch complete without callback', async () => {
            const { sessionToken } = await manager.createSession({
                projectId: 'project-1',
                projectIdNum: 1,
                userId: 1,
                clientId: 'client-1',
                totalFiles: 5,
                totalBytes: 1000,
            });

            const payload = await manager.validateSession(sessionToken);

            // Should not throw even without callback
            expect(() => {
                manager.emitBatchComplete(payload!.sessionId, {
                    uploaded: 5,
                    failed: 0,
                    results: [],
                });
            }).not.toThrow();
        });
    });

    describe('updateProgress for non-existent session', () => {
        it('should not throw when updating non-existent session', () => {
            expect(() => {
                manager.updateProgress('non-existent-id', 5, 1000);
            }).not.toThrow();
        });
    });

    describe('validateSession with missing fields', () => {
        it('should return null for token missing sessionId', async () => {
            // Create a token manually without sessionId using jose
            const token = await new SignJWT({ projectId: 'test', userId: 1 }) // missing sessionId
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30m')
                .sign(getJwtSecretEncoded());

            expect(await manager.validateSession(token)).toBeNull();
        });

        it('should return null for token missing projectId', async () => {
            const token = await new SignJWT({ sessionId: 'test', userId: 1 }) // missing projectId
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30m')
                .sign(getJwtSecretEncoded());

            expect(await manager.validateSession(token)).toBeNull();
        });

        it('should return null for token missing userId', async () => {
            const token = await new SignJWT({ sessionId: 'test', projectId: 'test' }) // missing userId
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30m')
                .sign(getJwtSecretEncoded());

            expect(await manager.validateSession(token)).toBeNull();
        });
    });

    describe('constants', () => {
        it('should export MAX_BATCH_BYTES (100MB)', () => {
            expect(MAX_BATCH_BYTES).toBe(100 * 1024 * 1024);
        });

        it('should export MAX_BATCH_FILES (200)', () => {
            expect(MAX_BATCH_FILES).toBe(200);
        });
    });
});
