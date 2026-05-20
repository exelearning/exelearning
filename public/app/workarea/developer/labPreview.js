/**
 * Lab preview controller.
 *
 * Sets the `src` of two iframes (desktop + mobile) to the server-side
 * preview endpoint. The server (see `src/routes/developer.ts`) loads
 * the selected `.elpx` fixture, runs `Html5Exporter.generateForPreview`,
 * inlines CSS / data-URIs / strips scripts, and returns a self-contained
 * HTML document. No Yjs bridge, no Service Worker, no srcdoc.
 */

function buildUrl({ basePath = '', fixture, theme, mode = 'web', refresh = false }) {
    const qs = new URLSearchParams({ theme, mode });
    if (refresh) qs.set('refresh', '1');
    qs.set('t', String(Date.now()));
    return `${basePath}/developer/preview/${encodeURIComponent(fixture)}?${qs.toString()}`;
}

export function createLabPreview({
    desktopFrame,
    mobileFrame,
    emptySlot,
    basePath = '',
} = {}) {
    let state = { fixture: null, theme: null, mode: 'web' };

    function showMessage(html) {
        if (!emptySlot) return;
        emptySlot.hidden = false;
        emptySlot.innerHTML = html;
    }
    function hideMessage() {
        if (!emptySlot) return;
        emptySlot.hidden = true;
        emptySlot.innerHTML = '';
    }
    function clearFrames() {
        if (desktopFrame) desktopFrame.src = 'about:blank';
        if (mobileFrame) mobileFrame.src = 'about:blank';
    }
    function showEmpty() {
        clearFrames();
        showMessage('<div class="lab-empty"><p>Pick a sample project and a theme to render the preview.</p></div>');
    }

    function refresh(partial = {}) {
        const force = partial.refresh === true;
        const next = { ...partial };
        delete next.refresh;
        state = { ...state, ...next };
        if (!state.fixture || !state.theme) { showEmpty(); return; }
        const url = buildUrl({ basePath, fixture: state.fixture, theme: state.theme, mode: state.mode, refresh: force });
        if (desktopFrame) desktopFrame.src = url;
        if (mobileFrame) mobileFrame.src = url;
        hideMessage();
    }

    return {
        refresh,
        get state() { return { ...state }; },
    };
}

// Exposed for tests so the URL building can be asserted directly.
export const __test = { buildUrl };
