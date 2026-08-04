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

        test('does not save code edits until they have been applied in Visual mode', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Code Save Guard');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-rect"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            await page.locator('[data-testid="slide-view-code"]').first().click();
            const textarea = page.locator('[data-testid="slide-code-textarea"]').first();
            await textarea.fill(JSON.stringify({ version: '6.0.0', objects: [], background: '' }, null, 2));
            await page.locator(`.idevice_node#${ideviceId} .btn-save-idevice`).first().click();

            await expect(textarea).toBeVisible();
            await expect(
                page.locator('[data-testid="slide-code-panel"] .exe-slide-code-panel__error--visible'),
            ).toBeVisible();
            await expect(page.locator(`.idevice_node#${ideviceId}`).first()).toHaveAttribute('mode', 'edition');

            await page.locator('[data-testid="slide-view-visual"]').first().click();
            await page.waitForFunction(
                () => {
                    const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
                    return (w.__slideEditorCanvas?.getObjects?.().length ?? -1) === 0;
                },
                undefined,
                { timeout: 10_000 },
            );
            await saveIdevice(page, ideviceId);
        });
    });

    test.describe('Compatibility and history', () => {
        test('preserves future payloads and disables editing when the mounted bundle cannot read them', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Future Payload');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            const result = await page.evaluate(() => {
                const future = { version: 4, engine: 'fabric', fabric: { objects: [{ type: 'rect' }] }, svg: '<svg/>' };
                const host = document.createElement('div');
                document.body.appendChild(host);
                const w = window as unknown as {
                    __slideEditorInit?: {
                        mount?: (
                            container: HTMLElement,
                            options: { previousData: unknown },
                        ) => { getUnreadPayload?: () => unknown; destroy?: () => void };
                    };
                };
                const api = w.__slideEditorInit?.mount?.(host, { previousData: future });
                const data = {
                    unread: api?.getUnreadPayload?.(),
                    hasBanner: Boolean(host.querySelector('[data-testid="slide-unsupported-banner"]')),
                    codeDisabled: (host.querySelector('[data-testid="slide-view-code"]') as HTMLButtonElement | null)
                        ?.disabled,
                };
                api?.destroy?.();
                host.remove();
                return data;
            });

            expect(result.unread).toEqual({
                version: 4,
                engine: 'fabric',
                fabric: { objects: [{ type: 'rect' }] },
                svg: '<svg/>',
            });
            expect(result.hasBanner).toBe(true);
            expect(result.codeDisabled).toBe(true);
        });

        test('undoes a newly inserted object before a preceding canvas resize', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Dimension Undo');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            const widthInput = page.locator('[data-testid="slide-config-width"]').first();
            await widthInput.fill('1024');
            await widthInput.dispatchEvent('change');
            await expect(widthInput).toHaveValue('1024');

            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-rect"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            await page.locator('[data-testid="slide-action-undo"]').first().click();
            await page.waitForFunction(
                () => {
                    const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
                    return (w.__slideEditorCanvas?.getObjects?.().length ?? -1) === 0;
                },
                undefined,
                { timeout: 10_000 },
            );
            await expect(widthInput).toHaveValue('1024');

            await page.locator('[data-testid="slide-action-undo"]').first().click();
            await expect(widthInput).toHaveValue('1280');
        });
    });

    test.describe('Editor usability (#2218)', () => {
        async function setupEditorWithRect(page: Page): Promise<void> {
            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);
            await page.locator('[data-testid="slide-tool-shapes"]').first().click();
            await page.locator('[data-testid="slide-shape-rect"]').first().click();
            await waitForObjectCountAtLeast(page, 1);
        }

        test('Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y drive the editor history without the unsaved-changes modal', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide Keyboard Undo');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await setupEditorWithRect(page);

            // Focus must sit outside inputs so the editor shortcut handler runs.
            await page.locator('[data-testid="slide-canvas-shell"]').first().click();

            await page.keyboard.press('Control+z');
            await page.waitForFunction(
                () => {
                    const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
                    return (w.__slideEditorCanvas?.getObjects?.().length ?? -1) === 0;
                },
                undefined,
                { timeout: 10_000 },
            );
            // The project-level handler must yield silently: no warning modal.
            await expect(page.locator('.modal.show')).toHaveCount(0);

            await page.keyboard.press('Control+Shift+z');
            await waitForObjectCountAtLeast(page, 1);

            await page.keyboard.press('Control+z');
            await page.waitForFunction(
                () => {
                    const w = window as unknown as { __slideEditorCanvas?: { getObjects?: () => unknown[] } };
                    return (w.__slideEditorCanvas?.getObjects?.().length ?? -1) === 0;
                },
                undefined,
                { timeout: 10_000 },
            );
            await page.keyboard.press('Control+y');
            await waitForObjectCountAtLeast(page, 1);
            await expect(page.locator('.modal.show')).toHaveCount(0);
        });

        test('project-level undo/redo buttons are disabled while the editor is open and never pop the modal', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide Navbar Undo Guard');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await setupEditorWithRect(page);
            const ideviceId = await getSlideIdeviceId(page);

            // While the slide editor owns the history, the project-level
            // buttons must be disabled (clicking them used to pop the
            // "unsaved changes" modal).
            await expect(page.locator('#yjs-undo-redo .btn-undo')).toBeDisabled();
            await expect(page.locator('#yjs-undo-redo .btn-redo')).toBeDisabled();
            await expect(page.locator('.modal.show')).toHaveCount(0);

            // Once the iDevice is saved the project history takes over again.
            await saveIdevice(page, ideviceId);
            await expect(page.locator('#yjs-undo-redo .btn-undo')).toBeEnabled({ timeout: 10_000 });
        });

        test('arrow keys nudge the selected object by 1px, Shift+arrow by 10px', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide Keyboard Nudge');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await setupEditorWithRect(page);

            const before = await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: { getActiveObject?: () => { left: number; top: number } | null };
                };
                const active = w.__slideEditorCanvas?.getActiveObject?.();
                return active ? { left: active.left, top: active.top } : null;
            });
            expect(before).not.toBeNull();

            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Shift+ArrowRight');
            await page.keyboard.press('Shift+ArrowUp');

            const after = await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: { getActiveObject?: () => { left: number; top: number } | null };
                };
                const active = w.__slideEditorCanvas?.getActiveObject?.();
                return active ? { left: active.left, top: active.top } : null;
            });
            expect(after).not.toBeNull();
            expect(after!.left - before!.left).toBeCloseTo(11); // +1 +10
            expect(after!.top - before!.top).toBeCloseTo(-9); // +1 -10
        });

        test('Ctrl+D duplicates the selected object', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide Keyboard Duplicate');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await setupEditorWithRect(page);

            await page.keyboard.press('Control+d');
            await waitForObjectCountAtLeast(page, 2);
        });

        test('Ctrl+drag draws a marquee over a full-bleed background instead of moving it', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide Marquee Selection');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            // Cover-page scene: a full-bleed background plus two small
            // rects, all with explicit top-left origins so the marquee
            // coordinates below are deterministic.
            await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        add: (o: unknown) => void;
                        sendObjectToBack: (o: unknown) => void;
                        discardActiveObject: () => void;
                        requestRenderAll: () => void;
                    };
                    fabric?: { Rect: new (opts: Record<string, unknown>) => unknown };
                };
                const c = w.__slideEditorCanvas;
                const f = w.fabric;
                if (!c || !f) throw new Error('slide canvas not ready');
                const mk = (opts: Record<string, unknown>) => new f.Rect({ originX: 'left', originY: 'top', ...opts });
                const bg = mk({ left: 0, top: 0, width: 1280, height: 720, fill: '#dfe9f2' });
                c.add(bg);
                c.sendObjectToBack(bg);
                c.add(mk({ left: 100, top: 100, width: 120, height: 80, fill: '#4e9a8e' }));
                c.add(mk({ left: 320, top: 140, width: 120, height: 80, fill: '#b05669' }));
                c.discardActiveObject();
                c.requestRenderAll();
            });

            const canvas = page.locator('[data-testid="slide-canvas"]').first();
            await canvas.scrollIntoViewIfNeeded();
            const box = await canvas.boundingBox();
            expect(box).not.toBeNull();
            const scale = box!.width / 1280;
            const toScreen = (x: number, y: number) => ({ x: box!.x + x * scale, y: box!.y + y * scale });

            // Ctrl/Cmd+drag a rectangle that fully encloses both small
            // rects. macOS translates Ctrl+click into a context-menu
            // gesture at the OS level, so use the platform's own marquee
            // modifier (Cmd there, Ctrl elsewhere) — the editor wires both.
            const marqueeKey = process.platform === 'darwin' ? 'Meta' : 'Control';
            const from = toScreen(60, 60);
            const to = toScreen(520, 280);
            await page.keyboard.down(marqueeKey);
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            await page.mouse.move(to.x, to.y, { steps: 10 });
            await page.mouse.up();
            await page.keyboard.up(marqueeKey);

            const result = await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getObjects: () => Array<{ width?: number; left?: number; top?: number }>;
                        getActiveObjects: () => unknown[];
                    };
                };
                const c = w.__slideEditorCanvas;
                if (!c) return null;
                const bg = c.getObjects().find(o => o.width === 1280);
                return {
                    selected: c.getActiveObjects().length,
                    bgSelected: (c.getActiveObjects() as unknown[]).includes(bg as unknown),
                    bgLeft: bg?.left,
                    bgTop: bg?.top,
                };
            });
            expect(result).not.toBeNull();
            // Both small rects selected; the background neither selected nor moved.
            expect(result!.selected).toBe(2);
            expect(result!.bgSelected).toBe(false);
            expect(result!.bgLeft).toBe(0);
            expect(result!.bgTop).toBe(0);
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
