import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    editIdevice,
    saveIdevice,
    selectFirstPage,
    addPage,
} from '../../helpers/workarea-helpers';

/**
 * E2E coverage for the centralized iDevice edition teardown (Refs #2293, #2271).
 *
 * The unit suites prove the lifecycle disposes each resource class. What only a
 * real browser can prove is that the whole close sequence runs cleanly against
 * real edition scripts, real TinyMCE and a real Yjs document — in particular
 * that no `$exeDevice` TypeError escapes, on any exit path, including opening a
 * second iDevice straight after closing the first.
 */

/** Errors that are not related to the edition lifecycle and predate this work. */
const IGNORED_ERROR = /favicon\.ico|net::ERR|ResizeObserver loop|404 \(Not Found\)/i;

/**
 * Collect page errors and console errors for the whole test.
 *
 * A stale edition callback surfaces as an uncaught `TypeError` mentioning
 * `$exeDevice` or the method it tried to call, so both channels are needed:
 * handlers throw as `pageerror`, while rejected promises can land on `console`.
 */
function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    const add = (text: string) => {
        if (!IGNORED_ERROR.test(text)) errors.push(text);
    };
    page.on('pageerror', error => add(error.message));
    page.on('console', message => {
        if (message.type() === 'error') add(message.text());
    });
    return errors;
}

/** Read the id of the first text iDevice node. */
async function getTextIdeviceId(page: Page): Promise<string> {
    const node = page.locator('#node-content article .idevice_node.text').first();
    await node.waitFor({ state: 'attached', timeout: 15000 });
    const id = await node.getAttribute('id');
    if (!id) throw new Error('text iDevice id not found');
    return id;
}

/** Put content into the active TinyMCE editor: an empty text iDevice cannot be saved. */
async function fillActiveEditor(page: Page, text: string): Promise<void> {
    await page.waitForFunction(
        () => {
            return (window as any).tinymce?.activeEditor?.initialized === true;
        },
        undefined,
        { timeout: 15000 },
    );
    await page.evaluate(value => {
        const editor = (window as any).tinymce.activeEditor;
        editor.setContent(`<p>${value}</p>`);
        editor.fire('change');
    }, text);
}

/** Wait until the given node has left edition mode, or disappeared entirely. */
async function waitForEditionClosed(page: Page, ideviceId: string): Promise<void> {
    await page.waitForFunction(
        id => {
            const node = document.getElementById(id);
            return !node || node.getAttribute('mode') !== 'edition';
        },
        ideviceId,
        { timeout: 20000 },
    );
}

/** Leave edition through a confirm-backed button (discard / delete). */
async function exitViaConfirm(page: Page, ideviceId: string, button: string): Promise<void> {
    await page.locator(`.idevice_node[id="${ideviceId}"] ${button}`).first().click();
    await expect(page.locator('#modalConfirm')).toBeVisible({ timeout: 10000 });
    await page.locator('#modalConfirm .modal-footer button').first().click();
    await waitForEditionClosed(page, ideviceId);
}

/**
 * The global is the thing the issue is about: after every close path it must be
 * released, and no lifecycle may still be registered as active.
 */
async function readEditionGlobals(page: Page): Promise<{ device: string; lifecycle: boolean }> {
    return page.evaluate(() => ({
        device: typeof (window as any).$exeDevice,
        lifecycle: !!(window as any).$exeEditionLifecycle,
    }));
}

