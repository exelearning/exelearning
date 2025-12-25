/**
 * Convert Routes for Elysia
 *
 * Provides REST API for stateless file conversion and export.
 * Allows uploading ELP/ELPX files and receiving converted/exported files
 * without requiring a session.
 *
 * Endpoints:
 * - POST /api/convert/elp - Convert legacy ELP to ELPX
 * - POST /api/export/:format - Export ELP/ELPX to various formats
 *
 * Uses Dependency Injection pattern for testability.
 */

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Kysely } from 'kysely';

import { db as defaultDb } from '../db/client';
import type { Database } from '../db/types';
import { findUserById as findUserByIdDefault } from '../db/queries';
import type { ConvertRequest } from './types/request-payloads';

// Centralized export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
    type ExportResult,
} from '../shared/export';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ConvertDependencies {
    db: Kysely<Database>;
    queries: {
        findUserById: typeof findUserByIdDefault;
    };
    publicDir?: string;
    tempDir?: string;
}

interface JwtPayload {
    sub: number;
    email: string;
    roles: string[];
    isGuest?: boolean;
}

// Supported export formats
const EXPORT_FORMATS = [
    { id: 'html5', name: 'HTML5 Website', extension: 'zip', mimeType: 'application/zip' },
    { id: 'html5-sp', name: 'HTML5 Single Page', extension: 'zip', mimeType: 'application/zip' },
    { id: 'scorm12', name: 'SCORM 1.2', extension: 'zip', mimeType: 'application/zip' },
    { id: 'scorm2004', name: 'SCORM 2004', extension: 'zip', mimeType: 'application/zip' },
    { id: 'ims', name: 'IMS Content Package', extension: 'zip', mimeType: 'application/zip' },
    { id: 'epub3', name: 'EPUB3', extension: 'epub', mimeType: 'application/epub+zip' },
    { id: 'elp', name: 'eXeLearning Project', extension: 'elpx', mimeType: 'application/x-exelearning' },
    { id: 'elpx', name: 'eXeLearning Project', extension: 'elpx', mimeType: 'application/x-exelearning' },
];

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = ['.elp', '.elpx', '.zip'];
const _ALLOWED_MIME_TYPES = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

/**
 * File with optional name property (for Blob/File uploads)
 */
interface FileWithName extends Blob {
    name?: string;
}

/**
 * Export options type
 */
interface ExportOptions {
    baseUrl?: string;
    theme?: string;
}

// Max upload size (default 100MB)
const getMaxUploadSize = (): number => {
    const envSize = process.env.MAX_UPLOAD_SIZE;
    if (envSize) {
        if (envSize.endsWith('M')) {
            return parseInt(envSize, 10) * 1024 * 1024;
        }
        return parseInt(envSize, 10);
    }
    return 100 * 1024 * 1024; // 100MB
};

// =============================================================================
// Default Dependencies
// =============================================================================

const defaultDeps: ConvertDependencies = {
    db: defaultDb,
    queries: {
        findUserById: findUserByIdDefault,
    },
    publicDir: path.resolve(__dirname, '../../public'),
    tempDir: process.env.FILES_DIR ? path.join(process.env.FILES_DIR, 'tmp') : '/tmp/exelearning-convert',
};

// Get JWT secret from environment
const getJwtSecret = (): string => {
    return process.env.API_JWT_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
};

// =============================================================================
// Factory Function
// =============================================================================

