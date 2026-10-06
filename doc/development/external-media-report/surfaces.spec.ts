import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { waitForPromotedPlayers } from './lib/harness.mjs';
import { join } from 'node:path';

/**
 * The same package reaches a reader through more than one surface, and they are NOT the
 * same code.
 *
 * WordPress renders the Gutenberg block through `render_block()`, the shortcode through a
 * separate handler with its own attribute defaults, and the admin screen through the
 * block's edit component. Omeka has a public item page and an admin media page that
 * injects the viewer from a different hook. A regression can live in exactly one of them
 * and be invisible everywhere else — which is why the page walk, run on one surface per
 * platform, is not enough on its own.
 *
 * Each surface is asked the same question: does the canonical host promote a real player
 * here, without leaking a provider SDK onto the trusted page?
 */
const OUT = join(__dirname, 'surfaces');
mkdirSync(OUT, { recursive: true });

interface Surface {
    id: string;
    platform: string;
    /** What is being exercised, in the report's words. */
    name: string;
    url: string;
    /** The content iframe. */
    frame: string;
    /** For surfaces that nest the content frame inside an editor canvas. */
    outerFrame?: string;
    login?: 'wordpress' | 'omeka';
    /**
     * What this surface is SUPPOSED to do with an external video.
     *
     * `promoted` — the content runs opaque, so the child reports geometry and the host
     * overlays a real player on the trusted page.
     * `inline` — the content runs same-origin, so the provider's own iframe renders inside
     * it and there is nothing to promote. Asserting `promoted` here would demand a
     * behaviour the design does not want; asserting nothing would miss a black box.
     */
    expect: 'promoted' | 'inline';
    /** Stated in the report so a reader knows what this surface is for. */
    note: string;
}

const SURFACES: Surface[] = [
    {
        id: 'wordpress-block',
        expect: 'promoted',
        platform: 'WordPress',
        name: 'Bloque Gutenberg, ancho completo',
        url: 'http://localhost:8888/2026/07/28/evil-elpx/',
        frame: 'iframe.exelearning-iframe',
        note: 'render_block() en la página pública, con align=full',
    },
    {
        id: 'wordpress-shortcode',
        expect: 'promoted',
        platform: 'WordPress',
        name: 'Shortcode [exelearning]',
        url: 'http://localhost:8888/2026/07/28/evil-elpx-shortcode/',
        frame: 'iframe.exelearning-iframe',
        note: 'manejador de shortcode, con sus propios atributos por defecto',
    },
    {
        id: 'wordpress-admin',
        expect: 'promoted',
        platform: 'WordPress',
        name: 'Editor de bloques (backend)',
        url: 'http://localhost:8888/wp-admin/post.php?post=49&action=edit',
        // Measured, not assumed: this WordPress does NOT iframe the editor canvas, so the
        // preview sits at top level. The edit component's iframe carries no class of its
        // own either, so the capability URL it loads is the stable handle.
        frame: 'iframe[src*="/exelearning/v1/content/"]',
        login: 'wordpress',
        note: 'componente edit del bloque, con la misma frontera y la misma promoción que el front',
    },
    {
        id: 'omeka-public',
        expect: 'promoted',
        platform: 'Omeka S',
        name: 'Página pública del ítem',
        url: 'http://localhost:8080/s/exelearning-demo/item/13',
        frame: 'iframe[data-exe-content-path]',
        note: 'ruta del front, la que ve el visitante',
    },
    {
        id: 'omeka-admin',
        expect: 'promoted',
        platform: 'Omeka S',
        name: 'Ficha de media en administración',
        url: 'http://localhost:8080/admin/media/14',
        frame: 'iframe[data-exe-content-path]',
        login: 'omeka',
        note: 'ruta de admin, la que ofrece «Edit in eXeLearning»',
    },
];

/** The page of the probe that carries a promotable video. */
const VIDEO_PAGE = '21-video-de-youtube.html';

