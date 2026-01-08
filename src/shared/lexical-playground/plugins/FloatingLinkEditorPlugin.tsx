/**
 * FloatingLinkEditorPlugin - Shows a link editor popup when a link is selected
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_HIGH,
    KEY_ESCAPE_COMMAND,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND, $isAutoLinkNode } from '@lexical/link';
import { mergeRegister, $findMatchingParent } from '@lexical/utils';
import { createPortal } from 'react-dom';

import { EditIcon, TrashIcon, CheckIcon, ExternalLinkIcon } from '../ui/Icons';

interface FloatingLinkEditorPluginProps {
    anchorElem?: HTMLElement | null;
    isLinkEditMode: boolean;
    setIsLinkEditMode: (value: boolean) => void;
}

function FloatingLinkEditor({
    anchorElem,
    isLinkEditMode,
    setIsLinkEditMode,
}: {
    anchorElem: HTMLElement;
    isLinkEditMode: boolean;
    setIsLinkEditMode: (value: boolean) => void;
}) {
    const [editor] = useLexicalComposerContext();
    const inputRef = useRef<HTMLInputElement>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [editedLinkUrl, setEditedLinkUrl] = useState('');
    const [isLink, setIsLink] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isAutoLink, setIsAutoLink] = useState(false);

    const updateLinkEditor = useCallback(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
            setIsLink(false);
            return;
        }

        const node = selection.anchor.getNode();
        const linkParent = $findMatchingParent(node, $isLinkNode);
        const autoLinkParent = $findMatchingParent(node, $isAutoLinkNode);

        if (linkParent) {
            setIsLink(true);
            setLinkUrl(linkParent.getURL());
            setIsAutoLink(!!autoLinkParent);
        } else if ($isLinkNode(node)) {
            setIsLink(true);
            setLinkUrl(node.getURL());
            setIsAutoLink($isAutoLinkNode(node));
        } else {
            setIsLink(false);
            setLinkUrl('');
            setIsAutoLink(false);
        }

        // Position the editor
        const nativeSelection = window.getSelection();
        if (nativeSelection && nativeSelection.rangeCount > 0) {
            const range = nativeSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const anchorRect = anchorElem.getBoundingClientRect();

            setPosition({
                top: rect.bottom - anchorRect.top + 8,
                left: rect.left - anchorRect.left,
            });
        }
    }, [anchorElem]);

    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateLinkEditor();
                    return false;
                },
                COMMAND_PRIORITY_LOW,
            ),
            editor.registerCommand(
                KEY_ESCAPE_COMMAND,
                () => {
                    if (isLinkEditMode) {
                        setIsLinkEditMode(false);
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_HIGH,
            ),
        );
    }, [editor, updateLinkEditor, isLinkEditMode, setIsLinkEditMode]);

    useEffect(() => {
        if (isLinkEditMode && inputRef.current) {
            setEditedLinkUrl(linkUrl);
            inputRef.current.focus();
        }
    }, [isLinkEditMode, linkUrl]);

    const handleSave = useCallback(() => {
        if (editedLinkUrl.trim()) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, editedLinkUrl);
        }
        setIsLinkEditMode(false);
    }, [editor, editedLinkUrl, setIsLinkEditMode]);

    const handleRemove = useCallback(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        setIsLinkEditMode(false);
    }, [editor, setIsLinkEditMode]);

    if (!isLink && !isLinkEditMode) return null;

    return createPortal(
        <div
            className="lexical-playground-link-editor"
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            {isLinkEditMode ? (
                <>
                    <input
                        ref={inputRef}
                        type="url"
                        value={editedLinkUrl}
                        onChange={e => setEditedLinkUrl(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsLinkEditMode(false);
                            }
                        }}
                        placeholder="https://"
                    />
                    <button
                        type="button"
                        className="lexical-playground-toolbar-btn"
                        onClick={handleSave}
                        aria-label="Save"
                    >
                        <CheckIcon />
                    </button>
                </>
            ) : (
                <>
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lexical-playground-link-editor-url"
                    >
                        {linkUrl}
                        <ExternalLinkIcon />
                    </a>
                    {!isAutoLink && (
                        <>
                            <button
                                type="button"
                                className="lexical-playground-toolbar-btn"
                                onClick={() => setIsLinkEditMode(true)}
                                aria-label="Edit"
                            >
                                <EditIcon />
                            </button>
                            <button
                                type="button"
                                className="lexical-playground-toolbar-btn"
                                onClick={handleRemove}
                                aria-label="Remove"
                            >
                                <TrashIcon />
                            </button>
                        </>
                    )}
                </>
            )}
        </div>,
        anchorElem,
    );
}

export function FloatingLinkEditorPlugin({
    anchorElem,
    isLinkEditMode,
    setIsLinkEditMode,
}: FloatingLinkEditorPluginProps) {
    if (!anchorElem) return null;

    return (
        <FloatingLinkEditor
            anchorElem={anchorElem}
            isLinkEditMode={isLinkEditMode}
            setIsLinkEditMode={setIsLinkEditMode}
        />
    );
}
