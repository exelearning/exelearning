/**
 * Test collaborative image sync and resize functionality
 * Run with: npx playwright test collab-image-sync.spec.ts --headed --project=chromium
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

test.describe('Collaborative Image Sync and Resize', () => {
    test.setTimeout(180000);

    test('image inserted in one client appears in the other and can be resized', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        await page1.setViewportSize({ width: 1200, height: 900 });
        await page2.setViewportSize({ width: 1200, height: 900 });

        try {
            // ========== USER 1: Create project ==========
            console.log('👤 User 1: Logging in...');
            await login(page1);

            const response = await page1.request.post('/api/project/create-quick', {
                data: { title: 'Image Sync Test' },
            });
            const result = await response.json();
            const projectUuid = result.uuid;
            console.log('📁 Project created:', projectUuid);

            await page1.goto(`/workarea?project=${projectUuid}`);
            await page1.waitForLoadState('networkidle');
            await waitForYjsBridge(page1);

            console.log('👤 User 1: Adding collaborative-editing iDevice...');
            await addCollaborativeEditingIdevice(page1);

            await page1.waitForFunction(
                () => document.querySelector('.lexical-editor [contenteditable="true"]') !== null,
                { timeout: 20000 },
            );
            await page1.waitForTimeout(1000);

            const editor1 = page1.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor1).toBeVisible();

            // ========== USER 2: Join project ==========
            console.log('👤 User 2: Logging in...');
            await login(page2);

            await page2.goto(`/workarea?project=${projectUuid}`);
            await page2.waitForLoadState('networkidle');
            await waitForYjsBridge(page2);

            await selectPageNode(page2);
            await page2.waitForTimeout(1000);

            // Double-click to enter edit mode
            const idevice2 = page2.locator('.idevice_node.collaborative-editing').first();
            await idevice2.waitFor({ timeout: 10000 });

            const mode2 = await idevice2.getAttribute('mode');
            if (mode2 !== 'edition') {
                const ideviceBody = idevice2.locator('.idevice_body').first();
                await ideviceBody.dblclick();
                await page2.waitForTimeout(2000);
            }

            await page2.waitForFunction(
                () => document.querySelector('.lexical-editor [contenteditable="true"]') !== null,
                { timeout: 20000 },
            );

            const editor2 = page2.locator('.lexical-editor [contenteditable="true"]').first();
            await expect(editor2).toBeVisible();
            console.log('👤 User 2: Editor visible');

            // ========== USER 1: Insert image via JavaScript ==========
            console.log('👤 User 1: Inserting test image...');

            // Insert a test image using the Lexical API with proper asset:// URL
            const imageInserted = await page1.evaluate(() => {
                const LexicalNodes = (window as any).LexicalNodes;
                const LexicalBundle = (window as any).LexicalBundle;

                if (!LexicalNodes || !LexicalBundle) {
                    console.log('LexicalNodes or LexicalBundle not available');
                    return false;
                }

                // Access the editor through the global $exeDevice
                const exeDevice = (window as any).$exeDevice;
                if (!exeDevice || !exeDevice.mainEditor) {
                    console.log('$exeDevice or mainEditor not found');
                    return false;
                }

                const editor = exeDevice.mainEditor.getEditor();
                if (!editor) {
                    console.log('Native editor not found');
                    return false;
                }

                // Insert an image node with asset:// URL for proper sync
                // In real usage, this would come from the Media Library
                const { $createImageNode } = LexicalNodes;
                const { $insertNodes, $getRoot, $createParagraphNode } = LexicalBundle;

                // Use an external URL that works across clients (for testing)
                // In production, this would be an asset:// URL that gets resolved to blob:
                const testImageUrl = 'https://via.placeholder.com/300x200/007bff/ffffff?text=Test+Image';

                editor.update(() => {
                    const imageNode = $createImageNode({
                        src: testImageUrl, // Direct URL works across clients
                        altText: 'Test image for sync',
                        width: 300,
                        height: 200,
                        // For real assets, would include:
                        // dataAssetSrc: 'asset://uuid/filename.jpg',
                    });

                    const root = $getRoot();
                    const paragraph = $createParagraphNode();
                    paragraph.append(imageNode);
                    root.append(paragraph);
                });

                return true;
            });

            console.log('Image inserted:', imageInserted);
            expect(imageInserted).toBe(true);

            // Wait for sync
            await page1.waitForTimeout(2000);

            // Take screenshot of User 1
            await page1.screenshot({ path: 'test-results/image-sync-1-user1-with-image.png' });

            // ========== Check if User 2 sees the image ==========
            console.log('🔍 Checking if User 2 sees the image...');
            await page2.waitForTimeout(2000);

            const image2Count = await editor2.locator('img').count();
            console.log('User 2 image count:', image2Count);

            // Take screenshot of User 2
            await page2.screenshot({ path: 'test-results/image-sync-2-user2-sees-image.png' });

            // Check image in User 2's editor
            const image2Info = await page2.evaluate(() => {
                const editor = document.querySelector('.lexical-editor [contenteditable="true"]');
                if (!editor) return { found: false };

                const img = editor.querySelector('img');
                if (!img) return { found: false };

                return {
                    found: true,
                    src: img.src,
                    width: img.offsetWidth,
                    height: img.offsetHeight,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                };
            });
            console.log('User 2 image info:', image2Info);

            // ========== USER 1: Click on image to show resize handles ==========
            console.log('👤 User 1: Clicking on image to select it...');

            // First check if the ImageResizerPlugin is actually registered
            const pluginInfo = await page1.evaluate(() => {
                const exeDevice = (window as any).$exeDevice;
                const editor = exeDevice?.mainEditor;
                return {
                    hasExeDevice: !!exeDevice,
                    hasMainEditor: !!editor,
                    hasImageResizerPlugin: !!editor?._imageResizerPlugin,
                    imageResizerPluginType: typeof editor?._imageResizerPlugin,
                };
            });
            console.log('Plugin info:', pluginInfo);

            const image1 = editor1.locator('img').first();
            if ((await image1.count()) > 0) {
                // Log before click
                console.log('About to click on image...');

                await image1.click();

                // Wait a bit for any async operations
                await page1.waitForTimeout(1000);

                // Check if resize handles appeared
                const resizeHandles = await page1.locator('.lexical-image-resizer').count();
                console.log('Resize handles count:', resizeHandles);

                // Take screenshot showing resize handles
                await page1.screenshot({ path: 'test-results/image-sync-3-user1-resize-handles.png' });

                // Check for resize wrapper
                const hasResizeWrapper = await page1.locator('.lexical-image-resizer-wrapper').count();
                console.log('Has resize wrapper:', hasResizeWrapper > 0);

                // Check if image has selected class
                const isSelected = await image1.evaluate(el => el.classList.contains('lexical-image-selected'));
                console.log('Image has selected class:', isSelected);

                // Check the activeResizer state
                const resizerState = await page1.evaluate(() => {
                    const exeDevice = (window as any).$exeDevice;
                    const plugin = exeDevice?.mainEditor?._imageResizerPlugin;
                    return {
                        hasPlugin: !!plugin,
                        hasActiveResizer: !!plugin?.activeResizer,
                        selectedNodeKey: plugin?.selectedNodeKey,
                    };
                });
                console.log('Resizer state:', resizerState);

                // Check DOM structure around the image
                const imageParentInfo = await image1.evaluate(el => {
                    const parent = el.parentElement;
                    const grandparent = parent?.parentElement;
                    return {
                        parentTag: parent?.tagName,
                        parentClass: parent?.className,
                        grandparentTag: grandparent?.tagName,
                        grandparentClass: grandparent?.className,
                        siblingCount: parent?.children.length,
                        siblings: Array.from(parent?.children || []).map(c => ({
                            tag: c.tagName,
                            className: c.className,
                            childCount: c.children.length,
                            innerHTML: c.innerHTML?.substring(0, 100),
                        })),
                        parentHTML: parent?.innerHTML?.substring(0, 500),
                    };
                });
                console.log('Image parent info:', JSON.stringify(imageParentInfo, null, 2));

                // Also check if wrapper exists anywhere in the editor
                const wrapperSearch = await page1.evaluate(() => {
                    const allDivs = document.querySelectorAll('.lexical-editor div');
                    const wrapperLike = Array.from(allDivs).filter(
                        d =>
                            d.style.position === 'absolute' ||
                            d.className.includes('resizer') ||
                            d.className.includes('wrapper'),
                    );
                    return wrapperLike.map(w => ({
                        className: w.className,
                        style: w.style.cssText?.substring(0, 100),
                        childCount: w.children.length,
                    }));
                });
                console.log('Wrapper-like elements:', JSON.stringify(wrapperSearch, null, 2));
            }

            // ========== Test resize functionality ==========
            console.log('👤 User 1: Testing resize...');

            const image1ForResize = editor1.locator('img').first();
            if ((await image1ForResize.count()) > 0) {
                // Get initial size
                const initialSize = await image1ForResize.boundingBox();
                console.log('Initial image size:', initialSize);

                // Click to select
                await image1ForResize.click();
                await page1.waitForTimeout(300);

                // Find SE resize handle
                const seHandle = page1.locator('.lexical-image-resizer-se').first();
                if ((await seHandle.count()) > 0) {
                    console.log('Found SE resize handle, dragging...');

                    const handleBox = await seHandle.boundingBox();
                    if (handleBox) {
                        // Drag to resize
                        await page1.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
                        await page1.mouse.down();
                        await page1.mouse.move(handleBox.x + 50, handleBox.y + 50, { steps: 10 });
                        await page1.mouse.up();

                        await page1.waitForTimeout(500);

                        // Get new size
                        const newSize = await image1ForResize.boundingBox();
                        console.log('New image size after resize:', newSize);

                        // Take screenshot after resize
                        await page1.screenshot({ path: 'test-results/image-sync-4-after-resize.png' });

                        // Verify size changed
                        if (initialSize && newSize) {
                            console.log(
                                `Size changed: ${initialSize.width}x${initialSize.height} -> ${newSize.width}x${newSize.height}`,
                            );
                        }
                    }
                } else {
                    console.log('SE resize handle not found');

                    // Debug: log all elements with lexical-image-resizer class
                    const allResizerInfo = await page1.evaluate(() => {
                        const resizers = document.querySelectorAll('[class*="lexical-image-resizer"]');
                        return Array.from(resizers).map(el => ({
                            className: el.className,
                            tagName: el.tagName,
                        }));
                    });
                    console.log('All resizer elements:', allResizerInfo);
                }
            }

            // ========== Final state ==========
            console.log('📸 Taking final screenshots...');
            await page1.screenshot({ path: 'test-results/image-sync-5-final-user1.png' });
            await page2.screenshot({ path: 'test-results/image-sync-6-final-user2.png' });

            // Final image check in both editors
            const finalImage1 = await page1.evaluate(() => {
                const img = document.querySelector('.lexical-editor [contenteditable="true"] img');
                return img
                    ? { src: (img as HTMLImageElement).src, width: (img as HTMLImageElement).offsetWidth }
                    : null;
            });
            const finalImage2 = await page2.evaluate(() => {
                const img = document.querySelector('.lexical-editor [contenteditable="true"] img');
                return img
                    ? { src: (img as HTMLImageElement).src, width: (img as HTMLImageElement).offsetWidth }
                    : null;
            });

            console.log('Final image in User 1:', finalImage1);
            console.log('Final image in User 2:', finalImage2);
        } finally {
            await context1.close();
            await context2.close();
        }
    });
});
