/**
 * Export Routes for Elysia
 * Handles project export to various formats (HTML5, SCORM, EPUB3, etc.)
 *
 * Uses the centralized export system from src/shared/export/ for consistency
 * with CLI and frontend exports.
 *
 * Uses Dependency Injection pattern for testability
 */
import { Elysia } from 'elysia';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';

import { getSession as getSessionDefault } from '../services/session-manager';
import type { ExportOptionsRequest, YjsExportStructure } from './types/request-payloads';
import type { ParsedOdeStructure, NormalizedPage, NormalizedComponent, OdeXmlMeta } from '../services/xml/interfaces';
import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    getOdeSessionDistDir as getOdeSessionDistDirDefault,
    fileExists as fileExistsDefault,
    readFile as readFileDefault,
} from '../services/file-helper';

// Centralized export system - same as CLI and frontend
import {
    ElpDocumentAdapter as ElpDocumentAdapterDefault,
    FileSystemResourceProvider as FileSystemResourceProviderDefault,
    FileSystemAssetProvider as FileSystemAssetProviderDefault,
    FflateZipProvider as FflateZipProviderDefault,
    Html5Exporter as Html5ExporterDefault,
    PageExporter as PageExporterDefault,
    Scorm12Exporter as Scorm12ExporterDefault,
    Scorm2004Exporter as Scorm2004ExporterDefault,
    ImsExporter as ImsExporterDefault,
    Epub3Exporter as Epub3ExporterDefault,
    ElpxExporter as ElpxExporterDefault,
    YjsDocumentAdapter as YjsDocumentAdapterDefault,
    ServerYjsDocumentWrapper as ServerYjsDocumentWrapperDefault,
    type ExportResult,
    type ExportDocument,
    type ResourceProvider,
    type AssetProvider,
    type ZipProvider,
} from '../shared/export';

// Yjs persistence for server-side Yjs documents
import { reconstructDocument as reconstructDocumentDefault } from '../websocket/yjs-persistence';

// Database and asset providers for server-side exports
import { db as defaultDb } from '../db/client';
import { findProjectByUuid as findProjectByUuidDefault } from '../db/queries';
import { DatabaseAssetProvider as DatabaseAssetProviderDefault } from '../shared/export/providers/DatabaseAssetProvider';
import { CombinedAssetProvider as CombinedAssetProviderDefault } from '../shared/export/providers/CombinedAssetProvider';

// ============================================================================
// Types and Interfaces for Dependency Injection
// ============================================================================

/**
 * Session manager dependencies
 */
export interface ExportSessionManagerDeps {
    getSession: typeof getSessionDefault;
}

/**
 * File helper dependencies
 */
export interface ExportFileHelperDeps {
    getOdeSessionTempDir: typeof getOdeSessionTempDirDefault;
    getOdeSessionDistDir: typeof getOdeSessionDistDirDefault;
    fileExists: typeof fileExistsDefault;
    readFile: typeof readFileDefault;
}

/**
 * Shared export system dependencies (for testability)
 */
export interface ExportSystemDeps {
    ElpDocumentAdapter: typeof ElpDocumentAdapterDefault;
    FileSystemResourceProvider: typeof FileSystemResourceProviderDefault;
    FileSystemAssetProvider: typeof FileSystemAssetProviderDefault;
    DatabaseAssetProvider: typeof DatabaseAssetProviderDefault;
    CombinedAssetProvider: typeof CombinedAssetProviderDefault;
    FflateZipProvider: typeof FflateZipProviderDefault;
    Html5Exporter: typeof Html5ExporterDefault;
    PageExporter: typeof PageExporterDefault;
    Scorm12Exporter: typeof Scorm12ExporterDefault;
    Scorm2004Exporter: typeof Scorm2004ExporterDefault;
    ImsExporter: typeof ImsExporterDefault;
    Epub3Exporter: typeof Epub3ExporterDefault;
    ElpxExporter: typeof ElpxExporterDefault;
    YjsDocumentAdapter: typeof YjsDocumentAdapterDefault;
    ServerYjsDocumentWrapper: typeof ServerYjsDocumentWrapperDefault;
}

/**
 * Yjs persistence dependencies (for testability)
 */
export interface ExportYjsDeps {
    reconstructDocument: typeof reconstructDocumentDefault;
}

/**
 * Database dependencies for export routes
 */
