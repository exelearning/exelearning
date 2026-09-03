/**
 * Zstandard compression for large immutable static-build payloads.
 *
 * Uses the zstd bindings built into Bun/Node's zlib — no extra build
 * dependency. The browser side decompresses with the vendored fzstd UMD
 * (public/libs/fzstd/fzstd.umd.js, loaded by the static index).
 *
 * Level 19 trades build-time CPU for the best practical ratio on JSON-shaped
 * data; these payloads are compressed once per build.
 */

import zlib from 'zlib';

export const ZSTD_LEVEL = 19;

export function zstdCompress(input: Buffer): Buffer {
    return zlib.zstdCompressSync(input, {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL },
    });
}

export function zstdDecompress(input: Buffer): Buffer {
    return zlib.zstdDecompressSync(input);
}
