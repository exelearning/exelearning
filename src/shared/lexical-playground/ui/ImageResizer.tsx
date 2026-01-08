/**
 * ImageResizer - Component for resizing images in the editor
 */
import { useRef, useCallback, useEffect } from 'react';

interface ImageResizerProps {
    imageRef: React.RefObject<HTMLImageElement>;
    onResize: (width: number, height: number) => void;
    showResizers: boolean;
}

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function ImageResizer({ imageRef, onResize, showResizers }: ImageResizerProps) {
    const controlWrapperRef = useRef<HTMLDivElement>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const startWidthRef = useRef(0);
    const startHeightRef = useRef(0);
    const directionRef = useRef<Direction | null>(null);
    const ratioRef = useRef(1);

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>, direction: Direction) => {
            event.preventDefault();
            event.stopPropagation();

            const image = imageRef.current;
            if (!image) return;

            startXRef.current = event.clientX;
            startYRef.current = event.clientY;
            startWidthRef.current = image.offsetWidth;
            startHeightRef.current = image.offsetHeight;
            ratioRef.current = startWidthRef.current / startHeightRef.current;
            directionRef.current = direction;

            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);
        },
        [imageRef, handlePointerMove, handlePointerUp],
    );

    const handlePointerMove = useCallback(
        (event: PointerEvent) => {
            const direction = directionRef.current;
            if (!direction) return;

            const diffX = event.clientX - startXRef.current;
            const diffY = event.clientY - startYRef.current;

            let newWidth = startWidthRef.current;
            let newHeight = startHeightRef.current;

            // Calculate new dimensions based on direction
            if (direction.includes('e')) {
                newWidth = Math.max(50, startWidthRef.current + diffX);
            }
            if (direction.includes('w')) {
                newWidth = Math.max(50, startWidthRef.current - diffX);
            }
            if (direction.includes('s')) {
                newHeight = Math.max(50, startHeightRef.current + diffY);
            }
            if (direction.includes('n')) {
                newHeight = Math.max(50, startHeightRef.current - diffY);
            }

            // Maintain aspect ratio for corner handles
            if (direction.length === 2) {
                if (direction.includes('e') || direction.includes('w')) {
                    newHeight = newWidth / ratioRef.current;
                } else {
                    newWidth = newHeight * ratioRef.current;
                }
            }

            onResize(Math.round(newWidth), Math.round(newHeight));
        },
        [onResize],
    );

    const handlePointerUp = useCallback(() => {
        directionRef.current = null;
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, [handlePointerMove, handlePointerUp]);

    if (!showResizers) return null;

    return (
        <div ref={controlWrapperRef} className="image-resizer-wrapper">
            {/* Corner handles */}
            <div className="image-resizer image-resizer-nw" onPointerDown={e => handlePointerDown(e, 'nw')} />
            <div className="image-resizer image-resizer-ne" onPointerDown={e => handlePointerDown(e, 'ne')} />
            <div className="image-resizer image-resizer-sw" onPointerDown={e => handlePointerDown(e, 'sw')} />
            <div className="image-resizer image-resizer-se" onPointerDown={e => handlePointerDown(e, 'se')} />
            {/* Edge handles */}
            <div className="image-resizer image-resizer-n" onPointerDown={e => handlePointerDown(e, 'n')} />
            <div className="image-resizer image-resizer-s" onPointerDown={e => handlePointerDown(e, 's')} />
            <div className="image-resizer image-resizer-e" onPointerDown={e => handlePointerDown(e, 'e')} />
            <div className="image-resizer image-resizer-w" onPointerDown={e => handlePointerDown(e, 'w')} />
        </div>
    );
}
