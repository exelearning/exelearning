/**
 * iDevice Installer Routes
 *
 * Local-mode-only endpoints for installing and uninstalling iDevice ZIP
 * packages into `public/files/perm/idevices/users/`.
 */
import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import {
    createIdeviceInstallerService,
    type IdeviceInstallerService,
    type InstallOutcome,
} from '../services/idevice-installer';
import { db as defaultDb } from '../db/client';
import { canInstallIdevices } from '../utils/local-mode.util';
import { getAppVersion } from '../utils/version';
import type { JwtPayload } from './auth';

interface CurrentUser {
    id: number;
}

interface JwtVerifier {
    verify: (token: string) => Promise<JwtPayload | false>;
}

interface CookieStore {
    auth?: { value?: string };
}

type CurrentUserResolver = () => CurrentUser | null | Promise<CurrentUser | null>;

export interface IdeviceInstallerRouteDeps {
    installer?: IdeviceInstallerService;
    canInstall?: () => boolean | Promise<boolean>;
    appVersion?: () => string;
    currentUser?: CurrentUser | null | CurrentUserResolver;
}

const httpStatusForCode: Record<string, number> = {
    INVALID_ZIP: 400,
    ZIP_TOO_LARGE: 413,
    UNCOMPRESSED_SIZE_TOO_LARGE: 413,
    TOO_MANY_FILES: 400,
    ZIP_SLIP_DETECTED: 400,
    UNSUPPORTED_EXTENSION: 400,
    CONFIG_XML_NOT_FOUND: 400,
    INVALID_CONFIG_XML: 400,
    INVALID_NAME: 400,
    MISSING_REQUIRED_FIELD: 400,
    MISSING_EDITION_FOLDER: 400,
    MISSING_EXPORT_FOLDER: 400,
    MISSING_EDITION_JS: 400,
    MISSING_EXPORT_JS: 400,
    INVALID_COMPONENT_TYPE: 400,
    INVALID_ICON: 400,
    MISSING_ICON_FILE: 400,
    EXPORT_OBJECT_NOT_FOUND: 400,
    EXPORT_OBJECT_CONFLICT: 409,
    IDEVICE_OVERLAPS_BUILTIN: 409,
    IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM: 409,
    COPY_ERROR: 500,
    ROLLBACK_ERROR: 500,
    UNKNOWN_ERROR: 500,
};

const isTrue = (value: unknown): boolean => value === true || value === 'true' || value === '1';

const getJwtSecret = (): string => {
    return process.env.API_JWT_SECRET || process.env.JWT_SECRET || process.env.APP_SECRET || 'dev_secret_change_me';
};

const bufferFromUpload = async (file: unknown): Promise<Buffer | null> => {
    if (!file) return null;
    if (file instanceof Blob) return Buffer.from(await file.arrayBuffer());
    if (Buffer.isBuffer(file)) return file;
    if (file instanceof Uint8Array) return Buffer.from(file);
    return null;
};

export function createIdeviceInstallerRoutes(deps: IdeviceInstallerRouteDeps = {}) {
    const installer = deps.installer ?? createIdeviceInstallerService();
    const canInstall = deps.canInstall ?? (() => canInstallIdevices(defaultDb));
    const appVersion = deps.appVersion ?? getAppVersion;

    const resolveCurrentUser = async (
        jwtVerifier: JwtVerifier,
        cookieStore: CookieStore,
    ): Promise<CurrentUser | null> => {
        if (typeof deps.currentUser === 'function') return deps.currentUser();
        if (deps.currentUser !== undefined) return deps.currentUser;

        const token = cookieStore.auth?.value;
        if (!token) return null;
        const payload = (await jwtVerifier.verify(token)) as JwtPayload | false;
        if (!payload || !payload.sub) return null;
        return { id: payload.sub };
    };

    const guard = async (set: {
        status?: number;
    }): Promise<{ code: 'LOCAL_MODE_REQUIRED'; message: string } | null> => {
        if (await canInstall()) return null;
        set.status = 403;
        return {
            code: 'LOCAL_MODE_REQUIRED',
            message: 'iDevice installation is only available in local mode.',
        };
    };

    return (
        new Elysia({ name: 'idevice-installer-routes' })
            .use(cookie())
            .use(jwt({ name: 'jwt', secret: getJwtSecret(), exp: '7d' }))
            // POST /api/idevices/install — accepts multipart/form-data with `file` (zip).
            .post('/api/idevices/install', async ({ body, set, jwt, cookie }) => {
                const blocked = await guard(set);
                if (blocked) return { success: false, ...blocked };

                const currentUser = await resolveCurrentUser(jwt, cookie);
                if (!currentUser) {
                    set.status = 401;
                    return { success: false, code: 'AUTH_REQUIRED', message: 'Authentication required.' };
                }

                const data = (body ?? {}) as Record<string, unknown>;
                const buffer = await bufferFromUpload(data.file);
                if (!buffer) {
                    set.status = 400;
                    return { success: false, code: 'INVALID_ZIP', message: 'No file provided.' };
                }

                const confirmOverwrite = isTrue(data.confirmOverwrite);
                const outcome: InstallOutcome = await installer.installFromBuffer(buffer, {
                    confirmOverwrite,
                    userId: currentUser.id,
                });

                if (!outcome.success) {
                    set.status = httpStatusForCode[outcome.code] ?? 400;
                    return outcome;
                }

                // Replace the on-disk install dir with the public HTTP path so
                // the frontend can fetch edition/ and export/ assets directly,
                // matching the shape of GET /api/idevices/installed.
                const publicUrl = `/${appVersion()}/files/perm/idevices/users/${currentUser.id}/${outcome.id}`;
                set.status = 200;
                return {
                    ...outcome,
                    config: { ...outcome.config, url: publicUrl, name: outcome.id },
                };
            })

            // DELETE /api/idevices/installed/:ideviceId — uninstall a user iDevice.
            .delete('/api/idevices/installed/:ideviceId', async ({ params, set, jwt, cookie }) => {
                const blocked = await guard(set);
                if (blocked) return { success: false, ...blocked };

                const currentUser = await resolveCurrentUser(jwt, cookie);
                if (!currentUser) {
                    set.status = 401;
                    return { success: false, code: 'AUTH_REQUIRED', message: 'Authentication required.' };
                }

                const result = await installer.uninstall(params.ideviceId, { userId: currentUser.id });
                if (!result.success) {
                    set.status =
                        result.code === 'NOT_FOUND' ? 404 : result.code === 'IDEVICE_OVERLAPS_BUILTIN' ? 409 : 500;
                    return result;
                }
                set.status = 200;
                return result;
            })
    );
}

// Default instance for production registration in src/index.ts.
export const ideviceInstallerRoutes = createIdeviceInstallerRoutes();
