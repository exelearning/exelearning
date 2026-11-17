import { test, expect, skipInStaticMode, waitForModal } from '../fixtures/auth.fixture';
import { waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Connect MCP modal flow (Help -> Connect MCP).
 *
 * eXeLearning registers its tools with the browser-native WebMCP API
 * (document.modelContext). Test browsers do not ship it, so the first test checks
 * the "unavailable" guidance, the second injects a minimal document.modelContext
 * before the app boots to check that the tools are registered and listed, and the
 * third drives the in-page assistant panel against a mocked OpenAI-compatible API.
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
        // The tools stay available to the in-page assistant even without the browser API.
        await expect(authenticatedPage.locator('#webmcp-tools-list')).toContainText('exe.project.save');
        await expect(authenticatedPage.locator('#button-open-webmcp-agent')).toBeVisible();
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

    test('the assistant panel runs a tool through an OpenAI-compatible endpoint', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        };
        const requests: any[] = [];
        await page.route('https://llm.example.test/v1/chat/completions', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: cors });
                return;
            }
            const body = route.request().postDataJSON();
            requests.push({ body, authorization: route.request().headers().authorization });
            const message =
                requests.length === 1
                    ? {
                          role: 'assistant',
                          content: null,
                          tool_calls: [
                              {
                                  id: 'call-1',
                                  type: 'function',
                                  function: { name: 'exe__pages__create', arguments: '{"name":"Volcanoes"}' },
                              },
                          ],
                      }
                    : { role: 'assistant', content: 'I added the Volcanoes page.' };
            await route.fulfill({ status: 200, headers: cors, json: { choices: [{ message }] } });
        });
        // Write tools ask for confirmation once per session.
        page.on('dialog', dialog => dialog.accept());

        await openWorkarea(page, createProject, 'WebMCP Assistant Project');
        await openConnectMcpModal(page);
        await page.locator('#button-open-webmcp-agent').click();

        const panel = page.getByTestId('webmcp-agent-panel');
        await expect(panel).toBeVisible();
        await panel.locator('#webmcp-agent-provider').selectOption('openai');
        await panel.locator('#webmcp-agent-base-url').fill('https://llm.example.test/v1');
        await panel.locator('#webmcp-agent-model').fill('test-model');
        await panel.locator('#webmcp-agent-api-key').fill('sk-e2e');
        await panel.locator('#webmcp-agent-prompt').fill('Add a page about volcanoes');
        await panel.locator('#webmcp-agent-send').click();

        await expect(panel.locator('.webmcp-agent-assistant')).toHaveText('I added the Volcanoes page.');
        await expect(panel.locator('.webmcp-agent-tool')).toContainText('exe.pages.create');
        await expect(page.locator('.nav-element .nav-element-text', { hasText: 'Volcanoes' }).first()).toBeVisible();

        expect(requests[0].authorization).toBe('Bearer sk-e2e');
        expect(requests[0].body.tools.map((tool: any) => tool.function.name)).toContain('exe__pages__create');
        expect(requests[1].body.messages.at(-1).role).toBe('tool');

        await panel.locator('#webmcp-agent-close').click();
        await expect(panel).toBeHidden();
    });

    test('fills a game iDevice through its own AI tab prompt and importer', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        // Write tools ask for confirmation once per session.
        page.on('dialog', dialog => dialog.accept());
        await openWorkarea(page, createProject, 'WebMCP AI Content Project');

        const run = (name: string, args: object) =>
            page.evaluate(
                async ([toolName, toolArgs]) => {
                    const result = await (window as any).eXeLearning.app.webmcp.executeTool(toolName, toolArgs);
                    return JSON.parse(result.content[0].text);
                },
                [name, args] as const,
            );

        const prompt = await run('exe.idevices.ai_prompt.get', { ideviceType: 'crossword' });
        expect(prompt).toMatchObject({ success: true });
        expect(prompt.data.prompt).toContain('Word#Definition');

        const page1 = await run('exe.pages.create', { name: 'Human body' });
        const pageId = page1.data.pageId ?? page1.data.id;
        const created = await run('exe.idevices.ai_content.import', {
            ideviceType: 'crossword',
            pageId,
            blockName: 'Organs',
            lines: ['```', 'Heart#Pumps blood', 'Lung#Exchanges gases', 'not a line', '```'],
        });
        expect(created, JSON.stringify(created)).toMatchObject({ success: true });
        expect(created.data).toMatchObject({ addedLines: 2, invalidLines: ['not a line'] });

        const appended = await run('exe.idevices.ai_content.import', {
            ideviceType: 'crossword',
            componentId: created.data.componentId,
            pageId,
            lines: ['Liver#Filters the blood'],
        });
        expect(appended.data.addedLines).toBe(1);

        // The iDevice was saved through its own edition: its stored data holds all three words.
        const words: string[] = await page.evaluate(id => {
            const w = window as any;
            const component = w.eXeLearning.app.webmcp.getStructureBinding().getComponent(id);
            const html = new DOMParser().parseFromString(component.htmlContent, 'text/html');
            const data = html.querySelector('.crucigrama-DataGame')?.textContent || '';
            const game = JSON.parse(w.$exeDevices.iDevice.gamification.helpers.decrypt(data));
            return game.wordsGame.map((entry: { word: string }) => entry.word);
        }, created.data.componentId);
        expect(words.map((word: string) => word.toLowerCase())).toEqual(
            expect.arrayContaining(['heart', 'lung', 'liver']),
        );
        // Saved and closed: one crossword on the page and no editor left open.
        await expect(page.locator('#node-content .idevice_node.crossword[mode="export"]')).toHaveCount(1);
        await expect(page.locator('#node-content .idevice_node[mode="edition"]')).toHaveCount(0);
    });
});
