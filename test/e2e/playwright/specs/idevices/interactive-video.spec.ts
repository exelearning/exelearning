import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Interactive Video iDevice
 *
 * Tests the Interactive Video iDevice functionality including:
 * - Basic operations (add, upload local video, save)
 * - Opening the interactive video editor
 * - Creating a cover (frontpage)
 * - Creating slides with different content types
 * - Saving editor changes
 * - Preview rendering
 */

const TEST_DATA = {
    projectTitle: 'Interactive Video E2E Test Project',
    videoFixture: 'test/fixtures/sample-video-480-900kb.webm',
    coverTitle: 'Welcome to Interactive Video',
    coverIntro: 'This is an interactive video with slides and questions.',
    textSlideContent: '<p>This is a text slide with important information.</p>',
    questionText: 'What is 2 + 2?',
    questionAnswers: ['3', '4', '5', '6'],
    correctAnswer: 1, // Index of correct answer (0-based) = "4"
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
 * Helper to add an Interactive Video iDevice by expanding the category and clicking the iDevice
 */
async function addInteractiveVideoIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    // Expand "Assessment and tracking" category (or "Evaluación" in Spanish)
    const assessmentCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Assessment|Evaluación/i }),
        })
        .first();

    if ((await assessmentCategory.count()) > 0) {
        const isCollapsed = await assessmentCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            const label = assessmentCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    await page.waitForTimeout(500);

    // Find and click the Interactive Video iDevice
    const interactiveVideoIdevice = page.locator('.idevice_item[id="interactive-video"]').first();
    await interactiveVideoIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await interactiveVideoIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.interactive-video').first().waitFor({ timeout: 15000 });

    // Wait for the form to be created
    await page.waitForTimeout(1000);

    // Wait for the file input to be visible
    await page
        .waitForFunction(
            () => {
                const fileInput = document.querySelector('#interactiveVideoFile');
                return fileInput !== null;
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to upload a video file via the file picker
 */
async function uploadVideoFile(page: Page, fixturePath: string): Promise<void> {
    // Ensure "Local file" type is selected
    const localRadio = page.locator('#interactiveVideoType-local');
    await localRadio.check();
    await page.waitForTimeout(300);

    // Click the file picker button
    const fileInput = page.locator('#interactiveVideoFile');
    await fileInput.waitFor({ state: 'visible', timeout: 5000 });

    // Find the associated pick button
    const pickButton = page.locator('#interactiveVideoFile + .exe-pick-any-file, #interactiveVideoFile + button');

    if ((await pickButton.count()) > 0) {
        await pickButton.first().click();
    } else {
        await fileInput.click();
    }

    // Wait for Media Library modal to appear
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload the video file
    const uploadInput = page.locator('#modalFileManager .media-library-upload-input');
    await uploadInput.setInputFiles(fixturePath);

    // Wait for upload to complete and item to appear
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 30000 }); // Longer timeout for video

    // Click on the uploaded item to select it
    await mediaItem.click();
    await page.waitForTimeout(500);

    // Click insert button
    const insertBtn = page.locator(
        '#modalFileManager .media-library-insert-btn, #modalFileManager button:has-text("Insert"), #modalFileManager button:has-text("Insertar")',
    );
    await insertBtn.first().click();

    // Wait for modal to close
    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalFileManager');
            return !modal || modal.getAttribute('data-open') !== 'true';
        },
        { timeout: 10000 },
    );

    await page.waitForTimeout(1000);
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
 * Helper to save the interactive-video iDevice
 */
async function saveInteractiveVideoIdevice(page: Page): Promise<void> {
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.interactive-video').last();
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
                const idevice = document.querySelector('#node-content article .idevice_node.interactive-video');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 10000 },
        )
        .catch(() => {});

    await page.waitForTimeout(500);
}

/**
 * Helper to open the interactive video editor and wait for it to load
 */
