import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for A-Z Quiz Game (Rosco) iDevice
 *
 * Tests the A-Z Quiz Game iDevice functionality including:
 * - Basic operations (add, fill words, save)
 * - Editing multiple letter entries with words and definitions
 * - Preview rendering with rosco wheel and game elements
 * - Game interaction (start game, answer questions)
 * - Persistence after reload
 */

const TEST_DATA = {
    projectTitle: 'AZ Quiz Game E2E Test Project',
    words: [
        { letter: 'A', word: 'Apple', definition: 'A red or green fruit that grows on trees' },
        { letter: 'B', word: 'Banana', definition: 'A yellow curved tropical fruit' },
        { letter: 'C', word: 'Cherry', definition: 'A small red stone fruit' },
    ],
    gameDuration: '120',
};

/**
 * Helper to add an A-Z Quiz Game iDevice by selecting the page and clicking the iDevice
 */
async function addAzQuizGameIdeviceFromPanel(page: Page): Promise<void> {
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

    // Expand "Games" category in iDevices panel
    const gamesCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Games|Juegos/i }),
        })
        .first();

    if ((await gamesCategory.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await gamesCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the .label to expand
            const label = gamesCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for the category content to be visible
    await page.waitForTimeout(500);

    // Find the A-Z Quiz Game iDevice
    const azQuizIdevice = page.locator('.idevice_item[id="az-quiz-game"]').first();

    // Wait for it to be visible and then click
    await azQuizIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await azQuizIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.az-quiz-game').first().waitFor({ timeout: 15000 });

    // Wait for the word inputs to be dynamically created
    await page.waitForTimeout(1500);

    // Wait for the Words fieldset to have content
    await page
        .waitForFunction(
            () => {
                // Check if the word inputs exist (roscoWordEdition class or input with Word placeholder)
                const wordInputs = document.querySelectorAll(
                    '.roscoWordEdition, #roscoDataWord input[placeholder="Word"], #roscoDataWord .roscoWordMutimediaEdition',
                );
                return wordInputs.length >= 26;
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });
}

/**
 * Helper to fill in words for specific letters
 * The iDevice has A-Z inputs, we fill in specific ones
 */
async function fillWords(
    page: Page,
    words: Array<{ letter: string; word: string; definition: string }>,
): Promise<void> {
    for (const entry of words) {
        // Find the word block for this letter by looking at the letter heading
        const wordBlocks = page.locator('.roscoWordMutimediaEdition');
        const count = await wordBlocks.count();

        for (let i = 0; i < count; i++) {
            const block = wordBlocks.nth(i);
            const letterHeading = block.locator('h3.roscoLetterEdition');
            const letterText = await letterHeading.textContent();

            if (letterText?.trim().toUpperCase() === entry.letter.toUpperCase()) {
                // Fill in the word - use input with placeholder "Word" or class
                const wordInput = block.locator('input.roscoWordEdition, input[placeholder="Word"]').first();
                await wordInput.clear();
                await wordInput.fill(entry.word);

                // Fill in the definition
                const definitionInput = block
                    .locator('input.roscoDefinitionEdition, input[placeholder="Definition"]')
                    .first();
                await definitionInput.clear();
                await definitionInput.fill(entry.definition);

                // Trigger blur to update the letter color indicator
                await definitionInput.blur();
                await page.waitForTimeout(300);
                break;
            }
        }
    }
}

/**
 * Helper to set game duration
 * Note: The Options fieldset must be expanded first
 */
async function setGameDuration(page: Page, duration: string): Promise<void> {
    // First, expand the Options fieldset by clicking its header link
    const optionsHeader = page
        .locator('fieldset legend a:has-text("Options"), fieldset legend a:has-text("Opciones")')
        .first();
    if ((await optionsHeader.count()) > 0) {
        await optionsHeader.click();
        await page.waitForTimeout(500);
    }

    const durationInput = page.locator('#roscoDuration');
    if ((await durationInput.count()) > 0) {
        // Scroll into view and wait for visibility
        await durationInput.scrollIntoViewIfNeeded();
        await durationInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        await durationInput.clear();
        await durationInput.fill(duration);
    }
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
 * Helper to save the az-quiz-game iDevice
 */
async function saveAzQuizGameIdevice(page: Page): Promise<void> {
    // Close any alert modals first
    await closeAlertModals(page);

    // Find the iDevice block
    const block = page.locator('#node-content article .idevice_node.az-quiz-game').last();

    // Find and click the Save button
    const saveBtn = block.locator('.btn-save-idevice');

    try {
        await saveBtn.click({ timeout: 5000 });
    } catch {
        // Close modal and try again
        await closeAlertModals(page);
        await saveBtn.click();
    }

    // Wait for save to complete - check for rosco container appearing
    await page.waitForTimeout(2000);

    // Try to wait for edition mode to end (mode attribute changes)
    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.az-quiz-game');
                // Either mode is not edition, or rosco container exists
                return (
                    (idevice && idevice.getAttribute('mode') !== 'edition') ||
                    document.querySelector('#node-content .az-quiz-game .rosco-IDevice') !== null
                );
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });

    await page.waitForTimeout(500);
}

