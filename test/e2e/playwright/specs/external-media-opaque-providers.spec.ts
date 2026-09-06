import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';

/**
 * Why promotion exists at all: no provider player survives an opaque origin.
 *
 * The whole external-media design rests on one premise — that a video embedded by untrusted
 * content cannot simply be left to render where it sits, because the content runs sandboxed
 * without `allow-same-origin`. That premise is an empirical claim about third-party players,
 * not something the codebase can prove about itself, and it is the kind of claim that
 * quietly stops being true: a provider ships a player that degrades gracefully, and suddenly
 * a chunk of machinery is buying nothing.
 *
 * So it is measured, for every provider the registry promotes, against a control. Without
 * the control "nothing played" is indistinguishable from "the test never clicked anything".
 *
 * Talks to the real providers. A sandboxed or offline runner has nothing to measure, so the
 * control failing skips the whole file rather than reporting a green it did not earn.
 */
const PROVIDERS: Record<string, string> = {
    youtube: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    vimeo: 'https://player.vimeo.com/video/76979871',
    dailymotion: 'https://www.dailymotion.com/embed/video/x3a9qru',
};

/** No `allow-same-origin`: the boundary every host plugin puts around a package. */
const OPAQUE = 'allow-scripts allow-popups allow-forms';
/** The same page one token wider, purely so the measurement can be trusted. */
const SAME_ORIGIN = 'allow-scripts allow-same-origin allow-popups allow-forms';

const CONTENT = `<!doctype html><meta charset="utf-8"><body style="margin:0">
${Object.entries(PROVIDERS)
    .map(
        ([id, url]) =>
            `<iframe id="${id}" src="${url}" width="420" height="236" allow="autoplay; encrypted-media; fullscreen"></iframe>`,
    )
    .join('')}
</body>`;

const parent = (sandbox: string) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="content" sandbox="${sandbox}" src="./content.html" width="460" height="760"></iframe>
</body>`;

let server: Server;
let base: string;

test.beforeAll(async () => {
    server = createServer((req, res) => {
        const path = (req.url ?? '').split('?')[0];
        const body =
            path === '/content.html'
                ? CONTENT
                : path === '/opaque.html'
                  ? parent(OPAQUE)
                  : path === '/same-origin.html'
                    ? parent(SAME_ORIGIN)
                    : null;
        if (!body) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(body);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
});

/**
 * Whether a player's picture MOVES: click its middle, then compare pixels a few seconds
 * apart. A poster frame cannot produce this, which matters — Vimeo renders its first frame
 * even when it cannot play, and reads as working until you look for motion.
 *
 * @returns the number of differing samples per provider.
 */
async function motion(page: import('@playwright/test').Page, url: string): Promise<Record<string, number>> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const content = page.frameLocator('#content');
    const result: Record<string, number> = {};

    for (const id of Object.keys(PROVIDERS)) {
        const handle = await content
            .locator(`#${id}`)
            .elementHandle()
            .catch(() => null);
        if (!handle) {
            result[id] = 0;
            continue;
        }
        const before = await handle.screenshot();
        await handle.click({ position: { x: 210, y: 118 }, timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(5000);
        const after = await handle.screenshot();

        let changed = 0;
        const length = Math.min(before.length, after.length);
        for (let i = 0; i < length; i += 97) if (before[i] !== after[i]) changed += 1;
        result[id] = changed;
    }
    return result;
}

/** Comfortably above the handful of samples that differ from PNG noise alone. */
const MOVING = 50;

test('no provider player survives an opaque origin, and promotion is what buys them back', async ({ page }) => {
    test.setTimeout(180_000);

    // Control first. If this cannot play, nothing below means anything.
    const control = await motion(page, `${base}/same-origin.html`);
    const playable = Object.values(control).filter(n => n > MOVING).length;
    test.skip(playable === 0, 'no provider played even same-origin — no network access to them here');

    // Every provider that plays with allow-same-origin must FAIL without it. That failure
    // is the entire justification for lifting players onto the trusted page.
    const opaque = await motion(page, `${base}/opaque.html`);

    for (const [id, moved] of Object.entries(control)) {
        if (moved <= MOVING) continue; // unreachable here; nothing to conclude about it
        expect(
            opaque[id],
            `${id} PLAYED inside an opaque iframe (${opaque[id]} samples changed). ` +
                'If that is reproducible, this provider no longer needs promoting and ADR-2199-14 should be revisited.',
        ).toBeLessThanOrEqual(MOVING);
    }
});
