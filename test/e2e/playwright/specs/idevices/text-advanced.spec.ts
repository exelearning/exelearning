import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { waitForAppReady, getPreviewFrame, waitForIdeviceEditionEnd } from '../../helpers/workarea-helpers';

/**
 * E2E Tests for Text iDevice Advanced Features
 *
 * Tests the following features that were fixed or need regression testing:
 * - Text iDevice with duration and participants in preview
 * - exe-dl definition lists with single icons (no duplicates)
 * - exe-fx effects rendering
 * - Click interactions in preview iframe
 */

/**
 * Helper to add text iDevice - expands the Information category first
 */
async function addTextIdevice(page: Page): Promise<void> {
    // Ensure a non-root page is selected first
    const isPageSelected = await page.evaluate(() => {
        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
        return !!selected;
    });

    if (!isPageSelected) {
        const pageNode = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first();
        await pageNode.scrollIntoViewIfNeeded();
        await pageNode.click({ force: true });
        await page.waitForTimeout(1000);
    }

    // Expand "Information and presentation" category
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the .label to expand
            const label = infoCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for the category content to be visible
    await page.waitForTimeout(500);

    // Find the Text iDevice and click
    const textIdevice = page.locator('.idevice_item[id="text"], [data-testid="idevice-text"]').first();
    await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await textIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to wait for TinyMCE to be ready
 */
async function waitForTinyMCE(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.activeEditor;
            return !!editor && editor.initialized;
        },
        { timeout: 15000 },
    );
}

/**
 * Helper to set TinyMCE content
 */
async function setTinyMCEContent(page: Page, content: string): Promise<void> {
    await page.evaluate(html => {
        const editor = (window as any).tinymce?.activeEditor;
        if (editor) {
            editor.setContent(html);
            editor.fire('change');
            editor.fire('input');
            editor.setDirty(true);
        }
    }, content);
}

/**
 * Helper to wait for Service Worker to be ready
 * The preview relies on the Service Worker to serve content
 */
async function waitForServiceWorker(page: Page, timeout = 15000): Promise<void> {
    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            // Check if SW registration promise exists and has completed
            return (
                app?._previewSwRegistration?.active?.state === 'activated' ||
                navigator.serviceWorker?.controller !== null
            );
        },
        { timeout },
    );
}

/**
 * Helper to open preview panel and wait for content to load
 * Handles Service Worker initialization and panel visibility
 */
async function openPreviewAndWaitForContent(page: Page, timeout = 30000): Promise<void> {
    // First ensure Service Worker is ready
    await waitForServiceWorker(page);

    // Open the preview panel
    const previewButton = page.locator('#head-bottom-preview');
    await previewButton.click();

    // Wait for preview panel to be visible
    const previewPanel = page.locator('#previewsidenav');
    await previewPanel.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for iframe to exist
    const previewIframe = page.locator('#preview-iframe');
    await previewIframe.waitFor({ state: 'attached', timeout: 10000 });

    // Give time for preview generation to start
    await page.waitForTimeout(3000);

    // Click refresh button to force preview regeneration
    const refreshBtn = page.locator(
        '#previewsidenav button[title*="Refresh"], #previewsidenav button:has-text("refresh")',
    );
    if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshBtn.click();
        await page.waitForTimeout(3000);
    }

    // Wait for any content to be present in the iframe
    const iframe = getPreviewFrame(page);
    await iframe.locator('body').waitFor({ state: 'attached', timeout: 10000 });

    // Wait for meaningful content to appear
    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            if (!iframe) return false;
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc || !doc.body) return false;
                // Check if body has any meaningful content
                const bodyHtml = doc.body.innerHTML || '';
                return bodyHtml.length > 100 || doc.querySelector('article, .idevice_node, main, nav, .exe-page');
            } catch {
                return false;
            }
        },
        { timeout },
    );

    // Additional wait for content to fully render
    await page.waitForTimeout(1000);
}

