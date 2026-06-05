/**
 * Activity Logger Service
 *
 * Records activity events for dashboard analytics (logins, project creation, impersonation).
 * Never throws — logging failures are caught and console.error'd so they
 * cannot break the originating request.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { insertActivityEvent } from '../db/queries/activity-log';

// ============================================================================
// TYPES
// ============================================================================

export type ActivityEventType = 'auth.login' | 'project.create' | 'admin.impersonation_start';

export interface ActivityEventInput {
    eventType: ActivityEventType;
    userId?: number | null;
}

// ============================================================================
// DEPENDENCIES (DI pattern)
// ============================================================================

export interface ActivityLoggerDependencies {
    insertActivityEvent: typeof insertActivityEvent;
}

const defaultDeps: ActivityLoggerDependencies = {
    insertActivityEvent,
};

let deps = defaultDeps;

export function configure(newDeps: Partial<ActivityLoggerDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Log an activity event for dashboard analytics.
 * Fire-and-forget: never throws, errors are logged to console.
 */
export async function logActivity(db: Kysely<Database>, input: ActivityEventInput): Promise<void> {
    try {
        const { eventType, userId = null } = input;

        await deps.insertActivityEvent(db, {
            event_type: eventType,
            user_id: userId ?? null,
            created_at: Date.now(),
        });
    } catch (err) {
        console.error('[activity-logger] Failed to log activity event:', err);
    }
}
