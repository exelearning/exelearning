/**
 * E2E Tests for Progressive Link Validation
 *
 * Tests the link validation modal that shows all links immediately with spinners,
 * then updates each to show valid (checkmark) or broken (X) status as validation completes.
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper to add a text iDevice to the current page
 */
async function addTextIdevice(page: Page): Promise<void> {
    // Select a page (not root)
    const pageNode = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first();
    await pageNode.scrollIntoViewIfNeeded();
    await pageNode.click({ force: true });
    await page.waitForTimeout(1500);

    // Try quick text button first
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        // Expand "Information and presentation" category (accordion)
        const infoCategory = page
            .locator('#menu_idevices .accordion-item')
            .filter({ hasText: /Information|Información/i })
            .locator('.accordion-button');

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.first().evaluate(el => el.classList.contains('collapsed'));
            if (isCollapsed) {
                await infoCategory.first().click();
                await page.waitForTimeout(500);
            }
        }

        // Add a text iDevice - wait for it to be visible first
        const textIdevice = page.locator('.idevice_item[id="text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to open the link validation modal
 */
async function openLinkValidationModal(page: Page): Promise<void> {
    // Open Utilities dropdown
    await page.locator('#dropdownUtilities').click();
    await page.waitForTimeout(300);

    // Click on Link Validation option
    const linkValidationBtn = page.locator('#navbar-button-odebrokenlinks');
    await expect(linkValidationBtn).toBeVisible({ timeout: 5000 });
    await linkValidationBtn.click();
}

/**
 * Helper to wait for workarea to be ready
 */
async function waitForWorkarea(page: Page): Promise<void> {
    // Wait for Yjs bridge initialization
    await page.waitForFunction(() => window.eXeLearning?.app?.project?._yjsBridge !== undefined, {
        timeout: 30000,
    });

    // Wait for loading screen to disappear
    await page.waitForFunction(
        () => {
            const loadScreen = document.querySelector('#load-screen-main');
            return !loadScreen || loadScreen.getAttribute('data-visible') === 'false';
        },
        { timeout: 15000 },
    );
}

test.describe('Link Validation', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        await page.fill('input[type="email"]', 'user@exelearning.net');
        await page.fill('input[type="password"]', '1234');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
    });

    test('should progressively validate links showing status', async ({ page }) => {
        // Create project
        const response = await page.request.post('/api/project/create-quick', {
            data: { title: 'Link Validation Test' },
        });
        const { uuid } = await response.json();

        // Navigate to workarea
        await page.goto(`/workarea?project=${uuid}`);
        await page.waitForLoadState('networkidle');
        await waitForWorkarea(page);

        // Add text iDevice
        await addTextIdevice(page);

        // Wait for TinyMCE editor to be fully ready (editor exists and is editable)
        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return editor?.initialized && !editor.readonly;
            },
            { timeout: 15000 },
        );

        // Add content with links via TinyMCE
        const contentSet = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            if (editor) {
                // HTML with links: valid google.com, broken domain, internal exe-node (should be skipped)
                const htmlWithLinks = `
                    <p>Valid link: <a href="https://www.google.com">Google</a></p>
                    <p>Broken link: <a href="https://this-domain-definitely-does-not-exist-xyz123.com">Broken</a></p>
                    <p>Internal link (should be skipped): <a href="exe-node:page-123">Internal Page</a></p>
                `;
                editor.setContent(htmlWithLinks);
                editor.nodeChanged();
                // Verify content was set
                return editor.getContent().includes('google.com');
            }
            return false;
        });

        expect(contentSet).toBe(true);

        // Wait a bit for Yjs sync
        await page.waitForTimeout(500);

        // Save the iDevice to commit the content
        const saveBtn = page.locator('#node-content article .idevice_node.text .btn-save-idevice').first();
        await saveBtn.click();

        // Wait for iDevice to exit edit mode
        await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 15000 },
        );

        await page.waitForTimeout(1000);

        // Open link validation modal
        await openLinkValidationModal(page);

        // Verify modal opens immediately
        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Wait for validation to complete (spinners disappear)
        // Note: Spinners might appear briefly or validation might complete quickly
        await page.waitForFunction(
            () => {
                const modal = document.querySelector('#modalOdeBrokenLinks');
                const spinners = modal?.querySelectorAll('.spinner-border');
                return spinners?.length === 0;
            },
            { timeout: 60000 },
        );

        // Verify google.com is valid (checkmark)
        const googleRow = modal.locator('tr', {
            has: page.locator('td.link-url:has-text("google.com")'),
        });
        await expect(googleRow.locator('.text-success')).toBeVisible();

        // Verify broken domain shows error (X mark)
        const brokenRow = modal.locator('tr', {
            has: page.locator('td.link-url:has-text("this-domain-definitely")'),
        });
        await expect(brokenRow.locator('.text-danger')).toBeVisible();

        // Verify exe-node links are NOT shown (they should be skipped)
        const exeNodeLinks = modal.locator('td.link-url:has-text("exe-node")');
        await expect(exeNodeLinks).toHaveCount(0);

        // Verify CSV button is enabled after validation completes
        const csvButton = modal.locator('button.confirm');
        await expect(csvButton).toBeEnabled();
    });

    test('should show progress bar during validation', async ({ page }) => {
        // Create project
        const response = await page.request.post('/api/project/create-quick', {
            data: { title: 'Progress Bar Test' },
        });
        const { uuid } = await response.json();

        // Navigate to workarea
        await page.goto(`/workarea?project=${uuid}`);
        await page.waitForLoadState('networkidle');
        await waitForWorkarea(page);

        // Add text iDevice
        await addTextIdevice(page);

        // Wait for TinyMCE editor to be ready
        await page.waitForSelector('.tox-tinymce', { timeout: 15000 });

        // Add content with just one link to test progress
        await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            if (editor) {
                const html = '<p><a href="https://www.google.com">Google</a></p>';
                editor.setContent(html);
                editor.nodeChanged();
            }
        });

        // Save the iDevice to commit the content
        const saveBtn = page.locator('#node-content article .idevice_node.text .btn-save-idevice').first();
        await saveBtn.click();

        // Wait for iDevice to exit edit mode
        await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 15000 },
        );

        // Open modal
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Verify progress bar element exists (may not be visible if validation is fast)
        const progressBar = modal.locator('.progress-bar');
        await expect(progressBar).toBeAttached({ timeout: 5000 });

        // Wait for completion
        await page.waitForFunction(
            () => {
                const progressText = document.querySelector('#modalOdeBrokenLinks .progress-text');
                return progressText?.textContent?.includes('Complete');
            },
            { timeout: 30000 },
        );

        // Verify progress text shows completion status
        const progressText = modal.locator('.progress-text');
        await expect(progressText).toContainText('Complete');
    });

    test('should show "No links found" for empty content', async ({ page }) => {
        // Create project
        const response = await page.request.post('/api/project/create-quick', {
            data: { title: 'Empty Content Test' },
        });
        const { uuid } = await response.json();

        // Navigate to workarea (project starts with no content)
        await page.goto(`/workarea?project=${uuid}`);
        await page.waitForLoadState('networkidle');
        await waitForWorkarea(page);

        // Open link validation modal without adding any content
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Should show "No links found" message
        await expect(modal.locator('text=No links found')).toBeVisible({ timeout: 10000 });
    });

    test('should disable CSV button while validating', async ({ page }) => {
        // Create project
        const response = await page.request.post('/api/project/create-quick', {
            data: { title: 'CSV Button Test' },
        });
        const { uuid } = await response.json();

        // Navigate to workarea
        await page.goto(`/workarea?project=${uuid}`);
        await page.waitForLoadState('networkidle');
        await waitForWorkarea(page);

        // Add text iDevice
        await addTextIdevice(page);

        // Wait for TinyMCE editor to be fully ready
        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return editor?.initialized && !editor.readonly;
            },
            { timeout: 15000 },
        );

        // Add content with multiple links to make validation take longer
        const contentSet = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            if (editor) {
                // Multiple links to slow down validation
                const html = `
                    <p><a href="https://www.google.com">Google</a></p>
                    <p><a href="https://www.github.com">GitHub</a></p>
                    <p><a href="https://www.example.com">Example</a></p>
                `;
                editor.setContent(html);
                editor.nodeChanged();
                return editor.getContent().includes('google.com');
            }
            return false;
        });

        expect(contentSet).toBe(true);
        await page.waitForTimeout(500);

        // Save the iDevice to commit the content
        const saveBtn = page.locator('#node-content article .idevice_node.text .btn-save-idevice').first();
        await saveBtn.click();

        // Wait for iDevice to exit edit mode
        await page.waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.text');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 15000 },
        );

        // Open modal
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Check that validation is in progress OR has completed
        // Note: With fast validation, we may not catch the disabled state
        const csvButton = modal.locator('button.confirm');

        // Either the button is disabled (validation in progress) or validation already completed
        const initialState = await page.evaluate(() => {
            const modal = document.querySelector('#modalOdeBrokenLinks');
            const spinners = modal?.querySelectorAll('.spinner-border');
            const button = modal?.querySelector('button.confirm') as HTMLButtonElement;
            return {
                hasSpinners: (spinners?.length ?? 0) > 0,
                isButtonDisabled: button?.disabled ?? false,
            };
        });

        // If spinners are present, button should be disabled
        if (initialState.hasSpinners) {
            await expect(csvButton).toBeDisabled();
        }

        // Wait for validation to complete
        await page.waitForFunction(
            () => {
                const modal = document.querySelector('#modalOdeBrokenLinks');
                const spinners = modal?.querySelectorAll('.spinner-border');
                return spinners?.length === 0;
            },
            { timeout: 60000 },
        );

        // CSV button should now be enabled
        await expect(csvButton).toBeEnabled();
    });
});
