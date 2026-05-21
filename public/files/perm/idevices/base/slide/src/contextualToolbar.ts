/**
 * Slide iDevice — contextual toolbar.
 *
 * Renders the right-hand portion of the top toolbar, swapping its
 * controls based on the current selection (shape / text / image / none).
 * It's strictly UI: every control delegates to the controller, which is
 * the editor (which in turn drives the canvas adapter).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { DEFAULT_FILL, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_STROKE, FONTS, FONT_SIZES } from './constants.js';
import { buildColorPopover } from './colorPopover.js';
import { renderIcon } from './icons.js';
import { Popover } from './popover.js';
import type { SelectionInfo } from './canvasAdapter.js';
import { t } from './i18n.js';

export interface ContextualController {
    setFill: (color: string | null) => void;
    setStroke: (color: string | null) => void;
    setStrokeWidth: (width: number) => void;
    setOpacity: (opacity: number) => void;
    setCornerRadius: (radius: number) => void;
    setShadowIntensity: (intensity: number) => void;
    setFontFamily: (family: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (color: string) => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleUnderline: () => void;
    setTextAlign: (align: 'left' | 'center' | 'right') => void;
    duplicateSelection: () => void;
    deleteSelection: () => void;
    bringForward: () => void;
    sendBackward: () => void;
    replaceImage: () => void;
    flipHorizontal: () => void;
    flipVertical: () => void;
    enterCropMode: () => void;
    applyCrop: () => void;
    cancelCrop: () => void;
    resetImageCrop: () => void;
    isCropping: () => boolean;
}

interface PopoverHost {
    /** Element used as the positioning context for popovers. */
    getHost(): HTMLElement;
}

export class SlideContextualToolbar {
    readonly root: HTMLElement;
    private currentInfo: SelectionInfo;
    private openPopover: Popover | null = null;

    constructor(private ctrl: ContextualController, private popHost: PopoverHost) {
        this.root = document.createElement('div');
        this.root.className = 'exe-slide-tb__context';
        this.root.setAttribute('data-testid', 'slide-context');
        this.currentInfo = emptyInfo();
        this.render();
    }

    update(info: SelectionInfo): void {
        this.currentInfo = info;
        this.render();
    }

    closePopover(): void {
        this.openPopover?.close();
        this.openPopover = null;
    }

