/**
 * Material icon sprite parser
 *
 * Single source of truth for turning the vendored Material Symbols sprite
 * (`public/libs/material-icons/material-icons.svg`) into individual icons.
 *
 * The sprite is the ONLY on-disk copy of the icon set: the loose per-icon SVG
 * files were removed to shrink the static editor bundle and the repository.
 * Both the export pipeline (this module) and the editor runtime
 * (`public/app/common/blockIconRuntime.js`, a hand-maintained JS twin of the
 * pure functions below) extract just the icons they need from the sprite.
 *
 * Sprite shape (one entry per icon, produced by
 * `scripts/generate-material-icons.js`):
 *
 *   <svg xmlns="http://www.w3.org/2000/svg" style="display:none">
 *   <symbol id="alarm" viewBox="0 -960 960 960"><path d="…"/></symbol>
 *   …
 *   </svg>
 */

/** A single icon extracted from the sprite. */
export interface MaterialIconSymbol {
    viewBox: string;
    body: string;
}

/** Icon rendered when a requested name is missing from the sprite. */
export const MATERIAL_ICON_FALLBACK = 'help';

/**
 * The `help` glyph extracted verbatim from the vendored sprite
 * (`public/libs/material-icons/material-icons.svg`). Kept as a literal so the
 * export renderer can still emit a visible icon even when the sprite cannot be
 * fetched at all (total failure) — the loose per-icon SVG files no longer exist
 * on disk, so there is no fallback path to point at.
 */
const HELP_SYMBOL: MaterialIconSymbol = {
    viewBox: '0 -960 960 960',
    body: '<path d="M484-247q16 0 27-11t11-27q0-16-11-27t-27-11q-16 0-27 11t-11 27q0 16 11 27t27 11Zm-35-146h59q0-26 6.5-47.5T555-490q31-26 44-51t13-55q0-53-34.5-85T486-713q-49 0-86.5 24.5T345-621l53 20q11-28 33-43.5t52-15.5q34 0 55 18.5t21 47.5q0 22-13 41.5T508-512q-30 26-44.5 51.5T449-393Zm31 313q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Z"/>',
};

/**
 * Inline `data:` URI for the {@link MATERIAL_ICON_FALLBACK} (`help`) glyph.
 * Used as the last-resort icon when neither the requested icon nor the sprite
 * are available.
 */
export const HELP_ICON_FALLBACK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
    buildStandaloneSvg(HELP_SYMBOL),
)}`;

// Match each <symbol …>…</symbol> non-greedily, then pull attributes out of the
// tag separately so we are tolerant of attribute order/whitespace.
const SYMBOL_RE = /<symbol\s+([^>]*?)>([\s\S]*?)<\/symbol>/gi;
const ID_RE = /\bid="([^"]+)"/i;
const VIEWBOX_RE = /\bviewBox="([^"]+)"/i;

/**
 * Parse the sprite text into a map of icon name -> { viewBox, body }.
 * Returns an empty map for empty/invalid input (never throws).
 */
export function parseMaterialIconSprite(spriteText: string): Map<string, MaterialIconSymbol> {
    const symbols = new Map<string, MaterialIconSymbol>();
    if (!spriteText) {
        return symbols;
    }

    for (const match of spriteText.matchAll(SYMBOL_RE)) {
        const attrs = match[1];
        const id = ID_RE.exec(attrs)?.[1];
        const viewBox = VIEWBOX_RE.exec(attrs)?.[1];
        if (!id || !viewBox) {
            continue;
        }
        symbols.set(id, { viewBox, body: match[2].trim() });
    }

    return symbols;
}

/**
 * Resolve an icon name to its symbol, falling back to {@link MATERIAL_ICON_FALLBACK}
 * (and finally `null` if even the fallback is absent).
 */
export function resolveMaterialIconSymbol(
    symbols: Map<string, MaterialIconSymbol>,
    name: string | null | undefined,
    fallback: string = MATERIAL_ICON_FALLBACK,
): MaterialIconSymbol | null {
    if (name && symbols.has(name)) {
        return symbols.get(name) ?? null;
    }
    return symbols.get(fallback) ?? null;
}

/**
 * Rebuild a standalone SVG document for an icon symbol. The `width`/`height`
 * (48) match the original Material Symbols files so reconstructed icons are
 * byte-equivalent in spirit to the loose files they replace.
 */
export function buildStandaloneSvg(symbol: MaterialIconSymbol): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="${symbol.viewBox}">${symbol.body}</svg>`;
}

/** Standalone SVG string for `name`, or `null` if unresolved. */
export function getMaterialIconSvg(
    symbols: Map<string, MaterialIconSymbol>,
    name: string | null | undefined,
    fallback: string = MATERIAL_ICON_FALLBACK,
): string | null {
    const symbol = resolveMaterialIconSymbol(symbols, name, fallback);
    return symbol ? buildStandaloneSvg(symbol) : null;
}

/**
 * Inline `data:` URI for `name`, matching the encoding used elsewhere in the
 * export pipeline (`data:image/svg+xml;utf8,…`). Returns `null` if unresolved.
 */
export function getMaterialIconDataUri(
    symbols: Map<string, MaterialIconSymbol>,
    name: string | null | undefined,
    fallback: string = MATERIAL_ICON_FALLBACK,
): string | null {
    const svg = getMaterialIconSvg(symbols, name, fallback);
    return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null;
}
