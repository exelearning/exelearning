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

        test('should edit a descriptor through the cell dialog', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Cell Dialog Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            // Open the descriptor dialog from the first cell
            const firstCell = page.locator('#ri_Table tbody tr').first().locator('td').first();
            await firstCell.locator('a.ri_EditTD').first().click();

            // Dialog and backdrop belong to the iDevice, so both hang from its form
            const dialog = page.locator('#ri_IdeviceForm > #ri_CellEditModal');
            await expect(dialog).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#ri_IdeviceForm > #ri_CellEditModalBackdrop')).toHaveCount(1);

            // Regression guard for #2227: the dialog, not the backdrop, is the
            // topmost element at its own centre.
            const dialogIsOnTop = await page.evaluate(() => {
                const content = document.querySelector('#ri_CellEditModal .modal-content');
                if (!content) return false;
                const rect = content.getBoundingClientRect();
                const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                return !!topmost && !!topmost.closest('#ri_CellEditModal');
            });
            expect(dialogIsOnTop).toBe(true);

            // A real (hit-tested) click: it fails if the backdrop covers the dialog
            const descriptorField = dialog.locator('#ri_CellEditContent');
            await descriptorField.click();
            await descriptorField.fill(TEST_DATA.editedDescriptor);
            await dialog.locator('#ri_CellEditScore').fill(TEST_DATA.weight);

            await dialog.locator('#ri_CellEditAccept').click();

            await expect(dialog).toBeHidden({ timeout: 10000 });
            await expect(page.locator('.ri-edit-backdrop')).toHaveCount(0);

            // The edited values land in the rubric table
            await expect(firstCell.locator('input[type="text"]:not(.ri_Weight)').first()).toHaveValue(
                TEST_DATA.editedDescriptor,
            );
            await expect(firstCell.locator('input.ri_Weight').first()).toHaveValue(TEST_DATA.weight);

            await saveRubricIdevice(page);

            await expect(page.locator('#node-content .idevice_node.rubric')).toContainText(TEST_DATA.editedDescriptor, {
                timeout: 10000,
            });
        });

        test('should block the rubric controls but leave the rest of the app usable', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Dialog Scope Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            await page.locator('#ri_Table tbody tr').first().locator('td').first().locator('a.ri_EditTD').click();
            await expect(page.locator('#ri_CellEditModal')).toBeVisible({ timeout: 10000 });

            const scope = await page.evaluate(() => {
                const reach = (selector: string) => {
                    const el = document.querySelector(selector) as HTMLElement | null;
                    if (!el) return 'absent';
                    const rect = el.getBoundingClientRect();
                    const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    if (!topmost) return 'none';
                    if (topmost.closest('#ri_CellEditModalBackdrop')) return 'blocked';
                    return el.contains(topmost) || topmost.contains(el) ? 'reachable' : 'other';
                };
                const form = document.getElementById('ri_IdeviceForm');
                const panel = document.querySelector('#ri_CellEditModal .modal-content');
                const formRect = form?.getBoundingClientRect();
                const panelRect = panel?.getBoundingClientRect();

                return {
                    rubricTable: reach('#ri_Table caption input'),
                    topBarPreview: reach('#head-bottom-preview'),
                    backdropCoversForm: document.getElementById('ri_CellEditModalBackdrop')?.parentElement?.id ?? null,
                    pageScrollLocked: document.body.classList.contains('modal-open'),
                    centreOffset:
                        formRect && panelRect
                            ? Math.abs((panelRect.left + panelRect.right) / 2 - (formRect.left + formRect.right) / 2)
                            : null,
                };
            });

            // The dialog belongs to the iDevice: it blocks the rubric underneath …
            expect(scope.rubricTable).not.toBe('reachable');
            expect(scope.backdropCoversForm).toBe('ri_IdeviceForm');
            // … and nothing else.
            expect(scope.topBarPreview).toBe('reachable');
            expect(scope.pageScrollLocked).toBe(false);
            // The panel is horizontally centred on the iDevice, not on the window.
            expect(scope.centreOffset).toBeLessThan(2);
        });

        test('should keep the rubric out of reach of the keyboard while a dialog is open', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Dialog Inert Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            await page.locator('#ri_Table tbody tr').first().locator('td').first().locator('a.ri_EditTD').click();
            await expect(page.locator('#ri_CellEditModal')).toBeVisible({ timeout: 10000 });

            // The backdrop only stops the pointer, so the rubric is made inert:
            // focusing one of its inputs must be a no-op.
            const whileOpen = await page.evaluate(() => {
                const input = document.querySelector('#ri_Table caption input') as HTMLElement;
                input.focus();
                return {
                    tookFocus: document.activeElement === input,
                    dialogFieldTakesFocus: (() => {
                        const field = document.getElementById('ri_CellEditContent');
                        field?.focus();
                        return document.activeElement === field;
                    })(),
                };
            });
            expect(whileOpen.tookFocus).toBe(false);
            // The dialog itself stays operable
            expect(whileOpen.dialogFieldTakesFocus).toBe(true);

            await page.locator('#ri_CellEditCancel').click();
            await expect(page.locator('#ri_CellEditModal')).toBeHidden({ timeout: 10000 });

            const afterClose = await page.evaluate(() => {
                const input = document.querySelector('#ri_Table caption input') as HTMLElement;
                input.focus();
                return document.activeElement === input;
            });
            expect(afterClose).toBe(true);
        });

        test('should return the focus to the control that opened the dialog', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Dialog Focus Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            const editLink = page.locator('#ri_Table tbody tr').first().locator('td').first().locator('a.ri_EditTD');
            await editLink.click();
            await expect(page.locator('#ri_CellEditModal')).toBeVisible({ timeout: 10000 });

            // Esc closes the dialog, so keyboard users must land back on the pencil
            await page.keyboard.press('Escape');
            await expect(page.locator('#ri_CellEditModal')).toBeHidden({ timeout: 10000 });

            const focusIsBack = await page.evaluate(() => {
                const active = document.activeElement;
                const opener = document.querySelector('#ri_Table tbody tr td a.ri_EditTD');
                return !!active && active === opener;
            });
            expect(focusIsBack).toBe(true);
        });

        test('should keep the edits pending in a dialog when the iDevice is saved', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Save With Dialog Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            // Type into the row dialog and save the iDevice without accepting it:
            // its Save button is outside the rubric form, so it stays clickable.
            await page.locator('#ri_Table tbody tr').first().locator('a.ri_EditTR').click();
            await expect(page.locator('#ri_RowEditModal')).toBeVisible({ timeout: 10000 });
            const pendingDescriptor = 'Descriptor pending in the dialog';
            await page.locator('#ri_RowEditContent').fill(pendingDescriptor);

            await saveRubricIdevice(page);

            await expect(page.locator('#node-content .idevice_node.rubric')).toContainText(pendingDescriptor, {
                timeout: 10000,
            });
        });

        test('should show the unsaved-changes confirmation above the row dialog', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Rubric Row Dialog Confirm Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await addRubricIdeviceFromPanel(page);
            await createNewRubric(page);

            // Dirty the row dialog and close it without saving
            await page.locator('#ri_Table tbody tr').first().locator('a.ri_EditTR').click();
            const rowDialog = page.locator('#ri_RowEditModal');
            await expect(rowDialog).toBeVisible({ timeout: 10000 });
            await page.locator('#ri_RowEditContent').fill('Descriptor sin guardar');
            await page.locator('#ri_RowEditCancel').click();

            const confirmDialog = page.locator('#modalConfirm');
            await expect(confirmDialog).toBeVisible({ timeout: 10000 });

            // The app confirm lives in the root stacking context, the rubric dialog
            // inside the editor, so the confirmation must paint above it.
            const confirmIsOnTop = await page.evaluate(() => {
                const button = document.querySelector('#modalConfirm .modal-footer button');
                if (!button) return false;
                const rect = button.getBoundingClientRect();
                const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                return !!topmost && !!topmost.closest('#modalConfirm');
            });
            expect(confirmIsOnTop).toBe(true);

            // A real (hit-tested) click: it fails if the rubric dialog covers the confirmation
            await confirmDialog.locator('.modal-footer button').first().click();
            await expect(rowDialog).toBeHidden({ timeout: 10000 });
        });

        for (const exit of ['save', 'discard', 'delete'] as const) {
            test(`should leave no dialog behind when leaving edition through ${exit}`, async ({
                authenticatedPage,
                createProject,
            }) => {
                const page = authenticatedPage;

                const projectUuid = await createProject(page, `Rubric Dialog Cleanup ${exit}`);
                await gotoWorkarea(page, projectUuid);

                await waitForAppReady(page);

                await addRubricIdeviceFromPanel(page);
                await createNewRubric(page);

                // Open and close a dialog so it exists in the DOM
                await page.locator('#ri_Table tbody tr').first().locator('td').first().locator('a.ri_EditTD').click();
                await expect(page.locator('#ri_CellEditModal')).toBeVisible({ timeout: 10000 });
                await page.locator('#ri_CellEditCancel').click();
                await expect(page.locator('#ri_CellEditModal')).toBeHidden({ timeout: 10000 });

                const rubricNode = page.locator('#node-content .idevice_node.rubric');
                if (exit === 'save') {
                    await rubricNode.locator('.btn-save-idevice').first().click();
                } else {
                    const button = exit === 'discard' ? '.btn-undo-idevice' : '.btn-delete-idevice';
                    await rubricNode.locator(button).first().click();
                    await expect(page.locator('#modalConfirm')).toBeVisible({ timeout: 10000 });
                    await page.locator('#modalConfirm .modal-footer button').first().click();
                }

                await page.waitForFunction(
                    () => {
                        const node = document.querySelector('#node-content article .idevice_node.rubric');
                        return !node || node.getAttribute('mode') !== 'edition';
                    },
                    undefined,
                    { timeout: 15000 },
                );

                // The dialogs live inside the editor, so they die with it
                await expect(page.locator('#ri_CellEditModal')).toHaveCount(0);
                await expect(page.locator('#ri_RowEditModal')).toHaveCount(0);
                await expect(page.locator('#ri_ColumnEditModal')).toHaveCount(0);
                await expect(page.locator('.ri-edit-backdrop')).toHaveCount(0);
            });
        }

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
