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
        <code id="webmcp-config-snippet"></code>
        <button id="button-copy-webmcp-config" type="button">copy</button>
        <button id="button-load-webmcp-script" type="button">load</button>
        <button id="button-open-webmcp-widget" type="button">open widget</button>
        <button id="button-open-webmcp-docs" type="button">open docs</button>
        <span id="webmcp-status-value"></span>
        <small id="webmcp-status-description"></small>
        <ul id="webmcp-tools-list"></ul>
      </div>
    `;

    beforeEach(() => {
        window._ = vi.fn((value) => value);
        window.alert = vi.fn();

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
            ensureReady: vi.fn().mockResolvedValue(true),
            canOpenWidget: vi.fn(() => true),
            openWidget: vi.fn(() => true),
            getDocsUrl: vi.fn(() => 'https://example.com/docs'),
            getClientConfigSnippet: vi.fn(
                () => '{"mcpServers":{"webmcp":{"command":"npx"}}}',
            ),
            getStatus: vi.fn(() => ({
                label: 'Ready',
                className: 'ok',
                description: 'Service is ready',
            })),
            isLoading: vi.fn(() => false),
            isReady: vi.fn(() => true),
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
        expect(modal.configSnippet).not.toBeNull();
        expect(modal.copyConfigButton).not.toBeNull();
        expect(modal.loadScriptButton).not.toBeNull();
        expect(modal.openWidgetButton).not.toBeNull();
        expect(modal.openDocsButton).not.toBeNull();
    });

    it('binds events only once via behaviour', async () => {
        const copySpy = vi
            .spyOn(modal, 'copyConfigToClipboard')
            .mockResolvedValue(undefined);

        modal.behaviour();
        modal.behaviour();

        modal.copyConfigButton.click();
        expect(copySpy).toHaveBeenCalledTimes(1);
    });

    it('shows modal and refreshes content before and after ensureReady', async () => {
        vi.useFakeTimers();
        const refreshSpy = vi.spyOn(modal, 'refreshContent');

        modal.show();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.ensureReady).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledTimes(3);

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

    it('refreshContent fills status, config and tool list', () => {
        modal.refreshContent();

        expect(modal.configSnippet.textContent).toContain('mcpServers');
        expect(modal.statusValue.textContent).toBe('Ready');
        expect(modal.statusValue.className).toBe('ok');
        expect(modal.statusDescription.textContent).toBe('Service is ready');
        expect(modal.loadScriptButton.disabled).toBe(false);
        expect(modal.openWidgetButton.disabled).toBe(false);
        expect(modal.toolsList.querySelectorAll('li')).toHaveLength(2);
    });

    it('refreshContent shows empty tools message when no tools are registered', () => {
        service.getRegisteredTools.mockReturnValue([]);
        modal.refreshContent();

        const items = modal.toolsList.querySelectorAll('li');
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toBe('No tools registered yet.');
    });

    it('load script button forces reload and refreshes content', async () => {
        const refreshSpy = vi.spyOn(modal, 'refreshContent');
        modal.behaviour();
        modal.loadScriptButton.click();
        await Promise.resolve();

        expect(service.ensureReady).toHaveBeenCalledWith({ forceReload: true });
        expect(refreshSpy).toHaveBeenCalled();
    });

    it('open widget warns in native mode', async () => {
        service.canOpenWidget.mockReturnValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        modal.behaviour();
        modal.openWidgetButton.click();
        await Promise.resolve();

        expect(service.ensureReady).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith(
            'Native WebMCP mode is active. No token widget is required.',
        );
    });

    it('open widget shows alert when widget open fails', async () => {
        service.openWidget.mockReturnValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        modal.behaviour();
        modal.openWidgetButton.click();
        await Promise.resolve();

        expect(alertSpy).toHaveBeenCalledWith('WebMCP widget not found.');
    });

    it('open docs button opens docs URL in new tab', () => {
        const focus = vi.fn();
        const openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus });

        modal.behaviour();
        modal.openDocsButton.click();

        expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank');
        expect(focus).toHaveBeenCalledTimes(1);
    });

    it('copyConfigToClipboard alerts when copy fails', async () => {
        modal.configSnippet.textContent = 'abc';
        vi.spyOn(modal, 'copyText').mockResolvedValue(false);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        await modal.copyConfigToClipboard();
        expect(alertSpy).toHaveBeenCalledWith(
            'Could not copy configuration to clipboard.',
        );
    });

    it('copyConfigToClipboard does nothing when snippet is empty', async () => {
        modal.configSnippet.textContent = '';
        const copySpy = vi.spyOn(modal, 'copyText');
        await modal.copyConfigToClipboard();
        expect(copySpy).not.toHaveBeenCalled();
    });

    it('copyText uses clipboard API when available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        const copied = await modal.copyText('hello');
        expect(copied).toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('copyText falls back to execCommand when clipboard fails', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn().mockRejectedValue(new Error('denied')),
            },
        });
        document.execCommand = vi.fn(() => true);
        const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

        const copied = await modal.copyText('fallback');
        expect(copied).toBe(true);
        expect(execSpy).toHaveBeenCalledWith('copy');
    });

    it('copyText returns false when fallback throws', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: undefined,
        });

        const appendSpy = vi
            .spyOn(document.body, 'append')
            .mockImplementation(() => {
                throw new Error('append failed');
            });

        const copied = await modal.copyText('broken');
        expect(copied).toBe(false);
        expect(appendSpy).toHaveBeenCalled();
    });

    it('returns null service when manager has no app webmcp', () => {
        modal.manager = {};
        expect(modal.getWebMcpService()).toBeNull();
    });

    it('refreshContent returns early without service', () => {
        modal.manager = {};
        expect(() => modal.refreshContent()).not.toThrow();
    });

    it('returns early in button handlers when service is unavailable', async () => {
        modal.manager = {};
        const refreshSpy = vi.spyOn(modal, 'refreshContent');

        modal.behaviour();
        modal.loadScriptButton.click();
        modal.openWidgetButton.click();
        modal.openDocsButton.click();
        await Promise.resolve();

        expect(refreshSpy).not.toHaveBeenCalled();
    });
});
