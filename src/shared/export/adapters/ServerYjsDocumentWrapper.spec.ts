/**
 * Tests for ServerYjsDocumentWrapper
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import { ServerYjsDocumentWrapper } from './ServerYjsDocumentWrapper';

describe('ServerYjsDocumentWrapper', () => {
    let ydoc: Y.Doc;
    let wrapper: ServerYjsDocumentWrapper;

    beforeEach(() => {
        ydoc = new Y.Doc();
        wrapper = new ServerYjsDocumentWrapper(ydoc, 'test-project-id');
    });

    afterEach(() => {
        wrapper.destroy();
    });

    describe('constructor', () => {
        it('should create wrapper with Y.Doc and projectId', () => {
            expect(wrapper.projectId).toBe('test-project-id');
        });

        it('should accept numeric projectId', () => {
            const numericWrapper = new ServerYjsDocumentWrapper(ydoc, 123);
            expect(numericWrapper.projectId).toBe(123);
        });
    });

    describe('getMetadata', () => {
        it('should return Y.Map for metadata', () => {
            const metadata = wrapper.getMetadata();
            expect(metadata).toBeDefined();
            expect(typeof metadata.set).toBe('function');
            expect(typeof metadata.get).toBe('function');
        });

        it('should return empty map for new document', () => {
            const metadata = wrapper.getMetadata();
            expect(metadata.size).toBe(0);
        });

        it('should return populated metadata', () => {
            // Populate metadata directly on the ydoc
            const meta = ydoc.getMap('metadata');
            meta.set('title', 'Test Project');
            meta.set('author', 'Test Author');

            const metadata = wrapper.getMetadata();
            expect(metadata.get('title')).toBe('Test Project');
            expect(metadata.get('author')).toBe('Test Author');
        });
    });

    describe('getNavigation', () => {
        it('should return Y.Array for navigation', () => {
            const navigation = wrapper.getNavigation();
            expect(navigation).toBeDefined();
            expect(typeof navigation.push).toBe('function');
            expect(typeof navigation.get).toBe('function');
        });

        it('should return empty array for new document', () => {
            const navigation = wrapper.getNavigation();
            expect(navigation.length).toBe(0);
        });

        it('should return populated navigation', () => {
            // Populate navigation directly on the ydoc
            const nav = ydoc.getArray('navigation');
            const pageMap = new Y.Map();
            pageMap.set('id', 'page-1');
            pageMap.set('pageName', 'Home');
            nav.push([pageMap]);

            const navigation = wrapper.getNavigation();
            expect(navigation.length).toBe(1);
        });
    });

    describe('getDoc', () => {
        it('should return the underlying Y.Doc', () => {
            expect(wrapper.getDoc()).toBe(ydoc);
        });
    });

    describe('hasContent', () => {
        it('should return false for empty document', () => {
            expect(wrapper.hasContent()).toBe(false);
        });

        it('should return true when metadata has content', () => {
            const meta = ydoc.getMap('metadata');
            meta.set('title', 'Test');
            expect(wrapper.hasContent()).toBe(true);
        });

        it('should return true when navigation has content', () => {
            const nav = ydoc.getArray('navigation');
            const pageMap = new Y.Map();
            nav.push([pageMap]);
            expect(wrapper.hasContent()).toBe(true);
        });

        it('should return true when both have content', () => {
            const meta = ydoc.getMap('metadata');
            meta.set('title', 'Test');
            const nav = ydoc.getArray('navigation');
            nav.push([new Y.Map()]);
            expect(wrapper.hasContent()).toBe(true);
        });
    });

    describe('destroy', () => {
        it('should destroy the underlying Y.Doc', () => {
            // Create a new wrapper for this test to avoid conflict with afterEach
            const testDoc = new Y.Doc();
            const testWrapper = new ServerYjsDocumentWrapper(testDoc, 'test');

            // Verify document is not destroyed
            expect(testDoc.isDestroyed).toBe(false);

            testWrapper.destroy();

            // After destroy, the doc should be marked as destroyed
            expect(testDoc.isDestroyed).toBe(true);
        });
    });

    describe('integration with YjsDocumentAdapter interface', () => {
        it('should provide interface compatible with YjsDocumentAdapter', () => {
            // The wrapper should provide the interface expected by YjsDocumentAdapter
            expect(typeof wrapper.getMetadata).toBe('function');
            expect(typeof wrapper.getNavigation).toBe('function');
            expect(wrapper.projectId).toBeDefined();

            // getMetadata should return object with get and toJSON methods
            const meta = wrapper.getMetadata();
            expect(typeof meta.get).toBe('function');
            expect(typeof meta.toJSON).toBe('function');

            // getNavigation should return object with length, get, toArray, forEach
            const nav = wrapper.getNavigation();
            expect(typeof nav.length).toBe('number');
            expect(typeof nav.get).toBe('function');
            expect(typeof nav.toArray).toBe('function');
            expect(typeof nav.forEach).toBe('function');
        });
    });
});
