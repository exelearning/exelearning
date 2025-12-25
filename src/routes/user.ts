/**
 * User Routes for Elysia
 * Handles user preferences and settings
 */
import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { db } from '../db/client';
import {
    findAllPreferencesForUser,
    findPreference,
    setPreference,
    findUserById,
    getUserStorageUsage,
} from '../db/queries';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import type { JwtPayload, UserPreferencesRequest } from './types/request-payloads';

/**
 * Preference value wrapper type expected by frontend
 */
interface PreferenceValue {
    value: string | number | boolean;
}

// Get JWT secret (same as auth.ts)
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

/**
 * Default user preferences with structure expected by frontend
 * Each preference has a `value` property that the frontend accesses
 */
const DEFAULT_PREFERENCES = {
    locale: { value: 'es' },
    theme: { value: 'base' },
    advancedMode: { value: 'true' },
    versionControl: { value: 'true' },
    defaultLicense: { value: 'creative commons: attribution - share alike 4.0' },
};

/**
 * Query dependencies for user routes
 */
export interface UserQueries {
    findAllPreferencesForUser: typeof findAllPreferencesForUser;
    findPreference: typeof findPreference;
    setPreference: typeof setPreference;
    findUserById: typeof findUserById;
    getUserStorageUsage: typeof getUserStorageUsage;
}

/**
 * Dependencies for user routes
 */
export interface UserDependencies {
    db: Kysely<Database>;
    queries: UserQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: UserDependencies = {
    db,
    queries: {
        findAllPreferencesForUser,
        findPreference,
        setPreference,
        findUserById,
        getUserStorageUsage,
    },
};

/**
 * Factory function to create user routes with injected dependencies
 */
export function createUserRoutes(deps: UserDependencies = defaultDependencies) {
    const { db: database, queries } = deps;

    /**
     * Get user preferences from database
     * Returns format: { key: { value: x } }
     */
    async function getUserPreferences(userId: string): Promise<Record<string, PreferenceValue>> {
        // Start with deep copy of defaults
        const result: Record<string, PreferenceValue> = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));

        try {
            const prefs = await queries.findAllPreferencesForUser(database, userId);

            for (const pref of prefs) {
                try {
                    // If value is JSON, parse it
                    const parsedValue = JSON.parse(pref.value);
                    // If already has value property, use it, otherwise wrap it
                    if (typeof parsedValue === 'object' && parsedValue !== null && 'value' in parsedValue) {
                        result[pref.preference_key] = parsedValue;
                    } else {
                        result[pref.preference_key] = { value: parsedValue };
                    }
                } catch {
                    // If not JSON, use raw value wrapped
                    result[pref.preference_key] = { value: pref.value };
                }
            }

            return result;
        } catch {
            // Return defaults if table doesn't exist or query fails
            return result;
        }
    }

    /**
     * Save user preference to database
     */
    async function saveUserPreference(userId: string, key: string, value: unknown): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        try {
            await queries.setPreference(database, userId, key, stringValue);
        } catch (error) {
            console.error('[User] Failed to save preference:', error);
        }
    }

    return (
        new Elysia({ name: 'user-routes' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive user from JWT token
            .derive(async ({ jwt, cookie }) => {
                const token = cookie.auth?.value;
                if (!token) return { currentUser: null };

                try {
                    const payload = (await jwt.verify(token)) as JwtPayload | false;
                    if (!payload) return { currentUser: null };

                    return {
                        currentUser: {
                            id: payload.sub,
                            email: payload.email,
                            isGuest: payload.isGuest || false,
                        },
                    };
                } catch {
                    return { currentUser: null };
                }
            })

            // GET /api/user/preferences - Get user preferences
            .get('/api/user/preferences', async ({ currentUser }) => {
                // Require authentication - guests get empty preferences
                if (!currentUser) {
                    return { userPreferences: {} };
                }

                const userId = String(currentUser.id);
                const preferences = await getUserPreferences(userId);
                // Frontend expects: { userPreferences: { key: { value: x } } }
                return { userPreferences: preferences };
            })

            // GET /api/user/storage - Get user storage usage and quota
            .get('/api/user/storage', async ({ currentUser, set }) => {
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const userIdNum = parseInt(String(currentUser.id), 10);
                if (Number.isNaN(userIdNum)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid user ID' };
                }

                const user = await queries.findUserById(database, userIdNum);
                if (!user) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'User not found' };
                }

                const usedBytes = await queries.getUserStorageUsage(database, userIdNum);
                const usedMB = Math.round(usedBytes / (1024 * 1024));

                return {
                    success: true,
                    data: {
                        quota_mb: user.quota_mb,
                        used_bytes: usedBytes,
                        used_mb: usedMB,
                    },
                };
            })

            // POST /api/user/preferences - Save user preferences
            .post('/api/user/preferences', async ({ body, set, currentUser }) => {
                // Require authentication to save preferences
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required to save preferences' };
                }

                const userId = String(currentUser.id);

                try {
                    const preferences = body as UserPreferencesRequest;

                    for (const [key, value] of Object.entries(preferences)) {
                        await saveUserPreference(userId, key, value);
                    }

                    return { responseMessage: 'OK' };
                } catch (error) {
                    console.error('[User] Failed to save preferences:', error);
                    set.status = 500;
                    return { error: 'Internal Error', message: 'Failed to save preferences' };
                }
            })

            // PUT /api/user/preferences - Save user preferences (Symfony compatibility)
            .put('/api/user/preferences', async ({ body, set, currentUser }) => {
                // Require authentication to save preferences
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required to save preferences' };
                }

                const userId = String(currentUser.id);

                try {
                    const preferences = body as UserPreferencesRequest;

                    for (const [key, value] of Object.entries(preferences)) {
                        await saveUserPreference(userId, key, value);
                    }

                    return { responseMessage: 'OK' };
                } catch (error) {
                    console.error('[User] Failed to save preferences:', error);
                    set.status = 500;
                    return { error: 'Internal Error', message: 'Failed to save preferences' };
                }
            })

            // POST /api/user/lopd-accepted - Accept LOPD terms
            .post('/api/user/lopd-accepted', async ({ set, currentUser }) => {
                // Require authentication to accept LOPD
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const userId = String(currentUser.id);

                try {
                    await saveUserPreference(userId, 'lopdAccepted', true);
                    await saveUserPreference(userId, 'lopdAcceptedAt', new Date().toISOString());
                    return { success: true, message: 'LOPD accepted' };
                } catch (error) {
                    console.error('[User] Failed to save LOPD acceptance:', error);
                    set.status = 500;
                    return { error: 'Internal Error', message: 'Failed to save LOPD acceptance' };
                }
            })
    );
}

/**
 * User routes with default (real) dependencies
 */
export const userRoutes = createUserRoutes();
