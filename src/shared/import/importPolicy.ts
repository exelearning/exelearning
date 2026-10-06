/**
 * Shared ELP/ELPX import policy — the single source of truth for how much a
 * given runtime is allowed to decompress, and for the desktop-compatibility
 * check used by the ELPX export warning.
 *
 * Why this module exists
 * ----------------------
 * `fflate.unzipSync` returns every entry fully decompressed in memory, so a
 * tiny upload can expand to tens of GB and OOM a shared server (a "ZIP bomb").
 * The importer therefore refuses oversized entries BEFORE they are inflated,
 * using three independent caps (per-entry, cumulative, entry-count).
 *
 * Those caps must be conservative for hosted web, server, CLI, static PWA and
 * embedded runtimes, which share memory with many users. The Electron desktop
 * application, however, runs on the user's own machine and legitimately needs
 * to open projects containing a single large media asset (e.g. a ~360 MB
 * lecture video) that the conservative per-entry cap would reject. See #2193.
 *
 * The fix is NOT to relax the shared defaults. Instead this module exposes two
 * explicit, validated policies and a runtime selector. The core importer stays
 * environment-agnostic: it merely receives validated limits. The desktop
 * per-entry threshold is ALSO the source of truth for the export-side warning,
 * so the editor never silently produces an ELPX the desktop app cannot reopen.
 *
 * NOTE (documented limitation, intentional): the desktop path still uses the
 * synchronous in-memory `unzipSync`. The desktop caps below bound that memory
 * use; they are not a claim that synchronous extraction is safe for
 * arbitrarily large archives. Streaming/lazy extraction remains future work.
 */

const MiB = 1024 * 1024;

/**
 * Decompression safety limits (ZIP-bomb / resource-exhaustion protection).
 * All three caps are enforced against the declared uncompressed sizes in the
 * ZIP central directory before any entry is inflated.
 */
export interface ZipDecompressionLimits {
    /** Maximum total uncompressed bytes across all entries. */
    maxTotalBytes: number;
    /** Maximum uncompressed bytes for any single entry. */
    maxEntryBytes: number;
    /** Maximum number of entries in the archive. */
    maxEntries: number;
}

/**
 * Conservative limits applied to hosted web, server, CLI, static PWA and
 * embedded imports. These are the historical defaults and MUST stay
 * conservative — every non-desktop runtime shares memory with other users.
 */
export const CONSERVATIVE_ZIP_LIMITS: ZipDecompressionLimits = {
    maxTotalBytes: 500 * MiB, // 500 MiB cumulative
    maxEntryBytes: 200 * MiB, // 200 MiB per entry
    maxEntries: 10000, // entry-count cap
};

/**
 * Backwards-compatible alias. Historically the importer's default limits lived
 * in `ElpxImporter.ts` as `DEFAULT_ZIP_LIMITS`; that symbol now points here so
 * there is a single definition. Every runtime that does not explicitly opt into
 * the desktop policy uses these conservative defaults.
 */
export const DEFAULT_ZIP_LIMITS: ZipDecompressionLimits = CONSERVATIVE_ZIP_LIMITS;

/**
 * Explicit policy for the Electron desktop application. The per-entry cap is
 * raised to 1 GiB so a single large media asset (the #2193 failure was a
 * ~360 MB MP4) can be opened, and the cumulative cap to 2 GiB. The entry-count
 * cap is deliberately left at the conservative value. These bounds keep the
 * synchronous in-memory extraction path from being effectively unlimited.
 */
export const DESKTOP_ZIP_LIMITS: ZipDecompressionLimits = {
    maxTotalBytes: 2048 * MiB, // 2 GiB cumulative
    maxEntryBytes: 1024 * MiB, // 1 GiB per entry
    maxEntries: 10000, // entry-count cap (same as conservative)
};

/**
 * Per-entry size above which the desktop application asks the user to confirm a
 * large import. It is the conservative per-entry cap: anything a non-desktop
 * runtime would reject triggers a confirmation on desktop (up to the desktop
 * hard limit), so a large import is never silently retried with weaker
 * protections.
 */
export const DESKTOP_CONFIRM_ENTRY_BYTES: number = CONSERVATIVE_ZIP_LIMITS.maxEntryBytes;

/** Runtimes that select an import policy. Everything that is not the Electron
 * desktop app ("hosted") shares the conservative policy. */
