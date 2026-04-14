/**
 * ElpxExporter
 *
 * Exports a document to ELPX (eXeLearning Project) format.
 * ELPX is a complete HTML5 export + content.xml for re-import.
 *
 * ELPX files contain everything HTML5 exports have, plus:
 * - content.xml (ODE format with full project structure for re-import)
 * - content.dtd (DTD for XML validation)
 *
 * Structure:
 * - index.html (main page)
 * - html/*.html (individual pages)
 * - content/css/ (base CSS + icons)
 * - content/resources/ (project assets)
 * - libs/ (shared JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content.xml (ODE format)
 * - content.dtd
 *
 * The ODE XML format is a hierarchical structure:
 * - odeProperties (metadata)
 * - odeResources (version info, identifiers)
 * - odeNavStructures (pages)
 *   - odePagStructures (blocks)
 *     - odeComponents (iDevices)
 */

import type { ExportOptions, ExportResult, ElpxExportOptions } from '../interfaces';
import { Html5Exporter } from './Html5Exporter';
import { validateXml, formatValidationErrors } from '../../../services/xml/xml-parser';
import { ODE_DTD_FILENAME, ODE_DTD_CONTENT } from '../constants';
import { generateOdeXml } from '../generators/OdeXmlGenerator';

export class ElpxExporter extends Html5Exporter {
    /**
     * Decode screenshot from base64 data URL or raw base64 to Uint8Array.
     * Returns null if the data is not valid PNG.
     */
    private decodeScreenshotToBuffer(screenshot: string): Uint8Array | null {
        try {
            let base64Data = screenshot;
            // Handle data URL format (data:image/png;base64,...)
            if (base64Data.startsWith('data:')) {
                const commaIndex = base64Data.indexOf(',');
                if (commaIndex === -1) return null;
                base64Data = base64Data.substring(commaIndex + 1);
            }
            // Decode base64 to binary
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            // Validate PNG signature (first 8 bytes)
            if (
                bytes.length >= 8 &&
                bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4e &&
                bytes[3] === 0x47 &&
                bytes[4] === 0x0d &&
                bytes[5] === 0x0a &&
                bytes[6] === 0x1a &&
                bytes[7] === 0x0a
            ) {
                return bytes;
            }
            console.warn('[ElpxExporter] Screenshot data is not a valid PNG');
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Get file extension for ELPX format
     */
    getFileExtension(): string {
        return '.elpx';
    }

    /**
     * Get file suffix for ELPX format (no suffix for ELPX)
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Export to ELPX format
     *
     * ELPX is a complete HTML5 export + content.xml (ODE format) + DTD for re-import.
     * This method generates all HTML5 content (index.html, html/*.html, libs/, theme/, etc.)
     * and then adds the content.xml with full ODE structure and DTD.
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();
        const elpxOptions = options as ElpxExportOptions | undefined;

        try {
            this.logElpxExportDebugPhase('exporter:elpx:start');
            let pages = this.buildPageList();
            this.logElpxExportDebugPhase('exporter:build-page-list:end', {
                pages: pages.length,
            });
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = elpxOptions?.theme || meta.theme || 'base';

            // Check for ELPX download support (looks for download-source-file iDevice)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);
            this.logElpxExportDebugPhase('exporter:prepare-theme:start', {
                theme: themeName,
            });

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // File tracking for ELPX manifest (only when download-source-file is used)
            const fileList: string[] | null = needsElpxDownload ? [] : null;
            const addFile = (path: string, content: Uint8Array | string) => {
                this.zip.addFile(path, content);
                if (fileList) fileList.push(path);
            };

            // =========================================================================
            // SECTION 1: Generate HTML5 content (same as Html5Exporter)
            // =========================================================================

            // 1.0 Pre-fetch theme to get the list of CSS/JS files for HTML includes
            const { themeFilesMap, themeRootFiles, faviconInfo } = await this.prepareThemeData(themeName);
            this.logElpxExportDebugPhase('exporter:prepare-theme:end', {
                theme: themeName,
                themeFiles: themeFilesMap?.size || 0,
            });

            // Fetch translated nav button labels for the content language
            this.logElpxExportDebugPhase('exporter:nav-labels:start', {
                language: meta.language || 'en',
            });
            const navLabels = await this.fetchNavLabels(meta.language || 'en');
            this.logElpxExportDebugPhase('exporter:nav-labels:end', {
                language: meta.language || 'en',
            });

            // 1.1 Generate HTML pages with optional Mermaid pre-rendering, store for later — manifest script tag injection happens after manifest is created)
            const pageHtmlMap = new Map<string, string>();
            let mermaidWasRendered = false;
            this.logElpxExportDebugPhase('exporter:generate-pages:start', {
                pages: pages.length,
            });

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let html = this.generatePageHtml(
                    page,
                    pages,
                    meta,
                    i === 0,
                    i,
                    themeRootFiles,
                    faviconInfo,
                    pageFilenameMap,
                    undefined,
                    navLabels,
                );

                // Pre-render Mermaid diagrams to static SVG if hook is provided
                // This eliminates the need for the ~2.7MB Mermaid library in exports
                if (options?.preRenderMermaid) {
                    try {
                        const result = await options.preRenderMermaid(html);
                        if (result.mermaidRendered) {
                            html = result.html;
                            mermaidWasRendered = true;
                            console.log(
                                `[ElpxExporter] Pre-rendered ${result.count} Mermaid diagram(s) on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[ElpxExporter] Mermaid pre-render failed for page:', page.title, error);
                    }
                }

                // Use unique filename from the map (handles title collisions)
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const pageFilename = i === 0 ? 'index.html' : `html/${uniqueFilename}`;
                pageHtmlMap.set(pageFilename, html);
            }
            this.logElpxExportDebugPhase('exporter:generate-pages:end', {
                pages: pageHtmlMap.size,
            });

            // 1.2 Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '', pageFilenameMap);
                addFile('search_index.js', searchIndexContent);
            }

            // 1.3 Add base CSS (fetch from content/css) and Mermaid pre-rendered CSS
            this.logElpxExportDebugPhase('exporter:content-css:start');
            const contentCssFiles = await this.resources.fetchContentCss();
            let baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            // Append pre-rendered Mermaid CSS if diagrams were rendered
            if (mermaidWasRendered) {
                const decoder = new TextDecoder();
                let baseCssText = decoder.decode(baseCss);
                baseCssText += '\n' + this.getPreRenderedMermaidCss();
                const encoder = new TextEncoder();
                baseCss = encoder.encode(baseCssText);
            }
            addFile('content/css/base.css', baseCss);
            this.logElpxExportDebugPhase('exporter:content-css:end', {
                files: contentCssFiles.size,
            });

            // 1.4 Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 1.5 Add theme files (already pre-fetched in step 1.0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    addFile(`theme/${filePath}`, content);
                }
            } else {
                // Add fallback theme if pre-fetch failed
                addFile('theme/style.css', this.getFallbackThemeCss());
                addFile('theme/style.js', this.getFallbackThemeJs());
            }

            // 1.6 Fetch base libraries (always included - jQuery, Bootstrap, exe_lightbox, etc.)
            try {
                this.logElpxExportDebugPhase('exporter:base-libs:start');
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    addFile(`libs/${libPath}`, content);
                }
                this.logElpxExportDebugPhase('exporter:base-libs:end', {
                    files: baseLibs.size,
                });
            } catch {
                // Base libraries not available - continue anyway
            }

            // 1.6.5 Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            addFile('libs/common_i18n.js', i18nContent);

            // 1.7 Detect and fetch additional required libraries based on content
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
            });

            try {
                this.logElpxExportDebugPhase('exporter:content-libs:start', {
                    requestedFiles: allRequiredFiles.length,
                    patterns: patterns.length,
                });
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        addFile(zipPath, content);
                    }
                }
                this.logElpxExportDebugPhase('exporter:content-libs:end', {
                    files: libFiles.size,
                });
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 1.8 Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            this.logElpxExportDebugPhase('exporter:idevice-resources:start', {
                idevices: usedIdevices.length,
            });
            for (const idevice of usedIdevices) {
                try {
                    // Normalize iDevice type to directory name (e.g., 'FreeTextIdevice' -> 'text')
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Use normalized type for ZIP path
                        addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }
            this.logElpxExportDebugPhase('exporter:idevice-resources:end', {
                idevices: usedIdevices.length,
            });

            // 1.9 Add project assets
            await this.addAssetsToZipWithResourcePath(fileList);

            // 1.10 Generate ELPX manifest and add HTML pages to ZIP
            if (needsElpxDownload && fileList) {
                for (const [htmlFile] of pageHtmlMap) {
                    if (!fileList.includes(htmlFile)) {
                        fileList.push(htmlFile);
                    }
                }
                // Include the manifest file itself in the file list (self-reference)
                fileList.push('libs/elpx-manifest.js');
                const manifestJs = this.generateElpxManifestFile(fileList);
                this.zip.addFile('libs/elpx-manifest.js', manifestJs);
            }

            // 1.11 Add HTML pages to ZIP (with manifest script on pages that have download-source-file)
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pageFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = i === 0 ? 'index.html' : `html/${pageFilename}`;
                let html = pageHtmlMap.get(filename) || '';

                if (needsElpxDownload && this.pageHasDownloadSourceFile(page)) {
                    const basePath = i === 0 ? '' : '../';
                    const manifestScriptTag = `<script src="${basePath}libs/elpx-manifest.js"> </script>`;
                    html = html.replace(/<\/body>/i, `${manifestScriptTag}\n</body>`);
                }
                this.zip.addFile(filename, html);
            }

            // =========================================================================
            // SECTION 2: Add ELPX-specific files (content.xml with ODE format + DTD)
            // =========================================================================

            // 2.1 Generate content.xml with full ODE format (for re-import)
            const contentXml = generateOdeXml(meta, pages);

            // Validate generated XML
            const validation = validateXml(contentXml);
            if (!validation.valid) {
                const errorMsg = formatValidationErrors(validation);
                console.error(`[ElpxExporter] Generated XML failed validation:\n${errorMsg}`);
                throw new Error(`Generated content.xml is invalid:\n${errorMsg}`);
            }
            if (validation.warnings.length > 0) {
                console.warn(`[ElpxExporter] XML validation warnings:\n${formatValidationErrors(validation)}`);
            }

            this.zip.addFile('content.xml', contentXml);

            // 2.2 Add DTD file
            this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);

            // 2.3 Add project screenshot/thumbnail
            let screenshotBuffer: Uint8Array | null = null;
            // Priority 1: custom screenshot from project metadata
            if (meta.screenshot) {
                screenshotBuffer = this.decodeScreenshotToBuffer(meta.screenshot);
            }
            // Priority 2: auto-generate from first page HTML via browser hook
            if (!screenshotBuffer && options?.generateScreenshot) {
                try {
                    const firstPageHtml = pageHtmlMap.get('index.html');
                    if (firstPageHtml) {
                        const dataUrl = await options.generateScreenshot(firstPageHtml);
                        if (dataUrl) {
                            screenshotBuffer = this.decodeScreenshotToBuffer(dataUrl);
                        }
                    }
                } catch (error) {
                    console.warn('[ElpxExporter] Screenshot auto-generation failed:', error);
                }
            }
            if (screenshotBuffer) {
                this.zip.addFile('screenshot.png', screenshotBuffer);
            }

            // =========================================================================
            // SECTION 3: Generate final ZIP
            // =========================================================================
            this.logElpxExportDebugPhase('exporter:zip-generate:start', {
                zipFiles: fileList?.length || this.zip.getFilePaths?.().length || null,
            });
            const buffer = await this.zip.generateAsync();
            const zipStats =
                (
                    this.zip as {
                        getLastGenerateStats?: () => {
                            deflatedFiles: number;
                            storedFiles: number;
                            deflatedBytes: number;
                            storedBytes: number;
                        };
                    }
                ).getLastGenerateStats?.() || null;
            this.logElpxExportDebugPhase('exporter:zip-generate:end', {
                bytes: buffer.byteLength,
                deflatedFiles: zipStats?.deflatedFiles ?? null,
                storedFiles: zipStats?.storedFiles ?? null,
                deflatedBytes: zipStats?.deflatedBytes ?? null,
                storedBytes: zipStats?.storedBytes ?? null,
            });

            return {
                success: true,
                filename: exportFilename,
                data: buffer,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
