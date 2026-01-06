import { test } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

async function selectPageNode(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                break;
            } catch {
                // Try next selector
            }
        }
    }

    await page.waitForTimeout(1000);
}

async function addCollaborativeEditingIdevice(page: Page): Promise<void> {
    await selectPageNode(page);

    // Expand "Information and presentation" category
    const infoCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
        })
        .first();

    if ((await infoCategory.count()) > 0) {
        const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            const label = infoCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Find and click the collaborative-editing iDevice
    const collabIdevice = page.locator('.idevice_item[id="collaborative-editing"]').first();
    await collabIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await collabIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.collaborative-editing').first().waitFor({ timeout: 15000 });
}

test('Debug: Screenshot ProseMirror toolbar', async ({ authenticatedPage, createProject }) => {
    const page = authenticatedPage;

    const projectUuid = await createProject(page, 'Debug Toolbar');
    await page.goto(`/workarea?project=${projectUuid}`);
    await page.waitForLoadState('networkidle');

    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            return app?.project?._yjsBridge !== undefined;
        },
        { timeout: 30000 },
    );

    // Wait for loading screen
    await page.waitForFunction(
        () => {
            const loadScreen = document.querySelector('#load-screen-main');
            return !loadScreen || loadScreen.getAttribute('data-visible') === 'false';
        },
        { timeout: 15000 },
    );

    // Add iDevice
    await addCollaborativeEditingIdevice(page);

    // Wait for ProseMirror editor
    await page.waitForFunction(
        () => {
            const editor = document.querySelector('.prosemirror-editor .ProseMirror');
            return editor && editor.getAttribute('contenteditable') === 'true';
        },
        { timeout: 20000 },
    );

    // Wait a bit for toolbar to fully render
    await page.waitForTimeout(2000);

    // Take screenshot of the iDevice area
    const idevice = page.locator('.idevice_node.collaborative-editing').first();
    await idevice.screenshot({ path: 'test-results/prosemirror-toolbar-debug.png' });

    // Also take full page screenshot
    await page.screenshot({ path: 'test-results/prosemirror-fullpage-debug.png', fullPage: true });

    console.log('Screenshots saved to test-results/prosemirror-toolbar-debug.png');
});