    destroy(): void {
        this.closePopover();
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    // ── Rendering ──────────────────────────────────────────────────────────

    private render(): void {
        this.root.classList.remove('exe-slide-tb__context--empty');
        this.root.innerHTML = '';

        // Crop mode takes over the contextual zone regardless of which
        // object is currently active on the canvas (the user is dragging
        // the overlay rectangle, but the conceptual target is still the
        // image being cropped).
        if (this.ctrl.isCropping()) {
            this.renderCropContext();
            return;
        }

        const info = this.currentInfo;
        if (info.kind === 'none') {
            this.root.classList.add('exe-slide-tb__context--empty');
            const empty = document.createElement('span');
            empty.className = 'exe-slide-tb__hint';
            empty.textContent = t('Select an element to see its options');
            this.root.appendChild(empty);
            return;
        }

        if (info.kind === 'text') {
            this.renderTextContext(info);
        } else if (info.kind === 'image') {
            this.renderImageContext(info);
        } else if (info.kind === 'arrow') {
            this.renderArrowContext(info);
        } else {
            this.renderShapeContext(info);
        }

        this.root.appendChild(this.arrangeGroup());
    }

    private renderCropContext(): void {
        const group = this.makeGroup();
        const apply = this.iconButton(
            'fit',
            t('Apply crop'),
            () => this.ctrl.applyCrop(),
            'slide-action-apply-crop',
        );
        apply.classList.add('exe-slide-tb__btn--accent');
        group.appendChild(apply);
        group.appendChild(
            this.iconButton('reset', t('Cancel crop'), () => this.ctrl.cancelCrop(), 'slide-action-cancel-crop'),
        );
        const hint = document.createElement('span');
        hint.className = 'exe-slide-tb__hint';
        hint.textContent = t('Drag the rectangle, then press Enter or click Apply.');
        this.root.appendChild(group);
        this.root.appendChild(hint);
    }

    // ── Sections ───────────────────────────────────────────────────────────

    private renderShapeContext(info: SelectionInfo): void {
        const group = this.makeGroup();
        group.appendChild(
            this.colorTrigger({
                kind: 'fill',
                label: t('Fill colour'),
                icon: 'fill',
                color: info.fill,
                allowNone: true,
                onPick: c => this.ctrl.setFill(c),
            }),
        );
        group.appendChild(
            this.colorTrigger({
                kind: 'stroke',
                label: t('Border colour'),
                icon: 'stroke',
                color: info.stroke,
                allowNone: true,
                onPick: c => this.ctrl.setStroke(c),
            }),
        );
        group.appendChild(
            this.borderWidthDropdown(info.strokeWidth ?? 0, v => this.ctrl.setStrokeWidth(v)),
        );
        // Corner radius only applies to rectangles. Fabric's Circle, Path,
        // Ellipse, etc. either ignore `rx`/`ry` or use them for unrelated
        // geometry, so we hide the trigger for non-rect shapes rather than
        // exposing a no-op control.
        const supportsRadius = info.shapeRole === 'rect' || info.shapeRole === 'rounded-rect';
        if (supportsRadius) {
            group.appendChild(
                this.popoverSlider({
                    label: t('Radius'),
                    testId: 'slide-style-radius',
                    icon: 'radius',
                    min: 0,
                    max: 80,
                    value: info.cornerRadius,
                    unit: 'px',
                    onChange: v => this.ctrl.setCornerRadius(v),
                }),
            );
        }
        group.appendChild(
            this.popoverSlider({
                label: t('Shadow'),
                testId: 'slide-style-shadow',
                icon: 'shadow',
                min: 0,
                max: 100,
                value: Math.round(info.shadowIntensity * 100),
                unit: '%',
                onChange: v => this.ctrl.setShadowIntensity(v / 100),
            }),
        );
        group.appendChild(this.opacityGroup(info.opacity));
        this.root.appendChild(group);
    }

    private renderArrowContext(info: SelectionInfo): void {
        const group = this.makeGroup();
        group.appendChild(
            this.colorTrigger({
                kind: 'fill',
                label: t('Arrow colour'),
                icon: 'fill',
                color: info.fill ?? info.stroke,
                allowNone: false,
                onPick: c => {
                    if (!c) return;
                    this.ctrl.setFill(c);
                },
            }),
        );
        group.appendChild(
            this.borderWidthDropdown(Math.max(1, info.strokeWidth ?? 4), v =>
                this.ctrl.setStrokeWidth(Math.max(1, v)),
            ),
        );
        group.appendChild(this.opacityGroup(info.opacity));
        this.root.appendChild(group);
    }

    private renderTextContext(info: SelectionInfo): void {
        const group = this.makeGroup();
        group.appendChild(
            this.dropdown({
                label: info.fontFamily ?? DEFAULT_FONT_FAMILY,
                title: t('Font family'),
                width: 120,
                kind: 'font',
                fontSample: info.fontFamily ?? DEFAULT_FONT_FAMILY,
                onOpen: anchor => this.openFontPopover(anchor, info.fontFamily ?? DEFAULT_FONT_FAMILY),
            }),
        );
        group.appendChild(
            this.dropdown({
                label: String(info.fontSize ?? DEFAULT_FONT_SIZE),
                title: t('Font size'),
                width: 56,
                kind: 'size',
                onOpen: anchor => this.openSizePopover(anchor, info.fontSize ?? DEFAULT_FONT_SIZE),
            }),
        );
        group.appendChild(this.iconToggle('bold', t('Bold'), info.bold, () => this.ctrl.toggleBold()));
        group.appendChild(this.iconToggle('italic', t('Italic'), info.italic, () => this.ctrl.toggleItalic()));
        group.appendChild(
            this.iconToggle('underline', t('Underline'), false, () => this.ctrl.toggleUnderline()),
        );
        group.appendChild(this.textColorTrigger(info.textColor ?? '#111827', c => this.ctrl.setTextColor(c)));
        group.appendChild(
            this.iconToggle('align-left', t('Align left'), info.align === 'left', () =>
                this.ctrl.setTextAlign('left'),
            ),
        );
        group.appendChild(
            this.iconToggle('align-center', t('Align centre'), info.align === 'center', () =>
                this.ctrl.setTextAlign('center'),
            ),
        );
        group.appendChild(
            this.iconToggle('align-right', t('Align right'), info.align === 'right', () =>
                this.ctrl.setTextAlign('right'),
            ),
        );
        group.appendChild(this.opacityGroup(info.opacity));
        this.root.appendChild(group);
    }

    private renderImageContext(info: SelectionInfo): void {
        const group = this.makeGroup();

        const replace = document.createElement('button');
        replace.type = 'button';
        replace.className = 'exe-slide-tb__btn';
        replace.title = t('Replace image');
        replace.setAttribute('aria-label', t('Replace image'));
        replace.setAttribute('data-testid', 'slide-action-replace-image');
        replace.innerHTML = renderIcon('replace');
        replace.addEventListener('click', event => {
            event.preventDefault();
            this.ctrl.replaceImage();
        });
        group.appendChild(replace);

        group.appendChild(
            this.iconButton('crop', t('Crop'), () => this.ctrl.enterCropMode(), 'slide-action-crop'),
        );
        group.appendChild(
            this.iconButton('flip-h', t('Flip horizontally'), () => this.ctrl.flipHorizontal(), 'slide-action-flip-h'),
        );
        group.appendChild(
            this.iconButton('flip-v', t('Flip vertically'), () => this.ctrl.flipVertical(), 'slide-action-flip-v'),
        );
        group.appendChild(
            this.iconButton('reset', t('Reset crop'), () => this.ctrl.resetImageCrop(), 'slide-action-reset-crop'),
        );

        group.appendChild(
            this.colorTrigger({
                kind: 'stroke',
                label: t('Border colour'),
                icon: 'stroke',
                color: info.stroke,
                allowNone: true,
                onPick: c => this.ctrl.setStroke(c),
            }),
        );
        group.appendChild(
            this.borderWidthDropdown(info.strokeWidth ?? 0, v => this.ctrl.setStrokeWidth(v)),
        );
        group.appendChild(this.opacityGroup(info.opacity));
        this.root.appendChild(group);
    }

    // ── Building blocks ────────────────────────────────────────────────────

    private opacityGroup(opacity: number): HTMLElement {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'exe-slide-tb__btn';
        const pct = Math.round(opacity * 100);
        trigger.title = `${t('Opacity')}: ${pct}%`;
        trigger.setAttribute('aria-label', t('Opacity'));
        trigger.setAttribute('data-testid', 'slide-style-opacity');
        trigger.innerHTML = renderIcon('opacity');
        trigger.addEventListener('click', event => {
            event.preventDefault();
            this.openOpacityPopover(trigger, opacity);
        });
        return trigger;
    }

    private openOpacityPopover(anchor: HTMLElement, current: number): void {
        this.openSliderPopover(anchor, {
            label: t('Opacity'),
            min: 0,
            max: 100,
            value: Math.round(current * 100),
            unit: '%',
            writeValue: v => `${v}%`,
            onChange: v => this.ctrl.setOpacity(v / 100),
        });
    }

    private arrangeGroup(): HTMLElement {
        const group = this.makeGroup();
        group.appendChild(
            this.iconButton('duplicate', t('Duplicate'), () => this.ctrl.duplicateSelection(), 'slide-action-duplicate'),
        );
        group.appendChild(
            this.iconButton('forward', t('Bring forward'), () => this.ctrl.bringForward(), 'slide-action-bring-forward'),
        );
        group.appendChild(
            this.iconButton('backward', t('Send backward'), () => this.ctrl.sendBackward(), 'slide-action-send-backward'),
        );
        group.appendChild(this.iconButton('delete', t('Delete'), () => this.ctrl.deleteSelection(), 'slide-action-delete'));
        return group;
    }

    private iconButton(icon: Parameters<typeof renderIcon>[0], label: string, onClick: () => void, testId?: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-tb__btn';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        if (testId) btn.setAttribute('data-testid', testId);
        btn.innerHTML = renderIcon(icon, { size: 16 });
        btn.addEventListener('click', event => {
            event.preventDefault();
            onClick();
        });
        return btn;
    }

    private iconToggle(
        icon: Parameters<typeof renderIcon>[0],
        label: string,
        active: boolean,
        onClick: () => void,
    ): HTMLButtonElement {
        const btn = this.iconButton(icon, label, onClick);
        btn.setAttribute('aria-pressed', String(active));
        if (active) btn.classList.add('exe-slide-tb__btn--active');
        return btn;
    }

    private colorTrigger(args: {
        kind: 'fill' | 'stroke';
        label: string;
        icon: 'fill' | 'stroke';
        color: string | null;
        allowNone: boolean;
        onPick: (color: string | null) => void;
    }): HTMLButtonElement {
        // Google-Drawings layout: just the icon, with a thin coloured bar
        // under it showing the current value. No caret.
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-tb__color';
        btn.title = args.label;
        btn.setAttribute('aria-label', args.label);
        btn.setAttribute('data-testid', `slide-style-${args.kind}`);
        btn.innerHTML =
            `<span class="exe-slide-tb__color-icon">${renderIcon(args.icon, { size: 18 })}</span>` +
            `<span class="exe-slide-tb__color-bar${args.color == null ? ' exe-slide-tb__color-bar--none' : ''}" ` +
            `style="background:${args.color ?? 'transparent'}"></span>`;
        btn.addEventListener('click', event => {
            event.preventDefault();
            this.openColorPopover(btn, args.color ?? null, args.allowNone, args.label, args.onPick);
        });
        return btn;
    }

    private textColorTrigger(initial: string, onPick: (c: string) => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-tb__color exe-slide-tb__color--text';
        btn.title = t('Text colour');
        btn.setAttribute('aria-label', t('Text colour'));
        btn.setAttribute('data-testid', 'slide-style-text-color');
        btn.innerHTML =
            `<span class="exe-slide-tb__color-icon exe-slide-tb__text-glyph">A</span>` +
            `<span class="exe-slide-tb__color-bar" style="background:${initial}"></span>`;
        btn.addEventListener('click', event => {
            event.preventDefault();
            this.openColorPopover(btn, initial, false, t('Text colour'), c => {
                if (c) onPick(c);
            });
        });
        return btn;
    }

    /**
     * Border-width picker: icon-only trigger that opens a popover list of
     * common widths. Each entry shows a preview line plus the px label.
     */
    private borderWidthDropdown(currentWidth: number, onChange: (v: number) => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-tb__btn';
        btn.title = `${t('Border')}: ${currentWidth} px`;
        btn.setAttribute('aria-label', t('Border width'));
        btn.setAttribute('data-testid', 'slide-style-border-width');
        btn.innerHTML = renderIcon('border-width');
        btn.addEventListener('click', event => {
            event.preventDefault();
            this.openBorderWidthPopover(btn, currentWidth, onChange);
        });
        return btn;
    }

    private openBorderWidthPopover(anchor: HTMLElement, current: number, onChange: (v: number) => void): void {
        const list = document.createElement('div');
        list.className = 'exe-slide-pop__list exe-slide-pop__list--border-widths';
        const widths = [0, 1, 2, 3, 4, 8, 12, 16];
        widths.forEach(w => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'exe-slide-pop__list-item exe-slide-pop__list-item--width';
            // "No border" uses an empty box with a diagonal slash so it
            // doesn't read as a 1 px line. Every other entry shows a bar
            // whose thickness matches the actual stroke value.
            const preview =
                w === 0
                    ? '<span class="exe-slide-pop__line-preview exe-slide-pop__line-preview--none" aria-hidden="true"></span>'
                    : `<span class="exe-slide-pop__line-preview" style="height:${w}px"></span>`;
            item.innerHTML = `${preview}<span class="exe-slide-pop__line-label">${w === 0 ? t('No border') : `${w} px`}</span>`;
            if (w === Math.round(current)) item.classList.add('exe-slide-pop__list-item--selected');
            item.addEventListener('click', event => {
                event.preventDefault();
                onChange(w);
                anchor.title = `${t('Border')}: ${w} px`;
                this.closePopover();
            });
            list.appendChild(item);
        });
        this.openPopoverWith(anchor, list);
    }

