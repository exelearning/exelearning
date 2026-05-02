import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { createIdeviceInstallerRoutes } from './idevice-installer';
import type {
    DownloadResult,
    IdeviceConfig,
    IdeviceInstallerService,
    InstallOutcome,
    UninstallResult,
} from '../services/idevice-installer';

const stubConfig = (overrides: Partial<IdeviceConfig> = {}): IdeviceConfig => ({
    id: 'custom-idevice',
    title: 'Custom iDevice',
    cssClass: 'custom-idevice',
    category: 'Activity',
    icon: { name: 'custom-idevice-icon', url: 'custom-idevice-icon.svg', type: 'img' },
    version: '1.0',
    apiVersion: '3.0',
    componentType: 'json',
    author: '',
    authorUrl: '',
    license: '',
    licenseUrl: '',
    description: '',
    downloadable: false,
    url: '/tmp/users/custom-idevice',
    editionJs: ['custom-idevice.js'],
    editionCss: [],
    exportJs: ['custom-idevice.js'],
    exportCss: [],
    editionTemplateFilename: '',
    exportTemplateFilename: '',
    editionTemplateContent: '',
    exportTemplateContent: '',
    location: '',
    locationType: '',
    exportObject: '$customidevice',
    ...overrides,
});

const createApp = (options: {
    canInstall?: () => boolean;
    installResult?: InstallOutcome;
    uninstallResult?: UninstallResult;
    downloadResult?: DownloadResult;
    currentUser?: { id: number } | null;
    onInstall?: (buffer: Buffer, confirmOverwrite: boolean, userId: number | string | undefined) => void;
    onUninstall?: (ideviceId: string, userId: number | string | undefined) => void;
    onDownload?: (ideviceId: string, userId: number | string | undefined) => void;
    appVersion?: () => string;
}) => {
    const installer: IdeviceInstallerService = {
        installFromBuffer: async (buffer, installOptions = {}) => {
            options.onInstall?.(buffer, !!installOptions.confirmOverwrite, installOptions.userId);
            return (
                options.installResult ?? {
                    success: true,
                    id: 'custom-idevice',
                    name: 'custom-idevice',
                    title: 'Custom iDevice',
                    version: '1.0',
                    exportObject: '$customidevice',
                    overwritten: false,
                    config: stubConfig(),
                }
            );
        },
        uninstall: async (ideviceId, uninstallOptions = {}) => {
            options.onUninstall?.(ideviceId, uninstallOptions.userId);
            return options.uninstallResult ?? { success: true, backupPath: 'backup/custom-idevice' };
        },
        download: async (ideviceId, downloadOptions = {}) => {
            options.onDownload?.(ideviceId, downloadOptions.userId);
            return (
                options.downloadResult ?? {
                    success: true,
                    zipFileName: `${ideviceId}.zip`,
                    zipBase64: Buffer.from('zip-data').toString('base64'),
                }
            );
        },
    };

    return new Elysia().use(
        createIdeviceInstallerRoutes({
            installer,
            canInstall: options.canInstall ?? (() => true),
            appVersion: options.appVersion ?? (() => 'v1.2.3'),
            currentUser: options.currentUser === undefined ? { id: 42 } : options.currentUser,
        }),
    );
};

