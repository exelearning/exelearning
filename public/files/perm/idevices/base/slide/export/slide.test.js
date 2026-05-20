/**
 * Tests for the Slide iDevice export renderer (slide.js).
 *
 * The renderer embeds a cached, sanitized SVG snapshot. It does not load
 * Fabric.js at runtime. These tests cover SVG embedding, responsiveness,
 * the scrubSvg defence-in-depth, and graceful null/empty handling.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportModule() {
    const code = readFileSync(join(__dirname, 'slide.js'), 'utf-8');
    const patched = code.replace(/^var\s+\$slide\s*=/, 'global.$slide =');
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
    return global.$slide;
}

const mod = loadExportModule();
const { _normalize, _scrubSvg, _render, renderView, renderBehaviour } = mod;

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide._normalize', () => {
    it('returns empty defaults when data is null', () => {
        const r = _normalize(null);
        expect(r.svg).toBe('');
        expect(r.width).toBeNull();
    });

    it('returns empty defaults when data is undefined', () => {
        const r = _normalize(undefined);
        expect(r.svg).toBe('');
        expect(r.width).toBeNull();
    });

    it('returns empty defaults for invalid JSON string', () => {
        const r = _normalize('not-json');
        expect(r.svg).toBe('');
    });

    it('returns svg string from saved data', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
        const r = _normalize({ version: 3, engine: 'fabric', fabric: {}, svg });
        expect(r.svg).toBe(svg);
    });

    it('returns empty svg when field is missing', () => {
        const r = _normalize({ version: 3, engine: 'fabric', fabric: {} });
        expect(r.svg).toBe('');
    });

    it('parses data from JSON string input', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
        const r = _normalize(JSON.stringify({ version: 3, engine: 'fabric', fabric: {}, svg }));
        expect(r.svg).toBe(svg);
    });

    it('passes through width when set', () => {
        const r = _normalize({ svg: '<svg/>', width: 800 });
        expect(r.width).toBe(800);
    });

    it('returns null width when zero or missing', () => {
        expect(_normalize({ svg: '<svg/>', width: 0 }).width).toBeNull();
        expect(_normalize({ svg: '<svg/>' }).width).toBeNull();
    });

    it('returns null width when not a number', () => {
        expect(_normalize({ svg: '<svg/>', width: 'wide' }).width).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide._scrubSvg', () => {
    it('removes <script> blocks', () => {
        const svg = '<svg><script>alert(1)</script><rect/></svg>';
        expect(_scrubSvg(svg)).not.toContain('<script');
    });

    it('removes inline event handlers (double-quoted)', () => {
        const svg = '<svg><rect onclick="alert(1)" width="10"/></svg>';
        const out = _scrubSvg(svg);
        expect(out).not.toContain('onclick');
        expect(out).toContain('width="10"');
    });

    it('removes inline event handlers (single-quoted)', () => {
        const svg = "<svg><rect onmouseover='evil()' /></svg>";
        expect(_scrubSvg(svg)).not.toContain('onmouseover');
    });

    it('strips javascript: URLs', () => {
        const svg = '<svg><a href="javascript:alert(1)"><rect/></a></svg>';
        expect(_scrubSvg(svg)).not.toContain('javascript:');
    });

    it('returns empty string for non-string input', () => {
        expect(_scrubSvg(null)).toBe('');
        expect(_scrubSvg(undefined)).toBe('');
        expect(_scrubSvg(42)).toBe('');
        expect(_scrubSvg('')).toBe('');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide.renderView', () => {
    it('renders svg data inside the slide-export-fabric wrapper', () => {
        const data = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"></svg>' };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('slide-export-fabric');
    });

    it('makes SVG responsive: replaces width with 100%', () => {
        const data = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"></svg>' };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('width="100%"');
        expect(result).not.toContain('width="1280"');
    });

    it('removes fixed height attribute from SVG', () => {
        const data = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect/></svg>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('height="720"');
    });

    it('handles empty svg by emitting just the wrapper and button', () => {
        const result = renderView({ svg: '' }, {}, '{content}');
        expect(result).toContain('slide-export-fabric');
        expect(result).toContain('slide-fullscreen-btn');
        expect(result).not.toContain('{content}');
    });

    it('handles null data gracefully', () => {
        const result = renderView(null, {}, '{content}');
        expect(result).toContain('slide-export-fabric');
    });

    it('replaces {content} placeholder with SVG wrapper', () => {
        const data = { svg: '<svg/>' };
        const result = renderView(data, {}, '<section>{content}</section>');
        expect(result).toContain('<section>');
        expect(result).not.toContain('{content}');
    });

    it('uses fallback template when template is empty', () => {
        const result = renderView({ svg: '<svg/>' }, {}, '');
        expect(result).toContain('slide-export-fabric');
    });

    it('applies inline max-width style when width is set', () => {
        const data = { svg: '<svg/>', width: 800 };
        const result = renderView(data, {}, '{content}');
        expect(result).toContain('style="max-width:800px"');
    });

    it('does not add inline style when width is absent', () => {
        const data = { svg: '<svg/>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('style="max-width:');
    });

    it('renders a fullscreen button', () => {
        const result = renderView({ svg: '<svg/>' }, {}, '{content}');
        expect(result).toContain('slide-fullscreen-btn');
        expect(result).toContain('aria-label="Fullscreen"');
    });

    it('strips <script> from cached SVG', () => {
        const data = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert(1)');
    });

    it('strips inline event handlers from cached SVG', () => {
        const data = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="10"/></svg>' };
        const result = renderView(data, {}, '{content}');
        expect(result).not.toContain('onclick');
    });

    it('preserves benign SVG content (rect, text, paths)', () => {
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50" fill="red"/><text x="10" y="10">Hi</text></svg>';
        const result = renderView({ svg }, {}, '{content}');
        expect(result).toContain('<rect');
        expect(result).toContain('Hi');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide.init', () => {
    it('caches normalized state on the module', () => {
        const out = mod.init({ svg: '<svg/>', width: 1024, height: 768 });
        expect(out).toBe(true);
        expect(mod._state).toEqual({ svg: '<svg/>', width: 1024, height: 768 });
    });

    it('handles null input', () => {
        const out = mod.init(null);
        expect(out).toBe(true);
        expect(mod._state).toEqual({ svg: '', width: null, height: null });
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$slide.renderBehaviour', () => {
    beforeAll(async () => {
        delete document._slideExportWired;
        await renderBehaviour();
    });

    it('returns a Promise that resolves to undefined', async () => {
        const p = renderBehaviour();
        expect(p).toBeInstanceOf(Promise);
        await expect(p).resolves.toBeUndefined();
    });

    it('is idempotent: calling multiple times does not wire delegation twice', async () => {
        await renderBehaviour();
        await renderBehaviour();
    });

    it('activates CSS simulation on click when Fullscreen API is unavailable', () => {
        const wrap = document.createElement('div');
        wrap.className = 'slide-export-fabric';
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
        const wrap = document.createElement('div');
        wrap.className = 'slide-export-fabric slide-fs-active';
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

    it('ignores clicks outside the slide wrapper', () => {
        const stray = document.createElement('div');
        const btn = document.createElement('button');
        stray.appendChild(btn);
        document.body.appendChild(stray);

        // Should not throw — and no wrapper exists, so nothing happens.
        expect(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();

        document.body.removeChild(stray);
    });
});
