/**
 * PrintPreviewExporter
 *
 * Generates a single-page HTML preview for printing.
 * Wraps PageRenderer (Single Page export logic) and patches paths for browser preview.
 */
import type {
    ExportDocument,
    ExportPage,
    ExportComponent,
    ResourceProvider,
    AssetProvider,
    LatexPreRenderResult,
    MermaidPreRenderResult,
} from '../interfaces';
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { PageRenderer } from '../renderers/PageRenderer';
import { AssetUrlResolver } from '../utils/AssetUrlResolver';
import { visibleWorksheetPages } from '../utils/visibility';
import { isInteractiveActivity } from '../worksheet/interactiveActivities';
import { WORKSHEET_ACTIVITY_STYLES } from '../worksheet/WorksheetRenderer';
import { renderMatchingLayoutScript } from '../worksheet/matchingLayout';
import { captureMolecules, type MoleculeRenderer } from '../worksheet/moleculeCapture';
import { resolveMaterialIconDataUris } from './BaseExporter';
import {
    applyActivityMode,
    PRINTABLE_ACTIVITY_TYPE,
    type ApplyActivityModeOptions,
    type DocumentActivityMode,
} from './printActivityModes';

/**
 * Options for print preview generation
 */
export interface PrintPreviewOptions {
    /** Base path for versioned URLs (e.g., 'http://localhost:3001') */
    baseUrl?: string;
    /** App version for cache busting */
    version?: string;
    /** Base path for URLs (e.g., '/exelearning') */
    basePath?: string;
    /**
     * Full theme URL from the themes manager (e.g., '/v1/site-files/themes/chiquito/')
     * When provided, this is used instead of constructing the path from theme name.
     */
    themeUrl?: string;
    /**
     * Optional hook to pre-render LaTeX expressions to SVG+MathML.
     * When provided and successful, MathJax library will NOT be included in the output.
     */
    preRenderLatex?: (html: string) => Promise<LatexPreRenderResult>;
    /**
     * Optional hook to pre-render LaTeX inside encrypted DataGame divs.
     */
    preRenderDataGameLatex?: (html: string) => Promise<{ html: string; count: number }>;
    /**
     * Optional hook to pre-render Mermaid diagrams to static SVG.
     * When provided and successful, Mermaid library (~2.7MB) will NOT be included.
     */
    preRenderMermaid?: (html: string) => Promise<MermaidPreRenderResult>;
    /**
     * If true, enables auto-print mode (injects print scripts and onload handler).
     */
    printMode?: boolean;
    /**
     * What to do with the project's interactive activities, and the strings to do it with.
     *
     * Left out, the document prints exactly as the browser draws it, which is how printing
     * behaved before there was anything else to choose.
     */
    activities?: ApplyActivityModeOptions & { mode: DocumentActivityMode };
    /**
     * Draws a molecule, for the activity that stores one without a picture of it.
     *
     * Only a browser can; without it those questions print without their molecules.
     */
    captureMolecule?: MoleculeRenderer;
}

/**
 * Result of print preview generation
 */
export interface PrintPreviewResult {
    success: boolean;
    html?: string;
    error?: string;
}

/**
 * PrintPreviewExporter class
 * Generates single-page HTML for printing by wrapping PageRenderer (Single Page export logic)
 * and adapting the output (paths) for browser preview.
 */
export class PrintPreviewExporter {
    private document: ExportDocument;
    private ideviceRenderer: IdeviceRenderer;
    private pageRenderer: PageRenderer;
    private assets: AssetProvider | null;
    private resources: ResourceProvider;
    private assetExportPathMap: Map<string, string> | null = null;
    private assetResolver: AssetUrlResolver;

    /**
     * Create a PrintPreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     * @param assetProvider - Asset provider for resolving asset URLs (optional but recommended)
     */
    constructor(
        document: ExportDocument,
        resourceProvider: ResourceProvider,
        assetProvider: AssetProvider | null = null,
    ) {
        this.document = document;
        this.resources = resourceProvider;
        this.assets = assetProvider;
        this.assetResolver = new AssetUrlResolver(assetProvider);
        // User IdeviceRenderer to render content.
        // We initialize it here to use it for single-page rendering and icon resolution
        this.ideviceRenderer = new IdeviceRenderer();
        this.pageRenderer = new PageRenderer(this.ideviceRenderer);
    }

