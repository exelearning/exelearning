/**
 * Request Payload Types for Route Handlers
 *
 * Centralized type definitions for request bodies across all routes.
 * Replaces `body as any` casts with proper typed interfaces.
 */

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * Chunked/resumable file upload request (assets, filemanager)
 */
export interface UploadChunkRequest {
    resumableIdentifier: string;
    resumableChunkNumber: string;
    resumableTotalChunks: string;
    resumableFilename: string;
    resumableRelativePath?: string;
    file: Blob | Buffer;
}

/**
 * Single file upload request
 */
export interface FileUploadRequest {
    file: Blob | Buffer | File;
    filename?: string;
}

/**
 * Asset upload request with metadata
 */
export interface AssetUploadRequest {
    file: Blob | Buffer;
    componentId?: string;
    clientId?: string;
    filename?: string;
}

/**
 * Batch asset sync request
 */
export interface AssetBatchSyncRequest {
    assets: Array<{
        clientId: string;
        filename: string;
        data: string; // Base64 encoded
        mimeType?: string;
    }>;
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Login request - supports both Symfony and REST style
 */
export interface LoginRequest {
    _username?: string; // Symfony style
    email?: string; // REST style
    _password?: string; // Symfony style
    password?: string; // REST style
    returnUrl?: string;
}

/**
 * Guest login request
 */
export interface GuestLoginRequest {
    returnUrl?: string;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
    sub: number;
    email: string;
    roles: string[];
    isGuest: boolean;
    exp: number;
    iat: number;
}

// ============================================================================
// FileManager (FileGator) Types
// ============================================================================

/**
 * Directory listing request
 */
export interface FileGatorDirRequest {
    dir: string;
}

/**
 * File/directory creation request
 */
export interface FileGatorCreateRequest {
    type: 'file' | 'dir';
    name: string;
    path?: string;
}

/**
 * File rename request
 */
export interface FileGatorRenameRequest {
    from: string;
    to: string;
}

/**
 * File copy/move request
 */
export interface FileGatorCopyMoveRequest {
    items: string[];
    destination: string;
}

/**
 * File delete request
 */
export interface FileGatorDeleteRequest {
    items: string[];
}

/**
 * File download request
 */
export interface FileGatorDownloadRequest {
    items: string[];
}

/**
 * Change directory request
 */
export interface FileGatorChangeDirRequest {
    to: string;
}

/**
 * Delete items request - items with path property
 */
export interface FileGatorDeleteItemsRequest {
    items: Array<{ path: string }>;
}

/**
 * Rename item request
 */
export interface FileGatorRenameItemRequest {
    destination?: string;
    from: string;
    to: string;
}

/**
 * Copy/move items request - items with path property
 */
export interface FileGatorCopyMoveItemsRequest {
    items: Array<{ path: string }>;
    destination: string;
}

/**
 * Zip items request
 */
export interface FileGatorZipItemsRequest {
    items: Array<{ path: string }>;
    destination?: string;
    name?: string;
}

/**
 * Unzip item request
 */
export interface FileGatorUnzipItemRequest {
    item: string;
    destination?: string;
}

/**
 * Save content request
 */
export interface FileGatorSaveContentRequest {
    path: string;
    content: string;
}

/**
 * Get path request
 */
export interface FileGatorGetPathRequest {
    item: string;
}

/**
 * File list result (return type for listDirectory)
 */
export interface FileListResult {
    location: string;
    files: FileListItem[];
    error?: string;
}

/**
 * File list item
 */
export interface FileListItem {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size: number;
    time: number;
    permissions: number;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Structure sent from Yjs client for export
 * Matches the format built by apiCallManager.buildStructureFromYjs()
 */
export interface YjsExportStructure {
    meta: {
        title?: string;
        author?: string;
        language?: string;
        description?: string;
        license?: string;
        theme?: string;
    };
    pages: Array<{
        id: string;
        pageName: string;
        parentId?: string | null;
        blocks: Array<{
            id: string;
            blockName?: string;
            iconName?: string;
            components: Array<{
                id: string;
                ideviceType: string;
                htmlContent?: string;
                properties?: Record<string, unknown>;
            }>;
        }>;
    }>;
    navigation: Array<{
        id: string;
        navText: string;
        parentId?: string | null;
    }>;
}

/**
 * Export options for various formats
 */
export interface ExportOptionsRequest {
    baseUrl?: string;
    theme?: string;
    singlePage?: boolean;
    format?: 'html5' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elp' | 'elpx';
    /** Structure from Yjs document (sent by client for real-time exports) */
    structure?: YjsExportStructure;
}

/**
 * Convert request (ELP to export format)
 */
export interface ConvertRequest {
    file: Blob | Buffer | File;
    format?: string;
    baseUrl?: string;
    theme?: string;
}

// ============================================================================
// iDevice Types
// ============================================================================

/**
 * iDevice file upload request
 */
export interface IdeviceFileUploadRequest {
    odeIdeviceId: string;
    file?: Blob | Buffer;
    filename: string;
    createThumbnail?: boolean;
    base64String?: string;
}

/**
 * iDevice image upload request (base64)
 */
export interface IdeviceImageUploadRequest {
    odeIdeviceId: string;
    base64String: string;
    filename: string;
    createThumbnail?: boolean;
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project open request
 */
export interface ProjectOpenRequest {
    odeFilePath?: string | string[];
    odeFileName?: string | string[];
}

/**
 * Project save request
 */
export interface ProjectSaveRequest {
    sessionId: string;
    title?: string;
}

/**
 * Upload chunk for project files
 */
export interface ProjectUploadChunkRequest {
    odeFilePart: Blob | Buffer;
    odeFileName: string;
    odeSessionId: string;
}

/**
 * Project properties update
 */
export interface ProjectPropertiesRequest {
    title?: string;
    author?: string;
    description?: string;
    language?: string;
    license?: string;
    theme?: string;
}

/**
 * Used files analysis request
 */
export interface UsedFilesRequest {
    idevices: Array<{
        id: string;
        htmlView: string;
    }>;
}

// ============================================================================
// User Preferences Types
// ============================================================================

/**
 * User preferences update request
 */
export interface UserPreferencesRequest {
    [key: string]: string | number | boolean;
}

// ============================================================================
// Sharing/Collaboration Types
// ============================================================================

/**
 * Add collaborator request
 */
export interface AddCollaboratorRequest {
    email: string;
}

/**
 * Transfer ownership request
 */
export interface TransferOwnershipRequest {
    newOwnerId: number;
}

/**
 * Update visibility request
 */
export interface UpdateVisibilityRequest {
    visibility: 'public' | 'private';
}

// ============================================================================
// Session/Structure Management Types
// ============================================================================

/**
 * Session-based request with optional session ID
 */
export interface SessionRequest {
    sessionId?: string;
    odeSessionId?: string;
}

/**
 * Export request with format and options
 */
export interface ProjectExportRequest extends SessionRequest {
    format?: 'html5' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elp' | 'elpx';
}

/**
 * Current user registration for ODE
 */
export interface OdeCurrentUserRequest {
    odeSessionId: string;
    userId?: string;
}

/**
 * Check before leave request
 */
export interface CheckBeforeLeaveRequest {
    odeSessionId: string;
}

/**
 * Close session request
 */
export interface CloseSessionRequest {
    odeSessionId: string;
}

/**
 * iDevice duplicate request
 */
export interface IdeviceDuplicateRequest {
    odeSessionId: string;
    ideviceId: string;
    targetBlockId?: string;
}

/**
 * Navigation structure duplicate request
 */
export interface NavStructureDuplicateRequest {
    odeSessionId: string;
    navStructureId: string;
    parentId?: string;
}

/**
 * Page structure duplicate request
 */
export interface PagStructureDuplicateRequest {
    odeSessionId: string;
    pagStructureId: string;
    targetPageId?: string;
}

/**
 * Structure data save request (generic)
 */
export interface StructureSaveRequest {
    odeSessionId?: string;
    [key: string]: unknown;
}

/**
 * Project metadata update request
 */
export interface ProjectMetadataRequest {
    title?: string;
}
