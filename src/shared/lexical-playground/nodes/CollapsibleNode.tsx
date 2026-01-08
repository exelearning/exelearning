/**
 * CollapsibleNode - Custom nodes for collapsible/accordion sections
 */
import {
    ElementNode,
    DOMConversionMap,
    DOMExportOutput,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedElementNode,
    Spread,
} from 'lexical';

// Container Node
export type SerializedCollapsibleContainerNode = Spread<{ open: boolean }, SerializedElementNode>;

export class CollapsibleContainerNode extends ElementNode {
    __open: boolean;

    static getType(): string {
        return 'collapsible-container';
    }

    static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
        return new CollapsibleContainerNode(node.__open, node.__key);
    }

    constructor(open: boolean = true, key?: NodeKey) {
        super(key);
        this.__open = open;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const dom = document.createElement('details');
        dom.classList.add('PlaygroundEditorTheme__collapsible-container');
        dom.open = this.__open;
        return dom;
    }

    updateDOM(prevNode: CollapsibleContainerNode, dom: HTMLDetailsElement): boolean {
        if (prevNode.__open !== this.__open) {
            dom.open = this.__open;
        }
        return false;
    }

    static importDOM(): DOMConversionMap | null {
        return {
            details: () => ({
                conversion: () => {
                    return {
                        node: $createCollapsibleContainerNode(true),
                    };
                },
                priority: 1,
            }),
        };
    }

    static importJSON(serializedNode: SerializedCollapsibleContainerNode): CollapsibleContainerNode {
        return $createCollapsibleContainerNode(serializedNode.open);
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('details');
        element.classList.add('PlaygroundEditorTheme__collapsible-container');
        element.open = this.__open;
        return { element };
    }

    exportJSON(): SerializedCollapsibleContainerNode {
        return {
            ...super.exportJSON(),
            type: 'collapsible-container',
            open: this.__open,
            version: 1,
        };
    }

    setOpen(open: boolean): void {
        const writable = this.getWritable();
        writable.__open = open;
    }

    getOpen(): boolean {
        return this.__open;
    }

    toggleOpen(): void {
        this.setOpen(!this.getOpen());
    }
}

export function $createCollapsibleContainerNode(open: boolean = true): CollapsibleContainerNode {
    return new CollapsibleContainerNode(open);
}

export function $isCollapsibleContainerNode(node: LexicalNode | null | undefined): node is CollapsibleContainerNode {
    return node instanceof CollapsibleContainerNode;
}

// Title Node
export type SerializedCollapsibleTitleNode = SerializedElementNode;

export class CollapsibleTitleNode extends ElementNode {
    static getType(): string {
        return 'collapsible-title';
    }

    static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
        return new CollapsibleTitleNode(node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
        const dom = document.createElement('summary');
        dom.classList.add('PlaygroundEditorTheme__collapsible-title');
        return dom;
    }

    updateDOM(): boolean {
        return false;
    }

    static importDOM(): DOMConversionMap | null {
        return {
            summary: () => ({
                conversion: () => {
                    return { node: $createCollapsibleTitleNode() };
                },
                priority: 1,
            }),
        };
    }

    static importJSON(): CollapsibleTitleNode {
        return $createCollapsibleTitleNode();
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('summary');
        element.classList.add('PlaygroundEditorTheme__collapsible-title');
        return { element };
    }

    exportJSON(): SerializedCollapsibleTitleNode {
        return {
            ...super.exportJSON(),
            type: 'collapsible-title',
            version: 1,
        };
    }

    collapseAtStart(): boolean {
        return true;
    }

    insertNewAfter(): null {
        return null;
    }
}

export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
    return new CollapsibleTitleNode();
}

export function $isCollapsibleTitleNode(node: LexicalNode | null | undefined): node is CollapsibleTitleNode {
    return node instanceof CollapsibleTitleNode;
}

// Content Node
export type SerializedCollapsibleContentNode = SerializedElementNode;

export class CollapsibleContentNode extends ElementNode {
    static getType(): string {
        return 'collapsible-content';
    }

    static clone(node: CollapsibleContentNode): CollapsibleContentNode {
        return new CollapsibleContentNode(node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
        const dom = document.createElement('div');
        dom.classList.add('PlaygroundEditorTheme__collapsible-content');
        return dom;
    }

    updateDOM(): boolean {
        return false;
    }

    static importDOM(): DOMConversionMap | null {
        return {};
    }

    static importJSON(): CollapsibleContentNode {
        return $createCollapsibleContentNode();
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('div');
        element.classList.add('PlaygroundEditorTheme__collapsible-content');
        return { element };
    }

    exportJSON(): SerializedCollapsibleContentNode {
        return {
            ...super.exportJSON(),
            type: 'collapsible-content',
            version: 1,
        };
    }
}

export function $createCollapsibleContentNode(): CollapsibleContentNode {
    return new CollapsibleContentNode();
}

export function $isCollapsibleContentNode(node: LexicalNode | null | undefined): node is CollapsibleContentNode {
    return node instanceof CollapsibleContentNode;
}
