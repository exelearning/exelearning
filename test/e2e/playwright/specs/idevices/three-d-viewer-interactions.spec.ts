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
 * E2E tests for the 3D Viewer interaction layer (issue #2153):
 * markers/hotspots, guided navigation and single-choice questions.
 *
 * Marker PLACEMENT is normally done by clicking the WebGL model, which is
 * unstable in CI. Following the SDD, the raycast/placement math is unit-tested
 * separately; here we inject the placement anchor deterministically through the
 * device's own `handleMarkerPlaced()` (the same entry point the placement click
 * calls) and then drive the real editor UI, persistence and runtime preview.
 */

async function add3DViewerIdevice(page: Page): Promise<void> {
    await expandIdeviceCategory(page, /Information|Información/i);
    const threeDIdevice = page.locator('.idevice_item[id="three-d-viewer"]').first();
    await threeDIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await threeDIdevice.click();
    await page.locator('#node-content article .idevice_node.three-d-viewer').first().waitFor({ timeout: 15000 });
    await page
        .waitForFunction(() => document.querySelector('#threeDViewerPreview model-viewer') !== null, { timeout: 15000 })
        .catch(() => {});
}

async function uploadModelViaFilePicker(page: Page, fixturePath: string): Promise<void> {
    const browseButton = page.locator('input.exe-pick-any-file, input.exe-pick-image').first();
    await browseButton.waitFor({ state: 'visible', timeout: 10000 });
    await browseButton.click();
    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 10000 });
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(fixturePath);
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 15000 });
    await mediaItem.click();
    await page.waitForTimeout(500);
    await page.locator('#modalFileManager .media-library-insert-btn').click();
    await page.waitForTimeout(1000);
}

async function save3DViewerIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.three-d-viewer').last();
    const saveBtn = block.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) await saveBtn.click();
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