    /**
     * Generate print preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options: PrintPreviewOptions = {}): Promise<PrintPreviewResult> {
        try {
            const pages = this.document.getNavigation();
            const meta = this.document.getMetadata();

            if (pages.length === 0) {
                return { success: false, error: 'No pages to preview' };
            }

            // Pre-process pages to resolve asset URLs (replace asset://UUID with keys for map)
            let processedPages = await this.preprocessPages(pages);

            // Runtime artifacts may share a legacy timestamp prefix. Printable activities each
            // have their own stored data and selection id, so keep every one the dialog offers.
            processedPages = this.deduplicateComponents(processedPages, options.activities !== undefined);

            // Anything that has to be drawn before it can be printed is drawn first: converting an
            // activity into an exercise is synchronous and has no browser to draw with.
            if (options.activities && options.captureMolecule) {
                processedPages = await this.captureDrawings(processedPages, options.captureMolecule);
            }

            // Carry out what the user chose to do with the interactive activities. This works on
            // the page model, so everything below renders it as it would any other document.
            // Asset URLs are already resolved by this point, which is what lets a converted
            // activity keep its pictures.
            if (options.activities) {
                processedPages = applyActivityMode(processedPages, options.activities.mode, options.activities);
            }

            // Fetch theme files and configure icon resolution (from main)
            const themeName = meta.theme || 'base';
            try {
                const themeFilesMap = await this.resources.fetchTheme(themeName);
                this.ideviceRenderer.setThemeIconFiles(themeFilesMap);
            } catch {
                // Theme fetch not available - icons will use .png fallback
            }

            const usedIdevices = this.getUsedIdevices(processedPages);
            const { dataUris: materialIconDataUris } = await resolveMaterialIconDataUris(
                this.resources,
                processedPages,
            );

            // Access version safely from window object
            const windowConfig =
                typeof window !== 'undefined'
                    ? (window as unknown as { eXeLearning?: { config?: { version?: string } } })
                    : undefined;
            const version = windowConfig?.eXeLearning?.config?.version || 'v1.0.0';

            // Generate the single-page HTML components using PageRenderer
            // This ensures we use the exact same logic as the "Single Page" export
            let html = this.pageRenderer.renderSinglePage(processedPages, {
                projectTitle: meta.title || 'eXeLearning',
                projectSubtitle: meta.subtitle || '',
                language: meta.language || 'en',
                customStyles: meta.customStyles || '',
                usedIdevices,
                author: meta.author || '',
                license: meta.license || '',
                addExeLink: meta.addExeLink ?? true,
                userFooterContent: meta.footer || '',
                version, // From browser context
                assetExportPathMap: this.assetExportPathMap || undefined,
                materialIconDataUris,
                printContext: { kind: 'document', activities: options.activities?.mode ?? null },
            });

            // Post-process HTML:
            // 1. Pre-render LaTeX/Mermaid (if hooks provided)
            html = await this.preRenderContent(html, meta, options);

            // 2. Patch relative paths (libs/, theme/) to server absolute paths
            html = this.patchPathsForServer(html, meta.theme || 'base', usedIdevices, options);

            // 2b. Resolve any remaining content/resources or asset:// URLs to blob URLs.
            // Block header custom icons are generated at render time, so they are not covered
            // by the page/component preprocess step above.
            html = await this.resolveAssetUrls(html);

            // 3. Make hidden feedback elements visible (remove display: none)
            html = this.revealFeedback(html);

            // 4. Hide unwanted print elements (versions, bns, map images)
            html = this.hidePrintExtras(html);

            // 5. Inject styles to avoid horizontal scroll
            // Calculate logo URL for fix (same logic as patchPathsForServer)
            const baseUrl = options.baseUrl || '';
            const basePath = options.basePath || '';
            // Determine version (priority: options > window > default)
            let versionStr = options.version;
            if (versionStr === undefined) {
                versionStr = version !== 'v1.0.0' ? version : undefined;
            }
            // If version is still undefined/null, default to nothing or v1.0.0 depending on logic.
            // patchPathsForServer uses options.version ?? 'v1.0.0' logic roughly.
            // Let's use the exact same logic helper if possible, or replicate:
            const effectiveVersion = options.version ?? version; // Use window version if options not present

            const getPath = (path: string) => {
                const cleanPath = path.startsWith('/') ? path.slice(1) : path;
                const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
                // If version is provided/detected, include it
                if (effectiveVersion && effectiveVersion !== 'v1.0.0') {
                    return `${baseUrl}${cleanBasePath}/${effectiveVersion}/${cleanPath}`;
                }
                // Default to no version in path if v1.0.0 or missing (usually dev)
                // NOTE: build-static-bundle usually puts everything under version folder?
                // patchPathsForServer logic:
                // if (!version) return ... else return .../${version}/...
                // It used `options.version === undefined ? 'v1.0.0' : options.version`
                // and checked `if (!version)` (which is never true if it defaults to v1.0.0 string?)
                // Wait, patchPathsForServer uses local scope version variable.

                // Replicating patchPathsForServer logic exactly:
                const v = options.version === undefined ? 'v1.0.0' : options.version;
                // If v exists (it always does due to default), it appends it?
                // No, check patchPathsForServer:
                // const version = options.version === undefined ? 'v1.0.0' : options.version;
                // if (!version) ...
                // 'v1.0.0' is truthy. So it always appends version?
                // Actually, let's look at patchPathsForServer implementation I saw earlier.
                return `${baseUrl}${cleanBasePath}/${v}/${cleanPath}`;
            };

            const logoUrl = getPath('app/common/exe_powered_logo/exe_powered_logo.png');
            // Only a mode that puts exercises in the document needs their styling.
            const convertsActivities = options.activities !== undefined && options.activities.mode !== 'omit';
            html = this.injectPreviewStyles(html, logoUrl, convertsActivities);

            // 4. Inject Print scripts and CSS (if printMode)
            if (options.printMode) {
                html = this.injectPrintSpecifics(html);
            } else {
                // Even in normal preview mode, we need to force init scripts because window.eXeLearning is defined
                html = this.injectInitScripts(html);
            }
            return { success: true, html };
        } catch (error) {
            console.error('PrintPreview generate error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Draw whatever has to exist as a picture before an activity can be converted.
     *
     * Walks the components rather than the rendered HTML, because the conversion happens on the
     * page model and needs the drawing already in place. Pages are copied, never mutated.
     *
     * One component at a time: a drawing may need a graphics context, and a browser hands out only
     * a handful of those at once — a project with a dozen molecules in it would run dry partway
     * through if they were all drawn together.
     */
    private async captureDrawings(pages: ExportPage[], render: MoleculeRenderer): Promise<ExportPage[]> {
        const captured: ExportPage[] = [];

        // The navigation is flat by the time it gets here, which is also what the conversion that
        // follows walks.
        for (const page of pages) {
            const blocks = [];
            for (const block of page.blocks || []) {
                const components = [];
                for (const component of block.components || []) {
                    components.push({ ...component, content: await captureMolecules(component.content || '', render) });
                }
                blocks.push({ ...block, components });
            }
            captured.push({ ...page, blocks });
        }

        return captured;
    }

