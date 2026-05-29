/**
 * Slide iDevice — shape descriptors.
 *
 * The canvas adapter takes a `ShapeKind` + bounding-box and turns it into a
 * Fabric object. Keeping the catalog framework-free keeps unit tests light
 * and makes adding new shapes a one-file change.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { ARROW_DEFAULT, DEFAULT_FILL, DEFAULT_STROKE, HEART_PATH } from './constants.js';

/**
 * Catalog of every shape the editor can insert. The picker UI maps these
 * keys to icons + labels; the canvas adapter maps them to Fabric objects.
 */
export type ShapeKind =
    | 'rect'
    | 'rounded-rect'
    | 'circle'
    | 'ellipse'
    | 'triangle'
    | 'diamond'
    | 'pentagon'
    | 'hexagon'
    | 'star'
    | 'parallelogram'
    | 'speech-bubble'
    | 'thought-bubble'
    | 'heart'
    | 'line'
    | 'arrow'
    | 'arrow-left'
    | 'arrow-up'
    | 'arrow-down';

export type ShapeRole = ShapeKind | 'text' | 'image';

/** Minimum side a drag-drawn shape needs before we treat it as intentional. */
export const MIN_BBOX_SIDE = 8;

export interface ShapeBBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface BaseDescriptor {
    role: ShapeRole;
    left: number;
    top: number;
}

export interface RectDescriptor extends BaseDescriptor {
    role: 'rect' | 'rounded-rect';
    width: number;
    height: number;
    fill: string;
    stroke?: string;
    strokeWidth: number;
    rx: number;
    ry: number;
}

export interface CircleDescriptor extends BaseDescriptor {
    role: 'circle';
    radius: number;
    fill: string;
    stroke?: string;
    strokeWidth: number;
}

export interface EllipseDescriptor extends BaseDescriptor {
    role: 'ellipse';
    rx: number;
    ry: number;
    fill: string;
    stroke?: string;
    strokeWidth: number;
}

export interface PathShapeDescriptor extends BaseDescriptor {
    role: 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'parallelogram' | 'heart';
    path: string;
    width: number;
    height: number;
    fill: string;
    stroke?: string;
    strokeWidth: number;
}

export interface BubbleDescriptor extends BaseDescriptor {
    role: 'speech-bubble' | 'thought-bubble';
    path: string;
    width: number;
    height: number;
    fill: string;
    stroke?: string;
    strokeWidth: number;
}

export interface LineDescriptor extends BaseDescriptor {
    role: 'line';
    points: [number, number, number, number];
    stroke: string;
    strokeWidth: number;
}

