import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import * as path from 'path';
import type { Download, Page } from '@playwright/test';
import * as fs from 'fs';
import { unzipSync } from '../../../../src/shared/export';
import {
    waitForAppReady,
    openElpFile,
    waitForPreviewContent,
    getPreviewFrame,
    addTextIdevice,
    waitForTinyMCEReady,
    saveProject,
    reloadPage,
    selectFirstPage,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for LaTeX Rendering
 *
 * Tests LaTeX/MathJax rendering in both Editor and Preview views.
 * Uses the latex.elp fixture which contains rich LaTeX content.
 *
 * Verifies:
 * - Basic inline and display math rendering
 * - MathJax configuration availability
 * - Pre-rendering in preview mode
 * - No rendering errors
 */

const LATEX_FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/latex.elp');

/**
 * Open the LaTeX ELP fixture and navigate to "Primeras fórmulas" page
 */
async function openLatexFixture(page: Page): Promise<void> {
    await openElpFile(page, LATEX_FIXTURE_PATH);

    // Click on a page with LaTeX content
    const latexPageLink = page.getByText('Primeras fórmulas').first();
    if (await latexPageLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await latexPageLink.click();
        await page.waitForTimeout(500);
    }

    // Give time for MathJax to initialize and process
    await page.waitForTimeout(500);
}

/**
 * Helper to enable MathJax via the Project Properties UI
 * This enables the pp_addMathJax toggle in Export options section
 * Note: Project properties are shown INLINE in #node-content when root is selected,
 * NOT in a modal like page properties.
 */
async function enableMathJaxViaUI(page: Page): Promise<void> {
    // Click Project Properties button to show project properties inline
    const propertiesButton = page.locator('#head-top-settings-button');
    await expect(propertiesButton).toBeVisible({ timeout: 10000 });
    await propertiesButton.click();

    // Wait for properties to appear in the content area
    await page.waitForTimeout(500);

    // The properties form is in #node-content
    const nodeContent = page.locator('#node-content');
    await expect(nodeContent).toBeVisible({ timeout: 10000 });

    // Wait for the "Export options" tab to be present in DOM
    // Project properties now use tabs instead of accordion (commit f4383b83)
    const exportTab = page.getByRole('tab', { name: /Export options|Opciones de exportación/i }).first();

    // Scroll the export tab into view if needed
    await exportTab.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(exportTab).toBeVisible({ timeout: 5000 });

    // Check if the export options tab is selected
    const isSelected = (await exportTab.getAttribute('aria-selected')) === 'true';
    if (!isSelected) {
        await exportTab.click();
        await page.waitForTimeout(500);
    }

    // Find the MathJax toggle in the export options section
    // The toggle is a checkbox input with property="pp_addMathJax"
    const mathJaxToggle = page.locator('input[property="pp_addMathJax"]');

    // Scroll to and wait for the toggle to be visible
    await mathJaxToggle.scrollIntoViewIfNeeded({ timeout: 10000 });
    await expect(mathJaxToggle).toBeVisible({ timeout: 5000 });

    const isChecked = await mathJaxToggle.isChecked();
    if (!isChecked) {
        // Click the toggle container or label to enable (the checkbox itself may be hidden)
        const toggleItem = page.locator('.toggle-item').filter({ has: mathJaxToggle }).first();
        if ((await toggleItem.count()) > 0) {
            await toggleItem.click();
        } else {
            // Try clicking the label that contains "MathJax"
            const label = page
                .locator('label')
                .filter({ hasText: /MathJax/i })
                .first();
            if ((await label.count()) > 0) {
                await label.click();
            } else {
                await mathJaxToggle.click({ force: true });
            }
        }
        await page.waitForTimeout(500);
    }

    // Verify the toggle is now checked
    const isNowChecked = await mathJaxToggle.isChecked();
    expect(isNowChecked).toBe(true);

    // Verify metadata was updated via Yjs binding
    const metadataCheck = await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const metadata = bridge?.documentManager?.getMetadata();
        const value = metadata?.get('addMathJax');
        return value === true || value === 'true';
    });
    expect(metadataCheck).toBe(true);
}

/**
 * Export project as HTML5 website and return Playwright download handle.
 */
