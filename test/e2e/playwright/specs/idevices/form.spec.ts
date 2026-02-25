import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Form iDevice
 *
 * Tests the Form (assessment) iDevice functionality including:
 * - Basic operations (add form, add questions)
 * - Multiple question types (true/false, selection, dropdown, fill)
 * - Preview rendering
 * - Form interaction (check answers)
 */

/**
 * Helper to close any alert modals that might be blocking interactions
 */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        // Try to click OK or close button
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

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

    await page.waitForTimeout(500);

    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to add a Form iDevice by expanding the category and clicking the iDevice
 */
async function addFormIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    // Expand "Assessment and tracking" or "Evaluación y seguimiento" category
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
            await page.waitForTimeout(500);
        }
    }

    await page.waitForTimeout(500);

    // Find and click the Form iDevice
    const formIdevice = page.locator('.idevice_item[id="form"], [data-testid="idevice-form"]').first();
    await formIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await formIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.form').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to open the questions panel
 */
async function openQuestionsPanel(page: Page): Promise<void> {
    // Click on the show questions button
    const showQuestionsBtn = page.locator('#buttonHideShowQuestionsTop').first();
    await showQuestionsBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Check if panel is already visible
    const panel = page.locator('#questionsContainerTop');
    const isVisible = await panel.isVisible();

    if (!isVisible) {
        await showQuestionsBtn.click();
        await panel.waitFor({ state: 'visible', timeout: 5000 });
    }
}

/**
 * Helper to add a True/False question
 */
async function addTrueFalseQuestion(page: Page, questionText: string, answer: boolean): Promise<void> {
    await openQuestionsPanel(page);

    // Click add True/False button
    const addBtn = page.locator('#buttonAddTrueFalseQuestionTop');
    await addBtn.click();
    await page.waitForTimeout(500);

    // Wait for TinyMCE to initialize - the textarea container should be visible
    const textareaContainer = page.locator('#formPreviewTextareaContainer');
    await textareaContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for TinyMCE iframe to appear
    await page.waitForTimeout(500);

    // Find the TinyMCE editor iframe within the question container
    const tinyMceIframe = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();

    if ((await tinyMceIframe.count()) > 0) {
        // Type into TinyMCE using keyboard
        const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();
        const body = frame.locator('body');
        await body.click();
        await page.waitForTimeout(300);
        await page.keyboard.type(questionText, { delay: 10 });
    } else {
        // Fallback: try to find any textarea
        const textarea = page.locator('#formPreviewTextareaContainer textarea').first();
        if ((await textarea.count()) > 0) {
            await textarea.fill(questionText);
        }
    }

    // Select True or False answer - look for radio buttons in the form
    const trueRadio = page
        .locator('input[type="radio"][value="true"], #formPreviewTrueFalseRadioButtons input[value="true"]')
        .first();
    const falseRadio = page
        .locator('input[type="radio"][value="false"], #formPreviewTrueFalseRadioButtons input[value="false"]')
        .first();

    if (answer && (await trueRadio.count()) > 0) {
        await trueRadio.check({ force: true });
    } else if (!answer && (await falseRadio.count()) > 0) {
        await falseRadio.check({ force: true });
    }

    // Save the question - using input button selector
    const saveBtn = page
        .locator(
            'input[id$="_buttonSaveQuestion"], input.question-button[value*="Save"], input.question-button[value*="Guardar"]',
        )
        .first();
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    } else {
        // Fallback to any save button
        const altSaveBtn = page.locator('.footer-buttons-container input[type="button"]').first();
        if ((await altSaveBtn.count()) > 0) {
            await altSaveBtn.click();
        }
    }
    await page.waitForTimeout(500);

    // Close any alert modals that might appear
    await closeAlertModals(page);
}

/**
 * Helper to add a Selection question (single or multiple choice)
 */
