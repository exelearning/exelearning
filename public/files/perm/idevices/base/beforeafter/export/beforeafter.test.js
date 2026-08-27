/**
 * Unit tests for the beforeafter iDevice (export/runtime).
 *
 * Regression coverage for issue #2272: initComparison runs from a 200ms
 * setTimeout scheduled after each image load, so by the time it fires the
 * iDevice DOM or its options entry may already be gone (page navigation,
 * editor closing the activity). It must bail out instead of crashing on a
 * null container / missing options / missing card.
 *
 * The export declares `var $eXeBeforeAfter`; it is rewired to a global and
 * the auto-init call is stripped so importing has no side effects. Real
 * jQuery + happy-dom (from vitest.setup.js) back the DOM.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExport() {
    const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeBeforeAfter\s*=/, 'global.$eXeBeforeAfter =');
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeBeforeAfter\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeBeforeAfter;
}

describe('beforeafter iDevice export — initComparison guards (#2272)', () => {
    let bfaf;
    const instance = 0;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        // The export reads the shared color palette while its object literal evaluates.
        global.$exeDevices.iDevice.gamification.colors = {
            borderColors: { red: '#f00', green: '#0f0', blue: '#00f', yellow: '#ff0' },
            backColor: '#fff',
        };
        bfaf = loadExport();
        bfaf.options = [];
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete global.$eXeBeforeAfter;
        delete global.$exeDevices.iDevice.gamification.colors;
    });

    function addContainer() {
        document.body.innerHTML = `
            <div id="bfafpContainerBA-${instance}">
                <div class="BFAFP-Overlay"></div>
                <div class="BFAFP-Slider"></div>
            </div>
        `;
    }

    it('returns early without throwing when the container is no longer in the DOM', () => {
        bfaf.options[instance] = { cardsGame: [{ vertical: false, position: 50 }], active: 0 };
        // DOM is empty: the delayed setTimeout fired after the activity was removed.
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
    });

    it('returns early without throwing when options[instance] is gone', () => {
        addContainer();
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
    });

    it('returns early without throwing when the card no longer exists', () => {
        addContainer();
        bfaf.options[instance] = { cardsGame: [], active: 0 };
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
        // No handlers were wired on the still-present slider.
        const slider = document.querySelector('.BFAFP-Slider');
        expect(slider._initComparisonHandlers).toBeUndefined();
    });

    it('wires the comparison slider when DOM and data are present (positive path)', () => {
        addContainer();
        bfaf.options[instance] = { cardsGame: [{ vertical: false, position: 50 }], active: 0 };
        expect(() => bfaf.initComparison(0, instance)).not.toThrow();
        const slider = document.querySelector('.BFAFP-Slider');
        const container = document.getElementById(`bfafpContainerBA-${instance}`);
        expect(slider._initComparisonHandlers).toBeDefined();
        expect(typeof slider._initComparisonHandlers.startSlide).toBe('function');
        expect(typeof container._initComparisonHandlers.containerClick).toBe('function');
    });
});
