import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreviewInvalidationTracker } from './previewInvalidation.js';

/** Minimal observable Y.Map-like fake. */
function fakeYMap(entries = []) {
    const map = new Map(entries);
    const observers = new Set();
    return {
        get: (key) => map.get(key),
        set: (key, value) => map.set(key, value),
        delete: (key) => map.delete(key),
        forEach: (callback) => map.forEach(callback),
        observe: (handler) => observers.add(handler),
        unobserve: (handler) => observers.delete(handler),
        emit(event) {
            for (const handler of observers) handler(event);
        },
    };
}

function fakePage(id) {
    return { get: (key) => (key === 'id' ? id : undefined) };
}

function createFakeBridge({ pages = ['page-1', 'page-2'] } = {}) {
    const structureObservers = [];
    const metadata = fakeYMap();
    const assets = fakeYMap();
    const themeFiles = fakeYMap();
    const navigation = { get: (index) => (pages[index] ? fakePage(pages[index]) : undefined) };

    return {
        onStructureChange: (callback) => {
            structureObservers.push(callback);
            return () => {
                const idx = structureObservers.indexOf(callback);
                if (idx >= 0) structureObservers.splice(idx, 1);
            };
        },
        documentManager: {
            getMetadata: () => metadata,
            getAssets: () => assets,
            getThemeFiles: () => themeFiles,
            getNavigation: () => navigation,
        },
        emitStructure(events) {
            for (const observer of structureObservers) observer(events, false);
        },
        metadata,
        assets,
        themeFiles,
        structureObservers,
    };
}

const metadataEvent = (...keys) => ({ keysChanged: new Set(keys) });
const assetsEvent = (changes) => ({ changes: { keys: new Map(Object.entries(changes)) } });

