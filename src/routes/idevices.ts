/**
 * iDevices Routes for Elysia
 * Handles installed iDevices listing and management
 */
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import { getFilesDir } from '../services/file-helper';
import { getAppVersion } from '../utils/version';
import { getBasePath } from '../utils/basepath.util';
import type { IdeviceFileUploadRequest } from './types/request-payloads';

/**
 * Response data for file upload
 */
interface UploadResponseData {
    odeSessionId: string;
    odeIdeviceId: string;
    originalFilename: string;
    savedPath: string;
    savedFilename: string;
    savedFileSize: string;
    savedThumbnailName?: string;
}

/**
 * File with optional name property (for Blob/File uploads)
 */
interface FileWithName extends Blob {
    name?: string;
}

// Base path for iDevices
const IDEVICES_BASE_PATH = 'public/files/perm/idevices/base';
const IDEVICES_USERS_PATH = 'public/files/perm/idevices/users';

interface IdeviceConfig {
    id: string;
    title: string;
    cssClass: string;
    category: string;
    icon: {
        name: string;
        url: string;
        type: string;
    };
    version: string;
    apiVersion: string;
    componentType: string;
    author: string;
    authorUrl: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: boolean;
    url: string;
    editionJs: string[];
    editionCss: string[];
    exportJs: string[];
    exportCss: string[];
    editionTemplateFilename: string;
    exportTemplateFilename: string;
    editionTemplateContent: string;
    exportTemplateContent: string;
    location: string;
    locationType: string;
    exportObject: string; // Global JS object name for export rendering (e.g., '$text')
}

/**
 * Read template file content safely
 */
function readTemplateContent(basePath: string, folder: string, filename: string): string {
    if (!filename) return '';
    try {
        const templatePath = path.join(basePath, folder, filename);
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf-8');
        }
    } catch {
        // Ignore errors, return empty string
    }
    return '';
}

/**
 * Parse iDevice config.xml
 */
