import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PRERENDERED_LATEX_CSS } from '../../../../src/shared/export/constants';

// Exercise the shared runtime directly, with the shipped engine and no editor/server
// dependency. In particular, happy-dom cannot reproduce detached image load events.
const ORIGIN = 'http://mathjax-runtime.test';
const commonDir = path.resolve('public/app/common');

async function installRuntime(page: Page): Promise<string[]> {
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('requestfailed', request => failures.push(request.url()));
    page.on('response', response => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) {
            failures.push(`Unexpected external dependency: ${url.href}`);
            await route.abort();
        } else if (url.pathname === '/') {
            await route.fulfill({
                contentType: 'text/html',
                body: '<!doctype html><html id="exe-index"><head></head><body></body></html>',
            });
        } else if (url.pathname === '/image.svg') {
            await route.fulfill({
                contentType: 'image/svg+xml',
                headers: { 'Cache-Control': 'no-store' },
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>',
            });
        } else if (url.pathname.startsWith('/libs/exe_math/')) {
            const engineDir = path.join(commonDir, 'exe_math');
            const file = path.resolve(engineDir, url.pathname.slice('/libs/exe_math/'.length));
            expect(path.relative(engineDir, file)).not.toMatch(/^\.\.|^[A-Za-z]:/);
            await route.fulfill({ contentType: 'application/javascript', body: await readFile(file) });
        } else {
            await route.fulfill({ status: 404, body: 'Unexpected runtime resource' });
        }
    });
    await openRuntime(page);
    return failures;
}

async function openRuntime(page: Page): Promise<void> {
    await page.goto(ORIGIN);
    await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
    await page.addScriptTag({ path: path.join(commonDir, 'common.js') });
    await page.addStyleTag({ content: PRERENDERED_LATEX_CSS });
}

async function loadEngine(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const runtime = window as any;
        await new Promise<void>(resolve => runtime.$exe.math.loadMathJax(resolve));
        await runtime.MathJax.startup.promise;
    });
}

test('math detection does not reload images or construct custom elements', async ({ page }) => {
    const failures = await installRuntime(page);
    await page.evaluate(() => {
        const runtime = window as any;
        runtime.imageLoads = 0;
        runtime.constructions = 0;
        customElements.define(
            'math-scan-widget',
            class extends HTMLElement {
                constructor() {
                    super();
                    runtime.constructions++;
                }
            },
        );
        document.body.innerHTML =
            '<main><math-scan-widget></math-scan-widget><img src="/image.svg" onload="window.imageLoads++"></main>';
    });
    await page.waitForFunction(() => (window as any).imageLoads === 1);
    await page.evaluate(() => {
        for (let i = 0; i < 3; i++) {
            (window as any).$exe.math.refresh(document.querySelector('main'));
            (window as any).$exe.math.init();
        }
    });
    // This isolated document has no background traffic. Drain any image requests
    // and queued load events caused by the detection calls before asserting.
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => [(window as any).imageLoads, (window as any).constructions])).toEqual([1, 1]);
    expect(await page.locator('script[src*="tex-mml-svg"]').count()).toBe(0);
    expect(failures).toEqual([]);
});

test('excluded examples do not load an absent engine, but new raw formulas still render', async ({ page }) => {
    const failures = await installRuntime(page);
    await page.evaluate(() => {
        document.body.innerHTML = String.raw`<main>
            <pre>\(pre\)</pre><code>\(code\)</code>
            <script type="application/json">"\\(script\\)"</script>
            <style>/* \(style\) */</style><textarea>\(textarea\)</textarea>
            <noscript>\(noscript\)</noscript><!-- \(comment\) -->
            <span title="\(attribute\)">Text</span>
            <div class="tex2jax_ignore"><span>\(ignored\)</span></div>
        </main>`;
        (window as any).$exe.math.refresh(document.querySelector('main'));
        (window as any).$exe.math.init();
    });
    expect(await page.locator('script[src*="tex-mml-svg"]').count()).toBe(0);
    await page.evaluate(() => {
        document.querySelector('main')!.insertAdjacentHTML('beforeend', '<p id="raw">\\(x^2\\)</p>');
        (window as any).$exe.math.init();
    });
    await expect(page.locator('#raw mjx-container svg')).toBeVisible();
    await expect(page.locator('main > pre')).toHaveText(String.raw`\(pre\)`);
    await expect(page.locator('main > code')).toHaveText(String.raw`\(code\)`);
    await expect(page.locator('.tex2jax_ignore')).toHaveText(String.raw`\(ignored\)`);
    expect(failures).toEqual([]);
});

