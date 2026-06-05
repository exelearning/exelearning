import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    reloadPage,
    gotoWorkarea,
    selectFirstPage,
    addIdevice,
    getPreviewFrame,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Rubric iDevice
 *
 * Tests the Rubric iDevice functionality including:
 * - Basic operations (add, create new rubric, edit, save)
 * - Editing rubric content (title, criteria, levels, descriptors, weights)
 * - Persistence after reload
 * - Preview rendering with Download/Reset buttons
 */

const TEST_DATA = {
    projectTitle: 'Rubric E2E Test Project',
    rubricTitle: 'E2E Test Rubric',
    editedDescriptor: 'E2E edited descriptor content',
    weight: '5',
};

/**
 * Helper to add a Rubric iDevice by selecting the page and clicking the iDevice
 */
async function addRubricIdeviceFromPanel(page: Page): Promise<void> {
    // Select non-root page before adding iDevices.
    await selectFirstPage(page);

    // Expand "Assessment and tracking" category in iDevices panel
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
            await page.waitForFunction(
                element => !!element && !element.classList.contains('off'),
                await assessmentCategory.elementHandle(),
                { timeout: 10000 },
            );
        }
    }

    await addIdevice(page, 'rubric');
}
/**
 * Helper to create a new rubric by clicking the "New rubric" button
 */
