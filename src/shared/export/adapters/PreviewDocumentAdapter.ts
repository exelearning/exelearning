import type {
    ExportComponent,
    ExportDocument,
    ExportMetadata,
    ExportPage,
    PreviewContentContext,
    PreviewContentPolicy,
    PreviewContentReport,
} from '../interfaces';

/**
 * Classification of every metadata field the document adapters emit, from the
 * preview policy's point of view:
 *
 * - `author-html`  — author-editable HTML rendered verbatim into preview
 *   documents; MUST pass through the policy.
 * - `author-css`   — author-editable CSS rendered raw inside `<style>`; a
 *   literal `</style>` breaks out into markup, so it is screened for that.
 * - `inert`        — escaped-at-render text (title, description, …),
 *   constrained values (theme, globalFont, booleans) or system-generated
 *   identifiers; not an active-content vector.
 *
 * ENFORCEMENT: `getMetadata()` treats any STRING field missing from this map
 * as `author-html` (fail closed) and reports `unclassified-metadata-field`,
 * and the spec asserts the map covers every field `YjsDocumentAdapter`
 * actually emits — so adding an author-editable HTML field without
 * classifying it here turns CI red instead of silently skipping the policy.
 */
export const PREVIEW_METADATA_FIELD_CLASSIFICATION: Record<string, 'author-html' | 'author-css' | 'inert'> = {
    extraHeadContent: 'author-html',
    footer: 'author-html',
    customStyles: 'author-css',
    title: 'inert',
    subtitle: 'inert',
    author: 'inert',
    description: 'inert',
    language: 'inert',
    license: 'inert',
    licenseUrl: 'inert',
    keywords: 'inert',
    category: 'inert',
    theme: 'inert',
    exelearningVersion: 'inert',
    createdAt: 'inert',
    modified: 'inert',
    modifiedAt: 'inert',
    addExeLink: 'inert',
    addPagination: 'inert',
    addSearchBox: 'inert',
    addAccessibilityToolbar: 'inert',
    addMathJax: 'inert',
    exportSource: 'inert',
    globalFont: 'inert',
    screenshot: 'inert',
    odeIdentifier: 'inert',
    odeVersionId: 'inert',
    scormIdentifier: 'inert',
    masteryScore: 'inert',
};

/**
 * Creates a preview-only view of an export document.
 *
 * The wrapped document and its Yjs data are never mutated. Normal exports use the
 * original adapter and therefore preserve the author's source exactly.
 */
export class PreviewDocumentAdapter implements ExportDocument {
    private readonly categories = new Set<string>();
    private readonly actions = new Set<string>();
    private readonly contexts = new Set<PreviewContentContext>();
    private activeContentFound = false;

    constructor(
        private readonly document: ExportDocument,
        private readonly policy: PreviewContentPolicy,
    ) {}

    getMetadata(): ExportMetadata {
        const metadata: Record<string, unknown> = { ...this.document.getMetadata() };
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value !== 'string' || value === '') continue;
            const classification = PREVIEW_METADATA_FIELD_CLASSIFICATION[key];
            if (classification === 'inert') continue;
            if (classification === 'author-html') {
                metadata[key] = this.prepare(value, key === 'footer' ? 'custom-footer' : 'custom-head');
            } else if (classification === 'author-css') {
                metadata[key] = this.prepareStyle(value);
            } else {
                // Unknown string field: fail closed — filter it like author
                // HTML and flag the missing classification in the report.
                this.categories.add('unclassified-metadata-field');
                metadata[key] = this.prepare(value, 'unclassified-metadata');
            }
        }
        return metadata as unknown as ExportMetadata;
    }

    getNavigation(): ExportPage[] {
        return this.document.getNavigation().map(page => ({
            ...page,
            properties: page.properties ? this.cloneValue(page.properties, 'component-property') : undefined,
            blocks: page.blocks.map(block => ({
                ...block,
                properties: block.properties ? { ...block.properties } : undefined,
                components: block.components.map(component => this.prepareComponent(component)),
            })),
        }));
    }

    getReport(): PreviewContentReport {
        return {
            activeContentFound: this.activeContentFound,
            categories: [...this.categories].sort(),
            actions: [...this.actions].sort(),
            contexts: [...this.contexts].sort(),
        };
    }

    private prepareComponent(component: ExportComponent): ExportComponent {
        return {
            ...component,
            content: this.prepare(component.content, 'component-html'),
            properties: this.cloneValue(component.properties, 'component-property'),
            structureProperties: component.structureProperties ? { ...component.structureProperties } : undefined,
        };
    }

    private cloneValue<T>(value: T, context: PreviewContentContext): T {
        if (typeof value === 'string') {
            return this.prepare(value, context) as T;
        }
        if (Array.isArray(value)) {
            return value.map(item => this.cloneValue(item, context)) as T;
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, item]) => [
                    key,
                    this.cloneValue(item, context),
                ]),
            ) as T;
        }
        return value;
    }

    private prepare(html: string, context: PreviewContentContext): string {
        const result = this.policy.prepare(html, context);
        if (result.activeContentFound) {
            this.activeContentFound = true;
            this.contexts.add(context);
        }
        for (const category of result.categories) this.categories.add(category);
        for (const action of result.actions) this.actions.add(action);
        return result.html;
    }

    /**
     * Screen author CSS through the policy when it implements `prepareStyle`;
     * otherwise apply the same fail-closed screening locally (a policy that
     * predates the hook must not silently let a `</style>` breakout through).
     */
    private prepareStyle(css: string): string {
        let result;
        if (typeof this.policy.prepareStyle === 'function') {
            result = this.policy.prepareStyle(css);
        } else if (/<\/style([\s/>]|$)/i.test(css)) {
            result = { html: '', activeContentFound: true, categories: ['style-breakout'], actions: ['disabled'] };
        } else {
            result = { html: css, activeContentFound: false, categories: [], actions: [] };
        }
        if (result.activeContentFound) {
            this.activeContentFound = true;
            this.contexts.add('custom-styles');
        }
        for (const category of result.categories) this.categories.add(category);
        for (const action of result.actions) this.actions.add(action);
        return result.html;
    }
}