/** Inject a marker placement through the live editor device (deterministic). */
async function placeMarker(page: Page, x: number, y: number, z: number): Promise<void> {
    await page.evaluate(
        ([mx, my, mz]) => {
            const dev = (window as any).$exeDevice;
            if (!dev || typeof dev.handleMarkerPlaced !== 'function') {
                throw new Error('3D viewer device not available on window');
            }
            dev.handleMarkerPlaced({
                position: { x: mx, y: my, z: mz },
                normal: { x: 0, y: 0, z: 1 },
                surface: '',
                camera: { orbit: '', target: '', fieldOfView: '' },
            });
        },
        [x, y, z],
    );
    await page.locator('#threeDMarkerEditorHost .tdv-marker-editor').waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('3D Viewer interactions', () => {
    test('authors markers + a question, persists them, and plays them in preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        test.setTimeout(120000);

        const projectUuid = await createProject(page, '3D Viewer Interactions Test');
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

        // Enable interactions + guided navigation via the real UI.
        await page.locator('#threeDInteractionsEnable').check();
        await expect(page.locator('#threeDInteractionsBody')).toBeVisible();
        await page.locator('#threeDGuidedMode').check();

        // Marker 1 — informational.
        await placeMarker(page, -0.3, 0, 1);
        await page.locator('#tdvMkLabel').fill('Summit');
        await page.locator('#tdvActionFields textarea').fill('<p>The highest point.</p>');
        await page.locator('#threeDMarkerEditorHost [data-save]').click();

        // Marker 2 — single-choice question.
        await placeMarker(page, 0.3, 0, 1);
        await page.locator('#tdvMkLabel').fill('Quiz');
        await page.locator('#tdvMkType').selectOption('question');
        await page.locator('#tdvActionFields textarea').first().fill('Is Teide a volcano?');
        const optionInputs = page.locator('#tdvActionFields .tdv-q-options .input-group input[type="text"]');
        await optionInputs.nth(0).fill('Yes');
        await optionInputs.nth(1).fill('No');
        await page.locator('#tdvActionFields .tdv-q-options input[type="radio"]').nth(0).check();
        await page.locator('#threeDMarkerEditorHost [data-save]').click();

        // Two rows in the marker list.
        await expect(page.locator('#threeDMarkerList .tdv-marker-row')).toHaveCount(2);

        // Persist.
        await save3DViewerIdevice(page);
        await saveProject(page);

        // Reload and confirm the data survived.
        await reloadPage(page);
        await waitForAppReady(page);
        await selectFirstPage(page);

        // Open the preview (direct click — the panel helper can leave the
        // iframe on about:blank for this iDevice).
        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        const iframe = page.frameLocator('#preview-iframe');
        await iframe.locator('article').waitFor({ state: 'attached', timeout: 30000 });
        await iframe
            .locator('.three-d-viewer-wrapper model-viewer[src]')
            .first()
            .waitFor({ state: 'attached', timeout: 20000 });

        // Markers render as accessible buttons with our labels.
        const markers = iframe.locator('.three-d-viewer-wrapper .tdv-marker');
        await expect(markers).toHaveCount(2, { timeout: 15000 });
        await expect(iframe.locator('.tdv-marker[aria-label="Summit"]')).toBeAttached();

        // Guided navigation controls are present.
        await expect(iframe.locator('.tdv-guided-nav')).toBeAttached();

        // Activating the informational marker opens an accessible dialog.
        // Use dispatchEvent rather than a real click: whether a model-viewer
        // hotspot is visually clickable depends on the WebGL projection of the
        // model (env-dependent and unstable headless), which is not what we're
        // testing — we're testing that activating the marker opens its content.
        await iframe.locator('.tdv-marker[aria-label="Summit"]').dispatchEvent('click');
        const dialog = iframe.locator('.tdv-dialog[role="dialog"]');
        await expect(dialog).toBeVisible({ timeout: 10000 });
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(dialog.locator('.tdv-dialog-html')).toContainText('The highest point.');
        await iframe.locator('.tdv-dialog-close').click();
        await expect(iframe.locator('.tdv-dialog')).toHaveCount(0);

        // Activating the question marker and answering correctly shows
        // accessible feedback (dispatchEvent — see note above).
        await iframe.locator('.tdv-marker[aria-label="Quiz"]').dispatchEvent('click');
        const question = iframe.locator('.tdv-question');
        await expect(question).toBeVisible({ timeout: 10000 });
        await expect(question.locator('legend')).toHaveText('Is Teide a volcano?');
        await iframe.locator('.tdv-question input[type="radio"]').first().check();
        await iframe.locator('.tdv-q-check').click();
        const feedback = iframe.locator('.tdv-q-feedback');
        await expect(feedback).toHaveClass(/tdv-q-feedback--correct/, { timeout: 10000 });
        await expect(feedback).toHaveAttribute('aria-live', 'polite');
    });

    test('authors an STL marker that persists and reaches the preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        test.setTimeout(120000);

        const projectUuid = await createProject(page, '3D Viewer STL Interactions Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        await add3DViewerIdevice(page);
        await uploadModelViaFilePicker(page, 'test/fixtures/ascii-cube.stl');
        // STL renders via the Three.js runtime (no model-viewer src). Wait for
        // the source field to reflect the uploaded .stl instead of a model
        // "load" event.
        await page.waitForFunction(
            () => {
                const inp = document.querySelector('#threeD3DModelFile');
                return !!(inp && inp.value && inp.value.toLowerCase().includes('.stl'));
            },
            { timeout: 20000 },
        );

        await page.locator('#threeDInteractionsEnable').check();
        await expect(page.locator('#threeDInteractionsBody')).toBeVisible();

        // Place a marker at the model centre (deterministic, no WebGL click).
        await placeMarker(page, 0, 0, 0);
        await page.locator('#tdvMkLabel').fill('Corner');
        await page.locator('#tdvActionFields textarea').fill('<p>A corner of the cube.</p>');
        await page.locator('#threeDMarkerEditorHost [data-save]').click();
        await expect(page.locator('#threeDMarkerList .tdv-marker-row')).toHaveCount(1);

        await save3DViewerIdevice(page);
        await saveProject(page);
        await reloadPage(page);
        await waitForAppReady(page);
        await selectFirstPage(page);

        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        const iframe = page.frameLocator('#preview-iframe');
        await iframe.locator('article').waitFor({ state: 'attached', timeout: 30000 });

        // The STL wrapper is exported. NOTE: the interactive STL overlay needs a
        // live WebGL context (the Three.js scene), which is not reliably
        // available in headless CI; the STL projection/placement math is
        // unit-tested separately with a THREE stub. Here we assert the
        // WebGL-independent guarantees: the STL wrapper is present, the
        // interaction data round-tripped through the STL export path, and the
        // accessible text fallback carries the marker content (shown whenever
        // the 3D scene cannot render).
        // The export template nests an outer .three-d-viewer-wrapper around the
        // renderView-generated inner one; the flat data-* attributes and the
        // interaction markup live on the inner [data-three-d] wrapper.
        const wrapper = iframe.locator('.three-d-viewer-wrapper[data-three-d]').first();
        await expect(wrapper).toHaveAttribute('data-model-type', 'stl', { timeout: 15000 });
        const fallback = wrapper.locator('.tdv-fallback');
        await expect(fallback).toContainText('Corner', { timeout: 15000 });
        await expect(fallback).toContainText('A corner of the cube.');
    });
});
