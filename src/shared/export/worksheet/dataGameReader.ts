/**
 * DataGame reader
 *
 * Pulls the stored state out of a gamified iDevice's HTML. Regex-based on purpose: this runs both
 * in the browser and under Bun (CLI exports), so there is no DOM to lean on.
 *
 * Two things live in that HTML and both are needed:
 *
 * 1. The `<div class="<prefix>-DataGame js-hidden">` blob — the whole activity as obfuscated JSON.
 * 2. Sibling "sidecar" links, `<a href="..." class="js-hidden <prefix>-LinkImages">3</a>`, whose
 *    link text is the question index.
 *
 * The sidecars exist because the export pipeline rewrites `asset://UUID` references by scanning
 * plain HTML, and it cannot see inside the obfuscated blob. So the URLs *inside* the JSON go stale
 * while the sidecars stay current. Media URLs must come from the sidecars; everything else comes
 * from the JSON. The iDevice editors do exactly this when reopening an activity.
 */

import { decryptDataGame } from '../utils/dataGameCipher';

/** Media sidecar families written by the gamified iDevices. */
export type MediaLinkKind = 'Images' | 'Audios';

/**
 * Build a case-insensitive matcher for a div carrying `className` among its classes.
 */
function divWithClassPattern(className: string): RegExp {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<div[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>`, 'i');
}

/**
 * Read the inner HTML of the first div carrying `className`, honouring nested divs.
 *
 * Author-written sections (the closing text, for instance) come from a rich text editor and can
 * contain their own divs, so a non-greedy match up to the first `</div>` would truncate them.
 *
 * @param html - Component HTML
 * @param className - Class to look for, e.g. 'adivina-extra-content'
 * @returns Inner HTML, or '' when the div is absent or unterminated
 */
export function extractDivContent(html: string, className: string): string {
    if (!html) return '';

    const opening = divWithClassPattern(className).exec(html);
    if (!opening) return '';

    const contentStart = opening.index + opening[0].length;
    const tagPattern = /<div\b[^>]*>|<\/div\s*>/gi;
    tagPattern.lastIndex = contentStart;

    let depth = 1;
    let match = tagPattern.exec(html);
    while (match !== null) {
        depth += match[0].startsWith('</') ? -1 : 1;
        if (depth === 0) {
            return html.slice(contentStart, match.index);
        }
        match = tagPattern.exec(html);
    }

    // Unterminated div: treat as no usable content rather than returning the rest of the document.
    return '';
}

/**
 * Read and parse the DataGame payload of a component.
 *
 * Handles both eras of the format: current activities store obfuscated JSON, while activities
 * saved before the cipher was introduced store it in the clear. Rather than trusting the
 * `<prefix>-version` marker, both readings are attempted and the one that parses wins.
 *
 * @param html - Component HTML
 * @param prefix - DataGame class prefix, e.g. 'adivina' (not derivable from the iDevice type)
 * @returns The parsed game data, or null when absent, empty or corrupt
 */
export function extractDataGame<T = Record<string, unknown>>(html: string, prefix: string): T | null {
    const raw = extractDivContent(html, `${prefix}-DataGame`).trim();
    if (!raw) return null;

    for (const candidate of [decryptDataGame(raw), raw]) {
        if (!candidate) continue;
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed as T;
        } catch {
            // Try the next reading.
        }
    }

    return null;
}

/**
 * Read the href of a single sidecar link.
 *
 * Some sidecars carry one reference for the whole activity rather than one per question — the
 * crossword's background image, for instance, whose link text is a label and not an index.
 *
 * @param html - Component HTML, after asset URLs have been resolved
 * @param className - Full sidecar class, e.g. 'crucigrama-LinkBack'
 * @returns The href, or '' when the link is absent
 */
export function extractLinkHref(html: string, className: string): string {
    if (!html) return '';

    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<a\\b([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*)>`, 'i');
    const match = pattern.exec(html);
    if (!match) return '';

    return /\bhref\s*=\s*["']([^"']*)["']/i.exec(match[1])?.[1] ?? '';
}

/**
 * Collect the media sidecar links of a component, keyed by question index.
 *
 * @param html - Component HTML, after asset URLs have been resolved
 * @param prefix - Link class prefix, e.g. 'adivina'
 * @param kind - Which sidecar family to read
 * @returns Map of question index to URL; empty when the activity has no media
 */
export function extractMediaLinks(html: string, prefix: string, kind: MediaLinkKind): Map<number, string> {
    const links = new Map<number, string>();
    if (!html) return links;

    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `<a\\b([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapedPrefix}-Link${kind}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/a\\s*>`,
        'gi',
    );

    let match = pattern.exec(html);
    while (match !== null) {
        const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(match[1])?.[1] ?? '';
        const index = Number.parseInt(match[2].trim(), 10);

        // The editors write a placeholder href for questions without media; skip those so the
        // adapter sees "no image" rather than a broken one.
        if (href && Number.isInteger(index) && index >= 0) {
            links.set(index, href);
        }
        match = pattern.exec(html);
    }

    return links;
}
