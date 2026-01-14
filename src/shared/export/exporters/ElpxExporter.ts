/**
 * ElpxExporter
 *
 * Exports a document to ELPX (eXeLearning Project) format.
 * ELPX is a complete HTML5 export + content.xml for re-import.
 *
 * ELPX files contain everything HTML5 exports have, plus:
 * - content.xml (ODE format with full project structure for re-import)
 * - content.dtd (DTD for XML validation)
 * - custom/ directory
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
 * - custom/
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
import { generateI18nScript } from '../generators/I18nGenerator';

export class ElpxExporter extends Html5Exporter {
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
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = elpxOptions?.theme || meta.theme || 'base';

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // =========================================================================
            // SECTION 1: Generate HTML5 content (same as Html5Exporter)
            // =========================================================================

            // 1.0 Pre-fetch theme to get the list of CSS/JS files for HTML includes
            const themeRootFiles: string[] = [];
            let themeFilesMap: Map<string, Uint8Array> | null = null;
            try {
                themeFilesMap = await this.resources.fetchTheme(themeName);
                for (const [filePath] of themeFilesMap) {
                    // Track root-level CSS/JS files (no path separator = root level)
                    if (!filePath.includes('/') && (filePath.endsWith('.css') || filePath.endsWith('.js'))) {
                        themeRootFiles.push(filePath);
                    }
                }
            } catch (e) {
                console.warn(`[ElpxExporter] Failed to pre-fetch theme: ${themeName}`, e);
                themeRootFiles.push('style.css', 'style.js');
            }

            // 1.1 Generate HTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const html = this.generatePageHtml(page, pages, meta, i === 0, i, themeRootFiles);
                // First page is index.html, others go in html/ directory
                const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                this.zip.addFile(pageFilename, html);
            }

            // 1.2 Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '');
                this.zip.addFile('search_index.js', searchIndexContent);
            }

            // 1.3 Add base CSS (fetch from content/css)
            const contentCssFiles = await this.resources.fetchContentCss();
            const baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            this.zip.addFile('content/css/base.css', baseCss);

            // 1.4 Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    this.zip.addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 1.5 Add theme files (already pre-fetched in step 1.0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    this.zip.addFile(`theme/${filePath}`, content);
                }
            } else {
                // Add fallback theme if pre-fetch failed
                this.zip.addFile('theme/style.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/style.js', this.getFallbackThemeJs());
            }

            // 1.6 Fetch base libraries (always included - jQuery, Bootstrap, exe_lightbox, etc.)
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    this.zip.addFile(`libs/${libPath}`, content);
                }
            } catch {
                // Base libraries not available - continue anyway
            }

            // 1.6.5 Generate localized i18n file
            const i18nContent = generateI18nScript(meta.language || 'en');
            this.zip.addFile('libs/common_i18n.js', i18nContent);

            // 1.7 Detect and fetch additional required libraries based on content
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                },
            );

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        this.zip.addFile(zipPath, content);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 1.8 Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    // Normalize iDevice type to directory name (e.g., 'FreeTextIdevice' -> 'text')
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Use normalized type for ZIP path
                        this.zip.addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 1.9 Add project assets
            await this.addAssetsToZipWithResourcePath();

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

            // 2.3 Add custom/ directory (empty marker file)
            this.zip.addFile('custom/.gitkeep', '');

            // =========================================================================
            // SECTION 3: Generate final ZIP
            // =========================================================================
            const buffer = await this.zip.generateAsync();

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
