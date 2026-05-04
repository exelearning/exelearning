/**
 * Shared behavior for partial SCORM 1.2 packages.
 *
 * Partial exports are Moodle-friendly SCOs: a single HTML entry point,
 * SCORM metadata, base runtime files, iDevice resources, detected libraries,
 * and only assets referenced by the exported page/component.
 */

import type { ExportAsset, ExportMetadata, ExportPage, PageRenderOptions, ThemeData } from '../interfaces';
import { Scorm12Exporter } from './Scorm12Exporter';

export abstract class Scorm12MinimalExporter extends Scorm12Exporter {
    private filteredAssetIds: Set<string> | null = null;

    getMetadata(): ExportMetadata {
        const meta = super.getMetadata();
        return {
            ...meta,
            addExeLink: false,
            addPagination: false,
            addSearchBox: false,
            exportSource: false,
        };
    }

    protected prepareMinimalExport(pages: ExportPage[]): void {
        this.filteredAssetIds = this.extractAssetIdsFromPages(pages);
    }

    protected resetMinimalExport(): void {
        this.filteredAssetIds = null;
    }

    protected async prepareThemeData(_themeName: string): Promise<ThemeData> {
        const themeFilesMap = new Map<string, Uint8Array>();
        this.ideviceRenderer.setThemeIconFiles(themeFilesMap);
        return {
            themeFilesMap,
            themeRootFiles: [],
            faviconInfo: null,
        };
    }

    protected async getContentXml(): Promise<string | null> {
        return null;
    }

    protected getScormPageRenderOverrides(
        _page: ExportPage,
        _allPages: ExportPage[],
        _meta: ExportMetadata,
    ): Partial<PageRenderOptions> {
        return {
            minimalScorm: true,
            addExeLink: false,
            addPagination: false,
            addSearchBox: false,
            themeFiles: [],
            faviconPath: undefined,
            faviconType: undefined,
        };
    }

    protected async addAssetsToZipWithResourcePath(trackingList?: string[] | null): Promise<number> {
        if (!this.filteredAssetIds) {
            return super.addAssetsToZipWithResourcePath(trackingList);
        }

        let assetsAdded = 0;

        try {
            const exportPathMap = await this.buildAssetExportPathMap();

            const processAsset = async (asset: ExportAsset) => {
                if (!this.filteredAssetIds?.has(asset.id)) {
                    return;
                }

                const exportPath = exportPathMap.get(asset.id);
                if (!exportPath) {
                    console.warn(`[Scorm12MinimalExporter] No export path for referenced asset: ${asset.id}`);
                    return;
                }

                const zipPath = `content/resources/${exportPath}`;
                this.zip.addFile(zipPath, asset.data);
                if (trackingList) trackingList.push(zipPath);
                assetsAdded++;

                const fallbackPath = this.buildAssetFallbackZipPath(asset);
                if (fallbackPath && fallbackPath !== zipPath && !this.zip.hasFile(fallbackPath)) {
                    this.zip.addFile(fallbackPath, asset.data);
                    if (trackingList) trackingList.push(fallbackPath);
                }
            };

            await this.forEachAsset(processAsset);
        } catch (error) {
            console.warn('[Scorm12MinimalExporter] Failed to add filtered assets to ZIP:', error);
        }

        return assetsAdded;
    }

    protected extractAssetIdsFromPages(pages: ExportPage[]): Set<string> {
        const assetIds = new Set<string>();
        const assetPattern = /asset:\/\/([a-zA-Z0-9-]+)(?=[./"'\s)>]|$)/gi;

        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    this.extractAssetIdsFromText(component.content, assetPattern, assetIds);

                    if (component.properties && Object.keys(component.properties).length > 0) {
                        this.extractAssetIdsFromText(JSON.stringify(component.properties), assetPattern, assetIds);
                    }
                }
            }
        }

        return assetIds;
    }

    private extractAssetIdsFromText(text: string | undefined, assetPattern: RegExp, assetIds: Set<string>): void {
        if (!text) {
            return;
        }

        assetPattern.lastIndex = 0;
        for (const match of text.matchAll(assetPattern)) {
            assetIds.add(match[1]);
        }
    }

    private buildAssetFallbackZipPath(asset: ExportAsset): string | null {
        if (!asset.id || !asset.filename) {
            return null;
        }

        const dotIndex = asset.filename.lastIndexOf('.');
        if (dotIndex === -1 || dotIndex === asset.filename.length - 1) {
            return null;
        }

        const extension = asset.filename.substring(dotIndex);
        return `content/resources/${asset.id}${extension}`;
    }
}
