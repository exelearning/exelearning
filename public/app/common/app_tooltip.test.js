import { readFileSync } from 'node:fs';
import createTooltip from './app_tooltip.js';

// Exercise the exact Bootstrap shipped to the browser, including its delayed callbacks.
const source = readFileSync('public/libs/bootstrap/bootstrap.bundle.min.js', 'utf8');
const bootstrap = new Function('module', 'exports', `${source}\nreturn module.exports;`)({ exports: {} }, {});

describe('editor tooltips', () => {
    let element;
    let tooltip;

    beforeEach(() => {
        vi.useFakeTimers();
        window.bootstrap = bootstrap;
        document.body.innerHTML = '<div id="panel"><button title="Edit">Edit</button></div>';
        element = document.querySelector('button');
        element.style.visibility = 'visible';
        // happy-dom has no layout engine. Browser tests exercise actual CSS visibility.
        vi.spyOn(element, 'getClientRects').mockReturnValue([{}]);
        tooltip = createTooltip(element, { animation: false, delay: 50 });
    });

    afterEach(() => {
        tooltip.dispose();
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete window.bootstrap;
    });

    it('reuses the existing instance without changing Bootstrap globally', () => {
        expect(createTooltip(element)).toBe(tooltip);
        expect(bootstrap.Tooltip.getInstance(element)).toBe(tooltip);
        expect(tooltip).toBeInstanceOf(bootstrap.Tooltip);
        expect(tooltip.constructor).not.toBe(bootstrap.Tooltip);
    });

    it('reproduces the original Bootstrap error and prevents it before the show event', () => {
        element.style.display = 'none';
        element.getClientRects.mockReturnValue([]);
        expect(() => bootstrap.Tooltip.prototype.show.call(tooltip))
            .toThrow('Please use show on visible elements');
        expect(() => tooltip.show()).not.toThrow();
        expect(document.querySelector('.tooltip')).toBeNull();
    });

    it.each(['mouseover', 'focusin'])('shows normally on %s and supports hiding', (event) => {
        element.dispatchEvent(new Event(event, { bubbles: true }));
        vi.advanceTimersByTime(50);
        expect(document.querySelector('.tooltip.show')?.textContent).toBe('Edit');
        expect(element.hasAttribute('aria-describedby')).toBe(true);
        tooltip.hide();
        expect(document.querySelector('.tooltip')).toBeNull();
        expect(element.hasAttribute('aria-describedby')).toBe(false);
    });

    it.each(['display', 'ancestor', 'detached', 'visibility'])('ignores a pending show after %s hides the trigger', (mode) => {
        element.dispatchEvent(new Event('mouseover', { bubbles: true }));
        if (mode === 'display') element.style.display = 'none';
        if (mode === 'ancestor') element.parentElement.hidden = true;
        if (mode === 'detached') element.remove();
        if (mode === 'visibility') element.style.visibility = 'hidden';
        if (mode === 'display' || mode === 'ancestor') element.getClientRects.mockReturnValue([]);
        expect(() => vi.advanceTimersByTime(50)).not.toThrow();
        expect(document.querySelector('.tooltip')).toBeNull();

        document.querySelector('#panel').appendChild(element);
        element.parentElement.hidden = false;
        element.style.display = '';
        element.style.visibility = 'visible';
        element.getClientRects.mockReturnValue([{}]);
        element.dispatchEvent(new Event('mouseover', { bubbles: true }));
        vi.advanceTimersByTime(50);
        expect(document.querySelector('.tooltip.show')).not.toBeNull();
    });

    it('cancels a pending show when hidden before it appears', () => {
        element.dispatchEvent(new Event('focusin', { bubbles: true }));
        tooltip.hide();
        expect(() => vi.advanceTimersByTime(50)).not.toThrow();
        expect(document.querySelector('.tooltip')).toBeNull();
    });

    it('cancels pending callbacks on disposal and can initialize the element again', () => {
        element.dispatchEvent(new Event('mouseover', { bubbles: true }));
        tooltip.dispose();
        expect(() => vi.advanceTimersByTime(50)).not.toThrow();
        tooltip = createTooltip(element, { animation: false });
        tooltip.show();
        expect(document.querySelector('.tooltip.show')).not.toBeNull();
    });
});