async function openVideoEditor(page: Page): Promise<FrameLocator> {
    // Click the Editor button
    const editorBtn = page.locator('#interactiveVideoOpenEditor');
    await editorBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editorBtn.click();

    // Wait for the editor modal to become visible
    await page.waitForSelector('#modalGenericIframeContainer.show', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get the iframe inside the modal
    const editorIframe = page.frameLocator('#modalGenericIframeContainer iframe');

    // Wait for the editor to initialize
    await editorIframe.locator('#admin-content').waitFor({ state: 'attached', timeout: 15000 });

    // Wait for the iframe body to be visible (starts with display:none, becomes visible after scripts load)
    // This is critical for Firefox which may be slower to initialize scripts
    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('#modalGenericIframeContainer iframe') as HTMLIFrameElement;
            if (!iframe?.contentDocument?.body) return false;
            const bodyStyle = window.getComputedStyle(iframe.contentDocument.body);
            return bodyStyle.display !== 'none';
        },
        { timeout: 15000 },
    );

    // Wait for the controls to be visible (frontpage-link is inside #controls)
    await editorIframe.locator('#controls').waitFor({ state: 'visible', timeout: 10000 });

    // Give time for TinyMCE and other components to initialize
    await page.waitForTimeout(1000);

    return editorIframe;
}

/**
 * Helper to create a cover (frontpage) in the editor
 */
async function createCover(page: Page, editorIframe: FrameLocator, title: string, intro: string): Promise<void> {
    // Wait for the frontpage link to be ready and visible
    const coverLink = editorIframe.locator('#frontpage-link');
    await coverLink.waitFor({ state: 'visible', timeout: 10000 });

    // Click using JavaScript to ensure the jQuery click handler fires in Firefox
    // Firefox sometimes has issues with native click events on elements with jQuery handlers
    await coverLink.evaluate(el => (el as HTMLElement).click());

    // Wait for jQuery fadeIn() animation to complete (default 400ms)
    // Firefox needs this buffer as it may detect element as hidden during the animation
    await page.waitForTimeout(600);

    // Wait for frontpage block to appear
    const frontpageBlock = editorIframe.locator('#frontpage-block');

    // Poll for visibility - fadeIn changes display and opacity
    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('#modalGenericIframeContainer iframe') as HTMLIFrameElement;
            const block = iframe?.contentDocument?.getElementById('frontpage-block');
            if (!block) return false;
            const style = window.getComputedStyle(block);
            return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.5;
        },
        { timeout: 15000 },
    );

    // Wait a bit for the block to fully render
    await editorIframe.locator('#frontpage-title').waitFor({ state: 'visible', timeout: 5000 });

    // Fill in the title (required)
    const titleInput = editorIframe.locator('#frontpage-title');
    await titleInput.clear();
    await titleInput.fill(title);

    // Wait for TinyMCE to initialize (the textarea is replaced by TinyMCE)
    // TinyMCE creates a wrapper with class .tox-tinymce containing the iframe
    // First wait for the TinyMCE wrapper to appear near the content field
    const tinyMceWrapper = editorIframe
        .locator('#frontpage-content')
        .locator('xpath=..')
        .locator('.tox-tinymce')
        .first();
    await tinyMceWrapper.waitFor({ state: 'visible', timeout: 15000 });
    const tinyMceIframe = tinyMceWrapper.locator('iframe').first();
    await tinyMceIframe.waitFor({ state: 'visible', timeout: 5000 });

    // Fill in the introduction through TinyMCE iframe
    const tinyMceBody = tinyMceIframe.contentFrame().locator('body');
    await tinyMceBody.click();
    await tinyMceBody.fill(intro);

    // Give TinyMCE time to process the input
    await tinyMceBody.page().waitForTimeout(500);

    // Submit the cover form
    const submitBtn = editorIframe.locator('#frontpage-submit');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();

    // Wait for success message to appear (Cover Updated message)
    // The message shows in #frontpage-form-msg for 1 second before fading out
    try {
        await editorIframe.locator('#frontpage-form-msg').waitFor({ state: 'visible', timeout: 5000 });
        // Wait for the message to be processed
        await editorIframe.locator('#frontpage-form-msg').page().waitForTimeout(1500);
    } catch {
        // Even if message doesn't show, wait a bit for the save to complete
        await editorIframe.locator('#frontpage-block').page().waitForTimeout(2000);
    }
}

