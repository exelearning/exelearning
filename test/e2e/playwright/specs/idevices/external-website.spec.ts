import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for External Website iDevice
 *
 * Tests the External Website iDevice functionality including:
 * - Basic operations (add, set URL, select frame height, save)
 * - URL validation (empty, invalid, valid)
 * - Frame height options (small, medium, large, super-size)
 * - Preview rendering with iframe
 * - Persistence after reload
 */

const TEST_DATA = {
    projectTitle: 'External Website E2E Test Project',
    // Use a reliable HTTPS URL that allows embedding
    validUrl: 'https://example.com',
    // Another URL for testing changes
    alternativeUrl: 'https://www.wikipedia.org',
    // Frame heights by option value
    frameHeights: {
        small: 200,
        medium: 300,
        large: 500,
        superSize: 800,
    },
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
 * Helper to add an External Website iDevice by expanding the category and clicking the iDevice
 */
async function addExternalWebsiteIdeviceFromPanel(page: Page): Promise<void> {
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

    // Find and click the External Website iDevice
    const externalWebsiteIdevice = page.locator('.idevice_item[id="external-website"]').first();
    await externalWebsiteIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await externalWebsiteIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.external-website').first().waitFor({ timeout: 15000 });

    // Wait for the form to be created
    await page.waitForTimeout(1000);

    // Wait for the URL input to be visible
    await page
        .waitForFunction(
            () => {
                const urlInput = document.querySelector('#websiteUrl');
                return urlInput !== null;
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to set the URL in the iDevice form
 */
async function setWebsiteUrl(page: Page, url: string): Promise<void> {
    const urlInput = page.locator('#websiteUrl');
    await urlInput.waitFor({ state: 'visible', timeout: 5000 });
    await urlInput.clear();
    await urlInput.fill(url);
}

/**
 * Helper to set the frame height option
 */
async function setFrameHeight(page: Page, option: 'small' | 'medium' | 'large' | 'super-size'): Promise<void> {
    const sizeSelector = page.locator('#sizeSelector');
    await sizeSelector.waitFor({ state: 'visible', timeout: 5000 });

    const optionValue = {
        small: '1',
        medium: '2',
        large: '3',
        'super-size': '4',
    }[option];

    await sizeSelector.selectOption(optionValue);
}

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Helper to save the external-website iDevice
 */
async function saveExternalWebsiteIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.external-website').last();
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        await closeAlertModals(page);
        await saveBtn.click();
    }

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Wait for edition mode to end or iframe to appear
    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.external-website');
                const iframe = document.querySelector('#node-content .external-website #iframeWebsiteIdevice iframe');
                return (idevice && idevice.getAttribute('mode') !== 'edition') || iframe !== null;
            },
            { timeout: 10000 },
        )
        .catch(() => {});

    await page.waitForTimeout(500);
}

/**
 * Helper to verify iframe in preview
 */
async function verifyIframeInPreview(
    iframe: FrameLocator,
    expectedUrl: string,
    expectedHeight?: number,
): Promise<void> {
    // Wait for the iframe container
    await iframe.locator('#iframeWebsiteIdevice').first().waitFor({ state: 'visible', timeout: 10000 });

    // Check the iframe src
    const embeddedIframe = iframe.locator('#iframeWebsiteIdevice iframe').first();
    await expect(embeddedIframe).toBeVisible({ timeout: 10000 });

    const src = await embeddedIframe.getAttribute('src');
    expect(src).toBe(expectedUrl);

    if (expectedHeight) {
        const height = await embeddedIframe.getAttribute('height');
        expect(height).toBe(String(expectedHeight));
    }
}

