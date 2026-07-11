/**
 * Layered preview helpers (serving contract v2).
 *
 * Fixed-resource ids are the identities the serving route resolves through
 * the build-generated manifest (`public/bundles/preview-fixed-resources.json`).
 * By construction every id equals the served preview path — except theme
 * files, whose served paths are flattened into the `theme/` namespace while
 * the id keeps the theme name (`theme:{name}/{relPath}`), matching the
 * manifest builder. Keep the two sides derived from the same builders here so
 * client-emitted ids and manifest ids can never drift by accident.
 */

import type { ResourceProvider } from '../interfaces';

/** Prefix of theme fixed-resource ids (the only ids that differ from paths). */
export const THEME_FIXED_ID_PREFIX = 'theme:';

/**
 * Fixed-resource id for a base theme file.
 * @param themeName - Theme directory name (e.g. 'base')
 * @param relPath - Path relative to the theme root (e.g. 'content.css')
 */
export function buildThemeFixedId(themeName: string, relPath: string): string {
    return `${THEME_FIXED_ID_PREFIX}${themeName}/${relPath}`;
}

/**
 * Parse a theme fixed-resource id back into its components.
 * Returns null for non-theme ids.
 */
export function parseThemeFixedId(id: string): { themeName: string; relPath: string } | null {
    if (!id.startsWith(THEME_FIXED_ID_PREFIX)) return null;
    const rest = id.slice(THEME_FIXED_ID_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) return null;
    return { themeName: rest.slice(0, slash), relPath: rest.slice(slash + 1) };
}

/** SHA-256 of the given bytes as lowercase hex (WebCrypto; browser and Bun). */
export async function sha256HexOf(bytes: Uint8Array): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    const view = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * Resolve the bytes behind a fixed-resource id through the ResourceProvider
 * fetch pipeline (all sources are memory-cached in the browser fetcher, so
 * this is cheap). Used by the HTTP preview transport to demote paths to
 * document writes when a host's manifest does not know an id
 * (`422 unknown-fixed-resources` — e.g. after a partial host upgrade).
 *
 * Returns null when the id cannot be resolved; the transport then surfaces a
 * clear error instead of serving a hole.
 */
export async function resolveFixedResourceBytes(resources: ResourceProvider, id: string): Promise<Uint8Array | null> {
    try {
        const theme = parseThemeFixedId(id);
        if (theme) {
            const files = await resources.fetchTheme(theme.themeName);
            return files.get(theme.relPath) ?? null;
        }
        if (id === 'content/css/base.css') {
            const files = await resources.fetchContentCss();
            return files.get(id) ?? null;
        }
        if (id === 'content/img/exe_powered_logo.png') {
            return (await resources.fetchExeLogo()) ?? null;
        }
        if (id.startsWith('libs/')) {
            const rel = id.slice('libs/'.length);
            const baseLibs = await resources.fetchBaseLibraries();
            const fromBase = baseLibs.get(rel);
            if (fromBase) return fromBase;
            const fetched = await resources.fetchLibraryFiles([rel]);
            return fetched.get(rel) ?? null;
        }
        if (id.startsWith('idevices/')) {
            // Id shape: idevices/{normalizedType}/{relPath}. Bundle-resolved
            // iDevices are cached under the normalized directory name, so a
            // fetch with that name resolves from the fetcher's memory cache.
            const rest = id.slice('idevices/'.length);
            const slash = rest.indexOf('/');
            if (slash <= 0) return null;
            const ideviceType = rest.slice(0, slash);
            const relPath = rest.slice(slash + 1);
            const files = await resources.fetchIdeviceResources(ideviceType);
            return files.get(relPath) ?? null;
        }
        if (id.startsWith('fonts/global/')) {
            const fontId = id.split('/')[2];
            if (!fontId) return null;
            const files = await resources.fetchGlobalFontFiles(fontId);
            return files?.get(id) ?? null;
        }
        return null;
    } catch {
        return null;
    }
}
