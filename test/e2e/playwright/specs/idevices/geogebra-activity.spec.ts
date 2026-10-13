import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    addIdevice,
    editIdevice,
    saveIdevice,
    waitForPreviewContent,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E coverage for the GeoGebra Activity iDevice display sizing (#2029).
 *
 * The Width/Height controls already existed in the editor markup but were
 * hidden behind Bootstrap's `d-none` class and a matching CSS
 * `display: none` override, so authors had no way to make the embedded
 * construction bigger. This spec guards the regression (controls must be
 * visible and usable) and confirms the configured size reaches the actual
 * GeoGebra applet in preview.
 *
 * The real `deployggb.js` CDN script is replaced with a lightweight mock
 * `GGBApplet` so the test never depends on network access to geogebra.org.
 */

const IDEVICE = 'geogebra-activity';
const NODE = `#node-content article .idevice_node.${IDEVICE}`;
// The runtime script loader appends a `?t=<timestamp>` cache-busting query
// string (idevicesEngine.js loadScript()), so match on the path, not an
// exact URL.
const GEOGEBRA_SCRIPT_PATTERN = /^https:\/\/cdn\.geogebra\.org\/apps\/deployggb\.js/;

const MOCK_GGB_APPLET_SCRIPT = `
window.__ggbAppletParams = [];
window.GGBApplet = function (parameters) {
    window.__ggbAppletParams.push(parameters);
    this.inject = function (containerId) {
        var el = document.getElementById(containerId);
        if (el) {
            el.innerHTML =
                '<div data-mock-geogebra-applet style="width:' +
                parameters.width +
                'px;height:' +
                parameters.height +
                'px;"></div>';
        }
    };
};
`;

async function addGeogebraIdevice(page: Page): Promise<string> {
    await selectFirstPage(page);
    await addIdevice(page, IDEVICE);

    const article = page.locator(NODE).first();
    await article.waitFor({ state: 'visible', timeout: 10000 });
    const id = await article.getAttribute('id');
    if (!id) throw new Error('GeoGebra iDevice rendered without id');
    return id;
}

/**
 * Every iDevice form fieldset (Instructions, General Settings, Advanced
 * Options, Content after) starts collapsed until its legend is clicked —
 * this is generic accordion behavior shared by all iDevices, not something
 * specific to GeoGebra. The URL/Title/Authorship/Size controls all live
 * inside "General Settings", so it must be expanded before interacting with
 * any of them.
 */
async function openGeneralSettings(page: Page, ideviceId: string): Promise<void> {
    const legend = page
        .locator(`#${ideviceId} fieldset.exe-fieldset legend`)
        .filter({ hasText: 'General Settings' })
        .locator('a');
    await legend.click();
    await page.waitForFunction(
        id => {
            const node = document.getElementById(id);
            const fieldsets = Array.from(node?.querySelectorAll('fieldset.exe-fieldset') || []);
            const generalSettings = fieldsets.find(fs =>
                fs.querySelector('legend')?.textContent?.includes('General Settings'),
            );
            return generalSettings?.classList.contains('exe-fieldset-open') ?? false;
        },
        ideviceId,
        { timeout: 5000 },
    );
}

test.describe('GeoGebra Activity iDevice — display sizing (#2029)', () => {
    test('exposes visible width/height controls and applies them to the preview applet', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Mock the GeoGebra CDN script for the whole test so preview rendering
        // never depends on real network access.
        await page.route(GEOGEBRA_SCRIPT_PATTERN, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: MOCK_GGB_APPLET_SCRIPT,
            });
        });

        const projectUuid = await createProject(page, 'GeoGebra Sizing E2E');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addGeogebraIdevice(page);
        await editIdevice(page, ideviceId);
        await openGeneralSettings(page, ideviceId);

        // Regression guard for #2029: the size controls must be visible, not
        // hidden behind Bootstrap's d-none + a matching CSS display:none rule.
        const sizeBlock = page.locator(`#${ideviceId} #geogebraActivitySize`);
        const widthInput = page.locator(`#${ideviceId} #geogebraActivityWidth`);
        const heightInput = page.locator(`#${ideviceId} #geogebraActivityHeight`);
        await expect(sizeBlock).toBeVisible();
        await expect(widthInput).toBeVisible();
        await expect(heightInput).toBeVisible();

        // "VgHhQXCC" is the same sample GeoGebra material ID used throughout
        // the unit tests; typing it directly avoids triggering the "Load
        // data" button, which would call the real geogebra.org JSON API.
        await page.locator(`#${ideviceId} #geogebraActivityURL`).fill('VgHhQXCC');
        await widthInput.fill('800');
        await heightInput.fill('600');

        await saveIdevice(page, ideviceId);

        const previewLoaded = await waitForPreviewContent(page, 20000);
        expect(previewLoaded).toBe(true);
        const frame = getPreviewFrame(page);
        const mockApplet = frame.locator('[data-mock-geogebra-applet]').first();
        await mockApplet.waitFor({ state: 'attached', timeout: 15000 });

        const size = await mockApplet.evaluate(el => ({
            width: (el as HTMLElement).style.width,
            height: (el as HTMLElement).style.height,
        }));
        expect(size.width).toBe('800px');
        expect(size.height).toBe('600px');

        await page.unroute(GEOGEBRA_SCRIPT_PATTERN);
    });
});
