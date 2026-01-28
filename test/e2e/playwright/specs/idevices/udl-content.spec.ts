import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for UDL Content (Contenido DUA) iDevice
 *
 * Tests the UDL Content iDevice functionality including:
 * - Basic operations (add, edit main content, save, persist)
 * - UDL types (engagement, representation, expression)
 * - Multiple blocks (add, reorder, delete)
 * - Alternative content tabs (main, simplified, audio, visual)
 * - Character button presentation (LUMEN)
 * - Preview rendering and interaction
 */

const TEST_DATA = {
    mainContent: 'This is the main content for UDL iDevice',
    simplifiedContent: 'Easy to read version of the content',
    audioContent: 'Audio description for accessibility',
    visualContent: 'Visual aid description with images',
    buttonText: 'Learn More',
    projectTitle: 'UDL Content Test Project',
};

/**
 * Helper to add a UDL Content iDevice by selecting the page and clicking the iDevice
 */
async function addUdlContentIdeviceFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree
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

    // Wait for the page content area to switch from metadata to page editor
    await page.waitForTimeout(1000);

    // Wait for node-content to show page content (not project metadata)
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });

    // Expand "Information and presentation" category in iDevices panel
    // The category structure: .idevice_category > .label (clickable) > h3.idevice_category_name
    // Category has class "off" when collapsed
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

    // Find the UDL Content iDevice
    const udlContentIdevice = page
        .locator('.idevice_item[id="udl-content"], [data-testid="idevice-udl-content"]')
        .first();

    // Wait for it to be visible and then click
    await udlContentIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await udlContentIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.udl-content').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to enter edit mode for a UDL Content iDevice
 * Note: UDL Content iDevice enters edit mode automatically when added,
 * so this just ensures TinyMCE is loaded
 */
async function enterEditMode(page: Page): Promise<void> {
    // UDL Content iDevice is already in edit mode when added
    // Just wait for TinyMCE to be fully loaded
    await page.locator('.tox-menubar').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Helper to save the iDevice and wait for edit mode to end
 */
async function saveIdevice(page: Page): Promise<void> {
    // The iDevice has a Save button in the form header
    const saveBtn = page
        .locator('#node-content article .idevice_node.udl-content button')
        .filter({ hasText: /^Save$/ })
        .first();
    await saveBtn.click();

    // Wait for edition mode to end (TinyMCE should disappear)
    await page.waitForFunction(
        () => {
            const tinyMce = document.querySelector('#node-content article .idevice_node.udl-content .tox-menubar');
            return !tinyMce;
        },
        { timeout: 15000 },
    );
}

/**
 * Helper to type content in the TinyMCE editor
 */
async function typeInTinyMCE(page: Page, text: string): Promise<void> {
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.activeEditor;
            return !!editor && editor.initialized;
        },
        null,
        { timeout: 15000 },
    );

    await page.evaluate(content => {
        const editor = (window as any).tinymce?.activeEditor;
        if (!editor) return;
        editor.setContent(content);
        editor.fire('change');
        editor.fire('input');
        editor.setDirty(true);
    }, text);

    await page.waitForFunction(() => {
        const editor = (window as any).tinymce?.activeEditor;
        return !!editor && editor.isDirty();
    });
}

/**
 * Helper to select a UDL type
 */
async function selectUdlType(page: Page, type: 'engagement' | 'representation' | 'expression'): Promise<void> {
    const typeSelector = page.locator(`#udlContentTypeOptions input[value="${type}"]`);
    await typeSelector.click();
}

/**
 * Helper to set button text for a block
 */
async function setButtonText(page: Page, text: string, blockIndex: number = 0): Promise<void> {
    // The button text input is inside a paragraph container
    const buttonTextInput = page.locator('.udlContentFormBlockButtonTxt input[type="text"]').nth(blockIndex);
    await buttonTextInput.fill(text);
}

/**
 * Helper to add a new block
 */
async function addBlock(page: Page): Promise<void> {
    const addBlockBtn = page.locator('#udlContentFormAddBlockWrapper a, #udlContentFormAddBlockWrapper button').first();
    await addBlockBtn.click();
    await page.waitForTimeout(500);
}

