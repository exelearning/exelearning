/**
 * E2E test for the SCORM 1.2 export runtime (clean-provenance rewrite).
 *
 * Exports a real project as SCORM 1.2 through the browser export pipeline
 * (File → Download as… → SCORM 1.2) and verifies the packaged runtime:
 *   1. `libs/SCORM_API_wrapper.js` is the vendored upstream pipwerks wrapper,
 *      byte-identical to the repository copy (MIT header included), and
 *   2. `libs/SCOFunctions.js` is the assembled project-owned runtime (AGPL
 *      SPDX banner, all five layers, no legacy ADL/CTC-derived code), and
 *   3. no page carries `onunload`/`onbeforeunload` attributes (the runtime
 *      owns end-of-session handling via pagehide/visibilitychange).
 *
 * See doc/development/scorm12-runtime-contract.md and ADR-2209-01.
 */

import { test, expect } from '../fixtures/auth.fixture';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync, strFromU8 } from 'fflate';
import { waitForAppReady, gotoWorkarea, addTextIdeviceWithContent } from '../helpers/workarea-helpers';

test.describe('SCORM 1.2 export runtime', () => {
    test('packages the vendored pipwerks wrapper and the assembled runtime', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'SCORM 1.2 Runtime Export');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        await addTextIdeviceWithContent(page, '<p>SCORM runtime packaging check.</p>');

        // Export as SCORM 1.2 through the File menu (browser-side pipeline).
        // Online mode shows the "Download as..." submenu; the static/offline
        // build shows the "Export as..." variant instead.
        await page.locator('#dropdownFile').click();
        const onlineSubmenu = page.locator('#dropdownExportAs');
        const usesOnlineMenu = await onlineSubmenu.isVisible().catch(() => false);
        await (usesOnlineMenu ? onlineSubmenu : page.locator('#dropdownExportAsOffline')).click();
        const exportButton = page.locator(
            usesOnlineMenu ? '#navbar-button-export-scorm12' : '#navbar-button-exportas-scorm12',
        );
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await exportButton.click();
        const download = await downloadPromise;

        const tmpZip = path.join(os.tmpdir(), `scorm12-runtime-${Date.now()}.zip`);
        await download.saveAs(tmpZip);
        const entries = unzipSync(new Uint8Array(fs.readFileSync(tmpZip)));
        fs.unlinkSync(tmpZip);

        // 1. Vendored upstream pipwerks wrapper, byte-identical, MIT header.
        const wrapperEntry = entries['libs/SCORM_API_wrapper.js'];
        expect(wrapperEntry).toBeDefined();
        const vendored = fs.readFileSync(
            path.join(
                process.cwd(),
                'public',
                'app',
                'common',
                'scorm',
                'scorm12',
                'vendor',
                'pipwerks',
                'SCORM_API_wrapper.js',
            ),
        );
        expect(Buffer.from(wrapperEntry).equals(vendored)).toBe(true);
        expect(strFromU8(wrapperEntry)).toContain('MIT-style license');

        // 2. Assembled project runtime replaces the legacy SCOFunctions.js.
        const scoFunctionsEntry = entries['libs/SCOFunctions.js'];
        expect(scoFunctionsEntry).toBeDefined();
        const scoFunctions = strFromU8(scoFunctionsEntry);
        expect(scoFunctions).toContain('SPDX-License-Identifier: AGPL-3.0-or-later');
        // Every layer Scorm12Runtime.ts concatenates, each under its section marker.
        for (const layer of [
            'exe-scorm12-client.js',
            'exe-scorm12-activities.js',
            'exe-scorm12-policy.js',
            'exe-scorm12-lifecycle.js',
            'exe-scorm12-adapter.js',
        ]) {
            expect(scoFunctions).toContain(`/* ==== ${layer} ==== */`);
        }
        expect(scoFunctions).not.toContain('ADL Technical Team');
        expect(scoFunctions).not.toContain('convertTotalMiliSeconds');

        // 3. Pages load the runtime but carry no unload attributes.
        const indexEntry = entries['index.html'];
        expect(indexEntry).toBeDefined();
        const indexHtml = strFromU8(indexEntry);
        expect(indexHtml).toContain('libs/SCORM_API_wrapper.js');
        expect(indexHtml).toContain('libs/SCOFunctions.js');
        expect(indexHtml).toContain('onload="loadPage()"');
        expect(indexHtml).not.toContain('onunload');
        expect(indexHtml).not.toContain('onbeforeunload');

        // Sanity: it is still a SCORM package.
        expect(entries['imsmanifest.xml']).toBeDefined();
    });
});
