import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady, selectFirstPage, addIdevice } from '../helpers/workarea-helpers';

/**
 * The empty-content guard in YjsStructureBinding.updateComponent ignores a
 * literally-blank htmlContent/content write when the component already has
 * content (issue #2165). The reviewer's blocking concern is the inverse: that
 * this global guard must NOT block a legitimate clear.
 *
 * This drives the real binding on a real (persisted) build and pins both
 * halves of the contract end to end:
 *   - a bare '' write is ignored (content preserved) — the #2165 guard, and
 *   - a non-blank "cleared" wrapper write (what every editor actually emits
 *     when the user deletes all content) IS applied and survives a reload.
 */
test.describe('empty-write guard vs legitimate clear', () => {
    test('ignores a bare empty write but applies and persists a wrapper clear', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Static mode boots a fresh project on reload, so the persistence half
        // cannot run there (same skip as open-project-clean-state).
        test.skip(testInfo.project.name === 'static', 'Reload persistence is disabled in static mode');

        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Empty-write guard');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        // Create a real text iDevice so a real component exists in the Y.Doc.
        await addIdevice(page, 'text');
        const node = page.locator('.idevice_node.text').first();
        await node.waitFor({ timeout: 15000 });
        const ideviceId = await node.getAttribute('id');

        const readStored = () =>
            page.evaluate(id => {
                const b = (window as any).eXeLearning.app.project._yjsBridge;
                return b.structureBinding.getComponent(id)?.htmlContent ?? '';
            }, ideviceId);

        // Seed real content through the binding, then assert both writes.
        const result = await page.evaluate(id => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            binding.updateComponent(id, { htmlContent: '<div class="exe-text-template"><p>Seeded content</p></div>' });
            const seeded = binding.getComponent(id).htmlContent;

            // (a) bare empty write — must be ignored (guard active, #2165).
            binding.updateComponent(id, { htmlContent: '' });
            const afterBare = binding.getComponent(id).htmlContent;

            // (b) legitimate clear — non-blank wrapper, what the editor emits.
            binding.updateComponent(id, { htmlContent: '<div class="exe-text-template"><p><br></p></div>' });
            const afterClear = binding.getComponent(id).htmlContent;

            return { seeded, afterBare, afterClear };
        }, ideviceId);

        expect(result.seeded).toContain('Seeded content');
        expect(result.afterBare).toContain('Seeded content'); // bare '' ignored
        expect(result.afterClear).not.toContain('Seeded content'); // wrapper clear applied
        expect(result.afterClear).toContain('exe-text-template');

        // The cleared state persists across a reload — the guard does not
        // resurrect the old content on load.
        await page.evaluate(async () => {
            const dm = (window as any).eXeLearning.app.project._yjsBridge.getDocumentManager();
            if (typeof dm.saveToServer === 'function') await dm.saveToServer({ silent: true });
        });
        await page.reload();
        await waitForAppReady(page);

        const persisted = await readStored();
        expect(persisted).not.toContain('Seeded content');
    });
});
