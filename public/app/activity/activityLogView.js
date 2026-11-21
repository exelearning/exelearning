/**
 * ActivityLogView (issue #2689)
 *
 * Read-only renderer for a project's activity log, shared by the workarea
 * Activity modal and the administration panel. It owns a container element and
 * renders: a filter row (actor, from, to), the entry list, loading/empty/error/
 * disabled states and a "Load more" control driven by the server's keyset
 * cursor.
 *
 * The view never interprets HTML from the server: every label, email and
 * detail is written with textContent. Labels are generated from the stable
 * event codes through the injected translate function, so the workarea passes
 * `_()` and the admin panel passes its own dictionary lookup.
 *
 * Dependencies are injected so the module stays free of globals:
 *   - fetchPage({ userId, since, until, cursor, limit }) → { events, nextCursor, recordingEnabled, retentionDays }
 *   - fetchActors() → { actors: [{ id, email }] }
 *   - translate(key) → string
 */

const EVENT_LABELS = {
    'access.collaborator_added': 'Added {target} as an editor',
    'access.collaborator_removed': 'Removed access for {target}',
    'access.ownership_transferred': 'Transferred ownership to {target}',
    'access.visibility_changed': 'Changed edit access',
    'access.public_link_enabled': 'Enabled the public read-only link',
    'access.public_link_disabled': 'Disabled the public read-only link',
    'access.public_link_regenerated': 'Regenerated the public read-only link',
    'session.opened': 'Opened the project for editing',
    'save.manual': 'Saved the project',
    'save.autosave': 'Saved automatically',
    'save.unload': 'Saved on leaving',
    'version.restored': 'Restored a previous version',
    'page.created': 'Created page {target}',
    'page.renamed': 'Renamed page to {target}',
    'page.edited': 'Edited page {target}',
    'page.moved': 'Moved page {target}',
    'page.deleted': 'Deleted page {target}',
    'page.cloned': 'Cloned page {target}',
    'block.created': 'Created box {target}',
    'block.edited': 'Edited box {target}',
    'block.moved': 'Moved box {target}',
    'block.deleted': 'Deleted box {target}',
    'block.cloned': 'Cloned box {target}',
    'idevice.created': 'Added an iDevice to {target}',
    'idevice.edited': 'Edited an iDevice in {target}',
    'idevice.moved': 'Moved an iDevice in {target}',
    'idevice.deleted': 'Deleted an iDevice from {target}',
    'idevice.cloned': 'Cloned an iDevice in {target}',
    'project.metadata_updated': 'Edited the project properties',
    'content.undone': 'Undid changes',
    'content.redone': 'Redid changes',
    'import.elpx': 'Imported content from an .elpx file',
    'import.elp': 'Imported content from a legacy .elp file',
    'import.idevice': 'Imported an iDevice',
};

const VISIBILITY_LABELS = {
    public: 'Anyone with the edit link',
    private: 'Only invited people',
};

export class ActivityLogView {
    /**
     * @param {HTMLElement} container
     * @param {Object} deps
     * @param {Function} deps.fetchPage
     * @param {Function} deps.fetchActors
     * @param {Function} deps.translate
     * @param {string} [deps.locale]
     * @param {number} [deps.pageSize=50]
     */
    constructor(container, deps) {
        this.container = container;
        this.fetchPage = deps.fetchPage;
        this.fetchActors = deps.fetchActors;
        this.translate = deps.translate || ((key) => key);
        this.locale = deps.locale || (typeof navigator !== 'undefined' ? navigator.language : undefined);
        this.pageSize = deps.pageSize || 50;
        this.filters = { userId: '', from: '', to: '' };
        this.nextCursor = null;
        this.loading = false;
        this.events = [];
        this.recordingEnabled = true;
        this._listeners = [];
        this._requestToken = 0;
        this._buildSkeleton();
    }

    // ------------------------------------------------------------------
    // DOM skeleton
    // ------------------------------------------------------------------

    _t(key) {
        const value = this.translate(key);
        return typeof value === 'string' && value ? value : key;
    }

    _el(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }

    _option(text, value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    }

    _on(element, event, handler) {
        element.addEventListener(event, handler);
        this._listeners.push({ element, event, handler });
    }

