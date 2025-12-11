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
import type { ExportOptionsRequest } from './types/request-payloads';
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
    ArchiverZipProvider as ArchiverZipProviderDefault,
    Html5Exporter as Html5ExporterDefault,
    PageExporter as PageExporterDefault,
    Scorm12Exporter as Scorm12ExporterDefault,
    Scorm2004Exporter as Scorm2004ExporterDefault,
    ImsExporter as ImsExporterDefault,
    Epub3Exporter as Epub3ExporterDefault,
    ElpxExporter as ElpxExporterDefault,
    type ExportResult,
    type ExportDocument,
    type ResourceProvider,
    type AssetProvider,
    type ZipProvider,
} from '../shared/export';

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
    ArchiverZipProvider: typeof ArchiverZipProviderDefault;
    Html5Exporter: typeof Html5ExporterDefault;
    PageExporter: typeof PageExporterDefault;
    Scorm12Exporter: typeof Scorm12ExporterDefault;
    Scorm2004Exporter: typeof Scorm2004ExporterDefault;
    ImsExporter: typeof ImsExporterDefault;
    Epub3Exporter: typeof Epub3ExporterDefault;
    ElpxExporter: typeof ElpxExporterDefault;
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
    ArchiverZipProvider: ArchiverZipProviderDefault,
    Html5Exporter: Html5ExporterDefault,
    PageExporter: PageExporterDefault,
    Scorm12Exporter: Scorm12ExporterDefault,
    Scorm2004Exporter: Scorm2004ExporterDefault,
    ImsExporter: ImsExporterDefault,
    Epub3Exporter: Epub3ExporterDefault,
    ElpxExporter: ElpxExporterDefault,
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
    const publicDir = deps.publicDir ?? defaultPublicDir;

    // Destructure export system classes
    const {
        ElpDocumentAdapter,
        FileSystemResourceProvider,
        FileSystemAssetProvider,
        DatabaseAssetProvider,
        CombinedAssetProvider,
        ArchiverZipProvider,
        Html5Exporter,
        PageExporter,
        Scorm12Exporter,
        Scorm2004Exporter,
        ImsExporter,
        Epub3Exporter,
        ElpxExporter,
    } = exportSystem;

    // ========================================================================
    // Internal Helper Functions
    // ========================================================================

    /**
     * Prepare export using centralized export system
     * Uses the same exporters as CLI and frontend for consistency
     */
    async function prepareExport(
        sessionId: string,
        exportType: string,
        options: ExportOptionsRequest = {},
    ): Promise<ExportResult & { zipPath?: string }> {
        const session = getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        const tempDir = getOdeSessionTempDir(sessionId);
        const distDir = getOdeSessionDistDir(sessionId);

        // Ensure dist directory exists
        await fs.ensureDir(distDir);

        try {
            // Create document adapter from session structure
            // session.structure contains the ParsedOdeStructure from when the ELP was opened
            let document: ExportDocument;
            if (session.structure) {
                document = new ElpDocumentAdapter(session.structure, tempDir);
            } else {
                // Fallback: Try to parse content.xml directly
                const contentXmlPath = path.join(tempDir, 'content.xml');
                if (await fileExists(contentXmlPath)) {
                    document = await ElpDocumentAdapter.fromElpFile(tempDir);
                } else {
                    return { success: false, error: 'No project structure found in session' };
                }
            }

            // Create providers using injected classes
            const resources: ResourceProvider = new FileSystemResourceProvider(publicDir);
            const zip: ZipProvider = new ArchiverZipProvider();

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
            // Preview Export
            // =====================================================

            // GET /api/export/:odeSessionId/preview - Preview exported content
            .get('/:odeSessionId/preview', async ({ params, set }) => {
                const { odeSessionId } = params;

                const session = getSession(odeSessionId);
                if (!session) {
                    set.status = 404;
                    return { success: false, error: 'Session not found' };
                }

                // Get temp directory
                const tempDir = getOdeSessionTempDir(odeSessionId);

                // Check for index.html
                const indexPath = path.join(tempDir, 'index.html');
                if (await fileExists(indexPath)) {
                    const content = await readFile(indexPath);
                    set.headers['content-type'] = 'text/html; charset=utf-8';
                    return content.toString('utf-8');
                }

                // Generate basic preview
                const contentXmlPath = path.join(tempDir, 'content.xml');
                if (await fileExists(contentXmlPath)) {
                    return {
                        success: true,
                        message: 'Project loaded, preview not yet generated',
                        sessionId: odeSessionId,
                        hasContent: true,
                    };
                }

                set.status = 404;
                return { success: false, error: 'No content found for preview' };
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
                    // Prepare export with options
                    const exportResult = await prepareExport(odeSessionId, exportType, options);

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
