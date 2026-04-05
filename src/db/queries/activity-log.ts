/**
 * Activity Log Queries - Kysely ORM
 * Type-safe queries for activity log operations
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, NewActivityEvent } from '../types';

// ============================================================================
// INSERT
// ============================================================================

/**
 * Insert a new activity event record
 */
export async function insertActivityEvent(db: Kysely<Database>, event: Omit<NewActivityEvent, 'id'>): Promise<void> {
    await db.insertInto('activity_log').values(event).execute();
}
