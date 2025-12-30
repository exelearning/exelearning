/**
 * Project Routes for Elysia
 * Handles project CRUD, file uploads, and session management
 *
 * Uses Dependency Injection pattern for testability
 */
import { Elysia } from 'elysia';
import * as fsDefault from 'fs-extra';
import * as pathDefault from 'path';

import {
    createSession as createSessionDefault,
    getSession as getSessionDefault,
    updateSession as updateSessionDefault,
    deleteSession as deleteSessionDefault,
    getAllSessions as getAllSessionsDefault,
    generateSessionId as generateSessionIdDefault,
} from '../services/session-manager';

import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    getContentXmlPath as getContentXmlPathDefault,
    fileExists as fileExistsDefault,
    readFileAsString as readFileAsStringDefault,
    appendFile as appendFileDefault,
    getFilesDir as getFilesDirDefault,
    getProjectAssetsDir as getProjectAssetsDirDefault,
} from '../services/file-helper';

// yjs-persistence functions no longer used here - endpoints moved to routes/yjs.ts

import * as queriesDefault from '../db/queries';
import { db as dbDefault } from '../db/client';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { createGravatarUrl as createGravatarUrlDefault } from '../utils/gravatar.util';
import {
    extractLinksFromIdevices,
    validateLinksStream,
    type ExtractedLink,
    type IdeviceContent,
} from '../services/link-validator';
import { getSettingString } from '../services/app-settings';
import { findThemeByDirName, getDefaultTheme as getDefaultThemeDefault } from '../db/queries/themes';
import { getAppVersion } from '../utils/version';
import {
    notifyVisibilityChanged as notifyVisibilityChangedDefault,
    notifyCollaboratorRemoved as notifyCollaboratorRemovedDefault,
} from '../websocket/access-notifier';
import { createBlankYjsDocument } from '../services/yjs-initializer';
import type { Kysely } from 'kysely';
import type { Database, Project, User } from '../db/types';
import type {
    ProjectUploadChunkRequest,
    ProjectPropertiesRequest,
    UsedFilesRequest,
    OdeCurrentUserRequest,
    CheckBeforeLeaveRequest,
    CloseSessionRequest,
    NavStructureDuplicateRequest,
    StructureSaveRequest,
    ProjectMetadataRequest,
} from './types/request-payloads';

// ============================================================================
// Types and Interfaces for Dependency Injection
// ============================================================================

/**
 * Session manager functions
 */
export interface SessionManagerDeps {
    createSession: typeof createSessionDefault;
    getSession: typeof getSessionDefault;
    updateSession: typeof updateSessionDefault;
    deleteSession: typeof deleteSessionDefault;
    getAllSessions: typeof getAllSessionsDefault;
    generateSessionId: typeof generateSessionIdDefault;
}

/**
 * File helper functions
 */
export interface FileHelperDeps {
    getOdeSessionTempDir: typeof getOdeSessionTempDirDefault;
    getContentXmlPath: typeof getContentXmlPathDefault;
    fileExists: typeof fileExistsDefault;
    readFileAsString: typeof readFileAsStringDefault;
    appendFile: typeof appendFileDefault;
    getFilesDir: typeof getFilesDirDefault;
    getProjectAssetsDir: typeof getProjectAssetsDirDefault;
}

/**
 * Database query functions
 */
export interface QueriesDeps {
    createProject: typeof queriesDefault.createProject;
    findProjectById: typeof queriesDefault.findProjectById;
    findProjectByUuid: typeof queriesDefault.findProjectByUuid;
    markProjectAsSaved: typeof queriesDefault.markProjectAsSaved;
    findSavedProjectsByOwner: typeof queriesDefault.findSavedProjectsByOwner;
    findProjectsAsCollaborator: typeof queriesDefault.findProjectsAsCollaborator;
    updateProjectVisibility: typeof queriesDefault.updateProjectVisibility;
    updateProjectVisibilityByUuid: typeof queriesDefault.updateProjectVisibilityByUuid;
    getProjectCollaborators: typeof queriesDefault.getProjectCollaborators;
    addCollaborator: typeof queriesDefault.addCollaborator;
    removeCollaborator: typeof queriesDefault.removeCollaborator;
    isCollaborator: typeof queriesDefault.isCollaborator;
    transferOwnership: typeof queriesDefault.transferOwnership;
    transferOwnershipByUuid: typeof queriesDefault.transferOwnershipByUuid;
    createProjectWithUuid: typeof queriesDefault.createProjectWithUuid;
    hardDeleteProject: typeof queriesDefault.hardDeleteProject;
    findUserById: typeof queriesDefault.findUserById;
    findUserByEmail: typeof queriesDefault.findUserByEmail;
    findFirstUser: typeof queriesDefault.findFirstUser;
    createUser: typeof queriesDefault.createUser;
    checkProjectAccess: typeof queriesDefault.checkProjectAccess;
    findSnapshotByProjectId?: typeof queriesDefault.findSnapshotByProjectId;
    upsertSnapshot?: typeof queriesDefault.upsertSnapshot;
    findAllAssetsForProject: typeof queriesDefault.findAllAssetsForProject;
    createAsset: typeof queriesDefault.createAsset;
}

/**
 * Utils dependencies
 */
export interface UtilsDeps {
    createGravatarUrl: typeof createGravatarUrlDefault;
}

/**
 * Access notifier dependencies (WebSocket notifications)
 */
export interface AccessNotifierDeps {
    notifyVisibilityChanged: typeof notifyVisibilityChangedDefault;
    notifyCollaboratorRemoved: typeof notifyCollaboratorRemovedDefault;
}

/**
 * All dependencies for project routes
 */
export interface ProjectDependencies {
    db: Kysely<Database>;
    fs?: typeof fsDefault;
    path?: typeof pathDefault;
    sessionManager?: SessionManagerDeps;
    fileHelper?: FileHelperDeps;
    queries?: QueriesDeps;
    utils?: UtilsDeps;
    accessNotifier?: AccessNotifierDeps;
}

// Default dependencies
const defaultSessionManager: SessionManagerDeps = {
    createSession: createSessionDefault,
    getSession: getSessionDefault,
    updateSession: updateSessionDefault,
    deleteSession: deleteSessionDefault,
    getAllSessions: getAllSessionsDefault,
    generateSessionId: generateSessionIdDefault,
};

const defaultFileHelper: FileHelperDeps = {
    getOdeSessionTempDir: getOdeSessionTempDirDefault,
    getContentXmlPath: getContentXmlPathDefault,
    fileExists: fileExistsDefault,
    readFileAsString: readFileAsStringDefault,
    appendFile: appendFileDefault,
    getFilesDir: getFilesDirDefault,
    getProjectAssetsDir: getProjectAssetsDirDefault,
};

const defaultQueries: QueriesDeps = {
    createProject: queriesDefault.createProject,
    findProjectById: queriesDefault.findProjectById,
    findProjectByUuid: queriesDefault.findProjectByUuid,
    markProjectAsSaved: queriesDefault.markProjectAsSaved,
    findSavedProjectsByOwner: queriesDefault.findSavedProjectsByOwner,
    findProjectsAsCollaborator: queriesDefault.findProjectsAsCollaborator,
    updateProjectVisibility: queriesDefault.updateProjectVisibility,
    updateProjectVisibilityByUuid: queriesDefault.updateProjectVisibilityByUuid,
    getProjectCollaborators: queriesDefault.getProjectCollaborators,
    addCollaborator: queriesDefault.addCollaborator,
    removeCollaborator: queriesDefault.removeCollaborator,
    isCollaborator: queriesDefault.isCollaborator,
    transferOwnership: queriesDefault.transferOwnership,
    transferOwnershipByUuid: queriesDefault.transferOwnershipByUuid,
    createProjectWithUuid: queriesDefault.createProjectWithUuid,
    hardDeleteProject: queriesDefault.hardDeleteProject,
    findUserById: queriesDefault.findUserById,
    findUserByEmail: queriesDefault.findUserByEmail,
    findFirstUser: queriesDefault.findFirstUser,
    createUser: queriesDefault.createUser,
    checkProjectAccess: queriesDefault.checkProjectAccess,
    findSnapshotByProjectId: queriesDefault.findSnapshotByProjectId,
    upsertSnapshot: queriesDefault.upsertSnapshot,
    findAllAssetsForProject: queriesDefault.findAllAssetsForProject,
    createAsset: queriesDefault.createAsset,
};

