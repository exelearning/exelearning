/**
 * Document Lock (Mutex) for Server-Side Y.Doc Operations
 *
 * Provides project-level locking to ensure atomic operations
 * when modifying Y.Doc from multiple REST requests.
 *
 * Features:
 * - Per-project mutex (different projects can be modified concurrently)
 * - Configurable timeout to prevent deadlocks
 * - Async/await friendly API
 */
import type { DocLockConfig, LockEntry } from './types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DocLockConfig = {
    timeoutMs: 5000, // 5 seconds
};

// ============================================================================
// MODULE STATE
// ============================================================================

let config: DocLockConfig = { ...DEFAULT_CONFIG };
const locks = new Map<string, LockEntry>();

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configure the lock manager
 */
export function configure(newConfig: Partial<DocLockConfig>): void {
    config = { ...DEFAULT_CONFIG, ...newConfig };
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
    config = { ...DEFAULT_CONFIG };
}

/**
 * Get current configuration
 */
export function getConfig(): DocLockConfig {
    return { ...config };
}

// ============================================================================
// LOCK OPERATIONS
// ============================================================================

/**
 * Error thrown when lock acquisition times out
 */
export class LockTimeoutError extends Error {
    constructor(projectUuid: string, timeoutMs: number) {
        super(`Lock acquisition timed out for project ${projectUuid} after ${timeoutMs}ms`);
        this.name = 'LockTimeoutError';
    }
}

/**
 * Acquire a lock for a project
 *
 * @param projectUuid - The project UUID to lock
 * @returns A release function to call when done
 * @throws LockTimeoutError if the lock cannot be acquired within timeout
 *
 * @example
 * ```ts
 * const release = await acquireLock('project-123');
 * try {
 *     // ... do work with the document
 * } finally {
 *     release();
 * }
 * ```
 */
export async function acquireLock(projectUuid: string): Promise<() => void> {
    // Wait for existing lock to release (with timeout)
    const existing = locks.get(projectUuid);
    if (existing) {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new LockTimeoutError(projectUuid, config.timeoutMs)), config.timeoutMs);
        });

        try {
            await Promise.race([existing.promise, timeoutPromise]);
        } catch (error) {
            if (error instanceof LockTimeoutError) {
                throw error;
            }
            // Other errors (e.g., from the existing promise) - continue to acquire
        }
    }

    // Create new lock
    let resolveFunc!: () => void;
    const promise = new Promise<void>(resolve => {
        resolveFunc = resolve;
    });

    const entry: LockEntry = {
        promise,
        resolve: resolveFunc,
        acquiredAt: Date.now(),
    };

    locks.set(projectUuid, entry);

    // Return release function
    return () => {
        const current = locks.get(projectUuid);
        // Only release if this is still our lock
        if (current?.resolve === resolveFunc) {
            locks.delete(projectUuid);
            resolveFunc();
        }
    };
}

/**
 * Try to acquire a lock without waiting
 *
 * @param projectUuid - The project UUID to lock
 * @returns A release function if lock was acquired, null otherwise
 */
export function tryAcquireLock(projectUuid: string): (() => void) | null {
    if (locks.has(projectUuid)) {
        return null;
    }

    let resolveFunc!: () => void;
    const promise = new Promise<void>(resolve => {
        resolveFunc = resolve;
    });

    const entry: LockEntry = {
        promise,
        resolve: resolveFunc,
        acquiredAt: Date.now(),
    };

    locks.set(projectUuid, entry);

    return () => {
        const current = locks.get(projectUuid);
        if (current?.resolve === resolveFunc) {
            locks.delete(projectUuid);
            resolveFunc();
        }
    };
}

/**
 * Check if a project is currently locked
 */
export function isLocked(projectUuid: string): boolean {
    return locks.has(projectUuid);
}

/**
 * Get the time a lock has been held (in ms)
 * Returns null if not locked
 */
export function getLockDuration(projectUuid: string): number | null {
    const entry = locks.get(projectUuid);
    if (!entry) {
        return null;
    }
    return Date.now() - entry.acquiredAt;
}

/**
 * Execute a function with a lock held
 *
 * @param projectUuid - The project UUID to lock
 * @param fn - The function to execute while holding the lock
 * @returns The result of the function
 *
 * @example
 * ```ts
 * const result = await withLock('project-123', async () => {
 *     // ... do work with the document
 *     return someValue;
 * });
 * ```
 */
export async function withLock<T>(projectUuid: string, fn: () => T | Promise<T>): Promise<T> {
    const release = await acquireLock(projectUuid);
    try {
        return await fn();
    } finally {
        release();
    }
}

/**
 * Get lock statistics
 */
export function getStats(): {
    activeLocks: number;
    locks: Array<{ uuid: string; acquiredAt: number; durationMs: number }>;
} {
    const now = Date.now();
    return {
        activeLocks: locks.size,
        locks: Array.from(locks.entries()).map(([uuid, entry]) => ({
            uuid,
            acquiredAt: entry.acquiredAt,
            durationMs: now - entry.acquiredAt,
        })),
    };
}

/**
 * Force release all locks (use with caution, mainly for testing)
 */
export function releaseAll(): void {
    for (const [, entry] of locks) {
        entry.resolve();
    }
    locks.clear();
}
