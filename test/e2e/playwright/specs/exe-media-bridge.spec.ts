import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * End-to-end validation of the external-media bridge in a REAL browser, exercising the
 * one thing the happy-dom unit tests cannot: a genuine opaque-origin sandboxed iframe
 * (`sandbox="allow-scripts allow-popups allow-forms"`, so `window.origin === "null"`)
 * talking to a trusted parent over a real MessageChannel.
 *
 * The harness serves a tiny parent + child page and the actual shipped bridge files via
 * page.route, so no eXe login/workarea is needed. The child runs the real
 * exe_media_bridge.js; the parent runs the real exe-media-host.js relay with a stubbed
 * provider factory (so the test never depends on YouTube/network).
 */

const BRIDGE_DIR = join(process.cwd(), 'public/app/common/exe_media_bridge');
const POLICY_JS = readFileSync(join(BRIDGE_DIR, 'exe_media_policy.js'), 'utf-8');
const BRIDGE_JS = readFileSync(join(BRIDGE_DIR, 'exe_media_bridge.js'), 'utf-8');
const HOST_JS = readFileSync(join(BRIDGE_DIR, 'exe-media-host.js'), 'utf-8');

const VIDEO_ID = 'dQw4w9WgXcQ';

// Child page: real policy + bridge, runs inside the opaque sandboxed iframe. It asks the
// parent to open a video and reports the outcome on its <title>.
const CHILD_HTML = `<!doctype html><html><head>
<script src="/_exebridge/exe_media_policy.js"></script>
<script src="/_exebridge/exe_media_bridge.js"></script>
</head><body><div id="player"></div><script>
  // Model real usage: content asks to open after the page has settled (in practice this
  // is a user click on the placeholder), by which time the host has attached its relay.
  setTimeout(function () {
    window.exeMediaBridge.openMedia({ provider: 'youtube', videoId: '${VIDEO_ID}', timeoutMs: 3000, readyTimeoutMs: 3000 })
      .then(function () { document.title = 'OPENED'; })
      .catch(function (e) { document.title = 'FALLBACK:' + e.message; });
  }, 300);
</script></body></html>`;

// Parent page: real policy + relay. ?attach=1 wires the relay to the child with a stub
// provider factory; without it, no relay answers (degradation path).
function parentHtml(attach: boolean): string {
    return `<!doctype html><html><head>
<script src="/_exebridge/exe_media_policy.js"></script>
<script src="/_exebridge/exe-media-host.js"></script>
</head><body>
<iframe id="child" sandbox="allow-scripts allow-popups allow-forms" src="/_exebridge/child.html" width="400" height="300"></iframe>
<script>
  window.__factoryVideoId = null;
  function stubFactory(container, videoId, callbacks) {
    window.__factoryVideoId = videoId;          // proves open round-trip + URL reconstruction
    setTimeout(function () { callbacks.onReady(100); }, 10);
    return { play(){}, pause(){}, seek(){}, getCurrentTime(){ return 5; }, getDuration(){ return 100; }, destroy(){} };
  }
  ${
      attach
          ? // Attach the relay immediately so it is already listening when the child's
            // hello arrives (the relay reads iframe.contentWindow lazily per message).
            `window.exeMediaHost.attach(document.getElementById('child'), { youtubeFactory: stubFactory });`
          : `/* no relay attached → child must degrade gracefully */`
  }
</script></body></html>`;
}

async function mountHarness(page: import('@playwright/test').Page, attach: boolean) {
    const js: Record<string, string> = {
        'exe_media_policy.js': POLICY_JS,
        'exe_media_bridge.js': BRIDGE_JS,
        'exe-media-host.js': HOST_JS,
    };
    await page.route('**/_exebridge/**', async route => {
        const url = new URL(route.request().url());
        const name = url.pathname.split('/').pop() || '';
        if (name === 'parent.html') {
            return route.fulfill({ contentType: 'text/html', body: parentHtml(attach) });
        }
        if (name === 'child.html') {
            return route.fulfill({ contentType: 'text/html', body: CHILD_HTML });
        }
        if (js[name]) {
            return route.fulfill({ contentType: 'application/javascript', body: js[name] });
        }
        return route.fulfill({ status: 404, body: 'not found' });
    });
    await page.goto('/_exebridge/parent.html');
}

test.describe('external-media bridge (opaque iframe, real browser)', () => {
    test('handshakes from an opaque sandboxed iframe and opens the player in the parent', async ({ page }) => {
        await mountHarness(page, true);

        // The child iframe is genuinely opaque-origin.
        const child = page.frames().find(f => f.url().includes('/_exebridge/child.html'));
        expect(child).toBeTruthy();
        await expect.poll(() => child!.evaluate(() => (window as unknown as { origin: string }).origin)).toBe('null');

        // The full round-trip ran: hello → welcome (+port) → open → parent rebuilds the URL
        // from the bare id and creates the player with exactly that id.
        await expect
            .poll(() => page.evaluate(() => (window as unknown as { __factoryVideoId: string }).__factoryVideoId), {
                timeout: 8000,
            })
            .toBe(VIDEO_ID);

        // And the child's openMedia resolved once the parent reported ready.
        await expect.poll(() => child!.title(), { timeout: 8000 }).toBe('OPENED');
    });

    test('degrades gracefully when no parent relay is present (no blank, no hang)', async ({ page }) => {
        await mountHarness(page, false);

        const child = page.frames().find(f => f.url().includes('/_exebridge/child.html'));
        expect(child).toBeTruthy();

        // With no relay answering, the watchdog fires and openMedia rejects with no-bridge
        // so the content can show its fallback — it never hangs or silently blanks.
        await expect.poll(() => child!.title(), { timeout: 10000 }).toContain('FALLBACK:no-bridge');
    });
});
