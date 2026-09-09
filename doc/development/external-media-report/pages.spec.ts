import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { moodleSession, waitForPromotedPlayers } from './lib/harness.mjs';
import { join } from 'node:path';

/**
 * Walk the adversarial package page by page inside every live host, capturing what each
 * page actually does.
 *
 * `evil.elpx` is the probe from the LMS untrusted-content paper: pages that each try a
 * different way out of the content boundary — cross-origin video, remote PDF, a generic
 * iframe, and a page per platform attempting privilege escalation. All four platforms now
 * serve THE SAME package, imported through each product's own ingestion path, so the
 * comparison between them is a comparison of hosts rather than of content.
 *
 * A screenshot per page is the readable half; the per-page runtime probe next to it is the
 * half that can be checked, because a page that looks fine and quietly reached the host
 * origin looks exactly like one that did not.
 */
const OUT = join(__dirname, 'pages');
mkdirSync(OUT, { recursive: true });

interface Platform {
    id: string;
    name: string;
    url: string;
    /** The content iframe, which differs per host. */
    frame: string;
    /** How the package got there, so the report can state provenance per platform. */
    ingestion: string;
    login?: 'moodle' | 'nextcloud';
    /** The content iframe defers loading until it is scrolled into view. */
    lazy?: boolean;
    /**
     * This host attaches the MEDIA half, so a bridged video must work here.
     *
     * Separate from the embed half and adopted separately (`host-entry.ts`), so it is
     * declared per platform rather than assumed. Where it is false the handshake is still
     * measured and written to the report — an unasserted gap that is visible, rather than
     * an absence nobody notices.
     */
    mediaHost?: boolean;
}

const MOODLE_LOGIN = {
    url: 'http://localhost/login/index.php',
    user: 'teacher_demo',
    pass: 'Demo!2026',
};

const NEXTCLOUD_LOGIN = { url: 'http://localhost:8081/login', user: 'admin', pass: 'admin' };

/**
 * Every entry serves evil.elpx. Each was imported through the product's own path — Moodle's
 * activity upload, WordPress's `wp_handle_upload` filter, Omeka's media API with the
 * `upload` ingester, and Procomún's `import:legacy-procomun` CLI — rather than by writing
 * rows or files behind the plugin's back, so what the walk exercises is the real flow.
 */
const PLATFORMS: Platform[] = [
    {
        id: 'moodle',
        name: 'Moodle',
        url: 'http://localhost/mod/exelearning/view.php?id=20',
        frame: '#exelearningobject',
        ingestion: 'subida de actividad del propio módulo',
        login: 'moodle',
        mediaHost: true,
    },
    {
        id: 'wordpress',
        name: 'WordPress',
        url: 'http://localhost:8888/?p=49',
        frame: 'iframe.exelearning-iframe',
        ingestion: 'filtro wp_handle_upload del plugin (extracción + hash propios)',
        mediaHost: true,
    },
    {
        id: 'omeka',
        name: 'Omeka S',
        url: 'http://localhost:8080/s/exelearning-demo/item/13',
        frame: 'iframe[data-exe-content-path]',
        ingestion: 'API de media con el ingester «upload»',
    },
    {
        id: 'procomun',
        name: 'Procomún',
        // Addressed by SLUG in the QUERY STRING: the SPA route is a bare `/recurso`, and
        // the island reads `?slug=` — a path segment renders the shell and nothing else.
        url: 'http://localhost:5173/recurso?slug=evil-elpx-adversarial-probe-98b06c02',
        frame: 'iframe.elpx-preview-iframe',
        ingestion: 'CLI import:legacy-procomun (par .json + .elpx)',
        mediaHost: true,
        // The preview iframe is `loading="lazy"`, so it never fetches while it sits below
        // the fold — the walk has to bring it into view before waiting on its document.
        lazy: true,
    },
    {
        id: 'nextcloud',
        name: 'Nextcloud',
        // Runs on 8081: 8080 is Omeka's in this set of environments.
        url: 'http://localhost:8081/apps/exelearning/view?path=/evil.elpx',
        frame: 'iframe.exelearning-viewer__iframe',
        ingestion: 'subida WebDAV a Ficheros (remote.php/dav)',
        login: 'nextcloud',
        mediaHost: true,
    },
];


