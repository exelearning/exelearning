import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Download Source File iDevice
 *
 * Tests the Download Source File iDevice functionality including:
 * - Basic operations (add, configure, save)
 * - Button customization (text, colors, font size)
 * - Preview rendering with download link
 * - Verification that exportSource is enabled by default
 */

const TEST_DATA = {
    projectTitle: 'Download Source File E2E Test Project',
    defaultButtonText: 'Download .elp file',
    customButtonText: 'Get Project File',
    defaultBgColor: '#107275',
    customBgColor: '#ff5500',
    defaultTextColor: '#ffffff',
    customTextColor: '#000000',
};

/**
 * Helper to select a page in the navigation tree (required before adding iDevices)
 */
async function selectPageNode(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        const treeItem = page.locator('#menu_structure .structure-tree li').first();
        if ((await treeItem.count()) > 0) {
            await treeItem.click({ force: true });
        }
    }

    await page.waitForTimeout(1000);

    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to add a Download Source File iDevice by expanding the category and clicking the iDevice
 */
async function addDownloadSourceFileIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    // Expand "Information and presentation" category
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            const label = infoCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    await page.waitForTimeout(500);

    // Find and click the Download Source File iDevice
    const downloadIdevice = page.locator('.idevice_item[id="download-source-file"]').first();
    await downloadIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await downloadIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.download-source-file').first().waitFor({ timeout: 15000 });

    // Wait for the form to be created
    await page.waitForTimeout(1000);

    // Wait for the TinyMCE editor to be visible
    await page
        .waitForFunction(
            () => {
                const editor = document.querySelector('.tox-editor-header');
                return editor !== null;
            },
            { timeout: 15000 },
        )
        .catch(() => {});
}

/**
 * Helper to set the button text
 */
async function setButtonText(page: Page, text: string): Promise<void> {
    const buttonTextInput = page.locator('#dpiButtonText');
    await buttonTextInput.waitFor({ state: 'visible', timeout: 5000 });

    // Use JavaScript to set value directly - more reliable across browsers
    await buttonTextInput.evaluate((input, newText) => {
        const el = input as HTMLInputElement;
        el.value = newText;
        // Trigger input and change events so the iDevice picks up the change
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);

    // Wait for the change to be processed
    await page.waitForTimeout(500);
}

/**
 * Helper to set button background color
 */
async function setButtonBgColor(page: Page, color: string): Promise<void> {
    const colorInput = page.locator('#dpiButtonBGcolor');
    await colorInput.waitFor({ state: 'visible', timeout: 5000 });
    await colorInput.fill(color);
    // Wait for input to be processed (Firefox needs more time)
    await page.waitForTimeout(300);
}

/**
 * Helper to set button text color
 */
async function setButtonTextColor(page: Page, color: string): Promise<void> {
    const colorInput = page.locator('#dpiButtonTextColor');
    await colorInput.waitFor({ state: 'visible', timeout: 5000 });
    await colorInput.fill(color);
    // Wait for input to be processed (Firefox needs more time)
    await page.waitForTimeout(300);
}

/**
 * Helper to set font size
 */
async function setFontSize(page: Page, option: '1' | '1.1' | '1.2' | '1.3' | '1.4' | '1.5'): Promise<void> {
    const fontSizeSelect = page.locator('#dpiButtonFontSize');
    await fontSizeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await fontSizeSelect.selectOption(option);
    // Wait for selection to be processed (Firefox needs more time)
    await page.waitForTimeout(300);
}

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    // Try multiple times to close any modals
    for (let i = 0; i < 3; i++) {
        const modal = page.locator('#modalAlert[data-open="true"], .modal.show');
        if ((await modal.count()) > 0) {
            // Wait for modal to be fully visible
            await page.waitForTimeout(300);

            // Try various close button selectors - the modal uses "Close" text
            const closeBtn = modal
                .locator(
                    'button:has-text("Close"), button:has-text("Cerrar"), button:has-text("OK"), button:has-text("Aceptar"), .btn-secondary[data-dismiss="modal"], button.close[data-dismiss="modal"]',
                )
                .first();
            if ((await closeBtn.count()) > 0) {
                await closeBtn.click({ force: true });
                await page.waitForTimeout(500);
            } else {
                // Try clicking the X button in the header as fallback
                const xBtn = modal.locator('.modal-header .close').first();
                if ((await xBtn.count()) > 0) {
                    await xBtn.click({ force: true });
                    await page.waitForTimeout(500);
                }
            }
        } else {
            break;
        }
    }
}

