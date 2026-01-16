/**
 * Projects REST API Endpoints
 *
 * CRUD operations for eXeLearning projects.
 */
import { Elysia, t } from 'elysia';
import { db } from '../../../db/client';
import {
    findAllProjectsForUser,
    findProjectByUuid,
    createProject,
    updateProject,
    hardDeleteProject,
} from '../../../db/queries';
import { ensureDocument } from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    CreateProjectBody,
    UpdateProjectBody,
    ProjectUuidParam,
} from './types';

// ============================================================================
// ROUTES
// ============================================================================

export const projectsRoutes = new Elysia({ prefix: '/projects' })
    // List all projects for the authenticated user
    .get(
        '/',
        async ({ headers, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const projects = await findAllProjectsForUser(db, auth.userId);

            return successResponse(
                projects.map(p => ({
                    id: p.id,
                    uuid: p.uuid,
                    title: p.title,
                    owner_id: p.owner_id,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                    saved_once: Boolean(p.saved_once),
                })),
            );
        },
        {
            detail: {
                summary: 'List Projects',
                description: 'Get all projects owned by the authenticated user',
                tags: ['Projects'],
            },
        },
    )

    // Create a new project
    .post(
        '/',
        async ({ headers, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            // Generate UUID for new project
            const uuid = crypto.randomUUID();

            // Create project in database
            const project = await createProject(db, {
                uuid,
                title: body.title,
                owner_id: auth.userId,
            });

            // Initialize Yjs document for the project
            await ensureDocument(uuid);

            set.status = 201;
            return successResponse({
                id: Number(project.insertId),
                uuid,
                title: body.title,
                owner_id: auth.userId,
                created_at: Date.now(),
                updated_at: null,
                saved_once: false,
            });
        },
        {
            body: CreateProjectBody,
            detail: {
                summary: 'Create Project',
                description: 'Create a new eXeLearning project',
                tags: ['Projects'],
            },
        },
    )

    // Get a specific project
    .get(
        '/:uuid',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const project = await findProjectByUuid(db, params.uuid);

            if (!project) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Project not found: ${params.uuid}`);
            }

            // Check ownership (unless admin)
            if (project.owner_id !== auth.userId && !isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'You do not have access to this project');
            }

            return successResponse({
                id: project.id,
                uuid: project.uuid,
                title: project.title,
                owner_id: project.owner_id,
                created_at: project.created_at,
                updated_at: project.updated_at,
                saved_once: Boolean(project.saved_once),
            });
        },
        {
            params: ProjectUuidParam,
            detail: {
                summary: 'Get Project',
                description: 'Get a specific project by UUID',
                tags: ['Projects'],
            },
        },
    )

    // Update a project
    .patch(
        '/:uuid',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const project = await findProjectByUuid(db, params.uuid);

            if (!project) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Project not found: ${params.uuid}`);
            }

            // Check ownership (unless admin)
            if (project.owner_id !== auth.userId && !isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'You do not have access to this project');
            }

            // Update project
            const updates: Record<string, unknown> = {};
            if (body.title !== undefined) updates.title = body.title;

            if (Object.keys(updates).length > 0) {
                await updateProject(db, project.id, updates);
            }

            // Fetch updated project
            const updated = await findProjectByUuid(db, params.uuid);

            return successResponse({
                id: updated!.id,
                uuid: updated!.uuid,
                title: updated!.title,
                owner_id: updated!.owner_id,
                created_at: updated!.created_at,
                updated_at: updated!.updated_at,
                saved_once: Boolean(updated!.saved_once),
            });
        },
        {
            params: ProjectUuidParam,
            body: UpdateProjectBody,
            detail: {
                summary: 'Update Project',
                description: 'Update project properties',
                tags: ['Projects'],
            },
        },
    )

    // Delete a project
    .delete(
        '/:uuid',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const project = await findProjectByUuid(db, params.uuid);

            if (!project) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Project not found: ${params.uuid}`);
            }

            // Check ownership (unless admin)
            if (project.owner_id !== auth.userId && !isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'You do not have access to this project');
            }

            // Delete project and related data
            await hardDeleteProject(db, project.id);

            return successResponse({ deleted: true, uuid: params.uuid });
        },
        {
            params: ProjectUuidParam,
            detail: {
                summary: 'Delete Project',
                description: 'Delete a project and all its content',
                tags: ['Projects'],
            },
        },
    )

    // Duplicate a project
    .post(
        '/:uuid/duplicate',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const sourceProject = await findProjectByUuid(db, params.uuid);

            if (!sourceProject) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `Project not found: ${params.uuid}`);
            }

            // Check ownership (unless admin)
            if (sourceProject.owner_id !== auth.userId && !isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'You do not have access to this project');
            }

            // Generate new UUID
            const newUuid = crypto.randomUUID();
            const newTitle = body?.title || `${sourceProject.title} (copy)`;

            // Create new project
            const newProject = await createProject(db, {
                uuid: newUuid,
                title: newTitle,
                owner_id: auth.userId,
            });

            // TODO: Copy Yjs document state from source to new project
            // For now, just create empty document
            await ensureDocument(newUuid);

            set.status = 201;
            return successResponse({
                id: Number(newProject.insertId),
                uuid: newUuid,
                title: newTitle,
                owner_id: auth.userId,
                created_at: Date.now(),
                updated_at: null,
                saved_once: false,
                sourceUuid: params.uuid,
            });
        },
        {
            params: ProjectUuidParam,
            body: t.Optional(
                t.Object({
                    title: t.Optional(t.String()),
                }),
            ),
            detail: {
                summary: 'Duplicate Project',
                description: 'Create a copy of an existing project',
                tags: ['Projects'],
            },
        },
    );
