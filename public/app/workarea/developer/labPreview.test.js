import { createLabPreview, __test } from './labPreview.js';

describe('buildUrl', () => {
    it('encodes fixture + theme + mode and appends a cache-buster', () => {
        const url = __test.buildUrl({ basePath: '/exe', fixture: 'basic.elpx', theme: 'flux', mode: 'single' });
        expect(url).toMatch(/^\/exe\/developer\/preview\/basic\.elpx\?/);
        expect(url).toContain('theme=flux');
        expect(url).toContain('mode=single');
        expect(url).toMatch(/t=\d+/);
    });

    it('URL-encodes unsafe characters in the fixture id', () => {
        const url = __test.buildUrl({ basePath: '', fixture: 'with space.elpx', theme: 'base' });
        expect(url).toContain('/developer/preview/with%20space.elpx');
    });
});

describe('createLabPreview.refresh', () => {
    let desktopFrame, mobileFrame, emptySlot;
    beforeEach(() => {
        document.body.innerHTML = `<iframe id="d" src="about:blank"></iframe><iframe id="m" src="about:blank"></iframe><div id="e" hidden></div>`;
        desktopFrame = document.getElementById('d');
        mobileFrame = document.getElementById('m');
        emptySlot = document.getElementById('e');
    });

    it('shows the empty message when no fixture is set', () => {
        const ctl = createLabPreview({ desktopFrame, mobileFrame, emptySlot, basePath: '/exe' });
        ctl.refresh({ theme: 'base' });
        expect(emptySlot.hidden).toBe(false);
        expect(emptySlot.innerHTML).toContain('Pick a sample project');
        expect(desktopFrame.src).toContain('about:blank');
    });

    it('shows the empty message when no theme is set', () => {
        const ctl = createLabPreview({ desktopFrame, mobileFrame, emptySlot });
        ctl.refresh({ fixture: 'x.elpx' });
        expect(emptySlot.hidden).toBe(false);
    });

    it('points both iframes at the preview endpoint when fixture+theme are set', () => {
        const ctl = createLabPreview({ desktopFrame, mobileFrame, emptySlot, basePath: '/exe' });
        ctl.refresh({ fixture: 'demo.elpx', theme: 'flux', mode: 'web' });
        expect(desktopFrame.src).toContain('/exe/developer/preview/demo.elpx?');
        expect(mobileFrame.src).toContain('theme=flux');
        expect(emptySlot.hidden).toBe(true);
    });

    it('keeps the last fixture when only theme changes', () => {
        const ctl = createLabPreview({ desktopFrame, mobileFrame, emptySlot });
        ctl.refresh({ fixture: 'demo.elpx', theme: 'a' });
        const firstSrc = desktopFrame.src;
        ctl.refresh({ theme: 'b' });
        expect(desktopFrame.src).toContain('theme=b');
        expect(desktopFrame.src).not.toEqual(firstSrc);
        expect(ctl.state).toEqual({ fixture: 'demo.elpx', theme: 'b', mode: 'web' });
    });
});