export type ImportRuntime = 'desktop' | 'hosted';

/** Select the decompression limits for a runtime. */
export function getZipLimitsForRuntime(runtime: ImportRuntime): ZipDecompressionLimits {
    return runtime === 'desktop' ? DESKTOP_ZIP_LIMITS : CONSERVATIVE_ZIP_LIMITS;
}

/**
 * Validate a fully-specified limits object at one boundary. Rejects values that
 * would disable or corrupt the ZIP-bomb protection: non-finite, non-positive,
 * non-integer entry counts, and inconsistent caps (an entry cap larger than the
 * total cap can never be reached). Returns the same object when valid so it can
 * be used inline.
 */
export function validateZipLimits(limits: ZipDecompressionLimits): ZipDecompressionLimits {
    const { maxTotalBytes, maxEntryBytes, maxEntries } = limits ?? ({} as ZipDecompressionLimits);

    const isPositiveFinite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

    if (!isPositiveFinite(maxTotalBytes)) {
        throw new TypeError(`Invalid maxTotalBytes: expected a positive finite number, got ${String(maxTotalBytes)}.`);
    }
    if (!isPositiveFinite(maxEntryBytes)) {
        throw new TypeError(`Invalid maxEntryBytes: expected a positive finite number, got ${String(maxEntryBytes)}.`);
    }
    if (!isPositiveFinite(maxEntries) || !Number.isInteger(maxEntries)) {
        throw new TypeError(`Invalid maxEntries: expected a positive integer, got ${String(maxEntries)}.`);
    }
    if (maxEntryBytes > maxTotalBytes) {
        throw new RangeError(
            `Invalid limits: maxEntryBytes (${maxEntryBytes}) cannot exceed maxTotalBytes (${maxTotalBytes}).`,
        );
    }

    return limits;
}

/** The kind of decompression cap a {@link ZipLimitError} refers to. */
export type ZipLimitKind = 'entry-size' | 'total-size' | 'entry-count';

/**
 * Structured description of a limit violation so UI code can render an
 * actionable, translated message without parsing the human-readable string.
 */
export interface ZipLimitDetails {
    kind: ZipLimitKind;
    archiveLabel: string;
    entryName?: string;
    actualValue: number;
    limitValue: number;
}

/**
 * Thrown when a ZIP archive would exceed the configured decompression limits.
 * The inflate is aborted before the offending data is materialised in memory.
 * Carries {@link ZipLimitDetails} so callers can build actionable messages.
 */
export class ZipLimitError extends Error {
    readonly details: ZipLimitDetails;

    constructor(message: string, details: ZipLimitDetails) {
        super(message);
        this.name = 'ZipLimitError';
        this.details = details;
        // Preserve prototype chain across the TS/bundle boundary.
        Object.setPrototypeOf(this, ZipLimitError.prototype);
    }
}

/** Build the canonical per-entry-size error (message kept stable for tests). */
export function entrySizeError(label: string, entryName: string, actual: number, limit: number): ZipLimitError {
    return new ZipLimitError(
        `Entry '${entryName}' in ${label} is too large when decompressed (${actual} bytes > ${limit} byte limit).`,
        { kind: 'entry-size', archiveLabel: label, entryName, actualValue: actual, limitValue: limit },
    );
}

/** Build the canonical cumulative-size error (message kept stable for tests). */
export function totalSizeError(label: string, actual: number, limit: number): ZipLimitError {
    return new ZipLimitError(
        `${label} exceeds the maximum total decompressed size (${actual} bytes > ${limit} byte limit).`,
        { kind: 'total-size', archiveLabel: label, actualValue: actual, limitValue: limit },
    );
}

/** Build the canonical entry-count error (message kept stable for tests). */
export function entryCountError(label: string, actual: number, limit: number): ZipLimitError {
    return new ZipLimitError(`${label} exceeds the maximum allowed number of entries (${limit}).`, {
        kind: 'entry-count',
        archiveLabel: label,
        actualValue: actual,
        limitValue: limit,
    });
}

/** A single archive entry's declared metadata (name + uncompressed size). */
export interface ArchiveEntryInfo {
    name: string;
    size: number;
}

/**
 * Result of inspecting a ZIP archive's central directory WITHOUT inflating any
 * entry. Produced by `inspectZipArchive` (see ElpxImporter.ts).
 */
