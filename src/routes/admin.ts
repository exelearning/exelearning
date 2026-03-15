/**
 * Admin Routes for Elysia
 * Protected endpoints for system administration
 * Requires ROLE_ADMIN for all routes
 */
import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import * as bcrypt from 'bcryptjs';
import { db as defaultDb } from '../db/client';
import { invalidateMaintenanceCache } from '../services/maintenance';
import type { Kysely } from 'kysely';
import type { Database, User } from '../db/types';
import { parseRoles } from '../db/types';
import type { JwtPayload } from './auth';
import {
    findUserById as findUserByIdDefault,
    findUserByEmail as findUserByEmailDefault,
    updateUserRoles as updateUserRolesDefault,
    deleteUser as deleteUserDefault,
} from '../db/queries/users';
import {
    findUsersPaginated as findUsersPaginatedDefault,
    countAdmins as countAdminsDefault,
    updateUserStatus as updateUserStatusDefault,
    createUserAsAdmin as createUserAsAdminDefault,
    updateUserQuota as updateUserQuotaDefault,
    getSystemStats as getSystemStatsDefault,
    getAllSettings as getAllSettingsDefault,
    setSetting as setSettingDefault,
    findProjectsPaginated as findProjectsPaginatedDefault,
} from '../db/queries/admin';
import { createImpersonationAuditSession as createImpersonationAuditSessionDefault } from '../db/queries/impersonation';
import {
    findProjectById as findProjectByIdDefault,
    updateProject as updateProjectDefault,
    hardDeleteProject as hardDeleteProjectDefault,
    findProjectsByOwnerId as findProjectsByOwnerIdDefault,
} from '../db/queries/projects';
import { getUserStorageUsage as getUserStorageUsageDefault } from '../db/queries/assets';
import { requireAdmin, hasRole, ROLES, PROTECTED_ROLE } from '../utils/guards';
import { trans } from '../services/translation';
import { getBasePath } from '../utils/basepath.util';
import { getSystemInfo } from '../services/system-info';
import { createFileHelper, type FileHelper } from '../services/file-helper';
import * as pathModule from 'path';
import {
    ElpxExporter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    DatabaseAssetProvider,
    CombinedAssetProvider,
    FflateZipProvider,
    YjsDocumentAdapter,
    ServerYjsDocumentWrapper,
} from '../shared/export';
import { reconstructDocument } from '../websocket/yjs-persistence';

type AppSettingsTable = {
    key: string;
    value: string;
    type: string;
    updated_at: number | null; // Unix timestamp in milliseconds
    updated_by: number | null;
};

type AppSettingsDb = Kysely<Database & { app_settings: AppSettingsTable }>;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Query dependencies for admin routes
 */
export interface AdminQueries {
    findUserById: typeof findUserByIdDefault;
    findUserByEmail: typeof findUserByEmailDefault;
    findUsersPaginated: typeof findUsersPaginatedDefault;
    countAdmins: typeof countAdminsDefault;
    updateUserRoles: typeof updateUserRolesDefault;
    updateUserStatus: typeof updateUserStatusDefault;
    createUserAsAdmin: typeof createUserAsAdminDefault;
    updateUserQuota: typeof updateUserQuotaDefault;
    deleteUser: typeof deleteUserDefault;
    getSystemStats: typeof getSystemStatsDefault;
    getUserStorageUsage: typeof getUserStorageUsageDefault;
    getAllSettings: typeof getAllSettingsDefault;
    setSetting: typeof setSettingDefault;
    findProjectsPaginated: typeof findProjectsPaginatedDefault;
    findProjectById: typeof findProjectByIdDefault;
    updateProject: typeof updateProjectDefault;
    hardDeleteProject: typeof hardDeleteProjectDefault;
    findProjectsByOwnerId: typeof findProjectsByOwnerIdDefault;
    createImpersonationAuditSession: typeof createImpersonationAuditSessionDefault;
}

/**
 * Dependencies for admin routes
 */
