/**
 * Metadata REST API Endpoints
 *
 * Operations for project metadata (title, author, description, etc.).
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { db } from '../../../db/client';
import { findProjectByUuid } from '../../../db/queries';
import { withDocument, readDocument, getMetadataData, updateMetadataData } from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    UpdateMetadataBody,
    ProjectUuidParam,
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

export const metadataRoutes = new Elysia({ prefix: '/projects' })
    // Get project metadata
    .get(
        '/:uuid/metadata',
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
                updateMetadataData(ydoc, body),
            );

            if (!result.success) {
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
