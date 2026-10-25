import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * #2621: any collaborator can upload an HTML or SVG asset and embed it. Its blob: URL
 * shares the editor's origin, so its scripts used to run with the viewer's session.
 * The editor must render an embedded HTML asset in an opaque origin (it still runs,
 * but cannot reach the editor) and must never expose a scriptable SVG.
 */
const HTML_PROBE = `<!DOCTYPE html><html><body><p id="ok">site</p><script>
var reached = false;
try { reached = !!top.document.body; top.__html2621 = 1; } catch (e) {}
top.postMessage({ probe: 'html-2621', reached: reached }, '*');
</script></body></html>`;

const SVG_PROBE = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="top.__svg2621 = 1">
<script>top.__svg2621 = 2</script><rect width="10" height="10"/></svg>`;

test.describe('Embedded HTML/SVG assets stay out of the editor origin', () => {
    test('an HTML asset runs in an opaque frame and an SVG asset loses its scripts', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque HTML Asset Embed');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const probe = page.evaluate(
            () =>
                new Promise(resolve => {
                    window.addEventListener('message', e => {
                        if (e.data?.probe === 'html-2621') resolve(e.data);
                    });
                }),
        );

        const urls = await page.evaluate(
            async ({ html, svg }) => {
                const am = (window as any).eXeLearning.app.project._yjsBridge.assetManager;
                const htmlUrl = await am.insertImage(new File([html], 'probe.html', { type: 'text/html' }));
                const svgUrl = await am.insertImage(new File([svg], 'probe.svg', { type: 'image/svg+xml' }));
                // Same DOM path as rendered iDevice content: asset_url_resolver resolves added iframes.
                const host = document.createElement('div');
                host.id = 'probe-2621';
                host.innerHTML = `<iframe id="html-2621" src="${htmlUrl}"></iframe><iframe id="svg-2621" src="${svgUrl}"></iframe>`;
                document.body.appendChild(host);
                return { htmlUrl, svgUrl };
            },
            { html: HTML_PROBE, svg: SVG_PROBE },
        );
        expect(urls.htmlUrl).toMatch(/^asset:\/\//);

        // The HTML asset still renders and runs its own script ...
        const result = (await probe) as { reached: boolean };
        // ... but in an opaque origin: no access to the editor document or globals.
        expect(result.reached).toBe(false);

        const svgFrame = page.locator('#svg-2621');
        await expect(svgFrame).toHaveAttribute('src', /^blob:/);
        const served = await page.evaluate(async () => {
            const src = (document.getElementById('svg-2621') as HTMLIFrameElement).src;
            const res = await fetch(src);
            return { type: res.headers.get('content-type'), body: await res.text() };
        });
        expect(served.type).toContain('image/svg+xml');
        expect(served.body).toContain('<rect');
        expect(served.body).not.toMatch(/script|onload/i);

        const leaked = await page.evaluate(() => ({
            html: (window as any).__html2621,
            svg: (window as any).__svg2621,
        }));
        expect(leaked).toEqual({ html: undefined, svg: undefined });
    });
});
