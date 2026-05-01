import { beforeAll, afterAll, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { createAdminIdevicesRoutes, type AdminIdevicesDependencies } from './admin-idevices';
import type { IdeviceConfig } from './idevices';
import type { IdeviceInstallerService } from '../services/idevice-installer';

const TEST_JWT_SECRET = 'test-secret-for-admin-idevices';
let originalJwtSecret: string | undefined;

const mockIdevice: IdeviceConfig = {
    id: 'rubric',
    title: 'Rubric',
    cssClass: 'rubric',
    category: 'Assessment and tracking',
    icon: { name: 'rubric-icon', url: 'rubric-icon.svg', type: 'img' },
    version: '1.0',
    apiVersion: '3.0',
    componentType: 'html',
    author: 'eXeLearning',
    authorUrl: 'https://exelearning.net',
    license: 'AGPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
    description: 'Assessment rubric',
    downloadable: false,
    url: 'public/files/perm/idevices/base/rubric',
    editionJs: ['rubric.js'],
    editionCss: ['rubric.css'],
    exportJs: ['rubric.js'],
    exportCss: ['rubric.css'],
    editionTemplateFilename: '',
    exportTemplateFilename: '',
    editionTemplateContent: '',
    exportTemplateContent: '',
    location: '',
    locationType: '',
    exportObject: '$rubric',
};

const mockSiteIdevice: IdeviceConfig = {
    ...mockIdevice,
    id: 'site-activity',
    title: 'Site Activity',
    cssClass: 'site-activity',
    url: 'public/files/perm/idevices/site/site-activity',
    editionJs: ['site-activity.js'],
    exportJs: ['site-activity.js'],
    exportObject: '$siteactivity',
};

beforeAll(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterAll(() => {
    if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalJwtSecret;
    }
});

async function generateToken(roles: string[]): Promise<string> {
    const app = new Elysia().use(jwt({ name: 'jwt', secret: TEST_JWT_SECRET }));
    let token = '';
    await app
        .get('/generate', async ({ jwt }) => {
            token = await jwt.sign({
                sub: 1,
                email: 'admin@test.com',
                roles,
                isGuest: false,
            });
            return token;
        })
        .handle(new Request('http://localhost/generate'));
    return token;
}

function createAuthRequest(url: string, token: string, options: RequestInit = {}): Request {
    const headers = new Headers(options.headers);
    headers.set('Cookie', `auth=${token}`);
    return new Request(url, { ...options, headers });
}

function createDeps(overrides: Partial<AdminIdevicesDependencies> = {}): AdminIdevicesDependencies {
    const installer: IdeviceInstallerService = {
        installFromBuffer: mock(async () => ({
            success: true,
            id: mockSiteIdevice.id,
            name: mockSiteIdevice.id,
            title: mockSiteIdevice.title,
            version: mockSiteIdevice.version,
            exportObject: mockSiteIdevice.exportObject,
            overwritten: false,
            config: mockSiteIdevice,
        })),
        uninstall: mock(async () => ({ success: true })),
    };

    return {
        db: {} as AdminIdevicesDependencies['db'],
        baseIdevicesPath: 'public/files/perm/idevices/base',
        siteIdevicesPath: 'public/files/perm/idevices/site',
        scanIdevices: mock((scanPath: string) => (scanPath.includes('/site') ? [] : [mockIdevice])),
        appVersion: () => 'vtest',
        getDisabledIdeviceIds: mock(() => Promise.resolve(new Set<string>())),
        setDisabledIdeviceIds: mock(() => Promise.resolve()),
        installer,
        ...overrides,
    };
}

describe('Admin iDevices Routes', () => {
    it('requires authentication', async () => {
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps()));

        const response = await app.handle(new Request('http://localhost/api/admin/idevices'));

        expect(response.status).toBe(401);
    });

    it('requires ROLE_ADMIN', async () => {
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps()));
        const token = await generateToken(['ROLE_USER']);

        const response = await app.handle(createAuthRequest('http://localhost/api/admin/idevices', token));

        expect(response.status).toBe(403);
    });

    it('lists iDevices with metadata and enabled state', async () => {
        const app = new Elysia().use(
            createAdminIdevicesRoutes(
                createDeps({ getDisabledIdeviceIds: mock(() => Promise.resolve(new Set(['rubric']))) }),
            ),
        );
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(createAuthRequest('http://localhost/api/admin/idevices', token));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.categories).toEqual(['Assessment and tracking']);
        expect(body.idevices).toHaveLength(1);
        expect(body.idevices[0].id).toBe('rubric');
        expect(body.idevices[0].name).toBe('rubric');
        expect(body.idevices[0].title).toBe('Rubric');
        expect(body.idevices[0].cssClass).toBe('rubric');
        expect(body.idevices[0].category).toBe('Assessment and tracking');
        expect(body.idevices[0].author).toBe('eXeLearning');
        expect(body.idevices[0].isEnabled).toBe(false);
        expect(body.idevices[0].source).toBe('base');
    });

    it('lists site iDevices separately from built-in iDevices', async () => {
        const app = new Elysia().use(
            createAdminIdevicesRoutes(
                createDeps({
                    scanIdevices: mock((scanPath: string) =>
                        scanPath.includes('/site') ? [mockSiteIdevice] : [mockIdevice],
                    ),
                }),
            ),
        );
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(createAuthRequest('http://localhost/api/admin/idevices', token));

        expect(response.status).toBe(200);
        const body = await response.json();
        const siteIdevice = body.idevices.find((idevice: { id: string }) => idevice.id === 'site-activity');
        expect(siteIdevice.source).toBe('site');
        expect(siteIdevice.url).toBe('/vtest/files/perm/idevices/site/site-activity');
    });

    it('installs a site iDevice through the existing installer', async () => {
        let receivedBuffer: Buffer | null = null;
        let receivedConfirmOverwrite = false;
        const installer: IdeviceInstallerService = {
            installFromBuffer: mock(async (buffer, options = {}) => {
                receivedBuffer = buffer;
                receivedConfirmOverwrite = options.confirmOverwrite === true;
                return {
                    success: true,
                    id: mockSiteIdevice.id,
                    name: mockSiteIdevice.id,
                    title: mockSiteIdevice.title,
                    version: mockSiteIdevice.version,
                    exportObject: mockSiteIdevice.exportObject,
                    overwritten: false,
                    config: mockSiteIdevice,
                };
            }),
            uninstall: mock(async () => ({ success: true })),
        };
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps({ installer })));
        const token = await generateToken(['ROLE_ADMIN']);
        const formData = new FormData();
        formData.append('file', new File(['zip-data'], 'site-activity.zip', { type: 'application/zip' }));
        formData.append('confirmOverwrite', 'true');

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/upload', token, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(201);
        expect(receivedBuffer?.toString()).toBe('zip-data');
        expect(receivedConfirmOverwrite).toBe(true);
        const body = await response.json();
        expect(body.id).toBe('site-activity');
        expect(body.source).toBe('site');
    });

    it('maps installer validation failures when installing a site iDevice', async () => {
        const installer: IdeviceInstallerService = {
            installFromBuffer: mock(async () => ({
                success: false,
                code: 'IDEVICE_OVERLAPS_BUILTIN',
                message: 'Cannot overwrite built-in iDevice.',
            })),
            uninstall: mock(async () => ({ success: true })),
        };
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps({ installer })));
        const token = await generateToken(['ROLE_ADMIN']);
        const formData = new FormData();
        formData.append('file', new File(['zip-data'], 'rubric.zip', { type: 'application/zip' }));

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/upload', token, {
                method: 'POST',
                body: formData,
            }),
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
            error: 'IDEVICE_OVERLAPS_BUILTIN',
            message: 'Cannot overwrite built-in iDevice.',
        });
    });

    it('uninstalls only site iDevices', async () => {
        let receivedId = '';
        const installer: IdeviceInstallerService = {
            installFromBuffer: mock(async () => ({
                success: true,
                id: mockSiteIdevice.id,
                name: mockSiteIdevice.id,
                title: mockSiteIdevice.title,
                version: mockSiteIdevice.version,
                exportObject: mockSiteIdevice.exportObject,
                overwritten: false,
                config: mockSiteIdevice,
            })),
            uninstall: mock(async id => {
                receivedId = id;
                return { success: true };
            }),
        };
        const app = new Elysia().use(
            createAdminIdevicesRoutes(
                createDeps({
                    installer,
                    scanIdevices: mock((scanPath: string) =>
                        scanPath.includes('/site') ? [mockSiteIdevice] : [mockIdevice],
                    ),
                }),
            ),
        );
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/site-activity', token, { method: 'DELETE' }),
        );

        expect(response.status).toBe(200);
        expect(receivedId).toBe('site-activity');
        expect(await response.json()).toMatchObject({ success: true, deleted: { name: 'site-activity' } });
    });

    it('does not uninstall built-in iDevices from admin actions', async () => {
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps()));
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/rubric', token, { method: 'DELETE' }),
        );

        expect(response.status).toBe(409);
    });

    it('toggles an iDevice enabled state', async () => {
        const disabledIds = new Set(['rubric']);
        const setDisabledIdeviceIds = mock(() => Promise.resolve());
        const app = new Elysia().use(
            createAdminIdevicesRoutes(
                createDeps({
                    getDisabledIdeviceIds: mock(() => Promise.resolve(disabledIds)),
                    setDisabledIdeviceIds,
                }),
            ),
        );
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/rubric/enabled', token, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: true }),
            }),
        );

        expect(response.status).toBe(200);
        expect(setDisabledIdeviceIds).toHaveBeenCalled();
        const body = await response.json();
        expect(body.isEnabled).toBe(true);
        expect(disabledIds.has('rubric')).toBe(false);
    });

    it('returns 404 when toggling an unknown iDevice', async () => {
        const app = new Elysia().use(createAdminIdevicesRoutes(createDeps()));
        const token = await generateToken(['ROLE_ADMIN']);

        const response = await app.handle(
            createAuthRequest('http://localhost/api/admin/idevices/unknown/enabled', token, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: false }),
            }),
        );

        expect(response.status).toBe(404);
    });
});
