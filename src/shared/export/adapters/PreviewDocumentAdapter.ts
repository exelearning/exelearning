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
        const metadata = { ...this.document.getMetadata() };
        if (metadata.extraHeadContent !== undefined) {
            metadata.extraHeadContent = this.prepare(metadata.extraHeadContent, 'custom-head');
        }
        if (metadata.footer !== undefined) {
            metadata.footer = this.prepare(metadata.footer, 'custom-footer');
        }
        return metadata;
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
}
