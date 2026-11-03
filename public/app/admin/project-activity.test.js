import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadModule() {
    vi.resetModules();
    return import('./project-activity.js');
}

describe('admin project activity', () => {
    let fetchMock;
    let modalShow;

    beforeEach(() => {
        document.body.innerHTML = `
            <table><tbody id="projectsTableBody"></tbody></table>
            <div class="modal" id="projectActivityModal">
                <h5 id="projectActivityTitle"></h5>
                <div id="projectActivityContainer"></div>
            </div>
        `;
        globalThis.API_BASE = '/base/api/admin';
        globalThis.T = { activity: 'Activity', 'All users': 'All users' };
        fetchMock = vi.fn(async (url) => ({
            ok: true,
            json: async () =>
                String(url).includes('/actors')
                    ? { actors: [{ id: 1, email: 'a@test.local' }] }
                    : { events: [{ id: 1, type: 'save.manual', provenance: 'server', actor: { id: 1, email: 'a@test.local' }, target: null, details: null, count: 1, firstOccurredAt: 1, occurredAt: 1 }], nextCursor: null, recordingEnabled: true, retentionDays: 90 },
        }));
        globalThis.fetch = fetchMock;
        modalShow = vi.fn();
        window.bootstrap = { Modal: { getOrCreateInstance: vi.fn(() => ({ show: modalShow })) } };
    });

    afterEach(() => {
        delete globalThis.API_BASE;
        delete globalThis.T;
        delete window.bootstrap;
        delete window.openProjectActivity;
        document.body.innerHTML = '';
    });

    it('opens the modal, builds admin URLs and renders the log', async () => {
        const mod = await loadModule();
        const view = mod.openProjectActivity(5, 'Audited <b>project</b>');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(modalShow).toHaveBeenCalled();
        expect(document.getElementById('projectActivityTitle').textContent).toBe('Activity: Audited <b>project</b>');
        expect(document.getElementById('projectActivityTitle').querySelector('b')).toBeNull();
        const urls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.endsWith('/base/api/admin/projects/5/activity?limit=50'))).toBe(true);
        expect(urls.some((u) => u.endsWith('/base/api/admin/projects/5/activity/actors'))).toBe(true);
        expect(document.querySelectorAll('.activity-log-entry')).toHaveLength(1);
        expect(view).not.toBeNull();
        expect(window.openProjectActivity).toBe(mod.openProjectActivity);
    });

    it('binds row buttons added later through the mutation observer', async () => {
        const mod = await loadModule();
        const tbody = document.getElementById('projectsTableBody');
        tbody.innerHTML = '<tr><td><button data-action="project-activity" data-project-id="7" data-project-title="Seven"></button></td></tr>';
        await new Promise((resolve) => setTimeout(resolve, 0));
        tbody.querySelector('button').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/projects/7/activity'))).toBe(true);
        // Rebinding is idempotent.
        mod.bindProjectActivityButtons(tbody);
        tbody.querySelector('button').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/projects/7/activity?limit=50'))).toHaveLength(2);
    });

    it('passes filters to the admin endpoint and normalises errors', async () => {
        const mod = await loadModule();
        const view = mod.openProjectActivity(5);
        await new Promise((resolve) => setTimeout(resolve, 0));
        fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 400, json: async () => ({ message: 'bad' }) }));
        view.userSelect.value = '1';
        await view.applyFilters();
        const last = String(fetchMock.mock.calls.at(-1)[0]);
        expect(last).toContain('userId=1');
        expect(view.status.textContent).toBe('The activity could not be loaded.');
    });

    it('tears the view down when the modal is hidden and when reopened', async () => {
        const mod = await loadModule();
        mod.openProjectActivity(5);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const container = document.getElementById('projectActivityContainer');
        expect(container.classList.contains('activity-log')).toBe(true);
        document.getElementById('projectActivityModal').dispatchEvent(new Event('hidden.bs.modal'));
        expect(container.classList.contains('activity-log')).toBe(false);
        expect(container.children).toHaveLength(0);
        mod.openProjectActivity(6);
        mod.openProjectActivity(7);
        expect(container.querySelectorAll('form')).toHaveLength(1);
        mod.closeProjectActivityView();
        expect(container.children).toHaveLength(0);
    });

    it('does nothing when the markup is missing', async () => {
        document.body.innerHTML = '';
        const mod = await loadModule();
        expect(mod.openProjectActivity(5)).toBeNull();
        expect(() => mod.bindProjectActivityButtons(document)).not.toThrow();
    });
});
