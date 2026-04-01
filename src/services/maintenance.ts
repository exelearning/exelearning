/**
 * Maintenance Mode Service
 *
 * Provides in-memory cached maintenance mode checks, path whitelisting,
 * and admin detection via JWT cookie verification.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getSettingBoolean } from './app-settings';
import { verifyToken } from '../routes/auth';
import { hasRole, ROLES } from '../utils/guards';

// ============================================================================
// TYPES & DEPENDENCIES (for DI / testability)
// ============================================================================

export interface MaintenanceDependencies {
    getSettingBoolean: typeof getSettingBoolean;
    verifyToken: typeof verifyToken;
}

const defaultDeps: MaintenanceDependencies = {
    getSettingBoolean,
    verifyToken,
};

let deps = defaultDeps;

export function configure(newDeps: Partial<MaintenanceDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// ============================================================================
// IN-MEMORY CACHE (5s TTL)
// ============================================================================

interface CacheEntry {
    value: boolean;
    expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5000;

/**
 * Check if maintenance mode is enabled.
 * Uses an in-memory cache with 5s TTL to avoid hitting the DB on every request.
 */
export async function isMaintenanceMode(db: Kysely<Database>): Promise<boolean> {
    const now = Date.now();
    if (cache && now < cache.expiresAt) {
        return cache.value;
    }

    const enabled = await deps.getSettingBoolean(db, 'MAINTENANCE_MODE', false);
    cache = { value: enabled, expiresAt: now + CACHE_TTL_MS };
    return enabled;
}

/**
 * Invalidate the maintenance mode cache.
 * Call this after the MAINTENANCE_MODE setting is changed.
 */
export function invalidateMaintenanceCache(): void {
    cache = null;
}

// ============================================================================
// PATH WHITELIST
// ============================================================================

/** Static file extensions that should always be served */
const STATIC_EXTENSIONS = new Set([
    '.css',
    '.js',
    '.mjs',
    '.map',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.avif',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.json',
    '.xml',
]);

/**
 * Check if a pathname should bypass maintenance mode.
 * Paths that must remain accessible: health checks, login flow, admin, static assets.
 */
export function shouldBypassMaintenance(pathname: string): boolean {
    // Health checks
    if (pathname === '/health' || pathname === '/healthcheck') return true;

    // Login flow (form, CAS, OpenID, guest — so users can authenticate)
    if (
        pathname === '/login' ||
        pathname.startsWith('/login/') ||
        pathname === '/login_check' ||
        pathname.startsWith('/api/auth/')
    )
        return true;
    // Logout must also be accessible
    if (pathname === '/logout') return true;

    // Admin panel and API (already protected by admin guard)
    if (pathname === '/admin' || pathname.startsWith('/api/admin/')) return true;

    // Static asset prefixes
    if (
        /^\/v\d/.test(pathname) || // versioned assets (/v1.2.3/...)
        pathname.startsWith('/libs/') ||
        pathname.startsWith('/style/') ||
        pathname.startsWith('/images/') ||
        pathname.startsWith('/icons/') ||
        pathname.startsWith('/app/') ||
        pathname === '/favicon.ico'
    ) {
        return true;
    }

    // Static file extensions (covers remaining cases)
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot !== -1) {
        const ext = pathname.slice(lastDot).toLowerCase();
        if (STATIC_EXTENSIONS.has(ext)) return true;
    }

    return false;
}

// ============================================================================
// ADMIN DETECTION
// ============================================================================

/**
 * Parse the `auth` cookie value from a raw Cookie header.
 */
function parseAuthCookie(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name === 'auth') {
            return valueParts.join('=') || null;
        }
    }
    return null;
}

/**
 * Get the default redirect target after login.
 * During maintenance, admins go to /admin; otherwise /workarea.
 */
export async function getPostLoginTarget(db: Kysely<Database>, roles: string[]): Promise<string> {
    if ((await isMaintenanceMode(db)) && hasRole(roles, ROLES.ADMIN)) {
        return '/admin';
    }
    return '/workarea';
}

/**
 * Check if a request is from an admin user by verifying the JWT in the auth cookie.
 */
export async function isAdminRequest(request: Request): Promise<boolean> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return false;

    const token = parseAuthCookie(cookieHeader);
    if (!token) return false;

    const payload = await deps.verifyToken(token);
    if (!payload) return false;

    return hasRole(payload.roles, ROLES.ADMIN);
}
