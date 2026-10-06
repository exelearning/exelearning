/**
 * Tests for the shared ELP/ELPX import policy.
 *
 * This module is the single source of truth for decompression limits across
 * every runtime (hosted web, server, CLI, static PWA, embedded, Electron
 * desktop) and for the desktop-compatibility check used by the ELPX export
 * warning. The conservative defaults must stay conservative; only the desktop
 * runtime receives the larger, explicit policy.
 */
import { describe, it, expect } from 'bun:test';

import {
    CONSERVATIVE_ZIP_LIMITS,
    DESKTOP_ZIP_LIMITS,
    DESKTOP_CONFIRM_ENTRY_BYTES,
    getZipLimitsForRuntime,
    validateZipLimits,
    assertInspectionWithinLimits,
    getDesktopExportCompatibility,
    formatBytes,
    ImportCancelledError,
    ZipLimitError,
} from './importPolicy';

const MiB = 1024 * 1024;

describe('conservative vs desktop limits', () => {
    it('keeps the conservative defaults at 200 MiB per entry / 500 MiB total / 10000 entries', () => {
        expect(CONSERVATIVE_ZIP_LIMITS.maxEntryBytes).toBe(200 * MiB);
        expect(CONSERVATIVE_ZIP_LIMITS.maxTotalBytes).toBe(500 * MiB);
        expect(CONSERVATIVE_ZIP_LIMITS.maxEntries).toBe(10000);
    });

    it('raises only the byte caps for desktop, keeping the entry-count cap conservative', () => {
        expect(DESKTOP_ZIP_LIMITS.maxEntryBytes).toBeGreaterThan(CONSERVATIVE_ZIP_LIMITS.maxEntryBytes);
        expect(DESKTOP_ZIP_LIMITS.maxTotalBytes).toBeGreaterThan(CONSERVATIVE_ZIP_LIMITS.maxTotalBytes);
        expect(DESKTOP_ZIP_LIMITS.maxEntries).toBe(CONSERVATIVE_ZIP_LIMITS.maxEntries);
    });

    it('lets desktop accept the reported ~360 MiB real-world asset', () => {
        expect(DESKTOP_ZIP_LIMITS.maxEntryBytes).toBeGreaterThanOrEqual(360 * MiB);
    });

    it('asks for desktop confirmation exactly at the conservative per-entry threshold', () => {
        expect(DESKTOP_CONFIRM_ENTRY_BYTES).toBe(CONSERVATIVE_ZIP_LIMITS.maxEntryBytes);
    });
});

describe('getZipLimitsForRuntime', () => {
    it('returns conservative limits for hosted/server/CLI/static/embedded', () => {
        expect(getZipLimitsForRuntime('hosted')).toEqual(CONSERVATIVE_ZIP_LIMITS);
    });

    it('returns the explicit desktop policy for the desktop runtime', () => {
        expect(getZipLimitsForRuntime('desktop')).toEqual(DESKTOP_ZIP_LIMITS);
    });
});

describe('validateZipLimits', () => {
    it('accepts a valid full limits object', () => {
        const limits = { maxTotalBytes: 10, maxEntryBytes: 5, maxEntries: 3 };
        expect(validateZipLimits(limits)).toEqual(limits);
    });

    it.each([
        ['negative entry bytes', { maxTotalBytes: 10, maxEntryBytes: -1, maxEntries: 3 }],
        ['zero total bytes', { maxTotalBytes: 0, maxEntryBytes: 5, maxEntries: 3 }],
        ['NaN entry bytes', { maxTotalBytes: 10, maxEntryBytes: Number.NaN, maxEntries: 3 }],
        ['infinite total bytes', { maxTotalBytes: Number.POSITIVE_INFINITY, maxEntryBytes: 5, maxEntries: 3 }],
        ['non-integer entry count', { maxTotalBytes: 10, maxEntryBytes: 5, maxEntries: 2.5 }],
        ['zero entry count', { maxTotalBytes: 10, maxEntryBytes: 5, maxEntries: 0 }],
        ['entry larger than total (inconsistent)', { maxTotalBytes: 4, maxEntryBytes: 5, maxEntries: 3 }],
    ])('rejects %s', (_label, limits) => {
        expect(() => validateZipLimits(limits as never)).toThrow();
    });
});

