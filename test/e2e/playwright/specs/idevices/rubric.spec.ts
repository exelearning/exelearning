import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Rubric iDevice
 *
 * Tests the Rubric iDevice functionality including:
 * - Basic operations (add, create new rubric, edit, save)
 * - Editing rubric content (title, criteria, levels, descriptors, weights)
 * - Persistence after reload
 * - Preview rendering with Apply button
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

    // Expand "Assessment and tracking" category in iDevices panel
    const assessmentCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Assessment|Evaluación/i }),
        })
        .first();

    if ((await assessmentCategory.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await assessmentCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the .label to expand
            const label = assessmentCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for the category content to be visible
    await page.waitForTimeout(500);

    // Find the Rubric iDevice
    const rubricIdevice = page.locator('.idevice_item[id="rubric"], [data-testid="idevice-rubric"]').first();

    // Wait for it to be visible and then click
    await rubricIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await rubricIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.rubric').first().waitFor({ timeout: 15000 });
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
 * Cell ID mapping for a 4x4 rubric:
 * - #ri_Cell-0 = caption (title)
 * - #ri_Cell-1 = empty thead th (top-left corner)
 * - #ri_Cell-2 to #ri_Cell-5 = level headers (Level 1-4)
 * - #ri_Cell-6 = first criteria TH (row 1)
 * - #ri_Cell-7 to #ri_Cell-10 = first row descriptors (TDs with weights)
 * - #ri_Cell-7-weight = weight for first descriptor
 */
async function editRubricContent(page: Page, title: string, descriptor?: string, weight?: string): Promise<void> {
    // Edit the title (caption) - #ri_Cell-0
    const titleInput = page.locator('#ri_Cell-0');
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.clear();
    await titleInput.fill(title);

    // Optionally edit a descriptor cell (#ri_Cell-7 is first descriptor TD in row 1)
    if (descriptor) {
        const descriptorInput = page.locator('#ri_Cell-7');
        if ((await descriptorInput.count()) > 0) {
            await descriptorInput.clear();
            await descriptorInput.fill(descriptor);
        }
    }

    // Optionally edit a weight value (#ri_Cell-7-weight is weight for first descriptor)
    if (weight) {
        const weightInput = page.locator('#ri_Cell-7-weight');
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
    // Find and click the Save button
    const saveBtn = page
        .locator('#node-content article .idevice_node.rubric button')
        .filter({ hasText: /^Save$|^Guardar$/i })
        .first();
    await saveBtn.click();

    // Wait for edition mode to end (table should be normal, not editable)
    await page.waitForFunction(
        () => {
            // The editable table has input fields; after save, it should be a normal table
            const editableInputs = document.querySelectorAll('#ri_Table input');
            const normalTable = document.querySelector('#node-content .rubric .exe-table');
            return editableInputs.length === 0 && normalTable !== null;
        },
        { timeout: 15000 },
    );
}

test.describe('Rubric iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add rubric iDevice and create new rubric', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'Rubric Add Test');
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

            // Add a rubric iDevice and create new rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            // Edit the rubric content
            await editRubricContent(page, TEST_DATA.rubricTitle, TEST_DATA.editedDescriptor, TEST_DATA.weight);

            // Save the iDevice
            await saveRubricIdevice(page);

            // Verify the rubric displays correctly after save
            const rubricTable = page.locator('#node-content .rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            // Verify the title is displayed in the caption
            const caption = page.locator('#node-content .rubric .exe-table caption');
            await expect(caption).toContainText(TEST_DATA.rubricTitle, { timeout: 5000 });

            // Verify the edited descriptor is visible
            await expect(page.locator('#node-content .rubric')).toContainText(TEST_DATA.editedDescriptor, {
                timeout: 5000,
            });

            // Verify the weight is displayed (format: "text (weight)")
            await expect(page.locator('#node-content .rubric')).toContainText(`(${TEST_DATA.weight})`, {
                timeout: 5000,
            });
        });

        test('should persist rubric after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Persistence Test');
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

            // Add, create and edit rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            const uniqueTitle = `Persistence Test Rubric ${Date.now()}`;
            await editRubricContent(page, uniqueTitle);
            await saveRubricIdevice(page);

            // Save the project
            await workarea.save();
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

            // Navigate to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(1000);
            }

            // Verify rubric content persisted
            await expect(page.locator('#node-content .rubric')).toContainText(uniqueTitle, { timeout: 15000 });

            // Verify the table structure is intact
            const rubricTable = page.locator('#node-content .rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Preview', () => {
        test('should display rubric table correctly in preview with Apply button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Rubric Preview Test');
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

            // Add, create and edit rubric
            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            const previewTitle = `Preview Test Rubric ${Date.now()}`;
            await editRubricContent(page, previewTitle, 'Preview descriptor', '3');
            await saveRubricIdevice(page);

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

            // Verify the rubric table is displayed
            const rubricTable = iframe.locator('.rubric .exe-table, .idevice_node.rubric .exe-table');
            await expect(rubricTable).toBeVisible({ timeout: 10000 });

            // Verify the title/caption is correct
            const caption = iframe.locator('.rubric .exe-table caption, .idevice_node.rubric .exe-table caption');
            await expect(caption).toContainText(previewTitle, { timeout: 5000 });

            // Verify the "Apply" button is present
            const applyButton = iframe.locator('a.exe-rubrics-print');
            await expect(applyButton).toBeVisible({ timeout: 10000 });
            await expect(applyButton).toContainText(/Apply|Aplicar/i, { timeout: 5000 });

            // Verify the edited descriptor is visible
            await expect(iframe.locator('.rubric, .idevice_node.rubric')).toContainText('Preview descriptor', {
                timeout: 5000,
            });

            // Verify the weight is displayed
            await expect(iframe.locator('.rubric, .idevice_node.rubric')).toContainText('(3)', { timeout: 5000 });

            // Verify the .exe-rubrics-strings list is present (needed for Apply popup i18n)
            const rubricStrings = iframe.locator(
                '.rubric .exe-rubrics-strings, .idevice_node.rubric .exe-rubrics-strings',
            );
            await expect(rubricStrings).toBeAttached({ timeout: 5000 });

            // Verify the strings list contains the expected i18n keys
            await expect(rubricStrings.locator('li.activity')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.name')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.date')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.score')).toBeAttached({ timeout: 2000 });
            await expect(rubricStrings.locator('li.apply')).toBeAttached({ timeout: 2000 });
        });
    });
});