/**
 * Helper to create a text slide in the editor
 */
async function createTextSlide(editorIframe: FrameLocator, content: string): Promise<void> {
    // Click on Create link to go to add-block
    const createLink = editorIframe.locator('a[href="#add-block"]');
    await createLink.click();
    await editorIframe.locator('#add-block').waitFor({ state: 'visible', timeout: 5000 });

    // Text type should be selected by default
    const textLink = editorIframe.locator('a[href="#text-block"]');
    await textLink.click();
    await editorIframe.locator('#text-block').waitFor({ state: 'visible', timeout: 5000 });

    // Wait for TinyMCE to initialize
    // TinyMCE creates a wrapper with class .tox-tinymce containing the iframe
    const tinyMceWrapper = editorIframe
        .locator('#text-block-content')
        .locator('xpath=..')
        .locator('.tox-tinymce')
        .first();
    await tinyMceWrapper.waitFor({ state: 'visible', timeout: 15000 });
    const tinyMceIframe = tinyMceWrapper.locator('iframe').first();
    await tinyMceIframe.waitFor({ state: 'visible', timeout: 5000 });

    // Fill in the text content through TinyMCE iframe
    const tinyMceBody = tinyMceIframe.contentFrame().locator('body');
    await tinyMceBody.click();
    await tinyMceBody.fill(content);

    // Submit the text block
    const submitBtn = editorIframe.locator('#text-block-submit');
    await submitBtn.click();

    // Wait for success message
    await editorIframe
        .locator('#text-block-msg')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {});
}

/**
 * Helper to create a single choice question slide in the editor
 */
async function createSingleChoiceSlide(
    editorIframe: FrameLocator,
    question: string,
    answers: string[],
    correctIndex: number,
): Promise<void> {
    // Click on Create link to go to add-block
    const createLink = editorIframe.locator('a[href="#add-block"]');
    await createLink.click();
    await editorIframe.locator('#add-block').waitFor({ state: 'visible', timeout: 5000 });

    // Click on Single Choice type
    const singleChoiceLink = editorIframe.locator('a[href="#singleChoice-block"]');
    await singleChoiceLink.click();
    await editorIframe.locator('#singleChoice-block').waitFor({ state: 'visible', timeout: 5000 });

    // Fill in the question (in Question tab)
    const questionInput = editorIframe.locator('#singleChoice-question');
    await questionInput.fill(question);

    // Switch to Answers tab
    const answersTab = editorIframe.locator('a[href="#singleChoice-b"]');
    await answersTab.click();
    await editorIframe.locator('#singleChoice-b').waitFor({ state: 'visible', timeout: 5000 });

    // Fill in answers
    for (let i = 0; i < Math.min(answers.length, 6); i++) {
        const answerInput = editorIframe.locator(`#singleChoice-answer-${i + 1}`);
        await answerInput.fill(answers[i]);
    }

    // Mark the correct answer
    const correctRadio = editorIframe.locator(`#singleChoice-answer-${correctIndex + 1}-right`);
    await correctRadio.check();

    // Submit the single choice block
    const submitBtn = editorIframe.locator('#singleChoice-block-submit');
    await submitBtn.click();

    // Wait for success message
    await editorIframe.locator('#singleChoice-block-msg').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Helper to save the editor and close it
 */
async function saveAndCloseEditor(page: Page, editorIframe: FrameLocator): Promise<void> {
    // Click the Save link in the actions menu (using CSS class selector to avoid translation issues)
    const saveLink = editorIframe.locator('#actions li.save a').first();
    await saveLink.waitFor({ state: 'visible', timeout: 5000 });
    await saveLink.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // If there's an Accept button visible, click it
    const acceptBtn = editorIframe
        .locator('button')
        .filter({ hasText: /Accept|Aceptar/i })
        .first();
    if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        await page.waitForTimeout(500);
    }

    // Set up handler for the confirm dialog that will appear when clicking Exit
    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    // Click the Exit link in the actions menu (using CSS class selector)
    const exitLink = editorIframe.locator('#actions li.exit a').first();
    await exitLink.click();

    // Wait for the modal to close (either removed from DOM or hidden)
    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalGenericIframeContainer');
            if (!modal) return true;
            const style = getComputedStyle(modal);
            return style.display === 'none' || !document.body.contains(modal);
        },
        { timeout: 15000 },
    );

    await page.waitForTimeout(500);
}

