/**
 * Shared route authentication helpers.
 *
 * Several route plugins repeat the same JWT bootstrap: `.use(jwt({ ... }))`
 * and a `.derive()` that extracts a `JwtPayload` from the `Authorization`
 * header or the `auth` cookie (read from Elysia's built-in `cookie` jar).
 * This module centralises that pattern so route files only have to call one
 * helper.
 *
 * Usage:
 *
 *   new Elysia({ prefix: '...' })
 *       .use(withJwtAuth())
 *       .onBeforeHandle(({ identity, set }) => {
 *           const err = requireAuth(identity);
 *           if (err) { set.status = err.status; return err; }
 *       })
 *       .get('/...', ...)
 */
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import type { Kysely } from 'kysely';
import { getJwtSecret } from '../routes/auth';
import { toAuthenticatedIdentity, type AuthenticatedIdentity, type JwtPayload } from '../auth/types';
import { hasRole, ROLES, requireAuth, type AuthorizationError } from './guards';
import { checkProjectAccess, findProjectByUuid, findProjectById } from '../db/queries';
import type { Database, Project } from '../db/types';

/**
 * Build an Elysia plugin that exposes a verified {@link AuthenticatedIdentity}
 * derived from the request. This is the single JWT boundary: the raw payload's
 * string `sub` is parsed to the numeric `userId` here and nowhere else.
 *
 * `identity` is `null` when no/invalid token is present — downstream handlers
 * decide whether that is acceptable via `requireAuth` or `requireAdmin` from
 * `./guards`.
 *
 * Marked `.as('scoped')` so the derive bubbles out to the consumer instance:
 * by default Elysia keeps lifecycle hooks defined inside `.use(plugin)` local
 * to the plugin, which means callers wouldn't see `identity` on their own
 * routes.
 */
export function withJwtAuth() {
    return new Elysia({ name: 'route-auth' })
        .use(
            jwt({
                name: 'jwt',
                secret: getJwtSecret(),
                exp: '7d',
            }),
        )
        .derive(async ({ jwt: jwtPlugin, cookie: cookieJar, request }) => {
            let token: string | undefined;
            const authHeader = request.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            } else if (cookieJar.auth?.value) {
                token = cookieJar.auth.value as string;
            }
            if (!token) {
                return { identity: null as AuthenticatedIdentity | null };
            }
            try {
                const payload = (await jwtPlugin.verify(token)) as JwtPayload | false;
                return { identity: payload ? toAuthenticatedIdentity(payload) : null };
            } catch {
                return { identity: null as AuthenticatedIdentity | null };
            }
        })
        .as('scoped');
}

/**
 * Queries used by `enforceProjectAccess`. Exposed so tests / callers can
 * inject mocks via the existing dependency-injection pattern in route files.
 */
export interface ProjectAccessQueries {
    findProjectByUuid: typeof findProjectByUuid;
    findProjectById: typeof findProjectById;
    checkProjectAccess: typeof checkProjectAccess;
}

export const defaultProjectAccessQueries: ProjectAccessQueries = {
    findProjectByUuid,
    findProjectById,
    checkProjectAccess,
};

/**
 * Shared project-access guard used by route plugins whose URL prefix is
 * `/api/projects/:projectId/...`. Encapsulates the policy that:
 *   1. The request must be authenticated.
 *   2. The `:projectId` parameter must resolve to a real project (accepts
 *      either a numeric ID or a UUID; configurable via `acceptNumericId`).
 *   3. The caller must be an admin, or `checkProjectAccess` must grant
 *      access — which already handles public projects, owners and
 *      collaborators consistently with the Yjs WebSocket.
 *
 * Returns the resolved project on success, or a structured error to be
 * mapped into an HTTP response by the caller.
 */
export type ProjectAccessError = AuthorizationError | { status: 404; error: 'NOT_FOUND'; message: string };

export interface ProjectAccessOk {
    project: Project;
}

export interface EnforceProjectAccessOptions {
    db: Kysely<Database>;
    queries?: ProjectAccessQueries;
    /** Default true. Set to false for routes that only ever take UUIDs. */
    acceptNumericId?: boolean;
}

export async function enforceProjectAccess(
    identity: AuthenticatedIdentity | null | undefined,
    projectIdOrUuid: string,
    opts: EnforceProjectAccessOptions,
): Promise<ProjectAccessOk | ProjectAccessError> {
    const authErr = requireAuth(identity);
    if (authErr) return authErr;

    const queries = opts.queries ?? defaultProjectAccessQueries;
    const acceptNumericId = opts.acceptNumericId !== false;
    const isNumeric = /^\d+$/.test(projectIdOrUuid);

    let project: Project | undefined;
    if (isNumeric) {
        project = acceptNumericId ? await queries.findProjectById(opts.db, parseInt(projectIdOrUuid, 10)) : undefined;
    } else {
        project = await queries.findProjectByUuid(opts.db, projectIdOrUuid);
    }
    if (!project) {
        return { status: 404, error: 'NOT_FOUND', message: 'Project not found' };
    }

    if (hasRole(identity!.roles, ROLES.ADMIN)) {
        return { project };
    }
    const access = await queries.checkProjectAccess(opts.db, project, identity!.userId);
    if (!access.hasAccess) {
        return { status: 403, error: 'FORBIDDEN', message: 'Access denied' };
    }
    return { project };
}
