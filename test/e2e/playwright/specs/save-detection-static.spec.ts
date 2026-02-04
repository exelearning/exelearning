import { test, expect } from '../fixtures/static.fixture';
import { waitForAppReady, openElpFile } from '../helpers/workarea-helpers';
import * as path from 'path';

test.describe('Save Detection - Static', () => {
    const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');

    test('static starts clean and does not prompt on New', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirty).toBe(false);

        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/saved/);

        let dialogTriggered = false;
        page.on('dialog', async dialog => {
            dialogTriggered = true;
            await dialog.dismiss();
        });

        await page.locator('#dropdownFile').click();
        await page.waitForTimeout(200);
        await page.locator('#navbar-button-new').click();
        await page.waitForTimeout(500);

        expect(dialogTriggered).toBe(false);
    });

    test('static beforeunload only warns when dirty', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        await page.dispatchEvent('body', 'pointerdown');
        await page.waitForFunction(() => typeof window.onbeforeunload === 'function', { timeout: 5000 });

        const cleanResult = await page.evaluate(() => {
            const evt = { preventDefault: () => {}, returnValue: undefined };
            const handler = window.onbeforeunload;
            const ret = handler ? handler(evt) : undefined;
            return { ret, returnValue: evt.returnValue };
        });
        expect(cleanResult.returnValue).toBeUndefined();

        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Static Dirty Title');
        });
        await page.waitForTimeout(300);

        const dirtyResult = await page.evaluate(() => {
            const evt = { preventDefault: () => {}, returnValue: undefined };
            const handler = window.onbeforeunload;
            const ret = handler ? handler(evt) : undefined;
            return { ret, returnValue: evt.returnValue };
        });
        expect(dirtyResult.returnValue).toBe('');
    });

    test('static opening ELPX starts clean and becomes dirty after changes', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        await openElpFile(page, FIXTURE_PATH, 1);

        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        const isDirtyAfterOpen = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirtyAfterOpen).toBe(false);

        const saveButtonAfterOpen = page.locator('#head-top-save-button');
        await expect(saveButtonAfterOpen).toHaveClass(/saved/);

        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('author', 'Static Change');
        });
        await page.waitForTimeout(300);

        const isDirtyAfterChange = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirtyAfterChange).toBe(true);

        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/unsaved/);
    });

    test('static save (download) clears dirty state', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Static Save Clears Dirty');
        });
        await page.waitForTimeout(300);

        const saveIndicator = page.locator('#head-top-save-button');
        await expect(saveIndicator).toHaveClass(/unsaved/);

        await page.evaluate(() => {
            const btn = document.getElementById('head-top-download-button');
            btn?.click();
        });

        await page.waitForFunction(
            () => {
                const btn = document.getElementById('head-top-save-button');
                return btn?.classList.contains('saved');
            },
            { timeout: 10000 },
        );
    });

    test('static open shows save prompt when dirty', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Static Open Prompt');
            bridge.documentManager.markDirty();
        });
        await page.waitForTimeout(300);

        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirty).toBe(true);

        const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
        await page.locator('#dropdownFile').click();
        await page.waitForTimeout(200);
        await page.locator('#navbar-button-open-offline').click();

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(FIXTURE_PATH);

        const modal = page.locator('#modalSessionLogout');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        await modal.locator('button.session-logout-without-save').click();
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
    });

    test('static new shows save prompt when dirty', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only tests');
        const page = staticPage;

        await waitForAppReady(page);
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Static New Prompt');
            bridge.documentManager.markDirty();
        });
        await page.waitForTimeout(300);

        await page.locator('#dropdownFile').click();
        await page.waitForTimeout(200);
        await page.locator('#navbar-button-new').click();

        const modal = page.locator('#modalSessionLogout');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        await modal.locator('button.session-logout-without-save').click();
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
    });
});