describe('PreviewInvalidationTracker', () => {
    let bridge;
    let tracker;
    let onDirty;

    beforeEach(() => {
        bridge = createFakeBridge();
        onDirty = vi.fn();
        tracker = new PreviewInvalidationTracker({ onDirty });
        tracker.attach(bridge);
    });

    describe('structure/content classification', () => {
        it('marks only the touched page for block-level events', () => {
            bridge.emitStructure([{ path: [1, 'blocks', 0, 'components', 0, 'htmlContent'] }]);

            const scope = tracker.consume();
            expect(scope.pages).toBeInstanceOf(Set);
            expect([...scope.pages]).toEqual(['page-2']);
        });

        it('accumulates dirty pages across events until consumed', () => {
            bridge.emitStructure([{ path: [0, 'blocks'], changes: {} }]);
            bridge.emitStructure([{ path: [1, 'blocks', 2] }]);

            const scope = tracker.consume();
            expect([...scope.pages].sort()).toEqual(['page-1', 'page-2']);
        });

        it('marks everything for changes on the navigation array itself (page add/delete/move)', () => {
            bridge.emitStructure([{ path: [] }]);
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for page-level key changes (rename/properties feed every nav menu)', () => {
            bridge.emitStructure([{ path: [0] }]);
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything when the page id cannot be resolved', () => {
            bridge.emitStructure([{ path: [9, 'blocks', 0] }]);
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for an empty event list (initial structure load)', () => {
            bridge.emitStructure([]);
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for unrecognized event shapes', () => {
            bridge.emitStructure([{ path: null }, { nope: true }]);
            expect(tracker.consume().pages).toBe('all');
        });
    });

    describe('metadata classification', () => {
        it('marks everything for visual/global keys', () => {
            bridge.metadata.emit(metadataEvent('theme'));
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for unknown keys (correctness first)', () => {
            bridge.metadata.emit(metadataEvent('someFutureKey'));
            expect(tracker.consume().pages).toBe('all');
        });

        it('ignores verified non-rendered bookkeeping keys', () => {
            bridge.metadata.emit(metadataEvent('modifiedAt', 'createdAt', 'exportSource', 'odeVersionId'));
            expect(tracker.isEmpty()).toBe(true);
            expect(onDirty).not.toHaveBeenCalled();
        });

        it('marks everything when bookkeeping and rendered keys change together', () => {
            bridge.metadata.emit(metadataEvent('modifiedAt', 'title'));
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for a malformed event', () => {
            bridge.metadata.emit({});
            expect(tracker.consume().pages).toBe('all');
        });
    });

    describe('asset classification', () => {
        it('notes a non-colliding added asset without invalidating pages', () => {
            bridge.assets.set('asset-1', { filename: 'photo.png', folderPath: '', hash: 'aa' });
            bridge.assets.emit(assetsEvent({ 'asset-1': { action: 'add' } }));

            const scope = tracker.consume();
            expect(scope.pages).toBeInstanceOf(Set);
            expect(scope.pages.size).toBe(0);
            expect([...scope.assetIds]).toEqual(['asset-1']);
        });

        it('marks everything when an added asset collides with an existing export path', () => {
            bridge.assets.set('asset-old', { filename: 'photo.png', folderPath: 'img', hash: 'aa' });
            bridge.assets.set('asset-new', { filename: 'PHOTO.png', folderPath: 'img', hash: 'bb' });
            bridge.assets.emit(assetsEvent({ 'asset-new': { action: 'add' } }));

            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for an added asset whose export name cannot be proven (no extension)', () => {
            bridge.assets.set('asset-1', { filename: 'photo', folderPath: '', hash: 'aa' });
            bridge.assets.emit(assetsEvent({ 'asset-1': { action: 'add' } }));
            expect(tracker.consume().pages).toBe('all');
        });

        it('marks everything for deletes (paths can be re-suffixed)', () => {
            bridge.assets.emit(assetsEvent({ 'asset-1': { action: 'delete', oldValue: { filename: 'a.png' } } }));
            expect(tracker.consume().pages).toBe('all');
        });

        it('only notes the asset for a pure content replacement (hash change, same path)', () => {
            bridge.assets.set('asset-1', { filename: 'photo.png', folderPath: '', hash: 'NEW', uploaded: false });
            bridge.assets.emit(
                assetsEvent({
                    'asset-1': {
                        action: 'update',
                        oldValue: { filename: 'photo.png', folderPath: '', hash: 'OLD', uploaded: true },
                    },
                }),
            );

            const scope = tracker.consume();
            expect(scope.pages).toBeInstanceOf(Set);
            expect(scope.pages.size).toBe(0);
            expect([...scope.assetIds]).toEqual(['asset-1']);
        });

        it('ignores bookkeeping-only updates (the uploaded flag flips during save)', () => {
            bridge.assets.set('asset-1', { filename: 'photo.png', folderPath: '', hash: 'aa', uploaded: true });
            bridge.assets.emit(
                assetsEvent({
                    'asset-1': {
                        action: 'update',
                        oldValue: { filename: 'photo.png', folderPath: '', hash: 'aa', uploaded: false },
                    },
                }),
            );

            expect(tracker.isEmpty()).toBe(true);
            expect(onDirty).not.toHaveBeenCalled();
        });

        it('marks everything for renames/moves (export paths are embedded in page HTML)', () => {
            bridge.assets.set('asset-1', { filename: 'renamed.png', folderPath: '', hash: 'aa' });
            bridge.assets.emit(
                assetsEvent({
                    'asset-1': { action: 'update', oldValue: { filename: 'photo.png', folderPath: '', hash: 'aa' } },
                }),
            );
            expect(tracker.consume().pages).toBe('all');
        });
    });

    describe('theme files', () => {
        it('marks everything for user-theme file changes', () => {
            bridge.themeFiles.emit({ changes: { keys: new Map() } });
            expect(tracker.consume().pages).toBe('all');
        });
    });

    describe('scope lifecycle', () => {
        it('consume() returns and resets the scope atomically', () => {
            bridge.emitStructure([{ path: [0, 'blocks', 1] }]);
            const scope = tracker.consume();
            expect([...scope.pages]).toEqual(['page-1']);
            expect(tracker.isEmpty()).toBe(true);

            // Changes after consume accumulate for the next round.
            bridge.emitStructure([{ path: [1, 'blocks', 0] }]);
            expect([...tracker.consume().pages]).toEqual(['page-2']);
        });

        it('merge() re-adds a consumed scope after a failed round', () => {
            bridge.emitStructure([{ path: [0, 'blocks', 1] }]);
            const scope = tracker.consume();
            expect(tracker.isEmpty()).toBe(true);

            tracker.merge(scope);
            expect([...tracker.consume().pages]).toEqual(['page-1']);
        });

        it('merge() preserves an all-scope and asset ids', () => {
            tracker.markAll();
            tracker.markAsset('asset-9');
            const scope = tracker.consume();

            tracker.merge(scope);
            const merged = tracker.consume();
            expect(merged.pages).toBe('all');
            expect([...merged.assetIds]).toEqual(['asset-9']);
        });

        it('merge() unions with changes recorded in the meantime', () => {
            bridge.emitStructure([{ path: [0, 'blocks', 1] }]);
            const scope = tracker.consume();
            bridge.emitStructure([{ path: [1, 'blocks', 1] }]);
            tracker.merge(scope);

            expect([...tracker.consume().pages].sort()).toEqual(['page-1', 'page-2']);
        });

        it('notifies onDirty for every recorded change but never from merge()', () => {
            bridge.emitStructure([{ path: [0, 'blocks', 1] }]);
            bridge.emitStructure([{ path: [0, 'blocks', 1] }]);
            expect(onDirty).toHaveBeenCalledTimes(2);

            const scope = tracker.consume();
            tracker.merge(scope);
            expect(onDirty).toHaveBeenCalledTimes(2);
        });
    });

    describe('attach/detach', () => {
        it('detach() removes every subscription', () => {
            tracker.detach();

            bridge.emitStructure([{ path: [] }]);
            bridge.metadata.emit(metadataEvent('title'));
            bridge.assets.emit(assetsEvent({ a: { action: 'delete' } }));
            bridge.themeFiles.emit({});

            expect(tracker.isEmpty()).toBe(true);
            expect(onDirty).not.toHaveBeenCalled();
            expect(bridge.structureObservers).toHaveLength(0);
        });

        it('attach() tolerates a bridge without the optional maps', () => {
            const minimal = new PreviewInvalidationTracker();
            expect(() => minimal.attach({ onStructureChange: () => () => {} })).not.toThrow();
            expect(() => minimal.attach(null)).not.toThrow();
        });
    });
});