export interface AdminDependencies {
    db: Kysely<Database>;
    queries: AdminQueries;
    fileHelper?: FileHelper;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const defaultDependencies: AdminDependencies = {
    db: defaultDb,
    queries: {
        findUserById: findUserByIdDefault,
        findUserByEmail: findUserByEmailDefault,
        findUsersPaginated: findUsersPaginatedDefault,
        countAdmins: countAdminsDefault,
        updateUserRoles: updateUserRolesDefault,
        updateUserStatus: updateUserStatusDefault,
        createUserAsAdmin: createUserAsAdminDefault,
        updateUserQuota: updateUserQuotaDefault,
        deleteUser: deleteUserDefault,
        getSystemStats: getSystemStatsDefault,
        getUserStorageUsage: getUserStorageUsageDefault,
        getAllSettings: getAllSettingsDefault,
        setSetting: setSettingDefault,
        findProjectsPaginated: findProjectsPaginatedDefault,
        findProjectById: findProjectByIdDefault,
        updateProject: updateProjectDefault,
        hardDeleteProject: hardDeleteProjectDefault,
        findProjectsByOwnerId: findProjectsByOwnerIdDefault,
        createImpersonationAuditSession: createImpersonationAuditSessionDefault,
    },
    fileHelper: createFileHelper(),
};

// Get JWT secret (same as auth.ts)
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the translation object for the admin panel template.
 * Kept here so these strings are excluded from the main translation extraction.
 */
export function buildAdminTranslations(locale: string): Record<string, string> {
    return {
        // Navigation / layout
        admin_panel: trans('Admin Panel', {}, locale),
        dashboard: trans('Dashboard', {}, locale),
        menu: trans('Menu', {}, locale),
        navigation: trans('Navigation', {}, locale),
        back_to_workarea: trans('Back to Workarea', {}, locale),
        logout: trans('Logout', {}, locale),
        version: trans('Version', {}, locale),
        // Common actions
        save: trans('Save', {}, locale),
        cancel: trans('Cancel', {}, locale),
        edit: trans('Edit', {}, locale),
        delete: trans('Delete', {}, locale),
        create: trans('Create', {}, locale),
        download: trans('Download', {}, locale),
        preview: trans('Preview', {}, locale),
        search: trans('Search', {}, locale),
        required: trans('Required', {}, locale),
        // Common statuses / labels
        active: trans('Active', {}, locale),
        inactive: trans('Inactive', {}, locale),
        enabled: trans('Enabled', {}, locale),
        loading: trans('Loading...', {}, locale),
        updating: trans('Updating...', {}, locale),
        deleting: trans('Deleting...', {}, locale),
        archiving: trans('Archiving...', {}, locale),
        error_loading: trans('Error loading data', {}, locale),
        // Common field labels
        email: trans('Email', {}, locale),
        password: trans('Password', {}, locale),
        name: trans('Name', {}, locale),
        title: trans('Title', {}, locale),
        description: trans('Description', {}, locale),
        author: trans('Author', {}, locale),
        locale: trans('Locale', {}, locale),
        roles: trans('Roles', {}, locale),
        status: trans('Status', {}, locale),
        actions: trans('Actions', {}, locale),
        source: trans('Source', {}, locale),
        filename: trans('Filename', {}, locale),
        created: trans('Created', {}, locale),
        visibility: trans('Visibility', {}, locale),
        // Selection / bulk actions
        select_all: trans('Select All', {}, locale),
        clear_selection: trans('Clear', {}, locale),
        selected: trans('selected', {}, locale),
        delete_selected: trans('Delete Selected', {}, locale),
        // Dashboard stats
        total_users: trans('Total Users', {}, locale),
        active_users: trans('Active Users', {}, locale),
        total_projects: trans('Total Projects', {}, locale),
        active_projects: trans('Active Projects', {}, locale),
        // Sections
        users: trans('Users', {}, locale),
        projects: trans('Projects', {}, locale),
        extensions: trans('Extensions', {}, locale),
        settings: trans('Settings', {}, locale),
        styles: trans('Styles', {}, locale),
        templates: trans('Templates', {}, locale),
        global_settings: trans('Global Settings', {}, locale),
        system_info: trans('System Info', {}, locale),
        // User management
        user_management: trans('User Management', {}, locale),
        create_user: trans('Create User', {}, locale),
        edit_user: trans('Edit User', {}, locale),
        display_name: trans('Display Name', {}, locale),
        log_in_as: trans('Log in as', {}, locale),
        cannot_impersonate_admin: trans('Cannot impersonate administrator users', {}, locale),
        cannot_impersonate_self: trans('Cannot impersonate your own account', {}, locale),
        confirm_impersonate: trans('Start impersonation as {email}?', {}, locale),
        impersonation_failed: trans('Failed to start impersonation', {}, locale),
        confirm_delete: trans('Are you sure you want to delete this user?', {}, locale),
        confirm_delete_bulk: trans('Are you sure you want to delete {count} users?', {}, locale),
        // Project management
        project_management: trans('Project Management', {}, locale),
        owner: trans('Owner', {}, locale),
        base: trans('Base', {}, locale),
        site: trans('Site', {}, locale),
        protected: trans('Protected', {}, locale),
        archive: trans('Archive', {}, locale),
        view_project: trans('View Project', {}, locale),
        download_elpx: trans('Download .elpx', {}, locale),
        confirm_delete_project: trans('Are you sure you want to delete this project?', {}, locale),
        confirm_delete_project_bulk: trans('Are you sure you want to delete {count} projects?', {}, locale),
        all_statuses: trans('All statuses', {}, locale),
        all_visibility: trans('All visibility', {}, locale),
        user: trans('User', {}, locale),
        // Themes management
        themes_management: trans('Themes Management', {}, locale),
        no_themes: trans('No themes available.', {}, locale),
        set_default: trans('Set', {}, locale),
        default: trans('Default', {}, locale),
        cannot_disable_default: trans('Cannot disable the default theme', {}, locale),
        default_theme_set: trans('Default theme set', {}, locale),
        theme_uploaded: trans('Theme uploaded successfully', {}, locale),
        theme_deleted: trans('Theme deleted', {}, locale),
        upload_theme: trans('Upload Theme', {}, locale),
        // Templates management
        templates_management: trans('Templates Management', {}, locale),
        no_templates: trans('No templates for this locale.', {}, locale),
        confirm_delete_template: trans('Are you sure you want to delete the template', {}, locale),
        confirm_delete_theme: trans('Are you sure you want to delete the theme', {}, locale),
        template_uploaded: trans('Template uploaded successfully', {}, locale),
        template_deleted: trans('Template deleted', {}, locale),
        upload_template: trans('Upload Template', {}, locale),
        // Settings — general
        platform_and_collaboration: trans('Platform and collaboration', {}, locale),
        enabled_auth_methods: trans('Enabled authentication methods.', {}, locale),
        allows_install_themes_online: trans('Allows installing themes online.', {}, locale),
        allows_install_idevices_online: trans('Allows installing iDevices online.', {}, locale),
        // Settings — storage & quotas
        storage_and_quotas: trans('Storage and quotas', {}, locale),
        quota_mb: trans('Quota (MB)', {}, locale),
        quota_help: trans('Leave empty for unlimited quota', {}, locale),
        default_quota_mb: trans('Default quota (MB).', {}, locale),
        max_storage_per_user: trans('Maximum storage per user (MB).', {}, locale),
        max_upload_size: trans('Maximum upload size (MB).', {}, locale),
        unlimited: trans('Unlimited', {}, locale),
        count_autosave_in_quota: trans('Counts autosave in quota.', {}, locale),
        // Settings — autosave
        autosave: trans('Autosave', {}, locale),
        autosave_interval: trans('Autosave interval (seconds).', {}, locale),
        // Customization
        customization: trans('Customization', {}, locale),
        custom_head_html_label: trans('Custom HEAD HTML', {}, locale),
        custom_head_html_help: trans(
            'HTML injected into the <head> of all user pages (login, workarea, error pages). Not applied to the admin panel. Only <style>, <meta>, <link> and <script> tags are allowed; any other tags will be removed automatically.',
            {},
            locale,
        ),
        custom_head_html_jquery_note: trans('jQuery is available on all user pages.', {}, locale),
        custom_head_html_hook_label: trans(
            'To run code only in the workarea after the app is fully loaded, define',
            {},
            locale,
        ),
        custom_head_html_example: trans('Example', {}, locale),
        app_identity_label: trans('App Identity', {}, locale),
        app_name_label: trans('Application name', {}, locale),
        app_name_help: trans('Page title shown in the browser tab. Leave empty to use "eXeLearning".', {}, locale),
        app_favicon_label: trans('Favicon', {}, locale),
        app_favicon_help: trans(
            'Icon shown in the browser tab and bookmarks. Leave empty to use the default favicon.',
            {},
            locale,
        ),
        app_favicon_delete: trans('Delete favicon', {}, locale),
        custom_assets_label: trans('Custom Assets', {}, locale),
        custom_assets_help: trans(
            'Upload images or other files to reference them from the Custom HEAD HTML via CSS or JS. Copy the URL of each file to use it in your code.',
            {},
            locale,
        ),
        custom_assets_empty: trans('No files uploaded yet.', {}, locale),
        custom_assets_copy_url: trans('Copy URL', {}, locale),
    };
}

/**
 * Parse and validate an ID parameter from route params.
 * Returns the parsed number if valid, or null if invalid.
 * Sets status 400 and returns error response if invalid.
 */
function parseAndValidateId(
    paramsId: string,
    set: { status: number },
): { id: number } | { error: string; message: string } {
    const id = parseInt(paramsId, 10);
    if (isNaN(id)) {
        set.status = 400;
        return { error: 'BAD_REQUEST', message: 'Invalid ID' };
    }
    return { id };
}

function getRequestClientIp(request: Request): string | null {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim();
        if (firstIp) return firstIp;
    }
    return null;
}

