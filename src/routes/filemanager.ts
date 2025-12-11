/**
 * Filemanager Routes for Elysia
 * Provides REST API for FileGator Vue.js file manager interface.
 * Handles all file operations within project session directories.
 *
 * Migrated from NestJS FilemanagerController
 * Uses Dependency Injection pattern for testability
 */
import { Elysia } from 'elysia';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';

import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    isPathSafe as isPathSafeDefault,
} from '../services/file-helper';
import {
    createZip as createZipDefault,
    extractZip as extractZipDefault,
} from '../services/zip';

// ============================================================================
// Types and Interfaces for Dependency Injection
// ============================================================================

/**
 * File helper dependencies
 */
export interface FilemanagerFileHelperDeps {
    getOdeSessionTempDir: typeof getOdeSessionTempDirDefault;
    isPathSafe: typeof isPathSafeDefault;
}

/**
 * ZIP service dependencies
 */
export interface FilemanagerZipDeps {
    createZip: typeof createZipDefault;
    extractZip: typeof extractZipDefault;
}

/**
 * All dependencies for filemanager routes
 */
export interface FilemanagerDependencies {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    fileHelper?: FilemanagerFileHelperDeps;
    zip?: FilemanagerZipDeps;
}

// Default dependencies
const defaultFileHelper: FilemanagerFileHelperDeps = {
    getOdeSessionTempDir: getOdeSessionTempDirDefault,
    isPathSafe: isPathSafeDefault,
};

const defaultZip: FilemanagerZipDeps = {
    createZip: createZipDefault,
    extractZip: extractZipDefault,
};

// FileGator configuration
const EDITABLE_EXTENSIONS = ['txt', 'css', 'js', 'ts', 'html', 'php', 'json', 'md'];
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

// In-memory session storage for filemanager state
const filemanagerSessions = new Map<string, {
    odeSessionId: string;
    currentPath: string;
}>();

/**
 * Generate HTML for FileGator Vue.js app
 */
