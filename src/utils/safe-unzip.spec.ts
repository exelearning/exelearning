import { describe, it, expect } from 'bun:test';
import { zipSync, strToU8 } from 'fflate';
import { safeUnzipSync, ZipLimitError, DEFAULT_ZIP_LIMITS } from './safe-unzip';
import { ZipLimitError as PolicyZipLimitError } from '../shared/import/importPolicy';

describe('safe-unzip', () => {
    describe('DEFAULT_ZIP_LIMITS', () => {
        it('exposes conservative caps well above any legitimate package', () => {
            expect(DEFAULT_ZIP_LIMITS.maxTotalBytes).toBe(500 * 1024 * 1024);
            expect(DEFAULT_ZIP_LIMITS.maxEntryBytes).toBe(200 * 1024 * 1024);
            expect(DEFAULT_ZIP_LIMITS.maxEntries).toBe(10000);
        });
    });

    describe('safeUnzipSync', () => {
        it('decompresses a normal archive and returns its entries', () => {
            const zip = zipSync({ 'a.txt': strToU8('hello'), 'b/c.txt': strToU8('world') });
            const out = safeUnzipSync(zip);
            expect(new TextDecoder().decode(out['a.txt'])).toBe('hello');
            expect(new TextDecoder().decode(out['b/c.txt'])).toBe('world');
        });

        it('throws ZipLimitError when a single entry exceeds the per-entry cap', () => {
            const zip = zipSync({ 'big.bin': new Uint8Array(2048) });
            expect(() => safeUnzipSync(zip, { limits: { maxEntryBytes: 1024 } })).toThrow(ZipLimitError);
            try {
                safeUnzipSync(zip, { limits: { maxEntryBytes: 1024 }, label: 'theme ZIP' });
            } catch (err) {
                expect(err).toBeInstanceOf(ZipLimitError);
                expect((err as Error).message).toMatch(/too large when decompressed/);
                expect((err as Error).message).toContain('theme ZIP');
            }
        });

        it('throws ZipLimitError when the cumulative size exceeds the total cap', () => {
            const zip = zipSync({ 'a.bin': new Uint8Array(600), 'b.bin': new Uint8Array(600) });
            // Each entry (600) is under the per-entry cap, but together they exceed 1000.
            expect(() => safeUnzipSync(zip, { limits: { maxEntryBytes: 1024, maxTotalBytes: 1000 } })).toThrow(
                /maximum total decompressed size/,
            );
        });

        it('throws ZipLimitError when the archive has too many entries', () => {
            const zip = zipSync({ 'a.txt': strToU8('a'), 'b.txt': strToU8('b'), 'c.txt': strToU8('c') });
            expect(() => safeUnzipSync(zip, { limits: { maxEntries: 2 } })).toThrow(
                /maximum allowed number of entries/,
            );
        });

        it('never inflates an entry past its declared size, even when the declaration lies', () => {
            // Shrink the declared uncompressed size of a 1 MiB entry to 1 KiB in
            // both the local header and the central directory. The size checks
            // trust that declaration, so the memory bound depends on fflate
            // allocating exactly the declared size and stopping there.
            const zip = zipSync({ 'lie.bin': [new Uint8Array(1024 * 1024), { level: 9 }] });
            const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
            const centralDirectory = view.getUint32(zip.length - 22 + 16, true);
            view.setUint32(22, 1024, true);
            view.setUint32(centralDirectory + 24, 1024, true);

            const out = safeUnzipSync(zip, { limits: { maxEntryBytes: 2048, maxTotalBytes: 2048 } });
            expect(out['lie.bin'].length).toBe(1024);
        });

        it('uses an injected fflate implementation when provided', () => {
            let called = false;
            const fakeFflate = {
                unzipSync: (_buf: Uint8Array, _opts: unknown) => {
                    called = true;
                    return { 'x.txt': strToU8('x') };
                },
            };
            const out = safeUnzipSync(new Uint8Array([1, 2, 3]), { fflate: fakeFflate });
            expect(called).toBe(true);
            expect(new TextDecoder().decode(out['x.txt'])).toBe('x');
        });
    });

    describe('ZipLimitError', () => {
        it('is the shared import-policy error, with structured details', () => {
            const zip = zipSync({ 'big.bin': new Uint8Array(2048) });
            let caught: unknown;
            try {
                safeUnzipSync(zip, { label: 'theme ZIP', limits: { maxEntryBytes: 1024 } });
            } catch (err) {
                caught = err;
            }
            expect(caught).toBeInstanceOf(PolicyZipLimitError);
            expect(ZipLimitError).toBe(PolicyZipLimitError);
            expect((caught as PolicyZipLimitError).details).toEqual({
                kind: 'entry-size',
                archiveLabel: 'theme ZIP',
                entryName: 'big.bin',
                actualValue: 2048,
                limitValue: 1024,
            });
        });
    });
});
