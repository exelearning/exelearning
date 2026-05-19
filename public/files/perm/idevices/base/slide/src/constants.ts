/**
 * Slide iDevice — shared constants.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export const DATA_VERSION = 3;
export const ENGINE_NAME = 'fabric';

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;
export const DEFAULT_BG = '#ffffff';

export const MIN_W = 400;
export const MAX_W = 1920;
export const MIN_H = 200;
export const MAX_H = 1200;

export const SLIDE_PRESETS: ReadonlyArray<{ key: string; label: string; width: number; height: number }> = [
    { key: '16-9', label: '16:9 (1280×720)', width: 1280, height: 720 },
    { key: '4-3', label: '4:3 (1024×768)', width: 1024, height: 768 },
];

/**
 * Google-Drawings-style colour palette: a header row of greys plus six
 * tonal rows (red, orange, yellow, green, blue, purple). Used by the
 * fill / stroke / text / background popovers in the toolbar.
 */
export const PALETTE: ReadonlyArray<string> = [
    '#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827', '#000000',
    '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#7f1d1d',
    '#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#7c2d12',
    '#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#713f12',
    '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#14532d',
    '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1e3a8a',
    '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#581c87',
];

export const FONTS: ReadonlyArray<string> = [
    'Inter, Arial, sans-serif',
    'Arial, Helvetica, sans-serif',
    'Georgia, Times, serif',
    '"Times New Roman", Times, serif',
    '"Courier New", Courier, monospace',
    '"Comic Sans MS", "Comic Sans", cursive',
];

export const FONT_SIZES: ReadonlyArray<number> = [12, 14, 16, 20, 24, 32, 40, 56, 72, 96];

export const DEFAULT_TEXT_COLOR = '#111827';
export const DEFAULT_FILL = '#3b82f6';
export const DEFAULT_STROKE = '#1f2937';
export const DEFAULT_FONT_FAMILY = FONTS[0];
export const DEFAULT_FONT_SIZE = 32;

export const ROTATION_SNAP_DEGREES = 15;

// SVG path for a heart that fits in a 200x180 bounding box (origin 0,0).
// Standard two-bezier heart definition; rendered via fabric.Path.
export const HEART_PATH =
    'M 100 30 C 70 -10 0 0 0 60 C 0 110 60 140 100 180 C 140 140 200 110 200 60 C 200 0 130 -10 100 30 Z';

// Default arrow size when added.
export const ARROW_DEFAULT = {
    length: 220,
    headSize: 22,
    strokeWidth: 4,
} as const;

/**
 * Default bounding-box sizes for shapes added with a click (drag-to-draw
 * with the click fallback uses these when the mousedown→mouseup distance
 * is below the click threshold).
 */
export const DEFAULT_SHAPE_BBOX = {
    width: 240,
    height: 160,
} as const;

/** Threshold in CSS pixels under which a press counts as a click, not a drag. */
export const DRAW_CLICK_THRESHOLD = 5;

export const HISTORY_LIMIT = 60;
export const HISTORY_DEBOUNCE_MS = 250;
