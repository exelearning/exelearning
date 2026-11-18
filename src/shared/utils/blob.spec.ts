import { describe, expect, it } from 'bun:test';
import { blobFromBytes } from './blob';

describe('blobFromBytes', () => {
    it('wraps bytes in a Blob with the given MIME type', () => {
        const bytes = new TextEncoder().encode('hello');
        const blob = blobFromBytes(bytes, 'application/zip');
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/zip');
        expect(blob.size).toBe(5);
    });

    it('preserves the byte content', async () => {
        const bytes = Uint8Array.from([1, 2, 3]);
        const blob = blobFromBytes(bytes, 'application/octet-stream');
        const restored = new Uint8Array(await blob.arrayBuffer());
        expect(Array.from(restored)).toEqual([1, 2, 3]);
    });

    it('accepts empty input', () => {
        expect(blobFromBytes(new Uint8Array([]), 'text/plain').size).toBe(0);
    });
});
