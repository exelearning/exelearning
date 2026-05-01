/**
 * Admin iDevices Routes for Elysia
 * Lists installed system iDevices and lets administrators enable or disable them.
 */
import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { db as defaultDb } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import type { JwtPayload } from './auth';
import {
    IDEVICES_BASE_PATH,
    IDEVICES_SITE_PATH,
    type IdeviceConfig,
    scanIdevices as scanIdevicesDefault,
} from './idevices';
import { requireAdmin } from '../utils/guards';
import { getAppVersion } from '../utils/version';
import {
    getDisabledIdeviceIds as getDisabledIdeviceIdsDefault,
    setDisabledIdeviceIds as setDisabledIdeviceIdsDefault,
} from '../services/idevice-admin-settings';
import { createIdeviceInstallerService, type IdeviceInstallerService } from '../services/idevice-installer';
import { getJwtSecret } from '../utils/admin-route-helpers';

export interface AdminIdevicesDependencies {
    db: Kysely<Database>;
    baseIdevicesPath: string;
    siteIdevicesPath: string;
    scanIdevices: typeof scanIdevicesDefault;
    appVersion: () => string;
    getDisabledIdeviceIds: typeof getDisabledIdeviceIdsDefault;
    setDisabledIdeviceIds: typeof setDisabledIdeviceIdsDefault;
    installer: IdeviceInstallerService;
}

export interface SerializedAdminIdevice {
    id: string;
    name: string;
    title: string;
    cssClass: string;
    category: string;
    author: string;
    authorUrl: string;
    version: string;
    apiVersion: string;
    componentType: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: boolean;
    icon: IdeviceConfig['icon'];
    url: string;
    editionJs: string[];
    editionCss: string[];
    exportJs: string[];
    exportCss: string[];
    isEnabled: boolean;
    source: 'base' | 'site';
}

const defaultDependencies: AdminIdevicesDependencies = {
    db: defaultDb,
    baseIdevicesPath: IDEVICES_BASE_PATH,
    siteIdevicesPath: IDEVICES_SITE_PATH,
    scanIdevices: scanIdevicesDefault,
    appVersion: getAppVersion,
    getDisabledIdeviceIds: getDisabledIdeviceIdsDefault,
    setDisabledIdeviceIds: setDisabledIdeviceIdsDefault,
    installer: createIdeviceInstallerService({ userIdevicesPath: IDEVICES_SITE_PATH }),
};

const httpStatusForInstallerCode: Record<string, number> = {
    ZIP_TOO_LARGE: 413,
    UNCOMPRESSED_SIZE_TOO_LARGE: 413,
    EXPORT_OBJECT_CONFLICT: 409,
    IDEVICE_OVERLAPS_BUILTIN: 409,
    IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM: 409,
    COPY_ERROR: 500,
    ROLLBACK_ERROR: 500,
    UNKNOWN_ERROR: 500,
};

async function bufferFromUpload(file: unknown): Promise<Buffer | null> {
    if (!file) return null;
    if (file instanceof Blob) return Buffer.from(await file.arrayBuffer());
    if (Buffer.isBuffer(file)) return file;
    if (file instanceof Uint8Array) return Buffer.from(file);
    return null;
}

function isTrue(value: unknown): boolean {
    return value === true || value === 'true' || value === '1';
}

function serializeIdevice(
    idevice: IdeviceConfig,
    version: string,
    disabledIds: Set<string>,
    source: 'base' | 'site',
): SerializedAdminIdevice {
    const url = `/${version}/files/perm/idevices/${source}/${idevice.id}`;

    return {
        id: idevice.id,
        name: idevice.id,
        title: idevice.title,
        cssClass: idevice.cssClass,
        category: idevice.category,
        author: idevice.author,
        authorUrl: idevice.authorUrl,
        version: idevice.version,
        apiVersion: idevice.apiVersion,
        componentType: idevice.componentType,
        license: idevice.license,
        licenseUrl: idevice.licenseUrl,
        description: idevice.description,
        downloadable: idevice.downloadable,
        icon: idevice.icon,
        url,
        editionJs: idevice.editionJs,
        editionCss: idevice.editionCss,
        exportJs: idevice.exportJs,
        exportCss: idevice.exportCss,
        isEnabled: !disabledIds.has(idevice.id),
        source,
    };
}

function getAllIdevices(
    scanIdevices: typeof scanIdevicesDefault,
    baseIdevicesPath: string,
    siteIdevicesPath: string,
): Array<{ idevice: IdeviceConfig; source: 'base' | 'site' }> {
    return [
        ...scanIdevices(baseIdevicesPath).map(idevice => ({ idevice, source: 'base' as const })),
        ...scanIdevices(siteIdevicesPath).map(idevice => ({ idevice, source: 'site' as const })),
    ];
}

