/**
 * Tests for the Slide iDevice export renderer (slide.js).
 *
 * Version 2 (tldraw): embeds cached SVG directly — tested for SVG embedding,
 * responsiveness, and graceful null/empty handling.
 *
 * Version 1 (Fabric.js legacy): converts saved Fabric JSON into static HTML
 * without any Fabric.js dependency.  Positions/sizes expressed as percentages
 * relative to a 960×540 stage.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

function loadExportModule() {
    const code = readFileSync(join(__dirname, 'slide.js'), 'utf-8');
    const patched = code.replace(/^var\s+\$slide\s*=/, 'global.$slide =');
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
    return global.$slide;
}

const mod = loadExportModule();
const { _normalize, _buildMarkup, renderView, renderBehaviour } = mod;

// ─────────────────────────────────────────────────────────────────────────────
// Version 2 — tldraw SVG path
// ─────────────────────────────────────────────────────────────────────────────

describe('$slide._normalize — version 2', () => {
    it('detects version 2 and returns _version=2', () => {
        const data = { version: 2, store: {}, svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' };
        const r = _normalize(data);
        expect(r._version).toBe(2);
    });

    it('returns svg string from version 2 data', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
        const data = { version: 2, store: {}, svg };
        const r = _normalize(data);
        expect(r.svg).toBe(svg);
    });

    it('returns empty svg when version 2 data has no svg field', () => {
        const data = { version: 2, store: {} };
        const r = _normalize(data);
        expect(r.svg).toBe('');
    });

    it('parses version 2 data from JSON string', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
        const r = _normalize(JSON.stringify({ version: 2, store: {}, svg }));
        expect(r._version).toBe(2);
        expect(r.svg).toBe(svg);
    });

    it('passes through width when set in version 2 data', () => {
        const data = { version: 2, store: {}, svg: '', width: 800 };
        const r = _normalize(data);
        expect(r.width).toBe(800);
    });

    it('returns null width when version 2 data has no width', () => {
        const data = { version: 2, store: {}, svg: '' };
        const r = _normalize(data);
        expect(r.width).toBeNull();
    });
});

describe('$slide.renderView — version 2', () => {
    it('renders version 2 data with slide-export-tldraw wrapper', () => {
        const data = {
            version: 2,
            store: {},
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"></svg>',
        };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('slide-export-tldraw');
    });

    it('makes SVG responsive: replaces width with 100%', () => {
        const data = {
            version: 2,
            store: {},
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"></svg>',
        };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('width="100%"');
        expect(result).not.toContain('width="960"');
    });

    it('removes fixed height attribute from SVG', () => {
        const data = {
            version: 2,
            store: {},
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect/></svg>',
        };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('height="540"');
    });

    it('handles empty svg string gracefully', () => {
        const data = { version: 2, store: {}, svg: '' };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('slide-export-tldraw');
        expect(result).not.toContain('{content}');
    });

    it('replaces {content} placeholder with SVG wrapper', () => {
        const data = { version: 2, store: {}, svg: '<svg/>' };
        const result = renderView(data, {}, '<section>{content}</section>');
        expect(result).toContain('<section>');
        expect(result).not.toContain('{content}');
    });

    it('uses fallback template when template is empty', () => {
        const data = { version: 2, store: {}, svg: '<svg/>' };
        const result = renderView(data, {}, '');
        expect(result).toContain('slide-export-tldraw');
    });

    it('does not render slide-export-canvas for version 2 data', () => {
        const data = { version: 2, store: {}, svg: '<svg/>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('slide-export-canvas');
    });

    it('applies inline max-width style when width is set', () => {
        const data = { version: 2, store: {}, svg: '<svg/>', width: 800 };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('style="max-width:800px"');
    });

    it('does not add inline style when width is absent', () => {
        const data = { version: 2, store: {}, svg: '<svg/>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('style="max-width:');
    });

    it('renders a fullscreen button for version 2 data', () => {
        const data = { version: 2, store: {}, svg: '<svg/>' };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('slide-fullscreen-btn');
        expect(result).toContain('aria-label="Fullscreen"');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Version 1 — Fabric.js legacy path  (all original tests preserved)
// ─────────────────────────────────────────────────────────────────────────────

describe('$slide._normalize — version 1 (Fabric legacy)', () => {
    it('returns empty default when data is null', () => {
        const r = _normalize(null);
        expect(r._version).toBe(1);
        expect(r.background).toBe('#ffffff');
        expect(r.objects).toEqual([]);
    });

    it('returns empty default for invalid JSON string', () => {
        const r = _normalize('not-json');
        expect(r._version).toBe(1);
        expect(r.background).toBe('#ffffff');
        expect(r.objects).toEqual([]);
    });

    it('parses current format: { version: 1, fabric: { background, objects } }', () => {
        const data = {
            version: 1,
            fabric: {
                background: '#ff0000',
                objects: [
                    { type: 'i-text', id: 'a', left: 10, top: 20, width: 100, height: 50, text: 'Hello', __z: 0 },
                ],
            },
        };
        const r = _normalize(data);
        expect(r.background).toBe('#ff0000');
        expect(r.objects).toHaveLength(1);
        expect(r.objects[0].text).toBe('Hello');
    });

    it('parses bare fabric JSON: { background, objects }', () => {
        const data = {
            background: '#00ff00',
            objects: [{ type: 'rect', id: 'r1', left: 0, top: 0, width: 200, height: 100, __z: 0 }],
        };
        const r = _normalize(data);
        expect(r.background).toBe('#00ff00');
        expect(r.objects[0].type).toBe('rect');
    });

    it('parses legacy array format: { items: [...] }', () => {
        const data = {
            items: [
                { type: 'text', id: 'l1', x: 5, y: 5, width: 200, height: 80, text: 'Legacy', zIndex: 0 },
            ],
        };
        const r = _normalize(data);
        expect(r.objects).toHaveLength(1);
        expect(r.objects[0].type).toBe('i-text');
        expect(r.objects[0].text).toBe('Legacy');
    });

    it('normalizes legacy image item', () => {
        const data = {
            items: [
                { type: 'image', id: 'i1', x: 0, y: 0, width: 320, height: 200, src: 'asset://uuid/photo.jpg', alt: 'Photo', zIndex: 0 },
            ],
        };
        const r = _normalize(data);
        expect(r.objects[0].type).toBe('image');
        expect(r.objects[0].src).toBe('asset://uuid/photo.jpg');
    });

    it('sorts objects by __z index', () => {
        const data = {
            fabric: {
                background: '#fff',
                objects: [
                    { type: 'rect', id: 'b', __z: 2, left: 0, top: 0, width: 10, height: 10 },
                    { type: 'rect', id: 'a', __z: 0, left: 0, top: 0, width: 10, height: 10 },
                    { type: 'rect', id: 'c', __z: 1, left: 0, top: 0, width: 10, height: 10 },
                ],
            },
        };
        const r = _normalize(data);
        expect(r.objects.map(o => o.id)).toEqual(['a', 'c', 'b']);
    });

    it('clamps position and size to stage bounds', () => {
        const data = {
            fabric: {
                background: '#fff',
                objects: [{ type: 'i-text', id: 't', left: -100, top: -50, width: 9999, height: 9999, text: 'X', __z: 0 }],
            },
        };
        const r = _normalize(data);
        const obj = r.objects[0];
        expect(obj.left).toBe(0);
        expect(obj.top).toBe(0);
        expect(obj.width).toBe(960);
        expect(obj.height).toBe(540);
    });

    it('prefers assetSrc over src for image objects', () => {
        const data = {
            fabric: {
                background: '#fff',
                objects: [{ type: 'image', id: 'i', src: 'blob:http://old', assetSrc: 'asset://uuid/img.png', __z: 0, left: 0, top: 0, width: 200, height: 150 }],
            },
        };
        const r = _normalize(data);
        expect(r.objects[0].src).toBe('asset://uuid/img.png');
    });

    it('accepts JSON string input', () => {
        const data = JSON.stringify({ fabric: { background: '#abc', objects: [] } });
        const r = _normalize(data);
        expect(r.objects).toEqual([]);
    });

    it('falls back to white background for invalid hex like #gggggg', () => {
        const data = { fabric: { background: '#gggggg', objects: [] } };
        const r = _normalize(data);
        expect(r.background).toBe('#ffffff');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide._buildMarkup (version 1)', () => {
    it('wraps output in slide-export-canvas with background color', () => {
        const html = _buildMarkup({ background: '#123456', objects: [] });
        expect(html).toContain('class="slide-export-canvas"');
        expect(html).toContain('background:#123456');
    });

    it('renders i-text as slide-export-text div with text content', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'i-text', id: 't1',
                left: 100, top: 50, width: 200, height: 80,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                text: 'Hello World',
                fontFamily: 'Arial, sans-serif', fontSize: 18, fontWeight: 'bold',
                fill: '#000000', textAlign: 'left',
                backgroundColor: 'rgba(255,255,255,0)',
                stroke: 'rgba(0,0,0,0)', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('slide-export-text');
        expect(html).toContain('Hello World');
        expect(html).toContain('font-weight:bold');
        expect(html).toContain('font-size:18px');
    });

    it('escapes HTML special chars in text content', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'i-text', id: 'x',
                left: 0, top: 0, width: 100, height: 40,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                text: '<script>alert(1)</script>',
                fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal',
                fill: '#000', textAlign: 'left',
                backgroundColor: '', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('renders image as figure.slide-export-image with img tag', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'image', id: 'img1',
                left: 50, top: 30, width: 320, height: 200,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 0.9,
                src: 'asset://uuid/photo.jpg', alt: 'A photo',
                backgroundColor: '', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('slide-export-image');
        expect(html).toContain('src="asset://uuid/photo.jpg"');
        expect(html).toContain('alt="A photo"');
    });

    it('escapes XSS in image src and alt attributes', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'image', id: 'i', left: 0, top: 0, width: 100, height: 100,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                src: '" onerror="alert(1)', alt: '<bad>',
                backgroundColor: '', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('&quot;');
        expect(html).not.toContain('<bad>');
        expect(html).toContain('&lt;bad&gt;');
        expect(html).toMatch(/src="[^"]*&quot;[^"]*"/);
    });

    it('renders rect as slide-export-shape div', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'r1',
                left: 0, top: 0, width: 200, height: 100,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: 'rgba(14,165,233,0.25)',
                stroke: 'rgba(14,165,233,1)', strokeWidth: 2,
                rx: 12, ry: 12, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('slide-export-shape');
        expect(html).toContain('border-radius:12px');
    });

    it('renders circle with border-radius:50%', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'circle', id: 'c1',
                left: 0, top: 0, width: 180, height: 180,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: 'rgba(244,114,182,0.25)', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('border-radius:50%');
    });

    it('applies rotation transform when angle is non-zero', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'rot',
                left: 100, top: 100, width: 200, height: 100,
                scaleX: 1, scaleY: 1, angle: 45, opacity: 1,
                fill: '#ff0000', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('rotate(45deg)');
        expect(html).toContain('transform-origin:0 0');
    });

    it('does not add transform when angle is 0', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'no-rot',
                left: 0, top: 0, width: 100, height: 100,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: '#000', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).not.toContain('rotate');
    });

    it('applies opacity correctly', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'i-text', id: 'op',
                left: 0, top: 0, width: 100, height: 40,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5,
                text: 'Fade', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal',
                fill: '#000', textAlign: 'left', backgroundColor: '', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('opacity:0.5');
    });

    it('accounts for scale in percentage width and height', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 's1',
                left: 0, top: 0, width: 200, height: 100,
                scaleX: 2, scaleY: 2, angle: 0, opacity: 1,
                fill: '#000', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('41.6667%');
        expect(html).toContain('37.037');
    });

    it('renders border when strokeWidth > 0', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'brd',
                left: 0, top: 0, width: 100, height: 100,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: '#fff', stroke: '#ff0000', strokeWidth: 3, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('border:3px solid');
    });

    it('does not render border when strokeWidth is 0', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'no-brd',
                left: 0, top: 0, width: 100, height: 100,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: '#000', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).not.toContain('border:');
    });

    it('positions items using percentage values relative to 960x540', () => {
        const data = {
            background: '#fff',
            objects: [{
                type: 'rect', id: 'pos',
                left: 480, top: 270, width: 96, height: 54,
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                fill: '#000', stroke: '', strokeWidth: 0, __z: 0,
            }],
        };
        const html = _buildMarkup(data);
        expect(html).toContain('left:50.0000%');
        expect(html).toContain('top:50.0000%');
        expect(html).toContain('width:10.0000%');
        expect(html).toContain('height:10.0000%');
    });

    it('renders multiple objects maintaining z-index order', () => {
        const data = {
            background: '#fff',
            objects: [
                { type: 'rect', id: 'bottom', left: 0, top: 0, width: 100, height: 100, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, fill: '#red', stroke: '', strokeWidth: 0, __z: 0 },
                { type: 'rect', id: 'top',    left: 0, top: 0, width: 100, height: 100, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, fill: '#blue', stroke: '', strokeWidth: 0, __z: 1 },
            ],
        };
        const html = _buildMarkup(data);
        const zIndexes = [...html.matchAll(/z-index:(\d+)/g)].map(m => Number(m[1]));
        expect(zIndexes[0]).toBe(1);
        expect(zIndexes[1]).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide.renderView — version 1 (Fabric legacy)', () => {
    it('replaces {content} placeholder with slide markup', () => {
        const data = { fabric: { background: '#ffffff', objects: [] } };
        const result = renderView(data, {}, '<section>{content}</section>');
        expect(result).toContain('<section>');
        expect(result).toContain('slide-export-canvas');
        expect(result).not.toContain('{content}');
    });

    it('uses {content} fallback template when template is empty', () => {
        const data = { fabric: { background: '#ffffff', objects: [] } };
        const result = renderView(data, {}, '');
        expect(result).toContain('slide-export-canvas');
    });

    it('handles null data gracefully', () => {
        const result = renderView(null, {}, '{content}');
        expect(result).toContain('slide-export-canvas');
        expect(result).toContain('background:#ffffff');
    });

    it('renders a full slide with text and image', () => {
        const data = {
            fabric: {
                background: '#f0f0f0',
                objects: [
                    {
                        type: 'i-text', id: 'txt',
                        left: 50, top: 50, width: 300, height: 100,
                        scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                        text: 'My Slide', fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold',
                        fill: '#333333', textAlign: 'center',
                        backgroundColor: 'rgba(255,255,255,0.8)', stroke: '', strokeWidth: 0, __z: 0,
                    },
                    {
                        type: 'image', id: 'img',
                        left: 400, top: 100, width: 400, height: 300,
                        scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                        src: 'asset://uuid/hero.jpg', alt: 'Hero image',
                        backgroundColor: '', stroke: '', strokeWidth: 0, __z: 1,
                    },
                ],
            },
        };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('My Slide');
        expect(result).toContain('hero.jpg');
        expect(result).toContain('Hero image');
        expect(result).toContain('background:#f0f0f0');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide.renderBehaviour', () => {
    // Wire the delegation once for all tests in this suite.  Re-wiring on each
    // test would accumulate click listeners (document is shared within the file)
    // and cause interference between tests.
    beforeAll(async () => {
        delete document._slideExportWired;
        await renderBehaviour();
    });

    it('returns a Promise that resolves to undefined', async () => {
        // The idempotent second call must still return a resolving Promise.
        const p = renderBehaviour();
        expect(p).toBeInstanceOf(Promise);
        await expect(p).resolves.toBeUndefined();
    });

    it('is idempotent: calling multiple times does not wire the delegation twice', async () => {
        await renderBehaviour();
        await renderBehaviour();
        // Verified indirectly: activation test below would double-trigger if not idempotent
    });

    it('activates CSS simulation on click when Fullscreen API is unavailable', () => {
        const wrap = document.createElement('div');
        wrap.className = 'slide-export-tldraw';
        const btn = document.createElement('button');
        btn.className = 'slide-fullscreen-btn';
        wrap.appendChild(btn);
        document.body.appendChild(wrap);

        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(wrap.classList.contains('slide-fs-active')).toBe(true);
        expect(btn.getAttribute('aria-label')).toBe('Exit fullscreen');

        document.body.removeChild(wrap);
    });

    it('deactivates CSS simulation when clicking while already active', () => {
        // Start with the wrapper already in simulated-fullscreen state.
        const wrap = document.createElement('div');
        wrap.className = 'slide-export-tldraw slide-fs-active';
        const btn = document.createElement('button');
        btn.className = 'slide-fullscreen-btn';
        btn.setAttribute('aria-label', 'Exit fullscreen');
        wrap.appendChild(btn);
        document.body.appendChild(wrap);

        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(wrap.classList.contains('slide-fs-active')).toBe(false);
        expect(btn.getAttribute('aria-label')).toBe('Fullscreen');

        document.body.removeChild(wrap);
    });
});
