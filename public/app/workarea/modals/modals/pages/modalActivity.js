import Modal from '../modal.js';
import { ActivityLogView } from '../../../../activity/activityLogView.js';

/**
 * Activity Modal (issue #2689) - per-project activity log for owners,
 * administrators and, when the site allows it, editors. Opened from the share
 * modal. Read-only: it never offers diffs or restoration.
 */
export default class ModalActivity extends Modal {
    constructor(manager) {
        const id = 'modalActivity';
        const titleDefault = _('Activity');
        super(manager, id, titleDefault, false);

        this.projectId = null;
        this.view = null;
        this.lastFocusedElement = null;
        this.container = this.modalElement.querySelector('#activity-log-container');
        this.backButton = this.modalElement.querySelector('#activity-back-button');
    }

    behaviour() {
        super.behaviour();
        this.backButton?.addEventListener('click', () => this.backToShare());
        this.modalElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
        this.modalElement.addEventListener('hidden.bs.modal', () => this.destroyView());
    }

    /**
     * Show the activity log of the current project.
     * @param {Object} [options]
     * @param {string} [options.projectId] - Project UUID (defaults to the open project)
     * @param {string} [options.title] - Project title for the heading
     */
    async show(options = {}) {
        const projectId = options.projectId || eXeLearning.app.project?.odeId;
        if (!projectId) {
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: _('No project available'),
                contentId: 'error',
            });
            return;
        }
        this.projectId = projectId;
        this.lastFocusedElement = document.activeElement;

        const projectTitle =
            options.title ||
            eXeLearning.app.project?.properties?.properties?.pp_title?.value ||
            _('Untitled document');
        this.setTitle(_('Activity of "{title}"').replace('{title}', this.escapeHtml(projectTitle)));
        this.setContentId(projectId);

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.modal.show();
            this.renderView();
        }, time);
    }

    /**
     * Build (or rebuild) the shared read-only view bound to the API layer.
     */
    renderView() {
        if (!this.container) return;
        this.destroyView();
        const api = eXeLearning.app.api;
        const projectId = this.projectId;
        this.view = new ActivityLogView(this.container, {
            fetchPage: (params) => api.getProjectActivity(projectId, params),
            fetchActors: () => api.getProjectActivityActors(projectId),
            translate: (key) => _(key),
            locale: eXeLearning.app.locale?.lang || undefined,
        });
        this.view.load().finally(() => {
            // Move focus into the dialog once content exists (screen readers announce the status region).
            this.view?.userSelect?.focus?.();
        });
    }

    destroyView() {
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
    }

    backToShare() {
        this.close();
        const share = this.manager.share;
        if (share && typeof share.show === 'function') {
            setTimeout(() => share.show(), this.timeMin);
        }
    }

    close() {
        super.close();
        this.destroyView();
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
}