async function logIn(page: Page, kind: NonNullable<Surface['login']>): Promise<void> {
    if (kind === 'wordpress') {
        await page.goto('http://localhost:8888/wp-login.php', { waitUntil: 'domcontentloaded' });
        await page.locator('#user_login').fill('admin');
        await page.locator('#user_pass').fill('password');
        await page.locator('#wp-submit').click();
        await page.waitForURL(/wp-admin/, { timeout: 60_000 });
        return;
    }
    await page.goto('http://localhost:8080/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('PLEASE_CHANGEME');
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForURL(/admin|s\//, { timeout: 60_000 });
}

for (const surface of SURFACES) {
    const outcome = surface.expect === 'promoted' ? 'promotes a real player' : 'renders the provider inline, with no orphan placeholder';
    test(`${surface.platform} — ${surface.name} ${outcome}`, async ({ page }) => {
        test.setTimeout(180_000);

        if (surface.login) await logIn(page, surface.login);
        await page.goto(surface.url, { waitUntil: 'domcontentloaded' });

        const host: Page | FrameLocator = surface.outerFrame ? page.frameLocator(surface.outerFrame) : page;
        await host.locator(surface.frame).first().waitFor({ state: 'attached', timeout: 90_000 });
        await host.locator(surface.frame).first().scrollIntoViewIfNeeded({ timeout: 15_000 }).catch(() => {});

        const content = host.frameLocator(surface.frame);
        await content.locator('body').waitFor({ timeout: 60_000 });

        // Navigate to the video page. The link may carry a query suffix, so match on a
        // substring rather than the end of the href, and fall back to a DOM click for
        // themes that collapse their navigation at this width.
        const link = content.locator(`a[href*="${VIDEO_PAGE}"]`).first();
        await link.click({ timeout: 8_000 }).catch(async () => {
            await link.evaluate((el: Element) => (el as HTMLAnchorElement).click());
        });
        await content.locator('[data-exe-embed-id]').first().waitFor({ timeout: 30_000 }).catch(() => {});
        await content
            .locator('[data-exe-embed-id]')
            .first()
            .scrollIntoViewIfNeeded({ timeout: 5_000 })
            .catch(() => {});

        /**
         * Read from the TRUSTED page, never from inside the content frame: these are the
         * questions the content cannot be trusted to answer about itself. The overlay lives
         * on the top-level document even when the content frame is nested in an editor
         * canvas, so this is `page`, not `host`.
         */
        const seen = async () =>
            page.evaluate(() => {
                const players = Array.from(document.querySelectorAll('.exe-embed-overlay iframe'));
                return {
                    players: players.map(f => (f as HTMLIFrameElement).src),
                    sandboxes: players.map(f => (f as HTMLIFrameElement).getAttribute('sandbox')),
                    canonicalHost: typeof (window as never as Record<string, unknown>).exeExternalMediaHost,
                    youtubeSdk: typeof (window as never as Record<string, unknown>).YT,
                    vimeoSdk: typeof (window as never as Record<string, unknown>).Vimeo,
                };
            });

        if (surface.expect === 'promoted') {
            await expect
                .poll(async () => (await seen()).players.length, { timeout: 45_000 })
                .toBeGreaterThan(0);
        } else {
            /**
             * The inline case, asserted just as hard. "No promotion" is also what a
             * half-migrated surface looks like — a child that replaced the embed with a
             * placeholder no host will ever fill, i.e. a permanent black box. So the check
             * is that the provider's own frame IS there, inside the content.
             */
            await expect
                .poll(
                    async () =>
                        content
                            .locator('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"]')
                            .count(),
                    { timeout: 45_000 },
                )
                .toBeGreaterThan(0);
            expect(
                await content.locator('[data-exe-embed-id]').count(),
                'a placeholder was left with no host to fill it',
            ).toBe(0);
        }

        await waitForPromotedPlayers(page);

        const contentSandbox = await host
            .locator(surface.frame)
            .first()
            .getAttribute('sandbox')
            .catch(() => null);

        const observed = { ...(await seen()), contentSandbox, contentOpaque: !(contentSandbox ?? '').includes('allow-same-origin') };
        await page.screenshot({ path: join(OUT, `${surface.id}.png`) });
        writeFileSync(
            join(OUT, `${surface.id}.json`),
            JSON.stringify({ ...surface, ...observed }, null, 2),
        );

        // The canonical bundle is running here, not just somewhere on the platform.
        expect(observed.canonicalHost, `${surface.id}: the canonical host is not running`).toBe('object');
        // No provider SDK on the trusted page — the claim the whole design rests on.
        expect(observed.youtubeSdk, `${surface.id}: the YouTube SDK leaked`).toBe('undefined');
        expect(observed.vimeoSdk, `${surface.id}: the Vimeo SDK leaked`).toBe('undefined');
        // A promoted player is third-party content on a trusted page: it stays sandboxed,
        // and never with permission to navigate the top-level window.
        expect(observed.sandboxes.every(s => s?.includes('allow-scripts'))).toBe(true);
        expect(observed.sandboxes.some(s => s?.includes('allow-top-navigation'))).toBe(false);
        // And the surface is the kind of surface it claims to be.
        // Opacity is asserted for EVERY surface, independently of whether this one has its
        // embed promotion wired yet. It is the boundary, and it is not negotiable.
        expect(observed.contentOpaque, `${surface.id}: the content is not running opaque`).toBe(true);
    });
}
