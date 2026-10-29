/**
 * Subtitle-track normalization for the native `<video>` surface.
 */

import type { CaptionTrack } from './types';
import { isRecord } from './types';

/**
 * Normalize an authored captions/subtitles list into the runtime shape
 * `[{src, lang, label, default}]`. A caption without a source is dropped; at
 * most one track keeps `default`; a missing label falls back to the lang code.
 * `src` is the asset reference the exporter rewrites — `.srt` subtitle assets
 * are converted to WebVTT at export time by the shared subtitle pipeline
 * (issue #2035), so authors can supply either `.srt` or `.vtt`. Pure.
 */
export function normalizeCaptions(list: unknown): CaptionTrack[] {
    if (!Array.isArray(list)) {
        return [];
    }
    const out: CaptionTrack[] = [];
    let hasDefault = false;
    for (const item of list) {
        const caption = isRecord(item) ? item : {};
        const src = String(caption.src || caption.url || caption.assetId || '').trim();
        if (!src) {
            continue;
        }
        const isDefault = !!caption.default && !hasDefault;
        if (isDefault) {
            hasDefault = true;
        }
        const lang = String(caption.lang || '').trim();
        out.push({
            src: src,
            lang: lang,
            label: String(caption.label || lang || '').trim(),
            default: isDefault,
        });
    }
    return out;
}
