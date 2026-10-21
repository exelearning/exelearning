import { describe, expect, it, vi } from 'vitest';
import { printPreviewSnapshot } from './printPreviewSnapshot.js';

const documentWith = (html) => {
    const doc = document.implementation.createHTMLDocument('Preview');
    doc.title = 'Preview';
    doc.body.innerHTML = html;
    return doc;
};
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const png = (content) => new Blob([content], { type: 'image/png' });

describe('printPreviewSnapshot', () => {
    it('keeps live folds and the print option, without changing the original document', async () => {
        const doc = documentWith('<article class="box minimized"><div class="box-content" style="display:none">Closed</div></article><article class="box"><div class="box-content">Reopened</div></article>');
        doc.documentElement.classList.add('exe-print-as-shown');
        const original = doc.documentElement.outerHTML;
        const html = await printPreviewSnapshot(doc);
        const copy = parse(html);
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(copy.documentElement.classList.contains('exe-print-as-shown')).toBe(true);
        expect(copy.querySelector('.minimized .box-content').style.display).toBe('none');
        expect(copy.querySelectorAll('.minimized')).toHaveLength(1);
        expect(copy.title).toBe('Preview');
        expect(doc.documentElement.outerHTML).toBe(original);
    });

    it('retains styles and resources, but does not rerun scripts or event handlers', async () => {
        const doc = documentWith('<script>randomize()</script><img src="blob:asset" onload="randomize()"><a href="#test">Link</a>');
        doc.documentElement.setAttribute('onclick', 'randomize()');
        doc.head.innerHTML = '<link rel="stylesheet" href="blob:theme"><style>@media print { pre { color:red } }</style>';
        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelectorAll('script,[onload],[onclick]')).toHaveLength(0);
        expect(copy.querySelector('img').getAttribute('src')).toBe('blob:asset');
        expect(copy.querySelector('link').getAttribute('href')).toBe('blob:theme');
        expect(copy.querySelector('style').textContent).toContain('@media print');
        expect(copy.querySelector('meta[http-equiv=Content-Security-Policy]').content).toBe("script-src 'none'");
        expect(copy.querySelector('a').getAttribute('href')).toBe('#test');
        expect(doc.querySelector('script')).not.toBeNull();
        expect(doc.documentElement.hasAttribute('onclick')).toBe(true);
    });

    it('copies drawn canvases as images with their dimensions and presentation', async () => {
        const doc = documentWith('<canvas id="drawing" width="40" height="20" style="width:80px"></canvas>');
        const canvas = doc.querySelector('canvas');
        canvas.toDataURL = vi.fn(() => 'data:image/png;base64,cGl4ZWxz');
        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelector('canvas')).toBeNull();
        const image = copy.querySelector('#drawing');
        expect(image.tagName).toBe('IMG');
        expect(image.getAttribute('src')).toBe('data:image/png;base64,cGl4ZWxz');
        expect(image.width).toBe(40);
        expect(image.height).toBe(20);
        expect(image.style.width).toBe('80px');
        expect(doc.querySelector('canvas')).toBe(canvas);
    });

    it('leaves a canvas it cannot read as it is, and still copies the others', async () => {
        const doc = documentWith('<canvas id="tainted" width="10" height="10"></canvas><canvas id="drawing" width="40" height="20"></canvas>');
        doc.querySelector('#tainted').toDataURL = vi.fn(() => {
            throw new DOMException('Tainted canvases may not be exported.', 'SecurityError');
        });
        doc.querySelector('#drawing').toDataURL = vi.fn(() => 'data:image/png;base64,cGl4ZWxz');
        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelector('#tainted').tagName).toBe('CANVAS');
        expect(copy.querySelector('#drawing').tagName).toBe('IMG');
        expect(copy.querySelector('#drawing').getAttribute('src')).toBe('data:image/png;base64,cGl4ZWxz');
    });

    it('pictures a shown <model-viewer> in its place, and leaves the hidden, failing and undefined ones', async () => {
        const doc = documentWith(
            '<model-viewer id="shown" class="viewer" style="display:block" alt="A duck" loading="lazy" src="duck.glb"></model-viewer>' +
                '<model-viewer id="hidden" style="display:none"></model-viewer>' +
                '<model-viewer id="failing"></model-viewer>' +
                '<model-viewer id="undefined-element"></model-viewer>',
        );
        const [shown, hidden, failing, plain] = doc.querySelectorAll('model-viewer');
        const box = (width, height) => () => ({ width, height });
        shown.getBoundingClientRect = box(320, 240);
        shown.toBlob = vi.fn(async () => png('duck'));
        hidden.getBoundingClientRect = box(0, 0);
        hidden.toBlob = vi.fn(async () => png('hidden'));
        failing.getBoundingClientRect = box(100, 100);
        failing.toBlob = vi.fn(async () => {
            throw new Error('Unable to retrieve canvas blob');
        });
        plain.getBoundingClientRect = box(100, 100);

        const copy = parse(await printPreviewSnapshot(doc));
        const image = copy.querySelector('#shown');
        expect(image.tagName).toBe('IMG');
        expect(image.getAttribute('src')).toBe('data:image/png;base64,ZHVjaw==');
        expect(image.className).toBe('viewer');
        expect(image.getAttribute('alt')).toBe('A duck');
        // Only what presents it: loading="lazy" on an <img> could leave the picture unloaded on paper.
        expect(image.hasAttribute('loading')).toBe(false);
        expect(image.style.display).toBe('block');
        expect(image.style.width).toBe('320px');
        expect(image.style.maxWidth).toBe('100%');
        expect(hidden.toBlob).not.toHaveBeenCalled();
        expect(copy.querySelector('#hidden').tagName).toBe('MODEL-VIEWER');
        expect(copy.querySelector('#failing').tagName).toBe('MODEL-VIEWER');
        expect(copy.querySelector('#undefined-element').tagName).toBe('MODEL-VIEWER');
        expect(doc.querySelector('#shown')).toBe(shown);
    });

    it('pictures only what a <model-viewer> shows, not the canvas it shares with larger ones', async () => {
        // Beside a larger viewer, toDataURL() returns the shared canvas, the model in its corner;
        // toBlob() returns the viewer's own part of it.
        const doc = documentWith('<model-viewer id="small"></model-viewer>');
        const viewer = doc.querySelector('model-viewer');
        viewer.getBoundingClientRect = () => ({ width: 320, height: 180 });
        viewer.toDataURL = vi.fn(() => 'data:image/png;base64,c2hhcmVk');
        viewer.toBlob = vi.fn(async () => png('own'));

        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelector('#small').getAttribute('src')).toBe('data:image/png;base64,b3du');
        expect(viewer.toDataURL).not.toHaveBeenCalled();
    });

    it('pictures a <model-viewer> without upsetting the controls and canvases after it', async () => {
        const doc = documentWith(
            '<model-viewer><input id="inside" value="in"><canvas id="inner"></canvas></model-viewer>' +
                '<input id="after" value="old"><canvas id="drawing"></canvas>',
        );
        const viewer = doc.querySelector('model-viewer');
        viewer.getBoundingClientRect = () => ({ width: 200, height: 100 });
        viewer.toBlob = async () => png('viewer');
        doc.querySelector('#inner').toDataURL = () => 'data:image/png;base64,aW5uZXI=';
        doc.querySelector('#drawing').toDataURL = () => 'data:image/png;base64,ZHJhd2luZw==';
        doc.querySelector('#after').value = 'new';

        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelector('model-viewer')).toBeNull();
        expect(copy.querySelector('#after').value).toBe('new');
        expect(copy.querySelector('#drawing').getAttribute('src')).toBe('data:image/png;base64,ZHJhd2luZw==');
    });

    it('preserves edited values and selections, including unchecked controls', async () => {
        const doc = documentWith('<input value="old"><input type="checkbox" checked><textarea>old</textarea><select><option selected>Old</option><option>New</option></select>');
        doc.querySelector('input').value = 'New answer';
        doc.querySelector('input[type=checkbox]').checked = false;
        doc.querySelector('textarea').value = 'New text';
        doc.querySelector('select').selectedIndex = 1;
        const copy = parse(await printPreviewSnapshot(doc));
        expect(copy.querySelector('input').value).toBe('New answer');
        expect(copy.querySelector('input[type=checkbox]').checked).toBe(false);
        expect(copy.querySelector('textarea').value).toBe('New text');
        expect(copy.querySelector('select').selectedIndex).toBe(1);
    });
});
