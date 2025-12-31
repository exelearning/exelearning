/**
 * Platform Integration Service
 *
 * Handles communication between eXeLearning and external platforms (Moodle, etc.)
 * for bidirectional project transfer.
 */
import type { PlatformJWTPayload } from '../utils/platform-jwt';
import { buildIntegrationUrl, getExportTypeFromPkgType } from '../utils/platform-jwt';
import { db as defaultDb } from '../db/client';
import { findProjectByUuid as findProjectByUuidDefault } from '../db/queries';
import { reconstructDocument as reconstructDocumentDefault } from '../websocket/yjs-persistence';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import type { Doc as YDoc } from 'yjs';

// Centralized export system
import {
    YjsDocumentAdapter,
    ServerYjsDocumentWrapper,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    DatabaseAssetProvider,
    CombinedAssetProvider,
    FflateZipProvider,
    Scorm12Exporter,
    Html5Exporter,
    type ExportResult,
} from '../shared/export';

/**
 * Response from platform when fetching an ELP file
 */
export interface PlatformElpResponse {
    ode_file: string; // Base64 encoded ELP file
    ode_filename: string; // Original filename
    status?: string; // '0' for success, '1' for error
    description?: string; // Error description if status is '1'
}

/**
 * Response when uploading to platform
 */
export interface PlatformSetResponse {
    success: boolean;
    error?: string;
    platformResponse?: Record<string, unknown>;
}

/**
 * JSON structure for platform communication (matches Moodle's expected format)
 */
interface PlatformJsonData {
    ode_id: string;
    ode_filename?: string;
    ode_file?: string;
    ode_user: string;
    ode_uri?: string;
    jwt_token: string;
}

/**
 * Dependencies for platform integration service
 */
export interface PlatformIntegrationDependencies {
    db: Kysely<Database>;
    findProjectByUuid: typeof findProjectByUuidDefault;
    reconstructDocument: (projectId: number) => Promise<YDoc | null>;
}

const defaultDeps: PlatformIntegrationDependencies = {
    db: defaultDb,
    findProjectByUuid: findProjectByUuidDefault,
    reconstructDocument: reconstructDocumentDefault,
};

let deps = defaultDeps;

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<PlatformIntegrationDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = defaultDeps;
}

/**
 * Get current dependencies (for testing)
 */
export function getDependencies(): PlatformIntegrationDependencies {
    return deps;
}

/**
 * Fetch ELP file from platform (e.g., Moodle)
 *
 * @param payload - Decoded JWT payload with platform parameters
 * @param jwtToken - Original JWT token for authentication
 * @returns Platform response with base64-encoded ELP file
 */
