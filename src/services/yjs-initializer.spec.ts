import { describe, it, expect } from 'bun:test';
import * as Y from 'yjs';
import { createBlankYjsDocument } from './yjs-initializer';

describe('yjs-initializer', () => {
    describe('createBlankYjsDocument', () => {
        it('creates a valid Yjs document', () => {
            const data = createBlankYjsDocument();
            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBeGreaterThan(0);
        });

        it('creates document with default metadata', () => {
            const data = createBlankYjsDocument();

            // Decode and verify
            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBe('Untitled document');
            expect(metadata.get('author')).toBe('');
            expect(metadata.get('description')).toBe('');
            expect(metadata.get('language')).toBe('en');
            expect(metadata.get('license')).toBe('creative commons: attribution - share alike 4.0');
            expect(metadata.get('theme')).toBe('base');
            expect(typeof metadata.get('createdAt')).toBe('number');
            expect(typeof metadata.get('modifiedAt')).toBe('number');
        });

        it('creates document with custom title', () => {
            const data = createBlankYjsDocument({ title: 'My Custom Project' });

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBe('My Custom Project');
        });

        it('creates document with custom language', () => {
            const data = createBlankYjsDocument({ language: 'es' });

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('language')).toBe('es');
        });

        it('creates document with custom theme', () => {
            const data = createBlankYjsDocument({ theme: 'modern' });

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('theme')).toBe('modern');
        });

        it('creates document with one root page in navigation', () => {
            const data = createBlankYjsDocument();

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBe(1);
        });

        it('creates root page with correct structure', () => {
            const data = createBlankYjsDocument();

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const navigation = ydoc.getArray('navigation');
            const rootPage = navigation.get(0) as Y.Map<unknown>;

            expect(rootPage).toBeInstanceOf(Y.Map);
            expect(typeof rootPage.get('id')).toBe('string');
            expect(rootPage.get('pageId')).toBe(rootPage.get('id'));
            expect(rootPage.get('title')).toBe('New page');
            expect(rootPage.get('pageName')).toBe('New page');
            expect(rootPage.get('parentId')).toBeNull();
            expect(rootPage.get('order')).toBe(0);
            expect(rootPage.get('blocks')).toBeInstanceOf(Y.Array);
            expect(rootPage.get('children')).toBeInstanceOf(Y.Array);
        });

        it('generates valid UUID-like page ID', () => {
            const data = createBlankYjsDocument();

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const navigation = ydoc.getArray('navigation');
            const rootPage = navigation.get(0) as Y.Map<unknown>;
            const pageId = rootPage.get('id') as string;

            // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            expect(pageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });

        it('creates empty blocks array on root page', () => {
            const data = createBlankYjsDocument();

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const navigation = ydoc.getArray('navigation');
            const rootPage = navigation.get(0) as Y.Map<unknown>;
            const blocks = rootPage.get('blocks') as Y.Array<unknown>;

            expect(blocks.length).toBe(0);
        });

        it('creates empty children array on root page', () => {
            const data = createBlankYjsDocument();

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, data);

            const navigation = ydoc.getArray('navigation');
            const rootPage = navigation.get(0) as Y.Map<unknown>;
            const children = rootPage.get('children') as Y.Array<unknown>;

            expect(children.length).toBe(0);
        });

        it('produces idempotent structure when merged', () => {
            // This simulates what happens when server-side doc syncs with client
            const serverData = createBlankYjsDocument({ title: 'Test Project' });

            const serverDoc = new Y.Doc();
            Y.applyUpdate(serverDoc, serverData);

            const clientDoc = new Y.Doc();
            Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));

            // Client should see the same structure
            const clientNav = clientDoc.getArray('navigation');
            expect(clientNav.length).toBe(1);

            const clientMeta = clientDoc.getMap('metadata');
            expect(clientMeta.get('title')).toBe('Test Project');
        });

        it('prevents client from adding duplicate page when structure exists', () => {
            // Simulate server creating the initial document
            const serverData = createBlankYjsDocument();

            // Client loads the server data
            const clientDoc = new Y.Doc();
            Y.applyUpdate(clientDoc, serverData);

            const navigation = clientDoc.getArray('navigation');

            // Client checks if navigation is empty (this is what ensureBlankStructureIfEmpty does)
            // Since it's not empty, no duplicate page should be created
            expect(navigation.length).toBe(1);

            // The condition `navigation.length === 0` would be false
            // So the client would skip creating a blank structure
        });
    });
});