/**
 * HTML tags allowed in the Custom HEAD HTML setting.
 * Only these tags are valid in <head> and safe for injection.
 */
const ALLOWED_HEAD_TAGS = new Set(['style', 'meta', 'link', 'script']);

/**
 * Allowed tags that are void elements (no closing tag).
 */
const VOID_HEAD_TAGS = new Set(['meta', 'link']);

/**
 * Sanitize Custom HEAD HTML: keep only allowed tags (style, meta, link, script).
 * Removes entire elements — including their text content — whose tag is not in the allowed list.
 * Any top-level text not inside an allowed element is also discarded.
 *
 * Uses an iterative parser so content of disallowed elements is never left behind.
 */
export function sanitizeCustomHeadHtml(html: string): string {
    if (!html) return '';

    const kept: string[] = [];
    let pos = 0;
    const len = html.length;

    while (pos < len) {
        // Advance to the next '<'; discard any top-level text before it
        const lt = html.indexOf('<', pos);
        if (lt === -1) break;

        // Preserve HTML comments: <!-- ... -->
        if (html.startsWith('<!--', lt)) {
            const end = html.indexOf('-->', lt + 4);
            if (end === -1) break;
            kept.push(html.slice(lt, end + 3));
            pos = end + 3;
            continue;
        }

        // Skip orphaned closing tags
        if (html[lt + 1] === '/') {
            const gt = html.indexOf('>', lt);
            pos = gt === -1 ? len : gt + 1;
            continue;
        }

        // Parse the tag name
        const tagMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/i.exec(html.slice(lt));
        if (!tagMatch) {
            pos = lt + 1;
            continue;
        }

        const tagName = tagMatch[1].toLowerCase();
        const isAllowed = ALLOWED_HEAD_TAGS.has(tagName);

        // Find the end of the opening tag
        const gt = html.indexOf('>', lt);
        if (gt === -1) break;

        const isSelfClosing = html[gt - 1] === '/';

        if (VOID_HEAD_TAGS.has(tagName) || isSelfClosing) {
            // Void or self-closing tag — no closing tag to find
            if (isAllowed) kept.push(html.slice(lt, gt + 1));
            pos = gt + 1;
        } else {
            // Paired element — find matching closing tag and include/skip the whole block
            const closeRe = new RegExp(`</${tagName}\\s*>`, 'i');
            const afterOpen = gt + 1;
            const closeMatch = closeRe.exec(html.slice(afterOpen));
            const endPos = closeMatch ? afterOpen + closeMatch.index + closeMatch[0].length : afterOpen;
            if (isAllowed) kept.push(html.slice(lt, endPos));
            pos = endPos;
        }
    }

    return kept.join('\n').trim();
}

/**
 * MIME types allowed for custom asset uploads.
 * Derived from ALLOWED_EXTENSIONS in config.ts.
 */
export const ALLOWED_ASSET_MIME_TYPES = new Set([
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    // Audio
    'audio/mpeg', // mp3
    'audio/ogg', // ogg
    'audio/wav', // wav
    'audio/mp4', // m4a
    'audio/x-wav', // wav alternative
    'audio/wave', // wav alternative
    // Video
    'video/mp4', // mp4
    'video/webm', // webm
    'video/ogg', // ogv
    // Documents
    'application/pdf', // pdf
    // Archives
    'application/zip', // zip
    'application/x-zip-compressed', // zip alternative
    // Text / Code
    'text/plain', // txt
    'text/html', // html, htm
    'text/css', // css
    'text/javascript', // js (legacy MIME)
    'text/xml', // xml
    'application/javascript', // js
    'application/json', // json
    'application/xml', // xml alternative
    // Fonts
    'font/ttf', // ttf
    'font/woff', // woff
    'font/woff2', // woff2
    'application/x-font-ttf', // ttf alternative
    'application/font-woff', // woff alternative
    'application/font-woff2', // woff2 alternative
    'application/vnd.ms-fontobject', // eot
]);

/**
 * Sanitize user for API response (remove password)
 */
