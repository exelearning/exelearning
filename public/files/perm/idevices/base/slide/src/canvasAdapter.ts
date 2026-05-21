/**
 * Slide iDevice — Fabric canvas adapter.
 *
 * The only module that touches Fabric.js. It accepts pure shape
 * descriptors from `shapes.ts` and turns them into Fabric objects, exposes
 * a small imperative API (add/select/transform/serialize), and emits
 * lifecycle events (`changed`, `selection`) as plain functions so the
 * editor and toolbar don't need to know about Fabric internals.
 *
 * Drag-to-draw: `enterDrawMode(kind)` arms the canvas; the next press +
 * drag emits a shape sized to the bounding box. A short press (under
 * `DRAW_CLICK_THRESHOLD` px) inserts the shape at a default size.
 *
 * Arrows ship as a custom subclass of `fabric.Object` with two extra
 * controls anchored at the start/end points so users can re-aim them
 * after drawing.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import * as fabric from 'fabric';
import {
    DEFAULT_FILL,
    DEFAULT_FONT_FAMILY,
    DEFAULT_FONT_SIZE,
    DEFAULT_SHAPE_BBOX,
    DEFAULT_STROKE,
    DEFAULT_TEXT_COLOR,
    ROTATION_SNAP_DEGREES,
} from './constants.js';
import { sanitizeSvg } from './sanitizer.js';
import {
    descriptorFromBBox,
    type ArrowDescriptor,
    type BubbleDescriptor,
    type CircleDescriptor,
    type EllipseDescriptor,
    type LineDescriptor,
    type PathShapeDescriptor,
    type RectDescriptor,
    type ShapeBBox,
    type ShapeDescriptor,
    type ShapeKind,
} from './shapes.js';
import type { AnyObj } from './serializer.js';

type DomPurifyLike = { sanitize: (input: string, opts?: Record<string, unknown>) => string };

export type SelectionKind = 'none' | 'text' | 'shape' | 'image' | 'group' | 'multi' | 'arrow';

export interface SelectionInfo {
    kind: SelectionKind;
    /** Specific shape role from `slideMeta.role` (e.g. 'rect', 'circle', 'arrow'). */
    shapeRole: string | null;
    fill: string | null;
    stroke: string | null;
    strokeWidth: number | null;
    fontFamily: string | null;
    fontSize: number | null;
    textColor: string | null;
    opacity: number;
    bold: boolean;
    italic: boolean;
    align: string | null;
    isEditing: boolean;
    /** Corner radius (rx) on rectangles, 0 otherwise. */
    cornerRadius: number;
    /** Shadow intensity in [0..1], 0 if no shadow. */
    shadowIntensity: number;
}

export interface CanvasAdapterOptions {
    canvasEl: HTMLCanvasElement;
    width: number;
    height: number;
    background: string;
    purifier?: DomPurifyLike;
    onChange?: (immediate: boolean) => void;
    onSelection?: (info: SelectionInfo) => void;
    /**
     * Resolve an `asset://` URL to a renderable URL (blob: in-session,
     * the original URL otherwise). Used when re-loading a saved scene so
     * Fabric can actually display the images.
     */
    resolveAssetUrl?: (assetUrl: string) => Promise<string>;
}

interface ShapeMeta {
    role?: string;
    [k: string]: unknown;
}

const META_KEY = 'slideMeta';

const NO_SELECTION: SelectionInfo = {
    kind: 'none',
    shapeRole: null,
    fill: null,
    stroke: null,
    strokeWidth: null,
    fontFamily: null,
    fontSize: null,
    textColor: null,
    opacity: 1,
    bold: false,
    italic: false,
    align: null,
    isEditing: false,
    cornerRadius: 0,
    shadowIntensity: 0,
};

function getMeta(obj: fabric.Object | undefined | null): ShapeMeta {
    const raw = obj && (obj as unknown as AnyObj)[META_KEY];
    return (raw && typeof raw === 'object' ? (raw as ShapeMeta) : {}) as ShapeMeta;
}

function setMeta(obj: fabric.Object, meta: ShapeMeta): void {
    (obj as unknown as AnyObj)[META_KEY] = meta;
}

// ── Custom arrow class ───────────────────────────────────────────────────────

interface ArrowProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    headSize: number;
}

/**
 * A two-endpoint arrow drawn from `(x1,y1)` to `(x2,y2)` in design
 * coordinates. Stores the endpoints directly so that the start/end
 * controls can reposition them without going through bounding-box scaling.
 */
class ArrowShape extends fabric.Object implements ArrowProps {
    static type = 'slide-arrow';

    x1 = 0;
    y1 = 0;
    x2 = 100;
    y2 = 0;
    headSize = 22;

    /** Last known translation, used to keep endpoints in sync with drags. */
    private _lastLeft = 0;
    private _lastTop = 0;

    constructor(options: Partial<fabric.Object & ArrowProps> = {}) {
        super(options);
        if (typeof options.x1 === 'number') this.x1 = options.x1;
        if (typeof options.y1 === 'number') this.y1 = options.y1;
        if (typeof options.x2 === 'number') this.x2 = options.x2;
        if (typeof options.y2 === 'number') this.y2 = options.y2;
        if (typeof options.headSize === 'number') this.headSize = options.headSize;
        // Arrows are defined by their endpoints, so scale/rotate handles
        // would be misleading. Expose only the move + endpoint controls.
        this.lockScalingX = true;
        this.lockScalingY = true;
        this.lockRotation = true;
        this.hasControls = true;
        this.controls = buildArrowControls();
        this._recomputeBounds();

        // Keep design-coord endpoints aligned with whatever translation
        // Fabric applies during a drag — without this the bbox visually
        // moves but the arrow + control dots stay anchored in design space.
        this.on('moving', () => this._syncEndpointsToTranslation());
        this.on('modified', () => this._syncEndpointsToTranslation());
    }

