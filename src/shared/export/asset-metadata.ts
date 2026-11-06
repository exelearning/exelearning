/**
 * Helpers for the centralized, reusable asset metadata that travels with exports.
 *
 * The metadata itself (description / title / license / author / authorUrl / sourceUrl)
 * lives in the Yjs assets map (browser) and the assets DB table (server). These helpers
 * normalize an arbitrary source object into an {@link AssetExportMetadata} containing only
 * the known, non-empty string fields — used when building the ELPX asset-metadata sidecar.
 *
 * Per-instance, context-specific values (alternative text, accessibility title, caption
 * heading/notes) are intentionally NOT part of this set: they live on each insertion.
 */
import type { AssetExportMetadata } from './interfaces';

export const ASSET_METADATA_FIELDS = ['description', 'title', 'license', 'author', 'authorUrl', 'sourceUrl'] as const;

/**
 * Pick the known centralized metadata fields from a source object, keeping only
 * non-empty strings. Returns null when the source carries no usable metadata, so
 * callers can skip assets without metadata entirely (keeping the sidecar minimal).
 */
export function pickAssetExportMetadata(
    source: Record<string, unknown> | null | undefined,
): AssetExportMetadata | null {
    if (!source) return null;
    const result: AssetExportMetadata = {};
    let hasAny = false;
    for (const field of ASSET_METADATA_FIELDS) {
        const value = source[field];
        if (typeof value === 'string' && value.trim() !== '') {
            result[field] = value;
            hasAny = true;
        }
    }
    return hasAny ? result : null;
}
