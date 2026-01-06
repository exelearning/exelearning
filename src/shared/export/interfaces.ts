/**
 * Unified Export System - TypeScript Interfaces
 *
 * These interfaces provide a common abstraction layer for the export system,
 * enabling the same export code to work in both:
 * - Frontend (browser): Using Yjs documents and IndexedDB assets
 * - Backend (CLI): Using ELP files and filesystem
 */

// =============================================================================
// Document Structure Interfaces
// =============================================================================

/**
 * Main document interface that abstracts document access
 * Implemented by YjsDocumentAdapter (browser) and ElpDocumentAdapter (CLI)
 */
export interface ExportDocument {
    getMetadata(): ExportMetadata;
    getNavigation(): ExportPage[];
}

/**
 * Project metadata
 */
export interface ExportMetadata {
    title: string;
    author: string;
    language: string;
    theme: string;
    customStyles?: string;
    license?: string;
    licenseUrl?: string;
    description?: string;
    keywords?: string;
    category?: string;

    // eXeLearning-specific metadata
    exelearningVersion?: string;
    odeIdentifier?: string;
    createdAt?: string;
    modifiedAt?: string;

    // Export options (from project properties)
    addExeLink?: boolean; // "Made with eXeLearning" link
    addPagination?: boolean; // Page counter (Página X/Y)
    addSearchBox?: boolean; // Search functionality (HTML5 website only)
    addAccessibilityToolbar?: boolean; // Accessibility toolbar
    addMathJax?: boolean; // Always include MathJax library for math formulas
    exportSource?: boolean; // Include content.xml for re-editing

    // Custom content
    extraHeadContent?: string; // Custom content in <head>
    footer?: string; // Custom footer content

    // SCORM metadata
    scormIdentifier?: string;
    masteryScore?: number;
}

/**
 * Page in the navigation structure
 */
export interface ExportPage {
    id: string;
    title: string;
    parentId: string | null;
    order: number;
    blocks: ExportBlock[];

    // Optional page-level properties
    properties?: Record<string, unknown>;
}

/**
 * Block containing iDevices/components
 */
export interface ExportBlock {
    id: string;
    name: string;
    order: number;
    components: ExportComponent[];

    // Block icon name (for themed icons)
    iconName?: string;

    // Block-level properties
    properties?: ExportBlockProperties;
}

/**
 * Block properties
 */
export interface ExportBlockProperties {
    visibility?: string;
    minimized?: string;
    teacherOnly?: string;
    visibilityType?: string;
    cssClass?: string;
    identifier?: string;
    allowToggle?: string;
}

/**
 * iDevice/component data
 */
export interface ExportComponent {
    id: string;
    type: string; // ideviceType (e.g., 'FreeTextIdevice', 'QuizActivity')
    order: number;
    content: string; // HTML content
    properties: Record<string, unknown>;

    // Component-level structure properties (visibility, teacherOnly, identifier, cssClass)
    structureProperties?: ExportComponentProperties;
}

/**
 * Component structure properties
 */
export interface ExportComponentProperties {
    visibility?: string;
    teacherOnly?: string;
    identifier?: string;
    cssClass?: string;
}

// =============================================================================
// Provider Interfaces
// =============================================================================

/**
 * Resource provider for loading themes, iDevice files, and libraries
 * Implemented by BrowserResourceProvider (fetch API) and FileSystemResourceProvider
 */
export interface ResourceProvider {
    /**
     * Fetch theme files
     * @param themeName - Name of the theme (e.g., 'base', 'cedec')
     * @returns Map of relative path -> content buffer
     */
    fetchTheme(themeName: string): Promise<Map<string, Uint8Array>>;

    /**
     * Fetch iDevice resource files (CSS, JS, templates)
     * @param ideviceType - Type of iDevice
     * @returns Map of relative path -> content buffer
     */
    fetchIdeviceResources(ideviceType: string): Promise<Map<string, Uint8Array>>;

    /**
     * Fetch base libraries (jQuery, Bootstrap, common scripts)
     * @returns Map of relative path -> content buffer
     */
    fetchBaseLibraries(): Promise<Map<string, Uint8Array>>;

    /**
     * Fetch specific library files
     * @param files - Array of file paths to fetch
     * @param patterns - Optional library patterns to identify directory-based libraries
     * @returns Map of relative path -> content buffer
     */
    fetchLibraryFiles(files: string[], patterns?: LibraryPattern[]): Promise<Map<string, Uint8Array>>;