/**
 * What the page did, from the HOST's point of view. Taken outside the content frame on
 * purpose: these are the questions the content cannot be trusted to answer about itself.
 */
async function observe(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const overlays = Array.from(document.querySelectorAll('.exe-embed-overlay iframe'));
        return {
            promotedPlayers: overlays.map(f => (f as HTMLIFrameElement).src),
            playerSandboxes: overlays.map(f => (f as HTMLIFrameElement).getAttribute('sandbox')),
            // The provider hosts actually reached, which is what "the video is there" means
            // in a design where the host — never the content — mounts the player.
            playerHosts: Array.from(
                new Set(
                    overlays
                        .map(f => {
                            try {
                                return new URL((f as HTMLIFrameElement).src).host;
                            } catch {
                                return '';
                            }
                        })
                        .filter(Boolean),
                ),
            ),
            mediaDialogs: document.querySelectorAll('dialog.exe-media-modal').length,
            // The escalation the probe is looking for: any sign the content reached the
            // host's own document, or pulled a provider SDK onto it.
            sdkLeaked: typeof (window as never as Record<string, unknown>).YT !== 'undefined',
            vimeoSdkLeaked: typeof (window as never as Record<string, unknown>).Vimeo !== 'undefined',
        };
    });
}

/**
 * The iDevices the host SERVED, against the ones that actually MOUNTED.
 *
 * This is the check that would have caught the interactive-video failure on its own, and
 * the reason it is here. That iDevice loaded YouTube's iframe API from inside the package;
 * the content CSP blocked it — correctly — and the runtime then polled forever for a global
 * that was never going to arrive. The node never mounted, the learner saw a blank panel
 * after pressing start, and this walk recorded a page with zero promoted players, which is
 * indistinguishable from a page that simply has no video. Silent, and green.
 *
 * The served markup is fetched separately rather than read from the DOM, because the DOM is
 * the thing under suspicion: a node that failed to mount is absent from it, and nothing is
 * left behind to say it was ever supposed to be there.
 *
 * Teacher-only content is safe to count: exports HIDE it with a class on the root, they do
 * not remove it (`exe_export.js`), so it is in the DOM either way.
 */
