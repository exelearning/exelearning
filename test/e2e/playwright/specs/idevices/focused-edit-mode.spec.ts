import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    editIdevice,
    saveIdevice,
} from '../../helpers/workarea-helpers';

/**
 * E2E tests for the experimental focused full-workarea iDevice edit mode
 * (Refs #1811, #1411).
 *
 * Verifies that entering iDevice edit mode applies the focused layout/state,
 * that every exit path (save / discard / delete) tears it down, that the outer
 * workarea is locked while the editor body fills the workarea, and that the
 * experiment can be disabled at runtime.
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

/**
 * Opt into the experiment (it is OFF by default). Must be called before
 * navigating to the workarea so the flag is present when the app boots.
 */
async function enableFocusMode(page): Promise<void> {
    await page.addInitScript(() => {
        try {
            window.localStorage.setItem('exe.experimentalIdeviceFocusedEditMode', '1');
        } catch {
            /* ignore */
        }
    });
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

test.describe('Focused iDevice edit mode (experiment)', () => {
    test('entering edit mode applies focused state and disables global controls', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await enableFocusMode(page);
        const projectUuid = await createProject(page, 'Focused Edit - enter');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);

        await waitForFocusActive(page);

        // The edited node is marked as the focused surface.
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).toHaveClass(new RegExp(NODE_CLASS));

        // Global save is visibly + accessibly disabled (but not via the
        // `disabled` attribute, which saveButton.js owns).
        const save = page.locator('#head-top-save-button');
        await expect(save).toHaveAttribute('aria-disabled', 'true');
        await expect(save).toHaveClass(/exe-disabled-during-focus/);

        // The bottom quick toolbar is hidden during focused editing.
        await expect(page.locator('#idevices-bottom')).toBeHidden();

        // A polite live region announces the editing state.
        const live = page.locator('#exe-focus-editing-live');
        await expect(live).toHaveAttribute('aria-live', 'polite');
        await expect(live).not.toBeEmpty();
    });

    test('the focused editor fills the content workarea', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await enableFocusMode(page);
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
        await enableFocusMode(page);
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
        await expect(page.locator('#head-top-save-button')).not.toHaveAttribute('aria-disabled', 'true');
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).not.toHaveClass(new RegExp(NODE_CLASS));
    });

    test('discarding changes exits focused mode', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await enableFocusMode(page);
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
        await enableFocusMode(page);
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

    test('is off by default (no opt-in) and does not alter editing', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        // NOTE: enableFocusMode() is intentionally NOT called here.
        const projectUuid = await createProject(page, 'Focused Edit - disabled');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await ensureEditing(page, ideviceId);

        // Focused state must NOT be applied, and global controls stay enabled.
        await page.waitForTimeout(500);
        expect(await page.evaluate(cls => document.body.classList.contains(cls), BODY_CLASS)).toBe(false);
        await expect(page.locator('#head-top-save-button')).not.toHaveAttribute('aria-disabled', 'true');
    });
});