    /**
     * Filter out pages that are marked as not visible in export
     */
    private filterVisiblePages(pages: ExportPage[]): ExportPage[] {
        return (
            visibleWorksheetPages(pages)
                // Recursively filter children (though ExportPage definition implies flat list,
                // if PageRenderer handles hierarchy via other means, this is safe for future proofing
                // or if ExportPage has children property not shown in interface file but present in runtime)
                .map(page => {
                    // Clone page to avoid mutation
                    const newPage = { ...page };
                    if (newPage.children && Array.isArray(newPage.children)) {
                        newPage.children = this.filterVisiblePages(newPage.children);
                    }
                    return newPage;
                })
        );
    }

    /**
     * Inject styles to force content to fit within the page width
     */
    private injectPreviewStyles(html: string, logoUrl?: string, includeActivityStyles = false): string {
        const logoCss = logoUrl
            ? `
/* Fix for eXe logo 404 */
#made-with-eXe a {
    background-image: url("${logoUrl}") !important;
}`
            : '';

        const styles = `
<style>
/* PREVIEW MODE (Screen) */
/* Create space around the document in preview mode */
body {
    padding: 40px;
    background-color: #f5f5f5; /* Light grey background for the "paper" effect */
}
/* The page content acts as the paper */
.exe-single-page {
    background-color: white;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    max-width: 210mm; /* A4 width approx */
    margin: 0 auto;
    padding: 20mm; /* A4 margins approx */
    box-sizing: border-box;
}

/* Force content to fit within the page (no horizontal scroll) */
img, figure, video, object, iframe, table, svg, canvas {
    max-width: 100%;
    height: auto;
    box-sizing: border-box;
}
/* Ensure figures behave responsively */
figure {
    margin: 1em 0;
}
figure img {
    max-width: 100%;
    height: auto;
}
/* Fix for specific eXe layout issues */
.iDevice_content {
    overflow-x: auto;
}

/* FIX: Force visibility globally (Screen & Print) */
/* The div with coordinates in Map iDevice should be visible even if js-hidden */
.mapa-LinkTextsPoints,
.js-hidden.mapa-LinkTextsPoints,
.js .js-hidden.mapa-LinkTextsPoints,
.mapa-IDevice .js-hidden.mapa-LinkTextsPoints {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
}

/* Force visibility for Definition List descriptions */
.js .exe-dl dd {
    display: block !important;
}

/* Force visibility for UDL Content Blocks */
.exe-udlContent-block,.exe-udlContent-block.js-hidden,
.js .exe-udlContent-block.js-hidden {
    display: block !important;
}

/* PRINT MODE */
@media print {
    /* Reset preview-specific styles */
    body {
        padding: 0 !important;
        background-color: transparent !important;
        overflow: visible !important;
        height: auto !important;
    }
    .exe-single-page {
        box-shadow: none !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    /* 1. Avoid cutting images between pages */
    img, figure, video, object, iframe, table, svg, canvas {
        max-width: 100% !important;
        height: auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    
    pre, blockquote {
        page-break-inside: avoid;
        break-inside: avoid;
        white-space: pre-wrap;
    }

    /* 2. Hide Title and Subtitle (Header) */
    /* The main header contains the project title and subtitle */
    /* Ensure package header (Project Title) is visible on the first page only */
    .package-header {
        display: block !important;
        visibility: visible !important; 
        position: static !important; /* Ensure it flows normally */
    }

    /* Hide individual page headers if needed, or other decorations */
    #nodeDecoration { 
        display: none !important; 
    }

    /* Hide navigation in print mode */
    #siteNav, .single-page-nav { display: none !important; }
    
    #made-with-eXe { display: none; }
    
    .single-page-section {
        page-break-inside: avoid;
        break-inside: avoid;
        border-bottom: none;
    }
}

/* Force visibility for feedback elements even if JS tries to hide them */
.feedback.js-hidden {
    display: block !important;
}
${logoCss}
${includeActivityStyles ? WORKSHEET_ACTIVITY_STYLES : ''}
</style>
`;
        return html.replace('</head>', `${styles}${includeActivityStyles ? renderMatchingLayoutScript() : ''}</head>`);
    }