export interface ArrowDescriptor extends BaseDescriptor {
    role: 'arrow' | 'arrow-left' | 'arrow-up' | 'arrow-down';
    /** Start point in design coords. */
    x1: number;
    y1: number;
    /** End point in design coords. */
    x2: number;
    y2: number;
    stroke: string;
    fill: string;
    strokeWidth: number;
    headSize: number;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function roundedRectPath(w: number, h: number, r: number): string {
    const rr = Math.min(r, w / 2, h / 2);
    return (
        `M ${rr} 0 L ${w - rr} 0 Q ${w} 0 ${w} ${rr} L ${w} ${h - rr} Q ${w} ${h} ${w - rr} ${h} ` +
        `L ${rr} ${h} Q 0 ${h} 0 ${h - rr} L 0 ${rr} Q 0 0 ${rr} 0 Z`
    );
}

function trianglePath(w: number, h: number): string {
    return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
}

function diamondPath(w: number, h: number): string {
    return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
}

function regularPolygonPath(w: number, h: number, sides: number, rotationDeg = -90): string {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const rotation = (rotationDeg * Math.PI) / 180;
    let d = '';
    for (let i = 0; i < sides; i++) {
        const angle = rotation + (i / sides) * Math.PI * 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return `${d}Z`;
}

function starPath(w: number, h: number, points = 5, innerRatio = 0.45): string {
    const cx = w / 2;
    const cy = h / 2;
    const rxOuter = w / 2;
    const ryOuter = h / 2;
    const rxInner = rxOuter * innerRatio;
    const ryInner = ryOuter * innerRatio;
    const rotation = -Math.PI / 2;
    let d = '';
    const verts = points * 2;
    for (let i = 0; i < verts; i++) {
        const isOuter = i % 2 === 0;
        const rx = isOuter ? rxOuter : rxInner;
        const ry = isOuter ? ryOuter : ryInner;
        const angle = rotation + (i / verts) * Math.PI * 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return `${d}Z`;
}

function parallelogramPath(w: number, h: number, slant = 0.18): string {
    const dx = w * slant;
    return `M ${dx} 0 L ${w} 0 L ${w - dx} ${h} L 0 ${h} Z`;
}

function speechBubblePath(w: number, h: number): string {
    const r = Math.min(16, h / 4);
    const tailW = Math.min(40, w * 0.18);
    const tailH = Math.min(28, h * 0.22);
    const tailX = w * 0.2;
    const bodyH = h - tailH;
    return (
        `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${bodyH - r} Q ${w} ${bodyH} ${w - r} ${bodyH} ` +
        `L ${tailX + tailW} ${bodyH} L ${tailX + tailW * 0.4} ${h} L ${tailX} ${bodyH} ` +
        `L ${r} ${bodyH} Q 0 ${bodyH} 0 ${bodyH - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    );
}

function thoughtBubblePath(w: number, h: number): string {
    // Main "cloud" of overlapping circles plus two trailing dots.
    const cx = w / 2;
    const bodyH = h * 0.78;
    const baseR = Math.min(w, bodyH) * 0.18;
    let path = '';
    const lobes = 7;
    for (let i = 0; i < lobes; i++) {
        const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(angle) * (w / 2 - baseR);
        const ly = bodyH / 2 + Math.sin(angle) * (bodyH / 2 - baseR);
        path += `M ${lx - baseR} ${ly} a ${baseR} ${baseR} 0 1 0 ${baseR * 2} 0 a ${baseR} ${baseR} 0 1 0 -${baseR * 2} 0 `;
    }
    // Centre lobe
    path += `M ${cx - baseR} ${bodyH / 2} a ${baseR} ${baseR} 0 1 0 ${baseR * 2} 0 a ${baseR} ${baseR} 0 1 0 -${baseR * 2} 0 `;
    // Trailing thought dots
    const tx = w * 0.2;
    const r1 = baseR * 0.6;
    const r2 = baseR * 0.4;
    path += `M ${tx - r1} ${bodyH + r1} a ${r1} ${r1} 0 1 0 ${r1 * 2} 0 a ${r1} ${r1} 0 1 0 -${r1 * 2} 0 `;
    path += `M ${tx - r2 - 6} ${h - r2} a ${r2} ${r2} 0 1 0 ${r2 * 2} 0 a ${r2} ${r2} 0 1 0 -${r2 * 2} 0 Z`;
    return path;
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

// ── Public factories ─────────────────────────────────────────────────────────

export function rectDescriptor(left = 60, top = 60, width = 240, height = 140): RectDescriptor {
    return {
        role: 'rect',
        left,
        top,
        width,
        height,
        fill: DEFAULT_FILL,
        stroke: undefined,
        strokeWidth: 0,
        rx: 0,
        ry: 0,
    };
}

export function roundedRectDescriptor(left = 60, top = 60, width = 240, height = 140, radius = 24): RectDescriptor {
    const r = clamp(radius, 0, Math.min(width, height) / 2);
    return {
        role: 'rounded-rect',
        left,
        top,
        width,
        height,
        fill: DEFAULT_FILL,
        stroke: undefined,
        strokeWidth: 0,
        rx: r,
        ry: r,
    };
}

export function circleDescriptor(left = 60, top = 60, radius = 80): CircleDescriptor {
    return {
        role: 'circle',
        left,
        top,
        radius,
        fill: '#10b981',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function ellipseDescriptor(left = 60, top = 60, rx = 120, ry = 70): EllipseDescriptor {
    return {
        role: 'ellipse',
        left,
        top,
        rx,
        ry,
        fill: '#10b981',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function triangleDescriptor(left = 60, top = 60, width = 200, height = 180): PathShapeDescriptor {
    return {
        role: 'triangle',
        left,
        top,
        path: trianglePath(width, height),
        width,
        height,
        fill: '#f97316',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function diamondDescriptor(left = 60, top = 60, width = 220, height = 180): PathShapeDescriptor {
    return {
        role: 'diamond',
        left,
        top,
        path: diamondPath(width, height),
        width,
        height,
        fill: '#a855f7',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function pentagonDescriptor(left = 60, top = 60, width = 200, height = 200): PathShapeDescriptor {
    return {
        role: 'pentagon',
        left,
        top,
        path: regularPolygonPath(width, height, 5),
        width,
        height,
        fill: '#0ea5e9',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function hexagonDescriptor(left = 60, top = 60, width = 220, height = 200): PathShapeDescriptor {
    return {
        role: 'hexagon',
        left,
        top,
        path: regularPolygonPath(width, height, 6, 0),
        width,
        height,
        fill: '#22c55e',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function starDescriptor(left = 60, top = 60, width = 220, height = 200): PathShapeDescriptor {
    return {
        role: 'star',
        left,
        top,
        path: starPath(width, height, 5, 0.45),
        width,
        height,
        fill: '#facc15',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function parallelogramDescriptor(left = 60, top = 60, width = 240, height = 140): PathShapeDescriptor {
    return {
        role: 'parallelogram',
        left,
        top,
        path: parallelogramPath(width, height),
        width,
        height,
        fill: '#06b6d4',
        stroke: undefined,
        strokeWidth: 0,
    };
}

export function speechBubbleDescriptor(left = 60, top = 60, width = 240, height = 180): BubbleDescriptor {
    return {
        role: 'speech-bubble',
        left,
        top,
        path: speechBubblePath(width, height),
        width,
        height,
        fill: '#fef3c7',
        stroke: '#a16207',
        strokeWidth: 1,
    };
}

export function thoughtBubbleDescriptor(left = 60, top = 60, width = 260, height = 200): BubbleDescriptor {
    return {
        role: 'thought-bubble',
        left,
        top,
        path: thoughtBubblePath(width, height),
        width,
        height,
        fill: '#dbeafe',
        stroke: '#1d4ed8',
        strokeWidth: 1,
    };
}

export function heartDescriptor(left = 60, top = 60): PathShapeDescriptor {
    return {
        role: 'heart',
        left,
        top,
        path: HEART_PATH,
        width: 200,
        height: 180,
        fill: '#ef4444',
        strokeWidth: 0,
    };
}

export function lineDescriptor(left = 60, top = 60, length = 200): LineDescriptor {
    return {
        role: 'line',
        left,
        top,
        points: [0, 0, length, 0],
        stroke: DEFAULT_STROKE,
        strokeWidth: 4,
    };
}

/**
 * Arrow defined by two endpoints in design coordinates. The canvas adapter
 * uses these to render the shaft + head and to wire endpoint controls.
 */
export function arrowDescriptor(x1 = 60, y1 = 100, x2 = 280, y2 = 100): ArrowDescriptor {
    return {
        role: 'arrow',
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        x1,
        y1,
        x2,
        y2,
        stroke: DEFAULT_STROKE,
        fill: DEFAULT_STROKE,
        strokeWidth: ARROW_DEFAULT.strokeWidth,
        headSize: ARROW_DEFAULT.headSize,
    };
}

// ── Bounding-box-driven factories ────────────────────────────────────────────

export type ShapeDescriptor =
    | RectDescriptor
    | CircleDescriptor
    | EllipseDescriptor
    | PathShapeDescriptor
    | BubbleDescriptor
    | LineDescriptor
    | ArrowDescriptor;

/**
 * Build a descriptor for `kind` sized to fit the supplied bbox. Used by the
 * drag-to-draw flow: the user paints a rectangle on the canvas, we emit a
 * shape that fills it.
 */
export function descriptorFromBBox(kind: ShapeKind, bbox: ShapeBBox): ShapeDescriptor {
    const { left, top, width, height } = bbox;
    const w = Math.max(MIN_BBOX_SIDE, width);
    const h = Math.max(MIN_BBOX_SIDE, height);
    switch (kind) {
        case 'rect':
            return rectDescriptor(left, top, w, h);
        case 'rounded-rect':
            return roundedRectDescriptor(left, top, w, h, Math.min(w, h) * 0.18);
        case 'circle':
            return circleDescriptor(left, top, Math.max(MIN_BBOX_SIDE, Math.min(w, h) / 2));
        case 'ellipse':
            return ellipseDescriptor(left, top, w / 2, h / 2);
        case 'triangle':
            return triangleDescriptor(left, top, w, h);
        case 'diamond':
            return diamondDescriptor(left, top, w, h);
        case 'pentagon':
            return pentagonDescriptor(left, top, w, h);
        case 'hexagon':
            return hexagonDescriptor(left, top, w, h);
        case 'star':
            return starDescriptor(left, top, w, h);
        case 'parallelogram':
            return parallelogramDescriptor(left, top, w, h);
        case 'speech-bubble':
            return speechBubbleDescriptor(left, top, w, h);
        case 'thought-bubble':
            return thoughtBubbleDescriptor(left, top, w, h);
        case 'heart':
            return { ...heartDescriptor(left, top), width: w, height: h, path: HEART_PATH } as PathShapeDescriptor;
        case 'line':
            return lineDescriptor(left, top, w);
        case 'arrow':
            return arrowDescriptor(left, top + h / 2, left + w, top + h / 2);
        case 'arrow-left':
            return { ...arrowDescriptor(left + w, top + h / 2, left, top + h / 2), role: 'arrow-left' };
        case 'arrow-up':
            return { ...arrowDescriptor(left + w / 2, top + h, left + w / 2, top), role: 'arrow-up' };
        case 'arrow-down':
            return { ...arrowDescriptor(left + w / 2, top, left + w / 2, top + h), role: 'arrow-down' };
        default: {
            const _exhaustive: never = kind;
            void _exhaustive;
            return rectDescriptor(left, top, w, h);
        }
    }
}
