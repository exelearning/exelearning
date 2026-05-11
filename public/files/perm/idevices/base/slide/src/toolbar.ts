/**
 * Slide iDevice — top toolbar.
 *
 * Layout (left → right):
 *   1. History group — undo / redo
 *   2. Tools group — text, sticky note, image, shape picker
 *   3. Contextual zone — controls for the current selection (or hint
 *      text when nothing is selected)
 *
 * The toolbar is intentionally Fabric-free: every action delegates to the
 * controller, which is the editor.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { renderIcon, type IconName } from './icons.js';
import { t } from './i18n.js';
import { SlideShapePicker, type ShapePickerController } from './shapePicker.js';
import type { ShapeKind } from './shapes.js';
import { SlideContextualToolbar, type ContextualController } from './contextualToolbar.js';

export interface ToolbarController extends ContextualController {
    addTextBox: () => void;
    addImage: () => void;
    addShape: (kind: ShapeKind) => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

interface ButtonSpec {
    id: string;
    testId: string;
    icon: IconName;
    label: string;
    handler: (ctrl: ToolbarController) => void;
    requireUndo?: boolean;
    requireRedo?: boolean;
}

const HISTORY_SPECS: ButtonSpec[] = [
    {
        id: 'undo',
        testId: 'slide-action-undo',
        icon: 'undo',
        label: 'Undo',
        requireUndo: true,
        handler: c => c.undo(),
    },
    {
        id: 'redo',
        testId: 'slide-action-redo',
        icon: 'redo',
        label: 'Redo',
        requireRedo: true,
        handler: c => c.redo(),
    },
];

const TOOL_SPECS: ButtonSpec[] = [
    {
        id: 'text',
        testId: 'slide-tool-text',
        icon: 'text',
        label: 'Add text',
        handler: c => c.addTextBox(),
    },
    {
        id: 'image',
        testId: 'slide-tool-image',
        icon: 'image',
        label: 'Add image',
        handler: c => c.addImage(),
    },
];

interface PopoverHostLike {
    getHost(): HTMLElement;
}

export class SlideToolbar {
    readonly root: HTMLElement;
    readonly picker: SlideShapePicker;
    readonly contextual: SlideContextualToolbar;
    /** Right-side slot where canvas-level controls (size / bg / zoom) mount. */
    readonly trailing: HTMLElement;
    private buttons: Map<string, HTMLButtonElement> = new Map();
    private cleanupFns: Array<() => void> = [];

    constructor(private ctrl: ToolbarController, popHost: PopoverHostLike) {
        this.root = document.createElement('div');
        this.root.className = 'exe-slide-tb';
        this.root.setAttribute('role', 'toolbar');
        this.root.setAttribute('aria-label', t('Slide editor toolbar'));
        this.root.setAttribute('data-testid', 'slide-toolbar');

        const pickerCtrl: ShapePickerController = {
            onPick: kind => this.ctrl.addShape(kind),
        };
        this.picker = new SlideShapePicker(pickerCtrl);
        this.contextual = new SlideContextualToolbar(this.ctrl, popHost);
        this.trailing = document.createElement('div');
        this.trailing.className = 'exe-slide-tb__trailing';

        this.build();
    }

    setHistoryState(canUndo: boolean, canRedo: boolean): void {
        const undoBtn = this.buttons.get('undo');
        const redoBtn = this.buttons.get('redo');
        if (undoBtn) undoBtn.disabled = !canUndo;
        if (redoBtn) redoBtn.disabled = !canRedo;
    }

    /** Mount the picker popup into a host so it can position itself. */
    mountPickerPopup(host: HTMLElement): void {
        this.picker.mountPopup(host);
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
        this.buttons.clear();
        this.picker.destroy();
        this.contextual.destroy();
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    private build(): void {
        const historyGroup = this.makeGroup();
        HISTORY_SPECS.forEach(spec => historyGroup.appendChild(this.makeButton(spec)));
        this.root.appendChild(historyGroup);

        this.root.appendChild(this.divider());

        const toolGroup = this.makeGroup();
        TOOL_SPECS.forEach(spec => toolGroup.appendChild(this.makeButton(spec)));
        // Shape picker dropdown lives in the tools group.
        toolGroup.appendChild(this.picker.trigger);
        this.root.appendChild(toolGroup);

        this.root.appendChild(this.divider());

        // The contextual zone fills the rest of the toolbar. The actual
        // children are managed by SlideContextualToolbar based on what's
        // currently selected on the canvas.
        this.root.appendChild(this.contextual.root);

        // Trailing slot — canvas-level controls (size, background, zoom).
        this.root.appendChild(this.divider());
        this.root.appendChild(this.trailing);
    }

    private makeGroup(): HTMLElement {
        const g = document.createElement('div');
        g.className = 'exe-slide-tb__group';
        return g;
    }

    private divider(): HTMLElement {
        const d = document.createElement('span');
        d.className = 'exe-slide-tb__sep';
        d.setAttribute('aria-hidden', 'true');
        return d;
    }

    private makeButton(spec: ButtonSpec): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `exe-slide-tb__btn exe-slide-tb__btn--${spec.id}`;
        btn.dataset.toolId = spec.id;
        btn.setAttribute('data-testid', spec.testId);
        btn.title = t(spec.label);
        btn.setAttribute('aria-label', t(spec.label));
        btn.innerHTML = renderIcon(spec.icon);
        if (spec.requireUndo || spec.requireRedo) btn.disabled = true;

        const onClick = (event: Event) => {
            event.preventDefault();
            spec.handler(this.ctrl);
        };
        btn.addEventListener('click', onClick);
        this.cleanupFns.push(() => btn.removeEventListener('click', onClick));

        this.buttons.set(spec.id, btn);
        return btn;
    }
}