function sanitizeUser(user: User): Omit<User, 'password'> & { roles: string[] } {
    const { password: _password, ...rest } = user;
    return {
        ...rest,
        roles: parseRoles(user.roles),
    };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createUserSchema = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 4 }),
    roles: t.Optional(t.Array(t.String())),
    quota_mb: t.Optional(t.Number()),
});

const updateRolesSchema = t.Object({
    roles: t.Array(t.String()),
});

const updateStatusSchema = t.Object({
    is_active: t.Boolean(),
});

const updateQuotaSchema = t.Object({
    quota_mb: t.Union([t.Number(), t.Null()]),
});

const startImpersonationSchema = t.Object({
    user_id: t.Number(),
});

const updateProjectStatusSchema = t.Object({
    status: t.Union([t.Literal('active'), t.Literal('inactive'), t.Literal('archived')]),
});

const updateSettingsSchema = t.Object({
    settings: t.Array(
        t.Object({
            key: t.String(),
            value: t.String(),
            type: t.Union([t.Literal('string'), t.Literal('number'), t.Literal('boolean'), t.Literal('json')]),
        }),
    ),
});

const ADMIN_SETTINGS_DEFAULTS: Record<
    string,
    { value: string | number | boolean; type: 'string' | 'number' | 'boolean' | 'json' }