    private _syncEndpointsToTranslation(): void {
        const left = this.left ?? 0;
        const top = this.top ?? 0;
        const dx = left - this._lastLeft;
        const dy = top - this._lastTop;
        if (dx === 0 && dy === 0) return;
        this.x1 += dx;
        this.y1 += dy;
        this.x2 += dx;
        this.y2 += dy;
        this._lastLeft = left;
        this._lastTop = top;
        this.dirty = true;
        this.setCoords();
    }

    /**
     * Update the arrow's bounding box from its endpoints. Fabric needs
     * `width`, `height`, `left`, `top` on the object to size selection
     * handles and hit-testing — they live on the parent class.
     */
    private _recomputeBounds(): void {
        const minX = Math.min(this.x1, this.x2);
        const maxX = Math.max(this.x1, this.x2);
        const minY = Math.min(this.y1, this.y2);
        const maxY = Math.max(this.y1, this.y2);
        const pad = this.headSize + 4;
        this.set({
            left: minX - pad,
            top: minY - pad,
            width: maxX - minX + pad * 2,
            height: maxY - minY + pad * 2,
        });
        this._lastLeft = this.left ?? 0;
        this._lastTop = this.top ?? 0;
        this.setCoords();
    }

    /**
     * Re-aim the arrow. Call after editing one of the endpoint properties.
     */
    refresh(): void {
        this._recomputeBounds();
        this.dirty = true;
        this.canvas?.requestRenderAll();
    }

