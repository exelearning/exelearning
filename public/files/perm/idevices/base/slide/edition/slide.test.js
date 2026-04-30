/**
 * Tests for the Slide iDevice edition module (slide.js).
 *
 * The edition module is an IIFE that assigns window.$exeDevice.
 * We mock __slideEditorInit so no real React/tldraw bundle is needed.
 * Tests focus on: bundle loading, init/save API,
 * error-path behaviour, and the data contract.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildContainerMock() {
    const attrs = { 'idevice-id': 'test-idevice-id' };
    const children = [];
    const obj = {
        classList: { add: vi.fn() },
        getAttribute: (attr) => attrs[attr] || null,
        _children: children,
        appendChild: vi.fn(function (child) { children.push(child); }),
        removeChild: vi.fn(function (child) {
            const i = children.indexOf(child);
            if (i !== -1) children.splice(i, 1);
        }),
        contains: vi.fn(function (child) { return children.includes(child); }),
    };
    // innerHTML = '' must clear tracked children, mirroring real DOM behaviour
    Object.defineProperty(obj, 'innerHTML', {
        set(v) { if (v === '') children.splice(0, children.length); },
        get() { return ''; },
    });
    return obj;
}

function buildMockEditorApi() {
    return {
        getStoreSnapshot: vi.fn(() => ({ store: { 'document:document': {} }, schema: {} })),
        getSvgString:     vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    };
}

// ── Module setup ──────────────────────────────────────────────────────────────

let container;
let $exeDevice;

beforeEach(async () => {
    delete global.window.__slideBundlePromise;
    delete global.window.$exeDevice;
    delete global.window.__slideEditorInit;

    global.window._ = (k) => k;

    const code = await import('./slide.js?raw').then(m => m.default);
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', code)(global.window, global.document);

    $exeDevice = global.window.$exeDevice;
    container  = buildContainerMock();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('$exeDevice public API', () => {
    it('exposes init and save methods', () => {
        expect(typeof $exeDevice.init).toBe('function');
        expect(typeof $exeDevice.save).toBe('function');
    });

    it('init returns undefined (async, no return value)', () => {
        global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
        const result = $exeDevice.init(container, null, '/path/');
        expect(result).toBeUndefined();
    });

    it('save returns null when editor not yet ready', () => {
        expect($exeDevice.save()).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('loadBundle', () => {
    it('uses existing __slideEditorInit if already on window', async () => {
        const mockApi = buildMockEditorApi();
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };

        $exeDevice.init(container, null, '/path/');
        await new Promise(r => setTimeout(r, 0));

        expect(global.window.__slideEditorInit.mount).toHaveBeenCalled();
    });

    it('shows error message when bundle fails to load', async () => {
        delete global.window.__slideEditorInit;

        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'script') {
                const script = { onload: null, onerror: null, type: '', src: '' };
                setTimeout(() => script.onerror && script.onerror(new Error('404')), 0);
                return script;
            }
            return createElement(tag);
        });
        vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});

        $exeDevice.init(container, null, '/bad/path/');
        await new Promise(r => setTimeout(r, 50));

        // Error element is inside the host div, not directly in container
        const host = container._children.find(c => c.className === 'slide-editor-tldraw-host');
        expect(host).toBeDefined();
        const errEl = host.querySelector('.slide-error');
        expect(errEl).toBeDefined();
        expect(errEl.textContent).toContain('Could not load');
    });

    it('reuses existing __slideBundlePromise for concurrent inits', async () => {
        delete global.window.__slideEditorInit;
        let resolveScript;

        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'script') {
                const script = { onload: null, onerror: null, type: '', src: '' };
                resolveScript = () => {
                    global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
                    script.onload && script.onload();
                };
                return script;
            }
            return createElement(tag);
        });
        const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});

        const c2 = buildContainerMock();
        $exeDevice.init(container, null, '/path/');
        $exeDevice.init(c2, null, '/path/');

        resolveScript();
        await new Promise(r => setTimeout(r, 0));

        // Only one <script> element should have been created
        expect(appendSpy).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('after init (with __slideEditorInit already loaded)', () => {
    let mockApi;

    async function initEditor(previousData) {
        mockApi = buildMockEditorApi();
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, previousData, '/path/');
        await new Promise(r => setTimeout(r, 0));
    }

    it('save returns object with version 2, store and svg', async () => {
        await initEditor(null);
        const data = $exeDevice.save();
        expect(data).not.toBeNull();
        expect(data.version).toBe(2);
        expect(data.store).toBeDefined();
        expect(data.svg).toBeDefined();
    });

    it('save includes width and height with defaults when previousData is null', async () => {
        await initEditor(null);
        const data = $exeDevice.save();
        expect(data.width).toBe(960);
        expect(data.height).toBe(600);
    });

    it('save restores width and height from previousData', async () => {
        await initEditor({ version: 2, store: {}, svg: '', width: 800, height: 450 });
        const data = $exeDevice.save();
        expect(data.width).toBe(800);
        expect(data.height).toBe(450);
    });

    it('save includes ideviceId from container attribute', async () => {
        await initEditor(null);
        expect($exeDevice.save().ideviceId).toBe('test-idevice-id');
    });

    it('save returns svg string from editor API', async () => {
        await initEditor(null);
        expect($exeDevice.save().svg).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    });

    it('passes previousData to mount', async () => {
        const previousData = { version: 2, store: {}, svg: '<svg/>' };
        await initEditor(previousData);
        expect(global.window.__slideEditorInit.mount).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ previousData }),
        );
    });

    it('passes bundlePath (the edition path) to mount', async () => {
        await initEditor(null);
        expect(global.window.__slideEditorInit.mount).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ bundlePath: '/path/' }),
        );
    });

    it('removes loading indicator before mounting editor', async () => {
        await initEditor(null);
        // Loading element is inside the host div, not a direct child of container
        const host = container._children.find(c => c.className === 'slide-editor-tldraw-host');
        expect(host).toBeDefined();
        expect(host.querySelector('.slide-loading')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('init with various previousData inputs', () => {
    async function initWithData(data) {
        const mockApi = buildMockEditorApi();
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, data, '/path/');
        await new Promise(r => setTimeout(r, 0));
    }

    it('handles null previousData without errors', async () => {
        await expect(initWithData(null)).resolves.toBeUndefined();
    });

    it('handles undefined previousData without errors', async () => {
        await expect(initWithData(undefined)).resolves.toBeUndefined();
    });

    it('handles version 2 previousData (tldraw)', async () => {
        await expect(initWithData({ version: 2, store: {}, svg: '<svg/>' })).resolves.toBeUndefined();
    });

    it('handles version 1 previousData (Fabric legacy) without errors', async () => {
        const v1Data = { version: 1, fabric: { background: '#fff', objects: [] } };
        await expect(initWithData(v1Data)).resolves.toBeUndefined();
    });

    it('handles invalid JSON string without errors', async () => {
        await expect(initWithData('not-valid-json')).resolves.toBeUndefined();
    });
});
