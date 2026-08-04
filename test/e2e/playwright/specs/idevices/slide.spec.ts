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

    test.describe('Text editing caret alignment', () => {
        /**
         * Regression for #2214 — the caret progressively drifted LEFT of the
         * rendered glyphs while typing, proportionally to text length.
         *
         * Root cause: the app ships Inter as a variable font with an `opsz`
         * (optical sizing) axis, so canvas glyph advances are non-linear in
         * font size. Fabric measures text at CACHE_FONT_SIZE=400px (where
         * auto optical sizing clamps opsz to the axis max) and scales down,
         * while glyphs are painted at the object's real font size (different
         * optical size below 32px → wider advances). Caret/selection/hit
         * geometry use the measured advances, so the error accumulates with
         * every typed character.
         *
         * The assertions compare Fabric's measured geometry against what the
         * browser actually paints on the editor's own lower canvas, so they
         * fail whenever measurement and rendering disagree, regardless of
         * which side regresses.
         */
        const TEST_STRING =
            'This is only a cursor alignment regression test with narrow letters iii and wide letters WWW.';

        interface CaretProbe {
            fontSize: number;
            displayedScale: number;
            measuredLineWidth: number;
            renderedLineWidth: number;
            caretOffset: number;
            inkStart: number | null;
            inkEnd: number | null;
            paintedLeft: number;
            midIndex: number;
            midCaretOffset: number;
            midRenderedPrefixWidth: number;
        }

        /**
         * Measures caret vs rendered-glyph geometry inside the page, in
         * design (canvas) pixels. Uses `getCursorRenderingData()` (public
         * Fabric API returning the exact rectangle the caret is painted at)
         * and reads glyph ink directly from the lower canvas backstore, so
         * the comparison reflects what the user actually sees.
         */
        async function probeCaretGeometry(page: Page, midIndex: number): Promise<CaretProbe> {
            return page.evaluate(mid => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getObjects: () => Array<Record<string, unknown>>;
                        getWidth: () => number;
                        getRetinaScaling: () => number;
                        renderAll: () => void;
                        lowerCanvasEl: HTMLCanvasElement;
                    };
                };
                const canvas = w.__slideEditorCanvas;
                if (!canvas) throw new Error('slide canvas not found');
                const t = canvas.getObjects().find(o => typeof (o as { text?: string }).text === 'string') as {
                    text: string;
                    width: number;
                    fontSize: number;
                    getBoundingRect: () => { left: number; top: number; width: number; height: number };
                    fontStyle: string;
                    fontWeight: string | number;
                    fontFamily: string;
                    isEditing: boolean;
                    getLineWidth: (line: number) => number;
                    setSelectionStart: (i: number) => void;
                    setSelectionEnd: (i: number) => void;
                    getCursorRenderingData: () => { left: number; width: number };
                    abortCursorAnimation?: () => void;
                    renderCursorOrSelection: () => void;
                };
                if (!t) throw new Error('text object not found');
                const text = t.text;

                // Caret offset from the line start, in design px, when the
                // caret is at a given selection index. getCursorRenderingData
                // returns the painted rect relative to the object's center.
                const caretOffsetAt = (index: number): number => {
                    t.setSelectionStart(index);
                    t.setSelectionEnd(index);
                    t.abortCursorAnimation?.();
                    const data = t.getCursorRenderingData();
                    return t.width / 2 + data.left + data.width / 2;
                };

                // What the browser will actually paint: measure on the lower
                // canvas' own 2D context (same element CSS as fillText uses).
                const ctx = canvas.lowerCanvasEl.getContext('2d') as CanvasRenderingContext2D;
                ctx.save();
                ctx.font = `${t.fontStyle} ${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
                const renderedLineWidth = ctx.measureText(text).width;
                const midRenderedPrefixWidth = ctx.measureText(text.slice(0, mid)).width;
                ctx.restore();

                // Glyph ink span read from the backstore. The lower canvas
                // holds only the scene (grid/background are CSS), so any dark
                // pixel in the text row band belongs to the glyphs. Fabric 7
                // defaults objects to a center origin, so the painted box
                // comes from the transform (getBoundingRect), never from
                // left/top directly.
                canvas.renderAll();
                const box = t.getBoundingRect();
                const retina = canvas.getRetinaScaling();
                const bandTop = Math.max(0, Math.round((box.top - 1) * retina));
                const bandBottom = Math.round((box.top + box.height + 1) * retina);
                const width = canvas.lowerCanvasEl.width;
                let inkStart: number | null = null;
                let inkEnd: number | null = null;
                for (let y = bandTop; y <= bandBottom; y += 2) {
                    const row = ctx.getImageData(0, y, width, 1).data;
                    for (let x = 0; x < width; x++) {
                        const alpha = row[x * 4 + 3];
                        const lum = 0.299 * row[x * 4] + 0.587 * row[x * 4 + 1] + 0.114 * row[x * 4 + 2];
                        if (alpha > 100 && lum < 130) {
                            if (inkStart === null || x < inkStart) inkStart = x;
                            if (inkEnd === null || x > inkEnd) inkEnd = x;
                        }
                    }
                }

                const displayedScale = canvas.lowerCanvasEl.getBoundingClientRect().width / canvas.getWidth();
                const probe = {
                    fontSize: t.fontSize,
                    displayedScale,
                    measuredLineWidth: t.getLineWidth(0),
                    renderedLineWidth,
                    caretOffset: caretOffsetAt(text.length),
                    inkStart: inkStart === null ? null : inkStart / retina,
                    inkEnd: inkEnd === null ? null : inkEnd / retina,
                    paintedLeft: box.left,
                    midIndex: mid,
                    midCaretOffset: caretOffsetAt(mid),
                    midRenderedPrefixWidth,
                };
                // Leave the caret at the end for the screenshotable state.
                t.setSelectionStart(text.length);
                t.setSelectionEnd(text.length);
                t.renderCursorOrSelection();
                return probe;
            }, midIndex);
        }

        test('keeps the caret aligned with rendered glyphs while typing below 32px', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Caret Alignment');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await page.locator('[data-testid="slide-tool-text"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            // The editor shows the canvas fitted to the shell — the displayed
            // scale must be below 1 so the regression exercises a scaled
            // canvas exactly like the reported scenario.
            const scaled = await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: { getWidth: () => number; lowerCanvasEl: HTMLCanvasElement };
                };
                const c = w.__slideEditorCanvas;
                if (!c) return null;
                return c.lowerCanvasEl.getBoundingClientRect().width / c.getWidth();
            });
            expect(scaled).not.toBeNull();
            expect(scaled as number).toBeLessThan(1);

            // 16px is one of the toolbar font sizes below Inter's opsz max.
            // Set it through the same object API the toolbar handler uses,
            // then type the string through the real keyboard input path.
            await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getActiveObject: () => {
                            set: (p: Record<string, unknown>) => void;
                            enterEditing: () => void;
                            selectAll: () => void;
                        } | null;
                        requestRenderAll: () => void;
                    };
                };
                const canvas = w.__slideEditorCanvas;
                const t = canvas?.getActiveObject();
                if (!t) throw new Error('no active text object');
                t.set({ fontSize: 16 });
                canvas?.requestRenderAll();
                t.enterEditing();
                t.selectAll();
            });
            await page.keyboard.type(TEST_STRING);
            await page.waitForFunction(
                expected => {
                    const w = window as unknown as {
                        __slideEditorCanvas?: { getObjects: () => Array<{ text?: string }> };
                    };
                    return w.__slideEditorCanvas?.getObjects().some(o => o.text === expected) ?? false;
                },
                TEST_STRING,
                { timeout: 10_000 },
            );

            const midIndex = Math.floor(TEST_STRING.length / 2);
            const probe = await probeCaretGeometry(page, midIndex);

            // Tolerances in design px. 3 design px ≈ 1.4 CSS px at the ~45%
            // fit zoom; the bug produces a 60–95 design px divergence.
            const METRIC_TOLERANCE = 3;
            const INK_TOLERANCE = 3;

            // 1. The advances Fabric measured (caret/selection/hit geometry)
            //    must equal the advances the browser paints with.
            expect(Math.abs(probe.renderedLineWidth - probe.measuredLineWidth)).toBeLessThanOrEqual(METRIC_TOLERANCE);

            // 2. End-of-text caret: no glyph ink may extend beyond the caret,
            //    and the rightmost ink must sit just behind it (trailing side
            //    bearing only).
            expect(probe.inkEnd).not.toBeNull();
            const caretAbsoluteX = probe.paintedLeft + probe.caretOffset;
            expect((probe.inkEnd as number) - caretAbsoluteX).toBeLessThanOrEqual(INK_TOLERANCE);
            expect(caretAbsoluteX - (probe.inkEnd as number)).toBeLessThanOrEqual(12);

            // 3. Mid-text caret must match the painted width of the prefix.
            expect(Math.abs(probe.midCaretOffset - probe.midRenderedPrefixWidth)).toBeLessThanOrEqual(METRIC_TOLERANCE);

            // 4. Editing mid-text must stay aligned: put the caret after the
            //    prefix and type one more character through the keyboard.
            await page.evaluate(mid => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getActiveObject: () => {
                            setSelectionStart: (i: number) => void;
                            setSelectionEnd: (i: number) => void;
                        } | null;
                    };
                };
                const t = w.__slideEditorCanvas?.getActiveObject();
                if (!t) throw new Error('no active text object');
                t.setSelectionStart(mid);
                t.setSelectionEnd(mid);
            }, midIndex);
            await page.keyboard.type('X');
            const afterEdit = await probeCaretGeometry(page, midIndex + 1);
            expect(Math.abs(afterEdit.midCaretOffset - afterEdit.midRenderedPrefixWidth)).toBeLessThanOrEqual(
                METRIC_TOLERANCE,
            );

            // 5. Sizes at/above the optical-sizing maximum were never
            //    affected and must stay aligned.
            await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getActiveObject: () => { set: (p: Record<string, unknown>) => void } | null;
                        requestRenderAll: () => void;
                    };
                };
                const canvas = w.__slideEditorCanvas;
                const t = canvas?.getActiveObject();
                if (!t) throw new Error('no active text object');
                t.set({ fontSize: 40 });
                canvas?.requestRenderAll();
            });
            const probe40 = await probeCaretGeometry(page, midIndex);
            expect(Math.abs(probe40.renderedLineWidth - probe40.measuredLineWidth)).toBeLessThanOrEqual(
                METRIC_TOLERANCE,
            );
        });

        test('keeps per-character styled sizes from corrupting other objects', async ({
            authenticatedPage,
            createProject,
        }) => {
            // Serialized scenes (and the Code view) can carry Fabric
            // per-character styles with their own fontSize. Measurements of
            // a styled span must be stored/scaled for the span's size, and
            // must never leak wrong-size advances into the shared width
            // cache used by other objects.
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Styled Spans');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            const HEAD = 'Base 32px text then ';
            const SPAN = 'a styled span with wide WWW letters iii';
            const result = await page.evaluate(
                ({ head, span }) => {
                    const w = window as unknown as {
                        __slideEditorCanvas?: {
                            add: (o: unknown) => void;
                            renderAll: () => void;
                            lowerCanvasEl: HTMLCanvasElement;
                        };
                        fabric?: {
                            IText: new (
                                text: string,
                                opts: Record<string, unknown>,
                            ) => {
                                styles: Record<number, Record<number, Record<string, unknown>>>;
                                initDimensions: () => void;
                                getLineWidth: (l: number) => number;
                                fontFamily: string;
                            };
                        };
                    };
                    const canvas = w.__slideEditorCanvas;
                    const fabric = w.fabric;
                    if (!canvas || !fabric) throw new Error('canvas or fabric missing');
                    const fontFamily = 'Inter, Arial, sans-serif';

                    // Object A: base 32px with the span styled at 16px, as a
                    // deserialized scene would carry it.
                    const styled = new fabric.IText(head + span, { left: 40, top: 60, fontSize: 32, fontFamily });
                    const styles: Record<number, Record<string, unknown>> = {};
                    for (let i = head.length; i < head.length + span.length; i++) styles[i] = { fontSize: 16 };
                    styled.styles = { 0: styles };
                    styled.initDimensions();
                    canvas.add(styled);

                    // Object B: a separate uniform 16px object reusing the
                    // exact same characters the styled span just measured.
                    const plain = new fabric.IText(span, { left: 40, top: 200, fontSize: 16, fontFamily });
                    canvas.add(plain);
                    canvas.renderAll();

                    const ctx = canvas.lowerCanvasEl.getContext('2d') as CanvasRenderingContext2D;
                    ctx.save();
                    ctx.font = `normal normal 16px ${fontFamily}`;
                    const span16 = ctx.measureText(span).width;
                    ctx.font = `normal normal 32px ${fontFamily}`;
                    const head32 = ctx.measureText(head).width;
                    ctx.restore();
                    return {
                        plainMeasured: plain.getLineWidth(0),
                        plainRendered: span16,
                        styledMeasured: styled.getLineWidth(0),
                        styledRendered: head32 + span16,
                    };
                },
                { head: HEAD, span: SPAN },
            );

            // The uniform 16px object must match what the browser paints at
            // 16px — a polluted shared cache would roughly double it.
            expect(Math.abs(result.plainMeasured - result.plainRendered)).toBeLessThanOrEqual(3);
            // The styled object's line is head@32px + span@16px. Style-run
            // boundaries drop one kerning pair, hence the slightly wider
            // tolerance.
            expect(Math.abs(result.styledMeasured - result.styledRendered)).toBeLessThanOrEqual(5);
        });

        test('keeps Fabric shared state intact: per-family cache invalidation still works', async ({
            authenticatedPage,
            createProject,
        }) => {
            // The Slide editor runs against the app-global window.fabric
            // (the bundle maps `import 'fabric'` to it), so its metric
            // corrections must not mutate shared defaults nor break the
            // documented `cache.clearFontCache(fontFamily)` invalidation
            // used after lazy webfont loads.
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Slide iDevice Fabric State');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addSlideIdevice(page);
            const ideviceId = await getSlideIdeviceId(page);
            await editSlideIdevice(page, ideviceId);
            await waitForEditorReady(page);

            await page.locator('[data-testid="slide-tool-text"]').first().click();
            await waitForObjectCountAtLeast(page, 1);

            const result = await page.evaluate(() => {
                const w = window as unknown as {
                    __slideEditorCanvas?: {
                        getActiveObject: () => {
                            set: (p: Record<string, unknown>) => void;
                            initDimensions: () => void;
                        } | null;
                    };
                    fabric?: {
                        cache: { charWidthsCache: Map<string, unknown>; clearFontCache: (f?: string) => void };
                        FabricText: { ownDefaults: { CACHE_FONT_SIZE?: number } };
                    };
                };
                const fabric = w.fabric;
                const t = w.__slideEditorCanvas?.getActiveObject();
                if (!fabric || !t) throw new Error('fabric or text object missing');
                const family = 'Inter, Arial, sans-serif';
                // Populate width-cache entries for two font sizes.
                t.set({ fontSize: 16 });
                t.initDimensions();
                t.set({ fontSize: 24 });
                t.initDimensions();
                const familyKeys = () =>
                    [...fabric.cache.charWidthsCache.keys()].filter(k => k.startsWith(family.toLowerCase()));
                const before = familyKeys().length;
                fabric.cache.clearFontCache(family);
                const after = familyKeys().length;
                return { before, after, ownDefaultsCacheFontSize: fabric.FabricText.ownDefaults.CACHE_FONT_SIZE };
            });

            expect(result.before).toBeGreaterThanOrEqual(1);
            // Per-family invalidation must remove every entry for the family,
            // including any size-scoped buckets.
            expect(result.after).toBe(0);
            // Shared Fabric defaults must stay untouched for other consumers.
            expect(result.ownDefaultsCacheFontSize).toBe(400);
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
