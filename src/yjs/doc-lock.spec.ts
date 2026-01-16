/**
 * Y.Doc Lock (Mutex) Tests
 *
 * Tests for the per-project mutex implementation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    configure,
    resetConfig,
    getConfig,
    acquireLock,
    tryAcquireLock,
    isLocked,
    getLockDuration,
    withLock,
    getStats,
    releaseAll,
    LockTimeoutError,
} from './doc-lock';

describe('doc-lock', () => {
    beforeEach(() => {
        resetConfig();
        releaseAll();
    });

    afterEach(() => {
        releaseAll();
    });

    describe('configure', () => {
        it('should use default configuration', () => {
            const config = getConfig();
            expect(config.timeoutMs).toBe(5000); // 5 seconds
        });

        it('should allow custom configuration', () => {
            configure({
                timeoutMs: 10000,
            });

            const config = getConfig();
            expect(config.timeoutMs).toBe(10000);
        });

        it('should reset to defaults', () => {
            configure({ timeoutMs: 10000 });
            resetConfig();

            const config = getConfig();
            expect(config.timeoutMs).toBe(5000);
        });
    });

    describe('acquireLock', () => {
        it('should acquire lock for unlocked project', async () => {
            expect(isLocked('uuid-1')).toBe(false);

            const release = await acquireLock('uuid-1');

            expect(isLocked('uuid-1')).toBe(true);
            expect(typeof release).toBe('function');

            release();
            expect(isLocked('uuid-1')).toBe(false);
        });

        it('should wait for lock when already locked', async () => {
            const release1 = await acquireLock('uuid-1');

            // Start acquiring second lock (will wait)
            let lock2Acquired = false;
            const lock2Promise = acquireLock('uuid-1').then(release => {
                lock2Acquired = true;
                return release;
            });

            // Give some time for the second lock attempt to queue
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(lock2Acquired).toBe(false);

            // Release first lock
            release1();

            // Second lock should now acquire
            const release2 = await lock2Promise;
            expect(lock2Acquired).toBe(true);
            expect(isLocked('uuid-1')).toBe(true);

            release2();
        });

        it('should timeout when waiting too long', async () => {
            configure({ timeoutMs: 50 });

            const release1 = await acquireLock('uuid-1');

            // Try to acquire second lock (should timeout)
            await expect(acquireLock('uuid-1')).rejects.toThrow(LockTimeoutError);

            release1();
        });
    });

    describe('tryAcquireLock', () => {
        it('should return release function when lock available', () => {
            const release = tryAcquireLock('uuid-1');

            expect(release).not.toBeNull();
            expect(isLocked('uuid-1')).toBe(true);

            release!();
            expect(isLocked('uuid-1')).toBe(false);
        });

        it('should return null when lock not available', async () => {
            const release1 = await acquireLock('uuid-1');

            const release2 = tryAcquireLock('uuid-1');
            expect(release2).toBeNull();

            release1();
        });
    });

    describe('isLocked', () => {
        it('should return false for unlocked project', () => {
            expect(isLocked('uuid-1')).toBe(false);
        });

        it('should return true for locked project', async () => {
            const release = await acquireLock('uuid-1');

            expect(isLocked('uuid-1')).toBe(true);

            release();
        });
    });

    describe('getLockDuration', () => {
        it('should return null for unlocked project', () => {
            expect(getLockDuration('uuid-1')).toBeNull();
        });

        it('should return duration for locked project', async () => {
            const release = await acquireLock('uuid-1');

            await new Promise(resolve => setTimeout(resolve, 10));

            const duration = getLockDuration('uuid-1');
            expect(duration).not.toBeNull();
            expect(duration!).toBeGreaterThanOrEqual(10);

            release();
        });
    });

    describe('withLock', () => {
        it('should execute function with lock', async () => {
            let executed = false;

            await withLock('uuid-1', () => {
                expect(isLocked('uuid-1')).toBe(true);
                executed = true;
            });

            expect(executed).toBe(true);
            expect(isLocked('uuid-1')).toBe(false);
        });

        it('should return function result', async () => {
            const result = await withLock('uuid-1', () => {
                return 42;
            });

            expect(result).toBe(42);
        });

        it('should handle async functions', async () => {
            const result = await withLock('uuid-1', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'async-result';
            });

            expect(result).toBe('async-result');
        });

        it('should release lock on error', async () => {
            await expect(
                withLock('uuid-1', () => {
                    throw new Error('test error');
                }),
            ).rejects.toThrow('test error');

            expect(isLocked('uuid-1')).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return correct stats', async () => {
            const release1 = await acquireLock('uuid-1');
            const release2 = await acquireLock('uuid-2');

            const stats = getStats();
            expect(stats.activeLocks).toBe(2);
            expect(stats.locks.map(l => l.uuid)).toContain('uuid-1');
            expect(stats.locks.map(l => l.uuid)).toContain('uuid-2');

            release1();
            release2();
        });
    });

    describe('releaseAll', () => {
        it('should release all locks', async () => {
            await acquireLock('uuid-1');
            await acquireLock('uuid-2');

            expect(getStats().activeLocks).toBe(2);

            releaseAll();

            expect(getStats().activeLocks).toBe(0);
            expect(isLocked('uuid-1')).toBe(false);
            expect(isLocked('uuid-2')).toBe(false);
        });
    });

    describe('multiple projects', () => {
        it('should handle locks independently per project', async () => {
            const release1 = await acquireLock('uuid-1');
            const release2 = await acquireLock('uuid-2');

            expect(isLocked('uuid-1')).toBe(true);
            expect(isLocked('uuid-2')).toBe(true);

            release1();
            expect(isLocked('uuid-1')).toBe(false);
            expect(isLocked('uuid-2')).toBe(true);

            release2();
        });
    });
});
