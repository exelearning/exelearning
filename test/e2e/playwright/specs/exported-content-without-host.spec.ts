import { expect, test } from '@playwright/test';
import { mkdtempSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The in-content embed shim travels INSIDE delivered content (Moodle bakes it into
 * the package; the editor preview injects it into every snapshot page). That content
 * is routinely opened where no host relay exists at all: a downloaded package on
 * `file://`, a third-party LMS, an ePub reader, an offline laptop.
 *
 * The shim must stay inert there. It replaces an author's `<iframe>` with a geometry
 * placeholder that only the trusted-side relay can fill, so promoting without a host
 * leaves a permanent black box — strictly worse than an unprotected embed, and
 * invisible to the author who published the package.
 *
 * `file://` is itself an OPAQUE origin in every engine, so "opaque" alone can never
 * be the activation signal; only a host answering the handshake may unlock promotion.
 * These specs run with the network cut, so nothing but the local files resolves.
 */

const SHIM = 'public/app/common/exe_embed_bridge/exe_embed_shim.js';

const PAGE = `<!doctype html><meta charset="utf-8"><title>exported page</title>
<script src="./exe_embed_shim.js"></script>
<body>
<h1>Exported eXeLearning page</h1>
<iframe id="yt" width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="video"></iframe>
</body>`;

let dir: string;

test.beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'exe-exported-nohost-'));
    copyFileSync(join(process.cwd(), SHIM), join(dir, 'exe_embed_shim.js'));
    writeFileSync(join(dir, 'index.html'), PAGE);
    writeFileSync(
        join(dir, 'wrapper.html'),
        `<!doctype html><meta charset="utf-8"><title>third-party host</title>
         <iframe src="./index.html" width="700" height="500"></iframe>`,
    );
});

const CASES = [
    { name: 'opened directly', entry: 'index.html', framed: false },
    // The regression case: framed by a page that speaks no eXe protocol. `file://`
    // makes the origin opaque, which used to be enough to trigger promotion.
    { name: 'framed by a page that speaks no eXe protocol', entry: 'wrapper.html', framed: true },
];

for (const c of CASES) {
    test(`exported content keeps its native embed with no host — ${c.name}`, async ({ page, context }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', e => pageErrors.push(String(e)));

        // Hard offline: only local files resolve, like a downloaded package on a plane.
        await context.route('**/*', route =>
            route.request().url().startsWith('file://') ? route.continue() : route.abort(),
        );

        await page.goto(`file://${join(dir, c.entry)}`, { waitUntil: 'load' });

        const frame = c.framed ? page.frameLocator('iframe[src="./index.html"]') : page;

        // The shim re-announces for ~5.5s before giving up; assert the settled state.
        await page.waitForTimeout(6500);

        await expect(frame.locator('#yt')).toHaveCount(1);
        await expect(frame.locator('#yt')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
        // No orphan placeholder: nothing would ever fill it.
        await expect(frame.locator('[data-exe-embed-id]')).toHaveCount(0);
        expect(pageErrors, 'the shim must not throw where there is no host').toEqual([]);
    });
}
