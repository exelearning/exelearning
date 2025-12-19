import { describe, it, expect, vi } from 'vitest';
import { MockYDoc, MockYMap, MockYArray, MockUndoManager } from './mock-yjs.js';

describe('mock-yjs helpers', () => {
    it('creates maps and arrays per key on MockYDoc', () => {
        const doc = new MockYDoc();
        const mapA = doc.getMap('meta');
        const mapB = doc.getMap('meta');
        const arrayA = doc.getArray('blocks');
        const arrayB = doc.getArray('blocks');

        expect(mapA).toBe(mapB);
        expect(arrayA).toBe(arrayB);
    });

    it('registers and unregisters update listeners on MockYDoc', () => {
        const doc = new MockYDoc();
        const handler = vi.fn();

        doc.on('update', handler);
        expect(doc._updateListeners).toContain(handler);

        doc.off('update', handler);
        expect(doc._updateListeners).not.toContain(handler);
    });

    it('creates distinct maps and arrays for different keys', () => {
        const doc = new MockYDoc();

        expect(doc.getMap('a')).not.toBe(doc.getMap('b'));
        expect(doc.getArray('one')).not.toBe(doc.getArray('two'));
    });

    it('transacts updates immediately', () => {
        const doc = new MockYDoc();
        const spy = vi.fn();

        doc.transact(spy);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('supports MockYMap basic operations', () => {
        const map = new MockYMap({ title: 'Hello' });
        map.set('count', 2);

        expect(map.get('title')).toBe('Hello');
        expect(map.has('count')).toBe(true);
        expect(map.delete('title')).toBe(true);
        expect(map.has('title')).toBe(false);
        expect(map.toJSON()).toEqual({ count: 2 });
    });

    it('builds a readable string from content fields', () => {
        const map = new MockYMap({ content: '<p>Text</p>' });
        expect(map.toString()).toBe('<p>Text</p>');
    });

    it('falls back to htmlContent string', () => {
        const map = new MockYMap({ htmlContent: '<p>Html</p>' });
        expect(map.toString()).toBe('<p>Html</p>');
    });

    it('provides iterable entries', () => {
        const map = new MockYMap({ a: 1, b: 2 });
        const keys = [];

        for (const [key] of map.entries()) {
            keys.push(key);
        }

        expect(keys.sort()).toEqual(['a', 'b']);
    });

    it('iterates keys and values', () => {
        const map = new MockYMap({ a: 1, b: 2 });
        const keys = Array.from(map.keys());
        const values = Array.from(map.values());

        expect(keys.sort()).toEqual(['a', 'b']);
        expect(values.sort()).toEqual([1, 2]);
    });

    it('executes forEach callback for entries', () => {
        const map = new MockYMap({ a: 1, b: 2 });
        const seen = [];

        map.forEach((value, key) => {
            seen.push([key, value]);
        });

        expect(seen).toEqual([
            ['a', 1],
            ['b', 2],
        ]);
    });

    it('returns a default string when no content is available', () => {
        const map = new MockYMap();
        expect(map.toString()).toBe('[object MockYMap]');
    });

    it('handles MockYArray mutations', () => {
        const array = new MockYArray(['a']);
        array.push('b');
        array.insert(1, ['x', 'y']);
        array.delete(0, 1);

        expect(array.length).toBe(3);
        expect(array.get(0)).toBe('x');
        expect(array.toArray()).toEqual(['x', 'y', 'b']);
    });

    it('serializes MockYArray items with toJSON when available', () => {
        const item = { toJSON: () => ({ ok: true }) };
        const array = new MockYArray([item, 'plain']);

        expect(array.toJSON()).toEqual([{ ok: true }, 'plain']);
    });

    it('iterates MockYArray items', () => {
        const array = new MockYArray(['a', 'b']);
        const items = [];

        for (const item of array) {
            items.push(item);
        }

        expect(items).toEqual(['a', 'b']);
    });

    it('creates a basic undo manager', () => {
        const manager = new MockUndoManager();
        expect(manager.undoStack).toEqual([]);
        expect(manager.redoStack).toEqual([]);
    });
});
