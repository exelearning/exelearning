/**
 * ImageNode - Custom node for images with asset support and resizing
 */
import {
    DecoratorNode,
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedLexicalNode,
    Spread,
    $getNodeByKey,
    COMMAND_PRIORITY_LOW,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
} from 'lexical';
import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';

export interface ImagePayload {
    src: string;
    altText?: string;
    width?: number;
    height?: number;
    dataAssetId?: string;
    dataAssetSrc?: string;
    key?: NodeKey;
}

export type SerializedImageNode = Spread<
    {
        src: string;
        altText: string;
        width?: number;
        height?: number;
        dataAssetId?: string;
        dataAssetSrc?: string;
    },
    SerializedLexicalNode
>;

function ImageComponent({
    src,
    altText,
    width,
    height,
    nodeKey,
}: {
    src: string;
    altText: string;
    width?: number;
    height?: number;
    nodeKey: NodeKey;
}) {
    const [editor] = useLexicalComposerContext();
    const imageRef = useRef<HTMLImageElement>(null);
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const [isResizing, setIsResizing] = useState(false);
    const [currentWidth, setCurrentWidth] = useState(width);
    const [currentHeight, setCurrentHeight] = useState(height);

    // Handle click to select
    const handleClick = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            if (!editor.isEditable()) return;

            clearSelection();
            setSelected(true);
        },
        [clearSelection, editor, setSelected],
    );

    // Handle resize
    const handleResize = useCallback((newWidth: number, newHeight: number) => {
        setCurrentWidth(newWidth);
        setCurrentHeight(newHeight);
    }, []);

    // Commit resize to node
    const handleResizeEnd = useCallback(() => {
        if (currentWidth !== undefined && currentHeight !== undefined) {
            editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if ($isImageNode(node)) {
                    node.setWidthAndHeight(currentWidth, currentHeight);
                }
            });
        }
        setIsResizing(false);
    }, [currentWidth, currentHeight, editor, nodeKey]);

    // Handle key commands for deletion
    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                KEY_DELETE_COMMAND,
                () => {
                    if (isSelected) {
                        editor.update(() => {
                            const node = $getNodeByKey(nodeKey);
                            if (node) {
                                node.remove();
                            }
                        });
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW,
            ),
            editor.registerCommand(
                KEY_BACKSPACE_COMMAND,
                () => {
                    if (isSelected) {
                        editor.update(() => {
                            const node = $getNodeByKey(nodeKey);
                            if (node) {
                                node.remove();
                            }
                        });
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW,
            ),
        );
    }, [editor, isSelected, nodeKey]);

    // Handle pointer events for resizing
    const handlePointerDown = useCallback(
        (event: React.PointerEvent, direction: string) => {
            event.preventDefault();
            event.stopPropagation();
            setIsResizing(true);

            const image = imageRef.current;
            if (!image) return;

            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = currentWidth || image.naturalWidth;
            const startHeight = currentHeight || image.naturalHeight;
            const ratio = startWidth / startHeight;

            const handlePointerMove = (moveEvent: PointerEvent) => {
                const diffX = moveEvent.clientX - startX;
                const diffY = moveEvent.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;

                if (direction.includes('e')) {
                    newWidth = Math.max(50, startWidth + diffX);
                }
                if (direction.includes('w')) {
                    newWidth = Math.max(50, startWidth - diffX);
                }
                if (direction.includes('s')) {
                    newHeight = Math.max(50, startHeight + diffY);
                }
                if (direction.includes('n')) {
                    newHeight = Math.max(50, startHeight - diffY);
                }

                // Maintain aspect ratio for corner handles
                if (direction.length === 2) {
                    newHeight = newWidth / ratio;
                }

                handleResize(Math.round(newWidth), Math.round(newHeight));
            };

            const handlePointerUp = () => {
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
                handleResizeEnd();
            };

            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);
        },
        [currentWidth, currentHeight, handleResize, handleResizeEnd],
    );

    const displayWidth = currentWidth || width;
    const displayHeight = currentHeight || height;

    return (
        <div className={`lexical-playground-image-container ${isSelected ? 'selected' : ''}`} onClick={handleClick}>
            <img
                ref={imageRef}
                src={src}
                alt={altText}
                style={{
                    width: displayWidth ? `${displayWidth}px` : 'auto',
                    height: displayHeight ? `${displayHeight}px` : 'auto',
                    maxWidth: '100%',
                }}
                className="PlaygroundEditorTheme__image"
                draggable="false"
            />
            {isSelected && editor.isEditable() && (
                <>
                    {/* Corner resize handles */}
                    <div className="image-resizer image-resizer-nw" onPointerDown={e => handlePointerDown(e, 'nw')} />
                    <div className="image-resizer image-resizer-ne" onPointerDown={e => handlePointerDown(e, 'ne')} />
                    <div className="image-resizer image-resizer-sw" onPointerDown={e => handlePointerDown(e, 'sw')} />
                    <div className="image-resizer image-resizer-se" onPointerDown={e => handlePointerDown(e, 'se')} />
                </>
            )}
        </div>
    );
}

