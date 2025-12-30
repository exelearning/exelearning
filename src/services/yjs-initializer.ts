/**
 * Server-Side Yjs Document Initializer
 *
 * Creates the initial Yjs document structure for new projects.
 * This ensures that when a project is created, the structure already exists
 * before any client connects, preventing race conditions where multiple
 * clients might create duplicate pages.
 */

import * as Y from 'yjs';

export interface YjsInitOptions {
    title?: string;
    language?: string;
    theme?: string;
}

/**
 * Generate a unique ID (matches client-side YjsDocumentManager.generateId)
 */
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Create a blank Yjs document with initial project structure.
 *
 * Structure matches client-side YjsDocumentManager.createBlankProjectStructure():
 * - metadata: Map with title, author, description, language, license, theme, createdAt, modifiedAt
 * - navigation: Array with one root page containing id, pageId, title, pageName, parentId, order, blocks, children
 *
 * @param options Configuration options for the initial document
 * @returns Encoded Yjs state as Uint8Array
 */
export function createBlankYjsDocument(options?: YjsInitOptions): Uint8Array {
    const ydoc = new Y.Doc();
    const navigation = ydoc.getArray('navigation');
    const metadata = ydoc.getMap('metadata');

    ydoc.transact(() => {
        // Create initial metadata (matches client-side structure)
        metadata.set('title', options?.title || 'Untitled document');
        metadata.set('author', '');
        metadata.set('description', '');
        metadata.set('language', options?.language || 'en');
        metadata.set('license', 'creative commons: attribution - share alike 4.0');
        metadata.set('theme', options?.theme || 'base');
        metadata.set('createdAt', Date.now());
        metadata.set('modifiedAt', Date.now());

        // Create root page (matches client-side structure)
        const rootPageId = generateId();
        const rootPage = new Y.Map();
        rootPage.set('id', rootPageId);
        rootPage.set('pageId', rootPageId);
        rootPage.set('title', 'New page');
        rootPage.set('pageName', 'New page');
        rootPage.set('parentId', null);
        rootPage.set('order', 0);
        rootPage.set('blocks', new Y.Array());
        rootPage.set('children', new Y.Array());

        navigation.push([rootPage]);
    }, 'system');

    return Y.encodeStateAsUpdate(ydoc);
}
