import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';

/**
 * The browser facts the static/PWA opaque preview transport rests on (ADR-2199-04), measured
 * rather than assumed, in every engine the suite runs:
 *
 * 1. A frame sandboxed without `allow-same-origin` is never Service-Worker controlled
 *    (Phase 0 spike S3). Here the origin server 404s a URL only the Service Worker answers;
 *    whichever body renders says who served it.
 * 2. A sandboxed `srcdoc` document gets an opaque origin: it cannot reach the parent, the
 *    editor's cookies, storage or IndexedDB, cannot fetch the editor host, and cannot use a
 *    `blob:` URL the editor minted. Its relative URLs still resolve against the editor's
 *    base URL, so an inlined classic script or stylesheet works while nothing credentialed does.
 * 3. The same document with `allow-same-origin`, or without a sandbox, has every one of those
 *    powers — the control that gives the first two measurements their meaning.
 *
 * A tiny local server stands in for the editor origin; nothing here depends on eXe itself.
 */

const SW = `
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname === '/sw-only.html') {
    e.respondWith(new Response('<!doctype html><body id="sw">SW</body>', { headers: { 'Content-Type': 'text/html' } }));
  }
});
`;

/**
 * Runs inside each probe frame and reports what it could reach. Every probe is wrapped so a
 * SecurityError is a result, not a crash, and the nested `</script>` is escaped because the
 * whole thing is itself an inline script.
 */
const PROBE = `
(async () => {
  const r = {};
  const attempt = (name, fn) => { try { r[name] = fn(); } catch (e) { r[name] = 'THROWS:' + e.name; } };
  attempt('origin', () => window.origin);
  attempt('baseURI', () => document.baseURI);
  attempt('parentDocument', () => (parent.document ? 'ACCESSIBLE' : 'no'));
  attempt('topLocation', () => top.location.href);
  attempt('cookie', () => document.cookie);
  attempt('localStorage', () => (localStorage.getItem('spike'), 'ACCESSIBLE'));
  attempt('indexedDB', () => (indexedDB.open('spike'), 'ACCESSIBLE'));
  attempt('swController', () => (navigator.serviceWorker && navigator.serviceWorker.controller ? 'CONTROLLED' : 'null'));
  try { const t = await (await fetch('/sw-only.html')).text(); r.fetchSwOnly = t.includes('id="sw"') ? 'SW' : 'ORIGIN'; } catch (e) { r.fetchSwOnly = 'THROWS:' + e.name; }
  try { const res = await fetch(window.__parentBlob); r.fetchParentBlob = 'OK:' + res.status; } catch (e) { r.fetchParentBlob = 'THROWS:' + e.name; }
  r.imgParentBlob = await new Promise(done => {
    const i = new Image();
    i.onload = () => done('LOADED');
    i.onerror = () => done('ERROR');
    i.src = window.__parentBlobImage;
  });
  r.classicScript = window.__classic ? 'RAN' : 'blocked';
  r.stylesheet = getComputedStyle(document.body).marginTop === '7px' ? 'APPLIED' : 'not-applied';
  r.nested = await new Promise(done => {
    const f = document.createElement('iframe');
    f.srcdoc = '<script>try{parent.parent.document;parent.postMessage({nested:"ACCESSIBLE"},"*")}catch(e){parent.postMessage({nested:"THROWS:"+e.name},"*")}<\\/script>';
    window.addEventListener('message', ev => { if (ev.data && ev.data.nested) done(ev.data.nested); }, { once: true });
    document.body.appendChild(f);
  });
  parent.postMessage({ probe: window.__probeName, result: r }, '*');
})();
`;

function probeDocument(name: string): string {
    return (
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<link rel="stylesheet" href="/style.css">' +
        `<script>window.__probeName=${JSON.stringify(name)};window.__parentBlob="__BLOB__";window.__parentBlobImage="__IMG__";</script>` +
        '<script src="/classic.js"></script>' +
        `</head><body>probe<script>${PROBE}</script></body></html>`
    );
}