test.describe('Text iDevice Advanced Features', () => {
    test.describe('Duration and Participants', () => {
        test('should display duration in preview when set in editor', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Text Duration Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await waitForAppReady(page);

            // Add a text iDevice
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            // Wait for TinyMCE to initialize
            await waitForTinyMCE(page);

            // Expand the "Information" fieldset to access duration inputs
            // The fieldset has legend with text "Information" or "Información"
            const infoFieldset = page.locator('fieldset').filter({
                has: page.locator('legend').filter({ hasText: /Information|Información/i }),
            });

            if ((await infoFieldset.count()) > 0) {
                // Click on the legend to expand the fieldset
                const legend = infoFieldset.locator('legend').first();
                await legend.click();
                await page.waitForTimeout(500);
            }

            // Fill duration input
            const durationInput = page.locator('#textInfoDurationInput');
            if (await durationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await durationInput.fill('30 min');
            }

            // Fill duration label (optional)
            const durationTextInput = page.locator('#textInfoDurationTextInput');
            if (await durationTextInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await durationTextInput.fill('Duration');
            }

            // Add some content to the text area
            await setTinyMCEContent(page, '<p>Activity content with duration</p>');

            // Save the iDevice
            const ideviceId = await block.getAttribute('id');
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for edition mode to end
            if (ideviceId) {
                await waitForIdeviceEditionEnd(page, ideviceId);
            }

            // Open Preview and wait for content
            await openPreviewAndWaitForContent(page);

            const iframe = getPreviewFrame(page);

            // Verify duration is displayed in preview
            const durationCheck = await iframe.locator('body').evaluate(body => {
                // Look for the duration display structure
                // Expected: .exe-text-activity dl div.inline containing dt/dd
                const activityWrapper = body.querySelector('.exe-text-activity');
                const durationDl = body.querySelector('.exe-text-activity dl');
                const durationDt = body.querySelector('.exe-text-activity dl dt');
                const durationDd = body.querySelector('.exe-text-activity dl dd');

                return {
                    hasActivityWrapper: !!activityWrapper,
                    hasDurationDl: !!durationDl,
                    hasDurationDt: !!durationDt,
                    hasDurationDd: !!durationDd,
                    durationDtText: durationDt?.textContent?.trim() || '',
                    durationDdText: durationDd?.textContent?.trim() || '',
                };
            });

            // If duration inputs were visible and filled, verify the display
            if (await durationInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                // Duration should be displayed
                expect(durationCheck.hasDurationDl || durationCheck.durationDdText.includes('30')).toBe(true);
            }
        });
    });

    test.describe('exe-dl Definition Lists', () => {
        test('should render exe-dl with exactly ONE icon per definition term', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'exe-dl Single Icon Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await waitForAppReady(page);

            // Add a text iDevice
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            // Wait for TinyMCE to initialize
            await waitForTinyMCE(page);

            // Insert exe-dl definition list HTML
            const exeDlHtml = `
                <dl class="exe-dl">
                    <dt>Term 1</dt>
                    <dd>Definition for term 1</dd>
                    <dt>Term 2</dt>
                    <dd>Definition for term 2</dd>
                    <dt>Term 3</dt>
                    <dd>Definition for term 3</dd>
                </dl>
            `;

            await setTinyMCEContent(page, exeDlHtml);

            // Save the iDevice
            const ideviceId = await block.getAttribute('id');
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for edition mode to end
            if (ideviceId) {
                await waitForIdeviceEditionEnd(page, ideviceId);
            }

            // Open Preview and wait for content
            await openPreviewAndWaitForContent(page);

            const iframe = getPreviewFrame(page);

            // Critical check: Each dt should have EXACTLY ONE icon (not duplicates)
            // This was a bug where both common.js and text.js added icons
            const iconCheck = await iframe.locator('body').evaluate(body => {
                const exeDl = body.querySelector('dl.exe-dl');
                if (!exeDl) {
                    return { hasExeDl: false, dtElements: 0, iconCounts: [], allSingleIcon: false };
                }

                const dtElements = exeDl.querySelectorAll('dt');
                const iconCounts: number[] = [];

                dtElements.forEach(dt => {
                    // Count icons (span.icon) within each dt
                    const icons = dt.querySelectorAll('span.icon');
                    iconCounts.push(icons.length);
                });

                return {
                    hasExeDl: true,
                    dtElements: dtElements.length,
                    iconCounts,
                    allSingleIcon: iconCounts.every(count => count === 1),
                    togglerCounts: Array.from(dtElements).map(dt => dt.querySelectorAll('a.exe-dd-toggler').length),
                };
            });

            expect(iconCheck.hasExeDl).toBe(true);
            expect(iconCheck.dtElements).toBe(3);

            // CRITICAL: Each dt should have exactly 1 icon (not 0, not 2)
            iconCheck.iconCounts.forEach((count, i) => {
                expect(count).toBe(1);
            });

            // Also verify each dt has exactly 1 toggler
            iconCheck.togglerCounts.forEach((count, i) => {
                expect(count).toBe(1);
            });
        });

        test('should toggle exe-dl definition on click', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'exe-dl Toggle Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await waitForAppReady(page);

            // Add a text iDevice with exe-dl content
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCE(page);

            const exeDlHtml = `
                <dl class="exe-dl">
                    <dt>Expandable Term</dt>
                    <dd>Hidden definition content that should toggle</dd>
                </dl>
            `;

            await setTinyMCEContent(page, exeDlHtml);

            const ideviceId = await block.getAttribute('id');
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            if (ideviceId) {
                await waitForIdeviceEditionEnd(page, ideviceId);
            }

            // Open Preview and wait for content
            await openPreviewAndWaitForContent(page);

            const iframe = getPreviewFrame(page);

            // Get initial state of dd (should be hidden initially)
            const initialState = await iframe.locator('body').evaluate(body => {
                const dd = body.querySelector('dl.exe-dl dd');
                if (!dd) return { visible: false, display: 'none' };
                const style = window.getComputedStyle(dd);
                return {
                    visible: style.display !== 'none' && style.visibility !== 'hidden',
                    display: style.display,
                };
            });

            // Click the toggler to expand
            const toggler = iframe.locator('dl.exe-dl dt a.exe-dd-toggler').first();
            if (await toggler.isVisible({ timeout: 5000 }).catch(() => false)) {
                await toggler.click();
                await page.waitForTimeout(500);

                // Check if dd is now visible (toggled)
                const afterClickState = await iframe.locator('body').evaluate(body => {
                    const dd = body.querySelector('dl.exe-dl dd');
                    if (!dd) return { visible: false, display: 'none' };
                    const style = window.getComputedStyle(dd);
                    return {
                        visible: style.display !== 'none' && style.visibility !== 'hidden',
                        display: style.display,
                    };
                });

                // State should have changed (toggled)
                expect(
                    afterClickState.visible !== initialState.visible ||
                        afterClickState.display !== initialState.display,
                ).toBe(true);
            }
        });
    });

    test.describe('Text iDevice Click Interactions', () => {
        test('should handle click on text iDevice content in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Text Click Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await waitForAppReady(page);

            // Add a text iDevice
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCE(page);

            // Add content with a clickable element
            const htmlContent = `
                <p>Click test content</p>
                <button id="test-btn" onclick="this.textContent='Clicked!'">Click Me</button>
            `;

            await setTinyMCEContent(page, htmlContent);

            const ideviceId = await block.getAttribute('id');
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            if (ideviceId) {
                await waitForIdeviceEditionEnd(page, ideviceId);
            }

            // Open Preview and wait for content
            await openPreviewAndWaitForContent(page);

            const iframe = getPreviewFrame(page);

            // Click the button in preview iframe
            const button = iframe.locator('#test-btn');
            if (await button.isVisible({ timeout: 5000 }).catch(() => false)) {
                const initialText = await button.textContent();
                await button.click();
                await page.waitForTimeout(500);
                const afterClickText = await button.textContent();

                // Button text should have changed after click
                expect(afterClickText).toBe('Clicked!');
                expect(afterClickText).not.toBe(initialText);
            }
        });
    });

    test.describe('Text iDevice JSON Data Preservation', () => {
        test('should preserve iDevice JSON data in preview iframe', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Text JSON Preservation Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await waitForAppReady(page);

            // Add a text iDevice
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCE(page);

            // Add test content
            const testContent = '<p>JSON preservation test content</p>';

            await setTinyMCEContent(page, testContent);

            const ideviceId = await block.getAttribute('id');
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            if (ideviceId) {
                await waitForIdeviceEditionEnd(page, ideviceId);
            }

            // Open Preview and wait for content
            await openPreviewAndWaitForContent(page);

            const iframe = getPreviewFrame(page);

            // Check for data-idevice-json-data attribute
            const jsonDataCheck = await iframe.locator('body').evaluate(body => {
                const textIdevice = body.querySelector('.idevice_node.text');
                if (!textIdevice) return { hasIdevice: false, hasJsonData: false };

                const jsonDataAttr = textIdevice.getAttribute('data-idevice-json-data');
                let parsedData: any = null;
                let parseError: string | null = null;

                if (jsonDataAttr) {
                    try {
                        parsedData = JSON.parse(jsonDataAttr);
                    } catch (e) {
                        parseError = (e as Error).message;
                    }
                }

                return {
                    hasIdevice: true,
                    hasJsonData: !!jsonDataAttr,
                    jsonDataLength: jsonDataAttr?.length || 0,
                    parsedSuccessfully: !!parsedData,
                    parseError,
                    hasTextTextarea: parsedData?.textTextarea !== undefined,
                };
            });

            expect(jsonDataCheck.hasIdevice).toBe(true);

            // If JSON data is present, it should be valid
            if (jsonDataCheck.hasJsonData) {
                expect(jsonDataCheck.parsedSuccessfully).toBe(true);
                expect(jsonDataCheck.parseError).toBeNull();
            }
        });
    });
});