const defaultUtils: UtilsDeps = {
    createGravatarUrl: createGravatarUrlDefault,
};

const defaultAccessNotifier: AccessNotifierDeps = {
    notifyVisibilityChanged: notifyVisibilityChangedDefault,
    notifyCollaboratorRemoved: notifyCollaboratorRemovedDefault,
};

const defaultDependencies: ProjectDependencies = {
    db: dbDefault,
    fs: fsDefault,
    path: pathDefault,
    sessionManager: defaultSessionManager,
    fileHelper: defaultFileHelper,
    queries: defaultQueries,
    utils: defaultUtils,
    accessNotifier: defaultAccessNotifier,
};

// Get default project visibility from environment
async function getDefaultProjectVisibility(db: Kysely<Database>): Promise<'public' | 'private'> {
    const visibility = await getSettingString(
        db,
        'DEFAULT_PROJECT_VISIBILITY',
        process.env.DEFAULT_PROJECT_VISIBILITY || 'private',
    );
    return visibility === 'public' ? 'public' : 'private';
}

/**
 * Serialize project sharing information for API response
 * Includes owner with role='owner' and collaborators with role='editor'
 */
function serializeProjectSharing(
    project: Project,
    owner: User | null | undefined,
    collaborators: User[],
    currentUserId: number | undefined,
    createGravatarUrl: (
        email: string | null | undefined,
        initials?: string | null,
        displayName?: string | null,
    ) => string = createGravatarUrlDefault,
) {
    const collabsList: Array<{ user: { id: number; email: string; gravatarUrl: string }; role: string }> = [];

    // Owner FIRST with role='owner'
    if (owner) {
        collabsList.push({
            user: {
                id: owner.id,
                email: owner.email,
                gravatarUrl: createGravatarUrl(owner.email),
            },
            role: 'owner',
        });
    }

    // Other collaborators with role='editor'
    for (const c of collaborators) {
        collabsList.push({
            user: {
                id: c.id,
                email: c.email,
                gravatarUrl: createGravatarUrl(c.email),
            },
            role: 'editor',
        });
    }

    return {
        id: project.id,
        uuid: project.uuid,
        title: project.title,
        visibility: project.visibility || 'private',
        owner: owner ? { id: owner.id, email: owner.email } : null,
        collaborators: collabsList,
        isOwner: currentUserId ? project.owner_id === currentUserId : false,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
    };
}

// Get JWT secret
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create project routes with injected dependencies
 */
export function createProjectRoutes(deps: ProjectDependencies = defaultDependencies) {
    // Shadow global imports with local variables from deps
    // This allows route handlers to use these without code changes
    const fs = deps.fs ?? fsDefault;
    const path = deps.path ?? pathDefault;
    const db = deps.db; // Shadow global db

    // Session manager functions
    const { createSession, getSession, deleteSession, getAllSessions } = deps.sessionManager ?? defaultSessionManager;

    // File helper functions
    const { getOdeSessionTempDir, getContentXmlPath, fileExists, readFileAsString, appendFile, getFilesDir } =
        deps.fileHelper ?? defaultFileHelper;

    // Query functions
    const { createProject, findSavedProjectsByOwner, findUserById, upsertSnapshot } = deps.queries ?? defaultQueries;

    return (
        new Elysia({ prefix: '/api/project' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive auth context from request
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;

                // Get token from Authorization header
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { currentUser: null };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null };
                    }
                    const user = await findUserById(db, payload.sub);
                    return { currentUser: user || null };
                } catch {
                    return { currentUser: null };
                }
            })

            // =====================================================
            // Session Management
            // =====================================================

            // GET /api/project/sessions - List all sessions
            .get('/sessions', () => {
                const sessions = getAllSessions();
                return {
                    count: sessions.length,
                    sessions: sessions.map(s => ({
                        sessionId: s.sessionId,
                        fileName: s.fileName,
                        createdAt: s.createdAt,
                        updatedAt: s.updatedAt,
                    })),
                };
            })

            // GET /api/project/sessions/:id - Get session details
            .get('/sessions/:id', ({ params, set }) => {
                const session = getSession(params.id);
                if (!session) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }

                return {
                    sessionId: session.sessionId,
                    fileName: session.fileName,
                    filePath: session.filePath,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    hasStructure: !!session.structure,
                };
            })

            // DELETE /api/project/sessions/:id - Delete a session
            .delete('/sessions/:id', async ({ params, set }) => {
                const session = getSession(params.id);
                if (!session) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }

                // Remove from memory (no temp directories to clean - Yjs is source of truth)
                deleteSession(params.id);

                return { message: 'Session deleted successfully' };
            })

            // =====================================================
            // File Upload (Chunked)
            // =====================================================

            // POST /api/project/upload-chunk - Upload a file chunk
            .post('/upload-chunk', async ({ body, set }) => {
                try {
                    const { odeFilePart, odeFileName, odeSessionId } = body as ProjectUploadChunkRequest;

                    if (!odeFilePart || !odeFileName || !odeSessionId) {
                        set.status = 400;
                        return {
                            responseMessage: 'error: odeFilePart, odeFileName, and odeSessionId are required',
                            success: false,
                        };
                    }

                    // Get or create session temp directory
                    const tempDir = getOdeSessionTempDir(odeSessionId);
                    await fs.ensureDir(tempDir);

                    // Build target file path
                    const targetPath = path.join(tempDir, odeFileName);

                    // Get the chunk data
                    let chunkBuffer: Buffer;
                    if (odeFilePart instanceof Blob) {
                        chunkBuffer = Buffer.from(await odeFilePart.arrayBuffer());
                    } else if (Buffer.isBuffer(odeFilePart)) {
                        chunkBuffer = odeFilePart;
                    } else {
                        chunkBuffer = Buffer.from(odeFilePart);
                    }

                    // Append chunk to file
                    await appendFile(targetPath, chunkBuffer);

                    return {
                        responseMessage: 'OK',
                        odeFilePath: targetPath,
                        odeFileName: odeFileName,
                    };
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return {
                        responseMessage: `error: ${errorMessage}`,
                        success: false,
                    };
                }
            })

            // NOTE: ELP extraction happens client-side (browser uses JSZip).
            // Server-side /api/project/open endpoint was removed as dead code.
            // Projects are created via create-quick and populated from client-side Yjs.

            // =====================================================
            // Get Session Structure
            // =====================================================

            // GET /api/project/version/:versionId/session/:sessionId/structure
            .get('/version/:versionId/session/:sessionId/structure', async ({ params, set }) => {
                const session = getSession(params.sessionId);
                if (!session) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Session not found' };
                }

                // Read content.xml if not parsed yet
                const contentXmlPath = getContentXmlPath(params.sessionId);
                if (await fileExists(contentXmlPath)) {
                    const content = await readFileAsString(contentXmlPath);

                    // Return raw content for now
                    // Full XML parsing will be added in next phase
                    return {
                        sessionId: params.sessionId,
                        versionId: params.versionId,
                        hasContent: true,
                        contentLength: content.length,
                    };
                }

                return {
                    sessionId: params.sessionId,
                    versionId: params.versionId,
                    hasContent: false,
                };
            })

            // NOTE: Export is handled by routes/export.ts (ElpDocumentAdapter, Yjs-based).
            // Old session-based /api/project/export endpoint was removed.

            // =====================================================
            // Create Quick Project
            // =====================================================

            // POST /api/project/create-quick - Create a new empty project
            .post('/create-quick', async ({ body, set, currentUser }) => {
                // Require authentication
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required to create projects' };
                }

                const data = body as ProjectPropertiesRequest;
                const title = data.title || 'New Project';

                // Create project in database with authenticated user as owner
                const userId = currentUser.id;

                const projectRecord = await createProject(db, {
                    title,
                    owner_id: userId,
                    saved_once: 0,
                });

                // Get global default theme early so we can use it for Yjs document initialization
                let themeDirName = 'base';
                try {
                    const globalDefault = await getDefaultThemeDefault(db);
                    themeDirName = globalDefault.dirName;
                } catch {
                    // Silently ignore if tables don't exist yet
                }

                // Create initial Yjs document with blank structure (prevents duplicate page race condition)
                if (upsertSnapshot) {
                    const initialYjsData = createBlankYjsDocument({
                        title,
                        language: 'en', // Default language, client can update later
                        theme: themeDirName,
                    });
                    await upsertSnapshot(db, projectRecord.id, initialYjsData, '1.0');
                    console.log(`[Project] Created initial Yjs document for project ${projectRecord.uuid}`);
                }

                // Use project UUID as session ID
                const sessionId = projectRecord.uuid;

                // Create session (no temp directory - Yjs is the source of truth)
                const session = createSession({
                    sessionId,
                    fileName: `${title}.elp`,
                    filePath: '', // No temp directory needed - client-side Yjs is source of truth
                    structure: { title, pages: 1 },
                    userId,
                });

                console.log(`[Project] Created new project ${projectRecord.uuid} with title "${title}"`);

                // Get global default theme (can be base or site)
                let defaultTheme: { dirName: string; displayName: string; url: string; type: 'base' | 'site' } | null =
                    null;
                try {
                    const globalDefault = await getDefaultThemeDefault(db);
                    const version = getAppVersion();

                    if (globalDefault.type === 'site') {
                        // Get site theme details
                        const siteTheme = await findThemeByDirName(db, globalDefault.dirName);
                        if (siteTheme?.is_enabled) {
                            defaultTheme = {
                                dirName: siteTheme.dir_name,
                                displayName: siteTheme.display_name,
                                url: `/${version}/site-files/themes/${siteTheme.dir_name}`,
                                type: 'site',
                            };
                        }
                    } else {
                        // Base theme - use base path
                        defaultTheme = {
                            dirName: globalDefault.dirName,
                            displayName: globalDefault.dirName, // Will be resolved by frontend
                            url: `/files/perm/themes/base/${globalDefault.dirName}`,
                            type: 'base',
                        };
                    }
                } catch {
                    // Silently ignore if tables don't exist yet - defaults to 'base' theme on frontend
                }

                return {
                    success: true,
                    uuid: session.sessionId,
                    sessionId: session.sessionId,
                    projectId: projectRecord.id,
                    projectUuid: projectRecord.uuid,
                    title,
                    defaultTheme, // Include default theme for new projects
                    message: 'Project created successfully',
                };
            })

            // =====================================================
            // Get User's ODE List (Symfony compatibility)
            // =====================================================

            // GET /api/project/get/user/ode/list - Get user's project list
            .get('/get/user/ode/list', async ({ currentUser }) => {
                // If not authenticated, return empty list
                if (!currentUser) {
                    return { odes: [] };
                }

                const userId = currentUser.id;

                // Query projects from database that have been saved at least once
                const userProjects = await findSavedProjectsByOwner(db, userId);

                return {
                    odes: userProjects.map(p => ({
                        odeSessionId: p.uuid,
                        odeName: p.title || 'Sin título',
                        odeCreatedAt: p.created_at,
                        odeUpdatedAt: p.updated_at,
                    })),
                };
            })

            // DELETE /api/project/cleanup-import - Cleanup temp import file after ElpxImporter is done
            .delete('/cleanup-import', async ({ query }) => {
                const importPath = query.path as string;

                if (!importPath) {
                    return { success: false, message: 'No path provided' };
                }

                try {
                    // Security: Only allow deletion within FILES_DIR/tmp
                    const filesDir = getFilesDir();
                    const cleanPath = importPath.replace(/^\/files\//, '');
                    const fullPath = path.join(filesDir, cleanPath);

                    // Verify the path is within the allowed directory
                    const resolvedPath = path.resolve(fullPath);
                    const allowedBase = path.resolve(path.join(filesDir, 'tmp'));

                    if (!resolvedPath.startsWith(allowedBase)) {
                        console.warn(`[Project] Cleanup blocked: path outside allowed directory: ${resolvedPath}`);
                        return { success: false, message: 'Invalid path' };
                    }

                    // Only delete .elp/.elpx files
                    if (!resolvedPath.endsWith('.elp') && !resolvedPath.endsWith('.elpx')) {
                        console.warn(`[Project] Cleanup blocked: not an ELP file: ${resolvedPath}`);
                        return { success: false, message: 'Invalid file type' };
                    }

                    if (await fileExists(fullPath)) {
                        await fs.remove(fullPath);
                        console.log(`[Project] Cleaned up import file: ${fullPath}`);
                    }

                    return { success: true, message: 'File cleaned up' };
                } catch (error: unknown) {
                    console.warn(`[Project] Cleanup error:`, error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, message: errorMessage };
                }
            })
    );
}