    /**
     * Compact icon button that opens a slider+input popover for a numeric
     * range setting (radius, shadow, …). Tooltip shows the live value so
     * the toolbar stays icon-only.
     */
    private popoverSlider(args: {
        label: string;
        testId: string;
        icon: 'radius' | 'shadow' | 'opacity';
        min: number;
        max: number;
        value: number;
        unit: string;
        onChange: (v: number) => void;
    }): HTMLElement {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'exe-slide-tb__btn';
        trigger.title = `${args.label}: ${args.value}${args.unit}`;
        trigger.setAttribute('aria-label', args.label);
        trigger.setAttribute('data-testid', args.testId);
        trigger.innerHTML = renderIcon(args.icon);
        trigger.addEventListener('click', event => {
            event.preventDefault();
            this.openSliderPopover(trigger, {
                ...args,
                writeValue: v => `${v}${args.unit}`,
            });
        });
        return trigger;
    }

    private openSliderPopover(
        anchor: HTMLElement,
        args: {
            label?: string;
            min: number;
            max: number;
            value: number;
            unit: string;
            writeValue: (v: number) => string;
            onChange: (v: number) => void;
        },
    ): void {
        const wrap = document.createElement('div');
        wrap.className = 'exe-slide-pop__opacity';

        const range = document.createElement('input');
        range.type = 'range';
        range.min = String(args.min);
        range.max = String(args.max);
        range.step = '1';
        range.value = String(Math.round(args.value));
        range.className = 'exe-slide-pop__opacity-range';

        const num = document.createElement('input');
        num.type = 'number';
        num.min = String(args.min);
        num.max = String(args.max);
        num.step = '1';
        num.value = String(Math.round(args.value));
        num.className = 'exe-slide-pop__opacity-number';

        const suffix = document.createElement('span');
        suffix.className = 'exe-slide-pop__opacity-suffix';
        suffix.textContent = args.unit;

        const baseTitle = args.label ?? anchor.getAttribute('aria-label') ?? '';
        const sync = (raw: number, source: 'range' | 'number') => {
            const clamped = Math.max(args.min, Math.min(args.max, Math.round(raw)));
            args.onChange(clamped);
            if (source !== 'range') range.value = String(clamped);
            if (source !== 'number') num.value = String(clamped);
            // Refresh the trigger's tooltip so the live value is visible.
            anchor.title = baseTitle ? `${baseTitle}: ${args.writeValue(clamped)}` : args.writeValue(clamped);
        };
        range.addEventListener('input', () => sync(Number(range.value), 'range'));
        num.addEventListener('input', () => sync(Number(num.value), 'number'));

        wrap.appendChild(range);
        wrap.appendChild(num);
        wrap.appendChild(suffix);
        this.openPopoverWith(anchor, wrap);
    }

