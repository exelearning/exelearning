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
 * - anything else                 → { source: 'theme',    value: RENAMED_THEME_ICONS[raw] ?? raw }
 */

export type BlockIconSource = 'material' | 'asset' | 'theme' | 'none';

/**
 * Theme icons whose file was renamed after a release shipped it, old name → current name.
 *
 * A project stores the icon its author picked as a bare name (`objetives`), and that name is
 * in `.elp` files on other people's disks for good. Renaming the file in the theme therefore
 * cannot be a rename: without this table `resolveIconName()` misses the theme's file list and
 * falls back to `<name>.png`, so the block loses its icon in the workarea, the preview and
 * every export.
 *
 * **Entries are added, never removed.** This is not a shim waiting for a cleanup: it is the
 * document format's memory of a name it once wrote, in the same category as `LEGACY_ICON_MAP`
 * in `blockNode.js`. The only thing that could retire an entry is a project migration that
 * rewrites stored icon names on open — until one exists, deleting a line here breaks the
 * projects it covers. Add one whenever a shipped theme icon file is renamed, and prefer not
 * renaming shipped icons at all.
 *
 * Kept in sync with the JS twin in `public/app/common/blockIconRuntime.js`.
 */
export const RENAMED_THEME_ICONS: Readonly<Record<string, string>> = Object.freeze({
    // neo, misspelt from v4.0.0 to v4.0.3.
    objetives: 'objectives',
    // educablue, hyphenated from v4.0.0 to v4.0.3; every other style uses an underscore.
    'think-alt': 'think_alt',
});

/**
 * Map a stored theme-icon name onto the file the themes ship today.
 *
 * Applied at every point a theme icon name is resolved — derivation from a legacy `iconName`,
 * the export renderer's file lookup, and the workarea's descriptor normalisation — because a
 * project can arrive through any of them.
 *
 * @param value - the theme icon name as stored in the project
 * @returns the current name, or `value` unchanged when it was never renamed
 */
export function resolveRenamedThemeIcon(value: string): string {
    return Object.hasOwn(RENAMED_THEME_ICONS, value) ? RENAMED_THEME_ICONS[value] : value;
}

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

    return { source: 'theme', value: resolveRenamedThemeIcon(name) };
}