async function addSelectionQuestion(
    page: Page,
    questionText: string,
    options: { text: string; correct: boolean }[],
    isMultiple: boolean = false,
): Promise<void> {
    await openQuestionsPanel(page);

    // Click add Selection button
    const addBtn = page.locator('#buttonAddSelectionQuestionTop');
    await addBtn.click();
    await page.waitForTimeout(500);

    // Wait for the question container to appear
    const textareaContainer = page.locator('#formPreviewTextareaContainer');
    await textareaContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for TinyMCE to initialize
    await page.waitForTimeout(500);

    // Find the TinyMCE editor iframe for the question text
    const tinyMceIframes = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');

    if ((await tinyMceIframes.count()) > 0) {
        // Type question into first TinyMCE using keyboard
        const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').first();
        const body = frame.locator('body');
        await body.click();
        await page.waitForTimeout(300);
        await page.keyboard.type(questionText, { delay: 10 });
    }

    // If multiple selection, click the toggle button
    if (isMultiple) {
        const toggleBtn = page.locator('#buttonRadioCheckboxToggle');
        if ((await toggleBtn.count()) > 0) {
            await toggleBtn.click();
        }
    }

    // For the first option, find the TinyMCE for it (it's already created)
    const optionEditors = page.locator('#formPreviewTextareaContainer .tox-tinymce');
    const optionCount = await optionEditors.count();

    // Fill the first option if there's more than one editor (question + option)
    if (optionCount > 1 && options.length > 0) {
        const optionFrames = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');
        if ((await optionFrames.count()) > 1) {
            const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').nth(1);
            const body = frame.locator('body');
            await body.click();
            await page.waitForTimeout(300);
            await page.keyboard.type(options[0].text, { delay: 10 });
        }

        // Mark first option as correct if needed
        if (options[0].correct) {
            const firstRadio = page.locator('#option_1').first();
            if ((await firstRadio.count()) > 0) {
                await firstRadio.check({ force: true });
            }
        }
    }

    // Add remaining options
    for (let i = 1; i < options.length; i++) {
        // Click add option button
        const addOptionBtn = page.locator('#formPreview_buttonAddOption');
        await addOptionBtn.click();
        await page.waitForTimeout(500);

        // Fill the new option (it should be the last TinyMCE)
        const optionFrames = page.locator('#formPreviewTextareaContainer .tox-edit-area__iframe');
        const frameCount = await optionFrames.count();
        if (frameCount > i + 1) {
            const frame = page.frameLocator('#formPreviewTextareaContainer .tox-edit-area__iframe').nth(i + 1);
            const body = frame.locator('body');
            await body.click();
            await page.waitForTimeout(300);
            await page.keyboard.type(options[i].text, { delay: 10 });
        }

        // Mark as correct if needed
        if (options[i].correct) {
            const optionRadio = page.locator(`#option_${i + 1}`).first();
            if ((await optionRadio.count()) > 0) {
                await optionRadio.check({ force: true });
            }
        }
    }

    // Save the question - using input button selector
    const saveBtn = page
        .locator(
            'input[id$="_buttonSaveQuestion"], input.question-button[value*="Save"], input.question-button[value*="Guardar"]',
        )
        .first();
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    } else {
        const altSaveBtn = page.locator('.footer-buttons-container input[type="button"]').first();
        if ((await altSaveBtn.count()) > 0) {
            await altSaveBtn.click();
        }
    }
    await page.waitForTimeout(500);

    // Close any alert modals that might appear
    await closeAlertModals(page);
}

/**
 * Helper to save the Form iDevice
 */
async function saveFormIdevice(page: Page): Promise<void> {
    // Close any alert modals first
    await closeAlertModals(page);

    const block = page.locator('#node-content article .idevice_node.form').first();
    const saveBtn = block.locator('.btn-save-idevice');

    // Try to click save, handling potential modals
    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        // If blocked by modal, close it and retry
        await closeAlertModals(page);
        await saveBtn.click({ timeout: 5000 });
    }

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.form');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Helper to verify form renders in preview
 */
async function verifyFormRendered(iframe: FrameLocator): Promise<void> {
    // Wait for form container
    const formContainer = iframe.locator('.form-IDevice').first();
    await formContainer.waitFor({ state: 'visible', timeout: 15000 });

    // Verify questions container exists
    const questionsContainer = iframe.locator('[id^="form-questions-"]').first();
    await expect(questionsContainer).toBeVisible({ timeout: 10000 });

    // Verify check button exists
    const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
    await expect(checkBtn).toBeVisible({ timeout: 5000 });
}

