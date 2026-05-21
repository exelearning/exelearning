/**
 * Slide iDevice — inline SVG icon set.
 *
 * Stroke-based icons on a 24×24 grid, sized 18–22 px in the toolbar. The
 * geometry tracks the user-supplied "Iconos.html" design bundle (Google
 * Drawings-inspired). Default render flags: fill="none",
 * stroke="currentColor", linecap/linejoin="round", stroke-width 1.6.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export type IconName =
    | 'cursor'
    | 'shape'
    | 'text'
    | 'image'
    | 'line'
    | 'arrow'
    | 'heart'
    | 'undo'
    | 'redo'
    | 'duplicate'
    | 'delete'
    | 'forward'
    | 'backward'
    | 'caret'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'align-left'
    | 'align-center'
    | 'align-right'
    | 'fill'
    | 'stroke'
    | 'crop'
    | 'replace'
    | 'flip-h'
    | 'flip-v'
    | 'reset'
    | 'zoom-in'
    | 'zoom-out'
    | 'fit'
    | 'rect'
    | 'circle'
    | 'radius'
    | 'shadow'
    | 'opacity'
    | 'border-width'
    | 'background';

interface IconDef {
    inner: string;
    viewBox?: string;
    sw?: number;
    /** Whether to fill the inner shapes by default. */
    filled?: boolean;
}