function parseIdeviceConfig(xmlContent: string, ideviceId: string, basePath: string): IdeviceConfig | null {
    try {
        // Simple XML parsing (no external dependency needed)
        const getValue = (tag: string): string => {
            const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            return match ? match[1].trim() : '';
        };

        const getNestedValue = (parent: string, child: string): string => {
            const parentMatch = xmlContent.match(new RegExp(`<${parent}>([\\s\\S]*?)<\\/${parent}>`));
            if (!parentMatch) return '';
            const childMatch = parentMatch[1].match(new RegExp(`<${child}>([\\s\\S]*?)<\\/${child}>`));
            return childMatch ? childMatch[1].trim() : '';
        };

        // Parse list of filenames and verify they exist on disk
        const getValidFilenames = (tag: string, subfolder: 'edition' | 'export'): string[] => {
            const parentMatch = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));

            let filenames: string[];
            if (!parentMatch) {
                // No explicit files specified - scan folder for all matching files
                // This ensures dependencies like html2canvas.js are included
                const folderPath = path.join(basePath, subfolder);
                const extension = tag.includes('js') ? '.js' : '.css';
                if (fs.existsSync(folderPath)) {
                    try {
                        filenames = fs
                            .readdirSync(folderPath)
                            .filter(
                                file =>
                                    file.endsWith(extension) && !file.includes('.test.') && !file.includes('.spec.'),
                            )
                            .sort((a, b) => {
                                // Put main iDevice file first, then alphabetically
                                if (a === `${ideviceId}${extension}`) return -1;
                                if (b === `${ideviceId}${extension}`) return 1;
                                return a.localeCompare(b);
                            });
                    } catch {
                        filenames = [`${ideviceId}${extension}`];
                    }
                } else {
                    filenames = [`${ideviceId}${extension}`];
                }
            } else {
                filenames = [];
                const filenameMatches = parentMatch[1].matchAll(/<filename>([^<]+)<\/filename>/g);
                for (const match of filenameMatches) {
                    filenames.push(match[1].trim());
                }
                if (filenames.length === 0) {
                    filenames = [`${ideviceId}.${tag.includes('js') ? 'js' : 'css'}`];
                }
            }

            // Filter to only include files that actually exist on disk
            return filenames.filter(filename => {
                const filePath = path.join(basePath, subfolder, filename);
                return fs.existsSync(filePath);
            });
        };

        // Handle icon - can be simple string or nested object
        let icon = {
            name: `${ideviceId}-icon`,
            url: `${ideviceId}-icon.svg`,
            type: 'img',
        };
        const iconContent = getValue('icon');
        if (iconContent && !iconContent.includes('<')) {
            // Simple icon name (like "lightbulb")
            icon = { name: iconContent, url: iconContent, type: 'icon' };
        } else if (iconContent) {
            // Nested icon structure
            icon = {
                name: getNestedValue('icon', 'name') || `${ideviceId}-icon`,
                url: getNestedValue('icon', 'url') || `${ideviceId}-icon.svg`,
                type: getNestedValue('icon', 'type') || 'img',
            };
        }

        // Get template filenames
        const editionTemplateFilename = getValue('edition-template-filename') || '';
        const exportTemplateFilename = getValue('export-template-filename') || '';

        // Read template content from files
        const editionTemplateContent = readTemplateContent(basePath, 'edition', editionTemplateFilename);
        const exportTemplateContent = readTemplateContent(basePath, 'export', exportTemplateFilename);

        // exportObject is the global JS object name used for rendering (e.g., '$text')
        // Can be specified in config.xml or defaults to '$' + ideviceId (without dashes)
        // This must match frontend's getIdeviceObjectKey(): '$' + this.id.split('-').join('')
        const exportObject = getValue('export-object') || `$${ideviceId.split('-').join('')}`;

        return {
            id: ideviceId,
            title: getValue('title') || ideviceId,
            cssClass: getValue('css-class') || ideviceId,
            category: getValue('category') || 'Uncategorized',
            icon,
            version: getValue('version') || '1.0',
            apiVersion: getValue('api-version') || '3.0',
            componentType: getValue('component-type') || 'html',
            author: getValue('author') || '',
            authorUrl: getValue('author-url') || '',
            license: getValue('license') || '',
            licenseUrl: getValue('license-url') || '',
            description: getValue('description') || '',
            downloadable: getValue('downloadable') === '1',
            url: basePath,
            editionJs: getValidFilenames('edition-js', 'edition'),
            editionCss: getValidFilenames('edition-css', 'edition'),
            exportJs: getValidFilenames('export-js', 'export'),
            exportCss: getValidFilenames('export-css', 'export'),
            editionTemplateFilename,
            exportTemplateFilename,
            editionTemplateContent,
            exportTemplateContent,
            location: getValue('location') || '',
            locationType: getValue('location-type') || '',
            exportObject,
        };
    } catch {
        return null;
    }
}

/**
 * Scan iDevices directory and return list
 */
function scanIdevices(basePath: string): IdeviceConfig[] {
    const idevices: IdeviceConfig[] = [];

    if (!fs.existsSync(basePath)) {
        return idevices;
    }

    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }

        const configPath = path.join(basePath, entry.name, 'config.xml');
        if (fs.existsSync(configPath)) {
            const xmlContent = fs.readFileSync(configPath, 'utf-8');
            const config = parseIdeviceConfig(xmlContent, entry.name, path.join(basePath, entry.name));
            if (config) {
                idevices.push(config);
            }
        }
    }

    return idevices;
}

/**
 * iDevices routes
 */
