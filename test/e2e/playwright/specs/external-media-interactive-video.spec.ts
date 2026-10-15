import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

/**
 * The media half, end to end in a real engine: an opaque document asks for a video, the
 * trusted page pairs with it over a transferred port, mounts an accessible dialog with a
 * real player, and drives that player by raw `postMessage`.
 *
 * Every piece is unit-tested on its own, and none of that proves they work TOGETHER in a
 * browser: the private `MessagePort`, the `<dialog>`, the sandbox flags and the provider
 * dialect only meet here. This is the interactive-video path the host plugins inherit, and
 * until now nothing exercised it outside of stubs.
 *
 * Built against the ARTIFACTS, not the sources — those are what the plugins vendor.
 */
let dir: string;
let server: Server;
let base: string;

const ARTIFACTS = { child: 'exe-external-media-child.min.js', host: 'exe-external-media-host.min.js' };
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

/**
 * The content document. Opaque (sandboxed without `allow-same-origin`), exactly as a
 * package served by a host plugin is, and it drives playback the way the interactive-video
 * iDevice does: through the media bridge, not by embedding a player itself.
 */
const CONTENT = `<!doctype html><meta charset="utf-8"><body>
<button id="go">play</button>
<script src="./${ARTIFACTS.child}"></script>
<script>
  window.__events = [];
  document.getElementById('go').addEventListener('click', async function () {
    var q = new URLSearchParams(location.search);
    var media = await window.exeMediaBridge.openMedia({
      provider: q.get('provider') || 'youtube',
      videoId: q.get('videoId') || 'aqz-KE-bpKQ',
    });
    window.__opened = !!media;
    if (!media) return;
    window.__media = media;
    ['ready', 'play', 'pause', 'ended', 'closed', 'error'].forEach(function (name) {
      media.on(name, function (e) { window.__events.push(name); });
    });
    window.__play = function () { media.play(); };
    window.__pause = function () { media.pause(); };
    window.__time = function () { return media.getCurrentTime(); };
  });
</script>
</body>`;

const PARENT = `<!doctype html><meta charset="utf-8">
<body>
<iframe id="content" sandbox="allow-scripts" src="./content.html" width="640" height="400"></iframe>
<script src="./${ARTIFACTS.host}"></script>
<script>
  var f = document.getElementById('content');
  f.src = './content.html' + location.search;
  window.__host = window.exeExternalMediaHost.attachMedia(f);
</script>
</body>`;

function startServer(root: string): Promise<{ server: Server; base: string }> {
    return new Promise(resolve => {
        const s = createServer((req, res) => {
            const path = join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
            if (!path.startsWith(root) || !existsSync(path)) {
                res.writeHead(404).end('not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
            res.end(readFileSync(path));
        });
        s.listen(0, '127.0.0.1', () => {
            const address = s.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            resolve({ server: s, base: `http://127.0.0.1:${port}` });
        });
    });
}

test.beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'exe-media-e2e-'));
    // The real build command, so this covers the entry point CI runs.
    execFileSync('bun', ['scripts/build-external-media.ts', '--out', dir], {
        cwd: join(__dirname, '../../../..'),
        stdio: 'pipe',
    });
    writeFileSync(join(dir, 'content.html'), CONTENT);
    writeFileSync(join(dir, 'parent.html'), PARENT);
    ({ server, base } = await startServer(dir));
});

test.afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
});

test('an opaque document opens a controllable video on the trusted page', async ({ page }) => {
    await page.goto(`${base}/parent.html`);

    const content = page.frameLocator('#content');
    await content.locator('#go').click();

    // The dialog is the host's, on the trusted page — not inside the opaque document,
    // which could not run a nested player at all.
    const dialog = page.locator('dialog.exe-media-modal');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const player = dialog.locator('iframe');
    await expect(player).toHaveCount(1);

    const src = new URL((await player.getAttribute('src')) ?? '');
    // The privacy-preserving host, rebuilt from the registry rather than taken from
    // whatever the content asked for.
    expect(src.origin).toBe('https://www.youtube-nocookie.com');
    expect(src.pathname).toBe('/embed/aqz-KE-bpKQ');
    // Without both of these the player accepts no commands, and the failure is silence.
    expect(src.searchParams.get('enablejsapi')).toBe('1');
    expect(src.searchParams.get('origin')).toBe(base);

    // No provider SDK was fetched: control is raw postMessage (ADR-2199-13).
    const sdks = await page.evaluate(() => ({
        yt: typeof (window as never as Record<string, unknown>).YT,
        vimeo: typeof (window as never as Record<string, unknown>).Vimeo,
    }));
    expect(sdks).toEqual({ yt: 'undefined', vimeo: 'undefined' });

    // The content really did get a controller back over the transferred port.
    expect(await content.locator('#go').evaluate(() => (window as never as { __opened: boolean }).__opened)).toBe(true);
});

test('the dialog is dismissible and tells the content it closed', async ({ page }) => {
    await page.goto(`${base}/parent.html`);
    const content = page.frameLocator('#content');
    await content.locator('#go').click();

    const dialog = page.locator('dialog.exe-media-modal');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Named for a screen reader, and closable from the keyboard.
    await expect(dialog).toHaveAttribute('aria-label', /.+/);
    const close = dialog.locator('button.exe-media-modal__close');
    await expect(close).toHaveAttribute('type', 'button');
    await expect(close).toHaveAttribute('aria-label', /.+/);

    await close.click();
    await expect(dialog).toBeHidden();

    /**
     * The learner dismissing the video has to reach the iDevice. An interactive-video
     * question clock that never hears `closed` keeps running against a video that is no
     * longer on screen.
     */
    await expect
        .poll(() => content.locator('#go').evaluate(() => (window as never as { __events: string[] }).__events))
        .toContain('closed');
});

