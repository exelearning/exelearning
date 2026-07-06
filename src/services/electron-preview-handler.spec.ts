import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'bun:test';
import { handlePreviewRequest, initElectronPreview } from './electron-preview-handler';
import * as manager from './preview-session-manager';

const BASE = 'app://localhost';

function sha256Hex(s: string): string {
    return createHash('sha256').update(new TextEncoder().encode(s)).digest('hex');
}

/** Drive the full create → manifest → blobs handshake and return the previewId. */
async function preparedSession(files: Record<string, string>): Promise<string> {
    const create = await handlePreviewRequest(new Request(`${BASE}/api/preview-session`, { method: 'POST' }));
    expect(create?.status).toBe(201);
    const { previewId } = (await create!.json()) as { previewId: string };

    const manifest: Record<string, { sha256: string; size: number }> = {};
    for (const [path, content] of Object.entries(files)) {
        manifest[path] = { sha256: sha256Hex(content), size: new TextEncoder().encode(content).length };
    }
    const manifestRes = await handlePreviewRequest(
        new Request(`${BASE}/api/preview-session/${previewId}/manifest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: manifest }),
        }),
    );
    const { manifestId, missing } = (await manifestRes.json()) as { manifestId: string; missing: string[] };

    const form = new FormData();
    form.set('manifestId', manifestId);
    const hashes: string[] = [];
    for (const [path, content] of Object.entries(files)) {
        const h = sha256Hex(content);
        if (missing.includes(h)) {
            hashes.push(h);
            form.append('files', new Blob([new TextEncoder().encode(content)]), path);
        }
    }
    form.set('hashes', JSON.stringify(hashes));
    const blobsRes = await handlePreviewRequest(
        new Request(`${BASE}/api/preview-session/${previewId}/blobs`, { method: 'POST', body: form }),
    );
    const stored = (await blobsRes.json()) as { active: boolean };
    expect(stored.active).toBe(true);
    return previewId;
}

describe('electron-preview-handler', () => {
    afterEach(() => manager.resetDependencies());

    it('returns null for non-preview paths (so static serving handles them)', async () => {
        initElectronPreview();
        expect(await handlePreviewRequest(new Request(`${BASE}/index.html`))).toBeNull();
        expect(await handlePreviewRequest(new Request(`${BASE}/app/app.bundle.js`))).toBeNull();
    });

    it('serves a synced session over the opaque capability URL', async () => {
        const previewId = await preparedSession({
            'index.html': '<html><body>hi</body></html>',
            'theme/style.css': 'body{color:red}',
        });
        const res = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/index.html`));
        expect(res?.status).toBe(200);
        expect(await res!.text()).toContain('hi');
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
            expect(res!.headers.get('cache-control')).toBe('no-store');
            expect(res!.headers.get('access-control-allow-origin')).toBe('*');
        }
    });

    it('404s an invalid previewId and an unknown path', async () => {
        const bad = await handlePreviewRequest(new Request(`${BASE}/preview/not-a-uuid/index.html`));
        expect(bad?.status).toBe(404);
        const previewId = await preparedSession({ 'index.html': '<html></html>' });
        const missing = await handlePreviewRequest(new Request(`${BASE}/preview/${previewId}/nope.html`));
        expect(missing?.status).toBe(404);
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
