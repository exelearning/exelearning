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

import type { AssetProvider, ExportBlock, ExportComponent, ExportDocument, LatexPreRenderResult } from '../interfaces';
import { AssetUrlResolver } from '../utils/AssetUrlResolver';
import { isComponentVisible, isStudentBlock, isTeacherOnly, visibleWorksheetPages } from '../utils/visibility';
import { getWorksheetAdapter } from '../worksheet/adapters/registry';
import { isInteractiveActivity } from '../worksheet/interactiveActivities';
import { renderWorksheet } from '../worksheet/WorksheetRenderer';
import type {
    PrintableActivity,
    PrintablePage,
    UnsupportedActivity,
    WorksheetLabels,
    WorksheetModel,
} from '../worksheet/types';

export interface WorksheetOptions {
    /** Trusted formula renderer, run after author HTML has been sanitized. */
    preRenderLatex?: (html: string) => Promise<LatexPreRenderResult>;
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
    /** Base URL the iDevice export files are served from, ending in a slash. */
    ideviceBasePath?: string;
}

export interface WorksheetResult {
    success: boolean;
    html?: string;
    error?: string;
    /** Release asset URLs when the preview is closed or superseded. */
    dispose?: () => void;
}

export class WorksheetExporter {
    private document: ExportDocument;
    private assets: AssetProvider | null;

    /**
     * @param document - Export document adapter over the project
     * @param assetProvider - Assets, so pictures resolve to something the browser can load
     */
    constructor(document: ExportDocument, assetProvider: AssetProvider | null = null) {
        this.document = document;
        this.assets = assetProvider;
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
        const metadata = this.document.getMetadata();
        const pages: PrintablePage[] = [];
        const unsupported: UnsupportedActivity[] = [];

        // Ancestors count: a page inside a hidden one does not reach the worksheet either.
        for (const page of visibleWorksheetPages(this.document.getNavigation())) {
            const activities: PrintableActivity[] = [];

            for (const { component, blockTitle } of this.collectComponents(page.blocks || [])) {
                const content = component.content || '';
                const adapter = getWorksheetAdapter(component.type);

                if (!adapter) {
                    // Report only what a teacher would expect to find on the worksheet. A text
                    // block is not missing from it, it simply does not belong; an activity is.
                    if (isInteractiveActivity(component.type)) {
                        this.reportUnsupported(unsupported, component.type, page.title);
                    }
                    continue;
                }

                const omissions = new Map<NonNullable<UnsupportedActivity['reason']>, number>();
                const onOmission = (reason: NonNullable<UnsupportedActivity['reason']>, count = 1) => {
                    omissions.set(reason, (omissions.get(reason) ?? 0) + count);
                };
                try {
                    const activity = adapter.build(content, {
                        title: options.ideviceTitles?.[component.type],
                        labels: options.labels,
                        random: options.random,
                        ideviceBasePath: options.ideviceBasePath,
                        onOmission,
                    });
                    if (activity) activities.push(blockTitle ? { ...activity, blockTitle } : activity);
                    else if (omissions.size === 0) onOmission('invalid-data');
                } catch {
                    onOmission('invalid-data');
                }
                for (const [reason, count] of omissions)
                    unsupported.push({
                        ideviceType: component.type,
                        pageTitle: page.title,
                        pageId: page.id,
                        componentId: component.id,
                        title: options.ideviceTitles?.[component.type] || adapter.defaultTitle,
                        reason,
                        count,
                    });
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
        const resolver = new AssetUrlResolver(this.assets);
        try {
            const model = await this.buildModel(options);
            let html = renderWorksheet(model, options.labels);
            await resolver.build(html);
            html = resolver.resolve(html);
            if (options.preRenderLatex) {
                const rendered = await options.preRenderLatex(html);
                if (rendered.hasLatex && !rendered.latexRendered)
                    throw new Error('Could not render worksheet formulas');
                html = rendered.html;
            }
            return { success: true, html, dispose: () => resolver.dispose() };
        } catch (error) {
            resolver.dispose();
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
     * Hidden and teacher-only blocks and components are dropped: the worksheet is the
     * student's copy.
     */
    private collectComponents(blocks: ExportBlock[]): { component: ExportComponent; blockTitle: string }[] {
        const components: { component: ExportComponent; blockTitle: string }[] = [];

        for (const block of blocks) {
            // A block can be hidden or reserved for teachers, which excludes everything in it
            // however each component is marked.
            if (!isStudentBlock(block)) continue;

            for (const component of block.components || []) {
                if (!isComponentVisible(component) || isTeacherOnly(component)) continue;
                // The block's own heading comes along: on the worksheet nothing else draws it, and
                // it is what the author called the exercise.
                components.push({ component, blockTitle: (block.name || '').trim() });
            }
        }

        return components;
    }
}
