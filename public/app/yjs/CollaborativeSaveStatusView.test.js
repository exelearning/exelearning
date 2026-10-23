/**
 * Tests for CollaborativeSaveStatusView (issues #1592 and #2615).
 *
 * Test helpers (describe/it/expect/vi/beforeEach/afterEach) are exposed as
 * globals by public/vitest.setup.js under happy-dom, so we can build a real DOM
 * and assert against it. The toast manager and translator are injected so the
 * view can be exercised in isolation.
 */

const CollaborativeSaveStatusView = require('./CollaborativeSaveStatusView');

/** Build the toolbar fragment the view renders into. */
function buildDom() {
    document.body.innerHTML = `
        <button id="head-top-save-button" title="Save" aria-describedby="exe-collab-save-status">
            <div class="small-icon save-icon-white"></div>
            <span class="save-label">Save</span>
            <span class="collab-autosave-badge d-none" data-testid="collab-autosave-indicator" aria-hidden="true"></span>
        </button>
        <div id="exe-collab-save-status" class="collab-save-status" role="status" aria-live="polite" aria-atomic="true">
            <span class="content"></span>
        </div>
    `;
}

function getButton() {
    return document.getElementById('head-top-save-button');
}
function getBadge() {
    return document.querySelector('#head-top-save-button .collab-autosave-badge');
}
function getLiveText() {
    return document.querySelector('#exe-collab-save-status .content').textContent;
}

/**
 * Construct a view with an injected toast manager spy and identity translator.
 * @param {Object} [opts]
 */
function makeView(opts = {}) {
    const remove = vi.fn();
    const createToast = vi.fn(() => ({ remove }));
    const view = new CollaborativeSaveStatusView({
        document,
        translate: (source) => source,
        getToastManager: () => ({ createToast }),
        // Disable the "saving" minimum-visibility deferral by default so phase
        // changes apply synchronously; the hold is exercised in its own suite.
        minSavingVisibleMs: 0,
        ...opts,
    });
    return { view, createToast, remove };
}