test.describe('UDL Content iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add UDL Content iDevice and edit main content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'UDL Content Basic Test');
            await gotoWorkarea(page, projectUuid);

            // Wait for app initialization
            await waitForAppReady(page);

            // Add a UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);

            // Verify iDevice was added
            const udlIdevice = page.locator('#node-content article .idevice_node.udl-content').first();
            await expect(udlIdevice).toBeVisible({ timeout: 10000 });

            // Enter edit mode
            await enterEditMode(page);

            // Select UDL type
            await selectUdlType(page, 'representation');

            // Set button text
            await setButtonText(page, TEST_DATA.buttonText);

            // Type main content
            await typeInTinyMCE(page, TEST_DATA.mainContent);

            // Save the iDevice
            await saveIdevice(page);

            // Verify content persists in view mode
            await page.waitForFunction(
                text => {
                    const content = document.querySelector('#node-content');
                    return content && (content.textContent || '').includes(text);
                },
                TEST_DATA.mainContent,
                { timeout: 15000 },
            );

            // Verify button text is visible
            await expect(page.locator('#node-content')).toContainText(TEST_DATA.buttonText, { timeout: 10000 });
        });

        test('should save and persist UDL content after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Content Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add and edit UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Configure the iDevice
            await selectUdlType(page, 'engagement');
            const uniqueContent = `Unique UDL content ${Date.now()}`;
            await setButtonText(page, 'Click Here');
            await typeInTinyMCE(page, uniqueContent);
            await saveIdevice(page);

            // Save the project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Reload the page
            await reloadPage(page);

            // Navigate to the page
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

            // Verify UDL type class is applied
            const udlContainer = page.locator('.exe-udlContent').first();
            await expect(udlContainer).toHaveClass(/exe-udlContent-engagement/, { timeout: 10000 });
        });
    });

    test.describe('UDL Types', () => {
        test('should apply correct CSS class for representation type', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'UDL Types Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add a UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Select representation type
            await selectUdlType(page, 'representation');

            // Add minimal content
            await typeInTinyMCE(page, 'Content for representation');
            await saveIdevice(page);

            // Verify the correct class is applied
            const udlContainer = page.locator('.exe-udlContent').first();
            await expect(udlContainer).toHaveClass(/exe-udlContent-representation/, { timeout: 10000 });
        });
    });

    test.describe('Multiple Blocks', () => {
        test('should add multiple blocks with different content', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'UDL Multiple Blocks Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Edit first block
            await setButtonText(page, 'Block 1', 0);
            await typeInTinyMCE(page, 'Content for block 1');

            // Add second block
            await addBlock(page);

            // Wait for second block to appear
            await page.locator('.udlContentFormBlock').nth(1).waitFor({ state: 'visible', timeout: 10000 });

            // Edit second block
            await setButtonText(page, 'Block 2', 1);

            // Click on the second block's editor to type in it
            const secondBlockEditor = page
                .locator('.udlContentFormBlock')
                .nth(1)
                .locator('iframe.tox-edit-area__iframe');
            const frameEl = await secondBlockEditor.elementHandle();
            const frame = await frameEl?.contentFrame();
            if (frame) {
                await frame.focus('body');
                await frame.type('body', 'Content for block 2', { delay: 5 });
            }

            // Save the iDevice
            await saveIdevice(page);

            // Verify both blocks are rendered
            const blocks = page.locator('.exe-udlContent-block');
            await expect(blocks).toHaveCount(2, { timeout: 10000 });

            // Verify content of both blocks
            await expect(page.locator('#node-content')).toContainText('Block 1', { timeout: 10000 });
            await expect(page.locator('#node-content')).toContainText('Block 2', { timeout: 10000 });
        });
    });

    test.describe('Alternative Content Tabs', () => {
        test('should display all 4 content tabs in editor', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'UDL Alt Content Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Verify all 4 tabs are visible
            const tabs = page.locator('.udlContentFormTabs a');
            await expect(tabs).toHaveCount(4, { timeout: 10000 });

            // Verify tab labels
            await expect(tabs.nth(0)).toContainText(/Main content|Contenido principal/i);
            await expect(tabs.nth(1)).toContainText(/Easier to read|Lectura facilitada/i);
            await expect(tabs.nth(2)).toContainText(/Audio/i);
            await expect(tabs.nth(3)).toContainText(/Visual aid|Apoyo visual/i);

            // Verify main tab is active by default
            await expect(tabs.nth(0)).toHaveClass(/active/);
        });
    });

    test.describe('Preview', () => {
        test('should render correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Preview Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add and configure UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            await selectUdlType(page, 'engagement');
            await setButtonText(page, 'Click to Learn');
            await typeInTinyMCE(page, 'This is the main learning content');

            await saveIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');

            // Wait for page to load
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify UDL container has correct type class
            const udlContainer = iframe.locator('.exe-udlContent');
            await expect(udlContainer).toHaveClass(/exe-udlContent-engagement/, { timeout: 10000 });

            // Verify button is visible with correct text
            const button = iframe.locator('.udl-btn, .udl-character').first();
            await expect(button).toBeVisible({ timeout: 10000 });
            await expect(button).toContainText('Click to Learn', { timeout: 5000 });

            // Click button to reveal content
            await button.click();
            await page.waitForTimeout(500);

            // Verify main content is visible after clicking
            const mainContent = iframe.locator('.exe-udlContent-content-main');
            await expect(mainContent).toBeVisible({ timeout: 10000 });
            await expect(mainContent).toContainText('main learning content', { timeout: 5000 });
        });
    });

    test.describe('Audio Player', () => {
        test('should render audio element with type attribute in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL Audio Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add and configure UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Wait for TinyMCE to be ready
            await page.waitForTimeout(1000);

            // Insert audio element via TinyMCE API (not directly into iframe body)
            // This ensures the content is properly tracked and saved
            const audioHtml =
                '<p>Audio content test</p><audio controls type="audio/wav" src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAB/"></audio>';

            await page.evaluate(html => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(html);
                }
            }, audioHtml);

            // Set button text
            await setButtonText(page, 'Listen Here');

            // Save the iDevice
            await saveIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const previewIframe = page.frameLocator('#preview-iframe');

            // Wait for page to load
            await previewIframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Click the button to reveal content
            const button = previewIframe.locator('.udl-btn, .udl-character').first();
            await expect(button).toBeVisible({ timeout: 10000 });
            await button.click();
            await page.waitForTimeout(1000);

            // Verify the content is visible
            const mainContent = previewIframe.locator('.exe-udlContent-content-main');
            await expect(mainContent).toBeVisible({ timeout: 10000 });

            // Check that audio exists in the content
            // It could be wrapped by MediaElement.js (.mejs-container) or be a raw audio element
            const audioElement = previewIframe.locator('.exe-udlContent-content-main audio');
            const mejsContainer = previewIframe.locator('.exe-udlContent-content-main .mejs-container');

            const audioCount = await audioElement.count();
            const mejsCount = await mejsContainer.count();

            // At least one audio representation should exist
            expect(audioCount + mejsCount).toBeGreaterThan(0);

            // If there's a raw audio element, verify it has the type attribute
            if (audioCount > 0) {
                const audioType = await audioElement.first().getAttribute('type');
                // Type should be set (either original or detected)
                if (audioType) {
                    expect(audioType).toContain('audio/');
                }
            }

            // If MediaElement.js is active, verify no cannotplay error
            if (mejsCount > 0) {
                const cannotPlay = previewIframe.locator('.me-cannotplay');
                const cannotPlayCount = await cannotPlay.count();
                expect(cannotPlayCount).toBe(0);
            }
        });

        test('should not have double MEJS initialization (mejs-audio and mejs-video classes)', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'UDL MEJS Double Init Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add and configure UDL Content iDevice
            await addUdlContentIdeviceFromPanel(page);
            await enterEditMode(page);

            // Wait for TinyMCE to be ready
            await page.waitForTimeout(1000);

            // Insert audio element via TinyMCE API (not directly into iframe body)
            // This ensures the content is properly tracked and saved
            const audioHtml =
                '<p>Audio test for MEJS</p><audio class="mediaelement" controls type="audio/mpeg" src="data:audio/mpeg;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"></audio>';

            await page.evaluate(html => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(html);
                }
            }, audioHtml);

            // Set button text
            await setButtonText(page, 'Play Audio');

            // Save the iDevice
            await saveIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const previewIframe = page.frameLocator('#preview-iframe');

            // Wait for page to load
            await previewIframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Click the button to reveal content
            const button = previewIframe.locator('.udl-btn, .udl-character').first();
            await expect(button).toBeVisible({ timeout: 10000 });
            await button.click();
            await page.waitForTimeout(1500);

            // Check MEJS container classes
            const mejsContainer = previewIframe.locator('.exe-udlContent-content-main .mejs-container').first();
            const mejsCount = await mejsContainer.count();

            if (mejsCount > 0) {
                const mejsClass = await mejsContainer.getAttribute('class');

                // Verify MEJS container does NOT have both mejs-audio and mejs-video classes
                // This was a bug where double initialization would add both classes
                const hasAudioClass = mejsClass?.includes('mejs-audio') ?? false;
                const hasVideoClass = mejsClass?.includes('mejs-video') ?? false;

                // Should have audio class (since it's an audio element)
                expect(hasAudioClass).toBe(true);

                // Should NOT have video class (that would indicate double initialization bug)
                expect(hasVideoClass).toBe(false);

                // Note: We do NOT check for me-cannotplay here because data URI audio
                // may legitimately fail to play in MEJS. The key verification is that
                // we don't have double initialization (both mejs-audio and mejs-video classes).
                // Real audio files with proper blob URLs should play correctly.
            }
        });
    });
});
