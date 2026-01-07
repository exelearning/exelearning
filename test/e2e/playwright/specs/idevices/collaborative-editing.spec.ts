import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Collaborative Editing iDevice
 *
 * Tests the Lexical-based collaborative text editor functionality including:
 * - Basic operations (add, edit, save)
 * - Text formatting
 * - Preview rendering
 */

/**
 * Helper to select a page node in the navigation tree
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

    // Wait for page content area to be ready
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
 * Helper to add collaborative-editing iDevice from panel
 */
async function addCollaborativeEditingIdevice(page: Page): Promise<void> {
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

    // Find and click the collaborative-editing iDevice
    const collabIdevice = page.locator('.idevice_item[id="collaborative-editing"]').first();
    await collabIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await collabIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.collaborative-editing').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to wait for Lexical editor to be ready
 */
async function waitForLexicalEditor(page: Page): Promise<void> {
    // Wait for Lexical editor to initialize
    await page.waitForFunction(
        () => {
            const editor = document.querySelector('.lexical-editor [contenteditable="true"]');
            return editor !== null;
        },
        { timeout: 20000 },
    );
}

test.describe('Collaborative Editing iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add collaborative-editing iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'Collab Edit Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            // Wait for app initialization
            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add collaborative-editing iDevice
            await addCollaborativeEditingIdevice(page);

            // Verify iDevice was added
            const collabIdevice = page.locator('#node-content article .idevice_node.collaborative-editing').first();
            await expect(collabIdevice).toBeVisible({ timeout: 10000 });
        });

        test('should show Lexical editor when iDevice is added', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Lexical Editor Test');
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
            await addCollaborativeEditingIdevice(page);

            // Wait for Lexical editor
            await waitForLexicalEditor(page);

            // Verify Lexical editor exists
            const lexicalEditor = page.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(lexicalEditor).toBeVisible({ timeout: 10000 });
        });

        test('should type content in Lexical editor', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Type Content Test');
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
            await addCollaborativeEditingIdevice(page);
            await waitForLexicalEditor(page);

            // Get editor and type content via Lexical API
            const editor = page.locator('.lexical-editor [contenteditable="true"]').first();

            // Click to focus and type using keyboard
            await editor.click();
            await page.waitForTimeout(500);
            await page.keyboard.type('Hello collaborative world!');

            // Verify content was typed
            await expect(editor).toContainText('Hello collaborative world!', { timeout: 10000 });
        });

        test('should show toolbar with formatting buttons', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Toolbar Test');
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
            await addCollaborativeEditingIdevice(page);
            await waitForLexicalEditor(page);

            // Verify toolbar exists (TinyMCE-like toolbar)
            const toolbar = page.locator('.lexical-toolbar-wrapper').first();
            await expect(toolbar).toBeVisible({ timeout: 10000 });

            // Verify button rows container exists
            const buttonRows = toolbar.locator('.lexical-button-rows');
            await expect(buttonRows).toBeVisible();

            // Verify toolbar row exists
            const toolbarRow = toolbar.locator('.lexical-toolbar-row');
            await expect(toolbarRow.first()).toBeVisible();

            // Verify some toolbar buttons exist
            const boldButton = toolbar.locator('.lexical-toolbar-btn[data-name="bold"]');
            const italicButton = toolbar.locator('.lexical-toolbar-btn[data-name="italic"]');

            await expect(boldButton).toBeVisible();
            await expect(italicButton).toBeVisible();
        });

        test('should apply bold formatting', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Bold Format Test');
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
            await addCollaborativeEditingIdevice(page);
            await waitForLexicalEditor(page);

            // Type some content in the Lexical editor
            const editor = page.locator('.lexical-editor [contenteditable="true"]').first();

            // Click to focus and type
            await editor.click();
            await page.waitForTimeout(500);
            await page.keyboard.type('Bold text');

            // Wait for text to appear
            await expect(editor).toContainText('Bold text', { timeout: 10000 });

            // Select all text using platform-aware shortcut
            const isMac = process.platform === 'darwin';
            await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
            await page.waitForTimeout(500);

            // Apply bold using keyboard shortcut (more reliable than clicking toolbar)
            await page.keyboard.press(isMac ? 'Meta+b' : 'Control+b');
            await page.waitForTimeout(1000);

            // Verify bold tag exists (Lexical uses <strong> or <b>)
            const boldText = editor.locator('strong, b');
            await expect(boldText).toBeVisible({ timeout: 10000 });
        });

        test('should have feedback section', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Feedback Section Test');
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
            await addCollaborativeEditingIdevice(page);
            await waitForLexicalEditor(page);

            // Verify feedback fieldset exists
            const feedbackFieldset = page.locator('#collabFeedbackFieldset');
            await expect(feedbackFieldset).toBeVisible();

            // Click to expand
            const legend = feedbackFieldset.locator('.exe-fieldset-legend');
            await legend.click();

            // Verify feedback editor container appears
            const feedbackEditor = page.locator('#collabFeedbackEditor');
            await expect(feedbackEditor).toBeVisible();
        });
    });

    test.describe('Save and Persistence', () => {
        test('should save iDevice content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Save Content Test');
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
            await addCollaborativeEditingIdevice(page);
            await waitForLexicalEditor(page);

            // Type content in Lexical editor
            const editor = page.locator('.lexical-editor [contenteditable="true"]').first();

            // Click to focus and type
            await editor.click();
            await page.waitForTimeout(500);
            await page.keyboard.type('Saved content test');

            // Wait for content to be typed
            await expect(editor).toContainText('Saved content', { timeout: 10000 });

            // Find and click the save button in the iDevice header
            const idevice = page.locator('.idevice_node.collaborative-editing').first();
            const saveBtn = idevice.locator('.btn-save-idevice, .idevice-save-btn, button:has-text("Save")').first();

            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
                // Wait a bit for save to process
                await page.waitForTimeout(2000);
            }

            // Content should still be visible (either in edit or view mode)
            await expect(idevice).toContainText('Saved content', { timeout: 10000 });
        });
    });
});