test('page initialization preserves registered formulas when more math is inserted', async ({ page }) => {
    const failures = await installRuntime(page);
    await page.evaluate(() => {
        document.body.innerHTML = '<p id="first">\\(a\\)</p>';
    });
    await loadEngine(page);
    await expect(page.locator('#first mjx-container svg')).toBeVisible();
    await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<p id="second">\\(b\\)</p>');
        (window as any).$exe.math.init();
    });
    await expect(page.locator('#second mjx-container svg')).toBeVisible();
    expect(
        await page.evaluate(() => (window as any).MathJax.startup.document.getMathItemsWithin([document.body]).length),
    ).toBe(2);
    expect(failures).toEqual([]);
});

for (const entry of ['init', 'refresh']) {
    for (const alreadyLoaded of [false, true]) {
        test(`mixed formulas preserve one SVG and accessible MathML via ${entry}, engine loaded: ${alreadyLoaded}`, async ({
            page,
        }) => {
            const failures = await installRuntime(page);
            await loadEngine(page);
            await page.addScriptTag({ path: path.join(commonDir, 'LatexPreRenderer.js') });
            const rendered = await page.evaluate(async () => {
                const result = await (window as any).LatexPreRenderer.preRender('<p>\\(a\\)</p>');
                if (result.count !== 1) throw new Error('The fixture must contain one pre-rendered formula');
                return result.html;
            });
            // Start with exported markup, without the producer's MathJax state.
            await openRuntime(page);
            // Loaded-engine cases insert content after startup, so they exercise
            // refresh/init protection independently of the pageReady hook.
            if (alreadyLoaded) await loadEngine(page);
            await page.evaluate(html => {
                document.body.innerHTML = `${html}<p id="raw">\\(b\\)</p>`;
                (window as any).originalMath = document.querySelector('.exe-math-rendered math');
                (window as any).originalSvg = document.querySelector('.exe-math-rendered svg');
            }, rendered);
            for (let pass = 0; pass < 2; pass++) {
                await page.evaluate(method => {
                    const runtime = window as any;
                    if (method === 'init') runtime.$exe.math.init();
                    else runtime.$exe.math.refresh(document.body);
                }, entry);
                await expect(page.locator('#raw mjx-container svg')).toBeVisible();
                await page.evaluate(async () => {
                    const mathjax = (window as any).MathJax;
                    await mathjax.startup.promise;
                    await mathjax.whenReady(() => {});
                });
                await expect(page.locator('.exe-math-rendered svg')).toHaveCount(1);
                await expect(page.locator('.exe-math-rendered svg')).toBeVisible();
                await expect(page.locator('.exe-math-rendered mjx-container')).toHaveCount(0);
                await expect(page.locator('.exe-math-rendered mjx-assistive-mml > math')).toHaveCount(1);
                expect(
                    await page.evaluate(() => {
                        const runtime = window as any;
                        return (
                            document.querySelector('.exe-math-rendered math') === runtime.originalMath &&
                            document.querySelector('.exe-math-rendered svg') === runtime.originalSvg &&
                            !runtime.originalMath.closest('[aria-hidden="true"], [hidden]')
                        );
                    }),
                ).toBe(true);
            }
            expect(failures).toEqual([]);
        });
    }
}
