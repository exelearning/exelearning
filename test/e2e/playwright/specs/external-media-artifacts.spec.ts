import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

/** Kept in step with `scripts/external-media/sources.ts`. */
const ARTIFACT_NAMES = {
    child: 'exe-external-media-child.min.js',
    host: 'exe-external-media-host.min.js',
} as const;

/**
 * The distributable artifacts are what host plugins actually vendor, so they — not the
 * sources they were built from — are what has to work. Minification, concatenation
 * order and the classic-script contract all only fail here.
 *
 * Both directions of ADR-2199-08 are covered: a host that welcomes the child promotes the
 * embeds, and a page with no relay at all leaves the author's iframes untouched.
 *
 * The artifacts are built into a temp directory by this spec, so it never depends on
 * whether someone remembered to run the build first.
 */

let dir: string;
let server: Server;
let base: string;

/**
 * The harness is served over HTTP, not `file://`, and that is load-bearing: a
 * sandboxed frame on `file://` cannot load local scripts at all (Chromium and WebKit
 * refuse outright, Firefox raises a null-principal security error). The child would
 * then be inert because it never ran, which proves nothing about the handshake.
 */
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

function startServer(root: string): Promise<{ server: Server; base: string }> {
    return new Promise(resolve => {
        const s = createServer((req, res) => {
            const path = join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
            if (!path.startsWith(root) || !existsSync(path)) {
                res.writeHead(404).end('not found');
                return;
            }
            const headers: Record<string, string> = {
                'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
            };
            // A top-level page in an opaque origin, the way a platform serves untrusted
            // content in a tab of its own (ADR-2199-16).
            if (path.endsWith('.sandboxed.html')) headers['Content-Security-Policy'] = 'sandbox allow-scripts';
            res.writeHead(200, headers);
            res.end(readFileSync(path));
        });
        s.listen(0, '127.0.0.1', () => {
            const address = s.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            resolve({ server: s, base: `http://127.0.0.1:${port}` });
        });
    });
}

const CONTENT = `<!doctype html><meta charset="utf-8"><body>
<iframe id="yt" src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" width="480" height="270"></iframe>
<iframe id="ext" src="https://example.com/" width="200" height="120"></iframe>
<script src="./${ARTIFACT_NAMES.child}"></script>
</body>`;

/**
 * What ADR-2199-16 is about: an embed no provider covers (Padlet), and Canva's responsive
 * snippet — a zero-height box that reserves space with padding-top and overflow:hidden,
 * with the iframe positioned over it.
 */
const CONTENT_FACADE = `<!doctype html><meta charset="utf-8"><body>
<iframe id="yt" src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" width="480" height="270"></iframe>
<iframe id="padlet" src="https://padlet.com/embed/abc" width="300" height="200"></iframe>
<div id="canva" style="position:relative;width:400px;height:0;padding-top:50%;overflow:hidden">
<iframe style="position:absolute;width:100%;height:100%;top:0;left:0;border:0" src="https://www.canva.com/design/DAG/view?embed"></iframe>
</div>
<script src="./${ARTIFACT_NAMES.child}"></script>
</body>`;

const PARENT_FACADE_NO_HOST = `<!doctype html><meta charset="utf-8">
<body><iframe id="content" sandbox="allow-scripts allow-popups" src="./content-facade.html" width="520" height="800"></iframe></body>`;

const PARENT_FACADE_STRICT = `<!doctype html><meta charset="utf-8">
<style>#wrap{position:relative;width:520px;height:800px}#content{width:100%;height:100%;border:0}</style>
<body>
<div id="wrap"><iframe id="content" sandbox="allow-scripts allow-popups" src="./content-facade.html"></iframe></div>
<script src="./${ARTIFACT_NAMES.host}"></script>
<script>window.exeEmbedRelay.init({ mode: 'strict', whitelist: ['www.youtube-nocookie.com', 'padlet.com'] });</script>
</body>`;

const PARENT = `<!doctype html><meta charset="utf-8">
<style>#wrap{position:relative;width:520px;height:600px}#content{width:100%;height:100%;border:0}</style>
<body>
<div id="wrap"><iframe id="content" sandbox="allow-scripts" src="./content.html"></iframe></div>
<script src="./${ARTIFACT_NAMES.host}"></script>
<script>window.exeEmbedRelay.init({ mode: 'open' });</script>
</body>`;

/**
 * A host page that can cover its own content frame, the way an editor panel covers a
 * preview. The frame stays in the DOM, keeps its box and stays measurable — only something
 * else is painted on top of it.
 */
