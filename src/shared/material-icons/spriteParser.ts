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