export const idevicesRoutes = new Elysia({ name: 'idevices-routes' })
    // GET /api/idevices/installed - Get list of installed iDevices
    .get('/api/idevices/installed', () => {
        const baseIdevices = scanIdevices(IDEVICES_BASE_PATH);
        const userIdevices = scanIdevices(IDEVICES_USERS_PATH);

        // Merge user iDevices with base, user takes priority
        const ideviceMap = new Map<string, IdeviceConfig>();
        const version = getAppVersion();

        for (const idevice of baseIdevices) {
            ideviceMap.set(idevice.id, { ...idevice, url: `/${version}/files/perm/idevices/base/${idevice.id}` });
        }

        for (const idevice of userIdevices) {
            ideviceMap.set(idevice.id, { ...idevice, url: `/${version}/files/perm/idevices/users/${idevice.id}` });
        }

        const result = Array.from(ideviceMap.values());

        // Sort by category then title
        result.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.title.localeCompare(b.title);
        });

        // Frontend expects { idevices: [...] } format with 'name' property
        return {
            idevices: result.map(idevice => ({
                ...idevice,
                name: idevice.id, // Frontend uses 'name' to identify iDevices
            })),
        };
    })

    // GET /api/idevices/installed/:ideviceId - Get specific iDevice
    .get('/api/idevices/installed/:ideviceId', ({ params, set }) => {
        const { ideviceId } = params;

        // Check user iDevices first
        let configPath = path.join(IDEVICES_USERS_PATH, ideviceId, 'config.xml');
        let basePath = path.join(IDEVICES_USERS_PATH, ideviceId);

        if (!fs.existsSync(configPath)) {
            // Fall back to base iDevices
            configPath = path.join(IDEVICES_BASE_PATH, ideviceId, 'config.xml');
            basePath = path.join(IDEVICES_BASE_PATH, ideviceId);
        }

        if (!fs.existsSync(configPath)) {
            set.status = 404;
            return { error: 'Not Found', message: `iDevice ${ideviceId} not found` };
        }

        const xmlContent = fs.readFileSync(configPath, 'utf-8');
        const config = parseIdeviceConfig(xmlContent, ideviceId, basePath);

        if (!config) {
            set.status = 500;
            return { error: 'Parse Error', message: 'Failed to parse iDevice config' };
        }

        return config;
    })

    // GET /api/idevices/download-file-resources - Download iDevice/theme file resources
    .get('/api/idevices/download-file-resources', async ({ query, set }) => {
        const resource = query.resource as string;

        if (!resource) {
            set.status = 400;
            return { error: 'Bad Request', message: 'resource parameter required' };
        }

        // Security: prevent path traversal
        const cleanResource = resource.replace(/\.\./g, '').replace(/^\/+/, '');
        let filePath = path.join('public/files', cleanResource);
        let resolvedPath = path.resolve(filePath);
        let basePath = path.resolve('public/files');

        // Check if file exists in public/files, if not check FILES_DIR for user themes
        if (!fs.existsSync(filePath) && cleanResource.startsWith('perm/themes/users/')) {
            // User themes may be in FILES_DIR/themes/users/ instead of public/files/perm/themes/users/
            const filesDir = process.env.ELYSIA_FILES_DIR || process.env.FILES_DIR || '/mnt/data';
            const themeRelativePath = cleanResource.replace('perm/themes/users/', '');
            filePath = path.join(filesDir, 'themes', 'users', themeRelativePath);
            resolvedPath = path.resolve(filePath);
            basePath = path.resolve(path.join(filesDir, 'themes', 'users'));
        }

        // Additional security check
        if (!resolvedPath.startsWith(basePath)) {
            set.status = 403;
            return { error: 'Forbidden', message: 'Access denied' };
        }

        if (!fs.existsSync(filePath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Resource not found: ${cleanResource}` };
        }

        const ext = path.extname(filePath).toLowerCase();

        // Set content type based on extension
        const mimeTypes: Record<string, string> = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.xml': 'application/xml',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
        };

        set.headers['Content-Type'] = mimeTypes[ext] || 'application/octet-stream';

        // For CSS files, rewrite relative URLs to absolute API endpoint URLs
        if (ext === '.css') {
            const content = fs.readFileSync(filePath, 'utf-8');
            return rewriteCSSUrls(content, cleanResource);
        }

        return fs.readFileSync(filePath);
    })

    // POST /api/idevices/upload/file/resources - Upload file resource (base64)
    .post('/api/idevices/upload/file/resources', async ({ body, cookie, set, request }) => {
        // Debug: log what we're receiving
        console.log('[idevices/upload] Content-Type:', request.headers.get('content-type'));
        console.log('[idevices/upload] Body type:', typeof body);
        const bodyObj = body as Record<string, unknown> | null;
        console.log('[idevices/upload] Body keys:', bodyObj ? Object.keys(bodyObj) : 'null');

        const data = body as IdeviceFileUploadRequest;
        const odeIdeviceId = data?.odeIdeviceId;
        // Support both 'file' (legacy) and 'base64String' fields for base64 data
        const dataRecord = data as Record<string, unknown>;
        const fileFieldValue = dataRecord?.file;
        const fileAsString = typeof fileFieldValue === 'string' ? fileFieldValue : undefined;
        const base64String = data?.base64String || fileAsString;
        const filename = data?.filename;
        // Support both boolean and string 'true' for createThumbnail
        const createThumbnailRaw = data?.createThumbnail;
        const createThumbnail = createThumbnailRaw === true || createThumbnailRaw === 'true';

        // Validate required parameters
        if (!odeIdeviceId || !base64String || !filename) {
            set.status = 400;
            console.log('[idevices/upload] Missing params:', {
                odeIdeviceId: !!odeIdeviceId,
                file: !!base64String,
                filename: !!filename,
            });
            return {
                code: 'error: invalid data',
                details: { odeIdeviceId: !!odeIdeviceId, file: !!base64String, filename: !!filename },
            };
        }

        // Get session ID from cookie or body
        // In Yjs mode, we use projectId cookie instead of odeSessionId
        let odeSessionId = data.odeSessionId || cookie.odeSessionId?.value || cookie.projectId?.value;

        // If no session ID, use a default based on the idevice ID
        // This allows uploads to work even without a traditional session
        if (!odeSessionId) {
            // Extract project ID from odeIdeviceId if it contains one, or use a temp directory
            odeSessionId = 'uploads';
        }

        // Clean filename
        let cleanFilename = filename.replace(/ /g, '_');
        cleanFilename = cleanFilename.replace(/[^A-Za-z0-9_\-.]/g, '');

        // Ensure we have a valid filename
        if (!cleanFilename) {
            cleanFilename = 'file_' + Date.now();
        }

        // Get iDevice directory
        const filesDir = getFilesDir();
        const iDeviceDir = path.join(filesDir, 'tmp', odeSessionId, 'content', 'resources', odeIdeviceId);

        // Ensure directory exists
        await fse.ensureDir(iDeviceDir);

        // Generate unique filename if file already exists
        let savedFilename = cleanFilename;
        let counter = 0;
        const ext = path.extname(cleanFilename);
        const baseName = path.basename(cleanFilename, ext);
        while (await fse.pathExists(path.join(iDeviceDir, savedFilename))) {
            counter++;
            savedFilename = `${baseName}_${counter}${ext}`;
        }

        const outputFile = path.join(iDeviceDir, savedFilename);

        // Decode base64 and write file
        const dataParts = base64String.split(',');
        const base64Data = dataParts.length > 1 ? dataParts[1] : dataParts[0];
        const buffer = Buffer.from(base64Data, 'base64');

        await fse.writeFile(outputFile, buffer);

        // Get file size
        const stats = await fse.stat(outputFile);
        const fileSize = stats.size;
        const fileSizeFormatted = formatFileSize(fileSize);

        // Build response
        const responseData: UploadResponseData = {
            odeSessionId,
            odeIdeviceId,
            originalFilename: filename,
            savedPath: `/files/tmp/${odeSessionId}/content/resources/${odeIdeviceId}/`,
            savedFilename,
            savedFileSize: fileSizeFormatted,
        };

        // Create thumbnail for images if requested
        if (createThumbnail) {
            // Try to detect mime type from data URL
            let mimeType = dataParts[0]?.match(/data:([^;]+)/)?.[1] || '';

            // Fallback: detect from filename extension if data URL doesn't have mime
            if (!mimeType && filename) {
                const ext = path.extname(filename).toLowerCase();
                const extToMime: Record<string, string> = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                };
                mimeType = extToMime[ext] || '';
            }

            const thumbValidMimeTypes = ['image/jpeg', 'image/gif', 'image/png'];
            if (thumbValidMimeTypes.includes(mimeType)) {
                // Simple thumbnail: just use the same file for now
                // TODO: Implement proper thumbnail generation with sharp or similar
                const thumbFilename = `thumb_${savedFilename}`;
                const thumbPath = path.join(iDeviceDir, thumbFilename);
                await fse.copyFile(outputFile, thumbPath);
                responseData.savedThumbnailName = thumbFilename;
            }
        }

        return responseData;
    })

    // POST /api/idevices/upload/large/file/resources - Upload large file resource (FormData)
    .post('/api/idevices/upload/large/file/resources', async ({ body, cookie, set }) => {
        const data = body as IdeviceFileUploadRequest;
        const odeIdeviceId = data.odeIdeviceId;
        const file = data.file;
        const filename = data.filename || (file as FileWithName)?.name;

        // Validate required parameters
        if (!odeIdeviceId || !file || !filename) {
            set.status = 400;
            return { code: 'error: invalid data' };
        }

        // Get session ID from cookie or body
        // In Yjs mode, we use projectId cookie instead of odeSessionId
        let odeSessionId = data.odeSessionId || cookie.odeSessionId?.value || cookie.projectId?.value;

        // If no session ID, use a default
        if (!odeSessionId) {
            odeSessionId = 'uploads';
        }

        // Clean filename
        let cleanFilename = filename.replace(/ /g, '_');
        cleanFilename = cleanFilename.replace(/[^A-Za-z0-9_\-.]/g, '');

        // Ensure we have a valid filename
        if (!cleanFilename) {
            cleanFilename = 'file_' + Date.now();
        }

        // Get iDevice directory
        const filesDir = getFilesDir();
        const iDeviceDir = path.join(filesDir, 'tmp', odeSessionId, 'content', 'resources', odeIdeviceId);

        // Ensure directory exists
        await fse.ensureDir(iDeviceDir);

        // Generate unique filename if file already exists
        let savedFilename = cleanFilename;
        let counter = 0;
        const ext = path.extname(cleanFilename);
        const baseName = path.basename(cleanFilename, ext);
        while (await fse.pathExists(path.join(iDeviceDir, savedFilename))) {
            counter++;
            savedFilename = `${baseName}_${counter}${ext}`;
        }

        const outputFile = path.join(iDeviceDir, savedFilename);

        // Get file buffer
        let buffer: Buffer;
        if (file instanceof Blob) {
            buffer = Buffer.from(await file.arrayBuffer());
        } else if (Buffer.isBuffer(file)) {
            buffer = file;
        } else {
            buffer = Buffer.from(file);
        }

        await fse.writeFile(outputFile, buffer);

        // Get file size
        const stats = await fse.stat(outputFile);
        const fileSize = stats.size;
        const fileSizeFormatted = formatFileSize(fileSize);

        return {
            odeSessionId,
            odeIdeviceId,
            originalFilename: filename,
            savedPath: `/files/tmp/${odeSessionId}/content/resources/${odeIdeviceId}/`,
            savedFilename,
            savedFileSize: fileSizeFormatted,
        };
    });

/**
 * Rewrite relative URLs in CSS to absolute API endpoint URLs
 * This ensures fonts, images, and other resources load correctly when CSS is served via API
 */
function rewriteCSSUrls(content: string, resourcePath: string): string {
    // Get the directory of the CSS file (relative to public/files)
    const dir = path.dirname(resourcePath);
    // Get BASE_PATH for subdirectory installations (e.g., /web/exelearning)
    const basePath = getBasePath();

    return content.replace(/url\(['"]?([^'"()]+)['"]?\)/g, (match, urlPath) => {
        // Skip absolute URLs, data URIs, and HTTP(S) URLs
        if (
            urlPath.startsWith('/') ||
            urlPath.startsWith('data:') ||
            urlPath.startsWith('http://') ||
            urlPath.startsWith('https://')
        ) {
            return match;
        }

        // Resolve relative path (e.g., ../fonts/open-sans.woff2)
        const resolvedPath = path.posix.normalize(path.posix.join(dir, urlPath));

        // Create the full API URL with BASE_PATH prefix
        return `url(${basePath}/api/idevices/download-file-resources?resource=${encodeURIComponent(resolvedPath)})`;
    });
}

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
}
