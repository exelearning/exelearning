/**
 * Admin panel — AI settings tab.
 *
 * Drives the "AI" section of the admin panel:
 *  - shows only the field groups relevant to the selected provider,
 *  - saves the AI settings (scoped to the #ai section) via PUT /api/admin/settings,
 *  - runs an optional "Test connection" against the managed provider.
 *
 * Secrets (API keys) are never rendered with a value; blank key fields are
 * sent as-is and the backend treats a blank value as "keep the stored key".
 *
 * Uses the globals `API_BASE` and `T` declared by the admin template, mirroring
 * dashboard.js. All accesses are defensive so the module is unit-testable.
 */

/** Resolve a translation with a fallback, tolerating a missing global `T`. */
function tr(key, fallback) {
    return (typeof T !== 'undefined' && T && T[key]) || fallback;
}

/** Base URL for the admin settings API (global declared by the template). */
function adminApiBase() {
    return typeof API_BASE !== 'undefined' && API_BASE ? API_BASE : '';
}

/** Base URL for the AI API (sibling of the admin API: .../api/ai). */
export function aiApiBase() {
    return adminApiBase().replace(/\/admin$/, '/ai');
}

function setStatus(el, text, state) {
    if (!el) return;
    el.textContent = text;
    el.className = `admin-settings-status${state ? ` ${state}` : ''}`;
}

/**
 * Show only the field groups relevant to the selected provider. The shared
 * "managed" group (generation options) is shown for any non-external provider.
 *
 * @param {string} provider
 */
export function applyProviderVisibility(provider) {
    const managed = Boolean(provider) && provider !== 'external';
    document.querySelectorAll('[data-ai-provider-group]').forEach(group => {
        const target = group.getAttribute('data-ai-provider-group');
        const show = target === 'managed' ? managed : target === provider;
        group.style.display = show ? '' : 'none';
    });
}

/**
 * Collect the AI settings inputs scoped to the #ai section into the
 * { key, value, type } shape expected by PUT /api/admin/settings.
 *
 * @returns {Array<{key: string, value: string, type: string}>}
 */
export function collectAiSettings() {
    const section = document.getElementById('ai');
    if (!section) return [];
    const settings = [];
    section.querySelectorAll('[data-setting-key]').forEach(input => {
        const key = input.dataset.settingKey;
        const type = input.dataset.settingType || 'string';
        const value = type === 'boolean' ? (input.checked ? 'true' : 'false') : input.value;
        settings.push({ key, value: String(value == null ? '' : value), type });
    });
    return settings;
}

/** Persist the AI settings. Returns true on success. */
export async function saveAiSettings() {
    const statusEl = document.getElementById('aiSaveStatus');
    setStatus(statusEl, tr('saving', 'Saving...'), '');
    try {
        const res = await fetch(`${adminApiBase()}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ settings: collectAiSettings() }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setStatus(statusEl, err.message || tr('error_saving', 'Error saving'), 'error');
            return false;
        }
        setStatus(statusEl, tr('saved', 'Saved'), 'success');
        return true;
    } catch (_e) {
        setStatus(statusEl, tr('error_saving', 'Error saving'), 'error');
        return false;
    }
}

/** Run a managed-provider connection test and report the outcome. Returns true on success. */
export async function testAiConnection() {
    const statusEl = document.getElementById('aiSaveStatus');
    setStatus(statusEl, tr('ai_testing', 'Testing...'), '');
    try {
        const res = await fetch(`${aiApiBase()}/test-connection`, { method: 'POST', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
            setStatus(statusEl, tr('ai_test_ok', 'Connection successful'), 'success');
            return true;
        }
        const detail = data.message || data.error || res.status;
        setStatus(statusEl, `${tr('ai_test_failed', 'Connection failed')}: ${detail}`, 'error');
        return false;
    } catch (_e) {
        setStatus(statusEl, tr('ai_test_failed', 'Connection failed'), 'error');
        return false;
    }
}

/** Wire up the AI tab controls. Safe to call when the section is absent. */
export function initAiTab() {
    const select = document.getElementById('aiProviderSelect');
    if (select) {
        applyProviderVisibility(select.value);
        select.addEventListener('change', () => applyProviderVisibility(select.value));
    }
    const saveBtn = document.getElementById('aiSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveAiSettings);
    const testBtn = document.getElementById('aiTestBtn');
    if (testBtn) testBtn.addEventListener('click', testAiConnection);
}

// Auto-initialize in the browser. In tests the module is imported with an empty
// DOM (init becomes a no-op) and the exported functions are called directly.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAiTab);
    } else {
        initAiTab();
    }
}