const PARENT_COVERABLE = `<!doctype html><meta charset="utf-8">
<style>
  #wrap{position:relative;width:520px;height:600px}
  #content{width:100%;height:100%;border:0}
  #panel{position:absolute;inset:0;background:#fff;z-index:10;display:none}
  body.editing #panel{display:block}
</style>
<body>
<div id="wrap">
  <iframe id="content" sandbox="allow-scripts" src="./content.html"></iframe>
  <div id="panel">editor</div>
</div>
<script src="./${ARTIFACT_NAMES.host}"></script>
<script>window.exeEmbedRelay.init({ mode: 'open' });</script>
</body>`;

const PARENT_NO_HOST = `<!doctype html><meta charset="utf-8">
<body><iframe id="content" sandbox="allow-scripts" src="./content.html" width="520" height="600"></iframe></body>`;

/**
 * The host initialised BEFORE the content frame exists.
 *
 * This is Moodle's order, and it is deliberate there: the relay is inlined ahead of the
 * iframe so its message listener is installed before the frame can load. A host that only
 * learned about frames from a scan at init would find nothing, never welcome the child,
 * and leave every embed unpromoted — which is exactly what happened until the sender was
 * resolved lazily again.
 */
const PARENT_EARLY_INIT = `<!doctype html><meta charset="utf-8">
<style>#wrap{position:relative;width:520px;height:600px}#content{width:100%;height:100%;border:0}</style>
<body>
<script src="./${ARTIFACT_NAMES.host}"></script>
<script>window.exeEmbedRelay.init({ mode: 'open' });</script>
<div id="wrap"><iframe id="content" sandbox="allow-scripts" src="./content.html"></iframe></div>
</body>`;

test.beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'exe-external-media-dist-'));
    // Invoke the real build command, so this spec covers the entry point a developer
    // and CI actually run — not just the functions behind it.
    execFileSync('bun', ['scripts/build-external-media.ts', '--out', dir], {
        cwd: join(__dirname, '../../../..'),
        stdio: 'pipe',
    });
    writeFileSync(join(dir, 'content.html'), CONTENT);
    writeFileSync(join(dir, 'parent.html'), PARENT);
    writeFileSync(join(dir, 'parent-nohost.html'), PARENT_NO_HOST);
    writeFileSync(join(dir, 'parent-early-init.html'), PARENT_EARLY_INIT);
    writeFileSync(join(dir, 'parent-coverable.html'), PARENT_COVERABLE);
    writeFileSync(join(dir, 'content-facade.html'), CONTENT_FACADE);
    writeFileSync(join(dir, 'content-facade.sandboxed.html'), CONTENT_FACADE);
    writeFileSync(join(dir, 'parent-facade-nohost.html'), PARENT_FACADE_NO_HOST);
    writeFileSync(join(dir, 'parent-facade-strict.html'), PARENT_FACADE_STRICT);
    ({ server, base } = await startServer(dir));
});

test.afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
});

