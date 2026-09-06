import { beforeEach, describe, expect, it } from 'bun:test';
import { createMediaModal, type MediaModal } from './modal';

/**
 * The dialog a bridged video plays in.
 *
 * The state machine is the part worth testing, and it is subtler than it looks: HIDING and
 * CLOSING both end up calling `dialog.close()`, so the platform reports them identically.
 * Telling them apart matters because closing is reported to the content — an iDevice that
 * believes the learner shut the video will stop driving it — while hiding is temporary and
 * must not be.
 */
interface StubElement {
    tag: string;
    attrs: Record<string, string>;
    className: string;
    textContent: string;
    children: StubElement[];
    listeners: Record<string, ((event?: unknown) => void)[]>;
    removed: boolean;
    shown: number;
    closedCalls: number;
}

let created: StubElement[];
let closes: number;
let translated: string[];
let modal: MediaModal;

function element(tag: string): StubElement {
    const node: StubElement = {
        tag,
        attrs: {},
        className: '',
        textContent: '',
        children: [],
        listeners: {},
        removed: false,
        shown: 0,
        closedCalls: 0,
    };
    Object.assign(node, {
        setAttribute: (name: string, value: string) => {
            node.attrs[name] = value;
        },
        addEventListener: (type: string, fn: (event?: unknown) => void) => {
            node.listeners[type] = [...(node.listeners[type] ?? []), fn];
        },
        appendChild: (child: StubElement) => node.children.push(child),
        remove: () => {
            node.removed = true;
        },
        showModal: () => {
            node.shown += 1;
        },
        close: () => {
            node.closedCalls += 1;
            // The platform fires `close` for BOTH a programmatic close and a user dismissal.
            node.listeners.close?.forEach(fn => fn());
        },
    });
    created.push(node);
    return node;
}

const dialog = () => created.find(node => node.tag === 'dialog') as StubElement;
const closeButton = () => created.find(node => node.tag === 'button') as StubElement;
const fire = (node: StubElement, type: string, event?: unknown) => node.listeners[type]?.forEach(fn => fn(event));

function build(): MediaModal {
    const body = element('body-root');
    return createMediaModal({
        doc: { createElement: element, body: body as never } as never,
        translate: key => {
            translated.push(key);
            return `«${key}»`;
        },
        onClose: () => {
            closes += 1;
        },
    });
}

beforeEach(() => {
    created = [];
    closes = 0;
    translated = [];
    modal = build();
});

describe('building', () => {
    it('opens as a modal dialog', () => {
        expect(dialog().tag).toBe('dialog');
        expect(dialog().shown).toBe(1);
    });

    /** Screen-reader users get a named dialog and a named control, not "button". */
    it('labels the dialog and its close control', () => {
        expect(dialog().attrs['aria-label']).toBeTruthy();
        expect(closeButton().attrs['aria-label']).toBeTruthy();
        expect(closeButton().textContent).toBeTruthy();
    });

    /** Every visible string goes through the caller's translator, none are baked in. */
    it('translates everything it shows', () => {
        expect(translated.length).toBeGreaterThanOrEqual(3);
        expect(dialog().attrs['aria-label']).toStartWith('«');
        expect(closeButton().textContent).toStartWith('«');
    });

    it('asks for light dismiss where the engine supports it', () => {
        expect(dialog().attrs.closedby).toBe('any');
    });

    it('gives the player somewhere to live', () => {
        expect(modal.body()).toBe(dialog().children.find(c => c.tag === 'div') as never);
    });

    it('is an explicit button, so it is reachable by keyboard', () => {
        expect(closeButton().attrs.type).toBe('button');
    });
});

describe('closing', () => {
    it('reports a close when the close button is pressed', () => {
        fire(closeButton(), 'click');

        expect(closes).toBe(1);
        expect(modal.isClosed()).toBe(true);
    });

    /** Esc, or the platform's own close affordance. */
    it('reports a close when the platform dismisses the dialog', () => {
        fire(dialog(), 'close');

        expect(closes).toBe(1);
    });

    /**
     * Safari has no `closedby`, so a click landing on the dialog element itself is the
     * backdrop. A click on anything inside it is not.
     */
    it('reports a close when the backdrop is clicked, but not the contents', () => {
        fire(dialog(), 'click', { target: modal.body() });
        expect(closes).toBe(0);

        fire(dialog(), 'click', { target: dialog() });
        expect(closes).toBe(1);
    });

    it('reports a close exactly once however many ways it is asked', () => {
        fire(closeButton(), 'click');
        fire(closeButton(), 'click');
        fire(dialog(), 'close');
        modal.close();

        expect(closes).toBe(1);
    });

    it('takes the dialog out of the document', () => {
        modal.close();

        expect(dialog().removed).toBe(true);
    });
});

describe('hiding, which is not closing', () => {
    /**
     * The case the flag exists for. `hide()` calls `dialog.close()`, so the platform fires
     * the same `close` event a user dismissal fires. Reporting it would tell the content
     * the learner shut the video, and an iDevice that believes that stops driving it.
     */
    it('does not report a close', () => {
        modal.hide();

        expect(closes).toBe(0);
        expect(modal.isClosed()).toBe(false);
    });

    it('can be shown again afterwards', () => {
        modal.hide();
        modal.show();

        expect(dialog().shown).toBe(2);
    });

    /** And after hiding, a real dismissal must still be reported. */
    it('leaves a genuine close still reportable', () => {
        modal.hide();
        modal.show();
        fire(dialog(), 'close');

        expect(closes).toBe(1);
    });

    it('does nothing when hidden twice', () => {
        modal.hide();
        modal.hide();

        expect(closes).toBe(0);
    });
});

describe('an engine without dialog support', () => {
    /** Older engines have no `showModal`; the modal must degrade, not throw. */
    it('builds and closes without throwing', () => {
        const plain = (tag: string) => {
            const node = element(tag);
            (node as unknown as { showModal?: unknown }).showModal = undefined;
            (node as unknown as { close?: unknown }).close = undefined;
            return node;
        };
        const fallback = createMediaModal({
            doc: { createElement: plain, body: element('body-root') as never } as never,
            translate: key => key,
            onClose: () => {
                closes += 1;
            },
        });

        expect(() => fallback.show()).not.toThrow();
        expect(() => fallback.hide()).not.toThrow();
        expect(() => fallback.close()).not.toThrow();
        expect(closes).toBe(1);
    });
});
