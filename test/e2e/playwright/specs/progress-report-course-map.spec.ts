/**
 * The progress report builds its page tree from content.xml, which a package
 * exported without the editable source does not carry. SCORM and IMS never
 * carry the search index either, so for those packages the only course map
 * left is the one the editor stores inside the activity on every save and the
 * exporter writes into the page.
 *
 * That contract spans the two halves of the iDevice -- the editor writes it,
 * the exporter carries it -- so neither unit suite can see it break. This spec
 * exports a real SCORM package and reads the map back out of it.
 */
import { expect, test } from '../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, saveIdevice, selectFirstPage, waitForAppReady } from '../helpers/workarea-helpers';

const CHILD_PAGE = 'Subpagina del informe';

type ExportProbe = {
    files: string[];
    payload: string | null;
};

/** Whether `title` appears as the child of some page, at any depth. */
function isNestedUnderAPage(pages: unknown, title: string): boolean {
    if (!Array.isArray(pages)) return false;
    return pages.some(page => {
        const children = (page as { children?: unknown }).children;
        if (Array.isArray(children)) {
            if (children.some(child => (child as { title?: string }).title === title)) return true;
            return isNestedUnderAPage(children, title);
        }
        return false;
    });
}

test.describe('Progress report course map in exported packages', () => {
    test('carries the page tree inside the activity, so SCORM can still build the report', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        test.setTimeout(180000);

        const uuid = await createProject(page, 'Progress report course map');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // The hierarchy has to exist before the report is opened: its editor
        // snapshots the page tree while it loads, and that snapshot is what
        // ends up travelling in the package.
        await page.evaluate(childName => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge?.structureBinding || !bridge?.documentManager) {
                throw new Error('Yjs bridge is not available');
            }
            const parentId = bridge.documentManager.getNavigation().get(0)?.get('id');
            if (!parentId) throw new Error('The project has no page');
            bridge.structureBinding.createPage(childName, parentId);
        }, CHILD_PAGE);

        await selectFirstPage(page);
        await addIdevice(page, 'progress-report');

        // The editor fills its page list asynchronously. Waiting for the child
        // page to appear there is what makes the snapshot deterministic.
        await expect(page.locator('#informeEPages')).toContainText(CHILD_PAGE, { timeout: 30000 });

        const ideviceId = await page.locator('#node-content .idevice_node.progress-report').getAttribute('id');
        expect(ideviceId).toBeTruthy();
        await saveIdevice(page, ideviceId!);

        const probe: ExportProbe = await page.evaluate(async () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            const fflate = (window as any).fflate;
            if (!bridge?.documentManager || !exporters?.quickExport || !fflate?.unzipSync) {
                throw new Error('Browser export dependencies are not available');
            }

            const exported = await exporters.quickExport(
                'scorm12',
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || 'scorm12 export failed');
            }

            const unzipped = fflate.unzipSync(new Uint8Array(exported.data));
            const decoder = new TextDecoder();
            let payload: string | null = null;
            for (const [name, bytes] of Object.entries(unzipped)) {
                if (!name.endsWith('.html')) continue;
                const html = decoder.decode(bytes as Uint8Array);
                const match = html.match(/<div class="informe-DataGame[^"]*">([\s\S]*?)<\/div>/);
                if (match) {
                    payload = match[1];
                    break;
                }
            }

            return { files: Object.keys(unzipped), payload };
        });

        // Neither of the two sources the report would otherwise read is here:
        // that is what makes the stored map load-bearing rather than a nicety.
        expect(probe.files).not.toContain('search_index.js');

        expect(probe.payload).toBeTruthy();
        const stored = JSON.parse(probe.payload!);
        expect(Array.isArray(stored.sessionIdevices)).toBe(true);
        expect(stored.sessionIdevices.length).toBeGreaterThan(0);

        // The hierarchy is the whole point of preferring this map: the search
        // index lists the same pages but stores no parent, so it reads flat.
        expect(isNestedUnderAPage(stored.sessionIdevices, CHILD_PAGE)).toBe(true);
    });
});
