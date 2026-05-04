/**
 * SCORM 1.2 export for one selected iDevice.
 *
 * The exporter creates a synthetic one-page SCO containing only the requested
 * component while preserving its block wrapper and iDevice resources.
 */

import type { ExportBlock, ExportComponent, ExportOptions, ExportPage, ExportResult } from '../interfaces';
import { Scorm12MinimalExporter } from './Scorm12MinimalExporter';

export interface Scorm12IdeviceExportOptions extends ExportOptions {
    blockId: string;
    ideviceId: string;
}

export class Scorm12IdeviceExporter extends Scorm12MinimalExporter {
    private blockId: string | undefined;
    private ideviceId: string | undefined;

    getFileSuffix(): string {
        return '_idevice_scorm12';
    }

    async export(options?: ExportOptions): Promise<ExportResult> {
        const ideviceOptions = options as Scorm12IdeviceExportOptions | undefined;
        this.blockId = ideviceOptions?.blockId;
        this.ideviceId = ideviceOptions?.ideviceId;

        if (!this.blockId) {
            return {
                success: false,
                error: 'blockId is required',
            };
        }

        if (!this.ideviceId) {
            return {
                success: false,
                error: 'ideviceId is required',
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
            this.ideviceId = undefined;
            this.resetMinimalExport();
        }
    }

    protected buildPageList(): ExportPage[] {
        const allPages = super.buildPageList();

        if (!this.blockId || !this.ideviceId) {
            return allPages;
        }

        const selected = this.findSelectedIdevice(allPages);
        const page = this.clonePage(selected.page);
        const block = this.cloneBlock(selected.block);
        const component = this.cloneComponent(selected.component);

        block.components = [
            {
                ...component,
                order: 0,
            },
        ];
        block.order = 0;

        return [
            {
                ...page,
                id: `${component.id}-scorm`,
                title: this.getIdevicePageTitle(component, block, page),
                parentId: null,
                order: 0,
                blocks: [block],
            },
        ];
    }

    private findSelectedIdevice(pages: ExportPage[]): {
        page: ExportPage;
        block: ExportBlock;
        component: ExportComponent;
    } {
        let matchedBlock: { page: ExportPage; block: ExportBlock } | null = null;

        for (const page of pages) {
            for (const block of page.blocks || []) {
                if (block.id !== this.blockId) {
                    continue;
                }

                matchedBlock = { page, block };
                const component = (block.components || []).find(candidate => candidate.id === this.ideviceId);
                if (component) {
                    return { page, block, component };
                }
            }
        }

        if (!matchedBlock) {
            throw new Error(`Block not found: ${this.blockId}`);
        }

        throw new Error(`iDevice not found: ${this.ideviceId}`);
    }

    private getIdevicePageTitle(component: ExportComponent, block: ExportBlock, page: ExportPage): string {
        const propertyTitle = component.properties?.title;
        if (typeof propertyTitle === 'string' && propertyTitle.trim()) {
            return propertyTitle.trim();
        }

        return block.name || page.title || 'iDevice';
    }

    private clonePage(page: ExportPage): ExportPage {
        return JSON.parse(JSON.stringify(page)) as ExportPage;
    }

    private cloneBlock(block: ExportBlock): ExportBlock {
        return JSON.parse(JSON.stringify(block)) as ExportBlock;
    }

    private cloneComponent(component: ExportComponent): ExportComponent {
        return JSON.parse(JSON.stringify(component)) as ExportComponent;
    }
}
