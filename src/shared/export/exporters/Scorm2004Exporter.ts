/**
 * Scorm2004Exporter
 *
 * Exports a document to SCORM 2004 (4th Edition) package format (ZIP).
 *
 * SCORM 2004 export creates:
 * - imsmanifest.xml (SCORM 2004 manifest with sequencing)
 * - imslrm.xml (LOM metadata)
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries + SCORM 2004 API wrapper)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult, FaviconInfo } from '../interfaces';
import { Html5Exporter } from './Html5Exporter';
import { Scorm2004ManifestGenerator } from '../generators/Scorm2004Manifest';
import { LomMetadataGenerator } from '../generators/LomMetadata';
import { ODE_DTD_FILENAME, ODE_DTD_CONTENT } from '../constants';
import { generateI18nScript } from '../generators/I18nGenerator';

export class Scorm2004Exporter extends Html5Exporter {
    protected manifestGenerator: Scorm2004ManifestGenerator | null = null;
    protected lomGenerator: LomMetadataGenerator | null = null;

    /**
     * Get file suffix for SCORM 2004 format
     */
    getFileSuffix(): string {
        return '_scorm2004';
    }

    /**
     * Export to SCORM 2004 ZIP
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = options?.theme || meta.theme || 'base';
            const projectId = this.generateProjectId();

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // Initialize generators
            this.manifestGenerator = new Scorm2004ManifestGenerator(projectId, pages, {
                title: meta.title || 'eXeLearning',
                language: meta.language || 'en',
                author: meta.author || '',
                description: meta.description || '',
                license: meta.license || '',
            });

            this.lomGenerator = new LomMetadataGenerator(projectId, {
                title: meta.title || 'eXeLearning',
                language: meta.language || 'en',
                author: meta.author || '',
                description: meta.description || '',
                license: meta.license || '',
            });

            // Track files for manifest
            const commonFiles: string[] = [];
            const pageFiles: Record<string, { fileUrl: string; files: string[] }> = {};

            // 0. Pre-fetch theme to get the list of CSS/JS files for HTML includes
            const { themeFilesMap, themeRootFiles, faviconInfo } = await this.prepareThemeData(themeName);

            // 1. Generate HTML pages (with SCORM 2004 support and optional LaTeX pre-rendering)
            let latexWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const isIndex = i === 0;
                let html = this.generateScorm2004PageHtml(
                    page,
                    pages,
                    meta,
                    isIndex,
                    themeRootFiles,
                    i,
                    faviconInfo,
                    pageFilenameMap,
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                // When MathJax is included, let it process LaTeX at runtime for full UX (context menu, accessibility)
                if (!meta.addMathJax && options?.preRenderLatex) {
                    try {
                        const result = await options.preRenderLatex(html);
                        if (result.latexRendered) {
                            html = result.html;
                            latexWasRendered = true;
                            console.log(
                                `[Scorm2004Exporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[Scorm2004Exporter] LaTeX pre-render failed for page:', page.title, error);
                    }
                }

                // Use unique filename from the map (handles title collisions)
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const pageFilename = isIndex ? 'index.html' : `html/${uniqueFilename}`;
                this.zip.addFile(pageFilename, html);

                pageFiles[page.id] = {
                    fileUrl: pageFilename,
                    files: [],
                };
            }

            // Note: SCORM exports do NOT include search_index.js
            // The LMS handles navigation, so client-side search is not needed

            // 2. Add base CSS (fetch from content/css) and pre-rendered LaTeX CSS
            const contentCssFiles = await this.resources.fetchContentCss();
            let baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            // Append pre-rendered LaTeX CSS if LaTeX was rendered
            if (latexWasRendered) {
                const latexCss = this.getPreRenderedLatexCss();
                const decoder = new TextDecoder();
                const baseCssText = decoder.decode(baseCss);
                const encoder = new TextEncoder();
                baseCss = encoder.encode(baseCssText + '\n' + latexCss);
            }
            this.zip.addFile('content/css/base.css', baseCss);
            commonFiles.push('content/css/base.css');

            // 3. Add theme files (already pre-fetched in step 0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    this.zip.addFile(`theme/${filePath}`, content);
                    commonFiles.push(`theme/${filePath}`);
                }
            } else {
                this.zip.addFile('theme/style.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/style.js', this.getFallbackThemeJs());
                commonFiles.push('theme/style.css', 'theme/style.js');
            }

            // 4. Fetch and add base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    this.zip.addFile(`libs/${path}`, content);
                    commonFiles.push(`libs/${path}`);
                }
            } catch {
                // No base libraries available
            }

            // 4.5. Generate localized i18n file
            const i18nContent = generateI18nScript(meta.language || 'en');
            this.zip.addFile('libs/common_i18n.js', i18nContent);
            commonFiles.push('libs/common_i18n.js');

            // 5. Fetch SCORM 2004 API wrapper files
            try {
                const scormFiles = await this.resources.fetchScormFiles('2004');
                for (const [filePath, content] of scormFiles) {
                    this.zip.addFile(`libs/${filePath}`, content);
                    commonFiles.push(`libs/${filePath}`);
                }
            } catch {
                // Add fallback SCORM files
                this.zip.addFile('libs/SCORM_API_wrapper.js', this.getScorm2004ApiWrapper());
                this.zip.addFile('libs/SCOFunctions.js', this.getSco2004Functions());
                commonFiles.push('libs/SCORM_API_wrapper.js', 'libs/SCOFunctions.js');
            }

            // 5b. Copy content.xml and DTD (always include for re-editing capability)
            try {
                const contentXml = await this.getContentXml();
                if (contentXml) {
                    this.zip.addFile('content.xml', contentXml);
                    commonFiles.push('content.xml');
                    this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
                    commonFiles.push(ODE_DTD_FILENAME);
                }
            } catch {
                // content.xml is optional
            }

            // 6. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [path, content] of ideviceFiles) {
                        this.zip.addFile(`idevices/${idevice}/${path}`, content);
                        commonFiles.push(`idevices/${idevice}/${path}`);
                    }
                } catch {
                    // Many iDevices don't have extra files
                }
            }

            // 7. Add project assets
            await this.addAssetsToZipWithResourcePath();

            // 8. Generate imslrm.xml (LOM metadata) - must be before manifest
            const lomXml = this.lomGenerator.generate();
            this.zip.addFile('imslrm.xml', lomXml);

            // 9. Generate imsmanifest.xml with complete file list
            // Get all files from the ZIP to ensure the manifest lists ALL resources
            const allZipFiles = this.zip.getFilePaths();
            const manifestXml = this.manifestGenerator.generate({
                commonFiles,
                pageFiles,
                allZipFiles,
            });
            this.zip.addFile('imsmanifest.xml', manifestXml);

            // 10. Generate ZIP buffer
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

    /**
     * Generate project ID for SCORM package
     */
    generateProjectId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    /**
     * Generate SCORM 2004-enabled HTML page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     * @param pageIndex - Index of the current page (for page counter)
     * @param faviconInfo - Favicon info (optional)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     */
    generateScorm2004PageHtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        themeFiles?: string[],
        pageIndex?: number,
        faviconInfo?: FaviconInfo | null,
        pageFilenameMap?: Map<string, string>,
    ): string {
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);

        return this.pageRenderer.render(page, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: meta.language || 'en',
            theme: meta.theme || 'base',
            customStyles: meta.customStyles || '',
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || '',
            // Export options - SCORM specific overrides
            // SCORM/IMS exports don't use client-side search - LMS handles navigation
            addSearchBox: false,
            // Force page counter for SCORM
            addPagination: true,
            totalPages: allPages.length,
            currentPageIndex: pageIndex ?? 0,
            // SCORM 2004-specific options
            isScorm: true,
            scormVersion: '2004',
            bodyClass: 'exe-export exe-scorm exe-scorm2004',
            extraHeadScripts: this.getScorm2004HeadScripts(basePath),
            onLoadScript: 'loadPage()',
            onUnloadScript: 'unloadPage()',
            // Hide navigation elements - LMS handles navigation in SCORM
            hideNavigation: true,
            hideNavButtons: true,
            // Theme files for HTML head includes
            themeFiles: themeFiles || [],
            // Favicon options
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Page filename map for navigation links (handles title collisions)
            pageFilenameMap,
        });
    }

    /**
     * Get SCORM 2004-specific head scripts
     */
    getScorm2004HeadScripts(basePath: string): string {
        return `<script src="${basePath}libs/SCORM_API_wrapper.js"></script>
<script src="${basePath}libs/SCOFunctions.js"></script>`;
    }

    /**
     * Get SCORM 2004 API wrapper (fallback)
     */
    getScorm2004ApiWrapper(): string {
        return `/**
 * SCORM 2004 API Wrapper
 * Minimal implementation for SCORM 2004 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "2004",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API_1484_11 && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API_1484_11 || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.Initialize("");
    if (success === "true" || success === true) {
      this.connection.isActive = true;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Terminate("");
    if (success === "true" || success === true) {
      this.connection.isActive = false;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.GetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.SetValue(parameter, value);
    success = (success === "true" || success === true);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Commit("");
    success = (success === "true" || success === true);
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
    }

    /**
     * Get SCO Functions for SCORM 2004 (fallback)
     */
    getSco2004Functions(): string {
        return `/**
 * SCO Functions for SCORM 2004
 * Page load/unload handlers for SCORM 2004 communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.completion_status");
    if (status === "not attempted" || status === "unknown" || status === "") {
      scorm.set("cmi.completion_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.set("cmi.exit", "suspend");
    scorm.save();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    // SCORM 2004 uses ISO 8601 duration format
    var seconds = Math.round(elapsed / 1000);
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds - hours * 3600) / 60);
    var secs = seconds - hours * 3600 - mins * 60;
    // Format: PT#H#M#S
    var sessionTime = "PT" + hours + "H" + mins + "M" + secs + "S";
    scorm.set("cmi.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.completion_status", "completed");
  scorm.set("cmi.success_status", "passed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.completion_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  // SCORM 2004 score must be between 0 and 1
  var scaledScore = maxScore ? score / maxScore : score / 100;
  scorm.set("cmi.score.scaled", scaledScore);
  scorm.set("cmi.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.score.min", minScore);
  scorm.save();
}
`;
    }

    /**
     * Get content.xml from the document for inclusion in SCORM package
     * This allows the package to be re-edited in eXeLearning
     */
    protected async getContentXml(): Promise<string | null> {
        // Try to get content.xml from the document adapter
        if ('getContentXml' in this.document && typeof this.document.getContentXml === 'function') {
            return (this.document as { getContentXml: () => Promise<string | null> }).getContentXml();
        }
        return null;
    }
}
