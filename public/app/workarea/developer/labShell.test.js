import { segmented, toggleSwitch, toast, applyLayout, applyModeBadge, readBasePath, loadIconSprite } from './labShell.js';

function makeSegmented(initial = 'split') {
    document.body.innerHTML = `
        <div id="seg">
            <button data-value="desktop">D</button>
            <button data-value="mobile">M</button>
            <button data-value="split" class="${initial === 'split' ? 'is-active' : ''}">B</button>
        </div>
    `;
    return document.getElementById('seg');
}

describe('segmented', () => {
    it('marks the .is-active button as initial value', () => {
        const root = makeSegmented('split');
        const ctl = segmented(root, () => {});
        expect(ctl.value).toBe('split');
    });

    it('fires onChange when a button is clicked and updates active class', () => {
        const root = makeSegmented('split');
        const spy = vi.fn();
        segmented(root, spy);
        root.querySelector('[data-value="mobile"]').click();
        expect(spy).toHaveBeenCalledWith('mobile');
        expect(root.querySelector('button.is-active').dataset.value).toBe('mobile');
    });

    it('set() with fire=false updates DOM without firing the callback', () => {
        const root = makeSegmented('split');
        const spy = vi.fn();
        const ctl = segmented(root, spy);
        spy.mockClear();
        ctl.set('desktop', false);
        expect(spy).not.toHaveBeenCalled();
        expect(ctl.value).toBe('desktop');
    });
});

describe('toggleSwitch', () => {
    it('toggles is-on class on click and fires callback', () => {
        document.body.innerHTML = '<div id="sw" class="switch"></div>';
        const spy = vi.fn();
        const sw = toggleSwitch(document.getElementById('sw'), false, spy);
        document.getElementById('sw').click();
        expect(sw.value).toBe(true);
        expect(spy).toHaveBeenCalledWith(true);
    });

    it('initial value applies without firing', () => {
        document.body.innerHTML = '<div id="sw" class="switch"></div>';
        const spy = vi.fn();
        toggleSwitch(document.getElementById('sw'), true, spy);
        expect(document.getElementById('sw').classList.contains('is-on')).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('toast', () => {
    beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('creates a .lab-toast element with the message and removes is-visible after timeout', () => {
        toast('Hello', 100);
        const el = document.querySelector('.lab-toast');
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Hello');
        expect(el.classList.contains('is-visible')).toBe(true);
        vi.advanceTimersByTime(120);
        expect(el.classList.contains('is-visible')).toBe(false);
    });
});

describe('applyLayout / applyModeBadge / readBasePath / loadIconSprite', () => {
    it('applyLayout writes data-layout', () => {
        document.body.innerHTML = '<div id="x"></div>';
        applyLayout(document.getElementById('x'), 'mobile');
        expect(document.getElementById('x').dataset.layout).toBe('mobile');
    });

    it('applyModeBadge replaces innerHTML with icon + label', () => {
        document.body.innerHTML = '<span id="b"></span>';
        applyModeBadge(document.getElementById('b'), 'scorm');
        expect(document.getElementById('b').innerHTML).toContain('SCORM');
        expect(document.getElementById('b').innerHTML).toContain('icon-scorm');
    });

    it('readBasePath reads data-base-path off <main>', () => {
        document.body.innerHTML = '<main data-base-path="/exe"></main>';
        expect(readBasePath()).toBe('/exe');
        document.body.innerHTML = '<main></main>';
        expect(readBasePath()).toBe('');
    });

    it('loadIconSprite fills #icon-sprite-host with fetched markup', async () => {
        document.body.innerHTML = '<div id="icon-sprite-host"></div>';
        global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '<svg id="sprite"></svg>' });
        await loadIconSprite('/exe');
        expect(global.fetch).toHaveBeenCalledWith('/exe/app/workarea/developer/assets/icons.svg.html');
        expect(document.getElementById('icon-sprite-host').innerHTML).toContain('<svg id="sprite">');
    });

    it('loadIconSprite swallows fetch errors silently', async () => {
        document.body.innerHTML = '<div id="icon-sprite-host"></div>';
        global.fetch = vi.fn().mockRejectedValue(new Error('boom'));
        await loadIconSprite();
        expect(document.getElementById('icon-sprite-host').innerHTML).toBe('');
    });
});
