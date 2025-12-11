/**
 * Project Routes for Elysia
 * Handles project CRUD, file uploads, and session management
 *
 * Uses Dependency Injection pattern for testability
 */
import { Elysia, t } from 'elysia';
import * as fsDefault from 'fs-extra';
import * as pathDefault from 'path';

import {
    createSession as createSessionDefault,
    getSession as getSessionDefault,
    updateSession as updateSessionDefault,
    deleteSession as deleteSessionDefault,
    getAllSessions as getAllSessionsDefault,
    generateSessionId as generateSessionIdDefault,
    type ProjectSession,
} from '../services/session-manager';

import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    getOdeSessionDistDir as getOdeSessionDistDirDefault,
    createSessionDirectories as createSessionDirectoriesDefault,
    cleanupSessionDirectories as cleanupSessionDirectoriesDefault,
    getContentXmlPath as getContentXmlPathDefault,
    fileExists as fileExistsDefault,
    readFileAsString as readFileAsStringDefault,
    writeFile as writeFileDefault,
    appendFile as appendFileDefault,
    getFilesDir as getFilesDirDefault,
} from '../services/file-helper';

import {
    extractZip as extractZipDefault,
    extractZipFromBuffer as extractZipFromBufferDefault,
    createZip as createZipDefault,
    readFileFromZipAsString as readFileFromZipAsStringDefault,
} from '../services/zip';

// yjs-persistence functions no longer used here - endpoints moved to routes/yjs.ts

import * as queriesDefault from '../db/queries';
import { db as dbDefault } from '../db/client';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { createGravatarUrl as createGravatarUrlDefault } from '../utils/gravatar.util';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

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
    getOdeSessionDistDir: typeof getOdeSessionDistDirDefault;
    createSessionDirectories: typeof createSessionDirectoriesDefault;
    cleanupSessionDirectories: typeof cleanupSessionDirectoriesDefault;
    getContentXmlPath: typeof getContentXmlPathDefault;
    fileExists: typeof fileExistsDefault;
    readFileAsString: typeof readFileAsStringDefault;
    writeFile: typeof writeFileDefault;
    appendFile: typeof appendFileDefault;
    getFilesDir: typeof getFilesDirDefault;
}

/**
 * Zip service functions
 */
export interface ZipDeps {
    extractZip: typeof extractZipDefault;
    extractZipFromBuffer: typeof extractZipFromBufferDefault;
    createZip: typeof createZipDefault;
    readFileFromZipAsString: typeof readFileFromZipAsStringDefault;
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
}

/**
 * Utils dependencies
 */
export interface UtilsDeps {
    createGravatarUrl: typeof createGravatarUrlDefault;
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
    zip?: ZipDeps;
    queries?: QueriesDeps;
    utils?: UtilsDeps;
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
    getOdeSessionDistDir: getOdeSessionDistDirDefault,
    createSessionDirectories: createSessionDirectoriesDefault,
    cleanupSessionDirectories: cleanupSessionDirectoriesDefault,
    getContentXmlPath: getContentXmlPathDefault,
    fileExists: fileExistsDefault,
    readFileAsString: readFileAsStringDefault,
    writeFile: writeFileDefault,
    appendFile: appendFileDefault,
    getFilesDir: getFilesDirDefault,
};

const defaultZip: ZipDeps = {
    extractZip: extractZipDefault,
    extractZipFromBuffer: extractZipFromBufferDefault,
    createZip: createZipDefault,
    readFileFromZipAsString: readFileFromZipAsStringDefault,
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
};

const defaultUtils: UtilsDeps = {
    createGravatarUrl: createGravatarUrlDefault,
};

const defaultDependencies: ProjectDependencies = {
    db: dbDefault,
    fs: fsDefault,
    path: pathDefault,
    sessionManager: defaultSessionManager,
    fileHelper: defaultFileHelper,
    zip: defaultZip,
    queries: defaultQueries,
    utils: defaultUtils,
};

// Get default project visibility from environment
function getDefaultProjectVisibility(): 'public' | 'private' {
    const visibility = process.env.DEFAULT_PROJECT_VISIBILITY;
    return visibility === 'public' ? 'public' : 'private';
}

/**
 * Serialize project sharing information for API response
 * Includes owner with role='owner' and collaborators with role='editor'
 */
