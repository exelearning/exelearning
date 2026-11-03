/**
 * Project Activity Service (issue #2689, ADR-2689-01)
 *
 * Records who performed a meaningful action in a project, what it affected
 * and when, and serves the per-project log to authorised readers.
 *
 * Logging policy:
 * - Critical completed operations (sharing, ownership, saves, sessions,
 *   restorations) are recorded by the server AFTER their state change
 *   succeeded. Recording is best-effort: a logging failure is reported to the
 *   console and never propagates to the originating request.
 * - Client-reported semantic events are validated, normalised, attributed to
 *   the authenticated reporter and inserted idempotently (dedupe key).
 * - Repeated automatic saves by the same user are coalesced into one row.
 *
 * Dependency injection: `createProjectActivityService(deps)` builds an
 * instance; routes receive it through their own dependency objects. The
 * default instance uses the real queries and configuration.
 */
import type { Kysely } from 'kysely';
import type { Database, Project } from '../db/types';
import {
    insertProjectActivity as insertProjectActivityDefault,
    hasProjectActivityDedupeKey as hasProjectActivityDedupeKeyDefault,
    findLatestProjectActivityForCoalesce as findLatestProjectActivityForCoalesceDefault,
    incrementProjectActivity as incrementProjectActivityDefault,
    hasProjectSessionOpened as hasProjectSessionOpenedDefault,
    listProjectActivity as listProjectActivityDefault,
    listProjectActivityActors as listProjectActivityActorsDefault,
    findUserEmailsByIds as findUserEmailsByIdsDefault,
    type ProjectActivityCursor,
} from '../db/queries/project-activity';
import { isCollaborator as isCollaboratorDefault } from '../db/queries/projects';
import {
    getProjectActivityConfig as getProjectActivityConfigDefault,
    type ProjectActivityConfig,
} from '../config/project-activity';
import {
    DEDUPE_KEY_PATTERN,
    PROJECT_ACTIVITY_LIMITS,
    SESSION_ID_PATTERN,
    TARGET_ID_PATTERN,
    allowedDetailKeysFor,
    getEventProvenance,
    isClientEventType,
    isTargetType,
    saveEventTypeFor,
    type ProjectActivityEventType,
    type ProjectActivityTargetType,
    type SaveKind,
    type ServerEventType,
} from '../shared/project-activity/events';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectActivityQueries {
    insertProjectActivity: typeof insertProjectActivityDefault;
    hasProjectActivityDedupeKey: typeof hasProjectActivityDedupeKeyDefault;
    findLatestProjectActivityForCoalesce: typeof findLatestProjectActivityForCoalesceDefault;
    incrementProjectActivity: typeof incrementProjectActivityDefault;
    hasProjectSessionOpened: typeof hasProjectSessionOpenedDefault;
    listProjectActivity: typeof listProjectActivityDefault;
    listProjectActivityActors: typeof listProjectActivityActorsDefault;
    findUserEmailsByIds: typeof findUserEmailsByIdsDefault;
    isCollaborator: typeof isCollaboratorDefault;
}

export interface ProjectActivityServiceDeps {
    queries: ProjectActivityQueries;
    getConfig: () => ProjectActivityConfig;
    now: () => number;
    logger: Pick<Console, 'warn'>;
}

export interface RecordActivityInput {
    projectId: number;
    userId: number | null;
    type: ServerEventType;
    targetType?: ProjectActivityTargetType;
    targetId?: string | number | null;
    targetLabel?: string | null;
    details?: Record<string, unknown> | null;
    sessionId?: string | null;
    occurredAt?: number;
}

export interface RecordSaveInput {
    projectId: number;
    userId: number;
    kind: SaveKind;
    documentVersion: string;
    merged: boolean;
}

export interface RecordSessionInput {
    projectId: number;
    userId: number;
    sessionId: string | null | undefined;
}

export interface RecordVersionRestoredInput {
    projectId: number;
    userId: number;
    restoredVersionId: number;
    restoredVersion: string;
    resultingVersion: string;
}

