/**
 * E2E Tests for: radioexploradores.elp
 *
 * This legacy ELP file tests import of the "Relate" (Relaciona) iDevice:
 *
 * ## Relate iDevice
 * - Should have `relate` type in Yjs
 * - Should have jsonProperties with cardsGame array
 * - JSON should be decrypted correctly (typeGame: "Relaciona")
 * - Edit button should be enabled
 */
import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { Page } from '@playwright/test';

const ELP_FIXTURE = 'radioexploradores.elp';

/**
 * Open the ELP fixture via File menu -> Open
 * This opens the file as a new project (replacing the current one)
 */
async function openElpFixture(page: Page): Promise<void> {
    const fixturePath = path.resolve(__dirname, `../../../fixtures/more/${ELP_FIXTURE}`);

    // Open File menu
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    // Click Open option (not Import)
    const openOption = page.locator('#navbar-button-openuserodefiles');
    await expect(openOption).toBeVisible({ timeout: 5000 });
    await openOption.click();

    // Wait for the Open modal to appear
    const openModal = page.locator('#modalOpenUserOdeFiles');
    await expect(openModal).toBeVisible({ timeout: 10000 });

    // Setup file chooser BEFORE clicking the upload button
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });

    // Click "Select a file from your device" button in the modal
    const uploadButton = openModal.locator('.ode-files-button-upload');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // Handle "Open without saving" confirmation dialog - it appears when opening a file
    // while another project is already open
    const sessionLogoutModal = page.locator('#modalSessionLogout');
    try {
        await sessionLogoutModal.waitFor({ state: 'visible', timeout: 5000 });
        const openWithoutSavingBtn = sessionLogoutModal.locator('button.session-logout-without-save');
        await openWithoutSavingBtn.click();
    } catch {
        // Modal didn't appear - that's fine, continue
    }

    // Wait for file to be processed - Yjs navigation has pages
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const docManager = bridge.getDocumentManager();
                if (!docManager || !docManager.initialized) return false;
                const yDoc = docManager.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= 1;
            } catch {
                // Document may be reinitializing, wait and retry
                return false;
            }
        },
        { timeout: 90000 },
    );

    // Wait for loading screen to hide
    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        { timeout: 30000 },
    );

    // Wait for import progress overlay to disappear (if present)
    await page.waitForFunction(() => !document.querySelector('#import-progress-overlay'), { timeout: 30000 });

    // Additional wait for all handlers to complete
    await page.waitForTimeout(3000);
}

/**
 * Get iDevice data directly from Yjs by searching for component type
 * This is more reliable than DOM queries since iDevice editors may not be installed
 */
async function getIdeviceDataFromYjs(page: Page, ideviceType: string) {
    return await page.evaluate(targetType => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge) return { error: 'No yjsBridge' };
        const yDoc = bridge.getDocumentManager()?.getDoc();
        if (!yDoc) return { error: 'No yDoc' };

        // Search through navigation -> pages -> blocks -> components
        const navigation = yDoc.getArray('navigation');
        let comp = null;
        let pageName = '';

        const searchInPage = (pageMap: any, depth: number): boolean => {
            const name = pageMap?.get('name') || `Page ${depth}`;
            const blocks = pageMap?.get('blocks');

            if (blocks) {
                for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
                    const blockMap = blocks.get(blockIdx);
                    const components = blockMap?.get('components');
                    if (components) {
                        for (let compIdx = 0; compIdx < components.length; compIdx++) {
                            const c = components.get(compIdx);
                            if (c?.get('type') === targetType) {
                                comp = c;
                                pageName = name;
                                return true;
                            }
                        }
                    }
                }
            }

            // Search in subpages
            const subpages = pageMap?.get('pages');
            if (subpages) {
                for (let i = 0; i < subpages.length; i++) {
                    if (searchInPage(subpages.get(i), depth + 1)) {
                        return true;
                    }
                }
            }

            return false;
        };

        for (let pageIdx = 0; pageIdx < navigation.length && !comp; pageIdx++) {
            const pageMap = navigation.get(pageIdx);
            searchInPage(pageMap, 0);
        }

        if (!comp) return { error: `Component with type ${targetType} not found in Yjs` };

        const type = comp.get('type');
        const id = comp.get('id');
        const jsonPropsStr = comp.get('jsonProperties');
        let jsonProperties = null;

        if (jsonPropsStr) {
            try {
                jsonProperties = typeof jsonPropsStr === 'string' ? JSON.parse(jsonPropsStr) : jsonPropsStr;
            } catch {
                return { error: 'Failed to parse jsonProperties', type, elementId: id };
            }
        }

        // Check if DOM element exists and Edit button state
        const element = document.getElementById(id);
        const editBtn = element?.querySelector('.btn-edit-idevice');
        const isEditDisabled = editBtn?.hasAttribute('disabled') || editBtn?.classList.contains('disabled');

        return {
            elementId: id,
            type,
            jsonProperties,
            pageName,
            editButtonEnabled: element ? !isEditDisabled : null,
            hasCorrectClass: element?.classList.contains(targetType) ?? false,
            domElementExists: !!element,
        };
    }, ideviceType);
}

