import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, expandIdeviceCategory } from '../../helpers/workarea-helpers';

/**
 * E2E for the Electrical Circuits iDevice TeX fonts (BaKoMa, served as WOFF2).
 *
 * TikZJax renders circuit labels as <text font-family="cmXXX"> that depend on
 * the @font-face rules in the iDevice's export CSS. Those fonts ship as WOFF2.
 * This loads the real export stylesheet and asserts the browser can actually
 * load several of the faces as usable fonts (i.e. the WOFF2 files are valid and
 * the @font-face src is correct), and that no legacy .ttf is requested.
 * Regression guard for the TTF→WOFF2 conversion in this PR.
 */
test('loads electrical-circuits TeX fonts as valid WOFF2 from the export stylesheet', async ({
    authenticatedPage,
    createProject,
}) => {
    const page = authenticatedPage;

    const woff2Fonts: string[] = [];
    const ttfFonts: string[] = [];
    page.on('request', req => {
        const u = req.url();
        if (/\/(cm|eu|ms)[a-z0-9]+\.woff2(\?|$)/.test(u)) woff2Fonts.push(u);
        if (/\/(cm|eu|ms)[a-z0-9]+\.ttf(\?|$)/.test(u)) ttfFonts.push(u);
    });

    const projectUuid = await createProject(page, 'Electrical Circuits Fonts Test');
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
    await selectFirstPage(page);

    // Add the iDevice so the app resolves its served path (version-prefixed in
    // dev, ./ in static) into window.$exeDevice.idevicePath.
    await expandIdeviceCategory(page, /Science|Ciencia/i);
    const ec = page.locator('.idevice_item[id="electrical-circuits"]').first();
    await ec.waitFor({ state: 'visible', timeout: 15000 });
    await ec.click();
    await page.locator('#node-content article .idevice_node.electrical-circuits').first().waitFor({ timeout: 20000 });

    // Load the real export stylesheet (its @font-face url('./fonts/*.woff2')
    // resolve against the stylesheet URL) and ask the browser to load the faces.
    // The edition script is loaded with the iDevice's absolute (version-prefixed
    // in dev) URL — derive the sibling export stylesheet URL from it.
    await page.waitForFunction(
        () => !!document.querySelector('script[src*="electrical-circuits/edition/electrical-circuits.js"]'),
        undefined,
        { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
        const editJs = document.querySelector(
            'script[src*="electrical-circuits/edition/electrical-circuits.js"]',
        ) as HTMLScriptElement | null;
        const cssUrl = (editJs?.src || '').replace(
            /edition\/electrical-circuits\.js.*$/,
            'export/electrical-circuits.css',
        );

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        const linkLoaded = new Promise<void>(resolve => {
            link.onload = () => resolve();
            link.onerror = () => resolve();
        });
        document.head.appendChild(link);
        await linkLoaded;

        // Families that real circuits use (roman, math italic, symbols, AMS).
        const families = ['cmr10', 'cmmi10', 'cmsy10', 'cmex10', 'msbm10'];
        const loaded: Record<string, number | string> = {};
        for (const f of families) {
            try {
                const faces = await document.fonts.load(`16px "${f}"`);
                loaded[f] = faces.length;
            } catch (e) {
                loaded[f] = `ERR:${(e as Error).message}`;
            }
        }
        return { cssUrl, loaded };
    });

    // Every tested family resolved to at least one successfully-loaded face.
    for (const fam of Object.keys(result.loaded)) {
        expect(
            typeof result.loaded[fam] === 'number' && (result.loaded[fam] as number) >= 1,
            `font ${fam} should load from ${result.cssUrl} (got ${result.loaded[fam]})`,
        ).toBe(true);
    }

    // The faces came from WOFF2, and no legacy TTF was requested.
    expect(woff2Fonts.length, 'expected TeX WOFF2 fonts to be fetched').toBeGreaterThan(0);
    expect(ttfFonts, `no .ttf TeX font should be requested, got: ${ttfFonts.join(', ')}`).toEqual([]);
});