    _buildSkeleton() {
        this.container.textContent = '';
        this.container.classList.add('activity-log');

        const form = this._el('form', 'activity-log-filters');
        form.setAttribute('role', 'search');
        const uid = `activity-${Math.random().toString(36).slice(2, 8)}`;

        const userGroup = this._el('div', 'activity-log-filter');
        const userLabel = this._el('label', null, this._t('User'));
        userLabel.htmlFor = `${uid}-user`;
        this.userSelect = this._el('select', 'form-select form-select-sm');
        this.userSelect.id = `${uid}-user`;
        this.userSelect.appendChild(this._option(this._t('All users'), ''));
        userGroup.append(userLabel, this.userSelect);

        const fromGroup = this._el('div', 'activity-log-filter');
        const fromLabel = this._el('label', null, this._t('From'));
        fromLabel.htmlFor = `${uid}-from`;
        this.fromInput = this._el('input', 'form-control form-control-sm');
        this.fromInput.type = 'date';
        this.fromInput.id = `${uid}-from`;
        fromGroup.append(fromLabel, this.fromInput);

        const toGroup = this._el('div', 'activity-log-filter');
        const toLabel = this._el('label', null, this._t('To'));
        toLabel.htmlFor = `${uid}-to`;
        this.toInput = this._el('input', 'form-control form-control-sm');
        this.toInput.type = 'date';
        this.toInput.id = `${uid}-to`;
        toGroup.append(toLabel, this.toInput);

        this.applyButton = this._el('button', 'btn btn-secondary btn-sm', this._t('Apply filters'));
        this.applyButton.type = 'submit';
        this.resetButton = this._el('button', 'btn btn-link btn-sm', this._t('Clear'));
        this.resetButton.type = 'button';

        form.append(userGroup, fromGroup, toGroup, this.applyButton, this.resetButton);

        this.notice = this._el('div', 'activity-log-notice d-none');
        this.notice.setAttribute('role', 'note');

        this.status = this._el('div', 'activity-log-status');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');

        this.list = this._el('ul', 'activity-log-list list-unstyled');
        this.list.setAttribute('aria-label', this._t('Activity'));

        this.loadMoreButton = this._el('button', 'btn btn-outline-secondary btn-sm activity-log-more d-none', this._t('Load more'));
        this.loadMoreButton.type = 'button';

        this.container.append(form, this.notice, this.status, this.list, this.loadMoreButton);

        this._on(form, 'submit', (event) => {
            event.preventDefault();
            this.applyFilters();
        });
        this._on(this.resetButton, 'click', () => this.resetFilters());
        this._on(this.loadMoreButton, 'click', () => this.loadMore());
    }

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------

    /** Load the actor list and the first page. */
    async load() {
        await Promise.all([this._loadActors(), this._loadPage({ reset: true })]);
    }

    async _loadActors() {
        if (typeof this.fetchActors !== 'function') return;
        try {
            const response = await this.fetchActors();
            const actors = Array.isArray(response?.actors) ? response.actors : [];
            const current = this.userSelect.value;
            while (this.userSelect.options.length > 1) this.userSelect.remove(1);
            for (const actor of actors) {
                if (actor.id === null || actor.id === undefined) {
                    this.userSelect.appendChild(this._option(this._t('Deleted user'), 'deleted'));
                    continue;
                }
                this.userSelect.appendChild(this._option(actor.email || String(actor.id), String(actor.id)));
            }
            this.userSelect.value = current;
        } catch (_) {
            // The filter degrades to "All users"; the list still loads.
        }
    }

    _dateBounds() {
        const bounds = {};
        if (this.filters.from) {
            const from = new Date(`${this.filters.from}T00:00:00`);
            if (!Number.isNaN(from.getTime())) bounds.since = from.getTime();
        }
        if (this.filters.to) {
            const to = new Date(`${this.filters.to}T00:00:00`);
            if (!Number.isNaN(to.getTime())) bounds.until = to.getTime() + 24 * 60 * 60 * 1000;
        }
        return bounds;
    }

    async _loadPage({ reset }) {
        const token = ++this._requestToken;
        this.loading = true;
        this.loadMoreButton.disabled = true;
        this._setStatus(this._t('Loading...'));
        if (reset) {
            this.events = [];
            this.nextCursor = null;
            this.list.textContent = '';
        }
        try {
            const params = { limit: this.pageSize, ...this._dateBounds() };
            if (this.filters.userId && this.filters.userId !== 'deleted') params.userId = this.filters.userId;
            if (!reset && this.nextCursor) params.cursor = this.nextCursor;
            const response = await this.fetchPage(params);
            if (token !== this._requestToken) return;
            if (!response || response.responseMessage === 'ERROR' || !Array.isArray(response.events)) {
                this._setStatus(this._t('The activity could not be loaded.'), 'error');
                return;
            }
            let events = response.events;
            if (this.filters.userId === 'deleted') events = events.filter((e) => !e.actor);
            this.events = this.events.concat(events);
            this.nextCursor = response.nextCursor || null;
            this.recordingEnabled = response.recordingEnabled !== false;
            this._renderNotice(response);
            this._renderEvents(events);
            this.loadMoreButton.classList.toggle('d-none', !this.nextCursor);
            if (this.events.length === 0) {
                this._setStatus(this._t('No activity recorded yet.'), 'empty');
            } else {
                this._setStatus('');
            }
        } catch (_) {
            if (token !== this._requestToken) return;
            this._setStatus(this._t('The activity could not be loaded.'), 'error');
        } finally {
            if (token === this._requestToken) {
                this.loading = false;
                this.loadMoreButton.disabled = false;
            }
        }
    }

    applyFilters() {
        this.filters = {
            userId: this.userSelect.value,
            from: this.fromInput.value,
            to: this.toInput.value,
        };
        return this._loadPage({ reset: true });
    }

