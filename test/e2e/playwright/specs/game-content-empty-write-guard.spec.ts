/**
 * Regression guard for the game-iDevice content wipe.
 *
 * "Game" iDevices (classify / crossword / select-media-files, etc.) keep their
 * entire state as an encoded blob inside htmlView/htmlContent, with an empty
 * jsonProperties — so those HTML fields are the ONLY copy of their content.
 *
 * A transient empty content update reaching `YjsStructureBinding.updateComponent`
 * used to blank the htmlContent Y.Text AND drop the htmlView fallback (issue #1674),
 * irreversibly wiping the iDevice: the title stayed but the body vanished, both in
 * the workarea and in any re-export.
 *
 * `updateComponent` now refuses an empty content update when the component already
 * holds content. This spec drives that guard through the real app: it imports a
 * project with game iDevices and confirms an empty write can no longer erase one.
 */
import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, gotoWorkarea, openElpFile } from '../helpers/workarea-helpers';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/todos-los-idevices_dos_informes.elpx');

test.describe('Game iDevice content is never wiped by an empty write', () => {
    test('empty htmlContent update preserves a game iDevice content', async ({ authenticatedPage, createProject }) => {
        test.setTimeout(180000);
        const page = authenticatedPage;

        const uuid = await createProject(page, 'Game Content Guard');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE, 1);

        const result = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yDoc = bridge?.getDocumentManager?.()?.getDoc?.();
            const strLen = (v: any) => (v == null ? 0 : typeof v === 'string' ? v.length : (v.length ?? 0));

            // Find a "classify" game component anywhere in the document.
            let comp: any = null;
            const walk = (pm: any) => {
                const blocks = pm?.get('blocks');
                if (blocks)
                    for (let b = 0; b < blocks.length; b++) {
                        const comps = blocks.get(b)?.get('components');
                        if (!comps) continue;
                        for (let c = 0; c < comps.length; c++) {
                            const x = comps.get(c);
                            if (!comp && x?.get('type') === 'classify') comp = x;
                        }
                    }
                for (const key of ['pages', 'children']) {
                    const subs = pm?.get(key);
                    if (subs) for (let i = 0; i < subs.length; i++) walk(subs.get(i));
                }
            };
            const nav = yDoc.getArray('navigation');
            for (let i = 0; i < nav.length; i++) walk(nav.get(i));
            if (!comp) return { error: 'no classify component found' };

            const id = comp.get('id');
            const contentBefore = Math.max(
                strLen(comp.get('htmlView')),
                strLen(comp.get('htmlContent')),
                strLen(comp.get('content')),
            );

            // Simulate the transient empty write that used to wipe the iDevice.
            bridge.structureBinding.updateComponent(id, { htmlContent: '' });

            const contentAfter = Math.max(
                strLen(comp.get('htmlView')),
                strLen(comp.get('htmlContent')),
                strLen(comp.get('content')),
            );
            return { id, contentBefore, contentAfter };
        });

        expect(result.error, result.error).toBeUndefined();
        expect(result.contentBefore, 'the imported game should have content').toBeGreaterThan(100);
        // The empty write must NOT have erased the content.
        expect(result.contentAfter, 'game content must survive an empty update').toBeGreaterThanOrEqual(
            result.contentBefore!,
        );
    });
});