const PARENT = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
window.results = {};
window.addEventListener('message', ev => { if (ev.data && ev.data.probe) window.results[ev.data.probe] = ev.data.result; });
document.cookie = 'spike=secret; path=/';
localStorage.setItem('spike', 'secret');
navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(async () => {
  for (let i = 0; i < 100; i++) {
    const t = await (await fetch('/sw-only.html')).text();
    if (t.includes('id="sw"')) break;
    await new Promise(r => setTimeout(r, 100));
  }
  window.swReady = true;
});
</script></body></html>`;

const OPAQUE_SANDBOX =
    'allow-scripts allow-forms allow-popups allow-downloads allow-presentation allow-popups-to-escape-sandbox';

let server: Server;
let base: string;

test.beforeAll(async () => {
    server = createServer((req, res) => {
        const path = (req.url ?? '').split('?')[0];
        const send = (type: string, body: string, status = 200) =>
            res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
        if (path === '/') return send('text/html', PARENT);
        if (path === '/sw.js') return send('application/javascript', SW);
        if (path === '/classic.js') return send('application/javascript', 'window.__classic = true;');
        if (path === '/style.css') return send('text/css', 'body{margin-top:7px}');
        if (path === '/sw-only.html')
            return send('text/html', '<!doctype html><body id="origin">ORIGIN 404</body>', 404);
        send('text/plain', 'not found', 404);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
});

test.describe('opaque srcdoc preview transport — browser facts', () => {
    test('a sandboxed frame without allow-same-origin is not Service-Worker controlled (S3)', async ({ page }) => {
        await page.goto(`${base}/`);
        await page.waitForFunction(() => (window as any).swReady === true);

        await page.evaluate(() => {
            for (const [name, sandbox] of [
                ['s3-opaque', 'allow-scripts'],
                ['s3-same-origin', 'allow-scripts allow-same-origin'],
            ]) {
                const frame = document.createElement('iframe');
                frame.setAttribute('sandbox', sandbox);
                frame.setAttribute('data-name', name);
                frame.src = '/sw-only.html';
                document.body.appendChild(frame);
            }
        });

        // The same-origin frame is served by the worker; the opaque one reaches the origin
        // server and gets its 404 body — the worker never saw the request.
        await expect(page.frameLocator('iframe[data-name="s3-same-origin"]').locator('body')).toHaveId('sw');
        await expect(page.frameLocator('iframe[data-name="s3-opaque"]').locator('body')).toHaveId('origin');
    });

    test('a sandboxed srcdoc document is opaque; the same document with allow-same-origin is not', async ({
        page,
        browserName,
    }) => {
        await page.goto(`${base}/`);
        await page.waitForFunction(() => (window as any).swReady === true);

        const results = await page.evaluate(
            async ({ opaqueDoc, controlDoc, sandbox }) => {
                const parentBlob = URL.createObjectURL(new Blob(['hello'], { type: 'text/plain' }));
                const png = Uint8Array.from(
                    atob(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                    ),
                    c => c.charCodeAt(0),
                );
                const parentBlobImage = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
                const fill = (doc: string) => doc.replace('__BLOB__', parentBlob).replace('__IMG__', parentBlobImage);

                const opaque = document.createElement('iframe');
                opaque.setAttribute('sandbox', sandbox);
                opaque.srcdoc = fill(opaqueDoc);
                document.body.appendChild(opaque);

                const control = document.createElement('iframe');
                control.setAttribute('sandbox', 'allow-scripts allow-same-origin');
                control.srcdoc = fill(controlDoc);
                document.body.appendChild(control);

                const w = window as any;
                for (let i = 0; i < 300 && !(w.results.opaque && w.results.control); i++) {
                    await new Promise(r => setTimeout(r, 100));
                }
                return w.results as Record<string, Record<string, string>>;
            },
            { opaqueDoc: probeDocument('opaque'), controlDoc: probeDocument('control'), sandbox: OPAQUE_SANDBOX },
        );

        const opaque = results.opaque;
        const control = results.control;
        expect(opaque, 'the opaque probe reported').toBeTruthy();
        expect(control, 'the control probe reported').toBeTruthy();

        // The control proves the probes can see everything when the sandbox allows it.
        expect(control.origin).toBe(new URL(base).origin);
        expect(control.parentDocument).toBe('ACCESSIBLE');
        expect(control.cookie).toContain('spike=secret');
        expect(control.localStorage).toBe('ACCESSIBLE');
        expect(control.fetchParentBlob).toBe('OK:200');
        expect(control.imgParentBlob).toBe('LOADED');
        expect(control.nested).toBe('ACCESSIBLE');

        // The opaque document: a browser-enforced boundary, not a filter.
        expect(opaque.origin).toBe('null');
        expect(opaque.parentDocument).toMatch(/^THROWS:/);
        expect(opaque.topLocation).toMatch(/^THROWS:/);
        // Chromium and Firefox throw on cookie access from an opaque origin; WebKit answers
        // with an empty string. Either way the editor's cookie is not readable.
        expect(opaque.cookie).not.toContain('secret');
        expect(opaque.localStorage).toMatch(/^THROWS:/);
        expect(opaque.indexedDB).toMatch(/^THROWS:/);
        // Not Service-Worker controlled, and the editor host cannot even be fetched.
        expect(opaque.swController).not.toBe('CONTROLLED');
        expect(opaque.fetchSwOnly).toMatch(/^THROWS:/);
        // A blob: URL minted by the editor is unreachable (this is why PDF embeds become links).
        expect(opaque.fetchParentBlob).toMatch(/^THROWS:/);
        expect(opaque.imgParentBlob).toBe('ERROR');
        // Nested frames inherit the sandbox: no escape through a child.
        expect(opaque.nested).toMatch(/^THROWS:/);
        // Relative URLs resolve against the editor's base URL, so inlined/relative classic
        // resources still work — the document is isolated, not broken.
        expect(opaque.baseURI).toBe(`${base}/`);
        expect(opaque.classicScript).toBe('RAN');
        expect(opaque.stylesheet).toBe('APPLIED');
        test.info().annotations.push({ type: 'engine', description: `${browserName}: ${JSON.stringify(opaque)}` });
    });
});