const DEFS: Record<IconName, IconDef> = {
    // Default arrow cursor (Iconos.html "cursor"): pointer with tail.
    cursor: {
        inner: '<path d="M6 3 L6 18 L10 14 L12.5 20 L14.5 19 L12 13 L18 13 Z"/>',
        sw: 1.6,
    },
    // Square overlapping circle — Iconos.html "shapes" glyph. The inner
    // white circle hides the rect's lower-right overlap so the two
    // primitives read cleanly even at small sizes.
    shape: {
        inner:
            '<rect x="3.5" y="3.5" width="11" height="11" rx="1"/>' +
            '<circle cx="15" cy="15" r="5.5" fill="white"/>' +
            '<circle cx="15" cy="15" r="5.5"/>',
        sw: 1.6,
    },
    // T glyph for the text tool.
    text: {
        inner: '<path d="M5 6 L19 6"/><path d="M12 6 L12 19"/><path d="M9 19 L15 19"/>',
        sw: 1.8,
    },
    // Photo frame with sun + mountain.
    image: {
        inner:
            '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/>' +
            '<circle cx="8.5" cy="10" r="1.5"/>' +
            '<path d="M20 16 L15 11 L4 19.5"/>',
        sw: 1.6,
    },
    line: {
        inner:
            '<path d="M5 19 L19 5"/>' +
            '<circle cx="5" cy="19" r="1.2" fill="currentColor"/>' +
            '<circle cx="19" cy="5" r="1.2" fill="currentColor"/>',
        sw: 1.6,
    },
    arrow: {
        inner: '<path d="M4 12 H17"/><path d="M14 8 L18 12 L14 16" fill="currentColor" stroke="currentColor"/>',
        sw: 1.6,
    },
    heart: {
        inner:
            '<path d="M12 20 C 6 16 3 12 3 8 C 3 5 5 3 8 3 C 10 3 11 4 12 6 C 13 4 14 3 16 3 C 19 3 21 5 21 8 C 21 12 18 16 12 20 Z" fill="currentColor" stroke="none"/>',
        sw: 1.6,
    },
    rect: { inner: '<rect x="4" y="6" width="16" height="12" rx="1"/>', sw: 1.6 },
    circle: { inner: '<circle cx="12" cy="12" r="7"/>', sw: 1.6 },

    // Iconos.html "undo": hooked arrow looping back.
    undo: {
        inner: '<path d="M9 9 L4 9 L4 4"/><path d="M4 9 C7 5, 13 4, 17 7 C20 10, 20 15, 17 18"/>',
        sw: 1.6,
    },
    redo: {
        inner: '<path d="M15 9 L20 9 L20 4"/><path d="M20 9 C17 5, 11 4, 7 7 C4 10, 4 15, 7 18"/>',
        sw: 1.6,
    },
    // Single card behind, plus badge in front-right — "duplicate" intent.
    duplicate: {
        inner:
            '<rect x="3.5" y="3.5" width="13" height="13" rx="2"/>' +
            '<path d="M20 13 L20 20 L13 20" stroke-dasharray="2.2 2.2"/>' +
            '<circle cx="17.5" cy="6.5" r="3.5" fill="currentColor" stroke="none"/>' +
            '<path d="M17.5 4.8 L17.5 8.2 M15.8 6.5 L19.2 6.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>',
        sw: 1.6,
    },
    // Trash can.
    delete: {
        inner:
            '<path d="M5 7 L19 7"/>' +
            '<path d="M10 7 L10 4 L14 4 L14 7"/>' +
            '<path d="M6.5 7 L7.5 20 L16.5 20 L17.5 7"/>' +
            '<path d="M10 10.5 L10 16.5 M14 10.5 L14 16.5" stroke-width="1.2"/>',
        sw: 1.6,
    },
    // Bring forward — outlined back card with the front card SOLID:
    // "the selected layer is being brought to the front". Two squares,
    // no arrow.
    forward: {
        inner:
            '<rect x="3" y="3" width="11" height="11" rx="1.5"/>' +
            '<rect x="10" y="10" width="11" height="11" rx="1.5" fill="currentColor"/>',
        sw: 1.6,
    },
    // Send backward — SOLID back card with the front card outlined:
    // "the selected layer is going to the back". The front rect uses a
    // white fill so the solid back doesn't bleed through where they
    // overlap.
    backward: {
        inner:
            '<rect x="3" y="3" width="11" height="11" rx="1.5" fill="currentColor"/>' +
            '<rect x="10" y="10" width="11" height="11" rx="1.5" fill="white"/>',
        sw: 1.6,
    },

    caret: { inner: '<path d="M7 10 L12 15 L17 10"/>', sw: 1.6 },

    bold: {
        inner:
            '<path d="M7 5 L13 5 C16 5, 16 11, 13 11 L7 11 Z" stroke-width="2"/>' +
            '<path d="M7 11 L14 11 C18 11, 18 19, 14 19 L7 19 Z" stroke-width="2"/>',
        sw: 0,
    },
    italic: { inner: '<path d="M10 5 L18 5"/><path d="M6 19 L14 19"/><path d="M14 5 L10 19"/>', sw: 1.8 },
    underline: { inner: '<path d="M6 4 L6 12 C6 16, 18 16, 18 12 L18 4"/><path d="M5 20 L19 20"/>', sw: 1.8 },
    'align-left': { inner: '<path d="M4 6 L20 6 M4 11 L14 11 M4 16 L18 16 M4 21 L12 21"/>', sw: 1.5 },
    'align-center': { inner: '<path d="M4 6 L20 6 M7 11 L17 11 M5 16 L19 16 M8 21 L16 21"/>', sw: 1.5 },
    'align-right': { inner: '<path d="M4 6 L20 6 M10 11 L20 11 M6 16 L20 16 M12 21 L20 21"/>', sw: 1.5 },

    // Paint bucket (tilted) + drip — Google Drawings fill icon.
    fill: {
        inner:
            '<path d="M5 13 L11.5 6.5 L18 13 L13 18 L8 18 Z"/>' +
            '<path d="M11.5 6.5 L8 3"/>' +
            '<path d="M18 13 L20.5 16.5 C20.5 18.2, 18.2 18.2, 18.2 16.5 C18.2 15.5, 19.3 14, 20.5 13.5" stroke-linejoin="round"/>',
        sw: 1.6,
    },
    // Pencil — Google Drawings stroke-colour icon.
    stroke: {
        inner: '<path d="M4 20 L7 19 L19 7 L17 5 L5 17 Z"/><path d="M14 8 L16 10"/>',
        sw: 1.6,
    },
    // Two opposite L-corner brackets — classic crop icon.
    crop: {
        inner: '<path d="M7 3 L7 17 L21 17"/><path d="M3 7 L17 7 L17 21"/>',
        sw: 1.6,
    },
    // Two stacked images with swap arrows — "replace image".
    replace: {
        inner:
            '<rect x="3" y="3" width="10" height="8" rx="1.3"/>' +
            '<rect x="11" y="13" width="10" height="8" rx="1.3"/>' +
            '<path d="M15 7 L18 7 M16.5 5.5 L18 7 L16.5 8.5"/>' +
            '<path d="M9 17 L6 17 M7.5 15.5 L6 17 L7.5 18.5"/>',
        sw: 1.6,
    },
    // Horizontal flip — solid box mirrored to a dashed triangle across a
    // vertical axis. Matches Iconos.html "flipH".
    'flip-h': {
        inner:
            '<path d="M12 4 L12 20"/>' +
            '<path d="M4 8 L9 8 L9 16 L4 16 Z" stroke-linejoin="round"/>' +
            '<path d="M15 6 L20 12 L15 18 Z" stroke-linejoin="round" stroke-dasharray="2 2"/>',
        sw: 1.6,
    },
    // Vertical flip — solid box mirrored to a dashed triangle across a
    // horizontal axis. Matches Iconos.html "flipV".
    'flip-v': {
        inner:
            '<path d="M4 12 L20 12"/>' +
            '<path d="M8 4 L8 9 L16 9 L16 4 Z" stroke-linejoin="round"/>' +
            '<path d="M6 15 L12 20 L18 15 Z" stroke-linejoin="round" stroke-dasharray="2 2"/>',
        sw: 1.6,
    },
    // Nearly-full-circle clockwise arrow with an L arrowhead — reads as
    // "rotate / refresh / reset". Distinct from undo (which is a half
    // arc curving back on itself); reset wraps almost the full circle so
    // the two icons are easy to tell apart at a glance.
    reset: {
        inner:
            '<path d="M21 12 a 9 9 0 1 1 -3 -6.7"/>' +
            '<path d="M21 3 V 9 H 15"/>',
        sw: 1.6,
    },

    'zoom-in': {
        inner: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 L20 20"/><path d="M8 11 L14 11 M11 8 L11 14"/>',
        sw: 1.6,
    },
    'zoom-out': {
        inner: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 L20 20"/><path d="M8 11 L14 11"/>',
        sw: 1.6,
    },
    // Four outward L-corners with a hint of inward chevrons — "fit zoom".
    fit: {
        inner:
            '<path d="M4 9 L4 4 L9 4"/>' +
            '<path d="M20 9 L20 4 L15 4"/>' +
            '<path d="M4 15 L4 20 L9 20"/>' +
            '<path d="M20 15 L20 20 L15 20"/>' +
            '<path d="M7 7 L11 11 M17 7 L13 11 M7 17 L11 13 M17 17 L13 13" opacity=".55"/>',
        sw: 1.6,
    },

    // Rounded corner with notches — border-radius.
    radius: {
        inner:
            '<path d="M5 19 L5 11 C5 7.5, 7.5 5, 11 5 L19 5"/>' +
            '<path d="M3 19 L5 19 M5 19 L5 21" stroke-width="1.2"/>' +
            '<path d="M19 3 L19 5 M19 5 L21 5" stroke-width="1.2"/>',
        sw: 1.6,
    },
    // Rect with offset dashed shadow rect — Iconos.html "shadow".
    shadow: {
        inner: '<rect x="4" y="4" width="13" height="13" rx="1.5"/><path d="M9 19 L20 19 L20 8" stroke-dasharray="2 2" opacity=".55"/>',
        sw: 1.6,
    },
    // Filled half + striped half circle — "opacity" indicator.
    opacity: {
        inner:
            '<circle cx="12" cy="12" r="8"/>' +
            '<path d="M12 4 A8 8 0 0 1 12 20 Z" fill="currentColor" stroke="none"/>' +
            '<path d="M4 8 L20 8 M4 12 L20 12 M4 16 L20 16" stroke-width="0.8" opacity=".4"/>',
        sw: 1.6,
    },
    // Three horizontal lines with increasing thickness — border-width.
    'border-width': {
        inner:
            '<path d="M4 7 L20 7" stroke-width="1"/>' +
            '<path d="M4 12 L20 12" stroke-width="2"/>' +
            '<path d="M4 17 L20 17" stroke-width="3.5" stroke-linecap="round"/>',
        sw: 0,
    },
    // Artboard rect with corner guide dots — "canvas background".
    background: {
        inner:
            '<rect x="5" y="6" width="14" height="10" rx="0.5"/>' +
            '<circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/>' +
            '<circle cx="19" cy="6" r="1.4" fill="currentColor" stroke="none"/>' +
            '<circle cx="5" cy="16" r="1.4" fill="currentColor" stroke="none"/>' +
            '<circle cx="19" cy="16" r="1.4" fill="currentColor" stroke="none"/>',
        sw: 1.6,
    },
};

export interface RenderIconOptions {
    /** Square pixel size. Defaults to 18. */
    size?: number;
}

export function renderIcon(name: IconName, options: RenderIconOptions = {}): string {
    const def = DEFS[name];
    if (!def) return '';
    const size = options.size ?? 18;
    const vb = def.viewBox ?? '0 0 24 24';
    const sw = def.sw ?? 1.6;
    const fill = def.filled ? 'currentColor' : 'none';
    return (
        `<svg viewBox="${vb}" width="${size}" height="${size}" fill="${fill}"` +
        ` stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` +
        ` aria-hidden="true">${def.inner}</svg>`
    );
}
