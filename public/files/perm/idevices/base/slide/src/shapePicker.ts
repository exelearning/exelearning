/**
 * Slide iDevice — categorized shape picker (Google-Docs style).
 *
 * Renders a popup grouped into Formas / Flechas / Llamadas. Picking a
 * shape calls the controller, which arms the canvas's drag-to-draw mode.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import type { ShapeKind } from './shapes.js';
import { renderIcon } from './icons.js';
import { t } from './i18n.js';

export interface ShapePickerController {
    onPick: (kind: ShapeKind) => void;
}

interface ShapeEntry {
    kind: ShapeKind;
    label: string;
    icon: string; // SVG path / inner markup
}

interface ShapeCategory {
    key: 'formas' | 'flechas' | 'llamadas';
    label: string;
    entries: ShapeEntry[];
}

function svg(inner: string, viewBox = '0 0 24 24'): string {
    return `<svg viewBox="${viewBox}" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
}

const CATEGORIES: ShapeCategory[] = [
    {
        key: 'formas',
        label: 'Shapes',
        entries: [
            { kind: 'rect', label: 'Rectangle', icon: svg('<rect x="4" y="6" width="16" height="12" rx="0.5"/>') },
            {
                kind: 'rounded-rect',
                label: 'Rounded rectangle',
                icon: svg('<rect x="4" y="6" width="16" height="12" rx="3"/>'),
            },
            { kind: 'circle', label: 'Circle', icon: svg('<circle cx="12" cy="12" r="7"/>') },
            { kind: 'ellipse', label: 'Ellipse', icon: svg('<ellipse cx="12" cy="12" rx="9" ry="6"/>') },
            { kind: 'triangle', label: 'Triangle', icon: svg('<path d="M12 4 L21 19 L3 19 Z"/>') },
            { kind: 'diamond', label: 'Diamond', icon: svg('<path d="M12 4 L20 12 L12 20 L4 12 Z"/>') },
            {
                kind: 'pentagon',
                label: 'Pentagon',
                icon: svg('<path d="M12 4 L20 10 L17 19 L7 19 L4 10 Z"/>'),
            },
            {
                kind: 'hexagon',
                label: 'Hexagon',
                icon: svg('<path d="M7 4 L17 4 L21 12 L17 20 L7 20 L3 12 Z"/>'),
            },
            {
                kind: 'star',
                label: 'Star',
                icon: svg(
                    '<path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20 L12 17 L6.5 20 L8 14 L3 9.5 L9.5 9 Z"/>',
                ),
            },
            {
                kind: 'parallelogram',
                label: 'Parallelogram',
                icon: svg('<path d="M7 6 L21 6 L17 18 L3 18 Z"/>'),
            },
            {
                kind: 'heart',
                label: 'Heart',
                icon: svg(
                    '<path d="M12 20 C 6 16 3 12 3 8 C 3 5 5 3 8 3 C 10 3 11 4 12 6 C 13 4 14 3 16 3 C 19 3 21 5 21 8 C 21 12 18 16 12 20 Z" fill="currentColor" stroke="none"/>',
                ),
            },
            { kind: 'line', label: 'Line', icon: svg('<path d="M4 18 L20 6"/>') },
        ],
    },
    {
        key: 'flechas',
        label: 'Arrows',
        entries: [
            {
                kind: 'arrow',
                label: 'Arrow right',
                icon: svg('<path d="M4 12 H17"/><path d="M14 8 L18 12 L14 16" fill="currentColor" stroke="currentColor"/>'),
            },
            {
                kind: 'arrow-left',
                label: 'Arrow left',
                icon: svg('<path d="M20 12 H7"/><path d="M10 8 L6 12 L10 16" fill="currentColor" stroke="currentColor"/>'),
            },
            {
                kind: 'arrow-up',
                label: 'Arrow up',
                icon: svg('<path d="M12 20 V7"/><path d="M8 10 L12 6 L16 10" fill="currentColor" stroke="currentColor"/>'),
            },
            {
                kind: 'arrow-down',
                label: 'Arrow down',
                icon: svg('<path d="M12 4 V17"/><path d="M8 14 L12 18 L16 14" fill="currentColor" stroke="currentColor"/>'),
            },
        ],
    },
    {
        key: 'llamadas',
        label: 'Callouts',
        entries: [
            {
                kind: 'speech-bubble',
                label: 'Speech bubble',
                icon: svg(
                    '<path d="M4 5 H20 A1 1 0 0 1 21 6 V15 A1 1 0 0 1 20 16 H10 L7 20 L7 16 H4 A1 1 0 0 1 3 15 V6 A1 1 0 0 1 4 5 Z"/>',
                ),
            },
            {
                kind: 'thought-bubble',
                label: 'Thought bubble',
                icon: svg(
                    '<path d="M5 9 a3 3 0 0 1 5 -2 a3 3 0 0 1 5 0 a3 3 0 0 1 5 2 a3 3 0 0 1 -2 5 a3 3 0 0 1 -5 1 a3 3 0 0 1 -5 -1 a3 3 0 0 1 -3 -5 Z"/><circle cx="6" cy="19" r="1.4"/><circle cx="3" cy="22" r="0.9"/>',
                ),
            },
        ],
    },
];

export class SlideShapePicker {
    readonly trigger: HTMLButtonElement;
    private popup: HTMLDivElement;
    private isOpen = false;
    private cleanupFns: Array<() => void> = [];

    constructor(private ctrl: ShapePickerController) {
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        // Match the rest of the top toolbar (exe-slide-tb__btn) so the
        // shape picker doesn't pick up the browser default 1 px button
        // border that made it look "boxed". The legacy class is kept as
        // a hook for the older e2e specs that still target it.
        this.trigger.className = 'exe-slide-tb__btn exe-slide-tb__btn--shapes exe-slide-toolbar__button';
        this.trigger.setAttribute('data-testid', 'slide-tool-shapes');
        this.trigger.title = t('Shapes');
        this.trigger.setAttribute('aria-label', t('Shapes'));
        this.trigger.setAttribute('aria-haspopup', 'true');
        this.trigger.setAttribute('aria-expanded', 'false');
        // Use the shared icon library so the trigger stays in lock-step
        // with the rest of the design (three-primitive "shapes" glyph).
        this.trigger.innerHTML = renderIcon('shape');

        this.popup = document.createElement('div');
        this.popup.className = 'exe-slide-shape-popup';
        this.popup.setAttribute('role', 'menu');
        this.popup.setAttribute('data-testid', 'slide-shape-popup');
        this.popup.hidden = true;
        this.buildPopup();

        const onTriggerClick = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggle();
        };
        this.trigger.addEventListener('click', onTriggerClick);
        this.cleanupFns.push(() => this.trigger.removeEventListener('click', onTriggerClick));

        const onDocClick = (event: Event) => {
            if (!this.isOpen) return;
            const target = event.target as Node | null;
            if (target && (this.popup.contains(target) || this.trigger.contains(target))) return;
            this.close();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && this.isOpen) this.close();
        };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKeyDown);
        this.cleanupFns.push(() => document.removeEventListener('click', onDocClick));
        this.cleanupFns.push(() => document.removeEventListener('keydown', onKeyDown));
    }

    private buildPopup(): void {
        CATEGORIES.forEach(cat => {
            const section = document.createElement('div');
            section.className = 'exe-slide-shape-popup__section';
            section.setAttribute('data-category', cat.key);
            const heading = document.createElement('div');
            heading.className = 'exe-slide-shape-popup__heading';
            heading.textContent = t(cat.label);
            section.appendChild(heading);
            const grid = document.createElement('div');
            grid.className = 'exe-slide-shape-popup__grid';
            cat.entries.forEach(entry => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'exe-slide-shape-popup__item';
                btn.setAttribute('data-shape', entry.kind);
                btn.setAttribute('data-testid', `slide-shape-${entry.kind}`);
                btn.title = t(entry.label);
                btn.setAttribute('aria-label', t(entry.label));
                btn.innerHTML = entry.icon;
                const onPick = (event: Event) => {
                    event.preventDefault();
                    this.close();
                    this.ctrl.onPick(entry.kind);
                };
                btn.addEventListener('click', onPick);
                this.cleanupFns.push(() => btn.removeEventListener('click', onPick));
                grid.appendChild(btn);
            });
            section.appendChild(grid);
            this.popup.appendChild(section);
        });
    }

    /**
     * Mount the popup onto the toolbar wrapper. The popup positions itself
     * absolutely relative to the host so it floats above the canvas.
     */
    mountPopup(host: HTMLElement): void {
        host.appendChild(this.popup);
    }

    open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.popup.hidden = false;
        this.trigger.setAttribute('aria-expanded', 'true');
        this.position();
    }

    close(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.popup.hidden = true;
        this.trigger.setAttribute('aria-expanded', 'false');
    }

    toggle(): void {
        this.isOpen ? this.close() : this.open();
    }

    private position(): void {
        const rect = this.trigger.getBoundingClientRect();
        const host = this.popup.parentElement;
        if (!host) return;
        const hostRect = host.getBoundingClientRect();
        this.popup.style.top = `${rect.bottom - hostRect.top + 6}px`;
        this.popup.style.left = `${Math.max(8, rect.left - hostRect.left)}px`;
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
        if (this.popup.parentNode) this.popup.parentNode.removeChild(this.popup);
        if (this.trigger.parentNode) this.trigger.parentNode.removeChild(this.trigger);
    }
}
