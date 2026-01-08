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
    findProjectByPlatformId,
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
    updateProjectTitle,
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
    // Cleanup queries
    findUnsavedProjectsOlderThan,
    findGuestProjectsOlderThan,
    deleteProjectWithRelatedData,
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
    getUserStorageUsage,
    createAsset,
    createAssets,
    updateAsset,
    updateAssetClientId,
    updateAssetFilenameByClientId,
    updateFolderPathPrefix,
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

// Admin queries
export * as adminQueries from './admin';
export {
    findUsersPaginated,
    countAdmins,
    updateUserStatus,
    createUserAsAdmin,
    updateUserQuota,
    getSystemStats,
} from './admin';
export type { AppSetting } from './admin';

// Theme queries (consolidated - base and site themes)
export * as themeQueries from './themes';
export {
    // Read queries - all themes
    findThemeById,
    findThemeByDirName,
    getAllThemes,
    getEnabledThemes,
    countThemes,
    themeDirNameExists,
    // Read queries - site themes (is_builtin=0)
    getSiteThemes,
    getEnabledSiteThemes,
    countSiteThemes,
    // Read queries - base themes (is_builtin=1)
    getBaseThemes,
    getEnabledBaseThemes,
    findBaseThemeByDirName,
    // Write queries
    createTheme,
    updateTheme,
    deleteTheme,
    // Default theme (from themes table)
    getDefaultThemeRecord,
    setDefaultThemeById,
    clearDefaultTheme,
    // Toggle enabled
    toggleThemeEnabled,
    // Sort order
    getNextSiteThemeSortOrder,
    // Default theme settings (from app_settings)
    getDefaultTheme,
    setDefaultTheme,
} from './themes';
export type { ThemeType, DefaultThemeSetting } from './themes';

// Template queries (project templates for new projects)
export * as templateQueries from './templates';
export {
    findTemplateById,
    findTemplateByFilenameAndLocale,
    getAllTemplates,
    getTemplatesByLocale,
    getEnabledTemplatesByLocale,
    countTemplates,
    countTemplatesByLocale,
    getDistinctLocales as getTemplateDistinctLocales,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateEnabled,
    templateFilenameExists,
    getNextTemplateSortOrder,
} from './templates';