export interface ArchiveInspection {
    entries: ArchiveEntryInfo[];
    totalBytes: number;
    entryCount: number;
    largestEntry: ArchiveEntryInfo | null;
}

/**
 * Assert that a pre-computed archive inspection fits within the given limits,
 * throwing a structured {@link ZipLimitError} otherwise. Used as a preflight so
 * an oversized archive is rejected before any inflation or project mutation.
 * Comparisons use `>` so a value exactly equal to a limit is accepted.
 */
export function assertInspectionWithinLimits(
    inspection: ArchiveInspection,
    limits: ZipDecompressionLimits,
    label: string,
): void {
    validateZipLimits(limits);

    if (inspection.entryCount > limits.maxEntries) {
        throw entryCountError(label, inspection.entryCount, limits.maxEntries);
    }
    if (inspection.largestEntry && inspection.largestEntry.size > limits.maxEntryBytes) {
        throw entrySizeError(label, inspection.largestEntry.name, inspection.largestEntry.size, limits.maxEntryBytes);
    }
    if (inspection.totalBytes > limits.maxTotalBytes) {
        throw totalSizeError(label, inspection.totalBytes, limits.maxTotalBytes);
    }
}

/** Thrown when the user cancels a controlled large-file desktop import. Distinct
 * from {@link ZipLimitError} so callers can silently leave the project
 * unchanged instead of showing an error. */
export class ImportCancelledError extends Error {
    constructor(message = 'Import cancelled by user') {
        super(message);
        this.name = 'ImportCancelledError';
        Object.setPrototypeOf(this, ImportCancelledError.prototype);
    }
}

/** An asset considered for desktop-export compatibility (name + byte size). */
export interface ExportAssetInfo {
    name: string;
    size: number;
}

/** Result of {@link getDesktopExportCompatibility}. */
export interface DesktopExportCompatibility {
    /** True when the export can be reopened by the desktop application. */
    compatible: boolean;
    /** Cumulative size of all assets considered. */
    totalBytes: number;
    /** Desktop per-entry limit used for the check. */
    entryLimit: number;
    /** Desktop cumulative limit used for the check. */
    totalLimit: number;
    /** The largest asset overall (may still be compatible), or null when empty. */
    largestAsset: ExportAssetInfo | null;
    /** The largest asset exceeding the desktop per-entry limit, or null. */
    oversizedAsset: ExportAssetInfo | null;
    /** True when the cumulative size exceeds the desktop total limit. */
    exceedsTotal: boolean;
}

/**
 * Determine whether an ELPX built from these assets could be reopened by the
 * desktop application, using the desktop policy as the single source of truth.
 * An export is incompatible when any asset exceeds the desktop per-entry limit
 * or the cumulative size exceeds the desktop total limit. Assets exactly at a
 * limit are compatible (`>` comparison).
 */
export function getDesktopExportCompatibility(
    assets: ExportAssetInfo[],
    limits: ZipDecompressionLimits = DESKTOP_ZIP_LIMITS,
): DesktopExportCompatibility {
    let totalBytes = 0;
    let largestAsset: ExportAssetInfo | null = null;
    let oversizedAsset: ExportAssetInfo | null = null;

    for (const asset of assets) {
        const size = Number.isFinite(asset.size) && asset.size > 0 ? asset.size : 0;
        totalBytes += size;
        if (largestAsset === null || size > largestAsset.size) {
            largestAsset = { name: asset.name, size };
        }
        if (size > limits.maxEntryBytes && (oversizedAsset === null || size > oversizedAsset.size)) {
            oversizedAsset = { name: asset.name, size };
        }
    }

    const exceedsTotal = totalBytes > limits.maxTotalBytes;

    return {
        compatible: oversizedAsset === null && !exceedsTotal,
        totalBytes,
        entryLimit: limits.maxEntryBytes,
        totalLimit: limits.maxTotalBytes,
        largestAsset,
        oversizedAsset,
        exceedsTotal,
    };
}

/**
 * Format a byte count as a short human-readable string (1024-based, one
 * decimal place). Used by import/export messages so both surfaces render sizes
 * identically. Kept dependency-free so it works in the bundle and in tests.
 */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    if (unitIndex === 0) {
        return `${value} B`;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}