    resetFilters() {
        this.userSelect.value = '';
        this.fromInput.value = '';
        this.toInput.value = '';
        return this.applyFilters();
    }

    loadMore() {
        if (this.loading || !this.nextCursor) return Promise.resolve();
        return this._loadPage({ reset: false });
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _setStatus(text, kind = '') {
        this.status.textContent = text;
        this.status.className = `activity-log-status${kind ? ` activity-log-status-${kind}` : ''}`;
    }

    _renderNotice(response) {
        if (response.recordingEnabled === false) {
            this.notice.textContent = this._t('Activity recording is disabled on this site. Existing entries remain visible.');
            this.notice.classList.remove('d-none');
            return;
        }
        if (typeof response.retentionDays === 'number' && response.retentionDays > 0) {
            this.notice.textContent = this._t('Entries are kept for {days} days.').replace('{days}', String(response.retentionDays));
            this.notice.classList.remove('d-none');
            return;
        }
        this.notice.classList.add('d-none');
    }

    _formatDate(ms) {
        if (!Number.isFinite(ms)) return '';
        try {
            return new Intl.DateTimeFormat(this.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
        } catch (_) {
            return new Date(ms).toLocaleString();
        }
    }

    _formatTime(ms) {
        try {
            return new Intl.DateTimeFormat(this.locale, { timeStyle: 'short' }).format(new Date(ms));
        } catch (_) {
            return new Date(ms).toLocaleTimeString();
        }
    }

    describe(event) {
        const template = EVENT_LABELS[event.type] ? this._t(EVENT_LABELS[event.type]) : event.type;
        let target = event.target?.label || '';
        if (event.target?.type === 'user' && !target) {
            target = event.target.deleted ? this._t('a deleted user') : `#${event.target.id}`;
        }
        if (!target && event.target?.type && event.target.type !== 'project') {
            target = this._t('an untitled item');
        }
        let text = template.replace('{target}', target);
        if (event.type === 'access.visibility_changed' && event.details?.to) {
            const to = VISIBILITY_LABELS[event.details.to] ? this._t(VISIBILITY_LABELS[event.details.to]) : event.details.to;
            text = `${text}: ${to}`;
        }
        if (event.type.startsWith('import.') && event.details) {
            const parts = [];
            if (event.details.pages) parts.push(this._t('{n} pages').replace('{n}', String(event.details.pages)));
            if (event.details.components) parts.push(this._t('{n} iDevices').replace('{n}', String(event.details.components)));
            if (event.details.mode === 'replace') parts.push(this._t('replacing the previous content'));
            if (parts.length) text = `${text} (${parts.join(', ')})`;
        }
        return text;
    }

    _renderEvents(events) {
        for (const event of events) {
            const item = this._el('li', `activity-log-entry activity-log-entry-${event.provenance || 'client'}`);
            item.dataset.eventId = String(event.id);
            item.dataset.eventType = event.type;

            const head = this._el('div', 'activity-log-entry-head');
            const actor = this._el('span', 'activity-log-actor', event.actor?.email || this._t('Deleted user'));
            const when = this._el('time', 'activity-log-time', this._formatDate(event.occurredAt));
            when.dateTime = new Date(event.occurredAt).toISOString();
            head.append(actor, when);

            const text = this._el('div', 'activity-log-text', this.describe(event));

            const meta = this._el('div', 'activity-log-meta');
            if (event.count > 1) {
                const range =
                    event.firstOccurredAt && event.firstOccurredAt !== event.occurredAt
                        ? this._t('{count} changes between {from} and {to}')
                              .replace('{count}', String(event.count))
                              .replace('{from}', this._formatTime(event.firstOccurredAt))
                              .replace('{to}', this._formatTime(event.occurredAt))
                        : this._t('{count} times').replace('{count}', String(event.count));
                meta.appendChild(this._el('span', 'activity-log-count', range));
            }
            if (event.details?.pageLabel && event.target?.type !== 'page') {
                meta.appendChild(this._el('span', 'activity-log-context', this._t('Page: {page}').replace('{page}', event.details.pageLabel)));
            }
            if (event.details?.ideviceType) {
                meta.appendChild(this._el('span', 'activity-log-context', event.details.ideviceType));
            }
            if (event.provenance === 'client') {
                const badge = this._el('span', 'activity-log-provenance', this._t('reported by the editor'));
                badge.title = this._t('Content changes are reported by the browser that made them and validated by the server.');
                meta.appendChild(badge);
            }

            item.append(head, text);
            if (meta.childNodes.length) item.appendChild(meta);
            this.list.appendChild(item);
        }
    }

    /** Remove listeners and DOM so the view can be recreated safely. */
    destroy() {
        for (const { element, event, handler } of this._listeners) {
            element.removeEventListener(event, handler);
        }
        this._listeners = [];
        this._requestToken++;
        this.container.textContent = '';
        this.container.classList.remove('activity-log');
    }
}

export { EVENT_LABELS };
export default ActivityLogView;
