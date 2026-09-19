import { test, expect } from '../../fixtures/auth.fixture';
import {
    SAVE_MENU_ITEM,
    clickRootNode,
    nodeCaptions,
    openMindmapEditor,
    pickColour,
    readZoomPercent,
    rootNodeColour,
    wheelOverCanvas,
} from '../../helpers/mindmap-helpers';

/**
 * Behavioural baseline for the embedded mindmaps editor.
 *
 * mindmaps runs on jQuery 1.6.1, jQuery UI 1.8.11 and a set of plugins that have had no
 * release in over a decade — mousewheel, hotkeys, dragscrollable, minicolors, tmpl. Each of
 * those is a candidate for an upgrade, and none of them had any browser coverage, so a
 * regression would have surfaced as a user report rather than a failing test.
 *
 * These tests exist to be run before and after such an upgrade. They cover the contracts
 * those plugins provide — wheel zoom, keyboard shortcuts, node commands, the inspector
 * widgets, and the jQuery UI dialogs built from jquery.tmpl templates — and deliberately
 * not the whole application. Assertions go through ids the application assigns and through
 * the navigator's own zoom readout, so a change of jQuery or jQuery UI markup does not
 * rewrite the test suite along with the dependency.
 *
 * Downloads stay in mindmap-export.spec.ts.
 */