export async function platformPetitionGet(payload: PlatformJWTPayload, jwtToken: string): Promise<PlatformElpResponse> {
    const platformUrl = buildIntegrationUrl(payload.returnurl, 'get');

    if (!platformUrl) {
        throw new Error('Could not build platform integration URL from return URL');
    }

    // Build request data
    const postData: PlatformJsonData = {
        ode_id: payload.cmid,
        ode_user: payload.userid,
        jwt_token: jwtToken,
    };

    // Create form data
    const formData = new FormData();
    formData.append('ode_data', JSON.stringify(postData));

    try {
        const response = await fetch(platformUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Platform responded with status ${response.status}`);
        }

        const content = (await response.json()) as PlatformElpResponse;

        // Check for platform error
        if (content.status === '1') {
            throw new Error(content.description || 'Platform returned an error');
        }

        return content;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[PlatformIntegration] Error fetching ELP from platform:', message);
        throw new Error(`Failed to fetch ELP from platform: ${message}`);
    }
}

/**
 * Generate export and upload to platform
 *
 * This function:
 * 1. Reconstructs the Yjs document from the database
 * 2. Generates an export (SCORM12 or HTML5) using the server-side export system
 * 3. Uploads the generated ZIP to the platform
 *
 * @param payload - Decoded JWT payload with platform parameters
 * @param jwtToken - Original JWT token for authentication
 * @param projectUuid - UUID of the project to export
 * @returns Result of the upload operation
 */
export async function platformPetitionSet(
    payload: PlatformJWTPayload,
    jwtToken: string,
    projectUuid: string,
): Promise<PlatformSetResponse> {
    const platformUrl = buildIntegrationUrl(payload.returnurl, 'set');

    if (!platformUrl) {
        return {
            success: false,
            error: 'Could not build platform integration URL from return URL',
        };
    }

    let yjsDocWrapper: InstanceType<typeof ServerYjsDocumentWrapper> | null = null;

    try {
        // 1. Find the project in the database
        const project = await deps.findProjectByUuid(deps.db, projectUuid);
        if (!project) {
            return {
                success: false,
                error: `Project not found: ${projectUuid}`,
            };
        }

        // 2. Reconstruct Yjs document from database
        const yjsDoc = await deps.reconstructDocument(project.id);
        if (!yjsDoc) {
            return {
                success: false,
                error: 'Could not reconstruct project document',
            };
        }

        yjsDocWrapper = new ServerYjsDocumentWrapper(yjsDoc, projectUuid);
        if (!yjsDocWrapper.hasContent()) {
            return {
                success: false,
                error: 'Project has no content to export',
            };
        }

        // 3. Create document adapter for export
        const document = new YjsDocumentAdapter(yjsDocWrapper);

        // 4. Create providers
        const publicDir = path.join(process.cwd(), 'public');
        const resources = new FileSystemResourceProvider(publicDir);
        const zip = new FflateZipProvider();

        // Create a temporary directory for the export
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exe-export-'));

        // Create asset providers
        const fsAssets = new FileSystemAssetProvider(tempDir);
        const dbAssets = new DatabaseAssetProvider(deps.db, project.id, tempDir);
        const assets = new CombinedAssetProvider([dbAssets, fsAssets]);

        // 5. Select exporter based on package type
        const exportType = getExportTypeFromPkgType(payload.pkgtype);
        let exporter;

        if (exportType === 'scorm12') {
            exporter = new Scorm12Exporter(document, resources, assets, zip);
        } else {
            exporter = new Html5Exporter(document, resources, assets, zip);
        }

        // 6. Run export
        const exportResult: ExportResult = await exporter.export({});

        // Cleanup temp directory
        await fs.remove(tempDir);

        if (!exportResult.success || !exportResult.data) {
            return {
                success: false,
                error: exportResult.error || 'Export failed',
            };
        }

        // 7. Convert ZIP buffer to base64
        const zipBase64 = Buffer.from(exportResult.data).toString('base64');

        // 8. Build filename from project title
        const meta = document.getMetadata();
        const projectTitle = meta.title || 'project';
        const extension = exportType === 'scorm12' ? 'zip' : 'zip';
        const filename = `${projectTitle}.${extension}`;

        // 9. Send to platform
        const postData: PlatformJsonData = {
            ode_id: payload.cmid,
            ode_filename: filename,
            ode_file: zipBase64,
            ode_user: payload.userid,
            ode_uri: payload.returnurl,
            jwt_token: jwtToken,
        };

        const formData = new FormData();
        formData.append('ode_data', JSON.stringify(postData));

        const response = await fetch(platformUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            return {
                success: false,
                error: `Platform responded with status ${response.status}`,
            };
        }

        const platformResponse = (await response.json()) as Record<string, unknown>;

        // Check for platform error
        if (platformResponse.status === '1' || platformResponse.error) {
            return {
                success: false,
                error:
                    (platformResponse.description as string) ||
                    (platformResponse.error as string) ||
                    'Platform returned an error',
                platformResponse,
            };
        }

        return {
            success: true,
            platformResponse,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[PlatformIntegration] Error uploading to platform:', message);
        return {
            success: false,
            error: `Failed to upload to platform: ${message}`,
        };
    } finally {
        // Cleanup Yjs document wrapper
        if (yjsDocWrapper) {
            yjsDocWrapper.destroy();
        }
    }
}

/**
 * Build the set_ode.php URL from a return URL
 * This is a convenience wrapper around buildIntegrationUrl
 */
export function buildSetOdeUrl(returnUrl: string): string | null {
    return buildIntegrationUrl(returnUrl, 'set');
}

/**
 * Build the get_ode.php URL from a return URL
 * This is a convenience wrapper around buildIntegrationUrl
 */
export function buildGetOdeUrl(returnUrl: string): string | null {
    return buildIntegrationUrl(returnUrl, 'get');
}
