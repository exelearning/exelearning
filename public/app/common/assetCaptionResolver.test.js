import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    extractAssetId,
    renderFigureCaption,
    renderAssetCaptions,
    observeAssetCaptions,
} from './assetCaptionResolver.js';

function figureHtml(inner) {
    const wrap = document.createElement('div');
    wrap.innerHTML = inner.trim();
    return wrap.firstElementChild;
}

describe('extractAssetId', () => {
    it('reads an explicit data-asset-id', () => {
        const fig = figureHtml('<figure class="exe-figure" data-asset-id="u1"><img src="x"></figure>');
        expect(extractAssetId(fig)).toBe('u1');
    });

    it('derives the id from an asset:// image src when data-asset-id is missing', () => {
        const fig = figureHtml('<figure class="exe-figure"><img src="asset://abc123.jpg"></figure>');
        expect(extractAssetId(fig)).toBe('abc123');
    });

    it('returns null when there is no asset reference', () => {
        const fig = figureHtml('<figure class="exe-figure"><img src="https://x/y.jpg"></figure>');
        expect(extractAssetId(fig)).toBeNull();
    });
});

describe('renderFigureCaption', () => {
    it('builds the figcaption from centralized metadata + per-instance data attributes', () => {
        const fig = figureHtml(
            '<figure class="exe-figure" data-asset-id="u1" data-caption-heading="Figure 1"><img src="asset://u1.jpg"></figure>',
        );
        renderFigureCaption(fig, { title: 'Sunset', author: 'Ada', license: 'Creative Commons BY' });

        expect(fig.querySelector('.figcaption.header strong').textContent).toBe('Figure 1');
        const cap = fig.querySelector('figcaption.figcaption');
        expect(cap).not.toBeNull();
        expect(cap.querySelector('.title em').textContent).toBe('Sunset');
        expect(cap.querySelector('.author').textContent).toBe('Ada');
        expect(cap.querySelector('a.license[rel~="license"]')).not.toBeNull();
        // The header sits before the image, the figcaption after it.
        const kids = Array.from(fig.children).map(n => n.tagName.toLowerCase() + (n.className ? '.' + n.className.split(' ')[0] : ''));
        expect(kids[0]).toContain('div');
        expect(kids[1]).toBe('img');
        expect(kids[2]).toBe('figcaption.figcaption');
    });

    it('renders no caption when hidden, removing any previous caption', () => {
        const fig = figureHtml(
            '<figure class="exe-figure" data-asset-id="u1" data-caption-hidden="true"><img src="asset://u1.jpg"><figcaption class="figcaption">stale</figcaption></figure>',
        );
        renderFigureCaption(fig, { title: 'Sunset', license: 'Creative Commons BY' });
        expect(fig.querySelector('figcaption')).toBeNull();
        expect(fig.querySelector('.figcaption.header')).toBeNull();
    });

    it('is idempotent — re-rendering replaces the previous caption rather than appending', () => {
        const fig = figureHtml('<figure class="exe-figure" data-asset-id="u1"><img src="asset://u1.jpg"></figure>');
        renderFigureCaption(fig, { title: 'First' });
        renderFigureCaption(fig, { title: 'Second' });
        expect(fig.querySelectorAll('figcaption.figcaption').length).toBe(1);
        expect(fig.querySelector('.title em').textContent).toBe('Second');
    });

    it('stamps data-asset-id on a legacy figure derived from the image src', () => {
        const fig = figureHtml('<figure class="exe-figure"><img src="asset://legacy9.png"></figure>');
        renderFigureCaption(fig, { title: 'X' });
        expect(fig.getAttribute('data-asset-id')).toBe('legacy9');
    });

    it('falls back to per-instance text when the asset has no centralized metadata', () => {
        const fig = figureHtml(
            '<figure class="exe-figure" data-asset-id="u1" data-caption-notes="A note"><img src="asset://u1.jpg"></figure>',
        );
        renderFigureCaption(fig, null);
        expect(fig.querySelector('.notes').textContent).toBe('A note');
        expect(fig.querySelector('.title')).toBeNull();
    });
});

describe('renderAssetCaptions', () => {
    let root;
    beforeEach(() => {
        root = document.createElement('div');
        root.innerHTML = `
            <figure class="exe-figure" data-asset-id="u1"><img src="asset://u1.jpg"></figure>
            <figure class="exe-figure"><img src="asset://u2.png"></figure>
            <p>not a figure</p>
        `;
    });

    it('resolves every asset figure under the root using the metadata getter', () => {
        const meta = { u1: { title: 'One' }, u2: { title: 'Two', license: 'GNU/GPL' } };
        const count = renderAssetCaptions(root, id => meta[id] || null);
        expect(count).toBe(2);
        const titles = Array.from(root.querySelectorAll('figcaption .title em')).map(n => n.textContent);
        expect(titles.sort()).toEqual(['One', 'Two']);
    });

    it('returns 0 and does nothing when there are no asset figures', () => {
        const empty = document.createElement('div');
        empty.innerHTML = '<p>plain</p>';
        expect(renderAssetCaptions(empty, () => null)).toBe(0);
    });
});

describe('observeAssetCaptions', () => {
    function mockAssetManager(store) {
        const observers = [];
        return {
            _fire: () => observers.forEach(cb => cb()),
            getAssetMetadata: id => store[id] || null,
            getAssetsYMap: () => ({
                observe: cb => observers.push(cb),
                unobserve: cb => {
                    const i = observers.indexOf(cb);
                    if (i >= 0) observers.splice(i, 1);
                },
            }),
        };
    }

    let root;
    beforeEach(() => {
        root = document.createElement('div');
        root.innerHTML = '<figure class="exe-figure" data-asset-id="u1"><img src="asset://u1.jpg"></figure>';
    });

    it('renders captions immediately and re-renders (debounced) when assets change', () => {
        vi.useFakeTimers();
        const store = { u1: { title: 'Before' } };
        const am = mockAssetManager(store);

        const dispose = observeAssetCaptions(root, am);
        expect(root.querySelector('.title em').textContent).toBe('Before');

        store.u1 = { title: 'After' };
        am._fire();
        am._fire(); // bursts coalesce into a single re-render
        expect(root.querySelector('.title em').textContent).toBe('Before'); // not yet (debounced)
        vi.runAllTimers();
        expect(root.querySelector('.title em').textContent).toBe('After');

        expect(typeof dispose).toBe('function');
        dispose();
        vi.useRealTimers();
    });

    it('is a safe no-op when the asset manager cannot observe', () => {
        expect(() => observeAssetCaptions(root, null)).not.toThrow();
        expect(() => observeAssetCaptions(root, {})).not.toThrow();
    });
});