describe('assertInspectionWithinLimits', () => {
    const limits = { maxTotalBytes: 100, maxEntryBytes: 40, maxEntries: 3 };
    const inspect = (entries: { name: string; size: number }[]) => ({
        entries,
        totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
        entryCount: entries.length,
        largestEntry: entries.reduce<{ name: string; size: number } | null>(
            (max, e) => (max === null || e.size > max.size ? e : max),
            null,
        ),
    });

    it('does not throw when the archive is within limits', () => {
        expect(() => assertInspectionWithinLimits(inspect([{ name: 'a', size: 40 }]), limits, 'archive')).not.toThrow();
    });

    it('accepts an entry exactly equal to the per-entry limit (> comparison)', () => {
        expect(() => assertInspectionWithinLimits(inspect([{ name: 'a', size: 40 }]), limits, 'archive')).not.toThrow();
    });

    it('rejects an entry one byte over the per-entry limit with structured details', () => {
        try {
            assertInspectionWithinLimits(inspect([{ name: 'big.mp4', size: 41 }]), limits, 'archive');
            throw new Error('expected ZipLimitError');
        } catch (err) {
            expect(err).toBeInstanceOf(ZipLimitError);
            const details = (err as ZipLimitError).details;
            expect(details.kind).toBe('entry-size');
            expect(details.entryName).toBe('big.mp4');
            expect(details.actualValue).toBe(41);
            expect(details.limitValue).toBe(40);
            expect(details.archiveLabel).toBe('archive');
        }
    });

    it('rejects when cumulative size exceeds the total limit', () => {
        try {
            assertInspectionWithinLimits(
                inspect([
                    { name: 'a', size: 40 },
                    { name: 'b', size: 40 },
                    { name: 'c', size: 40 },
                ]),
                limits,
                'archive',
            );
            throw new Error('expected ZipLimitError');
        } catch (err) {
            expect((err as ZipLimitError).details.kind).toBe('total-size');
        }
    });

    it('rejects when the entry count exceeds the cap', () => {
        try {
            assertInspectionWithinLimits(
                inspect([
                    { name: 'a', size: 1 },
                    { name: 'b', size: 1 },
                    { name: 'c', size: 1 },
                    { name: 'd', size: 1 },
                ]),
                limits,
                'archive',
            );
            throw new Error('expected ZipLimitError');
        } catch (err) {
            expect((err as ZipLimitError).details.kind).toBe('entry-count');
        }
    });
});

describe('getDesktopExportCompatibility', () => {
    it('reports compatible when every asset is within the desktop policy', () => {
        const result = getDesktopExportCompatibility([
            { name: 'small.png', size: 10 * MiB },
            { name: 'medium.mp4', size: 300 * MiB },
        ]);
        expect(result.compatible).toBe(true);
        expect(result.oversizedAsset).toBeNull();
        expect(result.exceedsTotal).toBe(false);
    });

    it('does not warn about an asset between the conservative and desktop limits', () => {
        // 300 MiB is above the 200 MiB conservative cap but well within the
        // 1 GiB desktop cap, so the desktop app can open it (with confirmation).
        const result = getDesktopExportCompatibility([{ name: 'video.mp4', size: 300 * MiB }]);
        expect(result.compatible).toBe(true);
    });

    it('flags the largest asset that exceeds the desktop per-entry limit', () => {
        const result = getDesktopExportCompatibility([
            { name: 'ok.mp4', size: 500 * MiB },
            { name: 'huge.mp4', size: 1500 * MiB },
            { name: 'big.mp4', size: 1100 * MiB },
        ]);
        expect(result.compatible).toBe(false);
        expect(result.oversizedAsset).not.toBeNull();
        expect(result.oversizedAsset?.name).toBe('huge.mp4');
        expect(result.entryLimit).toBe(DESKTOP_ZIP_LIMITS.maxEntryBytes);
    });

    it('treats an asset exactly at the desktop per-entry limit as compatible', () => {
        const result = getDesktopExportCompatibility([{ name: 'edge.mp4', size: DESKTOP_ZIP_LIMITS.maxEntryBytes }]);
        expect(result.compatible).toBe(true);
    });

    it('flags an export whose cumulative size exceeds the desktop total limit', () => {
        const asset = { name: 'part.mp4', size: 800 * MiB };
        const result = getDesktopExportCompatibility([asset, asset, asset, asset]);
        expect(result.compatible).toBe(false);
        expect(result.exceedsTotal).toBe(true);
        expect(result.totalBytes).toBe(4 * 800 * MiB);
    });
});

describe('formatBytes', () => {
    it('formats bytes across units', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(200 * MiB)).toBe('200.0 MB');
        expect(formatBytes(1024 * MiB)).toBe('1.0 GB');
    });
});

describe('ImportCancelledError', () => {
    it('is a named Error', () => {
        const err = new ImportCancelledError('cancelled');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('ImportCancelledError');
        expect(err.message).toBe('cancelled');
    });
});
