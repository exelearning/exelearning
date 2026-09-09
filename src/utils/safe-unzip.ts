/**
 * Safe ZIP decompression utility — single source of truth for ZIP-bomb
 * (decompression-bomb) protection across every server-side `unzipSync` sink.
 *
 * Background: `fflate.unzipSync` returns every entry fully decompressed in
 * memory. DEFLATE reaches ratios near 1000:1 on repetitive data, so a tiny
 * upload (~50 KB) can declare/inflate to tens of GB and OOM the shared server.
 * The ELP/ELPX import path was already hardened with this guard; this module
 * extracts that logic so the file-manager extraction, theme/template upload
 * validation, and generic ZIP service share one bounded inflate path instead of
 * re-implementing (and forgetting) it.
 *
 * The `filter` callback receives each entry's `originalSize` (the uncompressed
 * size recorded in the ZIP central directory) and runs BEFORE the entry is
 * inflated, so we refuse oversized/over-numerous archives without materialising
 * the offending bytes.
 *
 * KNOWN LIMITATION (intentional): `originalSize` is attacker-declared metadata,
 * not a measured value. A crafted entry can understate it and then inflate to
 * more than declared; fflate decompresses synchronously and cannot abort
 * mid-entry through this filter. The declared-size check still stops the common
 * over-declared zip bomb cheaply and without inflation.
 */
import * as fflateModule from 'fflate';

/** Caps applied to every inflate path. */
export interface ZipDecompressionLimits {
    /** Maximum total uncompressed bytes across all entries. */
    maxTotalBytes: number;
    /** Maximum uncompressed bytes for any single entry. */
    maxEntryBytes: number;
    /** Maximum number of entries in the archive. */
    maxEntries: number;
}

/** Default ZIP decompression limits applied to every inflate path. */
export const DEFAULT_ZIP_LIMITS: ZipDecompressionLimits = {
    maxTotalBytes: 500 * 1024 * 1024, // 500 MB cumulative
    maxEntryBytes: 200 * 1024 * 1024, // 200 MB per entry
    maxEntries: 10000, // entry-count cap
};

/**
 * Thrown when a ZIP archive would exceed the configured decompression limits.
 * The inflate is aborted before the offending data is materialised in memory.
 */
export class ZipLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ZipLimitError';
    }
}

/** Options for {@link safeUnzipSync}. */
export interface SafeUnzipOptions {
    /** Override any subset of the default decompression limits. */
    limits?: Partial<ZipDecompressionLimits>;
    /** Human-readable archive label used in error messages. */
    label?: string;
    /** Injectable fflate (defaults to the real module; used for testing/DI). */
    fflate?: Pick<typeof fflateModule, 'unzipSync'>;
}

/**
 * Decompress a ZIP buffer with hard limits enforced BEFORE inflation, so a zip
 * bomb cannot OOM the process. Throws {@link ZipLimitError} when a per-entry,
 * cumulative, or entry-count cap would be exceeded.
 */
export function safeUnzipSync(buffer: Uint8Array, options: SafeUnzipOptions = {}): Record<string, Uint8Array> {
    const { maxTotalBytes, maxEntryBytes, maxEntries } = { ...DEFAULT_ZIP_LIMITS, ...options.limits };
    const label = options.label ?? 'archive';
    const fflate = options.fflate ?? fflateModule;
    let cumulativeBytes = 0;
    let entryCount = 0;

    return fflate.unzipSync(buffer, {
        filter: (file: { name: string; originalSize: number }) => {
            entryCount++;
            if (entryCount > maxEntries) {
                throw new ZipLimitError(`${label} exceeds the maximum allowed number of entries (${maxEntries}).`);
            }

            // NOTE: `originalSize` is the attacker-declared uncompressed size from
            // the central directory, checked before inflation as a cheap guard.
            const entrySize = file.originalSize;
            if (entrySize > maxEntryBytes) {
                throw new ZipLimitError(
                    `Entry '${file.name}' in ${label} is too large when decompressed ` +
                        `(${entrySize} bytes > ${maxEntryBytes} byte limit).`,
                );
            }

            cumulativeBytes += entrySize;
            if (cumulativeBytes > maxTotalBytes) {
                throw new ZipLimitError(
                    `${label} exceeds the maximum total decompressed size ` +
                        `(${cumulativeBytes} bytes > ${maxTotalBytes} byte limit).`,
                );
            }

            return true;
        },
    });
}
