/**
 * Developer Tools routes
 *
 * Renders the dev-only Style Lab and iDevice Lab pages. The preview pipeline
 * generates an in-memory export from a `.elpx` fixture, writes the files to
 * a temp directory, and then serves them through a static handler so that
 * navigation, scripts, fonts, and sub-pages resolve naturally.
 *
 * Everything is gated by `isDeveloperToolsEnabled`; routes return 404 when
 * the gate is closed so the surface doesn't advertise itself.
 */
import { Elysia } from 'elysia';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as Y from 'yjs';

import {
    renderTemplate as renderTemplateDefault,
    setRenderLocale as setRenderLocaleDefault,
} from '../services/template';
import { getBasePath, prefixPath } from '../utils/basepath.util';
import { getAppVersion } from '../utils/version';
import { isDeveloperToolsEnabled as isDeveloperToolsEnabledDefault } from '../utils/developer-tools.util';
import { parseScormManifest, renderScormLabChrome } from '../utils/scorm-lab-chrome.util';
import * as fflate from 'fflate';
import { ElpxImporter, FileSystemAssetHandler } from '../shared/import';
import {
    ServerYjsDocumentWrapper,
    YjsDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
} from '../shared/export';

const FIXTURES_DIR = path.resolve(process.cwd(), 'test/fixtures');
const FIXTURE_ID_RE = /^[A-Za-z0-9._-]+\.elpx$/i;
const PREVIEW_CACHE_DIR = path.join(os.tmpdir(), 'exelearning-dev-preview');
const PREVIEW_KEY_RE = /^[A-Za-z0-9._-]+$/;
const MIME = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
} as Record<string, string>;

export interface DeveloperRoutesDeps {
    renderTemplate: typeof renderTemplateDefault;
    setRenderLocale: typeof setRenderLocaleDefault;
    isEnabled: () => boolean;
    listFixtures: () => Array<{ id: string; label: string; size: number }>;
    readFixture: (id: string) => Buffer | null;
    /** Generates the export into `outDir`. Override for tests so they can skip the real exporter. */
    generateExport: (elpBuffer: Buffer, theme: string, mode: string, outDir: string) => Promise<void>;
    /** Base directory where preview exports are written. Override for tests. */
    previewBaseDir: string;
}

