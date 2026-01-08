/**
 * ToolbarPlugin - Main toolbar matching Lexical Playground style
 *
 * Features:
 * - Undo/Redo buttons
 * - Block type dropdown (paragraph, headings, lists, quote, code)
 * - Font family dropdown
 * - Font size controls (+/- and input)
 * - Text formatting buttons (bold, italic, underline, code, link)
 * - Color pickers (text and background)
 * - More text styles dropdown (strikethrough, subscript, superscript, clear)
 * - Insert dropdown
 * - Alignment dropdown
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    $isRootOrShadowRoot,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    CAN_UNDO_COMMAND,
    CAN_REDO_COMMAND,
    ElementFormatType,
} from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isListNode, ListNode } from '@lexical/list';
import { $isCodeNode } from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';

import { InsertDropdown } from './InsertDropdown';
import { BlockTypeDropdown } from './BlockTypeDropdown';
import { ColorPicker } from '../../ui/ColorPicker';
import { ToolbarButton, ToolbarDivider } from '../../ui/ToolbarComponents';
import {
    BoldIcon,
    ItalicIcon,
    UnderlineIcon,
    StrikethroughIcon,
    CodeIcon,
    LinkIcon,
    AlignLeftIcon,
    AlignCenterIcon,
    AlignRightIcon,
    AlignJustifyIcon,
    UndoIcon,
    RedoIcon,
    TextColorIcon,
    BgColorIcon,
    SubscriptIcon,
    SuperscriptIcon,
    ChevronDownIcon,
    ClearFormattingIcon,
    FontSizeIncreaseIcon,
    FontSizeDecreaseIcon,
} from '../../ui/Icons';

import type { BlockType } from '../../types';

interface ToolbarPluginProps {
    onMediaLibraryOpen?: (type: 'image' | 'video' | 'audio' | 'file') => void;
    setIsLinkEditMode: (value: boolean) => void;
}

const BLOCK_TYPE_TO_LABEL: Record<BlockType, string> = {
    paragraph: 'Normal',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    h4: 'Heading 4',
    h5: 'Heading 5',
    h6: 'Heading 6',
    quote: 'Quote',
    bullet: 'Bulleted List',
    number: 'Numbered List',
    check: 'Check List',
    code: 'Code Block',
};

const FONT_FAMILY_OPTIONS: Array<[string, string]> = [
    ['Arial', 'Arial'],
    ['Courier New', 'Courier New'],
    ['Georgia', 'Georgia'],
    ['Times New Roman', 'Times New Roman'],
    ['Trebuchet MS', 'Trebuchet MS'],
    ['Verdana', 'Verdana'],
];

const FONT_SIZE_OPTIONS: string[] = [
    '10px',
    '11px',
    '12px',
    '13px',
    '14px',
    '15px',
    '16px',
    '17px',
    '18px',
    '19px',
    '20px',
    '24px',
    '30px',
    '36px',
    '48px',
    '60px',
    '72px',
    '96px',
];

const DEFAULT_FONT_SIZE = '15px';

function useDropdownClose(
    dropdownRef: React.RefObject<HTMLDivElement>,
    isOpen: boolean,
    setIsOpen: (value: boolean) => void,
) {
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
    }, [isOpen, setIsOpen, dropdownRef]);
}

export function ToolbarPlugin({ onMediaLibraryOpen, setIsLinkEditMode }: ToolbarPluginProps) {
    const [editor] = useLexicalComposerContext();
    const [blockType, setBlockType] = useState<BlockType>('paragraph');
    const [elementFormat, setElementFormat] = useState<ElementFormatType>('left');
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isSubscript, setIsSubscript] = useState(false);
    const [isSuperscript, setIsSuperscript] = useState(false);
    const [isCode, setIsCode] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [fontFamily, setFontFamily] = useState('Arial');
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [fontColor, setFontColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#ffffff');

    // Dropdown states
    const [showFontFamilyDropdown, setShowFontFamilyDropdown] = useState(false);
    const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState<'font' | 'bg' | null>(null);
    const [showMoreTextDropdown, setShowMoreTextDropdown] = useState(false);
    const [showAlignDropdown, setShowAlignDropdown] = useState(false);

    // Refs for dropdown closing
    const fontFamilyRef = useRef<HTMLDivElement>(null);
    const fontSizeRef = useRef<HTMLDivElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const moreTextRef = useRef<HTMLDivElement>(null);
    const alignRef = useRef<HTMLDivElement>(null);

    useDropdownClose(fontFamilyRef, showFontFamilyDropdown, setShowFontFamilyDropdown);
    useDropdownClose(fontSizeRef, showFontSizeDropdown, setShowFontSizeDropdown);
    useDropdownClose(moreTextRef, showMoreTextDropdown, setShowMoreTextDropdown);
    useDropdownClose(alignRef, showAlignDropdown, setShowAlignDropdown);

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setShowColorPicker(null);
            }
        };

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorPicker]);

    // Update toolbar state based on selection
    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            // Check text formats
            setIsBold(selection.hasFormat('bold'));
            setIsItalic(selection.hasFormat('italic'));
            setIsUnderline(selection.hasFormat('underline'));
            setIsStrikethrough(selection.hasFormat('strikethrough'));
            setIsSubscript(selection.hasFormat('subscript'));
            setIsSuperscript(selection.hasFormat('superscript'));
            setIsCode(selection.hasFormat('code'));

            // Check link
            const node = selection.anchor.getNode();
            const parent = node.getParent();
            setIsLink($isLinkNode(parent) || $isLinkNode(node));

            // Get font family
            const family = $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial');
            setFontFamily(family);

            // Get font size
            const size = $getSelectionStyleValueForProperty(selection, 'font-size', DEFAULT_FONT_SIZE);
            setFontSize(size);

            // Get font color
            const color = $getSelectionStyleValueForProperty(selection, 'color', '#000000');
            setFontColor(color);

            // Get bg color
            const bg = $getSelectionStyleValueForProperty(selection, 'background-color', '#ffffff');
            setBgColor(bg);

            // Check block type
            const anchorNode = selection.anchor.getNode();
            let element =
                anchorNode.getKey() === 'root'
                    ? anchorNode
                    : $findMatchingParent(anchorNode, e => {
                          const parent = e.getParent();
                          return parent !== null && $isRootOrShadowRoot(parent);
                      });

            if (element === null) {
                element = anchorNode.getTopLevelElementOrThrow();
            }

            const elementDOM = editor.getElementByKey(element.getKey());
            if (elementDOM !== null) {
                if ($isListNode(element)) {
                    const parentList = $findMatchingParent(anchorNode, node => $isListNode(node));
                    const type = parentList ? (parentList as ListNode).getListType() : (element as ListNode).getListType();
                    if (type === 'bullet') setBlockType('bullet');
                    else if (type === 'number') setBlockType('number');
                    else if (type === 'check') setBlockType('check');
                } else {
                    const type = element.getType();
                    if ($isHeadingNode(element)) {
                        const tag = element.getTag();
                        setBlockType(tag as BlockType);
                    } else if ($isCodeNode(element)) {
                        setBlockType('code');
                    } else if (type === 'quote') {
                        setBlockType('quote');
                    } else {
                        setBlockType('paragraph');
                    }
                }
            }

            // Get element format
            const formatType = element.getFormatType?.() || 'left';
            setElementFormat(formatType);
        }
    }, [editor]);

    // Register listeners
    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL,
            ),
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                CAN_UNDO_COMMAND,
                payload => {
                    setCanUndo(payload);
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL,
            ),
            editor.registerCommand(
                CAN_REDO_COMMAND,
                payload => {
                    setCanRedo(payload);
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL,
            ),
        );
    }, [editor, updateToolbar]);

    // Format handlers
    const formatBold = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
    const formatItalic = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
    const formatUnderline = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
    const formatStrikethrough = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
    const formatSubscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
    const formatSuperscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
    const formatCode = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');

    // Alignment handlers
    const formatAlignment = useCallback(
        (alignment: ElementFormatType) => {
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
            setShowAlignDropdown(false);
        },
        [editor],
    );

    // History handlers
    const undo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
    const redo = () => editor.dispatchCommand(REDO_COMMAND, undefined);

    // Link handler
    const insertLink = useCallback(() => {
        if (!isLink) {
            setIsLinkEditMode(true);
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
        } else {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        }
    }, [editor, isLink, setIsLinkEditMode]);

    // Font family handler
    const applyFontFamily = useCallback(
        (family: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'font-family': family });
                }
            });
            setFontFamily(family);
            setShowFontFamilyDropdown(false);
        },
        [editor],
    );

    // Font size handlers
    const applyFontSize = useCallback(
        (size: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'font-size': size });
                }
            });
            setFontSize(size);
            setShowFontSizeDropdown(false);
        },
        [editor],
    );

    const incrementFontSize = useCallback(() => {
        const currentIndex = FONT_SIZE_OPTIONS.indexOf(fontSize);
        if (currentIndex < FONT_SIZE_OPTIONS.length - 1) {
            applyFontSize(FONT_SIZE_OPTIONS[currentIndex + 1]);
        }
    }, [fontSize, applyFontSize]);

    const decrementFontSize = useCallback(() => {
        const currentIndex = FONT_SIZE_OPTIONS.indexOf(fontSize);
        if (currentIndex > 0) {
            applyFontSize(FONT_SIZE_OPTIONS[currentIndex - 1]);
        }
    }, [fontSize, applyFontSize]);

    // Color handlers
    const applyFontColor = useCallback(
        (color: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { color });
                }
            });
            setFontColor(color);
            setShowColorPicker(null);
        },
        [editor],
    );

    const applyBgColor = useCallback(
        (color: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'background-color': color });
                }
            });
            setBgColor(color);
            setShowColorPicker(null);
        },
        [editor],
    );

    // Clear formatting
    const clearFormatting = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                selection.getNodes().forEach(node => {
                    if (node.getType() === 'text') {
                        (node as any).setFormat(0);
                        (node as any).setStyle('');
                    }
                });
            }
        });
        setShowMoreTextDropdown(false);
    }, [editor]);

    // Get alignment icon
    const getAlignmentIcon = () => {
        switch (elementFormat) {
            case 'center':
                return <AlignCenterIcon />;
            case 'right':
                return <AlignRightIcon />;
            case 'justify':
                return <AlignJustifyIcon />;
            default:
                return <AlignLeftIcon />;
        }
    };

    return (
        <div className="toolbar">
            {/* Undo/Redo */}
            <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" icon={<UndoIcon />} />
            <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" icon={<RedoIcon />} />

            <ToolbarDivider />

            {/* Block Type Dropdown */}
            <BlockTypeDropdown editor={editor} blockType={blockType} blockTypeLabel={BLOCK_TYPE_TO_LABEL[blockType]} />

            <ToolbarDivider />

            {/* Font Family Dropdown */}
            <div className="toolbar-item dropdown" ref={fontFamilyRef}>
                <button
                    type="button"
                    className="toolbar-item font-family-dropdown"
                    onClick={() => setShowFontFamilyDropdown(!showFontFamilyDropdown)}
                    title="Font Family"
                    aria-label="Font Family"
                    aria-haspopup="listbox"
                    aria-expanded={showFontFamilyDropdown}
                >
                    <span className="text" style={{ fontFamily }}>
                        {fontFamily}
                    </span>
                    <ChevronDownIcon />
                </button>
                {showFontFamilyDropdown && (
                    <div className="dropdown-menu" role="listbox">
                        {FONT_FAMILY_OPTIONS.map(([label, value]) => (
                            <button
                                key={value}
                                type="button"
                                role="option"
                                className={`dropdown-item ${fontFamily === value ? 'active' : ''}`}
                                onClick={() => applyFontFamily(value)}
                                style={{ fontFamily: value }}
                                aria-selected={fontFamily === value}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ToolbarDivider />

            {/* Font Size Controls */}
            <ToolbarButton
                onClick={decrementFontSize}
                disabled={FONT_SIZE_OPTIONS.indexOf(fontSize) <= 0}
                title="Decrease Font Size"
                icon={<FontSizeDecreaseIcon />}
            />
            <div className="toolbar-item dropdown" ref={fontSizeRef}>
                <button
                    type="button"
                    className="toolbar-item font-size-dropdown"
                    onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
                    title="Font Size"
                    aria-label="Font Size"
                    aria-haspopup="listbox"
                    aria-expanded={showFontSizeDropdown}
                >
                    <span className="text">{fontSize.replace('px', '')}</span>
                </button>
                {showFontSizeDropdown && (
                    <div className="dropdown-menu font-size-menu" role="listbox">
                        {FONT_SIZE_OPTIONS.map(size => (
                            <button
                                key={size}
                                type="button"
                                role="option"
                                className={`dropdown-item ${fontSize === size ? 'active' : ''}`}
                                onClick={() => applyFontSize(size)}
                                aria-selected={fontSize === size}
                            >
                                {size.replace('px', '')}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <ToolbarButton
                onClick={incrementFontSize}
                disabled={FONT_SIZE_OPTIONS.indexOf(fontSize) >= FONT_SIZE_OPTIONS.length - 1}
                title="Increase Font Size"
                icon={<FontSizeIncreaseIcon />}
            />

            <ToolbarDivider />

            {/* Text Formatting */}
            <ToolbarButton onClick={formatBold} active={isBold} title="Bold (Ctrl+B)" icon={<BoldIcon />} />
            <ToolbarButton onClick={formatItalic} active={isItalic} title="Italic (Ctrl+I)" icon={<ItalicIcon />} />
            <ToolbarButton onClick={formatUnderline} active={isUnderline} title="Underline (Ctrl+U)" icon={<UnderlineIcon />} />
            <ToolbarButton onClick={formatCode} active={isCode} title="Insert Code" icon={<CodeIcon />} />
            <ToolbarButton onClick={insertLink} active={isLink} title="Insert Link" icon={<LinkIcon />} />

            <ToolbarDivider />

            {/* Colors */}
            <div className="toolbar-item dropdown" ref={colorPickerRef}>
                <ToolbarButton
                    onClick={() => setShowColorPicker(showColorPicker === 'font' ? null : 'font')}
                    title="Text Color"
                    icon={<TextColorIcon color={fontColor} />}
                />
                {showColorPicker === 'font' && <ColorPicker color={fontColor} onChange={applyFontColor} />}
            </div>
            <div className="toolbar-item dropdown">
                <ToolbarButton
                    onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
                    title="Background Color"
                    icon={<BgColorIcon color={bgColor} />}
                />
                {showColorPicker === 'bg' && <ColorPicker color={bgColor} onChange={applyBgColor} />}
            </div>

            <ToolbarDivider />

            {/* More Text Styles Dropdown */}
            <div className="toolbar-item dropdown" ref={moreTextRef}>
                <button
                    type="button"
                    className={`toolbar-item spaced ${showMoreTextDropdown ? 'active' : ''}`}
                    onClick={() => setShowMoreTextDropdown(!showMoreTextDropdown)}
                    title="More Text Styles"
                    aria-label="More Text Styles"
                    aria-haspopup="listbox"
                    aria-expanded={showMoreTextDropdown}
                >
                    <i className="format more-text" />
                    <span className="text">Aa</span>
                    <ChevronDownIcon />
                </button>
                {showMoreTextDropdown && (
                    <div className="dropdown-menu" role="listbox">
                        <button
                            type="button"
                            className={`dropdown-item ${isStrikethrough ? 'active' : ''}`}
                            onClick={() => {
                                formatStrikethrough();
                                setShowMoreTextDropdown(false);
                            }}
                        >
                            <StrikethroughIcon />
                            <span className="text">Strikethrough</span>
                        </button>
                        <button
                            type="button"
                            className={`dropdown-item ${isSubscript ? 'active' : ''}`}
                            onClick={() => {
                                formatSubscript();
                                setShowMoreTextDropdown(false);
                            }}
                        >
                            <SubscriptIcon />
                            <span className="text">Subscript</span>
                        </button>
                        <button
                            type="button"
                            className={`dropdown-item ${isSuperscript ? 'active' : ''}`}
                            onClick={() => {
                                formatSuperscript();
                                setShowMoreTextDropdown(false);
                            }}
                        >
                            <SuperscriptIcon />
                            <span className="text">Superscript</span>
                        </button>
                        <button type="button" className="dropdown-item" onClick={clearFormatting}>
                            <ClearFormattingIcon />
                            <span className="text">Clear Formatting</span>
                        </button>
                    </div>
                )}
            </div>

            <ToolbarDivider />

            {/* Insert Menu */}
            <InsertDropdown editor={editor} onMediaLibraryOpen={onMediaLibraryOpen} />

            <ToolbarDivider />

            {/* Alignment Dropdown */}
            <div className="toolbar-item dropdown" ref={alignRef}>
                <button
                    type="button"
                    className={`toolbar-item spaced ${showAlignDropdown ? 'active' : ''}`}
                    onClick={() => setShowAlignDropdown(!showAlignDropdown)}
                    title="Text Alignment"
                    aria-label="Text Alignment"
                    aria-haspopup="listbox"
                    aria-expanded={showAlignDropdown}
                >
                    {getAlignmentIcon()}
                    <ChevronDownIcon />
                </button>
                {showAlignDropdown && (
                    <div className="dropdown-menu" role="listbox">
                        <button
                            type="button"
                            className={`dropdown-item ${elementFormat === 'left' ? 'active' : ''}`}
                            onClick={() => formatAlignment('left')}
                        >
                            <AlignLeftIcon />
                            <span className="text">Left Align</span>
                        </button>
                        <button
                            type="button"
                            className={`dropdown-item ${elementFormat === 'center' ? 'active' : ''}`}
                            onClick={() => formatAlignment('center')}
                        >
                            <AlignCenterIcon />
                            <span className="text">Center Align</span>
                        </button>
                        <button
                            type="button"
                            className={`dropdown-item ${elementFormat === 'right' ? 'active' : ''}`}
                            onClick={() => formatAlignment('right')}
                        >
                            <AlignRightIcon />
                            <span className="text">Right Align</span>
                        </button>
                        <button
                            type="button"
                            className={`dropdown-item ${elementFormat === 'justify' ? 'active' : ''}`}
                            onClick={() => formatAlignment('justify')}
                        >
                            <AlignJustifyIcon />
                            <span className="text">Justify</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
