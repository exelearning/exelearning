/**
 * Blocks REST API Endpoints
 *
 * CRUD operations for blocks (iDevice containers) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
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
import { castRequestBody } from '../../types/request-payloads';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    CreateBlockBody,
    UpdateBlockBody,
    MoveBlockBody,
    type CreateBlockInput,
    type UpdateBlockInput,
    type MoveBlockInput,
    PageIdParam,
    BlockIdParam,
    checkProjectAccess,
} from './types';

// ============================================================================
// ROUTES
// ============================================================================

export const blocksRoutes = new Elysia({ prefix: '/projects' })
    // List all blocks in a page
    .get(
        '/:uuid/pages/:pageId/blocks',
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

            const input = castRequestBody<CreateBlockInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                createBlock(ydoc, {
                    pageId: params.pageId,
                    name: input.name,
                    order: input.order,
                }),
            );

            if (result.success === false) {
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

            const input = castRequestBody<UpdateBlockInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                updateBlock(ydoc, params.blockId, {
                    name: input.name,
                    iconName: input.iconName,
                    icon: input.icon,
                    properties: input.properties,
                }),
            );

            if (result.success === false) {
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
                deleteBlock(ydoc, params.blockId),
            );

            if (result.success === false) {
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

            const input = castRequestBody<MoveBlockInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                moveBlock(ydoc, params.blockId, input.targetPageId, input.position),
            );

            if (result.success === false) {
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