    /**
     * Pre-process pages to resolve asset URLs
     * Replaces asset://UUID with content/resources/FILENAME
     */
    private async preprocessPages(pages: ExportPage[]): Promise<ExportPage[]> {
        if (!this.assets) return this.filterVisiblePages(pages);

        // Build path map if not already done
        if (!this.assetExportPathMap) {
            await this.buildAssetExportPathMap();
        }

        // Filter out hidden pages
        const visiblePages = this.filterVisiblePages(pages);

        // Note: filterVisiblePages returns shallow copies, but preprocessPages was deep cloning.
        // Let's do a deep clone of the filtered result to be safe and consistent with previous logic
        const clonedPages: ExportPage[] = JSON.parse(JSON.stringify(visiblePages));

        for (const page of clonedPages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        component.content = await this.resolveAssetUrls(component.content);
                    }
                    if (component.properties) {
                        const propsStr = JSON.stringify(component.properties);
                        const processedStr = await this.resolveAssetUrls(propsStr);
                        component.properties = JSON.parse(processedStr);
                    }
                }
            }
        }
        return clonedPages;
    }

    /**
     * Resolve asset:// and content/resources/ URLs to Blob URLs
     */
    private async resolveAssetUrls(content: string): Promise<string> {
        return this.assetResolver.resolve(content);
    }

    /**
     * Build map of asset UUIDs to Blob URLs
     */
    private async buildAssetExportPathMap(): Promise<void> {
        if (!this.assets) {
            console.warn('[PrintPreviewExporter] No assets provider available');
            return;
        }

        await this.assetResolver.build();
        this.assetExportPathMap = this.assetResolver.getExportPathMap() ?? null;
    }

    /**
     * Get all unique iDevice types used in pages
     *
     * A component holding a converted activity is left out: it carries finished markup, so
     * listing it here would ask the document for an iDevice script and stylesheet that do not
     * exist.
     */
    private getUsedIdevices(pages: ExportPage[]): string[] {
        const types = new Set<string>();
        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.type && component.type !== PRINTABLE_ACTIVITY_TYPE) {
                        types.add(component.type);
                    }
                }
            }
        }
        return Array.from(types);
    }

    /**
     * Pre-render dynamic content (LaTeX, Mermaid) using provided hooks
     */
    private async preRenderContent(
        html: string,
        meta: ReturnType<ExportDocument['getMetadata']>,
        options: PrintPreviewOptions,
    ): Promise<string> {
        let finalHtml = html;

        // LaTeX Pre-rendering
        if (!meta.addMathJax) {
            if (options.preRenderDataGameLatex) {
                try {
                    const result = await options.preRenderDataGameLatex(finalHtml);
                    if (result.count > 0) finalHtml = result.html;
                } catch (e) {
                    console.warn('DataGame LaTeX pre-render error:', e);
                }
            }
            if (options.preRenderLatex) {
                try {
                    const result = await options.preRenderLatex(finalHtml);
                    if (result.latexRendered) finalHtml = result.html;
                } catch (e) {
                    console.warn('LaTeX pre-render error:', e);
                }
            }
        }

        // Mermaid Pre-rendering
        if (options.preRenderMermaid) {
            try {
                const result = await options.preRenderMermaid(finalHtml);
                if (result.mermaidRendered) {
                    finalHtml = result.html;
                    console.log(`[PrintPreview] Pre-rendered ${result.count} Mermaid diagrams`);
                }
            } catch (e) {
                console.warn('Mermaid pre-render error:', e);
            }
        }

        return finalHtml;
    }

    /**
     * Patch relative paths generated by PageRenderer to point to server resources
     */
    private patchPathsForServer(
        html: string,
        themeName: string,
        usedIdevices: string[],
        options: PrintPreviewOptions,
    ): string {
        const baseUrl = options.baseUrl || '';
        const basePath = options.basePath || '';
        const version = options.version;

        const getPath = (path: string) => {
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

            // Only include version in path if it is explicitly defined and not empty
            // This fixes issues where 'v1.0.0' was being forced into paths that didn't need it
            if (version && version !== 'v1.0.0') {
                return `${baseUrl}${cleanBasePath}/${version}/${cleanPath}`;
            }

            return `${baseUrl}${cleanBasePath}/${cleanPath}`;
        };

        let processed = html;

        // Path Mappings
        const mappings: Record<string, string> = {
            // Core libraries (in zip: libs/ -> on server: /app/common/ or /libs/)
            'libs/jquery/jquery.min.js': getPath('libs/jquery/jquery.min.js'),
            'libs/bootstrap/bootstrap.bundle.min.js': getPath('libs/bootstrap/bootstrap.bundle.min.js'),
            'libs/bootstrap/bootstrap.min.css': getPath('libs/bootstrap/bootstrap.min.css'),
            'libs/common.js': getPath('app/common/common.js'),
            'libs/common_i18n.js': getPath('app/common/common_i18n.js'),
            'libs/exe_export.js': getPath('app/common/exe_export.js'),
            'libs/exe_math/tex-mml-svg.js': getPath('app/common/exe_math/tex-mml-svg.js'),
            'libs/favicon.ico': getPath('favicon.ico'),

            // Base CSS
            'content/css/base.css': getPath('style/workarea/base.css'), // Fallback/Core CSS

            // Theme (in zip: theme/ -> on server: /files/perm/themes/base/...)
            'theme/style.css': options.themeUrl
                ? `${options.themeUrl.replace(/\/$/, '')}/style.css`
                : getPath(`files/perm/themes/base/${themeName}/style.css`),
            'theme/style.js': options.themeUrl
                ? `${options.themeUrl.replace(/\/$/, '')}/style.js`
                : getPath(`files/perm/themes/base/${themeName}/style.js`),

            // Highlighter (exe_highlighter)
            // PageRenderer outputs libs/exe_highlighter/...
            // Server has it in app/common/exe_highlighter/...
            'libs/exe_highlighter/exe_highlighter.js': getPath('app/common/exe_highlighter/exe_highlighter.js'),
            'libs/exe_highlighter/exe_highlighter.css': getPath('app/common/exe_highlighter/exe_highlighter.css'),

            // ABC Music (abcjs)
            // PageRenderer outputs libs/abcjs/...
            // Server has it in libs/abcjs/... (direct mapping to public/libs)
            'libs/abcjs/abcjs-basic-min.js': getPath('libs/abcjs/abcjs-basic-min.js'),
            'libs/abcjs/exe_abc_music.js': getPath('libs/abcjs/exe_abc_music.js'),
            'libs/abcjs/abcjs-audio.css': getPath('libs/abcjs/abcjs-audio.css'),
        };

        // Apply direct string replacements
        for (const [key, value] of Object.entries(mappings)) {
            // Replace refs in src="..." and href="..."
            processed = processed.replaceAll(`src="${key}"`, `src="${value}"`);
            processed = processed.replaceAll(`href="${key}"`, `href="${value}"`);
        }

        // Handle iDevice resources (in zip: idevices/ -> on server: /files/perm/idevices/base/...)
        const serverIdeviceBase = getPath('files/perm/idevices/base/');

        // Regex to match ANY "src" or "href" containing "idevices/"
        // We capture the full attribute content and parse it manually for robustness

        // Added handling for potential whitespace around '='
        // Updated to include data-idevice-path and handle directory paths
        const idevicePattern = /(src|href|data-idevice-path)\s*=\s*["']([^"']*idevices\/[^"']*)["']/gi;

        processed = processed.replace(idevicePattern, (match, attr, content) => {
            // 1. Remove ignore check for 'files/perm/idevices' to fix broken absolute/versioned paths
            // if (content.includes('files/perm/idevices')) return match;

            // 2. Extract the part after 'idevices/'
            // Content might be "idevices/identify/home.png"
            // OR "/v1/files/perm/idevices/base/identify/export/home.png"
            const parts = content.split('idevices/');
            if (parts.length < 2) return match;

            let relativePart = parts[1]; // e.g. "identify/home.png" or "base/identify/export/home.png"

            // Remove leading slashes if any
            if (relativePart.startsWith('/')) relativePart = relativePart.substring(1);

            const segments = relativePart.split('/');

            // Handle 'base/' prefix if present (common in server paths)
            let typeIndex = 0;
            if (segments[0] === 'base') {
                typeIndex = 1;
            }

            // We need at least TYPE/FILE (2 segments after base)
            if (segments.length < typeIndex + 1) return match;

            const type = segments[typeIndex];
            let rest = segments.slice(typeIndex + 1).join('/');

            // 3. Remove 'export/' prefix if present in the file part to avoid duplication
            if (rest.startsWith('export/')) {
                rest = rest.substring(7);
            }

            const file = rest;

            // Force reconstruction using the correct local server base
            const suffix = file ? `export/${file}` : 'export/';

            return `${attr}="${serverIdeviceBase}${type}/${suffix}"`;
        });

        // Fallback for simple 'idevices/' replacement if regex doesn't match specific structure
        processed = processed.replaceAll('src="idevices/', `src="${serverIdeviceBase}`);
        processed = processed.replaceAll('href="idevices/', `href="${serverIdeviceBase}`);

        // Handle content/resources/ (assets) -> server path
        // This is crucial for previewing images/media in Blob/iframe
        const serverResourceBase = getPath('content/resources/');
        // Replace src="content/resources/FILE" with src="SERVER_BASE/FILE"
        // Also href="..."
        // We use a regex to capture filenames to avoid double-slash issues if any

        const resourcePattern = /(src|href)=["'](?:(?:https?:\/\/[^/]+)?\/)?content\/resources\/([^"']+)["']/g;
        processed = processed.replace(resourcePattern, (match, attr, filename) => {
            return `${attr}="${serverResourceBase}${filename}"`;
        });

        return processed;
    }

    /**
     * Inject scripts/CSS required for the in-window Print Overlay
     */
    private injectPrintSpecifics(html: string): string {
        const printScript = `
<script>
window.onload = function() {
    // Force init for Print Preview (since window.eXeLearning is defined, auto-init doesn't run)
    if (typeof $exeABCmusic !== 'undefined' && typeof $exeABCmusic.init === 'function') {
         $exeABCmusic.init();
    }
    if (typeof $exeHighlighter !== 'undefined' && typeof $exeHighlighter.init === 'function') {
         $exeHighlighter.init();
    }

    setTimeout(function() {
        window.print();
    }, 1000);
};
</script>
<style>
/* Inject Single Page CSS (normally loaded from content/css/single-page.css in export) */
.exe-single-page .single-page-section {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 40px;
  margin-bottom: 40px;
}

.exe-single-page .single-page-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.exe-single-page .single-page-nav {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.exe-single-page .single-page-content {
  padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

@media print {
    /* Hide navigation in print mode (matches user request) */
    #siteNav, .single-page-nav { display: none !important; }
    
    #made-with-eXe { display: none; }
    /* Ensure no scrollbars in print */
    body { overflow: visible !important; height: auto !important; }
    
    .single-page-section {
        page-break-inside: avoid;
        border-bottom: none;
    }
}
/* Ensure overlay content fits */
html, body { height: 100%; margin: 0; padding: 0; }
</style>
`;
        return html.replace('</body>', `${printScript}</body>`);
    }

    /**
     * Inject specific initialization scripts without print dialog
     */
    private injectInitScripts(html: string): string {
        const initScript = `
<script>
$(function() {
    // Force init for Print Preview (since window.eXeLearning is defined, auto-init doesn't run)
    if (typeof $exeABCmusic !== 'undefined' && typeof $exeABCmusic.init === 'function') {
         $exeABCmusic.init();
    }
    if (typeof $exeHighlighter !== 'undefined' && typeof $exeHighlighter.init === 'function') {
         $exeHighlighter.init();
    }
});
</script>
`;
        return html.replace('</body>', `${initScript}</body>`);
    }

    /**
     * Reveal hidden feedback elements by removing display: none style
     * Targets divs with classes 'feedback' and 'js-hidden'
     */
    private revealFeedback(html: string): string {
        // Regex to match opening div tags
        return html.replace(/<div([^>]*)>/gi, (match, attributes) => {
            // Check if it has the required classes
            // We look for class="..." containing both 'feedback' and 'js-hidden'
            const classMatch = /class=["']([^"']*)["']/i.exec(attributes);
            if (!classMatch) return match;

            const classes = classMatch[1].split(/\s+/);
            if (classes.includes('feedback') && classes.includes('js-hidden')) {
                // It's a feedback div. Remove display properties from inline style
                // Replace style="..." completely if it checks out, or just modify content
                const newAttributes = attributes.replace(/style=(["'])(.*?)\1/i, (styleMatch, quote, styleContent) => {
                    // Remove display: none (case insensitive, optional space, optional semicolon)
                    // Also robust against 'display:none' without space
                    const newStyle = styleContent.replace(/display:\s*none;?/gi, '').trim();
                    // If style is empty after removal, we can return empty string or style=""
                    return newStyle ? `style=${quote}${newStyle}${quote}` : '';
                });
                return `<div${newAttributes}>`;
            }

            return match;
        });
    }

    /**
     * Deduplicate consecutive components that share the same type and ID prefix (timestamp)
     * This handles cases like 'Complete' iDevice where it splits into multiple components
     * but we only want to show the first one in print.
     */
    private deduplicateComponents(pages: ExportPage[], preserveInteractiveActivities = false): ExportPage[] {
        return pages.map(page => {
            const blocks = page.blocks || [];
            const newBlocks = blocks.map(block => {
                const components = block.components || [];
                const uniqueComponents: ExportComponent[] = [];
                let lastComponent: ExportComponent | null = null;

                for (const component of components) {
                    let isDuplicate = false;

                    if (
                        lastComponent &&
                        lastComponent.type === component.type &&
                        !(preserveInteractiveActivities && isInteractiveActivity(component.type))
                    ) {
                        // Check ID prefix (first 14 chars are usually timestamp YYYYMMDDHHMMSS)
                        // Example ID: 20251021091936ZBADPV
                        const prefixLength = 14;
                        if (
                            lastComponent.id &&
                            component.id &&
                            lastComponent.id.substring(0, prefixLength) === component.id.substring(0, prefixLength)
                        ) {
                            isDuplicate = true;
                        }
                    }

                    if (!isDuplicate) {
                        uniqueComponents.push(component);
                        lastComponent = component;
                    }
                }

                return {
                    ...block,
                    components: uniqueComponents,
                };
            });

            return {
                ...page,
                blocks: newBlocks,
                // ExportPage is flat list, no children property
            };
        });
    }

    /**
     * Hide specific elements from print preview based on class patterns
     * - divs with class ending in -version or -bns AND js-hidden
     * - imgs/links with class containing 'image', 'audio', 'video' AND js-hidden
     * - specific classes: exe-mindmap-code, form-Data, completa-DataGame
     */
    private hidePrintExtras(html: string): string {
        return html.replace(/<(div|img|a|p)([^>]*)>/gi, (match, tagName, attributes) => {
            const classMatch = /class=["']([^"']*)["']/i.exec(attributes);
            if (!classMatch) return match;

            const classes = classMatch[1].split(/\s+/);
            const lowerTagName = tagName.toLowerCase();
            let shouldHide = false;

            // 1. Check specific classes that don't depend on js-hidden
            // "The text that starts with that tag <p class="exe-mindmap-code">"
            if (lowerTagName === 'p' && classes.includes('exe-mindmap-code')) {
                shouldHide = true;
            }

            // 2. Checks that require js-hidden
            if (!shouldHide && classes.includes('js-hidden')) {
                if (lowerTagName === 'div') {
                    // Check for classes that match *-version or *-bns
                    // Regex for class: /.+-(version|bns)$/
                    if (classes.some(c => /.+-(version|bns)$/i.test(c))) {
                        shouldHide = true;
                    }
                    // Specific divs requested: form-Data, completa-DataGame
                    if (classes.includes('form-Data') || classes.includes('completa-DataGame')) {
                        shouldHide = true;
                    }
                } else if (lowerTagName === 'img' || lowerTagName === 'a') {
                    // Check for classes containing 'image', 'audio', 'video' (case insensitive)
                    if (classes.some(c => /image|audio|video/i.test(c))) {
                        shouldHide = true;
                    }
                }
            }

            if (shouldHide) {
                // Inject style="display: none !important"
                // Check if style attribute exists
                if (/style=(["'])/i.test(attributes)) {
                    return match.replace(/style=(["'])(.*?)\1/i, (m, q, c) => {
                        return `style=${q}${c}; display: none !important;${q}`;
                    });
                } else {
                    return `<${tagName} ${attributes} style="display: none !important">`;
                }
            }

            return match;
        });
    }
}