export interface ExportDatabaseDeps {
    db: typeof defaultDb;
    findProjectByUuid: typeof findProjectByUuidDefault;
}

/**
 * All dependencies for export routes
 */
export interface ExportDependencies {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    sessionManager?: ExportSessionManagerDeps;
    fileHelper?: ExportFileHelperDeps;
    exportSystem?: ExportSystemDeps;
    database?: ExportDatabaseDeps;
    yjsPersistence?: ExportYjsDeps;
    publicDir?: string;
}

// Default dependencies
const defaultSessionManager: ExportSessionManagerDeps = {
    getSession: getSessionDefault,
};

const defaultFileHelper: ExportFileHelperDeps = {
    getOdeSessionTempDir: getOdeSessionTempDirDefault,
    getOdeSessionDistDir: getOdeSessionDistDirDefault,
    fileExists: fileExistsDefault,
    readFile: readFileDefault,
};

const defaultExportSystem: ExportSystemDeps = {
    ElpDocumentAdapter: ElpDocumentAdapterDefault,
    FileSystemResourceProvider: FileSystemResourceProviderDefault,
    FileSystemAssetProvider: FileSystemAssetProviderDefault,
    DatabaseAssetProvider: DatabaseAssetProviderDefault,
    CombinedAssetProvider: CombinedAssetProviderDefault,
    FflateZipProvider: FflateZipProviderDefault,
    Html5Exporter: Html5ExporterDefault,
    PageExporter: PageExporterDefault,
    Scorm12Exporter: Scorm12ExporterDefault,
    Scorm2004Exporter: Scorm2004ExporterDefault,
    ImsExporter: ImsExporterDefault,
    Epub3Exporter: Epub3ExporterDefault,
    ElpxExporter: ElpxExporterDefault,
    YjsDocumentAdapter: YjsDocumentAdapterDefault,
    ServerYjsDocumentWrapper: ServerYjsDocumentWrapperDefault,
};

const defaultYjsPersistence: ExportYjsDeps = {
    reconstructDocument: reconstructDocumentDefault,
};

const defaultDatabase: ExportDatabaseDeps = {
    db: defaultDb,
    findProjectByUuid: findProjectByUuidDefault,
};

// Default public directory (where themes, libs, idevices live)
const defaultPublicDir = pathModule.resolve(__dirname, '../../public');

// Supported export formats
const EXPORT_FORMATS = [
    { id: 'html5', name: 'HTML5 Website', extension: 'zip', mimeType: 'application/zip' },
    { id: 'html5-sp', name: 'HTML5 Single Page', extension: 'zip', mimeType: 'application/zip' },
    { id: 'scorm12', name: 'SCORM 1.2', extension: 'zip', mimeType: 'application/zip' },
    { id: 'scorm2004', name: 'SCORM 2004', extension: 'zip', mimeType: 'application/zip' },
    { id: 'ims', name: 'IMS Content Package', extension: 'zip', mimeType: 'application/zip' },
    { id: 'epub3', name: 'EPUB3', extension: 'epub', mimeType: 'application/epub+zip' },
    { id: 'elp', name: 'eXeLearning Project', extension: 'elp', mimeType: 'application/x-exelearning' },
];

// ============================================================================
// Yjs Structure Conversion
// ============================================================================

/**
 * Convert YjsExportStructure (from client) to ParsedOdeStructure (for export)
 *
 * The client sends a structure with blocks already grouped inside pages,
 * but ParsedOdeStructure expects flat components with blockName property.
 *
 * @param yjs - Yjs structure from client (blocks grouped inside pages)
 * @returns ParsedOdeStructure with flat components (blockName on each component)
 */
