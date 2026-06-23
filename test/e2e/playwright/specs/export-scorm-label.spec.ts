import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E: SCORM export option label (issue #1760)
 *
 * The export menu must show the SCORM version next to the option so users can
 * tell SCORM 1.2 apart from SCORM 2004. The SCORM 1.2 entry must read
 * "SCORM (1.2)". This is a label-only change: the option ids and export
 * behavior are unchanged. The SCORM 2004 label is asserted separately in the
 * fast server-render unit test (src/services/template.spec.ts).
 */

/**
 * Open the File menu and reveal the export submenu so its options are visible.
 * Works in both online (Download as…) and offline (Export as…) layouts.
 */
async function openExportSubmenu(page: Page): Promise<void> {
    await page.locator('#dropdownFile').click();
    await page
        .locator('#dropdownFile[aria-expanded="true"], .dropdown-menu.show')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });

    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    await exportSubmenuToggle.waitFor({ state: 'visible', timeout: 5000 });
    await exportSubmenuToggle.click();
}

test.describe('Export menu SCORM label (#1760)', () => {
    test('shows the SCORM 1.2 export option as "SCORM (1.2)"', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'SCORM export label #1760');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openExportSubmenu(page);

        const scorm12Option = page
            .locator('#navbar-button-export-scorm12:visible, #navbar-button-exportas-scorm12:visible')
            .first();
        await scorm12Option.waitFor({ state: 'visible', timeout: 5000 });
        await expect(scorm12Option).toHaveText('SCORM (1.2)');
    });
});
