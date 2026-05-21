/**
 * Slide iDevice — canvas-level controls (width, height, background, zoom).
 *
 * Originally these lived in a bottom status bar; the redesigned editor
 * folds them into the right side of the top toolbar so the iDevice has a
 * single chrome row. The module's `root` is meant to be appended into the
 * toolbar's trailing slot.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { buildColorPopover } from './colorPopover.js';
import { renderIcon } from './icons.js';
import { Popover } from './popover.js';
import { SLIDE_PRESETS } from './constants.js';
import { t } from './i18n.js';

export interface CanvasControlsController {
    setDimensions: (width: number, height: number) => void;
    setBackground: (color: string) => void;
    setZoom: (factor: number) => void;
    fitZoom: () => void;
    getDimensions: () => { width: number; height: number };
    getBackground: () => string;
    getZoom: () => number;
}

interface PopoverHost {
    getHost(): HTMLElement;
}

export class SlideCanvasControls {
    readonly root: HTMLElement;
    private widthInput!: HTMLInputElement;
    private heightInput!: HTMLInputElement;
    private bgButton!: HTMLButtonElement;
    private bgBar!: HTMLElement;
    private sizeButton!: HTMLButtonElement;
    private zoomLabel!: HTMLElement;
    private openPop: Popover | null = null;

    constructor(private ctrl: CanvasControlsController, private popHost: PopoverHost) {
        this.root = document.createElement('div');
        this.root.className = 'exe-slide-tb__canvas';
        this.root.setAttribute('data-testid', 'slide-canvas-controls');
        this.build();
        this.refresh();
    }

    refresh(): void {
        const dims = this.ctrl.getDimensions();
        this.widthInput.value = String(dims.width);
        this.heightInput.value = String(dims.height);
        this.bgBar.style.background = this.ctrl.getBackground();
        const sizeValue = this.sizeButton.querySelector('.exe-slide-tb__canvas-size-value');
        if (sizeValue) sizeValue.textContent = `${dims.width}×${dims.height}`;
        this.zoomLabel.textContent = `${Math.round(this.ctrl.getZoom() * 100)}%`;
    }

    destroy(): void {
        this.openPop?.close();
        this.openPop = null;
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    private build(): void {
        // Compact size pill, e.g. "1280×720 ▾"
        this.sizeButton = document.createElement('button');
        this.sizeButton.type = 'button';
        this.sizeButton.className = 'exe-slide-tb__canvas-size';
        this.sizeButton.title = t('Slide size');
        this.sizeButton.setAttribute('data-testid', 'slide-status-size');
        this.sizeButton.innerHTML =
            `<span class="exe-slide-tb__canvas-size-value"></span>` + renderIcon('caret', { size: 10 });
        this.sizeButton.addEventListener('click', event => {
            event.preventDefault();
            this.openSizePopover(this.sizeButton);
        });
        this.root.appendChild(this.sizeButton);

        // Hidden width / height inputs — exposed for tests + power users
        // who need exact dimensions; the default UX uses the size preset.
        this.widthInput = this.makeNumberInput(t('Width'), 'slide-config-width', v =>
            this.ctrl.setDimensions(v, this.ctrl.getDimensions().height),
        );
        this.heightInput = this.makeNumberInput(t('Height'), 'slide-config-height', v =>
            this.ctrl.setDimensions(this.ctrl.getDimensions().width, v),
        );
        const inputs = document.createElement('div');
        inputs.className = 'exe-slide-tb__canvas-inputs';
        const wWrap = document.createElement('label');
        wWrap.className = 'exe-slide-tb__canvas-input';
        wWrap.title = t('Width');
        wWrap.appendChild(this.widthInput);
        const hWrap = document.createElement('label');
        hWrap.className = 'exe-slide-tb__canvas-input';
        hWrap.title = t('Height');
        hWrap.appendChild(this.heightInput);
        inputs.appendChild(wWrap);
        inputs.appendChild(hWrap);
        this.root.appendChild(inputs);

        // Background colour — same Google-Drawings look as the contextual
        // colour triggers: small icon + colour bar.
        this.bgButton = document.createElement('button');
        this.bgButton.type = 'button';
        this.bgButton.className = 'exe-slide-tb__color';
        this.bgButton.title = t('Background');
        this.bgButton.setAttribute('data-testid', 'slide-config-bg');
        this.bgButton.innerHTML =
            `<span class="exe-slide-tb__color-icon">${renderIcon('background', { size: 18 })}</span>` +
            `<span class="exe-slide-tb__color-bar"></span>`;
        this.bgBar = this.bgButton.querySelector('.exe-slide-tb__color-bar') as HTMLElement;
        this.bgButton.addEventListener('click', event => {
            event.preventDefault();
            this.openBgPopover(this.bgButton);
        });
        this.root.appendChild(this.bgButton);

        // Zoom controls — grouped so margin-left auto pushes the whole
        // cluster to the right edge of the bottom bar.
        const zoomGroup = document.createElement('div');
        zoomGroup.className = 'exe-slide-tb__canvas-zoom';
        const zoomOut = this.iconBtn('zoom-out', t('Zoom out'), () => this.bumpZoom(-0.1));
        const zoomIn = this.iconBtn('zoom-in', t('Zoom in'), () => this.bumpZoom(0.1));
        this.zoomLabel = document.createElement('span');
        this.zoomLabel.className = 'exe-slide-tb__canvas-zoom-value';
        const fit = this.iconBtn('fit', t('Fit to width'), () => {
            this.ctrl.fitZoom();
            this.refresh();
        });
        zoomGroup.appendChild(zoomOut);
        zoomGroup.appendChild(this.zoomLabel);
        zoomGroup.appendChild(zoomIn);
        zoomGroup.appendChild(fit);
        this.root.appendChild(zoomGroup);
    }

    private bumpZoom(delta: number): void {
        const next = Math.max(0.25, Math.min(2.5, this.ctrl.getZoom() + delta));
        this.ctrl.setZoom(next);
        this.refresh();
    }

    private iconBtn(icon: 'zoom-in' | 'zoom-out' | 'fit', label: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-tb__btn';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.innerHTML = renderIcon(icon, { size: 16 });
        btn.addEventListener('click', event => {
            event.preventDefault();
            onClick();
        });
        return btn;
    }

    private makeNumberInput(label: string, testId: string, onChange: (v: number) => void): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'exe-slide-tb__canvas-num';
        input.setAttribute('aria-label', label);
        input.setAttribute('data-testid', testId);
        input.min = '200';
        input.max = '4000';
        input.step = '10';
        input.addEventListener('change', () => {
            const v = Number(input.value);
            if (Number.isFinite(v) && v > 0) onChange(v);
        });
        return input;
    }

    private openBgPopover(anchor: HTMLElement): void {
        this.openPop?.close();
        const content = buildColorPopover({
            title: t('Background'),
            initial: this.ctrl.getBackground(),
            allowNone: false,
            onChange: c => {
                if (c) this.ctrl.setBackground(c);
                this.openPop?.close();
                this.openPop = null;
                this.refresh();
            },
        });
        this.openPop = new Popover({
            anchor,
            host: this.popHost.getHost(),
            content,
            direction: 'up',
            onClose: () => {
                this.openPop = null;
            },
        });
    }

    private openSizePopover(anchor: HTMLElement): void {
        this.openPop?.close();
        const list = document.createElement('div');
        list.className = 'exe-slide-pop__list';
        SLIDE_PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'exe-slide-pop__list-item';
            btn.innerHTML = `<span>${preset.label}</span><span class="exe-slide-pop__list-meta">${preset.width}×${preset.height}</span>`;
            const dims = this.ctrl.getDimensions();
            if (dims.width === preset.width && dims.height === preset.height) {
                btn.classList.add('exe-slide-pop__list-item--selected');
            }
            btn.addEventListener('click', () => {
                this.ctrl.setDimensions(preset.width, preset.height);
                this.openPop?.close();
                this.openPop = null;
                this.refresh();
            });
            list.appendChild(btn);
        });
        this.openPop = new Popover({
            anchor,
            host: this.popHost.getHost(),
            content: list,
            direction: 'up',
            onClose: () => {
                this.openPop = null;
            },
        });
    }
}