    /**
     * Normalize iDevice type name to directory name
     * @param ideviceType - Raw iDevice type name (e.g., 'FreeTextIdevice')
     * @returns Normalized directory name (e.g., 'text')
     */
    normalizeIdeviceType(ideviceType: string): string;

    /**
     * Fetch the eXeLearning "powered by" logo
     * @returns Logo image as Uint8Array, or null if not found
     */
    fetchExeLogo(): Promise<Uint8Array | null>;

    /**
     * Fetch content CSS files (base.css, etc.)
     * @returns Map of relative path -> content buffer
     */
    fetchContentCss(): Promise<Map<string, Uint8Array>>;

    /**
     * Fetch SCORM API wrapper files (SCORM_API_wrapper.js, SCOFunctions.js)
     * @param version - SCORM version: '1.2' or '2004'
     * @returns Map of relative path -> content buffer
     */
    fetchScormFiles(version: '1.2' | '2004'): Promise<Map<string, Uint8Array>>;

    /**
     * Fetch SCORM schema XSD files for validation
     * @param version - SCORM version: '1.2' or '2004'
     * @returns Map of relative path -> content buffer
     */
    fetchScormSchemas(version: '1.2' | '2004'): Promise<Map<string, Uint8Array>>;
}

/**
 * Asset provider for loading project assets (images, media, etc.)
 * Implemented by BrowserAssetProvider (IndexedDB) and FileSystemAssetProvider
 */
export interface AssetProvider {
    /**
     * Get all project assets
     * @returns Array of asset info with blob/buffer
     */
    getProjectAssets(): Promise<ExportAsset[]>;

    /**
     * Get all project assets (alias for getProjectAssets)
     * @returns Array of asset info with blob/buffer
     */
    getAllAssets(): Promise<ExportAsset[]>;

    /**
     * Get a single asset by ID
     * @param assetId - Asset UUID
     * @returns Asset info or null if not found
     */
    getAsset(assetId: string): Promise<ExportAsset | null>;
}

/**
 * Asset information for export
 */
export interface ExportAsset {
    id: string;
    filename: string;
    originalPath: string;
    /** Folder path for export structure (empty string = root) */
    folderPath?: string;
    mime: string;
    data: Uint8Array | Blob;
}

// =============================================================================
// ZIP Provider Interface
// =============================================================================

/**
 * ZIP provider for creating export archives
 * Allows different implementations for browser (JSZip) and Node (Archiver)
 */
export interface ZipProvider {
    /**
     * Create a new ZIP archive
     */
    createZip(): ZipArchive;
}

/**
 * ZIP archive abstraction
 */
export interface ZipArchive {
    /**
     * Add a file to the archive
     * @param path - Path within the ZIP
     * @param content - File content
     */
    addFile(path: string, content: string | Uint8Array | Blob): void;

    /**
     * Add multiple files from a Map
     * @param files - Map of path -> content
     */
    addFiles(files: Map<string, string | Uint8Array | Blob>): void;

    /**
     * Check if a file exists in the archive
     * @param path - Path to check
     * @returns True if file exists
     */
    hasFile(path: string): boolean;

    /**
     * Generate the ZIP archive
     * @returns ZIP content as buffer
     */
    generate(): Promise<Uint8Array>;
}

// =============================================================================
// Export Options Interfaces
// =============================================================================

/**
 * Common export options
 */
export interface ExportOptions {
    /** Output filename (without extension) */
    filename?: string;

    /** Include data-* attributes for JS initialization */
    includeDataAttributes?: boolean;

    /** Include accessibility toolbar */
    includeAccessibilityToolbar?: boolean;

    /** Base URL for absolute paths */
    baseUrl?: string;

    /** Theme name to use for export */
    theme?: string;

    /**
     * Optional hook to pre-render LaTeX expressions to SVG+MathML.
     * When provided and successful, MathJax library will NOT be included in the output.
     * This reduces export size by ~1MB and provides instant math rendering.
     */
    preRenderLatex?: (html: string) => Promise<LatexPreRenderResult>;

