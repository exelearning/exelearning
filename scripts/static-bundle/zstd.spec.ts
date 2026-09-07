import { describe, expect, it } from 'bun:test';

import { ZSTD_LEVEL, zstdCompress, zstdDecompress } from './zstd';

describe('zstd helpers', () => {
    it('round-trips JSON-shaped payloads byte-identically', () => {
        const payload = Buffer.from(JSON.stringify({ translations: { es: { hola: 'mundo' } }, list: Array(500).fill('x') }));

        const compressed = zstdCompress(payload);
        const restored = zstdDecompress(compressed);

        expect(restored.equals(payload)).toBe(true);
        expect(compressed.length).toBeLessThan(payload.length);
    });

    it('produces a zstd frame the browser-side fzstd decoder accepts (magic number)', () => {
        const compressed = zstdCompress(Buffer.from('static bundle data'));
        // Zstandard frame magic: 0xFD2FB528 (little-endian on disk)
        expect(compressed.readUInt32LE(0)).toBe(0xfd2fb528);
    });

    it('pins the build-time compression level', () => {
        expect(ZSTD_LEVEL).toBe(19);
    });
});
