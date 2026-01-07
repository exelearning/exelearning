/**
 * MCP Server Types and Interfaces
 *
 * Type definitions for the eXeLearning MCP server.
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

export interface McpDependencies {
    /**
     * JWT token for authenticating API v1 requests
     */
    authToken: string;

    /**
     * Authenticated user info
     */
    user: McpUser;
}

export interface McpUser {
    userId: number;
    email: string;
    roles: string[];
}

// ============================================================================
// TOOL RESULT TYPES
// ============================================================================

export interface McpToolSuccess<T = unknown> {
    success: true;
    data: T;
}

export interface McpToolError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export type McpToolResult<T = unknown> = McpToolSuccess<T> | McpToolError;

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface ProjectInfo {
    id: number;
    uuid: string;
    title: string | null;
    owner_id: number | null;
    created_at: number | null;
    updated_at: number | null;
    saved_once: boolean;
}

export interface ProjectListParams {
    limit?: number;
    offset?: number;
    search?: string;
}

export interface CreateProjectParams {
    title: string;
}

export interface UpdateProjectParams {
    uuid: string;
    title: string;
}

export interface DuplicateProjectParams {
    uuid: string;
    newTitle?: string;
}

// ============================================================================
// PAGE TYPES
// ============================================================================

export interface PageInfo {
    id: string;
    pageId: string;
    pageName: string;
    parentId: string | null;
    order: number;
    blockCount: number;
    createdAt: string;
    updatedAt?: string;
    properties?: Record<string, unknown>;
}

export interface CreatePageParams {
    projectUuid: string;
    name: string;
    parentId?: string | null;
    order?: number;
}

export interface UpdatePageParams {
    projectUuid: string;
    pageId: string;
    name?: string;
    properties?: Record<string, unknown>;
}

export interface MovePageParams {
    projectUuid: string;
    pageId: string;
    newParentId: string | null;
    position?: number;
}

// ============================================================================
// BLOCK TYPES
// ============================================================================

export interface BlockInfo {
    id: string;
    blockId: string;
    blockName: string;
    iconName: string;
    blockType: string;
    order: number;
    componentCount: number;
    createdAt: string;
    updatedAt?: string;
    properties?: Record<string, unknown>;
}

export interface CreateBlockParams {
    projectUuid: string;
    pageId: string;
    name?: string;
    order?: number;
}

export interface UpdateBlockParams {
    projectUuid: string;
    blockId: string;
    name?: string;
    iconName?: string;
    properties?: Record<string, unknown>;
}

export interface MoveBlockParams {
    projectUuid: string;
    blockId: string;
    targetPageId: string;
    position?: number;
}

// ============================================================================
// COMPONENT (IDEVICE) TYPES
// ============================================================================

export interface ComponentInfo {
    id: string;
    ideviceId: string;
    ideviceType: string;
    order: number;
    createdAt: string;
    updatedAt?: string;
    htmlContent?: string;
    htmlView?: string;
    properties?: Record<string, unknown>;
    jsonProperties?: string | Record<string, unknown>;
    title?: string;
    subtitle?: string;
    instructions?: string;
    feedback?: string;
}

export interface CreateComponentParams {
    projectUuid: string;
    blockId: string;
    ideviceType: string;
    initialData?: {
        title?: string;
        htmlContent?: string;
        instructions?: string;
    };
    order?: number;
}

export interface UpdateComponentParams {
    projectUuid: string;
    componentId: string;
    htmlContent?: string;
    htmlView?: string;
    properties?: Record<string, unknown>;
    jsonProperties?: string | Record<string, unknown>;
    title?: string;
    subtitle?: string;
    instructions?: string;
    feedback?: string;
}

export interface SetComponentHtmlParams {
    projectUuid: string;
    componentId: string;
    html: string;
}

export interface MoveComponentParams {
    projectUuid: string;
    componentId: string;
    targetBlockId: string;
    position?: number;
}

// ============================================================================
// METADATA TYPES
// ============================================================================

export interface MetadataInfo {
    title?: string;
    subtitle?: string;
    author?: string;
    description?: string;
    language?: string;
    license?: string;
    footer?: string;
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    extraHeadContent?: string;
    exportSource?: string;
    exelearning_version?: string;
}

export interface UpdateMetadataParams {
    projectUuid: string;
    title?: string;
    subtitle?: string;
    author?: string;
    description?: string;
    language?: string;
    license?: string;
    footer?: string;
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    extraHeadContent?: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = 'html5' | 'html5-sp' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elp' | 'elpx';

export interface ExportFormatInfo {
    id: string;
    name: string;
    extension: string;
    mimeType: string;
}

export interface ExportProjectParams {
    projectUuid: string;
    format: ExportFormat;
}

export interface ExportResult {
    downloadUrl: string;
    filename: string;
    format: ExportFormat;
    size: number;
}

// ============================================================================
// RESOURCE TYPES
// ============================================================================

export interface ProjectStructure {
    uuid: string;
    title: string;
    pages: PageStructure[];
}

export interface PageStructure {
    id: string;
    name: string;
    order: number;
    children: PageStructure[];
    blocks: BlockStructure[];
}

export interface BlockStructure {
    id: string;
    name: string;
    order: number;
    components: ComponentStructure[];
}

export interface ComponentStructure {
    id: string;
    type: string;
    order: number;
    title?: string;
}

export interface IdeviceInfo {
    id: string;
    name: string;
    category: string;
    description?: string;
    icon?: string;
}

export interface ThemeInfo {
    id: string;
    name: string;
    description?: string;
    previewImage?: string;
}

export interface AssetInfo {
    path: string;
    filename: string;
    mimeType: string;
    size: number;
}

// ============================================================================
// PROMPT TYPES
// ============================================================================

export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
