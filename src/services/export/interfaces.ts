/**
 * Export Interfaces for Elysia
 * Based on NestJS export module interfaces
 */
import { ParsedOdeStructure } from '../xml/interfaces';

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
 * Export format enum (matching NestJS dto)
 */
export enum ExportFormat {
    HTML5 = 'html5',
    SCORM12 = 'scorm12',
    SCORM2004 = 'scorm2004',
    EPUB3 = 'epub3',
    ELP = 'elp',
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
 * HTML5 export specific options
 */
export interface Html5ExportOptions {
    includeNavigation?: boolean;
    responsive?: boolean;
    theme?: string;
    customCss?: string;
    preview?: boolean;
    tempPath?: string;
    resourcePrefix?: string;
    compressionLevel?: number;
    faviconPath?: string;
    faviconType?: string;
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
    format: ExportFormat | ExportFormatType;

    /** Preview URL (only in preview mode) */
    previewUrl?: string;

    /** Success status */
    success?: boolean;

    /** Error message if failed */
    error?: string;
}

/**
 * Response for preview export endpoint
 */
export interface PreviewResponse {
    responseMessage: string;
    urlPreviewIndex?: string;
    error?: string;
}

/**
 * Response for download export endpoint
 */
export interface DownloadResponse {
    responseMessage: string;
    urlZipFile?: string;
    zipFileName?: string;
    exportProjectName?: string;
    error?: string;
}

/**
 * Unified orchestrator export result
 */
export interface OrchestratorExportResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    previewUrl?: string;
    format: ExportFormatType;
    error?: string;
}
