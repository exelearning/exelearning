import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createDeveloperRoutes } from './developer';

function buildApp(opts: {
    enabled: boolean;
    rendered?: string[];
    fixtures?: Array<{ id: string; label: string; size: number }>;
    fixtureBuf?: Buffer | null;
    previewBaseDir?: string;
    generateExport?: (buf: Buffer, theme: string, mode: string, outDir: string) => Promise<void>;
}) {
    const rendered = opts.rendered ?? [];
    const app = new Elysia().use(
        createDeveloperRoutes({
            isEnabled: () => opts.enabled,
            // biome-ignore lint/suspicious/noExplicitAny: test stub for renderTemplate
            renderTemplate: ((name: string) => {
                rendered.push(name);
                return `<html data-tpl="${name}"></html>`;
            }) as any,
            setRenderLocale: () => {},
            listFixtures: () => opts.fixtures ?? [],
            readFixture: () => opts.fixtureBuf ?? null,
            previewBaseDir: opts.previewBaseDir,
            generateExport: opts.generateExport,
        }),
    );
    return { app, rendered };
}

async function get(app: Elysia, p: string) {
    return app.handle(new Request(`http://localhost${p}`));
}

describe('developer routes — disabled', () => {
    for (const p of [
        '/developer',
        '/developer/style-lab',
        '/developer/idevice-lab',
        '/developer/api',
        '/developer/fixtures',
        '/developer/preview/whatever.elpx',
        '/developer/preview-cache/whatever/index.html',
    ]) {
        it(`returns 404 for ${p}`, async () => {
            const { app } = buildApp({ enabled: false });
            const res = await get(app, p);
            expect(res.status).toBe(404);
        });
    }
});

describe('developer routes — enabled', () => {
    it('redirects /developer to /developer/style-lab', async () => {
        const { app } = buildApp({ enabled: true });
        const res = await get(app, '/developer');
        expect(res.status).toBe(302);
        expect(res.headers.get('location') || '').toContain('/developer/style-lab');
    });

    it('renders the styleLab template at /developer/style-lab', async () => {
        const { app, rendered } = buildApp({ enabled: true });
        const res = await get(app, '/developer/style-lab');
        expect(res.status).toBe(200);
        expect(rendered).toContain('workarea/developer/styleLab');
    });

    it('renders the ideviceLab template at /developer/idevice-lab', async () => {
        const { app, rendered } = buildApp({ enabled: true });
        const res = await get(app, '/developer/idevice-lab');
        expect(res.status).toBe(200);
        expect(rendered).toContain('workarea/developer/ideviceLab');
    });

    it('redirects /developer/api to /api/v1/docs', async () => {
        const { app } = buildApp({ enabled: true });
        const res = await get(app, '/developer/api');
        expect(res.status).toBe(302);
        expect((res.headers.get('location') || '').endsWith('/api/v1/docs')).toBe(true);
    });

    it('returns a JSON list at /developer/fixtures', async () => {
        const fixtures = [{ id: 'a.elpx', label: 'a', size: 1 }];
        const { app } = buildApp({ enabled: true, fixtures });
        const res = await get(app, '/developer/fixtures');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ fixtures });
    });

    it('returns 404 when the fixture file is unknown', async () => {
        const { app } = buildApp({ enabled: true, fixtureBuf: null });
        const res = await get(app, '/developer/preview/nope.elpx');
        expect(res.status).toBe(404);
    });
});

describe('developer preview pipeline (export + static serve)', () => {
    let previewDir: string;
    beforeEach(async () => {
        previewDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'exelearning-dev-preview-spec-'));
    });

    it('generates the export and redirects to the cached static URL', async () => {
        const generateExport = async (_buf: Buffer, _theme: string, _mode: string, outDir: string) => {
            await fsp.mkdir(outDir, { recursive: true });
            await fsp.writeFile(path.join(outDir, 'index.html'), '<!doctype html><body>OK</body>');
        };
        const { app } = buildApp({
            enabled: true,
            fixtureBuf: Buffer.from('elpx-bytes'),
            previewBaseDir: previewDir,
            generateExport,
        });
        const res = await get(app, '/developer/preview/sample.elpx?theme=flux&mode=web');
        expect(res.status).toBe(302);
        const loc = res.headers.get('location') || '';
        expect(loc).toMatch(/\/developer\/preview-cache\/sample__flux__web\/index\.html$/);

        expect(fs.existsSync(path.join(previewDir, 'sample__flux__web', 'index.html'))).toBe(true);
    });

    it('serves an arbitrary file from the cache dir with correct mime type', async () => {
        const cacheKey = 'demo__base__web';
        const dir = path.join(previewDir, cacheKey);
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(path.join(dir, 'index.html'), '<!doctype html><body>hello</body>');
        await fsp.mkdir(path.join(dir, 'libs'), { recursive: true });
        await fsp.writeFile(path.join(dir, 'libs', 'app.css'), 'body{}');

        const { app } = buildApp({ enabled: true, previewBaseDir: previewDir });

        const html = await get(app, `/developer/preview-cache/${cacheKey}/index.html`);
        expect(html.status).toBe(200);
        expect(html.headers.get('Content-Type') || '').toContain('text/html');
        expect(await html.text()).toContain('hello');

        const css = await get(app, `/developer/preview-cache/${cacheKey}/libs/app.css`);
        expect(css.status).toBe(200);
        expect(css.headers.get('Content-Type') || '').toContain('text/css');
        expect(await css.text()).toBe('body{}');
    });

    it('rejects path traversal in the static handler', async () => {
        const { app } = buildApp({ enabled: true, previewBaseDir: previewDir });
        const res = await get(app, '/developer/preview-cache/anykey/../etc/passwd');
        expect(res.status).toBe(404);
    });

    it('returns 404 when the cache key has unsafe characters', async () => {
        const { app } = buildApp({ enabled: true, previewBaseDir: previewDir });
        const res = await get(app, '/developer/preview-cache/has%20space/index.html');
        expect(res.status).toBe(404);
    });
});