test.describe('External Website iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add external-website iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Add Test');
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

            // Add an External Website iDevice
            await addExternalWebsiteIdeviceFromPanel(page);

            // Verify iDevice was added
            const externalWebsiteIdevice = page.locator('#node-content article .idevice_node.external-website').first();
            await expect(externalWebsiteIdevice).toBeVisible({ timeout: 10000 });

            // Verify the form is visible with URL input
            const urlInput = page.locator('#websiteUrl');
            await expect(urlInput).toBeVisible({ timeout: 5000 });

            // Verify the size selector is visible
            const sizeSelector = page.locator('#sizeSelector');
            await expect(sizeSelector).toBeVisible({ timeout: 5000 });

            // Verify the default size is "medium"
            const selectedOption = await sizeSelector.inputValue();
            expect(selectedOption).toBe('2'); // medium = 2
        });

        test('should set URL and save iDevice', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website URL Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set URL
            await setWebsiteUrl(page, TEST_DATA.validUrl);

            // Save the iDevice
            await saveExternalWebsiteIdevice(page);

            // Verify the iDevice is saved and shows the iframe container
            const iframeContainer = page.locator('#node-content .external-website #iframeWebsiteIdevice');
            await expect(iframeContainer).toBeAttached({ timeout: 10000 });

            // Verify the iframe has the correct src
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const src = await iframe.getAttribute('src');
            expect(src).toBe(TEST_DATA.validUrl);
        });

        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Persist Test');
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

            // Add iDevice and set URL
            await addExternalWebsiteIdeviceFromPanel(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await saveExternalWebsiteIdevice(page);

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
                        const idevice = document.querySelector('#node-content .external-website');
                        return idevice !== null;
                    },
                    { timeout: 15000 },
                )
                .catch(() => {});

            // Verify the iDevice is still there with the iframe
            const iframeContainer = page.locator('#node-content .external-website #iframeWebsiteIdevice');
            await expect(iframeContainer).toBeAttached({ timeout: 15000 });

            // Verify the iframe has the correct src
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const src = await iframe.getAttribute('src');
            expect(src).toBe(TEST_DATA.validUrl);
        });
    });

    test.describe('Frame Height Options', () => {
        test('should set small frame height', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Small Height Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set URL and small frame height
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'small');

            // Save the iDevice
            await saveExternalWebsiteIdevice(page);

            // Verify the iframe has the correct height (200px for small)
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const height = await iframe.getAttribute('height');
            expect(height).toBe('200');
        });

        test('should set large frame height', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Large Height Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set URL and large frame height
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'large');

            // Save the iDevice
            await saveExternalWebsiteIdevice(page);

            // Verify the iframe has the correct height (500px for large)
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const height = await iframe.getAttribute('height');
            expect(height).toBe('500');
        });

        test('should set super-size frame height', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website SuperSize Height Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set URL and super-size frame height
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'super-size');

            // Save the iDevice
            await saveExternalWebsiteIdevice(page);

            // Verify the iframe has the correct height (800px for super-size)
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const height = await iframe.getAttribute('height');
            expect(height).toBe('800');
        });
    });

    test.describe('URL Validation', () => {
        test('should show error for empty URL', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Empty URL Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Don't set URL (leave empty) and try to save
            const block = page.locator('#node-content article .idevice_node.external-website').last();
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for alert modal to appear
            await page.waitForTimeout(1000);

            // Check if an alert modal appeared
            const alertModal = page.locator('#modalAlert[data-open="true"], .modal.show');
            await expect(alertModal).toBeVisible({ timeout: 5000 });

            // Close the alert
            await closeAlertModals(page);
        });

        test('should show error for invalid URL', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website Invalid URL Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set invalid URL
            await setWebsiteUrl(page, 'not-a-valid-url');

            // Try to save
            const block = page.locator('#node-content article .idevice_node.external-website').last();
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for alert modal to appear
            await page.waitForTimeout(1000);

            // Check if an alert modal appeared
            const alertModal = page.locator('#modalAlert[data-open="true"], .modal.show');
            await expect(alertModal).toBeVisible({ timeout: 5000 });

            // Close the alert
            await closeAlertModals(page);
        });

        test('should accept valid HTTPS URL', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'External Website HTTPS URL Test');
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
            await addExternalWebsiteIdeviceFromPanel(page);

            // Set valid HTTPS URL
            await setWebsiteUrl(page, 'https://www.example.org');

            // Save the iDevice
            await saveExternalWebsiteIdevice(page);

            // Verify the iframe was created with correct src
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            await expect(iframe).toBeAttached({ timeout: 10000 });

            const src = await iframe.getAttribute('src');
            expect(src).toBe('https://www.example.org');
        });
    });

    test.describe('Preview Panel', () => {
        test('should display iframe correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Preview Test');
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

            // Add iDevice and set URL
            await addExternalWebsiteIdeviceFromPanel(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await saveExternalWebsiteIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Verify the iframe container is visible in preview
            await verifyIframeInPreview(iframe, TEST_DATA.validUrl);
        });

        test('should display iframe with correct height in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Preview Height Test');
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

            // Add iDevice with large frame height
            await addExternalWebsiteIdeviceFromPanel(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'large');
            await saveExternalWebsiteIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Verify the iframe has correct height (500px for large)
            await verifyIframeInPreview(iframe, TEST_DATA.validUrl, 500);
        });
    });

    test.describe('Edit Mode', () => {
        test('should load previous URL when editing', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Edit Test');
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

            // Add iDevice with URL
            await addExternalWebsiteIdeviceFromPanel(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await setFrameHeight(page, 'large');
            await saveExternalWebsiteIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Click edit button to enter edit mode
            const editBtn = page.locator('#node-content .external-website button:has-text("Edit")').first();
            await editBtn.click();
            await page.waitForTimeout(1500);

            // Wait for the form to load
            await page.locator('#websiteUrl').waitFor({ state: 'visible', timeout: 10000 });

            // Verify the URL is loaded in the input
            const urlInput = page.locator('#websiteUrl');
            const loadedUrl = await urlInput.inputValue();
            expect(loadedUrl).toBe(TEST_DATA.validUrl);

            // Verify the size option is loaded
            const sizeSelector = page.locator('#sizeSelector');
            const selectedOption = await sizeSelector.inputValue();
            expect(selectedOption).toBe('3'); // large = 3
        });

        test('should update URL when re-editing', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'External Website Update Test');
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

            // Add iDevice with initial URL
            await addExternalWebsiteIdeviceFromPanel(page);
            await setWebsiteUrl(page, TEST_DATA.validUrl);
            await saveExternalWebsiteIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Click edit button to enter edit mode
            const editBtn = page.locator('#node-content .external-website button:has-text("Edit")').first();
            await editBtn.click();
            await page.waitForTimeout(1500);

            // Wait for the form to load
            await page.locator('#websiteUrl').waitFor({ state: 'visible', timeout: 10000 });

            // Update the URL
            await setWebsiteUrl(page, TEST_DATA.alternativeUrl);

            // Save again
            await saveExternalWebsiteIdevice(page);

            // Verify the new URL is set
            const iframe = page.locator('#node-content .external-website #iframeWebsiteIdevice iframe');
            const src = await iframe.getAttribute('src');
            expect(src).toBe(TEST_DATA.alternativeUrl);
        });
    });
});