function listFixturesDefault() {
    if (!fs.existsSync(FIXTURES_DIR)) return [];
    return fs
        .readdirSync(FIXTURES_DIR, { withFileTypes: true })
        .filter(e => e.isFile() && FIXTURE_ID_RE.test(e.name))
        .map(e => {
            const id = e.name;
            const stat = fs.statSync(path.join(FIXTURES_DIR, id));
            const label = id.replace(/\.elpx$/i, '').replace(/[-_]/g, ' ');
            return { id, label, size: stat.size };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

function readFixtureDefault(id: string): Buffer | null {
    if (!FIXTURE_ID_RE.test(id)) return null;
    const file = path.join(FIXTURES_DIR, id);
    if (path.dirname(file) !== FIXTURES_DIR) return null;
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file);
}

async function writeFilesMap(filesMap: Map<string, ArrayBuffer | Uint8Array>, outDir: string): Promise<void> {
    for (const [relPath, buf] of filesMap) {
        const target = path.join(outDir, relPath);
        if (!target.startsWith(outDir)) continue;
        await fsp.mkdir(path.dirname(target), { recursive: true });
        const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
        await fsp.writeFile(target, u8);
    }
}

async function generateExportDefault(elpBuffer: Buffer, theme: string, mode: string, outDir: string): Promise<void> {
    await fsp.rm(outDir, { recursive: true, force: true });
    await fsp.mkdir(outDir, { recursive: true });

    const extractDir = path.join(
        os.tmpdir(),
        `dev-preview-extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    fs.mkdirSync(extractDir, { recursive: true });

    let wrapper: ServerYjsDocumentWrapper | null = null;
    try {
        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, new FileSystemAssetHandler(extractDir));
        await importer.importFromBuffer(new Uint8Array(elpBuffer));

        wrapper = new ServerYjsDocumentWrapper(ydoc, 'dev-preview');
        const document = new YjsDocumentAdapter(wrapper);

        const publicDir = path.resolve(process.cwd(), process.env.PUBLIC_DIR || 'public');
        // Do NOT pass extractDir as the embedded-theme fallback: the fixture's
        // .elpx ships its own theme/, which would otherwise win over the
        // explicit `theme` option and make the theme selector a no-op.
        // Themes always resolve from public/files/perm/themes/base/<theme>.
        const resources = new FileSystemResourceProvider(publicDir, null);
        const assets = new FileSystemAssetProvider(extractDir);
        const zip = new FflateZipProvider();

        if (mode === 'web') {
            // Multi-page web export — use the preview helper that skips zipping.
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const filesMap = await exporter.generateForPreview({ theme });
            await writeFilesMap(filesMap, outDir);
            return;
        }

        // Single / SCORM exporters only expose .export() which returns a ZIP.
        // Unzip it on the fly and write each entry under outDir.
        const exporter =
            mode === 'scorm'
                ? new Scorm12Exporter(document, resources, assets, zip)
                : new PageExporter(document, resources, assets, zip);

        const result = await exporter.export({ theme });
        if (!result.success || !result.data) {
            throw new Error(result.error || `${mode} export failed`);
        }
        const zipBytes =
            result.data instanceof Uint8Array ? result.data : new Uint8Array(await (result.data as Blob).arrayBuffer());
        const entries = fflate.unzipSync(zipBytes);
        const filesMap = new Map<string, Uint8Array>(Object.entries(entries));
        await writeFilesMap(filesMap, outDir);
    } finally {
        if (wrapper) wrapper.destroy();
        await fsp.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
}

function resolveLocale(request: Request): string {
    const header = request.headers.get('accept-language') || '';
    const primary = header.split(',')[0]?.trim().toLowerCase() ?? '';
    if (primary.startsWith('es')) return 'es';
    if (primary.startsWith('fr')) return 'fr';
    return 'en';
}

function htmlResponse(body: string): Response {
    return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function notFound(): Response {
    return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

function cacheKeyFor(fixture: string, theme: string, mode: string): string {
    const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
    return `${safe(fixture.replace(/\.elpx$/i, ''))}__${safe(theme)}__${safe(mode)}`;
}

const pendingGenerations = new Map<string, Promise<void>>();

export function createDeveloperRoutes(overrides: Partial<DeveloperRoutesDeps> = {}) {
    const deps: DeveloperRoutesDeps = {
        renderTemplate: overrides.renderTemplate ?? renderTemplateDefault,
        setRenderLocale: overrides.setRenderLocale ?? setRenderLocaleDefault,
        isEnabled: overrides.isEnabled ?? (() => isDeveloperToolsEnabledDefault(process.env)),
        listFixtures: overrides.listFixtures ?? listFixturesDefault,
        readFixture: overrides.readFixture ?? readFixtureDefault,
        generateExport: overrides.generateExport ?? generateExportDefault,
        previewBaseDir: overrides.previewBaseDir ?? PREVIEW_CACHE_DIR,
    };

    function render(template: string, request: Request): Response {
        const locale = resolveLocale(request);
        deps.setRenderLocale(locale);
        const basePath = getBasePath();
        const viewModel = {
            version: getAppVersion(),
            basePath,
            locale,
            t: {},
            config: { isDev: true, basePath, appEnv: process.env.APP_ENV ?? 'prod' },
        };
        return htmlResponse(deps.renderTemplate(template, viewModel));
    }

    async function ensurePreview(key: string, buf: Buffer, theme: string, mode: string, outDir: string) {
        if (pendingGenerations.has(key)) return pendingGenerations.get(key);
        const p = deps.generateExport(buf, theme, mode, outDir);
        pendingGenerations.set(key, p);
        try {
            await p;
        } finally {
            pendingGenerations.delete(key);
        }
    }

    return new Elysia({ name: 'developer-routes' })
        .get('/developer', () => {
            if (!deps.isEnabled()) return notFound();
            return Response.redirect(prefixPath('/developer/style-lab') || '/developer/style-lab', 302);
        })
        .get('/developer/style-lab', ({ request }) => {
            if (!deps.isEnabled()) return notFound();
            return render('workarea/developer/styleLab', request);
        })
        .get('/developer/idevice-lab', ({ request }) => {
            if (!deps.isEnabled()) return notFound();
            return render('workarea/developer/ideviceLab', request);
        })
        .get('/developer/api', () => {
            if (!deps.isEnabled()) return notFound();
            return Response.redirect(prefixPath('/api/v1/docs') || '/api/v1/docs', 302);
        })
        .get('/developer/idevice-host/:idevice/:mode', ({ params, request }) => {
            if (!deps.isEnabled()) return notFound();
            const ideviceName = String(params.idevice).replace(/[^A-Za-z0-9_-]/g, '');
            const mode = String(params.mode);
            if (!ideviceName || !['edition', 'export'].includes(mode)) return notFound();
            const ideviceDir = path.join(process.cwd(), 'public/files/perm/idevices/base', ideviceName);
            if (!fs.existsSync(path.join(ideviceDir, mode, `${ideviceName}.js`))) return notFound();

            const locale = resolveLocale(request);
            deps.setRenderLocale(locale);
            const basePath = getBasePath();
            const viewModel = {
                version: getAppVersion(),
                basePath,
                locale,
                t: {},
                config: { isDev: true, basePath, appEnv: process.env.APP_ENV ?? 'prod' },
                ideviceName,
                mode,
            };
            return htmlResponse(deps.renderTemplate('workarea/developer/ideviceHost', viewModel));
        })
        .get('/developer/fixtures', () => {
            if (!deps.isEnabled()) return notFound();
            return new Response(JSON.stringify({ fixtures: deps.listFixtures() }), {
                headers: { 'Content-Type': 'application/json' },
            });
        })
        .get('/developer/preview/:fixture', async ({ params, query, request }) => {
            if (!deps.isEnabled()) return notFound();
            const fixture = String(params.fixture);
            const buf = deps.readFixture(fixture);
            if (!buf) return notFound();

            const theme = String(query.theme ?? 'base').replace(/[^A-Za-z0-9_-]/g, '') || 'base';
            const mode = String(query.mode ?? 'web').replace(/[^A-Za-z0-9_-]/g, '') || 'web';
            const forceRefresh = String(query.refresh ?? '') === '1';
            const key = cacheKeyFor(fixture, theme, mode);
            const outDir = path.join(deps.previewBaseDir, key);

            const cachedIndex = path.join(outDir, 'index.html');
            const cacheHit = !forceRefresh && fs.existsSync(cachedIndex);

            try {
                if (!cacheHit) await ensurePreview(key, buf, theme, mode, outDir);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return new Response(
                    `<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#7a1f1f"><strong>Preview failed:</strong> ${message}</body></html>`,
                    { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                );
            }

            // For SCORM, wrap the export in a Moodle-style player chrome so the
            // preview shows the TOC + prev/next bar instead of a single SCO.
            let entryFile = 'index.html';
            if (mode === 'scorm') {
                const manifestPath = path.join(outDir, 'imsmanifest.xml');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const xml = await fsp.readFile(manifestPath, 'utf-8');
                        const locale = resolveLocale(request);
                        const labLocale = (['es', 'en', 'fr'] as const).includes(locale as 'es' | 'en' | 'fr')
                            ? (locale as 'es' | 'en' | 'fr')
                            : 'en';
                        const chromeHtml = renderScormLabChrome(parseScormManifest(xml), labLocale);
                        await fsp.writeFile(path.join(outDir, '__lab.html'), chromeHtml);
                        entryFile = '__lab.html';
                    } catch {
                        // If parsing/writing fails fall back to the raw SCO.
                    }
                }
            }

            const target =
                prefixPath(`/developer/preview-cache/${key}/${entryFile}`) ||
                `/developer/preview-cache/${key}/${entryFile}`;
            return Response.redirect(target, 302);
        })
        .get('/developer/preview-cache/:cacheKey/*', async ({ params }) => {
            if (!deps.isEnabled()) return notFound();
            const key = String(params.cacheKey);
            if (!PREVIEW_KEY_RE.test(key)) return notFound();

            const rest = (params as Record<string, unknown>)['*'];
            const relativeRaw = typeof rest === 'string' && rest.length > 0 ? rest : 'index.html';
            if (relativeRaw.includes('..')) return notFound();

            const outDir = path.join(deps.previewBaseDir, key);
            const file = path.resolve(outDir, relativeRaw);
            if (!file.startsWith(`${outDir}${path.sep}`) && file !== outDir) return notFound();
            if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound();

            const ext = path.extname(file).slice(1).toLowerCase();
            const contentType = MIME[ext] || 'application/octet-stream';
            const data = await fsp.readFile(file);
            return new Response(data, { headers: { 'Content-Type': contentType } });
        });
}

export const developerRoutes = createDeveloperRoutes();