function convertImageElement(domNode: Node): DOMConversionOutput | null {
    const img = domNode as HTMLImageElement;
    if (img.src) {
        const node = $createImageNode({
            src: img.src,
            altText: img.alt || '',
            width: img.width || undefined,
            height: img.height || undefined,
            dataAssetId: img.dataset.assetId,
            dataAssetSrc: img.dataset.assetSrc,
        });
        return { node };
    }
    return null;
}

export class ImageNode extends DecoratorNode<JSX.Element> {
    __src: string;
    __altText: string;
    __width: number | undefined;
    __height: number | undefined;
    __dataAssetId: string | undefined;
    __dataAssetSrc: string | undefined;

    static getType(): string {
        return 'image';
    }

    static clone(node: ImageNode): ImageNode {
        return new ImageNode(
            node.__src,
            node.__altText,
            node.__width,
            node.__height,
            node.__dataAssetId,
            node.__dataAssetSrc,
            node.__key,
        );
    }

    static importJSON(serializedNode: SerializedImageNode): ImageNode {
        return $createImageNode({
            src: serializedNode.src,
            altText: serializedNode.altText,
            width: serializedNode.width,
            height: serializedNode.height,
            dataAssetId: serializedNode.dataAssetId,
            dataAssetSrc: serializedNode.dataAssetSrc,
        });
    }

    static importDOM(): DOMConversionMap | null {
        return {
            img: () => ({
                conversion: convertImageElement,
                priority: 0,
            }),
        };
    }

    constructor(
        src: string,
        altText: string,
        width?: number,
        height?: number,
        dataAssetId?: string,
        dataAssetSrc?: string,
        key?: NodeKey,
    ) {
        super(key);
        this.__src = src;
        this.__altText = altText;
        this.__width = width;
        this.__height = height;
        this.__dataAssetId = dataAssetId;
        this.__dataAssetSrc = dataAssetSrc;
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('img');
        element.setAttribute('src', this.__src);
        element.setAttribute('alt', this.__altText);
        if (this.__width) {
            element.setAttribute('width', String(this.__width));
        }
        if (this.__height) {
            element.setAttribute('height', String(this.__height));
        }
        if (this.__dataAssetId) {
            element.setAttribute('data-asset-id', this.__dataAssetId);
        }
        if (this.__dataAssetSrc) {
            element.setAttribute('data-asset-src', this.__dataAssetSrc);
        }
        return { element };
    }

    exportJSON(): SerializedImageNode {
        return {
            type: 'image',
            version: 1,
            src: this.__src,
            altText: this.__altText,
            width: this.__width,
            height: this.__height,
            dataAssetId: this.__dataAssetId,
            dataAssetSrc: this.__dataAssetSrc,
        };
    }

    getSrc(): string {
        return this.__src;
    }

    getAltText(): string {
        return this.__altText;
    }

    setWidthAndHeight(width: number, height: number): void {
        const writable = this.getWritable();
        writable.__width = width;
        writable.__height = height;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const span = document.createElement('span');
        const theme = config.theme;
        const className = theme.image;
        if (className) {
            span.className = className;
        }
        return span;
    }

    updateDOM(): false {
        return false;
    }

    decorate(): JSX.Element {
        return (
            <Suspense fallback={null}>
                <ImageComponent
                    src={this.__src}
                    altText={this.__altText}
                    width={this.__width}
                    height={this.__height}
                    nodeKey={this.__key}
                />
            </Suspense>
        );
    }
}

export function $createImageNode(payload: ImagePayload): ImageNode {
    return new ImageNode(
        payload.src,
        payload.altText || '',
        payload.width,
        payload.height,
        payload.dataAssetId,
        payload.dataAssetSrc,
        payload.key,
    );
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
    return node instanceof ImageNode;
}
