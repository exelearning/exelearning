/**
 * Visual debug test for collaborative editing
 * Run with: npx playwright test collab-visual-debug.spec.ts --headed --project=chromium
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

    const collabIdevice = page.locator('.idevice_item[id="collaborative-editing"]').first();
    await collabIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await collabIdevice.click();

    await page.locator('#node-content article .idevice_node.collaborative-editing').first().waitFor({ timeout: 15000 });
}

test.describe('Collaborative Editing - Visual Debug', () => {
    test.setTimeout(180000); // 3 minutes

    test('visually debug two users editing simultaneously', async ({ browser }) => {
        // Create two browser contexts
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Set viewport to fit side by side
        await page1.setViewportSize({ width: 1200, height: 900 });
        await page2.setViewportSize({ width: 1200, height: 900 });

        // Capture console logs for debugging
        page1.on('console', msg => {
            const text = msg.text();
            if (text.includes('[YjsLexicalBinding]')) {
                console.log('🔵 Page1:', text);
            }
        });
        page2.on('console', msg => {
            const text = msg.text();
            if (text.includes('[YjsLexicalBinding]')) {
                console.log('🟢 Page2:', text);
            }
        });

        try {
            // ========== USER 1: Create project ==========
            console.log('👤 User 1: Logging in...');
            await login(page1);

            const response = await page1.request.post('/api/project/create-quick', {
                data: { title: 'Collab Visual Debug Test' },
            });
            const result = await response.json();
            const projectUuid = result.uuid;
            console.log('📁 Project created:', projectUuid);

            await page1.goto(`/workarea?project=${projectUuid}`);
            await page1.waitForLoadState('networkidle');
            await waitForYjsBridge(page1);

            console.log('👤 User 1: Adding collaborative-editing iDevice...');
            await addCollaborativeEditingIdevice(page1);

            // Wait for Lexical editor
            await page1.waitForFunction(
                () => document.querySelector('.lexical-editor [contenteditable="true"]') !== null,
                { timeout: 20000 },
            );
            await page1.waitForTimeout(1000);

            const editor1 = page1.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor1).toBeVisible();

            // Take screenshot
            await page1.screenshot({ path: 'test-results/collab-debug-1-user1-ready.png' });
            console.log('📸 Screenshot: User 1 ready');

            // ========== USER 2: Join project ==========
            console.log('👤 User 2: Logging in...');
            await login(page2);

            console.log('👤 User 2: Navigating to same project...');
            await page2.goto(`/workarea?project=${projectUuid}`);
            await page2.waitForLoadState('networkidle');
            await waitForYjsBridge(page2);

            // Select page
            await selectPageNode(page2);
            await page2.waitForTimeout(1000);

            // Take screenshot of User 2 seeing the iDevice
            await page2.screenshot({ path: 'test-results/collab-debug-2-user2-sees-idevice.png' });
            console.log('📸 Screenshot: User 2 sees iDevice');

            // Double-click to enter edit mode
            const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
            await idevice2.waitFor({ timeout: 10000 });

            const mode2 = await idevice2.getAttribute('mode');
            console.log('👤 User 2: iDevice mode:', mode2);

            if (mode2 !== 'edition') {
                console.log('👤 User 2: Double-clicking to enter edit mode...');
                const ideviceBody = idevice2.locator('.idevice_body').first();
                await ideviceBody.dblclick();
                await page2.waitForTimeout(2000);
            }

            // Wait for Lexical editor in page2
            await page2.waitForFunction(
                () => document.querySelector('.lexical-editor [contenteditable="true"]') !== null,
                { timeout: 20000 },
            );

            const editor2 = page2.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor2).toBeVisible();

            // Take screenshot of both ready
            await page2.screenshot({ path: 'test-results/collab-debug-3-user2-in-edit-mode.png' });
            console.log('📸 Screenshot: User 2 in edit mode');

            // ========== USER 1: Type slowly and observe ==========
            console.log('👤 User 1: Starting to type slowly...');
            await editor1.click();
            await page1.waitForTimeout(500);

            // Type character by character with pauses
            const textToType = 'Hello';
            for (const char of textToType) {
                await page1.keyboard.type(char, { delay: 300 });
                await page1.waitForTimeout(200);

                // Check what User 2 sees
                const content2 = await editor2.textContent();
                console.log(`  User 1 typed '${char}' -> User 2 sees: "${content2}"`);
            }

            // Take screenshot after typing
            await page1.screenshot({ path: 'test-results/collab-debug-4-user1-typed-hello.png' });
            await page2.screenshot({ path: 'test-results/collab-debug-5-user2-sees-hello.png' });
            console.log('📸 Screenshots: After typing "Hello"');

            // Check content in both editors
            const content1 = await editor1.textContent();
            const content2 = await editor2.textContent();
            console.log('📝 User 1 content:', JSON.stringify(content1));
            console.log('📝 User 2 content:', JSON.stringify(content2));

            // ========== Check for cursor/presence indicators ==========
            console.log('🔍 Checking for collaboration indicators...');

            // Look for remote cursor elements
            const cursorSelectors = [
                '.yjs-cursor',
                '.collaboration-cursor',
                '.remote-cursor',
                '[data-lexical-cursor]',
                '.lexical-collaboration-cursor',
            ];

            for (const selector of cursorSelectors) {
                const count1 = await page1.locator(selector).count();
                const count2 = await page2.locator(selector).count();
                if (count1 > 0 || count2 > 0) {
                    console.log(`  Found ${selector}: User1=${count1}, User2=${count2}`);
                }
            }

            // Check awareness states (full state with cursor positions)
            const awarenessInfo = await page1.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const awareness = bridge?.documentManager?.wsProvider?.awareness;
                if (!awareness) return { error: 'No awareness' };

                const states: any[] = [];
                awareness.getStates().forEach((state: any, clientId: number) => {
                    states.push({
                        clientId,
                        user: state.user,
                        focusing: state.focusing,
                        hasAnchorPos: !!state.anchorPos,
                        hasFocusPos: !!state.focusPos,
                        name: state.name,
                        color: state.color,
                    });
                });
                return { clientId: awareness.clientID, states };
            });
            console.log('🔗 User 1 awareness:', JSON.stringify(awarenessInfo, null, 2));

            const awarenessInfo2 = await page2.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const awareness = bridge?.documentManager?.wsProvider?.awareness;
                if (!awareness) return { error: 'No awareness' };

                const states: any[] = [];
                awareness.getStates().forEach((state: any, clientId: number) => {
                    states.push({
                        clientId,
                        user: state.user,
                        focusing: state.focusing,
                        hasAnchorPos: !!state.anchorPos,
                        hasFocusPos: !!state.focusPos,
                        name: state.name,
                        color: state.color,
                    });
                });
                return { clientId: awareness.clientID, states };
            });
            console.log('🔗 User 2 awareness:', JSON.stringify(awarenessInfo2, null, 2));

            // Check for cursor container and cursor elements
            const cursorInfo1 = await page1.evaluate(() => {
                const container = document.querySelector('.lexical-cursors-container');
                const cursors = container?.children || [];
                return {
                    hasContainer: !!container,
                    cursorCount: cursors.length,
                    containerHTML: container?.innerHTML?.substring(0, 200) || '',
                };
            });
            console.log('🎯 User 1 cursor info:', JSON.stringify(cursorInfo1));

            const cursorInfo2 = await page2.evaluate(() => {
                const container = document.querySelector('.lexical-cursors-container');
                const cursors = container?.children || [];
                return {
                    hasContainer: !!container,
                    cursorCount: cursors.length,
                    containerHTML: container?.innerHTML?.substring(0, 200) || '',
                };
            });
            console.log('🎯 User 2 cursor info:', JSON.stringify(cursorInfo2));

            // ========== USER 2: Type and observe ==========
            console.log('👤 User 2: Now typing...');
            await editor2.click();
            await page2.keyboard.press('End');
            await page2.waitForTimeout(300);

            const text2ToType = ' World';
            for (const char of text2ToType) {
                await page2.keyboard.type(char, { delay: 300 });
                await page2.waitForTimeout(200);

                const c1 = await editor1.textContent();
                console.log(`  User 2 typed '${char}' -> User 1 sees: "${c1}"`);
            }

            // Final screenshots
            await page1.screenshot({ path: 'test-results/collab-debug-6-final-user1.png' });
            await page2.screenshot({ path: 'test-results/collab-debug-7-final-user2.png' });
            console.log('📸 Screenshots: Final state');

            // Check cursor info after both users have typed
            const finalCursorInfo1 = await page1.evaluate(() => {
                const container = document.querySelector('.lexical-cursors-container');
                const cursors = container?.children || [];
                return {
                    hasContainer: !!container,
                    cursorCount: cursors.length,
                    containerHTML: container?.innerHTML?.substring(0, 300) || '',
                };
            });
            console.log('🎯 Final User 1 cursor info:', JSON.stringify(finalCursorInfo1));

            const finalCursorInfo2 = await page2.evaluate(() => {
                const container = document.querySelector('.lexical-cursors-container');
                const cursors = container?.children || [];
                return {
                    hasContainer: !!container,
                    cursorCount: cursors.length,
                    containerHTML: container?.innerHTML?.substring(0, 300) || '',
                };
            });
            console.log('🎯 Final User 2 cursor info:', JSON.stringify(finalCursorInfo2));

            // Final content check
            const finalContent1 = await editor1.textContent();
            const finalContent2 = await editor2.textContent();
            console.log('📝 Final User 1 content:', JSON.stringify(finalContent1));
            console.log('📝 Final User 2 content:', JSON.stringify(finalContent2));

            // Check for duplication
            if (finalContent1 !== finalContent2) {
                console.log('⚠️  WARNING: Content mismatch between users!');
            }
            if (finalContent1?.includes('HelloHello') || finalContent2?.includes('HelloHello')) {
                console.log('⚠️  WARNING: Content duplication detected!');
            }

            // Wait a bit to observe
            console.log('⏳ Waiting 3 seconds for observation...');
            await page1.waitForTimeout(3000);
        } finally {
            await context1.close();
            await context2.close();
        }
    });
});
