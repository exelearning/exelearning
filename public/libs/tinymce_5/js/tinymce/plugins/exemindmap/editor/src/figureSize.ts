/**
 * The size a saved map is shown at in the content.
 *
 * By default the image has the map's own size. The legacy dialog let authors set other
 * Dimensions, with or without constraining the proportions, and authors use them for large maps:
 * `.exe-figure` is `max-width: 100%`, so a wide map is otherwise shrunk to the page width.
 */

export interface Size {
    width: number;
    height: number;
}

/** What the author typed in Dimensions: no value means "the map's own size". */
export interface SizeChoice {
    width?: number;
    height?: number;
    constrain: boolean;
}

export const MAX_FIGURE_SIZE = 10000;

/** A dimension typed by the author: a positive whole number of pixels, or undefined. */
export function parsePixels(value: string): number | undefined {
    const n = Math.round(Number(value.trim() || Number.NaN));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(n, MAX_FIGURE_SIZE);
}

const atLeastOne = (n: number) => Math.max(1, Math.round(n));

/** The size to show a map of `natural` size at, following the author's choice. */
export function figureSize(natural: Size, choice: SizeChoice): Size {
    const { width, height } = choice;
    const ratio = natural.width > 0 && natural.height > 0 ? natural.height / natural.width : 1;
    if (width !== undefined && (choice.constrain || height === undefined)) {
        return { width, height: atLeastOne(width * ratio) };
    }
    if (width !== undefined && height !== undefined) return { width, height };
    if (height !== undefined) return { width: atLeastOne(height / ratio), height };
    return { width: atLeastOne(natural.width), height: atLeastOne(natural.height) };
}

/**
 * How the author set the Dimensions, stored on the image (`data-mindmap-size`): empty for the
 * map's own size. The map's size depends on the fonts installed, so it cannot tell on opening.
 */
export type SizeMode = '' | 'constrain' | 'free';

export function sizeMode(choice: SizeChoice): SizeMode {
    if (choice.width === undefined && choice.height === undefined) return '';
    return choice.constrain ? 'constrain' : 'free';
}

/** Whether a stored size is not the size the map was saved at. */
function differs(stored: Size, natural: Size): boolean {
    return Math.abs(stored.width - natural.width) > 1 || Math.abs(stored.height - natural.height) > 1;
}

/**
 * The Dimensions to show when a map is opened, or undefined for the map's own size. A
 * constrained size keeps its width, the height following the map. A converted legacy map has
 * no marker and another shape: it keeps its width when its size is not the new layout's.
 */
export function openingChoice(
    stored: Partial<Size> | undefined,
    mode: string | null | undefined,
    natural: Size,
    legacy: boolean,
): SizeChoice | undefined {
    const { width, height } = stored ?? {};
    if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    if (mode === 'free') return { width, height, constrain: false };
    if (mode === 'constrain' || (legacy && !mode && differs({ width, height }, natural))) {
        return { width, constrain: true };
    }
    return undefined;
}