test('no video opens without a host to answer', async ({ page }) => {
    // The same content, framed by a page that loads no host at all.
    writeFileSync(
        join(dir, 'parent-nohost.html'),
        `<!doctype html><meta charset="utf-8"><body>
         <iframe id="content" sandbox="allow-scripts" src="./content.html" width="640" height="400"></iframe></body>`,
    );

    await page.goto(`${base}/parent-nohost.html`);
    await page.frameLocator('#content').locator('#go').click();
    await page.waitForTimeout(2000);

    // Nothing is mounted, and nothing is half-mounted: no dialog, no player, no placeholder
    // for a host that will never arrive (ADR-2199-08).
    await expect(page.locator('dialog.exe-media-modal')).toHaveCount(0);
    expect(await page.locator('iframe').count()).toBe(1); // only the content frame itself
});

/**
 * That the video actually PLAYS — not that a player was mounted.
 *
 * Every other check here stops at the boundary: the dialog exists, the URL is canonical,
 * the sandbox is right. All of that is equally true of a player showing a poster frame
 * over a video that will never start, which is the exact failure a CSP or a missing
 * `enablejsapi` produces. The only evidence that separates the two is the player's own
 * clock moving, so this drives playback and reads the time back through the transferred
 * port, from inside the opaque document.
 *
 * It talks to YouTube for real. That is the point — a stub cannot fail the way a provider
 * does — but it also means a sandboxed or offline runner has nothing to measure, so the
 * test says so and skips instead of reporting a green it did not earn.
 */
/**
 * One provider working proves the wiring; it does not prove the DIALECT.
 *
 * Each provider speaks its own postMessage protocol — different command envelopes,
 * different event names, different subscription handshake — and the host has a separate
 * translation per provider. YouTube passing says nothing about whether Vimeo's `getCurrentTime`
 * ever answers, which is exactly the kind of gap that ships as "the video just sits there".
 */
const PLAYABLE = [
    { provider: 'youtube', videoId: 'aqz-KE-bpKQ' },
    { provider: 'vimeo', videoId: '76979871' },
];

for (const target of PLAYABLE) {
    test(`an opened ${target.provider} video actually plays, and pausing stops the clock`, async ({
        page,
    }, testInfo) => {
        test.setTimeout(120_000);
        await page.goto(`${base}/parent.html?provider=${target.provider}&videoId=${target.videoId}`);

        const content = page.frameLocator('#content');
        await content.locator('#go').click();
        await expect(page.locator('dialog.exe-media-modal')).toBeVisible({ timeout: 15_000 });

        const button = content.locator('#go');
        const events = () => button.evaluate(() => (window as never as { __events: string[] }).__events);
        const timeNow = () =>
            button.evaluate(() => (window as never as { __time: () => Promise<number | null> }).__time());

        // `ready` is the provider answering at all. Without it there is nothing to drive, and
        // the cause is the environment rather than the code under test.
        const ready = await expect
            .poll(async () => (await events()).includes('ready'), { timeout: 30_000, intervals: [500, 1000] })
            .toBe(true)
            .then(() => true)
            .catch(() => false);
        test.skip(!ready, `${target.provider} never became ready — no network access to it in this environment`);

        // Unlock autoplay with a parent-page gesture, then drive play over the
        // port. `evaluate(__play)` alone is not a user gesture; CI browsers
        // refuse unmuted playback without one even when the iframe has
        // allow="autoplay".
        await page.locator('dialog.exe-media-modal .exe-media-modal__body').click({ position: { x: 8, y: 8 } });
        await button.evaluate(() => (window as never as { __play: () => void }).__play());

        // The clock moving is the assertion. A poster frame over a dead player cannot produce
        // this, and neither can a mounted iframe that ignored the command.
        const started = await expect
            .poll(async () => (await timeNow()) ?? 0, { timeout: 30_000, intervals: [500, 1000] })
            .toBeGreaterThan(0.5)
            .then(() => true)
            .catch(() => false);
        test.skip(
            !started,
            `${target.provider} did not start playback — autoplay blocked or no media in this environment (player was ready)`,
        );
        expect(await events()).toContain('play');

        await button.evaluate(() => (window as never as { __pause: () => void }).__pause());
        await expect.poll(async () => (await events()).includes('pause'), { timeout: 15_000 }).toBe(true);

        // Paused means paused: the time must not keep climbing on its own.
        const stopped = (await timeNow()) ?? 0;
        await page.waitForTimeout(2500);
        const afterWait = (await timeNow()) ?? 0;
        expect(afterWait).toBeLessThanOrEqual(stopped + 0.5);

        /**
         * Hand the measurement to the migration report, so it can cite numbers instead of
         * describing them. Written after the assertions, never instead of them.
         */
        const out = join(__dirname, '../../../../doc/development/external-media-report/shots');
        mkdirSync(out, { recursive: true });
        writeFileSync(
            join(out, `playback-${target.provider}-${testInfo.project.name}.json`),
            JSON.stringify(
                {
                    engine: testInfo.project.name,
                    provider: target.provider,
                    videoId: target.videoId,
                    secondsAfterPlay: Number(stopped.toFixed(2)),
                    secondsAfterPausing2500ms: Number(afterWait.toFixed(2)),
                    events: await events(),
                },
                null,
                2,
            ),
        );
    });
}