function generateFileGatorHTML(publicPath: string): string {
    return `<!DOCTYPE html>
<html lang=en>
  <head>
    <meta charset=utf-8>
    <meta http-equiv=X-UA-Compatible content="IE=edge">
    <meta name=viewport content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Filemanager</title>
  </head>
  <body>
    <div id=app></div>
  </body>
  <script>
    function loadFile(url) {
      var s;
      var base = "${publicPath}";
      if (top && typeof(top.eXeLearning) == "object") {
        if (top.window.location.href.indexOf("https://")==0 && base.indexOf("http://")==0) {
          base = base.replace("http://", "https://");
        }
        base = base.replace("/libs/", "/assets/" + top.eXeLearning.version + "/libs/");
        if (url.split(".").pop() == "css") {
          s = document.createElement("link");
          s.rel = "stylesheet";
          s.href = base + url;
        } else {
          s = document.createElement("script");
          s.src = base + url;
        }
        document.getElementsByTagName("head")[0].appendChild(s);
      }
    }
    loadFile("css/app.css");
    loadFile("css/chunk-vendors.css");
    loadFile("js/app.js");
    loadFile("js/chunk-vendors.js");
  </script>
</html>`;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create filemanager routes with injected dependencies
 */
export function createFilemanagerRoutes(deps: FilemanagerDependencies = {}): Elysia {
    // Shadow imports with injected dependencies
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const { getOdeSessionTempDir, isPathSafe } = deps.fileHelper ?? defaultFileHelper;
    const { createZip, extractZip } = deps.zip ?? defaultZip;

    // ========================================================================
    // Internal Helper Functions (use injected deps)
    // ========================================================================

    /**
     * Get filemanager directory for a session
     */
    async function getFilemanagerDirectory(odeSessionId: string): Promise<string> {
        const sessionDir = getOdeSessionTempDir(odeSessionId);
        const filemanagerDir = path.join(sessionDir, 'file_manager');
        await fs.ensureDir(filemanagerDir);
        return filemanagerDir;
    }

    /**
     * Get chunk file path for Resumable.js uploads
     */
    function getChunkPath(
        odeSessionId: string,
        filename: string,
        identifier: string,
        chunkNumber: number,
    ): string {
        const tempDir = getOdeSessionTempDir(odeSessionId);
        const sanitizedIdentifier = identifier.replace(/[^0-9a-zA-Z_]/g, '');
        const chunkFilename = `multipart_${sanitizedIdentifier}${filename}.part${chunkNumber}`;
        return path.join(tempDir, chunkFilename);
    }

    /**
     * List directory contents in FileGator format
     */
    async function listDirectory(odeSessionId: string, relativePath: string = ''): Promise<any> {
        const filemanagerDir = await getFilemanagerDirectory(odeSessionId);
        const targetDir = path.join(filemanagerDir, relativePath);

        // Security: validate path is within filemanager directory
        if (!isPathSafe(filemanagerDir, targetDir)) {
            throw new Error('Invalid path: Path traversal detected');
        }

        if (!(await fs.pathExists(targetDir))) {
            return { location: relativePath || '/', files: [] };
        }

        const items = await fs.readdir(targetDir);
        const fileList = [];

        for (const item of items) {
            const itemPath = path.join(targetDir, item);
            const stats = await fs.stat(itemPath);

            let itemRelativePath: string;
            if (!relativePath || relativePath === '/') {
                itemRelativePath = item;
            } else {
                itemRelativePath = `${relativePath}/${item}`;
            }

            fileList.push({
                name: item,
                path: itemRelativePath,
                type: stats.isDirectory() ? 'dir' : 'file',
                size: stats.size,
                time: Math.floor(stats.mtime.getTime() / 1000),
                permissions: stats.mode,
            });
        }

        return { location: relativePath || '/', files: fileList };
    }

    // ========================================================================
    // Routes
    // ========================================================================

    return new Elysia({ prefix: '/filemanager' })

    // =====================================================
    // Load FileGator Vue.js Interface
    // =====================================================

    // GET /filemanager/index/:plugin/:sessionId
    .get('/index/:plugin/:sessionId', async ({ params, request, set }) => {
        const { plugin, sessionId } = params;

        // Store session for subsequent requests
        filemanagerSessions.set(sessionId, {
            odeSessionId: sessionId,
            currentPath: '/',
        });

        // Get base URL from request
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const publicPath = `${baseUrl}/libs/filegator/`;

        const html = generateFileGatorHTML(publicPath);
        set.headers['content-type'] = 'text/html';
        return html;
    })

    // =====================================================
    // Configuration
    // =====================================================

    // GET /filemanager/getconfig
    .get('/getconfig', () => {
        return {
            data: {
                adapter: 'local',
                multiple_uploads: true,
                has_login: false,
                upload_max_size: MAX_UPLOAD_SIZE,
                upload_chunk_size: 1 * 1024 * 1024, // 1MB chunks
                guest_redirection: '',
                search_buffer_size: 20,
                overwrite_on_upload: false,
                editable: EDITABLE_EXTENSIONS,
                date_format: 'Y-m-d H:i:s',
                loaded: true,
            },
        };
    })

    // =====================================================
    // Directory Operations
    // =====================================================

    // POST /filemanager/getdir - List directory contents
    .post('/getdir', async ({ body, cookie }) => {
        const data = body as any;
        const dir = data.dir || '';
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return {
                data: {
                    error: 'Session not found',
                    location: '/',
                    files: [],
                },
            };
        }

        try {
            const result = await listDirectory(sessionId, dir);
            return { data: result };
        } catch (error: any) {
            return {
                data: {
                    error: error.message,
                    location: dir || '/',
                    files: [],
                },
            };
        }
    })

    // POST /filemanager/changedir - Change directory
    .post('/changedir', async ({ body, cookie }) => {
        const data = body as any;
        const to = data.to || '';
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return { data: { error: 'Session not found' } };
        }

        try {
            const result = await listDirectory(sessionId, to);
            return { data: result };
        } catch (error: any) {
            return { data: { error: error.message } };
        }
    })

    // =====================================================
    // File/Folder Operations
    // =====================================================

    // POST /filemanager/createnew - Create new file or folder
    .post('/createnew', async ({ body, cookie }) => {
        const data = body as any;
        const type = data.type as 'file' | 'dir';
        const name = data.name;
        const itemPath = data.path || '';
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return { data: { error: 'Session not found' } };
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const fullPath = itemPath ? `${itemPath}/${name}` : name;
            const targetPath = path.join(filemanagerDir, fullPath);

            if (!isPathSafe(filemanagerDir, targetPath)) {
                throw new Error('Invalid path: Path traversal detected');
            }

            if (type === 'dir') {
                await fs.ensureDir(targetPath);
            } else {
                await fs.ensureFile(targetPath);
            }

            return { data: 'Done' };
        } catch (error: any) {
            return { data: { error: error.message } };
        }
    })

    // POST /filemanager/deleteitems - Delete files or folders
    .post('/deleteitems', async ({ body, cookie }) => {
        const data = body as any;
        const items = data.items || [];
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);

            for (const item of items) {
                const targetPath = path.join(filemanagerDir, item.path);

                if (!isPathSafe(filemanagerDir, targetPath)) {
                    throw new Error('Invalid path: Path traversal detected');
                }

                await fs.remove(targetPath);
            }

            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // POST /filemanager/renameitem - Rename file or folder
    .post('/renameitem', async ({ body, cookie }) => {
        const data = body as any;
        const destination = data.destination || '';
        const oldName = data.from;
        const newName = data.to;
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const itemPath = destination && destination !== '/' ? `${destination}/${oldName}` : oldName;
            const sourcePath = path.join(filemanagerDir, itemPath);
            const destPath = path.join(path.dirname(sourcePath), newName);

            if (!isPathSafe(filemanagerDir, sourcePath) || !isPathSafe(filemanagerDir, destPath)) {
                throw new Error('Invalid path: Path traversal detected');
            }

            await fs.move(sourcePath, destPath);
            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // POST /filemanager/copyitems - Copy files or folders
    .post('/copyitems', async ({ body, cookie }) => {
        const data = body as any;
        const items = data.items || [];
        const destination = data.destination || '';
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const destPath = path.join(filemanagerDir, destination);

            if (!isPathSafe(filemanagerDir, destPath)) {
                throw new Error('Invalid destination path');
            }

            for (const item of items) {
                const sourcePath = path.join(filemanagerDir, item.path);
                const targetPath = path.join(destPath, path.basename(item.path));

                if (!isPathSafe(filemanagerDir, sourcePath)) {
                    throw new Error('Invalid source path');
                }

                await fs.copy(sourcePath, targetPath);
            }

            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // POST /filemanager/moveitems - Move files or folders
    .post('/moveitems', async ({ body, cookie }) => {
        const data = body as any;
        const items = data.items || [];
        const destination = data.destination || '';
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const destPath = path.join(filemanagerDir, destination);

            if (!isPathSafe(filemanagerDir, destPath)) {
                throw new Error('Invalid destination path');
            }

            for (const item of items) {
                const sourcePath = path.join(filemanagerDir, item.path);
                const targetPath = path.join(destPath, path.basename(item.path));

                if (!isPathSafe(filemanagerDir, sourcePath)) {
                    throw new Error('Invalid source path');
                }

                await fs.move(sourcePath, targetPath);
            }

            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // =====================================================
    // Download
    // =====================================================

    // GET /filemanager/download&path=:path - Download file
    .get('/download', async ({ query, cookie, set }) => {
        const filePath = query.path as string;
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            set.status = 404;
            return 'Session not found';
        }

        try {
            // Decode base64 path (Symfony encodes it)
            const decodedPath = Buffer.from(filePath, 'base64').toString('utf-8');

            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const absolutePath = path.join(filemanagerDir, decodedPath);

            if (!isPathSafe(filemanagerDir, absolutePath)) {
                set.status = 400;
                return 'Invalid path';
            }

            if (!(await fs.pathExists(absolutePath))) {
                set.status = 404;
                return 'File not found';
            }

            const fileContent = await fs.readFile(absolutePath);
            const fileName = decodedPath.split('/').pop() || 'download';

            set.headers['content-type'] = 'application/octet-stream';
            set.headers['content-disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`;
            return fileContent;
        } catch (error: any) {
            set.status = 500;
            return error.message;
        }
    })

    // =====================================================
    // Upload (Chunked - Resumable.js compatible)
    // =====================================================

    // GET /filemanager/upload - Check if chunk exists
    .get('/upload', async ({ query, cookie, set }) => {
        const filename = query.resumableFilename as string;
        const identifier = query.resumableIdentifier as string;
        const chunkNumber = parseInt(query.resumableChunkNumber as string, 10);
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            set.status = 404;
            return 'Session not found';
        }

        try {
            const chunkPath = getChunkPath(sessionId, filename || 'file', identifier, chunkNumber);
            const exists = await fs.pathExists(chunkPath);

            if (exists) {
                set.status = 200;
                return 'Chunk exists';
            } else {
                set.status = 204;
                return;
            }
        } catch (error: any) {
            set.status = 500;
            return error.message;
        }
    })

    // POST /filemanager/upload - Upload a chunk
    .post('/upload', async ({ body, cookie }) => {
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const data = body as any;
            const file = data.file;

            if (!file) {
                return 'No file uploaded';
            }

            // Get file buffer
            let buffer: Buffer;
            if (file instanceof Blob) {
                buffer = Buffer.from(await file.arrayBuffer());
            } else if (Buffer.isBuffer(file)) {
                buffer = file;
            } else {
                buffer = Buffer.from(file);
            }

            const filename = data.resumableFilename || (file as any).name || 'file';
            const identifier = data.resumableIdentifier || '';
            const chunkNumber = parseInt(data.resumableChunkNumber || '1', 10);
            const totalChunks = parseInt(data.resumableTotalChunks || '1', 10);
            const relativePath = data.resumableRelativePath;

            // Sanitize upload path
            const uploadPath =
                relativePath &&
                relativePath !== 'undefined' &&
                relativePath !== 'null' &&
                relativePath.trim() !== ''
                    ? relativePath.trim()
                    : '/';

            // Save the chunk
            const chunkPath = getChunkPath(sessionId, filename, identifier, chunkNumber);
            await fs.writeFile(chunkPath, buffer);

            // Check if all chunks have been uploaded
            let allChunksReceived = true;
            for (let i = 1; i <= totalChunks; i++) {
                const checkPath = getChunkPath(sessionId, filename, identifier, i);
                if (!(await fs.pathExists(checkPath))) {
                    allChunksReceived = false;
                    break;
                }
            }

            if (allChunksReceived) {
                // Assemble all chunks into final file
                const filemanagerDir = await getFilemanagerDirectory(sessionId);
                const finalPath = path.join(filemanagerDir, uploadPath, filename);

                await fs.ensureDir(path.dirname(finalPath));

                const writeStream = fs.createWriteStream(finalPath);

                for (let i = 1; i <= totalChunks; i++) {
                    const chunkFilePath = getChunkPath(sessionId, filename, identifier, i);
                    const chunkData = await fs.readFile(chunkFilePath);
                    writeStream.write(chunkData);
                }

                writeStream.end();

                await new Promise<void>((resolve, reject) => {
                    writeStream.on('finish', () => resolve());
                    writeStream.on('error', (err) => reject(err));
                });

                // Clean up chunks
                for (let i = 1; i <= totalChunks; i++) {
                    const chunkFilePath = getChunkPath(sessionId, filename, identifier, i);
                    await fs.remove(chunkFilePath);
                }

                return 'Stored';
            }

            return 'Uploaded';
        } catch (error: any) {
            return error.message;
        }
    })

    // =====================================================
    // Content Operations
    // =====================================================

    // POST /filemanager/savecontent - Save edited file content
    .post('/savecontent', async ({ body, cookie }) => {
        const data = body as any;
        const filePath = data.path;
        const content = data.content;
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const absolutePath = path.join(filemanagerDir, filePath);

            if (!isPathSafe(filemanagerDir, absolutePath)) {
                throw new Error('Invalid path');
            }

            await fs.writeFile(absolutePath, content, 'utf-8');
            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // POST /filemanager/getpath - Get relative path for a file
    .post('/getpath', ({ body }) => {
        const data = body as any;
        return { path: data.item || '' };
    })

    // =====================================================
    // ZIP Operations
    // =====================================================

    // POST /filemanager/zipitems - Zip files or folders
    .post('/zipitems', async ({ body, cookie }) => {
        const data = body as any;
        const items = data.items || [];
        const destination = data.destination || '';
        const name = data.name;
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const destDir = path.join(filemanagerDir, destination);

            if (!isPathSafe(filemanagerDir, destDir)) {
                throw new Error('Invalid destination path');
            }

            await fs.ensureDir(destDir);

            // Use provided name or generate from first item
            let zipFileName: string;
            if (name) {
                zipFileName = name.endsWith('.zip') ? name : `${name}.zip`;
            } else {
                const firstItemPath = items[0]?.path || 'archive';
                const baseName = path.basename(firstItemPath, path.extname(firstItemPath));
                zipFileName = `${baseName}.zip`;
            }

            const zipFilePath = path.join(destDir, zipFileName);

            if (await fs.pathExists(zipFilePath)) {
                throw new Error(`File ${zipFileName} already exists`);
            }

            // Create temporary directory for zip contents
            const tempDir = path.join(filemanagerDir, '.temp-zip-' + Date.now());
            await fs.ensureDir(tempDir);

            try {
                // Copy all items to temp directory
                for (const item of items) {
                    const sourcePath = path.join(filemanagerDir, item.path);

                    if (!isPathSafe(filemanagerDir, sourcePath)) {
                        throw new Error('Invalid source path');
                    }

                    if (!(await fs.pathExists(sourcePath))) {
                        throw new Error(`Source not found: ${item.path}`);
                    }

                    const destItemPath = path.join(tempDir, path.basename(item.path));
                    await fs.copy(sourcePath, destItemPath);
                }

                // Create zip file
                await createZip(tempDir, zipFilePath);
            } finally {
                // Clean up temp directory
                if (await fs.pathExists(tempDir)) {
                    await fs.remove(tempDir);
                }
            }

            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    })

    // POST /filemanager/unzipitem - Unzip a file
    .post('/unzipitem', async ({ body, cookie }) => {
        const data = body as any;
        const itemPath = data.item;
        const destination = data.destination;
        const sessionId = cookie.odeSessionId?.value;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const filemanagerDir = await getFilemanagerDirectory(sessionId);
            const sourcePath = path.join(filemanagerDir, itemPath);

            if (!isPathSafe(filemanagerDir, sourcePath)) {
                throw new Error('Invalid source path');
            }

            if (!(await fs.pathExists(sourcePath))) {
                throw new Error(`File not found: ${itemPath}`);
            }

            const ext = path.extname(itemPath).toLowerCase();
            if (ext !== '.zip') {
                throw new Error('Only .zip files can be unzipped');
            }

            // Determine extraction directory
            let extractDir: string;
            if (destination) {
                extractDir = path.join(filemanagerDir, destination);
            } else {
                extractDir = path.dirname(sourcePath);
            }

            if (!isPathSafe(filemanagerDir, extractDir)) {
                throw new Error('Invalid extraction path');
            }

            await fs.ensureDir(extractDir);
            await extractZip(sourcePath, extractDir);

            return 'Done';
        } catch (error: any) {
            return error.message;
        }
    });
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

export const filemanagerRoutes = createFilemanagerRoutes();
