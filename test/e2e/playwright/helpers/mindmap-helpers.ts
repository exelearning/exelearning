import { expect, type FrameLocator, type Frame, type Page } from '@playwright/test';
import { waitForAppReady, gotoWorkarea, addTextIdevice } from './workarea-helpers';

/**
 * Opens the real mindmaps editor the way a user reaches it: a text iDevice, TinyMCE, the
 * mind map plugin dialog, then the editor iframe.
 *
 * Shared by the export spec and the editor regression spec so the two describe the same
 * path. Selectors here are ids the mindmaps application assigns (#toolbar, #canvas-container,
 * #navi-zoom-level, #button-<COMMAND>) rather than generated classes, which is what makes
 * them survive a jQuery or jQuery UI change.
 */
export async function openMindmapEditor(
    page: Page,
    createProject: (page: Page, name: string) => Promise<string>,
    projectName: string,
): Promise<{ frame: FrameLocator; frame2: Frame }> {
    const projectUuid = await createProject(page, projectName);
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
    await addTextIdevice(page);

    const tinyMceMenubar = page.locator('.tox-menubar');
    if (!(await tinyMceMenubar.isVisible().catch(() => false))) {
        const block = page.locator('#node-content article .idevice_node.text').last();
        await block.waitFor({ timeout: 10000 });
        const editBtn = block.locator('.btn-edit-idevice');
        if ((await editBtn.count()) > 0) {
            await editBtn.waitFor({ timeout: 10000 });
            await editBtn.click();
        }
    }
    await page.waitForSelector('.tox-menubar', { timeout: 15000 });

    // The mind map button sits on a toolbar row that is collapsed by default.
    const toggleToolbars = page.locator('.tox-tbtn[aria-label*="Toggle"], .tox-tbtn[aria-label*="Alternar"]').first();
    if ((await toggleToolbars.count()) > 0 && (await toggleToolbars.isVisible())) {
        await toggleToolbars.click();
        await page.waitForTimeout(500);
    }

    const mindmapButton = page
        .locator(
            '.tox-tbtn[aria-label*="Mind map"], .tox-tbtn[aria-label*="Mapa mental"], .tox-tbtn[aria-label*="mind"]',
        )
        .first();
    await expect(mindmapButton).toBeVisible({ timeout: 10000 });
    await mindmapButton.click();

    const dialog = page.locator('.tox-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog
        .locator('button.tox-button')
        .filter({ hasText: /Open.*mind.*map|Abrir.*mapa.*mental|editor/i })
        .click();

    const frame = page.frameLocator('iframe[src*="exemindmap"]');

    // Editor-ready, not networkidle: the application boots on jQuery ready and draws the
    // root node itself, so the root caption appearing is the only honest signal.
    await expect(frame.locator('#toolbar')).toBeVisible({ timeout: 15000 });
    await expect(frame.locator('canvas').first()).toBeVisible({ timeout: 10000 });
    await expect(frame.locator('.node-caption.root')).toBeVisible({ timeout: 10000 });

    const frame2 = page.frames().find(f => f.url().includes('exemindmap'));
    if (!frame2) throw new Error('mindmap editor frame not found');
    return { frame, frame2 };
}

/** Current zoom as a number, read from the navigator's own readout ("125 %" -> 125). */
export async function readZoomPercent(frame2: Frame): Promise<number> {
    const text = await frame2.evaluate(() => (document.querySelector('#navi-zoom-level')?.textContent || '').trim());
    const match = text.match(/(\d+)/);
    if (!match) throw new Error(`could not read zoom level from "${text}"`);
    return Number(match[1]);
}

/**
 * Sends a real wheel gesture over the canvas.
 *
 * Deliberately page.mouse.wheel rather than a dispatched WheelEvent: mousewheel 3.0.4
 * listens for the legacy `mousewheel`/`DOMMouseScroll` events, which Chromium delivers for
 * genuine input but not for a synthetic `wheel` dispatch. A dispatched event would silently
 * do nothing and the test would prove nothing.
 */
export async function wheelOverCanvas(page: Page, frame: FrameLocator, deltaY: number, deltaX = 0): Promise<void> {
    const box = await frame.locator('#canvas-container').boundingBox();
    if (!box) throw new Error('canvas container has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(deltaX, deltaY);
    await page.waitForTimeout(300);
}

/** Captions of every node currently drawn. */
export async function nodeCaptions(frame2: Frame): Promise<string[]> {
    return frame2.evaluate(() =>
        Array.from(document.querySelectorAll('.node-caption')).map(n => (n.textContent || '').trim()),
    );
}

/**
 * Clicks the root node's caption near its top-left corner.
 *
 * Hovering a node attaches the creator nub (#creator-fakenode) over it, and the nub sits
 * where a centre click would land, so Playwright refuses the click as intercepted. That is
 * real application behaviour rather than a test artefact, so the click is aimed away from
 * the nub instead of forced through it -- forcing would skip exactly the actionability
 * checks that would catch a future layout regression.
 */
export async function clickRootNode(frame: FrameLocator, options: { double?: boolean } = {}): Promise<void> {
    const root = frame.locator('.node-caption.root');
    const target = { position: { x: 8, y: 8 } };
    if (options.double) await root.dblclick(target);
    else await root.click(target);
}

/**
 * Opens a minicolors picker and clicks inside its gradient, returning the colour chosen.
 *
 * Drives the real initialised widget rather than calling its value setter: the trigger and
 * the gradient are what a user touches, and they are what an upgrade would break.
 */
export async function pickColour(
    page: Page,
    frame: FrameLocator,
    frame2: Frame,
    inputId: string,
): Promise<{ value: string }> {
    await frame.locator(`#${inputId}`).locator('xpath=following-sibling::a').first().click();
    const gradient = frame.locator('.miniColors-colors, .minicolors-grid').first();
    await gradient.waitFor({ state: 'visible', timeout: 5000 });
    const box = await gradient.boundingBox();
    if (!box) throw new Error('colour gradient has no box');

    // Away from the corners so the result is neither black nor white.
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);
    await page.waitForTimeout(300);

    const value = await frame2.evaluate(
        id => (window as unknown as { jQuery: (s: string) => { val: () => string } }).jQuery(`#${id}`).val(),
        inputId,
    );

    // minicolors keeps a full-window overlay up until the picker is dismissed, and it
    // swallows every later click in the editor. Closing it is part of using the control.
    const overlay = frame.locator('.miniColors-overlay, .minicolors-overlay').first();
    if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 } });
        await overlay.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    }

    return { value };
}

/** Computed colour of the root node's caption. */
export async function rootNodeColour(frame2: Frame): Promise<string> {
    return frame2.evaluate(() => {
        const node = document.querySelector('.node-caption.root') as HTMLElement;
        return window.getComputedStyle(node).color;
    });
}
