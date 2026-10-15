import { test, expect } from '@playwright/test';
import { moodleSession } from './lib/harness.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Capture each live plugin serving eXeLearning content, and record what the page actually
 * loaded — not what it was supposed to.
 *
 * The screenshot is the human-readable half; the runtime probe next to it is the half that
 * can be checked. A picture of a page proves it rendered, not that it rendered from the
 * canonical bundle, so both go in the report.
 */
/** Beside this file, so the evidence travels with the harness that produced it. */
const OUT = join(__dirname, 'shots');
mkdirSync(OUT, { recursive: true });

interface Target {
    id: string;
    name: string;
    url: string;
    login?: { url: string; user: string; pass: string };
    /** The plugin's embedded eXeLearning editor, when it exposes one. */
    editorUrl?: string;
}

/**
 * Timings, so the report can carry a performance comparison rather than an impression.
 *
 * Measured from the browser's own Navigation and Resource timings plus wall-clock marks
 * around the things this migration actually changed: how long until the bundle publishes
 * its globals, and how big it is on the wire. A single run is a data point and not a
 * benchmark — the report says so — but a regression of the kind that matters here (an
 * extra round trip, a bundle that doubled) is visible even in one.
 */
async function measure(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const bundle = resources.filter(r => r.name.includes('exe-external-media'));
        const round = (n: number | undefined) => (typeof n === 'number' ? Math.round(n) : null);
        return {
            domContentLoadedMs: round(nav?.domContentLoadedEventEnd),
            loadEventMs: round(nav?.loadEventEnd),
            transferredKb: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
            requests: resources.length,
            bundleRequests: bundle.map(r => ({
                name: r.name.split('/').pop(),
                durationMs: round(r.duration),
                transferBytes: r.transferSize || 0,
            })),
        };
    });
}

const TARGETS: Target[] = [
    {
        id: 'moodle',
        name: 'Moodle',
        url: 'http://localhost/mod/exelearning/view.php?id=20',
        login: { url: 'http://localhost/login/index.php', user: 'teacher_demo', pass: 'Demo!2026' },
    },
    { id: 'wordpress', name: 'WordPress', url: 'http://localhost:8888/?p=49' },
    { id: 'omeka', name: 'Omeka S', url: 'http://localhost:8080/s/exelearning-demo/item/13' },
    {
        id: 'nextcloud',
        name: 'Nextcloud',
        // On 8081: 8080 belongs to Omeka in this set of environments.
        url: 'http://localhost:8081/apps/exelearning/view?path=/evil.elpx',
        browserLogin: {
            url: 'http://localhost:8081/login',
            user: 'admin',
            pass: 'admin',
        },
    },
    {
        id: 'procomun',
        name: 'Procomún',
        url: 'http://localhost:5173/recurso?slug=evil-elpx-adversarial-probe-98b06c02',
    },
];

for (const target of TARGETS) {
    test(`${target.name} serves eXeLearning content from the canonical bundle`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('pageerror', error => consoleErrors.push(error.message));

        if (target.login) {
            // Establish the session with curl and inject the cookie, rather than driving
            // the login form. Moodle's form rejected the browser submission ("Acceso
            // inválido") while the identical credentials authenticate over curl, and this
            // report is evidence about the MIGRATION — spending its reliability on a login
            // quirk would be the wrong thing to make it depend on.
            const session = moodleSession(`/tmp/shots-${target.id}.jar`, target.login);
            expect(session, 'curl did not establish a Moodle session').toBeTruthy();
            await page.context().addCookies([
                { name: 'MoodleSession', value: session as string, domain: 'localhost', path: '/' },
            ]);
        }

        if (target.browserLogin) {
            await page.goto(target.browserLogin.url, { waitUntil: 'domcontentloaded' });
            await page.locator('#user').fill(target.browserLogin.user);
            await page.locator('#password').fill(target.browserLogin.pass);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForURL(/apps|dashboard|files/, { timeout: 60_000 });
        }

        await page.goto(target.url, { waitUntil: 'domcontentloaded' });
        // Give the bundle a moment to publish its globals; it is loaded in the footer on
        // some platforms and dynamically on Procomún.
        await page.waitForTimeout(2500);

        /** What the RUNTIME says, which a screenshot cannot show. */
        const runtime = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(
                s => (s as HTMLScriptElement).src,
            );
            return {
                canonicalHost: typeof w.exeExternalMediaHost,
                legacyRelayFacade: typeof w.exeEmbedRelay,
                legacyMediaFacade: typeof w.exeMediaHost,
                // The SDKs the migration removed: their absence is the claim.
                youtubeSdk: typeof w.YT,
                vimeoSdk: typeof w.Vimeo,
                contentFrames: document.querySelectorAll('iframe').length,
                promotedPlayers: document.querySelectorAll('[data-exe-embed-player]').length,
                bundleScripts: scripts.filter(s => s.includes('exe-external-media')),
                oldScripts: scripts.filter(s => /exe[-_](embed[-_]relay|media[-_](host|policy))/.test(s)),
            };
        });

        const timings = await measure(page);
        await page.screenshot({ path: join(OUT, `${target.id}.png`), fullPage: false });
        writeFileSync(
            join(OUT, `${target.id}.json`),
            JSON.stringify({ ...runtime, consoleErrors, timings, capturedAtMs: Date.now() }, null, 2),
        );

        /**
         * POSITIVE first, and this ordering matters. "No superseded script" and "no SDK"
         * are trivially true of a page that loaded nothing at all — a failed login or a
         * wrong URL would sail through them. Asserting the bundle IS present first turns a
         * blank page into a failure instead of a pass.
         */
        expect(
            runtime.canonicalHost,
            `${target.name} did not load the canonical bundle — is this the right page, and did the login work?`,
        ).toBe('object');
        expect(runtime.contentFrames, `${target.name} rendered no content frame`).toBeGreaterThan(0);

        // Only then: no superseded file may be loaded anywhere, on any platform.
        expect(runtime.oldScripts, `${target.name} still loads a superseded script`).toEqual([]);
        // And no provider SDK may be present on the trusted page.
        expect(runtime.youtubeSdk, `${target.name} loaded the YouTube SDK`).toBe('undefined');
        expect(runtime.vimeoSdk, `${target.name} loaded the Vimeo SDK`).toBe('undefined');
    });
}
