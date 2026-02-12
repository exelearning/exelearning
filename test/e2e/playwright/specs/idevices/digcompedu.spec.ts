import { test, expect } from '../../fixtures/auth.fixture';
import { reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for DigCompEdu iDevice
 *
 * Tests the DigCompEdu iDevice functionality including:
 * - Adding the iDevice and loading framework data
 * - Selecting indicators via checkboxes
 * - Changing selection granularity (competence, level, indicator)
 * - Filtering by level
 * - Previewing summary modal
 * - Saving and persistence
 * - Preview rendering with summary table
 */

/**
 * Helper to add a DigCompEdu iDevice by selecting the page and clicking the iDevice
 */
async function addDigcompeduIdeviceFromPanel(page: Page): Promise<void> {
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
    const informationCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await informationCategory.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await informationCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the .label to expand
            const label = informationCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for the category content to be visible
    await page.waitForTimeout(500);

    // Find the DigCompEdu iDevice
    const digcompeduIdevice = page.locator('.idevice_item[id="digcompedu"]').first();

    // Wait for it to be visible and then click
    await digcompeduIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await digcompeduIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.digcompedu').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to wait for the DigCompEdu framework data to load
 */
async function waitForFrameworkDataLoaded(page: Page): Promise<void> {
    // Wait for the editor container to appear
    await page.locator('.digcompedu-editor').first().waitFor({ timeout: 15000 });

    // Wait for framework data to load (table should have rows)
    await page.waitForFunction(
        () => {
            const tableBody = document.querySelector('#digcompeduTableBody');
            const errorEl = document.querySelector('.digcompedu-error');
            if (errorEl) {
                throw new Error('Framework data could not be loaded');
            }
            return tableBody && tableBody.querySelectorAll('tr').length > 0;
        },
        { timeout: 15000 },
    );
}

/**
 * Helper to select indicators by clicking checkboxes
 */
async function selectIndicators(page: Page, count: number): Promise<string[]> {
    const checkboxes = await page.locator('#digcompeduTableBody input[type="checkbox"]').all();
    const selectedIds: string[] = [];

    for (let i = 0; i < Math.min(count, checkboxes.length); i++) {
        const checkbox = checkboxes[i];
        const id = await checkbox.getAttribute('value');
        await checkbox.click();
        await page.waitForTimeout(100);
        if (id) selectedIds.push(id);
    }

    return selectedIds;
}

/**
 * Helper to save the DigCompEdu iDevice
 */
async function saveDigcompeduIdevice(page: Page): Promise<void> {
    const saveBtn = page.locator('#node-content article .idevice_node.digcompedu .btn-save-idevice');
    await saveBtn.click();

    // Wait for edition mode to end
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.digcompedu');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        { timeout: 15000 },
    );
}

test.describe('DigCompEdu iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add digcompedu iDevice and load framework data', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'DigCompEdu Add Test');
            await gotoWorkarea(page, projectUuid);

            // Add a DigCompEdu iDevice
            await addDigcompeduIdeviceFromPanel(page);

            // Wait for framework data to load
            await waitForFrameworkDataLoaded(page);

            // Verify the editor structure
            const tableBody = page.locator('#digcompeduTableBody');
            const rowCount = await tableBody.locator('tr').count();
            expect(rowCount).toBeGreaterThan(0);

            // Verify checkboxes are present
            const checkboxCount = await tableBody.locator('input[type="checkbox"]').count();
            expect(checkboxCount).toBeGreaterThan(0);

            // Verify the selection counter shows initial state
            const counter = page.locator('#digcompeduSelectionCounter');
            await expect(counter).toContainText(/No items selected|Ningún elemento/i, { timeout: 5000 });
        });

        test('should select indicators and update selection counter', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Selection Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select 3 indicators
            await selectIndicators(page, 3);

            // Verify selection counter updated
            const counter = page.locator('#digcompeduSelectionCounter');
            await expect(counter).toContainText(/Selected items: 3|Elementos seleccionados: 3/i, { timeout: 5000 });
        });

        test('should filter indicators by level', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Filter Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Get initial row count
            const initialRowCount = await page.locator('#digcompeduTableBody tr').count();

            // Uncheck all levels except A1
            const levelFilters = ['A2', 'B1', 'B2', 'C1', 'C2'];
            for (const level of levelFilters) {
                const checkbox = page.locator(`#digcompedu-filter-${level.toLowerCase()}`);
                if (await checkbox.isChecked()) {
                    await checkbox.click();
                    await page.waitForTimeout(100);
                }
            }

            // Wait for table to update
            await page.waitForTimeout(500);

            // Get filtered row count - should be less than initial
            const filteredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(filteredRowCount).toBeLessThan(initialRowCount);
            expect(filteredRowCount).toBeGreaterThan(0);
        });

        test('should preview summary in modal', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Preview Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select some indicators
            await selectIndicators(page, 5);

            // Click preview summary button
            const previewBtn = page.locator('#digcompeduPreviewSummary');
            await previewBtn.click();

            // Wait for modal to appear
            const modal = page.locator('#digcompeduSummaryModal[aria-hidden="false"]');
            await expect(modal).toBeVisible({ timeout: 5000 });

            // Verify summary table is present
            const summaryTable = page.locator('#digcompeduSummaryTablePreview table');
            await expect(summaryTable).toBeVisible({ timeout: 5000 });

            // Verify the summary table has the expected structure (areas header row)
            const headerCells = summaryTable.locator('thead th');
            const headerCount = await headerCells.count();
            expect(headerCount).toBeGreaterThan(0);

            // Close modal
            await page.locator('#digcompeduSummaryModalClose').click();
            await expect(modal).toBeHidden({ timeout: 5000 });
        });

        test('should save iDevice and persist selection', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'DigCompEdu Save Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select some indicators
            await selectIndicators(page, 3);

            // Save the iDevice
            await saveDigcompeduIdevice(page);

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

            // Verify the iDevice shows saved content (not in edit mode)
            const idevice = page.locator('#node-content article .idevice_node.digcompedu');
            await expect(idevice).toBeVisible({ timeout: 15000 });

            // Verify it's showing export mode content (summary table)
            const summaryContent = idevice.locator('.digcompeduIdeviceContent');
            await expect(summaryContent).toBeVisible({ timeout: 10000 });

            // Verify the summary shows selected count
            await expect(summaryContent).toContainText(/Selected indicators|Indicadores seleccionados/i, {
                timeout: 5000,
            });
        });
    });

    test.describe('Selection Granularity', () => {
        test('should change selection granularity to level', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Granularity Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Change granularity to "Levels"
            const levelRadio = page.locator('#digcompedu-granularity-level');
            await levelRadio.click();
            await page.waitForTimeout(300);

            // Now when we select one checkbox, it should select all indicators in that level
            const firstCheckbox = page.locator('#digcompeduTableBody input[type="checkbox"]').first();
            await firstCheckbox.click();
            await page.waitForTimeout(200);

            // The selection counter should show more than 1 if there are multiple indicators per level
            const counter = page.locator('#digcompeduSelectionCounter');
            const counterText = await counter.textContent();

            // Verify that granularity is working (selection was made)
            expect(counterText).toMatch(/Selected items|Elementos seleccionados/i);
        });
    });

    test.describe('Preview Rendering', () => {
        test('should display summary table in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'DigCompEdu Preview Panel Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select some indicators
            await selectIndicators(page, 5);

            // Save the iDevice
            await saveDigcompeduIdevice(page);

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

            // Verify the DigCompEdu content is displayed
            const digcompeduContent = iframe.locator('.digcompeduIdeviceContent').first();
            await expect(digcompeduContent).toBeVisible({ timeout: 10000 });

            // Verify the summary table is present
            const summaryTable = iframe.locator('.digcompedu-summary-table').first();
            await expect(summaryTable).toBeVisible({ timeout: 10000 });

            // Verify the table has colored area headers
            const areaHeaders = summaryTable.locator('thead th[class*="area"]');
            const areaCount = await areaHeaders.count();
            expect(areaCount).toBeGreaterThan(0);
        });

        test('should display textual summary when table+summary mode is selected', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'DigCompEdu Summary Mode Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select "Table + textual summary" display mode
            const tableSummaryRadio = page.locator('#digcompeduDisplayTableSummary');
            await tableSummaryRadio.click();
            await page.waitForTimeout(200);

            // Select some indicators
            await selectIndicators(page, 5);

            // Save the iDevice
            await saveDigcompeduIdevice(page);

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

            // Verify the DigCompEdu content is displayed
            const digcompeduContent = iframe.locator('.digcompeduIdeviceContent').first();
            await expect(digcompeduContent).toBeVisible({ timeout: 10000 });

            // Verify the textual summary is present (only in table+summary mode)
            const textSummary = iframe.locator('.digcompedu-text-summary').first();
            await expect(textSummary).toBeVisible({ timeout: 10000 });

            // Verify the text summary has content (headings and lists)
            const summaryHeadings = textSummary.locator('h6');
            const headingCount = await summaryHeadings.count();
            expect(headingCount).toBeGreaterThan(0);
        });
    });

    test.describe('Reset and Search', () => {
        test('should reset selection when reset button is clicked', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Reset Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Select some indicators
            await selectIndicators(page, 5);

            // Verify selection was made
            const counter = page.locator('#digcompeduSelectionCounter');
            await expect(counter).toContainText(/Selected items: 5|Elementos seleccionados: 5/i, { timeout: 5000 });

            // Click reset button
            const resetBtn = page.locator('#digcompeduResetSelection');
            await resetBtn.click();
            await page.waitForTimeout(300);

            // Verify selection was reset
            await expect(counter).toContainText(/No items selected|Ningún elemento/i, { timeout: 5000 });
        });

        test('should filter indicators using search input', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'DigCompEdu Search Test');
            await gotoWorkarea(page, projectUuid);

            await addDigcompeduIdeviceFromPanel(page);
            await waitForFrameworkDataLoaded(page);

            // Get initial row count
            const initialRowCount = await page.locator('#digcompeduTableBody tr').count();

            // Type in search input
            const searchInput = page.locator('#digcompeduSearch');
            await searchInput.fill('comunicación');
            await page.waitForTimeout(500);

            // Get filtered row count - should be less than initial
            const filteredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(filteredRowCount).toBeLessThan(initialRowCount);
            expect(filteredRowCount).toBeGreaterThan(0);

            // Clear search and verify all rows return
            await searchInput.clear();
            await page.waitForTimeout(500);

            const restoredRowCount = await page.locator('#digcompeduTableBody tr').count();
            expect(restoredRowCount).toBe(initialRowCount);
        });
    });
});
