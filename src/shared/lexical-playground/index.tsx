import { createRoot, Root } from 'react-dom/client';
import { PlaygroundEditor } from './PlaygroundEditor';
import type {
    PlaygroundMountOptions,
    PlaygroundEditorHandle,
    YjsConfig,
    InsertImageOptions,
    InsertVideoOptions,
    InsertAudioOptions,
} from './types';

// Track mounted editors
const mountedEditors = new Map<
    string,
    {
        root: Root;
        handle: PlaygroundEditorHandle | null;
        container: HTMLElement;
    }
>();

/**
 * Mount a Lexical Playground editor to a container element
 *
 * @param container - DOM element or CSS selector
 * @param options - Editor configuration options
 * @returns Handle to control the editor
 *
 * @example
 * ```javascript
 * const editor = LexicalPlayground.mount('#editor-container', {
 *   placeholder: 'Start typing...',
 *   initialHTML: '<p>Hello world</p>',
 *   onUpdate: (html) => console.log('Content changed:', html),
 * });
 *
 * // Later:
 * const html = editor.getHTML();
 * editor.destroy();
 * ```
 */
export function mount(container: HTMLElement | string, options: PlaygroundMountOptions = {}): PlaygroundEditorHandle {
    // Resolve container element
    const containerEl = typeof container === 'string' ? (document.querySelector(container) as HTMLElement) : container;

    if (!containerEl) {
        throw new Error(`[LexicalPlayground] Container element not found: ${container}`);
    }

    // Generate unique editor ID
    const editorId = options.editorId || `lexical-playground-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Check if already mounted
    if (mountedEditors.has(editorId)) {
        console.warn(`[LexicalPlayground] Editor ${editorId} already mounted. Use unmount() first.`);
        const existing = mountedEditors.get(editorId);
        if (existing?.handle) {
            return existing.handle;
        }
    }

    // Create handle proxy that will be populated when editor mounts
    let editorHandle: PlaygroundEditorHandle | null = null;

    const handleProxy: PlaygroundEditorHandle = {
        getEditor: () => editorHandle?.getEditor() ?? null,
        getHTML: () => editorHandle?.getHTML() ?? '',
        setHTML: (html: string) => editorHandle?.setHTML(html),
        getJSON: () => editorHandle?.getJSON() ?? null,
        setJSON: json => editorHandle?.setJSON(json),
        isEmpty: () => editorHandle?.isEmpty() ?? true,
        focus: () => editorHandle?.focus(),
        blur: () => editorHandle?.blur(),
        setEditable: (editable: boolean) => editorHandle?.setEditable(editable),
        setYjsBinding: (config: YjsConfig) => editorHandle?.setYjsBinding(config),
        insertImage: (opts: InsertImageOptions) => editorHandle?.insertImage(opts),
        insertVideo: (opts: InsertVideoOptions) => editorHandle?.insertVideo(opts),
        insertAudio: (opts: InsertAudioOptions) => editorHandle?.insertAudio(opts),
        destroy: () => {
            unmount(editorId);
        },
    };

    // Create React root and render
    const root = createRoot(containerEl);

    mountedEditors.set(editorId, {
        root,
        handle: null,
        container: containerEl,
    });

    root.render(
        <PlaygroundEditor
            {...options}
            editorId={editorId}
            onHandleReady={handle => {
                editorHandle = handle;
                const entry = mountedEditors.get(editorId);
                if (entry) {
                    entry.handle = handle;
                }
            }}
        />,
    );

    return handleProxy;
}

/**
 * Unmount a Lexical Playground editor
 *
 * @param editorId - The editor ID or container element
 */
export function unmount(editorId: string | HTMLElement): void {
    // Find editor by ID or container
    let id: string | undefined;

    if (typeof editorId === 'string') {
        id = editorId;
    } else {
        // Find by container element
        for (const [key, value] of mountedEditors.entries()) {
            if (value.container === editorId) {
                id = key;
                break;
            }
        }
    }

    if (!id) {
        console.warn('[LexicalPlayground] Editor not found for unmount');
        return;
    }

    const entry = mountedEditors.get(id);
    if (entry) {
        try {
            entry.root.unmount();
        } catch (e) {
            console.error('[LexicalPlayground] Error unmounting:', e);
        }
        mountedEditors.delete(id);
    }
}

/**
 * Get all mounted editor IDs
 */
export function getMountedEditors(): string[] {
    return Array.from(mountedEditors.keys());
}

/**
 * Check if an editor is mounted
 */
export function isMounted(editorId: string): boolean {
    return mountedEditors.has(editorId);
}

// Re-export types for consumers
export type {
    PlaygroundMountOptions,
    PlaygroundEditorHandle,
    YjsConfig,
    PlaygroundEditorProps,
} from './types';
