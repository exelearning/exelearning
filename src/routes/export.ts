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

import { getSession as getSessionDefault, type ProjectSession } from '../services/session-manager';
import type { ExportOptionsRequest, YjsExportStructure } from './types/request-payloads';
import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    getOdeSessionDistDir as getOdeSessionDistDirDefault,
    fileExists as fileExistsDefault,
    readFile as readFileDefault,
} from '../services/file-helper';

// Centralized export system - same as CLI and frontend
import {
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
    PageElpxExporter as PageElpxExporterDefault,
    YjsDocumentAdapter as YjsDocumentAdapterDefault,
    ServerYjsDocumentWrapper as ServerYjsDocumentWrapperDefault,
    type ExportResult,
    type ExportDocument,
    type ResourceProvider,
    type AssetProvider,
    type ZipProvider,
} from '../shared/export';

// Import system (ELP → Y.Doc)
import {
    ElpxImporter as ElpxImporterDefault,
    FileSystemAssetHandler as FileSystemAssetHandlerDefault,
} from '../shared/import';
import * as Y from 'yjs';

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
    PageElpxExporter: typeof PageElpxExporterDefault;
    YjsDocumentAdapter: typeof YjsDocumentAdapterDefault;
    ServerYjsDocumentWrapper: typeof ServerYjsDocumentWrapperDefault;
    // Import system
    ElpxImporter: typeof ElpxImporterDefault;
    FileSystemAssetHandler: typeof FileSystemAssetHandlerDefault;
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
    PageElpxExporter: PageElpxExporterDefault,
    YjsDocumentAdapter: YjsDocumentAdapterDefault,
    ServerYjsDocumentWrapper: ServerYjsDocumentWrapperDefault,
    // Import system
    ElpxImporter: ElpxImporterDefault,
    FileSystemAssetHandler: FileSystemAssetHandlerDefault,
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
    { id: 'elp', name: 'eXeLearning Project', extension: 'elp', mimeType: 'application/zip' },
    { id: 'elpx-page', name: 'eXeLearning Page Package', extension: 'elpx', mimeType: 'application/zip' },
];

// ============================================================================
// Yjs Structure Population
// ============================================================================

/**
 * Populate a Y.Doc from YjsExportStructure
 * This allows us to use YjsDocumentAdapter for exports from client-sent structures
 *
 * @param ydoc - Y.Doc to populate
 * @param structure - YjsExportStructure from client
 */
