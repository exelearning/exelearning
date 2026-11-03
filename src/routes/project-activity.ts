/**
 * Project Activity Routes (issue #2689, ADR-2689-01)
 *
 * Internal UI endpoints under /api/projects (not /api/v1):
 *
 *   GET  /api/projects/:projectId/activity            read the log (numeric id)
 *   GET  /api/projects/uuid/:uuid/activity            read the log (uuid)
 *   GET  /api/projects/:projectId/activity/actors     distinct actors for the filter
 *   GET  /api/projects/uuid/:uuid/activity/actors
 *   POST /api/projects/uuid/:uuid/activity/events     client-reported semantic events
 *
 * Reading requires the project owner, an administrator, or an explicit
 * collaborator when PROJECT_ACTIVITY_EDITOR_ACCESS is enabled. Public edit
 * visibility never grants reading. Writing requires edit access to the
 * project; the actor is always the authenticated user.
 */
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import type { Database, Project } from '../db/types';
import { db as defaultDb } from '../db/client';
import { findProjectById, findProjectByUuid, checkProjectAccess } from '../db/queries';
import { withJwtAuth } from '../utils/route-auth';
import { hasRole, requireAuth, ROLES } from '../utils/guards';
import type { JwtPayload } from './auth';
import {
    projectActivityService as projectActivityServiceDefault,
    ProjectActivityValidationError,
    type ProjectActivityService,
} from '../services/project-activity';
import { PROJECT_ACTIVITY_LIMITS } from '../shared/project-activity/events';

export interface ProjectActivityRouteQueries {
    findProjectById: typeof findProjectById;
    findProjectByUuid: typeof findProjectByUuid;
    checkProjectAccess: typeof checkProjectAccess;
}

export interface ProjectActivityRouteDependencies {
    db: Kysely<Database>;
    queries: ProjectActivityRouteQueries;
    activity: ProjectActivityService;
    /** Injectable clock for the rate limiter (tests). */
    now?: () => number;
}

const defaultDependencies: ProjectActivityRouteDependencies = {
    db: defaultDb,
    queries: { findProjectById, findProjectByUuid, checkProjectAccess },
    activity: projectActivityServiceDefault,
};

/**
 * Per-user sliding-window limiter for client event posts. In-process only:
 * on multi-instance deployments each instance enforces it independently,
 * which still bounds the damage a hostile editor can do per instance.
 */
export class SlidingWindowRateLimiter {
    private readonly hits = new Map<number, number[]>();

    constructor(
        private readonly maxRequests: number,
        private readonly windowMs: number,
        private readonly maxTrackedUsers = 10000,
    ) {}

    /** Returns true when the request is allowed. */
    allow(userId: number, now: number): boolean {
        const since = now - this.windowMs;
        const recent = (this.hits.get(userId) ?? []).filter(ts => ts > since);
        if (recent.length >= this.maxRequests) {
            this.hits.set(userId, recent);
            return false;
        }
        recent.push(now);
        this.hits.set(userId, recent);
        if (this.hits.size > this.maxTrackedUsers) {
            // Drop the oldest tracked user so memory stays bounded.
            const oldest = this.hits.keys().next().value;
            if (oldest !== undefined) this.hits.delete(oldest);
        }
        return true;
    }

    reset(): void {
        this.hits.clear();
    }
}

function jsonError(set: { status?: number | string }, status: number, error: string, message: string) {
    set.status = status;
    return { error, message };
}

