import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import * as fflate from 'fflate';
import { developerRoutes } from './developer';

describe('developerRoutes', () => {
    let previousAppEnv: string | undefined;
    let app: Elysia;

    beforeEach(() => {
        previousAppEnv = process.env.APP_ENV;
        process.env.APP_ENV = 'dev';
        app = new Elysia().use(developerRoutes);
    });

    afterEach(() => {
        if (previousAppEnv === undefined) {
            delete process.env.APP_ENV;
        } else {
            process.env.APP_ENV = previousAppEnv;
        }
    });

    it('hides Style Lab when APP_ENV is not dev', async () => {
        process.env.APP_ENV = 'prod';

        const response = await app.handle(new Request('http://localhost/developer/style-lab'));

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not Found');
    });

    it('serves the Style Lab page in dev mode', async () => {
        const response = await app.handle(new Request('http://localhost/developer/style-lab'));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(await response.text()).toContain('Style Lab');
    });

    it('lists fixtures from the deterministic fixture directories', async () => {
        const response = await app.handle(new Request('http://localhost/api/developer/fixtures'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.fixtures).toContain('example.elpx');
        expect(body.fixtures.every((fixture: string) => fixture.endsWith('.elp') || fixture.endsWith('.elpx'))).toBe(
            true,
        );
    });

    it('blocks path traversal when serving fixture files', async () => {
        const response = await app.handle(new Request('http://localhost/api/developer/fixtures/../package.json'));

        expect(response.status).toBe(404);
        expect(await response.text()).toContain('NOT_FOUND');
    });

    it('exposes an automation manifest for Style Lab', async () => {
        const response = await app.handle(new Request('http://localhost/api/developer/manifest'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.fixtures).toContain('example.elpx');
        expect(body.exportTypes.map((preset: { id: string }) => preset.id)).toEqual(['html5', 'html5-sp', 'scorm12']);
        expect(body.viewports.map((viewport: { id: string }) => viewport.id)).toEqual(['desktop', 'tablet', 'mobile']);
        expect(body.exportOptions.map((option: { id: string }) => option.id)).toContain('addSearchBox');
    });

    it('validates required preview parameters', async () => {
        const response = await app.handle(new Request('http://localhost/api/developer/style-lab/preview'));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('(fixture or session) and theme');
    });

    it('generates a real export ZIP for a fixture preview', async () => {
        const response = await app.handle(
            new Request(
                'http://localhost/api/developer/style-lab/preview?fixture=example.elpx&theme=base&exportType=html5',
            ),
        );
        const zipBytes = new Uint8Array(await response.arrayBuffer());
        const files = fflate.unzipSync(zipBytes);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/zip');
        expect(Object.keys(files)).toContain('index.html');
        expect(Object.keys(files)).toContain('theme/style.css');
    });

    it('rejects missing themes during theme export', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/developer/style-lab/export-theme', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ theme: 'missing-theme' }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.error).toContain('Theme not found');
    });

    it('exports theme ZIP with patched metadata and controlled CSS overrides', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/developer/style-lab/export-theme', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    theme: 'base',
                    fileOverrides: {
                        'style.css':
                            'body { color: #111; }\n\n/* style-lab-quick:start */\na { color: red; }\n/* style-lab-quick:end */',
                    },
                    themeMetadata: {
                        name: 'style-lab-custom',
                        title: 'Style Lab Custom',
                        version: '1.2.3',
                        compatibility: '3.0',
                        author: 'Style Lab',
                        license: 'AGPL-3.0',
                        licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
                        description: 'Created in Style Lab',
                        downloadable: '1',
                    },
                }),
            }),
        );
        const files = fflate.unzipSync(new Uint8Array(await response.arrayBuffer()));
        const configXml = new TextDecoder().decode(files['config.xml']);
        const styleCss = new TextDecoder().decode(files['style.css']);

        expect(response.status).toBe(200);
        expect(configXml).toContain('<name>style-lab-custom</name>');
        expect(configXml).toContain('<title>Style Lab Custom</title>');
        expect(configXml).toContain('<version>1.2.3</version>');
        expect(configXml).toContain('<license-url>https://www.gnu.org/licenses/agpl-3.0.html</license-url>');
        expect(styleCss).toContain('/* style-lab-quick:start */');
        expect(styleCss).toContain('a { color: red; }');
    });

    it('validates install theme identifiers before touching storage', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/developer/style-lab/install-theme', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    theme: 'base',
                    newDirName: '../bad',
                    newDisplayName: 'Bad Theme',
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('newDirName');
    });

    it('rejects unsafe binary override paths during theme installation', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/developer/style-lab/install-theme', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    theme: 'base',
                    newDirName: 'unsafe-binary-path',
                    newDisplayName: 'Unsafe Binary Path',
                    assetFiles: {
                        '../escape.txt': Buffer.from('escape').toString('base64'),
                    },
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('Invalid theme file path');
    });

    it('rejects unsafe paths inside uploaded theme ZIPs', async () => {
        const zipBase64 = Buffer.from(
            fflate.zipSync({
                'theme\\escape.txt': Buffer.from('escape'),
                'config.xml': Buffer.from('<theme><name>unsafe-upload</name></theme>'),
            }),
        ).toString('base64');

        const response = await app.handle(
            new Request('http://localhost/api/developer/style-lab/upload-theme', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    zipBase64,
                    newDirName: 'unsafe-upload',
                    newDisplayName: 'Unsafe Upload',
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('Invalid theme ZIP entry path');
    });

    it('acknowledges reload requests in dev mode', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/developer/reload-theme', {
                method: 'POST',
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, reload: true });
    });
});
