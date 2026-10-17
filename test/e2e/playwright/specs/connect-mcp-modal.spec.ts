import { test, expect, skipInStaticMode, waitForModal } from '../fixtures/auth.fixture';
import { waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Connect MCP modal flow (Help -> Connect MCP).
 *
 * eXeLearning registers its tools with the browser-native WebMCP API
 * (document.modelContext). Test browsers do not ship it, so the first test checks
 * the "unavailable" guidance and the second injects a minimal document.modelContext
 * before the app boots to check that the tools are registered and listed.
 *
 * Skipped in static mode: opening the workarea on a real project requires the
 * server API (project creation + Yjs session).
 */
test.describe('Connect MCP modal', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Server API for project creation');
    });

    async function openWorkarea(page, createProject, title: string) {
        const projectUuid = await createProject(page, title);
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForAppReady(page);
    }

    async function openConnectMcpModal(page) {
        await page.locator('#dropdownHelp').click();
        const mcpItem = page.locator('#navbar-button-connect-mcp');
        await mcpItem.waitFor({ state: 'visible' });
        await mcpItem.click();
        await waitForModal(page, 'modalConnectMcp');
    }

    test('explains how to enable WebMCP when the browser lacks it', async ({ authenticatedPage, createProject }) => {
        await openWorkarea(authenticatedPage, createProject, 'WebMCP Unavailable Project');
        await openConnectMcpModal(authenticatedPage);

        const modal = authenticatedPage.locator('#modalConnectMcp');
        await expect(modal).toHaveAttribute('data-open', 'true');
        await expect(authenticatedPage.locator('#webmcp-status-value')).toHaveText('WebMCP unavailable');
        await expect(authenticatedPage.locator('#webmcp-status-description')).toContainText(
            'chrome://flags/#enable-webmcp-testing',
        );
        await expect(authenticatedPage.locator('#webmcp-tools-list li')).toHaveText(['No tools registered yet.']);
    });

    test('registers the tools on document.modelContext and lists them', async ({
        authenticatedPage,
        createProject,
    }) => {
        await authenticatedPage.addInitScript(() => {
            const registered: string[] = [];
            (window as any).__webmcpRegistered = registered;
            Object.defineProperty(document, 'modelContext', {
                configurable: true,
                value: {
                    registerTool(tool: { name: string }) {
                        registered.push(tool.name);
                        return Promise.resolve();
                    },
                },
            });
        });
        await openWorkarea(authenticatedPage, createProject, 'WebMCP Native Project');

        const registered = await authenticatedPage.evaluate(() => (window as any).__webmcpRegistered as string[]);
        expect(registered).toContain('exe.project.save');

        await openConnectMcpModal(authenticatedPage);

        await expect(authenticatedPage.locator('#webmcp-status-value')).toHaveText('Ready');
        await expect(authenticatedPage.locator('#webmcp-tools-list li')).toHaveCount(registered.length);
        await expect(authenticatedPage.locator('#webmcp-tools-list')).toContainText('exe.project.save');
    });
});
