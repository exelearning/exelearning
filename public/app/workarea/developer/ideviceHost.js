/**
 * iDevice Lab — standalone host orchestrator.
 *
 * Mirrors the workarea flow without a project:
 *   1. Load the iDevice's edition + export bundles.
 *   2. Render the form (state: edition). On Save, ask `$exeDevice.save()` for
 *      data — if it returns falsy the iDevice already showed its own
 *      validation warnings, so we stay in the form.
 *   3. When save returns data, render the same view the workarea would show
 *      after closing the form (state: view).
 *   4. A toggle lets the user switch to the export view, where the export
 *      bundle's renderBehaviour() + init() are applied so interactivity
 *      (quizzes, feedback toggles, etc.) actually runs.
 */

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(el);
    });
}

function loadCss(href) {
    return new Promise(resolve => {
        const el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = href;
        el.onload = () => resolve();
        el.onerror = () => resolve();
        document.head.appendChild(el);
    });
}

function buildAssetUrl(config, kind, filename) {
    return `${config.url}/${kind}/${filename}`;
}

async function loadIdeviceAssets(config) {
    for (const css of config.editionCss || []) await loadCss(buildAssetUrl(config, 'edition', css));
    for (const css of config.exportCss || []) await loadCss(buildAssetUrl(config, 'export', css));
    for (const js of config.editionJs || []) await loadScript(buildAssetUrl(config, 'edition', js));
    for (const js of config.exportJs || []) await loadScript(buildAssetUrl(config, 'export', js));
}

function renderIdeviceHtml(config, win, data) {
    if (config.componentType === 'html') {
        // Older iDevices return rendered HTML directly from save().
        return typeof data === 'string' ? data : String(data ?? '');
    }
    const exportObj = win[config.exportObject];
    if (!exportObj || typeof exportObj.renderView !== 'function') {
        throw new Error(`Export object ${config.exportObject} not found or missing renderView()`);
    }
    const ideviceId = `lab-idv-${Math.random().toString(36).slice(2, 10)}`;
    const json = typeof data === 'string' ? safeParseJson(data, data) : data;
    if (json && typeof json === 'object') json.ideviceId = ideviceId;
    const template = config.exportTemplateContent || '{content}';
    const innerHtml = exportObj.renderView(json, {}, template, ideviceId);
    return `<div id="${ideviceId}" class="idevice_node" mode="export">${innerHtml}</div>`;
}

function safeParseJson(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
}

function applyBehaviour(config, win, container) {
    if (config.componentType !== 'json') return;
    const exportObj = win[config.exportObject];
    if (!exportObj) return;
    const node = container.querySelector('.idevice_node');
    if (!node) return;
    const ideviceId = node.id;
    const data = { ideviceId };
    try { exportObj.renderBehaviour?.(data, {}, ideviceId); } catch (err) { console.warn('[lab-host] renderBehaviour failed', err); }
    try { exportObj.init?.(data, {}); } catch (err) { console.warn('[lab-host] init failed', err); }
}

function wirePostInit(win) {
    try {
        win.jQuery('.exe-fieldset legend a').on('click', function () {
            win.jQuery(this).parent().parent().toggleClass('exe-fieldset-closed');
            return false;
        });
    } catch {}
    try { win.$exeDevicesEdition?.iDevice?.colorPicker?.init?.(); } catch {}
    try { win.$exeDevicesEdition?.iDevice?.filePicker?.init?.(); } catch {}
}

function ensureExeAlertStub(win, doc) {
    // Some workarea scripts (e.g. exe_export.js → setExe()) wipe window.eXe.
    // iDevice validators call eXe.app.alert(message) for required-field warnings.
    // Make sure that always works AND that the user actually sees the message.
    const showWarning = (msg) => {
        const banner = doc.getElementById('lab-warning');
        if (banner) {
            banner.textContent = String(msg);
            banner.hidden = false;
            clearTimeout(showWarning._t);
            showWarning._t = setTimeout(() => { banner.hidden = true; }, 5000);
        } else {
            win.alert(String(msg));
        }
    };
    if (!win.eXe) win.eXe = {};
    if (!win.eXe.app) win.eXe.app = {};
    // Always replace alert (the inline stub uses console.warn which the user can't see;
    // any prior script may also have wiped it).
    win.eXe.app.alert = showWarning;
    if (typeof win.eXe.app.isInExe !== 'function') win.eXe.app.isInExe = () => true;
}

