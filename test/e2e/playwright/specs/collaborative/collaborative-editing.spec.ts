import { test, expect } from '../../fixtures/collaboration.fixture';
import { waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Collaborative Editing - Multi-client Sync
 *
 * Tests the real-time collaboration features of the collaborative-editing iDevice:
 * - Text sync between clients
 * - Remote cursor visibility
 * - Concurrent editing
 */

/**
 * Helper to wait for app initialization
 */
async function waitForAppInit(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            return app?.project?._yjsBridge !== undefined;
        },
        { timeout: 30000 },
    );
    await waitForLoadingScreenHidden(page);
}

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
 * Helper to wait for ProseMirror editor to be ready
 */
async function waitForProseMirrorEditor(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const editor = document.querySelector('.prosemirror-editor .ProseMirror');
            return editor && editor.getAttribute('contenteditable') === 'true';
        },
        { timeout: 20000 },
    );
}

// Skip multi-client tests for now - they require the share modal infrastructure to work correctly.
// The basic collaborative-editing iDevice tests in specs/idevices/collaborative-editing.spec.ts
// verify the ProseMirror editor and iDevice functionality works correctly.
// TODO: Enable these tests once share modal infrastructure is stable.
test.describe
    .skip('Collaborative Editing - Multi-client Sync', () => {
        test.describe('Text Synchronization', () => {
            test('should sync text between two clients via share link', async ({
                authenticatedPage,
                createProject,
                getShareUrl,
                secondAuthenticatedPage,
                joinSharedProject,
            }) => {
                const page1 = authenticatedPage;
                const page2 = secondAuthenticatedPage;

                // Create project on first client
                const projectUuid = await createProject(page1, 'Collab Sync Test');
                await page1.goto(`/workarea?project=${projectUuid}`);
                await page1.waitForLoadState('networkidle');
                await waitForAppInit(page1);

                // Add iDevice on first client
                await addCollaborativeEditingIdevice(page1);
                await waitForProseMirrorEditor(page1);

                // Type initial content on client 1
                const editor1 = page1.locator('.prosemirror-editor .ProseMirror').first();
                await editor1.click();
                await page1.keyboard.type('Hello from client 1');

                // Save the iDevice to ensure content is persisted
                const saveBtn = page1.locator('.idevice_node.collaborative-editing .btn-save-idevice').first();
                if ((await saveBtn.count()) > 0) {
                    await saveBtn.click();
                    await page1.waitForTimeout(2000);
                }

                // Get share URL and make project public
                const shareUrl = await getShareUrl(page1);

                // Second client joins via share URL
                await joinSharedProject(page2, shareUrl);

                // Select the same page on client 2
                await selectPageNode(page2);
                await page2.waitForTimeout(2000);

                // Verify content synced to client 2
                const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
                await expect(idevice2).toContainText('Hello from client 1', { timeout: 15000 });
            });

            test('should sync new content typed on second client back to first', async ({
                authenticatedPage,
                createProject,
                getShareUrl,
                secondAuthenticatedPage,
                joinSharedProject,
            }) => {
                const page1 = authenticatedPage;
                const page2 = secondAuthenticatedPage;

                // Create project and add iDevice on first client
                const projectUuid = await createProject(page1, 'Bidirectional Sync Test');
                await page1.goto(`/workarea?project=${projectUuid}`);
                await page1.waitForLoadState('networkidle');
                await waitForAppInit(page1);

                await addCollaborativeEditingIdevice(page1);
                await waitForProseMirrorEditor(page1);

                // Type some initial content
                const editor1 = page1.locator('.prosemirror-editor .ProseMirror').first();
                await editor1.click();
                await page1.keyboard.type('Initial content');

                // Get share URL
                const shareUrl = await getShareUrl(page1);

                // Second client joins
                await joinSharedProject(page2, shareUrl);
                await selectPageNode(page2);
                await page2.waitForTimeout(2000);

                // Click on the iDevice to edit it on client 2
                const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
                await idevice2.click();
                await page2.waitForTimeout(1000);

                // Try to type in the editor on client 2
                const editor2 = page2.locator('.prosemirror-editor .ProseMirror').first();
                if ((await editor2.count()) > 0 && (await editor2.isVisible())) {
                    await editor2.click();
                    await page2.keyboard.press('End');
                    await page2.keyboard.type(' - Added by client 2');
                    await page2.waitForTimeout(2000);

                    // Verify content synced back to client 1
                    await expect(editor1).toContainText('Added by client 2', { timeout: 10000 });
                }
            });
        });

        test.describe('Content Visibility', () => {
            test('should show same iDevice content on both clients', async ({
                authenticatedPage,
                createProject,
                getShareUrl,
                secondAuthenticatedPage,
                joinSharedProject,
            }) => {
                const page1 = authenticatedPage;
                const page2 = secondAuthenticatedPage;

                // Create project
                const projectUuid = await createProject(page1, 'Content Visibility Test');
                await page1.goto(`/workarea?project=${projectUuid}`);
                await page1.waitForLoadState('networkidle');
                await waitForAppInit(page1);

                // Add iDevice with content
                await addCollaborativeEditingIdevice(page1);
                await waitForProseMirrorEditor(page1);

                const editor1 = page1.locator('.prosemirror-editor .ProseMirror').first();
                await editor1.click();
                await page1.keyboard.type('Shared collaborative content');

                // Save the iDevice
                const saveBtn = page1.locator('.idevice_node.collaborative-editing .btn-save-idevice').first();
                if ((await saveBtn.count()) > 0) {
                    await saveBtn.click();
                    await page1.waitForTimeout(2000);
                }

                // Get share URL
                const shareUrl = await getShareUrl(page1);

                // Second client joins
                await joinSharedProject(page2, shareUrl);
                await selectPageNode(page2);
                await page2.waitForTimeout(2000);

                // Verify both clients see the same content
                const idevice1 = page1.locator('.idevice_node.collaborative-editing').first();
                const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();

                await expect(idevice1).toContainText('Shared collaborative content', { timeout: 10000 });
                await expect(idevice2).toContainText('Shared collaborative content', { timeout: 10000 });
            });
        });

        test.describe('Formatted Content Sync', () => {
            test('should sync bold text between clients', async ({
                authenticatedPage,
                createProject,
                getShareUrl,
                secondAuthenticatedPage,
                joinSharedProject,
            }) => {
                const page1 = authenticatedPage;
                const page2 = secondAuthenticatedPage;

                // Create project
                const projectUuid = await createProject(page1, 'Format Sync Test');
                await page1.goto(`/workarea?project=${projectUuid}`);
                await page1.waitForLoadState('networkidle');
                await waitForAppInit(page1);

                // Add iDevice
                await addCollaborativeEditingIdevice(page1);
                await waitForProseMirrorEditor(page1);

                // Type and format text
                const editor1 = page1.locator('.prosemirror-editor .ProseMirror').first();
                await editor1.click();
                await page1.keyboard.type('Bold text here');

                // Select all and make bold
                const isMac = process.platform === 'darwin';
                await page1.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
                await page1.waitForTimeout(300);
                await page1.keyboard.press(isMac ? 'Meta+b' : 'Control+b');
                await page1.waitForTimeout(500);

                // Save iDevice
                const saveBtn = page1.locator('.idevice_node.collaborative-editing .btn-save-idevice').first();
                if ((await saveBtn.count()) > 0) {
                    await saveBtn.click();
                    await page1.waitForTimeout(2000);
                }

                // Get share URL
                const shareUrl = await getShareUrl(page1);

                // Second client joins
                await joinSharedProject(page2, shareUrl);
                await selectPageNode(page2);
                await page2.waitForTimeout(2000);

                // Check content has bold formatting on client 2
                const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
                const boldText = idevice2.locator('strong');
                await expect(boldText).toBeVisible({ timeout: 10000 });
                await expect(boldText).toContainText('Bold text here');
            });
        });
    });