describe('iDevice installer routes', () => {
    describe('POST /api/idevices/install', () => {
        it('returns 403 when installation is not allowed', async () => {
            const app = createApp({ canInstall: () => false });
            const formData = new FormData();
            formData.append('file', new File(['zip-data'], 'custom.idevice.zip'));

            const res = await app.handle(
                new Request('http://localhost/api/idevices/install', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({
                success: false,
                code: 'LOCAL_MODE_REQUIRED',
            });
        });

        it('passes uploaded ZIP bytes and confirmOverwrite to the installer', async () => {
            let receivedBuffer: Buffer | null = null;
            let receivedConfirmOverwrite = false;
            let receivedUserId: number | string | undefined;
            const app = createApp({
                onInstall: (buffer, confirmOverwrite, userId) => {
                    receivedBuffer = buffer;
                    receivedConfirmOverwrite = confirmOverwrite;
                    receivedUserId = userId;
                },
            });
            const formData = new FormData();
            formData.append('file', new File(['zip-data'], 'custom.idevice.zip', { type: 'application/zip' }));
            formData.append('confirmOverwrite', 'true');

            const res = await app.handle(
                new Request('http://localhost/api/idevices/install', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(200);
            expect(receivedBuffer?.toString()).toBe('zip-data');
            expect(receivedConfirmOverwrite).toBe(true);
            expect(receivedUserId).toBe(42);
            const body = await res.json();
            expect(body).toMatchObject({
                success: true,
                id: 'custom-idevice',
            });
            expect(body.config.url).toBe('/v1.2.3/files/perm/idevices/users/42/custom-idevice');
            expect(body.config.name).toBe('custom-idevice');
        });

        it('returns 401 when no authenticated user is available', async () => {
            const app = createApp({ currentUser: null });
            const formData = new FormData();
            formData.append('file', new File(['zip-data'], 'custom.idevice.zip'));

            const res = await app.handle(
                new Request('http://localhost/api/idevices/install', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(401);
            expect(await res.json()).toMatchObject({ success: false, code: 'AUTH_REQUIRED' });
        });

        it('returns 400 when no file is provided', async () => {
            const app = createApp({});

            const res = await app.handle(
                new Request('http://localhost/api/idevices/install', {
                    method: 'POST',
                    body: new FormData(),
                }),
            );

            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({
                success: false,
                code: 'INVALID_ZIP',
            });
        });

        it('maps installer error codes to HTTP statuses', async () => {
            const app = createApp({
                installResult: {
                    success: false,
                    code: 'IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM',
                    message: 'iDevice already exists.',
                },
            });
            const formData = new FormData();
            formData.append('file', new File(['zip-data'], 'custom.idevice.zip'));

            const res = await app.handle(
                new Request('http://localhost/api/idevices/install', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(409);
            expect(await res.json()).toMatchObject({
                success: false,
                code: 'IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM',
            });
        });
    });

    describe('DELETE /api/idevices/installed/:ideviceId', () => {
        it('returns 403 when uninstall is not allowed', async () => {
            const app = createApp({ canInstall: () => false });

            const res = await app.handle(
                new Request('http://localhost/api/idevices/installed/custom-idevice', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({
                success: false,
                code: 'LOCAL_MODE_REQUIRED',
            });
        });

        it('passes the route id to the installer', async () => {
            let receivedId = '';
            let receivedUserId: number | string | undefined;
            const app = createApp({
                onUninstall: (ideviceId, userId) => {
                    receivedId = ideviceId;
                    receivedUserId = userId;
                },
            });

            const res = await app.handle(
                new Request('http://localhost/api/idevices/installed/custom-idevice', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(200);
            expect(receivedId).toBe('custom-idevice');
            expect(receivedUserId).toBe(42);
            expect(await res.json()).toMatchObject({ success: true });
        });

        it('returns 401 when uninstalling without an authenticated user', async () => {
            const app = createApp({ currentUser: null });

            const res = await app.handle(
                new Request('http://localhost/api/idevices/installed/custom-idevice', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(401);
            expect(await res.json()).toMatchObject({ success: false, code: 'AUTH_REQUIRED' });
        });

        it('maps missing user iDevices to 404', async () => {
            const app = createApp({
                uninstallResult: {
                    success: false,
                    code: 'NOT_FOUND',
                    message: 'iDevice is not installed.',
                },
            });

            const res = await app.handle(
                new Request('http://localhost/api/idevices/installed/missing-idevice', {
                    method: 'DELETE',
                }),
            );

            expect(res.status).toBe(404);
            expect(await res.json()).toMatchObject({
                success: false,
                code: 'NOT_FOUND',
            });
        });
    });

    describe('GET /api/idevices/:ideviceId/download', () => {
        it('returns 403 when installation features are not allowed', async () => {
            const app = createApp({ canInstall: () => false });

            const res = await app.handle(new Request('http://localhost/api/idevices/custom-idevice/download'));

            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({ success: false, code: 'LOCAL_MODE_REQUIRED' });
        });

        it('passes the route id and authenticated user to the installer', async () => {
            let receivedId = '';
            let receivedUserId: number | string | undefined;
            const app = createApp({
                onDownload: (ideviceId, userId) => {
                    receivedId = ideviceId;
                    receivedUserId = userId;
                },
            });

            const res = await app.handle(new Request('http://localhost/api/idevices/custom-idevice/download'));

            expect(res.status).toBe(200);
            expect(receivedId).toBe('custom-idevice');
            expect(receivedUserId).toBe(42);
            expect(await res.json()).toMatchObject({
                success: true,
                zipFileName: 'custom-idevice.zip',
                zipBase64: Buffer.from('zip-data').toString('base64'),
            });
        });

        it('returns 401 when downloading without an authenticated user', async () => {
            const app = createApp({ currentUser: null });

            const res = await app.handle(new Request('http://localhost/api/idevices/custom-idevice/download'));

            expect(res.status).toBe(401);
            expect(await res.json()).toMatchObject({ success: false, code: 'AUTH_REQUIRED' });
        });

        it('maps missing user iDevices to 404', async () => {
            const app = createApp({
                downloadResult: {
                    success: false,
                    code: 'NOT_FOUND',
                    message: 'iDevice is not installed.',
                },
            });

            const res = await app.handle(new Request('http://localhost/api/idevices/missing-idevice/download'));

            expect(res.status).toBe(404);
            expect(await res.json()).toMatchObject({ success: false, code: 'NOT_FOUND' });
        });
    });
});
