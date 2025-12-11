import { ParsedOdeStructure } from '../../xml/interfaces/ode-xml.interface';

/**
 * Export format types supported by the system
 */
export enum ExportFormatType {
    HTML5 = 'html5',
    PAGE = 'page',
    SCORM12 = 'scorm12',
    IMS = 'ims',
    EPUB3 = 'epub3',
    ELPX = 'elpx',
}

/**
 * Theme information for export
 */
export interface ThemeDto {
    id: string;
    name: string;
    path: string;
    cssFile?: string;
    jsFile?: string;
}

/**
 * Options for export operations
 */
export interface ExportOptions {
    /** Include navigation menu */
    includeNavigation?: boolean;

    /** Responsive design */
    responsive?: boolean;

    /** Theme to use */
    theme?: ThemeDto;

    /** Custom CSS to inject */
    customCss?: string;

    /** Enable preview mode (no ZIP, direct file serving) */
    preview?: boolean;

    /** Random subdirectory for preview isolation */
    tempPath?: string;

    /** URL prefix for resources */
    resourcePrefix?: string;

    /** ZIP compression level (0-9) */
    compressionLevel?: number;

    /** SCORM: SCO organization type */
    scormOrganization?: 'flat' | 'hierarchical';

    /** EPUB: Include cover image */
    epubIncludeCover?: boolean;

    /** Language override */
    language?: string;
}

/**
 * Context passed to export strategies
 */
export interface ExportContext {
    /** Unique session identifier */
    sessionId: string;

    /** Parsed ODE structure from content.xml */
    structure: ParsedOdeStructure;

    /** Path to session directory (extracted ELP) */
    sessionPath: string;

    /** Path to export output directory */
    exportDir: string;

    /** Export options */
    options: ExportOptions;

    /** Theme configuration */
    theme?: ThemeDto;

    /** Base URL for assets (differs between preview/download) */
    assetsBaseUrl?: string;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
    /** Path to the exported file or directory */
    filePath: string;

    /** Suggested filename for download */
    fileName: string;

    /** File size in bytes (0 for preview mode) */
    fileSize: number;

    /** Export format used */
    format: ExportFormatType;

    /** Preview URL (only in preview mode) */
    previewUrl?: string;

    /** Success status */
    success: boolean;

    /** Error message if failed */
    error?: string;
}

/**
 * Interface for export strategies
 * Each export format implements this interface
 */
export interface IExportStrategy {
    /** Format this strategy handles */
    readonly format: ExportFormatType;

    /** File extension for the export (e.g., '.zip', '.epub') */
    readonly fileExtension: string;

    /** Suffix for filename (e.g., '_html5', '_scorm') */
    readonly fileSuffix: string;

    /**
     * Main export method
     * @param context Export context with all necessary data
     * @returns Export result with file path and metadata
     */
    export(context: ExportContext): Promise<ExportResult>;

    /**
     * Generate HTML files for export
     * @param context Export context
     */
    generateHtmlFiles(context: ExportContext): Promise<void>;

    /**
     * Generate format-specific files (manifests, metadata, etc.)
     * @param context Export context
     */
    generateFormatSpecificFiles(context: ExportContext): Promise<void>;

    /**
     * Whether this format supports preview mode
     */
    supportsPreview(): boolean;

    /**
     * Get list of required base assets for this format
     */
    getRequiredAssets(): string[];
}

/**
 * Interface for manifest builders (SCORM, IMS, EPUB)
 */
export interface IManifestBuilder {
    /**
     * Generate the manifest XML content
     * @param context Export context
     * @returns XML string
     */
    generateManifest(context: ExportContext): Promise<string>;

    /**
     * Get the manifest filename
     */
    getManifestFilename(): string;
}

/**
 * Resource entry for manifest files
 */
export interface ManifestResource {
    /** Resource identifier */
    id: string;

    /** Resource type (e.g., 'webcontent') */
    type: string;

    /** Main file for this resource */
    href: string;

    /** List of files in this resource */
    files: string[];

    /** Dependencies on other resources */
    dependencies?: string[];

    /** SCORM-specific: SCO type */
    scormType?: 'sco' | 'asset';
}

/**
 * Organization item for manifest files
 */
export interface ManifestOrganizationItem {
    /** Item identifier */
    id: string;

    /** Display title */
    title: string;

    /** Reference to resource */
    resourceRef?: string;

    /** Child items */
    children?: ManifestOrganizationItem[];

    /** SCORM-specific: parameters */
    parameters?: string;
}

/**
 * Metadata for manifest files
 */
export interface ManifestMetadata {
    /** Schema identifier */
    schema?: string;

    /** Schema version */
    schemaVersion?: string;

    /** Title */
    title: string;

    /** Description */
    description?: string;

    /** Author/Creator */
    author?: string;

    /** Language */
    language?: string;

    /** Keywords */
    keywords?: string[];

    /** Rights/License */
    rights?: string;

    /** Creation date */
    dateCreated?: string;

    /** Modification date */
    dateModified?: string;

    /** eXeLearning version */
    exeVersion?: string;
}