export interface ClientActivityEventInput {
    type: string;
    targetType?: string;
    targetId?: string | null;
    label?: string | null;
    count?: number;
    firstAt?: number;
    lastAt?: number;
    details?: Record<string, unknown> | null;
    seq: number;
}

export interface ClientActivityBatch {
    sessionId: string;
    events: ClientActivityEventInput[];
}

export interface ClientActivityResult {
    accepted: number;
    duplicates: number;
    rejected: number;
    failed: number;
    recordingEnabled: boolean;
}

export interface ActivityListParams {
    userId?: string | number;
    since?: string | number;
    until?: string | number;
    limit?: string | number;
    cursor?: string;
}

export interface ActivityActor {
    id: number;
    email: string;
}

export interface ActivityTarget {
    type: ProjectActivityTargetType;
    id: string | null;
    label: string | null;
    /** For user targets: the account no longer exists. */
    deleted?: boolean;
}

export interface ActivityEntry {
    id: number;
    type: string;
    provenance: 'server' | 'client';
    /** null when the actor's account was deleted */
    actor: ActivityActor | null;
    target: ActivityTarget | null;
    details: Record<string, unknown> | null;
    count: number;
    firstOccurredAt: number;
    occurredAt: number;
    createdAt: number;
    sessionId: string | null;
}

export interface ActivityPage {
    events: ActivityEntry[];
    nextCursor: string | null;
    recordingEnabled: boolean;
    retentionDays: number;
}

export interface CanViewActivityInput {
    project: Pick<Project, 'id' | 'owner_id' | 'status'>;
    userId: number;
    isAdmin: boolean;
}

export class ProjectActivityValidationError extends Error {
    readonly status = 400;
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'ProjectActivityValidationError';
        this.code = code;
    }
}

export interface ProjectActivityService {
    isEnabled(): boolean;
    getConfig(): ProjectActivityConfig;
    record(db: Kysely<Database>, input: RecordActivityInput): Promise<void>;
    recordSave(db: Kysely<Database>, input: RecordSaveInput): Promise<void>;
    recordSessionOpened(db: Kysely<Database>, input: RecordSessionInput): Promise<void>;
    recordVersionRestored(db: Kysely<Database>, input: RecordVersionRestoredInput): Promise<void>;
    recordClientEvents(
        db: Kysely<Database>,
        projectId: number,
        userId: number,
        batch: unknown,
    ): Promise<ClientActivityResult>;
    canViewActivity(db: Kysely<Database>, input: CanViewActivityInput): Promise<boolean>;
    listActivity(db: Kysely<Database>, projectId: number, params: ActivityListParams): Promise<ActivityPage>;
    listActors(db: Kysely<Database>, projectId: number): Promise<Array<{ id: number | null; email: string | null }>>;
}

// ============================================================================
// HELPERS
// ============================================================================

const TARGET_BY_FAMILY: Readonly<Record<string, ProjectActivityTargetType>> = {
    page: 'page',
    block: 'block',
    idevice: 'idevice',
    project: 'project',
    content: 'project',
    import: 'project',
};

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const CURSOR_PATTERN = /^(\d{1,16})_(\d{1,16})$/;

function truncate(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text === '') return null;
    return text.length > max ? text.slice(0, max) : text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep only allow-listed keys with bounded scalar or short string-array values.
 * Returns the JSON text or null when nothing survives or the result is too big.
 */
function sanitizeDetails(type: string, details: unknown): string | null {
    if (!isPlainObject(details)) return null;
    const allowed = allowedDetailKeysFor(type);
    const clean: Record<string, unknown> = {};
    for (const key of allowed) {
        const value = details[key];
        if (value === undefined || value === null) continue;
        if (typeof value === 'string') {
            const text = truncate(value, PROJECT_ACTIVITY_LIMITS.detailsStringLength);
            if (text !== null) clean[key] = text;
        } else if (typeof value === 'number') {
            if (Number.isFinite(value)) clean[key] = value;
        } else if (typeof value === 'boolean') {
            clean[key] = value;
        } else if (Array.isArray(value)) {
            const items = value
                .slice(0, 20)
                .map(item => (typeof item === 'string' ? truncate(item, 64) : null))
                .filter((item): item is string => item !== null);
            if (items.length > 0) clean[key] = items;
        }
    }
    if (Object.keys(clean).length === 0) return null;
    const json = JSON.stringify(clean);
    return json.length > PROJECT_ACTIVITY_LIMITS.detailsBytes ? null : json;
}

