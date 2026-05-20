import { initIdeviceLab } from './ideviceLab.js';

function setupDom() {
    document.body.innerHTML = `
        <div id="icon-sprite-host"></div>
        <main class="workspace" data-base-path="" data-testid="idevice-lab-root">
            <aside>
                <input id="idv-search">
                <div id="idv-list"></div>
                <span id="idv-count"></span>
            </aside>
            <section>
                <span id="ct-idv"></span>
                <span id="ct-cat"></span>
                <button id="btn-refresh"></button>
                <iframe id="idevice-host" hidden></iframe>
                <div id="canvas-empty"></div>
            </section>
        </main>
    `;
}

function mockApis({ idevices = [] }) {
    return vi.fn((url) => {
        if (url.includes('/api/idevices/')) {
            return Promise.resolve({ ok: true, json: async () => ({ idevices }) });
        }
        return Promise.resolve({ ok: false, status: 404, text: async () => 'not found' });
    });
}

describe('initIdeviceLab', () => {
    beforeEach(() => {
        try { sessionStorage.clear(); } catch {}
        global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => '' });
    });

    it('fetches iDevices and renders the list grouped by category', async () => {
        setupDom();
        const idevices = [
            { name: 'rubric', title: 'Rubric', category: 'Activity', url: '/idv/rubric', icon: { url: 'rubric-icon.svg' } },
            { name: 'freetext', title: 'Free text', category: 'Text', url: '/idv/freetext' },
        ];
        await initIdeviceLab({ fetchFn: mockApis({ idevices }) });
        expect(document.getElementById('idv-count').textContent).toBe('2');
        const groups = Array.from(document.querySelectorAll('#idv-list .idv-group')).map(g => g.textContent);
        expect(groups).toEqual(['Activity', 'Text']);
        expect(document.querySelectorAll('#idv-list .idevice-item').length).toBe(2);
    });

    it('on click, points the iframe at the developer idevice-host route (always edition entry)', async () => {
        setupDom();
        const idevices = [{ name: 'rubric', title: 'Rubric', category: 'Activity', url: '/idv/rubric' }];
        await initIdeviceLab({ fetchFn: mockApis({ idevices }) });
        document.querySelector('.idevice-item[data-name="rubric"]').click();
        await new Promise(r => setTimeout(r, 10));
        const frame = document.getElementById('idevice-host');
        expect(frame.hidden).toBe(false);
        expect(frame.src).toContain('/developer/idevice-host/rubric/edition');
    });

    it('filters by search and hides empty group headings', async () => {
        setupDom();
        const idevices = [
            { name: 'alpha', title: 'Alpha', category: 'A', url: '/x' },
            { name: 'beta', title: 'Beta', category: 'B', url: '/x' },
        ];
        await initIdeviceLab({ fetchFn: mockApis({ idevices }) });
        const search = document.getElementById('idv-search');
        search.value = 'alpha';
        search.dispatchEvent(new Event('input'));
        const visibleItems = Array.from(document.querySelectorAll('.idevice-item')).filter(el => !el.hidden);
        expect(visibleItems.map(el => el.dataset.name)).toEqual(['alpha']);
        const visibleGroups = Array.from(document.querySelectorAll('.idv-group')).filter(g => !g.hidden);
        expect(visibleGroups.map(g => g.textContent)).toEqual(['A']);
    });
});
