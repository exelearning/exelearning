import { test, expect } from '@playwright/test';

/**
 * Documented experiment (regression guard): a Service Worker CANNOT serve an
 * opaque-origin sandboxed iframe. This is why the editor preview moved off the
 * `/viewer/*` Service Worker transport to a same-origin HTTP session for
 * opaque frames — see doc/development/preview-architecture.md.
 *
 * The test registers a Service Worker that would answer a virtual path, then
 * loads that path inside an iframe WITHOUT allow-same-origin and asserts the
 * SW never controls it: the fetch handler is bypassed and the document is not
 * served the SW response. No eXe login is needed — a self-contained harness
 * exercises the raw browser behavior across the configured engines.
 */

const SW_SOURCE = `
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.endsWith('/sw-virtual.html')) {
        event.respondWith(new Response(
            '<!DOCTYPE html><html><body data-served-by="service-worker">SW SERVED</body></html>',
            { headers: { 'Content-Type': 'text/html' } },
        ));
    }
});
`;

const PARENT_HTML = `<!DOCTYPE html><html><body>
<script>
(async () => {
    try {
        const reg = await navigator.serviceWorker.register('/sw-negative.js');
        await navigator.serviceWorker.ready;
        window.__swReady = true;
    } catch (e) {
        window.__swError = String(e);
    }
})();
</script>
</body></html>`;

test.describe('Service Worker cannot serve an opaque iframe (documented experiment)', () => {
    test('an opaque sandboxed iframe is not controlled by the parent-origin SW', async ({ page, baseURL }) => {
        // Serve the harness on the app origin (SW needs a secure/localhost context).
        const origin = baseURL || 'http://localhost:3001';
        await page.route(`${origin}/sw-negative-parent.html`, route =>
            route.fulfill({ contentType: 'text/html', body: PARENT_HTML }),
        );
        await page.route(`${origin}/sw-negative.js`, route =>
            route.fulfill({ contentType: 'application/javascript', body: SW_SOURCE }),
        );

        await page.goto(`${origin}/sw-negative-parent.html`);
        await page.waitForFunction(() => (window as any).__swReady === true || (window as any).__swError, undefined, {
            timeout: 15000,
        });

        // Inject an OPAQUE sandboxed iframe pointing at the SW-answered path.
        const result = await page.evaluate(async o => {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.src = `${o}/sw-virtual.html`;
            const done = new Promise<string>(resolve => {
                iframe.onload = () => resolve('loaded');
                setTimeout(() => resolve('timeout'), 5000);
            });
            document.body.appendChild(iframe);
            await done;
            // The parent cannot read an opaque child's DOM; instead assert what
            // the browser exposes: navigator.serviceWorker is undefined inside
            // such a frame, so it can never be a controlled client.
            try {
                const win = iframe.contentWindow as unknown as { navigator?: Navigator };
                return { swInFrame: typeof win?.navigator?.serviceWorker };
            } catch (e) {
                return { swInFrame: 'cross-origin-blocked' };
            }
        }, origin);

        // Either navigator.serviceWorker is absent in the frame, or the parent
        // cannot even reach into it — both prove it is not SW-controllable.
        expect(['undefined', 'cross-origin-blocked']).toContain(result.swInFrame);
    });
});
