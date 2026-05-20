import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for the Slide iDevice (Fabric.js editor).
 *
 * Tests cover:
 *   - Insertion from the iDevice panel.
 *   - Toolbar tools (text, image, shape picker).
 *   - Save / reopen round-trip preserves the scene.
 *   - Preview renders the cached SVG without loading the editor bundle.
 *   - Sanitized payload defends against script injection.
 *
 * The Slide editor is a canvas (Fabric.js); pixel-level drag interactions
 * are exercised through the editor's public API (`window.__slideEditorInit`)
 * rather than synthetic mouse events to keep the spec deterministic.
 */

const SLIDE_IDEVICE_TYPE = 'slide';

async function addSlideIdevice(page: Page): Promise<void> {
    await selectFirstPage(page);
    await expandIdeviceCategory(page, /Information|Información/i);
    await addIdevice(page, SLIDE_IDEVICE_TYPE);
}

async function getSlideIdeviceId(page: Page): Promise<string> {
    const id = await page.locator('#node-content article .idevice_node.slide').first().getAttribute('id');
    if (!id) throw new Error('slide iDevice id not found');
    return id;
}

/**
 * Enter edit mode on the slide iDevice. Scoped to `.idevice_node` because
 * the shared `editIdevice` helper hits a strict-mode violation when
 * eXeLearning duplicates the id on the inner `idevice_body` element.
 */
async function editSlideIdevice(page: Page, ideviceId: string): Promise<void> {
    const node = page.locator(`.idevice_node#${ideviceId}`).first();
    await node.waitFor({ state: 'visible', timeout: 15_000 });
    const editBtn = node.locator('.btn-edit-idevice').first();
    try {
        await editBtn.waitFor({ state: 'visible', timeout: 5_000 });
        await editBtn.click({ timeout: 5_000 });
    } catch {
        await node.dblclick({ timeout: 5_000 }).catch(() => {});
    }
    await page.waitForFunction(
        id => {
            const el = document.querySelector(`.idevice_node#${id}`);
            return el?.getAttribute('mode') === 'edition';
        },
        ideviceId,
        { timeout: 15_000 },
    );
}

async function waitForEditorReady(page: Page): Promise<void> {
    await page.locator('[data-testid="slide-editor"]').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('[data-testid="slide-canvas"]').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(
        () => {
            const w = window as unknown as {
                __slideEditorInit?: { mount?: (...args: unknown[]) => unknown };
            };
            return Boolean(w.__slideEditorInit && typeof w.__slideEditorInit.mount === 'function');
        },
        undefined,
        { timeout: 30_000 },
    );
}

async function getObjectCount(page: Page): Promise<number> {
    // The editor exposes its Fabric canvas as `window.__slideEditorCanvas`
    // explicitly for tests, since Fabric 6 doesn't keep a reliable
    // DOM-back-reference (`__fabric`) we can rely on.
    return page.evaluate(() => {
        const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
        return w.__slideEditorCanvas?.getObjects?.().length ?? -1;
    });
}

async function waitForObjectCountAtLeast(page: Page, expected: number, timeoutMs = 10_000): Promise<void> {
    await page.waitForFunction(
        target => {
            const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
            const count = w.__slideEditorCanvas?.getObjects?.().length ?? -1;
            return count >= target;
        },
        expected,
        { timeout: timeoutMs },
    );
}

