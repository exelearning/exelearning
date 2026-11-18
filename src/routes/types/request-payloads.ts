/**
 * Request Payload Types for Route Handlers
 *
 * Centralized type definitions for request bodies across all routes.
 * Replaces `body as any` casts with proper typed interfaces.
 */

/**
 * Compile-time cast for route handler request bodies where Elysia plugin chaining
 * collapses handler `body` to `unknown`.
 *
 * It does NOT validate anything at runtime. Routes without a TypeBox schema in
 * `{ body: t.Object(...) }` still receive whatever the client sent.
 */
export function castRequestBody<T>(body: unknown): T {
    return body as T;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Structure sent from Yjs client for export
 * Matches the format built by apiCallManager.buildStructureFromYjs()
 */
export interface YjsExportStructure {
    meta: {
        title?: string;
        author?: string;
        language?: string;
        description?: string;
        license?: string;
        theme?: string;
        // Export options
        addExeLink?: boolean | string;
        addPagination?: boolean | string;
        addSearchBox?: boolean | string;
        addAccessibilityToolbar?: boolean | string;
        exportSource?: boolean | string;
        // Custom content
        extraHeadContent?: string;
        footer?: string;
        // Stable identifiers (#1786) -- forwarded from the browser Y.Map so the
        // server-side YjsDocumentAdapter sees the same project identity and
        // BaseExporter.getManifestIdentifier derives a stable manifest@identifier.
        odeIdentifier?: string;
        odeVersionId?: string;
        scormIdentifier?: string;
    };
    pages: Array<{
        id: string;
        pageName: string;
        parentId?: string | null;
        properties?: Record<string, unknown>;
        blocks: Array<{
            id: string;
            blockName?: string;
            iconName?: string;
            icon?: { source: 'material' | 'asset' | 'theme' | 'none'; value: string; name?: string };
            properties?: Record<string, unknown>;
            components: Array<{
                id: string;
                ideviceType: string;
                htmlContent?: string;
                properties?: Record<string, unknown>;
            }>;
        }>;
    }>;
    navigation: Array<{
        id: string;
        navText: string;
        parentId?: string | null;
    }>;
}

/**
 * Export options for various formats
 */
export interface ExportOptionsRequest {
    baseUrl?: string;
    theme?: string;
    singlePage?: boolean;
    format?: 'html5' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elp' | 'elpx' | 'elpx-page';
    /** Structure from Yjs document (sent by client for real-time exports) */
    structure?: YjsExportStructure;
    /** Root page ID for single page export */
    rootPageId?: string;
}
