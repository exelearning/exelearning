import { loadIconSprite, readBasePath, toast } from './labShell.js';

function categoryOf(idevice) {
    return idevice.category || idevice.group || 'Custom';
}

function normalize(str) {
    // Lowercase + strip diacritics so "matemáticas" matches "matematicas".
    return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function renderIdeviceList(listEl, idevices, activeName) {
    listEl.innerHTML = '';
    const byCategory = new Map();
    for (const idv of idevices) {
        const cat = categoryOf(idv);
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(idv);
    }
    for (const [cat, items] of byCategory) {
        const heading = document.createElement('div');
        heading.className = 'idv-group';
        heading.textContent = cat;
        listEl.appendChild(heading);
        for (const idv of items) {
            const item = document.createElement('div');
            item.className = 'idevice-item' + (idv.name === activeName ? ' is-active' : '');
            item.dataset.name = idv.name;
            item.dataset.testid = 'idevice-lab-item';
            // Pre-compute the searchable haystack on the element so filterList stays cheap.
            item.dataset.search = normalize([
                idv.title, idv.label, idv.name, idv.cssClass, idv.description, cat,
            ].filter(Boolean).join(' '));

            const iconUrl = idv.icon?.url ? `${idv.url}/${idv.icon.url}` : '';
            const icon = document.createElement('div');
            icon.className = 'idevice-icon';
            if (iconUrl) icon.innerHTML = `<img src="${iconUrl}" alt="" loading="lazy">`;

            const info = document.createElement('div');
            info.className = 'idevice-info';
            const name = document.createElement('div');
            name.className = 'idevice-name';
            name.textContent = idv.title || idv.label || idv.name;
            info.appendChild(name);

            item.append(icon, info);
            listEl.appendChild(item);
        }
    }
}

function filterList(listEl, query) {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    for (const item of listEl.querySelectorAll('.idevice-item')) {
        const haystack = item.dataset.search || normalize(item.textContent + ' ' + (item.dataset.name || ''));
        item.hidden = tokens.length > 0 && !tokens.every(t => haystack.includes(t));
    }
    for (const heading of listEl.querySelectorAll('.idv-group')) {
        let next = heading.nextElementSibling;
        let visible = false;
        while (next && !next.classList.contains('idv-group')) {
            if (!next.hidden) { visible = true; break; }
            next = next.nextElementSibling;
        }
        heading.hidden = !visible;
    }
}

function readUrlState(win) {
    const url = new URL(win.location.href);
    return { idevice: url.searchParams.get('idevice') || null };
}

function writeUrlState(win, state) {
    const params = new URLSearchParams();
    if (state.idevice) params.set('idevice', state.idevice);
    const qs = params.toString();
    const pathname = win.location?.pathname || '';
    try { win.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname); } catch {}
}

function buildHostUrl(basePath, ideviceName) {
    return `${basePath}/developer/idevice-host/${encodeURIComponent(ideviceName)}/edition?t=${Date.now()}`;
}

export async function initIdeviceLab({
    doc = document,
    win = (typeof window !== 'undefined' ? window : undefined),
    fetchFn = (...args) => fetch(...args),
} = {}) {
    const basePath = readBasePath(doc);
    loadIconSprite(basePath);

    const listEl = doc.getElementById('idv-list');
    const ideviceSearch = doc.getElementById('idv-search');
    const ideviceCount = doc.getElementById('idv-count');
    const activeIdeviceLabel = doc.getElementById('ct-idv');
    const categoryLabel = doc.getElementById('ct-cat');
    const refreshBtn = doc.getElementById('btn-refresh');
    const hostFrame = doc.getElementById('idevice-host');
    const emptyState = doc.getElementById('canvas-empty');

    let idevices = [];
    let activeIdevice = null;

    const urlState = win ? readUrlState(win) : { idevice: null };

    function persistUrl() {
        if (!win) return;
        writeUrlState(win, { idevice: activeIdevice });
    }

    function refreshFrame() {
        if (!activeIdevice) return;
        if (!hostFrame) return;
        hostFrame.hidden = false;
        hostFrame.src = buildHostUrl(basePath, activeIdevice);
        if (emptyState) emptyState.hidden = true;
    }

    function selectIdevice(name) {
        activeIdevice = name;
        for (const item of listEl?.querySelectorAll('.idevice-item') ?? []) {
            item.classList.toggle('is-active', item.dataset.name === name);
        }
        const idv = idevices.find(i => i.name === name);
        if (activeIdeviceLabel) activeIdeviceLabel.textContent = idv?.title || idv?.label || name;
        if (categoryLabel) categoryLabel.textContent = idv ? `· ${categoryOf(idv)}` : '';
        persistUrl();
        refreshFrame();
    }

    try {
        const res = await fetchFn(`${basePath}/api/idevices/installed`);
        idevices = (await res.json())?.idevices || [];
    } catch (err) {
        toast(`Could not load iDevices: ${err?.message || err}`);
    }

    if (ideviceCount) ideviceCount.textContent = String(idevices.length);

    const initialName = urlState.idevice && idevices.some(i => i.name === urlState.idevice) ? urlState.idevice : null;
    if (listEl) renderIdeviceList(listEl, idevices, initialName);

    listEl?.addEventListener('click', e => {
        const item = e.target.closest('.idevice-item');
        if (item) selectIdevice(item.dataset.name);
    });
    ideviceSearch?.addEventListener('input', e => filterList(listEl, e.target.value));
    refreshBtn?.addEventListener('click', () => refreshFrame());

    if (initialName) selectIdevice(initialName);

    return {
        get idevice() { return activeIdevice; },
    };
}

if (typeof document !== 'undefined' && document.querySelector('[data-testid="idevice-lab-page"]')) {
    initIdeviceLab().catch(err => console.error('[IdeviceLab] init failed', err));
}
