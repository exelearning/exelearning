import { segmented, applyLayout, applyModeBadge, loadIconSprite, readBasePath, toast } from './labShell.js';
import { createLabPreview } from './labPreview.js';

function groupLabel(theme) {
    return theme.type === 'site' ? 'Site' : 'Base';
}

function renderThemeList(listEl, themes, activeDir) {
    listEl.innerHTML = '';
    for (const theme of themes) {
        const item = document.createElement('div');
        item.className = 'theme-item' + (theme.dirName === activeDir ? ' is-active' : '');
        item.dataset.dir = theme.dirName;
        item.dataset.type = theme.type;
        item.dataset.testid = 'style-lab-theme-item';

        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch';
        // The themes API returns `theme.preview` pointing to /style/<dir>/preview.png,
        // but the file on disk is `screenshot.png`. Build the URL ourselves.
        const screenshotUrl = theme.url ? `${theme.url}/screenshot.png` : '';
        if (screenshotUrl) {
            swatch.style.backgroundImage = `url("${screenshotUrl}")`;
            swatch.style.backgroundSize = 'cover';
            swatch.style.backgroundPosition = 'center';
        }

        const name = document.createElement('div');
        name.className = 'theme-name';
        name.textContent = theme.displayName || theme.dirName;
        const family = document.createElement('small');
        family.style.cssText = 'margin-left:6px;color:var(--ink-mute)';
        family.textContent = groupLabel(theme);
        name.appendChild(family);

        item.append(swatch, name);
        listEl.appendChild(item);
    }
}

function renderFixtureSelect(selectEl, fixtures, activeId) {
    selectEl.innerHTML = '';
    if (!fixtures.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— no fixtures —';
        opt.disabled = true;
        opt.selected = true;
        selectEl.appendChild(opt);
        return;
    }
    for (const fx of fixtures) {
        const opt = document.createElement('option');
        opt.value = fx.id;
        opt.textContent = fx.label || fx.id;
        if (fx.id === activeId) opt.selected = true;
        selectEl.appendChild(opt);
    }
}

function readUrlState(win) {
    const url = new URL(win.location.href);
    return {
        fixture: url.searchParams.get('fixture') || null,
        theme: url.searchParams.get('theme') || null,
        mode: url.searchParams.get('mode') || null,
        view: url.searchParams.get('view') || null,
    };
}

function writeUrlState(win, state) {
    // Build a relative query string so replaceState stays same-origin.
    const params = new URLSearchParams();
    const set = (k, v) => { if (v) params.set(k, v); };
    set('fixture', state.fixture);
    set('theme', state.theme);
    set('mode', state.mode);
    set('view', state.view);
    const qs = params.toString();
    const pathname = win.location?.pathname || '';
    try { win.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname); } catch {}
}

export async function initStyleLab({
    doc = document,
    win = (typeof window !== 'undefined' ? window : undefined),
    fetchFn = (...args) => fetch(...args),
    previewFactory = createLabPreview,
} = {}) {
    const basePath = readBasePath(doc);
    loadIconSprite(basePath);

    const listEl = doc.getElementById('theme-list');
    const themeCount = doc.getElementById('theme-count');
    const fixtureSelect = doc.getElementById('fixture-select');
    const activeThemeLabel = doc.getElementById('ct-theme');
    const modeBadge = doc.getElementById('ct-mode');
    const layoutLabel = doc.getElementById('layout-label');
    const canvasBody = doc.getElementById('canvas-body');
    const emptySlot = doc.getElementById('canvas-empty');
    const refreshBtn = doc.getElementById('btn-refresh');
    const desktopFrame = doc.getElementById('preview-desktop');
    const mobileFrame = doc.getElementById('preview-mobile');

    const preview = previewFactory({ desktopFrame, mobileFrame, emptySlot, basePath });

    let themes = [];
    let fixtures = [];
    let activeDir = null;
    let activeFixture = null;
    let mode = 'web';
    let view = 'split';

    const urlState = win ? readUrlState(win) : { fixture: null, theme: null, mode: null, view: null };

    function persistUrl() {
        if (!win) return;
        writeUrlState(win, { fixture: activeFixture, theme: activeDir, mode, view });
    }

    function applyAndRefresh() {
        const theme = themes.find(t => t.dirName === activeDir);
        if (activeThemeLabel) activeThemeLabel.textContent = theme?.displayName || activeDir || '—';
        preview.refresh({ fixture: activeFixture, theme: activeDir, mode });
        persistUrl();
    }

    function selectTheme(dir) {
        activeDir = dir;
        for (const item of listEl?.querySelectorAll('.theme-item') ?? []) {
            item.classList.toggle('is-active', item.dataset.dir === dir);
        }
        applyAndRefresh();
    }

    function selectFixture(id) {
        activeFixture = id || null;
        if (fixtureSelect) fixtureSelect.value = id || '';
        applyAndRefresh();
    }

    try {
        const [themesRes, fixturesRes] = await Promise.all([
            fetchFn(`${basePath}/api/themes/installed`),
            fetchFn(`${basePath}/developer/fixtures`),
        ]);
        themes = (await themesRes.json())?.themes || [];
        fixtures = (await fixturesRes.json())?.fixtures || [];
    } catch (err) {
        toast(`Could not load registries: ${err?.message || err}`);
    }

    if (themeCount) themeCount.textContent = String(themes.length);

    const defaultDir = themes.find(t => t.isDefault)?.dirName || themes[0]?.dirName || null;
    const defaultFixture = fixtures[0]?.id || null;

    activeDir = (urlState.theme && themes.some(t => t.dirName === urlState.theme)) ? urlState.theme : defaultDir;
    activeFixture = (urlState.fixture && fixtures.some(f => f.id === urlState.fixture)) ? urlState.fixture : defaultFixture;
    mode = ['web', 'single', 'scorm'].includes(urlState.mode) ? urlState.mode : 'web';
    view = ['desktop', 'mobile', 'split'].includes(urlState.view) ? urlState.view : 'split';

    if (listEl) renderThemeList(listEl, themes, activeDir);
    if (fixtureSelect) renderFixtureSelect(fixtureSelect, fixtures, activeFixture);
    applyLayout(canvasBody, view);
    if (layoutLabel) layoutLabel.textContent = view.charAt(0).toUpperCase() + view.slice(1);
    applyModeBadge(modeBadge, mode);

    listEl?.addEventListener('click', e => {
        const item = e.target.closest('.theme-item');
        if (item) selectTheme(item.dataset.dir);
    });
    fixtureSelect?.addEventListener('change', e => selectFixture(e.target.value));

    segmented(doc.getElementById('seg-layout'), v => {
        view = v;
        if (layoutLabel) layoutLabel.textContent = v.charAt(0).toUpperCase() + v.slice(1);
        applyLayout(canvasBody, v);
        persistUrl();
    }, view);
    segmented(doc.getElementById('seg-mode'), v => {
        mode = v;
        applyModeBadge(modeBadge, v);
        applyAndRefresh();
    }, mode);

    refreshBtn?.addEventListener('click', () => {
        preview.refresh({ fixture: activeFixture, theme: activeDir, mode, refresh: true });
        persistUrl();
    });

    if (fixtureSelect && activeFixture) fixtureSelect.value = activeFixture;
    applyAndRefresh();

    return {
        preview,
        get theme() { return activeDir; },
        get fixture() { return activeFixture; },
        get mode() { return mode; },
        get view() { return view; },
    };
}

if (typeof document !== 'undefined' && document.querySelector('[data-testid="style-lab-page"]')) {
    initStyleLab().catch(err => console.error('[StyleLab] init failed', err));
}
