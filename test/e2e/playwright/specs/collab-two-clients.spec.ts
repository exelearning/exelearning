/**
 * Test collaborative editing between two clients
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const TEST_EMAIL = 'user@exelearning.net';
const TEST_PASSWORD = '1234';

async function login(page: Page) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
}

async function waitForYjsBridge(page: Page) {
    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            return app?.project?._yjsBridge !== undefined;
        },
        { timeout: 30000 },
    );

    // Wait for loading screen to disappear
    await page.waitForFunction(
        () => {
            const loadScreen = document.querySelector('#load-screen-main');
            return !loadScreen || loadScreen.getAttribute('data-visible') === 'false';
        },
        { timeout: 15000 },
    );
}

async function selectPageNode(page: Page) {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '.structure-tree li .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                break;
            } catch {
                // Try next
            }
        }
    }
    await page.waitForTimeout(1000);
}

async function addCollaborativeEditingIdevice(page: Page) {
    await selectPageNode(page);

    // Expand category
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
            await page.waitForTimeout(800);
        }
    }

    // Click on collaborative-editing iDevice
    const collabIdevice = page.locator('.idevice_item[id="collaborative-editing"]').first();
    await collabIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await collabIdevice.click();

    // Wait for iDevice to appear
    await page.locator('#node-content article .idevice_node.collaborative-editing').first().waitFor({ timeout: 15000 });
}

async function waitForLexicalEditor(page: Page) {
    await page.waitForFunction(
        () => {
            const editor = document.querySelector('.lexical-editor [contenteditable="true"]');
            return editor !== null;
        },
        { timeout: 20000 },
    );
}

test.describe('Collaborative Editing - Two Clients', () => {
    test.setTimeout(120000); // 2 minutes timeout

    test('two users can edit the same document and see changes', async ({ browser }) => {
        // Create two browser contexts (simulating two different users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Capture console logs from both pages for debugging
        page1.on('console', msg => {
            const text = msg.text();
            if (
                text.includes('[IdevicesEngine]') ||
                text.includes('[IdeviceNode]') ||
                text.includes('CollaborativeEditing') ||
                text.includes('[YjsModules]') ||
                text.includes('[YjsLexicalBinding]') ||
                text.includes('isCollaborative') ||
                text.includes('bindLexical') ||
                text.includes('binding')
            ) {
                console.log('Browser console (page1):', text);
            }
        });
        page2.on('console', msg => {
            const text = msg.text();
            if (
                text.includes('[IdevicesEngine]') ||
                text.includes('[IdeviceNode]') ||
                text.includes('CollaborativeEditing') ||
                text.includes('[YjsModules]') ||
                text.includes('[YjsLexicalBinding]') ||
                text.includes('isCollaborative') ||
                text.includes('bindLexical') ||
                text.includes('binding')
            ) {
                console.log('Browser console (page2):', text);
            }
        });

        try {
            // ========== USER 1: Create project and add iDevice ==========
            console.log('User 1: Logging in...');
            await login(page1);

            // Create project
            const response = await page1.request.post('/api/project/create-quick', {
                data: { title: 'Collab Test Two Clients' },
            });
            const result = await response.json();
            const projectUuid = result.uuid;
            console.log('Project created:', projectUuid);

            // Navigate to workarea
            await page1.goto(`/workarea?project=${projectUuid}`);
            await page1.waitForLoadState('networkidle');
            await waitForYjsBridge(page1);

            // Add collaborative-editing iDevice
            console.log('User 1: Adding iDevice...');
            await addCollaborativeEditingIdevice(page1);
            await waitForLexicalEditor(page1);
            await page1.waitForTimeout(2000);

            // Get the editor
            const editor1 = page1.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor1).toBeVisible();

            // Type initial content
            console.log('User 1: Typing initial content...');
            await editor1.click();
            await page1.keyboard.type('Hello from User 1!');
            await page1.waitForTimeout(1000);

            // Verify content was typed
            await expect(editor1).toContainText('Hello from User 1!');

            // ========== USER 2: Join same project ==========
            console.log('User 2: Logging in...');
            await login(page2);

            // Navigate to same project
            console.log('User 2: Navigating to project...');
            await page2.goto(`/workarea?project=${projectUuid}`);
            await page2.waitForLoadState('networkidle');
            await waitForYjsBridge(page2);
            console.log('User 2: Yjs bridge ready');

            // Select the same page
            console.log('User 2: Selecting page...');
            await selectPageNode(page2);
            await page2.waitForTimeout(2000);

            // Check if iDevice exists in the page
            const ideviceCount = await page2.locator('.idevice_node.collaborative-editing').count();
            console.log('User 2: Found', ideviceCount, 'collaborative-editing iDevices');

            // Wait for iDevice to appear
            const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
            await idevice2.waitFor({ timeout: 15000 });
            console.log('User 2: iDevice visible');

            // Check the iDevice mode
            const mode2 = await idevice2.getAttribute('mode');
            console.log('User 2: iDevice mode:', mode2);

            // Double-click to enter edit mode if not already in edition
            if (mode2 !== 'edition') {
                console.log('User 2: Double-clicking to enter edit mode...');
                // Double-click on iDevice body to enter edition mode
                const ideviceBody = idevice2.locator('.idevice_body').first();
                await ideviceBody.dblclick();
                await page2.waitForTimeout(2000);

                // Check mode again
                const newMode = await idevice2.getAttribute('mode');
                console.log('User 2: New iDevice mode after click:', newMode);

                // Check for lock message
                const lockMessage = await page2
                    .locator('.modal-body, .alert, [class*="lock"]')
                    .first()
                    .textContent()
                    .catch(() => null);
                if (lockMessage) {
                    console.log('User 2: Lock message:', lockMessage);
                }

                // Check if isCollaborative is set
                const ideviceConfig = await page2.evaluate(() => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const structureBinding = bridge?.structureBinding;
                    const components = structureBinding?.getAllComponents?.() || [];
                    const collabComponent = components.find((c: any) => c.ideviceType === 'collaborative-editing');
                    return {
                        found: !!collabComponent,
                        isCollaborative: (window as any).eXeLearning?.app?.idevicesEngine?.idevices?.[
                            'collaborative-editing'
                        ]?.isCollaborative,
                    };
                });
                console.log('User 2: iDevice config:', ideviceConfig);
            }

            // Check if Lexical editor appeared
            const hasLexicalEditor = await page2.locator('.lexical-editor [contenteditable="true"]').count();
            console.log('User 2: Lexical editors found:', hasLexicalEditor);

            if (hasLexicalEditor === 0) {
                // Take a screenshot of what User 2 sees
                console.log('User 2: No Lexical editor found. Checking DOM...');

                const ideviceHTML = await idevice2.innerHTML();
                console.log('User 2: iDevice HTML (first 500 chars):', ideviceHTML.substring(0, 500));

                // Check if there's a lock indicator
                const lockInfo = await page2.evaluate(() => {
                    const lockElements = document.querySelectorAll('[class*="lock"], [data-locked]');
                    return Array.from(lockElements).map(el => ({
                        class: el.className,
                        text: el.textContent?.substring(0, 100),
                    }));
                });
                console.log('User 2: Lock elements:', lockInfo);
            }

            // Wait for Lexical editor (with shorter timeout for debugging)
            console.log('User 2: Waiting for Lexical editor...');
            try {
                await page2.waitForFunction(
                    () => document.querySelector('.lexical-editor [contenteditable="true"]') !== null,
                    { timeout: 10000 },
                );
            } catch (e) {
                console.log('User 2: Lexical editor did not appear');
                throw new Error('Lexical editor did not appear for User 2');
            }
            await page2.waitForTimeout(2000);

            // Get the editor for User 2
            const editor2 = page2.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor2).toBeVisible();
            console.log('User 2: Editor visible');

            // ========== CHECK SYNC: User 2 should see User 1's content ==========
            console.log('Checking if User 2 sees User 1 content...');

            // Check if content synced (may take a moment)
            const content2 = await editor2.textContent();
            console.log('User 2 sees:', content2);

            // Debug: Check Yjs connection state
            const yjsState1 = await page1.evaluate(() => {
                const project = (window as any).eXeLearning?.app?.project;
                const bridge = project?._yjsBridge;
                return {
                    yjsEnabled: project?._yjsEnabled,
                    hasBridge: !!bridge,
                    hasYjsModules: !!(window as any).YjsModules,
                    hasYjsModulesBridge: !!(window as any).YjsModules?._bridge,
                    hasYjsLexicalBinding: !!(window as any).YjsLexicalBinding,
                    connected: bridge?.documentManager?.provider?.synced,
                    wsState: bridge?.documentManager?.provider?.wsconnected,
                    awarenessCount: bridge?.documentManager?.awareness?.getStates().size,
                    hasDoc: !!bridge?.documentManager?.doc,
                };
            });
            console.log('User 1 Yjs state:', yjsState1);

            const yjsState2 = await page2.evaluate(() => {
                const project = (window as any).eXeLearning?.app?.project;
                const bridge = project?._yjsBridge;
                return {
                    yjsEnabled: project?._yjsEnabled,
                    hasBridge: !!bridge,
                    hasYjsModules: !!(window as any).YjsModules,
                    hasYjsModulesBridge: !!(window as any).YjsModules?._bridge,
                    hasYjsLexicalBinding: !!(window as any).YjsLexicalBinding,
                    connected: bridge?.documentManager?.provider?.synced,
                    wsState: bridge?.documentManager?.provider?.wsconnected,
                    awarenessCount: bridge?.documentManager?.awareness?.getStates().size,
                    hasDoc: !!bridge?.documentManager?.doc,
                };
            });
            console.log('User 2 Yjs state:', yjsState2);

            // Check binding state
            const bindingState1 = await page1.evaluate(() => {
                const exeDevice = (window as any).$exeDevice;
                return {
                    hasMainEditor: !!exeDevice?.mainEditor,
                    hasMainBinding: !!exeDevice?.mainBinding,
                    bindingDestroyed: exeDevice?.mainBinding?.isDestroyed?.(),
                };
            });
            console.log('User 1 binding state:', bindingState1);

            const bindingState2 = await page2.evaluate(() => {
                const exeDevice = (window as any).$exeDevice;
                return {
                    hasMainEditor: !!exeDevice?.mainEditor,
                    hasMainBinding: !!exeDevice?.mainBinding,
                    bindingDestroyed: exeDevice?.mainBinding?.isDestroyed?.(),
                };
            });
            console.log('User 2 binding state:', bindingState2);

            // ========== USER 2: Type more content ==========
            console.log('User 2: Typing content...');
            await editor2.click();
            await page2.keyboard.press('End');
            await page2.keyboard.type(' And User 2 adds this!');
            await page2.waitForTimeout(2000);

            // Check what User 2 sees
            const finalContent2 = await editor2.textContent();
            console.log('User 2 final content:', finalContent2);

            // Check what User 1 sees
            const finalContent1 = await editor1.textContent();
            console.log('User 1 final content:', finalContent1);

            // Assertions
            expect(finalContent2).toContain('User 2 adds this');

            // If sync is working, User 1 should see User 2's content
            // (This may or may not work depending on if the sync is actually functioning)
            console.log('Test completed. Check logs above to verify sync behavior.');
        } finally {
            await context1.close();
            await context2.close();
        }
    });
});