/**
 * Create Symfony-compatible routes with injected dependencies
 */
export function createSymfonyCompatProjectRoutes(deps: ProjectDependencies = defaultDependencies) {
    // Shadow global imports with local variables from deps
    const fs = deps.fs ?? fsDefault;
    const path = deps.path ?? pathDefault;
    const db = deps.db;

    // Session manager functions
    const { getSession, updateSession, generateSessionId } = deps.sessionManager ?? defaultSessionManager;

    // File helper functions
    const { getOdeSessionTempDir, getFilesDir, getProjectAssetsDir } = deps.fileHelper ?? defaultFileHelper;

    // Query functions
    const {
        findProjectById,
        findProjectByUuid,
        markProjectAsSaved,
        findSavedProjectsByOwner,
        findProjectsAsCollaborator,
        updateProjectVisibility,
        updateProjectVisibilityByUuid,
        getProjectCollaborators,
        addCollaborator,
        removeCollaborator,
        isCollaborator,
        transferOwnership,
        transferOwnershipByUuid,
        createProjectWithUuid,
        hardDeleteProject,
        findUserById,
        findUserByEmail,
        checkProjectAccess,
        findSnapshotByProjectId,
        upsertSnapshot,
        findAllAssetsForProject,
        createAsset,
    } = deps.queries ?? defaultQueries;

    // Access notifier functions (WebSocket notifications for access revocation)
    const { notifyVisibilityChanged, notifyCollaboratorRemoved } = deps.accessNotifier ?? defaultAccessNotifier;

    return (
        new Elysia()
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive auth context from request
            .derive(async ({ jwt, cookie, request }) => {
                let token: string | undefined;

                // Get token from Authorization header
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { currentUser: null };
                }

                try {
                    const payload = (await jwt.verify(token)) as { sub: number } | false;
                    if (!payload || !payload.sub) {
                        return { currentUser: null };
                    }
                    const user = await findUserById(db, payload.sub);
                    return { currentUser: user || null };
                } catch {
                    return { currentUser: null };
                }
            })

            // =====================================================
            // ODE Routes (used by frontend)
            // =====================================================

            // GET /api/odes/last-updated - Get last update timestamp
            .get('/api/odes/last-updated', () => {
                // Return current timestamp as last update
                return {
                    lastUpdated: new Date().toISOString(),
                    timestamp: Date.now(),
                };
            })

            // GET /api/nav-structures/:sessionId - Get navigation structure
            .get('/api/nav-structures/:sessionId', async ({ params, set, currentUser }) => {
                const sessionId = params.sessionId;

                // =====================================================
                // ACCESS CONTROL: Verify user has access to the project
                // =====================================================
                const session = getSession(sessionId);

                if (!session) {
                    // Check database for persisted projects
                    const project = await findProjectByUuid(db, sessionId);
                    if (project) {
                        const accessCheck = await checkProjectAccess(db, project, currentUser?.id);
                        if (!accessCheck.hasAccess) {
                            set.status = 403;
                            return { error: 'Forbidden', message: accessCheck.reason || 'Access denied' };
                        }
                    }
                    // If no project in DB and no session, return default structure for new projects
                    return {
                        sessionId,
                        structure: {
                            root: {
                                id: 'root',
                                title: 'New Project',
                                children: [
                                    {
                                        id: 'page_1',
                                        title: 'Home',
                                        type: 'page',
                                        children: [],
                                    },
                                ],
                            },
                        },
                    };
                }

                // Session exists, check project access in database
                const project = await findProjectByUuid(db, sessionId);
                if (project) {
                    const accessCheck = await checkProjectAccess(db, project, currentUser?.id);
                    if (!accessCheck.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: accessCheck.reason || 'Access denied' };
                    }
                }

                // Return session structure if available
                return {
                    sessionId,
                    structure: session.structure || {
                        root: {
                            id: 'root',
                            title: session.fileName || 'Project',
                            children: [
                                {
                                    id: 'page_1',
                                    title: 'Home',
                                    type: 'page',
                                    children: [],
                                },
                            ],
                        },
                    },
                };
            })

            // GET /api/projects/:projectId/sharing - Get project sharing info
            .get('/api/projects/:projectId/sharing', async ({ params, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);

                if (isNaN(projectId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid project ID' };
                }

                const project = await findProjectById(db, projectId);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                const owner = await findUserById(db, project.owner_id);
                const collabs = await getProjectCollaborators(db, projectId);

                return {
                    responseMessage: 'OK',
                    project: serializeProjectSharing(project, owner, collabs, currentUser?.id),
                };
            })

            // PATCH /api/projects/:projectId/visibility - Update project visibility
            .patch('/api/projects/:projectId/visibility', async ({ params, body, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const { visibility } = body as { visibility: 'public' | 'private' };

                if (isNaN(projectId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid project ID' };
                }

                if (!visibility || !['public', 'private'].includes(visibility)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_VISIBILITY', detail: 'Visibility must be public or private' };
                }

                const project = await findProjectById(db, projectId);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can change visibility' };
                }

                await updateProjectVisibility(db, projectId, visibility);

                // If made private, kick non-authorized users via WebSocket
                if (visibility === 'private') {
                    const collabs = await getProjectCollaborators(db, projectId);
                    const collaboratorIds = collabs.map(c => c.user_id);
                    notifyVisibilityChanged(project.uuid, project.owner_id, collaboratorIds);
                }

                return { responseMessage: 'OK' };
            })

            // POST /api/projects/:projectId/collaborators - Add collaborator
            .post('/api/projects/:projectId/collaborators', async ({ params, body, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const { email } = body as { email: string };

                if (isNaN(projectId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid project ID' };
                }

                if (!email) {
                    set.status = 400;
                    return { responseMessage: 'EMAIL_REQUIRED', detail: 'Email is required' };
                }

                const project = await findProjectById(db, projectId);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can add collaborators' };
                }

                const user = await findUserByEmail(db, email);
                if (!user) {
                    return { responseMessage: 'USER_NOT_FOUND', detail: 'User not found with this email' };
                }

                // Check not already collaborator
                const existing = await isCollaborator(db, projectId, user.id);
                if (existing) {
                    return { responseMessage: 'ALREADY_COLLABORATOR', detail: 'User is already a collaborator' };
                }

                // Check not owner (trying to add themselves)
                if (project.owner_id === user.id) {
                    return { responseMessage: 'IS_OWNER', detail: 'Cannot add owner as collaborator' };
                }

                await addCollaborator(db, projectId, user.id);

                return { responseMessage: 'OK', collaborator: { userId: user.id, email: user.email } };
            })

            // DELETE /api/projects/:projectId/collaborators/:userId - Remove collaborator
            .delete('/api/projects/:projectId/collaborators/:userId', async ({ params, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const userId = parseInt(params.userId, 10);

                if (isNaN(projectId) || isNaN(userId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid project ID or user ID' };
                }

                const project = await findProjectById(db, projectId);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can remove collaborators' };
                }

                await removeCollaborator(db, projectId, userId);

                // Notify removed user via WebSocket
                notifyCollaboratorRemoved(project.uuid, userId);

                return { responseMessage: 'OK' };
            })

            // PATCH /api/projects/:projectId/owner - Transfer ownership
            .patch('/api/projects/:projectId/owner', async ({ params, body, set, currentUser }) => {
                const projectId = parseInt(params.projectId, 10);
                const { newOwnerId } = body as { newOwnerId: number };

                if (isNaN(projectId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid project ID' };
                }

                if (!newOwnerId || isNaN(newOwnerId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_OWNER', detail: 'New owner ID is required' };
                }

                const project = await findProjectById(db, projectId);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can transfer ownership' };
                }

                const newOwner = await findUserById(db, newOwnerId);
                if (!newOwner) {
                    set.status = 404;
                    return { responseMessage: 'USER_NOT_FOUND', detail: 'New owner not found' };
                }

                // Verify new owner is a collaborator (required for ownership transfer)
                const isNewOwnerCollaborator = await isCollaborator(db, projectId, newOwnerId);
                if (!isNewOwnerCollaborator) {
                    set.status = 403;
                    return {
                        responseMessage: 'NOT_COLLABORATOR',
                        detail: 'New owner must be a current collaborator',
                    };
                }

                await transferOwnership(db, projectId, newOwnerId);

                return { responseMessage: 'OK' };
            })

            // GET /api/odes/:sessionId/properties - Get ODE properties
            .get('/api/odes/:sessionId/properties', async ({ params, set, currentUser }) => {
                const sessionId = params.sessionId;

                // =====================================================
                // ACCESS CONTROL: Verify user has access to the project
                // =====================================================
                const project = await findProjectByUuid(db, sessionId);
                if (project) {
                    const accessCheck = await checkProjectAccess(db, project, currentUser?.id);
                    if (!accessCheck.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: accessCheck.reason || 'Access denied' };
                    }
                }

                const session = getSession(sessionId);

                return {
                    sessionId,
                    properties: {
                        pp_title: session?.fileName || 'New Project',
                        pp_lang: 'es',
                        pp_description: '',
                        pp_author: '',
                        pp_license: 'creative commons: attribution - share alike 4.0',
                    },
                };
            })

            // POST /api/odes/:sessionId/properties - Save ODE properties
            .post('/api/odes/:sessionId/properties', async ({ params, body, set, currentUser }) => {
                const sessionId = params.sessionId;

                // =====================================================
                // ACCESS CONTROL: Verify user has access to the project
                // =====================================================
                const project = await findProjectByUuid(db, sessionId);
                if (project) {
                    const accessCheck = await checkProjectAccess(db, project, currentUser?.id);
                    if (!accessCheck.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: accessCheck.reason || 'Access denied' };
                    }
                }

                const data = body as StructureSaveRequest;
                const session = getSession(sessionId);

                if (session && data.properties) {
                    updateSession(sessionId, {
                        metadata: { ...session.metadata, properties: data.properties },
                    });
                }

                return {
                    success: true,
                    sessionId,
                    message: 'Properties saved',
                };
            })

            // POST /api/odes/clean-init-autosave - Clean previous autosaves
            .post('/api/odes/clean-init-autosave', () => {
                // In stateless mode, no server-side autosaves to clean
                return {
                    success: true,
                    message: 'Autosave cleanup not needed (stateless mode)',
                };
            })

            // GET /api/projects/uuid/:uuid/sharing - Get project sharing info by UUID
            .get('/api/projects/uuid/:uuid/sharing', async ({ params, set, currentUser }) => {
                const uuid = params.uuid;

                let project = await findProjectByUuid(db, uuid);

                // If project doesn't exist in DB, create it with current user as owner
                if (!project) {
                    // Require authentication to create project
                    if (!currentUser) {
                        set.status = 401;
                        return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                    }

                    // Create the project in DB with current user as owner
                    project = await createProjectWithUuid(db, uuid, {
                        title: 'Untitled',
                        owner_id: currentUser.id,
                        visibility: await getDefaultProjectVisibility(db),
                        saved_once: 0,
                    });

                    console.log(`[Project] Created project ${uuid} for user ${currentUser.id} via sharing endpoint`);
                }

                const owner = await findUserById(db, project.owner_id);
                const collabs = await getProjectCollaborators(db, project.id);

                return {
                    responseMessage: 'OK',
                    project: serializeProjectSharing(project, owner, collabs, currentUser?.id),
                };
            })

            // PATCH /api/projects/uuid/:uuid/visibility - Update project visibility by UUID
            .patch('/api/projects/uuid/:uuid/visibility', async ({ params, body, set, currentUser }) => {
                const uuid = params.uuid;
                const { visibility } = body as { visibility: 'public' | 'private' };

                if (!visibility || !['public', 'private'].includes(visibility)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_VISIBILITY', detail: 'Visibility must be public or private' };
                }

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can change visibility' };
                }

                await updateProjectVisibilityByUuid(db, uuid, visibility);

                // If made private, kick non-authorized users via WebSocket
                if (visibility === 'private') {
                    const collabs = await getProjectCollaborators(db, project.id);
                    const collaboratorIds = collabs.map(c => c.user_id);
                    notifyVisibilityChanged(uuid, project.owner_id, collaboratorIds);
                }

                return { responseMessage: 'OK' };
            })

            // POST /api/projects/uuid/:uuid/collaborators - Add collaborator by UUID
            .post('/api/projects/uuid/:uuid/collaborators', async ({ params, body, set, currentUser }) => {
                const uuid = params.uuid;
                const { email } = body as { email: string };

                if (!email) {
                    set.status = 400;
                    return { responseMessage: 'EMAIL_REQUIRED', detail: 'Email is required' };
                }

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can add collaborators' };
                }

                const user = await findUserByEmail(db, email);
                if (!user) {
                    return { responseMessage: 'USER_NOT_FOUND', detail: 'User not found with this email' };
                }

                const existing = await isCollaborator(db, project.id, user.id);
                if (existing) {
                    return { responseMessage: 'ALREADY_COLLABORATOR', detail: 'User is already a collaborator' };
                }

                // Check not owner (trying to add themselves)
                if (project.owner_id === user.id) {
                    return { responseMessage: 'IS_OWNER', detail: 'Cannot add owner as collaborator' };
                }

                await addCollaborator(db, project.id, user.id);

                return { responseMessage: 'OK', collaborator: { userId: user.id, email: user.email } };
            })

            // DELETE /api/projects/uuid/:uuid/collaborators/:userId - Remove collaborator by UUID
            .delete('/api/projects/uuid/:uuid/collaborators/:userId', async ({ params, set, currentUser }) => {
                const uuid = params.uuid;
                const userId = parseInt(params.userId, 10);

                if (isNaN(userId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_ID', detail: 'Invalid user ID' };
                }

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can remove collaborators' };
                }

                await removeCollaborator(db, project.id, userId);

                // Notify removed user via WebSocket
                notifyCollaboratorRemoved(uuid, userId);

                return { responseMessage: 'OK' };
            })

            // PATCH /api/projects/uuid/:uuid/owner - Transfer ownership by UUID
            .patch('/api/projects/uuid/:uuid/owner', async ({ params, body, set, currentUser }) => {
                const uuid = params.uuid;
                const { newOwnerId } = body as { newOwnerId: number };

                if (!newOwnerId || isNaN(newOwnerId)) {
                    set.status = 400;
                    return { responseMessage: 'INVALID_OWNER', detail: 'New owner ID is required' };
                }

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { responseMessage: 'NOT_FOUND', detail: 'Project not found' };
                }

                // Verify requester is authenticated
                if (!currentUser) {
                    set.status = 401;
                    return { responseMessage: 'UNAUTHORIZED', detail: 'Authentication required' };
                }

                // Verify requester is the project owner
                if (project.owner_id !== currentUser.id) {
                    set.status = 403;
                    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can transfer ownership' };
                }

                const newOwner = await findUserById(db, newOwnerId);
                if (!newOwner) {
                    set.status = 404;
                    return { responseMessage: 'USER_NOT_FOUND', detail: 'New owner not found' };
                }

                // Verify new owner is a collaborator (required for ownership transfer)
                const isNewOwnerCollaborator = await isCollaborator(db, project.id, newOwnerId);
                if (!isNewOwnerCollaborator) {
                    set.status = 403;
                    return {
                        responseMessage: 'NOT_COLLABORATOR',
                        detail: 'New owner must be a current collaborator',
                    };
                }

                await transferOwnershipByUuid(db, uuid, newOwnerId);

                return { responseMessage: 'OK' };
            })

            // POST /api/projects/uuid/:uuid/duplicate - Duplicate project by UUID
            .post('/api/projects/uuid/:uuid/duplicate', async ({ params, set }) => {
                const uuid = params.uuid;

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // Generate new UUID for the duplicate
                const newUuid = generateSessionId();

                // Create duplicate project with new UUID
                const duplicateProject = await createProjectWithUuid(db, newUuid, {
                    title: `${project.title} (copy)`,
                    owner_id: project.owner_id,
                    description: project.description || undefined,
                    visibility: project.visibility as 'public' | 'private',
                    language: project.language || undefined,
                    author: project.author || undefined,
                    license: project.license || undefined,
                });

                // =====================================================
                // Duplicate assets (physical files + database records)
                // Build client_id mapping for Yjs document update
                // =====================================================
                const clientIdMapping = new Map<string, string>();
                const sourceAssets = await findAllAssetsForProject(db, project.id);

                if (sourceAssets.length > 0) {
                    const targetAssetsDir = getProjectAssetsDir(duplicateProject.uuid);

                    for (const asset of sourceAssets) {
                        if (!asset.client_id) continue;

                        // Generate new client_id for the duplicated asset
                        const newClientId = crypto.randomUUID();
                        clientIdMapping.set(asset.client_id, newClientId);

                        // Copy physical file if it exists
                        if (asset.storage_path) {
                            try {
                                const sourceExists = await fs.pathExists(asset.storage_path);
                                if (sourceExists) {
                                    const targetFile = path.join(targetAssetsDir, newClientId, asset.filename);
                                    await fs.ensureDir(path.dirname(targetFile));
                                    await fs.copy(asset.storage_path, targetFile);

                                    // Create new asset record with new client_id
                                    await createAsset(db, {
                                        project_id: duplicateProject.id,
                                        filename: asset.filename,
                                        storage_path: targetFile,
                                        mime_type: asset.mime_type,
                                        file_size: asset.file_size,
                                        client_id: newClientId,
                                        component_id: asset.component_id,
                                        content_hash: asset.content_hash,
                                    });
                                } else {
                                    console.warn(`[Project Duplicate] Asset file not found: ${asset.storage_path}`);
                                }
                            } catch (err) {
                                console.warn(`[Project Duplicate] Failed to copy asset ${asset.id}:`, err);
                            }
                        }
                    }
                }

                // Copy Yjs document state if exists, updating the title in metadata
                // and replacing old client_ids with new ones
                const snapshot = findSnapshotByProjectId ? await findSnapshotByProjectId(db, project.id) : null;
                if (snapshot) {
                    // Import Yjs to modify the document
                    const Y = await import('yjs');

                    // Load snapshot into Y.Doc
                    const ydoc = new Y.Doc();
                    Y.applyUpdate(ydoc, new Uint8Array(snapshot.snapshot_data));

                    // Update title in metadata
                    const metadata = ydoc.getMap('metadata');
                    metadata.set('title', `${project.title} (copy)`);

                    // Replace old client_ids with new ones in all content
                    if (clientIdMapping.size > 0) {
                        const replaceClientIds = (text: string): string => {
                            let result = text;
                            for (const [oldId, newId] of clientIdMapping) {
                                result = result.replaceAll(oldId, newId);
                            }
                            return result;
                        };

                        // Update pages - iterate through the pages map and update HTML content
                        const pages = ydoc.getMap('pages');
                        for (const pageId of pages.keys()) {
                            const page = pages.get(pageId) as Y.Map<unknown> | undefined;
                            if (page && page instanceof Y.Map) {
                                const blocks = page.get('blocks') as Y.Map<unknown> | undefined;
                                if (blocks && blocks instanceof Y.Map) {
                                    for (const blockId of blocks.keys()) {
                                        const block = blocks.get(blockId) as Y.Map<unknown> | undefined;
                                        if (block && block instanceof Y.Map) {
                                            const idevices = block.get('idevices') as Y.Map<unknown> | undefined;
                                            if (idevices && idevices instanceof Y.Map) {
                                                for (const ideviceId of idevices.keys()) {
                                                    const idevice = idevices.get(ideviceId) as
                                                        | Y.Map<unknown>
                                                        | undefined;
                                                    if (idevice && idevice instanceof Y.Map) {
                                                        // Update innerHtml if present
                                                        const innerHtml = idevice.get('innerHtml');
                                                        if (typeof innerHtml === 'string') {
                                                            idevice.set('innerHtml', replaceClientIds(innerHtml));
                                                        }
                                                        // Update any field values that might contain asset references
                                                        const fields = idevice.get('fields') as
                                                            | Y.Map<unknown>
                                                            | undefined;
                                                        if (fields && fields instanceof Y.Map) {
                                                            for (const fieldKey of fields.keys()) {
                                                                const fieldValue = fields.get(fieldKey);
                                                                if (typeof fieldValue === 'string') {
                                                                    fields.set(fieldKey, replaceClientIds(fieldValue));
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Encode modified state
                    const newState = Y.encodeStateAsUpdate(ydoc);
                    ydoc.destroy();

                    // Save with updated title
                    if (upsertSnapshot) {
                        await upsertSnapshot(db, duplicateProject.id, Buffer.from(newState), Date.now().toString());
                    }
                }

                // Mark duplicated project as saved so it appears in the list
                await markProjectAsSaved(db, duplicateProject.id);

                return {
                    success: true,
                    message: 'Project duplicated',
                    newProjectId: newUuid,
                    project: {
                        id: duplicateProject.id,
                        uuid: newUuid,
                        title: duplicateProject.title,
                    },
                };
            })

            // DELETE /api/projects/uuid/:uuid - Delete project by UUID
            .delete('/api/projects/uuid/:uuid', async ({ params, set }) => {
                const uuid = params.uuid;

                const project = await findProjectByUuid(db, uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // Delete project (cascades to assets, yjs_documents, etc.)
                await hardDeleteProject(db, project.id);

                // Clean up session files if they exist
                const sessionPath = getOdeSessionTempDir(uuid);
                try {
                    await fs.remove(sessionPath);
                } catch {
                    // Ignore cleanup errors
                }

                return { success: true, message: 'Project deleted' };
            })

            // NOTE: yjs-document endpoints moved to src/new/routes/yjs.ts (database-backed)

            // GET /api/projects/user/recent - Get user's most recent projects
            .get('/api/projects/user/recent', async ({ currentUser }) => {
                // If not authenticated, return empty array
                if (!currentUser) {
                    return [];
                }

                const userId = currentUser.id;

                // Query owned projects that have been saved at least once
                const ownedProjects = await findSavedProjectsByOwner(db, userId);

                // Query projects where user is a collaborator (saved only)
                const sharedProjects = await findProjectsAsCollaborator(db, userId, ['active']);
                const savedSharedProjects = sharedProjects.filter(p => p.saved_once === 1);

                // Combine all projects
                const allProjects = [...ownedProjects, ...savedSharedProjects];

                // Sort by updatedAt DESC and take the 3 most recent
                const recentProjects = allProjects
                    .sort((a, b) => {
                        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                        return dateB - dateA;
                    })
                    .slice(0, 3);

                // Return array directly (format expected by frontend makeRecentProjecList)
                return recentProjects.map(project => ({
                    odeId: project.uuid,
                    title: project.title || 'Sin título',
                    fileName: project.title || 'Sin título',
                    updatedAt: project.updated_at,
                }));
            })

            // GET /api/projects/user/list - Get user's project list (owned + shared)
            .get('/api/projects/user/list', async ({ currentUser }) => {
                // If not authenticated, return empty list
                if (!currentUser) {
                    return { success: true, odeFiles: { odeFilesSync: [] } };
                }

                const userId = currentUser.id;

                // Query owned projects that have been saved at least once
                const ownedProjects = await findSavedProjectsByOwner(db, userId);

                // Query projects where user is a collaborator (saved only)
                const sharedProjects = await findProjectsAsCollaborator(db, userId, ['active']);
                const savedSharedProjects = sharedProjects.filter(p => p.saved_once === 1);

                // Get unique owner IDs from shared projects to fetch their emails
                const ownerIds = [...new Set(savedSharedProjects.map(p => p.owner_id))];
                const ownerEmails: Map<number, string> = new Map();

                for (const ownerId of ownerIds) {
                    const owner = await findUserById(db, ownerId);
                    if (owner) {
                        ownerEmails.set(ownerId, owner.email);
                    }
                }

                // Format owned projects
                const ownedFormatted = ownedProjects.map(p => ({
                    id: p.id,
                    odeId: p.uuid,
                    title: p.title || 'Sin título',
                    fileName: p.title || 'Sin título',
                    versionName: '1',
                    size: 0,
                    sizeFormatted: '--',
                    updatedAt: p.updated_at || new Date().toISOString(),
                    isManualSave: true,
                    role: 'owner',
                    ownerEmail: null,
                    ownerId: p.owner_id,
                    visibility: p.visibility || 'private',
                }));

                // Format shared projects
                const sharedFormatted = savedSharedProjects.map(p => ({
                    id: p.id,
                    odeId: p.uuid,
                    title: p.title || 'Sin título',
                    fileName: p.title || 'Sin título',
                    versionName: '1',
                    size: 0,
                    sizeFormatted: '--',
                    updatedAt: p.updated_at || new Date().toISOString(),
                    isManualSave: true,
                    role: 'editor',
                    ownerEmail: ownerEmails.get(p.owner_id) || null,
                    ownerId: p.owner_id,
                    visibility: p.visibility || 'private',
                }));

                // Combine all projects (frontend filters by role for tabs)
                const allProjects = [...ownedFormatted, ...sharedFormatted];

                // Format response for frontend compatibility (odeFilesSync format)
                return {
                    success: true,
                    odeFiles: {
                        odeFilesSync: allProjects,
                        maxDiskSpace: 0,
                        maxDiskSpaceFormatted: '--',
                        usedSpace: 0,
                        usedSpaceFormatted: '--',
                        freeSpace: 0,
                        freeSpaceFormatted: '--',
                    },
                };
            })

            // PATCH /api/projects/uuid/:uuid/metadata - Update project metadata (title sync)
            .patch('/api/projects/uuid/:uuid/metadata', async ({ params, body }) => {
                const { uuid } = params;
                const data = body as ProjectMetadataRequest;
                const title = data.title;

                // Update session if exists
                const session = getSession(uuid);
                if (session) {
                    updateSession(uuid, {
                        fileName: title ? `${title}.elp` : session.fileName,
                        metadata: {
                            ...session.metadata,
                            title: title || session.metadata?.title,
                        },
                    });
                }

                return {
                    success: true,
                    projectId: uuid,
                    title: title,
                    message: 'Metadata updated',
                };
            })

            // GET /api/odes/current-users - Get users currently working on ODE
            .get('/api/odes/current-users', ({ query }) => {
                const odeSessionId = query.odeSessionId as string | undefined;

                // In single-user mode, return empty array or minimal info
                // This endpoint is for collaboration awareness
                if (!odeSessionId) {
                    return {
                        currentUsers: [],
                    };
                }

                const session = getSession(odeSessionId);
                if (!session) {
                    return {
                        currentUsers: [],
                    };
                }

                // Return current user info if session exists
                // In full collaborative mode, this would track WebSocket connections
                return {
                    currentUsers: [
                        {
                            odeName: session.fileName || 'Untitled',
                            odeSessionId: odeSessionId,
                            isCurrentUser: true,
                        },
                    ],
                };
            })

            // POST /api/odes/current-users - Register user working on ODE (for collaboration)
            .post('/api/odes/current-users', ({ body }) => {
                const data = body as OdeCurrentUserRequest;
                // In stateless mode, just acknowledge
                return {
                    success: true,
                    message: 'User registered (stateless mode)',
                    odeSessionId: data.odeSessionId,
                };
            })

            // DELETE /api/odes/current-users - Unregister user from ODE (for collaboration)
            .delete('/api/odes/current-users', () => {
                // In stateless mode, just acknowledge
                return {
                    success: true,
                    message: 'User unregistered (stateless mode)',
                };
            })

            // POST /api/odes/check-before-leave - Check if safe to leave (no other users editing)
            .post('/api/odes/check-before-leave', ({ body }) => {
                const data = body as CheckBeforeLeaveRequest;
                const odeSessionId = data.odeSessionId;

                // In single-user mode, always safe to leave
                // In collaborative mode, this would check WebSocket connections
                return {
                    success: true,
                    canLeave: true,
                    currentUsers: [],
                    message: 'Safe to leave (single-user mode)',
                    odeSessionId: odeSessionId || null,
                    // Include these flags for logout flow compatibility
                    leaveSession: true,
                    askSave: false,
                    leaveEmptySession: false,
                };
            })

            // POST /api/odes/session/close - Close an ODE session (called during logout)
            .post('/api/odes/session/close', ({ body }) => {
                const data = body as CloseSessionRequest;
                const odeSessionId = data.odeSessionId;

                // Clean up session resources if needed
                // In stateless mode, sessions are managed by IndexedDB on client
                console.log(`[Project] Closing session: ${odeSessionId || 'unknown'}`);

                return {
                    success: true,
                    message: 'Session closed successfully',
                    odeSessionId: odeSessionId || null,
                };
            })

            // =====================================================
            // Utilities: Link Validation (brokenlinks)
            // =====================================================

            // POST /api/ode-management/odes/session/brokenlinks - Validate links in content
            .post('/api/ode-management/odes/session/brokenlinks', async ({ body }) => {
                const data = body as UsedFilesRequest;
                const idevices = data.idevices || [];
                const filesDir = getFilesDir();

                interface BrokenLinkInfo {
                    brokenLinks: string;
                    nTimesBrokenLinks: number | null;
                    brokenLinksError: string | null;
                    pageNamesBrokenLinks: string;
                    blockNamesBrokenLinks: string;
                    typeComponentSyncBrokenLinks: string;
                    orderComponentSyncBrokenLinks: string;
                }

                interface ExtractedLink {
                    url: string;
                    count: number;
                }

                // Extract links from HTML
                const extractLinks = (html: string): ExtractedLink[] => {
                    if (!html) return [];
                    const regex = /(href|src)="([^"]*)"/gi;
                    const links: ExtractedLink[] = [];
                    let match: RegExpExecArray | null;
                    while ((match = regex.exec(html)) !== null) {
                        links.push({ url: match[2], count: 1 });
                    }
                    return links;
                };

                // Clean and count links
                const cleanAndCountLinks = (links: ExtractedLink[]): ExtractedLink[] => {
                    const urlCounts = new Map<string, number>();
                    for (const link of links) {
                        const cleanUrl = link.url.replace(/"/g, '');
                        urlCounts.set(cleanUrl, (urlCounts.get(cleanUrl) || 0) + 1);
                    }
                    return Array.from(urlCounts.entries()).map(([url, count]) => ({ url, count }));
                };

                // Remove invalid links
                const removeInvalidLinks = (links: ExtractedLink[]): ExtractedLink[] => {
                    return links.filter(link => {
                        if (!link.url || link.url.trim() === '') return false;
                        if (link.url.startsWith('#')) return false;
                        if (link.url.startsWith('javascript:')) return false;
                        if (link.url.startsWith('data:')) return false;
                        return true;
                    });
                };

                // Deduplicate links
                const deduplicateLinks = (links: ExtractedLink[]): ExtractedLink[] => {
                    const uniqueLinks = new Map<string, ExtractedLink>();
                    for (const link of links) {
                        const existing = uniqueLinks.get(link.url);
                        if (!existing || link.count > existing.count) {
                            uniqueLinks.set(link.url, link);
                        }
                    }
                    return Array.from(uniqueLinks.values());
                };

                // Validate a single link
                const validateLink = async (url: string): Promise<string | null> => {
                    // Internal page links (exe-node:) - consider valid
                    if (url.startsWith('exe-node:')) {
                        return null;
                    }

                    // Internal file links (files/...)
                    if (url.startsWith('files/') || url.startsWith('files\\')) {
                        try {
                            const relativePath = url.substring(6);
                            const fullPath = path.join(filesDir, relativePath);
                            if (await fs.pathExists(fullPath)) {
                                return null;
                            }
                            return '404';
                        } catch {
                            return '500';
                        }
                    }

                    // Skip relative URLs that aren't files/
                    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
                        return null;
                    }

                    // External link validation
                    try {
                        let normalizedUrl = url;
                        if (url.startsWith('//')) {
                            normalizedUrl = 'https:' + url;
                        }

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);

                        try {
                            let response = await fetch(normalizedUrl, {
                                method: 'HEAD',
                                signal: controller.signal,
                                redirect: 'follow',
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                },
                            });

                            clearTimeout(timeoutId);

                            // If HEAD returns 405, try GET
                            if (response.status === 405) {
                                const controller2 = new AbortController();
                                const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
                                response = await fetch(normalizedUrl, {
                                    method: 'GET',
                                    signal: controller2.signal,
                                    redirect: 'follow',
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                        Range: 'bytes=0-0',
                                    },
                                });
                                clearTimeout(timeoutId2);
                            }

                            // 301 is not broken
                            if (response.status === 301) return null;
                            if (response.ok) return null;
                            return String(response.status);
                        } catch (fetchError: unknown) {
                            clearTimeout(timeoutId);
                            const err = fetchError as { name?: string; message?: string; cause?: { code?: string } };
                            if (err.name === 'AbortError') return 'Timeout';
                            const cause = err.cause;
                            if (cause?.code === 'ENOTFOUND') return 'Could not resolve host';
                            if (cause?.code === 'ECONNREFUSED') return 'Connection refused';
                            return err.message || 'Network error';
                        }
                    } catch {
                        return 'URL using bad/illegal format';
                    }
                };

                const allBrokenLinks: BrokenLinkInfo[] = [];

                for (const idevice of idevices) {
                    if (!idevice.html) continue;

                    let links = extractLinks(idevice.html);
                    links = cleanAndCountLinks(links);
                    links = removeInvalidLinks(links);
                    links = deduplicateLinks(links);

                    for (const link of links) {
                        const validationError = await validateLink(link.url);

                        if (validationError) {
                            allBrokenLinks.push({
                                brokenLinks: link.url,
                                nTimesBrokenLinks: link.count,
                                brokenLinksError: validationError,
                                pageNamesBrokenLinks: idevice.pageName || '',
                                blockNamesBrokenLinks: idevice.blockName || '',
                                typeComponentSyncBrokenLinks: idevice.ideviceType || '',
                                orderComponentSyncBrokenLinks: String(idevice.order ?? ''),
                            });
                        }
                    }
                }

                // If no broken links found, return success message
                if (allBrokenLinks.length === 0) {
                    return {
                        responseMessage: 'OK',
                        brokenLinks: [
                            {
                                brokenLinks: 'No broken links found',
                                nTimesBrokenLinks: null,
                                brokenLinksError: null,
                                pageNamesBrokenLinks: '',
                                blockNamesBrokenLinks: '',
                                typeComponentSyncBrokenLinks: '',
                                orderComponentSyncBrokenLinks: '',
                            },
                        ],
                    };
                }

                return {
                    responseMessage: 'OK',
                    brokenLinks: allBrokenLinks,
                };
            })

            // POST /api/ode-management/odes/session/brokenlinks/extract - Extract links without validating (fast)
            .post('/api/ode-management/odes/session/brokenlinks/extract', async ({ body }) => {
                const data = body as UsedFilesRequest;
                const idevices = (data.idevices || []) as IdeviceContent[];

                const links = extractLinksFromIdevices(idevices);

                return {
                    responseMessage: 'OK',
                    links,
                    totalLinks: links.length,
                };
            })

            // POST /api/ode-management/odes/session/brokenlinks/validate-stream - Validate links via SSE
            .post('/api/ode-management/odes/session/brokenlinks/validate-stream', async function* ({ body }) {
                const data = body as { links: ExtractedLink[] };
                const links = data.links || [];
                const filesDir = getFilesDir();

                // Stream validation results as SSE events
                for await (const result of validateLinksStream(links, { filesDir, batchSize: 5 })) {
                    yield {
                        event: 'link-validated',
                        data: JSON.stringify(result),
                    };
                }

                // Signal completion
                yield {
                    event: 'done',
                    data: JSON.stringify({ complete: true, totalValidated: links.length }),
                };
            })

            // =====================================================
            // Utilities: Resources Report (usedfiles)
            // =====================================================

            // POST /api/ode-management/odes/session/usedfiles - Get used files report
            .post('/api/ode-management/odes/session/usedfiles', async ({ body }) => {
                const data = body as UsedFilesRequest;
                const idevices = data.idevices || [];
                const assetMetadata = data.assetMetadata || {};
                const filesDir = getFilesDir();

                // Debug: log received data
                console.log(`[UsedFiles] Raw body keys:`, Object.keys(data));
                console.log(`[UsedFiles] idevices type:`, typeof data.idevices, Array.isArray(data.idevices));
                console.log(`[UsedFiles] Received ${idevices.length} idevices`);
                console.log(`[UsedFiles] Received metadata for ${Object.keys(assetMetadata).length} assets`);
                if (idevices.length > 0) {
                    console.log('[UsedFiles] First idevice HTML sample:', idevices[0].html?.substring(0, 500));
                }

                interface UsedFileInfo {
                    usedFiles: string;
                    usedFilesPath: string;
                    usedFilesSize: string;
                    pageNamesUsedFiles: string;
                    blockNamesUsedFiles: string;
                    typeComponentSyncUsedFiles: string;
                    orderComponentSyncUsedFiles: string;
                }

                // Format file size
                const formatFileSize = (bytes: number): string => {
                    if (bytes === 0) return '0 B';
                    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const k = 1024;
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + units[i];
                };

                // Extract internal file links from HTML
                const extractInternalFileLinks = (html: string): string[] => {
                    if (!html) return [];
                    const links: string[] = [];

                    // Match files/ links
                    const filesRegex = /(href|src)="(files\/[^"]*)"/gi;
                    let match: RegExpExecArray | null;
                    while ((match = filesRegex.exec(html)) !== null) {
                        const url = match[2];
                        if (url && !links.includes(url)) {
                            links.push(url);
                        }
                    }

                    // Match asset:// URLs (Yjs internal format)
                    const assetRegex = /(href|src)="(asset:\/\/[^"]*)"/gi;
                    while ((match = assetRegex.exec(html)) !== null) {
                        const url = match[2];
                        if (url && !links.includes(url)) {
                            links.push(url);
                        }
                    }

                    // Debug: log found links
                    if (links.length > 0) {
                        console.log('[UsedFiles] Found links:', links);
                    }

                    return links;
                };

                // Get file info
                interface IdeviceInfo {
                    html?: string;
                    pageName?: string;
                    blockName?: string;
                    ideviceType?: string;
                    order?: number;
                }
                const getFileInfo = async (filePath: string, idevice: IdeviceInfo): Promise<UsedFileInfo | null> => {
                    try {
                        // Handle asset:// URLs (stored in IndexedDB)
                        if (filePath.startsWith('asset://')) {
                            // Extract asset ID from URL (asset://uuid or asset://uuid/filename)
                            const assetIdMatch = filePath.match(/asset:\/\/([a-f0-9-]+)/i);
                            const assetId = assetIdMatch ? assetIdMatch[1] : '';

                            // Get metadata from client if available
                            const metadata = assetId ? assetMetadata[assetId] : null;

                            // Use filename from metadata if available, otherwise use UUID
                            let fileName: string;
                            if (metadata?.filename) {
                                fileName = metadata.filename;
                            } else {
                                // Fallback: extract from URL path or use UUID
                                const urlParts = filePath.replace('asset://', '').split('/');
                                fileName = urlParts.length > 1 ? urlParts[urlParts.length - 1] : assetId;
                            }

                            // Use size from metadata if available
                            let fileSize: string;
                            if (metadata?.size && metadata.size > 0) {
                                fileSize = formatFileSize(metadata.size);
                            } else {
                                fileSize = 'Stored in browser';
                            }

                            return {
                                usedFiles: fileName,
                                usedFilesPath: filePath,
                                usedFilesSize: fileSize,
                                pageNamesUsedFiles: idevice.pageName || '',
                                blockNamesUsedFiles: idevice.blockName || '',
                                typeComponentSyncUsedFiles: idevice.ideviceType || '',
                                orderComponentSyncUsedFiles: String(idevice.order ?? ''),
                            };
                        }

                        // Remove "files/" prefix for filesystem path
                        const relativePath = filePath.startsWith('files/') ? filePath.substring(6) : filePath;
                        const fullPath = path.join(filesDir, relativePath);

                        // Check if file exists
                        if (!(await fs.pathExists(fullPath))) {
                            return null;
                        }

                        // Get file stats
                        const stats = await fs.stat(fullPath);
                        const fileSize = formatFileSize(stats.size);
                        const fileName = path.basename(filePath);

                        return {
                            usedFiles: fileName,
                            usedFilesPath: filePath,
                            usedFilesSize: fileSize,
                            pageNamesUsedFiles: idevice.pageName || '',
                            blockNamesUsedFiles: idevice.blockName || '',
                            typeComponentSyncUsedFiles: idevice.ideviceType || '',
                            orderComponentSyncUsedFiles: String(idevice.order ?? ''),
                        };
                    } catch {
                        return null;
                    }
                };

                const allUsedFiles: UsedFileInfo[] = [];

                for (const idevice of idevices) {
                    if (!idevice.html) continue;

                    const fileLinks = extractInternalFileLinks(idevice.html);

                    for (const fileLink of fileLinks) {
                        const fileInfo = await getFileInfo(fileLink, idevice);
                        if (fileInfo) {
                            allUsedFiles.push(fileInfo);
                        }
                    }
                }

                // If no files found, return empty message
                if (allUsedFiles.length === 0) {
                    return {
                        responseMessage: 'OK',
                        usedFiles: [
                            {
                                usedFiles: 'No files found',
                                usedFilesPath: '',
                                usedFilesSize: '',
                                pageNamesUsedFiles: '',
                                blockNamesUsedFiles: '',
                                typeComponentSyncUsedFiles: '',
                                orderComponentSyncUsedFiles: '',
                            },
                        ],
                    };
                }

                return {
                    responseMessage: 'OK',
                    usedFiles: allUsedFiles,
                };
            })

            // =====================================================
            // Clone/Duplicate Endpoints
            // =====================================================

            // POST /api/nav-structure-management/nav-structures/duplicate - Clone a page (nav-structure)
            .post('/api/nav-structure-management/nav-structures/duplicate', async ({ body }) => {
                const data = body as NavStructureDuplicateRequest;
                const { odeSessionId, navStructureId, parentId } = data;

                // In stateless Yjs mode, cloning is handled client-side
                // This endpoint acknowledges the request and returns a new UUID
                const newNavStructureId = crypto.randomUUID();

                console.log(`[Project] Clone nav-structure request: ${navStructureId} -> ${newNavStructureId}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    newNavStructureId,
                    message: 'Page cloned (client-side Yjs mode)',
                    odeSessionId,
                    originalNavStructureId: navStructureId,
                    parentId,
                };
            })

            // =====================================================
            // Save/Update Endpoints for Structure Management
            // =====================================================

            // PUT /api/nav-structure-management/nav-structures/reorder/save - Reorder pages
            .put('/api/nav-structure-management/nav-structures/reorder/save', async ({ body }) => {
                const data = body as StructureSaveRequest;
                const { odeSessionId, order: _order } = data;

                // In stateless Yjs mode, reordering is handled client-side
                console.log(`[Project] Reorder nav-structures request`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'Pages reordered (client-side Yjs mode)',
                    odeSessionId,
                };
            })

            // PUT /api/pag-structure-management/pag-structures/reorder/save - Reorder blocks
            .put('/api/pag-structure-management/pag-structures/reorder/save', async ({ body }) => {
                const data = body as StructureSaveRequest;
                const { odeSessionId, pageId, order: _order } = data;

                // In stateless Yjs mode, reordering is handled client-side
                console.log(`[Project] Reorder pag-structures request for page ${pageId}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'Blocks reordered (client-side Yjs mode)',
                    odeSessionId,
                    pageId,
                };
            })

            // PUT /api/idevice-management/idevices/reorder/save - Reorder iDevices
            .put('/api/idevice-management/idevices/reorder/save', async ({ body }) => {
                const data = body as StructureSaveRequest;
                const { odeSessionId, blockId, order: _order } = data;

                // In stateless Yjs mode, reordering is handled client-side
                console.log(`[Project] Reorder idevices request for block ${blockId}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'iDevices reordered (client-side Yjs mode)',
                    odeSessionId,
                    blockId,
                };
            })

            // =====================================================
            // Delete Endpoints for Structure Management
            // =====================================================

            // DELETE /api/nav-structure-management/nav-structures/:id/delete - Delete a page
            .delete('/api/nav-structure-management/nav-structures/:id/delete', async ({ params }) => {
                const { id } = params;

                // In stateless Yjs mode, deletion is handled client-side
                console.log(`[Project] Delete nav-structure request: ${id}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'Page deleted (client-side Yjs mode)',
                    deletedId: id,
                };
            })

            // DELETE /api/pag-structure-management/pag-structures/:id/delete - Delete a block
            .delete('/api/pag-structure-management/pag-structures/:id/delete', async ({ params }) => {
                const { id } = params;

                // In stateless Yjs mode, deletion is handled client-side
                console.log(`[Project] Delete pag-structure request: ${id}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'Block deleted (client-side Yjs mode)',
                    deletedId: id,
                };
            })

            // DELETE /api/idevice-management/idevices/:id/delete - Delete an iDevice
            .delete('/api/idevice-management/idevices/:id/delete', async ({ params }) => {
                const { id } = params;

                // In stateless Yjs mode, deletion is handled client-side
                console.log(`[Project] Delete idevice request: ${id}`);

                return {
                    responseMessage: 'OK',
                    success: true,
                    message: 'iDevice deleted (client-side Yjs mode)',
                    deletedId: id,
                };
            })
    );
}

// ============================================================================
// Default Instances (for backwards compatibility)
// ============================================================================

export const projectRoutes = createProjectRoutes();
export const symfonyCompatProjectRoutes = createSymfonyCompatProjectRoutes();
