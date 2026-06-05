/**
 * Kysely Database Schema
 * A single schema for SQLite, PostgreSQL and MySQL
 */
import type { Generated, Selectable, Insertable, Updateable } from 'kysely';

// ============================================================================
// DATABASE INTERFACE (One schema for all dialects)
// ============================================================================

export interface Database {
    users: UsersTable;
    users_preferences: UsersPreferencesTable;
    projects: ProjectsTable;
    project_collaborators: ProjectCollaboratorsTable;
    assets: AssetsTable;
    yjs_documents: YjsDocumentsTable;
    yjs_updates: YjsUpdatesTable;
    yjs_version_history: YjsVersionHistoryTable;
    app_settings: AppSettingsTable;
    themes: ThemesTable;
    templates: TemplatesTable;
    impersonation_audit_logs: ImpersonationAuditLogsTable;
    activity_log: ActivityLogTable;
    // Kysely internal migration tables
    kysely_migration: KyselyMigrationTable;
    kysely_migration_lock: KyselyMigrationLockTable;
}

// ============================================================================
// TABLE INTERFACES
// ============================================================================

interface UsersTable {
    id: Generated<number>;
    email: string;
    /**
     * External login identifier for SSO integrations (nullable)
     * - CAS users: "cas:{username}"
     * - OIDC users: "oidc:{subject}"
     * - Local/Guest users: null (not SSO)
     */
    user_id: string | null;
    password: string;
    roles: string; // JSON stored as text, parse with JSON.parse()
    is_lopd_accepted: number; // SQLite boolean = 0/1
    quota_mb: number | null;
    external_identifier: string | null;
    api_token: string | null;
    is_active: number;
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface UsersPreferencesTable {
    id: Generated<number>;
    owner_id: number;
    preference_key: string;
    value: string;
    description: string | null;
    is_active: number;
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface ProjectsTable {
    id: Generated<number>;
    uuid: string;
    title: string;
    description: string | null;
    owner_id: number;
    status: string; // 'active' | 'inactive' | 'archived'
    visibility: string; // 'public' | 'private'
    language: string | null;
    author: string | null;
    license: string | null;
    last_accessed_at: number | null; // Unix timestamp in milliseconds
    saved_once: number;
    platform_id: string | null; // External platform ID (e.g., Moodle cmid)
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface ProjectCollaboratorsTable {
    project_id: number;
    user_id: number;
}

interface AssetsTable {
    id: Generated<number>;
    project_id: number;
    filename: string;
    storage_path: string;
    mime_type: string | null;
    file_size: string | null; // bigint stored as text
    client_id: string | null;
    component_id: string | null;
    content_hash: string | null;
    folder_path: string; // Relative folder path: "" = root, "website/css" = nested
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface YjsDocumentsTable {
    id: Generated<number>;
    project_id: number;
    snapshot_data: Uint8Array; // Blob/bytea - compatible across all dialects
    snapshot_version: string; // bigint as text
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface YjsUpdatesTable {
    id: Generated<number>;
    project_id: number;
    update_data: Uint8Array;
    version: string;
    client_id: string | null;
    created_at: number | null; // Unix timestamp in milliseconds
}

interface YjsVersionHistoryTable {
    id: Generated<number>;
    project_id: number;
    snapshot_data: Uint8Array; // Full Yjs state at this version
    version: string; // Timestamp-based version identifier
    description: string | null; // Optional description (e.g., "Manual save", "Auto-backup")
    created_by: number | null; // User ID who created this version
    created_at: number; // Unix timestamp in milliseconds (required)
}

interface AppSettingsTable {
    key: string;
    value: string;
    type: string;
    updated_at: number | null; // Unix timestamp in milliseconds
    updated_by: number | null;
}

/**
 * Unified themes table for both builtin (base) and site themes
 * - is_builtin=1: Base themes from public/files/perm/themes/base/
 * - is_builtin=0: Site themes uploaded by admin, stored in FILES_DIR/themes/site/
 */
interface ThemesTable {
    id: Generated<number>;
    dir_name: string;
    display_name: string;
    description: string | null;
    version: string | null;
    author: string | null;
    license: string | null;
    is_builtin: number; // SQLite boolean: 1=base theme, 0=site theme
    is_enabled: number; // SQLite boolean = 0/1
    is_default: number; // SQLite boolean = 0/1
    sort_order: number;
    storage_path: string | null; // NULL for builtin themes (use filesystem)
    file_size: number | null;
    uploaded_by: number | null;
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface TemplatesTable {
    id: Generated<number>;
    filename: string;
    display_name: string;
    description: string | null;
    locale: string;
    is_enabled: number; // SQLite boolean = 0/1
    sort_order: number;
    storage_path: string;
    file_size: number | null;
    preview_image: string | null;
    uploaded_by: number | null;
    created_at: number | null; // Unix timestamp in milliseconds
    updated_at: number | null; // Unix timestamp in milliseconds
}

interface ImpersonationAuditLogsTable {
    id: Generated<number>;
    session_id: string;
    impersonator_user_id: number;
    impersonated_user_id: number;
    started_at: number;
    ended_at: number | null;
    started_by_ip: string | null;
    started_user_agent: string | null;
    ended_by_ip: string | null;
    ended_user_agent: string | null;
}

interface ActivityLogTable {
    id: Generated<number>;
    event_type: string;
    user_id: number | null;
    created_at: number; // Unix timestamp in milliseconds
}

// Kysely internal migration tables
interface KyselyMigrationTable {
    name: string;
    timestamp: string;
}

interface KyselyMigrationLockTable {
    id: string;
    is_locked: number;
}

// ============================================================================
// TYPE EXPORTS (for queries)
// ============================================================================

// Users
export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// User Preferences
export type UserPreference = Selectable<UsersPreferencesTable>;
export type NewUserPreference = Insertable<UsersPreferencesTable>;
export type UserPreferenceUpdate = Updateable<UsersPreferencesTable>;

// Projects
export type Project = Selectable<ProjectsTable>;
export type NewProject = Insertable<ProjectsTable>;
export type ProjectUpdate = Updateable<ProjectsTable>;

// Project Collaborators
export type ProjectCollaborator = Selectable<ProjectCollaboratorsTable>;
export type NewProjectCollaborator = Insertable<ProjectCollaboratorsTable>;

// Assets
export type Asset = Selectable<AssetsTable>;
export type NewAsset = Insertable<AssetsTable>;
export type AssetUpdate = Updateable<AssetsTable>;

// Yjs Documents
export type YjsDocument = Selectable<YjsDocumentsTable>;
export type NewYjsDocument = Insertable<YjsDocumentsTable>;
export type YjsDocumentUpdate = Updateable<YjsDocumentsTable>;

// Yjs Updates
export type YjsUpdate = Selectable<YjsUpdatesTable>;
export type NewYjsUpdate = Insertable<YjsUpdatesTable>;

// Yjs Version History
export type YjsVersionHistory = Selectable<YjsVersionHistoryTable>;
export type NewYjsVersionHistory = Insertable<YjsVersionHistoryTable>;

// Themes (unified: base and site themes)
export type Theme = Selectable<ThemesTable>;
export type NewTheme = Insertable<ThemesTable>;
export type ThemeUpdate = Updateable<ThemesTable>;

// Templates (project templates for new projects)
export type Template = Selectable<TemplatesTable>;
export type NewTemplate = Insertable<TemplatesTable>;
export type TemplateUpdate = Updateable<TemplatesTable>;

// Impersonation audit logs
export type ImpersonationAuditLog = Selectable<ImpersonationAuditLogsTable>;
export type NewImpersonationAuditLog = Insertable<ImpersonationAuditLogsTable>;
export type ImpersonationAuditLogUpdate = Updateable<ImpersonationAuditLogsTable>;

// Audit events
export type ActivityEvent = Selectable<ActivityLogTable>;
export type NewActivityEvent = Insertable<ActivityLogTable>;

// ============================================================================
// HELPER TYPES
// ============================================================================

export type ProjectStatus = 'active' | 'inactive' | 'archived';
export type ProjectVisibility = 'public' | 'private';

// Helper to parse JSON roles from string
export function parseRoles(roles: string): string[] {
    try {
        return JSON.parse(roles);
    } catch {
        return [];
    }
}

// Helper to stringify roles to JSON
export function stringifyRoles(roles: string[]): string {
    return JSON.stringify(roles);
}

// Helper for timestamps - returns Unix milliseconds
export function now(): number {
    return Date.now();
}
