import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    editIdevice,
    saveIdevice,
} from '../../helpers/workarea-helpers';

/**
 * E2E tests for the focused full-workarea iDevice edit mode (Refs #1811, #1411).
 *
 * This is the final, always-on editing behaviour. The tests verify that
 * entering iDevice edit mode applies the focused layout/state, that every exit
 * path (save / discard / delete) tears it down, that the editor fills the
 * workarea, and that the outer workarea scroll is locked while editing.
 */

const BODY_CLASS = 'exe-idevice-focus-editing';
const NODE_CLASS = 'idevice-node--focused-editing';

/**
 * Read the id of the first text iDevice directly from its node. A freshly added
 * text iDevice is already in edition mode (no export-mode dropdown), so the
 * generic id helper does not apply here.
 */
async function getTextIdeviceId(page): Promise<string> {
    const node = page.locator('#node-content article .idevice_node.text').first();
    await node.waitFor({ state: 'attached', timeout: 15000 });
    const id = await node.getAttribute('id');
    if (!id) throw new Error('text iDevice id not found');
    return id;
}

/** Ensure the given iDevice is in edition mode (no-op if already editing). */
async function ensureEditing(page, ideviceId: string): Promise<void> {
    const mode = await page.locator(`.idevice_node[id="${ideviceId}"]`).getAttribute('mode');
    if (mode !== 'edition') {
        await editIdevice(page, ideviceId);
    }
}

/**
 * Put text into the active TinyMCE editor. A text iDevice with no content
 * cannot be saved ("Failed to save the iDevice to database"), so the save and
 * discard flows must add content first.
 */
async function fillActiveEditor(page, text: string): Promise<void> {
    await page.waitForFunction(
        () => {
            const ed = (window as any).tinymce?.activeEditor;
            return ed && ed.initialized;
        },
        undefined,
        { timeout: 15000 },
    );
    await page.evaluate(t => {
        const ed = (window as any).tinymce.activeEditor;
        ed.setContent(`<p>${t}</p>`);
        ed.fire('change');
        ed.fire('input');
        ed.setDirty(true);
    }, text);
}

/** Confirm the generic confirmation modal (used by discard and delete). */
async function confirmModal(page): Promise<void> {
    const confirmBtn = page.locator('#modalConfirm .confirm, [data-testid="confirm-action"]').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
}

async function waitForFocusActive(page): Promise<void> {
    await page.waitForFunction(cls => document.body.classList.contains(cls), BODY_CLASS, {
        timeout: 10000,
    });
}

async function waitForFocusInactive(page): Promise<void> {
    await page.waitForFunction(cls => !document.body.classList.contains(cls), BODY_CLASS, {
        timeout: 15000,
    });
}

/**
 * Add a single text iDevice, give it (short) content and save it. Returns the
 * saved iDevice id. Mirrors the proven single-iDevice save flow used by the
 * other tests in this file to avoid empty-save / unsaved-changes flakiness.
 */
async function addSavedTextIdevice(page): Promise<string> {
    await addTextIdevice(page);
    const id = await getTextIdeviceId(page);
    await ensureEditing(page, id);
    await waitForFocusActive(page);
    await fillActiveEditor(page, 'Saved content');
    await saveIdevice(page, id);
    await waitForFocusInactive(page);
    return id;
}

/**
 * Reproduce the exact DOM residue that saving an iDevice from TinyMCE fullscreen
 * left behind: a `tox-fullscreen` class stuck on <html>/<body> (the editor was
 * destroyed before fullscreen's own teardown ran). This is what historically
 * scroll-locked the document and broke the *next* iDevice edit, and reproducing
 * it directly is deterministic — unlike toggling the real fullscreen plugin in
 * headless. Returns whether both classes were applied.
 */
async function injectLeftoverFullscreenState(page): Promise<boolean> {
    return page.evaluate(() => {
        document.documentElement.classList.add('tox-fullscreen');
        document.body.classList.add('tox-fullscreen');
        return (
            document.documentElement.classList.contains('tox-fullscreen') &&
            document.body.classList.contains('tox-fullscreen')
        );
    });
}

