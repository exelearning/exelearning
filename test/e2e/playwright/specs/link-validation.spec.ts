/**
 * E2E Tests for Progressive Link Validation
 *
 * Tests the link validation modal that shows all links immediately with spinners,
 * then updates each to show valid (checkmark), broken (X) or "requires manual
 * review" (warning sign) as validation completes.
 */

import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, addTextIdevice, selectFirstPage, gotoWorkarea } from '../helpers/workarea-helpers';
import { Page } from '@playwright/test';

/**
 * In static mode the check runs in a plain browser, where CORS makes every
 * cross-origin response opaque: no external link can be checked at all, so all
 * of them are reported as "requires manual review" and the modal explains the
 * limitation up front. The server-side validator (online mode) and the
 * Electron main process (desktop app) read the real HTTP status instead.
 */
const isStaticMode = process.env.STATIC_MODE === 'true';
const reachableLinkIcon = isStaticMode ? '.text-warning-emphasis' : '.text-success';
const brokenLinkIcon = isStaticMode ? '.text-warning-emphasis' : '.text-danger';
// Browser-limited flavors list links instead of validating them, and the
// closing summary says so (review of PR #2208).
const completionText = isStaticMode ? 'Links listed' : 'Complete';

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

test.describe('Link Validation', () => {
    test('should progressively validate links showing status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Link Validation Test');

        // Navigate to workarea
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Select a page first, then add text iDevice
        await selectFirstPage(page);
        await addTextIdevice(page);

        // Wait for TinyMCE editor to be fully ready (editor exists and is editable)
        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return editor?.initialized && !editor.readonly;
            },
            undefined,
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
            undefined,
            { timeout: 15000 },
        );

        await page.waitForTimeout(500);

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
            undefined,
            { timeout: 60000 },
        );

        // Verify google.com is reported as reachable: a checkmark when the server
        // read its status, a manual-review warning when only the browser could look
        const googleRow = modal.locator('tr', {
            has: page.locator('td.link-url:has-text("google.com")'),
        });
        await expect(googleRow.locator(reachableLinkIcon)).toBeVisible();

        // Verify the broken domain shows an error: an X mark when the status
        // could actually be read, the manual-review warning in a plain browser
        const brokenRow = modal.locator('tr', {
            has: page.locator('td.link-url:has-text("this-domain-definitely")'),
        });
        await expect(brokenRow.locator(brokenLinkIcon)).toBeVisible();

        // Verify exe-node links are NOT shown (they should be skipped)
        const exeNodeLinks = modal.locator('td.link-url:has-text("exe-node")');
        await expect(exeNodeLinks).toHaveCount(0);

        // Every reported URL is clickable so it can be reviewed in a new tab
        // (review of PR #2208 by @ignaciogros)
        const googleLink = googleRow.locator('td.link-url a');
        await expect(googleLink).toHaveAttribute('href', /google\.com/);
        await expect(googleLink).toHaveAttribute('target', '_blank');
        await expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer');

        // The legend explains the three possible outcomes
        await expect(modal.locator('.validation-legend')).toContainText('Requires manual review');

        // Browser-limited flavors say up front that external links cannot be
        // checked automatically; flavors with real statuses show no such notice
        const staticNotice = modal.locator('.validation-static-notice');
        if (isStaticMode) {
            await expect(staticNotice).toBeVisible();
            await expect(staticNotice).toContainText('browser security restrictions');
        } else {
            await expect(staticNotice).toHaveCount(0);
        }

        // Verify CSV button is enabled after validation completes
        const csvButton = modal.locator('button.confirm');
        await expect(csvButton).toBeEnabled();
    });

    test('should show progress bar during validation', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Progress Bar Test');

        // Navigate to workarea
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Select a page first, then add text iDevice
        await selectFirstPage(page);
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
            undefined,
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
            expected => {
                const progressText = document.querySelector('#modalOdeBrokenLinks .progress-text');
                return progressText?.textContent?.includes(expected);
            },
            completionText,
            { timeout: 30000 },
        );

        // Verify progress text shows completion status
        const progressText = modal.locator('.progress-text');
        await expect(progressText).toContainText(completionText);
    });

    test('should show "No links found" for empty content', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Empty Content Test');

        // Navigate to workarea (project starts with no content)
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Open link validation modal without adding any content
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Should show "No links found" message
        await expect(modal.locator('text=No links found')).toBeVisible({ timeout: 10000 });
    });

    test('should disable CSV button while validating', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'CSV Button Test');

        // Navigate to workarea
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Select a page first, then add text iDevice
        await selectFirstPage(page);
        await addTextIdevice(page);

        // Wait for TinyMCE editor to be fully ready
        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.activeEditor;
                return editor?.initialized && !editor.readonly;
            },
            undefined,
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
            undefined,
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
            undefined,
            { timeout: 60000 },
        );

        // CSV button should now be enabled
        await expect(csvButton).toBeEnabled();
    });
});
