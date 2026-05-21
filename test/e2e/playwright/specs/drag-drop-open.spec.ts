import { readFileSync } from 'fs';
import path from 'path';
import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for drag-and-drop opening of .elpx/.elp files (Issue #1836).
 *
 * Dropping a project file onto the editor window must open it through the same
 * funnel as the File menu, including the "save current project?" prompt when
 * there are unsaved changes.
 */

const FIXTURE = path.resolve(__dirname, '../../../fixtures/basic-example.elp');

/**
 * Simulate a real file drop with the given fixture file.
 *
 * The drop is dispatched on a DEEP nested element (not window) so the test
 * exercises the real propagation path: the handler must catch the drop before
 * any descendant stopPropagation() and cancel the browser's native file open.
 * Returns whether the native default was prevented.
 */
async function dropFileDeep(page: Page, fixturePath: string): Promise<boolean> {
    const base64 = readFileSync(fixturePath).toString('base64');
    const name = path.basename(fixturePath);

    return page.evaluate(
        ({ base64, name }) => {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const file = new File([bytes], name, { type: 'application/octet-stream' });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const target =
                document.querySelector('#node-content') || document.querySelector('#workarea') || document.body;

            const event = new DragEvent('drop', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
            target.dispatchEvent(event);
            return event.defaultPrevented;
        },
        { base64, name },
    );
}

test.describe('Drag-and-drop open', () => {
    test('dropping an .elp file opens the project', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Drag Drop Open Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const prevented = await dropFileDeep(page, FIXTURE);
        // The browser's native file open must be cancelled even for a deep drop.
        expect(prevented).toBe(true);

        // Same convergence point as the File menu: navigation pages get populated.
        await page.waitForFunction(
            () => {
                try {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const docManager = bridge?.getDocumentManager?.();
                    if (!docManager || !docManager.initialized) return false;
                    const navigation = docManager.getDoc()?.getArray('navigation');
                    return navigation && navigation.length >= 1;
                } catch {
                    return false;
                }
            },
            undefined,
            { timeout: 90000 },
        );
    });

    test('dropping a file with unsaved changes prompts to save first', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Dirty-state setup mirrors open-project-clean-state, skipped in static');
        }

        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Drag Drop Save Prompt Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            undefined,
            { timeout: 10000 },
        );

        // Dirty the document so the save prompt should appear on open.
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('title', 'Edited before drop');
        });
        await page.waitForTimeout(300);

        await dropFileDeep(page, FIXTURE);

        // The same "save current project?" dialog used by a normal Open appears.
        const sessionModal = page.locator('#modalSessionLogout');
        await expect(sessionModal).toBeVisible({ timeout: 10000 });
    });
});