test.describe('radioexploradores.elp Import Tests', () => {
    test.describe('Relate (Relaciona) iDevice', () => {
        test('should import relate iDevice with correct type and cardsGame data', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Relate Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
                timeout: 30000,
            });

            await page.waitForFunction(
                () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
                { timeout: 30000 },
            );

            // Open ELP
            await openElpFixture(page);

            // Get relate data directly from Yjs
            const relateData = await getIdeviceDataFromYjs(page, 'relate');

            // Assertions - check Yjs data
            expect(relateData.error).toBeUndefined();
            expect(relateData.type).toBe('relate');

            // Check JSON is decrypted (should have typeGame property)
            expect(relateData.jsonProperties).toBeDefined();
            expect(relateData.jsonProperties.typeGame).toBe('Relaciona');

            // Check cardsGame has cards (relate uses cardsGame)
            expect(relateData.jsonProperties.cardsGame).toBeDefined();
            expect(relateData.jsonProperties.cardsGame.length).toBeGreaterThan(0);

            // Check first card has expected structure (eText for text content)
            const firstCard = relateData.jsonProperties.cardsGame[0];
            expect(firstCard.eText).toBeDefined();
            expect(firstCard.eTextBk).toBeDefined();
        });

        test('should have Edit button enabled after import', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Relate Edit Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
                timeout: 30000,
            });

            await page.waitForFunction(
                () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
                { timeout: 30000 },
            );

            // Open ELP
            await openElpFixture(page);

            // Find which page contains the relate iDevice
            const pageWithRelate = await page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return null;
                const yDoc = bridge.getDocumentManager()?.getDoc();
                if (!yDoc) return null;

                const navigation = yDoc.getArray('navigation');

                const searchInPage = (pageMap: any): string | null => {
                    const pageId = pageMap?.get('id');
                    const blocks = pageMap?.get('blocks');

                    if (blocks) {
                        for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
                            const blockMap = blocks.get(blockIdx);
                            const components = blockMap?.get('components');
                            if (components) {
                                for (let compIdx = 0; compIdx < components.length; compIdx++) {
                                    const c = components.get(compIdx);
                                    if (c?.get('type') === 'relate') {
                                        return pageId;
                                    }
                                }
                            }
                        }
                    }

                    // Search in subpages
                    const subpages = pageMap?.get('pages');
                    if (subpages) {
                        for (let i = 0; i < subpages.length; i++) {
                            const found = searchInPage(subpages.get(i));
                            if (found) return found;
                        }
                    }
                    return null;
                };

                for (let pageIdx = 0; pageIdx < navigation.length; pageIdx++) {
                    const pageMap = navigation.get(pageIdx);
                    const found = searchInPage(pageMap);
                    if (found) return found;
                }
                return null;
            });

            expect(pageWithRelate).not.toBeNull();

            // Navigate to the page containing the relate iDevice
            await page.evaluate((pageId: string) => {
                (window as any).eXeLearning?.app?.project?.structure?.selectNode(pageId);
            }, pageWithRelate!);

            // Wait for the page to render
            await page.waitForTimeout(1000);

            // Get relate data and check Edit button
            const relateData = await getIdeviceDataFromYjs(page, 'relate');

            expect(relateData.error).toBeUndefined();
            expect(relateData.domElementExists).toBe(true);
            // Edit button should be enabled (not disabled)
            expect(relateData.editButtonEnabled).toBe(true);
        });
    });

    test.describe('All iDevices', () => {
        test('should import all legacy iDevices without critical errors', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const errors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    const text = msg.text();
                    // Only collect import-related errors
                    if (
                        text.includes('import') ||
                        text.includes('handler') ||
                        text.includes('legacy') ||
                        text.includes('decrypt')
                    ) {
                        errors.push(text);
                    }
                }
            });

            const projectUuid = await createProject(page, 'Full Import Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined, {
                timeout: 30000,
            });

            await page.waitForFunction(
                () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
                { timeout: 30000 },
            );

            // Open ELP
            await openElpFixture(page);

            // Wait for processing
            await page.waitForTimeout(3000);

            // Verify no critical errors
            expect(errors.length).toBeLessThan(5);

            // Verify navigation has content in Yjs
            const navInfo = await page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return { error: 'No yjsBridge' };
                const yDoc = bridge.getDocumentManager()?.getDoc();
                if (!yDoc) return { error: 'No yDoc' };

                const navigation = yDoc.getArray('navigation');
                return {
                    pageCount: navigation.length,
                    hasContent: navigation.length > 0,
                };
            });

            expect(navInfo.hasContent).toBe(true);
            expect(navInfo.pageCount).toBeGreaterThanOrEqual(1);
        });
    });
});