const IDEVICE_CLASS_ATTR = /class="([^"]*\bidevice_node\b[^"]*)"/g;

/** Everything on an iDevice's class list that is not its type. */
const NOT_A_TYPE = new Set(['idevice_node', 'box', 'teacher-only', 'em_iDevice']);

function typesOf(classLists: string[]): string[] {
    return Array.from(
        new Set(classLists.flatMap(list => list.split(/\s+/).filter(name => name && !NOT_A_TYPE.has(name)))),
    ).sort();
}

async function servedIdevices(page: import('@playwright/test').Page, url: string) {
    // Through the page's own request context, so the host's session cookie comes with it.
    const response = await page.request.get(url).catch(() => null);
    if (!response?.ok()) return null;
    const html = await response.text();
    const classLists = Array.from(html.matchAll(IDEVICE_CLASS_ATTR)).map(match => match[1] ?? '');
    return { count: classLists.length, types: typesOf(classLists) };
}

/**
 * Whether a host answers the media handshake — asked from inside the content, which is the
 * only place the answer means anything.
 *
 * The embed half and the media half are attached separately, and a host can have one
 * without the other. Moodle had exactly that: `exeMediaHost` was published, the page called
 * `attach()`, and it still never ran, because the lookup for the content iframe sat in an
 * inline script emitted BEFORE that iframe existed. `if (f && ...)` swallowed the null.
 * Embeds kept being promoted, so every existing assertion here stayed green while every
 * bridged video in the package was dead.
 *
 * A fresh hello long after the page has settled separates the two failures that look
 * identical from outside: no host attached at all, versus a child that asked too early.
 */
async function mediaHostAnswers(frame: import('@playwright/test').FrameLocator): Promise<boolean> {
    return frame
        .locator('body')
        .evaluate(
            () =>
                new Promise<boolean>(resolve => {
                    const helloId = `harness-${Date.now()}`;
                    addEventListener('message', event => {
                        const message = event as MessageEvent;
                        if (message.source !== parent) return;
                        const data = message.data as Record<string, unknown> | null;
                        if (data?.type !== 'exe-media' || data?.action !== 'welcome') return;
                        if (data?.helloId !== helloId) return;
                        // A welcome with no transferred port is not a session.
                        resolve(Boolean(message.ports?.[0]));
                    });
                    parent.postMessage({ type: 'exe-media', v: 1, action: 'hello', helloId }, '*');
                    setTimeout(() => resolve(false), 6000);
                }),
        )
        .catch(() => false);
}

async function mountedIdevices(frame: import('@playwright/test').FrameLocator) {
    const classLists = await frame
        .locator('.idevice_node')
        .evaluateAll(nodes => nodes.map(node => (node as HTMLElement).className));
    return { count: classLists.length, types: typesOf(classLists) };
}

/**
 * Whether what the package REFERENCES actually renders.
 *
 * The rest of this walk proves videos. Nothing in it asserted that an image loaded or that
 * a PDF frame got a box, so "the picture is missing" and "there was never a picture" read
 * the same — which is how a CSP that drops remote images, or a sandbox that breaks the PDF
 * viewer, stays invisible in a report full of screenshots.
 *
 * Read from inside the content frame, because these are facts about the content's own DOM
 * rather than claims the content is making about the host.
 *
 * `naturalWidth` is the honest test for an image: it is non-zero only once the bytes have
 * decoded, so a blocked or 404'd `<img>` is distinguishable from a slow one via `complete`.
 * For a cross-origin PDF the parent cannot see whether the viewer painted, so this records
 * the frame's box — zero height means it was never laid out, which is the failure the
 * report can honestly claim.
 */
async function renderedMedia(frame: import('@playwright/test').FrameLocator) {
    return frame.locator('body').evaluate(() => {
        const inContent = (el: Element) => !!el.closest('.idevice_node, article, main');

        const images = Array.from(document.querySelectorAll('img'))
            .filter(inContent)
            .map(img => ({
                src: img.currentSrc || img.src,
                remote: /^https?:\/\//i.test(img.src) && !img.src.startsWith(location.origin),
                loaded: img.naturalWidth > 0,
                settled: img.complete,
            }));

        const pdfFrames = Array.from(document.querySelectorAll('iframe, object, embed'))
            .filter(el => /\.pdf(\?|#|$)/i.test(el.getAttribute('src') || el.getAttribute('data') || ''))
            .map(el => {
                const box = (el as HTMLElement).getBoundingClientRect();
                const source = el.getAttribute('src') || el.getAttribute('data') || '';
                return {
                    src: source,
                    remote: /^https?:\/\//i.test(source) && !source.startsWith(location.origin),
                    laidOut: box.width > 0 && box.height > 0,
                };
            });

        return { images, pdfFrames };
    });
}

for (const platform of PLATFORMS) {
    test(`walks every page of evil.elpx inside ${platform.name}`, async ({ page }) => {
        test.setTimeout(300_000);

        if (platform.login === 'moodle') {
            const session = moodleSession('/tmp/pages-moodle.jar', MOODLE_LOGIN);
            expect(session, 'no Moodle session could be established').toBeTruthy();
            await page.context().addCookies([
                { name: 'MoodleSession', value: session, domain: 'localhost', path: '/' },
            ]);
        }

        if (platform.login === 'nextcloud') {
            /**
             * Driven through the real form rather than curl. Nextcloud answers a
             * scripted POST with 303 and a `nc_sameSiteCookie*` pair instead of a
             * session — its same-site protection doing its job — so the cookie-injection
             * trick used for Moodle produces a 401 on the very next request.
             */
            await page.goto(NEXTCLOUD_LOGIN.url, { waitUntil: 'domcontentloaded' });
            await page.locator('#user').fill(NEXTCLOUD_LOGIN.user);
            await page.locator('#password').fill(NEXTCLOUD_LOGIN.pass);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForURL(/apps|dashboard|files/, { timeout: 60_000 });
        }

        const startedAt = Date.now();
        await page.goto(platform.url, { waitUntil: 'domcontentloaded' });

        // Omeka and Procomún set the content iframe's `src` from JavaScript after load, so
        // entering the frame before that yields an about:blank document whose body never
        // arrives. Waiting for the element and its attribute is the deterministic version
        // of waiting long enough.
        await page.locator(platform.frame).first().waitFor({ state: 'attached', timeout: 60_000 });
        if (platform.lazy) {
            await page.locator(platform.frame).first().scrollIntoViewIfNeeded({ timeout: 15_000 });
        }
        await page
            .locator(platform.frame)
            .first()
            .evaluate(
                (el: Element) =>
                    new Promise<void>(resolve => {
                        const ready = () => !!(el as HTMLIFrameElement).getAttribute('src');
                        if (ready()) return resolve();
                        const observer = new MutationObserver(() => {
                            if (ready()) {
                                observer.disconnect();
                                resolve();
                            }
                        });
                        observer.observe(el, { attributes: true, attributeFilter: ['src'] });
                    }),
                undefined,
                { timeout: 30_000 },
            )
            .catch(() => {});

        const frame = page.frameLocator(platform.frame);
        await frame.locator('body').waitFor({ timeout: 60_000 });

        /**
         * Wait for the content frame to stop navigating before reading anything out of it.
         *
         * Several hosts set `src` more than once while mounting (a placeholder, then the
         * real capability URL), so the first document that reports a `body` is not always
         * the one that stays. Reading links across that second navigation tears down the
         * execution context mid-call. Two consecutive identical `src` values is the
         * condition that actually distinguishes "settled" from "about to move".
         */
        await expect
            .poll(
                async () => {
                    const first = await page.locator(platform.frame).first().getAttribute('src');
                    await page.waitForTimeout(400);
                    const second = await page.locator(platform.frame).first().getAttribute('src');
                    return first === second && !!second;
                },
                { timeout: 30_000 },
            )
            .toBe(true);
        await frame.locator('body').waitFor({ timeout: 30_000 });

        /**
         * Once per platform, before the walk: a video the host never agreed to drive cannot
         * be diagnosed page by page, and this is what tells the two apart.
         */
        const mediaAnswered = await mediaHostAnswers(frame);
        if (platform.mediaHost) {
            expect(
                mediaAnswered,
                `${platform.name} declares the media half but did not welcome a handshake. ` +
                    'Every bridged video in the package is dead here — check that the host ' +
                    'page really calls attachMedia() on an element that exists by then.',
            ).toBe(true);
        }

        /**
         * The package's own navigation is the source of truth for what pages exist, so a
         * page added to the probe shows up in the report without anyone maintaining a list
         * here.
         *
         * Navigated by FILENAME rather than by the href read on the first page: those hrefs
         * are relative and differ per page ("html/x.html" from the index, "x.html" from a
         * sibling), so a selector built once goes stale on the second click.
         */
        const links = await frame.locator('a[href*=".html"]').evaluateAll(nodes =>
            Array.from(
                new Set(
                    nodes
                        .map(n => (n as HTMLAnchorElement).getAttribute('href') ?? '')
                        // Strip query and fragment BEFORE testing the extension. Nextcloud
                        // rewrites in-package links with `?exe-teacher=1`, so a bare
                        // endsWith('.html') matched exactly one of the twenty and the walk
                        // quietly reported a two-page package.
                        .map(h => (h.split('#')[0] ?? '').split('?')[0] ?? '')
                        .map(h => h.split('/').pop() ?? '')
                        .filter(h => h.endsWith('.html') && h !== 'index.html'),
                ),
            ),
        );

        const results: Record<string, unknown>[] = [];
        /**
         * Set once the theme is known to collapse its navigation in this host's frame.
         * Without it every later page pays the click timeout again before falling back,
         * which showed up as an 8 s "page time" that was entirely this script waiting.
         */
        let navCollapsed = false;
        /** The heading of the page currently shown, used to detect the next one arriving. */
        let shownHeading = ((await frame.locator('h1').first().textContent().catch(() => '')) ?? '').trim();

        // Index first: it is a page of the package like any other, and skipping the landing
        // page would leave the first thing a learner sees uncaptured.
        for (const [index, name] of ['index.html', ...links].entries()) {
            const slug = name.replace(/\.html$/, '');
            const pageStart = Date.now();
            let navigatedBy = 'initial';

            if (index > 0) {
                /**
                 * Bounded per page: one unreachable page must not consume the whole budget
                 * and leave the walk with nothing to show.
                 *
                 * The fallback is a DOM click, for hosts that render the package in a frame
                 * narrow enough that the theme collapses its navigation. Playwright refuses
                 * to click a hidden anchor — correctly — but the walk is here to visit the
                 * pages, not to audit the nav's responsive behaviour. Which path was taken
                 * is recorded rather than smoothed over.
                 */
                const link = frame.locator(`a[href*="${name}"]`).first();
                navigatedBy = navCollapsed ? 'dom-click (collapsed nav)' : 'click';
                try {
                    if (navCollapsed) {
                        await link.evaluate((el: Element) => (el as HTMLAnchorElement).click());
                    } else {
                        await link.click({ timeout: 8_000 });
                    }
                } catch {
                    try {
                        await link.evaluate((el: Element) => (el as HTMLAnchorElement).click());
                        navCollapsed = true;
                        navigatedBy = 'dom-click (collapsed nav)';
                    } catch {
                        results.push({ index: index + 1, slug, unreachable: true });
                        continue;
                    }
                }

                /**
                 * Wait for the NEW page, by the only signal available from outside an opaque
                 * document: its heading changing. The content is cross-origin by design, so
                 * neither its URL nor its readyState can be read from here.
                 *
                 * This replaced a flat 1.2 s sleep. The sleep was not just slow — it WAS the
                 * measurement: every platform came out at 1229-1230 ms, four identical
                 * numbers presented as a comparison between hosts, when all they recorded
                 * was this script waiting.
                 */
                await expect
                    .poll(
                        async () => ((await frame.locator('h1').first().textContent().catch(() => '')) ?? '').trim(),
                        { timeout: 20_000, intervals: [50, 100, 150, 250] },
                    )
                    .not.toBe(shownHeading);
                shownHeading = ((await frame.locator('h1').first().textContent().catch(() => '')) ?? '').trim();
            }

            /**
             * Stop the clock HERE, before any capture work.
             *
             * Everything below — scrolling the content, waiting for the overlay to follow,
             * taking the screenshot — exists to make the figure readable, not to exercise
             * the host. Letting it into `elapsedMs` would quadruple every number and turn a
             * page-timing column into a measurement of this harness's own waits.
             */
            const settledMs = Date.now() - pageStart;

            /**
             * Centre the embed INSIDE the content frame before capturing.
             *
             * Every host renders the package in a fixed-height iframe, so an embed further
             * down the page is clipped by the frame's own viewport no matter how tall the
             * browser window is — enlarging the window alone just shows more chrome around
             * the same cropped video. Scrolling the content is the part that actually puts
             * the player on screen; the host re-reports geometry afterwards and moves its
             * overlay to follow, which is why the wait comes after and not before.
             */
            await frame
                .locator('[data-exe-embed-id]')
                .first()
                .scrollIntoViewIfNeeded({ timeout: 4_000 })
                .catch(() => {});
            await page.waitForTimeout(800);

            const observed = await observe(page);

            // Then bring the overlay into the window, for pages where the frame itself sits
            // below the fold. Order matters: the in-frame scroll above moves the overlay, so
            // doing this first would scroll to where the player used to be.
            if (observed.promotedPlayers.length > 0) {
                await page
                    .locator('.exe-embed-overlay iframe')
                    .first()
                    .scrollIntoViewIfNeeded({ timeout: 5_000 })
                    .catch(() => {});

                /**
                 * Wait for each promoted player to FINISH loading before capturing.
                 *
                 * Providers do not paint at the same speed: YouTube shows its poster almost
                 * at once, Vimeo takes several seconds. A fixed pause tuned to the fast one
                 * photographed the slow one as a black rectangle — which reads in the report
                 * as "the isolation broke the video" when the video was merely still on its
                 * way. `load` fires on a cross-origin iframe, so this is observable from the
                 * trusted page without reading into the frame.
                 */
                await waitForPromotedPlayers(page);
            }

            /**
             * Served vs mounted, per page. The content frame's own URL is the thing to
             * fetch: the walk navigates by clicking inside the frame, so the host page's
             * URL has not moved and the `src` attribute still points at the first page.
             */
            const contentUrl = page.frames().find(f => f.url().includes(name))?.url() ?? null;
            const served = contentUrl ? await servedIdevices(page, contentUrl) : null;
            const mounted = await mountedIdevices(frame);
            const media = await renderedMedia(frame);

            const title = await frame.locator('h1, title').first().textContent().catch(() => null);
            await page.screenshot({
                path: join(OUT, `${platform.id}-${String(index + 1).padStart(2, '0')}-${slug}.png`),
            });

            results.push({
                index: index + 1,
                slug,
                file: name,
                navigatedBy,
                title: (title ?? '').trim().slice(0, 80),
                elapsedMs: settledMs,
                servedIdevices: served?.count ?? null,
                servedIdeviceTypes: served?.types ?? null,
                mountedIdevices: mounted.count,
                mountedIdeviceTypes: mounted.types,
                images: media.images.length,
                localImagesBroken: media.images.filter(i => !i.remote && i.settled && !i.loaded).map(i => i.src),
                remoteImagesBlocked: media.images.filter(i => i.remote && i.settled && !i.loaded).map(i => i.src),
                pdfFrames: media.pdfFrames.length,
                pdfFramesWithoutBox: media.pdfFrames.filter(f => !f.laidOut).map(f => f.src),
                ...observed,
            });

            // The claim the report makes for EVERY page, asserted page by page rather than
            // once at the end: no provider SDK ever reaches the trusted page.
            expect(observed.sdkLeaked, `${slug} leaked the YouTube SDK onto the host page`).toBe(false);
            expect(observed.vimeoSdkLeaked, `${slug} leaked the Vimeo SDK onto the host page`).toBe(false);

            /**
             * And that isolation did not cost the learner an iDevice. Asserted on types
             * rather than on the count, so the message names what went missing instead of
             * reporting a number that has to be chased.
             */
            /**
             * The package's OWN media must render, everywhere, always.
             *
             * Remote media is deliberately excluded from this assertion. Under the strict CSP
             * profile the content gets `img-src 'self' … data: blob:` and a `frame-src`
             * limited to the promoted providers, so a remote image or a remote PDF is blocked
             * BY DESIGN — an `<img>` pointing at an attacker's host is a beacon that leaks the
             * reader's address and the fact they opened the material. Demanding that it load
             * would be demanding the boundary be weakened. It is recorded instead, so the
             * report can say "policy blocked this" where a screenshot only shows a gap.
             *
             * What must never happen is the package's own image failing: that is the host
             * mis-serving content it is responsible for.
             */
            const localBroken = media.images.filter(i => !i.remote && i.settled && !i.loaded);
            expect(
                localBroken.map(i => i.src),
                `${slug}: images shipped INSIDE the package did not render on ${platform.name}`,
            ).toEqual([]);

            // A frame with no box was never laid out. Whether a cross-origin PDF viewer then
            // painted is not observable from here, and this does not pretend otherwise.
            expect(
                media.pdfFrames.filter(f => !f.laidOut).map(f => f.src),
                `${slug}: a PDF frame was served with no box on ${platform.name}`,
            ).toEqual([]);

            if (served && served.count > 0) {
                const missing = served.types.filter(type => !mounted.types.includes(type));
                expect(
                    missing,
                    `${slug}: served by ${platform.name} but never mounted — ${missing.join(', ')}. ` +
                        'An iDevice that fails inside the sandbox looks exactly like a page that ' +
                        'never had one; check the content frame console for a blocked request.',
                ).toEqual([]);
            }
        }

        const players = results.flatMap(r => (r.promotedPlayers as string[]) ?? []);
        writeFileSync(
            join(OUT, `${platform.id}-pages.json`),
            JSON.stringify(
                {
                    platform: platform.name,
                    url: platform.url,
                    package: 'evil.elpx',
                    ingestion: platform.ingestion,
                    // Sum of the per-page settle times. NOT the wall clock, which also
                    // carries this harness's screenshot and scrolling work.
                    totalMs: results.reduce((n, r) => n + ((r.elapsedMs as number) ?? 0), 0),
                    wallClockMs: Date.now() - startedAt,
                    pagesWalked: results.length,
                    playersPromoted: players.length,
                    // Declared vs measured, side by side: a host that never adopted the
                    // media half reads differently from one that adopted it and broke.
                    mediaHostDeclared: Boolean(platform.mediaHost),
                    mediaHostAnswered: mediaAnswered,
                    pages: results,
                },
                null,
                2,
            ),
        );

        expect(results.length, 'nothing was captured').toBeGreaterThan(1);
        // At least one page must have promoted a real player, or the walk proved nothing
        // about the media path — a package where nothing was promoted is indistinguishable
        // from a relay that never ran.
        expect(players.length, `${platform.name} promoted no player anywhere in the package`).toBeGreaterThan(0);
    });
}
