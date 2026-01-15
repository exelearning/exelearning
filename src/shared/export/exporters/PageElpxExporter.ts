/**
 * PageElpxExporter
 *
 * Exports a single page (subtree) to ELPX format.
 * ELPX is a complete HTML5 export + content.xml for re-import.
 */

import type { ExportOptions, ExportPage, ExportResult, ElpxExportOptions } from '../interfaces';
import { ElpxExporter } from './ElpxExporter';

export class PageElpxExporter extends ElpxExporter {
    private rootPageId: string | undefined;

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
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const elpxOptions = options as ElpxExportOptions | undefined;
        this.rootPageId = elpxOptions?.rootPageId;

        return super.export(options);
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
