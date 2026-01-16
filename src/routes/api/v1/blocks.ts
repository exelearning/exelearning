/**
 * Blocks REST API Endpoints
 *
 * CRUD operations for blocks (iDevice containers) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { db } from '../../../db/client';
import { findProjectByUuid } from '../../../db/queries';
import {
    withDocument,
    readDocument,
    getBlocks,
    getBlock,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
} from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    CreateBlockBody,
    UpdateBlockBody,
    MoveBlockBody,
    PageIdParam,
    BlockIdParam,
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

export const blocksRoutes = new Elysia({ prefix: '/projects' })
    // List all blocks in a page
    .get(
        '/:uuid/pages/:pageId/blocks',
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

            const blocks = await readDocument(params.uuid, ydoc => getBlocks(ydoc, params.pageId));

            return successResponse(blocks);
        },
        {
            params: PageIdParam,
            detail: {
                summary: 'List Blocks',
                description: 'Get all blocks in a page',
                tags: ['Blocks'],
            },
        },
    )

    // Create a new block in a page
    .post(
        '/:uuid/pages/:pageId/blocks',
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
                createBlock(ydoc, {
                    pageId: params.pageId,
                    name: body.name,
                    order: body.order,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('CREATE_FAILED', result.error || 'Failed to create block');
            }

            set.status = 201;
            return successResponse(result.data);
        },
        {
            params: PageIdParam,
            body: CreateBlockBody,
            detail: {
                summary: 'Create Block',
                description: 'Create a new block in a page',
                tags: ['Blocks'],
            },
        },
    )

    // Get a specific block
    .get(
        '/:uuid/blocks/:blockId',
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

            const block = await readDocument(params.uuid, ydoc => getBlock(ydoc, params.blockId));

            if (!block) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Block not found: ${params.blockId}`);
            }

            return successResponse(block);
        },
        {
            params: BlockIdParam,
            detail: {
                summary: 'Get Block',
                description: 'Get a specific block by ID',
                tags: ['Blocks'],
            },
        },
    )

    // Update a block
    .patch(
        '/:uuid/blocks/:blockId',
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
                updateBlock(ydoc, {
                    blockId: params.blockId,
                    name: body.name,
                    iconName: body.iconName,
                    properties: body.properties,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('UPDATE_FAILED', result.error || 'Failed to update block');
            }

            return successResponse(result.data);
        },
        {
            params: BlockIdParam,
            body: UpdateBlockBody,
            detail: {
                summary: 'Update Block',
                description: 'Update block name, icon, or properties',
                tags: ['Blocks'],
            },
        },
    )

    // Delete a block
    .delete(
        '/:uuid/blocks/:blockId',
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
                deleteBlock(ydoc, params.blockId),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('DELETE_FAILED', result.error || 'Failed to delete block');
            }

            return successResponse({ deleted: true, blockId: params.blockId });
        },
        {
            params: BlockIdParam,
            detail: {
                summary: 'Delete Block',
                description: 'Delete a block and all its components',
                tags: ['Blocks'],
            },
        },
    )

    // Move a block
    .post(
        '/:uuid/blocks/:blockId/move',
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
                moveBlock(ydoc, {
                    blockId: params.blockId,
                    targetPageId: body.targetPageId,
                    position: body.position,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('MOVE_FAILED', result.error || 'Failed to move block');
            }

            return successResponse(result.data);
        },
        {
            params: BlockIdParam,
            body: MoveBlockBody,
            detail: {
                summary: 'Move Block',
                description: 'Move a block to a different page or position',
                tags: ['Blocks'],
            },
        },
    );
