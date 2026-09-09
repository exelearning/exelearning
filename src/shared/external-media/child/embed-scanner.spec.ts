import { describe, expect, it } from 'bun:test';
import {
    collect,
    promote,
    EMBED_ID_ATTR,
    EMBED_PROVIDER_ATTR,
    EMBED_RESOURCE_ATTR,
    EMBED_URL_ATTR,
    type ScanCounter,
} from './embed-scanner';
import type { RuntimeWindow } from './environment';

/**
 * A minimal DOM stub rather than a DOM engine.
 *
 * happy-dom's `querySelectorAll` throws under raw `bun test` (it reaches for a
 * `window.SyntaxError` that is not there), and the alternative — a real browser — is
 * already covering this code end to end in `external-media-artifacts.spec.ts`. What is
 * worth asserting here is the scanner's DECISIONS: which srcs it promotes, and which
 * attributes it stamps on the placeholder. A stub states those precisely.
 */

interface StubElement {
    tag: string;
    attrs: Record<string, string>;
    className: string;
    style: Record<string, string>;
    parentNode: StubParent | null;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

interface StubParent {
    children: StubElement[];
    ownerDocument: { createElement(tag: string): StubElement };
    querySelectorAll(selector: string): StubElement[];
    replaceChild(next: StubElement, previous: StubElement): void;
}

function element(tag: string, attrs: Record<string, string> = {}): StubElement {
    return {
        tag,
        attrs: { ...attrs },
        className: attrs.class ?? '',
        style: {},
        parentNode: null,
        getAttribute(name) {
            return name in this.attrs ? this.attrs[name] : null;
        },
        setAttribute(name, value) {
            this.attrs[name] = value;
        },
        getBoundingClientRect: () => ({ left: 4, top: 8, width: 560, height: 315 }),
    };
}

function container(children: StubElement[]): StubParent {
    const parent: StubParent = {
        children,
        ownerDocument: { createElement: (tag: string) => element(tag) },
        querySelectorAll(selector: string) {
            if (selector === 'iframe[src]') {
                return this.children.filter(child => child.tag === 'iframe' && child.getAttribute('src'));
            }
            const attr = selector.replace(/^\[|\]$/g, '');
            return this.children.filter(child => child.getAttribute(attr) !== null);
        },
        replaceChild(next, previous) {
            this.children = this.children.map(child => (child === previous ? next : child));
            next.parentNode = this;
        },
    };
    for (const child of children) child.parentNode = parent;
    return parent;
}

const win = { location: { href: 'https://lms.example/preview/page.html' } } as RuntimeWindow;
const counter = (): ScanCounter => ({ n: 0 });
const run = (parent: StubParent) => promote(parent as never, counter(), win);

describe('promote', () => {
    it('replaces a recognised provider embed and reports provider + id, not the URL', () => {
        const parent = container([
            element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ', width: '560', height: '315' }),
        ]);

        const created = run(parent);

        expect(created).toHaveLength(1);
        expect(created[0].getAttribute(EMBED_ID_ATTR)).toBe('exe-embed-1');
        expect(created[0].getAttribute(EMBED_PROVIDER_ATTR)).toBe('youtube');
        expect(created[0].getAttribute(EMBED_RESOURCE_ATTR)).toBe('aqz-KE-bpKQ');
        expect(parent.children[0].tag).toBe('div');
    });

    it('reserves the original box so the page does not reflow under the placeholder', () => {
        const parent = container([
            element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ', width: '560', height: '315' }),
        ]);
        const [placeholder] = run(parent);
        expect(placeholder.style.width).toBe('560px');
        expect(placeholder.style.height).toBe('315px');
    });

    it('falls back to the measured box when the iframe declares no size', () => {
        const parent = container([element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ' })]);
        const [placeholder] = run(parent);
        expect(placeholder.style.width).toBe('560px');
        expect(placeholder.style.height).toBe('315px');
    });

    it('resolves a relative src against the CONTENT location', () => {
        const parent = container([element('iframe', { src: 'handout.pdf' })]);
        const [placeholder] = run(parent);
        expect(placeholder.getAttribute(EMBED_URL_ATTR)).toBe('https://lms.example/preview/handout.pdf');
    });

    it('promotes an unknown cross-origin provider by URL only', () => {
        const parent = container([element('iframe', { src: 'https://example.com/player' })]);
        const [placeholder] = run(parent);
        expect(placeholder.getAttribute(EMBED_URL_ATTR)).toBe('https://example.com/player');
        expect(placeholder.getAttribute(EMBED_PROVIDER_ATTR)).toBeNull();
    });

    it('leaves same-origin content and non-promotable embeds alone', () => {
        const parent = container([
            element('iframe', { src: './local.html' }),
            element('iframe', { src: 'http://insecure.example/x' }),
        ]);
        expect(run(parent)).toHaveLength(0);
        expect(parent.children.every(child => child.tag === 'iframe')).toBe(true);
    });

    it('never promotes the same embed twice', () => {
        const parent = container([element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ' })]);
        const shared = counter();
        promote(parent as never, shared, win);
        const second = promote(parent as never, shared, win);
        expect(second).toHaveLength(0);
    });

    it('gives each embed a distinct id across repeated scans', () => {
        const shared = counter();
        const first = container([element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ' })]);
        const second = container([element('iframe', { src: 'https://example.com/player' })]);
        const a = promote(first as never, shared, win);
        const b = promote(second as never, shared, win);
        expect(a[0].getAttribute(EMBED_ID_ATTR)).not.toBe(b[0].getAttribute(EMBED_ID_ATTR));
    });
});

describe('collect', () => {
    it('reports the geometry and identity of every placeholder', () => {
        const parent = container([
            element('iframe', { src: 'https://www.youtube.com/embed/aqz-KE-bpKQ', width: '560', height: '315' }),
        ]);
        run(parent);

        const [record] = collect(parent as never);
        expect(record.id).toBe('exe-embed-1');
        expect(record).toMatchObject({ x: 4, y: 8, w: 560, h: 315 });
        expect(record.provider).toBe('youtube');
        expect(record.objectId).toBe('aqz-KE-bpKQ');
    });

    it('omits provider fields for an embed reported by URL', () => {
        const parent = container([element('iframe', { src: 'https://example.com/player' })]);
        run(parent);

        const [record] = collect(parent as never);
        expect(record.provider).toBeUndefined();
        expect(record.objectId).toBeUndefined();
        expect(record.url).toBe('https://example.com/player');
    });

    it('reports nothing when nothing was promoted', () => {
        expect(collect(container([element('iframe', { src: './local.html' })]) as never)).toEqual([]);
    });
});