/**
 * Helper to save the download-source-file iDevice
 */
async function saveDownloadSourceFileIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.download-source-file').last();
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        await closeAlertModals(page);
        await saveBtn.click();
    }

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Wait for edition mode to end
    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.download-source-file');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 10000 },
        )
        .catch(() => {});

    await page.waitForTimeout(500);
}

/**
 * Helper to verify download link in preview
 */
async function verifyDownloadLinkInPreview(
    iframe: FrameLocator,
    expectedButtonText?: string,
    expectedBgColor?: string,
): Promise<void> {
    // Wait for the download link container
    const downloadLink = iframe.locator('.exe-download-package-link a').first();
    await downloadLink.waitFor({ state: 'visible', timeout: 10000 });

    if (expectedButtonText) {
        const buttonText = await downloadLink.textContent();
        expect(buttonText?.trim()).toBe(expectedButtonText);
    }

    if (expectedBgColor) {
        const style = await downloadLink.getAttribute('style');
        expect(style).toContain(expectedBgColor);
    }

    // Verify the onclick handler is present (indicates proper export transformation)
    const onclick = await downloadLink.getAttribute('onclick');
    expect(onclick).toContain('downloadElpx');
}

test.describe('Download Source File iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add download-source-file iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Add Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add a Download Source File iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);

            // Verify iDevice was added
            const downloadIdevice = page.locator('#node-content article .idevice_node.download-source-file').first();
            await expect(downloadIdevice).toBeVisible({ timeout: 10000 });

            // Verify the form elements are visible
            const buttonTextInput = page.locator('#dpiButtonText');
            await expect(buttonTextInput).toBeVisible({ timeout: 5000 });

            const bgColorInput = page.locator('#dpiButtonBGcolor');
            await expect(bgColorInput).toBeVisible({ timeout: 5000 });

            const textColorInput = page.locator('#dpiButtonTextColor');
            await expect(textColorInput).toBeVisible({ timeout: 5000 });

            const fontSizeSelect = page.locator('#dpiButtonFontSize');
            await expect(fontSizeSelect).toBeVisible({ timeout: 5000 });
        });

        test('should save iDevice with default values', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Save Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);

            // Save with default values
            await saveDownloadSourceFileIdevice(page);

            // Verify the iDevice is saved and shows the download link
            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            await expect(downloadLink).toBeAttached({ timeout: 10000 });
        });

        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Persist Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice and set custom button text
            await addDownloadSourceFileIdeviceFromPanel(page);
            await setButtonText(page, TEST_DATA.customButtonText);
            await saveDownloadSourceFileIdevice(page);

            // Save the project
            await workarea.save();
            await page.waitForTimeout(2000);

            // Reload the page
            await page.reload();
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Navigate to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(2000);
            }

            // Wait for the iDevice to be rendered
            await page
                .waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content .download-source-file');
                        return idevice !== null;
                    },
                    { timeout: 15000 },
                )
                .catch(() => {});

            // Verify the download link has the custom text
            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            await expect(downloadLink).toBeAttached({ timeout: 15000 });

            const buttonText = await downloadLink.textContent();
            expect(buttonText?.trim()).toBe(TEST_DATA.customButtonText);
        });
    });

    test.describe('Customization', () => {
        test('should set custom button text', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Custom Text Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);

            // Set custom button text
            await setButtonText(page, TEST_DATA.customButtonText);

            // Save the iDevice
            await saveDownloadSourceFileIdevice(page);

            // Verify the button text
            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            const buttonText = await downloadLink.textContent();
            expect(buttonText?.trim()).toBe(TEST_DATA.customButtonText);
        });

        test('should set custom background color', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Custom Color Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);

            // Set custom background color
            await setButtonBgColor(page, TEST_DATA.customBgColor);

            // Save the iDevice
            await saveDownloadSourceFileIdevice(page);

            // Verify the button has the custom color
            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            const style = await downloadLink.getAttribute('style');
            expect(style).toContain(TEST_DATA.customBgColor);
        });

        test('should set custom font size', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Download Source File Font Size Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);

            // Set font size to 130%
            await setFontSize(page, '1.3');

            // Save the iDevice
            await saveDownloadSourceFileIdevice(page);

            // Verify the button has the custom font size
            const downloadLink = page.locator('#node-content .download-source-file .exe-download-package-link a');
            const style = await downloadLink.getAttribute('style');
            expect(style).toContain('font-size:1.3em');
        });
    });

    test.describe('Preview Panel', () => {
        test('should display download link correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Preview Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice and set custom values
            await addDownloadSourceFileIdeviceFromPanel(page);
            await setButtonText(page, TEST_DATA.customButtonText);
            await setButtonBgColor(page, TEST_DATA.customBgColor);
            await saveDownloadSourceFileIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify the download link in preview
            await verifyDownloadLinkInPreview(iframe, TEST_DATA.customButtonText, TEST_DATA.customBgColor);
        });

        test('should have ELPX download functionality in preview via postMessage', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Manifest Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);
            await saveDownloadSourceFileIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Check that preview has downloadElpx function available
            // With SW-based preview, we use manifest-based download approach
            const downloadInfo = await iframe.locator('html').evaluate(() => {
                const win = window as any;
                const fnSource = win.downloadElpx?.toString() || '';
                return {
                    hasDownloadElpx: typeof win.downloadElpx === 'function',
                    // SW preview uses manifest-based approach (checks for __ELPX_MANIFEST__)
                    hasManifestLogic: fnSource.includes('__ELPX_MANIFEST__'),
                    // Legacy blob preview uses postMessage approach
                    hasPostMessageLogic: fnSource.includes('postMessage') && fnSource.includes('exe-download-elpx'),
                };
            });

            expect(downloadInfo.hasDownloadElpx).toBe(true);
            // Either manifest-based (SW preview) or postMessage-based (legacy) is valid
            expect(downloadInfo.hasManifestLogic || downloadInfo.hasPostMessageLogic).toBe(true);

            // Verify onclick handler is present (indicates proper export with ELPX download support)
            const downloadLink = iframe.locator('.exe-download-package-link a').first();
            await downloadLink.waitFor({ state: 'visible', timeout: 10000 });
            const onclick = await downloadLink.getAttribute('onclick');
            expect(onclick).toBeTruthy();
            expect(onclick).toContain('downloadElpx');
        });

        test('should show project info table in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Info Table Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice
            await addDownloadSourceFileIdeviceFromPanel(page);
            await saveDownloadSourceFileIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify the project info table is present
            const infoTable = iframe.locator('.exe-download-package-instructions .exe-package-info').first();
            await expect(infoTable).toBeVisible({ timeout: 10000 });

            // Verify table has expected headers (Title, Description, Authorship, License)
            const tableHeaders = iframe.locator('.exe-download-package-instructions .exe-package-info th');
            const headerCount = await tableHeaders.count();
            expect(headerCount).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Edit Mode', () => {
        test('should load previous values when editing', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Download Source File Edit Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add iDevice with custom values
            await addDownloadSourceFileIdeviceFromPanel(page);
            await setButtonText(page, TEST_DATA.customButtonText);
            await setButtonBgColor(page, TEST_DATA.customBgColor);
            await setFontSize(page, '1.2');
            await saveDownloadSourceFileIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Click edit button to enter edit mode
            const editBtn = page.locator('#node-content .download-source-file button:has-text("Edit")').first();
            await editBtn.click();
            await page.waitForTimeout(1500);

            // Wait for the form to load
            await page.locator('#dpiButtonText').waitFor({ state: 'visible', timeout: 10000 });

            // Verify the values are loaded correctly
            const buttonTextInput = page.locator('#dpiButtonText');
            const loadedText = await buttonTextInput.inputValue();
            expect(loadedText).toBe(TEST_DATA.customButtonText);

            // Verify the font size option is loaded
            const fontSizeSelect = page.locator('#dpiButtonFontSize');
            const selectedOption = await fontSizeSelect.inputValue();
            expect(selectedOption).toBe('1.2');
        });
    });
});
