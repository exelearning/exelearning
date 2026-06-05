/**
 * Pages REST API Endpoints
 *
 * CRUD operations for pages (navigation nodes) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { db } from '../../../db/client';
import { findProjectByUuid } from '../../../db/queries';
import { withDocument, readDocument, getPages, getPage, addPage, updatePage, deletePage, movePage } from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    CreatePageBody,
    UpdatePageBody,
    MovePageBody,
    ProjectUuidParam,
    PageIdParam,
    type AuthenticatedUser,
    type ApiErrorResponse,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

async function checkProjectAccess(
    uuid: string,
    auth: AuthenticatedUser,
): Promise<{ project: Awaited<ReturnType<typeof findProjectByUuid>>; error?: ApiErrorResponse }> {
    const project = await findProjectByUuid(db, uuid);

    if (!project) {
        return { project: null, error: errorResponse('NOT_FOUND', `Project not found: ${uuid}`) };
    }

    if (project.owner_id !== auth.userId && !isAdmin(auth)) {
        return { project: null, error: errorResponse('FORBIDDEN', 'You do not have access to this project') };
    }

    return { project };
}

// ============================================================================
// ROUTES
// ============================================================================

export const pagesRoutes = new Elysia({ prefix: '/projects' })
    // List all pages in a project
    .get(
        '/:uuid/pages',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const pages = await readDocument(params.uuid, ydoc => getPages(ydoc));

            return successResponse(pages);
        },
        {
            params: ProjectUuidParam,
            detail: {
                summary: 'List Pages',
                description: 'Get all pages in a project',
                tags: ['Pages'],
            },
        },
    )

    // Create a new page
    .post(
        '/:uuid/pages',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                addPage(ydoc, {
                    name: body.name,
                    parentId: body.parentId ?? null,
                    order: body.order,
                }),
            );

            if (!result.success) {
                set.status = 400;
                return errorResponse('CREATE_FAILED', result.error || 'Failed to create page');
            }

            set.status = 201;
            return successResponse(result.data);
        },
        {
            params: ProjectUuidParam,
            body: CreatePageBody,
            detail: {
                summary: 'Create Page',
                description: 'Create a new page in the project',
                tags: ['Pages'],
            },
        },
    )

    // Get a specific page
    .get(
        '/:uuid/pages/:pageId',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const page = await readDocument(params.uuid, ydoc => getPage(ydoc, params.pageId));

            if (!page) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Page not found: ${params.pageId}`);
            }

            return successResponse(page);
        },
        {
            params: PageIdParam,
            detail: {
                summary: 'Get Page',
                description: 'Get a specific page by ID',
                tags: ['Pages'],
            },
        },
    )

    // Update a page
    .patch(
        '/:uuid/pages/:pageId',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                updatePage(ydoc, {
                    pageId: params.pageId,
                    name: body.name,
                    properties: body.properties,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('UPDATE_FAILED', result.error || 'Failed to update page');
            }

            return successResponse(result.data);
        },
        {
            params: PageIdParam,
            body: UpdatePageBody,
            detail: {
                summary: 'Update Page',
                description: 'Update page name or properties',
                tags: ['Pages'],
            },
        },
    )

    // Delete a page
    .delete(
        '/:uuid/pages/:pageId',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                deletePage(ydoc, params.pageId),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('DELETE_FAILED', result.error || 'Failed to delete page');
            }

            return successResponse({ deleted: true, pageId: params.pageId });
        },
        {
            params: PageIdParam,
            detail: {
                summary: 'Delete Page',
                description: 'Delete a page and all its blocks',
                tags: ['Pages'],
            },
        },
    )

    // Move a page
    .post(
        '/:uuid/pages/:pageId/move',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                movePage(ydoc, {
                    pageId: params.pageId,
                    newParentId: body.newParentId,
                    position: body.position,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('MOVE_FAILED', result.error || 'Failed to move page');
            }

            return successResponse(result.data);
        },
        {
            params: PageIdParam,
            body: MovePageBody,
            detail: {
                summary: 'Move Page',
                description: 'Move a page to a different parent or position',
                tags: ['Pages'],
            },
        },
    );