export function createProjectActivityRoutes(deps: ProjectActivityRouteDependencies = defaultDependencies) {
    const { db, queries, activity } = deps;
    const now = deps.now ?? (() => Date.now());
    const limiter = new SlidingWindowRateLimiter(
        PROJECT_ACTIVITY_LIMITS.rateLimitRequests,
        PROJECT_ACTIVITY_LIMITS.rateLimitWindowMs,
    );

    type Resolved = { project: Project; userId: number; isAdmin: boolean } | { error: ReturnType<typeof jsonError> };

    async function resolveReader(
        jwtPayload: JwtPayload | null | undefined,
        idOrUuid: string,
        byUuid: boolean,
        set: { status?: number | string },
    ): Promise<Resolved> {
        const authError = requireAuth(jwtPayload);
        if (authError) return { error: jsonError(set, authError.status, authError.error, authError.message) };
        const project = byUuid
            ? await queries.findProjectByUuid(db, idOrUuid)
            : /^\d+$/.test(idOrUuid)
              ? await queries.findProjectById(db, parseInt(idOrUuid, 10))
              : undefined;
        if (!project) return { error: jsonError(set, 404, 'NOT_FOUND', 'Project not found') };
        const userId = Number(jwtPayload!.sub);
        const isAdmin = hasRole(jwtPayload!.roles, ROLES.ADMIN);
        const allowed = await activity.canViewActivity(db, { project, userId, isAdmin });
        if (!allowed) return { error: jsonError(set, 403, 'FORBIDDEN', 'Access denied') };
        return { project, userId, isAdmin };
    }

    async function listHandler(
        jwtPayload: JwtPayload | null | undefined,
        idOrUuid: string,
        byUuid: boolean,
        query: Record<string, string | undefined>,
        set: { status?: number | string },
    ) {
        const resolved = await resolveReader(jwtPayload, idOrUuid, byUuid, set);
        if ('error' in resolved) return resolved.error;
        try {
            return await activity.listActivity(db, resolved.project.id, {
                userId: query.userId,
                since: query.since,
                until: query.until,
                limit: query.limit,
                cursor: query.cursor,
            });
        } catch (error) {
            if (error instanceof ProjectActivityValidationError) {
                return jsonError(set, 400, error.code, error.message);
            }
            throw error;
        }
    }

    async function actorsHandler(
        jwtPayload: JwtPayload | null | undefined,
        idOrUuid: string,
        byUuid: boolean,
        set: { status?: number | string },
    ) {
        const resolved = await resolveReader(jwtPayload, idOrUuid, byUuid, set);
        if ('error' in resolved) return resolved.error;
        return { actors: await activity.listActors(db, resolved.project.id) };
    }

    return new Elysia({ prefix: '/api/projects' })
        .use(withJwtAuth())
        .get('/uuid/:uuid/activity', ({ params, query, set, jwtPayload }) =>
            listHandler(jwtPayload, params.uuid, true, query as Record<string, string | undefined>, set),
        )
        .get('/uuid/:uuid/activity/actors', ({ params, set, jwtPayload }) =>
            actorsHandler(jwtPayload, params.uuid, true, set),
        )
        .get('/:projectId/activity', ({ params, query, set, jwtPayload }) =>
            listHandler(jwtPayload, params.projectId, false, query as Record<string, string | undefined>, set),
        )
        .get('/:projectId/activity/actors', ({ params, set, jwtPayload }) =>
            actorsHandler(jwtPayload, params.projectId, false, set),
        )
        .post('/uuid/:uuid/activity/events', async ({ params, body, set, jwtPayload, request }) => {
            const authError = requireAuth(jwtPayload);
            if (authError) return jsonError(set, authError.status, authError.error, authError.message);

            const contentLength = Number(request.headers.get('content-length') ?? 0);
            if (contentLength > PROJECT_ACTIVITY_LIMITS.requestBytes) {
                return jsonError(set, 413, 'PAYLOAD_TOO_LARGE', 'Activity batch too large');
            }

            const project = await queries.findProjectByUuid(db, params.uuid);
            if (!project) return jsonError(set, 404, 'NOT_FOUND', 'Project not found');

            const userId = Number(jwtPayload!.sub);
            // Writers need edit access to this project (owner, collaborator, public
            // edit visibility, or administrator). Cross-project injection is not
            // possible: the project comes from the URL and is authorised here.
            if (!hasRole(jwtPayload!.roles, ROLES.ADMIN)) {
                const access = await queries.checkProjectAccess(db, project, userId);
                if (!access.hasAccess) return jsonError(set, 403, 'FORBIDDEN', 'Access denied');
            }

            if (!limiter.allow(userId, now())) {
                return jsonError(set, 429, 'RATE_LIMITED', 'Too many activity reports');
            }

            try {
                const result = await activity.recordClientEvents(db, project.id, userId, body);
                return { success: true, ...result };
            } catch (error) {
                if (error instanceof ProjectActivityValidationError) {
                    return jsonError(set, 400, error.code, error.message);
                }
                throw error;
            }
        });
}

export const projectActivityRoutes = createProjectActivityRoutes();
