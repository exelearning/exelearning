import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityLogView, EVENT_LABELS } from './activityLogView.js';

const DAY = 24 * 60 * 60 * 1000;

function makeEvent(overrides = {}) {
    return {
        id: 1,
        type: 'page.edited',
        provenance: 'client',
        actor: { id: 2, email: 'editor@test.local' },
        target: { type: 'page', id: 'page-1', label: 'Intro' },
        details: null,
        count: 1,
        firstOccurredAt: 1_700_000_000_000,
        occurredAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
        ...overrides,
    };
}

describe('ActivityLogView', () => {
    let container;
    let fetchPage;
    let fetchActors;
    let view;

    const translate = (key) => key;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        fetchPage = vi.fn(async () => ({ events: [makeEvent()], nextCursor: null, recordingEnabled: true, retentionDays: 90 }));
        fetchActors = vi.fn(async () => ({ actors: [{ id: 2, email: 'editor@test.local' }, { id: null, email: null }] }));
    });

    afterEach(() => {
        view?.destroy();
        container.remove();
    });

    const create = (deps = {}) => {
        view = new ActivityLogView(container, { fetchPage, fetchActors, translate, locale: 'en-GB', pageSize: 2, ...deps });
        return view;
    };

    it('renders accessible filters, the entries and the retention notice', async () => {
        create();
        await view.load();
        const form = container.querySelector('form[role="search"]');
        expect(form).not.toBeNull();
        for (const input of [view.userSelect, view.fromInput, view.toInput]) {
            const label = container.querySelector(`label[for="${input.id}"]`);
            expect(label).not.toBeNull();
        }
        expect(container.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
        const items = container.querySelectorAll('.activity-log-entry');
        expect(items).toHaveLength(1);
        expect(items[0].querySelector('.activity-log-actor').textContent).toBe('editor@test.local');
        expect(items[0].querySelector('.activity-log-text').textContent).toBe('Edited page Intro');
        expect(items[0].querySelector('time').dateTime).toBe(new Date(1_700_000_000_000).toISOString());
        expect(container.querySelector('.activity-log-notice').textContent).toBe('Entries are kept for 90 days.');
        expect(container.querySelector('.activity-log-provenance')).not.toBeNull();
        // Actor options: all + editor + deleted.
        expect([...view.userSelect.options].map((o) => o.value)).toEqual(['', '2', 'deleted']);
    });

    it('renders user-controlled labels as text, never as HTML', async () => {
        fetchPage.mockResolvedValue({
            events: [
                makeEvent({ target: { type: 'page', id: 'p', label: '<img src=x onerror="window.__xss=1">' } }),
                makeEvent({ id: 2, actor: { id: 3, email: '<b>bold@test.local</b>' }, details: { pageLabel: '<i>x</i>', ideviceType: '<script>' }, target: { type: 'idevice', id: 'i', label: 'Box' } }),
            ],
            nextCursor: null,
        });
        create();
        await view.load();
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror="window.__xss=1">');
        expect(window.__xss).toBeUndefined();
    });

    it('shows empty, error and disabled states', async () => {
        fetchPage.mockResolvedValue({ events: [], nextCursor: null, recordingEnabled: false });
        create();
        await view.load();
        expect(view.status.textContent).toBe('No activity recorded yet.');
        expect(container.querySelector('.activity-log-notice').textContent).toContain('disabled');

        fetchPage.mockResolvedValue({ responseMessage: 'ERROR', detail: 'Access denied' });
        await view.applyFilters();
        expect(view.status.textContent).toBe('The activity could not be loaded.');
        expect(view.status.classList.contains('activity-log-status-error')).toBe(true);

        fetchPage.mockRejectedValue(new Error('network'));
        await view.applyFilters();
        expect(view.status.textContent).toBe('The activity could not be loaded.');
    });

    it('applies user and date filters as server parameters with inclusive day bounds', async () => {
        create();
        await view.load();
        view.userSelect.value = '2';
        view.fromInput.value = '2024-01-10';
        view.toInput.value = '2024-01-12';
        view.applyButton.click();
        await Promise.resolve();
        const params = fetchPage.mock.calls.at(-1)[0];
        expect(params.userId).toBe('2');
        expect(params.since).toBe(new Date('2024-01-10T00:00:00').getTime());
        expect(params.until).toBe(new Date('2024-01-12T00:00:00').getTime() + DAY);
        expect(params.limit).toBe(2);

        view.resetButton.click();
        await Promise.resolve();
        const reset = fetchPage.mock.calls.at(-1)[0];
        expect(reset.userId).toBeUndefined();
        expect(reset.since).toBeUndefined();
        expect(view.userSelect.value).toBe('');
    });

    it('filters deleted actors locally and keeps the Load more control in sync with the cursor', async () => {
        fetchPage
            .mockResolvedValueOnce({ events: [makeEvent({ id: 1 }), makeEvent({ id: 2, actor: null })], nextCursor: '10_2' })
            .mockResolvedValueOnce({ events: [makeEvent({ id: 3, actor: null })], nextCursor: null });
        create();
        await view.load();
        expect(view.loadMoreButton.classList.contains('d-none')).toBe(false);
        view.userSelect.value = 'deleted';
        fetchPage.mockResolvedValueOnce({ events: [makeEvent({ id: 4 }), makeEvent({ id: 5, actor: null })], nextCursor: null });
        await view.applyFilters();
        expect(container.querySelectorAll('.activity-log-entry')).toHaveLength(1);
        expect(container.querySelector('.activity-log-actor').textContent).toBe('Deleted user');
        expect(fetchPage.mock.calls.at(-1)[0].userId).toBeUndefined();
        expect(view.loadMoreButton.classList.contains('d-none')).toBe(true);
    });

    it('appends the next page on Load more with the cursor and ignores double clicks', async () => {
        fetchPage
            .mockResolvedValueOnce({ events: [makeEvent({ id: 1 }), makeEvent({ id: 2 })], nextCursor: '10_2' })
            .mockResolvedValueOnce({ events: [makeEvent({ id: 3 })], nextCursor: null });
        create();
        await view.load();
        const first = view.loadMore();
        const second = view.loadMore();
        await Promise.all([first, second]);
        expect(fetchPage).toHaveBeenCalledTimes(2);
        expect(fetchPage.mock.calls[1][0].cursor).toBe('10_2');
        expect(container.querySelectorAll('.activity-log-entry')).toHaveLength(3);
        expect(view.loadMoreButton.classList.contains('d-none')).toBe(true);
        await view.loadMore();
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('describes every event code with its target, counts and details', () => {
        create();
        for (const type of Object.keys(EVENT_LABELS)) {
            expect(view.describe(makeEvent({ type }))).not.toBe(type);
        }
        expect(view.describe(makeEvent({ type: 'unknown.code' }))).toBe('unknown.code');
        expect(view.describe(makeEvent({ type: 'access.collaborator_removed', target: { type: 'user', id: '9', label: null, deleted: true } }))).toBe(
            'Removed access for a deleted user',
        );
        expect(view.describe(makeEvent({ type: 'access.collaborator_added', target: { type: 'user', id: '9', label: null, deleted: false } }))).toBe(
            'Added #9 as an editor',
        );
        expect(view.describe(makeEvent({ type: 'page.deleted', target: { type: 'page', id: 'p', label: null } }))).toBe('Deleted page an untitled item');
        expect(view.describe(makeEvent({ type: 'access.visibility_changed', target: { type: 'project', id: null, label: null }, details: { from: 'private', to: 'public' } }))).toBe(
            'Changed edit access: Anyone with the edit link',
        );
        expect(view.describe(makeEvent({ type: 'import.elpx', target: { type: 'project', id: null, label: null }, details: { pages: 3, components: 10, mode: 'replace' } }))).toBe(
            'Imported content from an .elpx file (3 pages, 10 iDevices, replacing the previous content)',
        );
    });

    it('renders aggregated counts with their time range and contextual metadata', async () => {
        fetchPage.mockResolvedValue({
            events: [
                makeEvent({ count: 14, firstOccurredAt: 1_700_000_000_000, occurredAt: 1_700_001_740_000 }),
                makeEvent({ id: 2, type: 'idevice.edited', count: 3, firstOccurredAt: 5, occurredAt: 5, target: { type: 'idevice', id: 'i', label: 'Box' }, details: { pageLabel: 'Lesson', ideviceType: 'text' }, provenance: 'server' }),
            ],
            nextCursor: null,
        });
        create();
        await view.load();
        const [first, second] = container.querySelectorAll('.activity-log-entry');
        expect(first.querySelector('.activity-log-count').textContent).toMatch(/^14 changes between .+ and .+$/);
        expect(second.querySelector('.activity-log-count').textContent).toBe('3 times');
        expect(second.textContent).toContain('Page: Lesson');
        expect(second.textContent).toContain('text');
        expect(second.querySelector('.activity-log-provenance')).toBeNull();
    });

    it('ignores stale responses and detaches listeners on destroy', async () => {
        let resolveSlow;
        fetchPage.mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }));
        create();
        const slow = view.load();
        fetchPage.mockResolvedValueOnce({ events: [makeEvent({ id: 7 })], nextCursor: null });
        await view.applyFilters();
        resolveSlow({ events: [makeEvent({ id: 8 }), makeEvent({ id: 9 })], nextCursor: null });
        await slow;
        expect(container.querySelectorAll('.activity-log-entry')).toHaveLength(1);

        view.destroy();
        expect(container.children).toHaveLength(0);
        expect(container.classList.contains('activity-log')).toBe(false);
        view = null;
    });

    it('works without an actors loader and tolerates actor errors', async () => {
        create({ fetchActors: undefined });
        await view.load();
        expect(view.userSelect.options).toHaveLength(1);
        view.destroy();
        create({ fetchActors: vi.fn(async () => { throw new Error('nope'); }) });
        await view.load();
        expect(view.userSelect.options).toHaveLength(1);
        expect(container.querySelectorAll('.activity-log-entry')).toHaveLength(1);
    });
});
