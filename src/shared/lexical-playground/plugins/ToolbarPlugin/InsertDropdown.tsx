/**
 * InsertDropdown - Menu for inserting various content types
 *
 * Shows a "+" button that opens a dropdown with insert options:
 * - Horizontal Rule
 * - Table
 * - Image (via media library)
 * - Collapsible section
 * - Code block
 * - Quote
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LexicalEditor } from 'lexical';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';

import {
    PlusIcon,
    HorizontalRuleIcon,
    TableIcon,
    ImageIcon,
    VideoIcon,
    CollapsibleIcon,
    QuoteIcon,
    CodeBlockIcon,
    BulletListIcon,
    NumberedListIcon,
    CheckListIcon,
} from '../../ui/Icons';
import { INSERT_COLLAPSIBLE_COMMAND } from '../CollapsiblePlugin';

interface InsertDropdownProps {
    editor: LexicalEditor;
    onMediaLibraryOpen?: (type: 'image' | 'video' | 'audio' | 'file') => void;
}

interface InsertMenuItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    description?: string;
    onClick: () => void;
}

export function InsertDropdown({ editor, onMediaLibraryOpen }: InsertDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Insert handlers
    const insertHorizontalRule = useCallback(() => {
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
        setIsOpen(false);
    }, [editor]);

    const insertTable = useCallback(() => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3', includeHeaders: true });
        setIsOpen(false);
    }, [editor]);

    const insertImage = useCallback(() => {
        if (onMediaLibraryOpen) {
            onMediaLibraryOpen('image');
        }
        setIsOpen(false);
    }, [onMediaLibraryOpen]);

    const insertVideo = useCallback(() => {
        if (onMediaLibraryOpen) {
            onMediaLibraryOpen('video');
        }
        setIsOpen(false);
    }, [onMediaLibraryOpen]);

    const insertCollapsible = useCallback(() => {
        editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, undefined);
        setIsOpen(false);
    }, [editor]);

    const insertQuote = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createQuoteNode());
            }
        });
        setIsOpen(false);
    }, [editor]);

    const insertCodeBlock = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createCodeNode());
            }
        });
        setIsOpen(false);
    }, [editor]);

    const insertBulletList = useCallback(() => {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        setIsOpen(false);
    }, [editor]);

    const insertNumberedList = useCallback(() => {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        setIsOpen(false);
    }, [editor]);

    const insertCheckList = useCallback(() => {
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        setIsOpen(false);
    }, [editor]);

    const items: InsertMenuItem[] = [
        {
            key: 'horizontal-rule',
            label: 'Horizontal Rule',
            icon: <HorizontalRuleIcon />,
            description: 'Add a divider line',
            onClick: insertHorizontalRule,
        },
        {
            key: 'table',
            label: 'Table',
            icon: <TableIcon />,
            description: 'Insert a table',
            onClick: insertTable,
        },
        {
            key: 'image',
            label: 'Image',
            icon: <ImageIcon />,
            description: 'Insert an image',
            onClick: insertImage,
        },
        {
            key: 'video',
            label: 'Video',
            icon: <VideoIcon />,
            description: 'Insert a video',
            onClick: insertVideo,
        },
        {
            key: 'collapsible',
            label: 'Collapsible',
            icon: <CollapsibleIcon />,
            description: 'Add a collapsible section',
            onClick: insertCollapsible,
        },
        {
            key: 'quote',
            label: 'Quote',
            icon: <QuoteIcon />,
            description: 'Add a block quote',
            onClick: insertQuote,
        },
        {
            key: 'code-block',
            label: 'Code Block',
            icon: <CodeBlockIcon />,
            description: 'Add a code block',
            onClick: insertCodeBlock,
        },
        {
            key: 'bullet-list',
            label: 'Bullet List',
            icon: <BulletListIcon />,
            description: 'Create a bullet list',
            onClick: insertBulletList,
        },
        {
            key: 'numbered-list',
            label: 'Numbered List',
            icon: <NumberedListIcon />,
            description: 'Create a numbered list',
            onClick: insertNumberedList,
        },
        {
            key: 'check-list',
            label: 'Check List',
            icon: <CheckListIcon />,
            description: 'Create a checklist',
            onClick: insertCheckList,
        },
    ];

    return (
        <div className="lexical-playground-insert-dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                type="button"
                className={`lexical-playground-toolbar-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Insert"
                aria-label="Insert"
                aria-expanded={isOpen}
            >
                <PlusIcon />
            </button>

            {isOpen && (
                <div className="lexical-playground-insert-menu">
                    {items.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            className="lexical-playground-insert-menu-item"
                            onClick={item.onClick}
                        >
                            <span className="lexical-playground-insert-menu-item-icon">{item.icon}</span>
                            <span className="lexical-playground-insert-menu-item-text">
                                <span className="lexical-playground-insert-menu-item-label">{item.label}</span>
                                {item.description && (
                                    <span className="lexical-playground-insert-menu-item-description">
                                        {item.description}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
