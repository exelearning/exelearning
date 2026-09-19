/**
 * AssetUrlResolver
 *
 * Turns the `asset://UUID` and `content/resources/NAME` references stored in a project into URLs
 * a browser can actually load, by handing each asset's bytes to `URL.createObjectURL`.
 *
 * Shared by every in-browser preview path (print preview, worksheets) so they resolve assets the
 * same way — previously this logic lived inside PrintPreviewExporter and had no second home.
 */

import type { AssetProvider, ExportAsset } from '../interfaces';

/** Matches both reference styles, stopping before quotes, whitespace and JSON escapes. */
const ASSET_REFERENCE_PATTERN = /(?:asset:\/\/|content\/resources\/)([^"'\s\\]+)/gi;

export class AssetUrlResolver {
    private assets: AssetProvider | null;
    private byId: Map<string, string> | null = null;
    private byFilename: Map<string, string> | null = null;

    /**
     * @param assets - Asset provider, or null when the caller has no assets to resolve
     */
    constructor(assets: AssetProvider | null = null) {
        this.assets = assets;
    }

    /**
     * Map every asset to a blob URL. Safe to call more than once; later calls are no-ops.
     */
    async build(): Promise<void> {
        if (this.byId || !this.assets) return;

        this.byId = new Map();
        this.byFilename = new Map();

        try {
            await this.iterateAssets(async (asset: ExportAsset) => {
                const blobUrl = this.createBlobUrl(asset);
                if (!blobUrl) return;

                this.byId?.set(asset.id, blobUrl);
                if (asset.filename) this.byFilename?.set(asset.filename, blobUrl);
            });
        } catch (error) {
            console.warn('[AssetUrlResolver] Failed to build asset map:', error);
        }
    }

    /**
     * The id-to-blob-URL map, for renderers that resolve paths themselves.
     *
     * @returns The map, or undefined when there are no assets
     */
    getExportPathMap(): Map<string, string> | undefined {
        return this.byId ?? undefined;
    }

    /**
     * Rewrite every asset reference in a string.
     *
     * Unknown `asset://` references fall back to the export-relative path rather than being left
     * as an unusable custom scheme.
     *
     * @param content - Any string that may embed asset references (HTML, or serialised JSON)
     * @returns The string with references rewritten
     */
    resolve(content: string): string {
        if (!content || !this.byId) return content;

        return content.replace(ASSET_REFERENCE_PATTERN, (match, reference: string) => {
            let blobUrl = this.byId?.get(reference) || this.byFilename?.get(reference);

            // Stored references often carry an extension the asset id does not have.
            if (!blobUrl && reference.includes('.')) {
                blobUrl = this.byId?.get(reference.substring(0, reference.lastIndexOf('.')));
            }

            if (blobUrl) return blobUrl;

            return match.startsWith('asset://') ? `content/resources/${reference}` : match;
        });
    }

    /**
     * Wrap an asset's bytes in a blob URL.
     *
     * @returns The blob URL, or '' when the asset carries no data
     */
    private createBlobUrl(asset: ExportAsset): string {
        if (!asset.data) {
            console.warn('[AssetUrlResolver] Asset has no data:', asset.id);
            return '';
        }

        try {
            const blob =
                asset.data instanceof Blob
                    ? asset.data
                    : // biome-ignore lint/suspicious/noExplicitAny: legacy asset data types
                      new Blob([asset.data as any], { type: asset.mime });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('[AssetUrlResolver] Failed to create blob URL for asset:', asset.id, error);
            return '';
        }
    }

    /**
     * Walk the assets, streaming when the provider supports it.
     */
    private async iterateAssets(callback: (asset: ExportAsset) => Promise<void>): Promise<void> {
        if (!this.assets) return;

        if (this.assets.forEachAsset) {
            await this.assets.forEachAsset(callback);
            return;
        }

        for (const asset of await this.assets.getAllAssets()) {
            await callback(asset);
        }
    }
}
