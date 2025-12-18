/**
 * Kysely Query Exports
 * Re-exports all query modules for easy importing
 */

// User queries
export * as userQueries from './users';
export {
    findUserById,
    findUserByEmail,
    findUserByExternalId,
    findUserByApiToken,
    getAllUsers,
    countUsers,
    createUser,
    updateUser,
    deleteUser,
    findOrCreateExternalUser,
    updateApiToken,
    findFirstUser,
} from './users';

// Project queries
export * as projectQueries from './projects';
export {
    findProjectById,
    findProjectByUuid,
    findProjectWithOwner,
    findProjectByUuidWithOwner,
    getProjectCollaborators,
    addCollaborator,
    removeCollaborator,
    isCollaborator,
    findProjectsByOwner,
    findProjectsAsCollaborator,
    findAllProjectsForUser,
    findSavedProjectsForUser,
    createProject,
    updateProject,
    updateProjectByUuid,
    markProjectAsSaved,
    updateProjectTitleAndSave,
    updateLastAccessed,
    softDeleteProject,
    hardDeleteProject,
    hasAccess,
    checkProjectAccess,
    findSavedProjectsByOwner,
    createProjectWithUuid,
    transferOwnership,
    transferOwnershipByUuid,
    updateProjectVisibility,
    updateProjectVisibilityByUuid,
} from './projects';

// Asset queries
export * as assetQueries from './assets';
export {
    findAssetById,
    findAssetByIdWithProject,
    findAssetByClientId,
    findAssetsByClientIds,
    findAssetByHash,
    findAssetsByHashes,
    findAllAssetsForProject,
    getProjectStorageSize,
    createAsset,
    createAssets,
    updateAsset,
    updateAssetClientId,
    deleteAsset,
    deleteAllAssetsForProject,
    bulkUpdateClientIds,
    bulkUpdateAssets,
} from './assets';

// Yjs queries
export * as yjsQueries from './yjs';
export {
    findSnapshotByProjectId,
    createSnapshot,
    updateSnapshot,
    upsertSnapshot,
    deleteSnapshot,
    snapshotExists,
    findUpdatesByProjectId,
    findUpdatesSince,
    createUpdate,
    deleteAllUpdates,
    deleteUpdatesBefore,
    getLatestVersion,
    countUpdates,
    documentExists,
    saveFullState,
    loadDocumentState,
    getAllUpdateBuffers,
    // Incremental update operations
    getUpdateStats,
    saveIncrementalUpdate,
    deleteUpdatesUpToVersion,
    loadDocumentWithUpdates,
    // Version history operations
    createVersionSnapshot,
    listVersionHistory,
    getVersionById,
    countVersions,
    pruneOldVersions,
    deleteAllVersionHistory,
    getLatestVersionHistory,
} from './yjs';
export type { UpdateStats, SaveIncrementalResult } from './yjs';

// Preference queries
export * as preferenceQueries from './preferences';
export {
    findPreferenceById,
    findPreference,
    findAllPreferencesForUser,
    getPreferenceValue,
    getPreferenceValueOrDefault,
    createPreference,
    updatePreference,
    setPreference,
    deletePreference,
    deleteAllPreferencesForUser,
    setMultiplePreferences,
    getAllPreferencesAsMap,
    getAllPreferencesAsObject,
} from './preferences';
