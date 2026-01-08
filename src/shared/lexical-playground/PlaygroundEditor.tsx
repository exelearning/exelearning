/**
 * PlaygroundEditor - Main React component for the Lexical Playground
 *
 * Integrates all plugins, nodes, and provides an imperative handle
 * for external control.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $createParagraphNode, EditorState } from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { TRANSFORMERS } from '@lexical/markdown';

import PlaygroundTheme from './themes/PlaygroundTheme';
import './themes/PlaygroundTheme.css';
import { ToolbarPlugin } from './plugins/ToolbarPlugin';
import { FloatingTextFormatPlugin } from './plugins/FloatingTextFormatPlugin';
import { FloatingLinkEditorPlugin } from './plugins/FloatingLinkEditorPlugin';
import { DraggableBlockPlugin } from './plugins/DraggableBlockPlugin';
import { CodeHighlightPlugin } from './plugins/CodeHighlightPlugin';
import { AutoLinkPlugin } from './plugins/AutoLinkPlugin';
import { ClickableLinkPlugin } from './plugins/ClickableLinkPlugin';
import { ImagesPlugin } from './plugins/ImagesPlugin';
import { CollapsiblePlugin } from './plugins/CollapsiblePlugin';
import { MediaLibraryPlugin } from './plugins/MediaLibraryPlugin';
import { ExeCollaborationPlugin } from './plugins/ExeCollaborationPlugin';
import { ImageNode } from './nodes/ImageNode';
import { CollapsibleContainerNode, CollapsibleTitleNode, CollapsibleContentNode } from './nodes/CollapsibleNode';

import type {
    PlaygroundEditorProps,
    PlaygroundEditorHandle,
    YjsConfig,
    InsertImageOptions,
    InsertVideoOptions,
    InsertAudioOptions,
} from './types';
import { INSERT_IMAGE_COMMAND } from './plugins/ImagesPlugin';
import { $insertNodes } from 'lexical';

// Error handler
function onError(error: Error): void {
    console.error('[LexicalPlayground] Error:', error);
}

// Placeholder component
function Placeholder({ text }: { text: string }) {
    return <div className="lexical-playground-placeholder">{text}</div>;
}

// Inner component that has access to editor context
const EditorInner = forwardRef<PlaygroundEditorHandle, PlaygroundEditorProps>(function EditorInner(props, ref) {
    const [editor] = useLexicalComposerContext();
    const [yjsConfig, setYjsConfig] = useState<YjsConfig | null>(null);
    const [isLinkEditMode, setIsLinkEditMode] = useState(false);
    const floatingAnchorRef = useRef<HTMLDivElement>(null);

    // Create imperative handle
    useImperativeHandle(
        ref,
        () => ({
            getEditor: () => editor,
            getHTML: () => {
                let html = '';
                editor.getEditorState().read(() => {
                    html = $generateHtmlFromNodes(editor, null);
                });
                return html;
            },
            setHTML: (html: string) => {
                editor.update(() => {
                    const parser = new DOMParser();
                    const dom = parser.parseFromString(html, 'text/html');
                    const nodes = $generateNodesFromDOM(editor, dom);
                    const root = $getRoot();
                    root.clear();
                    root.append(...nodes);
                });
            },
            getJSON: () => editor.getEditorState().toJSON(),
            setJSON: json => {
                const editorState = editor.parseEditorState(json);
                editor.setEditorState(editorState);
            },
            isEmpty: () => {
                let empty = true;
                editor.getEditorState().read(() => {
                    const root = $getRoot();
                    empty = root.getTextContent().trim() === '';
                });
                return empty;
            },
            focus: () => editor.focus(),
            blur: () => editor.blur(),
            setEditable: (editable: boolean) => editor.setEditable(editable),
            setYjsBinding: (config: YjsConfig) => {
                setYjsConfig(config);
            },
            insertImage: (options: InsertImageOptions) => {
                editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                    src: options.src,
                    altText: options.altText || '',
                    width: options.width,
                    height: options.height,
                    dataAssetId: options.dataAssetId,
                    dataAssetSrc: options.dataAssetSrc,
                });
            },
            insertVideo: (options: InsertVideoOptions) => {
                // For now, insert as HTML - can be replaced with proper VideoNode later
                editor.update(() => {
                    const parser = new DOMParser();
                    const videoHtml = `<video src="${options.src}" controls data-asset-id="${options.dataAssetId || ''}" data-asset-src="${options.dataAssetSrc || ''}" style="max-width: 100%;"></video>`;
                    const dom = parser.parseFromString(videoHtml, 'text/html');
                    const nodes = $generateNodesFromDOM(editor, dom);
                    $insertNodes(nodes);
                });
            },
            insertAudio: (options: InsertAudioOptions) => {
                // For now, insert as HTML - can be replaced with proper AudioNode later
                editor.update(() => {
                    const parser = new DOMParser();
                    const audioHtml = `<audio src="${options.src}" controls data-asset-id="${options.dataAssetId || ''}" data-asset-src="${options.dataAssetSrc || ''}"></audio>`;
                    const dom = parser.parseFromString(audioHtml, 'text/html');
                    const nodes = $generateNodesFromDOM(editor, dom);
                    $insertNodes(nodes);
                });
            },
            destroy: () => {
                // Editor will be destroyed when component unmounts
            },
        }),
        [editor],
    );

    // Notify parent when handle is ready
    useEffect(() => {
        if (props.onHandleReady && ref && typeof ref === 'object' && ref.current) {
            props.onHandleReady(ref.current);
        }
    }, [props.onHandleReady, ref]);

    // Handle content changes
    const handleChange = useCallback(
        (editorState: EditorState) => {
            if (props.onUpdate) {
                editorState.read(() => {
                    const html = $generateHtmlFromNodes(editor, null);
                    props.onUpdate!(html);
                });
            }
        },
        [editor, props.onUpdate],
    );

    // Set initial content
    useEffect(() => {
        if (props.initialHTML) {
            editor.update(() => {
                const parser = new DOMParser();
                const dom = parser.parseFromString(props.initialHTML!, 'text/html');
                const nodes = $generateNodesFromDOM(editor, dom);
                const root = $getRoot();
                root.clear();
                if (nodes.length > 0) {
                    root.append(...nodes);
                } else {
                    root.append($createParagraphNode());
                }
            });
        }
    }, [editor, props.initialHTML]);

    // Set editable state
    useEffect(() => {
        editor.setEditable(props.editable !== false);
    }, [editor, props.editable]);

    return (
        <div className="lexical-playground-container">
            <ToolbarPlugin onMediaLibraryOpen={props.onMediaLibraryOpen} setIsLinkEditMode={setIsLinkEditMode} />
            <div className="lexical-playground-editor-wrapper" ref={floatingAnchorRef}>
                <RichTextPlugin
                    contentEditable={<ContentEditable className="lexical-playground-editor" />}
                    placeholder={<Placeholder text={props.placeholder || 'Start typing...'} />}
                    ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <AutoFocusPlugin />
                <ListPlugin />
                <CheckListPlugin />
                <LinkPlugin />
                <TablePlugin hasCellMerge hasCellBackgroundColor />
                <HorizontalRulePlugin />
                <TabIndentationPlugin />
                <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
                <CodeHighlightPlugin />
                <AutoLinkPlugin />
                <ClickableLinkPlugin />
                <ImagesPlugin />
                <CollapsiblePlugin />
                <MediaLibraryPlugin onMediaLibraryOpen={props.onMediaLibraryOpen} />
                <ExeCollaborationPlugin yjsConfig={yjsConfig} />
                <DraggableBlockPlugin anchorElem={floatingAnchorRef.current} />
                <FloatingTextFormatPlugin anchorElem={floatingAnchorRef.current} />
                <FloatingLinkEditorPlugin
                    anchorElem={floatingAnchorRef.current}
                    isLinkEditMode={isLinkEditMode}
                    setIsLinkEditMode={setIsLinkEditMode}
                />
            </div>
        </div>
    );
});

// Main component with LexicalComposer
export const PlaygroundEditor = forwardRef<PlaygroundEditorHandle, PlaygroundEditorProps>(
    function PlaygroundEditor(props, ref) {
        const innerRef = useRef<PlaygroundEditorHandle>(null);

        // Forward ref to inner component
        useImperativeHandle(
            ref,
            () => ({
                getEditor: () => innerRef.current?.getEditor() ?? null,
                getHTML: () => innerRef.current?.getHTML() ?? '',
                setHTML: (html: string) => innerRef.current?.setHTML(html),
                getJSON: () => innerRef.current?.getJSON() ?? null,
                setJSON: json => innerRef.current?.setJSON(json),
                isEmpty: () => innerRef.current?.isEmpty() ?? true,
                focus: () => innerRef.current?.focus(),
                blur: () => innerRef.current?.blur(),
                setEditable: (editable: boolean) => innerRef.current?.setEditable(editable),
                setYjsBinding: (config: YjsConfig) => innerRef.current?.setYjsBinding(config),
                insertImage: (options: InsertImageOptions) => innerRef.current?.insertImage(options),
                insertVideo: (options: InsertVideoOptions) => innerRef.current?.insertVideo(options),
                insertAudio: (options: InsertAudioOptions) => innerRef.current?.insertAudio(options),
                destroy: () => innerRef.current?.destroy(),
            }),
            [],
        );

        // Initial editor config
        const initialConfig = {
            namespace: props.editorId || 'PlaygroundEditor',
            theme: PlaygroundTheme as Record<string, unknown>,
            onError,
            nodes: [
                HeadingNode,
                QuoteNode,
                ListNode,
                ListItemNode,
                LinkNode,
                AutoLinkNode,
                CodeNode,
                CodeHighlightNode,
                TableNode,
                TableRowNode,
                TableCellNode,
                HorizontalRuleNode,
                ImageNode,
                CollapsibleContainerNode,
                CollapsibleTitleNode,
                CollapsibleContentNode,
            ],
        };

        return (
            <LexicalComposer initialConfig={initialConfig}>
                <EditorInner {...props} ref={innerRef} />
            </LexicalComposer>
        );
    },
);
