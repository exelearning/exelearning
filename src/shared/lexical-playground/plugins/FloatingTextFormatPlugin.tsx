/**
 * FloatingTextFormatPlugin - Shows a floating toolbar when text is selected
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { createPortal } from 'react-dom';

import { BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, CodeIcon, LinkIcon } from '../ui/Icons';

interface FloatingTextFormatPluginProps {
    anchorElem?: HTMLElement | null;
}

function FloatingToolbar({ anchorElem }: { anchorElem: HTMLElement }) {
    const [editor] = useLexicalComposerContext();
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isCode, setIsCode] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
            setIsVisible(false);
            return;
        }

        // Update format states
        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));
        setIsCode(selection.hasFormat('code'));

        const node = selection.anchor.getNode();
        const parent = node.getParent();
        setIsLink($isLinkNode(parent) || $isLinkNode(node));

        // Get selection position
        const nativeSelection = window.getSelection();
        if (nativeSelection && nativeSelection.rangeCount > 0) {
            const range = nativeSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const anchorRect = anchorElem.getBoundingClientRect();

            setPosition({
                top: rect.top - anchorRect.top - 45,
                left: rect.left - anchorRect.left + rect.width / 2 - 100,
            });
            setIsVisible(true);
        }
    }, [anchorElem]);

    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                COMMAND_PRIORITY_LOW,
            ),
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
        );
    }, [editor, updateToolbar]);

    // Hide on mouse down outside
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                // Let selection change handle visibility
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);

    if (!isVisible) return null;

    return createPortal(
        <div
            ref={toolbarRef}
            className="lexical-playground-floating-toolbar"
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isBold ? 'active' : ''}`}
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
                aria-label="Bold"
            >
                <BoldIcon />
            </button>
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isItalic ? 'active' : ''}`}
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
                aria-label="Italic"
            >
                <ItalicIcon />
            </button>
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isUnderline ? 'active' : ''}`}
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
                aria-label="Underline"
            >
                <UnderlineIcon />
            </button>
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isStrikethrough ? 'active' : ''}`}
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
                aria-label="Strikethrough"
            >
                <StrikethroughIcon />
            </button>
            <div className="lexical-playground-floating-toolbar-divider" />
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isCode ? 'active' : ''}`}
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
                aria-label="Code"
            >
                <CodeIcon />
            </button>
            <button
                type="button"
                className={`lexical-playground-floating-toolbar-btn ${isLink ? 'active' : ''}`}
                onClick={() => {
                    if (isLink) {
                        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                    } else {
                        editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
                    }
                }}
                aria-label="Link"
            >
                <LinkIcon />
            </button>
        </div>,
        anchorElem,
    );
}

export function FloatingTextFormatPlugin({ anchorElem }: FloatingTextFormatPluginProps) {
    if (!anchorElem) return null;
    return <FloatingToolbar anchorElem={anchorElem} />;
}
