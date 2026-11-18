/**
 * Components (iDevices) REST API Endpoints
 *
 * CRUD operations for components (iDevices) in a project.
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia } from 'elysia';
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
import { castRequestBody } from '../../types/request-payloads';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    CreateComponentBody,
    UpdateComponentBody,
    SetHtmlBody,
    type CreateComponentInput,
    type UpdateComponentInput,
    type SetHtmlInput,
    BlockIdParam,
    ComponentIdParam,
    checkProjectAccess,
} from './types';

// ============================================================================
// ROUTES
// ============================================================================

export const componentsRoutes = new Elysia({ prefix: '/projects' })
    // List all components in a block
    .get(
        '/:uuid/blocks/:blockId/components',
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

            const input = castRequestBody<CreateComponentInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                createComponent(ydoc, {
                    blockId: params.blockId,
                    ideviceType: input.ideviceType,
                    initialData: input.initialData,
                    order: input.order,
                }),
            );

            if (result.success === false) {
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

            const input = castRequestBody<UpdateComponentInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                updateComponent(ydoc, params.componentId, {
                    htmlContent: input.htmlContent,
                    htmlView: input.htmlView,
                    properties: input.properties,
                    jsonProperties: input.jsonProperties,
                    title: input.title,
                    subtitle: input.subtitle,
                    instructions: input.instructions,
                    feedback: input.feedback,
                }),
            );

            if (result.success === false) {
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

            const input = castRequestBody<SetHtmlInput>(body);
            const { result } = await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                setComponentHtml(ydoc, params.componentId, input.html),
            );

            if (result.success === false) {
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
                deleteComponent(ydoc, params.componentId),
            );

            if (result.success === false) {
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
