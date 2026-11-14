import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalActivity from './modalActivity.js';

const flush = () => vi.advanceTimersByTimeAsync(10);

describe('ModalActivity', () => {
    let modal;
    let manager;
    let element;
    let bootstrapModal;

    beforeEach(() => {
        vi.useFakeTimers();
        window._ = vi.fn((key) => key);
        window.eXeLearning = {
            app: {
                project: { odeId: 'proj-uuid', properties: { properties: { pp_title: { value: 'My <b>project</b>' } } } },
                modals: { alert: { show: vi.fn() } },
                locale: { lang: 'en' },
                api: {
                    getProjectActivity: vi.fn(async () => ({ events: [], nextCursor: null, recordingEnabled: true, retentionDays: 90 })),
                    getProjectActivityActors: vi.fn(async () => ({ actors: [] })),
                },
            },
        };
        element = document.createElement('div');
        element.id = 'modalActivity';
        element.innerHTML = `
            <div class="modal-header"><h5 class="modal-title"></h5></div>
            <div class="modal-body"><div id="activity-log-container"></div></div>
            <div class="modal-footer"><button id="activity-back-button" type="button"></button></div>
        `;
        document.body.appendChild(element);
        bootstrapModal = { show: vi.fn(), hide: vi.fn(), _isShown: false };
        window.bootstrap = {
            Modal: vi.fn(function MockModal() {
                return bootstrapModal;
            }),
        };
        window.bootstrap.Modal.getInstance = vi.fn(() => bootstrapModal);
        const interactable = { draggable: vi.fn().mockReturnThis() };
        window.interact = vi.fn(() => interactable);
        window.interact.modifiers = { restrictRect: vi.fn() };
        manager = {
            closeModals: vi.fn(() => false),
            share: { show: vi.fn() },
        };
        modal = new ModalActivity(manager);
        modal.modal = bootstrapModal;
        modal.timeMin = 0;
        modal.timeMax = 0;
        modal.behaviour();
    });

    afterEach(() => {
        element.remove();
        vi.useRealTimers();
        delete window.eXeLearning;
        delete window.bootstrap;
        delete window.interact;
    });

    it('opens with the escaped project title and loads the log through the API layer', async () => {
        await modal.show();
        vi.runAllTimers();
        expect(bootstrapModal.show).toHaveBeenCalled();
        expect(modal.modalElementTitle.textContent).toBe('Activity of "My <b>project</b>"');
        expect(modal.modalElementTitle.querySelector('b')).toBeNull();
        expect(modal.view).not.toBeNull();
        await flush();
        vi.runAllTimers();
        expect(window.eXeLearning.app.api.getProjectActivity).toHaveBeenCalledWith('proj-uuid', expect.objectContaining({ limit: 50 }));
        expect(window.eXeLearning.app.api.getProjectActivityActors).toHaveBeenCalledWith('proj-uuid');
    });

    it('accepts an explicit project id and title', async () => {
        await modal.show({ projectId: 'other-uuid', title: 'Other' });
        vi.runAllTimers();
        expect(modal.projectId).toBe('other-uuid');
        expect(modal.modalElementTitle.textContent).toBe('Activity of "Other"');
        await flush();
        expect(window.eXeLearning.app.api.getProjectActivity.mock.calls[0][0]).toBe('other-uuid');
    });

    it('alerts and stays closed when no project is available', async () => {
        window.eXeLearning.app.project = null;
        await modal.show();
        vi.runAllTimers();
        expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        expect(bootstrapModal.show).not.toHaveBeenCalled();
    });

    it('destroys the view on close and returns focus to the opener', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        await modal.show();
        vi.runAllTimers();
        const view = modal.view;
        const destroySpy = vi.spyOn(view, 'destroy');
        modal.close();
        expect(destroySpy).toHaveBeenCalled();
        expect(modal.view).toBeNull();
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('goes back to the share modal', async () => {
        await modal.show();
        vi.runAllTimers();
        modal.backButton.click();
        vi.runAllTimers();
        expect(manager.share.show).toHaveBeenCalled();
    });

    it('closes on Escape and tears the view down when the dialog is hidden', async () => {
        await modal.show();
        vi.runAllTimers();
        const closeSpy = vi.spyOn(modal, 'close');
        modal.modalElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(closeSpy).toHaveBeenCalled();
        modal.renderView();
        expect(modal.view).not.toBeNull();
        modal.modalElement.dispatchEvent(new Event('hidden.bs.modal'));
        expect(modal.view).toBeNull();
    });
});