    // @ts-expect-error reserved helper for future numeric controls
    private numberStepper(args: {
        label: string;
        suffix?: string;
        min: number;
        max: number;
        value: number;
        onChange: (v: number) => void;
    }): HTMLElement {
        const wrap = document.createElement('label');
        wrap.className = 'exe-slide-tb__num';
        const lbl = document.createElement('span');
        lbl.className = 'exe-slide-tb__num-label';
        lbl.textContent = args.label;
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'exe-slide-tb__num-input';
        input.min = String(args.min);
        input.max = String(args.max);
        input.value = String(args.value);
        input.setAttribute('aria-label', args.label);
        input.addEventListener('change', () => {
            const v = Number(input.value);
            if (Number.isFinite(v)) args.onChange(v);
        });
        wrap.appendChild(lbl);
        wrap.appendChild(input);
        if (args.suffix) {
            const sfx = document.createElement('span');
            sfx.className = 'exe-slide-tb__num-suffix';
            sfx.textContent = args.suffix;
            wrap.appendChild(sfx);
        }
        return wrap;
    }

    private dropdown(args: {
        label: string;
        title: string;
        width: number;
        kind: 'font' | 'size';
        fontSample?: string;
        onOpen: (anchor: HTMLElement) => void;
    }): HTMLElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `exe-slide-tb__dd exe-slide-tb__dd--${args.kind}`;
        btn.title = args.title;
        btn.setAttribute('aria-label', args.title);
        btn.style.width = `${args.width}px`;
        btn.innerHTML =
            `<span class="exe-slide-tb__dd-label"${args.fontSample ? ` style="font-family:${args.fontSample}"` : ''}>${args.label}</span>` +
            renderIcon('caret', { size: 10 });
        btn.addEventListener('click', event => {
            event.preventDefault();
            args.onOpen(btn);
        });
        return btn;
    }

    private openFontPopover(anchor: HTMLElement, current: string): void {
        const list = document.createElement('div');
        list.className = 'exe-slide-pop__list';
        list.setAttribute('role', 'listbox');
        FONTS.forEach(font => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'exe-slide-pop__list-item';
            btn.style.fontFamily = font;
            btn.textContent = font.split(',')[0].replace(/"/g, '');
            if (font === current) btn.classList.add('exe-slide-pop__list-item--selected');
            btn.addEventListener('click', () => {
                this.ctrl.setFontFamily(font);
                this.closePopover();
            });
            list.appendChild(btn);
        });
        this.openPopoverWith(anchor, list, 220);
    }

    private openSizePopover(anchor: HTMLElement, current: number): void {
        const list = document.createElement('div');
        list.className = 'exe-slide-pop__list exe-slide-pop__list--narrow';
        list.setAttribute('role', 'listbox');
        FONT_SIZES.forEach(size => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'exe-slide-pop__list-item';
            btn.textContent = String(size);
            if (size === current) btn.classList.add('exe-slide-pop__list-item--selected');
            btn.addEventListener('click', () => {
                this.ctrl.setFontSize(size);
                this.closePopover();
            });
            list.appendChild(btn);
        });
        this.openPopoverWith(anchor, list, 80);
    }

    private openColorPopover(
        anchor: HTMLElement,
        initial: string | null,
        allowNone: boolean,
        title: string,
        onPick: (color: string | null) => void,
    ): void {
        const content = buildColorPopover({
            title,
            initial,
            allowNone,
            onChange: c => {
                onPick(c);
                this.closePopover();
            },
        });
        this.openPopoverWith(anchor, content);
    }

    private openPopoverWith(anchor: HTMLElement, content: HTMLElement, _minWidth?: number): void {
        this.closePopover();
        this.openPopover = new Popover({
            anchor,
            host: this.popHost.getHost(),
            content,
            onClose: () => {
                this.openPopover = null;
            },
        });
    }

    private makeGroup(): HTMLElement {
        const g = document.createElement('div');
        g.className = 'exe-slide-tb__group';
        return g;
    }

    private divider(): HTMLElement {
        const sep = document.createElement('span');
        sep.className = 'exe-slide-tb__sep';
        sep.setAttribute('aria-hidden', 'true');
        return sep;
    }
}

// Re-export defaults so the editor can wire the contextual toolbar with the
// adapter's fallback colours when nothing is selected yet.
export { DEFAULT_FILL, DEFAULT_FONT_FAMILY, DEFAULT_STROKE };

function emptyInfo(): SelectionInfo {
    return {
        kind: 'none',
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
    };
}