export function populateYDocFromStructure(ydoc: Y.Doc, structure: YjsExportStructure): void {
    // Set metadata
    const metadata = ydoc.getMap('metadata');
    const meta = structure.meta;
    metadata.set('title', meta.title || 'Untitled');
    metadata.set('author', meta.author || '');
    metadata.set('description', meta.description || '');
    metadata.set('language', meta.language || 'en');
    metadata.set('license', meta.license || '');
    metadata.set('theme', meta.theme || 'base');
    metadata.set('addExeLink', meta.addExeLink ?? true);
    metadata.set('addPagination', meta.addPagination ?? false);
    metadata.set('addSearchBox', meta.addSearchBox ?? false);
    metadata.set('addAccessibilityToolbar', meta.addAccessibilityToolbar ?? false);
    metadata.set('exportSource', meta.exportSource ?? true);
    if (meta.extraHeadContent) metadata.set('extraHeadContent', meta.extraHeadContent);
    if (meta.footer) metadata.set('footer', meta.footer);

    // Set navigation (pages with blocks)
    const navigation = ydoc.getArray('navigation');

    for (const page of structure.pages) {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('pageName', page.pageName);
        pageMap.set('parentId', page.parentId || null);

        // Page properties
        if (page.properties) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(page.properties)) {
                propsMap.set(key, value);
            }
            pageMap.set('properties', propsMap);
        }

        // Blocks
        const blocksArray = new Y.Array();
        for (const block of page.blocks || []) {
            const blockMap = new Y.Map();
            blockMap.set('id', block.id);
            blockMap.set('blockName', block.blockName || '');
            blockMap.set('iconName', block.iconName || '');

            // Block properties
            if (block.properties) {
                const blockPropsMap = new Y.Map();
                for (const [key, value] of Object.entries(block.properties)) {
                    blockPropsMap.set(key, value);
                }
                blockMap.set('properties', blockPropsMap);
            }

            // Components
            const componentsArray = new Y.Array();
            for (const comp of block.components || []) {
                const compMap = new Y.Map();
                compMap.set('id', comp.id);
                compMap.set('type', comp.ideviceType || 'FreeTextIdevice');
                compMap.set('htmlContent', comp.htmlContent || '');

                // Component properties - store as JSON string in jsonProperties field
                // This matches the browser-side ComponentImporter.createComponentYMap behavior
                if (comp.properties && Object.keys(comp.properties).length > 0) {
                    compMap.set('jsonProperties', JSON.stringify(comp.properties));
                }

                componentsArray.push([compMap]);
            }
            blockMap.set('components', componentsArray);
            blocksArray.push([blockMap]);
        }
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);
    }
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
        PageElpxExporter,
        YjsDocumentAdapter,
        ServerYjsDocumentWrapper,
        // Import system
        ElpxImporter,
        FileSystemAssetHandler,
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

        // Helper to import ELP file from tempDir using ElpxImporter
        async function importElpFromTempDir(): Promise<{
            document: ExportDocument;
            wrapper: InstanceType<typeof ServerYjsDocumentWrapper>;
        } | null> {
            // Look for ELP files in tempDir
            const files = await fs.readdir(tempDir);
            const elpFile = files.find(f => f.endsWith('.elp') || f.endsWith('.elpx'));

            if (elpFile) {
                const elpPath = path.join(tempDir, elpFile);
                const elpBuffer = await fs.readFile(elpPath);

                const ydoc = new Y.Doc();
                const assetHandler = new FileSystemAssetHandler(tempDir);
                const importer = new ElpxImporter(ydoc, assetHandler);
                await importer.importFromBuffer(new Uint8Array(elpBuffer));

                const wrapper = new ServerYjsDocumentWrapper(ydoc, 'import-export');
                const document = new YjsDocumentAdapter(wrapper);
                return { document, wrapper };
            }

            // Fallback: Try to parse content.xml directly
            const contentXmlPath = path.join(tempDir, 'content.xml');
            if (await fileExists(contentXmlPath)) {
                // Read all files in tempDir to create a zip-like structure for ElpxImporter
                const ydoc = new Y.Doc();
                const assetHandler = new FileSystemAssetHandler(tempDir);
                const importer = new ElpxImporter(ydoc, assetHandler);

                // Read content.xml and resources
                const contentXml = await fs.readFile(contentXmlPath);
                const zipContents: Record<string, Uint8Array> = {
                    'content.xml': new Uint8Array(contentXml),
                };

                // Check for contentv3.xml (legacy format)
                const contentV3Path = path.join(tempDir, 'contentv3.xml');
                if (await fileExists(contentV3Path)) {
                    const contentV3 = await fs.readFile(contentV3Path);
                    zipContents['contentv3.xml'] = new Uint8Array(contentV3);
                }

                // Add resources directory contents
                const resourcesDir = path.join(tempDir, 'resources');
                if (await fileExists(resourcesDir)) {
                    const stats = await fs.stat(resourcesDir);
                    if (stats.isDirectory()) {
                        const resourceFiles = await fs.readdir(resourcesDir);
                        for (const file of resourceFiles) {
                            const filePath = path.join(resourcesDir, file);
                            const fileStats = await fs.stat(filePath);
                            if (fileStats.isFile()) {
                                const fileContent = await fs.readFile(filePath);
                                zipContents[`resources/${file}`] = new Uint8Array(fileContent);
                            }
                        }
                    }
                }

                // Import from constructed zip-like structure
                await importer.importFromZipContents(zipContents);

                const wrapper = new ServerYjsDocumentWrapper(ydoc, 'xml-import-export');
                const document = new YjsDocumentAdapter(wrapper);
                return { document, wrapper };
            }

            return null;
        }

        try {
            // Create document adapter from structure
            // Priority:
            // 1. options.structure (Yjs from client) - create Y.Doc from structure
            // 2. Yjs from database (server-side Yjs document)
            // 3. ELP file in tempDir - use ElpxImporter
            // 4. content.xml (legacy fallback) - use ElpxImporter
            let document: ExportDocument;

            if (options.structure) {
                // Yjs structure sent from client - create Y.Doc directly
                console.log('[Export] Creating Y.Doc from client structure');
                const ydoc = new Y.Doc();
                populateYDocFromStructure(ydoc, options.structure);
                yjsDocWrapper = new ServerYjsDocumentWrapper(ydoc, 'client-structure');
                document = new YjsDocumentAdapter(yjsDocWrapper);
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
                                console.log('[Export] Yjs document empty, falling back to ELP import');
                                yjsDocWrapper.destroy();
                                yjsDocWrapper = null;
                                // Try to import from ELP file
                                const imported = await importElpFromTempDir();
                                if (imported) {
                                    document = imported.document;
                                    yjsDocWrapper = imported.wrapper;
                                } else {
                                    return { success: false, error: 'No project structure found' };
                                }
                            }
                        } else {
                            console.log('[Export] No Yjs document in database, falling back to ELP import');
                            // Try to import from ELP file
                            const imported = await importElpFromTempDir();
                            if (imported) {
                                document = imported.document;
                                yjsDocWrapper = imported.wrapper;
                            } else {
                                return { success: false, error: 'No project structure found' };
                            }
                        }
                    } else {
                        console.log('[Export] Project not found in database, falling back to ELP import');
                        const imported = await importElpFromTempDir();
                        if (imported) {
                            document = imported.document;
                            yjsDocWrapper = imported.wrapper;
                        } else {
                            return { success: false, error: 'No project structure found' };
                        }
                    }
                } catch (yjsError) {
                    // Database/Yjs lookup failed - fall back to ELP import
                    console.warn('[Export] Yjs lookup failed, falling back to ELP import:', yjsError);
                    const imported = await importElpFromTempDir();
                    if (imported) {
                        document = imported.document;
                        yjsDocWrapper = imported.wrapper;
                    } else {
                        return { success: false, error: 'No project structure found' };
                    }
                }
            } else {
                // No odeId, try to import from ELP file directly
                console.log('[Export] No odeId, trying ELP import');
                const imported = await importElpFromTempDir();
                if (imported) {
                    document = imported.document;
                    yjsDocWrapper = imported.wrapper;
                } else {
                    return { success: false, error: 'No project structure found in session' };
                }
            }

            // Create providers using injected classes
            console.log('[Export] Using publicDir:', publicDir);
            const resources: ResourceProvider = new FileSystemResourceProvider(publicDir);
            const zip: ZipProvider = new FflateZipProvider();

            // Ensure temp directory exists to prevent ENOENT errors in FileSystemAssetProvider
            await fs.ensureDir(tempDir);

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
                case 'elpx-page':
                    exporter = new PageElpxExporter(document, resources, assets, zip);
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
                    const rawFilename = `${session.fileName?.replace(/\.elp$/, '') || 'export'}_${exportType}.${format.extension}`;
                    // ASCII-only filename for compatibility
                    const safeFilename = rawFilename.replace(/[^\x20-\x7E]/g, '_');
                    // UTF-8 encoded filename for modern browsers (RFC 5987)
                    const encodedFilename = encodeURIComponent(rawFilename)
                        .replace(/['()]/g, escape)
                        .replace(/\*/g, '%2A');

                    set.headers['content-type'] = format.mimeType;
                    set.headers['content-disposition'] =
                        `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
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
                        sessionId: odeSessionId,
                        fileName: `${projectTitle}.elp`,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as ProjectSession;
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
                    const rawFilename = `${session.fileName?.replace(/\.elp$/, '') || 'export'}_${exportType}.${format.extension}`;
                    // ASCII-only filename for compatibility
                    const safeFilename = rawFilename.replace(/[^\x20-\x7E]/g, '_');
                    // UTF-8 encoded filename for modern browsers (RFC 5987)
                    const encodedFilename = encodeURIComponent(rawFilename)
                        .replace(/['()]/g, escape)
                        .replace(/\*/g, '%2A');

                    set.headers['content-type'] = format.mimeType;
                    set.headers['content-disposition'] =
                        `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
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
