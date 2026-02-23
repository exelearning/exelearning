/**
 * Export REST API Endpoints
 *
 * Export projects to various formats (HTML5, SCORM, EPUB3, etc.).
 * Uses the centralized export system from src/shared/export/.
 */
import { Elysia } from 'elysia';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { db } from '../../../db/client';
import { findProjectByUuid } from '../../../db/queries';
import { getFilesDir } from '../../../services/file-helper';
import {
    Html5Exporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
    ServerYjsDocumentWrapper,
    YjsDocumentAdapter,
    CombinedAssetProvider,
    FileSystemAssetProvider,
    DatabaseAssetProvider,
    FileSystemResourceProvider,
    FflateZipProvider,
    ServerLatexPreRenderer,
} from '../../../shared/export';
import { reconstructDocument } from '../../../websocket/yjs-persistence';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    ExportFormatParam,
    type AuthenticatedUser,
    type ApiErrorResponse,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPORT_FORMATS: Record<
    string,
    {
        id: string;
        name: string;
        extension: string;
        mimeType: string;
    }
> = {
    html5: {
        id: 'html5',
        name: 'HTML5 Website',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    'html5-sp': {
        id: 'html5-sp',
        name: 'HTML5 Single Page',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    scorm12: {
        id: 'scorm12',
        name: 'SCORM 1.2 Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    scorm2004: {
        id: 'scorm2004',
        name: 'SCORM 2004 Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    ims: {
        id: 'ims',
        name: 'IMS Content Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    epub3: {
        id: 'epub3',
        name: 'EPUB 3 eBook',
        extension: '.epub',
        mimeType: 'application/epub+zip',
    },
    elp: {
        id: 'elp',
        name: 'eXeLearning Legacy Project',
        extension: '.elp',
        mimeType: 'application/x-elp',
    },
    elpx: {
        id: 'elpx',
        name: 'eXeLearning Project',
        extension: '.elpx',
        mimeType: 'application/x-elpx',
    },
};

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

export const exportRoutes = new Elysia({ prefix: '/export' })
    // List available export formats
    .get(
        '/formats',
        async ({ headers, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }

            return successResponse(Object.values(EXPORT_FORMATS));
        },
        {
            detail: {
                summary: 'List Export Formats',
                description: 'Get all available export formats',
                tags: ['Export'],
            },
        },
    )
    // Register under /projects prefix for project-specific exports
    .group('/projects', app =>
        app.get(
            '/:uuid/export/:format',
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

                const format = params.format;
                const formatInfo = EXPORT_FORMATS[format];
                if (!formatInfo) {
                    set.status = 400;
                    return errorResponse('INVALID_FORMAT', `Invalid export format: ${format}`);
                }

                try {
                    // Load the Yjs document
                    const ydoc = await reconstructDocument(project!.id);

                    // Create document adapter
                    const wrapper = new ServerYjsDocumentWrapper(ydoc, params.uuid);
                    const documentAdapter = new YjsDocumentAdapter(wrapper);

                    // Create asset providers
                    const filesDir = getFilesDir();
                    const assetsPath = path.join(filesDir, 'assets', params.uuid);

                    const fsAssetProvider = new FileSystemAssetProvider(assetsPath);
                    const dbAssetProvider = new DatabaseAssetProvider(db, project!.id);
                    const assetProvider = new CombinedAssetProvider([fsAssetProvider, dbAssetProvider]);

                    // Create resource provider (themes, idevices, base CSS)
                    // Note: ResourceProvider expects the public/ directory as root
                    // since it accesses multiple subdirectories (style/, files/perm/, app/, libs/)
                    const resourceProvider = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));

                    // Create ZIP provider
                    const zipProvider = new FflateZipProvider();

                    // Create temp directory for export
                    const tempDir = path.join(os.tmpdir(), 'exelearning-export', crypto.randomUUID());
                    fs.mkdirSync(tempDir, { recursive: true });

                    // Create the appropriate exporter
                    let exporter;
                    switch (format) {
                        case 'html5':
                            exporter = new Html5Exporter(
                                documentAdapter,
                                resourceProvider,
                                assetProvider,
                                zipProvider,
                                {
                                    singlePage: false,
                                },
                            );
                            break;
                        case 'html5-sp':
                            exporter = new Html5Exporter(
                                documentAdapter,
                                resourceProvider,
                                assetProvider,
                                zipProvider,
                                {
                                    singlePage: true,
                                },
                            );
                            break;
                        case 'scorm12':
                            exporter = new Scorm12Exporter(
                                documentAdapter,
                                resourceProvider,
                                assetProvider,
                                zipProvider,
                            );
                            break;
                        case 'scorm2004':
                            exporter = new Scorm2004Exporter(
                                documentAdapter,
                                resourceProvider,
                                assetProvider,
                                zipProvider,
                            );
                            break;
                        case 'ims':
                            exporter = new ImsExporter(documentAdapter, resourceProvider, assetProvider, zipProvider);
                            break;
                        case 'epub3':
                            exporter = new Epub3Exporter(documentAdapter, resourceProvider, assetProvider, zipProvider);
                            break;
                        case 'elpx':
                        case 'elp':
                            exporter = new ElpxExporter(documentAdapter, resourceProvider, assetProvider, zipProvider);
                            break;
                        default:
                            set.status = 400;
                            return errorResponse('INVALID_FORMAT', `Unsupported format: ${format}`);
                    }

                    // Run the export with server-side LaTeX pre-render hooks.
                    // This keeps behavior consistent with the main export routes.
                    const latexRenderer = new ServerLatexPreRenderer();
                    const result = await exporter.export({
                        preRenderLatex: async (html: string) => latexRenderer.preRender(html),
                        preRenderDataGameLatex: async (html: string) => latexRenderer.preRenderDataGameLatex(html),
                    });

                    if (!result.success || !result.data) {
                        set.status = 500;
                        return errorResponse('EXPORT_FAILED', result.error || 'Export failed');
                    }

                    // Set response headers for file download
                    const title = documentAdapter.getMetadata().title || 'untitled';
                    const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '_');
                    const filename = `${safeTitle}${formatInfo.extension}`;

                    set.headers['Content-Type'] = formatInfo.mimeType;
                    set.headers['Content-Disposition'] = `attachment; filename="${filename}"`;
                    set.headers['Content-Length'] = result.data.length.toString();

                    // Clean up temp directory
                    fs.rmSync(tempDir, { recursive: true, force: true });

                    // Return the ZIP/export data
                    return new Response(result.data, {
                        headers: {
                            'Content-Type': formatInfo.mimeType,
                            'Content-Disposition': `attachment; filename="${filename}"`,
                            'Content-Length': result.data.length.toString(),
                        },
                    });
                } catch (err) {
                    console.error('[Export API] Error:', err);
                    set.status = 500;
                    return errorResponse('EXPORT_ERROR', err instanceof Error ? err.message : 'Export failed');
                }
            },
            {
                params: ExportFormatParam,
                detail: {
                    summary: 'Export Project',
                    description: 'Export a project to the specified format',
                    tags: ['Export'],
                },
            },
        ),
    );