/** Server-side details are trusted code, but still bounded in size. */
function serializeServerDetails(details: Record<string, unknown> | null | undefined): string | null {
    if (!isPlainObject(details) || Object.keys(details).length === 0) return null;
    const json = JSON.stringify(details);
    return json.length > PROJECT_ACTIVITY_LIMITS.detailsBytes ? null : json;
}

function parseDetails(json: string | null): Record<string, unknown> | null {
    if (!json) return null;
    try {
        const parsed = JSON.parse(json);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function encodeCursor(cursor: ProjectActivityCursor | null): string | null {
    return cursor ? `${cursor.occurredAt}_${cursor.id}` : null;
}

function parseCursor(value: string | undefined): ProjectActivityCursor | undefined {
    if (value === undefined || value === '') return undefined;
    const match = CURSOR_PATTERN.exec(value);
    if (!match) throw new ProjectActivityValidationError('INVALID_CURSOR', 'Invalid pagination cursor');
    return { occurredAt: Number(match[1]), id: Number(match[2]) };
}

function parseOptionalInteger(value: string | number | undefined, code: string, label: string): number | undefined {
    if (value === undefined || value === '') return undefined;
    const text = String(value).trim();
    if (!/^\d{1,16}$/.test(text))
        throw new ProjectActivityValidationError(code, `${label} must be a non-negative integer`);
    return Number(text);
}

function clampTimestamp(value: unknown, now: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return now;
    const min = now - PROJECT_ACTIVITY_LIMITS.pastSkewMs;
    const max = now + PROJECT_ACTIVITY_LIMITS.futureSkewMs;
    if (n < min || n > max) return now;
    return Math.floor(n);
}

function normalizeCount(value: unknown): number | null {
    const n = typeof value === 'number' ? value : value === undefined ? 1 : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > PROJECT_ACTIVITY_LIMITS.maxCount) return null;
    return n;
}

// ============================================================================
// SERVICE
// ============================================================================

export function createProjectActivityService(
    overrides: Partial<ProjectActivityServiceDeps> = {},
): ProjectActivityService {
    const deps: ProjectActivityServiceDeps = {
        queries: {
            insertProjectActivity: insertProjectActivityDefault,
            hasProjectActivityDedupeKey: hasProjectActivityDedupeKeyDefault,
            findLatestProjectActivityForCoalesce: findLatestProjectActivityForCoalesceDefault,
            incrementProjectActivity: incrementProjectActivityDefault,
            hasProjectSessionOpened: hasProjectSessionOpenedDefault,
            listProjectActivity: listProjectActivityDefault,
            listProjectActivityActors: listProjectActivityActorsDefault,
            findUserEmailsByIds: findUserEmailsByIdsDefault,
            isCollaborator: isCollaboratorDefault,
            ...(overrides.queries ?? {}),
        },
        getConfig: overrides.getConfig ?? (() => getProjectActivityConfigDefault()),
        now: overrides.now ?? (() => Date.now()),
        logger: overrides.logger ?? console,
    };

    const warn = (message: string, error: unknown): void => {
        const detail = error instanceof Error ? error.message : String(error);
        deps.logger.warn(`[project-activity] ${message}: ${detail}`);
    };

    const isEnabled = (): boolean => deps.getConfig().recordingEnabled;

    async function insertRow(
        db: Kysely<Database>,
        row: {
            projectId: number;
            userId: number | null;
            type: ProjectActivityEventType;
            targetType: ProjectActivityTargetType | null;
            targetId: string | null;
            targetLabel: string | null;
            details: string | null;
            sessionId: string | null;
            dedupeKey: string | null;
            count: number;
            firstOccurredAt: number;
            occurredAt: number;
        },
    ): Promise<number | undefined> {
        return deps.queries.insertProjectActivity(db, {
            project_id: row.projectId,
            user_id: row.userId,
            event_type: row.type,
            target_type: row.targetType,
            target_id: row.targetId,
            target_label: row.targetLabel,
            details: row.details,
            session_id: row.sessionId,
            dedupe_key: row.dedupeKey,
            event_count: row.count,
            first_occurred_at: row.firstOccurredAt,
            occurred_at: row.occurredAt,
            created_at: deps.now(),
        });
    }

    const record: ProjectActivityService['record'] = async (db, input) => {
        if (!isEnabled()) return;
        try {
            const at = input.occurredAt ?? deps.now();
            await insertRow(db, {
                projectId: input.projectId,
                userId: input.userId,
                type: input.type,
                targetType: input.targetType ?? 'project',
                targetId: input.targetId === undefined || input.targetId === null ? null : String(input.targetId),
                targetLabel: truncate(input.targetLabel, PROJECT_ACTIVITY_LIMITS.labelLength),
                details: serializeServerDetails(input.details),
                sessionId: truncate(input.sessionId, PROJECT_ACTIVITY_LIMITS.sessionIdLength),
                dedupeKey: null,
                count: 1,
                firstOccurredAt: at,
                occurredAt: at,
            });
        } catch (error) {
            warn(`Failed to record ${input.type} for project ${input.projectId}`, error);
        }
    };

    /**
     * Fold the event into the newest matching row of the same actor when it
     * is recent enough; otherwise insert a fresh row.
     */
    async function recordCoalesced(
        db: Kysely<Database>,
        input: {
            projectId: number;
            userId: number;
            type: ServerEventType;
            details: Record<string, unknown> | null;
            sessionId?: string | null;
        },
    ): Promise<void> {
        const now = deps.now();
        const since = now - PROJECT_ACTIVITY_LIMITS.saveCoalesceWindowMs;
        const latest = await deps.queries.findLatestProjectActivityForCoalesce(
            db,
            input.projectId,
            input.userId,
            input.type,
            since,
        );
        const details = serializeServerDetails(input.details);
        if (latest) {
            const updated = await deps.queries.incrementProjectActivity(db, Number(latest.id), now, details);
            if (updated) return;
        }
        await insertRow(db, {
            projectId: input.projectId,
            userId: input.userId,
            type: input.type,
            targetType: 'project',
            targetId: null,
            targetLabel: null,
            details,
            sessionId: truncate(input.sessionId, PROJECT_ACTIVITY_LIMITS.sessionIdLength),
            dedupeKey: null,
            count: 1,
            firstOccurredAt: now,
            occurredAt: now,
        });
    }

    const recordSave: ProjectActivityService['recordSave'] = async (db, input) => {
        if (!isEnabled()) return;
        const type = saveEventTypeFor(input.kind);
        const details = { documentVersion: input.documentVersion, merged: input.merged };
        try {
            if (type === 'save.manual') {
                await record(db, { projectId: input.projectId, userId: input.userId, type, details });
                return;
            }
            await recordCoalesced(db, { projectId: input.projectId, userId: input.userId, type, details });
        } catch (error) {
            warn(`Failed to record ${type} for project ${input.projectId}`, error);
        }
    };

    const recordSessionOpened: ProjectActivityService['recordSessionOpened'] = async (db, input) => {
        if (!isEnabled()) return;
        try {
            const sessionId =
                typeof input.sessionId === 'string' && SESSION_ID_PATTERN.test(input.sessionId)
                    ? input.sessionId
                    : null;
            if (sessionId) {
                if (await deps.queries.hasProjectSessionOpened(db, input.projectId, input.userId, sessionId)) return;
                await record(db, {
                    projectId: input.projectId,
                    userId: input.userId,
                    type: 'session.opened',
                    sessionId,
                });
                return;
            }
            // No usable session id (non-standard client): coalesce recent opens by the same user instead.
            await recordCoalesced(db, {
                projectId: input.projectId,
                userId: input.userId,
                type: 'session.opened',
                details: null,
            });
        } catch (error) {
            warn(`Failed to record session.opened for project ${input.projectId}`, error);
        }
    };

    const recordVersionRestored: ProjectActivityService['recordVersionRestored'] = async (db, input) => {
        await record(db, {
            projectId: input.projectId,
            userId: input.userId,
            type: 'version.restored',
            details: {
                restoredVersionId: input.restoredVersionId,
                restoredVersion: input.restoredVersion,
                documentVersion: input.resultingVersion,
            },
        });
    };

    const recordClientEvents: ProjectActivityService['recordClientEvents'] = async (db, projectId, userId, batch) => {
        if (!isPlainObject(batch)) throw new ProjectActivityValidationError('INVALID_BODY', 'Body must be an object');
        const sessionId = batch.sessionId;
        if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
            throw new ProjectActivityValidationError('INVALID_SESSION', 'sessionId is required');
        }
        const events = batch.events;
        if (!Array.isArray(events) || events.length === 0) {
            throw new ProjectActivityValidationError('INVALID_EVENTS', 'events must be a non-empty array');
        }
        if (events.length > PROJECT_ACTIVITY_LIMITS.eventsPerRequest) {
            throw new ProjectActivityValidationError(
                'TOO_MANY_EVENTS',
                `At most ${PROJECT_ACTIVITY_LIMITS.eventsPerRequest} events per request`,
            );
        }

        const result: ClientActivityResult = {
            accepted: 0,
            duplicates: 0,
            rejected: 0,
            failed: 0,
            recordingEnabled: isEnabled(),
        };
        if (!result.recordingEnabled) return result;

        const now = deps.now();
        for (const raw of events) {
            if (!isPlainObject(raw) || typeof raw.type !== 'string' || !isClientEventType(raw.type)) {
                result.rejected++;
                continue;
            }
            const type = raw.type;
            const expectedTarget = TARGET_BY_FAMILY[type.split('.')[0]];
            const targetType =
                typeof raw.targetType === 'string' && isTargetType(raw.targetType) ? raw.targetType : expectedTarget;
            if (targetType !== expectedTarget) {
                result.rejected++;
                continue;
            }
            let targetId: string | null = null;
            if (targetType !== 'project') {
                if (typeof raw.targetId !== 'string' || !TARGET_ID_PATTERN.test(raw.targetId)) {
                    result.rejected++;
                    continue;
                }
                targetId = raw.targetId;
            }
            const count = normalizeCount(raw.count);
            if (count === null) {
                result.rejected++;
                continue;
            }
            if (!Number.isInteger(raw.seq) || (raw.seq as number) < 0) {
                result.rejected++;
                continue;
            }
            const dedupeKey = `${sessionId}:${raw.seq}`;
            if (!DEDUPE_KEY_PATTERN.test(dedupeKey) || dedupeKey.length > PROJECT_ACTIVITY_LIMITS.dedupeKeyLength) {
                result.rejected++;
                continue;
            }
            const lastAt = clampTimestamp(raw.lastAt ?? raw.firstAt, now);
            const firstAt = Math.min(clampTimestamp(raw.firstAt ?? raw.lastAt, now), lastAt);

            try {
                if (await deps.queries.hasProjectActivityDedupeKey(db, projectId, dedupeKey)) {
                    result.duplicates++;
                    continue;
                }
                await insertRow(db, {
                    projectId,
                    userId,
                    type,
                    targetType,
                    targetId,
                    targetLabel: truncate(raw.label, PROJECT_ACTIVITY_LIMITS.labelLength),
                    details: sanitizeDetails(type, raw.details),
                    sessionId,
                    dedupeKey,
                    count,
                    firstOccurredAt: firstAt,
                    occurredAt: lastAt,
                });
                result.accepted++;
            } catch (error) {
                // A concurrent retry may have inserted the same key between the check and the insert.
                try {
                    if (await deps.queries.hasProjectActivityDedupeKey(db, projectId, dedupeKey)) {
                        result.duplicates++;
                        continue;
                    }
                } catch {
                    // fall through to the failure report
                }
                result.failed++;
                warn(`Failed to store client event ${type} for project ${projectId}`, error);
            }
        }
        return result;
    };

    const canViewActivity: ProjectActivityService['canViewActivity'] = async (db, input) => {
        if (input.isAdmin) return true;
        if (input.project.status === 'inactive') return false;
        if (input.project.owner_id === input.userId) return true;
        if (!deps.getConfig().editorAccess) return false;
        return deps.queries.isCollaborator(db, input.project.id, input.userId);
    };

    const listActivity: ProjectActivityService['listActivity'] = async (db, projectId, params) => {
        const limitRaw = parseOptionalInteger(params.limit, 'INVALID_LIMIT', 'limit');
        const limit = limitRaw === undefined ? DEFAULT_LIST_LIMIT : limitRaw;
        if (limit < 1 || limit > MAX_LIST_LIMIT) {
            throw new ProjectActivityValidationError('INVALID_LIMIT', `limit must be between 1 and ${MAX_LIST_LIMIT}`);
        }
        const userId = parseOptionalInteger(params.userId, 'INVALID_USER', 'userId');
        if (userId !== undefined && userId < 1)
            throw new ProjectActivityValidationError('INVALID_USER', 'userId must be positive');
        const since = parseOptionalInteger(params.since, 'INVALID_RANGE', 'since');
        const until = parseOptionalInteger(params.until, 'INVALID_RANGE', 'until');
        if (since !== undefined && until !== undefined && since >= until) {
            throw new ProjectActivityValidationError('INVALID_RANGE', 'since must be earlier than until');
        }
        const cursor = parseCursor(params.cursor);

        const { rows, nextCursor } = await deps.queries.listProjectActivity(db, projectId, {
            userId,
            since,
            until,
            limit,
            cursor,
        });

        const userTargetIds = rows
            .filter(row => row.target_type === 'user' && row.target_id !== null && /^\d+$/.test(row.target_id))
            .map(row => Number(row.target_id));
        const targetEmails = await deps.queries.findUserEmailsByIds(db, Array.from(new Set(userTargetIds)));

        const events: ActivityEntry[] = rows.map(row => {
            const targetType = row.target_type && isTargetType(row.target_type) ? row.target_type : null;
            let target: ActivityTarget | null = null;
            if (targetType) {
                target = { type: targetType, id: row.target_id, label: row.target_label };
                if (targetType === 'user' && row.target_id !== null) {
                    const email = targetEmails.get(Number(row.target_id));
                    target.label = email ?? null;
                    target.deleted = email === undefined;
                }
            }
            return {
                id: Number(row.id),
                type: row.event_type,
                provenance: getEventProvenance(row.event_type),
                // A dangling user id (engine without FK enforcement) is shown as a deleted actor too.
                actor:
                    row.user_id === null || row.actor_email === null || row.actor_email === undefined
                        ? null
                        : { id: Number(row.user_id), email: row.actor_email },
                target,
                details: parseDetails(row.details),
                count: Number(row.event_count),
                firstOccurredAt: Number(row.first_occurred_at),
                occurredAt: Number(row.occurred_at),
                createdAt: Number(row.created_at),
                sessionId: row.session_id,
            };
        });

        const config = deps.getConfig();
        return {
            events,
            nextCursor: encodeCursor(nextCursor),
            recordingEnabled: config.recordingEnabled,
            retentionDays: config.retentionDays,
        };
    };

    const listActors: ProjectActivityService['listActors'] = async (db, projectId) => {
        const actors = await deps.queries.listProjectActivityActors(db, projectId);
        return actors.map(actor => ({ id: actor.user_id, email: actor.email }));
    };

    return {
        isEnabled,
        getConfig: () => deps.getConfig(),
        record,
        recordSave,
        recordSessionOpened,
        recordVersionRestored,
        recordClientEvents,
        canViewActivity,
        listActivity,
        listActors,
    };
}

/** Default instance with real queries and environment configuration. */
export const projectActivityService: ProjectActivityService = createProjectActivityService();
