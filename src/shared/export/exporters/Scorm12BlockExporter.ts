/**
 * SCORM 1.2 export for one selected box/block.
 *
 * The exporter creates a synthetic one-page SCO containing only the requested
 * block while preserving all its iDevices and referenced resources.
 */

import type { ExportBlock, ExportOptions, ExportPage, ExportResult } from '../interfaces';
import { Scorm12MinimalExporter } from './Scorm12MinimalExporter';

export interface Scorm12BlockExportOptions extends ExportOptions {
    blockId: string;
}

export class Scorm12BlockExporter extends Scorm12MinimalExporter {
    private blockId: string | undefined;

    getFileSuffix(): string {
        return '_box_scorm12';
    }

    async export(options?: ExportOptions): Promise<ExportResult> {
        const blockOptions = options as Scorm12BlockExportOptions | undefined;
        this.blockId = blockOptions?.blockId;

        if (!this.blockId) {
            return {
                success: false,
                error: 'blockId is required',
            };
        }

        try {
            const pages = this.buildPageList();
            this.prepareMinimalExport(pages);
            return await super.export(options);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        } finally {
            this.blockId = undefined;
            this.resetMinimalExport();
        }
    }

    protected buildPageList(): ExportPage[] {
        const allPages = super.buildPageList();

        if (!this.blockId) {
            return allPages;
        }

        const selected = this.findSelectedBlock(allPages);
        const page = this.clonePage(selected.page);
        const block = this.cloneBlock(selected.block);
        block.order = 0;

        return [
            {
                ...page,
                id: `${block.id}-scorm`,
                title: block.name || page.title || 'Box',
                parentId: null,
                order: 0,
                blocks: [block],
            },
        ];
    }

    private findSelectedBlock(pages: ExportPage[]): { page: ExportPage; block: ExportBlock } {
        for (const page of pages) {
            for (const block of page.blocks || []) {
                if (block.id === this.blockId) {
                    return { page, block };
                }
            }
        }

        throw new Error(`Block not found: ${this.blockId}`);
    }

    private clonePage(page: ExportPage): ExportPage {
        return JSON.parse(JSON.stringify(page)) as ExportPage;
    }

    private cloneBlock(block: ExportBlock): ExportBlock {
        return JSON.parse(JSON.stringify(block)) as ExportBlock;
    }
}