test.describe('Slide iDevice', () => {
    test.describe('Insertion and editor mount', () => {
        test('adds the slide iDevice and mounts the Fabric editor', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Mount');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await expect(page.locator('[data-testid="slide-toolbar"]').first()).toBeVisible();
            await expect(page.locator('[data-testid="slide-tool-text"]').first()).toBeVisible();
            await expect(page.locator('[data-testid="slide-tool-image"]').first()).toBeVisible();
            // Shapes are accessed through a single dropdown trigger.
            await expect(page.locator('[data-testid="slide-tool-shapes"]').first()).toBeVisible();
            await expect(page.locator('[data-testid="slide-action-undo"]').first()).toBeVisible();
            await expect(page.locator('[data-testid="slide-action-redo"]').first()).toBeVisible();
        });
    });

    test.describe('Toolbar tools', () => {
        test('inserts text + several shapes through the toolbar', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Tools');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            // Text tool
            await page.locator('[data-testid="slide-tool-text"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            // Open the shape picker and pick a few shapes, asserting the
            // count grows after each insertion. This handles the
            // popover-positioning race where the picker re-anchors before
            // the click registers.
            const shapesToInsert = ['rect', 'circle', 'triangle', 'arrow', 'heart'];
            let expected = 1;
            for (const kind of shapesToInsert) {
                await page.locator('[data-testid="slide-tool-shapes"]').first().click();
                await page.locator(`[data-testid="slide-shape-${kind}"]`).first().waitFor({ state: 'visible' });
                await page.locator(`[data-testid="slide-shape-${kind}"]`).first().click();
                expected += 1;
                await waitForObjectCountAtLeast(page, expected);
            }

            const count = await getObjectCount(page);
            expect(count).toBeGreaterThanOrEqual(shapesToInsert.length + 1);
        });
    });

    test.describe('Save / reopen round-trip', () => {
        test('persists the slide payload (version 3, fabric scene + svg snapshot)', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Roundtrip');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-rect"]').first().waitFor({ state: 'visible' });
            await page.locator('[data-testid="slide-shape-rect"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            await saveIdevice(page, ideviceId);

            // After save, the iDevice exits edition mode and shows static SVG preview.
            await expect(page.locator(`#${ideviceId} .slide-export-fabric svg, #${ideviceId} svg`).first()).toBeVisible(
                { timeout: 15_000 },
            );

            // Re-enter edition mode and verify the editor recovers the scene.
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);
            await waitForObjectCountAtLeast(page, 1);
            const sceneSize = await getObjectCount(page);
            expect(sceneSize).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Static preview rendering', () => {
        test('renders sanitized SVG in the preview frame without loading the editor bundle', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Preview');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);
            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-circle"]').first().click();
            await saveIdevice(page, ideviceId);

            const previewBtn = page.locator('#head-bottom-preview');
            if ((await previewBtn.count()) > 0) {
                await previewBtn.click();
                const preview = await getPreviewFrame(page);
                if (preview) {
                    await expect(preview.locator('.slide-export-fabric').first()).toBeVisible({ timeout: 10_000 });

                    // The preview must not pull in fabric.js. Inspect script tags.
                    const fabricCount = await preview
                        .locator('script[src*="slide-editor.bundle.js"], script[src*="fabric"]')
                        .count();
                    expect(fabricCount).toBe(0);
                }
            }
        });
    });

    test.describe('Visual / Code toggle', () => {
        test('exposes the JSON in a textarea and round-trips edits back to the canvas', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Code View');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            // Seed a single rectangle so the JSON has at least one shape.
            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-rect"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            // Switch to code mode — textarea is populated with the JSON.
            await page.locator('[data-testid="slide-view-code"]').first().click();
            const textarea = page.locator('[data-testid="slide-code-textarea"]').first();
            await expect(textarea).toBeVisible();
            const initialJson = await textarea.inputValue();
            expect(initialJson.length).toBeGreaterThan(20);
            expect(initialJson).toContain('"objects"');

            // Empty the scene by replacing the JSON with a minimal payload
            // (no objects) and switching back to Visual.
            const emptyScene = JSON.stringify({ version: '6.0.0', objects: [], background: '' }, null, 2);
            await textarea.fill(emptyScene);
            await page.locator('[data-testid="slide-view-visual"]').first().click();

            // The canvas now reflects the textarea (zero objects).
            await page.waitForFunction(
                () => {
                    const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
                    return (w.__slideEditorCanvas?.getObjects?.().length ?? -1) === 0;
                },
                undefined,
                { timeout: 10_000 },
            );
            const count = await getObjectCount(page);
            expect(count).toBe(0);
        });

        test('shows an inline error and stays in code mode when the JSON is invalid', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Code Invalid');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await page.locator('[data-testid="slide-view-code"]').first().click();
            const textarea = page.locator('[data-testid="slide-code-textarea"]').first();
            await expect(textarea).toBeVisible();
            await textarea.fill('{ this is not valid json');
            await page.locator('[data-testid="slide-view-visual"]').first().click();

            // The textarea is still visible (code mode held), the error
            // banner appeared and quotes the JSON parse failure.
            await expect(textarea).toBeVisible();
            const codePanel = page.locator('[data-testid="slide-code-panel"]').first();
            await expect(codePanel.locator('.exe-slide-code-panel__error--visible')).toBeVisible();
        });
    });

    test.describe('Security', () => {
        test('strips <script> and javascript: URLs from the saved SVG', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Security');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            const sanitized = await page.evaluate(() => {
                const w = window as unknown as { __slideEditorInit?: { sanitizeSvg?: (s: string) => string } };
                if (!w.__slideEditorInit?.sanitizeSvg) return null;
                return w.__slideEditorInit.sanitizeSvg(
                    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><a href="javascript:alert(1)"><rect onclick="x" width="10"/></a></svg>',
                );
            });
            expect(sanitized).not.toBeNull();
            expect(sanitized).not.toContain('<script');
            expect(sanitized).not.toContain('javascript:');
            expect(sanitized).not.toContain('onclick');
        });
    });
});