export function createConvertRoutes(deps: ConvertDependencies = defaultDeps) {
    const { db, queries, publicDir, tempDir } = { ...defaultDeps, ...deps };
    const { findUserById } = queries;

    /**
     * Validate uploaded file
     */
    function validateFile(file: File | Blob | null | undefined): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'No file uploaded' };
        }

        // Check file size
        const maxSize = getMaxUploadSize();
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
            };
        }

        // Check file extension
        const filename = (file as FileWithName).name || '';
        const ext = path.extname(filename).toLowerCase();
        if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
            };
        }

        return { valid: true };
    }

    /**
     * Create temporary directory for extraction
     */
    async function createTempDir(): Promise<string> {
        const dir = path.join(tempDir!, `convert-${randomUUID()}`);
        await fs.ensureDir(dir);
        return dir;
    }

    /**
     * Write uploaded file to disk
     */
    async function writeUploadedFile(file: File | Blob, destPath: string): Promise<void> {
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(destPath, buffer);
    }

    /**
     * Run export using unified export system
     */
    async function runExport(
        extractedPath: string,
        exportType: string,
        options: ExportOptions = {},
    ): Promise<ExportResult & { filename?: string }> {
        try {
            // Create document adapter from extracted ELP
            const document = await ElpDocumentAdapter.fromElpFile(extractedPath);

            // Create providers
            const resources = new FileSystemResourceProvider(publicDir!);
            const assets = new FileSystemAssetProvider(document.extractedPath);
            const zip = new FflateZipProvider();

            // Select exporter based on format
            let exporter;
            switch (exportType) {
                case 'html5':
                    exporter = new Html5Exporter(document, resources, assets, zip);
                    break;
                case 'html5-sp':
                    exporter = new PageExporter(document, resources, assets, zip);
                    break;
                case 'scorm12':
                    exporter = new Scorm12Exporter(document, resources, assets, zip);
                    break;
                case 'scorm2004':
                    exporter = new Scorm2004Exporter(document, resources, assets, zip);
                    break;
                case 'ims':
                    exporter = new ImsExporter(document, resources, assets, zip);
                    break;
                case 'epub3':
                    exporter = new Epub3Exporter(document, resources, assets, zip);
                    break;
                case 'elp':
                case 'elpx':
                    exporter = new ElpxExporter(document, resources, assets, zip);
                    break;
                default:
                    return { success: false, error: `Unsupported export format: ${exportType}` };
            }

            // Run export
            const result = await exporter.export(options);
            return result;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Convert] Error during ${exportType} export:`, error);
            return { success: false, error: errorMessage };
        }
    }

    // =========================================================================
    // Routes
    // =========================================================================

    return (
        new Elysia({ name: 'convert-routes' })
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
                    const payload = (await jwt.verify(token)) as JwtPayload | false;
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
            // GET /api/convert/formats - List available formats
            // =====================================================
            .get('/api/convert/formats', () => {
                return {
                    success: true,
                    formats: EXPORT_FORMATS,
                };
            })

            // =====================================================
            // POST /api/convert/elp - Convert ELP to ELPX
            // =====================================================
            .post(
                '/api/convert/elp',
                async ({ body, query, set, currentUser }) => {
                    // Require authentication
                    if (!currentUser) {
                        set.status = 401;
                        return { code: 'UNAUTHORIZED', detail: 'Authentication required' };
                    }

                    const data = body as ConvertRequest;
                    const download = query.download === '1';

                    // Validate file
                    const validation = validateFile(data.file);
                    if (!validation.valid) {
                        set.status = 400;
                        return { code: 'MISSING_FILE', detail: validation.error };
                    }

                    let tempDirPath: string | null = null;

                    try {
                        // Create temp directory
                        tempDirPath = await createTempDir();

                        // Write uploaded file
                        const filename = (data.file as FileWithName).name || 'upload.elp';
                        const uploadPath = path.join(tempDirPath, filename);
                        await writeUploadedFile(data.file, uploadPath);

                        // Run ELPX export (conversion)
                        const result = await runExport(uploadPath, 'elpx');

                        if (!result.success) {
                            set.status = 500;
                            return { code: 'CONVERSION_FAILED', detail: result.error };
                        }

                        // Return result
                        if (download && result.data) {
                            const exportFilename = result.filename || 'converted.elpx';
                            set.headers['content-type'] = 'application/x-exelearning';
                            set.headers['content-disposition'] = `attachment; filename="${exportFilename}"`;
                            set.headers['content-length'] = String(result.data.length);
                            return result.data;
                        }

                        return {
                            status: 'success',
                            fileName: result.filename || 'converted.elpx',
                            size: result.data?.length || 0,
                            message: 'Conversion completed. Use ?download=1 to download the file directly.',
                        };
                    } catch (error: unknown) {
                        set.status = 500;
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        return { code: 'INTERNAL_ERROR', detail: errorMessage };
                    } finally {
                        // Cleanup temp directory
                        if (tempDirPath) {
                            try {
                                await fs.remove(tempDirPath);
                            } catch {
                                // Ignore cleanup errors
                            }
                        }
                    }
                },
                {
                    query: t.Object({
                        download: t.Optional(t.String()),
                    }),
                },
            )

            // =====================================================
            // POST /api/convert/export/:format - Export to format (stateless)
            // =====================================================
            .post(
                '/api/convert/export/:format',
                async ({ params, body, query, set, currentUser }) => {
                    const { format } = params;

                    // Require authentication
                    if (!currentUser) {
                        set.status = 401;
                        return { code: 'UNAUTHORIZED', detail: 'Authentication required' };
                    }

                    // Validate format
                    const formatInfo = EXPORT_FORMATS.find(f => f.id === format);
                    if (!formatInfo) {
                        set.status = 400;
                        return {
                            code: 'INVALID_FORMAT',
                            detail: `Invalid export format: ${format}`,
                            validFormats: EXPORT_FORMATS.map(f => f.id),
                        };
                    }

                    const data = body as ConvertRequest;
                    const download = query.download === '1';
                    const baseUrl = data.baseUrl || undefined;
                    const theme = data.theme || undefined;

                    // Validate file
                    const validation = validateFile(data.file);
                    if (!validation.valid) {
                        set.status = 400;
                        return { code: 'MISSING_FILE', detail: validation.error };
                    }

                    let tempDirPath: string | null = null;

                    try {
                        // Create temp directory
                        tempDirPath = await createTempDir();

                        // Write uploaded file
                        const filename = (data.file as FileWithName).name || 'upload.elp';
                        const uploadPath = path.join(tempDirPath, filename);
                        await writeUploadedFile(data.file, uploadPath);

                        // Run export
                        const result = await runExport(uploadPath, format, { baseUrl, theme });

                        if (!result.success) {
                            set.status = 500;
                            return { code: 'EXPORT_FAILED', detail: result.error };
                        }

                        // Return result
                        if (download && result.data) {
                            const exportFilename = result.filename || `export_${format}.${formatInfo.extension}`;
                            set.headers['content-type'] = formatInfo.mimeType;
                            set.headers['content-disposition'] = `attachment; filename="${exportFilename}"`;
                            set.headers['content-length'] = String(result.data.length);
                            return result.data;
                        }

                        return {
                            status: 'success',
                            format: format,
                            fileName: result.filename || `export_${format}.${formatInfo.extension}`,
                            size: result.data?.length || 0,
                            message: 'Export completed. Use ?download=1 to download the file directly.',
                        };
                    } catch (error: unknown) {
                        set.status = 500;
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        return { code: 'INTERNAL_ERROR', detail: errorMessage };
                    } finally {
                        // Cleanup temp directory
                        if (tempDirPath) {
                            try {
                                await fs.remove(tempDirPath);
                            } catch {
                                // Ignore cleanup errors
                            }
                        }
                    }
                },
                {
                    params: t.Object({
                        format: t.String(),
                    }),
                    query: t.Object({
                        download: t.Optional(t.String()),
                    }),
                },
            )
    );
}

// =============================================================================
// Default Instance
// =============================================================================

export const convertRoutes = createConvertRoutes();
