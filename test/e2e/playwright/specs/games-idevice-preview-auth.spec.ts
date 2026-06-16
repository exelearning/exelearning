import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    waitForServiceWorker,
    gotoWorkarea,
    selectFirstPage,
    addIdevice,
    openPreviewPanel,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * E2E: game iDevices still render in Preview after the auth gate.
 *
 * Context (PR #1896, security hardening): `GET /api/games/:odeSessionId/idevices`
 * — used by game iDevices such as `progress-report` to list all evaluable
 * activities in a project — was previously reachable anonymously by UUID. It is
 * now behind `withJwtAuth` + project-access enforcement. The editor/preview is
 * same-origin and sends the `auth` cookie, so this gate must NOT break preview
 * rendering of game iDevices.
 *
 * This spec adds a `progress-report` iDevice to a fresh (unsaved) project and
 * verifies it renders in the Preview, exercising the data path that backs the
 * games endpoint (in browser it reads the Yjs doc; the live endpoint is the
 * server-side fallback that the same-origin cookie now authenticates).
 *
 * NOTE: This spec is added for coverage of the auth-gated game-iDevice preview
 * flow; per the task brief it was authored but NOT executed in this change.
 */
test.describe('Game iDevice preview after auth gate', () => {
    test('progress-report iDevice renders in Preview on an authenticated session', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create and open a fresh project (lives in an in-memory session before
        // the first save — the same brand-new-project case the games route now
        // grants the owner via the in-memory session check).
        const projectUuid = await createProject(page, 'Games iDevice Preview Auth');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForServiceWorker(page);

        // Add the progress-report game iDevice to a real (non-root) page.
        await selectFirstPage(page);
        await addIdevice(page, 'progress-report');

        // It should be present in the editor content area.
        const editorIdevice = page.locator('#node-content article .idevice_node.progress-report').first();
        await expect(editorIdevice).toBeVisible();

        // Open the Preview and confirm the game iDevice renders there. The
        // progress-report export markup is wrapped in `.IFPP-MainContainer`.
        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);

        const previewIdevice = frame.locator('article.idevice_node.progress-report, .IFPP-MainContainer').first();
        await expect(previewIdevice).toBeVisible({ timeout: 30000 });
    });
});
