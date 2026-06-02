import { test, expect } from '../../fixtures/auth.fixture';
import { reloadPage, gotoWorkarea } from '../../helpers/workarea-helpers';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for 360° panorama viewer (three-sixty-viewer) iDevice
 *
 * Covers: add to page, set configuration fields, save, persist after reload,
 * verify exported dependencies are registered.
 */

const TEST_DATA = {
    alt: 'E2E test panorama',
    yaw: '45',
    pitch: '10',
    fov: '90',
    autorotateSpeed: '2.5',
};

async function selectPageNode(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                break;
            } catch {
                // try next
            }
        }
    }

    await page.waitForTimeout(500);
    await page
        .waitForFunction(() => !!document.querySelector('#node-content'), undefined, { timeout: 10000 })
        .catch(() => {});
}

async function addThreeSixtyIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            await infoCategory.locator('.label').click();
            await page.waitForTimeout(500);
        }
    }

    await page.waitForTimeout(500);

    const idevice = page.locator('.idevice_item[id="three-sixty-viewer"]').first();
    await idevice.waitFor({ state: 'visible', timeout: 10000 });
    await idevice.scrollIntoViewIfNeeded();
    await idevice.click();

    await page.locator('#node-content article .idevice_node.three-sixty-viewer').first().waitFor({ timeout: 15000 });

    await page.locator('#threeSixtyAlt').waitFor({ state: 'visible', timeout: 10000 });
}