export async function initIdeviceHost({
    doc = document,
    win = (typeof window !== 'undefined' ? window : undefined),
    fetchFn = (...args) => fetch(...args),
} = {}) {
    if (!win) throw new Error('initIdeviceHost: no window');
    ensureExeAlertStub(win, doc);
    const root = doc.body;
    const ideviceName = root.dataset.idevice;
    const basePath = root.dataset.basePath || '';
    if (!ideviceName) throw new Error('initIdeviceHost: missing data-idevice');

    const editMount = doc.getElementById('lab-pane-edit');
    const viewMount = doc.getElementById('lab-pane-view');
    const exportMount = doc.getElementById('lab-pane-export');
    const errEl = doc.getElementById('lab-error');
    const saveBtn = doc.getElementById('lab-save');
    const resetBtn = doc.getElementById('lab-reset');
    const tabs = Array.from(doc.querySelectorAll('.lab-tab'));
    const titleEl = doc.getElementById('lab-title');

    let savedData = null;
    let state = 'edition';
    let config = null;

    function showState(next) {
        state = next;
        for (const pane of [editMount, viewMount, exportMount]) pane.hidden = pane.dataset.state !== next;
        for (const tab of tabs) {
            tab.classList.toggle('is-active', tab.dataset.state === next);
            tab.setAttribute('aria-pressed', tab.dataset.state === next ? 'true' : 'false');
        }
    }

    function setTabsAvailable(canPreview) {
        for (const tab of tabs) {
            if (tab.dataset.state === 'view' || tab.dataset.state === 'export') {
                tab.disabled = !canPreview;
            }
        }
    }

    function showError(err) {
        errEl.hidden = false;
        errEl.textContent = (err && (err.stack || err.message)) || String(err);
        console.error('[lab-host]', err);
    }

    try {
        const apiUrl = `${basePath}/api/idevices/installed`;
        const res = await fetchFn(apiUrl);
        const json = await res.json();
        config = (json?.idevices ?? []).find(i => i.name === ideviceName);
        if (!config) throw new Error(`iDevice config not found for "${ideviceName}"`);
        if (titleEl) titleEl.textContent = config.title || ideviceName;

        await loadIdeviceAssets(config);

        if (typeof win.$exeDevice === 'undefined' || typeof win.$exeDevice.init !== 'function') {
            throw new Error(`Edition bundle did not register $exeDevice.init() for "${ideviceName}"`);
        }

        const idevicePath = `${basePath}${config.url}/edition`;
        win.$exeDevice.init(editMount, null, idevicePath);
        wirePostInit(win);
        setTabsAvailable(false);
        showState('edition');

        resetBtn?.addEventListener('click', () => win.location.reload());

        saveBtn?.addEventListener('click', () => {
            errEl.hidden = true;
            let result;
            try {
                result = win.$exeDevice.save();
            } catch (err) {
                showError(err);
                return;
            }
            if (!result) {
                // The iDevice already raised its own warnings via eXe.app.alert.
                return;
            }
            savedData = result;
            try {
                const html = renderIdeviceHtml(config, win, savedData);
                viewMount.innerHTML = `<div class="exe-content lab-saved-view">${html}</div>`;
                exportMount.innerHTML = `<div class="exe-content lab-saved-view">${html}</div>`;
                applyBehaviour(config, win, exportMount);
            } catch (err) {
                showError(err);
                return;
            }
            setTabsAvailable(true);
            showState('view');
        });

        for (const tab of tabs) {
            tab.addEventListener('click', () => {
                if (tab.disabled) return;
                const target = tab.dataset.state;
                if (target === 'export') {
                    // Re-apply behaviour each time so toggles/state reset cleanly.
                    exportMount.innerHTML = viewMount.innerHTML;
                    applyBehaviour(config, win, exportMount);
                }
                showState(target);
            });
        }
    } catch (err) {
        showError(err);
    }

    return {
        get state() { return state; },
        get savedData() { return savedData; },
    };
}

if (typeof document !== 'undefined' && document.body && document.body.dataset.testid === 'idevice-host-page') {
    initIdeviceHost().catch(err => console.error('[ideviceHost] init failed', err));
}
