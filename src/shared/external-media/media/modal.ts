/**
 * The dialog a bridged video plays in.
 *
 * A native `<dialog>` rather than a hand-built overlay, because the platform already
 * provides what an accessible modal needs — focus trapping, inert background, Esc to
 * dismiss — and a reimplementation would be a worse version of it that has to be
 * maintained.
 *
 * The state machine is subtler than the markup. HIDING and CLOSING both end in
 * `dialog.close()`, so the platform reports them identically, and telling them apart is
 * load-bearing: closing is reported to the content, and an iDevice that believes the
 * learner shut the video stops driving it. Hiding is temporary and must stay silent.
 *
 * Every visible string is translated by the caller's function. Nothing user-facing is
 * baked in here.
 */

export interface ModalElement {
    className: string;
    textContent: string;
    setAttribute(name: string, value: string): void;
    addEventListener(type: string, listener: (event?: unknown) => void): void;
    appendChild(node: unknown): void;
    remove?(): void;
    showModal?(): void;
    close?(): void;
}

export interface MediaModalOptions {
    doc: { createElement(tag: string): ModalElement; body?: ModalElement; documentElement?: ModalElement };
    /** The caller's i18n function; every visible string passes through it. */
    translate(key: string): string;
    /** Called once, when the modal is genuinely dismissed — never when merely hidden. */
    onClose(): void;
}

export interface MediaModal {
    /** Where the player is mounted. */
    body(): ModalElement;
    show(): void;
    /** Temporarily dismiss without reporting a close. */
    hide(): void;
    /** Dismiss for good. Idempotent; reports at most once. */
    close(): void;
    isClosed(): boolean;
}

export function createMediaModal({ doc, translate, onClose }: MediaModalOptions): MediaModal {
    let closed = false;
    // Set while `hide()` is calling `close()`, so the resulting `close` event can be told
    // apart from a user dismissal. Without it, hiding reports a close.
    let hiding = false;

    const dialog = doc.createElement('dialog');
    dialog.className = 'exe-media-modal';
    dialog.setAttribute('aria-label', translate('Video player'));
    try {
        // Light dismiss where supported; harmless where the attribute is unknown.
        dialog.setAttribute('closedby', 'any');
    } catch {
        // Older engines reject unknown attributes on some elements.
    }

    const closeButton = doc.createElement('button');
    // An explicit button rather than a styled div: focusable, keyboard-activated, and
    // announced as a button without help.
    closeButton.setAttribute('type', 'button');
    closeButton.className = 'exe-media-modal__close';
    closeButton.setAttribute('aria-label', translate('Close video'));
    closeButton.textContent = translate('Close');

    const body = doc.createElement('div');
    body.className = 'exe-media-modal__body';

    dialog.appendChild(closeButton);
    dialog.appendChild(body);

    function requestClose(): void {
        if (closed) return;
        closed = true;
        dialog.close?.();
        dialog.remove?.();
        onClose();
    }

    closeButton.addEventListener('click', requestClose);
    // Safari has no `closedby`, so a click landing on the dialog ELEMENT is the backdrop;
    // a click on anything inside it is not.
    dialog.addEventListener('click', event => {
        if ((event as { target?: unknown })?.target === dialog) requestClose();
    });
    // Esc, or the platform's own dismissal.
    dialog.addEventListener('close', () => {
        if (hiding) {
            hiding = false;
            return;
        }
        requestClose();
    });

    (doc.body ?? doc.documentElement)?.appendChild(dialog);
    dialog.showModal?.();

    return {
        body: () => body,
        show: () => dialog.showModal?.(),
        hide() {
            if (closed) return;
            hiding = true;
            dialog.close?.();
            // Reset unconditionally: an engine that does not fire `close` would otherwise
            // leave the flag set and swallow the next genuine dismissal.
            hiding = false;
        },
        close: requestClose,
        isClosed: () => closed,
    };
}