export function createAdminIdevicesRoutes(deps: AdminIdevicesDependencies = defaultDependencies) {
    const {
        db,
        baseIdevicesPath,
        siteIdevicesPath,
        scanIdevices,
        appVersion,
        getDisabledIdeviceIds,
        setDisabledIdeviceIds,
        installer,
    } = deps;

    return new Elysia({ name: 'admin-idevices-routes' })
        .use(jwt({ name: 'jwt', secret: getJwtSecret() }))
        .use(cookie())
        .guard({
            async beforeHandle({ jwt, cookie, set }) {
                const token = cookie.auth?.value;
                if (!token) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'No authentication token' };
                }

                const payload = (await jwt.verify(token)) as JwtPayload | false;
                if (!payload) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Invalid token' };
                }

                const authError = requireAdmin(payload);
                if (authError) {
                    set.status = 403;
                    return { error: authError.error, message: authError.message };
                }

                return undefined;
            },
        })
        .get('/api/admin/idevices', async () => {
            const disabledIds = await getDisabledIdeviceIds(db);
            const version = appVersion();
            const idevices = getAllIdevices(scanIdevices, baseIdevicesPath, siteIdevicesPath)
                .map(({ idevice, source }) => serializeIdevice(idevice, version, disabledIds, source))
                .sort((a, b) => {
                    if (a.category !== b.category) return a.category.localeCompare(b.category);
                    return a.title.localeCompare(b.title);
                });

            return {
                idevices,
                categories: [...new Set(idevices.map(idevice => idevice.category))].sort((a, b) => a.localeCompare(b)),
            };
        })
        .get('/api/admin/idevices/:id', async ({ params, set }) => {
            const disabledIds = await getDisabledIdeviceIds(db);
            const found = getAllIdevices(scanIdevices, baseIdevicesPath, siteIdevicesPath).find(
                ({ idevice }) => idevice.id === params.id,
            );

            if (!found) {
                set.status = 404;
                return { error: 'Not Found', message: 'iDevice not found' };
            }

            return serializeIdevice(found.idevice, appVersion(), disabledIds, found.source);
        })
        .post(
            '/api/admin/idevices/upload',
            async ({ body, set }) => {
                const data = (body ?? {}) as Record<string, unknown>;
                const buffer = await bufferFromUpload(data.file);
                if (!buffer) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'No file uploaded' };
                }

                const outcome = await installer.installFromBuffer(buffer, {
                    confirmOverwrite: isTrue(data.confirmOverwrite),
                });

                if (!outcome.success) {
                    set.status = httpStatusForInstallerCode[outcome.code] ?? 400;
                    return { error: outcome.code, message: outcome.message, details: outcome.details };
                }

                const disabledIds = await getDisabledIdeviceIds(db);
                set.status = 201;
                return serializeIdevice(outcome.config, appVersion(), disabledIds, 'site');
            },
            {
                body: t.Object({
                    file: t.File(),
                    confirmOverwrite: t.Optional(t.String()),
                }),
            },
        )
        .delete('/api/admin/idevices/:id', async ({ params, set }) => {
            const baseIdevice = scanIdevices(baseIdevicesPath).find(idevice => idevice.id === params.id);
            if (baseIdevice) {
                set.status = 409;
                return { error: 'Built-in iDevice', message: 'Built-in iDevices cannot be uninstalled' };
            }

            const siteIdevice = scanIdevices(siteIdevicesPath).find(idevice => idevice.id === params.id);
            if (!siteIdevice) {
                set.status = 404;
                return { error: 'Not Found', message: 'iDevice not found' };
            }

            const result = await installer.uninstall(params.id);
            if (!result.success) {
                set.status = result.code === 'NOT_FOUND' ? 404 : result.code === 'IDEVICE_OVERLAPS_BUILTIN' ? 409 : 500;
                return { error: result.code ?? 'Error', message: result.message ?? 'Could not uninstall iDevice' };
            }

            return { success: true, deleted: { name: params.id } };
        })
        .patch(
            '/api/admin/idevices/:id/enabled',
            async ({ params, body, set }) => {
                const found = getAllIdevices(scanIdevices, baseIdevicesPath, siteIdevicesPath).find(
                    ({ idevice }) => idevice.id === params.id,
                );

                if (!found) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'iDevice not found' };
                }

                const disabledIds = await getDisabledIdeviceIds(db);
                if (body.isEnabled) {
                    disabledIds.delete(params.id);
                } else {
                    disabledIds.add(params.id);
                }

                await setDisabledIdeviceIds(db, disabledIds);

                return serializeIdevice(found.idevice, appVersion(), disabledIds, found.source);
            },
            {
                body: t.Object({
                    isEnabled: t.Boolean(),
                }),
            },
        );
}

export const adminIdevicesRoutes = createAdminIdevicesRoutes();