test.describe('iDevice edition lifecycle (#2293)', () => {
    for (const exit of ['save', 'discard', 'delete'] as const) {
        test(`releases the edition when leaving through ${exit}`, async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const errors = collectErrors(page);

            const projectUuid = await createProject(page, `Edition lifecycle ${exit}`);
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addTextIdevice(page);
            const ideviceId = await getTextIdeviceId(page);
            await fillActiveEditor(page, `Lifecycle ${exit}`);

            if (exit === 'save') {
                await saveIdevice(page, ideviceId);
            } else {
                const button = exit === 'discard' ? '.btn-undo-idevice' : '.btn-delete-idevice';
                await exitViaConfirm(page, ideviceId, button);
            }

            const globals = await readEditionGlobals(page);
            expect(globals.device).toBe('undefined');
            expect(globals.lifecycle).toBe(false);

            expect(errors, `errors while leaving edition through ${exit}:\n${errors.join('\n')}`).toEqual([]);
        });
    }

    /**
     * The regression #2293 exists for: after A closes, B becomes the global. A
     * callback left behind by A must reach neither A nor B.
     */
    test('opening a second iDevice after closing the first leaves no stale edition', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const errors = collectErrors(page);

        const projectUuid = await createProject(page, 'Edition lifecycle switch');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const firstId = await getTextIdeviceId(page);
        await fillActiveEditor(page, 'First iDevice');
        await saveIdevice(page, firstId);

        // A second iDevice becomes the new owner of the global.
        await addTextIdevice(page);
        const secondId = await page.evaluate(first => {
            const nodes = Array.from(document.querySelectorAll('#node-content article .idevice_node.text'));
            const other = nodes.find(node => node.id !== first);
            return other ? other.id : '';
        }, firstId);
        expect(secondId).not.toBe('');
        expect(secondId).not.toBe(firstId);

        await fillActiveEditor(page, 'Second iDevice');

        // Exactly one lifecycle is registered, and it belongs to the open editor.
        const whileEditing = await page.evaluate(() => ({
            device: typeof (window as any).$exeDevice,
            hasLifecycle: !!(window as any).$exeEditionLifecycle,
            active: (window as any).$exeEditionLifecycle?.isActive?.() === true,
        }));
        expect(whileEditing.device).toBe('object');
        expect(whileEditing.hasLifecycle).toBe(true);
        expect(whileEditing.active).toBe(true);

        await saveIdevice(page, secondId);

        const globals = await readEditionGlobals(page);
        expect(globals.device).toBe('undefined');
        expect(globals.lifecycle).toBe(false);

        // The first iDevice must still be intact — nothing from its closed
        // edition may have been applied to it or removed from it.
        await expect(page.locator(`.idevice_node[id="${firstId}"]`)).toHaveCount(1);
        await expect(page.locator(`.idevice_node[id="${firstId}"]`)).toHaveAttribute('mode', 'export');

        expect(errors, `errors while switching editors:\n${errors.join('\n')}`).toEqual([]);
    });

    /**
     * Rapid open/close cycles are where a leaked timer or handler accumulates:
     * each round would add another live listener firing against a dead editor.
     */
    test('survives repeated open and close cycles', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = collectErrors(page);

        const projectUuid = await createProject(page, 'Edition lifecycle churn');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await fillActiveEditor(page, 'Churn');
        await saveIdevice(page, ideviceId);

        for (let round = 0; round < 3; round++) {
            await editIdevice(page, ideviceId);
            await fillActiveEditor(page, `Churn ${round}`);
            await saveIdevice(page, ideviceId);

            const globals = await readEditionGlobals(page);
            expect(globals.device, `round ${round} left $exeDevice set`).toBe('undefined');
            expect(globals.lifecycle, `round ${round} left a lifecycle registered`).toBe(false);
        }

        expect(errors, `errors during repeated edit cycles:\n${errors.join('\n')}`).toEqual([]);
    });

    /**
     * Switching pages discards the node content wholesale, without going through
     * IdeviceNode.remove(). That path had no teardown at all before #2293.
     */
    test('releases the edition when the page content is discarded', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const errors = collectErrors(page);

        const projectUuid = await createProject(page, 'Edition lifecycle page switch');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addTextIdevice(page);
        const ideviceId = await getTextIdeviceId(page);
        await fillActiveEditor(page, 'Page switch');
        await saveIdevice(page, ideviceId);

        // Add a second page and navigate to it, discarding the current content.
        const secondPageId = await addPage(page, 'Second page');
        await page.locator(`.nav-element[nav-id="${secondPageId}"] .nav-element-text`).first().click();
        await page.waitForFunction(
            () => !document.querySelector('#node-content article .idevice_node.text'),
            undefined,
            { timeout: 15000 },
        );

        const globals = await readEditionGlobals(page);
        expect(globals.lifecycle).toBe(false);

        expect(errors, `errors while switching pages:\n${errors.join('\n')}`).toEqual([]);
    });
});