    /**
     * Optional hook to pre-render LaTeX inside encrypted DataGame divs.
     * Game iDevices store questions in encrypted JSON. This decrypts, pre-renders LaTeX,
     * and re-encrypts before the main preRenderLatex processes visible content.
     * Must be called BEFORE preRenderLatex.
     */
    preRenderDataGameLatex?: (html: string) => Promise<{ html: string; count: number }>;

    /**
     * Optional hook to pre-render Mermaid diagrams to static SVG.
     * When provided and successful, Mermaid library (~2.7MB) will NOT be included in the output.
     * This significantly reduces export size and provides instant diagram rendering.
     */
    preRenderMermaid?: (html: string) => Promise<MermaidPreRenderResult>;
}

/**
 * HTML5 export options
 */
export interface Html5ExportOptions extends ExportOptions {
    /** Export as single page (anchor navigation) */
    singlePage?: boolean;
}

/**
 * SCORM export options
 */
export interface ScormExportOptions extends ExportOptions {
    /** SCORM version: '1.2' or '2004' */
    version: '1.2' | '2004';

    /** Mastery score (0-100) */
    masteryScore?: number;

    /** SCORM identifier */
    scormIdentifier?: string;

    /** Organization title */
    organizationTitle?: string;
}

/**
 * IMS Content Package export options
 */
export interface ImsExportOptions extends ExportOptions {
    /** Include LOM metadata */
    includeLomMetadata?: boolean;
}

/**
 * EPUB3 export options
 */
export interface Epub3ExportOptions extends ExportOptions {
    /** Cover image path */
    coverImage?: string;

    /** Publisher name */
    publisher?: string;

    /** Book UUID */
    bookId?: string;
}

/**
 * ELPX export options
 */
export interface ElpxExportOptions extends ExportOptions {
    /** Include HTML preview pages */
    includeHtmlContent?: boolean;
}

// =============================================================================
// Export Result Interface
// =============================================================================

/**
 * Result of an export operation
 */
export interface ExportResult {
    success: boolean;
    filename?: string;
    data?: Uint8Array | Blob;
    error?: string;
}

// =============================================================================
// Asset Resolution Interfaces
// =============================================================================

/**
 * Asset URL resolver interface
 * Allows different URL resolution strategies for preview vs export:
 * - Preview mode: asset:// → blob:// URLs (browser-side)
 * - Export mode: asset:// → relative paths (content/resources/...)
 *
 * Implemented by:
 * - ExportAssetResolver (for ZIP exports)
 * - PreviewAssetResolver (for browser preview with blob URLs)
 */
export interface AssetResolver {
    /**
     * Resolve an asset URL to the appropriate format
     * @param assetUrl - Original asset URL (e.g., "asset://uuid/filename.jpg")
     * @returns Resolved URL (sync or async depending on implementation)
     */
    resolve(assetUrl: string): string | Promise<string>;

    /**
     * Synchronous resolution (optional, for renderers that need sync behavior)
     * Falls back to a placeholder if async resolution is needed
     */
    resolveSync?(assetUrl: string): string;

    /**
     * Process HTML content, resolving all asset URLs within
     * @param html - HTML content with asset:// URLs
     * @returns HTML with resolved URLs
     */
    processHtml(html: string): string | Promise<string>;

    /**
     * Synchronous HTML processing (optional)
     */
    processHtmlSync?(html: string): string;
}

/**
 * Asset resolver options
 */
export interface AssetResolverOptions {
    /** Base path for relative URLs (e.g., "" for index.html, "../" for subpages) */
    basePath?: string;

    /** Resource directory name (default: "content/resources") */
    resourceDir?: string;
}

// =============================================================================
// Renderer Interfaces
// =============================================================================

/**
 * Page rendering options
 */
export interface PageRenderOptions {
    projectTitle: string;
    language: string;
    theme: string;
    customStyles?: string;
    allPages: ExportPage[];
    basePath: string;
    isIndex: boolean;
    usedIdevices: string[];
    author: string;
    license: string;
    description?: string;
    licenseUrl?: string;

    // Page counter options
    totalPages?: number;
    currentPageIndex?: number;

    // Custom footer content from ODE
    userFooterContent?: string;

    // Export options
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    addMathJax?: boolean;

    // Custom head content
    extraHeadContent?: string;

    // SCORM-specific
    isScorm?: boolean;
    scormVersion?: string;
    bodyClass?: string;
    extraHeadScripts?: string;
    onLoadScript?: string;
    onUnloadScript?: string;

