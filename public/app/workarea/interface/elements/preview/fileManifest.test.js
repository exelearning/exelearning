import { describe, it, expect } from 'vitest';
import { sha256Hex, buildManifest, diffManifests } from './fileManifest.js';

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('fileManifest', () => {
    describe('sha256Hex', () => {
        it('hashes bytes to lowercase hex (NIST vector)', async () => {
            const bytes = new TextEncoder().encode('abc');
            expect(await sha256Hex(bytes)).toBe(SHA256_ABC);
        });

        it('hashes the empty input', async () => {
            expect(await sha256Hex(new Uint8Array(0))).toBe(SHA256_EMPTY);
        });
    });

    describe('buildManifest', () => {
        it('maps paths to sha256 + byte size for mixed content types', async () => {
            const files = {
                'a.txt': new TextEncoder().encode('abc').buffer,
                'b.txt': 'abc',
            };
            const manifest = await buildManifest(files);
            expect(manifest['a.txt']).toEqual({ sha256: SHA256_ABC, size: 3 });
            expect(manifest['b.txt']).toEqual({ sha256: SHA256_ABC, size: 3 });
        });

        it('measures multibyte strings in UTF-8 bytes', async () => {
            const manifest = await buildManifest({ 'x.txt': 'ñ' });
            expect(manifest['x.txt'].size).toBe(2);
        });

        it('skips null/undefined entries', async () => {
            const manifest = await buildManifest({ 'x.txt': null, 'y.txt': 'abc' });
            expect(manifest['x.txt']).toBeUndefined();
            expect(manifest['y.txt']).toBeDefined();
        });
    });

    describe('diffManifests', () => {
        const prev = {
            'same.html': { sha256: 'h1', size: 1 },
            'changed.html': { sha256: 'h2', size: 2 },
            'removed.css': { sha256: 'h3', size: 3 },
        };
        const next = {
            'same.html': { sha256: 'h1', size: 1 },
            'changed.html': { sha256: 'h2b', size: 2 },
            'added.js': { sha256: 'h4', size: 4 },
        };

        it('classifies added, changed, removed and unchanged paths', () => {
            const result = diffManifests(prev, next);
            expect(result.added).toEqual(['added.js']);
            expect(result.changed).toEqual(['changed.html']);
            expect(result.removed).toEqual(['removed.css']);
            expect(result.unchanged).toEqual(['same.html']);
        });

        it('treats a null previous manifest as all-added', () => {
            const result = diffManifests(null, next);
            expect(result.added.sort()).toEqual(['added.js', 'changed.html', 'same.html']);
            expect(result.changed).toEqual([]);
            expect(result.removed).toEqual([]);
        });
    });
});
