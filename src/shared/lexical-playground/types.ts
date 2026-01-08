/**
 * Type definitions for Lexical Playground
 */
import type { LexicalEditor, SerializedEditorState } from 'lexical';
import type { Provider } from '@lexical/yjs';

/**
 * Configuration for Yjs collaboration
 */
export interface YjsConfig {
    provider: Provider;
    docId: string;
    userId: string;
    userName: string;
    userColor?: string;
}

/**
 * Options for mounting the playground editor
 */
export interface PlaygroundMountOptions {
    /** Unique identifier for this editor instance */
    editorId?: string;
    /** Placeholder text when editor is empty */
    placeholder?: string;
    /** Initial HTML content */
    initialHTML?: string;
    /** Whether editor is editable */
    editable?: boolean;
    /** Callback when content changes */
    onUpdate?: (html: string) => void;
    /** Callback when selection changes */
    onSelectionChange?: (selection: unknown) => void;
    /** Callback to open media library */
    onMediaLibraryOpen?: (type: 'image' | 'video' | 'audio' | 'file') => void;
    /** Asset manager instance for resolving asset:// URLs */
    assetManager?: unknown;
    /** Enable Excalidraw drawings (heavy, ~300KB) */
    enableExcalidraw?: boolean;
    /** Enable math equations via KaTeX */
    enableEquations?: boolean;
    /** Enable @mentions */
    enableMentions?: boolean;
    /** Enable comments */
    enableComments?: boolean;
    /** Enable table of contents */
    enableTableOfContents?: boolean;
    /** Enable speech to text */
    enableSpeechToText?: boolean;
    /** Enable polls */
    enablePolls?: boolean;
    /** Yjs collaboration config - set after mount */
    yjsConfig?: YjsConfig;
}

/**
 * Image insert options
 */
export interface InsertImageOptions {
    src: string;
    altText?: string;
    width?: number;
    height?: number;
    dataAssetId?: string;
    dataAssetSrc?: string;
}

/**
 * Video insert options
 */
export interface InsertVideoOptions {
    src: string;
    width?: number;
    height?: number;
    dataAssetId?: string;
    dataAssetSrc?: string;
}

/**
 * Audio insert options
 */
export interface InsertAudioOptions {
    src: string;
    dataAssetId?: string;
    dataAssetSrc?: string;
}

/**
 * Handle returned when mounting an editor
 */
export interface PlaygroundEditorHandle {
    /** Get the underlying Lexical editor instance */
    getEditor(): LexicalEditor | null;
    /** Get current content as HTML string */
    getHTML(): string;
    /** Set content from HTML string */
    setHTML(html: string): void;
    /** Get content as JSON */
    getJSON(): SerializedEditorState | null;
    /** Set content from JSON */
    setJSON(json: SerializedEditorState): void;
    /** Check if editor is empty */
    isEmpty(): boolean;
    /** Focus the editor */
    focus(): void;
    /** Blur the editor */
    blur(): void;
    /** Enable/disable editing */
    setEditable(editable: boolean): void;
    /** Setup Yjs collaboration */
    setYjsBinding(config: YjsConfig): void;
    /** Insert an image */
    insertImage(options: InsertImageOptions): void;
    /** Insert a video */
    insertVideo(options: InsertVideoOptions): void;
    /** Insert an audio element */
    insertAudio(options: InsertAudioOptions): void;
    /** Destroy the editor and cleanup */
    destroy(): void;
}

/**
 * Internal props for PlaygroundEditor component
 */
export interface PlaygroundEditorProps extends PlaygroundMountOptions {
    /** Callback when editor handle is ready */
    onHandleReady?: (handle: PlaygroundEditorHandle) => void;
}

/**
 * Theme configuration for editor styling
 */
export interface EditorThemeClasses {
    paragraph?: string;
    heading?: {
        h1?: string;
        h2?: string;
        h3?: string;
        h4?: string;
        h5?: string;
        h6?: string;
    };
    list?: {
        ul?: string;
        ol?: string;
        listitem?: string;
        nested?: {
            listitem?: string;
        };
        listitemChecked?: string;
        listitemUnchecked?: string;
    };
    quote?: string;
    code?: string;
    codeHighlight?: Record<string, string>;
    table?: string;
    tableCell?: string;
    tableCellHeader?: string;
    tableRow?: string;
    link?: string;
    text?: {
        bold?: string;
        italic?: string;
        underline?: string;
        strikethrough?: string;
        subscript?: string;
        superscript?: string;
        code?: string;
        highlight?: string;
    };
    image?: string;
    horizontalRule?: string;
    characterLimit?: string;
}

/**
 * Settings context value
 */
export interface SettingsContextValue {
    isCollab: boolean;
    isRichText: boolean;
    showTableOfContents: boolean;
    tableCellMerge: boolean;
    tableCellBackgroundColor: boolean;
    shouldUseLexicalContextMenu: boolean;
}

/**
 * Insert menu item configuration
 */
export interface InsertMenuItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    keywords?: string[];
    onSelect: (editor: LexicalEditor) => void;
}

/**
 * Toolbar button configuration
 */
export interface ToolbarButtonConfig {
    key: string;
    label: string;
    icon: React.ReactNode;
    isActive?: boolean;
    isDisabled?: boolean;
    onClick: () => void;
}

/**
 * Block type options for format dropdown
 */
export type BlockType =
    | 'paragraph'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'quote'
    | 'bullet'
    | 'number'
    | 'check'
    | 'code';
