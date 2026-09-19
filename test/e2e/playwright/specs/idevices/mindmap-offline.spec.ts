import { test, expect } from '../../fixtures/auth.fixture';
import { clickRootNode, openMindmapEditor, readZoomPercent, wheelOverCanvas } from '../../helpers/mindmap-helpers';

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
        await frame
            .getByText(/^(Export|Exportar|Save|Guardar)$/i)
            .first()
            .click();
        await expect(frame.locator('#button-save-hdd')).toBeVisible({ timeout: 10000 });

        expect(foreign, `editor requested remote resources:\n${foreign.join('\n')}`).toEqual([]);
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
