/**
 * User Routes for Elysia
 * Handles user preferences and settings
 */
import { Elysia, t } from 'elysia';
import { getJwtSecret } from './auth';
import { jwt } from '@elysiajs/jwt';
import { db } from '../db/client';
import {
    findAllPreferencesForUser,
    findPreference,
    setPreference,
    findUserById,
    getUserStorageUsage,
    updateUserPassword,
} from '../db/queries';
import { getAuthMethods } from '../services/app-settings';
import {
    canChangePassword,
    hashPassword,
    verifyPassword,
    validateNewPassword,
    PASSWORD_CHANGE_UNAVAILABLE_MESSAGE,
} from '../services/password';
import { isOfflineMode } from '../utils/offline.util';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import type { JwtPayload, UserPreferencesRequest } from './types/request-payloads';

/**
 * Preference value wrapper type expected by frontend
 */
interface PreferenceValue {
    value: string | number | boolean;
}

/**
 * Default user preferences with structure expected by frontend
 * Each preference has a `value` property that the frontend accesses
 */
const DEFAULT_PREFERENCES = {
    locale: { value: process.env.APP_LOCALE || 'en' },
    theme: { value: 'base' },
    advancedMode: { value: 'true' },
    versionControl: { value: 'true' },
    defaultLicense: { value: 'creative commons: attribution - share alike 4.0' },
    defaultAI: { value: 'https://chatgpt.com/?q=' },
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
    updateUserPassword: typeof updateUserPassword;
}

/**
 * Settings dependencies for user routes
 */
export interface UserSettings {
    getAuthMethods: typeof getAuthMethods;
}

/**
 * Dependencies for user routes
 */
export interface UserDependencies {
    db: Kysely<Database>;
    queries: UserQueries;
    settings?: UserSettings;
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
        updateUserPassword,
    },
    settings: {
        getAuthMethods,
    },
};

/**
 * Factory function to create user routes with injected dependencies
 */
