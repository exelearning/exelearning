/**
 * Type definitions for server-side Yjs document manipulation
 */
import type * as Y from 'yjs';

// ============================================================================
// CHANGE ORIGIN (for tracking who made changes)
// ============================================================================

/**
 * Origin information attached to Yjs transactions
 */
export interface ChangeOrigin {
    type: 'rest' | 'websocket' | 'cli' | 'system';
    userId?: number;
    clientId?: string;
    requestId?: string;
    command?: string;
}

// ============================================================================
// OPERATION RESULTS
// ============================================================================

/**
 * Result of a structure operation
 */
export interface OperationResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

// ============================================================================
// PAGE TYPES
// ============================================================================

/**
 * Page data as returned by API
 */
export interface PageData {
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

/**
 * Input for creating a page
 */
export interface CreatePageInput {
    name: string;
    parentId?: string | null;
    order?: number;
}

/**
 * Input for updating a page
 */
export interface UpdatePageInput {
    name?: string;
    properties?: Record<string, unknown>;
}

/**
 * Input for moving a page
 */
export interface MovePageInput {
    newParentId: string | null;
    position?: number;
}

// ============================================================================
// BLOCK TYPES
// ============================================================================

/**
 * Block data as returned by API
 */
export interface BlockData {
    id: string;
    blockId: string;
    blockName: string;
    iconName: string;
    blockType: string;
    order: number;
    componentCount: number;
    createdAt: string;
    updatedAt?: string;
    properties?: BlockProperties;
}

/**
 * Block properties
 */
export interface BlockProperties {
    visibility?: string | boolean;
    teacherOnly?: string | boolean;
    allowToggle?: string | boolean;
    minimized?: string | boolean;
    identifier?: string;
    cssClass?: string;
}

/**
 * Input for creating a block
 */
export interface CreateBlockInput {
    pageId: string;
    name?: string;
    order?: number;
}

/**
 * Input for updating a block
 */
export interface UpdateBlockInput {
    name?: string;
    iconName?: string;
    properties?: Partial<BlockProperties>;
}

/**
 * Input for moving a block
 */
export interface MoveBlockInput {
    targetPageId: string;
    position?: number;
}

// ============================================================================
// COMPONENT (IDEVICE) TYPES
// ============================================================================

/**
 * Component data as returned by API
 */
export interface ComponentData {
    id: string;
    ideviceId: string;
    ideviceType: string;
    order: number;
    createdAt: string;
    updatedAt?: string;
    htmlContent?: string;
    htmlView?: string;
    properties?: ComponentProperties;
    jsonProperties?: string | Record<string, unknown>;
    title?: string;
    subtitle?: string;
    instructions?: string;
    feedback?: string;
    lockedBy?: string;
    lockUserName?: string;
    lockUserColor?: string;
}

/**
 * Component properties
 */
export interface ComponentProperties {
    visibility?: string | boolean;
    teacherOnly?: string | boolean;
    [key: string]: unknown;
}

/**
 * Input for creating a component
 */
export interface CreateComponentInput {
    pageId: string;
    blockId: string;
    ideviceType: string;
    initialData?: Record<string, unknown>;
    order?: number;
}

/**
 * Input for updating a component
 */
export interface UpdateComponentInput {
    htmlContent?: string;
    htmlView?: string;
    properties?: Partial<ComponentProperties>;
    jsonProperties?: string | Record<string, unknown>;
    title?: string;
    subtitle?: string;
    instructions?: string;
    feedback?: string;
    [key: string]: unknown;
}

/**
 * Input for moving a component
 */
export interface MoveComponentInput {
    targetBlockId: string;
    position?: number;
}

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Project metadata
 */
export interface MetadataData {
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
    [key: string]: unknown;
}

/**
 * Input for updating metadata
 */
export interface UpdateMetadataInput {
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
    [key: string]: unknown;
}

// ============================================================================
// DOCUMENT CACHE TYPES
// ============================================================================

/**
 * Configuration for document cache
 */
export interface DocCacheConfig {
    /** Maximum number of documents in cache (default: 50) */
    maxSize: number;
    /** Time-to-live in milliseconds (default: 5 minutes) */
    ttlMs: number;
    /** Cleanup interval in milliseconds (default: 1 minute) */
    cleanupIntervalMs: number;
}

/**
 * Cached document entry
 */
export interface CachedDocument {
    ydoc: Y.Doc;
    projectId: number;
    projectUuid: string;
    loadedAt: number;
    lastAccessedAt: number;
    isDirty: boolean;
}

// ============================================================================
// DOCUMENT LOCK TYPES
// ============================================================================

/**
 * Lock configuration
 */
export interface DocLockConfig {
    /** Lock timeout in milliseconds (default: 5000) */
    timeoutMs: number;
}

/**
 * Lock entry
 */
export interface LockEntry {
    promise: Promise<void>;
    resolve: () => void;
    acquiredAt: number;
}

// ============================================================================
// DOCUMENT MANAGER TYPES
// ============================================================================

/**
 * Result of a document transaction
 */
export interface TransactionResult<T> {
    result: T;
    update: Uint8Array;
}
