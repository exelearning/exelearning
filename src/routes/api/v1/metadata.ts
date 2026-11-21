/**
 * Metadata REST API Endpoints
 *
 * Operations for project metadata (title, author, description, etc.).
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { withDocument, readDocument, getMetadataData, updateMetadataData } from '../../../yjs';
import { castRequestBody } from '../../types/request-payloads';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    UpdateMetadataBody,
    type UpdateMetadataInput,
    ProjectUuidParam,
    checkProjectAccess,
} from './types';

// ============================================================================
// ROUTES
// ============================================================================

export const metadataRoutes = new Elysia({ prefix: '/projects' })
    // Get project metadata
    .get(
        '/:uuid/metadata',
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

            const metadata = await readDocument(params.uuid, ydoc => getMetadataData(ydoc));

            return successResponse(metadata);
        },
        {
            params: ProjectUuidParam,
            detail: {
                summary: 'Get Metadata',
                description: 'Get project metadata (title, author, description, etc.)',
                tags: ['Metadata'],
            },
        },
    )

    // Update project metadata
    .patch(
        '/:uuid/metadata',
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

            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                updateMetadataData(ydoc, castRequestBody<UpdateMetadataInput>(body)),
            );

            if (result.success === false) {
                set.status = 400;
                return errorResponse('UPDATE_FAILED', result.error || 'Failed to update metadata');
            }

            // Get updated metadata
            const updatedMetadata = await readDocument(params.uuid, ydoc => getMetadataData(ydoc));

            return successResponse(updatedMetadata);
        },
        {
            params: ProjectUuidParam,
            body: UpdateMetadataBody,
            detail: {
                summary: 'Update Metadata',
                description: 'Update project metadata fields',
                tags: ['Metadata'],
            },
        },
    );