test.describe('Interactive Video iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add interactive-video iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Interactive Video Add Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add an Interactive Video iDevice
            await addInteractiveVideoIdeviceFromPanel(page);

            // Verify iDevice was added
            const interactiveVideoIdevice = page
                .locator('#node-content article .idevice_node.interactive-video')
                .first();
            await expect(interactiveVideoIdevice).toBeVisible({ timeout: 10000 });

            // Verify the form is visible with file input
            const fileInput = page.locator('#interactiveVideoFile');
            await expect(fileInput).toBeVisible({ timeout: 5000 });
        });

        test('should upload local video file and save iDevice', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Interactive Video Upload Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add iDevice
            await addInteractiveVideoIdeviceFromPanel(page);

            // Upload video file
            await uploadVideoFile(page, TEST_DATA.videoFixture);

            // Verify the file path is set with asset:// URL format (uuid.ext)
            const fileInput = page.locator('#interactiveVideoFile');
            const filePath = await fileInput.inputValue();
            expect(filePath.startsWith('asset://')).toBe(true);
            // Should have .webm extension (from original file)
            expect(filePath).toMatch(/^asset:\/\/[a-f0-9-]+\.webm$/);

            // Save the iDevice
            await saveInteractiveVideoIdevice(page);

            // Verify the iDevice is saved and shows the video container
            const videoContainer = page.locator('#node-content .interactive-video .exe-interactive-video');
            await expect(videoContainer).toBeAttached({ timeout: 10000 });
        });
    });

    test.describe('Editor Workflow', () => {
        // Skip Editor Workflow tests on Firefox - jQuery click handlers in iframes
        // don't fire reliably in Firefox, causing the frontpage-block to stay hidden
        // after clicking frontpage-link. This is a Firefox-specific browser quirk.
        test.skip(
            ({ browserName }) => browserName === 'firefox',
            'Firefox has issues with jQuery click handlers in iframes',
        );

        test('should open editor, create cover, and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Interactive Video Editor Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add iDevice
            await addInteractiveVideoIdeviceFromPanel(page);

            // Upload video file
            await uploadVideoFile(page, TEST_DATA.videoFixture);

            // Open the editor
            const editorIframe = await openVideoEditor(page);

            // Create a cover
            await createCover(page, editorIframe, TEST_DATA.coverTitle, TEST_DATA.coverIntro);

            // Save and close the editor
            await saveAndCloseEditor(page, editorIframe);

            // Save the iDevice
            await saveInteractiveVideoIdevice(page);

            // Verify the iDevice shows the interactive video content
            const videoContainer = page.locator('#node-content .interactive-video .exe-interactive-video');
            await expect(videoContainer).toBeAttached({ timeout: 10000 });
        });

        test('should persist editor changes after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Interactive Video Persist Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add iDevice and upload video
            await addInteractiveVideoIdeviceFromPanel(page);
            await uploadVideoFile(page, TEST_DATA.videoFixture);

            // Open editor and create cover
            const editorIframe = await openVideoEditor(page);
            await createCover(page, editorIframe, TEST_DATA.coverTitle, TEST_DATA.coverIntro);
            await saveAndCloseEditor(page, editorIframe);

            // Debug: Check what data is in activityToSave after editor closes
            const activityData = await page.evaluate(() => {
                const data = (window as any).top?.interactiveVideoEditor?.activityToSave;
                return data ? JSON.stringify(data) : 'undefined';
            });
            console.log('[DEBUG] activityToSave after editor close:', activityData);

            // Save the iDevice
            await saveInteractiveVideoIdevice(page);

            // Debug: Check the HTML content of the iDevice after saving
            const ideviceHtml = await page.evaluate(() => {
                const idevice = document.querySelector('#node-content .interactive-video .exe-interactive-video');
                return idevice?.innerHTML || 'not found';
            });
            console.log('[DEBUG] iDevice HTML after save (first 500 chars):', ideviceHtml.substring(0, 500));

            // Save the project
            await workarea.save();
            await page.waitForTimeout(2000);

            // Reload the page
            await reloadPage(page);

            // Navigate to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(2000);
            }

            // Verify the iDevice is still there with the video container
            const videoContainer = page.locator('#node-content .interactive-video .exe-interactive-video');
            await expect(videoContainer).toBeAttached({ timeout: 15000 });

            // Debug: Check the HTML content after reload
            const ideviceHtmlAfterReload = await page.evaluate(() => {
                const idevice = document.querySelector('#node-content .interactive-video .exe-interactive-video');
                return idevice?.innerHTML || 'not found';
            });
            console.log(
                '[DEBUG] iDevice HTML after reload (first 800 chars):',
                ideviceHtmlAfterReload.substring(0, 800),
            );

            // Debug: Check if there's a script tag with JSON data
            const jsonContent = await page.evaluate(() => {
                const script = document.querySelector('#exe-interactive-video-contents');
                return script?.textContent || 'script not found';
            });
            console.log('[DEBUG] JSON content after reload:', jsonContent.substring(0, 500));

            // Verify the cover content is present
            const coverContent = page.locator('#node-content .interactive-video .exe-interactive-video');
            await expect(coverContent).toContainText(TEST_DATA.coverTitle, { timeout: 10000 });
        });
    });

    test.describe('Preview Panel', () => {
        // Skip Preview Panel tests on Firefox - depends on createCover which has Firefox issues
        test.skip(
            ({ browserName }) => browserName === 'firefox',
            'Firefox has issues with jQuery click handlers in iframes',
        );

        test('should display interactive video correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Interactive Video Preview Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add iDevice and upload video
            await addInteractiveVideoIdeviceFromPanel(page);
            await uploadVideoFile(page, TEST_DATA.videoFixture);

            // Open editor and create cover with a slide
            const editorIframe = await openVideoEditor(page);
            await createCover(page, editorIframe, TEST_DATA.coverTitle, TEST_DATA.coverIntro);
            await createTextSlide(editorIframe, TEST_DATA.textSlideContent);
            await saveAndCloseEditor(page, editorIframe);

            // Save the iDevice
            await saveInteractiveVideoIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const previewIframe = page.frameLocator('#preview-iframe');
            await previewIframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify the interactive video container is visible in preview
            const videoContainer = previewIframe.locator('.exe-interactive-video').first();
            await expect(videoContainer).toBeAttached({ timeout: 10000 });
        });
    });

    test.describe('Symfony Compatibility Shim', () => {
        test('should have eXeLearning.symfony defined after page load', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Symfony Shim Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Verify eXeLearning.symfony exists and has expected properties
            const symfonyShim = await page.evaluate(() => {
                const symfony = (window as any).eXeLearning?.symfony;
                return {
                    exists: symfony !== undefined,
                    hasBaseURL: symfony?.baseURL !== undefined,
                    hasBasePath: symfony?.basePath !== undefined,
                    hasFullURL: symfony?.fullURL !== undefined,
                };
            });

            expect(symfonyShim.exists).toBe(true);
            expect(symfonyShim.hasBaseURL).toBe(true);
            expect(symfonyShim.hasBasePath).toBe(true);
            expect(symfonyShim.hasFullURL).toBe(true);
        });
    });
});