export function createUserRoutes(deps: UserDependencies = defaultDependencies) {
    const { db: database, queries } = deps;
    const settings = deps.settings ?? { getAuthMethods };

    /**
     * Whether this installation authenticates users at all. Offline/desktop
     * installations (and `APP_AUTH_METHODS=none`) log the default user in
     * automatically, so there is no password to change.
     */
    async function isPasswordAuthMeaningless(): Promise<boolean> {
        if (isOfflineMode()) return true;
        const authMethods = await settings.getAuthMethods(database, process.env.APP_AUTH_METHODS || 'password,guest');
        return authMethods.includes('none');
    }

    /**
     * Get user preferences from database
     * Returns format: { key: { value: x } }
     */
    async function getUserPreferences(ownerId: number): Promise<Record<string, PreferenceValue>> {
        // Start with deep copy of defaults
        const result: Record<string, PreferenceValue> = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));

        try {
            const prefs = await queries.findAllPreferencesForUser(database, ownerId);

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
    async function saveUserPreference(ownerId: number, key: string, value: unknown): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        try {
            await queries.setPreference(database, ownerId, key, stringValue);
        } catch (error) {
            console.error('[User] Failed to save preference:', error);
        }
    }

    /**
     * Shared handler for POST/PUT /api/user/preferences
     * Both endpoints have identical behavior for Symfony compatibility.
     */
    async function handleSavePreferences(
        body: unknown,
        set: { status: number },
        currentUser: { id: number; email: string; isGuest: boolean } | null,
        saveFn: (ownerId: number, key: string, value: unknown) => Promise<void>,
    ): Promise<{ responseMessage: string } | { error: string; message: string }> {
        if (!currentUser) {
            set.status = 401;
            return { error: 'Unauthorized', message: 'Authentication required to save preferences' };
        }

        const ownerId = currentUser.id;

        try {
            const preferences = body as UserPreferencesRequest;

            for (const [key, value] of Object.entries(preferences)) {
                await saveFn(ownerId, key, value);
            }

            return { responseMessage: 'OK' };
        } catch (error) {
            console.error('[User] Failed to save preferences:', error);
            set.status = 500;
            return { error: 'Internal Error', message: 'Failed to save preferences' };
        }
    }

    return (
        new Elysia({ name: 'user-routes' })
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
                            authMethod: payload.authMethod,
                            // An impersonated token inherits the administrator's
                            // authMethod, so this flag must travel with it.
                            isImpersonated: payload.isImpersonated || false,
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

                const ownerId = currentUser.id;
                const preferences = await getUserPreferences(ownerId);
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
                return handleSavePreferences(body, set, currentUser, saveUserPreference);
            })

            // PUT /api/user/preferences - Save user preferences (Symfony compatibility)
            .put('/api/user/preferences', async ({ body, set, currentUser }) => {
                return handleSavePreferences(body, set, currentUser, saveUserPreference);
            })

            // POST /api/user/lopd-accepted - Accept LOPD terms
            .post('/api/user/lopd-accepted', async ({ set, currentUser }) => {
                // Require authentication to accept LOPD
                if (!currentUser) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const ownerId = currentUser.id;

                try {
                    await saveUserPreference(ownerId, 'lopdAccepted', true);
                    await saveUserPreference(ownerId, 'lopdAcceptedAt', new Date().toISOString());
                    return { success: true, message: 'LOPD accepted' };
                } catch (error) {
                    console.error('[User] Failed to save LOPD acceptance:', error);
                    set.status = 500;
                    return { error: 'Internal Error', message: 'Failed to save LOPD acceptance' };
                }
            })

            // PATCH /api/user/password - Change your own password
            //
            // Self-service only: the authenticated session decides whose password
            // may change, so no user id is accepted. Every eligibility rule is
            // re-checked here — the hidden menu item is not an authorization
            // boundary.
            .patch(
                '/api/user/password',
                async ({ body, set, currentUser }) => {
                    if (!currentUser) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Authentication required' };
                    }

                    if (await isPasswordAuthMeaningless()) {
                        set.status = 403;
                        return { error: 'Forbidden', message: PASSWORD_CHANGE_UNAVAILABLE_MESSAGE };
                    }

                    const userId = parseInt(String(currentUser.id), 10);
                    if (Number.isNaN(userId)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid user ID' };
                    }

                    const user = await queries.findUserById(database, userId);
                    if (!user) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Authentication required' };
                    }

                    // Session AND persisted account must both qualify: an
                    // externally authenticated account must never gain a local
                    // password this way.
                    const allowed = canChangePassword({
                        authMethod: currentUser.authMethod,
                        isGuest: currentUser.isGuest,
                        isImpersonated: currentUser.isImpersonated,
                        offlineMode: false,
                        user,
                    });

                    if (!allowed) {
                        set.status = 403;
                        return { error: 'Forbidden', message: PASSWORD_CHANGE_UNAVAILABLE_MESSAGE };
                    }

                    const currentPasswordMatches = await verifyPassword(body.currentPassword, user.password);
                    if (!currentPasswordMatches) {
                        set.status = 401;
                        return { error: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' };
                    }

                    const validation = validateNewPassword(body.newPassword);
                    if (!validation.valid) {
                        set.status = 422;
                        return { error: 'INVALID_PASSWORD', message: validation.message! };
                    }

                    try {
                        const hashedPassword = await hashPassword(body.newPassword);
                        const updated = await queries.updateUserPassword(database, userId, hashedPassword);

                        if (!updated) {
                            set.status = 500;
                            return { error: 'Internal Error', message: 'Failed to change the password' };
                        }

                        return { success: true, message: 'Password changed successfully' };
                    } catch (error) {
                        // Log the failure, never the credentials.
                        console.error('[User] Failed to change password:', error);
                        set.status = 500;
                        return { error: 'Internal Error', message: 'Failed to change the password' };
                    }
                },
                {
                    body: t.Object({
                        currentPassword: t.String({ minLength: 1 }),
                        newPassword: t.String({ minLength: 1 }),
                    }),
                },
            )
    );
}

/**
 * User routes with default (real) dependencies
 */
export const userRoutes = createUserRoutes();