function serializeProjectSharing(
    project: any,
    owner: any,
    collaborators: any[],
    currentUserId: number | undefined,
    createGravatarUrl: (email: string | null | undefined, initials?: string | null, displayName?: string | null) => string = createGravatarUrlDefault
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
    const db = deps.db;  // Shadow global db

    // Session manager functions
    const { createSession, getSession, updateSession, deleteSession, getAllSessions, generateSessionId } =
        deps.sessionManager ?? defaultSessionManager;

    // File helper functions
    const { getOdeSessionTempDir, getOdeSessionDistDir, createSessionDirectories, cleanupSessionDirectories,
        getContentXmlPath, fileExists, readFileAsString, writeFile, appendFile, getFilesDir } =
        deps.fileHelper ?? defaultFileHelper;

    // Zip functions
    const { extractZip, extractZipFromBuffer, createZip, readFileFromZipAsString } =
        deps.zip ?? defaultZip;

    // Query functions
    const { createProject, findProjectById, findProjectByUuid, markProjectAsSaved, findSavedProjectsByOwner,
        findProjectsAsCollaborator, updateProjectVisibility, updateProjectVisibilityByUuid, getProjectCollaborators,
        addCollaborator, removeCollaborator, isCollaborator, transferOwnership, transferOwnershipByUuid,
        createProjectWithUuid, hardDeleteProject, findUserById, findUserByEmail, findFirstUser, createUser,
        checkProjectAccess, findSnapshotByProjectId, upsertSnapshot } =
        deps.queries ?? defaultQueries;

    // Utils
    const { createGravatarUrl } = deps.utils ?? defaultUtils;

    return new Elysia({ prefix: '/api/project' })
    .use(cookie())
    .use(jwt({
        name: 'jwt',
        secret: getJwtSecret(),
        exp: '7d',
    }))

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
            const payload = await jwt.verify(token) as { sub: number } | false;
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

        // Clean up files
        await cleanupSessionDirectories(params.id);

        // Remove from memory
        deleteSession(params.id);

        return { message: 'Session deleted successfully' };
    })

    // =====================================================
    // File Upload (Chunked)
    // =====================================================

    // POST /api/project/upload-chunk - Upload a file chunk
    .post('/upload-chunk', async ({ body, set }) => {
        try {
            const { odeFilePart, odeFileName, odeSessionId } = body as any;

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
        } catch (error: any) {
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
    })

    // =====================================================
    // Open ELP File
    // =====================================================

    // POST /api/project/open - Open an ELP file
    .post('/open', async ({ body, set, currentUser }) => {
        try {
            // Require authentication
            if (!currentUser) {
                set.status = 401;
                return { error: 'Unauthorized', message: 'Authentication required to open projects' };
            }

            const data = body as any;

            let filePath: string | undefined;
            let fileName: string | undefined;
            let shouldCleanup = false;

            // Mode 1: File path provided (after chunked upload)
            if (data.odeFilePath) {
                filePath = Array.isArray(data.odeFilePath) ? data.odeFilePath[0] : data.odeFilePath;
                fileName = Array.isArray(data.odeFileName) ? data.odeFileName[0] : data.odeFileName;

                if (!(await fileExists(filePath))) {
                    set.status = 400;
                    return { error: 'Bad Request', message: `File not found: ${filePath}` };
                }
                shouldCleanup = true;
            }
            // Mode 2: Direct file upload
            else if (data.file) {
                const file = data.file;
                fileName = file.name || 'uploaded.elp';

                // Save to temp location
                const tempDir = path.join(process.cwd(), 'temp');
                await fs.ensureDir(tempDir);
                filePath = path.join(tempDir, `${Date.now()}-${fileName}`);

                let fileBuffer: Buffer;
                if (file instanceof Blob) {
                    fileBuffer = Buffer.from(await file.arrayBuffer());
                } else if (Buffer.isBuffer(file)) {
                    fileBuffer = file;
                } else {
                    fileBuffer = Buffer.from(file);
                }

                await writeFile(filePath, fileBuffer);
                shouldCleanup = true;
            } else {
                set.status = 400;
                return {
                    error: 'Bad Request',
                    message: 'No file provided. Provide either file upload or odeFilePath parameter',
                };
            }

            // Generate new session ID
            const sessionId = generateSessionId();

            // Create session directories
            await createSessionDirectories(sessionId);

            // Extract ZIP to session temp directory
            const tempDir = getOdeSessionTempDir(sessionId);
            await extractZip(filePath!, tempDir);

            // Find and read content.xml
            const contentXmlPath = getContentXmlPath(sessionId);
            let structure: any = null;

            if (await fileExists(contentXmlPath)) {
                // For now, just mark that we have the file
                // XML parsing will be added in next phase
                structure = { loaded: true, path: contentXmlPath };
            }

            // Clean up uploaded file if needed
            if (shouldCleanup && filePath) {
                await fs.remove(filePath).catch(() => {});
            }

            // Create project in database with authenticated user as owner
            const userId = currentUser.id;
            const projectTitle = fileName?.replace('.elp', '') || 'Sin título';

            const projectRecord = await createProject(db, {
                title: projectTitle,
                owner_id: userId,
                saved_once: 0,
            });

            // Use project UUID as session ID for consistency
            const projectSessionId = projectRecord.uuid;

            // Create session with project UUID
            const session = createSession({
                sessionId: projectSessionId,
                fileName,
                filePath: tempDir,
                structure,
                userId,
            });

            // Move extracted files to new session directory
            const newTempDir = getOdeSessionTempDir(projectSessionId);
            if (sessionId !== projectSessionId) {
                await fs.ensureDir(newTempDir);
                await fs.copy(tempDir, newTempDir);
                await fs.remove(tempDir).catch(() => {});
            }

            console.log(`[Project] Created project ${projectRecord.uuid} for file ${fileName}`);

            return {
                success: true,
                sessionId: session.sessionId,
                fileName: session.fileName,
                projectId: projectRecord.id,
                projectUuid: projectRecord.uuid,
                message: 'Project opened successfully',
            };
        } catch (error: any) {
            set.status = 500;
            return {
                error: 'Internal Server Error',
                message: error.message,
            };
        }
    })

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

    // =====================================================
    // Export Project
    // =====================================================

    // POST /api/project/export - Export project to format
    .post('/export', async ({ body, set }) => {
        const data = body as any;
        const { sessionId, format = 'html5' } = data;

        const session = getSession(sessionId);
        if (!session) {
            set.status = 404;
            return { error: 'Not Found', message: 'Session not found' };
        }

        try {
            // Get export directory
            const distDir = getOdeSessionDistDir(sessionId);
            await fs.ensureDir(distDir);

            // Copy session files to dist
            const tempDir = getOdeSessionTempDir(sessionId);
            await fs.copy(tempDir, distDir, { overwrite: true });

            // Create ZIP of export
            const zipPath = path.join(distDir, `export-${format}.zip`);
            await createZip(distDir, zipPath);

            return {
                success: true,
                sessionId,
                format,
                exportPath: zipPath,
                message: `Project exported as ${format}`,
            };
        } catch (error: any) {
            set.status = 500;
            return {
                error: 'Internal Server Error',
                message: error.message,
            };
        }
    })

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

        const data = body as any;
        const title = data.title || 'New Project';

        // Create project in database with authenticated user as owner
        const userId = currentUser.id;

        const projectRecord = await createProject(db, {
            title,
            owner_id: userId,
            saved_once: 0,
        });

        // Use project UUID as session ID
        const sessionId = projectRecord.uuid;

        // Create session directories
        await createSessionDirectories(sessionId);

        // Create minimal content.xml
        const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.exelearning.net/ode/1.0">
    <properties>
        <title>${title}</title>
        <description></description>
        <author></author>
        <license></license>
        <createdAt>${new Date().toISOString()}</createdAt>
    </properties>
    <navigation>
        <page id="page_1" title="Home">
            <blocks />
        </page>
    </navigation>
</ode>`;

        // Write content.xml
        const contentXmlPath = getContentXmlPath(sessionId);
        await writeFile(contentXmlPath, contentXml);

        // Create session
        const session = createSession({
            sessionId,
            fileName: `${title}.elp`,
            filePath: getOdeSessionTempDir(sessionId),
            structure: { title, pages: 1 },
            userId,
        });

        console.log(`[Project] Created new project ${projectRecord.uuid} with title "${title}"`);

        return {
            success: true,
            uuid: session.sessionId,
            sessionId: session.sessionId,
            projectId: projectRecord.id,
            projectUuid: projectRecord.uuid,
            title,
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
        } catch (error: any) {
            console.warn(`[Project] Cleanup error:`, error);
            return { success: false, message: error.message };
        }
    });
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
    const { createSession, getSession, updateSession, deleteSession, getAllSessions, generateSessionId } =
        deps.sessionManager ?? defaultSessionManager;

    // File helper functions
    const { getOdeSessionTempDir, getOdeSessionDistDir, createSessionDirectories, cleanupSessionDirectories,
        getContentXmlPath, fileExists, readFileAsString, writeFile, appendFile, getFilesDir } =
        deps.fileHelper ?? defaultFileHelper;

    // Zip functions
    const { extractZip, extractZipFromBuffer, createZip, readFileFromZipAsString } =
        deps.zip ?? defaultZip;

    // Query functions
    const { createProject, findProjectById, findProjectByUuid, markProjectAsSaved, findSavedProjectsByOwner,
        findProjectsAsCollaborator, updateProjectVisibility, updateProjectVisibilityByUuid, getProjectCollaborators,
        addCollaborator, removeCollaborator, isCollaborator, transferOwnership, transferOwnershipByUuid,
        createProjectWithUuid, hardDeleteProject, findUserById, findUserByEmail, findFirstUser, createUser,
        checkProjectAccess, findSnapshotByProjectId, upsertSnapshot } =
        deps.queries ?? defaultQueries;

    // Utils
    const { createGravatarUrl } = deps.utils ?? defaultUtils;

    return new Elysia()
    .use(cookie())
    .use(jwt({
        name: 'jwt',
        secret: getJwtSecret(),
        exp: '7d',
    }))

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
            const payload = await jwt.verify(token) as { sub: number } | false;
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
        const projectId = parseInt(params.projectId);

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
        const projectId = parseInt(params.projectId);
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

        return { responseMessage: 'OK' };
    })

    // POST /api/projects/:projectId/collaborators - Add collaborator
    .post('/api/projects/:projectId/collaborators', async ({ params, body, set, currentUser }) => {
        const projectId = parseInt(params.projectId);
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
        const projectId = parseInt(params.projectId);
        const userId = parseInt(params.userId);

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

        return { responseMessage: 'OK' };
    })

    // PATCH /api/projects/:projectId/owner - Transfer ownership
    .patch('/api/projects/:projectId/owner', async ({ params, body, set, currentUser }) => {
        const projectId = parseInt(params.projectId);
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

        const data = body as any;
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
    // POST /api/ode-management/odes/ode/local/large/elp/open - Chunked upload (Symfony)
    .post('/api/ode-management/odes/ode/local/large/elp/open', async ({ body, set }) => {
        // Forward to upload-chunk logic
        try {
            const data = body as any;
            const odeFilePart = data.odeFilePart;
            const odeFileName = data.odeFileName;
            const odeSessionId = data.odeSessionId;

            if (!odeFilePart || !odeFileName || !odeSessionId) {
                set.status = 400;
                return {
                    responseMessage: 'error: odeFilePart, odeFileName, and odeSessionId are required',
                    success: false,
                };
            }

            const tempDir = getOdeSessionTempDir(odeSessionId);
            await fs.ensureDir(tempDir);

            const targetPath = path.join(tempDir, odeFileName);

            let chunkBuffer: Buffer;
            if (odeFilePart instanceof Blob) {
                chunkBuffer = Buffer.from(await odeFilePart.arrayBuffer());
            } else if (Buffer.isBuffer(odeFilePart)) {
                chunkBuffer = odeFilePart;
            } else {
                chunkBuffer = Buffer.from(odeFilePart);
            }

            await appendFile(targetPath, chunkBuffer);

            return {
                responseMessage: 'OK',
                odeFilePath: targetPath,
                odeFileName: odeFileName,
            };
        } catch (error: any) {
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
    })

    // POST /api/ode-management/odes/ode/local/elp/open - Open ELP (Symfony)
    .post('/api/ode-management/odes/ode/local/elp/open', async ({ body, set, currentUser }) => {
        try {
            // Require authentication
            if (!currentUser) {
                set.status = 401;
                return { responseMessage: 'error: Authentication required' };
            }

            const data = body as any;
            const odeFilePath = Array.isArray(data.odeFilePath) ? data.odeFilePath[0] : data.odeFilePath;
            const odeFileName = Array.isArray(data.odeFileName) ? data.odeFileName[0] : data.odeFileName;

            if (!odeFilePath) {
                set.status = 400;
                return { responseMessage: 'error: odeFilePath is required' };
            }

            if (!(await fileExists(odeFilePath))) {
                set.status = 400;
                return { responseMessage: `error: File not found: ${odeFilePath}` };
            }

            // Create project in database with authenticated user as owner
            const userId = currentUser.id;
            const projectTitle = odeFileName?.replace('.elp', '') || 'Sin título';

            const projectRecord = await createProject(db, {
                title: projectTitle,
                owner_id: userId,
                saved_once: 0,
            });

            // Use project UUID as session ID for consistency
            const sessionId = projectRecord.uuid;
            await createSessionDirectories(sessionId);

            // Extract
            const tempDir = getOdeSessionTempDir(sessionId);
            await extractZip(odeFilePath, tempDir);

            // Create session in memory
            const session = createSession({
                sessionId,
                fileName: odeFileName,
                filePath: tempDir,
                userId: currentUser.id,
            });

            // Copy ELP file to temp directory for frontend to fetch (instead of deleting)
            // This is needed because frontend's ElpxImporter will fetch and parse the ELP
            const importFileName = `${sessionId}.elp`;
            const importFilePath = path.join(tempDir, importFileName);
            await fs.copy(odeFilePath, importFilePath);

            // Clean up original uploaded file (the copy remains in tempDir)
            await fs.remove(odeFilePath).catch(() => {});

            console.log(`[Project] Created project ${projectRecord.uuid} for file ${odeFileName}`);

            // Return the import path for frontend to fetch ELP for ElpxImporter
            const elpImportPath = `/files/tmp/${sessionId}/${importFileName}`;

            return {
                responseMessage: 'OK',
                odeSessionId: session.sessionId,
                odeName: session.fileName,
                projectId: projectRecord.id,
                projectUuid: projectRecord.uuid,
                elpImportPath, // Path for frontend to fetch ELP for import
            };
        } catch (error: any) {
            console.error('[Project] Failed to open ELP:', error);
            return {
                responseMessage: `error: ${error.message}`,
            };
        }
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
                visibility: getDefaultProjectVisibility(),
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
        const userId = parseInt(params.userId);

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

        // Copy Yjs document state if exists, updating the title in metadata
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

    // POST /api/odes/local/large-elp/open - Alias for frontend (shorter path)
    .post('/api/odes/local/large-elp/open', async ({ body, set }) => {
        try {
            const data = body as any;
            const odeFilePart = data.odeFilePart;
            const odeFileName = data.odeFileName;
            const odeSessionId = data.odeSessionId;

            if (!odeFilePart || !odeFileName || !odeSessionId) {
                set.status = 400;
                return {
                    responseMessage: 'error: odeFilePart, odeFileName, and odeSessionId are required',
                    success: false,
                };
            }

            const tempDir = getOdeSessionTempDir(odeSessionId);
            await fs.ensureDir(tempDir);

            const targetPath = path.join(tempDir, odeFileName);

            let chunkBuffer: Buffer;
            if (odeFilePart instanceof Blob) {
                chunkBuffer = Buffer.from(await odeFilePart.arrayBuffer());
            } else if (Buffer.isBuffer(odeFilePart)) {
                chunkBuffer = odeFilePart;
            } else {
                chunkBuffer = Buffer.from(odeFilePart);
            }

            await appendFile(targetPath, chunkBuffer);

            return {
                responseMessage: 'OK',
                odeFilePath: targetPath,
                odeFileName: odeFileName,
            };
        } catch (error: any) {
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
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
        const data = body as any;
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
        const data = body as any;
        // In stateless mode, just acknowledge
        return {
            success: true,
            message: 'User registered (stateless mode)',
            odeSessionId: data.odeSessionId,
        };
    })

    // DELETE /api/odes/current-users - Unregister user from ODE (for collaboration)
    .delete('/api/odes/current-users', ({ query }) => {
        // In stateless mode, just acknowledge
        return {
            success: true,
            message: 'User unregistered (stateless mode)',
        };
    })

    // POST /api/odes/check-before-leave - Check if safe to leave (no other users editing)
    .post('/api/odes/check-before-leave', ({ body }) => {
        const data = body as any;
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
        const data = body as any;
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
        const data = body as any;
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
            return links.filter((link) => {
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
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    if (fetchError.name === 'AbortError') return 'Timeout';
                    const cause = fetchError.cause;
                    if (cause?.code === 'ENOTFOUND') return 'Could not resolve host';
                    if (cause?.code === 'ECONNREFUSED') return 'Connection refused';
                    return fetchError.message || 'Network error';
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
                brokenLinks: [{
                    brokenLinks: 'No broken links found',
                    nTimesBrokenLinks: null,
                    brokenLinksError: null,
                    pageNamesBrokenLinks: '',
                    blockNamesBrokenLinks: '',
                    typeComponentSyncBrokenLinks: '',
                    orderComponentSyncBrokenLinks: '',
                }],
            };
        }

        return {
            responseMessage: 'OK',
            brokenLinks: allBrokenLinks,
        };
    })

    // =====================================================
    // Utilities: Resources Report (usedfiles)
    // =====================================================

    // POST /api/ode-management/odes/session/usedfiles - Get used files report
    .post('/api/ode-management/odes/session/usedfiles', async ({ body }) => {
        const data = body as any;
        const idevices = data.idevices || [];
        const filesDir = getFilesDir();

        // Debug: log received data
        console.log(`[UsedFiles] Raw body keys:`, Object.keys(data));
        console.log(`[UsedFiles] idevices type:`, typeof data.idevices, Array.isArray(data.idevices));
        console.log(`[UsedFiles] Received ${idevices.length} idevices`);
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
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
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
        const getFileInfo = async (
            filePath: string,
            idevice: any,
        ): Promise<UsedFileInfo | null> => {
            try {
                // Handle asset:// URLs (stored in IndexedDB)
                if (filePath.startsWith('asset://')) {
                    const fileName = filePath.split('/').pop() || filePath;
                    return {
                        usedFiles: fileName,
                        usedFilesPath: filePath,
                        usedFilesSize: 'Stored in browser',
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
                usedFiles: [{
                    usedFiles: 'No files found',
                    usedFilesPath: '',
                    usedFilesSize: '',
                    pageNamesUsedFiles: '',
                    blockNamesUsedFiles: '',
                    typeComponentSyncUsedFiles: '',
                    orderComponentSyncUsedFiles: '',
                }],
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

    // POST /api/idevice-management/idevices/duplicate - Clone an iDevice
    .post('/api/idevice-management/idevices/duplicate', async ({ body }) => {
        const data = body as any;
        const { odeSessionId, ideviceId, targetBlockId } = data;

        // In stateless Yjs mode, cloning is handled client-side
        // This endpoint acknowledges the request and returns a new UUID
        const newIdeviceId = crypto.randomUUID();

        console.log(`[Project] Clone iDevice request: ${ideviceId} -> ${newIdeviceId} in block ${targetBlockId}`);

        return {
            responseMessage: 'OK',
            success: true,
            newIdeviceId,
            message: 'iDevice cloned (client-side Yjs mode)',
            odeSessionId,
            originalIdeviceId: ideviceId,
            targetBlockId,
        };
    })

    // POST /api/nav-structure-management/nav-structures/duplicate - Clone a page (nav-structure)
    .post('/api/nav-structure-management/nav-structures/duplicate', async ({ body }) => {
        const data = body as any;
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

    // POST /api/pag-structure-management/pag-structures/duplicate - Clone a block (pag-structure)
    .post('/api/pag-structure-management/pag-structures/duplicate', async ({ body }) => {
        const data = body as any;
        const { odeSessionId, pagStructureId, targetPageId } = data;

        // In stateless Yjs mode, cloning is handled client-side
        // This endpoint acknowledges the request and returns a new UUID
        const newPagStructureId = crypto.randomUUID();

        console.log(`[Project] Clone pag-structure request: ${pagStructureId} -> ${newPagStructureId}`);

        return {
            responseMessage: 'OK',
            success: true,
            newPagStructureId,
            message: 'Block cloned (client-side Yjs mode)',
            odeSessionId,
            originalPagStructureId: pagStructureId,
            targetPageId,
        };
    })

    // =====================================================
    // Save/Update Endpoints for Structure Management
    // =====================================================

    // PUT /api/nav-structure-management/nav-structures/nav/structure/data/save - Save page properties
    .put('/api/nav-structure-management/nav-structures/nav/structure/data/save', async ({ body }) => {
        const data = body as any;
        const { odeSessionId, navStructureId, properties } = data;

        // In stateless Yjs mode, saving is handled client-side
        console.log(`[Project] Save nav-structure properties: ${navStructureId}`);

        return {
            responseMessage: 'OK',
            success: true,
            message: 'Page properties saved (client-side Yjs mode)',
            odeSessionId,
            navStructureId,
        };
    })

    // PUT /api/nav-structure-management/nav-structures/reorder/save - Reorder pages
    .put('/api/nav-structure-management/nav-structures/reorder/save', async ({ body }) => {
        const data = body as any;
        const { odeSessionId, order } = data;

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
        const data = body as any;
        const { odeSessionId, pageId, order } = data;

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
        const data = body as any;
        const { odeSessionId, blockId, order } = data;

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
    });
}

// ============================================================================
// Default Instances (for backwards compatibility)
// ============================================================================

export const projectRoutes = createProjectRoutes();
export const symfonyCompatProjectRoutes = createSymfonyCompatProjectRoutes();
