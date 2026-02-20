/**
 * Impersonation Audit Queries
 * Stores start/end events for admin user impersonation sessions.
 */
import type { Kysely } from 'kysely';
import type { Database, ImpersonationAuditLog } from '../types';
import { now } from '../types';

export interface CreateImpersonationAuditSessionInput {
    sessionId: string;
    impersonatorUserId: number;
    impersonatedUserId: number;
    startedByIp?: string | null;
    startedUserAgent?: string | null;
}

export interface EndImpersonationAuditSessionInput {
    sessionId: string;
    endedByIp?: string | null;
    endedUserAgent?: string | null;
}

/**
 * Create a new impersonation audit session row.
 */
export async function createImpersonationAuditSession(
    db: Kysely<Database>,
    input: CreateImpersonationAuditSessionInput,
): Promise<void> {
    await db
        .insertInto('impersonation_audit_logs')
        .values({
            session_id: input.sessionId,
            impersonator_user_id: input.impersonatorUserId,
            impersonated_user_id: input.impersonatedUserId,
            started_at: now(),
            ended_at: null,
            started_by_ip: input.startedByIp ?? null,
            started_user_agent: input.startedUserAgent ?? null,
            ended_by_ip: null,
            ended_user_agent: null,
        })
        .execute();
}

/**
 * Mark an impersonation session as ended.
 * Returns true if an open session was updated.
 */
export async function endImpersonationAuditSession(
    db: Kysely<Database>,
    input: EndImpersonationAuditSessionInput,
): Promise<boolean> {
    const result = await db
        .updateTable('impersonation_audit_logs')
        .set({
            ended_at: now(),
            ended_by_ip: input.endedByIp ?? null,
            ended_user_agent: input.endedUserAgent ?? null,
        })
        .where('session_id', '=', input.sessionId)
        .where('ended_at', 'is', null)
        .executeTakeFirst();

    const updated = Number(result.numUpdatedRows ?? 0);
    return updated > 0;
}

/**
 * Find one audit session row by session identifier.
 */
export async function findImpersonationAuditSessionBySessionId(
    db: Kysely<Database>,
    sessionId: string,
): Promise<ImpersonationAuditLog | undefined> {
    return db.selectFrom('impersonation_audit_logs').selectAll().where('session_id', '=', sessionId).executeTakeFirst();
}
