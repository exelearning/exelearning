/**
 * Slide iDevice — popover positioning helper.
 *
 * Tiny floating panel that anchors below a trigger element, watches for
 * outside-clicks, and tears itself down. The host scopes positioning so
 * the popover appears in the iDevice's coordinate space (not the page),
 * keeping the editor self-contained.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface PopoverOptions {
    /** Element the popover should align beneath. */
    anchor: HTMLElement;
    /** DOM element the popover is appended to (positioning context). */
    host: HTMLElement;
    /** Inner content (already constructed). */
    content: HTMLElement;
    /**
     * Whether the popover anchors above (`up`) or below (`down`) the
     * trigger. Defaults to `down`. Use `up` for triggers that live in the
     * bottom status bar so the popover doesn't fall off-screen.
     */
    direction?: 'up' | 'down';
    /** Optional callback fired when the popover dismisses. */
    onClose?: () => void;
}

export class Popover {
    readonly root: HTMLElement;
    private cleanupFns: Array<() => void> = [];
    private opts: PopoverOptions;

    constructor(opts: PopoverOptions) {
        this.opts = opts;
        this.root = document.createElement('div');
        this.root.className = 'exe-slide-pop';
        this.root.setAttribute('role', 'dialog');
        this.root.appendChild(opts.content);
        opts.host.appendChild(this.root);
        this.position();

        const onDocPointer = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (this.root.contains(target) || opts.anchor.contains(target)) return;
            this.close();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') this.close();
        };
        // Pointer-down catches clicks that happen anywhere on the page
        // (including inside Fabric's canvas overlay).
        document.addEventListener('mousedown', onDocPointer, true);
        document.addEventListener('keydown', onKey);
        this.cleanupFns.push(() => document.removeEventListener('mousedown', onDocPointer, true));
        this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));
    }

    private position(): void {
        const aRect = this.opts.anchor.getBoundingClientRect();
        const hRect = this.opts.host.getBoundingClientRect();
        const popHeight = this.root.offsetHeight || 240;
        const popWidth = this.root.offsetWidth || 240;

        if (this.opts.direction === 'up') {
            // Anchor the bottom of the popover above the top of the trigger.
            const topInHost = aRect.top - hRect.top;
            const top = Math.max(8, topInHost - popHeight - 4);
            this.root.style.top = `${top}px`;
        } else {
            const top = aRect.bottom - hRect.top + 4;
            this.root.style.top = `${top}px`;
        }

        // Clamp horizontally so the popover stays inside the host.
        const naturalLeft = aRect.left - hRect.left;
        const maxLeft = Math.max(8, hRect.width - popWidth - 8);
        const left = Math.min(Math.max(8, naturalLeft), maxLeft);
        this.root.style.left = `${left}px`;
    }

    close(): void {
        if (!this.root.parentNode) return;
        this.cleanupFns.forEach(fn => {
            try {
                fn();
            } catch {
                /* ignore */
            }
        });
        this.cleanupFns = [];
        this.root.parentNode.removeChild(this.root);
        this.opts.onClose?.();
    }
}
