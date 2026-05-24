import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    expandIdeviceCategory,
    saveProject,
    reloadPage,
} from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for 3D Viewer iDevice
 *
 * Tests the 3D Viewer iDevice functionality including:
 * - Basic operations (add to blank document)
 * - GLB model upload via file picker
 * - model-viewer display and loading
 * - Preview panel display
 * - Customization options (background color, camera controls, auto-rotate)
 */

/**
 * Helper to add a 3D Viewer iDevice from the panel
 */
async function add3DViewerIdevice(page: Page): Promise<void> {
    // Expand "Information and presentation" category
    await expandIdeviceCategory(page, /Information|Información/i);

    // Find and click the 3D Viewer iDevice
    const threeDIdevice = page.locator('.idevice_item[id="three-d-viewer"]').first();
    await threeDIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await threeDIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.three-d-viewer').first().waitFor({ timeout: 15000 });

    // Wait for model-viewer to be loaded
    await page
        .waitForFunction(
            () => {
                const modelViewer = document.querySelector('#threeDViewerPreview model-viewer');
                return modelViewer !== null;
            },
            { timeout: 15000 },
        )
        .catch(() => {});
}

/**
 * Helper to upload a 3D model via the file picker
 */
async function uploadModelViaFilePicker(page: Page, fixturePath: string): Promise<void> {
    // Wait for the browse button (created by legacyExeIdevicesFilePicker)
    const browseButton = page.locator('input.exe-pick-any-file, input.exe-pick-image').first();
    await browseButton.waitFor({ state: 'visible', timeout: 10000 });
    await browseButton.click();

    // Wait for the file manager modal to open
    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 10000 });

    // Upload the file
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // Wait for the file to appear in the media library
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 15000 });

    // Select and insert the file
    await mediaItem.click();
    await page.waitForTimeout(500);

    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await insertBtn.click();

    // Wait for modal to close
    await page.waitForTimeout(1000);
}

/**
 * Helper to save the 3D Viewer iDevice
 */
async function save3DViewerIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.three-d-viewer').last();
    const saveBtn = block.locator('.btn-save-idevice');

    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    // Wait for edition mode to end
    await page
        .waitForFunction(
            () => {
                const idevice = document.querySelector('#node-content article .idevice_node.three-d-viewer');
                return idevice && idevice.getAttribute('mode') !== 'edition';
            },
            { timeout: 15000 },
        )
        .catch(() => {});

    await page.waitForTimeout(500);
}