export function convertYjsStructureToParsed(yjs: YjsExportStructure): ParsedOdeStructure {
    // Helper to parse boolean values (may be boolean or string 'true'/'false')
    const parseBoolean = (value: boolean | string | undefined, defaultValue: boolean): boolean => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return defaultValue;
    };

    const meta: OdeXmlMeta = {
        title: yjs.meta.title || 'Untitled',
        author: yjs.meta.author || '',
        description: yjs.meta.description || '',
        language: yjs.meta.language || 'en',
        license: yjs.meta.license || '',
        theme: yjs.meta.theme || 'base',
        keywords: '',
        exelearning_version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),

        // Export options
        addExeLink: parseBoolean(yjs.meta.addExeLink, true),
        addPagination: parseBoolean(yjs.meta.addPagination, false),
        addSearchBox: parseBoolean(yjs.meta.addSearchBox, false),
        addAccessibilityToolbar: parseBoolean(yjs.meta.addAccessibilityToolbar, false),
        exportSource: parseBoolean(yjs.meta.exportSource, true),

        // Custom content
        extraHeadContent: yjs.meta.extraHeadContent,
        footer: yjs.meta.footer,
    };

    // Build pages map for parent lookup
    const pageMap = new Map<string, { id: string; parentId?: string | null }>();
    for (const page of yjs.pages) {
        pageMap.set(page.id, { id: page.id, parentId: page.parentId });
    }

    // Build hierarchical pages structure
    const rootPages: NormalizedPage[] = [];
    const pageById = new Map<string, NormalizedPage>();

    // First pass: create all pages
    for (const page of yjs.pages) {
        // Flatten blocks into components with blockName
        const components: NormalizedComponent[] = [];
        let compOrder = 0;

        for (const block of page.blocks || []) {
            for (const comp of block.components || []) {
                components.push({
                    id: comp.id,
                    type: comp.ideviceType || 'FreeTextIdevice',
                    order: compOrder++,
                    position: compOrder,
                    content: comp.htmlContent || '',
                    blockName: block.blockName || '',
                    data: {},
                    properties: comp.properties || {},
                });
            }
        }

        const normalizedPage: NormalizedPage = {
            id: page.id,
            title: page.pageName,
            parent_id: page.parentId || undefined,
            position: 0,
            children: [],
            components,
        };

        pageById.set(page.id, normalizedPage);
    }

    // Second pass: build hierarchy
    for (const page of yjs.pages) {
        const normalizedPage = pageById.get(page.id)!;

        if (page.parentId && pageById.has(page.parentId)) {
            const parent = pageById.get(page.parentId)!;
            parent.children.push(normalizedPage);
        } else {
            rootPages.push(normalizedPage);
        }
    }

    // Build navigation
    const navigation = yjs.navigation.map((nav, index) => ({
        id: nav.id,
        navText: nav.navText,
        parent_id: nav.parentId || undefined,
        position: index,
    }));

    return {
        meta,
        pages: rootPages,
        navigation,
        raw: {} as ParsedOdeStructure['raw'], // Empty raw - not needed for export
    };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create export routes with injected dependencies
 */
