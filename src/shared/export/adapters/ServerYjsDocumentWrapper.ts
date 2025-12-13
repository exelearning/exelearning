/**
 * ServerYjsDocumentWrapper
 *
 * Wraps a Y.Doc (from yjs library) to provide the YjsDocumentManagerInterface
 * expected by YjsDocumentAdapter. This allows server-side exports to use
 * the same YjsDocumentAdapter as browser exports.
 *
 * Usage:
 * ```typescript
 * import * as Y from 'yjs';
 * import { ServerYjsDocumentWrapper } from './adapters/ServerYjsDocumentWrapper';
 * import { YjsDocumentAdapter } from './adapters/YjsDocumentAdapter';
 *
 * // Reconstruct Y.Doc from database
 * const ydoc = await reconstructDocument(projectId);
 *
 * // Wrap for export
 * const wrapper = new ServerYjsDocumentWrapper(ydoc, projectUuid);
 * const adapter = new YjsDocumentAdapter(wrapper);
 *
 * // Use adapter for export
 * const metadata = adapter.getMetadata();
 * const pages = adapter.getNavigation();
 * ```
 */
import type { Doc as YDoc, Map as YMap, Array as YArray } from 'yjs';

/**
 * Interface expected by YjsDocumentAdapter
 * Matches the structure used in public/app/yjs/YjsDocumentManager.js
 */
interface YjsDocumentManagerInterface {
    getMetadata(): YMap<unknown>;
    getNavigation(): YArray<unknown>;
    projectId: string | number;
}

/**
 * ServerYjsDocumentWrapper class
 * Adapts a raw Y.Doc to the YjsDocumentManagerInterface
 */
export class ServerYjsDocumentWrapper implements YjsDocumentManagerInterface {
    private doc: YDoc;
    public projectId: string | number;

    /**
     * Create wrapper from Y.Doc
     * @param doc - Yjs document (Y.Doc instance)
     * @param projectId - Project identifier (UUID or numeric ID)
     */
    constructor(doc: YDoc, projectId: string | number) {
        this.doc = doc;
        this.projectId = projectId;
    }

    /**
     * Get metadata Y.Map from document
     * Expected structure: { title, author, description, language, license, theme, ... }
     */
    getMetadata(): YMap<unknown> {
        return this.doc.getMap('metadata');
    }

    /**
     * Get navigation Y.Array from document
     * Expected structure: Array of page Y.Maps, each containing:
     * - id, pageName, parentId, order, blocks: Y.Array
     * - blocks contain components: Y.Array
     */
    getNavigation(): YArray<unknown> {
        return this.doc.getArray('navigation');
    }

    /**
     * Get the underlying Y.Doc
     * Useful for cleanup (doc.destroy())
     */
    getDoc(): YDoc {
        return this.doc;
    }

    /**
     * Check if the document has content
     * Returns true if metadata or navigation exists
     */
    hasContent(): boolean {
        const meta = this.getMetadata();
        const nav = this.getNavigation();
        return meta.size > 0 || nav.length > 0;
    }

    /**
     * Destroy the underlying Y.Doc to free memory
     * Call this after export is complete
     */
    destroy(): void {
        this.doc.destroy();
    }
}