test.describe('3D Viewer iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add 3D viewer iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Add Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Select a page before adding iDevice
            await selectFirstPage(page);

            // Add a 3D Viewer iDevice
            await add3DViewerIdevice(page);

            // Verify iDevice was added
            const threeDIdevice = page.locator('#node-content article .idevice_node.three-d-viewer').first();
            await expect(threeDIdevice).toBeVisible({ timeout: 10000 });

            // Verify the form elements are visible
            const modelFileInput = page.locator('#threeD3DModelFile');
            await expect(modelFileInput).toBeAttached({ timeout: 5000 });

            // Verify the viewer preview container exists
            const viewerPreview = page.locator('#threeDViewerPreview');
            await expect(viewerPreview).toBeVisible({ timeout: 5000 });

            // Verify the model-viewer element exists
            const modelViewer = page.locator('#threeDViewerPreview model-viewer');
            await expect(modelViewer).toBeAttached({ timeout: 5000 });

            // Verify the empty state is shown initially
            const emptyState = page.locator('#threeDViewerPreview [data-empty-state]');
            await expect(emptyState).toBeVisible();
        });

        test('should have file picker button for model selection', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer File Picker Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify the file input has exe-file-picker class
            const modelFileInput = page.locator('#threeD3DModelFile');
            const hasClass = await modelFileInput.evaluate(el => el.classList.contains('exe-file-picker'));
            expect(hasClass).toBe(true);

            // Verify a browse button exists
            const browseButton = page.locator('input.exe-pick-any-file, input.exe-pick-image').first();
            await expect(browseButton).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Model Upload', () => {
        test('should upload GLB model and display in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer GLB Upload Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Upload GLB model via file picker
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Wait for the model to load in model-viewer
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            // Verify empty state is hidden
            const emptyState = page.locator('#threeDViewerPreview [data-empty-state]');
            await expect(emptyState).toBeHidden({ timeout: 5000 });

            // Verify the input has a value with asset:// URL format
            const modelFileInput = page.locator('#threeD3DModelFile');
            const inputValue = await modelFileInput.inputValue();
            expect(inputValue).toBeTruthy();
            expect(inputValue.startsWith('asset://')).toBe(true);
            expect(inputValue.endsWith('.glb')).toBe(true);
        });

        test('should upload STL model and keep it as STL (rendered natively with Three.js)', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer STL Upload Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Upload STL model via file picker
            await uploadModelViaFilePicker(page, 'test/fixtures/ascii-cube.stl');

            // Wait for the input to reflect the uploaded STL asset (no conversion)
            await page.waitForFunction(
                () => {
                    const input = document.querySelector('#threeD3DModelFile') as HTMLInputElement;
                    return input?.value?.startsWith('asset://') && input?.value?.endsWith('.stl');
                },
                { timeout: 30000 },
            );

            // Verify the input keeps the STL asset path (rendered natively, no orphan GLB)
            const modelFileInput = page.locator('#threeD3DModelFile');
            const inputValue = await modelFileInput.inputValue();
            expect(inputValue).toBeTruthy();
            expect(inputValue.startsWith('asset://')).toBe(true);
            expect(inputValue.endsWith('.stl')).toBe(true);
        });

        test('should upload both GLB and STL models in sequence', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Multi-Format Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);

            // --- Test 1: Add 3D Viewer with GLB ---
            await add3DViewerIdevice(page);
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Wait for GLB to load
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            // Verify GLB is set
            const glbInput = page.locator('#threeD3DModelFile');
            const glbValue = await glbInput.inputValue();
            expect(glbValue.startsWith('asset://')).toBe(true);
            expect(glbValue.endsWith('.glb')).toBe(true);

            // Save the first iDevice
            await save3DViewerIdevice(page);

            // --- Test 2: Add another 3D Viewer with STL ---
            await add3DViewerIdevice(page);
            await uploadModelViaFilePicker(page, 'test/fixtures/ascii-cube.stl');

            // STL stays as STL (rendered natively with Three.js, no conversion)
            await page.waitForFunction(
                () => {
                    const inputs = document.querySelectorAll('#threeD3DModelFile');
                    const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
                    return lastInput?.value?.startsWith('asset://') && lastInput?.value?.endsWith('.stl');
                },
                { timeout: 30000 },
            );

            const stlValue = await page.evaluate(() => {
                const inputs = document.querySelectorAll('#threeD3DModelFile');
                const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
                return lastInput?.value || '';
            });
            expect(stlValue.startsWith('asset://')).toBe(true);
            expect(stlValue.endsWith('.stl')).toBe(true);

            // Save the second iDevice
            await save3DViewerIdevice(page);

            // Verify both iDevices exist on the page
            const ideviceCount = await page.locator('#node-content article .idevice_node.three-d-viewer').count();
            expect(ideviceCount).toBe(2);
        });

        test('should update model input value after file selection', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Input Update Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify input is initially empty
            const modelFileInput = page.locator('#threeD3DModelFile');
            const initialValue = await modelFileInput.inputValue();
            expect(initialValue).toBe('');

            // Upload GLB model
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Verify input now has a value
            const updatedValue = await modelFileInput.inputValue();
            expect(updatedValue.startsWith('asset://')).toBe(true);
            expect(updatedValue.endsWith('.glb')).toBe(true);
        });
    });

    test.describe('Customization Options', () => {
        test('should have camera controls checkbox', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Camera Controls Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify camera controls checkbox exists and is checked by default
            const cameraControlsCheckbox = page.locator('#threeDCameraControls');
            await expect(cameraControlsCheckbox).toBeVisible();
            const isChecked = await cameraControlsCheckbox.isChecked();
            expect(isChecked).toBe(true);
        });

        test('should have auto-rotate checkbox and speed input', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Auto Rotate Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify auto-rotate checkbox exists
            const autoRotateCheckbox = page.locator('#threeDAutoRotate');
            await expect(autoRotateCheckbox).toBeVisible();

            // Verify auto-rotate speed input exists
            const autoRotateSpeed = page.locator('#threeDAutoRotateSpeed');
            await expect(autoRotateSpeed).toBeVisible();
        });

        test('should have background color input', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Background Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify background color input exists
            const bgColorInput = page.locator('#threeDBackground');
            await expect(bgColorInput).toBeVisible();

            // Verify default background color
            const bgColor = await bgColorInput.inputValue();
            expect(bgColor).toBe('#f5f5f5');
        });

        test('should have alt text input', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Alt Text Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Verify alt text input exists
            const altInput = page.locator('#threeDAlt');
            await expect(altInput).toBeVisible();

            // Set alt text
            await altInput.fill('A 3D model of a cube');
            await altInput.blur();
            await page.waitForTimeout(500);

            // Verify alt text input has the value
            const altValue = await altInput.inputValue();
            expect(altValue).toBe('A 3D model of a cube');
        });
    });

    test.describe('Save and Persist', () => {
        test('should save iDevice with model and settings', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Save Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Upload GLB model
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Wait for model to load
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            // Set alt text
            const altInput = page.locator('#threeDAlt');
            await altInput.fill('Test 3D model');

            // Save the iDevice
            await save3DViewerIdevice(page);

            // Verify the iDevice is saved and shows the viewer
            const viewerWrapper = page.locator(
                '#node-content .three-d-viewer model-viewer, #node-content .three-d-viewer .three-d-viewer-wrapper',
            );
            await expect(viewerWrapper.first()).toBeAttached({ timeout: 10000 });

            // Save the project
            await saveProject(page);
        });

        test('should persist 3D viewer after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Persistence Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Upload GLB model
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Wait for model to load
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            // Save the iDevice and project
            await save3DViewerIdevice(page);
            await saveProject(page);

            // Reload the page
            await reloadPage(page);

            // Navigate to the page
            await selectFirstPage(page);

            // Verify 3D viewer content persisted
            const viewerWrapper = page.locator(
                '#node-content .three-d-viewer model-viewer, #node-content .three-d-viewer .three-d-viewer-wrapper',
            );
            await expect(viewerWrapper.first()).toBeAttached({ timeout: 15000 });
        });
    });

    test.describe('Model Color', () => {
        test('should enable threeDModelColor field for STL files', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, '3D Viewer STL Color Enabled');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            await uploadModelViaFilePicker(page, 'test/fixtures/ascii-cube.stl');
            await page.waitForFunction(
                () => {
                    const input = document.querySelector('#threeD3DModelFile') as HTMLInputElement;
                    return input?.value?.endsWith('.stl');
                },
                { timeout: 30000 },
            );

            const colorInput = page.locator('#threeDModelColor');
            await expect(colorInput).toBeVisible({ timeout: 5000 });
            await expect(colorInput).toBeEnabled({ timeout: 5000 });
        });

        test('should disable threeDModelColor field for GLB files', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, '3D Viewer GLB Color Disabled');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');
            await page.waitForFunction(
                () => {
                    const input = document.querySelector('#threeD3DModelFile') as HTMLInputElement;
                    return input?.value?.endsWith('.glb');
                },
                { timeout: 30000 },
            );

            const colorInput = page.locator('#threeDModelColor');
            await expect(colorInput).toBeVisible({ timeout: 5000 });
            await expect(colorInput).toBeDisabled({ timeout: 5000 });
        });

        test('should persist a custom STL color through save+reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, '3D Viewer STL Color Persist');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            await uploadModelViaFilePicker(page, 'test/fixtures/ascii-cube.stl');
            await page.waitForFunction(
                () => {
                    const input = document.querySelector('#threeD3DModelFile') as HTMLInputElement;
                    return input?.value?.endsWith('.stl');
                },
                { timeout: 30000 },
            );

            const colorInput = page.locator('#threeDModelColor');
            await colorInput.fill('#ff0000');
            await colorInput.dispatchEvent('change');
            await save3DViewerIdevice(page);
            await saveProject(page);
            await reloadPage(page);
            await selectFirstPage(page);

            // The template (`three-d-viewer.html`) wraps the engine
            // content in its own `.three-d-viewer-wrapper`; the inner
            // one with `data-three-d` (no `-viewer` suffix on its
            // marker attribute) is what `renderView` emits and carries
            // the flat data-* attributes.
            const wrapperColor = await page.evaluate(() => {
                const w = document.querySelector('article .three-d-viewer-wrapper[data-three-d]') as HTMLElement | null;
                return w?.dataset?.modelColor || '';
            });
            expect(wrapperColor.toLowerCase()).toBe('#ff0000');
        });
    });

    test.describe('Persisted DOM Discipline', () => {
        test('saved wrapper carries flat data-* attributes (no data-config base64)', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, '3D Viewer No Base64');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            await save3DViewerIdevice(page);
            await saveProject(page);

            const wrapperState = await page.evaluate(() => {
                const w = document.querySelector('article .three-d-viewer-wrapper[data-three-d]') as HTMLElement | null;
                return {
                    hasDataConfig: w?.hasAttribute('data-config') ?? null,
                    modelAssetRef: w?.dataset?.modelAssetRef || '',
                    modelType: w?.dataset?.modelType || '',
                };
            });
            // No base64 envelope — the canonical reference lives in
            // `data-model-asset-ref`. `data-model-src` may be a
            // blob: URL because the workarea engine resolves
            // asset:// → blob: when reading the iDevice JSON; that's
            // expected and orthogonal to this assertion.
            expect(wrapperState.hasDataConfig).toBe(false);
            expect(wrapperState.modelAssetRef).toMatch(/\.glb$/);
            expect(wrapperState.modelType).toBe('glb');
        });

        test('saved iDevice carries data-model-asset-ref so AssetManager can recover the source', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, '3D Viewer Asset Ref');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            await save3DViewerIdevice(page);
            await saveProject(page);
            await reloadPage(page);
            await selectFirstPage(page);

            // After reload the workarea engine has resolved asset:// →
            // blob: on `data-model-src`. The canonical handle that
            // survives is `data-model-asset-ref` (no `asset://`
            // prefix, so it's invisible to the URL rewriter). It must
            // be present and non-empty, otherwise the runtime can't
            // re-route through AssetManager and we'd lose the model
            // on every reload (the bug we fixed in 82a93787).
            const assetRef = await page.evaluate(() => {
                const w = document.querySelector('article .three-d-viewer-wrapper[data-three-d]') as HTMLElement | null;
                return w?.dataset?.modelAssetRef || '';
            });
            expect(assetRef).toMatch(/\.glb$/);
            expect(assetRef).not.toContain('asset://');
            expect(assetRef).not.toContain('blob:');
        });
    });

    test.describe('Preview Panel', () => {
        test('should display 3D model correctly in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer Preview Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Upload GLB model
            await uploadModelViaFilePicker(page, 'test/fixtures/sample-model.glb');

            // Wait for model to load
            await page.waitForFunction(
                () => {
                    const mv = document.querySelector('#threeDViewerPreview model-viewer') as any;
                    return mv && (mv.loaded || mv.src);
                },
                { timeout: 30000 },
            );

            // Save the iDevice and project
            await save3DViewerIdevice(page);
            await saveProject(page);

            // Open preview panel (manually like image-gallery test)
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Wait for iframe to load
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 30000 });

            // Verify 3D viewer wrapper exists in preview
            const previewViewer = iframe.locator('.three-d-viewer-wrapper').first();
            await expect(previewViewer).toBeVisible({ timeout: 10000 });

            // Verify model-viewer element exists in preview
            const previewModelViewer = iframe.locator('.three-d-viewer-wrapper model-viewer').first();
            await expect(previewModelViewer).toBeAttached({ timeout: 10000 });

            // The runtime sets <model-viewer src> asynchronously after
            // boot (it reads the wrapper's data-model-src, resolves the
            // asset and then applies). Wait for it to land before
            // asserting.
            await iframe.locator('.three-d-viewer-wrapper model-viewer[src]').first().waitFor({
                state: 'attached',
                timeout: 15000,
            });
            const src = await previewModelViewer.getAttribute('src');
            expect(src).toBeTruthy();
        });
    });

    test.describe('File Manager Integration', () => {
        test('should open file manager modal when clicking browse button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, '3D Viewer File Manager Test');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await add3DViewerIdevice(page);

            // Click browse button
            const browseButton = page.locator('input.exe-pick-any-file, input.exe-pick-image').first();
            await browseButton.waitFor({ state: 'visible', timeout: 10000 });
            await browseButton.click();

            // Verify modal opens
            await expect(page.locator('#modalFileManager')).toBeVisible({ timeout: 10000 });

            // Verify the modal has the file input for upload
            const uploadInput = page.locator('#modalFileManager .media-library-upload-input');
            await expect(uploadInput).toBeAttached();

            // Close modal
            const closeBtn = page
                .locator(
                    '#modalFileManager .modal-header .close, #modalFileManager .modal-header button[data-dismiss="modal"]',
                )
                .first();
            if ((await closeBtn.count()) > 0) {
                await closeBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }

            // Verify modal is closed
            await expect(page.locator('#modalFileManager.show, #modalFileManager[data-open="true"]')).toBeHidden({
                timeout: 5000,
            });
        });
    });
});