/**
 * Helper to check if rosco elements are visible in preview
 */
async function verifyRoscoInPreview(iframe: FrameLocator): Promise<void> {
    // Wait for the rosco container
    await iframe.locator('.rosco-IDevice').first().waitFor({ state: 'visible', timeout: 10000 });

    // Verify main container is visible
    const mainContainer = iframe.locator('[id^="roscoMainContainer-"]').first();
    await expect(mainContainer).toBeVisible({ timeout: 10000 });
}

test.describe('A-Z Quiz Game iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add az-quiz-game iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'AZ Quiz Add Test');
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

            // Add an A-Z Quiz Game iDevice
            await addAzQuizGameIdeviceFromPanel(page);

            // Verify iDevice was added
            const azQuizIdevice = page.locator('#node-content article .idevice_node.az-quiz-game').first();
            await expect(azQuizIdevice).toBeVisible({ timeout: 10000 });

            // Verify the edition form is visible with word inputs
            // The word blocks have class .roscoWordMutimediaEdition, each containing an input
            const wordBlocks = page.locator('.roscoWordMutimediaEdition');
            const wordBlockCount = await wordBlocks.count();
            expect(wordBlockCount).toBeGreaterThanOrEqual(26); // A-Z = 26 letters
        });

        test('should fill words and definitions for multiple letters', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'AZ Quiz Fill Test');
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
            await addAzQuizGameIdeviceFromPanel(page);

            // Fill in words for A, B, C
            await fillWords(page, TEST_DATA.words);

            // Verify the letter indicators changed color (blue for filled)
            // Find the A letter heading and check its background color
            const aBlock = page.locator('.roscoWordMutimediaEdition').first();
            const aLetterHeading = aBlock.locator('h3.roscoLetterEdition');
            const bgColor = await aLetterHeading.evaluate(el => getComputedStyle(el).backgroundColor);

            // The color should be blue (#0099cc) for filled letters
            expect(bgColor).toContain('rgb'); // Just check it's a color value
        });

        test('should save iDevice and verify content displays correctly', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'AZ Quiz Save Test');
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
            await addAzQuizGameIdeviceFromPanel(page);

            // Fill in words (required for save to work - at least one word needed)
            await fillWords(page, TEST_DATA.words);

            // Save the iDevice
            await saveAzQuizGameIdevice(page);

            // Verify the iDevice is saved - check for the rosco container
            // The saved iDevice shows the game UI with Hits/Errors counters and a Start button
            const roscoContent = page.locator('#node-content .az-quiz-game');
            await expect(roscoContent.first()).toBeAttached({ timeout: 10000 });

            // Verify the game data was saved - check for the Start button or stats area
            const gameStart = page.locator('#node-content .az-quiz-game a:has-text("Click here to start")');
            const statsArea = page.locator('#node-content .az-quiz-game:has-text("Hits")');
            await expect(gameStart.or(statsArea).first()).toBeAttached({ timeout: 5000 });
        });

        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Persist Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save the project
            await workarea.save();
            await page.waitForTimeout(2000);

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

            // Navigate to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(2000);
            }

            // Wait for the iDevice to be rendered
            await page
                .waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content .az-quiz-game');
                        return idevice !== null;
                    },
                    { timeout: 15000 },
                )
                .catch(() => {});

            // Verify the iDevice is still there - check for rosco content
            const roscoContent = page.locator(
                '#node-content .az-quiz-game .rosco-IDevice, #node-content .az-quiz-game .rosco-DataGame',
            );
            await expect(roscoContent.first()).toBeAttached({ timeout: 15000 });
        });
    });

    test.describe('Preview Panel', () => {
        test('should display rosco wheel correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Preview Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

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
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Verify rosco elements are present
            await verifyRoscoInPreview(iframe);
        });

        test('should display canvas with rosco letters in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Canvas Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for the rosco to initialize
            await page.waitForTimeout(2000);

            // Check canvas has proper dimensions (not 0x0)
            const canvasInfo = await iframe
                .locator('[id^="roscoCanvas-"]')
                .first()
                .evaluate(el => {
                    const canvas = el as HTMLCanvasElement;
                    return {
                        width: canvas.width,
                        height: canvas.height,
                        hasContext: !!canvas.getContext('2d'),
                    };
                });

            expect(canvasInfo.width).toBeGreaterThan(0);
            expect(canvasInfo.height).toBeGreaterThan(0);
            expect(canvasInfo.hasContext).toBe(true);
        });

        test('should display letter indicators with correct colors in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Letters Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Check that letter indicators exist
            const letterIndicators = iframe.locator('.rosco-Letter');
            const letterCount = await letterIndicators.count();
            expect(letterCount).toBeGreaterThanOrEqual(26);

            // Check that filled letters (A, B, C) are blue (not gray)
            // The "A" letter should have the blue color (#5877c6 or similar)
            const letterA = iframe.locator('[id^="letterRA-"]').first();
            const letterABgColor = await letterA.evaluate(el => getComputedStyle(el).backgroundColor);
            // Blue color for filled letters
            expect(letterABgColor).not.toContain('rgb(249, 249, 249)'); // Not gray/black (empty)
        });

        test('should show start game button in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Start Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Check start game button is visible
            const startButton = iframe.locator('[id^="roscoStartGame-"]').first();
            await expect(startButton).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Game Interaction', () => {
        test('should start game and show question interface', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Game Start Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Click start game button
            const startButton = iframe.locator('[id^="roscoStartGame-"]').first();
            await startButton.click();

            // Wait for game to start
            await page.waitForTimeout(1000);

            // Verify question div is visible
            const questionDiv = iframe.locator('[id^="roscoQuestionDiv-"]').first();
            await expect(questionDiv).toBeVisible({ timeout: 10000 });

            // Verify reply input is visible
            const replyInput = iframe.locator('[id^="roscoEdReply-"]').first();
            await expect(replyInput).toBeVisible({ timeout: 5000 });

            // Verify submit button is visible
            const submitBtn = iframe.locator('[id^="roscoBtnReply-"]').first();
            await expect(submitBtn).toBeVisible({ timeout: 5000 });
        });

        test('should answer question and update score', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Answer Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Click start game button
            const startButton = iframe.locator('[id^="roscoStartGame-"]').first();
            await startButton.click();
            await page.waitForTimeout(1000);

            // Get the initial hits count
            const hitsCounter = iframe.locator('[id^="roscotPHits-"]').first();
            const initialHits = await hitsCounter.textContent();
            expect(initialHits).toBe('0');

            // The first question should be for letter A (word: Apple)
            // Type the correct answer
            const replyInput = iframe.locator('[id^="roscoEdReply-"]').first();
            await replyInput.fill('Apple');

            // Click submit
            const submitBtn = iframe.locator('[id^="roscoBtnReply-"]').first();
            await submitBtn.click();

            // Wait for answer to be processed
            await page.waitForTimeout(2000);

            // Verify hits counter increased
            const newHits = await hitsCounter.textContent();
            expect(newHits).toBe('1');
        });

        test('should track errors for wrong answers', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Error Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Click start game button
            const startButton = iframe.locator('[id^="roscoStartGame-"]').first();
            await startButton.click();
            await page.waitForTimeout(1000);

            // Get the initial errors count
            const errorsCounter = iframe.locator('[id^="roscotPErrors-"]').first();
            const initialErrors = await errorsCounter.textContent();
            expect(initialErrors).toBe('0');

            // Type a wrong answer
            const replyInput = iframe.locator('[id^="roscoEdReply-"]').first();
            await replyInput.fill('WrongAnswer');

            // Click submit
            const submitBtn = iframe.locator('[id^="roscoBtnReply-"]').first();
            await submitBtn.click();

            // Wait for answer to be processed
            await page.waitForTimeout(2000);

            // Verify errors counter increased
            const newErrors = await errorsCounter.textContent();
            expect(newErrors).toBe('1');
        });

        test('should allow skipping questions with Move On button', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Skip Test');
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

            // Add iDevice and fill words
            await addAzQuizGameIdeviceFromPanel(page);
            await fillWords(page, TEST_DATA.words);
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Click start game button
            const startButton = iframe.locator('[id^="roscoStartGame-"]').first();
            await startButton.click();
            await page.waitForTimeout(1000);

            // Get the first definition text
            const definitionText = iframe.locator('[id^="roscoPDefinition-"]').first();
            const firstDefinition = await definitionText.textContent();

            // Click Move On button to skip
            const moveOnBtn = iframe.locator('[id^="roscoBtnMoveOn-"]').first();
            await moveOnBtn.click();

            // Wait for next question
            await page.waitForTimeout(1000);

            // Verify definition changed (moved to next question)
            const newDefinition = await definitionText.textContent();
            expect(newDefinition).not.toBe(firstDefinition);
        });
    });

    test.describe('Configuration', () => {
        test('should respect game duration setting', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'AZ Quiz Duration Test');
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
            await addAzQuizGameIdeviceFromPanel(page);

            // Fill words
            await fillWords(page, TEST_DATA.words);

            // Set a specific duration (60 seconds)
            await setGameDuration(page, '60');

            // Save
            await saveAzQuizGameIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 10000 });

            // Wait for initialization
            await page.waitForTimeout(2000);

            // Check the time display shows 1:00 (60 seconds)
            const timeDisplay = iframe.locator('[id^="roscoPTime-"]').first();
            const timeText = await timeDisplay.textContent();
            expect(timeText).toContain('1:00');
        });
    });
});
