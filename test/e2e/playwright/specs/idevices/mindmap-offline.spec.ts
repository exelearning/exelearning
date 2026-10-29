import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    SAVE_MENU_ITEM,
    clickRootNode,
    openMindmapEditor,
    readZoomPercent,
    wheelOverCanvas,
} from '../../helpers/mindmap-helpers';

/**
 * The mindmaps editor must not fetch executable code or styles from anywhere but this
 * application's own origin.
 *
 * The upstream project loads jQuery, Filestack and FileSaver from three CDNs, so this is a
 * real possibility rather than a hypothetical one: a future vendoring that took the
 * standalone page too literally would reintroduce them. Offline installations and the
 * Electron build would then ship an editor that silently degrades, and every user would be
 * announced to three third parties.
 *
 * Checked by origin rather than by hostname list, so a CDN nobody thought of still fails.
 */
test.describe('Mind map editor offline contract', () => {
    /** Resource types that execute or style; an image leaking would be a different bug. */
    const EXECUTABLE_TYPES = new Set(['script', 'stylesheet', 'font', 'xhr', 'fetch']);

    test('loads no script or stylesheet from another origin', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const origin = new URL(page.url() || 'http://localhost:3001').origin;
        const foreign: string[] = [];

        page.on('request', request => {
            if (!EXECUTABLE_TYPES.has(request.resourceType())) return;
            const url = request.url();
            if (url.startsWith('data:') || url.startsWith('blob:')) return;
            if (!url.startsWith(origin)) foreign.push(`${request.resourceType()} ${url}`);
        });

        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Offline');

        // Exercise the interactions too: a lazily loaded dependency would only show up here.
        await clickRootNode(frame);
        await frame.locator('#button-CREATE_NODE_COMMAND').click();
        await wheelOverCanvas(page, frame, -240);
        expect(await readZoomPercent(frame2)).toBeGreaterThan(100);
        await frame
            .locator('#toolbar')
            .getByText(/Tools|Herramientas/i)
            .first()
            .click();
        await frame.getByText(SAVE_MENU_ITEM).first().click();
        await expect(frame.locator('#button-save-hdd')).toBeVisible({ timeout: 10000 });

        expect(foreign, `editor requested remote resources:\n${foreign.join('\n')}`).toEqual([]);
    });

    test('runs on the exact jQuery and jQuery UI this application ships', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const { frame2 } = await openMindmapEditor(page, createProject, 'MindMap jQuery Version');

        // Read the expected versions out of the canonical assets rather than hardcoding
        // them, so upgrading eXeLearning's jQuery does not leave this quietly asserting an
        // old number that the editor no longer uses.
        const repoRoot = path.resolve(__dirname, '../../../../..');
        const jqueryAsset = fs.readFileSync(path.join(repoRoot, 'public/libs/jquery/jquery.min.js'), 'utf8');
        const jqueryUiAsset = fs.readFileSync(path.join(repoRoot, 'public/libs/jquery-ui/jquery-ui.min.js'), 'utf8');
        const expectedJquery = /jQuery v(\d+\.\d+\.\d+)/.exec(jqueryAsset)?.[1];
        const expectedJqueryUi = /jQuery UI - v(\d+\.\d+\.\d+)/.exec(jqueryUiAsset)?.[1];
        expect(expectedJquery, 'could not read the shipped jQuery version').toBeTruthy();
        expect(expectedJqueryUi, 'could not read the shipped jQuery UI version').toBeTruthy();

        const runtime = await frame2.evaluate(() => {
            const win = window as unknown as { jQuery: { fn: { jquery: string }; ui?: { version: string } } };
            return { jquery: win.jQuery.fn.jquery, jqueryUi: win.jQuery.ui?.version };
        });

        expect(runtime.jquery).toBe(expectedJquery);
        expect(runtime.jqueryUi).toBe(expectedJqueryUi);
    });

    test('loads exactly one jQuery into the editor document', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const { frame2 } = await openMindmapEditor(page, createProject, 'MindMap Single jQuery');

        // Counted inside the iframe rather than across the page: the workarea that hosts
        // the editor loads its own jQuery, and that is a different document. What matters
        // is that the editor document holds one, and that it is the application's copy.
        const loaded = await frame2.evaluate(() =>
            Array.from(document.querySelectorAll('script[src]'))
                .map(script => new URL((script as HTMLScriptElement).src).pathname)
                .filter(pathname => /\/jquery(\.min)?\.js$/i.test(pathname)),
        );

        expect(loaded, `editor document loaded: ${loaded.join(', ')}`).toHaveLength(1);
        expect(loaded[0]).toContain('/libs/jquery/jquery.min.js');
    });

    test('keeps no private jQuery beside the plugin', async () => {
        const repoRoot = path.resolve(__dirname, '../../../../..');
        const editorJs = path.join(repoRoot, 'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/js');

        // The plugin used to ship its own jQuery 1.6.1 here. Reintroducing one would load a
        // second copy into the editor and silently shadow the application's.
        const strays = fs.readdirSync(editorJs).filter(name => /^jquery(\.min)?\.js$/i.test(name));
        expect(strays, `private jQuery reintroduced: ${strays.join(', ')}`).toEqual([]);

        const html = fs.readFileSync(path.join(editorJs, '..', 'index.html'), 'utf8');
        expect(html).toContain('/libs/jquery/jquery.min.js');
        expect(html).toContain('/libs/jquery-ui/jquery-ui.min.js');
    });

    test('serves the editor its jQuery from this application', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const origin = new URL(page.url() || 'http://localhost:3001').origin;
        const scripts: string[] = [];
        page.on('request', request => {
            if (request.resourceType() === 'script') scripts.push(request.url());
        });

        await openMindmapEditor(page, createProject, 'MindMap Offline jQuery');

        const jquery = scripts.filter(url => /jquery[^/]*\.js/i.test(url));
        expect(jquery.length, `no jQuery request seen in:\n${scripts.join('\n')}`).toBeGreaterThan(0);
        for (const url of jquery) {
            expect(url.startsWith(origin), `${url} is not served by this application`).toBe(true);
        }
    });
});
