import { test, expect, skipInStaticMode, waitForModal } from '../fixtures/auth.fixture';
import { waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Connect MCP modal flow (Help -> Connect MCP).
 *
 * Verifies the WebMCP onboarding modal that lets a user wire an external MCP
 * client (e.g. Claude Desktop) to the in-browser editor:
 *   - the modal opens from the Help menu,
 *   - the client config snippet renders,
 *   - the status line populates (leaves the "-" placeholder), and
 *   - the available-tools list is rendered.
 *
 * In a headless CI browser there is no connected MCP client, so the status may
 * be "WebMCP unavailable" and the tools list may show the empty-state item;
 * both are valid "populated" states. The assertions below therefore check that
 * the UI is wired up and reactive, not that a live client is attached.
 *
 * Skipped in static mode: opening the workarea on a real project requires the
 * server API (project creation + Yjs session).
 */
test.describe('Connect MCP modal', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Server API for project creation');
    });

    async function openConnectMcpModal(page) {
        // Open the Help dropdown, then the "Connect MCP" item.
        await page.locator('#dropdownHelp').click();
        const mcpItem = page.locator('#navbar-button-connect-mcp');
        await mcpItem.waitFor({ state: 'visible' });
        await mcpItem.click();
        await waitForModal(page, 'modalConnectMcp');
    }

    test('opens from the Help menu and renders config, status and tools', async ({
        authenticatedPage,
        createProject,
    }) => {
        const projectUuid = await createProject(authenticatedPage, 'WebMCP Connect Project');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        await authenticatedPage.waitForLoadState('networkidle');
        await waitForAppReady(authenticatedPage);

        await openConnectMcpModal(authenticatedPage);

        const modal = authenticatedPage.locator('#modalConnectMcp');
        await expect(modal).toBeVisible();
        await expect(modal).toHaveAttribute('data-open', 'true');

        // 1) Config snippet renders (either the MCP client JSON or the native note).
        const snippet = authenticatedPage.locator('#webmcp-config-snippet');
        await expect(snippet).not.toBeEmpty();
        const snippetText = (await snippet.textContent()) || '';
        expect(snippetText.length).toBeGreaterThan(0);
        // The JSON config advertises the webmcp server entry; the native fallback
        // mentions WebMCP. Either way the snippet must reference WebMCP.
        expect(snippetText.toLowerCase()).toContain('webmcp');

        // 2) Status value leaves the "-" placeholder once the service reports in.
        const statusValue = authenticatedPage.locator('#webmcp-status-value');
        await expect(statusValue).not.toHaveText('-', { timeout: 15000 });
        await expect(statusValue).not.toBeEmpty();

        // 3) The tools list is rendered with at least one item (a registered tool
        //    name, or the "No tools registered yet." empty-state entry).
        const toolItems = authenticatedPage.locator('#webmcp-tools-list li');
        await expect(toolItems.first()).toBeVisible({ timeout: 15000 });
        expect(await toolItems.count()).toBeGreaterThan(0);
    });

    test('copies the config snippet via the Copy config button', async ({
        authenticatedPage,
        createProject,
        context,
    }) => {
        // Grant clipboard access so the copy path does not fall back to alert().
        await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {
            /* some engines do not support these permissions; the test still asserts the click is wired */
        });

        const projectUuid = await createProject(authenticatedPage, 'WebMCP Copy Project');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        await authenticatedPage.waitForLoadState('networkidle');
        await waitForAppReady(authenticatedPage);

        await openConnectMcpModal(authenticatedPage);

        const snippet = authenticatedPage.locator('#webmcp-config-snippet');
        await expect(snippet).not.toBeEmpty();
        const expected = (await snippet.textContent()) || '';

        await authenticatedPage.locator('#button-copy-webmcp-config').click();

        // Best-effort clipboard verification (skipped silently where unsupported).
        const clipboard = await authenticatedPage.evaluate(() => navigator.clipboard?.readText?.()).catch(() => null);
        if (clipboard) {
            expect(clipboard).toBe(expected);
        }
    });
});
