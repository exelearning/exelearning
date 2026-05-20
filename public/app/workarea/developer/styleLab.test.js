import { initStyleLab } from './styleLab.js';

function setupDom() {
    document.body.innerHTML = `
        <div id="icon-sprite-host"></div>
        <main class="workspace" data-base-path="/exe" data-testid="style-lab-root">
            <aside>
                <div id="seg-layout"><button data-value="desktop">D</button><button data-value="mobile">M</button><button class="is-active" data-value="split">B</button></div>
                <div id="seg-mode"><button class="is-active" data-value="web">W</button><button data-value="single">S</button><button data-value="scorm">C</button></div>
                <select id="fixture-select"></select>
                <div id="theme-list"></div>
                <span id="theme-count"></span>
            </aside>
            <section>
                <span id="ct-theme"></span>
                <span id="ct-mode"></span>
                <button id="btn-refresh"></button>
                <div id="canvas-body"></div>
                <iframe id="preview-desktop"></iframe>
                <iframe id="preview-mobile"></iframe>
                <div id="canvas-empty"></div>
            </section>
        </main>
    `;
}

function mockPreview() {
    const calls = [];
    const factory = vi.fn(() => ({ refresh: vi.fn(state => calls.push(state)) }));
    return { factory, calls };
}

function mockApis({ themes = [], fixtures = [] }) {
    return vi.fn(url => Promise.resolve({
        ok: true,
        json: async () => url.includes('/api/themes/') ? { themes } : { fixtures },
    }));
}

describe('initStyleLab', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => '' });
    });

    it('fetches themes + fixtures, defaults to first theme/fixture and triggers refresh', async () => {
        setupDom();
        const themes = [
            { dirName: 'base', displayName: 'Base', type: 'base' },
            { dirName: 'modern', displayName: 'Modern', type: 'base', isDefault: true },
        ];
        const fixtures = [
            { id: 'a.elpx', label: 'a' },
            { id: 'b.elpx', label: 'b' },
        ];
        const fetchFn = mockApis({ themes, fixtures });
        const { factory, calls } = mockPreview();

        await initStyleLab({ fetchFn, previewFactory: factory });

        expect(fetchFn).toHaveBeenCalledWith('/exe/api/themes/installed');
        expect(fetchFn).toHaveBeenCalledWith('/exe/developer/fixtures');
        expect(document.querySelectorAll('#fixture-select option')[0].value).toBe('a.elpx');
        expect(document.getElementById('theme-count').textContent).toBe('2');
        expect(calls.at(-1)).toEqual({ fixture: 'a.elpx', theme: 'modern', mode: 'web' });
        expect(document.getElementById('ct-theme').textContent).toBe('Modern');
    });

    it('refreshes preview when fixture changes', async () => {
        setupDom();
        const { factory, calls } = mockPreview();
        await initStyleLab({
            fetchFn: mockApis({
                themes: [{ dirName: 'base', displayName: 'Base', type: 'base' }],
                fixtures: [{ id: 'a.elpx', label: 'a' }, { id: 'b.elpx', label: 'b' }],
            }),
            previewFactory: factory,
        });
        calls.length = 0;
        const sel = document.getElementById('fixture-select');
        sel.value = 'b.elpx';
        sel.dispatchEvent(new Event('change'));
        expect(calls.at(-1)).toEqual({ fixture: 'b.elpx', theme: 'base', mode: 'web' });
    });

    it('refreshes preview when a theme item is clicked', async () => {
        setupDom();
        const { factory, calls } = mockPreview();
        await initStyleLab({
            fetchFn: mockApis({
                themes: [{ dirName: 'a', displayName: 'A', type: 'base' }, { dirName: 'b', displayName: 'B', type: 'base' }],
                fixtures: [{ id: 'x.elpx', label: 'x' }],
            }),
            previewFactory: factory,
        });
        calls.length = 0;
        document.querySelector('.theme-item[data-dir="b"]').click();
        expect(calls.at(-1)).toEqual({ fixture: 'x.elpx', theme: 'b', mode: 'web' });
        expect(document.querySelector('.theme-item[data-dir="b"]').classList.contains('is-active')).toBe(true);
    });

    it('refreshes preview when mode segmented changes', async () => {
        setupDom();
        const { factory, calls } = mockPreview();
        await initStyleLab({
            fetchFn: mockApis({
                themes: [{ dirName: 'a', displayName: 'A', type: 'base' }],
                fixtures: [{ id: 'x.elpx', label: 'x' }],
            }),
            previewFactory: factory,
        });
        calls.length = 0;
        document.querySelector('#seg-mode [data-value="scorm"]').click();
        expect(calls.at(-1)).toEqual({ fixture: 'x.elpx', theme: 'a', mode: 'scorm' });
    });

    it('handles fetch failure gracefully', async () => {
        setupDom();
        const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
        await initStyleLab({ fetchFn, previewFactory: mockPreview().factory });
        expect(document.getElementById('theme-count').textContent).toBe('0');
        expect(document.querySelectorAll('.theme-item').length).toBe(0);
    });
});
