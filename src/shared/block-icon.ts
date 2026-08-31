/**
 * Block icon derivation — single source of truth.
 *
 * A block stores its icon both as a structured `icon` descriptor and as a
 * legacy `iconName` string. When only the legacy string is present we must
 * derive the descriptor from it. This logic used to be copy-pasted (with subtle
 * divergence) across `src/routes/export.ts`,
 * `src/shared/export/renderers/IdeviceRenderer.ts` and
 * `src/yjs/structure-binding.ts`; it now lives here so every path behaves
 * identically.
 *
 * The frontend keeps a hand-maintained JS twin of this function in
 * `public/app/common/blockIconRuntime.js` (`deriveBlockIcon`) — keep both in
 * sync.
 *
 * Rules (applied in order):
 * - empty / nullish               → { source: 'none',     value: '' }
 * - `mi-<name>`                   → { source: 'material', value: '<name>' }
 * - `asset://…` or starts with `/`→ { source: 'asset',    value: <raw> }
 * - anything else                 → { source: 'theme',    value: <raw> }
 */

export type BlockIconSource = 'material' | 'asset' | 'theme' | 'none';

export interface DerivedBlockIcon {
    source: BlockIconSource;
    value: string;
}

/**
 * Derive a structured block-icon descriptor from a legacy `iconName` string.
 *
 * @param iconName - legacy icon name (e.g. `mi-lightbulb`, `asset://…`, `objectives`)
 * @returns the structured `{ source, value }` descriptor
 */
export function deriveBlockIcon(iconName: string | null | undefined): DerivedBlockIcon {
    const name = iconName == null ? '' : String(iconName);

    if (!name) {
        return { source: 'none', value: '' };
    }

    if (name.startsWith('mi-')) {
        return { source: 'material', value: name.slice(3) };
    }

    if (name.startsWith('asset://') || name.startsWith('/')) {
        return { source: 'asset', value: name };
    }

    return { source: 'theme', value: name };
}
