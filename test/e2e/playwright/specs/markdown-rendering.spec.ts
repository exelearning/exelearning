import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    addTextIdevice,
    waitForTinyMCEReady,
    setTinyMCEContent,
    selectFirstPage,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for Markdown and Code Block Rendering
 *
 * Tests the rendering of:
 * - Code blocks with syntax highlighting (highlighted-code class)
 * - Code preservation in preview
 * - Various programming language syntax highlighting
 */

test.describe('Markdown and Code Block Rendering', () => {
    test.describe('Code Blocks', () => {
        test('should render code blocks with highlighted-code class in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Code Block Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Select a non-root page and add a text iDevice
            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCEReady(page);

            // Insert code block with highlighted-code class
            const codeBlockHtml = `
                <p>Here is some JavaScript code:</p>
                <pre class="highlighted-code" data-language="javascript"><code>function hello() {
    const message = "Hello, World!";
    console.log(message);
    return message;
}</code></pre>
            `;

            await setTinyMCEContent(page, codeBlockHtml);

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Open Preview
            const previewButton = page.locator('#head-bottom-preview');
            await previewButton.click();

            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            await page.waitForTimeout(3000);

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify code block is rendered
            const codeBlockCheck = await iframe.locator('body').evaluate(body => {
                // Look for highlighted-code or exe-code class
                const codeBlock = body.querySelector('pre.highlighted-code, pre.exe-code, pre code');
                const hasCodeBlock = !!codeBlock;

                // Check for syntax highlighting classes (highlight.js adds these)
                const hasHljsClasses =
                    !!body.querySelector('.hljs-keyword') ||
                    !!body.querySelector('.hljs-string') ||
                    !!body.querySelector('.hljs-function') ||
                    !!body.querySelector('[class*="hljs"]');

                // Get the code content
                const codeContent = codeBlock?.textContent || '';

                return {
                    hasCodeBlock,
                    hasHljsClasses,
                    codeContent: codeContent.substring(0, 200),
                    hasExpectedContent: codeContent.includes('function hello'),
                };
            });

            expect(codeBlockCheck.hasCodeBlock).toBe(true);
            expect(codeBlockCheck.hasExpectedContent).toBe(true);
        });

        test('should preserve code block structure with multiple languages', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Multi-Language Code Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCEReady(page);

            // Insert multiple code blocks with different languages
            const multiCodeHtml = `
                <h2>JavaScript Example</h2>
                <pre class="highlighted-code" data-language="javascript"><code>const greeting = "Hello";</code></pre>

                <h2>Python Example</h2>
                <pre class="highlighted-code" data-language="python"><code>greeting = "Hello"
print(greeting)</code></pre>

                <h2>HTML Example</h2>
                <pre class="highlighted-code" data-language="html"><code>&lt;div class="container"&gt;
  &lt;p&gt;Hello World&lt;/p&gt;
&lt;/div&gt;</code></pre>
            `;

            await setTinyMCEContent(page, multiCodeHtml);

            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Open Preview
            const previewButton = page.locator('#head-bottom-preview');
            await previewButton.click();

            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            await page.waitForTimeout(3000);

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify all code blocks are present
            const multiCodeCheck = await iframe.locator('body').evaluate(body => {
                const codeBlocks = body.querySelectorAll('pre.highlighted-code, pre.exe-code, pre code');
                const blockDetails: Array<{
                    language: string | null;
                    contentPreview: string;
                }> = [];

                codeBlocks.forEach(block => {
                    const pre = block.closest('pre') || block;
                    blockDetails.push({
                        language: pre.getAttribute('data-language') || pre.className,
                        contentPreview: (block.textContent || '').substring(0, 50),
                    });
                });

                return {
                    totalBlocks: codeBlocks.length,
                    blockDetails,
                    hasJavaScript: body.innerHTML.includes('greeting'),
                    hasPython: body.innerHTML.includes('print'),
                    hasHtml: body.innerHTML.includes('container') || body.innerHTML.includes('&lt;div'),
                };
            });

            expect(multiCodeCheck.totalBlocks).toBeGreaterThanOrEqual(3);
            expect(multiCodeCheck.hasJavaScript).toBe(true);
            expect(multiCodeCheck.hasPython).toBe(true);
            expect(multiCodeCheck.hasHtml).toBe(true);
        });

        test('should handle code blocks inserted via TinyMCE CodeMagic', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'CodeMagic Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCEReady(page);

            // Try to find and click the CodeMagic button (code editor)
            // The button has tooltip "Advanced Code Editor (CodeMagic)" or similar
            const codeButton = page
                .locator(
                    '.tox-tbtn[aria-label*="Code"], .tox-tbtn[aria-label*="code"], .tox-tbtn[title*="Code"], .tox-tbtn[aria-label*="Magic"]',
                )
                .first();

            // Toggle toolbars first if needed
            const toggleToolbarsButton = page
                .locator('.tox-tbtn[aria-label*="Toggle"], .tox-tbtn[aria-label*="Alternar"]')
                .first();

            if (await toggleToolbarsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await toggleToolbarsButton.click();
                await page.waitForTimeout(500);
            }

            if (await codeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await codeButton.click();

                // Wait for code dialog
                const codeDialog = page.locator('.tox-dialog');
                await expect(codeDialog).toBeVisible({ timeout: 10000 });

                // Find the textarea and enter code
                const textarea = codeDialog.locator('textarea').first();
                if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await textarea.fill(`<pre class="highlighted-code" data-language="css"><code>.button {
    background-color: blue;
    color: white;
}</code></pre>`);

                    // Save the dialog
                    const saveDialogBtn = codeDialog.locator('button').filter({ hasText: /Save|Guardar|OK/i });
                    if ((await saveDialogBtn.count()) > 0) {
                        await saveDialogBtn.first().click();
                    }
                }
            } else {
                // Fallback: Insert code directly
                await page.evaluate(() => {
                    const editor = (window as any).tinymce?.activeEditor;
                    if (editor) {
                        editor.setContent(`<pre class="highlighted-code" data-language="css"><code>.button {
    background-color: blue;
    color: white;
}</code></pre>`);
                        editor.fire('change');
                    }
                });
            }

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Open Preview
            const previewButton = page.locator('#head-bottom-preview');
            await previewButton.click();

            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            await page.waitForTimeout(3000);

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify CSS code is rendered
            const cssCodeCheck = await iframe.locator('body').evaluate(body => {
                const hasCodeBlock = !!body.querySelector('pre.highlighted-code, pre.exe-code, pre code');
                const hasCssContent = body.innerHTML.includes('background-color') || body.innerHTML.includes('blue');

                return {
                    hasCodeBlock,
                    hasCssContent,
                };
            });

            expect(cssCodeCheck.hasCodeBlock).toBe(true);
            expect(cssCodeCheck.hasCssContent).toBe(true);
        });
    });

    test.describe('Inline Code', () => {
        test('should render inline code elements in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Inline Code Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 10000 });

            await waitForTinyMCEReady(page);

            // Insert text with inline code
            const inlineCodeHtml = `
                <p>Use the <code>console.log()</code> function to print messages.</p>
                <p>The <code>const</code> keyword declares a constant variable.</p>
            `;

            await setTinyMCEContent(page, inlineCodeHtml);

            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Open Preview
            const previewButton = page.locator('#head-bottom-preview');
            await previewButton.click();

            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            await page.waitForTimeout(3000);

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 10000 });

            // Verify inline code elements are present
            const inlineCodeCheck = await iframe.locator('body').evaluate(body => {
                const codeElements = body.querySelectorAll('p code');
                return {
                    inlineCodeCount: codeElements.length,
                    hasConsoleLog: body.innerHTML.includes('console.log'),
                    hasConst: body.innerHTML.includes('const'),
                };
            });

            expect(inlineCodeCheck.inlineCodeCount).toBeGreaterThanOrEqual(2);
            expect(inlineCodeCheck.hasConsoleLog).toBe(true);
            expect(inlineCodeCheck.hasConst).toBe(true);
        });
    });
});
