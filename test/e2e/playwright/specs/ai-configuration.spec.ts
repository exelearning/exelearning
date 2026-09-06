import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice } from '../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E tests for the server-managed AI configuration behaviour matrix.
 *
 * The game-generation editor (here the Form iDevice, which renders getTabIA)
 * shows different AI controls depending on the safe public AI config served by
 * the backend at window.eXeLearning.app.api.parameters.ai:
 *   - disabled  -> copy-only tab (prompt + Copy), no provider selector/Send to AI
 *   - external  -> public assistant selector + "Send to AI" (default behaviour)
 *   - managed   -> server-side "Generate"/"Create" surface, no external selector
 *
 * The managed/disabled rows are driven by overriding the public config client
 * side (the server only sends safe flags; this just exercises the UI branches
 * without requiring a configured provider).
 */

/** Override the public AI config before the iDevice editor renders. */
async function setAiConfig(page: Page, ai: Record<string, unknown> | null): Promise<void> {
    await page.evaluate(value => {
        const api = (window as any).eXeLearning?.app?.api;
        if (!api) return;
        api.parameters = api.parameters || {};
        if (value) api.parameters.ai = value;
        else delete api.parameters.ai;
    }, ai);
}

async function addFormGameIdevice(page: Page): Promise<void> {
    await selectFirstPage(page);
    await addIdevice(page, 'form');
    // The Form iDevice enters edition on add; its AI tab content (getTabIA) is
    // rendered into the editor DOM (hidden unless the AI tab is active).
    await page.waitForSelector('#node-content article .idevice_node.form', { timeout: 15000 });
}

test.describe('AI configuration behaviour matrix', () => {
    test('external mode shows the public assistant selector and "Send to AI"', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'AI External Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Default server config in the E2E env is enabled + external; assert it,
        // then add the iDevice so getTabIA renders the external controls.
        await setAiConfig(page, { enabled: true, provider: 'external', mode: 'external', configured: true });
        await addFormGameIdevice(page);

        await expect(page.locator('#eXeEPromptArea')).toBeAttached({ timeout: 10000 });
        await expect(page.locator('#eXeEIASelect')).toBeAttached();
        await expect(page.locator('#eXeEOpenChatGPTButton')).toBeAttached();
        // No managed Generate tab in external mode.
        await expect(page.locator('#eXeETabIA')).toHaveCount(0);
    });

    test('disabled mode keeps a copy-only tab (prompt + Copy) without provider controls', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'AI Disabled Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await setAiConfig(page, { enabled: false, provider: 'external', mode: 'external', configured: true });
        await addFormGameIdevice(page);

        // The prompt + Copy surface stays so teachers can still copy the prompt and
        // paste questions generated elsewhere; no AI provider controls are rendered.
        await expect(page.locator('#eXeEPromptArea')).toBeAttached({ timeout: 10000 });
        await expect(page.locator('#eXeECopyButton')).toBeAttached();
        await expect(page.locator('#eXeEIASelect')).toHaveCount(0);
        await expect(page.locator('#eXeEOpenChatGPTButton')).toHaveCount(0);
        await expect(page.locator('#eXeETabIA')).toHaveCount(0);
    });

    test('managed mode shows the Generate/Create surface and hides the external selector', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'AI Managed Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await setAiConfig(page, { enabled: true, provider: 'ollama', mode: 'managed', configured: true });
        await addFormGameIdevice(page);

        await expect(page.locator('#eXeEPromptArea')).toBeAttached({ timeout: 10000 });
        await expect(page.locator('#eXeETabIA')).toBeAttached();
        await expect(page.locator('#eXeFormIAContainer')).toBeAttached();
        // External assistant controls are hidden in managed mode.
        await expect(page.locator('#eXeEIASelect')).toHaveCount(0);
        await expect(page.locator('#eXeEOpenChatGPTButton')).toHaveCount(0);
    });
});
