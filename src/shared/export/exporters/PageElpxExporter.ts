/**
 * PageElpxExporter
 *
 * Exports a single page (subtree) to ELPX format.
 * ELPX is a complete HTML5 export + content.xml for re-import.
 *
 * Key behavior: When exporting a page subtree, ONLY assets that are
 * actually referenced by the exported pages are included. This prevents
 * the export from including all project assets (which would be incorrect
 * for a partial page export).
 */

import type { ExportAsset, ExportOptions, ExportPage, ExportResult, ElpxExportOptions } from '../interfaces';
import { ElpxExporter } from './ElpxExporter';

export class PageElpxExporter extends ElpxExporter {
    private rootPageId: string | undefined;
    // Set of asset IDs that are referenced by the pages being exported
    // null means no filtering (export all assets)
    private filteredAssetIds: Set<string> | null = null;

    /**
     * Get file extension for ELPX format
     */
    getFileExtension(): string {
        return '.elpx';
    }

    /**
     * Get file suffix for ELPX PAGE format
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Export to ELPX format (subtree)
     *
     * Key: We extract asset IDs from the original pages BEFORE calling super.export(),
     * because super.export() will preprocess pages and transform asset:// URLs to
     * {{context_path}}/content/resources/ format, losing the asset UUIDs.
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const elpxOptions = options as ElpxExportOptions | undefined;
        this.rootPageId = elpxOptions?.rootPageId;

        // Extract asset IDs from original pages BEFORE preprocessing
        // This must happen before super.export() because it transforms asset:// URLs
        if (this.rootPageId) {
            const pages = this.buildPageList();
            this.filteredAssetIds = this.extractAssetIdsFromPages(pages);
            console.log(
                `[PageElpxExporter] Extracted ${this.filteredAssetIds.size} asset IDs from ${pages.length} pages`,
            );
        } else {
            // Full export: no filtering
            this.filteredAssetIds = null;
        }

        return super.export(options);
    }

    /**
     * Override to only add assets used by the exported page subtree
     *
     * This follows the same pattern as ComponentExporter.addComponentAssetsToZip()
     * which successfully filters assets for component exports.
     */
    protected async addAssetsToZipWithResourcePath(trackingList?: string[] | null): Promise<number> {
        // If no filter (full export), use default behavior
        if (!this.filteredAssetIds) {
            return super.addAssetsToZipWithResourcePath(trackingList);
        }

        let assetsAdded = 0;

        try {
            const exportPathMap = await this.buildAssetExportPathMap();

            const processAsset = async (asset: ExportAsset) => {
                // Only include assets that are actually referenced by exported pages
                if (this.filteredAssetIds!.has(asset.id)) {
                    const exportPath = exportPathMap.get(asset.id);
                    if (exportPath) {
                        const zipPath = `content/resources/${exportPath}`;
                        this.zip.addFile(zipPath, asset.data);
                        if (trackingList) trackingList.push(zipPath);
                        assetsAdded++;
                    } else {
                        console.warn(`[PageElpxExporter] No export path for referenced asset: ${asset.id}`);
                    }
                }
            };

            await this.forEachAsset(processAsset);

            console.log(`[PageElpxExporter] Added ${assetsAdded} filtered assets to ZIP`);
        } catch (e) {
            console.warn('[PageElpxExporter] Failed to add assets to ZIP:', e);
        }

        return assetsAdded;
    }

    /**
     * Extract asset IDs from all component content and properties in pages
     *
     * This scans for the asset:// URL pattern used in eXeLearning content.
     * Supports both formats:
     * - New format: asset://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg (UUID with extension)
     * - Legacy format: asset://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/filename (UUID with path)
     * - ODE ID format: asset://20251009090601SQPBIF.jpg (18-char alphanumeric with extension)
     *
     * @param pages - Pages to scan for asset references
     * @returns Set of asset IDs found in the content
     */
    private extractAssetIdsFromPages(pages: ExportPage[]): Set<string> {
        const assetIds = new Set<string>();

        // Pattern matches asset://ID where ID can be:
        // - UUID format: a-f, 0-9, and dashes, 36 chars (e.g., aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)
        // - ODE ID format: alphanumeric, typically 18 chars (e.g., 20251009090601SQPBIF)
        // Followed by: . (extension), / (path), or quote (end of URL)
        const assetPattern = /asset:\/\/([a-zA-Z0-9-]+)(?:[./"'])/gi;

        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    // Extract from content (htmlView field)
                    if (component.content) {
                        const matches = component.content.matchAll(assetPattern);
                        for (const match of matches) {
                            assetIds.add(match[1]);
                        }
                    }

                    // Extract from properties (jsonProperties may contain asset URLs)
                    if (component.properties && Object.keys(component.properties).length > 0) {
                        const propsStr = JSON.stringify(component.properties);
                        const matches = propsStr.matchAll(assetPattern);
                        for (const match of matches) {
                            assetIds.add(match[1]);
                        }
                    }
                }
            }
        }

        return assetIds;
    }

    /**
     * Override buildPageList to filter subtree
     */
    protected buildPageList(): ExportPage[] {
        const allPages = super.buildPageList();

        // If no rootPageId provided, export everything (fallback)
        if (!this.rootPageId) {
            return allPages;
        }

        // Find root page
        const rootPage = allPages.find(p => p.id === this.rootPageId);
        if (!rootPage) {
            console.warn(`[PageElpxExporter] Root page ${this.rootPageId} not found, exporting all.`);
            return allPages;
        }

        // Collect subtree
        const subtree: ExportPage[] = [];
        const visited = new Set<string>();

        const collect = (parentId: string | null) => {
            const children = allPages.filter(p => p.parentId === parentId);
            // Sort by order
            children.sort((a, b) => a.order - b.order);

            for (const child of children) {
                if (!visited.has(child.id)) {
                    visited.add(child.id);
                    subtree.push(child);
                    collect(child.id);
                }
            }
        };

        // Add root page (as new root, so parentId must be null for the export context)
        // We clone it to avoid mutating shared state
        const newRoot = { ...rootPage, parentId: null };
        visited.add(rootPage.id);
        subtree.push(newRoot);

        // Collect descendants
        collect(rootPage.id);

        return subtree;
    }
}
