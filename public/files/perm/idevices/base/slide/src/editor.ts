/**
 * Slide iDevice — main editor (orchestrator).
 *
 * Composes:
 *   - top toolbar with a contextual zone (text / shape / image controls)
 *   - canvas (Fabric)
 *   - bottom status bar (canvas size + background + zoom)
 *
 * Wires keyboard shortcuts (Delete, Cmd+Z, Cmd+Shift+Z), debounced
 * history, and asset-service-backed image picking.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import DOMPurify from 'dompurify';
import { SlideAssetService } from './assetService.js';
import { SlideCanvasAdapter, type SelectionInfo } from './canvasAdapter.js';
import { SlideCanvasControls } from './canvasControls.js';
import { SlideHistoryManager } from './history.js';
import { parsePrevious, type AnyObj, type ParsedSlide } from './serializer.js';
import type { ShapeKind } from './shapes.js';
import { SlideToolbar, type ToolbarController } from './toolbar.js';
import { t } from './i18n.js';

export interface EditorOptions {
    previousData?: unknown;
}

export interface EditorAPI {
    getFabricJSON(): AnyObj;
    getSvgString(): string;
    getDimensions(): { width: number; height: number };
    getBackground(): string;
    setDimensions(width: number, height: number): void;
    setBackground(color: string): void;
    destroy(): void;
}

export class SlideEditor implements EditorAPI {
    private root: HTMLElement;
    private parsed: ParsedSlide;
    private wrapper!: HTMLElement;
    private canvasShell!: HTMLElement;
    private canvasFrame!: HTMLElement;
    private canvasEl!: HTMLCanvasElement;
    private emptyHint!: HTMLElement;
    private toolbar!: SlideToolbar;
    private canvasControls!: SlideCanvasControls;
    private adapter!: SlideCanvasAdapter;
    private assetService!: SlideAssetService;
    private history: SlideHistoryManager;
    private resizeObserver: ResizeObserver | null = null;
    private cleanupFns: Array<() => void> = [];
    private destroyed = false;
    private applyingHistory = false;
    /** Manual zoom factor; clamped to [0.25, 2.5]. 0 means "fit to shell". */
    private zoom = 0;

    // ── View toggle (Visual / Code) ────────────────────────────────────────
    private viewToggle!: HTMLElement;
    private visualBtn!: HTMLButtonElement;
    private codeBtn!: HTMLButtonElement;
    private codePanel!: HTMLElement;
    private codeTextarea!: HTMLTextAreaElement;
    private codeError!: HTMLElement;
    private codeMode = false;
    /** JSON snapshot captured when entering code mode; used to skip a
     *  no-op reload if the user toggles back without editing. */
    private codeOriginalJson = '';

    constructor(container: HTMLElement, options: EditorOptions = {}) {
        this.root = container;
        this.root.classList.add('exe-slide-editor');
        this.root.setAttribute('data-testid', 'slide-editor');
        this.parsed = parsePrevious(options.previousData);
        this.history = new SlideHistoryManager();

        this.buildDom();
        this.assetService = new SlideAssetService(this.root);
        this.adapter = new SlideCanvasAdapter({
            canvasEl: this.canvasEl,
            width: this.parsed.width,
            height: this.parsed.height,
            background: this.parsed.background,
            purifier: DOMPurify as unknown as { sanitize: (input: string, opts?: Record<string, unknown>) => string },
            onChange: immediate => this.handleCanvasChange(immediate),
            onSelection: info => this.handleSelectionChange(info),
            resolveAssetUrl: url => this.assetService.resolveDisplayUrl(url),
        });

        const popHost = { getHost: () => this.wrapper };

        const toolbarCtrl: ToolbarController = {
            addTextBox: () => this.adapter.addTextBox(t('Text')),
            addImage: () => this.handleAddImage(),
            addShape: (kind: ShapeKind) => {
                this.adapter.addShape(kind);
            },
            duplicateSelection: () => {
                void this.adapter.duplicateSelection();
            },
            deleteSelection: () => {
                this.adapter.deleteSelection();
            },
            bringForward: () => this.adapter.bringForward(),
            sendBackward: () => this.adapter.sendBackward(),
            undo: () => this.handleUndo(),
            redo: () => this.handleRedo(),
            canUndo: () => this.history.canUndo(),
            canRedo: () => this.history.canRedo(),
            setFill: c => this.adapter.setFill(c),
            setStroke: c => this.adapter.setStroke(c),
            setStrokeWidth: w => this.adapter.setStrokeWidth(w),
            setOpacity: o => this.adapter.setOpacity(o),
            setCornerRadius: r => this.adapter.setCornerRadius(r),
            setShadowIntensity: s => this.adapter.setShadowIntensity(s),
            setFontFamily: f => this.adapter.setFontFamily(f),
            setFontSize: s => this.adapter.setFontSize(s),
            setTextColor: c => this.adapter.setTextColor(c),
            toggleBold: () => this.adapter.toggleBold(),
            toggleItalic: () => this.adapter.toggleItalic(),
            toggleUnderline: () => this.adapter.toggleUnderline(),
            setTextAlign: a => this.adapter.setTextAlign(a),
            replaceImage: () => this.handleAddImage(),
            flipHorizontal: () => {
                this.adapter.flipSelectionHorizontal();
            },
            flipVertical: () => {
                this.adapter.flipSelectionVertical();
            },
            enterCropMode: () => {
                this.adapter.enterCropMode();
                this.toolbar.contextual.update(this.adapter.getSelectionInfo());
            },
            applyCrop: () => {
                this.adapter.applyCrop();
                this.toolbar.contextual.update(this.adapter.getSelectionInfo());
            },
            cancelCrop: () => {
                this.adapter.cancelCrop();
                this.toolbar.contextual.update(this.adapter.getSelectionInfo());
            },
            resetImageCrop: () => {
                this.adapter.resetImageCrop();
            },
            isCropping: () => this.adapter.isCropping(),
        };
        this.toolbar = new SlideToolbar(toolbarCtrl, popHost);

        this.canvasControls = new SlideCanvasControls(
            {
                setDimensions: (w, h) => this.setDimensions(w, h),
                setBackground: c => this.setBackground(c),
                setZoom: z => {
                    this.zoom = z;
                    this.fitCanvasToShell();
                },
                fitZoom: () => {
                    this.zoom = 0;
                    this.fitCanvasToShell();
                },
                getDimensions: () => ({ width: this.parsed.width, height: this.parsed.height }),
                getBackground: () => this.parsed.background,
                getZoom: () => (this.zoom > 0 ? this.zoom : this.computeFitZoom()),
            },
            popHost,
        );

        // Wrapper layout: toolbar | canvas shell | canvas controls (bottom bar).
        this.wrapper.insertBefore(this.toolbar.root, this.canvasShell);
        this.wrapper.appendChild(this.canvasControls.root);
        this.toolbar.mountPickerPopup(this.wrapper);

        this.fitCanvasToShell();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.fitCanvasToShell();
                this.canvasControls.refresh();
            });
            this.resizeObserver.observe(this.canvasShell);
        }
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                if (this.destroyed) return;
                this.fitCanvasToShell();
                this.canvasControls.refresh();
            });
        }
        setTimeout(() => {
            if (this.destroyed) return;
            this.fitCanvasToShell();
            this.canvasControls.refresh();
        }, 120);

        this.attachKeyboard();
        void this.loadInitialScene();
    }

    // ── DOM ────────────────────────────────────────────────────────────────

    private buildDom(): void {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'exe-slide-editor__wrapper';
        // Wrapper is the popover positioning context.
        this.wrapper.style.position = 'relative';

        this.canvasShell = document.createElement('div');
        this.canvasShell.className = 'exe-slide-canvas-shell';
        this.canvasShell.setAttribute('data-testid', 'slide-canvas-shell');

        this.canvasFrame = document.createElement('div');
        this.canvasFrame.className = 'exe-slide-canvas-frame';
        // Seed the canvas-bg CSS variable from the parsed payload so the
        // saved Fondo colour is reflected the moment the editor mounts.
        this.canvasFrame.style.setProperty('--slide-canvas-bg', this.parsed.background);

        this.canvasEl = document.createElement('canvas');
        this.canvasEl.className = 'exe-slide-canvas';
        this.canvasEl.width = this.parsed.width;
        this.canvasEl.height = this.parsed.height;
        this.canvasEl.setAttribute('data-testid', 'slide-canvas');
        this.canvasFrame.appendChild(this.canvasEl);

        this.emptyHint = document.createElement('div');
        this.emptyHint.className = 'exe-slide-empty-hint';
        this.emptyHint.setAttribute('data-testid', 'slide-empty-hint');
        this.emptyHint.setAttribute('aria-hidden', 'true');
        this.emptyHint.innerHTML =
            `<div class="exe-slide-empty-hint__inner">` +
            `<div class="exe-slide-empty-hint__icon" aria-hidden="true">` +
            `<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
            `<rect x="6" y="6" width="36" height="36" rx="3"/>` +
            `<path d="M14 22h12M14 30h20"/>` +
            `<circle cx="34" cy="16" r="4"/>` +
            `</svg></div>` +
            `<p class="exe-slide-empty-hint__text">${t('Pick a tool above to start your slide')}</p>` +
            `</div>`;
        this.canvasFrame.appendChild(this.emptyHint);

        this.canvasShell.appendChild(this.canvasFrame);
        this.buildViewToggle();
        this.wrapper.appendChild(this.canvasShell);
        this.root.appendChild(this.wrapper);
    }

    private buildViewToggle(): void {
        // Segmented control overlaid on the canvas shell (top-right corner).
        // Modelled after TinyMCE's Visual / Code switcher.
        this.viewToggle = document.createElement('div');
        this.viewToggle.className = 'exe-slide-view-toggle';
        this.viewToggle.setAttribute('data-testid', 'slide-view-toggle');
        this.viewToggle.setAttribute('role', 'tablist');
        this.viewToggle.setAttribute('aria-label', t('View mode'));

        this.visualBtn = document.createElement('button');
        this.visualBtn.type = 'button';
        this.visualBtn.className = 'exe-slide-view-toggle__btn is-active';
        this.visualBtn.setAttribute('data-testid', 'slide-view-visual');
        this.visualBtn.setAttribute('role', 'tab');
        this.visualBtn.setAttribute('aria-selected', 'true');
        this.visualBtn.textContent = t('Visual');

        this.codeBtn = document.createElement('button');
        this.codeBtn.type = 'button';
        this.codeBtn.className = 'exe-slide-view-toggle__btn';
        this.codeBtn.setAttribute('data-testid', 'slide-view-code');
        this.codeBtn.setAttribute('role', 'tab');
        this.codeBtn.setAttribute('aria-selected', 'false');
        this.codeBtn.textContent = t('Code');

        this.visualBtn.addEventListener('click', () => this.setCodeMode(false));
        this.codeBtn.addEventListener('click', () => this.setCodeMode(true));

        this.viewToggle.appendChild(this.visualBtn);
        this.viewToggle.appendChild(this.codeBtn);
        this.canvasShell.appendChild(this.viewToggle);

        // Code panel — textarea with the Fabric JSON. Hidden by default.
        this.codePanel = document.createElement('div');
        this.codePanel.className = 'exe-slide-code-panel';
        this.codePanel.setAttribute('data-testid', 'slide-code-panel');
        this.codePanel.setAttribute('aria-hidden', 'true');

        this.codeError = document.createElement('div');
        this.codeError.className = 'exe-slide-code-panel__error';
        this.codeError.setAttribute('role', 'alert');

        this.codeTextarea = document.createElement('textarea');
        this.codeTextarea.className = 'exe-slide-code-panel__textarea';
        this.codeTextarea.setAttribute('data-testid', 'slide-code-textarea');
        this.codeTextarea.spellcheck = false;
        this.codeTextarea.autocapitalize = 'off';
        this.codeTextarea.setAttribute('aria-label', t('Slide source (JSON)'));

        this.codePanel.appendChild(this.codeError);
        this.codePanel.appendChild(this.codeTextarea);
        this.canvasShell.appendChild(this.codePanel);
    }

    // ── View toggle (Visual / Code) ────────────────────────────────────────

    private setCodeMode(enable: boolean): void {
        if (this.codeMode === enable) return;
        if (enable) {
            this.enterCodeMode();
        } else {
            this.exitCodeMode();
        }
    }

    private enterCodeMode(): void {
        let serialized = '';
        try {
            serialized = JSON.stringify(this.adapter.serialize(), null, 2);
        } catch {
            serialized = '';
        }
        this.codeTextarea.value = serialized;
        this.codeOriginalJson = serialized;
        this.clearCodeError();
        this.codeMode = true;
        this.codePanel.setAttribute('aria-hidden', 'false');
        this.codePanel.classList.add('exe-slide-code-panel--visible');
        this.canvasFrame.classList.add('exe-slide-canvas-frame--hidden');
        this.emptyHint.classList.add('exe-slide-empty-hint--hidden');
        this.toolbar.root.classList.add('exe-slide-toolbar--disabled');
        this.canvasControls.root.classList.add('exe-slide-canvas-controls--disabled');
        this.visualBtn.classList.remove('is-active');
        this.codeBtn.classList.add('is-active');
        this.visualBtn.setAttribute('aria-selected', 'false');
        this.codeBtn.setAttribute('aria-selected', 'true');
        // Defer focus so the layout settles first.
        setTimeout(() => {
            if (!this.destroyed && this.codeMode) this.codeTextarea.focus();
        }, 0);
    }

    private exitCodeMode(): void {
        const text = this.codeTextarea.value;
        // No-op short-circuit: if the user didn't touch the source, just
        // restore the visual view without reloading the scene.
        if (text === this.codeOriginalJson) {
            this.finishExitCodeMode();
            return;
        }
        let parsed: AnyObj;
        try {
            parsed = JSON.parse(text.trim() || '{}') as AnyObj;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.showCodeError(`${t('Invalid JSON')}: ${msg}`);
            return;
        }
        this.applyingHistory = true;
        this.adapter.loadFromJSON(parsed).then(
            () => {
                this.applyingHistory = false;
                this.finishExitCodeMode();
                // Commit the manually-edited scene as one history step so
                // it's reachable through Undo afterwards.
                this.history.commit(this.snapshotString());
                this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
                this.toolbar.contextual.update(this.adapter.getSelectionInfo());
                this.updateEmptyHint();
                this.fitCanvasToShell();
            },
            err => {
                this.applyingHistory = false;
                const msg = err instanceof Error ? err.message : String(err);
                this.showCodeError(`${t('Could not load slide')}: ${msg}`);
            },
        );
    }

    private finishExitCodeMode(): void {
        this.codeMode = false;
        this.codePanel.setAttribute('aria-hidden', 'true');
        this.codePanel.classList.remove('exe-slide-code-panel--visible');
        this.canvasFrame.classList.remove('exe-slide-canvas-frame--hidden');
        this.toolbar.root.classList.remove('exe-slide-toolbar--disabled');
        this.canvasControls.root.classList.remove('exe-slide-canvas-controls--disabled');
        this.codeBtn.classList.remove('is-active');
        this.visualBtn.classList.add('is-active');
        this.visualBtn.setAttribute('aria-selected', 'true');
        this.codeBtn.setAttribute('aria-selected', 'false');
        this.clearCodeError();
        this.updateEmptyHint();
    }

    private showCodeError(msg: string): void {
        this.codeError.textContent = msg;
        this.codeError.classList.add('exe-slide-code-panel__error--visible');
    }

    private clearCodeError(): void {
        this.codeError.textContent = '';
        this.codeError.classList.remove('exe-slide-code-panel__error--visible');
    }

    private computeFitZoom(): number {
        const designW = this.parsed.width;
        const designH = this.parsed.height;
        const shellW = this.canvasShell.clientWidth;
        const shellH = this.canvasShell.clientHeight;
        // The shell now uses an 8 px padding (16 px total per axis); fall back
        // to design dimensions when the shell isn't laid out yet.
        const availableW = shellW > 0 ? shellW - 16 : designW;
        const availableH = shellH > 0 ? shellH - 16 : designH;
        const scaleW = availableW / designW;
        const scaleH = availableH / designH;
        return Math.min(1, Math.min(scaleW, scaleH));
    }

    private fitCanvasToShell(): void {
        if (this.destroyed) return;
        if (!this.adapter) return;
        const designW = this.parsed.width;
        const designH = this.parsed.height;
        const scale = this.zoom > 0 ? this.zoom : this.computeFitZoom();
        const cssW = Math.max(1, Math.round(designW * scale));
        const cssH = Math.max(1, Math.round(designH * scale));
        this.adapter.setCssDimensions(cssW, cssH);
    }

    private updateEmptyHint(): void {
        const hasObjects = this.adapter?.canvas?.getObjects().length > 0;
        this.emptyHint.classList.toggle('exe-slide-empty-hint--hidden', hasObjects);
    }

    private attachKeyboard(): void {
        const onKey = (event: KeyboardEvent) => {
            if (this.destroyed) return;
            // In code mode the canvas is hidden and the textarea owns input
            // (it handles undo/delete natively). Skip canvas shortcuts.
            if (this.codeMode) return;
            const tgt = event.target as HTMLElement | null;
            const tag = tgt?.tagName;
            const editingInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            if (editingInput) return;
            // Crop mode: Enter applies, Escape cancels. Both swallow the
            // event so Fabric's default selection-cleanup doesn't fire.
            if (this.adapter.isCropping()) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.adapter.applyCrop();
                    this.toolbar.contextual.update(this.adapter.getSelectionInfo());
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.adapter.cancelCrop();
                    this.toolbar.contextual.update(this.adapter.getSelectionInfo());
                    return;
                }
                // Block destructive shortcuts so the overlay isn't deleted.
                if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    return;
                }
                return;
            }
            if (this.adapter.selectionIsEditingText()) {
                if (event.key === 'Escape') {
                    this.adapter.discardSelection();
                    event.preventDefault();
                }
                return;
            }
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (this.adapter.deleteSelection()) event.preventDefault();
                return;
            }
            const meta = event.ctrlKey || event.metaKey;
            if (meta && !event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
                event.preventDefault();
                void this.handleUndo();
                return;
            }
            if (meta && ((event.shiftKey && (event.key === 'z' || event.key === 'Z')) || event.key === 'y' || event.key === 'Y')) {
                event.preventDefault();
                void this.handleRedo();
                return;
            }
            if (event.key === 'Escape') {
                this.adapter.discardSelection();
            }
        };
        document.addEventListener('keydown', onKey);
        this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    private async loadInitialScene(): Promise<void> {
        if (this.parsed.fabric) {
            this.applyingHistory = true;
            try {
                await this.adapter.loadFromJSON(this.parsed.fabric);
                this.fitCanvasToShell();
            } finally {
                this.applyingHistory = false;
            }
        }
        this.history.seed(this.snapshotString());
        this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
        this.toolbar.contextual.update(this.adapter.getSelectionInfo());
        this.updateEmptyHint();
    }

    private async handleAddImage(): Promise<void> {
        const picked = await this.assetService.pickImage();
        if (!picked) return;
        const display = await this.assetService.resolveDisplayUrl(picked.assetUrl);
        await this.adapter.addImageFromUrl(display || picked.displayUrl, picked.assetUrl, picked.name);
    }

    private handleCanvasChange(immediate: boolean): void {
        if (this.applyingHistory) return;
        const snapshot = this.snapshotString();
        if (immediate) {
            this.history.commit(snapshot);
        } else {
            this.history.push(snapshot);
        }
        this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
        this.toolbar.contextual.update(this.adapter.getSelectionInfo());
        this.updateEmptyHint();
    }

    private handleSelectionChange(info: SelectionInfo): void {
        this.toolbar.contextual.update(info);
    }

    private async handleUndo(): Promise<void> {
        const snapshot = this.history.undo();
        if (!snapshot) return;
        this.applyingHistory = true;
        try {
            await this.adapter.loadFromJSON(JSON.parse(snapshot) as AnyObj);
        } finally {
            this.applyingHistory = false;
        }
        this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
        this.toolbar.contextual.update(this.adapter.getSelectionInfo());
        this.updateEmptyHint();
    }

    private async handleRedo(): Promise<void> {
        const snapshot = this.history.redo();
        if (!snapshot) return;
        this.applyingHistory = true;
        try {
            await this.adapter.loadFromJSON(JSON.parse(snapshot) as AnyObj);
        } finally {
            this.applyingHistory = false;
        }
        this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
        this.toolbar.contextual.update(this.adapter.getSelectionInfo());
        this.updateEmptyHint();
    }

    private snapshotString(): string {
        return JSON.stringify(this.adapter.serialize());
    }

    // ── Public API ─────────────────────────────────────────────────────────

    isCodeMode(): boolean {
        return this.codeMode;
    }

    getFabricJSON(): AnyObj {
        // If the user is in code mode, the textarea is the source of truth.
        // We try to parse it and return that; if it's invalid we fall back
        // to the last-known-good scene (saved is better than refusing to
        // save and losing data).
        if (this.codeMode) {
            try {
                return JSON.parse(this.codeTextarea.value.trim() || '{}') as AnyObj;
            } catch {
                /* fall through */
            }
        }
        return this.adapter.serialize();
    }

    getSvgString(): string {
        const raw = this.adapter.exportSvg(this.parsed.width, this.parsed.height);
        // Fabric's canvas keeps a transparent buffer during editing (so the
        // CSS dotted grid shows through). Inject the chosen Fondo colour as
        // a fill rect at the start of the SVG so exported slides aren't
        // accidentally transparent.
        const bg = this.parsed.background || '#ffffff';
        const rect =
            `<rect x="0" y="0" width="${this.parsed.width}" height="${this.parsed.height}" fill="${bg}"/>`;
        return raw.replace(/(<svg\b[^>]*>)/, `$1${rect}`);
    }

    getDimensions(): { width: number; height: number } {
        return { width: this.parsed.width, height: this.parsed.height };
    }

    getBackground(): string {
        return this.parsed.background;
    }

    setDimensions(width: number, height: number): void {
        const w = Math.max(200, Math.min(4000, Math.round(width)));
        const h = Math.max(200, Math.min(4000, Math.round(height)));
        this.parsed = { ...this.parsed, width: w, height: h };
        this.adapter?.setBufferDimensions(w, h);
        this.fitCanvasToShell();
        this.canvasControls?.refresh();
    }

    setBackground(color: string): void {
        this.parsed = { ...this.parsed, background: color };
        // CSS-side: update the canvas-frame's background so the dotted grid
        // sits on top of the chosen colour. Fabric's canvas buffer stays
        // transparent during editing.
        this.canvasFrame?.style.setProperty('--slide-canvas-bg', color);
        this.canvasControls?.refresh();
    }

    destroy(): void {
        this.destroyed = true;
        this.cleanupFns.forEach(fn => {
            try {
                fn();
            } catch {
                /* ignore */
            }
        });
        this.cleanupFns = [];
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.toolbar?.destroy();
        this.canvasControls?.destroy();
        this.assetService?.destroy();
        this.adapter?.destroy();
        while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
        this.root.classList.remove('exe-slide-editor');
        this.root.removeAttribute('data-testid');
    }
}
