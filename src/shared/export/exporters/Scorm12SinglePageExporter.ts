/**
 * SCORM 1.2 export for one selected page.
 *
 * The selected page becomes the single SCO root. Descendants and siblings are
 * intentionally excluded so the package can be imported as a minimal Moodle
 * SCORM activity.
 */

import type { ExportOptions, ExportPage, ExportResult } from '../interfaces';
import { Scorm12MinimalExporter } from './Scorm12MinimalExporter';

export interface Scorm12SinglePageExportOptions extends ExportOptions {
    pageId: string;
}

export class Scorm12SinglePageExporter extends Scorm12MinimalExporter {
    private pageId: string | undefined;

    getFileSuffix(): string {
        return '_page_scorm12';
    }

    async export(options?: ExportOptions): Promise<ExportResult> {
        const pageOptions = options as Scorm12SinglePageExportOptions | undefined;
        this.pageId = pageOptions?.pageId;

        if (!this.pageId) {
            return {
                success: false,
                error: 'pageId is required',
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
            this.pageId = undefined;
            this.resetMinimalExport();
        }
    }

    protected buildPageList(): ExportPage[] {
        const allPages = super.buildPageList();

        if (!this.pageId) {
            return allPages;
        }

        const page = allPages.find(candidate => candidate.id === this.pageId);
        if (!page) {
            throw new Error(`Page not found: ${this.pageId}`);
        }

        return [
            {
                ...this.clonePage(page),
                parentId: null,
                order: 0,
            },
        ];
    }

    private clonePage(page: ExportPage): ExportPage {
        return JSON.parse(JSON.stringify(page)) as ExportPage;
    }
}
