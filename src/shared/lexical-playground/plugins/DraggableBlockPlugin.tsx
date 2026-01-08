/**
 * DraggableBlockPlugin - Shows drag handle and add button on hover
 * Similar to the Lexical Playground's block tools
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey, $getRoot, $createParagraphNode } from 'lexical';
import { DragHandleIcon, PlusIcon } from '../ui/Icons';

interface DraggableBlockPluginProps {
    anchorElem?: HTMLElement | null;
}

const DRAG_DATA_FORMAT = 'application/x-lexical-drag-block';

function isHTMLElement(x: unknown): x is HTMLElement {
    return x instanceof HTMLElement;
}

export function DraggableBlockPlugin({ anchorElem }: DraggableBlockPluginProps) {
    const [editor] = useLexicalComposerContext();
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const targetNodeKey = useRef<string | null>(null);
    const isDragging = useRef(false);

    const setTargetLine = useCallback(
        (targetBlockElem: HTMLElement | null) => {
            if (!anchorElem) return;

            if (targetBlockElem === null) {
                setIsVisible(false);
                return;
            }

            const rect = targetBlockElem.getBoundingClientRect();
            const anchorRect = anchorElem.getBoundingClientRect();

            const top = rect.top - anchorRect.top;
            const left = -40; // Position to the left of the block

            setPosition({ top, left });
            setIsVisible(true);
        },
        [anchorElem],
    );

    // Handle mouse movement to show/hide the menu
    useEffect(() => {
        if (!anchorElem) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging.current) return;

            const target = e.target as HTMLElement;

            // Don't show if hovering over the menu itself
            if (menuRef.current?.contains(target)) return;

            // Find the closest block element
            const blockElement = target.closest(
                '[data-lexical-decorator="true"], p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, .lexical-playground-image-container',
            ) as HTMLElement | null;

            if (blockElement && anchorElem.contains(blockElement)) {
                setTargetLine(blockElement);

                // Store the node key for operations
                editor.getEditorState().read(() => {
                    const node = $getNearestNodeFromDOMNode(blockElement);
                    if (node) {
                        targetNodeKey.current = node.getKey();
                    }
                });
            } else if (!menuRef.current?.contains(target)) {
                setTargetLine(null);
            }
        };

        const handleMouseLeave = (e: MouseEvent) => {
            if (isDragging.current) return;
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!menuRef.current?.contains(relatedTarget)) {
                setTargetLine(null);
            }
        };

        anchorElem.addEventListener('mousemove', handleMouseMove);
        anchorElem.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            anchorElem.removeEventListener('mousemove', handleMouseMove);
            anchorElem.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [anchorElem, editor, setTargetLine]);

    // Handle add button click - inserts a new paragraph
    const handleAddClick = useCallback(() => {
        editor.update(() => {
            if (targetNodeKey.current) {
                const node = $getNodeByKey(targetNodeKey.current);
                if (node) {
                    const newParagraph = $createParagraphNode();
                    node.insertAfter(newParagraph);
                    newParagraph.select();
                }
            } else {
                // Add at the end
                const root = $getRoot();
                const newParagraph = $createParagraphNode();
                root.append(newParagraph);
                newParagraph.select();
            }
        });
    }, [editor]);

    // Handle drag start
    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (!targetNodeKey.current) return;

        isDragging.current = true;
        e.dataTransfer.setData(DRAG_DATA_FORMAT, targetNodeKey.current);
        e.dataTransfer.effectAllowed = 'move';

        // Hide the menu during drag
        setIsVisible(false);
    }, []);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        isDragging.current = false;
    }, []);

    if (!anchorElem) return null;

    return (
        <div
            ref={menuRef}
            className="lexical-playground-draggable-block-menu"
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                left: `${position.left}px`,
                opacity: isVisible ? 1 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '2px',
                transition: 'opacity 0.1s',
            }}
        >
            <button
                type="button"
                className="lexical-playground-draggable-block-add"
                onClick={handleAddClick}
                title="Add block"
                aria-label="Add block"
            >
                <PlusIcon />
            </button>
            <div
                className="lexical-playground-draggable-block-handle"
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                title="Drag to move"
                aria-label="Drag to move block"
            >
                <DragHandleIcon />
            </div>
        </div>
    );
}
