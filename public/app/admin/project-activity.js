/**
 * Admin panel — per-project activity log (issue #2689).
 *
 * Adds an "Activity" action to every row of the Projects table and renders the
 * shared read-only ActivityLogView inside a Bootstrap modal. Administrators can
 * inspect any project; the server enforces the role on every request.
 */
import { ActivityLogView } from '../activity/activityLogView.js';

const API = typeof API_BASE !== 'undefined' ? API_BASE : '/api/admin';
const LABELS = typeof T !== 'undefined' && T ? T : {};

let activeView = null;

function label(key) {
    return LABELS[key] || key;
}

async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return { responseMessage: 'ERROR', detail: body.message || `HTTP ${response.status}` };
    }
    return response.json();
}

function buildActivityUrl(projectId, params = {}) {
    const url = new URL(`${API}/projects/${encodeURIComponent(projectId)}/activity`, window.location.origin);
    for (const key of ['userId', 'since', 'until', 'limit', 'cursor']) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url.toString();
}

/**
 * Open the activity modal for a project.
 * @param {number} projectId
 * @param {string} [title]
 */
export function openProjectActivity(projectId, title = '') {
    const modalEl = document.getElementById('projectActivityModal');
    const container = document.getElementById('projectActivityContainer');
    const heading = document.getElementById('projectActivityTitle');
    if (!modalEl || !container || !heading) return null;

    heading.textContent = `${label('activity')}: ${title || `#${projectId}`}`;
    closeProjectActivityView();
    activeView = new ActivityLogView(container, {
        fetchPage: (params) => fetchJson(buildActivityUrl(projectId, params)),
        fetchActors: () => fetchJson(`${API}/projects/${encodeURIComponent(projectId)}/activity/actors`),
        translate: label,
        locale: document.documentElement.lang || undefined,
    });
    activeView.load();

    if (window.bootstrap?.Modal) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
    return activeView;
}

export function closeProjectActivityView() {
    if (activeView) {
        activeView.destroy();
        activeView = null;
    }
}

export function bindProjectActivityButtons(root = document) {
    for (const button of root.querySelectorAll('[data-action="project-activity"]')) {
        if (button.dataset.activityBound === '1') continue;
        button.dataset.activityBound = '1';
        button.addEventListener('click', () => {
            const projectId = Number(button.dataset.projectId);
            if (!Number.isInteger(projectId)) return;
            openProjectActivity(projectId, button.dataset.projectTitle || '');
        });
    }
}

// Init: the projects table is re-rendered on every load; observe it so new
// rows get their handler without polling the backend.
(function init() {
    const tbody = document.getElementById('projectsTableBody');
    if (tbody && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => bindProjectActivityButtons(tbody));
        observer.observe(tbody, { childList: true, subtree: true });
        bindProjectActivityButtons(tbody);
    }
    const modalEl = document.getElementById('projectActivityModal');
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', closeProjectActivityView);
    }
    window.openProjectActivity = openProjectActivity;
})();