    _render(ctx: CanvasRenderingContext2D): void {
        const lx = this.x1 - (this.left ?? 0) - (this.width ?? 0) / 2;
        const ly = this.y1 - (this.top ?? 0) - (this.height ?? 0) / 2;
        const ex = this.x2 - (this.left ?? 0) - (this.width ?? 0) / 2;
        const ey = this.y2 - (this.top ?? 0) - (this.height ?? 0) / 2;

        const dx = ex - lx;
        const dy = ey - ly;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        const ux = dx / len;
        const uy = dy / len;
        const head = this.headSize;
        // Trim the shaft so it doesn't poke through the head triangle.
        const sx = ex - ux * head * 0.85;
        const sy = ey - uy * head * 0.85;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = (this.stroke as string) ?? '#1f2937';
        ctx.fillStyle = (this.fill as string) ?? (this.stroke as string) ?? '#1f2937';
        ctx.lineWidth = this.strokeWidth ?? 4;

        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Head triangle
        const px = -uy;
        const py = ux;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - ux * head + px * head * 0.6, ey - uy * head + py * head * 0.6);
        ctx.lineTo(ex - ux * head - px * head * 0.6, ey - uy * head - py * head * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    toObject(propertiesToInclude: string[] = []): AnyObj {
        return super.toObject([...propertiesToInclude, 'x1', 'y1', 'x2', 'y2', 'headSize', META_KEY]) as AnyObj;
    }

    /**
     * Emit the arrow as SVG so it survives `canvas.toSVG()` (the path
     * used by the saved snapshot). Fabric wraps the returned fragments
     * in a `<g transform="…">` placed at the object's centre, so we
     * write the geometry in object-local coords just like `_render`.
     *
     * Without this override Fabric falls back to an empty `<g>` for
     * custom objects, and arrows vanish from the static preview /
     * exported HTML even though they're still in the Fabric JSON.
     */
    _toSVG(): string[] {
        const left = this.left ?? 0;
        const top = this.top ?? 0;
        const halfW = (this.width ?? 0) / 2;
        const halfH = (this.height ?? 0) / 2;
        const lx = this.x1 - left - halfW;
        const ly = this.y1 - top - halfH;
        const ex = this.x2 - left - halfW;
        const ey = this.y2 - top - halfH;

        const dx = ex - lx;
        const dy = ey - ly;
        const len = Math.hypot(dx, dy);
        if (len < 1) return [];

        const ux = dx / len;
        const uy = dy / len;
        const head = this.headSize;
        const sx = ex - ux * head * 0.85;
        const sy = ey - uy * head * 0.85;
        const px = -uy;
        const py = ux;

        const stroke = (this.stroke as string) || '#1f2937';
        const fill = (this.fill as string) || stroke;
        const sw = this.strokeWidth ?? 4;

        const ax = ex - ux * head + px * head * 0.6;
        const ay = ey - uy * head + py * head * 0.6;
        const bx = ex - ux * head - px * head * 0.6;
        const by = ey - uy * head - py * head * 0.6;

        const shaft =
            `<line x1="${lx}" y1="${ly}" x2="${sx}" y2="${sy}"` +
            ` stroke="${stroke}" stroke-width="${sw}"` +
            ` stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
        const headTri =
            `<polygon points="${ex},${ey} ${ax},${ay} ${bx},${by}"` +
            ` fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
        return [shaft, headTri];
    }
}

(fabric.classRegistry as unknown as { setClass: (c: unknown) => void }).setClass(ArrowShape);

function buildArrowControls(): Record<string, fabric.Control> {
    function endpointPositionHandler(which: 'start' | 'end') {
        return (
            _dim: fabric.Point,
            _finalMatrix: fabric.TMat2D,
            fabricObject: fabric.Object,
        ): fabric.Point => {
            const arrow = fabricObject as ArrowShape;
            const px = which === 'start' ? arrow.x1 : arrow.x2;
            const py = which === 'start' ? arrow.y1 : arrow.y2;
            // Endpoints are stored in design (scene) coordinates and the
            // editor keeps the canvas viewportTransform at identity, so
            // the design coord IS the world-space position Fabric expects
            // for control rendering.
            return new fabric.Point(px, py);
        };
    }

    function endpointActionHandler(which: 'start' | 'end') {
        return (
            _eventData: TPointerEvent,
            transform: fabric.Transform,
            x: number,
            y: number,
        ): boolean => {
            const arrow = transform.target as ArrowShape;
            // (x, y) is the pointer in world coords (already viewport-adjusted
            // by Fabric's control machinery). With identity viewport, this
            // equals the design coordinate of the dragged endpoint.
            if (which === 'start') {
                arrow.x1 = x;
                arrow.y1 = y;
            } else {
                arrow.x2 = x;
                arrow.y2 = y;
            }
            arrow.refresh();
            return true;
        };
    }

    function endpointRender(which: 'start' | 'end') {
        const colour = which === 'start' ? '#22c55e' : '#ef4444';
        return (
            ctx: CanvasRenderingContext2D,
            left: number,
            top: number,
            _styleOverride: unknown,
            _fabricObject: fabric.Object,
        ): void => {
            const r = 7;
            ctx.save();
            ctx.fillStyle = colour;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(left, top, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        };
    }

    return {
        start: new fabric.Control({
            x: 0,
            y: 0,
            actionName: 'modifyArrow',
            cursorStyle: 'crosshair',
            positionHandler: endpointPositionHandler('start'),
            actionHandler: endpointActionHandler('start'),
            render: endpointRender('start'),
        }),
        end: new fabric.Control({
            x: 0,
            y: 0,
            actionName: 'modifyArrow',
            cursorStyle: 'crosshair',
            positionHandler: endpointPositionHandler('end'),
            actionHandler: endpointActionHandler('end'),
            render: endpointRender('end'),
        }),
    };
}

// Type alias matches Fabric's exported event payload for pointer events.
type TPointerEvent = MouseEvent | TouchEvent | PointerEvent;

// ── Adapter ─────────────────────────────────────────────────────────────────

export class SlideCanvasAdapter {
    canvas!: fabric.Canvas;
    private opts: CanvasAdapterOptions;
    private cleanupFns: Array<() => void> = [];
    /** Counter that staggers default object placement so they don't pile up. */
    private placementCounter = 0;
    /**
     * Active crop session: the target image plus the transient overlay rect
     * the user drags to define the new crop region. Null when not cropping.
     */
    private cropContext: {
        image: fabric.FabricImage;
        rect: fabric.Rect;
        prev: {
            selectable: boolean;
            evented: boolean;
            lockMovementX: boolean;
            lockMovementY: boolean;
            lockScalingX: boolean;
            lockScalingY: boolean;
        };
    } | null = null;

    constructor(opts: CanvasAdapterOptions) {
        this.opts = opts;
        this.init();
    }

    /**
     * Returns a staggered (left, top) tuple for the next inserted object.
     * Each insertion shifts +28 px in both axes, wrapping inside the slide
     * after a few rows to avoid drifting off-canvas.
     */
    private nextPlacement(): { left: number; top: number } {
        const designW = this.opts.width;
        const designH = this.opts.height;
        const step = 28;
        const margin = 60;
        const wrap = 8;
        const i = this.placementCounter++ % wrap;
        const left = Math.min(margin + i * step, Math.max(margin, designW - 240));
        const top = Math.min(margin + i * step, Math.max(margin, designH - 200));
        return { left, top };
    }

    private init(): void {
        // Empty backgroundColor leaves the canvas buffer transparent so the
        // CSS-painted Fondo + dotted grid show through during editing. The
        // editor injects a bg <rect> into the SVG export so saved slides
        // still carry the chosen background.
        const canvas = new fabric.Canvas(this.opts.canvasEl, {
            backgroundColor: '',
            preserveObjectStacking: true,
            selection: true,
        });
        this.canvas = canvas;
        // Expose the active canvas globally so Playwright specs can probe
        // the Fabric scene without depending on Fabric's internal DOM-back
        // references (which differ across versions).
        if (typeof globalThis !== 'undefined') {
            (globalThis as unknown as { __slideEditorCanvas?: fabric.Canvas }).__slideEditorCanvas = canvas;
        }

        canvas.on('object:rotating', evt => {
            const target = evt.target as fabric.Object | undefined;
            if (!target) return;
            const e = (evt as unknown as { e?: { shiftKey?: boolean } }).e;
            if (e && e.shiftKey) {
                const angle = target.angle ?? 0;
                target.set({ angle: Math.round(angle / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES });
            }
        });

        const fireChange = (immediate: boolean) => this.opts.onChange?.(immediate);
        const fireSelection = () => this.opts.onSelection?.(this.getSelectionInfo());

        canvas.on('object:added', () => fireChange(true));
        canvas.on('object:removed', () => fireChange(true));
        canvas.on('object:modified', evt => {
            // Bake any user-applied scale on text objects into fontSize so
            // the toolbar dropdown reflects the visible size. Without this
            // dragging the corner of an IText/Textbox would change scaleX/Y
            // and leave fontSize stale (selector still showed the old size).
            this.normalizeTextScale(evt?.target as fabric.Object | undefined);
            fireChange(true);
        });
        canvas.on('object:moving', () => fireChange(false));
        canvas.on('object:scaling', () => fireChange(false));
        canvas.on('object:rotating', () => fireChange(false));
        canvas.on('text:changed', () => fireChange(false));
        canvas.on('text:editing:exited', () => fireChange(true));
        canvas.on('selection:created', fireSelection);
        canvas.on('selection:updated', fireSelection);
        canvas.on('selection:cleared', fireSelection);
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    setBackground(color: string): void {
        this.canvas.set({ backgroundColor: color });
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
    }

    setBufferDimensions(width: number, height: number): void {
        this.canvas.setDimensions({ width, height });
        this.canvas.requestRenderAll();
    }

    setCssDimensions(width: number, height: number): void {
        const wPx = `${width}px`;
        const hPx = `${height}px`;
        const c = this.canvas as unknown as {
            wrapperEl?: HTMLElement;
            lowerCanvasEl?: HTMLCanvasElement;
            upperCanvasEl?: HTMLCanvasElement;
            calcOffset?: () => void;
        };
        if (c.wrapperEl) {
            c.wrapperEl.style.width = wPx;
            c.wrapperEl.style.height = hPx;
        }
        if (c.lowerCanvasEl) {
            c.lowerCanvasEl.style.width = wPx;
            c.lowerCanvasEl.style.height = hPx;
        }
        if (c.upperCanvasEl) {
            c.upperCanvasEl.style.width = wPx;
            c.upperCanvasEl.style.height = hPx;
        }
        c.calcOffset?.();
        this.canvas.requestRenderAll();
    }

    requestRender(): void {
        this.canvas.requestRenderAll();
    }

    discardSelection(): void {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
    }

    destroy(): void {
        this.cleanupFns.forEach(fn => {
            try {
                fn();
            } catch {
                /* ignore */
            }
        });
        this.cleanupFns = [];
        try {
            this.canvas.dispose();
        } catch {
            /* ignore */
        }
    }

    // ── Shape factory ──────────────────────────────────────────────────────

    /**
     * Public entry point: insert any shape from the catalog. When `bbox`
     * is omitted a staggered default position + size is used (suitable for
     * keyboard / programmatic insertion).
     */
    addShape(kind: ShapeKind, bbox?: ShapeBBox): fabric.Object {
        const placement = bbox ?? this.defaultBBoxFor(kind);
        const descriptor = descriptorFromBBox(kind, placement);
        const obj = this.buildShape(descriptor);
        return this.addAndSelect(obj);
    }

    private defaultBBoxFor(kind: ShapeKind): ShapeBBox {
        const p = this.nextPlacement();
        if (kind === 'line' || kind === 'arrow' || kind === 'arrow-left') {
            return { left: p.left, top: p.top, width: 240, height: 0 };
        }
        if (kind === 'arrow-up' || kind === 'arrow-down') {
            return { left: p.left, top: p.top, width: 0, height: 200 };
        }
        return { left: p.left, top: p.top, width: DEFAULT_SHAPE_BBOX.width, height: DEFAULT_SHAPE_BBOX.height };
    }

    private buildShape(d: ShapeDescriptor): fabric.Object {
        switch (d.role) {
            case 'rect':
            case 'rounded-rect':
                return this.buildRect(d);
            case 'circle':
                return this.buildCircle(d);
            case 'ellipse':
                return this.buildEllipse(d);
            case 'triangle':
            case 'diamond':
            case 'pentagon':
            case 'hexagon':
            case 'star':
            case 'parallelogram':
            case 'heart':
                return this.buildPath(d);
            case 'speech-bubble':
            case 'thought-bubble':
                return this.buildPath(d);
            case 'line':
                return this.buildLine(d);
            case 'arrow':
            case 'arrow-left':
            case 'arrow-up':
            case 'arrow-down':
                return this.buildArrow(d);
            default: {
                const _e: never = d;
                void _e;
                throw new Error('unknown shape descriptor');
            }
        }
    }

    private buildRect(d: RectDescriptor): fabric.Object {
        const obj = new fabric.Rect({
            left: d.left,
            top: d.top,
            width: d.width,
            height: d.height,
            fill: d.fill,
            stroke: d.stroke,
            strokeWidth: d.strokeWidth,
            rx: d.rx,
            ry: d.ry,
        });
        setMeta(obj, { role: d.role });
        return obj;
    }

    private buildCircle(d: CircleDescriptor): fabric.Object {
        const obj = new fabric.Circle({
            left: d.left,
            top: d.top,
            radius: d.radius,
            fill: d.fill,
            stroke: d.stroke,
            strokeWidth: d.strokeWidth,
        });
        setMeta(obj, { role: d.role });
        return obj;
    }

    private buildEllipse(d: EllipseDescriptor): fabric.Object {
        const obj = new fabric.Ellipse({
            left: d.left,
            top: d.top,
            rx: d.rx,
            ry: d.ry,
            fill: d.fill,
            stroke: d.stroke,
            strokeWidth: d.strokeWidth,
        });
        setMeta(obj, { role: d.role });
        return obj;
    }

    private buildPath(d: PathShapeDescriptor | BubbleDescriptor): fabric.Object {
        const obj = new fabric.Path(d.path, {
            left: d.left,
            top: d.top,
            fill: d.fill,
            stroke: d.stroke,
            strokeWidth: d.strokeWidth,
        });
        setMeta(obj, { role: d.role });
        return obj;
    }

    private buildLine(d: LineDescriptor): fabric.Object {
        const [x1, y1, x2, y2] = d.points;
        const obj = new fabric.Line([d.left + x1, d.top + y1, d.left + x2, d.top + y2], {
            stroke: d.stroke,
            strokeWidth: d.strokeWidth,
        });
        setMeta(obj, { role: d.role });
        return obj;
    }

    private buildArrow(d: ArrowDescriptor): fabric.Object {
        const arrow = new ArrowShape({
            x1: d.x1,
            y1: d.y1,
            x2: d.x2,
            y2: d.y2,
            headSize: d.headSize,
            stroke: d.stroke,
            fill: d.fill,
            strokeWidth: d.strokeWidth,
        });
        setMeta(arrow, { role: d.role });
        return arrow;
    }

    // ── Convenience wrappers for backward compatibility ───────────────────

    addTextBox(text = 'Text'): fabric.Object {
        const p = this.nextPlacement();
        const obj = new fabric.IText(text, {
            left: p.left,
            top: p.top,
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: DEFAULT_FONT_SIZE,
            fill: DEFAULT_TEXT_COLOR,
            editable: true,
        });
        setMeta(obj, { role: 'text' });
        return this.addAndSelect(obj);
    }

    addRectangle(): fabric.Object {
        return this.addShape('rect');
    }

    addCircle(): fabric.Object {
        return this.addShape('circle');
    }

    addLine(): fabric.Object {
        return this.addShape('line');
    }

    addArrow(): fabric.Object {
        return this.addShape('arrow');
    }

    addHeart(): fabric.Object {
        return this.addShape('heart');
    }

    async addImageFromUrl(displayUrl: string, assetUrl: string, name = 'image'): Promise<fabric.Object | null> {
        if (!displayUrl) return null;
        try {
            // Load via the blob/display URL so Fabric can render the image
            // immediately. The canonical reference (`asset://...`) is kept as
            // a custom property; `serialize` and `exportSvg` substitute it
            // back into the saved scene so JSON + SVG stay lightweight.
            const img = await fabric.FabricImage.fromURL(displayUrl, { crossOrigin: 'anonymous' });
            const designW = this.canvas.getWidth() / (this.canvas.getZoom() || 1);
            const maxW = Math.max(120, designW * 0.5);
            const w = Number(img.width) || maxW;
            const scale = w > maxW ? maxW / w : 1;
            const p = this.nextPlacement();
            img.set({ left: p.left, top: p.top, scaleX: scale, scaleY: scale });
            (img as unknown as AnyObj).slideAssetUrl = assetUrl || displayUrl;
            (img as unknown as AnyObj).slideAssetName = name;
            setMeta(img, { role: 'image', assetUrl, name });
            this.addAndSelect(img);
            return img;
        } catch {
            return null;
        }
    }

    private addAndSelect<T extends fabric.Object>(obj: T): T {
        this.canvas.add(obj);
        this.canvas.setActiveObject(obj);
        this.canvas.requestRenderAll();
        return obj;
    }

    // ── Style operations ───────────────────────────────────────────────────

    setFill(color: string | null): void {
        this.applyToSelection(o => {
            const role = getMeta(o).role;
            const value = color ?? '';
            if (role === 'line' || role === 'arrow' || role === 'arrow-left' || role === 'arrow-up' || role === 'arrow-down') {
                // Arrows treat fill + stroke together: keep them in sync.
                o.set({ fill: value, stroke: value || '#000000' });
                return;
            }
            o.set({ fill: value });
        });
    }

    setStroke(color: string | null): void {
        this.applyToSelection(o => {
            if (color === null) {
                o.set({ stroke: '', strokeWidth: 0 });
                return;
            }
            const sw = Number((o as unknown as AnyObj).strokeWidth) || 0;
            if (sw === 0 && getMeta(o).role !== 'line') {
                o.set({ stroke: color, strokeWidth: 2 });
            } else {
                o.set({ stroke: color });
            }
        });
    }

    setStrokeWidth(width: number): void {
        const w = Math.max(0, Math.min(40, Math.round(width)));
        this.applyToSelection(o => o.set({ strokeWidth: w }));
    }

    /**
     * Set the corner radius on the active rectangle(s). Only meaningful for
     * fabric.Rect — other shapes ignore the property.
     */
    setCornerRadius(radius: number): void {
        const r = Math.max(0, Math.min(200, Math.round(radius)));
        this.applyToSelection(o => {
            if (o instanceof fabric.Rect) {
                o.set({ rx: r, ry: r });
            }
        });
    }

    /**
     * Apply (or clear) a Fabric drop shadow on the active object(s). The
     * caller passes a normalized intensity in [0..1]; the adapter maps it
     * into a sensible blur + offset combination so the slider is the only
     * control the user needs.
     */
    setShadowIntensity(intensity: number): void {
        const v = Math.max(0, Math.min(1, intensity));
        this.applyToSelection(o => {
            if (v <= 0.01) {
                o.set({ shadow: null });
                return;
            }
            const blur = 6 + Math.round(22 * v);
            const offset = 2 + Math.round(8 * v);
            const alpha = 0.18 + 0.32 * v;
            const shadow = new fabric.Shadow({
                color: `rgba(15, 23, 42, ${alpha.toFixed(2)})`,
                blur,
                offsetX: offset,
                offsetY: offset,
            });
            o.set({ shadow });
        });
    }

    setOpacity(opacity: number): void {
        const v = Math.max(0, Math.min(1, opacity));
        this.applyToSelection(o => o.set({ opacity: v }));
    }

    setFontFamily(font: string): void {
        this.applyToSelection(o => {
            if (this.isTextLike(o)) (o as unknown as AnyObj).set?.({ fontFamily: font });
        });
    }

    setFontSize(size: number): void {
        const s = Math.max(6, Math.min(240, Math.round(size)));
        this.applyToSelection(o => {
            if (this.isTextLike(o)) (o as unknown as AnyObj).set?.({ fontSize: s });
        });
    }

    setTextColor(color: string): void {
        this.applyToSelection(o => {
            if (this.isTextLike(o)) (o as unknown as AnyObj).set?.({ fill: color });
        });
    }

    toggleBold(): void {
        this.applyToSelection(o => {
            if (!this.isTextLike(o)) return;
            const cur = String((o as unknown as AnyObj).fontWeight ?? 'normal');
            (o as unknown as AnyObj).set?.({ fontWeight: cur === 'bold' ? 'normal' : 'bold' });
        });
    }

    toggleItalic(): void {
        this.applyToSelection(o => {
            if (!this.isTextLike(o)) return;
            const cur = String((o as unknown as AnyObj).fontStyle ?? 'normal');
            (o as unknown as AnyObj).set?.({ fontStyle: cur === 'italic' ? 'normal' : 'italic' });
        });
    }

    toggleUnderline(): void {
        this.applyToSelection(o => {
            if (!this.isTextLike(o)) return;
            const cur = Boolean((o as unknown as AnyObj).underline);
            (o as unknown as AnyObj).set?.({ underline: !cur });
        });
    }

    setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
        this.applyToSelection(o => {
            if (this.isTextLike(o)) (o as unknown as AnyObj).set?.({ textAlign: align });
        });
    }

    // ── Z-order ────────────────────────────────────────────────────────────

    bringForward(): void {
        const target = this.canvas.getActiveObject();
        if (!target) return;
        this.canvas.bringObjectForward(target);
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
    }

    sendBackward(): void {
        const target = this.canvas.getActiveObject();
        if (!target) return;
        this.canvas.sendObjectBackwards(target);
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
    }

    bringToFront(): void {
        const target = this.canvas.getActiveObject();
        if (!target) return;
        this.canvas.bringObjectToFront(target);
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
    }

    sendToBack(): void {
        const target = this.canvas.getActiveObject();
        if (!target) return;
        this.canvas.sendObjectToBack(target);
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
    }

    // ── Transforms (flip / crop / reset) ──────────────────────────────────

    /** Toggle `flipX` on the selected object(s). Works for any object. */
    flipSelectionHorizontal(): boolean {
        const objs = this.canvas.getActiveObjects();
        if (!objs.length) return false;
        objs.forEach(o => {
            o.set({ flipX: !o.flipX });
            o.setCoords();
        });
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        this.opts.onSelection?.(this.getSelectionInfo());
        return true;
    }

    /** Toggle `flipY` on the selected object(s). */
    flipSelectionVertical(): boolean {
        const objs = this.canvas.getActiveObjects();
        if (!objs.length) return false;
        objs.forEach(o => {
            o.set({ flipY: !o.flipY });
            o.setCoords();
        });
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        this.opts.onSelection?.(this.getSelectionInfo());
        return true;
    }

    isCropping(): boolean {
        return this.cropContext !== null;
    }

    /**
     * Enter crop mode for the selected image. Displays a draggable overlay
     * rectangle inside the image's bounds; the user resizes it and confirms
     * with {@link applyCrop} (or aborts with {@link cancelCrop}). The
     * overlay is excluded from serialization so it never leaks into save
     * payloads even if the workflow is interrupted.
     */
    enterCropMode(): boolean {
        if (this.cropContext) return true;
        const active = this.canvas.getActiveObject();
        if (!active || !(active instanceof fabric.FabricImage)) return false;
        const image = active;

        const prev = {
            selectable: image.selectable ?? true,
            evented: image.evented ?? true,
            lockMovementX: image.lockMovementX ?? false,
            lockMovementY: image.lockMovementY ?? false,
            lockScalingX: image.lockScalingX ?? false,
            lockScalingY: image.lockScalingY ?? false,
        };
        image.set({
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
        });

        // Inset the overlay 10% inside the displayed image bounds.
        const bounds = image.getBoundingRect();
        const inset = Math.min(bounds.width, bounds.height) * 0.1;
        const rect = new fabric.Rect({
            left: bounds.left + inset,
            top: bounds.top + inset,
            width: bounds.width - 2 * inset,
            height: bounds.height - 2 * inset,
            fill: 'rgba(26, 115, 232, 0.12)',
            stroke: '#1a73e8',
            strokeWidth: 1.5,
            strokeDashArray: [6, 4],
            strokeUniform: true,
            lockRotation: true,
            cornerColor: '#1a73e8',
            cornerStrokeColor: '#ffffff',
            transparentCorners: false,
            cornerSize: 10,
            hasRotatingPoint: false,
        } as unknown as fabric.RectProps);
        // Excluded from save: never serialized, never exported.
        (rect as unknown as AnyObj).excludeFromExport = true;
        setMeta(rect, { role: 'crop-overlay', transient: true });
        this.canvas.add(rect);
        this.canvas.setActiveObject(rect);
        this.canvas.requestRenderAll();
        this.cropContext = { image, rect, prev };
        return true;
    }

    /**
     * Apply the current crop overlay to the underlying image. Computes new
     * `cropX/cropY/width/height` in source-pixel space so the image displays
     * only the selected region. Assumes near-zero rotation; rotation is
     * preserved but cropping math treats axes as canvas-aligned.
     */
    applyCrop(): boolean {
        if (!this.cropContext) return false;
        const { image, rect, prev } = this.cropContext;

        const rectLeft = rect.left ?? 0;
        const rectTop = rect.top ?? 0;
        const rectW = (rect.width ?? 0) * (rect.scaleX ?? 1);
        const rectH = (rect.height ?? 0) * (rect.scaleY ?? 1);

        const imgLeft = image.left ?? 0;
        const imgTop = image.top ?? 0;
        const scaleX = image.scaleX ?? 1;
        const scaleY = image.scaleY ?? 1;
        const cropX0 = image.cropX ?? 0;
        const cropY0 = image.cropY ?? 0;

        const newCropX = Math.max(0, cropX0 + (rectLeft - imgLeft) / scaleX);
        const newCropY = Math.max(0, cropY0 + (rectTop - imgTop) / scaleY);
        const newWidth = Math.max(1, rectW / scaleX);
        const newHeight = Math.max(1, rectH / scaleY);

        image.set({
            cropX: newCropX,
            cropY: newCropY,
            width: newWidth,
            height: newHeight,
            left: rectLeft,
            top: rectTop,
        });
        image.setCoords();

        this.canvas.remove(rect);
        image.set(prev);
        this.canvas.setActiveObject(image);
        this.cropContext = null;
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        this.opts.onSelection?.(this.getSelectionInfo());
        return true;
    }

    /** Abort crop mode: discard the overlay, restore the image's flags. */
    cancelCrop(): boolean {
        if (!this.cropContext) return false;
        const { image, rect, prev } = this.cropContext;
        this.canvas.remove(rect);
        image.set(prev);
        this.canvas.setActiveObject(image);
        this.cropContext = null;
        this.canvas.requestRenderAll();
        this.opts.onSelection?.(this.getSelectionInfo());
        return true;
    }

    /**
     * Restore the active image to its uncropped source bounds: `cropX/Y` go
     * to 0 and `width/height` go back to the underlying element's natural
     * dimensions. The image's anchor (`left`, `top`) is kept so the result
     * grows from the same corner.
     */
    resetImageCrop(): boolean {
        const active = this.canvas.getActiveObject();
        if (!active || !(active instanceof fabric.FabricImage)) return false;
        const el = (active as unknown as { _element?: { naturalWidth?: number; naturalHeight?: number } })._element;
        const nat = {
            w: Number(el?.naturalWidth ?? active.width ?? 0),
            h: Number(el?.naturalHeight ?? active.height ?? 0),
        };
        if (!nat.w || !nat.h) return false;
        active.set({ cropX: 0, cropY: 0, width: nat.w, height: nat.h });
        active.setCoords();
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        this.opts.onSelection?.(this.getSelectionInfo());
        return true;
    }

    // ── Object lifecycle ───────────────────────────────────────────────────

    deleteSelection(): boolean {
        const objs = this.canvas.getActiveObjects();
        if (!objs.length) return false;
        objs.forEach(o => this.canvas.remove(o));
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        return true;
    }

    async duplicateSelection(): Promise<boolean> {
        const target = this.canvas.getActiveObject();
        if (!target) return false;
        const cloned = await target.clone();
        cloned.set({ left: (cloned.left ?? 0) + 24, top: (cloned.top ?? 0) + 24 });
        if (cloned instanceof fabric.ActiveSelection) {
            cloned.canvas = this.canvas;
            cloned.forEachObject(o => this.canvas.add(o));
            cloned.setCoords();
        } else {
            this.canvas.add(cloned);
        }
        this.canvas.discardActiveObject();
        this.canvas.setActiveObject(cloned);
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        return true;
    }

    // ── Serialization ──────────────────────────────────────────────────────

    serialize(): AnyObj {
        const json = this.canvas.toJSON([
            META_KEY,
            'slideAssetUrl',
            'slideAssetName',
            'x1',
            'y1',
            'x2',
            'y2',
            'headSize',
        ]) as unknown as AnyObj;
        // Substitute each image's `src` with its canonical asset:// URL so
        // the saved snapshot is lightweight and round-trips through the
        // AssetManager pipeline (the in-memory Fabric image keeps the
        // blob URL for rendering).
        const objects = (json as { objects?: Array<AnyObj> }).objects;
        if (Array.isArray(objects)) {
            objects.forEach(obj => {
                const type = String(obj.type ?? '').toLowerCase();
                if (type === 'image' || type === 'fabricimage') {
                    const assetUrl = obj.slideAssetUrl;
                    if (typeof assetUrl === 'string' && assetUrl.startsWith('asset://')) {
                        obj.src = assetUrl;
                    }
                }
            });
        }
        return json;
    }

    async loadFromJSON(json: AnyObj | null): Promise<void> {
        if (!json) return;
        try {
            // Resolve asset:// URLs to blob URLs Fabric can actually load.
            // The asset URL is preserved on each object's slideAssetUrl
            // property so the next serialize call round-trips back to it.
            const inflated = await this.preResolveAssetSources(json);
            await this.canvas.loadFromJSON(inflated);
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.canvas.renderAll();
        } catch {
            /* corrupt JSON: keep blank canvas */
        }
    }

    private async preResolveAssetSources(json: AnyObj): Promise<AnyObj> {
        const objects = (json as { objects?: Array<AnyObj> }).objects;
        if (!Array.isArray(objects) || !this.opts.resolveAssetUrl) return json;
        const clone = JSON.parse(JSON.stringify(json)) as AnyObj;
        const cloneObjects = (clone as { objects: Array<AnyObj> }).objects;
        await Promise.all(
            cloneObjects.map(async obj => {
                const type = String(obj.type ?? '').toLowerCase();
                if (type !== 'image' && type !== 'fabricimage') return;
                const src = typeof obj.src === 'string' ? obj.src : '';
                if (!src.startsWith('asset://')) return;
                obj.slideAssetUrl = src;
                try {
                    const resolved = await this.opts.resolveAssetUrl?.(src);
                    if (resolved) obj.src = resolved;
                } catch {
                    /* keep asset:// — Fabric may fail to load but at least the URL persists */
                }
            }),
        );
        return clone;
    }

    exportSvg(width: number, height: number): string {
        const imageObjs = this.canvas
            .getObjects()
            .filter((o): o is fabric.FabricImage => o instanceof fabric.FabricImage);
        const assetUrls: Array<string | null> = imageObjs.map(o => {
            const url = (o as unknown as AnyObj).slideAssetUrl;
            return typeof url === 'string' && url ? url : null;
        });

        let svg = this.canvas.toSVG({
            viewBox: { x: 0, y: 0, width, height },
            width: String(width),
            height: String(height),
        } as unknown as Parameters<fabric.Canvas['toSVG']>[0]);

        // Replace each <image>'s href with the canonical asset:// URL in
        // z-order. Browsers don't render asset:// directly — eXeLearning's
        // AssetManager (`resolveHTMLAssetsSync`) walks the rendered HTML
        // and rewrites it to blob: (preview) or to the bundled file path
        // (static export), exactly like it already does for <img src=>.
        let cursor = 0;
        svg = svg.replace(/<image\b([^>]*?)(\/?)>/g, (match, attrs: string, end: string) => {
            const url = assetUrls[cursor++];
            if (!url) return match;
            const cleanedAttrs = attrs
                .replace(/\s*xlink:href\s*=\s*"[^"]*"/gi, '')
                .replace(/\s*href\s*=\s*"[^"]*"/gi, '');
            return `<image xlink:href="${url}"${cleanedAttrs}${end}>`;
        });

        return sanitizeSvg(svg, this.opts.purifier);
    }

    // ── Selection helpers ──────────────────────────────────────────────────

    getSelectionInfo(): SelectionInfo {
        const active = this.canvas.getActiveObject();
        if (!active) return NO_SELECTION;
        const objs = this.canvas.getActiveObjects();
        const a = active as unknown as AnyObj;
        const opacity = typeof a.opacity === 'number' ? (a.opacity as number) : 1;
        if (objs.length > 1 && active instanceof fabric.ActiveSelection) {
            return { ...NO_SELECTION, kind: 'multi', opacity };
        }
        const isEditing = Boolean((a as { isEditing?: boolean }).isEditing);
        const role = getMeta(active).role;
        let kind: SelectionKind = 'shape';
        if (active instanceof ArrowShape || role?.startsWith('arrow')) kind = 'arrow';
        else if (this.isTextLike(active)) kind = 'text';
        else if (active instanceof fabric.FabricImage) kind = 'image';
        else if (active instanceof fabric.Group) kind = 'group';

        const fill = typeof a.fill === 'string' ? (a.fill as string) : null;
        const stroke = typeof a.stroke === 'string' ? (a.stroke as string) : null;
        const strokeWidth = typeof a.strokeWidth === 'number' ? (a.strokeWidth as number) : null;
        const fontFamily = typeof a.fontFamily === 'string' ? (a.fontFamily as string) : null;
        const fontSize = typeof a.fontSize === 'number' ? (a.fontSize as number) : null;
        const textColor = this.isTextLike(active) && typeof a.fill === 'string' ? (a.fill as string) : null;
        const bold = String(a.fontWeight ?? 'normal') === 'bold';
        const italic = String(a.fontStyle ?? 'normal') === 'italic';
        const align = typeof a.textAlign === 'string' ? (a.textAlign as string) : null;
        const cornerRadius = active instanceof fabric.Rect ? Number((a as { rx?: number }).rx ?? 0) : 0;
        const shadow = (a as { shadow?: { blur?: number } | null }).shadow;
        // Reverse-engineer the slider position from the blur we last set.
        const shadowIntensity = shadow && typeof shadow.blur === 'number' ? Math.max(0, Math.min(1, (shadow.blur - 6) / 22)) : 0;
        return {
            kind,
            shapeRole: typeof role === 'string' ? role : null,
            fill,
            stroke,
            strokeWidth,
            fontFamily,
            fontSize,
            textColor,
            opacity,
            bold,
            italic,
            align,
            isEditing,
            cornerRadius,
            shadowIntensity,
        };
    }

    isAnythingSelected(): boolean {
        return this.canvas.getActiveObjects().length > 0;
    }

    selectionIsEditingText(): boolean {
        const a = this.canvas.getActiveObject() as unknown as { isEditing?: boolean } | null;
        return Boolean(a && a.isEditing);
    }

    private applyToSelection(fn: (o: fabric.Object) => void): void {
        const objs = this.canvas.getActiveObjects();
        if (!objs.length) return;
        objs.forEach(o => fn(o));
        this.canvas.requestRenderAll();
        this.opts.onChange?.(true);
        this.opts.onSelection?.(this.getSelectionInfo());
    }

    private isTextLike(obj: fabric.Object): boolean {
        return obj instanceof fabric.IText || obj instanceof fabric.Textbox || obj instanceof fabric.Text;
    }

    /**
     * If the user resized a text object via the corner handles, fold the
     * resulting `scaleX/scaleY` into `fontSize` (and into `width` for
     * Textbox) so the visible size matches what the selector reports.
     * Vertical scale drives the font size; horizontal scale only resizes
     * the textbox wrap-width.
     */
    private normalizeTextScale(target: fabric.Object | undefined): void {
        if (!target) return;
        if (!this.isTextLike(target)) return;
        const t = target as unknown as { scaleX?: number; scaleY?: number; fontSize?: number; width?: number };
        const sx = t.scaleX ?? 1;
        const sy = t.scaleY ?? 1;
        if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return;

        const baseFontSize = typeof t.fontSize === 'number' && t.fontSize > 0 ? t.fontSize : DEFAULT_FONT_SIZE;
        const newFontSize = Math.max(6, Math.min(240, Math.round(baseFontSize * sy)));

        const updates: Record<string, unknown> = { fontSize: newFontSize, scaleX: 1, scaleY: 1 };
        if (target instanceof fabric.Textbox && typeof t.width === 'number' && t.width > 0) {
            updates.width = Math.max(20, Math.round(t.width * sx));
        }
        target.set(updates);
        target.setCoords();
        this.canvas.requestRenderAll();
    }
}

// Re-export defaults so the toolbar/style panel can use the same fallback values.
export { DEFAULT_FILL, DEFAULT_STROKE, DEFAULT_TEXT_COLOR };
export { ArrowShape };
