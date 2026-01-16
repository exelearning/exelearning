/**
 * Components (iDevices) REST API Endpoints
 *
 * CRUD operations for components (iDevices) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
import { db } from '../../../db/client';
import { findProjectByUuid } from '../../../db/queries';
import {
    withDocument,
    readDocument,
    getComponents,
    getComponent,
    createComponent,
    updateComponent,
    setComponentHtml,
    deleteComponent,
} from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    CreateComponentBody,
    UpdateComponentBody,
    SetHtmlBody,
    BlockIdParam,
    ComponentIdParam,
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

export const componentsRoutes = new Elysia({ prefix: '/projects' })
    // List all components in a block
    .get(
        '/:uuid/blocks/:blockId/components',
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

            const components = await readDocument(params.uuid, ydoc => getComponents(ydoc, params.blockId));

            return successResponse(components);
        },
        {
            params: BlockIdParam,
            detail: {
                summary: 'List Components',
                description: 'Get all components (iDevices) in a block',
                tags: ['Components'],
            },
        },
    )

    // Create a new component in a block
    .post(
        '/:uuid/blocks/:blockId/components',
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
                createComponent(ydoc, {
                    blockId: params.blockId,
                    ideviceType: body.ideviceType,
                    initialData: body.initialData,
                    order: body.order,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('CREATE_FAILED', result.error || 'Failed to create component');
            }

            set.status = 201;
            return successResponse(result.data);
        },
        {
            params: BlockIdParam,
            body: CreateComponentBody,
            detail: {
                summary: 'Create Component',
                description: 'Create a new component (iDevice) in a block',
                tags: ['Components'],
            },
        },
    )

    // Get a specific component
    .get(
        '/:uuid/components/:componentId',
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

            const component = await readDocument(params.uuid, ydoc => getComponent(ydoc, params.componentId));

            if (!component) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Component not found: ${params.componentId}`);
            }

            return successResponse(component);
        },
        {
            params: ComponentIdParam,
            detail: {
                summary: 'Get Component',
                description: 'Get a specific component by ID',
                tags: ['Components'],
            },
        },
    )

    // Update a component
    .put(
        '/:uuid/components/:componentId',
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
                updateComponent(ydoc, {
                    componentId: params.componentId,
                    htmlContent: body.htmlContent,
                    htmlView: body.htmlView,
                    properties: body.properties,
                    jsonProperties: body.jsonProperties,
                    title: body.title,
                    subtitle: body.subtitle,
                    instructions: body.instructions,
                    feedback: body.feedback,
                }),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('UPDATE_FAILED', result.error || 'Failed to update component');
            }

            return successResponse(result.data);
        },
        {
            params: ComponentIdParam,
            body: UpdateComponentBody,
            detail: {
                summary: 'Update Component',
                description: 'Update component content and properties',
                tags: ['Components'],
            },
        },
    )

    // Update only HTML content
    .put(
        '/:uuid/components/:componentId/html',
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
                setComponentHtml(ydoc, params.componentId, body.html),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('UPDATE_FAILED', result.error || 'Failed to update HTML');
            }

            return successResponse({ updated: true, componentId: params.componentId });
        },
        {
            params: ComponentIdParam,
            body: SetHtmlBody,
            detail: {
                summary: 'Set Component HTML',
                description: 'Update only the HTML content of a component',
                tags: ['Components'],
            },
        },
    )

    // Delete a component
    .delete(
        '/:uuid/components/:componentId',
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
                deleteComponent(ydoc, params.componentId),
            );

            if (!result.success) {
                set.status = result.error?.includes('not found') ? 404 : 400;
                return errorResponse('DELETE_FAILED', result.error || 'Failed to delete component');
            }

            return successResponse({ deleted: true, componentId: params.componentId });
        },
        {
            params: ComponentIdParam,
            detail: {
                summary: 'Delete Component',
                description: 'Delete a component (iDevice)',
                tags: ['Components'],
            },
        },
    );
