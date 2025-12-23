import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Text iDevice
 *
 * Tests the Text iDevice functionality including:
 * - Basic operations (add, edit, save, delete)
 * - TinyMCE advanced editor (CodeMagic)
 * - TinyMCE mind map editor (exemindmap)
 * - Text formatting and persistence
 */

/**
 * Helper to add a text iDevice by selecting the page and clicking the text iDevice
 */
async function addTextIdeviceFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree (click on "New page" text)
    // The page node might be a span or button inside the tree structure
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
                // Force click since element might be partially hidden
                await element.click({ force: true, timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        // Try clicking on the page icon or the whole tree item
        const treeItem = page.locator('#menu_structure .structure-tree li').first();
        if ((await treeItem.count()) > 0) {
            await treeItem.click({ force: true });
        }
    }

    // Wait for the page content area to switch from metadata to page editor
    await page.waitForTimeout(1000);

    // Wait for node-content to show page content (not project metadata)
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                // Either metadata is hidden or node-content shows page content
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });

    // Try to use quick access button first (at bottom of page content area)
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        // Expand "Information and presentation" category in iDevices panel
        const infoCategory = page
            .locator('#menu_idevices .accordion-item')
            .filter({
                hasText: /Information|Información/i,
            })
            .locator('.accordion-button');

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.first().evaluate(el => el.classList.contains('collapsed'));
            if (isCollapsed) {
                await infoCategory.first().click();
                await page.waitForTimeout(500);
            }
        }

        // Find and click the text iDevice
        const textIdevice = page.locator('.idevice_item[id="text"], [data-testid="idevice-text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

test.describe('Text iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add text iDevice and edit content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Create a new project
            const projectUuid = await createProject(page, 'Text iDevice Test');
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

            // Add a text iDevice using the panel
            await addTextIdeviceFromPanel(page);

            // Verify iDevice was added
            const textIdevice = page.locator('#node-content article .idevice_node.text').first();
            await expect(textIdevice).toBeVisible({ timeout: 10000 });

            // Edit the iDevice
            const testContent = `Test content ${Date.now()}`;
            await workarea.editFirstTextIdevice(testContent);

            // Verify content was saved (iDevice exits edition mode and shows content)
            await page.waitForFunction(
                text => {
                    const content = document.querySelector('#node-content');
                    return content && (content.textContent || '').includes(text);
                },
                testContent,
                { timeout: 15000 },
            );
        });

        test('should save and persist text content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Text Persistence Test');
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

            // Add and edit text iDevice
            await addTextIdeviceFromPanel(page);
            const uniqueContent = `Unique content for persistence test ${Date.now()}`;
            await workarea.editFirstTextIdevice(uniqueContent);

            // Save the project
            await workarea.save();

            // Wait a moment for save to complete
            await page.waitForTimeout(1000);

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

            // Navigate to the page (after reload, project shows metadata by default)
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(1000);
            }

            // Verify content persisted
            await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 15000 });
        });
    });

    test.describe('TinyMCE Advanced Editor (CodeMagic)', () => {
        test('should open advanced HTML editor without blank window', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const _workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'CodeMagic Test');
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

            // Add a text iDevice
            await addTextIdeviceFromPanel(page);

            // Check if already in edit mode (TinyMCE visible) or need to click edit button
            const tinyMceMenubar = page.locator('.tox-menubar');
            const isTinyMceVisible = await tinyMceMenubar.isVisible().catch(() => false);

            if (!isTinyMceVisible) {
                // Enter edit mode
                const block = page.locator('#node-content article .idevice_node.text').last();
                await block.waitFor({ timeout: 10000 });
                const editBtn = block.locator('.btn-edit-idevice');
                if ((await editBtn.count()) > 0) {
                    await editBtn.waitFor({ timeout: 10000 });
                    await editBtn.click();
                }
            }

            // Wait for TinyMCE to load
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // Open Tools menu (support both English and Spanish)
            // Use first() since there may be multiple TinyMCE editors (main text + feedback)
            const toolsMenu = page
                .locator('.tox-mbtn')
                .filter({ hasText: /Tools|Herramientas/i })
                .first();
            await expect(toolsMenu).toBeVisible({ timeout: 10000 });
            await toolsMenu.click();

            // Wait for dropdown to appear
            await page.waitForTimeout(300);

            // Click on "Edit source code (advanced editor)"
            const codemagicMenuItem = page.locator('.tox-collection__item').filter({
                hasText: /avanzado|advanced/i,
            });
            await expect(codemagicMenuItem).toBeVisible({ timeout: 5000 });
            await codemagicMenuItem.click();

            // Wait for codemagic dialog
            const dialog = page.locator('.tox-dialog');
            await expect(dialog).toBeVisible({ timeout: 10000 });

            // Find the codemagic iframe
            const codemagicFrame = page.frameLocator('iframe[src*="codemagic.html"]');

            // Verify key UI elements are visible (NOT blank)
            // These elements should be visible if jQuery loaded correctly and i18n.js ran
            // Note: #htmlSource textarea is hidden because CodeMirror replaces it with its own UI
            await expect(codemagicFrame.locator('.CodeMirror')).toBeVisible({ timeout: 10000 });
            await expect(codemagicFrame.locator('#codemagic_insert')).toBeVisible({ timeout: 5000 });
            await expect(codemagicFrame.locator('#wraptext')).toBeVisible({ timeout: 5000 });
            await expect(codemagicFrame.locator('#codemagic_cancel')).toBeVisible({ timeout: 5000 });

            // Close dialog
            await codemagicFrame.locator('#codemagic_cancel').click();

            // Verify dialog closed
            await expect(dialog).not.toBeVisible({ timeout: 5000 });
        });

        test('should edit HTML source and apply changes', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const _workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'CodeMagic Edit Test');
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

            // Add a text iDevice
            await addTextIdeviceFromPanel(page);

            const block = page.locator('#node-content article .idevice_node.text').last();
            await block.waitFor({ timeout: 10000 });

            // Check if already in edit mode (TinyMCE visible) or need to click edit button
            const tinyMceMenubar = page.locator('.tox-menubar');
            const isTinyMceVisible = await tinyMceMenubar.isVisible().catch(() => false);

            if (!isTinyMceVisible) {
                // Enter edit mode
                const editBtn = block.locator('.btn-edit-idevice');
                if ((await editBtn.count()) > 0) {
                    await editBtn.waitFor({ timeout: 10000 });
                    await editBtn.click();
                }
            }

            // Wait for TinyMCE to load
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // Open Tools menu (use first() since there may be multiple TinyMCE editors)
            const toolsMenu = page
                .locator('.tox-mbtn')
                .filter({ hasText: /Tools|Herramientas/i })
                .first();
            await toolsMenu.click();
            await page.waitForTimeout(300);

            // Click on codemagic (Edit source code (advanced editor) menu item)
            const codemagicMenuItem = page.locator('.tox-collection__item').filter({
                hasText: /advanced|avanzado/i,
            });
            await codemagicMenuItem.click();

            // Wait for codemagic dialog
            const dialog = page.locator('.tox-dialog');
            await expect(dialog).toBeVisible({ timeout: 10000 });

            // Get the codemagic frame (now served via API endpoint)
            const codemagicFrame = page.frameLocator('iframe[src*="codemagic-editor"]');

            // Wait for CodeMirror to be initialized
            await codemagicFrame.locator('.CodeMirror').waitFor({ timeout: 10000 });

            // Set content via CodeMirror's API
            const uniqueId = Date.now();
            const testHtml = `<p id="test-${uniqueId}">HTML edited via CodeMagic</p>`;

            // Get the iframe element and use evaluate to set CodeMirror content
            const iframeHandle = await page.locator('iframe[src*="codemagic-editor"]').elementHandle();
            const frame = await iframeHandle?.contentFrame();
            if (frame) {
                // Wait for CodeMirror element to be available (it stores a reference on the DOM element)
                await frame.waitForFunction(
                    () => {
                        const cmElement = document.querySelector('.CodeMirror') as any;
                        return cmElement && cmElement.CodeMirror;
                    },
                    { timeout: 10000 },
                );

                // Set the content using CodeMirror API via DOM element
                await frame.evaluate(html => {
                    const cmElement = document.querySelector('.CodeMirror') as any;
                    if (cmElement && cmElement.CodeMirror) {
                        cmElement.CodeMirror.setValue(html);
                    }
                }, testHtml);

                // Verify the content was set
                const cmContent = await frame.evaluate(() => {
                    const cmElement = document.querySelector('.CodeMirror') as any;
                    return cmElement && cmElement.CodeMirror ? cmElement.CodeMirror.getValue() : '';
                });
                expect(cmContent).toContain('HTML edited via CodeMagic');
            }

            // Click Insert and Close button
            await codemagicFrame.locator('#codemagic_insert').click();

            // Verify dialog closed
            await expect(dialog).not.toBeVisible({ timeout: 5000 });

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Verify the HTML content was applied
            await expect(page.locator('#node-content')).toContainText('HTML edited via CodeMagic', { timeout: 10000 });
        });
    });

    test.describe('TinyMCE Mind Map Editor (exemindmap)', () => {
        test('should open mind map editor without blank window', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const _workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'MindMap Test');
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

            // Add a text iDevice
            await addTextIdeviceFromPanel(page);

            // Check if already in edit mode (TinyMCE visible) or need to click edit button
            const tinyMceMenubar = page.locator('.tox-menubar');
            const isTinyMceVisible = await tinyMceMenubar.isVisible().catch(() => false);

            if (!isTinyMceVisible) {
                // Enter edit mode
                const block = page.locator('#node-content article .idevice_node.text').last();
                await block.waitFor({ timeout: 10000 });
                const editBtn = block.locator('.btn-edit-idevice');
                if ((await editBtn.count()) > 0) {
                    await editBtn.waitFor({ timeout: 10000 });
                    await editBtn.click();
                }
            }

            // Wait for TinyMCE to load
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // The mindmap button is on the 4th toolbar row (buttons3), which is hidden by default
            // First, click the toggletoolbars button to expand all toolbars
            const toggleToolbarsButton = page
                .locator(
                    '.tox-tbtn[aria-label*="Toggle"], .tox-tbtn[aria-label*="Alternar"], .tox-tbtn[title*="Toggle"], .tox-tbtn[title*="Alternar"]',
                )
                .first();
            if ((await toggleToolbarsButton.count()) > 0 && (await toggleToolbarsButton.isVisible())) {
                await toggleToolbarsButton.click();
                await page.waitForTimeout(500); // Wait for toolbar animation
            }

            // Find and click the mindmap button in TinyMCE toolbar
            // The button has a tooltip "Mind map" or "Mapa mental" and uses the exemindmap icon
            const mindmapButton = page
                .locator(
                    '.tox-tbtn[aria-label*="Mind map"], .tox-tbtn[aria-label*="Mapa mental"], .tox-tbtn[aria-label*="mind"]',
                )
                .first();
            await expect(mindmapButton).toBeVisible({ timeout: 10000 });
            await mindmapButton.click();

            // Wait for the mindmap TinyMCE dialog to appear
            const dialog = page.locator('.tox-dialog');
            await expect(dialog).toBeVisible({ timeout: 10000 });

            // Verify the dialog title contains "Mind map" or similar
            const dialogTitle = dialog.locator('.tox-dialog__title');
            await expect(dialogTitle).toContainText(/Mind|Mapa/i, { timeout: 5000 });

            // Find and click the "Open the mind map editor" button (it's a primary button)
            const openEditorButton = dialog.locator('button.tox-button').filter({
                hasText: /Open.*mind.*map|Abrir.*mapa.*mental|editor/i,
            });
            await expect(openEditorButton).toBeVisible({ timeout: 5000 });
            await openEditorButton.click();

            // Wait for the mindmap editor dialog (nested dialog) to appear
            // This is a second dialog that contains an iframe with the mindmap editor
            const editorDialog = page.locator('.tox-dialog').nth(1);
            await expect(editorDialog).toBeVisible({ timeout: 10000 });

            // Find the mindmap editor iframe (served from /api/exemindmap-editor/)
            const mindmapFrame = page.frameLocator('iframe[src*="exemindmap-editor"]');

            // Verify key UI elements are visible inside the iframe (NOT blank)
            // The mindmap editor should have toolbar and canvas elements
            await expect(mindmapFrame.locator('#toolbar')).toBeVisible({ timeout: 15000 });
            await expect(mindmapFrame.locator('canvas').first()).toBeVisible({ timeout: 5000 });

            // Close both dialogs
            // First close the editor dialog (the nested one)
            const closeEditorButton = editorDialog
                .locator('.tox-dialog__header-close, button[aria-label="Close"]')
                .first();
            if ((await closeEditorButton.count()) > 0) {
                await closeEditorButton.click();
            }

            // Then close the main mindmap dialog
            const cancelButton = dialog
                .locator('button')
                .filter({ hasText: /Cancel|Cancelar/i })
                .first();
            if ((await cancelButton.count()) > 0 && (await cancelButton.isVisible())) {
                await cancelButton.click();
            }

            // Verify dialogs are closed
            await expect(page.locator('.tox-dialog')).not.toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Text Formatting', () => {
        test('should apply bold formatting and persist after save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const _workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Text Formatting Test');
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

            // Add a text iDevice
            await addTextIdeviceFromPanel(page);

            const block = page.locator('#node-content article .idevice_node.text').last();
            await block.waitFor({ timeout: 10000 });

            // Check if already in edit mode (TinyMCE visible) or need to click edit button
            const tinyMceMenubar = page.locator('.tox-menubar');
            const isTinyMceVisible = await tinyMceMenubar.isVisible().catch(() => false);

            if (!isTinyMceVisible) {
                // Enter edit mode
                const editBtn = block.locator('.btn-edit-idevice');
                if ((await editBtn.count()) > 0) {
                    await editBtn.waitFor({ timeout: 10000 });
                    await editBtn.click();
                }
            }

            // Wait for TinyMCE iframe to load
            const tinyMceFrame = block.locator('iframe.tox-edit-area__iframe').first();
            await tinyMceFrame.waitFor({ timeout: 15000 });

            // Get the frame
            const frameEl = await tinyMceFrame.elementHandle();
            const frame = await frameEl?.contentFrame();

            if (frame) {
                // Focus and type text
                await frame.focus('body');
                const testText = `Bold test ${Date.now()}`;
                await frame.type('body', testText, { delay: 5 });

                // Select all text and apply bold
                await page.keyboard.press('Control+A');
                await page.keyboard.press('Control+B');
            }

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Verify bold formatting was applied (check for <strong> or <b> tag)
            const hasBoldContent = await page.evaluate(() => {
                const content = document.querySelector('#node-content article .idevice_node.text .textIdeviceContent');
                if (!content) return false;
                const html = content.innerHTML;
                return html.includes('<strong>') || html.includes('<b>');
            });

            expect(hasBoldContent).toBe(true);
        });
    });

    test.describe('Image Persistence', () => {
        test('should persist image after save and reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // 1. Create project
            const projectUuid = await createProject(page, 'Image Persistence Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');
            await waitForLoadingScreenHidden(page);

            // 2. Wait for Yjs to initialize
            await page.waitForFunction(
                () => {
                    return (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            // 3. Add text iDevice
            await addTextIdeviceFromPanel(page);

            // 4. Enter edit mode
            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            const editBtn = block.locator('.btn-edit-idevice');
            if ((await editBtn.count()) > 0) {
                await editBtn.click();
            }

            // 5. Wait for TinyMCE
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // 6. Click on image button in TinyMCE toolbar
            const imageBtn = page
                .locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]')
                .first();
            await expect(imageBtn).toBeVisible({ timeout: 10000 });
            await imageBtn.click();

            // 7. Wait for file manager modal
            await page.waitForSelector('#modal-filemanager, .modal.show', { timeout: 10000 });

            // 8. Upload image from fixture
            const fileInput = page.locator('#modal-filemanager input[type="file"], .modal.show input[type="file"]');
            await fileInput.setInputFiles('test/fixtures/sample-2.jpg');

            // 9. Wait for upload to complete
            await page.waitForTimeout(3000);

            // 10. Select and insert the uploaded image
            const imageItem = page.locator('#modal-filemanager .file-item img, .modal.show .file-item img').first();
            if ((await imageItem.count()) > 0) {
                await imageItem.click();
            }

            // Click insert/select button
            const insertBtn = page
                .locator('button:has-text("Insert"), button:has-text("Insertar"), button:has-text("Select")')
                .first();
            if ((await insertBtn.count()) > 0) {
                await insertBtn.click();
            }

            // 11. Wait for modal to close
            await page.waitForTimeout(2000);

            // 12. Save iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // 13. Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // 14. Verify image is visible BEFORE reload
            const imgBefore = page.locator('#node-content article .idevice_node.text img');
            await expect(imgBefore).toBeVisible({ timeout: 10000 });

            // 15. Save project
            await workarea.save();
            await page.waitForTimeout(2000);

            // 16. Reload the page
            await page.reload();
            await page.waitForLoadState('networkidle');
            await waitForLoadingScreenHidden(page);

            // 17. Wait for Yjs to reinitialize
            await page.waitForFunction(
                () => {
                    return (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            // 18. Navigate to the page with the iDevice
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true });
                await page.waitForTimeout(1000);
            }

            // 19. Verify image is visible AFTER reload
            const imgAfter = page.locator('#node-content article .idevice_node.text img');
            await expect(imgAfter).toBeVisible({ timeout: 15000 });

            // 20. Verify image src is NOT a blob: URL (should be resolved from IndexedDB)
            const imgSrc = await imgAfter.getAttribute('src');
            expect(imgSrc).not.toBeNull();
            // After reload, src can be blob: (resolved) or asset:// (waiting to resolve)
            // It should NOT be an invalid blob URL that returns 404
            const naturalWidth = await imgAfter.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        });

        test('should show image in preview after insert', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // 1. Create project
            const projectUuid = await createProject(page, 'Image Preview Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');
            await waitForLoadingScreenHidden(page);

            // 2. Wait for Yjs
            await page.waitForFunction(
                () => {
                    return (window as any).eXeLearning?.app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            // 3. Add text iDevice
            await addTextIdeviceFromPanel(page);

            // 4. Enter edit mode
            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            const editBtn = block.locator('.btn-edit-idevice');
            if ((await editBtn.count()) > 0) {
                await editBtn.click();
            }

            // 5. Wait for TinyMCE
            await page.waitForSelector('.tox-menubar', { timeout: 15000 });

            // 6. Click image button
            const imageBtn = page
                .locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]')
                .first();
            await expect(imageBtn).toBeVisible({ timeout: 10000 });
            await imageBtn.click();

            // 7. Wait for file manager
            await page.waitForSelector('#modal-filemanager, .modal.show', { timeout: 10000 });

            // 8. Upload fixture image
            const fileInput = page.locator('#modal-filemanager input[type="file"], .modal.show input[type="file"]');
            await fileInput.setInputFiles('test/fixtures/sample-3.jpg');
            await page.waitForTimeout(3000);

            // 9. Select and insert
            const imageItem = page.locator('#modal-filemanager .file-item img, .modal.show .file-item img').first();
            if ((await imageItem.count()) > 0) {
                await imageItem.click();
            }

            const insertBtn = page
                .locator('button:has-text("Insert"), button:has-text("Insertar"), button:has-text("Select")')
                .first();
            if ((await insertBtn.count()) > 0) {
                await insertBtn.click();
            }

            await page.waitForTimeout(2000);

            // 10. Save iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // 11. Save project
            await workarea.save();
            await page.waitForTimeout(2000);

            // 12. Open preview
            const popupPromise = page.context().waitForEvent('page', { timeout: 15000 });
            await page.click('#head-bottom-preview');
            const previewPage = await popupPromise;
            await previewPage.waitForLoadState('networkidle');

            // 13. Verify image in preview
            const previewImg = previewPage.locator('article img');
            await expect(previewImg).toBeVisible({ timeout: 15000 });

            // 14. Verify image loads (not broken)
            const naturalWidth = await previewImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            await previewPage.close();
        });
    });
});
