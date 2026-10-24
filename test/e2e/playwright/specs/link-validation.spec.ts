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
// Browser-limited flavors list links instead of validating them, and the
// closing summary says so (review of PR #2208).
const completionText = isStaticMode ? 'Links listed' : 'Complete';

/**
 * Add a text iDevice with the given HTML and save it
 */
async function addLinksAndSave(page: Page, uuid: string, html: string): Promise<void> {
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addTextIdevice(page);

    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.activeEditor;
            return editor?.initialized && !editor.readonly;
        },
        undefined,
        { timeout: 15000 },
    );
    await page.evaluate(content => {
        const editor = (window as any).tinymce.activeEditor;
        editor.setContent(content);
        editor.nodeChanged();
    }, html);

    await page.locator('#node-content article .idevice_node.text .btn-save-idevice').first().click();
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

type LinkCheck = { status: 'valid' | 'broken' | 'unavailable'; error: string | null };

/**
 * Answer the server's link-check stream with fixed results, so these tests do not
 * depend on reaching real hosts. The server still extracts the links; the events
 * have the shape the validate-stream route yields. The validator itself is covered
 * end to end by the loopback test below and hermetically by link-validator.spec.ts.
 * Resolve `gate` to let the answer through; until then the check stays in progress.
 * Static mode has no stream, so the route never fires there.
 */
async function answerLinkChecks(page: Page, checks: Record<string, LinkCheck>, gate?: Promise<void>): Promise<void> {
    await page.route('**/odes/session/brokenlinks/validate-stream', async route => {
        const { links } = route.request().postDataJSON() as { links: { id: string; url: string }[] };
        await gate;
        const events = links.map(link => ({
            event: 'link-validated',
            data: JSON.stringify({ id: link.id, url: link.url, ...checks[link.url] }),
        }));
        events.push({ event: 'done', data: JSON.stringify({ complete: true, totalValidated: links.length }) });
        await route.fulfill({ contentType: 'text/event-stream', body: events.map(e => JSON.stringify(e)).join('') });
    });
}

/**
 * Wait until no link is still being checked
 */
async function waitForValidationEnd(page: Page): Promise<void> {
    await page.waitForFunction(
        () => document.querySelectorAll('#modalOdeBrokenLinks .spinner-border').length === 0,
        undefined,
        { timeout: 30000 },
    );
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

test.describe('Link Validation', () => {
    test('should progressively validate links showing status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Link Validation Test');

        // Reserved .test hosts (RFC 6761): nothing is ever fetched from them
        await answerLinkChecks(page, {
            'https://valid.test/': { status: 'valid', error: null },
            'https://broken.test/': { status: 'broken', error: '404' },
            'https://unavailable.test/': { status: 'unavailable', error: 'Timeout' },
        });
        await addLinksAndSave(
            page,
            uuid,
            `<p>Valid link: <a href="https://valid.test/">Valid</a></p>
            <p>Broken link: <a href="https://broken.test/">Broken</a></p>
            <p>Unavailable link: <a href="https://unavailable.test/">Unavailable</a></p>
            <p>Internal link (should be skipped): <a href="exe-node:page-123">Internal Page</a></p>`,
        );

        await openLinkValidationModal(page);

        // Verify modal opens immediately
        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        await waitForValidationEnd(page);

        const row = (host: string) => modal.locator('tr', { has: page.locator(`td.link-url:has-text("${host}")`) });

        // Each outcome gets its own mark when the server read the status; a plain
        // browser cannot, so every external link there requires manual review
        await expect(
            row('valid.test').locator(isStaticMode ? '.text-warning-emphasis' : '.text-success'),
        ).toBeVisible();
        await expect(
            row('broken.test').locator(isStaticMode ? '.text-warning-emphasis' : '.text-danger'),
        ).toBeVisible();
        await expect(
            row('unavailable.test').locator(isStaticMode ? '.text-warning-emphasis' : '.text-info-emphasis'),
        ).toBeVisible();
        if (!isStaticMode) {
            await expect(row('broken.test').locator('td.link-error')).toHaveText('404');
        }

        // Verify exe-node links are NOT shown (they should be skipped)
        const exeNodeLinks = modal.locator('td.link-url:has-text("exe-node")');
        await expect(exeNodeLinks).toHaveCount(0);

        // Every reported URL is clickable so it can be reviewed in a new tab
        // (review of PR #2208 by @ignaciogros)
        const validLink = row('valid.test').locator('td.link-url a');
        await expect(validLink).toHaveAttribute('href', 'https://valid.test/');
        await expect(validLink).toHaveAttribute('target', '_blank');
        await expect(validLink).toHaveAttribute('rel', 'noopener noreferrer');

        // The legend explains the possible outcomes
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

    test('should report a link the server refuses to check as broken', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Link Validation Loopback Test');

        // Not intercepted: the real validator answers. Its SSRF guard refuses
        // loopback addresses before any connection, so no network is involved.
        await addLinksAndSave(page, uuid, '<p><a href="http://127.0.0.1/">Loopback</a></p>');

        await openLinkValidationModal(page);
        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        await waitForValidationEnd(page);

        const loopbackRow = modal.locator('tr', { has: page.locator('td.link-url:has-text("127.0.0.1")') });
        if (isStaticMode) {
            await expect(loopbackRow.locator('.text-warning-emphasis')).toBeVisible();
        } else {
            await expect(loopbackRow.locator('.text-danger')).toBeVisible();
            await expect(loopbackRow.locator('td.link-error')).toHaveText('Blocked address');
        }
    });

    test('should show progress bar during validation', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Progress Bar Test');

        await answerLinkChecks(page, { 'https://valid.test/': { status: 'valid', error: null } });
        await addLinksAndSave(page, uuid, '<p><a href="https://valid.test/">Valid</a></p>');

        // Open modal
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Verify progress bar element exists (may not be visible if validation is fast)
        const progressBar = modal.locator('.progress-bar');
        await expect(progressBar).toBeAttached({ timeout: 5000 });

        // Verify progress text shows completion status
        const progressText = modal.locator('.progress-text');
        await expect(progressText).toContainText(completionText, { timeout: 30000 });
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

        // Hold the answer so the check is still in progress when the button is read
        let release!: () => void;
        const answered = new Promise<void>(resolve => {
            release = resolve;
        });
        await answerLinkChecks(
            page,
            {
                'https://valid.test/': { status: 'valid', error: null },
                'https://broken.test/': { status: 'broken', error: '404' },
            },
            answered,
        );
        await addLinksAndSave(
            page,
            uuid,
            '<p><a href="https://valid.test/">Valid</a></p><p><a href="https://broken.test/">Broken</a></p>',
        );

        // Open modal
        await openLinkValidationModal(page);

        const modal = page.locator('#modalOdeBrokenLinks');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        const csvButton = modal.locator('button.confirm');
        // Static mode checks nothing over the network, so it may already be done
        if (!isStaticMode) {
            await expect(modal.locator('.spinner-border').first()).toBeVisible();
            await expect(csvButton).toBeDisabled();
        }
        release();

        await waitForValidationEnd(page);

        // CSV button should now be enabled
        await expect(csvButton).toBeEnabled();
    });
});
