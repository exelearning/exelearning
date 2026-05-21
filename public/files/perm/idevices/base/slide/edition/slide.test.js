/**
 * Tests for the Slide iDevice edition bridge (slide.js).
 *
 * The bridge is an IIFE that assigns window.$exeDevice and dynamically
 * loads slide-editor.bundle.js (the Fabric.js editor). Tests mock the
 * bundle global so no real fabric/dompurify is needed.
 *
 * The bridge no longer hosts width/height/background controls — those
 * live inside the editor's bottom status bar. The bridge only mounts the
 * editor and forwards what the editor reports back.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildContainerMock() {
    const attrs = { 'idevice-id': 'test-idevice-id' };
    const children = [];
    const classes = new Set();
    const obj = {
        classList: {
            add: vi.fn(name => classes.add(name)),
            remove: vi.fn(name => classes.delete(name)),
            contains: vi.fn(name => classes.has(name)),
        },
        getAttribute: attr => attrs[attr] || null,
        setAttribute: vi.fn((name, value) => {
            attrs[name] = value;
        }),
        removeAttribute: vi.fn(name => {
            delete attrs[name];
        }),
        _attrs: attrs,
        _classes: classes,
        _children: children,
        appendChild: vi.fn(function (child) {
            children.push(child);
        }),
        removeChild: vi.fn(function (child) {
            const i = children.indexOf(child);
            if (i !== -1) children.splice(i, 1);
        }),
        contains: vi.fn(function (child) {
            return children.includes(child);
        }),
    };
    Object.defineProperty(obj, 'innerHTML', {
        set(v) {
            if (v === '') children.splice(0, children.length);
        },
        get() {
            return '';
        },
    });
    return obj;
}

function buildMockEditorApi(overrides = {}) {
    return {
        getFabricJSON: vi.fn(() => ({ version: '6.0.0', objects: [] })),
        getSvgString: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        getDimensions: vi.fn(() => ({ width: 1280, height: 720 })),
        getBackground: vi.fn(() => '#ffffff'),
        setDimensions: vi.fn(),
        setBackground: vi.fn(),
        destroy: vi.fn(),
        ...overrides,
    };
}

let container;
let $exeDevice;

beforeEach(async () => {
    delete global.window.__slideBundlePromise;
    delete global.window.$exeDevice;
    delete global.window.__slideEditorInit;
    global.window._ = k => k;

    const code = await import('./slide.js?raw').then(m => m.default);
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', code)(global.window, global.document);

    $exeDevice = global.window.$exeDevice;
    container = buildContainerMock();
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

    it('save returns null before the editor mounts', () => {
        expect($exeDevice.save()).toBeNull();
    });

    it('init applies the .exe-slide-idevice scope class to the container', () => {
        global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
        $exeDevice.init(container, null, '/path/');
        expect(container.classList.add).toHaveBeenCalledWith('exe-slide-idevice');
    });

    it('init tags the container with data-testid for E2E selection', () => {
        global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
        $exeDevice.init(container, null, '/path/');
        expect(container.setAttribute).toHaveBeenCalledWith('data-testid', 'slide-idevice');
    });

    it('init mounts a host wrapper inside the iDevice container', () => {
        global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
        $exeDevice.init(container, null, '/path/');
        const host = container._children.find(c => c.className === 'exe-slide-host');
        expect(host).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('loadBundle', () => {
    it('uses existing __slideEditorInit when already on window', async () => {
        const mockApi = buildMockEditorApi();
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, null, '/path/');
        await new Promise(r => setTimeout(r, 0));
        expect(global.window.__slideEditorInit.mount).toHaveBeenCalled();
    });

    it('shows error message when bundle fails to load', async () => {
        delete global.window.__slideEditorInit;

        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(tag => {
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

        const host = container._children.find(c => c.className === 'exe-slide-host');
        expect(host).toBeDefined();
        const errEl = host.querySelector('.exe-slide-error');
        expect(errEl).toBeDefined();
        expect(errEl.textContent).toContain('Could not load');
    });

    it('reuses existing __slideBundlePromise for concurrent inits', async () => {
        delete global.window.__slideEditorInit;
        let resolveScript;

        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(tag => {
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

        expect(appendSpy).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('save (after editor mount)', () => {
    let mockApi;

    async function initEditor(previousData) {
        mockApi = buildMockEditorApi();
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, previousData, '/path/');
        await new Promise(r => setTimeout(r, 0));
    }

    it('returns the v3 envelope with engine="fabric"', async () => {
        await initEditor(null);
        const data = $exeDevice.save();
        expect(data.version).toBe(3);
        expect(data.engine).toBe('fabric');
    });

    it('reads dimensions from the editor (status bar lives inside the bundle)', async () => {
        const apiOverrides = {
            getDimensions: vi.fn(() => ({ width: 1024, height: 768 })),
        };
        mockApi = buildMockEditorApi(apiOverrides);
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, null, '/path/');
        await new Promise(r => setTimeout(r, 0));
        const data = $exeDevice.save();
        expect(data.width).toBe(1024);
        expect(data.height).toBe(768);
        expect(mockApi.getDimensions).toHaveBeenCalled();
    });

    it('reads background from the editor', async () => {
        const apiOverrides = { getBackground: vi.fn(() => '#0ea5e9') };
        mockApi = buildMockEditorApi(apiOverrides);
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, null, '/path/');
        await new Promise(r => setTimeout(r, 0));
        expect($exeDevice.save().background).toBe('#0ea5e9');
    });

    it('falls back to defaults when the editor lacks getDimensions/getBackground', async () => {
        mockApi = buildMockEditorApi({ getDimensions: undefined, getBackground: undefined });
        global.window.__slideEditorInit = { mount: vi.fn(() => mockApi) };
        $exeDevice.init(container, null, '/path/');
        await new Promise(r => setTimeout(r, 0));
        const data = $exeDevice.save();
        expect(data.width).toBe(1280);
        expect(data.height).toBe(720);
        expect(data.background).toBe('#ffffff');
    });

    it('includes ideviceId from container attribute', async () => {
        await initEditor(null);
        expect($exeDevice.save().ideviceId).toBe('test-idevice-id');
    });

    it('includes svg snapshot from the editor', async () => {
        await initEditor(null);
        expect($exeDevice.save().svg).toContain('<svg');
    });

    it('passes previousData to mount verbatim', async () => {
        const previousData = { version: 3, engine: 'fabric', fabric: {}, svg: '<svg/>' };
        await initEditor(previousData);
        expect(global.window.__slideEditorInit.mount).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ previousData }),
        );
    });

    it('removes the loading indicator before mounting the editor', async () => {
        await initEditor(null);
        const host = container._children.find(c => c.className === 'exe-slide-host');
        expect(host).toBeDefined();
        expect(host.querySelector('.exe-slide-loading')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('init with various previousData inputs', () => {
    async function initWithData(data) {
        global.window.__slideEditorInit = { mount: vi.fn(() => buildMockEditorApi()) };
        $exeDevice.init(container, data, '/path/');
        await new Promise(r => setTimeout(r, 0));
    }

    it('handles null', async () => {
        await expect(initWithData(null)).resolves.toBeUndefined();
    });

    it('handles undefined', async () => {
        await expect(initWithData(undefined)).resolves.toBeUndefined();
    });

    it('handles a v3 fabric payload', async () => {
        await expect(
            initWithData({ version: 3, engine: 'fabric', fabric: {}, svg: '<svg/>' }),
        ).resolves.toBeUndefined();
    });

    it('handles a JSON-string payload', async () => {
        await expect(initWithData(JSON.stringify({ version: 3, engine: 'fabric', fabric: {} }))).resolves.toBeUndefined();
    });

    it('handles legacy v1 payloads', async () => {
        await expect(initWithData({ version: 1, html: '<p>old idevice</p>' })).resolves.toBeUndefined();
    });
});
