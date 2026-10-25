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
 * `originalSize` is attacker-declared metadata, not a measured value. A crafted
 * entry that understates it does not get past the caps: fflate inflates each
 * entry into a buffer of exactly the declared size and stops there, so such an
 * entry comes back truncated (corrupt), never larger than declared. The spec
 * pins that behavior because the memory bound depends on it.
 */
import * as fflateModule from 'fflate';
import {
    DEFAULT_ZIP_LIMITS,
    entryCountError,
    entrySizeError,
    totalSizeError,
    type ZipDecompressionLimits,
} from '../shared/import/importPolicy';

// The limits and the error type come from the shared import policy so every
// server unzip sink and the ELP/ELPX importer report the same ZipLimitError
// (with structured `details`) against the same conservative caps.
export { DEFAULT_ZIP_LIMITS, ZipLimitError, type ZipDecompressionLimits } from '../shared/import/importPolicy';

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
                throw entryCountError(label, entryCount, maxEntries);
            }

            // `originalSize` is the declared uncompressed size from the central
            // directory; fflate never inflates past it (see the module comment).
            const entrySize = file.originalSize;
            if (entrySize > maxEntryBytes) {
                throw entrySizeError(label, file.name, entrySize, maxEntryBytes);
            }

            cumulativeBytes += entrySize;
            if (cumulativeBytes > maxTotalBytes) {
                throw totalSizeError(label, cumulativeBytes, maxTotalBytes);
            }

            return true;
        },
    });
}
