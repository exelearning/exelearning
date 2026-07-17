import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady, selectFirstPage, addIdevice } from '../helpers/workarea-helpers';

/**
 * The empty-content guard in YjsStructureBinding.updateComponent ignores a
 * literally-blank htmlContent/content write when the component already has
 * content (issue #2165). The reviewer's blocking concern is the inverse: the
 * global guard must NOT block a legitimate clear.
 *
 * Two things carry that:
 *   (A) The real editor/save pipeline emits a NON-BLANK wrapper, not a bare
 *       '' — the text iDevice always renders its content inside
 *       `<div class="exe-text-template">…</div>`. So the guard's bare-''
 *       branch is unreachable from a real save.
 *   (B) At the binding level, a bare '' is ignored (content preserved) while a
 *       non-blank wrapper clear IS applied and survives a reload.
 *
 * Part A drives the real UI; Part B drives the binding on a persisted build
 * with strong assertions (component still exists, persisted value is the
 * wrapper, seeded text gone).
 */
test.describe('empty-write guard vs legitimate clear', () => {
    test('the real save pipeline stores a non-blank wrapper, and the guard applies a wrapper clear across reload', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        test.skip(testInfo.project.name === 'static', 'Reload persistence is disabled in static mode');
        test.setTimeout(120000);

        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Empty-write guard');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        // ---- Part A: the REAL editor/save pipeline emits a non-blank wrapper.
        await addIdevice(page, 'text');
        const node = page.locator('.idevice_node.text').first();
        await node.waitFor({ timeout: 15000 });
        const ideviceId = await node.getAttribute('id');

        // Target the TinyMCE instance bound to this node's textTextarea field,
        // not activeEditor, so we drive the specific editor whose content the
        // save() reads.
        const editorId = await page
            .waitForFunction(
                nodeId => {
                    const ta = document.querySelector(`#${nodeId} textarea[id*="textTextarea"]`);
                    const ed = ta && (window as any).tinymce?.get(ta.id);
                    return ed?.initialized && !ed.destroyed ? ta.id : null;
                },
                ideviceId,
                { timeout: 20000, polling: 200 },
            )
            .then(h => h.jsonValue());
        await page.evaluate(eid => {
            const ed = (window as any).tinymce.get(eid);
            ed.setContent('<p>Real editor content</p>');
            ed.save();
            (window as any).tinymce.triggerSave();
        }, editorId);
        await node.locator('.btn-save-idevice').click();
        await page.waitForTimeout(2500);

        const savedByEditor = await page.evaluate(id => {
            const b = (window as any).eXeLearning.app.project._yjsBridge;
            return b.structureBinding.getComponent(id)?.htmlContent ?? '';
        }, ideviceId);
        // The typed content really flowed through the editor/save pipeline, and
        // the save path wraps it — it never emits a bare '', which is exactly
        // why the guard's blank branch cannot fire from a real save.
        expect(savedByEditor).toContain('Real editor content');
        expect(savedByEditor).toContain('exe-text-template');

        // ---- Part B: the guard, exercised on the real binding + persistence.
        const result = await page.evaluate(id => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;

            // bare '' — must be ignored (content preserved, #2165).
            const before = binding.getComponent(id).htmlContent;
            binding.updateComponent(id, { htmlContent: '' });
            const afterBare = binding.getComponent(id).htmlContent;

            // legitimate clear — non-blank wrapper, what an editor emits.
            const clearedWrapper = '<div class="exe-text-template"><p><br></p></div>';
            binding.updateComponent(id, { htmlContent: clearedWrapper });
            const afterClear = binding.getComponent(id).htmlContent;

            return { before, afterBare, afterClear, clearedWrapper };
        }, ideviceId);

        expect(result.afterBare).toBe(result.before); // bare '' ignored, byte-for-byte
        expect(result.afterClear).toBe(result.clearedWrapper); // wrapper clear applied

        // Persist and reload: the cleared state survives, and the component is
        // still there — the guard does not resurrect the old content, and does
        // not drop the component.
        await page.evaluate(async () => {
            const dm = (window as any).eXeLearning.app.project._yjsBridge.getDocumentManager();
            if (typeof dm.saveToServer === 'function') await dm.saveToServer({ silent: true });
        });
        await page.reload();
        await waitForAppReady(page);

        const persisted = await page.evaluate(id => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            const comp = binding.getComponent(id);
            return comp ? { exists: true, htmlContent: comp.htmlContent ?? '' } : { exists: false, htmlContent: '' };
        }, ideviceId);

        expect(persisted.exists).toBe(true); // component not dropped
        expect(persisted.htmlContent).toBe('<div class="exe-text-template"><p><br></p></div>'); // cleared wrapper persisted verbatim
        expect(persisted.htmlContent).not.toContain('Real editor content'); // old content gone
    });
});
