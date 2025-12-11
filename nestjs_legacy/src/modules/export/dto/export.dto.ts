/**
 * Export format types
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
 * Export type constants (matching Symfony)
 */
export enum ExportType {
    HTML5 = 'HTML5',
    SCORM12 = 'SCORM12',
    SCORM2004 = 'SCORM2004',
    EPUB3 = 'EPUB3',
    IMS = 'IMS',
    PROPERTIES = 'properties',
    ELP = 'elp',
    ELPX = 'elpx',
    DOT_ELP = '.elp',
    DOT_ELPX = '.elpx',
}

/**
 * Export options
 */
export interface ExportOptions {
    format: ExportFormat;
    includeResources?: boolean;
    compressionLevel?: number;
    templateName?: string;
}

/**
 * Export result
 */
export interface ExportResult {
    filePath: string;
    fileName: string;
    fileSize: number;
    format: ExportFormat;
}

/**
 * HTML5 export specific options
 */
export interface Html5ExportOptions {
    includeNavigation?: boolean;
    responsive?: boolean;
    theme?: string;
    customCss?: string;

    /** Enable preview mode (no ZIP compression, serves files directly) */
    preview?: boolean;

    /** Random subdirectory for preview isolation (e.g., "a3f5d2/") */
    tempPath?: string;

    /** URL prefix for resources in preview mode */
    resourcePrefix?: string;

    /** Compression level for ZIP (0-9, only for download mode) */
    compressionLevel?: number;
}

/**
 * Response for preview export endpoint
 */
export interface PreviewResponse {
    /** Response status message */
    responseMessage: string;

    /** URL to preview index.html (only on success) */
    urlPreviewIndex?: string;

    /** Error message (only on error) */
    error?: string;
}

/**
 * Response for download export endpoint
 */
export interface DownloadResponse {
    /** Response status message */
    responseMessage: string;

    /** URL to download ZIP file (only on success) */
    urlZipFile?: string;

    /** ZIP filename (only on success) */
    zipFileName?: string;

    /** Export project name for frontend compatibility (same as zipFileName) */
    exportProjectName?: string;

    /** Error message (only on error) */
    error?: string;
}