    // Detected libraries from content scanning (MathJax, Mermaid, etc.)
    detectedLibraries?: LibraryDetectionResult;
}

/**
 * Component rendering options
 */
export interface ComponentRenderOptions {
    basePath: string;
    includeDataAttributes: boolean;
}

/**
 * Block rendering options
 */
export interface BlockRenderOptions extends ComponentRenderOptions {
    /** Base path for theme icons (e.g., '/files/perm/themes/base/base/icons/' for preview) */
    themeIconBasePath?: string;
}

// =============================================================================
// iDevice Configuration
// =============================================================================

/**
 * iDevice type configuration
 */
export interface IdeviceConfig {
    cssClass: string;
    componentType: 'json' | 'html';
    template: string;
}

// =============================================================================
// Library Detection
// =============================================================================

/**
 * Library pattern for detection
 */
export interface LibraryPattern {
    name: string;
    type: 'class' | 'rel' | 'regex';
    pattern: string | RegExp;
    files: string[];
    requiresLatexCheck?: boolean;
    /** When true, files array contains directory names and all contents should be included recursively */
    isDirectory?: boolean;
}

/**
 * Library detection result
 */
export interface LibraryDetectionResult {
    libraries: Array<{ name: string; files: string[] }>;
    files: string[];
    count: number;
    /** Full pattern info for directory-based libraries */
    patterns: LibraryPattern[];
}

/**
 * Library detection options
 */
export interface LibraryDetectionOptions {
    includeScorm?: boolean;
    includeAccessibilityToolbar?: boolean;
    /** Force include MathJax library regardless of content detection */
    includeMathJax?: boolean;
    /** Skip MathJax library if LaTeX was pre-rendered to SVG+MathML */
    skipMathJax?: boolean;
    /** Skip Mermaid library if diagrams were pre-rendered to SVG */
    skipMermaid?: boolean;
}

/**
 * LaTeX pre-render result
 */
export interface LatexPreRenderResult {
    /** Processed HTML with LaTeX rendered to SVG+MathML */
    html: string;
    /** Whether the original HTML contained LaTeX expressions */
    hasLatex: boolean;
    /** Whether LaTeX was successfully pre-rendered */
    latexRendered: boolean;
    /** Number of expressions rendered */
    count: number;
}

/**
 * Mermaid pre-render result
 */
export interface MermaidPreRenderResult {
    /** Processed HTML with Mermaid diagrams rendered to static SVG */
    html: string;
    /** Whether the original HTML contained Mermaid diagrams */
    hasMermaid: boolean;
    /** Whether Mermaid was successfully pre-rendered */
    mermaidRendered: boolean;
    /** Number of diagrams rendered */
    count: number;
}

// =============================================================================
// Manifest/Metadata Generation
// =============================================================================

/**
 * SCORM manifest generation options
 */
export interface ScormManifestOptions {
    identifier: string;
    title: string;
    language: string;
    pages: ExportPage[];
    masteryScore?: number;
    organization?: string;
    version: '1.2' | '2004';
}

/**
 * IMS manifest generation options
 */
export interface ImsManifestOptions {
    identifier: string;
    title: string;
    language: string;
    pages: ExportPage[];
}

/**
 * LOM metadata generation options
 */
export interface LomMetadataOptions {
    title: string;
    description?: string;
    language: string;
    author?: string;
    keywords?: string;
    category?: string;
    license?: string;
}

/**
 * EPUB3 package generation options
 */
export interface Epub3PackageOptions {
    bookId: string;
    title: string;
    language: string;
    author?: string;
    publisher?: string;
    chapters: Array<{ id: string; title: string; filename: string }>;
}

// =============================================================================
// Exporter Base Interface
// =============================================================================

/**
 * Base interface for all exporters
 */
export interface Exporter {
    /**
     * Export the project
     * @param filename - Optional filename override
     * @returns Export result
     */
    export(filename?: string): Promise<ExportResult>;

    /**
     * Export to a buffer (for programmatic use)
     * @returns ZIP content as Uint8Array
     */
    exportToBuffer(): Promise<Uint8Array>;

    /**
     * Get the file extension for this format
     */
    getFileExtension(): string;

    /**
     * Get the file suffix for this format (e.g., '_web', '_scorm12')
     */
    getFileSuffix(): string;
}