export function createExportRoutes(deps: ExportDependencies = {}): Elysia {
    // Shadow imports with injected dependencies
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const { getSession } = deps.sessionManager ?? defaultSessionManager;
    const { getOdeSessionTempDir, getOdeSessionDistDir, fileExists, readFile } = deps.fileHelper ?? defaultFileHelper;
    const exportSystem = deps.exportSystem ?? defaultExportSystem;
    const { db, findProjectByUuid } = deps.database ?? defaultDatabase;
    const { reconstructDocument } = deps.yjsPersistence ?? defaultYjsPersistence;
    const publicDir = deps.publicDir ?? defaultPublicDir;

    // Destructure export system classes
    const {
        ElpDocumentAdapter,
        FileSystemResourceProvider,
        FileSystemAssetProvider,
        DatabaseAssetProvider,
        CombinedAssetProvider,
        FflateZipProvider,
        Html5Exporter,
        PageExporter,
        Scorm12Exporter,
        Scorm2004Exporter,
        ImsExporter,
        Epub3Exporter,
        ElpxExporter,
        YjsDocumentAdapter,
        ServerYjsDocumentWrapper,
    } = exportSystem;

    // ========================================================================
    // Internal Helper Functions
    // ========================================================================

    /**
     * Prepare export using centralized export system
     * Uses the same exporters as CLI and frontend for consistency
     *
     * @param virtualSession - Optional virtual session for Yjs-only exports
     */
    async function prepareExport(
        sessionId: string,
        exportType: string,
        options: ExportOptionsRequest = {},
        virtualSession?: ProjectSession,
    ): Promise<ExportResult & { zipPath?: string }> {
        const session = virtualSession || getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        const tempDir = getOdeSessionTempDir(sessionId);
        const distDir = getOdeSessionDistDir(sessionId);

        // Ensure dist directory exists
        await fs.ensureDir(distDir);

        // Track if we need to cleanup Yjs document after export
        let yjsDocWrapper: InstanceType<typeof ServerYjsDocumentWrapper> | null = null;

        try {
            // Create document adapter from structure
            // Priority:
            // 1. options.structure (Yjs from client)
            // 2. Yjs from database (server-side Yjs document)
            // 3. session.structure (from ELP open)
            // 4. content.xml (legacy fallback for CLI)
            let document: ExportDocument;

            if (options.structure) {
                // Yjs structure sent from client - convert to ParsedOdeStructure
                console.log('[Export] Using Yjs structure from client');
                console.log('[Export] Structure pages:', options.structure.pages?.length);
                console.log('[Export] Structure meta theme:', options.structure.meta?.theme);
                const parsedStructure = convertYjsStructureToParsed(options.structure);
                console.log('[Export] Parsed theme:', parsedStructure.meta?.theme);
                document = new ElpDocumentAdapter(parsedStructure, tempDir);
            } else if (session.odeId) {
                // Try to load Yjs document from database
                try {
                    const project = await findProjectByUuid(db, session.odeId);
                    if (project) {
                        const yjsDoc = await reconstructDocument(project.id);
                        if (yjsDoc) {
                            // Check if document has content
                            yjsDocWrapper = new ServerYjsDocumentWrapper(yjsDoc, session.odeId);
                            if (yjsDocWrapper.hasContent()) {
                                console.log('[Export] Using Yjs document from database');
                                document = new YjsDocumentAdapter(yjsDocWrapper);
                            } else {
                                console.log('[Export] Yjs document empty, falling back to session structure');
                                yjsDocWrapper.destroy();
                                yjsDocWrapper = null;
                                if (session.structure) {
                                    document = new ElpDocumentAdapter(session.structure, tempDir);
                                } else {
                                    return { success: false, error: 'No project structure found' };
                                }
                            }
                        } else if (session.structure) {
                            console.log('[Export] No Yjs document in database, using session structure');
                            document = new ElpDocumentAdapter(session.structure, tempDir);
                        } else {
                            return { success: false, error: 'No project structure found' };
                        }
                    } else if (session.structure) {
                        console.log('[Export] Project not found in database, using session structure');
                        document = new ElpDocumentAdapter(session.structure, tempDir);
                    } else {
                        return { success: false, error: 'No project structure found' };
                    }
                } catch (yjsError) {
                    // Database/Yjs lookup failed - fall back to session structure
                    console.warn('[Export] Yjs lookup failed, falling back to session structure:', yjsError);
                    if (session.structure) {
                        document = new ElpDocumentAdapter(session.structure, tempDir);
                    } else {
                        return { success: false, error: 'No project structure found' };
                    }
                }
            } else if (session.structure) {
                // Session structure from when ELP was opened
                console.log('[Export] Using session structure (no odeId)');
                document = new ElpDocumentAdapter(session.structure, tempDir);
            } else {
                // Fallback: Try to parse content.xml directly (for CLI exports)
                const contentXmlPath = path.join(tempDir, 'content.xml');
                if (await fileExists(contentXmlPath)) {
                    console.log('[Export] Fallback: parsing content.xml directly');
                    document = await ElpDocumentAdapter.fromElpFile(tempDir);
                } else {
                    return { success: false, error: 'No project structure found in session' };
                }
            }

            // Create providers using injected classes
            console.log('[Export] Using publicDir:', publicDir);
            const resources: ResourceProvider = new FileSystemResourceProvider(publicDir);
            const zip: ZipProvider = new FflateZipProvider();

            // Create asset provider - combine database assets with filesystem assets
            const fsAssets = new FileSystemAssetProvider(tempDir);
            const assetProviders: AssetProvider[] = [fsAssets];

            // If session has a project UUID, also check database for uploaded assets
            if (session.odeId) {
                try {
                    const project = await findProjectByUuid(db, session.odeId);
                    if (project) {
                        const dbAssets = new DatabaseAssetProvider(db, project.id, tempDir);
                        // Database assets take priority (newer uploads)
                        assetProviders.unshift(dbAssets);
                    }
                } catch (error) {
                    // Database lookup failed - continue with filesystem only
                    console.warn(`[Export] Could not lookup project ${session.odeId}:`, error);
                }
            }

            const assets: AssetProvider =
                assetProviders.length > 1 ? new CombinedAssetProvider(assetProviders) : fsAssets;

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

            if (!result.success) {
                return result;
            }

            // Write the ZIP buffer to disk
            const zipPath = path.join(distDir, `${exportType}.zip`);
            if (result.data) {
                await fs.writeFile(zipPath, result.data);
            }

            return { ...result, zipPath };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Export] Error during ${exportType} export:`, error);
            return { success: false, error: errorMessage };
        } finally {
            // Cleanup Yjs document if we created one
            if (yjsDocWrapper) {
                yjsDocWrapper.destroy();
            }
        }
    }

    // ========================================================================
    // Routes
    // ========================================================================

    return (
        new Elysia({ prefix: '/api/export' })

            // =====================================================
            // Get Available Formats
            // =====================================================

            // GET /api/export/formats - List available export formats
            .get('/formats', () => {
                return {
                    success: true,
                    formats: EXPORT_FORMATS,
                };
            })

            // =====================================================
            // Download Export (GET)
            // =====================================================

            // GET /api/export/:odeSessionId/:exportType/download - Download export
            .get('/:odeSessionId/:exportType/download', async ({ params, set }) => {
                const { odeSessionId, exportType } = params;

                const session = getSession(odeSessionId);
                if (!session) {
                    set.status = 404;
                    return { success: false, error: 'Session not found' };
                }

                // Validate export type
                const format = EXPORT_FORMATS.find(f => f.id === exportType);
                if (!format) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Invalid export type: ${exportType}`,
                        validTypes: EXPORT_FORMATS.map(f => f.id),
                    };
                }

                try {
                    // Prepare export
                    const exportResult = await prepareExport(odeSessionId, exportType);

                    if (!exportResult.success) {
                        set.status = 500;
                        return { success: false, error: exportResult.error };
                    }

                    // Read the zip file
                    const zipBuffer = await readFile(exportResult.zipPath!);

                    // Set headers for download
                    const filename = `${session.fileName?.replace(/\.elp$/, '') || 'export'}_${exportType}.${format.extension}`;
                    set.headers['content-type'] = format.mimeType;
                    set.headers['content-disposition'] = `attachment; filename="${filename}"`;
                    set.headers['content-length'] = zipBuffer.length.toString();

                    return zipBuffer;
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                }
            })

            // =====================================================
            // Download Export (POST)
            // =====================================================

            // POST /api/export/:odeSessionId/:exportType/download - Download export with options
            .post('/:odeSessionId/:exportType/download', async ({ params, body, set }) => {
                const { odeSessionId, exportType } = params;
                const options = body as ExportOptionsRequest;

                let session = getSession(odeSessionId);

                // For Yjs-only sessions (yjs-*), create a virtual session if structure is provided
                if (!session && options.structure) {
                    console.log('[Export] Yjs-only session detected, using structure from request body');
                    const projectTitle = options.structure.meta?.title || 'Untitled';
                    session = {
                        id: odeSessionId,
                        fileName: `${projectTitle}.elp`,
                        structure: convertYjsStructureToParsed(options.structure),
                        created: new Date(),
                        modified: new Date(),
                    };
                }

                if (!session) {
                    set.status = 404;
                    return {
                        success: false,
                        error: 'Session not found. For Yjs sessions, include structure in request body.',
                    };
                }

                // Validate export type
                const format = EXPORT_FORMATS.find(f => f.id === exportType);
                if (!format) {
                    set.status = 400;
                    return {
                        success: false,
                        error: `Invalid export type: ${exportType}`,
                        validTypes: EXPORT_FORMATS.map(f => f.id),
                    };
                }

                try {
                    // Prepare export with options (pass virtual session for Yjs-only exports)
                    const exportResult = await prepareExport(odeSessionId, exportType, options, session);

                    if (!exportResult.success) {
                        set.status = 500;
                        return { success: false, error: exportResult.error };
                    }

                    // Read the zip file
                    const zipBuffer = await readFile(exportResult.zipPath!);

                    // Set headers for download
                    const filename = `${session.fileName?.replace(/\.elp$/, '') || 'export'}_${exportType}.${format.extension}`;
                    set.headers['content-type'] = format.mimeType;
                    set.headers['content-disposition'] = `attachment; filename="${filename}"`;
                    set.headers['content-length'] = zipBuffer.length.toString();

                    return zipBuffer;
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    set.status = 500;
                    return { success: false, error: errorMessage };
                }
            })
    );
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

export const exportRoutes = createExportRoutes();
