/**
 * PrintPreviewExporter
 *
 * Generates a single-page HTML preview for printing.
 * Wraps PageRenderer (Single Page export logic) and patches paths for browser preview.
 */
import type {
    ExportDocument,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    LatexPreRenderResult,
    MermaidPreRenderResult,
} from '../interfaces';
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { PageRenderer } from '../renderers/PageRenderer';

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
    private assetExportPathMap: Map<string, string> | null = null;

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
        this.assets = assetProvider;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error - resourceProvider usage pending refactor of IdeviceRenderer
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
            const processedPages = await this.preprocessPages(pages);

            const usedIdevices = this.getUsedIdevices(processedPages);

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
            });

            // Post-process HTML:
            // 1. Pre-render LaTeX/Mermaid (if hooks provided)
            html = await this.preRenderContent(html, meta, options);

            // 2. Patch relative paths (libs/, theme/) to server absolute paths
            html = this.patchPathsForServer(html, meta.theme || 'base', usedIdevices, options);

            // 3. Inject styles to avoid horizontal scroll
            html = this.injectPreviewStyles(html);

            // 4. Inject Print scripts and CSS (if printMode)
            if (options.printMode) {
                html = this.injectPrintSpecifics(html);
            }
            return { success: true, html };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Inject styles to force content to fit within the page width
     */
    private injectPreviewStyles(html: string): string {
        const styles = `
<style>
/* Force content to fit within the page (no horizontal scroll) */
img, figure, video, object, iframe, table {
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
@media print {
    img, figure, video, object, iframe, table {
        max-width: 100% !important;
        height: auto !important;
        page-break-inside: avoid;
    }
    pre, blockquote {
        page-break-inside: avoid;
        white-space: pre-wrap;
    }
    /* Ensure no scrollbars in print */
    body { 
        overflow: visible !important; 
        height: auto !important; 
    }
}
</style>
`;
        return html.replace('</head>', `${styles}</head>`);
    }

    /**
     * Pre-process pages to resolve asset URLs
     * Replaces asset://UUID with content/resources/FILENAME
     */
    private async preprocessPages(pages: ExportPage[]): Promise<ExportPage[]> {
        if (!this.assets) return pages;

        // Build path map if not already done
        if (!this.assetExportPathMap) {
            await this.buildAssetExportPathMap();
        }

        // Deep clone pages to avoid mutating original structure
        const clonedPages: ExportPage[] = JSON.parse(JSON.stringify(pages));

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
        if (!content || !this.assetExportPathMap) return content;

        // Replace asset://UUID or content/resources/UUID with blob:URL
        // Capture group 1 is the ID/Filename
        // IMPORTANT: Exclude \ (backslash) to prevent consuming JSON escape characters (e.g. \")
        return content.replace(/(?:asset:\/\/|content\/resources\/)([^"'\s\\]+)/gi, (_match, idOrFilename) => {
            // 1. Try direct lookup (UUID or Filename as is)
            let blobUrl = this.assetExportPathMap?.get(idOrFilename) || this.assetFilenameMap?.get(idOrFilename);

            // 2. Try removing extension (e.g. UUID.png -> UUID)
            if (!blobUrl && idOrFilename.includes('.')) {
                const idWithoutExt = idOrFilename.substring(0, idOrFilename.lastIndexOf('.'));
                blobUrl = this.assetExportPathMap?.get(idWithoutExt);
            }

            if (blobUrl) {
                return blobUrl;
            }

            // Fallback: If it was asset://, convert to path. If it was already path, keep it.
            if (_match.startsWith('asset://')) {
                return `content/resources/${idOrFilename}`;
            }
            return _match;
        });
    }

    private assetFilenameMap: Map<string, string> | null = null;

    /**
     * Build map of asset UUIDs to Blob URLs
     */
    private async buildAssetExportPathMap(): Promise<void> {
        if (!this.assets) {
            console.warn('[PrintPreviewExporter] No assets provider available');
            return;
        }

        this.assetExportPathMap = new Map();
        this.assetFilenameMap = new Map();

        try {
            const assets = await this.assets.getAllAssets();
            console.log(`[PrintPreview] Building asset map for ${assets.length} assets`);

            if (assets.length > 0) {
                console.log('[PrintPreview] First asset sample:', assets[0]);
            }

            for (const asset of assets) {
                // Create Blob URL
                let blobUrl = '';
                if (asset.data) {
                    try {
                        const blob =
                            asset.data instanceof Blob
                                ? asset.data
                                : new Blob([asset.data as any], { type: asset.mime });
                        blobUrl = URL.createObjectURL(blob);
                    } catch (err) {
                        console.error('[PrintPreview] Failed to create Blob URL for asset:', asset.id, err);
                    }
                } else {
                    console.warn('[PrintPreview] Asset has no data:', asset.id);
                }

                if (blobUrl) {
                    this.assetExportPathMap.set(asset.id, blobUrl);
                    if (asset.filename) {
                        this.assetFilenameMap.set(asset.filename, blobUrl);
                    }
                }
            }
            console.log('[PrintPreview] Asset map built. Size:', this.assetExportPathMap.size);
        } catch (e) {
            console.warn('[PrintPreviewExporter] Failed to build asset map:', e);
        }
    }

    /**
     * Get all unique iDevice types used in pages
     */
    private getUsedIdevices(pages: ExportPage[]): string[] {
        const types = new Set<string>();
        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.type) {
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
        const version = options.version || 'v1.0.0';

        // Helper to build versioned server path
        const getPath = (path: string) => {
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
            return `${baseUrl}${cleanBasePath}/${version}/${cleanPath}`;
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
            'content/css/base.css': getPath('style/content.css'), // Fallback/Core CSS

            // Theme (in zip: theme/ -> on server: /files/perm/themes/base/...)
            'theme/style.css': options.themeUrl
                ? `${options.themeUrl.replace(/\/$/, '')}/style.css`
                : getPath(`files/perm/themes/base/${themeName}/style.css`),
            'theme/style.js': options.themeUrl
                ? `${options.themeUrl.replace(/\/$/, '')}/style.js`
                : getPath(`files/perm/themes/base/${themeName}/style.js`),
        };

        // Apply direct string replacements
        for (const [key, value] of Object.entries(mappings)) {
            // Replace refs in src="..." and href="..."
            processed = processed.replaceAll(`src="${key}"`, `src="${value}"`);
            processed = processed.replaceAll(`href="${key}"`, `href="${value}"`);
        }

        // Handle iDevice resources (in zip: idevices/ -> on server: /files/perm/idevices/base/...)
        const serverIdeviceBase = getPath('files/perm/idevices/base/');

        // Regex to match "idevices/TYPE/FILE" and transform to "SERVER_BASE/TYPE/export/FILE"
        // PageRenderer typically outputs `src="idevices/{type}/{file}"` when basePath is empty
        const idevicePattern = /(src|href)=["']idevices\/([^/"']+)\/([^/"']+)["']/g;

        processed = processed.replace(idevicePattern, (match, attr, type, file) => {
            return `${attr}="${serverIdeviceBase}${type}/export/${file}"`;
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

        const resourcePattern = /(src|href)=["']content\/resources\/([^"']+)["']/g;
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
}
