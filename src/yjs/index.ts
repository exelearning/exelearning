/**
 * Server-Side Yjs Module
 *
 * Provides server-side document manipulation capabilities for the REST API.
 * Enables modifying Yjs documents programmatically and broadcasting changes
 * to connected WebSocket clients.
 *
 * Main Entry Points:
 * - `withDocument`: Execute operations on a Y.Doc with locking and broadcasting
 * - `readDocument`: Read document structure without modification
 *
 * Structure Operations (via structure-binding):
 * - Pages: getPages, addPage, updatePage, deletePage, movePage
 * - Blocks: getBlocks, createBlock, updateBlock, deleteBlock, moveBlock
 * - Components: getComponents, createComponent, updateComponent, deleteComponent
 * - Metadata: getMetadataData, updateMetadataData
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
    // Change origin
    ChangeOrigin,
    // Operation results
    OperationResult,
    TransactionResult,
    // Page types
    PageData,
    CreatePageInput,
    UpdatePageInput,
    MovePageInput,
    // Block types
    BlockData,
    BlockProperties,
    CreateBlockInput,
    UpdateBlockInput,
    MoveBlockInput,
    // Component types
    ComponentData,
    ComponentProperties,
    CreateComponentInput,
    UpdateComponentInput,
    MoveComponentInput,
    // Metadata types
    MetadataData,
    UpdateMetadataInput,
    // Cache types
    DocCacheConfig,
    CachedDocument,
    // Lock types
    DocLockConfig,
    LockEntry,
} from './types';

// ============================================================================
// DOCUMENT MANAGER EXPORTS
// ============================================================================

export {
    // Main operations
    withDocument,
    readDocument,
    getDocument,
    ensureDocument,
    invalidateCache,
    getStats,
    // Project lookup
    getProjectByUuid,
    // Errors
    ProjectNotFoundError,
    DocumentLoadError,
    // Configuration
    configure as configureDocManager,
    resetDependencies as resetDocManager,
} from './doc-manager';

// ============================================================================
// STRUCTURE BINDING EXPORTS
// ============================================================================

export {
    // ID generation
    generateId,
    // Document structure accessors
    getNavigation,
    getMetadata,
    getAssets,
    // Asset operations
    getAssetMetadata,
    setAssetMetadata,
    deleteAssetMetadata,
    getAllAssetsMetadata,
    // Page operations
    getPages,
    getPage,
    addPage,
    updatePage,
    deletePage,
    movePage,
    // Block operations
    getBlocks,
    getBlock,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    // Component operations
    getComponents,
    getComponent,
    createComponent,
    updateComponent,
    setComponentHtml,
    deleteComponent,
    // Metadata operations
    getMetadataData,
    updateMetadataData,
    // Internal helpers (for advanced use)
    findPageMap,
    findBlockMap,
    findComponentMap,
    // Asset type
    type AssetMetadata,
} from './structure-binding';

// ============================================================================
// CACHE EXPORTS
// ============================================================================

export {
    configure as configureCache,
    resetConfig as resetCacheConfig,
    getConfig as getCacheConfig,
    getDocument as getCachedDocument,
    hasDocument as hasCachedDocument,
    setDocument as setCachedDocument,
    removeDocument as removeCachedDocument,
    markDirty,
    markClean,
    getCachedUuids,
    getStats as getCacheStats,
    stopCleanupTimer,
    clearAll as clearCache,
    setRoomManagerIntegration,
} from './doc-cache';

// ============================================================================
// LOCK EXPORTS
// ============================================================================

export {
    configure as configureLock,
    resetConfig as resetLockConfig,
    getConfig as getLockConfig,
    acquireLock,
    tryAcquireLock,
    isLocked,
    getLockDuration,
    withLock,
    getStats as getLockStats,
    releaseAll as releaseAllLocks,
    LockTimeoutError,
} from './doc-lock';

// ============================================================================
// BROADCASTER EXPORTS
// ============================================================================

export {
    configure as configureBroadcaster,
    resetDependencies as resetBroadcaster,
    encodeYjsUpdate,
    broadcastUpdate,
    hasActiveConnections,
    getConnectionCount,
} from './broadcaster';