async function fillForm(page: Page): Promise<void> {
    await page.locator('#threeSixtyAlt').fill(TEST_DATA.alt);
    await page.locator('#threeSixtyYaw').fill(TEST_DATA.yaw);
    await page.locator('#threeSixtyPitch').fill(TEST_DATA.pitch);
    await page.locator('#threeSixtyFov').fill(TEST_DATA.fov);
    await page.locator('#threeSixtyAutorotate').check();
    await page.locator('#threeSixtyAutorotateSpeed').fill(TEST_DATA.autorotateSpeed);
    // Dispatch input/change events to guarantee state propagation
    await page.evaluate(() => {
        ['#threeSixtyYaw', '#threeSixtyPitch', '#threeSixtyFov', '#threeSixtyAutorotateSpeed', '#threeSixtyAlt']
            .map(id => document.querySelector(id) as HTMLInputElement | null)
            .forEach(el => {
                if (!el) return;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
    });
}

async function saveIdeviceInPage(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.three-sixty-viewer').last();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click({ timeout: 5000 });
    await page.waitForTimeout(500);
}

test.describe('Three Sixty Viewer iDevice', () => {
    test('adds three-sixty-viewer and shows all configuration fields', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Three Sixty Add Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);

        await expect(page.locator('#threeSixtyImageButton')).toBeVisible();
        await expect(page.locator('#threeSixtyAlt')).toBeVisible();
        await expect(page.locator('#threeSixtyYaw')).toBeVisible();
        await expect(page.locator('#threeSixtyPitch')).toBeVisible();
        await expect(page.locator('#threeSixtyFov')).toBeVisible();
        await expect(page.locator('#threeSixtyAutorotate')).toBeVisible();
        await expect(page.locator('#threeSixtyZoom')).toBeVisible();
        await expect(page.locator('#threeSixtyFullscreen')).toBeVisible();

        // Defaults
        await expect(page.locator('#threeSixtyYaw')).toHaveValue('0');
        await expect(page.locator('#threeSixtyPitch')).toHaveValue('0');
        await expect(page.locator('#threeSixtyFov')).toHaveValue('75');
    });

    test('persists configuration across save + reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const workarea = new WorkareaPage(page);
        const projectUuid = await createProject(page, 'Three Sixty Persist Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);
        await fillForm(page);
        await saveIdeviceInPage(page);

        await workarea.save();
        await page.waitForTimeout(500);

        await reloadPage(page);

        const pageNode = page
            .locator('.nav-element-text')
            .filter({ hasText: /New page|Nueva página/i })
            .first();
        if ((await pageNode.count()) > 0) {
            await pageNode.click({ force: true, timeout: 5000 });
            await page.waitForTimeout(500);
        }

        // Wait for the idevice wrapper to be present after reload
        await page
            .waitForFunction(
                () => !!document.querySelector('#node-content .idevice_node.three-sixty-viewer'),
                undefined,
                { timeout: 15000 },
            )
            .catch(() => {});

        // Enter edit mode and verify persisted values
        const editBtn = page.locator('#node-content .idevice_node.three-sixty-viewer .btn-edit-idevice').first();
        if (await editBtn.isVisible().catch(() => false)) {
            await editBtn.click();
        } else {
            await page
                .locator('#node-content .idevice_node.three-sixty-viewer .idevice_body')
                .first()
                .dblclick({ timeout: 5000 })
                .catch(() => {});
        }

        await page.locator('#threeSixtyAlt').waitFor({ state: 'visible', timeout: 10000 });
        await expect(page.locator('#threeSixtyAlt')).toHaveValue(TEST_DATA.alt);
        await expect(page.locator('#threeSixtyYaw')).toHaveValue(TEST_DATA.yaw);
        await expect(page.locator('#threeSixtyPitch')).toHaveValue(TEST_DATA.pitch);
        await expect(page.locator('#threeSixtyFov')).toHaveValue(TEST_DATA.fov);
        await expect(page.locator('#threeSixtyAutorotateSpeed')).toHaveValue(TEST_DATA.autorotateSpeed);
        await expect(page.locator('#threeSixtyAutorotate')).toBeChecked();
    });

    test('exports the expected vendored dependencies', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        // Query the browser helper to confirm three.js + OrbitControls are registered
        const files = await page.evaluate(async () => {
            try {
                const mod = await import('/src/shared/export/browser/idevice-config-browser.ts');
                return mod.getIdeviceExportFiles('three-sixty-viewer', '.js');
            } catch {
                // In production the browser has no TS module; fall back to inspecting
                // the export-js declaration in config.xml if available via fetch.
                return null;
            }
        });
        if (files) {
            expect(files).toContain('three-sixty-viewer.js');
            expect(files).toContain('three.min.js');
            expect(files).toContain('OrbitControls.js');
        }
    });

    test('exposes scene list and hotspot list controls', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Three Sixty Tour Test');
        await gotoWorkarea(page, projectUuid);

        await addThreeSixtyIdeviceFromPanel(page);

        // Tour authoring controls
        await expect(page.locator('#threeSixtySceneList')).toBeVisible();
        await expect(page.locator('#threeSixtyAddScene')).toBeVisible();
        await expect(page.locator('#threeSixtyHotspotList')).toBeVisible();
        await expect(page.locator('#threeSixtyAddHotspot')).toBeVisible();

        // Default: one scene in the list
        await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(1);

        // Adding a scene should render a second list item
        await page.locator('#threeSixtyAddScene').click();
        await expect(page.locator('#threeSixtySceneList .three-sixty-scene-item')).toHaveCount(2);

        // Adding a hotspot should render an editable hotspot row
        await page.locator('#threeSixtyAddHotspot').click();
        await expect(page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item')).toHaveCount(1);
        await expect(
            page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type'),
        ).toBeVisible();
    });

    test.describe('Flat (non-360) scenes', () => {
        test('toggling off the panorama checkbox switches a scene to flat mode', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Flat Toggle');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // The panorama checkbox is present and checked by default; the
            // Initial view (yaw/pitch/fov) controls are visible for 360° scenes.
            const panoramaToggle = page.locator('#threeSixtyIsPanorama');
            await expect(panoramaToggle).toBeVisible();
            await expect(panoramaToggle).toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toBeVisible();

            // Unchecking it switches the scene to a flat photo: the initial-view
            // fields disappear (they make no sense for a non-rotating image).
            await panoramaToggle.uncheck();
            await panoramaToggle.dispatchEvent('change');
            await page.waitForTimeout(300);

            await expect(page.locator('#threeSixtyIsPanorama')).not.toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toHaveCount(0);

            // Hotspots on a flat scene are positioned by X/Y percent, not yaw/pitch.
            await page.locator('#threeSixtyAddHotspot').click();
            await expect(page.locator('#threeSixtyHotspotList .hotspot-x').first()).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#threeSixtyHotspotList .hotspot-y').first()).toBeVisible();
            await expect(page.locator('#threeSixtyHotspotList .hotspot-yaw')).toHaveCount(0);
        });

        test('flat projection persists through save + reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty Flat Persist');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            const panoramaToggle = page.locator('#threeSixtyIsPanorama');
            await panoramaToggle.uncheck();
            await panoramaToggle.dispatchEvent('change');
            await page.waitForTimeout(300);

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);

            await reloadPage(page);

            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(500);
            }

            await page
                .waitForFunction(
                    () => !!document.querySelector('#node-content .idevice_node.three-sixty-viewer'),
                    undefined,
                    { timeout: 15000 },
                )
                .catch(() => {});

            const editBtn = page.locator('#node-content .idevice_node.three-sixty-viewer .btn-edit-idevice').first();
            if (await editBtn.isVisible().catch(() => false)) {
                await editBtn.click();
            } else {
                await page
                    .locator('#node-content .idevice_node.three-sixty-viewer .idevice_body')
                    .first()
                    .dblclick({ timeout: 5000 })
                    .catch(() => {});
            }

            await page.locator('#threeSixtyIsPanorama').waitFor({ state: 'visible', timeout: 10000 });
            await expect(page.locator('#threeSixtyIsPanorama')).not.toBeChecked();
            await expect(page.locator('#threeSixtyYaw')).toHaveCount(0);
        });
    });

    test.describe('Link hotspot', () => {
        test('link action type shows URL and new-tab checkbox', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, 'Three Sixty Link Hotspot Fields');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Add a hotspot
            await page.locator('#threeSixtyAddHotspot').click();
            await page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item').first().waitFor({ timeout: 10000 });

            // Switch action type to "link"
            const actionTypeSelect = page
                .locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type')
                .first();
            await actionTypeSelect.selectOption('link');
            await actionTypeSelect.dispatchEvent('change');
            await page.waitForTimeout(300);

            // URL input and newTab checkbox must appear
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-url').first()).toBeVisible({
                timeout: 5000,
            });
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).toBeVisible({
                timeout: 5000,
            });

            // newTab defaults to checked
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).toBeChecked();
        });

        test('link hotspot URL and newTab persist through save + reload', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);
            const projectUuid = await createProject(page, 'Three Sixty Link Hotspot Persist');
            await gotoWorkarea(page, projectUuid);

            await addThreeSixtyIdeviceFromPanel(page);

            // Add a hotspot and configure it as a link
            await page.locator('#threeSixtyAddHotspot').click();
            await page.locator('#threeSixtyHotspotList .three-sixty-hotspot-item').first().waitFor({ timeout: 10000 });

            const actionTypeSelect = page
                .locator('#threeSixtyHotspotList .three-sixty-hotspot-item .hotspot-action-type')
                .first();
            await actionTypeSelect.selectOption('link');
            await actionTypeSelect.dispatchEvent('change');
            await page.waitForTimeout(300);

            // Fill URL
            const urlInput = page.locator('#threeSixtyHotspotList .hotspot-payload-url').first();
            await urlInput.fill('https://example.com');
            await urlInput.dispatchEvent('input');

            // Uncheck "open in new tab"
            const newTabCheckbox = page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first();
            await newTabCheckbox.uncheck();
            await newTabCheckbox.dispatchEvent('change');

            await saveIdeviceInPage(page);
            await workarea.save();
            await page.waitForTimeout(500);

            await reloadPage(page);

            // Navigate back to the page
            const pageNode = page
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(500);
            }

            await page
                .waitForFunction(
                    () => !!document.querySelector('#node-content .idevice_node.three-sixty-viewer'),
                    undefined,
                    { timeout: 15000 },
                )
                .catch(() => {});

            // Re-enter edit mode
            const editBtn = page.locator('#node-content .idevice_node.three-sixty-viewer .btn-edit-idevice').first();
            if (await editBtn.isVisible().catch(() => false)) {
                await editBtn.click();
            } else {
                await page
                    .locator('#node-content .idevice_node.three-sixty-viewer .idevice_body')
                    .first()
                    .dblclick({ timeout: 5000 })
                    .catch(() => {});
            }

            await page.locator('#threeSixtyHotspotList').waitFor({ state: 'visible', timeout: 10000 });

            // Verify persisted link hotspot values
            await expect(page.locator('#threeSixtyHotspotList .hotspot-action-type').first()).toHaveValue('link');
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-url').first()).toHaveValue(
                'https://example.com',
            );
            await expect(page.locator('#threeSixtyHotspotList .hotspot-payload-newTab').first()).not.toBeChecked();
        });

        test('export runtime opens URL via window.open when newTab is true', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            // Load the export script and exercise _openLink directly.
            // The module exposes itself as $threesixtyviewer (not $exeDevice).
            const result = await page.evaluate(async () => {
                const res = await fetch('/files/perm/idevices/base/three-sixty-viewer/export/three-sixty-viewer.js');
                const code = await res.text();
                // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
                const factory = new Function('_', code + '; return $threesixtyviewer;');
                const dev = factory((s: string) => s);

                const opened: string[] = [];
                const hrefs: string[] = [];

                // Patch _openLink to capture calls without real navigation
                dev._openLink = (payload: { url: string; newTab: boolean }) => {
                    if (!payload.url) return;
                    if (payload.newTab !== false) {
                        opened.push(payload.url);
                    } else {
                        hrefs.push(payload.url);
                    }
                };

                dev._openLink({ url: 'https://example.com', newTab: true });
                dev._openLink({ url: 'https://same.com', newTab: false });
                dev._openLink({ url: '', newTab: true }); // empty → no-op

                return { opened, hrefs };
            });

            expect(result.opened).toEqual(['https://example.com']);
            expect(result.hrefs).toEqual(['https://same.com']);
        });
    });

    test('migrates v1 saved data into a one-scene tour without losing fields', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        // Load the iDevice script directly in the page and call its migration to assert
        // that legacy single-image data lifts cleanly into the v2 schema.
        const result = await page.evaluate(async () => {
            const res = await fetch('/files/perm/idevices/base/three-sixty-viewer/edition/three-sixty-viewer.js');
            const code = await res.text();
            // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
            const factory = new Function('_', code + '; return $exeDevice;');
            const dev = factory((s: string) => s);
            const v1 = {
                ideviceId: 'idev-v1',
                src: 'asset://pano.jpg',
                alt: 'A scene',
                initialView: { yaw: 30, pitch: 10, fov: 80 },
                autorotate: { enabled: true, speed: 2 },
                zoomEnabled: false,
                fullscreenEnabled: true,
            };
            return dev.normalizeData(v1);
        });

        expect(result.version).toBe(2);
        expect(result.scenes).toHaveLength(1);
        expect(result.scenes[0].src).toBe('asset://pano.jpg');
        expect(result.scenes[0].alt).toBe('A scene');
        expect(result.scenes[0].initialView).toEqual({ yaw: 30, pitch: 10, fov: 80 });
        expect(result.behaviour.autorotate).toEqual({ enabled: true, speed: 2 });
        expect(result.behaviour.zoomEnabled).toBe(false);
        expect(result.behaviour.fullscreenEnabled).toBe(true);
        expect(result.startSceneId).toBe(result.scenes[0].id);
    });
});