async function createNewRubric(page: Page): Promise<void> {
    // Click the "New rubric" button
    const newRubricBtn = page.locator('#ri_CreateNewRubric');
    await newRubricBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newRubricBtn.click();

    // Wait for the rubric table editor to appear
    await page.locator('#ri_Table').waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Helper to edit rubric content
 *
 * Uses semantic selectors (caption/first descriptor cell) instead of
 * brittle internal input ids so the test remains stable if id numbering changes.
 */
async function editRubricContent(page: Page, title: string, descriptor?: string, weight?: string): Promise<void> {
    // Edit title input from caption.
    const titleInput = page.locator('#ri_Table caption input[type="text"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.clear();
    await titleInput.fill(title);

    // Optionally edit first descriptor cell in row 1/col 1.
    if (descriptor) {
        const descriptorInput = page
            .locator('#ri_Table tbody tr')
            .first()
            .locator('td')
            .first()
            .locator('input[type="text"]:not(.ri_Weight)');
        if ((await descriptorInput.count()) > 0) {
            await descriptorInput.clear();
            await descriptorInput.fill(descriptor);
        }
    }

    // Optionally edit first descriptor weight value.
    if (weight) {
        const weightInput = page.locator('#ri_Table tbody tr').first().locator('td').first().locator('input.ri_Weight');
        if ((await weightInput.count()) > 0) {
            await weightInput.clear();
            await weightInput.fill(weight);
        }
    }
}
/**
 * Helper to save the rubric iDevice
 */
async function saveRubricIdevice(page: Page): Promise<void> {
    const rubricNode = page.locator('#node-content article .idevice_node.rubric').first();
    await rubricNode.waitFor({ state: 'visible', timeout: 10000 });

    // Save using stable iDevice action button.
    const saveBtn = rubricNode.locator('.btn-save-idevice').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();

    // Wait for edition mode to end.
    await page.waitForFunction(
        () => {
            const node = document.querySelector('#node-content article .idevice_node.rubric');
            return !!node && node.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 15000 },
    );

    // Confirm rendered table is present after save.
    await expect(page.locator('#node-content .idevice_node.rubric .exe-table').first()).toBeVisible({ timeout: 10000 });
}

/**
 * Ensure rubric content is expanded in preview iframe.
 */
async function ensureExpandedRubricInPreview(page: Page): Promise<void> {
    const iframe = getPreviewFrame(page);
    const rubricArticle = iframe
        .locator('article.box')
        .filter({
            has: iframe.locator('h1.box-title').filter({ hasText: /Rubric|Rúbrica/i }),
        })
        .first();

    await rubricArticle.waitFor({ state: 'attached', timeout: 10000 });

    const boxContent = rubricArticle.locator('.box-content').first();
    const isExpanded = (await boxContent.count()) > 0 && (await boxContent.isVisible().catch(() => false));
    if (!isExpanded) {
        const toggleButton = rubricArticle.locator('.box-toggle').first();
        if ((await toggleButton.count()) > 0) {
            await toggleButton.click();
        }
    }

    await boxContent.waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Resolve the rubric root container inside preview.
 *
 * Preferred structure is `.exe-rubrics-wrapper`.
 * Fallback keeps compatibility with intermediate markup states.
 */
async function getRubricRootInPreview(page: Page) {
    const iframe = getPreviewFrame(page);
    const wrapper = iframe.locator('.exe-rubrics-wrapper').first();
    if ((await wrapper.count()) > 0) {
        await wrapper.waitFor({ state: 'visible', timeout: 10000 });
        return wrapper;
    }

    const fallback = iframe.locator('.idevice_node.rubric').first();
    await fallback.waitFor({ state: 'visible', timeout: 10000 });
    return fallback;
}
test.describe('Rubric iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add rubric iDevice and create new rubric', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'Rubric Add Test');
            await gotoWorkarea(page, projectUuid);

            // Wait for app initialization
            await waitForAppReady(page);

            // Add a rubric iDevice
            await addRubricIdeviceFromPanel(page);

            // Verify iDevice was added
            const rubricIdevice = page.locator('#node-content article .idevice_node.rubric').first();
            await expect(rubricIdevice).toBeVisible({ timeout: 10000 });

            // Create a new rubric
            await createNewRubric(page);

            // Verify the rubric table editor appeared with default 4x4 structure
            const rubricTable = page.locator('#ri_Table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            // Verify it has the expected structure (4 levels in thead + empty th)
            const theadThs = page.locator('#ri_Table thead th');
            await expect(theadThs).toHaveCount(5, { timeout: 5000 }); // 1 empty + 4 levels

            // Verify it has 4 criteria rows
            const tbodyTrs = page.locator('#ri_Table tbody tr');
            await expect(tbodyTrs).toHaveCount(4, { timeout: 5000 });
        });

        test('should edit rubric content and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Edit Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add a rubric iDevice and create new rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            // Edit the rubric content
            await editRubricContent(page, TEST_DATA.rubricTitle, TEST_DATA.editedDescriptor, TEST_DATA.weight);

            // Save the iDevice
            await saveRubricIdevice(page);

            // Verify the rubric displays correctly after save
            const rubricTable = page.locator('#node-content .idevice_node.rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            // Verify the title is displayed in the caption
            const caption = page.locator('#node-content .idevice_node.rubric .exe-table caption');
            await expect(caption).toContainText(TEST_DATA.rubricTitle, { timeout: 5000 });

            // Verify the edited descriptor is visible
            await expect(page.locator('#node-content .idevice_node.rubric')).toContainText(TEST_DATA.editedDescriptor, {
                timeout: 5000,
            });

            // Verify the weight is displayed (format: "text (weight)")
            await expect(page.locator('#node-content .idevice_node.rubric')).toContainText(`(${TEST_DATA.weight})`, {
                timeout: 5000,
            });
        });

        test('should persist rubric after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add, create and edit rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            const uniqueTitle = `Persistence Test Rubric ${Date.now()}`;
            await editRubricContent(page, uniqueTitle);
            await saveRubricIdevice(page);

            // Save the project
            await workarea.save();

            // Reload the page
            await reloadPage(page);

            // Navigate to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForFunction(
                    () => {
                        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
                        return !!selected;
                    },
                    undefined,
                    { timeout: 10000 },
                );
            }

            // Verify rubric content persisted
            await expect(page.locator('#node-content .idevice_node.rubric')).toContainText(uniqueTitle, {
                timeout: 15000,
            });

            // Verify the table structure is intact
            const rubricTable = page.locator('#node-content .idevice_node.rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Preview', () => {
        test('should display rubric table correctly in preview with Download button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Preview Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Add, create and edit rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            const previewTitle = `Preview Test Rubric ${Date.now()}`;
            await editRubricContent(page, previewTitle, 'Preview descriptor', '3');
            await saveRubricIdevice(page);

            // Save project
            await workarea.save();
            const previewLoaded = await waitForPreviewContent(page, 45000);
            expect(previewLoaded).toBe(true);

            // Expand rubric if needed and wait for visible rubric content.
            await ensureExpandedRubricInPreview(page);
            const rubricRoot = await getRubricRootInPreview(page);
            await expect(rubricRoot).toBeVisible({ timeout: 10000 });

            // Verify the rubric table is displayed
            const rubricTable = rubricRoot.locator('.exe-table').first();
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            // Verify the title/caption is correct
            const caption = rubricTable.locator('caption').first();
            await expect(caption).toContainText(previewTitle, { timeout: 5000 });

            // Verify the "Download" button is present (replaces old "Apply" button)
            const downloadButton = rubricRoot.locator('button.exe-rubrics-download').first();
            await expect(downloadButton).toBeVisible({ timeout: 10000 });
            await expect(downloadButton).toContainText(/Download|Descargar/i, { timeout: 5000 });

            // Verify the "Reset" button is present
            const resetButton = rubricRoot.locator('button.exe-rubrics-reset').first();
            await expect(resetButton).toBeVisible({ timeout: 10000 });

            // Verify the edited descriptor is visible
            await expect(rubricRoot).toContainText('Preview descriptor', {
                timeout: 5000,
            });

            // Verify the weight is displayed
            await expect(rubricRoot).toContainText('(3)', { timeout: 5000 });
        });
    });
});