> = {
    ONLINE_THEMES_INSTALL: { value: process.env.ONLINE_THEMES_INSTALL ?? '0', type: 'boolean' },
    ONLINE_IDEVICES_INSTALL: { value: process.env.ONLINE_IDEVICES_INSTALL ?? '0', type: 'boolean' },
    APP_AUTH_METHODS: { value: process.env.APP_AUTH_METHODS || 'password,cas,openid,guest', type: 'string' },
    VERSION_CONTROL: { value: process.env.VERSION_CONTROL ?? 'true', type: 'boolean' },
    DEFAULT_PROJECT_VISIBILITY: { value: process.env.DEFAULT_PROJECT_VISIBILITY || 'private', type: 'string' },
    USER_RECENT_ODE_FILES_AMOUNT: { value: process.env.USER_RECENT_ODE_FILES_AMOUNT ?? '3', type: 'number' },
    COLLABORATIVE_BLOCK_LEVEL: { value: process.env.COLLABORATIVE_BLOCK_LEVEL || 'idevice', type: 'string' },
    USER_STORAGE_MAX_DISK_SPACE: { value: process.env.USER_STORAGE_MAX_DISK_SPACE ?? '1024', type: 'number' },
    DEFAULT_QUOTA: { value: process.env.DEFAULT_QUOTA ?? '4096', type: 'number' },
    COUNT_USER_AUTOSAVE_SPACE_ODE_FILES: {
        value: process.env.COUNT_USER_AUTOSAVE_SPACE_ODE_FILES ?? 'true',
        type: 'boolean',
    },
    FILE_UPLOAD_MAX_SIZE: { value: process.env.FILE_UPLOAD_MAX_SIZE ?? '1024', type: 'number' },
    PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL: {
        value: process.env.PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL ?? '600',
        type: 'number',
    },
    PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES: {
        value: process.env.PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES ?? '10',
        type: 'number',
    },
    AUTOSAVE_ODE_FILES_FUNCTION: { value: process.env.AUTOSAVE_ODE_FILES_FUNCTION ?? 'true', type: 'boolean' },
    CAS_URL: { value: process.env.CAS_URL || 'https://casserverpac4j.herokuapp.com', type: 'string' },
    CAS_VALIDATE_PATH: { value: process.env.CAS_VALIDATE_PATH || '/p3/serviceValidate', type: 'string' },
    CAS_LOGIN_PATH: { value: process.env.CAS_LOGIN_PATH || '/login', type: 'string' },
    CAS_LOGOUT_PATH: { value: process.env.CAS_LOGOUT_PATH || '/logout', type: 'string' },
    OIDC_ISSUER: { value: process.env.OIDC_ISSUER || 'https://demo.duendesoftware.com', type: 'string' },
    OIDC_AUTHORIZATION_ENDPOINT: {
        value: process.env.OIDC_AUTHORIZATION_ENDPOINT || 'https://demo.duendesoftware.com/connect/authorize',
        type: 'string',
    },
    OIDC_TOKEN_ENDPOINT: {
        value: process.env.OIDC_TOKEN_ENDPOINT || 'https://demo.duendesoftware.com/connect/token',
        type: 'string',
    },
    OIDC_USERINFO_ENDPOINT: {
        value: process.env.OIDC_USERINFO_ENDPOINT || 'https://demo.duendesoftware.com/connect/userinfo',
        type: 'string',
    },
    OIDC_SCOPE: { value: process.env.OIDC_SCOPE || 'openid email', type: 'string' },
    OIDC_CLIENT_ID: { value: process.env.OIDC_CLIENT_ID || 'interactive.confidential', type: 'string' },
    OIDC_CLIENT_SECRET: { value: process.env.OIDC_CLIENT_SECRET || 'secret', type: 'string' },
    GOOGLE_CLIENT_ID: {
        value: process.env.GOOGLE_CLIENT_ID || 'example.com.apps.googleusercontent.com',
        type: 'string',
    },
    GOOGLE_CLIENT_SECRET: { value: process.env.GOOGLE_CLIENT_SECRET || 'example.com', type: 'string' },
    DROPBOX_CLIENT_ID: { value: process.env.DROPBOX_CLIENT_ID || 'example.com', type: 'string' },
    DROPBOX_CLIENT_SECRET: { value: process.env.DROPBOX_CLIENT_SECRET || 'example.com', type: 'string' },
    OPENEQUELLA_CLIENT_ID: { value: process.env.OPENEQUELLA_CLIENT_ID || 'example.com', type: 'string' },
    OPENEQUELLA_CLIENT_SECRET: { value: process.env.OPENEQUELLA_CLIENT_SECRET || 'example.com', type: 'string' },
    CUSTOM_HEAD_HTML: { value: '', type: 'string' },
    APP_NAME: { value: '', type: 'string' },
    APP_FAVICON_PATH: { value: '', type: 'string' },
    MAINTENANCE_MODE: { value: process.env.MAINTENANCE_MODE ?? 'false', type: 'boolean' },
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create admin routes with dependency injection
 */
export function createAdminRoutes(deps: AdminDependencies = defaultDependencies) {
    const { db, queries, fileHelper = createFileHelper() } = deps;

    return (
        new Elysia({ name: 'admin-routes' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive JWT payload from request
            .derive(async ({ jwt: jwtPlugin, cookie, request }) => {
                let token: string | undefined;

                // Get token from Authorization header
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { jwtPayload: null as JwtPayload | null };
                }

                try {
                    const payload = (await jwtPlugin.verify(token)) as JwtPayload | false;
                    return { jwtPayload: payload || null };
                } catch {
                    return { jwtPayload: null as JwtPayload | null };
                }
            })

            // Global guard: Require ROLE_ADMIN for all routes in this group
            .onBeforeHandle(({ set, jwtPayload }) => {
                const authError = requireAdmin(jwtPayload);
                if (authError) {
                    set.status = authError.status;
                    return {
                        error: authError.error,
                        message: authError.message,
                    };
                }
            })

            // =====================================================
            // DASHBOARD / STATS
            // =====================================================

            // GET /api/admin/stats - Get system statistics
            .get('/api/admin/stats', async () => {
                const stats = await queries.getSystemStats(db);
                return {
                    ...stats,
                    timestamp: new Date().toISOString(),
                };
            })

            // GET /api/admin/system-info - Get system information (runtime, db, memory, etc.)
            .get('/api/admin/system-info', async () => {
                return await getSystemInfo();
            })

            // =====================================================
            // APP SETTINGS
            // =====================================================

            // GET /api/admin/settings - Get admin settings (defaults + overrides)
            .get('/api/admin/settings', async () => {
                const stored = await queries.getAllSettings(db as unknown as AppSettingsDb);
                const storedMap = new Map(stored.map(item => [item.key, item]));

                const settings: Record<string, { value: string | number | boolean; type: string }> = {};
                for (const [key, def] of Object.entries(ADMIN_SETTINGS_DEFAULTS)) {
                    const override = storedMap.get(key);
                    settings[key] = {
                        value: override ? override.value : def.value,
                        type: override ? override.type : def.type,
                    };
                }

                return { settings };
            })

            // PUT /api/admin/settings - Update admin settings
            .put(
                '/api/admin/settings',
                async ({ body, set, jwtPayload }) => {
                    const data = body as { settings: Array<{ key: string; value: string; type: string }> };
                    const sanitizedValues: Record<string, string> = {};

                    for (const setting of data.settings) {
                        const def = ADMIN_SETTINGS_DEFAULTS[setting.key];
                        if (!def) {
                            set.status = 400;
                            return { error: 'Bad Request', message: `Unknown setting: ${setting.key}` };
                        }

                        if (setting.key === 'CUSTOM_HEAD_HTML') {
                            setting.value = sanitizeCustomHeadHtml(setting.value);
                            sanitizedValues['CUSTOM_HEAD_HTML'] = setting.value;
                        }

                        if (setting.key === 'APP_AUTH_METHODS') {
                            const methods = setting.value
                                .split(',')
                                .map(m => m.trim())
                                .filter(Boolean);
                            const allowedMethods = new Set(['password', 'cas', 'openid', 'guest']);
                            const invalid = methods.filter(method => !allowedMethods.has(method));
                            if (methods.length === 0) {
                                set.status = 400;
                                return {
                                    error: 'Bad Request',
                                    message: 'APP_AUTH_METHODS must include at least one method',
                                };
                            }
                            if (invalid.length > 0) {
                                set.status = 400;
                                return {
                                    error: 'Bad Request',
                                    message: `APP_AUTH_METHODS has invalid values: ${invalid.join(', ')}`,
                                };
                            }
                        }

                        try {
                            await queries.setSetting(
                                db as unknown as AppSettingsDb,
                                setting.key,
                                setting.value,
                                setting.type as 'string' | 'number' | 'boolean' | 'json',
                                jwtPayload?.sub ? Number(jwtPayload.sub) : undefined,
                            );
                        } catch (error) {
                            set.status = 500;
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            return {
                                error: 'Internal Server Error',
                                message: `Failed to save ${setting.key}: ${errorMessage}`,
                            };
                        }
                    }

                    // Invalidate maintenance cache if MAINTENANCE_MODE was changed
                    if (data.settings.some(s => s.key === 'MAINTENANCE_MODE')) {
                        invalidateMaintenanceCache();
                    }

                    return { success: true, sanitizedValues };
                },
                { body: updateSettingsSchema },
            )

            // =====================================================
            // USER MANAGEMENT
            // =====================================================

            // POST /api/admin/impersonation/start - Start impersonating a user
            .post(
                '/api/admin/impersonation/start',
                async ({ body, set, jwtPayload, cookie, request, jwt: jwtPlugin }) => {
                    const adminUserId = Number(jwtPayload!.sub);
                    const targetUserId = Number(body.user_id);

                    if (!Number.isInteger(adminUserId) || !Number.isInteger(targetUserId)) {
                        set.status = 400;
                        return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                    }

                    if (adminUserId === targetUserId) {
                        set.status = 400;
                        return { error: 'CANNOT_IMPERSONATE_SELF', message: 'Cannot impersonate your own account' };
                    }

                    const targetUser = await queries.findUserById(db, targetUserId);
                    if (!targetUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    if (targetUser.is_active !== 1) {
                        set.status = 400;
                        return { error: 'USER_INACTIVE', message: 'Cannot impersonate an inactive user' };
                    }

                    const targetRoles = parseRoles(targetUser.roles);
                    if (hasRole(targetRoles, ROLES.ADMIN)) {
                        set.status = 403;
                        return {
                            error: 'CANNOT_IMPERSONATE_ADMIN',
                            message: 'Impersonating administrator accounts is not allowed',
                        };
                    }

                    const authHeader = request.headers.get('authorization');
                    const sourceToken = authHeader?.startsWith('Bearer ')
                        ? authHeader.slice(7)
                        : cookie.auth?.value || null;

                    if (!sourceToken) {
                        set.status = 401;
                        return { error: 'UNAUTHORIZED', message: 'No active session to preserve' };
                    }

                    const sessionId = crypto.randomUUID();
                    const userAgent = request.headers.get('user-agent');
                    const clientIp = getRequestClientIp(request);

                    await queries.createImpersonationAuditSession(db, {
                        sessionId,
                        impersonatorUserId: adminUserId,
                        impersonatedUserId: targetUserId,
                        startedByIp: clientIp,
                        startedUserAgent: userAgent,
                    });

                    const impersonatedPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
                        sub: targetUser.id,
                        email: targetUser.email,
                        roles: targetRoles,
                        isGuest: false,
                        authMethod: jwtPayload?.authMethod || 'local',
                        isImpersonated: true,
                        impersonatedBy: adminUserId,
                        impersonationSessionId: sessionId,
                    };

                    const impersonatedToken = await jwtPlugin.sign(impersonatedPayload);
                    const secure = process.env.NODE_ENV === 'production';
                    const sevenDays = 7 * 24 * 60 * 60;

                    cookie.impersonator_auth.set({
                        value: sourceToken,
                        httpOnly: true,
                        secure,
                        sameSite: 'lax',
                        maxAge: sevenDays,
                        path: '/',
                    });

                    cookie.impersonation_session.set({
                        value: sessionId,
                        httpOnly: true,
                        secure,
                        sameSite: 'lax',
                        maxAge: sevenDays,
                        path: '/',
                    });

                    cookie.auth.set({
                        value: impersonatedToken,
                        httpOnly: true,
                        secure,
                        sameSite: 'lax',
                        maxAge: sevenDays,
                        path: '/',
                    });

                    return {
                        success: true,
                        message: 'Impersonation started',
                        impersonation: {
                            session_id: sessionId,
                            user_id: targetUser.id,
                            email: targetUser.email,
                        },
                        redirect_to: '/workarea',
                    };
                },
                { body: startImpersonationSchema },
            )

            // GET /api/admin/users - List all users (paginated)
            .get('/api/admin/users', async ({ query }) => {
                const limit = Math.min(parseInt((query.limit as string) || '50', 10), 100);
                const offset = parseInt((query.offset as string) || '0', 10);
                const search = query.search as string | undefined;
                const sortBy = (query.sortBy as 'id' | 'email' | 'created_at') || 'id';
                const sortOrder = (query.sortOrder as 'asc' | 'desc') || 'asc';

                const { users, total } = await queries.findUsersPaginated(db, {
                    limit,
                    offset,
                    search,
                    sortBy,
                    sortOrder,
                });

                // Calculate storage usage for each user
                const usersWithStorage = await Promise.all(
                    users.map(async user => {
                        const storageBytes = await queries.getUserStorageUsage(db, user.id);
                        const storageMB = Math.round(storageBytes / (1024 * 1024));
                        return {
                            ...sanitizeUser(user),
                            storage_used_mb: storageMB,
                        };
                    }),
                );

                return {
                    users: usersWithStorage,
                    total,
                    limit,
                    offset,
                };
            })

            // GET /api/admin/users/:id - Get user by ID
            .get('/api/admin/users/:id', async ({ params, set }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;

                const user = await queries.findUserById(db, parsed.id);
                if (!user) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'User not found' };
                }

                return { user: sanitizeUser(user) };
            })

            // POST /api/admin/users - Create new user
            .post(
                '/api/admin/users',
                async ({ body, set }) => {
                    // Check if email already exists
                    const existing = await queries.findUserByEmail(db, body.email);
                    if (existing) {
                        set.status = 409;
                        return { error: 'CONFLICT', message: 'Email already registered' };
                    }

                    // Hash password
                    const hashedPassword = await bcrypt.hash(body.password, 10);

                    // Default roles if not provided
                    const roles = body.roles || [ROLES.USER];

                    // user_id: not set for admin-created users (null) - they're not SSO
                    const user = await queries.createUserAsAdmin(db, {
                        email: body.email,
                        password: hashedPassword,
                        roles,
                        quotaMb: body.quota_mb,
                    });

                    set.status = 201;
                    return { user: sanitizeUser(user) };
                },
                { body: createUserSchema },
            )

            // PATCH /api/admin/users/:id/roles - Update user roles
            .patch(
                '/api/admin/users/:id/roles',
                async ({ params, body, set, jwtPayload }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;
                    const userId = parsed.id;

                    // Get target user
                    const targetUser = await queries.findUserById(db, userId);
                    if (!targetUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    let newRoles = body.roles;

                    // Ensure ROLE_USER is always present
                    if (!newRoles.includes(PROTECTED_ROLE)) {
                        newRoles = [PROTECTED_ROLE, ...newRoles];
                    }

                    // Check for self-degradation (removing own admin role)
                    const currentUserId = jwtPayload!.sub;
                    const isRemovingOwnAdminRole =
                        currentUserId === userId &&
                        hasRole(jwtPayload!.roles, ROLES.ADMIN) &&
                        !newRoles.includes(ROLES.ADMIN);

                    if (isRemovingOwnAdminRole) {
                        // Check if this is the last admin
                        const adminCount = await queries.countAdmins(db);
                        if (adminCount <= 1) {
                            set.status = 400;
                            return {
                                error: 'CANNOT_REMOVE_LAST_ADMIN',
                                message: 'Cannot remove admin role from the last administrator',
                            };
                        }
                    }

                    const updatedUser = await queries.updateUserRoles(db, userId, newRoles);
                    if (!updatedUser) {
                        set.status = 500;
                        return { error: 'UPDATE_FAILED', message: 'Failed to update roles' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateRolesSchema },
            )

            // PATCH /api/admin/users/:id/status - Activate/deactivate user
            .patch(
                '/api/admin/users/:id/status',
                async ({ params, body, set, jwtPayload }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;
                    const userId = parsed.id;

                    // Prevent deactivating yourself
                    if (jwtPayload!.sub === userId && !body.is_active) {
                        set.status = 400;
                        return { error: 'CANNOT_DEACTIVATE_SELF', message: 'Cannot deactivate your own account' };
                    }

                    const updatedUser = await queries.updateUserStatus(db, userId, body.is_active);
                    if (!updatedUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateStatusSchema },
            )

            // PATCH /api/admin/users/:id/quota - Update user quota
            .patch(
                '/api/admin/users/:id/quota',
                async ({ params, body, set }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;

                    const updatedUser = await queries.updateUserQuota(db, parsed.id, body.quota_mb);
                    if (!updatedUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateQuotaSchema },
            )

            // =====================================================
            // PROJECT MANAGEMENT
            // =====================================================

            // GET /api/admin/projects - List projects with filters
            .get('/api/admin/projects', async ({ query }) => {
                const limit = Math.min(parseInt((query.limit as string) || '50', 10), 100);
                const offset = parseInt((query.offset as string) || '0', 10);
                const owner = (query.owner as string | undefined)?.trim();
                const title = (query.title as string | undefined)?.trim();
                const status = (query.status as string | undefined)?.trim();
                const visibility = (query.visibility as string | undefined)?.trim();
                const sortByRaw = (query.sortBy as string | undefined)?.trim();
                const sortOrderRaw = (query.sortOrder as string | undefined)?.trim();
                const allowedSortBy = new Set(['id', 'title', 'created_at']);
                const allowedSortOrder = new Set(['asc', 'desc']);
                const sortBy = (sortByRaw && allowedSortBy.has(sortByRaw) ? sortByRaw : 'id') as
                    | 'id'
                    | 'title'
                    | 'created_at';
                const sortOrder = (sortOrderRaw && allowedSortOrder.has(sortOrderRaw) ? sortOrderRaw : 'desc') as
                    | 'asc'
                    | 'desc';

                const allowedStatuses = new Set(['active', 'inactive', 'archived']);
                const allowedVisibility = new Set(['public', 'private']);

                const parsedStatus = status && allowedStatuses.has(status) ? status : undefined;
                const parsedVisibility = visibility && allowedVisibility.has(visibility) ? visibility : undefined;

                const { projects, total } = await queries.findProjectsPaginated(db, {
                    limit,
                    offset,
                    owner,
                    title,
                    status: parsedStatus,
                    visibility: parsedVisibility,
                    sortBy,
                    sortOrder,
                });

                return { projects, total };
            })

            // PATCH /api/admin/projects/:id/status - Update project status
            .patch(
                '/api/admin/projects/:id/status',
                async ({ params, body, set }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;

                    const updated = await queries.updateProject(db, parsed.id, {
                        status: body.status,
                    });

                    if (!updated) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'Project not found' };
                    }

                    return { project: updated };
                },
                { body: updateProjectStatusSchema },
            )

            // DELETE /api/admin/projects/:id - Hard delete project
            .delete('/api/admin/projects/:id', async ({ params, set }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;

                const project = await queries.findProjectById(db, parsed.id);
                if (!project) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Project not found' };
                }

                await queries.hardDeleteProject(db, parsed.id);
                return { success: true };
            })

            // GET /api/admin/projects/:id/download - Download project as .elpx (public projects only)
            .get('/api/admin/projects/:id/download', async ({ params, set }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;

                const project = await queries.findProjectById(db, parsed.id);
                if (!project) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Project not found' };
                }

                if (project.visibility !== 'public') {
                    set.status = 403;
                    return { error: 'FORBIDDEN', message: 'Only public projects can be downloaded' };
                }

                const yjsDoc = await reconstructDocument(project.id);
                const publicDir = pathModule.resolve(__dirname, '../../public');
                const assetsDir = fileHelper!.getProjectAssetsDir(project.uuid);

                const wrapper = new ServerYjsDocumentWrapper(yjsDoc, project.uuid);
                const document = new YjsDocumentAdapter(wrapper);
                const resources = new FileSystemResourceProvider(publicDir);
                const zip = new FflateZipProvider();
                const fsAssets = new FileSystemAssetProvider(assetsDir);
                const dbAssets = new DatabaseAssetProvider(db, project.id, assetsDir);
                const assets = new CombinedAssetProvider([dbAssets, fsAssets]);

                const exporter = new ElpxExporter(document, resources, assets, zip);
                const result = await exporter.export();

                wrapper.destroy();

                if (!result.success || !result.data) {
                    set.status = 500;
                    return { error: 'EXPORT_FAILED', message: result.error || 'Export failed' };
                }

                const slug = (project.title || 'untitled')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 50);
                const safeFilename = `project-${project.id}-${slug}.elpx`;

                set.headers['content-type'] = 'application/zip';
                set.headers['content-disposition'] = `attachment; filename="${safeFilename}"`;
                set.headers['content-length'] = result.data.length.toString();
                return result.data;
            })

            // DELETE /api/admin/users/:id - Delete user
            .delete('/api/admin/users/:id', async ({ params, set, jwtPayload }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;
                const userId = parsed.id;

                // Prevent deleting yourself
                if (jwtPayload!.sub === userId) {
                    set.status = 400;
                    return { error: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' };
                }

                // Check if user exists
                const user = await queries.findUserById(db, userId);
                if (!user) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'User not found' };
                }

                // Check if deleting last admin
                const userRoles = parseRoles(user.roles);
                if (hasRole(userRoles, ROLES.ADMIN)) {
                    const adminCount = await queries.countAdmins(db);
                    if (adminCount <= 1) {
                        set.status = 400;
                        return {
                            error: 'CANNOT_DELETE_LAST_ADMIN',
                            message: 'Cannot delete the last administrator',
                        };
                    }
                }

                // Get all projects owned by user before deletion
                // (needed to clean up asset directories - DB cascade will delete records)
                const userProjects = await queries.findProjectsByOwnerId(db, userId);
                const deletedProjectsCount = userProjects.length;

                // Clean up asset directories for each project
                // Continue even if some cleanups fail - the DB cascade will still remove records
                for (const project of userProjects) {
                    try {
                        const assetsDir = fileHelper.getProjectAssetsDir(project.uuid);
                        const exists = await fileHelper.fileExists(assetsDir);
                        if (exists) {
                            await fileHelper.remove(assetsDir);
                        }
                    } catch (err) {
                        console.error(`Failed to clean up assets for project ${project.uuid}:`, err);
                        // Continue with deletion - DB cascade will handle records
                    }
                }

                // Delete user - DB cascade will delete projects and related records
                await queries.deleteUser(db, userId);

                return {
                    success: true,
                    message: 'User deleted',
                    deletedProjectsCount,
                };
            })

            // ================================================================
            // Customization: Favicon
            // ================================================================

            // POST /api/admin/customization/favicon — upload custom favicon
            .post(
                '/api/admin/customization/favicon',
                async ({ body, set, jwtPayload }) => {
                    const FAVICON_ALLOWED_TYPES = [
                        'image/x-icon',
                        'image/png',
                        'image/svg+xml',
                        'image/gif',
                        'image/jpeg',
                        'image/webp',
                    ];
                    const file = (body as { file: File }).file;
                    if (!file || !FAVICON_ALLOWED_TYPES.includes(file.type)) {
                        set.status = 400;
                        return {
                            error: 'Bad Request',
                            message: 'Invalid file. Allowed: .ico, .png, .svg, .gif, .jpg, .webp',
                        };
                    }
                    const originalName = pathModule.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
                    if (!originalName) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid filename' };
                    }
                    const faviconDir = pathModule.join(fileHelper.getFilesDir(), 'customization', 'favicon');
                    // Remove previous favicon files
                    for (const f of await fileHelper.listFiles(faviconDir).catch(() => [])) {
                        await fileHelper.remove(pathModule.join(faviconDir, f)).catch(() => {});
                    }
                    await fileHelper.writeFile(
                        pathModule.join(faviconDir, originalName),
                        Buffer.from(await file.arrayBuffer()),
                    );
                    await queries.setSetting(
                        db as unknown as AppSettingsDb,
                        'APP_FAVICON_PATH',
                        originalName,
                        'string',
                        jwtPayload?.sub ? Number(jwtPayload.sub) : undefined,
                    );
                    return { success: true, filename: originalName };
                },
                { body: t.Object({ file: t.File() }) },
            )

            // DELETE /api/admin/customization/favicon — remove custom favicon
            .delete('/api/admin/customization/favicon', async ({ jwtPayload }) => {
                const faviconDir = pathModule.join(fileHelper.getFilesDir(), 'customization', 'favicon');
                for (const f of await fileHelper.listFiles(faviconDir).catch(() => [])) {
                    await fileHelper.remove(pathModule.join(faviconDir, f)).catch(() => {});
                }
                await queries.setSetting(
                    db as unknown as AppSettingsDb,
                    'APP_FAVICON_PATH',
                    '',
                    'string',
                    jwtPayload?.sub ? Number(jwtPayload.sub) : undefined,
                );
                return { success: true };
            })

            // ================================================================
            // Customization: Assets
            // ================================================================

            // GET /api/admin/customization/assets — list custom asset files
            .get('/api/admin/customization/assets', async () => {
                const assetsDir = pathModule.join(fileHelper.getFilesDir(), 'customization', 'assets');
                const files = await fileHelper.listFiles(assetsDir).catch(() => []);
                const basePath = getBasePath();
                const assets = await Promise.all(
                    files.map(async filename => {
                        const stats = await fileHelper.getStats(pathModule.join(assetsDir, filename));
                        return {
                            filename,
                            size: stats?.size ?? 0,
                            url: `${basePath}/customization/assets/${encodeURIComponent(filename)}`,
                        };
                    }),
                );
                return { assets };
            })

            // POST /api/admin/customization/assets — upload a custom asset file
            .post(
                '/api/admin/customization/assets',
                async ({ body, set }) => {
                    const file = (body as { file: File }).file;
                    if (!file) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'No file uploaded' };
                    }
                    if (!ALLOWED_ASSET_MIME_TYPES.has(file.type)) {
                        set.status = 400;
                        return {
                            error: 'Bad Request',
                            message: `File type '${file.type}' is not allowed`,
                        };
                    }
                    const originalName = pathModule.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
                    if (!originalName) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid filename' };
                    }
                    const assetsDir = pathModule.join(fileHelper.getFilesDir(), 'customization', 'assets');
                    if (!fileHelper.isPathSafe(assetsDir, originalName)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid filename' };
                    }
                    await fileHelper.writeFile(
                        pathModule.join(assetsDir, originalName),
                        Buffer.from(await file.arrayBuffer()),
                    );
                    const basePath = getBasePath();
                    return {
                        success: true,
                        filename: originalName,
                        url: `${basePath}/customization/assets/${encodeURIComponent(originalName)}`,
                    };
                },
                { body: t.Object({ file: t.File() }) },
            )

            // DELETE /api/admin/customization/assets/:filename — remove a custom asset
            .delete('/api/admin/customization/assets/:filename', async ({ params, set }) => {
                const assetsDir = pathModule.join(fileHelper.getFilesDir(), 'customization', 'assets');
                if (!fileHelper.isPathSafe(assetsDir, params.filename)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid filename' };
                }
                const targetPath = pathModule.join(assetsDir, params.filename);
                if (!(await fileHelper.fileExists(targetPath))) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'File not found' };
                }
                await fileHelper.remove(targetPath);
                return { success: true };
            })
    );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Admin routes with default (real) dependencies
 */
export const adminRoutes = createAdminRoutes();
