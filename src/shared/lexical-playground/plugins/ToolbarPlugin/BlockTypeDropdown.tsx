/**
 * BlockTypeDropdown - Dropdown for selecting block format
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LexicalEditor, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $setBlocksType } from '@lexical/selection';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    INSERT_CHECK_LIST_COMMAND,
    REMOVE_LIST_COMMAND,
} from '@lexical/list';

import type { BlockType } from '../../types';
import {
    ParagraphIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    Heading4Icon,
    Heading5Icon,
    Heading6Icon,
    QuoteIcon,
    CodeBlockIcon,
    BulletListIcon,
    NumberedListIcon,
    CheckListIcon,
    ChevronDownIcon,
} from '../../ui/Icons';

interface BlockTypeDropdownProps {
    editor: LexicalEditor;
    blockType: BlockType;
    blockTypeLabel: string;
}

interface BlockTypeOption {
    value: BlockType;
    label: string;
    icon: React.ReactNode;
}

const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
    { value: 'paragraph', label: 'Paragraph', icon: <ParagraphIcon /> },
    { value: 'h1', label: 'Heading 1', icon: <Heading1Icon /> },
    { value: 'h2', label: 'Heading 2', icon: <Heading2Icon /> },
    { value: 'h3', label: 'Heading 3', icon: <Heading3Icon /> },
    { value: 'h4', label: 'Heading 4', icon: <Heading4Icon /> },
    { value: 'h5', label: 'Heading 5', icon: <Heading5Icon /> },
    { value: 'h6', label: 'Heading 6', icon: <Heading6Icon /> },
    { value: 'bullet', label: 'Bullet List', icon: <BulletListIcon /> },
    { value: 'number', label: 'Numbered List', icon: <NumberedListIcon /> },
    { value: 'check', label: 'Check List', icon: <CheckListIcon /> },
    { value: 'quote', label: 'Quote', icon: <QuoteIcon /> },
    { value: 'code', label: 'Code Block', icon: <CodeBlockIcon /> },
];

export function BlockTypeDropdown({ editor, blockType, blockTypeLabel }: BlockTypeDropdownProps) {
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

    const formatBlock = useCallback(
        (type: BlockType) => {
            if (type === blockType) {
                setIsOpen(false);
                return;
            }

            if (type === 'bullet') {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            } else if (type === 'number') {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            } else if (type === 'check') {
                editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
            } else {
                // Remove list if currently in a list
                if (['bullet', 'number', 'check'].includes(blockType)) {
                    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                }

                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        if (type === 'paragraph') {
                            $setBlocksType(selection, () => $createParagraphNode());
                        } else if (type.startsWith('h')) {
                            const tag = type as HeadingTagType;
                            $setBlocksType(selection, () => $createHeadingNode(tag));
                        } else if (type === 'quote') {
                            $setBlocksType(selection, () => $createQuoteNode());
                        } else if (type === 'code') {
                            $setBlocksType(selection, () => $createCodeNode());
                        }
                    }
                });
            }

            setIsOpen(false);
        },
        [editor, blockType],
    );

    const currentOption = BLOCK_TYPE_OPTIONS.find(opt => opt.value === blockType);

    return (
        <div className="lexical-playground-block-type-dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                type="button"
                className="lexical-playground-toolbar-dropdown"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span className="lexical-playground-toolbar-dropdown-icon">{currentOption?.icon}</span>
                <span className="lexical-playground-toolbar-dropdown-label">{blockTypeLabel}</span>
                <span className="lexical-playground-toolbar-dropdown-chevron">
                    <ChevronDownIcon />
                </span>
            </button>

            {isOpen && (
                <div className="lexical-playground-dropdown-menu" role="listbox">
                    {BLOCK_TYPE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            className={`lexical-playground-dropdown-item ${blockType === option.value ? 'active' : ''}`}
                            onClick={() => formatBlock(option.value)}
                            aria-selected={blockType === option.value}
                        >
                            <span className="lexical-playground-dropdown-item-icon">{option.icon}</span>
                            <span className="lexical-playground-dropdown-item-label">{option.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
