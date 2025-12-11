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
}

// ============================================================================
// TABLE INTERFACES
// ============================================================================

interface UsersTable {
    id: Generated<number>;
    email: string;
    user_id: string;
    password: string;
    roles: string; // JSON stored as text, parse with JSON.parse()
    is_lopd_accepted: number; // SQLite boolean = 0/1
    quota_mb: number | null;
    external_identifier: string | null;
    api_token: string | null;
    is_active: number;
    created_at: string | null;
    updated_at: string | null;
}

interface UsersPreferencesTable {
    id: Generated<number>;
    user_id: string;
    preference_key: string;
    value: string;
    description: string | null;
    is_active: number;
    created_at: string | null;
    updated_at: string | null;
}

interface ProjectsTable {
    id: Generated<number>;
    uuid: string;
    title: string;
    description: string | null;
    owner_id: number;
    status: string; // 'active' | 'archived' | 'deleted'
    visibility: string; // 'public' | 'private'
    language: string | null;
    author: string | null;
    license: string | null;
    last_accessed_at: string | null;
    saved_once: number;
    is_active: number;
    created_at: string | null;
    updated_at: string | null;
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
    created_at: string | null;
    updated_at: string | null;
}

interface YjsDocumentsTable {
    id: Generated<number>;
    project_id: number;
    snapshot_data: Uint8Array; // Blob/bytea - compatible across all dialects
    snapshot_version: string; // bigint as text
    created_at: string | null;
    updated_at: string | null;
}

interface YjsUpdatesTable {
    id: Generated<number>;
    project_id: number;
    update_data: Uint8Array;
    version: string;
    client_id: string | null;
    created_at: string | null;
}

interface YjsVersionHistoryTable {
    id: Generated<number>;
    project_id: number;
    snapshot_data: Uint8Array; // Full Yjs state at this version
    version: string; // Timestamp-based version identifier
    description: string | null; // Optional description (e.g., "Manual save", "Auto-backup")
    created_by: number | null; // User ID who created this version
    created_at: string;
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

// ============================================================================
// HELPER TYPES
// ============================================================================

export type ProjectStatus = 'active' | 'archived' | 'deleted';
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

// Helper for timestamps
export function now(): string {
    return new Date().toISOString();
}