describe('CollaborativeSaveStatusView (issue #1592)', () => {
    beforeEach(() => {
        buildDom();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('badge + live region per phase', () => {
        it('renders the clean phase as a check badge and announces it, without a toast', () => {
            const { view, createToast } = makeView();
            view.setPhase('clean');

            const badge = getBadge();
            expect(badge.classList.contains('d-none')).toBe(false);
            expect(badge.getAttribute('data-collab-phase')).toBe('clean');
            expect(badge.textContent).toBe('check');
            expect(getLiveText()).toBe('All changes are saved.');
            expect(getButton().hasAttribute('aria-busy')).toBe(false);
            expect(createToast).not.toHaveBeenCalled();
        });

        it('renders the pending phase as a plain (glyph-less) red dot, without a toast', () => {
            const { view, createToast } = makeView();
            view.setPhase('pending');

            const badge = getBadge();
            expect(badge.getAttribute('data-collab-phase')).toBe('pending');
            expect(badge.textContent).toBe(''); // plain dot: colour + placement, no glyph
            expect(getLiveText()).toBe('Changes will be saved automatically.');
            expect(getButton().hasAttribute('aria-busy')).toBe(false);
            expect(createToast).not.toHaveBeenCalled();
        });

        it('renders the saving phase as a glyph-less dot (pulse is CSS) and sets aria-busy, without a toast', () => {
            const { view, createToast } = makeView();
            view.setPhase('saving');

            const badge = getBadge();
            expect(badge.getAttribute('data-collab-phase')).toBe('saving');
            expect(badge.textContent).toBe(''); // motion cue comes from the CSS pulse
            expect(getLiveText()).toBe('Saving changes...');
            expect(getButton().getAttribute('aria-busy')).toBe('true');
            expect(createToast).not.toHaveBeenCalled();
        });

        it('renders the failed phase as a warning badge, announces it and shows one toast', () => {
            const { view, createToast } = makeView();
            view.setPhase('failed');

            const badge = getBadge();
            expect(badge.getAttribute('data-collab-phase')).toBe('failed');
            expect(badge.textContent).toBe('priority_high');
            // The badge tooltip carries the full, actionable sentence...
            expect(badge.getAttribute('title')).toBe('Autosave failed. Please click Save before leaving.');
            // ...while the polite live region announces only a short status
            // token, so the assertive toast (below) is not duplicated verbatim.
            expect(getLiveText()).toBe('Autosave failed.');
            expect(getButton().hasAttribute('aria-busy')).toBe(false);

            expect(createToast).toHaveBeenCalledTimes(1);
            const payload = createToast.mock.calls[0][0];
            expect(payload.error).toBe(true);
            expect(payload.icon).toBe('error');
            expect(payload.title).toBe('Autosave failed');
            expect(payload.body).toBe('Autosave failed. Please click Save before leaving.');
            // The assertive toast body differs from the polite live-region text,
            // so a screen reader does not hear the identical sentence twice.
            expect(payload.body).not.toBe(getLiveText());
            // No dwell timeout: the warning stays until recovery/dismissal.
            expect(payload.remove).toBeUndefined();
        });

        it('resets the badge and keeps the previous announcement for an unknown phase, without a toast', () => {
            const { view, createToast } = makeView();
            view.setPhase('pending');
            createToast.mockClear();

            expect(() => view.setPhase('bogus')).not.toThrow();

            const badge = getBadge();
            expect(badge.classList.contains('d-none')).toBe(true);
            expect(badge.hasAttribute('data-collab-phase')).toBe(false);
            expect(badge.textContent).toBe('');
            // Live region left untouched so no empty/confusing announcement.
            expect(getLiveText()).toBe('Changes will be saved automatically.');
            expect(createToast).not.toHaveBeenCalled();
        });

        it('clears aria-busy when moving from saving to a resting phase', () => {
            const { view } = makeView();
            view.setPhase('saving');
            expect(getButton().getAttribute('aria-busy')).toBe('true');
            view.setPhase('clean');
            expect(getButton().hasAttribute('aria-busy')).toBe(false);
        });

        it('takes over the manual unsaved dot while showing a status, and releases it on reset', () => {
            const { view } = makeView();
            view.setPhase('pending');
            // The SCSS hides #head-top-save-button.collab-autosave-active .unsaved:before,
            // so the status dot stands in for the manual dot (no double marker).
            expect(getButton().classList.contains('collab-autosave-active')).toBe(true);

            view.setPhase('bogus'); // unknown/reset
            expect(getButton().classList.contains('collab-autosave-active')).toBe(false);
        });
    });

    describe('minimum "saving" visibility', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it('defers a fast clean so the saving state stays visible for the minimum time', () => {
            vi.useFakeTimers();
            const { view } = makeView({ minSavingVisibleMs: 600 });
            view.setPhase('saving');
            expect(getBadge().getAttribute('data-collab-phase')).toBe('saving');

            view.setPhase('clean'); // arrives immediately after saving
            expect(getBadge().getAttribute('data-collab-phase')).toBe('saving'); // deferred

            vi.advanceTimersByTime(600);
            expect(getBadge().getAttribute('data-collab-phase')).toBe('clean');
        });

        it('does not defer clean once the minimum time has already elapsed', () => {
            vi.useFakeTimers();
            const { view } = makeView({ minSavingVisibleMs: 600 });
            view.setPhase('saving');
            vi.advanceTimersByTime(700); // saving already shown long enough
            view.setPhase('clean');
            expect(getBadge().getAttribute('data-collab-phase')).toBe('clean');
        });

        it('never defers a failure — shows it promptly with its toast', () => {
            vi.useFakeTimers();
            const { view, createToast } = makeView({ minSavingVisibleMs: 600 });
            view.setPhase('saving');
            view.setPhase('failed');
            expect(getBadge().getAttribute('data-collab-phase')).toBe('failed');
            expect(createToast).toHaveBeenCalledTimes(1);
        });

        it('cancels a deferred transition when a new phase arrives during the hold', () => {
            vi.useFakeTimers();
            const { view } = makeView({ minSavingVisibleMs: 600 });
            view.setPhase('saving');
            view.setPhase('clean'); // deferred (hold timer pending)
            view.setPhase('saving'); // cancels the pending hold, re-applies saving
            expect(getBadge().getAttribute('data-collab-phase')).toBe('saving');

            vi.advanceTimersByTime(600);
            // The earlier deferred 'clean' was cancelled and must not fire.
            expect(getBadge().getAttribute('data-collab-phase')).toBe('saving');
        });

        it('cancels a pending saving-hold timer on destroy', () => {
            vi.useFakeTimers();
            const { view } = makeView({ minSavingVisibleMs: 600 });
            view.setPhase('saving');
            view.setPhase('clean'); // deferred
            view.destroy();
            vi.advanceTimersByTime(1000);
            // destroy reset the badge; the deferred clean must not resurrect it.
            expect(getBadge().classList.contains('d-none')).toBe(true);
        });
    });

    describe('failure toast deduplication and re-arm', () => {
        it('shows the failure toast only once per failure episode', () => {
            const { view, createToast } = makeView();
            view.setPhase('failed');
            view.setPhase('failed');
            expect(createToast).toHaveBeenCalledTimes(1);
        });

        it('does not re-arm on pending or saving during a failure episode', () => {
            const { view, createToast } = makeView();
            view.setPhase('failed');
            view.setPhase('pending');
            view.setPhase('saving');
            view.setPhase('failed');
            expect(createToast).toHaveBeenCalledTimes(1);
        });

        it('dismisses the toast and re-arms after a recovery to clean', () => {
            const { view, createToast, remove } = makeView();
            view.setPhase('failed');
            expect(createToast).toHaveBeenCalledTimes(1);

            view.setPhase('clean');
            expect(remove).toHaveBeenCalledTimes(1); // stale warning removed on recovery

            view.setPhase('failed');
            expect(createToast).toHaveBeenCalledTimes(2); // a new, independent failure toasts again
        });
    });

    describe('manual Save availability shapes the failure wording', () => {
        // The availability-dependent wording lives in the actionable channels
        // (the badge tooltip and the toast body); the polite live region always
        // carries the same short status token.

        it('tells the user to click Save when the Save button is available', () => {
            const { view, createToast } = makeView();
            view.setPhase('failed');
            expect(getBadge().getAttribute('title')).toBe('Autosave failed. Please click Save before leaving.');
            expect(createToast.mock.calls[0][0].body).toBe('Autosave failed. Please click Save before leaving.');
        });

        it('drops the "click Save" instruction when the Save button is hidden with d-none', () => {
            getButton().classList.add('d-none');
            const { view, createToast } = makeView();
            view.setPhase('failed');
            expect(getBadge().getAttribute('title')).toBe(
                'Autosave failed. Your latest changes may not be saved.',
            );
            expect(createToast.mock.calls[0][0].body).toBe(
                'Autosave failed. Your latest changes may not be saved.',
            );
        });

        it('drops the "click Save" instruction when body has data-exe-hide-save', () => {
            document.body.setAttribute('data-exe-hide-save', 'true');
            const { view } = makeView();
            view.setPhase('failed');
            expect(getBadge().getAttribute('title')).toBe(
                'Autosave failed. Your latest changes may not be saved.',
            );
            document.body.removeAttribute('data-exe-hide-save');
        });

        it('drops the "click Save" instruction when the Save button computes to display:none', () => {
            getButton().style.display = 'none';
            const { view } = makeView();
            view.setPhase('failed');
            expect(getBadge().getAttribute('title')).toBe(
                'Autosave failed. Your latest changes may not be saved.',
            );
        });
    });

    describe('Save button semantics are preserved', () => {
        it('never changes the Save button label or title', () => {
            const { view } = makeView();
            for (const phase of ['pending', 'saving', 'failed', 'clean']) {
                view.setPhase(phase);
                expect(document.querySelector('#head-top-save-button .save-label').textContent).toBe('Save');
                expect(getButton().getAttribute('title')).toBe('Save');
            }
        });

        it('leaves the Save button clickable in the failed phase (manual retry)', () => {
            const { view } = makeView();
            view.setPhase('failed');
            expect(getButton().hasAttribute('disabled')).toBe(false);
        });
    });

    describe('accessible live region', () => {
        it('keeps its status role and polite live semantics and stays visually hidden (not d-none)', () => {
            const { view } = makeView();
            view.setPhase('saving');
            const region = document.getElementById('exe-collab-save-status');
            expect(region.getAttribute('role')).toBe('status');
            expect(region.getAttribute('aria-live')).toBe('polite');
            // The region is hidden via CSS (position/clip), never display:none,
            // so it remains in the accessibility tree.
            expect(region.classList.contains('d-none')).toBe(false);
        });
    });

    describe('robustness', () => {
        it('does not throw when neither the Save button nor the live region exist', () => {
            document.body.innerHTML = '';
            const { view } = makeView();
            expect(() => view.setPhase('failed')).not.toThrow();
        });

        it('does not throw when the toast manager is unavailable', () => {
            const view = new CollaborativeSaveStatusView({
                document,
                translate: (source) => source,
                getToastManager: () => null,
            });
            expect(() => view.setPhase('failed')).not.toThrow();
        });

        it('resets every surface and dismisses the toast on destroy', () => {
            const { view, remove } = makeView();
            view.setPhase('saving');
            view.setPhase('failed');

            view.destroy();

            const badge = getBadge();
            expect(badge.classList.contains('d-none')).toBe(true);
            expect(badge.textContent).toBe('');
            expect(getLiveText()).toBe('');
            expect(getButton().hasAttribute('aria-busy')).toBe(false);
            expect(remove).toHaveBeenCalledTimes(1);

            // Re-armed: a later failure toasts again.
            view.setPhase('failed');
            // (the createToast spy lives on the manager returned each call; assert
            //  no throw and the badge is restored)
            expect(getBadge().getAttribute('data-collab-phase')).toBe('failed');
        });
    });

    describe('default dependencies', () => {
        it('uses the global translator when none is injected', () => {
            const view = new CollaborativeSaveStatusView({
                document,
                getToastManager: () => null,
            });
            view.setPhase('clean');
            // The vitest global _() echoes the source string back.
            expect(getLiveText()).toBe('All changes are saved.');
        });

        it('resolves the toast manager from window.eXeLearning.app.toasts by default', () => {
            const createToast = vi.fn(() => ({ remove: vi.fn() }));
            const previous = window.eXeLearning;
            window.eXeLearning = { app: { toasts: { createToast } } };

            const view = new CollaborativeSaveStatusView({ document, translate: (s) => s });
            view.setPhase('failed');
            expect(createToast).toHaveBeenCalledTimes(1);

            window.eXeLearning = previous;
        });

        it('falls back to the ambient document when none is injected', () => {
            const view = new CollaborativeSaveStatusView({
                translate: (source) => source,
                getToastManager: () => null,
            });
            view.setPhase('clean');
            expect(getBadge().getAttribute('data-collab-phase')).toBe('clean');
        });

        it('falls back to the raw source string when no global translator exists', () => {
            const previousUnderscore = global._;
            global._ = undefined;
            try {
                const view = new CollaborativeSaveStatusView({ document, getToastManager: () => null });
                view.setPhase('clean');
                expect(getLiveText()).toBe('All changes are saved.');
            } finally {
                global._ = previousUnderscore;
            }
        });

        it('does not throw on failure when no app toast manager is reachable', () => {
            const previous = window.eXeLearning;
            window.eXeLearning = undefined;
            try {
                const view = new CollaborativeSaveStatusView({ document, translate: (s) => s });
                expect(() => view.setPhase('failed')).not.toThrow();
                expect(getLiveText()).toBe('Autosave failed.');
            } finally {
                window.eXeLearning = previous;
            }
        });
    });
});

describe('cloud status chip replaces the Save button (issue #2615)', () => {
    /** Toolbar fragment as rendered by menuHeadTop.njk in cloud mode. */
    function buildCloudDom() {
        document.body.innerHTML = `
            <button id="head-top-save-button" class="cloud-autosave saved" title="Save" aria-describedby="exe-collab-save-status">
                <div class="small-icon save-icon-white"></div>
                <span class="save-label">Save</span>
                <span class="auto-icon cloud-save-icon" aria-hidden="true"></span>
                <span class="cloud-save-label"></span>
                <span class="collab-autosave-badge d-none" aria-hidden="true"></span>
            </button>
            <div id="exe-collab-save-status" class="collab-save-status" role="status" aria-live="polite" aria-atomic="true">
                <span class="content"></span>
            </div>
        `;
    }
    const icon = () => document.querySelector('#head-top-save-button .cloud-save-icon');
    const label = () => document.querySelector('#head-top-save-button .cloud-save-label');

    beforeEach(() => {
        buildCloudDom();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders clean as cloud_done / "Saved" with a neutral tooltip and announcement, no toast', () => {
        const { view, createToast } = makeView();
        view.setPhase('clean');

        expect(icon().textContent).toBe('cloud_done');
        expect(label().textContent).toBe('Saved');
        expect(getButton().getAttribute('data-cloud-phase')).toBe('clean');
        expect(getButton().getAttribute('title')).toBe('All changes are saved.');
        expect(getLiveText()).toBe('All changes are saved.');
        expect(createToast).not.toHaveBeenCalled();
    });

    it('renders pending as cloud_upload / "Unsaved changes"', () => {
        const { view } = makeView();
        view.setPhase('pending');

        expect(icon().textContent).toBe('cloud_upload');
        expect(label().textContent).toBe('Unsaved changes');
        expect(getLiveText()).toBe('Changes will be saved automatically.');
        expect(getButton().hasAttribute('aria-busy')).toBe(false);
    });

    it('renders saving as cloud_sync / "Saving..." and marks the control busy', () => {
        const { view } = makeView();
        view.setPhase('saving');

        expect(icon().textContent).toBe('cloud_sync');
        expect(label().textContent).toBe('Saving...');
        expect(getButton().getAttribute('aria-busy')).toBe('true');
        expect(getLiveText()).toBe('Saving changes...');
    });

    it('renders failed as cloud_off / "Not saved" with the retry-queue wording (no "click Save")', () => {
        const { view, createToast } = makeView();
        view.setPhase('failed');

        expect(icon().textContent).toBe('cloud_off');
        expect(label().textContent).toBe('Not saved');
        const expected = 'Autosave failed. Retrying automatically. Click the status to retry now.';
        expect(getButton().getAttribute('title')).toBe(expected);
        expect(createToast).toHaveBeenCalledTimes(1);
        expect(createToast.mock.calls[0][0]).toMatchObject({ title: 'Autosave failed', body: expected, error: true });
        expect(getLiveText()).toBe('Autosave failed.');
    });

    it('translates the short labels through the injected translator', () => {
        const { view } = makeView({ translate: (source) => `t:${source}` });
        view.setPhase('saving');
        expect(label().textContent).toBe('t:Saving...');
        expect(getButton().getAttribute('title')).toBe('t:Saving changes...');
    });

    it('keeps the dot badge hidden and never claims the manual-dot takeover class', () => {
        const { view } = makeView();
        for (const phase of ['pending', 'saving', 'clean', 'failed']) {
            view.setPhase(phase);
            expect(getBadge().classList.contains('d-none')).toBe(true);
            expect(getBadge().hasAttribute('data-collab-phase')).toBe(false);
            expect(getButton().classList.contains('collab-autosave-active')).toBe(false);
        }
    });

    it('resets the chip and restores the original tooltip for an unknown phase and on destroy', () => {
        const { view } = makeView();
        view.setPhase('clean');
        view.setPhase('bogus');
        expect(getButton().hasAttribute('data-cloud-phase')).toBe(false);
        expect(icon().textContent).toBe('');
        expect(label().textContent).toBe('');
        expect(getButton().getAttribute('title')).toBe('Save');

        view.setPhase('saving');
        view.destroy();
        expect(getButton().hasAttribute('data-cloud-phase')).toBe(false);
        expect(getButton().hasAttribute('aria-busy')).toBe(false);
        expect(getButton().getAttribute('title')).toBe('Save');
        expect(getLiveText()).toBe('');
    });

    it('does not throw when the icon/label spans are missing from the markup', () => {
        document.querySelector('.cloud-save-icon').remove();
        document.querySelector('.cloud-save-label').remove();
        const { view } = makeView();
        expect(() => view.setPhase('saving')).not.toThrow();
        expect(getButton().getAttribute('data-cloud-phase')).toBe('saving');
    });

    it('leaves the control clickable in every phase (click = save now / manual retry)', () => {
        const { view } = makeView();
        for (const phase of ['pending', 'saving', 'clean', 'failed']) {
            view.setPhase(phase);
            expect(getButton().hasAttribute('disabled')).toBe(false);
        }
    });
});
