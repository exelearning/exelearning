/* eslint-disable no-undef */
import '../../../../../../vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$casestudy\s*=/, 'global.$casestudy =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$casestudy;
}

describe('casestudy iDevice export', () => {
    let $casestudy;

    beforeEach(() => {
        global.$casestudy = undefined;
        const filePath = join(__dirname, 'casestudy.js');
        const code = readFileSync(filePath, 'utf-8');
        $casestudy = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('generateActivities', () => {
        // A case study whose saved jsonProperties was lost or discarded reaches
        // renderView as {}, with no activities array to iterate.
        it('renders an empty activity list instead of throwing', () => {
            let html;

            expect(() => {
                html = $casestudy.generateActivities({ msgs: $casestudy.msgs });
            }).not.toThrow();

            expect(html).toBe('');
        });

        it('renders an activity that has no feedback', () => {
            let html;

            expect(() => {
                html = $casestudy.generateActivities({
                    msgs: $casestudy.msgs,
                    activities: [{ activity: '<p>Analiza el caso</p>' }],
                });
            }).not.toThrow();

            expect(html).toContain('Analiza el caso');
            expect(html).not.toContain('CSP-FeedbackBtn');
        });

        it('still renders activities with feedback', () => {
            const html = $casestudy.generateActivities({
                msgs: $casestudy.msgs,
                activities: [
                    { activity: '<p>Analiza el caso</p>', feedback: '<p>Respuesta</p>' },
                ],
            });

            expect(html).toContain('Analiza el caso');
            expect(html).toContain('CSP-FeedbackBtn');
        });
    });

    describe('addEvents — feedback button A|B toggle', () => {
        let origIs;

        beforeEach(() => {
            // happy-dom has no layout engine (offsetWidth/Height always 0), so
            // jQuery's :visible always returns false. Patch $.fn.is at prototype
            // level (Sizzle caches compiled selectors so $.expr.pseudos is too late).
            origIs = $.fn.is;
            $.fn.is = function (selector) {
                if (selector === ':visible') {
                    return this.length > 0 && this[0].style.display !== 'none';
                }
                return origIs.call(this, selector);
            };
        });

        afterEach(() => {
            $.fn.is = origIs;
        });

        function buildActivity(btnValue) {
            const container = document.createElement('div');
            container.className = 'CSP-Activities';
            container.innerHTML = `
                <div class="CSP-ActivityDiv">
                    <input type="button" class="CSP-FeedbackBtn" value="${btnValue}">
                    <div class="CSP-FeedbackText" style="display:none;">Feedback content</div>
                </div>`;
            document.body.appendChild(container);
            return container;
        }

        it('sets data-text-a and data-text-b from A|B value', () => {
            buildActivity('Show|Hide');
            $casestudy.addEvents({});
            const btn = document.querySelector('.CSP-FeedbackBtn');
            expect(btn.dataset.textA).toBe('Show');
            expect(btn.dataset.textB).toBe('Hide');
        });

        it('sets initial button value to textA', () => {
            buildActivity('Show|Hide');
            $casestudy.addEvents({});
            const btn = document.querySelector('.CSP-FeedbackBtn');
            expect(btn.value).toBe('Show');
        });

        it('uses same text for both states when no | separator', () => {
            buildActivity('Show feedback');
            $casestudy.addEvents({});
            const btn = document.querySelector('.CSP-FeedbackBtn');
            expect(btn.dataset.textA).toBe('Show feedback');
            expect(btn.dataset.textB).toBe('Show feedback');
        });

        it('changes button text to textB when feedback is hidden and button is clicked', () => {
            buildActivity('Show|Hide');
            $casestudy.addEvents({});
            const btn = $(`.CSP-FeedbackBtn`);
            btn.closest('.CSP-ActivityDiv').find('.CSP-FeedbackText').hide();
            btn.trigger('click');
            expect(btn.val()).toBe('Hide');
        });

        it('changes button text to textA when feedback is visible and button is clicked', () => {
            buildActivity('Show|Hide');
            $casestudy.addEvents({});
            const btn = $(`.CSP-FeedbackBtn`);
            btn.closest('.CSP-ActivityDiv').find('.CSP-FeedbackText').css('display', 'block');
            btn.trigger('click');
            expect(btn.val()).toBe('Show');
        });

        it('keeps same button text on both states when no | separator', () => {
            buildActivity('Show feedback');
            $casestudy.addEvents({});
            const btn = $(`.CSP-FeedbackBtn`);
            const $fb = btn.closest('.CSP-ActivityDiv').find('.CSP-FeedbackText');
            $fb.css('display', 'none');
            btn.trigger('click');
            expect(btn.val()).toBe('Show feedback');
            $fb.css('display', 'block');
            btn.trigger('click');
            expect(btn.val()).toBe('Show feedback');
        });

        it('does not reinitialize data attributes on second addEvents call', () => {
            buildActivity('Show|Hide');
            $casestudy.addEvents({});
            const btn = document.querySelector('.CSP-FeedbackBtn');
            btn.value = 'Changed|Other';
            $casestudy.addEvents({});
            expect(btn.dataset.textA).toBe('Show');
            expect(btn.dataset.textB).toBe('Hide');
        });
    });
});