test('built artifacts promote every embed once the host welcomes the child', async ({ page }) => {
    await page.goto(`${base}/parent.html`);
    const players = page.locator('.exe-embed-overlay iframe');
    await expect.poll(() => players.count(), { timeout: 15000 }).toBe(2);

    const srcs = await players.evaluateAll(els => els.map(e => (e as HTMLIFrameElement).src));
    // The relay rebuilds the canonical, privacy-friendly URL from the reported id.
    expect(srcs.some(s => /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/.test(s))).toBe(true);
    // Open mode promotes any cross-origin https iframe, not just known providers.
    expect(srcs.some(s => /^https:\/\/example\.com\//.test(s))).toBe(true);
});

test('built artifacts promote nothing when no relay answers', async ({ page, context }) => {
    // Offline apart from the harness itself, like a package re-hosted somewhere that
    // speaks no eXe protocol. The child DOES load here — it stays dormant by choice.
    await context.route('**/*', route => (route.request().url().startsWith(base) ? route.continue() : route.abort()));

    await page.goto(`${base}/parent-nohost.html`);
    const content = page.frameLocator('#content');
    // The child re-announces for ~5.5s before giving up; assert the settled state.
    await page.waitForTimeout(6500);

    await expect(content.locator('#yt')).toHaveCount(1);
    // The frame is sandboxed, so the embed no provider covers became a link (ADR-2199-16).
    // Nothing became a bare placeholder only a host could fill (ADR-2199-08).
    await expect(content.locator('[data-exe-embed-id]:not([data-exe-embed-facade])')).toHaveCount(0);
    await expect(content.locator('[data-exe-embed-facade] a')).toHaveText('View content from example.com');
    await expect(page.locator('.exe-embed-overlay iframe')).toHaveCount(0);
});

test.describe('the facade in sandboxed content (ADR-2199-16)', () => {
    test('links an embed no provider covers when no host answers', async ({ page, context }) => {
        await context.route('**/*', route =>
            route.request().url().startsWith(base) ? route.continue() : route.abort(),
        );
        await page.goto(`${base}/parent-facade-nohost.html`);
        const content = page.frameLocator('#content');

        // Built on start: no waiting for the handshake to give up.
        const link = content.locator('[data-exe-embed-facade] a', { hasText: 'padlet.com' });
        await expect(link).toHaveAttribute('href', 'https://padlet.com/embed/abc');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link).toBeVisible();
        // A provider keeps waiting for a host that can render it.
        await expect(content.locator('#yt')).toHaveCount(1);
    });

    test("fills the box of Canva's responsive snippet instead of falling below it", async ({ page, context }) => {
        await context.route('**/*', route =>
            route.request().url().startsWith(base) ? route.continue() : route.abort(),
        );
        await page.goto(`${base}/parent-facade-nohost.html`);
        const content = page.frameLocator('#content');
        await expect(content.locator('#canva [data-exe-embed-facade] a')).toHaveCount(1);

        // With overflow:hidden and zero height, anything left in flow is clipped away.
        const hit = await content.locator('#canva').evaluate(box => {
            const rect = box.getBoundingClientRect();
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return target?.closest('a')?.textContent ?? null;
        });
        expect(hit).toBe('View content from www.canva.com');
    });

    test('a strict host overlays the providers it accepts and leaves the facade for the rest', async ({ page }) => {
        await page.goto(`${base}/parent-facade-strict.html`);
        const content = page.frameLocator('#content');

        // Only YouTube is a provider: padlet.com is allowlisted, but strict mode refuses
        // anything the registry cannot rebuild, so its link stays the way in.
        const players = page.locator('.exe-embed-overlay iframe');
        await expect.poll(() => players.count(), { timeout: 15000 }).toBe(1);
        expect(await players.first().getAttribute('src')).toMatch(/youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/);
        await expect(content.locator('[data-exe-embed-facade] a', { hasText: 'padlet.com' })).toBeVisible();
    });

    test('works in a top-level sandboxed page, which has no parent to ask', async ({ page, context }) => {
        await context.route('**/*', route =>
            route.request().url().startsWith(base) ? route.continue() : route.abort(),
        );
        await page.goto(`${base}/content-facade.sandboxed.html`);

        await expect(page.locator('[data-exe-embed-facade] a', { hasText: 'padlet.com' })).toBeVisible();
        await expect(page.locator('#yt')).toHaveCount(1);
    });
});

test('built artifacts promote when the host was initialised before the frame existed', async ({ page }) => {
    await page.goto(`${base}/parent-early-init.html`);

    // Same expectation as the ordinary parent: the ordering of script and frame is the
    // host's business, not something the content should be able to notice.
    const players = page.locator('.exe-embed-overlay iframe');
    await expect.poll(() => players.count(), { timeout: 15000 }).toBe(2);
});

/**
 * A promoted player must not outlive the visibility of the frame it belongs to.
 *
 * The overlay is pinned to the top of the stacking order so no page chrome can ever cover
 * a player. The flip side is that when the embedder swaps the preview for something else,
 * the frame stays in the DOM, still measurable, and the video keeps playing above whatever
 * replaced it. Reported from the Omeka-embedded editor: press play in the preview, switch
 * to edit, and Big Buck Bunny is on top of the metadata form.
 */
test('a promoted player disappears when its frame is covered, and returns with it', async ({ page }) => {
    await page.goto(`${base}/parent-coverable.html`);

    const overlay = page.locator('.exe-embed-overlay').first();
    await expect.poll(() => page.locator('.exe-embed-overlay iframe').count(), { timeout: 15_000 }).toBe(2);
    await expect(overlay).toBeVisible();

    // The editor panel covers the preview. The frame is untouched: same parent, same box.
    await page.evaluate(() => document.body.classList.add('editing'));

    await expect(overlay).toBeHidden({ timeout: 5_000 });
    // Covered, not destroyed — going back must not need a fresh handshake.
    expect(await page.locator('.exe-embed-overlay iframe').count()).toBe(2);

    await page.evaluate(() => document.body.classList.remove('editing'));
    await expect(overlay).toBeVisible({ timeout: 5_000 });
});
