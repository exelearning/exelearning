/**
 * WorksheetExporter
 *
 * Builds a printable worksheet from the activities in a project.
 *
 * This is the other half of the printing story. PrintPreviewExporter prints what the browser
 * renders, which for an interactive activity is a game board rather than an exercise. This
 * exporter goes to each iDevice's stored data instead and rebuilds it as something a student can
 * fill in on paper.
 *
 * It only reads the document — nothing here writes back to the project.
 */

import type { AssetProvider, ExportComponent, ExportDocument } from '../interfaces';
import { AssetUrlResolver } from '../utils/AssetUrlResolver';
import { isComponentVisible, isPageVisible, isTeacherOnly } from '../utils/visibility';
import { getWorksheetAdapter } from '../worksheet/adapters/registry';
import { renderWorksheet } from '../worksheet/WorksheetRenderer';
import type {
    PrintableActivity,
    PrintablePage,
    UnsupportedActivity,
    WorksheetLabels,
    WorksheetModel,
} from '../worksheet/types';

export interface WorksheetOptions {
    /** Translated user-visible strings for the worksheet chrome. */
    labels?: WorksheetLabels;
    /** Translated activity headings keyed by iDevice type, e.g. `{ guess: 'Adivina' }`. */
    ideviceTitles?: Record<string, string>;
    /**
     * Source of randomness for activities that draw questions or hint letters at random.
     *
     * Defaults to `Math.random`; injectable so a worksheet can be made reproducible.
     */
    random?: () => number;
}

export interface WorksheetResult {
    success: boolean;
    html?: string;
    error?: string;
}

/**
 * Whether a component holds a gamified activity's stored state.
 *
 * Used to decide what is worth reporting as "not printable yet". This catches the DataGame
 * family only; activities that keep their data in jsonProperties (trueorfalse, form, ...) are not
 * flagged, which is acceptable while no adapter covers them either.
 */
function carriesGameData(content: string): boolean {
    return /class\s*=\s*["'][^"']*-DataGame\b/i.test(content);
}

export class WorksheetExporter {
    private document: ExportDocument;
    private assetResolver: AssetUrlResolver;

    /**
     * @param document - Export document adapter over the project
     * @param assetProvider - Assets, so pictures resolve to something the browser can load
     */
    constructor(document: ExportDocument, assetProvider: AssetProvider | null = null) {
        this.document = document;
        this.assetResolver = new AssetUrlResolver(assetProvider);
    }

    /**
     * Collect the printable activities in the project.
     *
     * Kept separate from rendering so the walk can be tested without going through HTML.
     *
     * @param options - Translated titles and labels
     * @returns The worksheet model, including activities that had no adapter
     */
    async buildModel(options: WorksheetOptions = {}): Promise<WorksheetModel> {
        await this.assetResolver.build();

        const metadata = this.document.getMetadata();
        const pages: PrintablePage[] = [];
        const unsupported: UnsupportedActivity[] = [];

        for (const page of this.document.getNavigation()) {
            if (!isPageVisible(page)) continue;

            const activities: PrintableActivity[] = [];

            for (const component of this.collectComponents(page.blocks || [])) {
                const content = this.assetResolver.resolve(component.content || '');
                const adapter = getWorksheetAdapter(component.type);

                if (!adapter) {
                    // Report only what a teacher would expect to find on the worksheet. A text
                    // block is not missing from it, it simply does not belong; an activity is.
                    if (carriesGameData(content)) {
                        this.reportUnsupported(unsupported, component.type, page.title);
                    }
                    continue;
                }

                const activity = adapter.build(content, {
                    title: options.ideviceTitles?.[component.type],
                    random: options.random,
                });
                if (activity) activities.push(activity);
            }

            if (activities.length > 0) {
                pages.push({ pageId: page.id, title: page.title, activities });
            }
        }

        return {
            projectTitle: metadata.title || 'eXeLearning',
            language: metadata.language || 'en',
            pages,
            unsupported,
        };
    }

    /**
     * Generate the worksheet as a standalone HTML document.
     *
     * @param options - Translated titles and labels
     * @returns The document, or the reason it could not be produced
     */
    async generate(options: WorksheetOptions = {}): Promise<WorksheetResult> {
        try {
            const model = await this.buildModel(options);
            return { success: true, html: renderWorksheet(model, options.labels) };
        } catch (error) {
            console.error('[WorksheetExporter] Failed to generate worksheet:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Record an activity that has no adapter, once per type and page.
     *
     * Three crosswords on one page are one gap to report, not three.
     */
    private reportUnsupported(collected: UnsupportedActivity[], ideviceType: string, pageTitle: string): void {
        const alreadyReported = collected.some(
            entry => entry.ideviceType === ideviceType && entry.pageTitle === pageTitle,
        );

        if (!alreadyReported) collected.push({ ideviceType, pageTitle });
    }

    /**
     * Flatten a page's blocks into the components a student should see, in document order.
     *
     * Hidden and teacher-only components are dropped: the worksheet is the student's copy.
     */
    private collectComponents(blocks: { components?: ExportComponent[] }[]): ExportComponent[] {
        const components: ExportComponent[] = [];

        for (const block of blocks) {
            for (const component of block.components || []) {
                if (!isComponentVisible(component) || isTeacherOnly(component)) continue;
                components.push(component);
            }
        }

        return components;
    }
}
