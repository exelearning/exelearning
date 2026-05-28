/**
 * Site Theme URL Builder
 *
 * Builds the public URL prefix used to serve admin-uploaded ("site") themes.
 * The URL embeds two version segments so that the browser HTTP cache is
 * invalidated when a theme is replaced from the admin panel without forcing
 * an app-wide redeploy:
 *
 *   /v{appVersion}-{themeUpdatedAtMs}/site-files/themes/{dirName}
 *
 * The static file handler in `src/index.ts` matches the path with a regex
 * that allows arbitrary characters between the dotted version and the next
 * `/` (`/^\/v[\d.]+[^/]*\/site-files\/themes\/(.+)$/`), so the extra
 * `-{themeUpdatedAtMs}` suffix is transparent to the file lookup.
 */

/**
 * Build the URL prefix for an admin-uploaded site theme.
 *
 * @param appVersion - app version string returned by getAppVersion (e.g. "v3.0.0")
 * @param dirName - on-disk theme directory name (slugified)
 * @param updatedAtMs - epoch-ms timestamp of the theme record's last update
 *                     (used purely for cache busting; falsy values are ignored)
 */
export function buildSiteThemeUrl(appVersion: string, dirName: string, updatedAtMs: number | null | undefined): string {
    const cacheBuster =
        typeof updatedAtMs === 'number' && Number.isFinite(updatedAtMs) && updatedAtMs > 0 ? `-${updatedAtMs}` : '';
    return `/${appVersion}${cacheBuster}/site-files/themes/${dirName}`;
}