test.describe('Mind map editor', () => {
    /** Fails the test on an uncaught error rather than letting a broken plugin pass quietly. */
    function trackPageErrors(page: import('@playwright/test').Page): string[] {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        return errors;
    }

    test('starts up with a usable canvas, root node and toolbar', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = trackPageErrors(page);
        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Startup');

        await expect(frame.locator('#canvas-container')).toBeVisible();
        await expect(frame.locator('.node-caption.root')).toHaveText(/\S/);

        // The toolbar is built from command objects; these ids are the command names.
        for (const command of ['CREATE_NODE_COMMAND', 'DELETE_NODE_COMMAND', 'UNDO_COMMAND', 'REDO_COMMAND']) {
            await expect(frame.locator(`#button-${command}`)).toBeVisible();
        }

        // The float panels are jQuery UI widgets rendered from jquery.tmpl templates.
        await expect(frame.locator('#inspector')).toBeVisible();
        await expect(frame.locator('#navigator')).toBeVisible();
        expect(await readZoomPercent(frame2)).toBe(100);

        expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('edits the root node caption', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = trackPageErrors(page);
        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Caption');

        const root = frame.locator('.node-caption.root');
        const original = (await root.textContent())?.trim();

        await clickRootNode(frame, { double: true });
        // Editing swaps the caption for a textarea, which is the event wiring under test.
        const editor = frame.locator('.node-caption.root textarea');
        await expect(editor).toBeVisible({ timeout: 5000 });
        await editor.fill('Renamed root');
        await frame.locator('#canvas-container').click({ position: { x: 20, y: 20 } });

        await expect(frame.locator('.node-caption.root')).toHaveText('Renamed root', { timeout: 5000 });
        expect((await nodeCaptions(frame2)).join()).not.toBe(original);
        expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('creates and deletes a node from the toolbar', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = trackPageErrors(page);
        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Nodes');

        expect(await nodeCaptions(frame2)).toHaveLength(1);

        await frame.locator('#button-CREATE_NODE_COMMAND').click();
        await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(2);

        await frame.locator('#button-DELETE_NODE_COMMAND').click();
        await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(1);

        expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('undoes and redoes a node creation', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = trackPageErrors(page);
        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Undo');

        await frame.locator('#button-CREATE_NODE_COMMAND').click();
        await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(2);

        await frame.locator('#button-UNDO_COMMAND').click();
        await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(1);

        await frame.locator('#button-REDO_COMMAND').click();
        await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(2);

        expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });

    /**
     * The contract jquery.mousewheel provides.
     *
     * mindmaps reads only the sign of the plugin's `delta` — CanvasPresenter does
     * `delta > 0 ? zoomIn() : zoomOut()` — and every step is ZoomController.ZOOM_STEP,
     * a fixed 0.25. So direction and step count are the behaviour worth pinning; the
     * plugin's delta magnitude is discarded and asserting it would pin an implementation
     * detail the application deliberately ignores.
     */
    test.describe('zoom', () => {
        test('wheeling up zooms in and wheeling down zooms back out', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Zoom');

            const start = await readZoomPercent(frame2);
            expect(start).toBe(100);

            await wheelOverCanvas(page, frame, -240);
            const zoomedIn = await readZoomPercent(frame2);
            expect(zoomedIn).toBeGreaterThan(start);

            await wheelOverCanvas(page, frame, 240);
            const zoomedBack = await readZoomPercent(frame2);
            expect(zoomedBack).toBeLessThan(zoomedIn);
            expect(zoomedBack).toBe(start);

            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('one wheel gesture is one zoom step', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Zoom Step');

            // ZOOM_STEP is 0.25, so 100% -> 125%. This is what a delta-normalisation change
            // in the plugin would break: one gesture must not become two steps or none.
            await wheelOverCanvas(page, frame, -240);
            expect(await readZoomPercent(frame2)).toBe(125);

            await wheelOverCanvas(page, frame, -240);
            expect(await readZoomPercent(frame2)).toBe(150);
        });

        test('stops at the maximum instead of running away', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Zoom Max');

            // MAX_ZOOM is 3. Twelve gestures is well past it.
            for (let i = 0; i < 12; i++) await wheelOverCanvas(page, frame, -240);

            expect(await readZoomPercent(frame2)).toBe(300);
        });

        test('a horizontal wheel does not zoom', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Zoom Horizontal');

            // One gesture at a time, and asserted after each: a pair of opposite scrolls
            // cancels out and would hide a zoom that did happen. That is exactly how this
            // went unnoticed before -- the plugin falls back to the horizontal delta when
            // the vertical one is zero, so a sideways two-finger swipe used to zoom.
            expect(await readZoomPercent(frame2)).toBe(100);

            await wheelOverCanvas(page, frame, 0, 240);
            expect(await readZoomPercent(frame2), 'scrolling right must not zoom').toBe(100);

            await wheelOverCanvas(page, frame, 0, -240);
            expect(await readZoomPercent(frame2), 'scrolling left must not zoom').toBe(100);

            // The vertical gesture still zooms, so this is a narrowing rather than a mute.
            await wheelOverCanvas(page, frame, -240);
            expect(await readZoomPercent(frame2)).toBe(125);
        });

        test('the navigator zoom buttons work independently of the wheel', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Navi Zoom');

            await frame.locator('#button-navi-zoom-in').click();
            await expect.poll(() => readZoomPercent(frame2), { timeout: 5000 }).toBe(125);

            await frame.locator('#button-navi-zoom-out').click();
            await expect.poll(() => readZoomPercent(frame2), { timeout: 5000 }).toBe(100);
        });
    });

    /** The contract dragscrollable provides: drag the background, the canvas scrolls. */
    test('pans the canvas by dragging the background', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = trackPageErrors(page);
        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Pan');

        const scrollPosition = () =>
            frame2.evaluate(() => {
                const container = document.querySelector('#canvas-container') as HTMLElement;
                return { left: container.scrollLeft, top: container.scrollTop };
            });

        const before = await scrollPosition();
        const box = await frame.locator('#canvas-container').boundingBox();
        if (!box) throw new Error('canvas container has no box');

        // Start low and left of centre, away from the root node, so this drags the
        // background rather than a node.
        const startX = box.x + box.width * 0.3;
        const startY = box.y + box.height * 0.8;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        for (let step = 1; step <= 8; step++) {
            await page.mouse.move(startX - step * 20, startY - step * 10, { steps: 2 });
        }
        await page.mouse.up();

        // Directional rather than exact: dragging up and left scrolls the viewport down and
        // right. The pixel total is deterministic here, but pinning it would describe the
        // drag arithmetic instead of the behaviour.
        await expect.poll(async () => (await scrollPosition()).left, { timeout: 5000 }).toBeGreaterThan(before.left);
        expect((await scrollPosition()).top).toBeGreaterThan(before.top);

        expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });

    /** The contract jquery.hotkeys provides: a shortcut string as bind()'s eventData. */
    test.describe('keyboard shortcuts', () => {
        test('ctrl+z undoes the last command exactly once', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Shortcut');

            // Ctrl+Z rather than the Tab binding: Tab is consumed by the browser's own focus
            // traversal before the document sees it, and a modifier combination exercises more
            // of the plugin -- hotkeys has to parse "ctrl+z" and match the modifier state,
            // which a bare key never tests.
            await frame.locator('#button-CREATE_NODE_COMMAND').click();
            await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(2);

            await clickRootNode(frame);
            await page.keyboard.press('Control+z');

            await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(1);
            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('typing a caption does not fire the shortcut', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Shortcut Editing');

            await clickRootNode(frame, { double: true });
            const editor = frame.locator('.node-caption.root textarea');
            await expect(editor).toBeVisible({ timeout: 5000 });

            // Backspace is bound to DeleteNodeCommand. While a caption is being edited the
            // shortcut must stay out of the way, or correcting a typo would delete the node.
            await editor.fill('typo');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(300);

            expect(await nodeCaptions(frame2)).toHaveLength(1);
        });
    });

    /** The controls jquery.minicolors and jQuery UI buttons render into the inspector. */
    test.describe('inspector', () => {
        test('font size and bold controls act on the selected node', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Inspector');

            await clickRootNode(frame);

            const fontSize = () =>
                frame2.evaluate(() => {
                    const node = document.querySelector('.node-caption.root') as HTMLElement;
                    return Number.parseFloat(window.getComputedStyle(node).fontSize);
                });

            const before = await fontSize();
            await frame.locator('#inspector-button-font-size-increase').click();
            await expect.poll(fontSize, { timeout: 5000 }).toBeGreaterThan(before);

            await frame.locator('#inspector-button-font-size-decrease').click();
            await expect.poll(fontSize, { timeout: 5000 }).toBe(before);

            // The bold control is a jQuery UI checkboxradio button over a real checkbox.
            const fontWeight = () =>
                frame2.evaluate(() => {
                    const node = document.querySelector('.node-caption.root') as HTMLElement;
                    return window.getComputedStyle(node).fontWeight;
                });
            const weightBefore = await fontWeight();
            await frame.locator('#inspector-label-font-bold').click();
            await expect.poll(fontWeight, { timeout: 5000 }).not.toBe(weightBefore);

            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('changing the font colour updates the node and survives reselection', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Colours');

            await clickRootNode(frame);
            const before = await rootNodeColour(frame2);

            const { value } = await pickColour(page, frame, frame2, 'inspector-font-color-picker');
            expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(value).not.toBe('#000000');

            // The rendered node has to follow the picker, not just the input.
            await expect.poll(() => rootNodeColour(frame2), { timeout: 5000 }).not.toBe(before);

            // Deselect, reselect: the inspector reads the value back out of the model, so
            // this is what proves the colour was stored rather than only painted.
            await frame.locator('#canvas-container').click({ position: { x: 20, y: 20 } });
            await clickRootNode(frame);

            const restored = await frame2.evaluate(() =>
                (window as unknown as { jQuery: (s: string) => { val: () => string } })
                    .jQuery('#inspector-font-color-picker')
                    .val(),
            );
            expect(restored.toLowerCase()).toBe(value.toLowerCase());
            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('changing the branch colour updates the model', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Branch Colour');

            // A child node, because the root has no incoming branch to colour.
            await frame.locator('#button-CREATE_NODE_COMMAND').click();
            await expect.poll(async () => (await nodeCaptions(frame2)).length, { timeout: 5000 }).toBe(2);

            const { value } = await pickColour(page, frame, frame2, 'inspector-branch-color-picker');

            expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
            const stored = await frame2.evaluate(() =>
                (window as unknown as { jQuery: (s: string) => { val: () => string } })
                    .jQuery('#inspector-branch-color-picker')
                    .val(),
            );
            expect(stored.toLowerCase()).toBe(value.toLowerCase());
        });
    });

    /**
     * jquery.tmpl actually rendering, not merely being defined.
     *
     * Every panel and dialog in the editor is produced by $.tmpl() from a
     * <script type="text/x-jquery-tmpl"> block in the host page, using ${...} substitution
     * and {{if}} blocks. A jQuery upgrade that broke the plugin would leave those blocks
     * empty or unsubstituted rather than throwing, so the assertions look for the
     * substituted text.
     */
    test.describe('templates', () => {
        test('renders float panel titles through $.tmpl substitution', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Templates');

            // #template-float-panel interpolates ${title}; the inspector and navigator
            // panels are built from it at startup.
            const titles = await frame2.evaluate(() =>
                Array.from(document.querySelectorAll('.float-panel .ui-dialog-title')).map(t =>
                    (t.textContent || '').trim(),
                ),
            );

            expect(titles.length).toBeGreaterThanOrEqual(2);
            for (const title of titles) {
                expect(title).not.toBe('');
                // An unsubstituted template leaves the placeholder behind.
                expect(title).not.toContain('${');
            }

            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('renders a dialog body through $.tmpl when one is opened', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Template Dialog');

            await frame
                .locator('#toolbar')
                .getByText(/Tools|Herramientas/i)
                .first()
                .click();
            await frame.getByText(SAVE_MENU_ITEM).first().click();
            await expect(frame.locator('#save-dialog')).toBeVisible({ timeout: 10000 });

            // #template-save interpolates ${customStrings.saveMap} and friends.
            const body = await frame2.evaluate(() => (document.querySelector('#save-dialog') as HTMLElement).innerText);
            expect(body.trim()).not.toBe('');
            expect(body).not.toContain('${');

            // $.tmpl is what produced it.
            const tmpl = await frame2.evaluate(
                () => typeof (window as unknown as { jQuery: { tmpl?: unknown } }).jQuery.tmpl,
            );
            expect(tmpl).toBe('function');
        });
    });

    /** jQuery UI dialogs built from jquery.tmpl templates. */
    test.describe('dialogs', () => {
        test('opens and closes the export dialog without navigating away', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const errors = trackPageErrors(page);
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Dialog');
            const urlBefore = frame2.url();

            await frame
                .locator('#toolbar')
                .getByText(/Tools|Herramientas/i)
                .first()
                .click();
            await frame.getByText(SAVE_MENU_ITEM).first().click();
            await expect(frame.locator('#button-save-hdd')).toBeVisible({ timeout: 10000 });

            // Scoped to the dialog that owns the save button: the inspector and navigator
            // float panels carry the same close control, and while a modal dialog is open the
            // widget overlay covers them.
            const saveDialog = frame.locator('.ui-dialog').filter({ has: frame.locator('#button-save-hdd') });
            await saveDialog.locator('.ui-dialog-titlebar-close').click();
            await expect(frame.locator('#button-save-hdd')).toBeHidden({ timeout: 5000 });

            expect(frame2.url()).toBe(urlBefore);
            expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
        });

        test('closing a float panel does not jump to the top of the host page', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Panel Close');
            const urlBefore = frame2.url();

            // The panel's close control is an <a href="#">, so eXeLearning returns false from
            // the handler. Without it the iframe navigates to "#" on every close.
            const inspector = frame.locator('.float-panel').filter({ has: frame.locator('#inspector') });
            await inspector.locator('.ui-dialog-titlebar-close').click();

            await expect(frame.locator('#inspector')).toBeHidden({ timeout: 5000 });
            expect(frame2.url()).toBe(urlBefore);
        });
    });
});
