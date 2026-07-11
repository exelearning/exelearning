import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'bun:test';
import { handlePreviewRequest, initElectronPreview } from './electron-preview-handler';
import {
    configure as configureFixedResources,
    resetDependencies as resetFixedResources,
} from './preview-fixed-resources';
import * as manager from './preview-session-manager';

const BASE = 'app://localhost';
const ASSET_KEY = '11111111-2222-4333-8444-555555555555@aabbccdd';

function bytesOf(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/** Drive the v2 create → assets → revision handshake and return the previewId. */
async function preparedSession(
    files: Record<string, string>,
    extras: { assets?: Array<{ key: string; content: string }>; assetRefs?: Record<string, string> } = {},
): Promise<string> {
    const create = await handlePreviewRequest(new Request(`${BASE}/api/preview-session`, { method: 'POST' }));
    expect(create?.status).toBe(201);
    const created = (await create!.json()) as { previewId: string; protocolVersion: number; revision: number };
    expect(created.protocolVersion).toBe(2);
    expect(created.revision).toBe(0);
    const { previewId } = created;

    if (extras.assets?.length) {
        const form = new FormData();
        form.set('assets', JSON.stringify(extras.assets.map(a => ({ key: a.key, size: bytesOf(a.content).length }))));
        for (const asset of extras.assets) form.append('files', new Blob([bytesOf(asset.content)]));
        const uploaded = await handlePreviewRequest(
            new Request(`${BASE}/api/preview-session/${previewId}/assets`, { method: 'POST', body: form }),
        );
        expect(uploaded?.status).toBe(200);
    }

    const form = new FormData();
    form.set(
        'revision',
        JSON.stringify({
            baseRevision: 0,
            nextRevision: 1,
            writes: Object.keys(files),
            deletes: [],
            assetRefs: extras.assetRefs ?? {},
            fixedRefs: {},
        }),
    );
    for (const content of Object.values(files)) form.append('files', new Blob([bytesOf(content)]));
    const published = await handlePreviewRequest(
        new Request(`${BASE}/api/preview-session/${previewId}/revisions`, { method: 'POST', body: form }),
    );
    expect(published?.status).toBe(200);
    expect((await published!.json()) as object).toEqual({ revision: 1, active: true });
    return previewId;
}

describe('electron-preview-handler', () => {
    afterEach(() => {
        manager.resetDependencies();
        resetFixedResources();
    });

    it('returns null for non-preview paths (so static serving handles them)', async () => {
        initElectronPreview();
        expect(await handlePreviewRequest(new Request(`${BASE}/index.html`))).toBeNull();
        expect(await handlePreviewRequest(new Request(`${BASE}/app/app.bundle.js`))).toBeNull();
    });

    it('serves a published session over the opaque capability URL', async () => {
        const previewId = await preparedSession({
            'index.html': '<html><body>hi</body></html>',
            'theme/style.css': 'body{color:red}',
        });
        const res = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/index.html`));
        expect(res?.status).toBe(200);
        expect(await res!.text()).toContain('hi');
        expect(res!.headers.get('cache-control')).toBe('no-store');
    });

    it('serves session assets with ETag, 304 revalidation and Range support', async () => {
        const previewId = await preparedSession(
            { 'index.html': '<html></html>' },
            {
                assets: [{ key: ASSET_KEY, content: '0123456789' }],
                assetRefs: { 'media/clip.mp4': ASSET_KEY },
            },
        );
        const url = `${BASE}/preview/${previewId}/media/clip.mp4`;
        const full = await handlePreviewRequest(new Request(url));
        expect(full?.status).toBe(200);
        expect(full!.headers.get('etag')).toBe(`"${ASSET_KEY}"`);
        expect(full!.headers.get('cache-control')).toBe('no-cache');
        expect(full!.headers.get('accept-ranges')).toBe('bytes');

        const cached = await handlePreviewRequest(new Request(url, { headers: { 'If-None-Match': `"${ASSET_KEY}"` } }));
        expect(cached?.status).toBe(304);

        const partial = await handlePreviewRequest(new Request(url, { headers: { Range: 'bytes=2-4' } }));
        expect(partial?.status).toBe(206);
        expect(partial!.headers.get('content-range')).toBe('bytes 2-4/10');
        expect(await partial!.text()).toBe('234');
    });

    it('serves fixed resources through the manifest-gated resolver', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-fixed-'));
        fs.mkdirSync(path.join(root, 'libs/jquery'), { recursive: true });
        fs.writeFileSync(path.join(root, 'libs/jquery/jquery.min.js'), 'jq();');
        fs.mkdirSync(path.join(root, 'bundles'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'bundles/preview-fixed-resources.json'),
            JSON.stringify({
                schemaVersion: 1,
                buildVersion: 'v-test',
                resources: { 'libs/jquery/jquery.min.js': { path: 'libs/jquery/jquery.min.js', size: 5 } },
            }),
        );
        configureFixedResources({
            publicRoot: root,
            manifestPath: path.join(root, 'bundles/preview-fixed-resources.json'),
        });

        const create = await handlePreviewRequest(new Request(`${BASE}/api/preview-session`, { method: 'POST' }));
        const { previewId } = (await create!.json()) as { previewId: string };
        const form = new FormData();
        form.set(
            'revision',
            JSON.stringify({
                baseRevision: 0,
                nextRevision: 1,
                writes: ['index.html'],
                deletes: [],
                assetRefs: {},
                fixedRefs: { 'libs/jquery/jquery.min.js': 'libs/jquery/jquery.min.js' },
            }),
        );
        form.append('files', new Blob([bytesOf('<html></html>')]));
        const published = await handlePreviewRequest(
            new Request(`${BASE}/api/preview-session/${previewId}/revisions`, { method: 'POST', body: form }),
        );
        expect(published?.status).toBe(200);

        const res = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/libs/jquery/jquery.min.js`));
        expect(res?.status).toBe(200);
        expect(res!.headers.get('cache-control')).toBe('private, max-age=31536000');
        expect(await res!.text()).toBe('jq();');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('answers a stale revision with 409 and the current revision', async () => {
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const form = new FormData();
        form.set(
            'revision',
            JSON.stringify({ baseRevision: 0, nextRevision: 1, writes: [], deletes: [], assetRefs: {}, fixedRefs: {} }),
        );
        const res = await handlePreviewRequest(
            new Request(`${BASE}/api/preview-session/${previewId}/revisions`, { method: 'POST', body: form }),
        );
        expect(res?.status).toBe(409);
        expect(await res!.json()).toEqual({ reason: 'revision-conflict', currentRevision: 1 });
    });

    it('emits the sandbox CSP on scriptable types (HTML + SVG), not on passive ones', async () => {
        const previewId = await preparedSession({
            'index.html': '<html></html>',
            'img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
            'theme/style.css': 'body{}',
        });
        for (const scriptable of ['index.html', 'img/logo.svg']) {
            const res = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/${scriptable}`));
            const csp = res!.headers.get('content-security-policy') ?? '';
            expect(csp.startsWith('sandbox allow-scripts allow-popups allow-forms')).toBe(true);
            expect(csp).not.toContain('allow-same-origin');
        }
        const css = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/theme/style.css`));
        expect(css!.headers.get('content-security-policy')).toBeNull();
    });

    it('sends the hardening headers on every serving response, including 404s', async () => {
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const responses = [
            await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/index.html`)),
            await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/missing.css`)),
            await handlePreviewRequest(new Request(`${BASE}/preview/11111111-2222-4333-8444-555555555555/x.html`)),
        ];
        for (const res of responses) {
            expect(res!.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res!.headers.get('referrer-policy')).toBe('no-referrer');
            expect(res!.headers.get('access-control-allow-origin')).toBe('*');
        }
        expect(responses[1]!.status).toBe(404);
        expect(responses[1]!.headers.get('cache-control')).toBe('no-store');
    });

    it('404s an invalid previewId and an unknown path', async () => {
        const bad = await handlePreviewRequest(new Request(`${BASE}/preview/not-a-uuid/index.html`));
        expect(bad?.status).toBe(404);
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const missing = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/nope.html`));
        expect(missing?.status).toBe(404);
    });

    it('rejects non-GET serving and unknown management methods with 405', async () => {
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const post = await handlePreviewRequest(
            new Request(`${BASE}/preview/${previewId}/index.html`, { method: 'POST' }),
        );
        expect(post?.status).toBe(405);
        const get = await handlePreviewRequest(new Request(`${BASE}/api/preview-session/${previewId}/assets`));
        expect(get?.status).toBe(405);
    });

    it('deletes a session so it stops serving', async () => {
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const del = await handlePreviewRequest(
            new Request(`${BASE}/api/preview-session/${previewId}`, { method: 'DELETE' }),
        );
        expect(del?.status).toBe(200);
        const after = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/index.html`));
        expect(after?.status).toBe(404);
    });
});
