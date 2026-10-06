import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalConnectMcp from './modalConnectMcp.js';

describe('ModalConnectMcp', () => {
    let modal;
    let mockManager;
    let mockElement;
    let mockBootstrapModal;
    let service;

    const createModalHtml = () => `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
        <button class="close" type="button">x</button>
      </div>
      <div class="modal-body">
        <button id="button-open-webmcp-docs" type="button">open docs</button>
        <span id="webmcp-status-value"></span>
        <small id="webmcp-status-description"></small>
        <ul id="webmcp-tools-list"></ul>
      </div>
    `;

    beforeEach(() => {
        window._ = vi.fn((value) => value);

        mockElement = document.createElement('div');
        mockElement.id = 'modalConnectMcp';
        mockElement.innerHTML = createModalHtml();
        document.body.appendChild(mockElement);

        const main = document.createElement('div');
        main.id = 'main';
        document.body.appendChild(main);

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'modalConnectMcp') return mockElement;
            return null;
        });

        mockBootstrapModal = {
            show: vi.fn(),
            hide: vi.fn(),
            _isShown: false,
        };
        window.bootstrap = {
            Modal: vi.fn().mockImplementation(function () {
                return mockBootstrapModal;
            }),
        };

        const mockInteractable = {
            draggable: vi.fn().mockReturnThis(),
        };
        window.interact = vi.fn().mockImplementation(() => mockInteractable);
        window.interact.modifiers = {
            restrictRect: vi.fn(),
        };

        service = {
            init: vi.fn(() => true),
            getDocsUrl: vi.fn(() => 'https://example.com/docs'),
            getStatus: vi.fn(() => ({
                label: 'Ready',
                className: 'ok',
                description: 'Service is ready',
            })),
            getRegisteredTools: vi.fn(() => [
                { name: 'exe.pages.create' },
                { name: 'exe.idevices.text.add' },
            ]),
        };

        mockManager = {
            app: {
                webmcp: service,
            },
            closeModals: vi.fn(() => false),
        };

        modal = new ModalConnectMcp(mockManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('initializes expected DOM references', () => {
        expect(modal.id).toBe('modalConnectMcp');
        expect(modal.openDocsButton).not.toBeNull();
        expect(modal.statusValue).not.toBeNull();
        expect(modal.toolsList).not.toBeNull();
    });

    it('binds events only once via behaviour', () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        modal.behaviour();
        modal.behaviour();

        modal.openDocsButton.click();
        expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it('show retries detection, refreshes content and opens the modal', () => {
        vi.useFakeTimers();
        const refreshSpy = vi.spyOn(modal, 'refreshContent');

        modal.show();

        expect(service.init).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60);
        expect(mockBootstrapModal.show).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('uses long delay when closeModals closes another modal', () => {
        vi.useFakeTimers();
        mockManager.closeModals.mockReturnValue(true);

        modal.show();
        vi.advanceTimersByTime(499);
        expect(mockBootstrapModal.show).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(mockBootstrapModal.show).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('refreshContent fills status and tool list', () => {
        modal.refreshContent();

        expect(modal.statusValue.textContent).toBe('Ready');
        expect(modal.statusValue.className).toBe('ok');
        expect(modal.statusDescription.textContent).toBe('Service is ready');
        const items = modal.toolsList.querySelectorAll('li');
        expect([...items].map((li) => li.textContent)).toEqual(['exe.pages.create', 'exe.idevices.text.add']);
    });

    it('refreshContent shows empty tools message when no tools are registered', () => {
        service.getRegisteredTools.mockReturnValue([]);
        modal.refreshContent();

        const items = modal.toolsList.querySelectorAll('li');
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toBe('No tools registered yet.');
    });

    it('open docs button opens docs URL in new tab', () => {
        const focus = vi.fn();
        const openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus });

        modal.behaviour();
        modal.openDocsButton.click();

        expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank');
        expect(focus).toHaveBeenCalledTimes(1);
    });

    it('returns null service when manager has no app webmcp', () => {
        modal.manager = {};
        expect(modal.getWebMcpService()).toBeNull();
    });

    it('refreshContent returns early without service', () => {
        modal.manager = {};
        expect(() => modal.refreshContent()).not.toThrow();
    });

    it('show works without service', () => {
        vi.useFakeTimers();
        modal.manager = { closeModals: vi.fn(() => false) };

        expect(() => modal.show()).not.toThrow();
        vi.advanceTimersByTime(60);
        expect(mockBootstrapModal.show).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('docs button does nothing when service is unavailable', () => {
        modal.manager = {};
        const openSpy = vi.spyOn(window, 'open');

        modal.behaviour();
        modal.openDocsButton.click();

        expect(openSpy).not.toHaveBeenCalled();
    });
});
