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

    /**
     * Create a PrintPreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document: ExportDocument, resourceProvider: ResourceProvider) {
        this.document = document;
        this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
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

            // Get all used iDevice types (needed for path patching heuristic)
            const usedIdevices = this.getUsedIdevices(pages);

            // Generate the single-page HTML components using PageRenderer
            // This ensures we use the exact same logic as the "Single Page" export
            let html = this.pageRenderer.renderSinglePage(pages, {
                projectTitle: meta.title || 'eXeLearning',
                projectSubtitle: meta.subtitle || '',
                language: meta.language || 'en',
                customStyles: meta.customStyles || '',
                usedIdevices,
                author: meta.author || '',
                license: meta.license || '',
                addExeLink: meta.addExeLink ?? true,
                userFooterContent: meta.footer || '',
                version: (typeof window !== 'undefined' && window.eXeLearning?.config?.version) || 'v1.0.0', // From browser context
            });

            // Post-process HTML:
            // 1. Pre-render LaTeX/Mermaid (if hooks provided)
            html = await this.preRenderContent(html, meta, options);

            // 2. Patch relative paths (libs/, theme/) to server absolute paths
            html = this.patchPathsForServer(html, meta.theme || 'base', usedIdevices, options);

            // 3. Inject Print scripts and CSS (if printMode)
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
     * Get all unique iDevice types used in pages
     */
    private getUsedIdevices(pages: ExportPage[]): string[] {
        const types = new Set<string>();
        for (const page of pages) {
            for (const block of page.blocks) {
                for (const component of block.components) {
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
        options: PrintPreviewOptions
    ): Promise<string> {
        let finalHtml = html;

        // LaTeX Pre-rendering
        if (!meta.addMathJax) {
            if (options.preRenderDataGameLatex) {
                try {
                    const result = await options.preRenderDataGameLatex(finalHtml);
                    if (result.count > 0) finalHtml = result.html;
                } catch (e) { console.warn('DataGame LaTeX pre-render error:', e); }
            }
            if (options.preRenderLatex) {
                try {
                    const result = await options.preRenderLatex(finalHtml);
                    if (result.latexRendered) finalHtml = result.html;
                } catch (e) { console.warn('LaTeX pre-render error:', e); }
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
            } catch (e) { console.warn('Mermaid pre-render error:', e); }
        }

        return finalHtml;
    }

    /**
     * Patch relative paths generated by PageRenderer to point to server resources
     */
    private patchPathsForServer(html: string, themeName: string, usedIdevices: string[], options: PrintPreviewOptions): string {
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