test.describe('Focused iDevice edit mode (experiment)', () => {
    test('entering edit mode applies focused state and disables global controls', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - enter');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);

        await waitForFocusActive(page);

        // The edited node is marked as the focused surface.
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).toHaveClass(new RegExp(NODE_CLASS));

        // Global save shows a dimmed "unavailable" cue + tooltip while editing
        // (it stays clickable so the existing checkOpenIdevice alert can fire).
        const save = page.locator('#head-top-save-button');
        await expect(save).toHaveClass(/exe-disabled-during-focus/);
        await expect(save).toHaveAttribute('title', 'Save or discard the open iDevice before saving the project.');

        // The bottom quick toolbar is hidden during focused editing.
        await expect(page.locator('#idevices-bottom')).toBeHidden();

        // A polite live region announces the editing state.
        const live = page.locator('#exe-focus-editing-live');
        await expect(live).toHaveAttribute('aria-live', 'polite');
        await expect(live).not.toBeEmpty();
    });

    test('the focused editor fills the content workarea', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - layout');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);
        await waitForFocusActive(page);

        // The focused block overlays the scroll container and fills it.
        const ratio = await page.evaluate(id => {
            const container = document.getElementById('node-content-container');
            const node = document.getElementById(id);
            const box = node?.closest('.box');
            if (!container || !box) return 0;
            return box.getBoundingClientRect().height / container.getBoundingClientRect().height;
        }, ideviceId);
        expect(ratio).toBeGreaterThan(0.8);
    });

    test('saving the iDevice exits focused mode and re-enables controls', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - save');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);
        await waitForFocusActive(page);

        await fillActiveEditor(page, 'Saved content');
        await saveIdevice(page, ideviceId);

        await waitForFocusInactive(page);
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/exe-disabled-during-focus/);
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).not.toHaveClass(new RegExp(NODE_CLASS));
    });

    test('discarding changes exits focused mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - discard');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);

        // Save first so the iDevice is persisted, then re-enter to discard cleanly.
        await ensureEditing(page, ideviceId);
        await fillActiveEditor(page, 'Persisted content');
        await saveIdevice(page, ideviceId);
        await waitForFocusInactive(page);

        await editIdevice(page, ideviceId);
        await waitForFocusActive(page);

        // Click discard and confirm.
        await page.locator(`.idevice_node[id="${ideviceId}"] .btn-undo-idevice`).click();
        await confirmModal(page);

        await waitForFocusInactive(page);
    });

    test('deleting the iDevice exits focused mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - delete');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);
        await waitForFocusActive(page);

        // Delete and confirm (an empty iDevice can be deleted without saving).
        await page.locator(`.idevice_node[id="${ideviceId}"] .btn-delete-idevice`).click();
        await confirmModal(page);
        await page.waitForFunction(id => !document.getElementById(id), ideviceId, { timeout: 10000 });

        await waitForFocusInactive(page);
    });

    test('recovers from leftover TinyMCE fullscreen state so the next edit stays usable', async ({
        authenticatedPage,
        createProject,
    }) => {
        // Regression for #1871 (pabloamayab). Saving an iDevice from TinyMCE
        // fullscreen used to leave a `tox-fullscreen` class on <html>/<body> (the
        // editor was destroyed before fullscreen teardown). That scroll-locked the
        // document and, via the `.tox-fullscreen` CSS guard, suspended the focus
        // layout for the NEXT edit — the editor looked blank and "an iDevice is
        // already being edited" blocked every other action. Entering edit mode
        // must strip the stale class and lay the overlay out on-screen.
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - leftover state recovery');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const id = await addSavedTextIdevice(page);

        // Reproduce the residue a save-from-fullscreen leaves behind.
        expect(await injectLeftoverFullscreenState(page)).toBe(true);

        await editIdevice(page, id);
        await waitForFocusActive(page);

        const state = await page.evaluate(ideviceId => {
            const box = document.getElementById(ideviceId)?.closest('.box');
            const rect = box?.getBoundingClientRect();
            return {
                htmlFullscreen: document.documentElement.classList.contains('tox-fullscreen'),
                bodyFullscreen: document.body.classList.contains('tox-fullscreen'),
                boxTop: rect ? Math.round(rect.top) : null,
                boxHeight: rect ? Math.round(rect.height) : 0,
                viewportH: window.innerHeight,
            };
        }, id);

        // Stale fullscreen residue cleared (document scroll no longer locked).
        expect(state.htmlFullscreen).toBe(false);
        expect(state.bodyFullscreen).toBe(false);
        // The focus overlay is laid out on-screen and visible (not suspended by
        // the leftover `.tox-fullscreen` guard, which would have made it static).
        expect(state.boxTop).not.toBeNull();
        expect(state.boxTop as number).toBeGreaterThanOrEqual(0);
        expect(state.boxTop as number).toBeLessThan(state.viewportH);
        expect(state.boxHeight).toBeGreaterThan(0);
    });

    test('locks the outer workarea scroll while editing', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Focused Edit - scroll lock');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);
        await waitForFocusActive(page);

        // The scroll container is locked while editing; only the editor body scrolls.
        const overflowY = await page.evaluate(() => {
            const el = document.getElementById('node-content-container');
            return el ? getComputedStyle(el).overflowY : '';
        });
        expect(overflowY).toBe('hidden');
    });
});
