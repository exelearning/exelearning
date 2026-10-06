/**
 * SRT -> WebVTT subtitle conversion (issue #2034).
 *
 * Native HTML5 `<video><track>` only understands WebVTT. Text iDevice video
 * subtitles are attached as raw `.srt` files (via the exemedia TinyMCE
 * plugin's "Subtitles (srt / vtt)" field), which produce zero cues in the
 * browser's native track engine. This isomorphic, dependency-free converter
 * is used by the export/preview pipeline (see BaseExporter) so a `.srt`
 * subtitle asset is always served as valid WebVTT to `<track>` elements.
 *
 * Kept intentionally small and hand-written (no third-party SRT parser)
 * per project conventions -- this only needs to handle the common SRT
 * dialect: numeric cue index (optional), a single timestamp line using a
 * comma or dot decimal separator, and one or more text lines, blocks
 * separated by a blank line.
 */

/** Result of a `.srt` -> WebVTT conversion attempt. */
export interface SrtToVttResult {
    /** The resulting WebVTT document text. Always starts with "WEBVTT". */
    vtt: string;
    /**
     * Whether the input was actually rewritten. `false` when the input was
     * already valid WebVTT and was passed through unchanged.
     */
    converted: boolean;
    /**
     * Present when the input could not be parsed as subtitle cues (e.g.
     * malformed, empty, or binary input). The conversion never throws in
     * this case -- it degrades to an empty (but still valid) WebVTT document.
     */
    error?: string;
}

const BOM = '﻿';

/** Matches an SRT/WebVTT cue timestamp line, e.g. "00:00:01,000 --> 00:00:02,500". */
const CUE_TIMESTAMP_RE = /^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})(.*)$/;

/** Matches a bare cue index line, e.g. "1". */
const CUE_INDEX_RE = /^\d+$/;

/**
 * Detect whether `content` is already valid WebVTT (has a `WEBVTT` header),
 * tolerating a leading UTF-8 BOM. Used to avoid double-converting subtitle
 * assets that were already uploaded as `.vtt`.
 */
export function isWebVtt(content: string): boolean {
    if (!content) return false;
    const stripped = content.startsWith(BOM) ? content.slice(1) : content;
    return /^WEBVTT(\s|$)/.test(stripped.trimStart());
}

function stripBom(content: string): string {
    return content.startsWith(BOM) ? content.slice(1) : content;
}

/**
 * Convert a single SRT timestamp (comma or dot decimal separator) to the
 * dot-decimal form WebVTT requires.
 */
function normalizeTimestamp(timestamp: string): string {
    return timestamp.replace(',', '.');
}

/**
 * Convert raw SRT subtitle text to WebVTT. Content that is already valid
 * WebVTT is passed through unchanged (`converted: false`). Never throws --
 * malformed, empty, or binary input yields an empty WebVTT document with
 * `error` set describing why nothing could be parsed.
 */
export function convertSrtToVtt(content: string): SrtToVttResult {
    try {
        const withoutBom = stripBom(typeof content === 'string' ? content : '');

        if (isWebVtt(withoutBom)) {
            return { vtt: withoutBom, converted: false };
        }

        const normalized = withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const blocks = normalized.split(/\n\s*\n/);
        const cues: string[] = [];

        for (const rawBlock of blocks) {
            const lines = rawBlock.split('\n').map(line => line.trim());

            let timestampIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (CUE_TIMESTAMP_RE.test(lines[i])) {
                    timestampIndex = i;
                    break;
                }
            }
            if (timestampIndex === -1) continue;

            const match = lines[timestampIndex].match(CUE_TIMESTAMP_RE);
            if (!match) continue;

            const start = normalizeTimestamp(match[1]);
            const end = normalizeTimestamp(match[2]);
            const settings = match[3] ? match[3].trim() : '';
            const timestampLine = settings ? `${start} --> ${end} ${settings}` : `${start} --> ${end}`;

            const indexLine = timestampIndex > 0 && CUE_INDEX_RE.test(lines[0]) ? lines[0] : null;
            const text = lines
                .slice(timestampIndex + 1)
                .join('\n')
                .trim();

            const cueParts = [indexLine, timestampLine, text].filter((part): part is string => !!part);
            cues.push(cueParts.join('\n'));
        }

        if (cues.length === 0) {
            return {
                vtt: 'WEBVTT\n',
                converted: true,
                error: 'No subtitle cues could be parsed from the input',
            };
        }

        return { vtt: `WEBVTT\n\n${cues.join('\n\n')}\n`, converted: true };
    } catch (e) {
        return {
            vtt: 'WEBVTT\n',
            converted: true,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
