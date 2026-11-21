/**
 * Pages REST API Endpoints
 *
 * CRUD operations for pages (navigation nodes) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { withDocument, readDocument, getPages, getPage, addPage, updatePage, deletePage, movePage } from '../../../yjs';
import { castRequestBody } from '../../types/request-payloads';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    CreatePageBody,
    UpdatePageBody,
    MovePageBody,
    type CreatePageInput,
    type UpdatePageInput,
    type MovePageInput,
    ProjectUuidParam,
    PageIdParam,
    checkProjectAccess,
} from './types';

// ============================================================================
// ROUTES
// ============================================================================

export const pagesRoutes = new Elysia({ prefix: '/projects' })
    // List all pages in a project
    .get(
        '/:uuid/pages',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (authResult.success === false) {
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
            if (authResult.success === false) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const input = castRequestBody<CreatePageInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                addPage(ydoc, {
                    name: input.name,
                    parentId: input.parentId ?? null,
                    order: input.order,
                }),
            );

            if (result.success === false) {
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
            if (authResult.success === false) {
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
            if (authResult.success === false) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const input = castRequestBody<UpdatePageInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                updatePage(ydoc, params.pageId, {
                    name: input.name,
                    properties: input.properties,
                }),
            );

            if (result.success === false) {
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
            if (authResult.success === false) {
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

            if (result.success === false) {
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
            if (authResult.success === false) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const input = castRequestBody<MovePageInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                movePage(ydoc, params.pageId, input.newParentId, input.position),
            );

            if (result.success === false) {
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