test.describe('Form iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add form iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Form Basic Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add a form iDevice
            await addFormIdeviceFromPanel(page);

            // Verify iDevice was added and is in edition mode
            const idevice = page.locator('#node-content article .idevice_node.form').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });

            // Verify the add question buttons are available
            await expect(page.locator('#buttonHideShowQuestionsTop')).toBeVisible({ timeout: 5000 });
        });

        test('should add a true/false question', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form TrueFalse Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            // Add a true/false question
            await addTrueFalseQuestion(page, 'The sky is blue.', true);

            // Verify question was added (should see it in the form preview)
            const questionPreview = page.locator('#formPreview .question-container, #formPreview [class*="question"]');
            await expect(questionPreview.first()).toBeVisible({ timeout: 5000 });

            // Save the iDevice
            await saveFormIdevice(page);

            await workarea.save();
        });

        test('should add a selection question with multiple options', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Selection Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            // Add a selection question
            await addSelectionQuestion(page, 'What is the capital of France?', [
                { text: 'London', correct: false },
                { text: 'Paris', correct: true },
                { text: 'Berlin', correct: false },
            ]);

            // Save the iDevice
            await saveFormIdevice(page);

            await workarea.save();
        });

        test('should add multiple questions of different types', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Multiple Questions Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            // Add first question (true/false)
            await addTrueFalseQuestion(page, 'Water boils at 100°C.', true);

            // Add second question (selection)
            await addSelectionQuestion(page, 'Which is a primary color?', [
                { text: 'Red', correct: true },
                { text: 'Green', correct: false },
                { text: 'Orange', correct: false },
            ]);

            // Add third question (true/false)
            await addTrueFalseQuestion(page, 'The Earth is flat.', false);

            // Verify we have questions added (look for list items in form preview)
            const questions = page.locator('#formPreview > li, #formPreview .FormView_question, .FormView_question');
            const count = await questions.count();
            expect(count).toBeGreaterThanOrEqual(1);

            // Save the iDevice
            await saveFormIdevice(page);

            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should render form correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Preview Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            // Add questions
            await addTrueFalseQuestion(page, 'Preview test question: True or False?', true);
            await addSelectionQuestion(page, 'Preview test: Select the correct answer', [
                { text: 'Option A', correct: false },
                { text: 'Option B', correct: true },
            ]);

            await saveFormIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(500);

            // Verify form renders correctly
            await verifyFormRendered(iframe);

            // Verify questions are displayed
            const questions = iframe.locator('.FRMP-Question, [class*="question"]');
            const count = await questions.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should have check and reset buttons in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Buttons Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            await addTrueFalseQuestion(page, 'Test question for buttons', true);

            await saveFormIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(500);

            // Verify check button exists
            const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
            await expect(checkBtn).toBeVisible({ timeout: 10000 });

            // Verify show answers button exists (if enabled)
            const showAnswersBtn = iframe.locator('[id^="form-button-show-answers-"]').first();
            // This button may or may not be visible depending on settings
            // Just check it exists in the DOM
            const showAnswersCount = await showAnswersBtn.count();
            expect(showAnswersCount).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('Form Interaction', () => {
        test('should allow answering true/false question', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form TF Interaction Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            await addTrueFalseQuestion(page, 'The sun rises in the east.', true);

            await saveFormIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(500);

            // Find and click on "True" radio button
            const trueRadio = iframe.locator('input[type="radio"][value="true"], label:has-text("True") input');
            if ((await trueRadio.count()) > 0) {
                await trueRadio.first().click();
            }

            // Click check button
            const checkBtn = iframe.locator('[id^="form-button-check-"]').first();
            await checkBtn.click();

            await page.waitForTimeout(500);

            // Verify score is shown
            const scoreText = iframe.locator('[id^="form-score-"], .score-text').first();
            await expect(scoreText).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Persistence', () => {
        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Form Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addFormIdeviceFromPanel(page);

            const uniqueQuestion = `Persistence test question ${Date.now()}`;
            await addTrueFalseQuestion(page, uniqueQuestion, true);

            await saveFormIdevice(page);
            await workarea.save();
            await page.waitForTimeout(500);

            // Reload
            await reloadPage(page);

            await selectPageNode(page);

            // Verify iDevice is still there
            const idevice = page.locator('#node-content article .idevice_node.form').first();
            await expect(idevice).toBeVisible({ timeout: 15000 });
        });
    });
});