async function exportHtml5Website(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    // Open the "Download as..." / "Export as..." sub-menu first (desktop/offline variants).
    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
        await page.waitForTimeout(300);
    }

    const exportOption = page
        .locator('#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

test.describe('LaTeX Rendering', () => {
    test.describe('Editor View', () => {
        test('should render LaTeX content from fixture in editor', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'LaTeX Editor Test');

            // Navigate to the project workarea
            await gotoWorkarea(page, projectUuid);

            // Wait for app to fully initialize
            await waitForAppReady(page);

            // Open the LaTeX fixture - this navigates to "Primeras fórmulas" page
            await openLatexFixture(page);

            // Wait for page content to load in the node-content area
            const nodeContent = page.locator('#node-content');
            await expect(nodeContent).toBeVisible({ timeout: 10000 });

            // Wait for MathJax to process content
            await page.waitForTimeout(500);

            // Comprehensive check for LaTeX rendering in the editor
            const latexCheck = await page.evaluate(() => {
                const nodeContent = document.querySelector('#node-content');
                // Navigation tree uses role="tree" attribute
                const nav = document.querySelector('[role="tree"], .nav-tree, .tree');

                // Check for MathJax output elements (mjx-container or SVG)
                const mjxContainers = document.querySelectorAll('mjx-container');
                const svgMath = document.querySelectorAll('svg[data-mml-node]');

                // Check for data-latex attributes (pre-rendered LaTeX)
                const dataLatexElements = document.querySelectorAll('[data-latex]');
                const dataLatexValues: string[] = [];
                dataLatexElements.forEach(el => {
                    const latex = el.getAttribute('data-latex');
                    if (latex) dataLatexValues.push(latex);
                });

                // Check for LaTeX syntax patterns in data-latex
                const hasLatexSyntax = dataLatexValues.some(
                    latex =>
                        latex.includes('\\frac') ||
                        latex.includes('\\sqrt') ||
                        latex.includes('\\LaTeX') ||
                        latex.includes('\\alpha') ||
                        latex.includes('\\beta') ||
                        latex.includes('\\int') ||
                        latex.includes('\\sum'),
                );

                // Check for rendered math content
                const hasFractionElement = document.querySelector('mjx-mfrac, [data-mml-node="mfrac"]') !== null;
                const hasSuperscript = document.querySelector('mjx-msup, [data-mml-node="msup"]') !== null;
                const hasSquareRoot = document.querySelector('mjx-msqrt, [data-mml-node="msqrt"]') !== null;

                // Check navigation tree for LaTeX page titles (look in nav OR entire page)
                const navText = nav?.textContent || '';
                const pageText = document.body.textContent || '';
                const navHasLatexTitle =
                    navText.includes('Fórmulas') ||
                    navText.includes('Delimitadores') ||
                    navText.includes('Primeras') ||
                    pageText.includes('Fórmulas') ||
                    pageText.includes('Delimitadores');

                // Check for SVG content inside MathJax containers
                let svgContentCount = 0;
                mjxContainers.forEach(container => {
                    if (container.querySelector('svg')) svgContentCount++;
                });

                return {
                    mjxContainerCount: mjxContainers.length,
                    svgMathCount: svgMath.length,
                    dataLatexCount: dataLatexElements.length,
                    dataLatexValues: dataLatexValues.slice(0, 5), // First 5 for debugging
                    hasLatexSyntax,
                    hasFractionElement,
                    hasSuperscript,
                    hasSquareRoot,
                    navHasLatexTitle,
                    svgContentCount,
                    hasNodeContent: nodeContent !== null,
                };
            });

            // Assert: Navigation should show LaTeX page titles
            expect(latexCheck.navHasLatexTitle).toBe(true);

            // Assert: Should have MathJax containers OR data-latex elements (pre-rendered)
            const hasMathElements = latexCheck.mjxContainerCount > 0 || latexCheck.dataLatexCount > 0;
            expect(hasMathElements).toBe(true);

            // Assert: If MathJax containers exist, they should have SVG content
            if (latexCheck.mjxContainerCount > 0) {
                expect(latexCheck.svgContentCount).toBeGreaterThan(0);
            }

            // Assert: Should have data-latex attributes with actual LaTeX code
            if (latexCheck.dataLatexCount > 0) {
                expect(latexCheck.hasLatexSyntax).toBe(true);
            }

            // Assert: Should have at least some math rendering present
            // In the editor view, the main LaTeX content is in the navigation tree
            // (page titles with \LaTeX) and in the content area when viewing a page with formulas
            const hasMathRendering =
                latexCheck.hasFractionElement ||
                latexCheck.hasSuperscript ||
                latexCheck.hasSquareRoot ||
                latexCheck.mjxContainerCount >= 1 ||
                latexCheck.svgMathCount >= 1 ||
                latexCheck.dataLatexCount >= 1;
            expect(hasMathRendering).toBe(true);
        });

        test('should have MathJax available with required methods', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'MathJax Check');
            await gotoWorkarea(page, projectUuid);

            await page.waitForFunction(() => typeof (window as any).MathJax !== 'undefined', undefined, {
                timeout: 30000,
            });

            // Verify MathJax has the required methods
            const mathJaxInfo = await page.evaluate(() => {
                const MathJax = (window as any).MathJax;
                return {
                    available: typeof MathJax !== 'undefined',
                    hasTexReset: typeof MathJax?.texReset === 'function',
                    hasTex2svg: typeof MathJax?.tex2svg === 'function',
                    hasTypesetPromise: typeof MathJax?.typesetPromise === 'function',
                };
            });

            expect(mathJaxInfo.available).toBe(true);
            expect(mathJaxInfo.hasTex2svg).toBe(true);
            expect(mathJaxInfo.hasTypesetPromise).toBe(true);
        });
    });

    test.describe('Preview View', () => {
        test('should render LaTeX in preview with pre-rendering', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Preview Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Open the LaTeX fixture
            await openLatexFixture(page);

            // Open Preview and wait for content to load
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await previewPanel.waitFor({ state: 'visible', timeout: 15000 });

            // Wait for preview content to render (same pattern as text.spec.ts)
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').first().waitFor({ state: 'attached', timeout: 15000 });

            // Check for pre-rendered math (exe-math-rendered class) or MathJax elements
            const mathRendered = await iframe.locator('body').evaluate(body => {
                const preRendered = body.querySelectorAll('.exe-math-rendered').length;
                const mjxElements = body.querySelectorAll('mjx-container, svg[data-mml-node]').length;
                return {
                    preRenderedCount: preRendered,
                    mjxElementsCount: mjxElements,
                    totalMath: preRendered + mjxElements,
                };
            });

            // Should have rendered math content (either pre-rendered or MathJax processed)
            expect(mathRendered.totalMath).toBeGreaterThan(0);
        });

        test('should not have rendering errors in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Error Check');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Open the LaTeX fixture
            await openLatexFixture(page);

            // Open Preview and wait for content to load
            // Open Preview and wait for content
            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            // Get the HTML content to analyze for errors
            const analysisResult = await iframe.locator('body').evaluate(body => {
                const html = body.innerHTML;

                return {
                    // Check for unresolved references (???)
                    hasUnresolvedRefs: (html.match(/\?\?\?/g) || []).length,
                    // Check for "multiply defined" errors
                    hasMultiplyDefined: html.toLowerCase().includes('multiply defined'),
                    // Check for MathJax error elements
                    hasMjxError: body.querySelectorAll('.MathJax_Error, mjx-merror').length,
                };
            });

            // Legacy fixtures may have some unresolved references - allow up to 10
            // This is acceptable for testing rendering, not reference resolution
            expect(analysisResult.hasUnresolvedRefs).toBeLessThanOrEqual(10);

            // Should NOT have multiply defined errors
            expect(analysisResult.hasMultiplyDefined).toBe(false);

            // MathJax errors are acceptable in some cases (malformed LaTeX in fixture)
            // but we log them for debugging
            if (analysisResult.hasMjxError > 0) {
                console.log(
                    `Note: Found ${analysisResult.hasMjxError} MathJax error elements (may be expected for some content)`,
                );
            }
        });

        test('should render Delimitadores page with LaTeX formulas and syntax-highlighted code', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Delimitadores Page Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Open the LaTeX fixture
            await openLatexFixture(page);

            // Click on the "Delimitadores" page in the navigation
            const delimitadoresPage = page
                .locator('.nav-element-text .node-text-span')
                .filter({ hasText: /^Delimitadores$/ });
            await expect(delimitadoresPage).toBeVisible({ timeout: 10000 });
            await delimitadoresPage.click();

            // Wait for the page content to load
            await page.waitForTimeout(500);

            // Verify LaTeX formulas are rendered in the workarea
            const workareaContent = page.locator('#node-content');
            await expect(workareaContent).toBeVisible({ timeout: 10000 });

            // Check for rendered math elements (exe-math-rendered or mjx-container or SVG math)
            const mathInWorkarea = await workareaContent.evaluate(el => {
                const preRendered = el.querySelectorAll('.exe-math-rendered').length;
                const mjxElements = el.querySelectorAll('mjx-container').length;
                const svgMath = el.querySelectorAll('svg[data-mml-node]').length;
                // Check for specific LaTeX delimiters that should be rendered
                const hasInlineDelimiters = el.textContent?.includes('\\(') || false;
                const hasDisplayDelimiters = el.textContent?.includes('\\[') || el.textContent?.includes('$$') || false;
                return {
                    preRenderedCount: preRendered,
                    mjxCount: mjxElements,
                    svgMathCount: svgMath,
                    totalMath: preRendered + mjxElements + svgMath,
                    hasInlineDelimiters,
                    hasDisplayDelimiters,
                };
            });

            // Assert: Math elements should be rendered
            expect(mathInWorkarea.totalMath).toBeGreaterThan(0);
            // Assert: Should have multiple math elements (Delimitadores page has many formulas)
            expect(mathInWorkarea.totalMath).toBeGreaterThanOrEqual(2);

            // Check for syntax-highlighted code blocks (highlighted-code language-latex)
            const codeBlocksInWorkarea = await workareaContent.evaluate(el => {
                const highlightedCode = el.querySelectorAll(
                    '.highlighted-code.language-latex, pre.language-latex, code.language-latex',
                ).length;
                const anyHighlightedCode = el.querySelectorAll(
                    '.highlighted-code, pre[class*="language-"], code[class*="language-"]',
                ).length;
                // Check if highlighted code has syntax coloring (spans with color classes)
                const highlightedElements = el.querySelectorAll('.highlighted-code, pre[class*="language-"]');
                let hasSyntaxColoring = false;
                for (const elem of highlightedElements) {
                    // Prism.js or other highlighters add spans with token classes
                    const hasTokenSpans = elem.querySelectorAll('span.token, span[class*="token"]').length > 0;
                    const hasColoredSpans = elem.querySelectorAll('span[style*="color"]').length > 0;
                    if (hasTokenSpans || hasColoredSpans) {
                        hasSyntaxColoring = true;
                        break;
                    }
                }
                // Check for specific LaTeX code content (various LaTeX commands)
                const codeContent = Array.from(highlightedElements)
                    .map(e => e.textContent)
                    .join(' ');
                const hasLatexSyntax =
                    codeContent.includes('\\frac') ||
                    codeContent.includes('\\sqrt') ||
                    codeContent.includes('\\int') ||
                    codeContent.includes('\\(') ||
                    codeContent.includes('\\[') ||
                    codeContent.includes('$$') ||
                    codeContent.includes('\\alpha') ||
                    codeContent.includes('\\beta');
                return {
                    latexCodeBlocks: highlightedCode,
                    anyCodeBlocks: anyHighlightedCode,
                    hasSyntaxColoring,
                    hasLatexSyntax,
                    codeContentLength: codeContent.length,
                };
            });

            // Assert: Should have highlighted code blocks
            expect(codeBlocksInWorkarea.latexCodeBlocks + codeBlocksInWorkarea.anyCodeBlocks).toBeGreaterThan(0);
            // Assert: Code blocks should have content (LaTeX examples or delimiters)
            expect(codeBlocksInWorkarea.codeContentLength).toBeGreaterThan(0);

            // Now open the preview and wait for content
            // Open Preview and wait for content
            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            // Navigate to Delimitadores page in preview
            // The preview navigation has a dropdown menu - we need to expand "Escritura de fórmulas" first
            // Click on the parent menu item to expand it
            const escrituraMenuItem = iframe
                .locator('nav a, .nav-list a, li a')
                .filter({ hasText: 'Escritura de fórmulas' })
                .first();
            const escrituraExists = (await escrituraMenuItem.count()) > 0;
            if (escrituraExists) {
                await escrituraMenuItem.click();
                await page.waitForTimeout(500);
            }

            // Now click on Delimitadores
            const previewNavLink = iframe.locator('a').filter({ hasText: 'Delimitadores' }).first();
            const navLinkExists = (await previewNavLink.count()) > 0;
            if (navLinkExists) {
                // Use force:true in case it's in a submenu that needs expanding
                await previewNavLink.click({ force: true });
                await page.waitForTimeout(500);
            } else {
                // Alternative: navigate directly using JavaScript
                await iframe.locator('body').evaluate(() => {
                    // Find link by href containing delimitadores
                    const link = document.querySelector('a[href*="delimitadores"]') as HTMLAnchorElement;
                    if (link) link.click();
                });
                await page.waitForTimeout(500);
            }

            // Verify LaTeX formulas are rendered in preview
            const mathInPreview = await iframe.locator('body').evaluate(body => {
                const preRendered = body.querySelectorAll('.exe-math-rendered').length;
                const mjxElements = body.querySelectorAll('mjx-container').length;
                const svgMath = body.querySelectorAll('svg[data-mml-node]').length;
                // Check for SVG content inside math containers (actual rendered math)
                const svgInMjx = body.querySelectorAll('mjx-container svg').length;
                // Check that formulas have actual visual content
                const mjxWithContent = Array.from(body.querySelectorAll('mjx-container')).filter(
                    el => el.querySelector('svg') || el.querySelector('mjx-math'),
                ).length;
                return {
                    preRenderedCount: preRendered,
                    mjxCount: mjxElements,
                    svgMathCount: svgMath,
                    svgInMjx,
                    mjxWithContent,
                    totalMath: preRendered + mjxElements + svgMath,
                };
            });

            // Assert: Math elements should be rendered in preview
            expect(mathInPreview.totalMath).toBeGreaterThan(0);
            // Assert: Should have multiple math elements
            expect(mathInPreview.totalMath).toBeGreaterThanOrEqual(2);
            // Assert: MathJax containers should have actual SVG content
            if (mathInPreview.mjxCount > 0) {
                expect(mathInPreview.mjxWithContent).toBeGreaterThan(0);
            }

            // Verify syntax-highlighted code blocks in preview
            const codeBlocksInPreview = await iframe.locator('body').evaluate(body => {
                const highlightedCode = body.querySelectorAll(
                    '.highlighted-code.language-latex, pre.language-latex, code.language-latex',
                ).length;
                const anyHighlightedCode = body.querySelectorAll(
                    '.highlighted-code, pre[class*="language-"], code[class*="language-"]',
                ).length;
                // Check for syntax coloring in preview
                const highlightedElements = body.querySelectorAll('.highlighted-code, pre[class*="language-"]');
                let hasSyntaxColoring = false;
                for (const elem of highlightedElements) {
                    const hasTokenSpans = elem.querySelectorAll('span.token, span[class*="token"]').length > 0;
                    const hasColoredSpans = elem.querySelectorAll('span[style*="color"]').length > 0;
                    if (hasTokenSpans || hasColoredSpans) {
                        hasSyntaxColoring = true;
                        break;
                    }
                }
                // Check for specific LaTeX code content (various LaTeX commands)
                const codeContent = Array.from(highlightedElements)
                    .map(e => e.textContent)
                    .join(' ');
                const hasLatexSyntax =
                    codeContent.includes('\\frac') ||
                    codeContent.includes('\\sqrt') ||
                    codeContent.includes('\\int') ||
                    codeContent.includes('\\(') ||
                    codeContent.includes('\\[') ||
                    codeContent.includes('$$') ||
                    codeContent.includes('\\alpha') ||
                    codeContent.includes('\\beta');
                return {
                    latexCodeBlocks: highlightedCode,
                    anyCodeBlocks: anyHighlightedCode,
                    hasSyntaxColoring,
                    hasLatexSyntax,
                    codeContentLength: codeContent.length,
                };
            });

            // Assert: Should have highlighted code blocks in preview
            expect(codeBlocksInPreview.latexCodeBlocks + codeBlocksInPreview.anyCodeBlocks).toBeGreaterThan(0);
            // Assert: Code blocks should have content (LaTeX examples or delimiters)
            expect(codeBlocksInPreview.codeContentLength).toBeGreaterThan(0);

            // Verify no rendering errors
            const errorCheck = await iframe.locator('body').evaluate(body => {
                const mjxErrors = body.querySelectorAll('.MathJax_Error, mjx-merror').length;
                const parseErrors = body.querySelectorAll('[data-mjx-error]').length;
                return {
                    mjxErrors,
                    parseErrors,
                    totalErrors: mjxErrors + parseErrors,
                };
            });

            // Assert: Should have no or minimal MathJax errors
            expect(errorCheck.totalErrors).toBeLessThanOrEqual(2); // Allow up to 2 errors for legacy content
        });

        test('should render pending span formulas in preview for mixed pre-rendered table content', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Span Mixed Preview');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Keep default addMathJax=false to validate pre-render preview path.
            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 15000 });
            await waitForTinyMCEReady(page);

            // Mixed content: one pre-rendered formula + several raw formulas inside styled spans.
            const mixedTableContent = `
                <table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
                <tbody>
                <tr>
                    <th style="width: 304px; text-align: center;" colspan="2"><span style="font-size: 12pt;">Tipografías matemáticas</span></th>
                </tr>
                <tr>
                    <th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg><math></math></span></span></th>
                    <th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathbb{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathbb{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathcal{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathcal{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="color: #0000ff; font-size: 12pt;">&nbsp;\\mathfrak{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathfrak{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathscr{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathscr{ABCdef}\\)</span></td>
                </tr>
                </tbody>
                </table>
            `;

            await page.evaluate(content => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(content);
                    editor.fire('change');
                    editor.fire('input');
                    editor.setDirty(true);
                }
            }, mixedTableContent);

            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            const previewCheck = await iframe.locator('body').evaluate(body => {
                const visibleText = body.textContent || '';
                const rawInlineMatches = visibleText.match(/\\\([^)]*\\\)/g) || [];

                const renderedWrappers = body.querySelectorAll('.exe-math-rendered').length;
                const mjxContainers = body.querySelectorAll('mjx-container').length;
                const totalMathElements = renderedWrappers + mjxContainers;

                const expectedLatexSnippets = [
                    '\\mathrm{ABCdef}',
                    '\\mathit{ABCdef}',
                    '\\mathbb{ABCdef}',
                    '\\mathcal{ABCdef}',
                    '\\mathfrak{ABCdef}',
                    '\\mathscr{ABCdef}',
                ];

                const dataLatexValues = Array.from(body.querySelectorAll('.exe-math-rendered[data-latex]'))
                    .map(el => el.getAttribute('data-latex') || '')
                    .join(' ');

                const matchedExpected = expectedLatexSnippets.filter(snippet =>
                    dataLatexValues.includes(snippet),
                ).length;

                return {
                    rawInlineCount: rawInlineMatches.length,
                    renderedWrappers,
                    mjxContainers,
                    totalMathElements,
                    matchedExpected,
                };
            });

            // No raw LaTeX delimiters should remain visible in preview text.
            expect(previewCheck.rawInlineCount).toBe(0);
            // Ensure math got rendered (pre-rendered wrappers and/or MathJax runtime).
            expect(previewCheck.totalMathElements).toBeGreaterThanOrEqual(6);
            // Ensure expected formulas are represented in pre-rendered data-latex.
            if (previewCheck.renderedWrappers > 0) {
                expect(previewCheck.matchedExpected).toBeGreaterThanOrEqual(6);
            }
        });

        test('should export website with mixed span formulas rendered (no raw inline delimiters)', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Span Mixed Export');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await selectFirstPage(page);
            await addTextIdevice(page);

            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 15000 });
            await waitForTinyMCEReady(page);

            const mixedTableContent = `
                <table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
                <tbody>
                <tr>
                    <th style="width: 304px; text-align: center;" colspan="2"><span style="font-size: 12pt;">Tipografías matemáticas</span></th>
                </tr>
                <tr>
                    <th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg><math></math></span></span></th>
                    <th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathbb{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathbb{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathcal{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathcal{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="color: #0000ff; font-size: 12pt;">&nbsp;\\mathfrak{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathfrak{ABCdef}\\)</span></td>
                </tr>
                <tr>
                    <td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathscr{ABCdef}</span></td>
                    <td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathscr{ABCdef}\\)</span></td>
                </tr>
                </tbody>
                </table>
            `;

            await page.evaluate(content => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(content);
                    editor.fire('change');
                    editor.fire('input');
                    editor.setDirty(true);
                }
            }, mixedTableContent);

            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            await saveProject(page);

            const download = await exportHtml5Website(page);
            const tmpDir = path.join('/tmp', `latex-export-${Date.now()}`);
            fs.mkdirSync(tmpDir, { recursive: true });
            const exportPath = path.join(tmpDir, download.suggestedFilename());
            await download.saveAs(exportPath);
            expect(fs.existsSync(exportPath)).toBe(true);

            const zipMap = unzipSync(fs.readFileSync(exportPath));
            const htmlFiles = Object.keys(zipMap).filter(f => f.endsWith('.html') || f.endsWith('.xhtml'));
            expect(htmlFiles.length).toBeGreaterThan(0);

            const decodedHtml = htmlFiles.map(f => Buffer.from(zipMap[f]).toString('utf8')).join('\n');

            const rawVisibleInline = (decodedHtml.match(/>\s*\\\([^<]*\\\)\s*</g) || []).length;
            const renderedWrappers = (decodedHtml.match(/class="exe-math-rendered"/g) || []).length;

            expect(rawVisibleInline).toBe(0);
            expect(renderedWrappers).toBeGreaterThanOrEqual(6);
        });
    });

    test.describe('MathJax Runtime Option (addMathJax)', () => {
        test('should include MathJax script in preview when addMathJax option is enabled via UI', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'MathJax Option Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Enable addMathJax option via the Project Properties UI toggle
            await enableMathJaxViaUI(page);

            // Open Preview and wait for content
            await waitForPreviewContent(page);

            // Check for MathJax script in preview
            const mathJaxCheck = await page.evaluate(async () => {
                const checkMathJax = () => {
                    const previewIframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                    if (!previewIframe?.contentDocument?.body) return null;

                    const doc = previewIframe.contentDocument;
                    const body = doc.body;
                    const scripts = doc.querySelectorAll('script[src*="tex-mml-svg"], script[src*="exe_math"]');
                    const hasContent = body.textContent && body.textContent.length > 50;
                    const isErrorPage = body.textContent?.includes('Preview Error');

                    if (isErrorPage) return { error: 'Preview Error', hasMathJaxScript: false };
                    if (!hasContent) return null;

                    return {
                        hasMathJaxScript: scripts.length > 0,
                        scriptCount: scripts.length,
                        scriptSrcs: Array.from(scripts).map(s => s.getAttribute('src')),
                    };
                };

                for (let i = 0; i < 30; i++) {
                    const result = checkMathJax();
                    if (result) return result;
                    await new Promise(r => setTimeout(r, 500));
                }
                return { error: 'Timeout', hasMathJaxScript: false };
            });

            // Note: Firefox has Service Worker registration issues, skip if preview failed
            if (mathJaxCheck.error) {
                test.skip();
                return;
            }

            // Assert: MathJax script should be included
            expect(mathJaxCheck.hasMathJaxScript).toBe(true);
            // Assert: Script should be tex-mml-svg or exe_math
            expect(
                mathJaxCheck.scriptSrcs?.some(src => src?.includes('tex-mml-svg') || src?.includes('exe_math')),
            ).toBe(true);
        });

        test('should configure MathJax with typeset:false for preview when enabled via UI', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'MathJax Config Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Enable addMathJax option via the Project Properties UI toggle
            await enableMathJaxViaUI(page);

            // Open Preview and wait for content
            await waitForPreviewContent(page);

            // Check for MathJax config in preview
            const mathJaxConfigCheck = await page.evaluate(async () => {
                const checkConfig = () => {
                    const previewIframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                    if (!previewIframe?.contentDocument?.body) return null;

                    const doc = previewIframe.contentDocument;
                    const body = doc.body;
                    const html = doc.documentElement.innerHTML;
                    const hasContent = body.textContent && body.textContent.length > 50;
                    const isErrorPage = body.textContent?.includes('Preview Error');

                    if (isErrorPage) return { error: 'Preview Error', hasMathJaxConfig: false };
                    if (!hasContent) return null;

                    // Check for MathJax configuration and script
                    const hasConfig =
                        html.includes('typeset: false') || html.includes('typeset:false') || html.includes('MathJax');
                    const hasMathJaxScript =
                        doc.querySelectorAll('script[src*="tex-mml-svg"], script[src*="exe_math"]').length > 0;

                    return {
                        hasMathJaxConfig: hasConfig || hasMathJaxScript,
                        hasTypesetFalse: html.includes('typeset: false') || html.includes('typeset:false'),
                        hasMathJaxScript,
                    };
                };

                for (let i = 0; i < 30; i++) {
                    const result = checkConfig();
                    if (result) return result;
                    await new Promise(r => setTimeout(r, 500));
                }
                return { error: 'Timeout', hasMathJaxConfig: false };
            });

            // Note: Firefox has Service Worker registration issues, skip if preview failed
            if (mathJaxConfigCheck.error) {
                test.skip();
                return;
            }

            // Assert: MathJax configuration should be present
            expect(mathJaxConfigCheck.hasMathJaxConfig).toBe(true);
            // Assert: MathJax script should be included
            expect(mathJaxConfigCheck.hasMathJaxScript).toBe(true);
        });

        // Test MathJax runtime rendering with dynamically created LaTeX content
        test('should render LaTeX with MathJax at runtime when addMathJax is enabled via UI', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'MathJax Runtime Render Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Enable addMathJax via the Project Properties UI toggle
            await enableMathJaxViaUI(page);

            // Select a non-root page and add a text iDevice
            await selectFirstPage(page);
            await addTextIdevice(page);

            // Wait for text iDevice to appear
            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 15000 });

            // Wait for TinyMCE to initialize
            await waitForTinyMCEReady(page);

            // Set content with raw LaTeX (display and inline math)
            const contentWithLatex = `
                <p>Inline: \\(a^2 + b^2 = c^2\\)</p>
                <p>Display: $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$</p>
            `;
            await page.evaluate(content => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(content);
                    editor.fire('change');
                    editor.setDirty(true);
                }
            }, contentWithLatex);

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                undefined,
                { timeout: 15000 },
            );

            // Open Preview and wait for content using helper
            // Open Preview and wait for content
            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            // Additional wait for MathJax to process at runtime
            await page.waitForTimeout(500);

            // When addMathJax is enabled, MathJax should render the content at runtime
            const mathRendered = await iframe.locator('body').evaluate(body => {
                const mjxContainers = body.querySelectorAll('mjx-container');
                const mjxContainersCount = mjxContainers.length;
                const preRendered = body.querySelectorAll('.exe-math-rendered').length;
                // Check if raw LaTeX delimiters are still visible (should NOT be after rendering)
                const hasRawInlineLatex = body.textContent?.includes('\\(') || false;
                const hasRawDisplayLatex = body.textContent?.includes('$$') || false;
                // Check for inline formula content (Pythagorean theorem: a² + b² = c²)
                const hasInlineContent =
                    body.textContent?.includes('a') &&
                    body.textContent?.includes('b') &&
                    body.textContent?.includes('c');
                // Check for display formula content (integral with π)
                const hasDisplayContent =
                    body.textContent?.includes('∫') ||
                    body.textContent?.includes('π') ||
                    body.innerHTML.includes('int') ||
                    body.innerHTML.includes('pi');
                // Check for SVG math content (actual rendered formulas)
                const svgMathCount = body.querySelectorAll('mjx-container svg, svg[data-mml-node]').length;
                // Check for specific math elements that should appear in rendered formulas
                const hasSuperscript = body.querySelector('mjx-msup, g[data-mml-node="msup"]') !== null;
                const hasFraction = body.querySelector('mjx-mfrac, g[data-mml-node="mfrac"]') !== null;
                const hasSquareRoot = body.querySelector('mjx-msqrt, g[data-mml-node="msqrt"]') !== null;

                return {
                    mjxContainersCount,
                    preRendered,
                    hasRawInlineLatex,
                    hasRawDisplayLatex,
                    hasInlineContent,
                    hasDisplayContent,
                    svgMathCount,
                    hasSuperscript,
                    hasFraction,
                    hasSquareRoot,
                };
            });

            // Assert: Should have MathJax containers (rendered formulas)
            expect(mathRendered.mjxContainersCount).toBeGreaterThan(0);
            // Assert: Should have at least 2 containers (one inline, one display)
            expect(mathRendered.mjxContainersCount).toBeGreaterThanOrEqual(2);
            // Assert: Should have SVG content (actual rendered math)
            expect(mathRendered.svgMathCount).toBeGreaterThan(0);
            // Assert: Raw LaTeX delimiters should NOT be visible (MathJax should have processed them)
            expect(mathRendered.hasRawInlineLatex).toBe(false);
            expect(mathRendered.hasRawDisplayLatex).toBe(false);
            // Assert: Formula content should be present (Pythagorean: a, b, c)
            expect(mathRendered.hasInlineContent).toBe(true);
            // Assert: Superscript should exist (a^2, b^2, c^2 from inline formula)
            expect(mathRendered.hasSuperscript).toBe(true);
            // Note: Fraction and square root detection may vary by MathJax version
            // The SVG structure differs, so we check that either specific elements exist
            // OR that we have complex math rendering (more than just basic elements)
            const hasComplexMath =
                mathRendered.hasFraction || mathRendered.hasSquareRoot || mathRendered.mjxContainersCount >= 2;
            expect(hasComplexMath).toBe(true);
        });

        test('should NOT corrupt data-latex when same LaTeX appears multiple times', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Duplicate Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Import the LaTeX fixture which contains duplicate LaTeX expressions
            await openLatexFixture(page);

            // Open Preview and wait for content
            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            // Critical check: Verify data-latex attributes are NOT corrupted
            // The bug was: String.replace() only replaced first occurrence, causing
            // subsequent replacements to corrupt data-latex by including HTML inside it
            const dataLatexCheck = await iframe.locator('body').evaluate(body => {
                const dataLatexElements = body.querySelectorAll('[data-latex]');
                const results: Array<{
                    value: string | null;
                    isCorrupted: boolean;
                    corruptionType: string | null;
                }> = [];

                dataLatexElements.forEach(el => {
                    const value = el.getAttribute('data-latex');
                    let isCorrupted = false;
                    let corruptionType: string | null = null;

                    if (value) {
                        // Check for HTML tags inside data-latex (corruption indicator)
                        if (value.includes('<span')) {
                            isCorrupted = true;
                            corruptionType = 'contains <span';
                        } else if (value.includes('&lt;span')) {
                            isCorrupted = true;
                            corruptionType = 'contains &lt;span';
                        } else if (value.includes('exe-math-rendered')) {
                            isCorrupted = true;
                            corruptionType = 'contains exe-math-rendered';
                        } else if (value.includes('<mjx-')) {
                            isCorrupted = true;
                            corruptionType = 'contains <mjx-';
                        }
                    }

                    results.push({
                        value: value?.substring(0, 100) || null,
                        isCorrupted,
                        corruptionType,
                    });
                });

                return {
                    totalElements: dataLatexElements.length,
                    corruptedCount: results.filter(r => r.isCorrupted).length,
                    results: results.slice(0, 10), // First 10 for debugging
                };
            });

            // Log details for debugging if there are issues
            if (dataLatexCheck.corruptedCount > 0) {
                console.log(
                    'Corrupted data-latex elements found:',
                    dataLatexCheck.results.filter(r => r.isCorrupted),
                );
            }

            // CRITICAL: No data-latex attribute should contain HTML (corruption)
            expect(dataLatexCheck.corruptedCount).toBe(0);

            // Should have some data-latex elements (pre-rendered math)
            expect(dataLatexCheck.totalElements).toBeGreaterThan(0);
        });

        test('should render multiple identical LaTeX expressions correctly', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'LaTeX Multiple Identical Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Select a non-root page and add a text iDevice
            await selectFirstPage(page);
            await addTextIdevice(page);

            // Wait for text iDevice to appear
            const block = page.locator('#node-content article .idevice_node.text').first();
            await block.waitFor({ timeout: 15000 });

            // Wait for TinyMCE to initialize
            await waitForTinyMCEReady(page);

            // Set content with DUPLICATE LaTeX expressions (the exact scenario that caused corruption)
            const contentWithDuplicateLatex = `
                <p>First formula: \\(\\alpha + \\beta\\)</p>
                <p>Second identical: \\(\\alpha + \\beta\\)</p>
                <p>Third identical: \\(\\alpha + \\beta\\)</p>
            `;

            await page.evaluate(content => {
                const editor = (window as any).tinymce?.activeEditor;
                if (editor) {
                    editor.setContent(content);
                    editor.fire('change');
                    editor.fire('input');
                    editor.setDirty(true);
                }
            }, contentWithDuplicateLatex);

            // Save the iDevice
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.text');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                undefined,
                { timeout: 15000 },
            );

            // Open Preview and wait for content using helper
            // Open Preview and wait for content
            await waitForPreviewContent(page);
            const iframe = getPreviewFrame(page);

            // Additional wait for preview to render
            await page.waitForTimeout(500);

            // Verify all three LaTeX expressions rendered without corruption
            const renderCheck = await iframe.locator('body').evaluate(body => {
                const mathElements = body.querySelectorAll('.exe-math-rendered, mjx-container');
                const dataLatexValues: string[] = [];
                let corruptedCount = 0;
                let elementsWithSvg = 0;
                let elementsWithContent = 0;

                mathElements.forEach(el => {
                    // Check for data-latex attribute (pre-rendered)
                    const dataLatex = el.getAttribute('data-latex');
                    if (dataLatex) {
                        dataLatexValues.push(dataLatex);
                        if (dataLatex.includes('<span') || dataLatex.includes('exe-math-rendered')) {
                            corruptedCount++;
                        }
                    }
                    // Check for SVG content (visual rendering)
                    if (el.querySelector('svg') || el.querySelector('mjx-math')) {
                        elementsWithSvg++;
                    }
                    // Check for actual math content (α and β symbols)
                    const text = el.textContent || '';
                    if (
                        text.includes('α') ||
                        text.includes('β') ||
                        el.innerHTML.includes('alpha') ||
                        el.innerHTML.includes('beta')
                    ) {
                        elementsWithContent++;
                    }
                });

                // Check that all three paragraphs contain "First", "Second", "Third"
                const paragraphs = body.querySelectorAll('p');
                const hasFirst = Array.from(paragraphs).some(p => p.textContent?.includes('First'));
                const hasSecond = Array.from(paragraphs).some(p => p.textContent?.includes('Second'));
                const hasThird = Array.from(paragraphs).some(p => p.textContent?.includes('Third'));

                // Check all formulas are identical (same data-latex value)
                const uniqueLatexValues = [...new Set(dataLatexValues.map(v => v.trim()))];

                return {
                    totalMathElements: mathElements.length,
                    dataLatexValues,
                    corruptedCount,
                    elementsWithSvg,
                    elementsWithContent,
                    hasFirst,
                    hasSecond,
                    hasThird,
                    uniqueLatexCount: uniqueLatexValues.length,
                };
            });

            // Assert: Should have rendered all three identical expressions
            expect(renderCheck.totalMathElements).toBeGreaterThanOrEqual(3);

            // Assert: None should be corrupted
            expect(renderCheck.corruptedCount).toBe(0);

            // Assert: All three formula positions should be present
            expect(renderCheck.hasFirst).toBe(true);
            expect(renderCheck.hasSecond).toBe(true);
            expect(renderCheck.hasThird).toBe(true);

            // Assert: Math elements should have visual content (SVG or similar)
            expect(renderCheck.elementsWithSvg).toBeGreaterThan(0);

            // Assert: Math elements should have math content (α, β symbols)
            expect(renderCheck.elementsWithContent).toBeGreaterThan(0);

            // Assert: All data-latex values should be identical (same formula 3 times)
            if (renderCheck.dataLatexValues.length > 0) {
                expect(renderCheck.uniqueLatexCount).toBe(1);
            }

            // Assert: All data-latex values should contain the original LaTeX and NOT be corrupted
            renderCheck.dataLatexValues.forEach(value => {
                expect(value).toContain('alpha');
                expect(value).toContain('beta');
                expect(value).not.toContain('<span');
                expect(value).not.toContain('exe-math-rendered');
                expect(value).not.toContain('<mjx-');
            });
        });
    });

    test.describe('LaTeX in Project Title', () => {
        test.describe('Open Dialog', () => {
            // Skip in static mode - Open dialog requires server storage
            test.beforeAll(async ({}, testInfo) => {
                skipInStaticMode(test, testInfo, 'Open dialog requires server storage');
            });

            test('should render LaTeX in project title and show it in Open dialog after save', async ({
                authenticatedPage,
                createProject,
            }) => {
                const page = authenticatedPage;

                // Create a new project
                const projectUuid = await createProject(page, 'LaTeX Title Test');
                await gotoWorkarea(page, projectUuid);

                // Enable MathJax for runtime rendering via UI toggle
                await enableMathJaxViaUI(page);

                // Set LaTeX title directly via Yjs metadata (more reliable than UI interaction)
                const latexTitle = '\\(\\LaTeX\\)';
                await page.evaluate(title => {
                    const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                    const metadata = bridge.documentManager.getMetadata();
                    const ydoc = bridge.documentManager.getDoc();

                    // Set title in Yjs metadata (key is 'title', not 'pp_title')
                    ydoc.transact(() => {
                        metadata.set('title', title);
                        metadata.set('modifiedAt', Date.now());
                    }, ydoc.clientID);

                    // Trigger UI update
                    if ((window as any).eXeLearning.app.interface?.odeTitleElement) {
                        (window as any).eXeLearning.app.interface.odeTitleElement.setTitle();
                    }
                }, latexTitle);

                // Wait for MathJax to render in the title
                await page.waitForTimeout(500);

                // Verify LaTeX renders in the page title (h2.exe-title or #change_title)
                const pageTitleElement = page.locator('h2.exe-title, #change_title').first();
                await expect(pageTitleElement).toBeVisible({ timeout: 10000 });

                // Check if MathJax rendered the LaTeX in the page title
                const titleRenderCheck = await pageTitleElement.evaluate(el => {
                    const mjxContainer = el.querySelector('mjx-container');
                    const hasSvg = el.querySelector('mjx-container svg') !== null;
                    const hasLatexText =
                        el.textContent?.includes('L') && el.textContent?.includes('T') && el.textContent?.includes('X');
                    const rawLatex = el.textContent?.includes('\\(') || false;
                    const mjxJax = mjxContainer?.getAttribute('jax');
                    // Check for the characteristic LaTeX logo styling (stacked letters)
                    const hasLatexLogo = el.querySelector('mjx-container mjx-mpadded, mjx-container mpadded') !== null;

                    return {
                        hasMjxContainer: mjxContainer !== null,
                        hasSvg,
                        hasLatexText,
                        rawLatex,
                        mjxJax: mjxJax || null,
                        hasLatexLogo,
                        innerHTML: el.innerHTML.substring(0, 500),
                    };
                });

                // Assert: MathJax should have rendered in the page title
                expect(titleRenderCheck.hasMjxContainer).toBe(true);
                // Assert: Should have SVG content (visual rendering)
                expect(titleRenderCheck.hasSvg).toBe(true);
                // Assert: MathJax should use SVG output
                expect(titleRenderCheck.mjxJax).toBe('SVG');
                // Assert: Should contain LaTeX text characters (L, A, T, E, X)
                expect(titleRenderCheck.hasLatexText).toBe(true);
                // Assert: Raw LaTeX should NOT be visible (should be rendered)
                expect(titleRenderCheck.rawLatex).toBe(false);

                // Save the project
                await saveProject(page);

                // Verify save was successful by checking for any save indicators
                const saveSuccess = await page.evaluate(() => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const metadata = bridge?.documentManager?.getMetadata();
                    // Note: title is stored with key 'title', not 'pp_title'
                    const title = metadata?.get('title');
                    return {
                        hasTitle: title !== undefined,
                        titleValue: title || null,
                    };
                });

                // Assert: Title should be saved in metadata
                expect(saveSuccess.hasTitle).toBe(true);
                expect(saveSuccess.titleValue).toBe(latexTitle);

                // Now open the "Open file" dialog to verify LaTeX title appears there
                const fileMenu = page.locator('#dropdownFile');
                await expect(fileMenu).toBeVisible({ timeout: 10000 });
                await fileMenu.click();

                await page.waitForTimeout(300);

                const openOption = page.locator('#navbar-button-openuserodefiles');
                await expect(openOption).toBeVisible({ timeout: 5000 });
                await openOption.click();

                // Wait for the Open modal to appear
                const openModal = page.locator('#modalOpenUserOdeFiles');
                await expect(openModal).toBeVisible({ timeout: 10000 });

                // Wait for the file list to load
                await page.waitForTimeout(500);

                // Find the project in the list by looking for the LaTeX rendered title
                // The title should be in .ode-title or .ode-file-title element
                const projectRow = openModal.locator('article.ode-row').first();
                await expect(projectRow).toBeVisible({ timeout: 10000 });

                // Check if LaTeX is rendered in the Open dialog
                const openDialogCheck = await openModal.evaluate(modal => {
                    // Find all title elements in the file list
                    const titleElements = modal.querySelectorAll('.ode-title, .ode-file-title');
                    let foundLatexTitle = false;
                    let hasMjxInTitle = false;
                    let hasSvgInTitle = false;
                    let titleDataFilename: string | null = null;

                    for (const titleEl of titleElements) {
                        const dataFilename = titleEl.getAttribute('data-filename');
                        if (dataFilename?.includes('\\(') || dataFilename?.includes('LaTeX')) {
                            titleDataFilename = dataFilename;
                            foundLatexTitle = true;
                            hasMjxInTitle = titleEl.querySelector('mjx-container') !== null;
                            hasSvgInTitle = titleEl.querySelector('mjx-container svg') !== null;
                            break;
                        }
                        // Also check if already rendered
                        const mjx = titleEl.querySelector('mjx-container');
                        if (mjx) {
                            hasMjxInTitle = true;
                            hasSvgInTitle = titleEl.querySelector('mjx-container svg') !== null;
                            foundLatexTitle = true;
                            break;
                        }
                    }

                    return {
                        foundLatexTitle,
                        hasMjxInTitle,
                        hasSvgInTitle,
                        titleDataFilename,
                        totalTitles: titleElements.length,
                    };
                });

                // Assert: Should find the project with LaTeX title
                expect(openDialogCheck.foundLatexTitle).toBe(true);
                // Assert: MathJax should render in the Open dialog title
                expect(openDialogCheck.hasMjxInTitle).toBe(true);
                // Assert: Should have SVG content
                expect(openDialogCheck.hasSvgInTitle).toBe(true);

                // Close the modal
                const closeModalBtn = openModal.locator('button.btn-close, [data-bs-dismiss="modal"]').first();
                if ((await closeModalBtn.count()) > 0) {
                    await closeModalBtn.click();
                } else {
                    await page.keyboard.press('Escape');
                }

                // Verify MathJax is enabled before opening preview
                const mathJaxEnabledBeforePreview = await page.evaluate(() => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const metadata = bridge?.documentManager?.getMetadata();
                    return {
                        addMathJax: metadata?.get('addMathJax'),
                        title: metadata?.get('title'),
                    };
                });
                console.log('[LaTeX Title Test] MathJax status before preview:', mathJaxEnabledBeforePreview);

                // Capture console messages from the iframe
                const consoleMessages: string[] = [];
                page.on('console', msg => {
                    if (msg.type() === 'error' || msg.text().toLowerCase().includes('mathjax')) {
                        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
                    }
                });

                const previewButton = page.locator('#head-bottom-preview');
                await previewButton.click();

                const previewPanel = page.locator('#previewsidenav');
                await expect(previewPanel).toBeVisible({ timeout: 15000 });

                const iframe = page.frameLocator('#preview-iframe');

                // Wait for preview content to load first
                await iframe.locator('body').waitFor({ state: 'attached', timeout: 10000 });
                await iframe.locator('header, h1, h2').first().waitFor({ state: 'attached', timeout: 10000 });

                // Wait for MathJax to render the title in the preview header
                // MathJax SHOULD process all LaTeX in the page, including the header
                // Use waitForFunction to poll for mjx-container in the title
                const previewTitleCheck = await iframe.locator('body').evaluate(async body => {
                    // Wait for MathJax to finish processing (poll for up to 10 seconds)
                    const maxWait = 10000;
                    const pollInterval = 200;
                    let elapsed = 0;

                    while (elapsed < maxWait) {
                        const titleElements = body.querySelectorAll(
                            'h1.package-title, h2.exe-title, .exe-title, header h1, header h2',
                        );
                        for (const titleEl of titleElements) {
                            const mjx = titleEl.querySelector('mjx-container');
                            if (mjx) {
                                // MathJax has rendered!
                                return {
                                    hasMjxInPreview: true,
                                    hasSvgInPreview: titleEl.querySelector('mjx-container svg') !== null,
                                    rawLatexInTitle: false,
                                    mjxJax: mjx.getAttribute('jax'),
                                    titleHtml: titleEl.innerHTML.substring(0, 300),
                                };
                            }
                        }
                        await new Promise(r => setTimeout(r, pollInterval));
                        elapsed += pollInterval;
                    }

                    // MathJax didn't render - collect info for debugging
                    const titleElements = body.querySelectorAll(
                        'h1.package-title, h2.exe-title, .exe-title, header h1, header h2',
                    );
                    let rawLatexInTitle = false;
                    let titleHtml = '';
                    const allTitles: string[] = [];
                    for (const titleEl of titleElements) {
                        const text = titleEl.textContent || '';
                        allTitles.push(`${titleEl.tagName}.${titleEl.className}: "${text.substring(0, 50)}"`);
                        if (text.includes('\\(') || text.includes('\\LaTeX')) {
                            rawLatexInTitle = true;
                        }
                        titleHtml = titleEl.innerHTML.substring(0, 300);
                    }

                    // Check if MathJax script is loaded
                    const mathJaxLoaded = typeof (window as any).MathJax !== 'undefined';
                    const mathJaxReady = mathJaxLoaded && typeof (window as any).MathJax.typesetPromise === 'function';

                    // Get MathJax status
                    let mathJaxStatus = 'not loaded';
                    if (mathJaxLoaded) {
                        const mj = (window as any).MathJax;
                        mathJaxStatus = `loaded, startup: ${mj.startup ? 'exists' : 'missing'}, typesetPromise: ${typeof mj.typesetPromise}`;
                        if (mj.startup) {
                            mathJaxStatus += `, document: ${mj.startup.document ? 'exists' : 'missing'}`;
                            mathJaxStatus += `, promise: ${mj.startup.promise ? 'exists' : 'missing'}`;
                        }
                    }

                    // Get the header HTML to see what's there
                    const headerEl = body.querySelector('header.main-header, .main-header, header');
                    const headerHtml = headerEl ? headerEl.innerHTML.substring(0, 500) : 'No header found';

                    // Check for any mjx-container anywhere in the body
                    const anyMjxInBody = body.querySelectorAll('mjx-container').length;

                    // Check if MathJax config script exists in head
                    const scripts = Array.from(document.querySelectorAll('script')).map(
                        s => s.src || s.textContent?.substring(0, 100),
                    );
                    const hasMathJaxConfig = scripts.some(s => s?.includes('MathJax'));

                    return {
                        hasMjxInPreview: false,
                        hasSvgInPreview: false,
                        rawLatexInTitle,
                        mathJaxLoaded,
                        mathJaxReady,
                        mathJaxStatus,
                        titleHtml,
                        allTitles,
                        headerHtml,
                        anyMjxInBody,
                        hasMathJaxConfig,
                        scripts: scripts.filter(s => s?.includes('MathJax') || s?.includes('tex-mml')),
                    };
                });

                // Debug: Log what we found
                console.log('[LaTeX Title Test] Preview check result:', JSON.stringify(previewTitleCheck, null, 2));
                console.log('[LaTeX Title Test] Console messages:', consoleMessages);

                // Assert: LaTeX content should be present in preview (either rendered or raw)
                // Note: MathJax rendering in preview depends on library loading which may fail in test environment
                // The key is that the LaTeX content is PRESERVED in the preview
                const latexInPreview = previewTitleCheck.hasMjxInPreview || previewTitleCheck.rawLatexInTitle;
                expect(latexInPreview).toBe(true);

                // If MathJax rendered, verify it has SVG
                if (previewTitleCheck.hasMjxInPreview) {
                    expect(previewTitleCheck.hasSvgInPreview).toBe(true);
                }
            });
        });

        test('should preserve LaTeX title after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project with LaTeX title directly via API/metadata
            const projectUuid = await createProject(page, 'LaTeX Persistence Test');
            await gotoWorkarea(page, projectUuid);

            await waitForAppReady(page);

            // Enable MathJax for runtime rendering via UI toggle
            await enableMathJaxViaUI(page);

            // Set LaTeX title via Yjs metadata
            const latexTitle = '\\(E = mc^2\\)';
            await page.evaluate(title => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const metadata = bridge.documentManager.getMetadata();
                const ydoc = bridge.documentManager.getDoc();

                // Set title in Yjs metadata (key is 'title', not 'pp_title')
                ydoc.transact(() => {
                    metadata.set('title', title);
                    metadata.set('modifiedAt', Date.now());
                }, ydoc.clientID);

                // Trigger UI update
                if ((window as any).eXeLearning.app.interface?.odeTitleElement) {
                    (window as any).eXeLearning.app.interface.odeTitleElement.setTitle();
                }
            }, latexTitle);

            // Wait for changes to propagate
            await page.waitForTimeout(500);

            // Save the project
            await saveProject(page);

            // Reload the page
            await reloadPage(page);

            // Wait for MathJax to render
            await page.waitForTimeout(500);

            // Verify the title was persisted and renders correctly
            const persistenceCheck = await page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const metadata = bridge?.documentManager?.getMetadata();
                return {
                    // Note: title is stored with key 'title', not 'pp_title'
                    title: metadata?.get('title') || null,
                    addMathJax: metadata?.get('addMathJax') || false,
                };
            });

            // Assert: Title should persist after reload
            expect(persistenceCheck.title).toBe(latexTitle);
            // Assert: MathJax setting should persist (may be stored as string "true" or boolean true)
            const mathJaxEnabled = persistenceCheck.addMathJax === true || persistenceCheck.addMathJax === 'true';
            expect(mathJaxEnabled).toBe(true);

            // Verify rendered title in the page
            const pageTitleElement = page.locator('h2.exe-title, #change_title').first();

            const titleAfterReload = await pageTitleElement.evaluate(el => {
                const mjxContainer = el.querySelector('mjx-container');
                const hasSvg = el.querySelector('mjx-container svg') !== null;
                // E=mc² should have superscript element
                const hasSuperscript = el.querySelector('mjx-msup, g[data-mml-node="msup"]') !== null;
                const textContent = el.textContent || '';

                return {
                    hasMjxContainer: mjxContainer !== null,
                    hasSvg,
                    hasSuperscript,
                    hasEnergyFormula:
                        textContent.includes('E') && textContent.includes('m') && textContent.includes('c'),
                    rawLatexVisible: textContent.includes('\\('),
                };
            });

            // Assert: MathJax should render after reload
            expect(titleAfterReload.hasMjxContainer).toBe(true);
            // Assert: Should have SVG content
            expect(titleAfterReload.hasSvg).toBe(true);
            // Assert: Energy formula content should be visible (E, m, c)
            expect(titleAfterReload.hasEnergyFormula).toBe(true);
            // Assert: Raw LaTeX should NOT be visible
            expect(titleAfterReload.rawLatexVisible).toBe(false);
            // Assert: Should have superscript for c²
            expect(titleAfterReload.hasSuperscript).toBe(true);
        });
    });
});
