/**
 * navbarFile Tests
 *
 * Unit tests for NavbarFile class.
 * Tests constructor initialization, event setup, event handlers, and action methods.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NavbarFile from './navbarFile.js';

describe('NavbarFile', () => {
    let mockMenu;
    let mockButtons;
    let navbarFile;
    let originalTooltip;
    let navbarElement;

    beforeEach(() => {
        vi.clearAllMocks();

        const createButton = (id) => {
            const button = document.createElement('button');
            button.id = id;
            button.addEventListener = vi.fn();
            return button;
        };

        navbarElement = document.createElement('nav');
        mockButtons = {
            dropdownFile: createButton('dropdownFile'),
            newButton: createButton('navbar-button-new'),
            newFromTemplateButton: createButton('navbar-button-new-from-template'),
            saveButton: createButton('navbar-button-save'),
            settingsButton: createButton('navbar-button-settings'),
            shareButton: createButton('navbar-button-share'),
            uploadPlatformButton: createButton('navbar-button-uploadtoplatform'),
            openUserOdeFilesButton: createButton('navbar-button-openuserodefiles'),
            openOfflineButton: createButton('navbar-button-open-offline'),
            saveOfflineButton: createButton('navbar-button-save-offline'),
            recentProjectsButton: createButton('navbar-button-dropdown-recent-projects'),
            downloadProjectButton: createButton('navbar-button-download-project'),
            downloadProjectAsButton: createButton('navbar-button-download-project-as'),
            exportHTML5Button: createButton('navbar-button-export-html5'),
            exportHTML5AsButton: createButton('navbar-button-exportas-html5'),
            exportHTML5FolderAsButton: createButton('navbar-button-exportas-html5-folder'),
            exportHTML5SPButton: createButton('navbar-button-export-html5-sp'),
            exportHTML5SPAsButton: createButton('navbar-button-exportas-html5-sp'),
            exportPrintButton: createButton('navbar-button-export-print'),
            exportSCORM12Button: createButton('navbar-button-export-scorm12'),
            exportSCORM12AsButton: createButton('navbar-button-exportas-scorm12'),
            exportSCORM2004Button: createButton('navbar-button-export-scorm2004'),
            exportSCORM2004AsButton: createButton('navbar-button-exportas-scorm2004'),
            exportIMSButton: createButton('navbar-button-export-ims'),
            exportIMSAsButton: createButton('navbar-button-exportas-ims'),
            exportEPUB3Button: createButton('navbar-button-export-epub3'),
            exportEPUB3AsButton: createButton('navbar-button-exportas-epub3'),
            exportXmlPropertiesButton: createButton('navbar-button-export-xml-properties'),
            exportXmlPropertiesAsButton: createButton('navbar-button-exportas-xml-properties'),
            importXmlPropertiesButton: createButton('navbar-button-import-xml-properties'),
            importElpButton: createButton('navbar-button-import-elp'),
            leftPanelsTogglerButton: createButton('exe-panels-toggler'),
        };

        Object.values(mockButtons).forEach((button) => navbarElement.appendChild(button));
        const recentProjectsDropdown = document.createElement('ul');
        recentProjectsDropdown.id = 'navbar-dropdown-menu-recent-projects';
        navbarElement.appendChild(recentProjectsDropdown);
        vi.spyOn(navbarElement, 'querySelector');

        mockMenu = {
            navbar: navbarElement,
        };

        // Mock global window
        global.window = {
            AppLogger: { log: vi.fn() },
            open: vi.fn(),
            location: {
                origin: 'http://localhost:8080',
                href: '',
                replace: vi.fn(),
                search: '',
            },
            onbeforeunload: null,
            electronAPI: null,
            fetch: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            innerWidth: 1024,
        };
        global.eXe = {
            app: {
                alert: vi.fn(),
            },
        };

        // Mock eXeLearning
        global.eXeLearning = {
            app: {
                project: {
                    checkOpenIdevice: vi.fn(() => false),
                    odeSession: 'test-session-123',
                    odeId: 'test-ode-id',
                    odeVersion: 'v1',
                    save: vi.fn(),
                    _yjsEnabled: false,
                    _yjsBridge: null,
                    transitionToProject: null,
                    exportToElpxViaYjs: null,
                    importFromElpxViaYjs: null,
                    openLoad: vi.fn(),
                    showModalSaveOk: vi.fn(),
                    showModalSaveError: vi.fn(),
                },
                modals: {
                    templateselection: { show: vi.fn() },
                    sessionlogout: { show: vi.fn() },
                    confirm: { show: vi.fn() },
                    alert: { show: vi.fn() },
                    share: { show: vi.fn() },
                    uploadtodrive: { show: vi.fn() },
                    uploadtodropbox: { show: vi.fn() },
                    openuserodefiles: {
                        show: vi.fn(),
                        largeFilesUpload: vi.fn(),
                    },
                    uploadprogress: {
                        show: vi.fn(),
                        setProcessingPhase: vi.fn(),
                        setComplete: vi.fn(),
                        hide: vi.fn(),
                        updateUploadProgress: vi.fn(),
                        showError: vi.fn(),
                    },
                },
                toasts: {
                    createToast: vi.fn(() => ({
                        toastBody: {
                            innerHTML: '',
                            classList: { add: vi.fn() }
                        },
                        remove: vi.fn(),
                    })),
                },
                api: {
                    postCheckCurrentOdeUsers: vi.fn().mockResolvedValue({ leaveEmptySession: false }),
                    postCloseSession: vi.fn().mockResolvedValue({}),
                    postOdeSaveAs: vi.fn().mockResolvedValue({}),
                    postFirstTypePlatformIntegrationElpUpload: vi.fn(),
                    getOdeExportDownload: vi.fn().mockResolvedValue({ url: 'http://test.com/file.zip' }),
                    getOdePreviewUrl: vi.fn(),
                    getFileResourcesForceDownload: vi.fn().mockResolvedValue({ url: 'http://test.com/file.zip' }),
                    getRecentUserOdeFiles: vi.fn().mockResolvedValue([]),
                    getUserOdeFiles: vi.fn().mockResolvedValue([]),
                    getOdeConcurrentUsers: vi.fn().mockResolvedValue({ currentUsers: [] }),
                    postLocalLargeOdeFile: vi.fn(),
                    postImportElpToRootFromLocal: vi.fn(),
                    getFoldersGoogleDrive: vi.fn(),
                    getUrlLoginGoogleDrive: vi.fn(),
                    getFoldersDropbox: vi.fn(),
                    getUrlLoginDropbox: vi.fn(),
                },
                actions: {
                    authorizeAddActions: false,
                },
                interface: {
                    connectionTime: {
                        loadLasUpdatedInInterface: vi.fn(),
                    },
                },
            },
            config: {
                isOfflineInstallation: false,
                platformUrlSet: 'http://platform',
                baseURL: '',
                basePath: '',
            },
            extension: 'elpx',
        };

        // Mock i18n
        global._ = vi.fn((str) => str);

        if (!global.$ || !global.$.fn) {
            throw new Error('jQuery is not available in the test environment');
        }
        originalTooltip = global.$.fn.tooltip;
        global.$.fn.tooltip = vi.fn().mockReturnThis();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete global.window;
        delete global.eXeLearning;
        delete global._;
        delete global.eXe;
        global.$.fn.tooltip = originalTooltip;
    });

    describe('constructor', () => {
        it('should initialize with menu reference', () => {
            navbarFile = new NavbarFile(mockMenu);
            expect(navbarFile.menu).toBe(mockMenu);
        });

        it('should query for all button elements', () => {
            navbarFile = new NavbarFile(mockMenu);

            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#dropdownFile');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-new');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-new-from-template');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-save');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-settings');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-share');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-uploadtoplatform');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-openuserodefiles');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-open-offline');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-save-offline');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-dropdown-recent-projects');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-download-project');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-download-project-as');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-html5');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-html5');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-html5-folder');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-html5-sp');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-html5-sp');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-print');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-scorm12');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-scorm12');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-scorm2004');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-scorm2004');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-ims');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-ims');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-epub3');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-epub3');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-export-xml-properties');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-exportas-xml-properties');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-import-xml-properties');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-import-elp');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#exe-panels-toggler');
        });

        it('should store button references', () => {
            navbarFile = new NavbarFile(mockMenu);

            expect(navbarFile.button).toBe(mockButtons.dropdownFile);
            expect(navbarFile.newButton).toBe(mockButtons.newButton);
            expect(navbarFile.newFromTemplateButton).toBe(mockButtons.newFromTemplateButton);
            expect(navbarFile.saveButton).toBe(mockButtons.saveButton);
            expect(navbarFile.settingsButton).toBe(mockButtons.settingsButton);
            expect(navbarFile.shareButton).toBe(mockButtons.shareButton);
            expect(navbarFile.uploadPlatformButton).toBe(mockButtons.uploadPlatformButton);
            expect(navbarFile.openUserOdeFilesButton).toBe(mockButtons.openUserOdeFilesButton);
            expect(navbarFile.openOfflineButton).toBe(mockButtons.openOfflineButton);
            expect(navbarFile.saveOfflineButton).toBe(mockButtons.saveOfflineButton);
            expect(navbarFile.recentProjectsButton).toBe(mockButtons.recentProjectsButton);
            expect(navbarFile.downloadProjectButton).toBe(mockButtons.downloadProjectButton);
            expect(navbarFile.downloadProjectAsButton).toBe(mockButtons.downloadProjectAsButton);
            expect(navbarFile.exportHTML5Button).toBe(mockButtons.exportHTML5Button);
            expect(navbarFile.exportHTML5AsButton).toBe(mockButtons.exportHTML5AsButton);
            expect(navbarFile.exportHTML5FolderAsButton).toBe(mockButtons.exportHTML5FolderAsButton);
            expect(navbarFile.exportHTML5SPButton).toBe(mockButtons.exportHTML5SPButton);
            expect(navbarFile.exportHTML5SPAsButton).toBe(mockButtons.exportHTML5SPAsButton);
            expect(navbarFile.exportPrintButton).toBe(mockButtons.exportPrintButton);
            expect(navbarFile.exportSCORM12Button).toBe(mockButtons.exportSCORM12Button);
            expect(navbarFile.exportSCORM12AsButton).toBe(mockButtons.exportSCORM12AsButton);
            expect(navbarFile.exportSCORM2004Button).toBe(mockButtons.exportSCORM2004Button);
            expect(navbarFile.exportSCORM2004AsButton).toBe(mockButtons.exportSCORM2004AsButton);
            expect(navbarFile.exportIMSButton).toBe(mockButtons.exportIMSButton);
            expect(navbarFile.exportIMSAsButton).toBe(mockButtons.exportIMSAsButton);
            expect(navbarFile.exportEPUB3Button).toBe(mockButtons.exportEPUB3Button);
            expect(navbarFile.exportEPUB3AsButton).toBe(mockButtons.exportEPUB3AsButton);
            expect(navbarFile.exportXmlPropertiesButton).toBe(mockButtons.exportXmlPropertiesButton);
            expect(navbarFile.exportXmlPropertiesAsButton).toBe(mockButtons.exportXmlPropertiesAsButton);
            expect(navbarFile.importXmlPropertiesButton).toBe(mockButtons.importXmlPropertiesButton);
            expect(navbarFile.importElpButton).toBe(mockButtons.importElpButton);
            expect(navbarFile.leftPanelsTogglerButton).toBe(mockButtons.leftPanelsTogglerButton);
        });
    });

    describe('setEvents', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should call all event setup methods', () => {
            const spies = {
                setNewProjectEvent: vi.spyOn(navbarFile, 'setNewProjectEvent'),
                setNewFromTemplateEvent: vi.spyOn(navbarFile, 'setNewFromTemplateEvent'),
                setSaveProjectEvent: vi.spyOn(navbarFile, 'setSaveProjectEvent'),
                setUploadPlatformEvent: vi.spyOn(navbarFile, 'setUploadPlatformEvent'),
                setOpenUserOdeFilesEvent: vi.spyOn(navbarFile, 'setOpenUserOdeFilesEvent'),
                setOpenOfflineEvent: vi.spyOn(navbarFile, 'setOpenOfflineEvent'),
                setRecentProjectsEvent: vi.spyOn(navbarFile, 'setRecentProjectsEvent'),
                setDownloadProjectEvent: vi.spyOn(navbarFile, 'setDownloadProjectEvent'),
                setSaveProjectOfflineEvent: vi.spyOn(navbarFile, 'setSaveProjectOfflineEvent'),
                setDownloadProjectAsEvent: vi.spyOn(navbarFile, 'setDownloadProjectAsEvent'),
                setExportHTML5Event: vi.spyOn(navbarFile, 'setExportHTML5Event'),
                setExportHTML5AsEvent: vi.spyOn(navbarFile, 'setExportHTML5AsEvent'),
                setExportHTML5FolderAsEvent: vi.spyOn(navbarFile, 'setExportHTML5FolderAsEvent'),
                setExportHTML5SPEvent: vi.spyOn(navbarFile, 'setExportHTML5SPEvent'),
                setExportHTML5SPAsEvent: vi.spyOn(navbarFile, 'setExportHTML5SPAsEvent'),
                setExportPrintEvent: vi.spyOn(navbarFile, 'setExportPrintEvent'),
                setExportSCORM12Event: vi.spyOn(navbarFile, 'setExportSCORM12Event'),
                setExportSCORM12AsEvent: vi.spyOn(navbarFile, 'setExportSCORM12AsEvent'),
                setExportSCORM2004Event: vi.spyOn(navbarFile, 'setExportSCORM2004Event'),
                setExportSCORM2004AsEvent: vi.spyOn(navbarFile, 'setExportSCORM2004AsEvent'),
                setExportIMSEvent: vi.spyOn(navbarFile, 'setExportIMSEvent'),
                setExportIMSAsEvent: vi.spyOn(navbarFile, 'setExportIMSAsEvent'),
                setExportEPUB3Event: vi.spyOn(navbarFile, 'setExportEPUB3Event'),
                setExportEPUB3AsEvent: vi.spyOn(navbarFile, 'setExportEPUB3AsEvent'),
                setExportXmlPropertiesEvent: vi.spyOn(navbarFile, 'setExportXmlPropertiesEvent'),
                setExportXmlPropertiesAsEvent: vi.spyOn(navbarFile, 'setExportXmlPropertiesAsEvent'),
                setImportXmlPropertiesEvent: vi.spyOn(navbarFile, 'setImportXmlPropertiesEvent'),
                setImportElpEvent: vi.spyOn(navbarFile, 'setImportElpEvent'),
                setLeftPanelsTogglerEvents: vi.spyOn(navbarFile, 'setLeftPanelsTogglerEvents'),
            };

            navbarFile.setEvents();

            Object.values(spies).forEach((spy) => {
                expect(spy).toHaveBeenCalled();
            });
        });
    });

    describe('event listener setup', () => {
        const getHandlerByEventName = (mockFn, eventName) => {
            const call = mockFn.mock.calls.find(([name]) => name === eventName);
            return call?.[1];
        };

        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('setNewProjectEvent should add click listener', () => {
            navbarFile.setNewProjectEvent();
            expect(mockButtons.newButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockButtons.newButton.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
            expect(mockButtons.newButton.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
            expect(window.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function), true);
            expect(window.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
        });

        it('setNewProjectEvent should prevent default and create a new project on regular click', () => {
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            navbarFile.setNewProjectEvent();

            const handler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );
            handler({
                preventDefault,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(newProjectSpy).toHaveBeenCalled();
        });

        it('setNewProjectEvent should open a new window on Ctrl/Cmd click', () => {
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            navbarFile.setNewProjectEvent();

            const handler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );
            handler({
                preventDefault,
                ctrlKey: true,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('http://localhost:8080/workarea', '_blank');
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should open current URL on Ctrl/Cmd click in static mode', () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.location.href = 'http://localhost:64522/?v=v0.0.0-alpha';
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            navbarFile.setNewProjectEvent();

            const handler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );
            handler({
                preventDefault,
                ctrlKey: false,
                metaKey: true,
                shiftKey: false,
                altKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('http://localhost:64522/?v=v0.0.0-alpha', '_blank');
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should keep Ctrl/Cmd intent from mousedown if click modifiers are missing', () => {
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            navbarFile.setNewProjectEvent();

            const mousedownHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'mousedown'
            );
            const clickHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );

            mousedownHandler({
                ctrlKey: true,
                metaKey: false,
                button: 0,
            });
            clickHandler({
                preventDefault,
                ctrlKey: false,
                metaKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('http://localhost:8080/workarea', '_blank');
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should keep Ctrl/Cmd intent from pointerdown if click modifiers are missing', () => {
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            navbarFile.setNewProjectEvent();

            const pointerdownHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'pointerdown'
            );
            const clickHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );

            pointerdownHandler({
                ctrlKey: true,
                metaKey: false,
                button: 0,
            });
            clickHandler({
                preventDefault,
                ctrlKey: false,
                metaKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('http://localhost:8080/workarea', '_blank');
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should open new tab when Ctrl/Cmd key state is tracked globally', () => {
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');
            const preventDefault = vi.fn();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            navbarFile.setNewProjectEvent();

            const keydownCall = window.addEventListener.mock.calls.find(
                ([eventName]) => eventName === 'keydown'
            );
            const clickHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );

            keydownCall?.[1]({ key: 'Control' });
            clickHandler({
                preventDefault,
                ctrlKey: false,
                metaKey: false,
                button: 0,
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('http://localhost:8080/workarea', '_blank');
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should suppress immediate duplicate newProjectEvent after opening new tab', () => {
            const realNewProjectEvent = NavbarFile.prototype.newProjectEvent;
            const newSessionSpy = vi.spyOn(navbarFile, 'newSession').mockResolvedValue();
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            const preventDefault = vi.fn();
            const stopPropagation = vi.fn();
            navbarFile.setNewProjectEvent();

            const clickHandler = getHandlerByEventName(
                mockButtons.newButton.addEventListener,
                'click'
            );
            clickHandler({
                preventDefault,
                stopPropagation,
                ctrlKey: true,
                metaKey: false,
                button: 0,
            });

            // Simulate a stale duplicated listener trying to execute in same gesture.
            realNewProjectEvent.call(navbarFile);

            expect(openSpy).toHaveBeenCalledWith('http://localhost:8080/workarea', '_blank');
            expect(newSessionSpy).not.toHaveBeenCalled();
        });

        it('setNewProjectEvent should not duplicate listeners when called twice', () => {
            const removeSpy = vi.spyOn(mockButtons.newButton, 'removeEventListener');
            const openSpy = vi.spyOn(window, 'open').mockReturnValue({
                focus: vi.fn(),
            });
            const newProjectSpy = vi.spyOn(navbarFile, 'newProjectEvent');

            navbarFile.setNewProjectEvent();
            navbarFile.setNewProjectEvent();

            expect(removeSpy).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );

            const clickCall = mockButtons.newButton.addEventListener.mock.calls
                .filter(([eventName]) => eventName === 'click')
                .at(-1);
            const clickHandler = clickCall?.[1];
            clickHandler({
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                ctrlKey: true,
                metaKey: false,
                button: 0,
            });

            expect(openSpy).toHaveBeenCalledTimes(1);
            expect(newProjectSpy).not.toHaveBeenCalled();
        });

        it('newProjectEvent should respect global suppression flag from other instances', () => {
            const newSessionSpy = vi.spyOn(navbarFile, 'newSession').mockResolvedValue();
            window.__exeSuppressNewProjectUntil = Date.now() + 1000;

            navbarFile.newProjectEvent();

            expect(newSessionSpy).not.toHaveBeenCalled();
            expect(window.__exeSuppressNewProjectUntil).toBe(0);
        });

        it('setNewFromTemplateEvent should add click listener', () => {
            navbarFile.setNewFromTemplateEvent();
            expect(mockButtons.newFromTemplateButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('checkAndShowNewFromTemplateButton should show button when templates exist', async () => {
            // Setup: wrap button in a list item with d-none class
            const li = document.createElement('li');
            li.classList.add('d-none');
            li.appendChild(mockButtons.newFromTemplateButton);
            navbarElement.appendChild(li);

            // Mock fetch to return templates
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    templates: [{ name: 'Test Template', path: '/path/to/template' }],
                    locale: 'en',
                    supportedLocales: ['en', 'es']
                })
            });

            await navbarFile.checkAndShowNewFromTemplateButton();

            expect(li.classList.contains('d-none')).toBe(false);
        });

        it('checkAndShowNewFromTemplateButton should keep button hidden when no templates', async () => {
            const li = document.createElement('li');
            li.classList.add('d-none');
            li.appendChild(mockButtons.newFromTemplateButton);
            navbarElement.appendChild(li);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    templates: [],
                    locale: 'en',
                    supportedLocales: ['en', 'es']
                })
            });

            await navbarFile.checkAndShowNewFromTemplateButton();

            expect(li.classList.contains('d-none')).toBe(true);
        });

        it('checkAndShowNewFromTemplateButton should handle fetch error gracefully', async () => {
            const li = document.createElement('li');
            li.classList.add('d-none');
            li.appendChild(mockButtons.newFromTemplateButton);
            navbarElement.appendChild(li);

            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            await navbarFile.checkAndShowNewFromTemplateButton();

            // Button should stay hidden on error
            expect(li.classList.contains('d-none')).toBe(true);
        });

        it('setSaveProjectEvent should add click listener', () => {
            navbarFile.setSaveProjectEvent();
            expect(mockButtons.saveButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setSettingsEvent should add click listener when button exists', () => {
            navbarFile.setSettingsEvent();
            expect(mockButtons.settingsButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setShareEvent should add click listener when button exists', () => {
            navbarFile.setShareEvent();
            expect(mockButtons.shareButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setUploadPlatformEvent should add click listener when button exists', () => {
            navbarFile.setUploadPlatformEvent();
            expect(mockButtons.uploadPlatformButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setUploadPlatformEvent should add click listener to finishButton when it exists', () => {
            const finishButton = document.createElement('button');
            finishButton.id = 'head-top-finish-button';
            finishButton.addEventListener = vi.fn();
            navbarFile.finishButton = finishButton;

            navbarFile.setUploadPlatformEvent();

            expect(finishButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setUploadPlatformEvent should not add listener to finishButton when it is null', () => {
            navbarFile.finishButton = null;
            navbarFile.setUploadPlatformEvent();
            // Should not throw and uploadPlatformButton listener should still be added
            expect(mockButtons.uploadPlatformButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setUploadPlatformEvent handler should return early if idevice is open', () => {
            global.eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            const uploadEventSpy = vi.spyOn(navbarFile, 'uploadPlatformEvent');

            navbarFile.setUploadPlatformEvent();
            const handler = mockButtons.uploadPlatformButton.addEventListener.mock.calls[0][1];
            handler();

            expect(global.eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(uploadEventSpy).not.toHaveBeenCalled();
        });

        it('setUploadPlatformEvent handler should call uploadPlatformEvent when no idevice is open', () => {
            global.eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            const uploadEventSpy = vi.spyOn(navbarFile, 'uploadPlatformEvent').mockImplementation(() => {});

            navbarFile.setUploadPlatformEvent();
            const handler = mockButtons.uploadPlatformButton.addEventListener.mock.calls[0][1];
            handler();

            expect(global.eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(uploadEventSpy).toHaveBeenCalled();
        });

        it('setOpenUserOdeFilesEvent should add click listener', () => {
            navbarFile.setOpenUserOdeFilesEvent();
            expect(mockButtons.openUserOdeFilesButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setOpenOfflineEvent should add click listener when button exists', () => {
            navbarFile.setOpenOfflineEvent();
            expect(mockButtons.openOfflineButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setRecentProjectsEvent should add click listener', () => {
            navbarFile.setRecentProjectsEvent();
            expect(mockButtons.recentProjectsButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setDownloadProjectEvent should add click listener', () => {
            navbarFile.setDownloadProjectEvent();
            expect(mockButtons.downloadProjectButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setDownloadProjectAsEvent should add click listener when button exists', () => {
            navbarFile.setDownloadProjectAsEvent();
            expect(mockButtons.downloadProjectAsButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setDownloadProjectAsEvent click handler should call downloadProjectEvent', () => {
            vi.spyOn(navbarFile, 'downloadProjectEvent').mockImplementation(() => {});
            navbarFile.setDownloadProjectAsEvent();
            const clickHandler = mockButtons.downloadProjectAsButton.addEventListener.mock.calls[0][1];
            clickHandler();
            expect(navbarFile.downloadProjectEvent).toHaveBeenCalled();
        });

        it('setSaveProjectOfflineEvent should add click listener when button exists', () => {
            navbarFile.setSaveProjectOfflineEvent();
            expect(mockButtons.saveOfflineButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportHTML5Event should add click listener', () => {
            navbarFile.setExportHTML5Event();
            expect(mockButtons.exportHTML5Button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportHTML5SPEvent should add click listener', () => {
            navbarFile.setExportHTML5SPEvent();
            expect(mockButtons.exportHTML5SPButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportPrintEvent should add click listener when button exists', () => {
            navbarFile.setExportPrintEvent();
            expect(mockButtons.exportPrintButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportSCORM12Event should add click listener', () => {
            navbarFile.setExportSCORM12Event();
            expect(mockButtons.exportSCORM12Button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportSCORM2004Event should add click listener', () => {
            navbarFile.setExportSCORM2004Event();
            expect(mockButtons.exportSCORM2004Button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportIMSEvent should add click listener', () => {
            navbarFile.setExportIMSEvent();
            expect(mockButtons.exportIMSButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportEPUB3Event should add click listener', () => {
            navbarFile.setExportEPUB3Event();
            expect(mockButtons.exportEPUB3Button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setExportXmlPropertiesEvent should add click listener', () => {
            navbarFile.setExportXmlPropertiesEvent();
            expect(mockButtons.exportXmlPropertiesButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setImportXmlPropertiesEvent should add click listener', () => {
            navbarFile.setImportXmlPropertiesEvent();
            expect(mockButtons.importXmlPropertiesButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setImportElpEvent should add click listener when button exists', () => {
            navbarFile.setImportElpEvent();
            expect(mockButtons.importElpButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    describe('event handlers with checkOpenIdevice', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('setSaveProjectEvent should return early if idevice is open', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            vi.spyOn(navbarFile, 'saveOdeEvent');
            navbarFile.setSaveProjectEvent();

            const clickHandler = mockButtons.saveButton.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(navbarFile.saveOdeEvent).not.toHaveBeenCalled();
        });

        it('setSaveProjectEvent should call saveOdeEvent when no idevice is open (online mode)', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            eXeLearning.config.isOfflineInstallation = false;
            vi.spyOn(navbarFile, 'saveOdeEvent');
            navbarFile.setSaveProjectEvent();

            const clickHandler = mockButtons.saveButton.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(navbarFile.saveOdeEvent).toHaveBeenCalled();
        });

        it('setSaveProjectEvent should call downloadProjectEvent in offline mode', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = {};
            vi.spyOn(navbarFile, 'downloadProjectEvent');
            navbarFile.setSaveProjectEvent();

            const clickHandler = mockButtons.saveButton.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(navbarFile.downloadProjectEvent).toHaveBeenCalled();
        });

        it('setDownloadProjectEvent should return false if idevice is open', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            vi.spyOn(navbarFile, 'downloadProjectEvent');
            navbarFile.setDownloadProjectEvent();

            const clickHandler = mockButtons.downloadProjectButton.addEventListener.mock.calls[0][1];
            const result = clickHandler();

            expect(eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(navbarFile.downloadProjectEvent).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('setExportHTML5Event should return early if idevice is open', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            vi.spyOn(navbarFile, 'exportHTML5Event');
            navbarFile.setExportHTML5Event();

            const clickHandler = mockButtons.exportHTML5Button.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(navbarFile.exportHTML5Event).not.toHaveBeenCalled();
        });

        it('setSettingsEvent should call openProjectSettingsEvent', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            vi.spyOn(navbarFile, 'openProjectSettingsEvent');
            navbarFile.setSettingsEvent();

            const clickHandler = mockButtons.settingsButton.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(navbarFile.openProjectSettingsEvent).toHaveBeenCalled();
        });

        it('setShareEvent should call openShareModalEvent', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            vi.spyOn(navbarFile, 'openShareModalEvent');
            navbarFile.setShareEvent();

            const clickHandler = mockButtons.shareButton.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(navbarFile.openShareModalEvent).toHaveBeenCalled();
        });
    });

    describe('action methods', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        describe('newProjectEvent', () => {
            it('should call newSession with ode session ID', () => {
                vi.spyOn(navbarFile, 'newSession');
                navbarFile.newProjectEvent();

                expect(navbarFile.newSession).toHaveBeenCalledWith('test-session-123');
            });
        });

        describe('newFromTemplateEvent', () => {
            it('should show template selection modal', () => {
                navbarFile.newFromTemplateEvent();

                expect(eXeLearning.app.modals.templateselection.show).toHaveBeenCalled();
            });
        });

        describe('openProjectSettingsEvent', () => {
            it('should click the root node', () => {
                const root = document.createElement('div');
                root.setAttribute('nav-id', 'root');
                const nodeText = document.createElement('span');
                nodeText.classList.add('nav-element-text');
                nodeText.click = vi.fn();
                root.appendChild(nodeText);
                document.body.appendChild(root);

                navbarFile.openProjectSettingsEvent();

                expect(nodeText.click).toHaveBeenCalled();
            });
        });

        describe('openShareModalEvent', () => {
            it('should show share modal when available', () => {
                navbarFile.openShareModalEvent();
                expect(eXeLearning.app.modals.share.show).toHaveBeenCalled();
            });
        });

        describe('saveOdeEvent', () => {
            it('should call project save method', () => {
                navbarFile.saveOdeEvent();

                expect(eXeLearning.app.project.save).toHaveBeenCalled();
            });
        });

        describe('saveAs', () => {
            it('should update project on successful save', async () => {
                eXeLearning.app.api.postOdeSaveAs.mockResolvedValue({
                    responseMessage: 'OK',
                    odeId: 'new-ode',
                    odeVersionId: 'new-version',
                    newSessionId: 'new-session',
                });

                await navbarFile.saveAs('Title');

                expect(eXeLearning.app.project.odeId).toBe('new-ode');
                expect(eXeLearning.app.project.odeVersion).toBe('new-version');
                expect(eXeLearning.app.project.odeSession).toBe('new-session');
                expect(eXeLearning.app.project.openLoad).toHaveBeenCalled();
                expect(eXeLearning.app.project.showModalSaveOk).toHaveBeenCalled();
            });

            it('should show error modal on failed save', async () => {
                eXeLearning.app.api.postOdeSaveAs.mockResolvedValue({
                    responseMessage: 'ERR',
                });

                await navbarFile.saveAs('Title');

                expect(eXeLearning.app.project.showModalSaveError).toHaveBeenCalled();
            });
        });

        describe('makeConfirmTitleInputModal', () => {
            it('should call saveAs with modal input value', () => {
                document.body.innerHTML = `
                    <div class="modal-confirm">
                        <input class="properties-title-input" value="Modal Title">
                    </div>
                `;
                vi.spyOn(navbarFile, 'saveAs');

                navbarFile.makeConfirmTitleInputModal();

                const confirmArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
                confirmArgs.confirmExec();

                expect(navbarFile.saveAs).toHaveBeenCalledWith('Modal Title');
            });
        });

        describe('saveAsOdeEvent', () => {
            it('should call currentOdeUsers with correct params', () => {
                vi.spyOn(navbarFile, 'currentOdeUsers');
                navbarFile.saveAsOdeEvent();

                expect(navbarFile.currentOdeUsers).toHaveBeenCalledWith({
                    odeSessionId: 'test-session-123',
                    odeVersionId: 'v1',
                    odeId: 'test-ode-id',
                });
            });
        });

        describe('currentOdeUsers', () => {
            it('should prompt for save when only one user is connected', async () => {
                eXeLearning.app.api.getOdeConcurrentUsers.mockResolvedValue({
                    currentUsers: [{}],
                });
                vi.spyOn(navbarFile, 'makeConfirmTitleInputModal');

                await navbarFile.currentOdeUsers({
                    odeSessionId: 'session-1',
                    odeVersionId: 'version-1',
                    odeId: 'ode-1',
                });

                expect(navbarFile.makeConfirmTitleInputModal).toHaveBeenCalled();
            });

            it('should show error when multiple users are connected', async () => {
                eXeLearning.app.api.getOdeConcurrentUsers.mockResolvedValue({
                    currentUsers: [{}, {}],
                });
                const errorSpy = vi.spyOn(eXeLearning.app.project, 'showModalSaveError');

                await navbarFile.currentOdeUsers({
                    odeSessionId: 'session-1',
                    odeVersionId: 'version-1',
                    odeId: 'ode-1',
                });

                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('newSession', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should create session directly when no unsaved changes', async () => {
            // No yjsBridge means no unsaved changes
            eXeLearning.app.project._yjsBridge = null;
            vi.spyOn(navbarFile, 'createSession');

            await navbarFile.newSession('session-123');

            expect(navbarFile.createSession).toHaveBeenCalled();
            expect(eXeLearning.app.modals.sessionlogout.show).not.toHaveBeenCalled();
        });

        it('should create session when hasUnsavedChanges returns false', async () => {
            eXeLearning.app.project._yjsBridge = {
                documentManager: {
                    hasUnsavedChanges: vi.fn(() => false),
                },
            };
            vi.spyOn(navbarFile, 'createSession');

            await navbarFile.newSession('session-123');

            expect(navbarFile.createSession).toHaveBeenCalled();
            expect(eXeLearning.app.modals.sessionlogout.show).not.toHaveBeenCalled();
        });

        it('should show session logout modal when hasUnsavedChanges returns true', async () => {
            eXeLearning.app.project._yjsBridge = {
                documentManager: {
                    hasUnsavedChanges: vi.fn(() => true),
                },
            };
            vi.spyOn(navbarFile, 'createSession');

            await navbarFile.newSession('session-123');

            expect(eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalledWith({
                title: 'New file',
                forceOpen: 'Create new file without saving',
                pendingAction: { action: 'new' },
            });
            expect(navbarFile.createSession).not.toHaveBeenCalled();
        });
    });

    describe('createSession', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use static newProject flow when running in static web mode', async () => {
            eXeLearning.app.capabilities = { storage: { remote: false } };
            window.__EXE_STATIC_MODE__ = true;
            window.electronAPI = null;
            window.newProject = vi.fn();
            global.fetch = vi.fn();

            await navbarFile.createSession();

            expect(window.newProject).toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
            expect(eXeLearning.app.api.postCloseSession).not.toHaveBeenCalled();
            expect(window.onbeforeunload).toBeNull();
        });

        it('should use transitionToProject when available', async () => {
            const transitionSpy = vi.fn().mockResolvedValue();
            eXeLearning.app.project.transitionToProject = transitionSpy;

            await navbarFile.createSession();

            expect(transitionSpy).toHaveBeenCalledWith({
                action: 'new',
                skipSave: true,
            });
        });

        it('should redirect to projects page when transitionToProject is available but fails', async () => {
            const transitionSpy = vi.fn().mockRejectedValue(new Error('Network error'));
            eXeLearning.app.project.transitionToProject = transitionSpy;

            await navbarFile.createSession();

            expect(transitionSpy).toHaveBeenCalled();
            expect(window.onbeforeunload).toBeNull();
            expect(window.location.href).toBe('/projects');
        });

        it('should fall back to redirect when transitionToProject is not available', async () => {
            eXeLearning.app.project.transitionToProject = undefined;

            await navbarFile.createSession();

            expect(window.onbeforeunload).toBeNull();
            expect(window.location.href).toBe('/projects');
        });
    });

    describe('input helpers', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('createIdevicesUploadInput should upload selected file', () => {
            const input = navbarFile.createIdevicesUploadInput();
            const file = new File([new Uint8Array([1, 2, 3])], 'test.elpx');
            Object.defineProperty(input, 'files', {
                value: [file],
            });

            input.dispatchEvent(new Event('change'));

            expect(eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(file);
            expect(navbarElement.querySelectorAll('.local-ode-file-upload-input').length).toBeGreaterThan(0);
        });

        it('createPropertiesUploadInput should upload selected properties file', () => {
            const input = navbarFile.createPropertiesUploadInput();
            const file = new File([new Uint8Array([1, 2, 3])], 'props.xml');
            Object.defineProperty(input, 'files', {
                value: [file],
            });

            input.dispatchEvent(new Event('change'));

            expect(eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(
                file,
                false,
                true
            );
        });
    });

    describe('importElpEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.project.importFromElpxViaYjs = null;
        });

        it('should import via Yjs and update progress modal', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.importFromElpxViaYjs = vi.fn().mockResolvedValue({
                pages: 2,
            });
            vi.useFakeTimers();
            navbarFile.setImportElpEvent();

            const clickHandler = mockButtons.importElpButton.addEventListener.mock.calls[0][1];
            clickHandler();

            const confirmArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            confirmArgs.confirmExec();

            const input = document.querySelector('input[type="file"]');
            const file = new File([new Uint8Array([1, 2, 3])], 'import.elpx');
            Object.defineProperty(input, 'files', {
                value: [file],
            });

            input.dispatchEvent(new Event('change'));
            await Promise.resolve();
            await vi.runAllTimersAsync();

            expect(eXeLearning.app.project.importFromElpxViaYjs).toHaveBeenCalledWith(file, {
                clearExisting: false,
            });
            expect(eXeLearning.app.modals.uploadprogress.setProcessingPhase).toHaveBeenCalledWith('extracting');
            expect(eXeLearning.app.modals.uploadprogress.setComplete).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('should import via legacy upload flow', async () => {
            vi.useFakeTimers();
            eXeLearning.app.api.postLocalLargeOdeFile.mockResolvedValue({
                responseMessage: 'OK',
                odeFileName: 'file.elpx',
                odeFilePath: '/tmp/file.elpx',
            });
            eXeLearning.app.api.postImportElpToRootFromLocal.mockResolvedValue({
                responseMessage: 'OK',
            });
            eXeLearning.app.project.structure = {
                getSelectNodeNavId: vi.fn().mockReturnValue('root'),
                resetDataAndStructureData: vi.fn(),
            };

            navbarFile.setImportElpEvent();
            const clickHandler = mockButtons.importElpButton.addEventListener.mock.calls[0][1];
            clickHandler();

            const confirmArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            confirmArgs.confirmExec();

            const input = document.querySelector('input[type="file"]');
            const file = new File([new Uint8Array([1, 2, 3])], 'import.elpx');
            Object.defineProperty(input, 'files', {
                value: [file],
            });

            input.dispatchEvent(new Event('change'));
            await Promise.resolve();
            await vi.runAllTimersAsync();

            expect(eXeLearning.app.api.postLocalLargeOdeFile).toHaveBeenCalled();
            expect(eXeLearning.app.api.postImportElpToRootFromLocal).toHaveBeenCalledWith({
                odeSessionId: 'test-session-123',
                odeFileName: 'file.elpx',
                odeFilePath: '/tmp/file.elpx',
            });
            expect(eXeLearning.app.project.structure.resetDataAndStructureData).toHaveBeenCalledWith('root');
            vi.useRealTimers();
        });
    });

    describe('openUserOdeFilesEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should open offline file via electron API', async () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = {
                openElp: vi.fn().mockResolvedValue('/tmp/test.elpx'),
                readFile: vi.fn().mockResolvedValue({
                    ok: true,
                    base64: Buffer.from('test').toString('base64'),
                }),
            };
            global.atob = (value) => Buffer.from(value, 'base64').toString('binary');

            navbarFile.openUserOdeFilesEvent();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(window.electronAPI.openElp).toHaveBeenCalled();
            expect(eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalled();
            expect(window.__originalElpPath).toBe('/tmp/test.elpx');
        });

        it('should show alert when offline file read fails', async () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = {
                openElp: vi.fn().mockResolvedValue('/tmp/test.elpx'),
                readFile: vi.fn().mockResolvedValue({
                    ok: false,
                    error: 'Read failed',
                }),
            };

            navbarFile.openUserOdeFilesEvent();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Error opening',
                body: 'Read failed',
                contentId: 'error',
            });
        });

        it('should open online file list when not offline', async () => {
            eXeLearning.config.isOfflineInstallation = false;
            eXeLearning.app.api.getUserOdeFiles.mockResolvedValue([{ odeId: '1' }]);

            navbarFile.openUserOdeFilesEvent();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(eXeLearning.app.modals.openuserodefiles.show).toHaveBeenCalledWith([{ odeId: '1' }]);
        });
    });

    describe('recent projects', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('showMostRecentProjectsEvent should render recent projects list', async () => {
            eXeLearning.app.api.getRecentUserOdeFiles.mockResolvedValue([
                { odeId: 'proj-1', title: 'Project 1' },
            ]);

            navbarFile.showMostRecentProjectsEvent();
            await Promise.resolve();

            const list = navbarElement.querySelector('#navbar-dropdown-menu-recent-projects');
            expect(list.querySelectorAll('a').length).toBe(1);
        });

        it('makeRecentProjecList should prompt when unsaved changes exist', () => {
            eXeLearning.app.project._yjsBridge = {
                documentManager: {
                    hasUnsavedChanges: vi.fn(() => true),
                },
            };

            const list = navbarFile.makeRecentProjecList([
                { odeId: 'proj-2', title: 'Project 2' },
            ]);
            const link = list.querySelector('a');
            link.click();

            expect(eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalledWith({
                title: 'Open project',
                forceOpen: 'Open without saving',
                pendingAction: { action: 'open', projectUuid: 'proj-2' },
            });
        });

        it('makeRecentProjecList should navigate when no unsaved changes', () => {
            eXeLearning.app.project._yjsBridge = {
                documentManager: {
                    hasUnsavedChanges: vi.fn(() => false),
                },
            };

            const list = navbarFile.makeRecentProjecList([
                { odeId: 'proj-3', title: 'Project 3' },
            ]);
            const link = list.querySelector('a');
            link.click();

            expect(window.location.href).toBe('/workarea?project=proj-3');
        });

        it('makeRecentProjecList should show empty message when list is empty', () => {
            const list = navbarFile.makeRecentProjecList([]);
            expect(list.textContent).toContain('No recent projects');
        });
    });

    describe('openPrintPreview', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should open print preview modal when available', () => {
            const mockPrintPreviewModal = {
                show: vi.fn(),
            };
            eXeLearning.app.modals.printpreview = mockPrintPreviewModal;

            navbarFile.openPrintPreview();

            expect(mockPrintPreviewModal.show).toHaveBeenCalled();
        });

        it('should show error when print preview modal is not available', () => {
            eXeLearning.app.modals.printpreview = null;
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            navbarFile.openPrintPreview();

            expect(consoleWarnSpy).toHaveBeenCalledWith('[NavbarFile] Print preview modal not available');
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });

        it('should show error when modals object is missing printpreview', () => {
            delete eXeLearning.app.modals.printpreview;
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            navbarFile.openPrintPreview();

            expect(consoleWarnSpy).toHaveBeenCalledWith('[NavbarFile] Print preview modal not available');
            consoleWarnSpy.mockRestore();
        });
    });

    describe('openClientPreview', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should return false when Yjs is not enabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;

            const result = await navbarFile.openClientPreview();

            expect(result).toBe(false);
        });

        it('should return false when document manager not available', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = null;

            const result = await navbarFile.openClientPreview();

            expect(result).toBe(false);
        });

        it('should return false when PreviewExporter not loaded', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = { documentManager: {} };
            window.PreviewExporter = undefined;

            const result = await navbarFile.openClientPreview();

            expect(result).toBe(false);
        });

        it('should return false when PreviewExporter throws', async () => {
            // When Yjs is enabled but PreviewExporter throws, it should return false
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                documentManager: {},
                assetCache: {},
                assetManager: {},
            };

            // Mock PreviewExporter to throw an error
            globalThis.PreviewExporter = vi.fn(() => {
                throw new Error('Preview failed');
            });

            const result = await navbarFile.openClientPreview();

            // Should return false due to the error
            expect(result).toBe(false);
        });

        it('should handle preview error', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                documentManager: {},
            };

            const mockExporter = {
                preview: vi.fn().mockResolvedValue({
                    success: false,
                    error: 'Preview failed'
                }),
            };
            window.PreviewExporter = vi.fn(() => mockExporter);

            const result = await navbarFile.openClientPreview();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('downloadProjectEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use Yjs export when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.exportToElpxViaYjs = vi.fn();
            vi.spyOn(navbarFile, 'downloadProjectViaYjs').mockResolvedValue(undefined);

            await navbarFile.downloadProjectEvent();

            expect(navbarFile.downloadProjectViaYjs).toHaveBeenCalled();
        });

        it('should use legacy export when Yjs not enabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                path: '/downloads/project.elpx',
            });

            await navbarFile.downloadProjectEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'elpx'
            );
            expect(eXeLearning.app.toasts.createToast).toHaveBeenCalled();
        });
    });

    describe('downloadProjectViaYjs', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should export via Yjs and update UI on success', async () => {
            eXeLearning.app.project.exportToElpxViaYjs = vi.fn().mockResolvedValue({ saved: true });

            await navbarFile.downloadProjectViaYjs();

            // Save always prompts — no saveAs parameter needed
            expect(eXeLearning.app.project.exportToElpxViaYjs).toHaveBeenCalledWith();
            expect(eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface).toHaveBeenCalled();
        });

        it('should not markClean or update UI when user cancels save dialog', async () => {
            eXeLearning.app.project.exportToElpxViaYjs = vi.fn().mockResolvedValue({ saved: false });
            eXeLearning.app.project._yjsBridge = { documentManager: { markClean: vi.fn() } };
            window.electronAPI = { saveBuffer: vi.fn() };

            await navbarFile.downloadProjectViaYjs();

            expect(eXeLearning.app.project._yjsBridge.documentManager.markClean).not.toHaveBeenCalled();
            expect(eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface).not.toHaveBeenCalled();
        });

        it('should markClean in Electron mode on successful save', async () => {
            eXeLearning.app.project.exportToElpxViaYjs = vi.fn().mockResolvedValue({ saved: true });
            const markClean = vi.fn();
            eXeLearning.app.project._yjsBridge = { documentManager: { markClean } };
            window.electronAPI = { saveBuffer: vi.fn() };

            await navbarFile.downloadProjectViaYjs();

            expect(markClean).toHaveBeenCalled();
            expect(eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface).toHaveBeenCalled();
        });

        it('should show alert on Yjs export error', async () => {
            eXeLearning.app.project.exportToElpxViaYjs = vi.fn().mockRejectedValue(new Error('boom'));

            await navbarFile.downloadProjectViaYjs();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });
    });

    describe('exportViaYjs', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                documentManager: {},
                assetCache: {},
                assetManager: {},
            };
            window.SharedExporters = {
                createExporter: vi.fn(() => ({
                    export: vi.fn().mockResolvedValue({
                        success: true,
                        data: new Uint8Array([1, 2, 3]),
                        filename: 'export.zip',
                    }),
                })),
                quickExport: vi.fn().mockResolvedValue({
                    success: true,
                    data: new Uint8Array([1, 2, 3]),
                    filename: 'export.zip',
                }),
            };
            global.URL.createObjectURL = vi.fn(() => 'blob:test');
            global.URL.revokeObjectURL = vi.fn();
        });

        it('should return false when Yjs is disabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            const result = await navbarFile.exportViaYjs('HTML5', 'html5');
            expect(result).toBe(false);
        });

        it('should return false when document manager is missing', async () => {
            eXeLearning.app.project._yjsBridge = null;
            const result = await navbarFile.exportViaYjs('HTML5', 'html5');
            expect(result).toBe(false);
        });

        it('should return false when SharedExporters is missing', async () => {
            delete window.SharedExporters;
            const result = await navbarFile.exportViaYjs('HTML5', 'html5');
            expect(result).toBe(false);
        });

        it('should return false for unsupported format', async () => {
            const result = await navbarFile.exportViaYjs('FOO', 'foo');
            expect(result).toBe(false);
        });

        it('should export and trigger download on success', async () => {
            const appendSpy = vi.spyOn(document.body, 'appendChild');
            const removeSpy = vi.spyOn(document.body, 'removeChild');

            const result = await navbarFile.exportViaYjs('HTML5', 'html5');

            expect(result).toBe(true);
            expect(window.SharedExporters.quickExport).toHaveBeenCalled();
            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(appendSpy).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalled();
        });

        it('should show alert on export error', async () => {
            window.SharedExporters.quickExport.mockResolvedValue({
                success: false,
                error: 'bad',
            });

            const result = await navbarFile.exportViaYjs('HTML5', 'html5');

            expect(result).toBe(true);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });

        it('should use electronAPI.saveBuffer in Electron mode', async () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = { saveBuffer: vi.fn().mockResolvedValue(true) };
            window.__currentProjectId = 'proj-1';

            const result = await navbarFile.exportViaYjs('HTML5', 'html5');

            expect(result).toBe(true);
            expect(window.electronAPI.saveBuffer).toHaveBeenCalledWith(
                expect.any(String),
                'proj-1:html5',
                'export.zip'
            );
        });

        it('should return true without success toast when Electron save is cancelled', async () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = { saveBuffer: vi.fn().mockResolvedValue(false) };
            window.__currentProjectId = 'proj-1';

            const result = await navbarFile.exportViaYjs('HTML5', 'html5');

            expect(result).toBe(true);
            expect(window.electronAPI.saveBuffer).toHaveBeenCalled();
        });
    });

    describe('export As flows', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            window.electronAPI = { saveAs: vi.fn() };
        });

        it('exportHTML5AsEvent should use electron save as', async () => {
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportHTML5AsEvent();

            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });

        it('exportHTML5SPAsEvent should fall back to server export', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportHTML5SPAsEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'html5-sp'
            );
            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });

        it('exportSCORM2004AsEvent should fall back to server export', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportSCORM2004AsEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'scorm2004'
            );
            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });

        it('exportIMSAsEvent should fall back to server export', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportIMSAsEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'ims'
            );
            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });

        it('exportEPUB3AsEvent should fall back to server export', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Book',
            });

            await navbarFile.exportEPUB3AsEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'epub3'
            );
            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });

        it('exportXmlPropertiesAsEvent should save xml properties', async () => {
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'props',
            });

            await navbarFile.exportXmlPropertiesAsEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'properties'
            );
            expect(window.electronAPI.saveAs).toHaveBeenCalled();
        });
    });

    describe('exportHTML5FolderAsEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should export to folder in offline mode', async () => {
            eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = {
                exportToFolder: vi.fn().mockResolvedValue({ ok: true }),
            };
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportHTML5FolderAsEvent();

            expect(window.electronAPI.exportToFolder).toHaveBeenCalled();
        });
    });

    describe('exportHTML5Event', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use Yjs export when available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(true);

            await navbarFile.exportHTML5Event();

            expect(navbarFile.exportViaYjs).toHaveBeenCalledWith('HTML5', 'html5');
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                path: '/exports/project.zip',
            });

            await navbarFile.exportHTML5Event();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalled();
            expect(eXeLearning.app.toasts.createToast).toHaveBeenCalled();
        });
    });

    describe('exportHTML5SPEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportHTML5SPEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'html5-sp'
            );
        });
    });

    describe('exportSCORM12Event', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use Yjs export when available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(true);

            await navbarFile.exportSCORM12Event();

            expect(navbarFile.exportViaYjs).toHaveBeenCalledWith('SCORM12', 'scorm12');
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                path: '/exports/scorm.zip',
            });

            await navbarFile.exportSCORM12Event();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalled();
        });
    });

    describe('exportSCORM2004Event', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportSCORM2004Event();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'scorm2004'
            );
        });
    });

    describe('exportIMSEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'Project',
            });

            await navbarFile.exportIMSEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'ims'
            );
        });
    });

    describe('exportXmlPropertiesEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should export properties via server download', async () => {
            const downloadSpy = vi.spyOn(navbarFile, 'downloadLink').mockImplementation(() => {});
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                urlZipFile: 'http://file',
                exportProjectName: 'props.xml',
            });

            await navbarFile.exportXmlPropertiesEvent();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalledWith(
                'test-session-123',
                'properties'
            );
            expect(downloadSpy).toHaveBeenCalled();
        });
    });

    describe('exportEPUB3Event', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use Yjs export when available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(true);

            await navbarFile.exportEPUB3Event();

            expect(navbarFile.exportViaYjs).toHaveBeenCalledWith('EPUB3', 'epub3');
        });

        it('should fall back to server export when Yjs not available', async () => {
            vi.spyOn(navbarFile, 'exportViaYjs').mockResolvedValue(false);
            eXeLearning.app.api.getOdeExportDownload.mockResolvedValue({
                responseMessage: 'OK',
                path: '/exports/book.epub',
            });

            await navbarFile.exportEPUB3Event();

            expect(eXeLearning.app.api.getOdeExportDownload).toHaveBeenCalled();
        });
    });

    describe('cloud upload helpers', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('getFoldersGoogleDrive should return files when available', async () => {
            eXeLearning.app.api.getFoldersGoogleDrive.mockResolvedValue({
                folders: { files: [] },
            });

            const result = await navbarFile.getFoldersGoogleDrive();

            expect(result).toEqual({ error: false, files: { files: [] } });
        });

        it('getFoldersGoogleDrive should return unknown when missing data', async () => {
            eXeLearning.app.api.getFoldersGoogleDrive.mockResolvedValue(null);

            const result = await navbarFile.getFoldersGoogleDrive();

            expect(result).toEqual({ error: 'Unknown', files: [] });
        });

        it('uploadToGoogleDriveEvent should open Google Drive modal', async () => {
            vi.spyOn(navbarFile, 'getFoldersGoogleDrive').mockResolvedValue({
                error: false,
                files: { files: [] },
            });

            navbarFile.uploadToGoogleDriveEvent();
            await Promise.resolve();

            expect(eXeLearning.app.modals.uploadtodrive.show).toHaveBeenCalledWith({ files: [] });
        });

        it('uploadToGoogleDriveEvent should show alert when error and no auth', async () => {
            eXeLearning.app.actions.authorizeAddActions = false;
            vi.spyOn(navbarFile, 'getFoldersGoogleDrive').mockResolvedValue({
                error: 'bad',
                files: [],
            });

            navbarFile.uploadToGoogleDriveEvent();
            await Promise.resolve();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Google Drive error',
                body: 'bad',
                contentId: 'error',
            });
        });

        it('uploadToGoogleDriveEvent should open login when auth is enabled', async () => {
            eXeLearning.app.actions.authorizeAddActions = true;
            vi.spyOn(navbarFile, 'getFoldersGoogleDrive').mockResolvedValue({
                error: 'bad',
                files: [],
            });
            const loginSpy = vi.spyOn(navbarFile, 'openWindowLoginGoogleDrive').mockResolvedValue();

            navbarFile.uploadToGoogleDriveEvent();
            await Promise.resolve();

            expect(loginSpy).toHaveBeenCalled();
        });

        it('openWindowLoginGoogleDrive should open login popup', async () => {
            eXeLearning.app.api.getUrlLoginGoogleDrive.mockResolvedValue({
                url: 'http://drive-login',
            });

            await navbarFile.openWindowLoginGoogleDrive();

            expect(window.open).toHaveBeenCalledWith(
                'http://drive-login',
                'drive',
                expect.any(String)
            );
        });

        it('getFoldersDropbox should return files when available', async () => {
            eXeLearning.app.api.getFoldersDropbox.mockResolvedValue({
                folders: { files: [] },
            });

            const result = await navbarFile.getFoldersDropbox();

            expect(result).toEqual({ error: false, files: { files: [] } });
        });

        it('uploadToDropboxEvent should show alert when error and no auth', async () => {
            eXeLearning.app.actions.authorizeAddActions = false;
            vi.spyOn(navbarFile, 'getFoldersDropbox').mockResolvedValue({
                error: 'bad',
                files: [],
            });

            navbarFile.uploadToDropboxEvent();
            await Promise.resolve();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Dropbox error',
                body: 'bad',
                contentId: 'error',
            });
        });

        it('uploadToDropboxEvent should open Dropbox modal', async () => {
            vi.spyOn(navbarFile, 'getFoldersDropbox').mockResolvedValue({
                error: false,
                files: { files: [] },
            });

            navbarFile.uploadToDropboxEvent();
            await Promise.resolve();

            expect(eXeLearning.app.modals.uploadtodropbox.show).toHaveBeenCalledWith({ files: [] });
        });

        it('openWindowLoginDropbox should open login popup', async () => {
            eXeLearning.app.api.getUrlLoginDropbox.mockResolvedValue({
                url: 'http://dropbox-login',
            });

            await navbarFile.openWindowLoginDropbox();

            expect(window.open).toHaveBeenCalledWith(
                'http://dropbox-login',
                'dropbox',
                expect.any(String)
            );
        });
    });

    describe('platform upload', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('uploadPlatformEvent should redirect on success', async () => {
            window.location.search = '?jwt_token=abc';
            eXeLearning.app.api.postFirstTypePlatformIntegrationElpUpload.mockResolvedValue({
                responseMessage: 'OK',
                returnUrl: 'http://return',
            });

            await navbarFile.uploadPlatformEvent();

            expect(window.location.replace).toHaveBeenCalledWith('http://return');
        });

        it('uploadPlatformEvent should alert on error', async () => {
            window.location.search = '?jwt_token=abc';
            eXeLearning.app.api.postFirstTypePlatformIntegrationElpUpload.mockResolvedValue({
                responseMessage: 'ERR',
            });

            await navbarFile.uploadPlatformEvent();

            expect(global.eXe.app.alert).toHaveBeenCalled();
        });
    });

    describe('importXmlPropertiesEvent', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should click the properties upload input', () => {
            const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

            navbarFile.importXmlPropertiesEvent();

            expect(clickSpy).toHaveBeenCalled();
            clickSpy.mockRestore();
        });
    });

    describe('integration', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should setup all event listeners on setEvents call', () => {
            navbarFile.setEvents();

            expect(mockButtons.newButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.newFromTemplateButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.saveButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.downloadProjectButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.exportHTML5Button.addEventListener).toHaveBeenCalled();
            expect(mockButtons.exportSCORM12Button.addEventListener).toHaveBeenCalled();
            expect(mockButtons.exportEPUB3Button.addEventListener).toHaveBeenCalled();
        });

        it('should call correct action methods when buttons clicked', () => {
            navbarFile.setEvents();

            vi.spyOn(navbarFile, 'newProjectEvent');
            vi.spyOn(navbarFile, 'newFromTemplateEvent');
            vi.spyOn(navbarFile, 'saveOdeEvent');

            // Click new button
            const newCall = mockButtons.newButton.addEventListener.mock.calls.find(
                ([eventName]) => eventName === 'click'
            );
            const newHandler = newCall?.[1];
            newHandler({ preventDefault: vi.fn() });
            expect(navbarFile.newProjectEvent).toHaveBeenCalled();

            // Click new from template button
            const templateHandler = mockButtons.newFromTemplateButton.addEventListener.mock.calls[0][1];
            templateHandler();
            expect(navbarFile.newFromTemplateEvent).toHaveBeenCalled();

            // Click save button (online mode)
            eXeLearning.config.isOfflineInstallation = false;
            const saveHandler = mockButtons.saveButton.addEventListener.mock.calls[0][1];
            saveHandler();
            expect(navbarFile.saveOdeEvent).toHaveBeenCalled();
        });
    });

    describe('mobile layout helpers', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            document.body.classList.remove('left-column-hidden');
        });

        it('initMobileLayout should collapse on small screens', () => {
            window.innerWidth = 500;
            navbarFile.initMobileLayout();
            expect(document.body.classList.contains('left-column-hidden')).toBe(true);
        });

        it('handleResponsiveLayout should toggle state on resize', () => {
            window.innerWidth = 500;
            navbarFile.handleResponsiveLayout();
            expect(navbarFile._wasResizedToMobile).toBe(true);
            expect(document.body.classList.contains('left-column-hidden')).toBe(true);

            window.innerWidth = 900;
            navbarFile.handleResponsiveLayout();
            expect(navbarFile._wasResizedToMobile).toBe(false);
        });

        it('initMobileBackdropClose should hide sidebar on outside click', () => {
            window.innerWidth = 500;
            const sidebar = document.createElement('div');
            sidebar.classList.add('asideleft');
            sidebar.getBoundingClientRect = () => ({
                left: 0,
                right: 100,
                top: 0,
                bottom: 100,
            });
            document.body.appendChild(sidebar);

            const toggler = document.createElement('button');
            toggler.id = 'exe-panels-toggler';
            document.body.appendChild(toggler);

            navbarFile.initMobileBackdropClose();
            document.dispatchEvent(
                new MouseEvent('click', { clientX: 200, clientY: 200 })
            );

            expect(document.body.classList.contains('left-column-hidden')).toBe(true);
        });
    });

    describe('helper methods', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            document.body.innerHTML = '';
        });

        it('should warn when share modal is missing', () => {
            eXeLearning.app.modals.share = null;
            expect(() => navbarFile.openShareModalEvent()).not.toThrow();
        });

        it('should normalize suggested names using project title and suffix', () => {
            eXeLearning.app.project.properties = {
                properties: {
                    pp_title: { value: 'My Project' },
                },
            };

            const result = navbarFile.normalizeSuggestedName('document', 'export-html5');

            expect(result).toBe('My Project_web.zip');
        });

        it('should replace mismatched extensions during normalization', () => {
            const result = navbarFile.normalizeSuggestedName('project.xml', 'export-html5');
            expect(result).toBe('project.zip');
        });

        it('should keep epub extension for epub3', () => {
            const result = navbarFile.normalizeSuggestedName('book.epub', 'export-epub3');
            expect(result).toBe('book.epub');
        });

        it('should apply suffixes based on export type', () => {
            expect(navbarFile.appendSuffixForType('base', 'html5')).toBe('base_web');
            expect(navbarFile.appendSuffixForType('base', 'html5-sp')).toBe('base_page');
            expect(navbarFile.appendSuffixForType('base', 'scorm12')).toBe('base_scorm');
            expect(navbarFile.appendSuffixForType('base', 'scorm2004')).toBe('base_scorm2004');
            expect(navbarFile.appendSuffixForType('base', 'ims')).toBe('base_ims');
        });

        it('should use electron save with normalized name', () => {
            window.__currentProjectId = 'proj-1';
            window.electronAPI = { save: vi.fn() };

            navbarFile.electronSave('http://file', 'elpx', 'Doc');

            expect(window.electronAPI.save).toHaveBeenCalledWith(
                'http://file',
                'proj-1',
                'Doc.elpx'
            );
        });

        it('should fall back to downloadLink when electron save is missing', () => {
            window.electronAPI = null;
            const downloadSpy = vi.spyOn(navbarFile, 'downloadLink').mockImplementation(() => {});

            navbarFile.electronSave('http://file', 'export-html5', 'export-html5.zip');

            expect(downloadSpy).toHaveBeenCalledWith('http://file', 'export-html5.zip_web.zip');
        });

        it('should use electron save in offline downloadLink', async () => {
            window.__currentProjectId = 'proj-2';
            window.electronAPI = { save: vi.fn() };
            eXeLearning.config.isOfflineInstallation = true;
            eXeLearning.app.api.getFileResourcesForceDownload.mockResolvedValue({
                url: 'http://final',
            });

            await navbarFile.downloadLink('http://file', 'export-html5-sp.zip');

            expect(window.electronAPI.save).toHaveBeenCalledWith(
                'http://final',
                'proj-2',
                expect.stringContaining('.zip')
            );
        });

        it('should infer export types when downloading offline', async () => {
            window.__currentProjectId = 'proj-3';
            window.electronAPI = { save: vi.fn() };
            eXeLearning.config.isOfflineInstallation = true;
            eXeLearning.app.api.getFileResourcesForceDownload.mockResolvedValue({
                url: 'http://final',
            });

            const names = [
                'export-html5.zip',
                'export-scorm2004.zip',
                'export-scorm12.zip',
                'export-ims.zip',
                'export-epub3.zip',
                'export-xml-properties.xml',
                'bundle.zip',
            ];

            for (const name of names) {
                await navbarFile.downloadLink('http://file', name);
            }

            expect(window.electronAPI.save).toHaveBeenCalled();
        });

        it('should create a browser download link when not offline', async () => {
            window.electronAPI = null;
            eXeLearning.config.isOfflineInstallation = false;
            eXeLearning.app.api.getFileResourcesForceDownload.mockResolvedValue({
                url: 'http://final',
            });
            const appendSpy = vi.spyOn(document.body, 'appendChild');
            const removeSpy = vi.spyOn(document.body, 'removeChild');
            const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

            await navbarFile.downloadLink('http://file', 'export.zip');

            expect(appendSpy).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
            clickSpy.mockRestore();
        });

        it('should detect legacy elp format with contentv3.xml', async () => {
            const xml = '<instance></instance>';
            window.fflate = {
                unzipSync: vi.fn(() => ({
                    'contentv3.xml': new TextEncoder().encode(xml),
                })),
            };
            const file = new File([new Uint8Array([1, 2, 3])], 'test.elp');

            const result = await navbarFile.checkIfLegacyElpFormat(file);

            expect(result).toBe(true);
        });

        it('should return false when fflate is unavailable', async () => {
            window.fflate = undefined;
            const file = new File([new Uint8Array([1, 2, 3])], 'test.elp');

            const result = await navbarFile.checkIfLegacyElpFormat(file);

            expect(result).toBe(false);
        });

        it('should return false when contentv3.xml is non-legacy', async () => {
            const xml = '<root></root>';
            window.fflate = {
                unzipSync: vi.fn(() => ({
                    'contentv3.xml': new TextEncoder().encode(xml),
                })),
            };
            const file = new File([new Uint8Array([1, 2, 3])], 'test.elp');

            const result = await navbarFile.checkIfLegacyElpFormat(file);

            expect(result).toBe(false);
        });
    });

    describe('convertLegacyElpViaBackend', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should return converted structure on success', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    structure: { id: 'root' },
                    assets: ['asset-1'],
                }),
            });

            const result = await navbarFile.convertLegacyElpViaBackend(
                new File([new Uint8Array([1])], 'legacy.elp'),
                {}
            );

            expect(result).toEqual({
                success: true,
                structure: { id: 'root' },
                assets: ['asset-1'],
            });
        });

        it('should return error details on failure', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ message: 'bad' }),
            });

            const result = await navbarFile.convertLegacyElpViaBackend(
                new File([new Uint8Array([1])], 'legacy.elp'),
                {}
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('bad');
        });
    });

    describe('checkAndShowNewFromTemplateButton static mode', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should skip fetch when capabilities.storage.remote is false', async () => {
            // Set up static mode (no remote storage)
            eXeLearning.app.capabilities = { storage: { remote: false } };
            global.fetch = vi.fn();

            await navbarFile.checkAndShowNewFromTemplateButton();

            // Should NOT call fetch when in static mode
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should proceed to fetch when capabilities is undefined', async () => {
            // No capabilities defined (legacy mode)
            delete eXeLearning.app.capabilities;
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ templates: [] }),
            });

            await navbarFile.checkAndShowNewFromTemplateButton();

            // Should call fetch when capabilities is not defined
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should proceed to fetch when storage.remote is true', async () => {
            eXeLearning.app.capabilities = { storage: { remote: true } };
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ templates: [] }),
            });

            await navbarFile.checkAndShowNewFromTemplateButton();

            expect(global.fetch).toHaveBeenCalled();
        });

        it('should handle non-ok API response', async () => {
            delete eXeLearning.app.capabilities;
            global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
            const li = document.createElement('li');
            li.classList.add('d-none');
            li.appendChild(mockButtons.newFromTemplateButton);
            navbarElement.appendChild(li);

            await navbarFile.checkAndShowNewFromTemplateButton();

            // Button should stay hidden on 404
            expect(li.classList.contains('d-none')).toBe(true);
        });
    });

    describe('null button safety in set*Event methods', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        // Tests for methods that have explicit null checks in the source code
        it('setSettingsEvent should return early when button is null', () => {
            navbarFile.settingsButton = null;
            expect(() => navbarFile.setSettingsEvent()).not.toThrow();
        });

        it('setShareEvent should return early when button is null', () => {
            navbarFile.shareButton = null;
            expect(() => navbarFile.setShareEvent()).not.toThrow();
        });

        it('setOpenOfflineEvent should return early when button is null', () => {
            navbarFile.openOfflineButton = null;
            expect(() => navbarFile.setOpenOfflineEvent()).not.toThrow();
        });

        it('setUploadPlatformEvent should not throw when both buttons are null', () => {
            navbarFile.uploadPlatformButton = null;
            navbarFile.finishButton = null;
            expect(() => navbarFile.setUploadPlatformEvent()).not.toThrow();
        });

        it('setDownloadProjectAsEvent should return early when button is null', () => {
            navbarFile.downloadProjectAsButton = null;
            expect(() => navbarFile.setDownloadProjectAsEvent()).not.toThrow();
        });

        it('setSaveProjectOfflineEvent should return early when button is null', () => {
            navbarFile.saveOfflineButton = null;
            expect(() => navbarFile.setSaveProjectOfflineEvent()).not.toThrow();
        });

        it('setExportHTML5AsEvent should return early when button is null', () => {
            navbarFile.exportHTML5AsButton = null;
            expect(() => navbarFile.setExportHTML5AsEvent()).not.toThrow();
        });

        it('setExportHTML5FolderAsEvent should return early when button is null', () => {
            navbarFile.exportHTML5FolderAsButton = null;
            expect(() => navbarFile.setExportHTML5FolderAsEvent()).not.toThrow();
        });

        it('setExportHTML5SPAsEvent should return early when button is null', () => {
            navbarFile.exportHTML5SPAsButton = null;
            expect(() => navbarFile.setExportHTML5SPAsEvent()).not.toThrow();
        });

        it('setExportPrintEvent should return early when button is null', () => {
            navbarFile.exportPrintButton = null;
            expect(() => navbarFile.setExportPrintEvent()).not.toThrow();
        });

        it('setExportSCORM12AsEvent should return early when button is null', () => {
            navbarFile.exportSCORM12AsButton = null;
            expect(() => navbarFile.setExportSCORM12AsEvent()).not.toThrow();
        });

        it('setExportSCORM2004AsEvent should return early when button is null', () => {
            navbarFile.exportSCORM2004AsButton = null;
            expect(() => navbarFile.setExportSCORM2004AsEvent()).not.toThrow();
        });

        it('setExportIMSAsEvent should return early when button is null', () => {
            navbarFile.exportIMSAsButton = null;
            expect(() => navbarFile.setExportIMSAsEvent()).not.toThrow();
        });

        it('setExportEPUB3AsEvent should return early when button is null', () => {
            navbarFile.exportEPUB3AsButton = null;
            expect(() => navbarFile.setExportEPUB3AsEvent()).not.toThrow();
        });

        it('setExportXmlPropertiesAsEvent should return early when button is null', () => {
            navbarFile.exportXmlPropertiesAsButton = null;
            expect(() => navbarFile.setExportXmlPropertiesAsEvent()).not.toThrow();
        });

        it('setImportElpEvent should return early when button is null', () => {
            navbarFile.importElpButton = null;
            expect(() => navbarFile.setImportElpEvent()).not.toThrow();
        });
    });

    describe('openClientPreview additional edge cases', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should return false when yjsBridge is null', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = null;

            const result = await navbarFile.openClientPreview();

            expect(result).toBe(false);
        });

        it('should return false when documentManager is null', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = { documentManager: null };

            const result = await navbarFile.openClientPreview();

            expect(result).toBe(false);
        });

        it('should work without toast when toasts.createToast is unavailable', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                documentManager: {},
                assetCache: new Map(),
            };
            eXeLearning.app.toasts.createToast = null;

            // Mock PreviewExporter with preview method that returns success
            window.PreviewExporter = vi.fn().mockImplementation(() => ({
                preview: vi.fn().mockResolvedValue({
                    success: true,
                }),
            }));

            // This should not throw even though createToast is null
            const result = await navbarFile.openClientPreview();

            // Function returns true after successful preview
            expect(result).toBe(true);

            delete window.PreviewExporter;
        });
    });

    describe('openFileInputStatic', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should create file input element if not exists', () => {
            navbarFile.openFileInputStatic();

            const input = document.getElementById('static-open-file-input');
            expect(input).toBeDefined();
            expect(input.type).toBe('file');
            expect(input.accept).toBe('.elpx,.elp,.zip');
        });

        it('should reuse existing file input element', () => {
            // Call twice
            navbarFile.openFileInputStatic();
            navbarFile.openFileInputStatic();

            const inputs = document.querySelectorAll('#static-open-file-input');
            expect(inputs.length).toBe(1);
        });

        it('should trigger click on file input', () => {
            const clickSpy = vi.fn();
            const mockInput = document.createElement('input');
            mockInput.id = 'static-open-file-input';
            mockInput.click = clickSpy;
            document.body.appendChild(mockInput);

            navbarFile.openFileInputStatic();

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should handle file selection via unified open flow', async () => {
            const largeFilesUploadSpy = vi.fn();
            eXeLearning.app.modals.openuserodefiles = {
                largeFilesUpload: largeFilesUploadSpy,
            };

            navbarFile.openFileInputStatic();

            const input = document.getElementById('static-open-file-input');
            const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

            // Simulate file selection
            Object.defineProperty(input, 'files', { value: [mockFile] });
            await input.dispatchEvent(new Event('change'));

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(largeFilesUploadSpy).toHaveBeenCalledWith(mockFile);
        });

        it('should not process when no file selected', async () => {
            const largeFilesUploadSpy = vi.fn();
            eXeLearning.app.modals.openuserodefiles = {
                largeFilesUpload: largeFilesUploadSpy,
            };

            navbarFile.openFileInputStatic();

            const input = document.getElementById('static-open-file-input');

            // Simulate empty file selection
            Object.defineProperty(input, 'files', { value: [] });
            await input.dispatchEvent(new Event('change'));

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(largeFilesUploadSpy).not.toHaveBeenCalled();
        });

        it('should reset input value after file selection', async () => {
            const largeFilesUploadSpy = vi.fn();
            eXeLearning.app.modals.openuserodefiles = {
                largeFilesUpload: largeFilesUploadSpy,
            };

            navbarFile.openFileInputStatic();

            const input = document.getElementById('static-open-file-input');
            const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

            Object.defineProperty(input, 'files', { value: [mockFile] });
            // Note: Can't set input.value for file inputs (browser security)
            // The handler resets e.target.value = '' after processing
            await input.dispatchEvent(new Event('change'));

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify the input value is empty (reset by the handler)
            expect(input.value).toBe('');
        });
    });

    describe('openUserOdeFilesEvent static mode', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should call openFileInputStatic in static mode', () => {
            eXeLearning.app.capabilities = { storage: { remote: false } };
            const staticSpy = vi.spyOn(navbarFile, 'openFileInputStatic').mockImplementation(() => {});

            navbarFile.openUserOdeFilesEvent();

            expect(staticSpy).toHaveBeenCalled();
        });

        it('should not call openFileInputStatic when storage.remote is true', () => {
            eXeLearning.app.capabilities = { storage: { remote: true } };
            const staticSpy = vi.spyOn(navbarFile, 'openFileInputStatic').mockImplementation(() => {});
            eXeLearning.app.modals.openUserOdeFiles = { show: vi.fn() };

            navbarFile.openUserOdeFilesEvent();

            expect(staticSpy).not.toHaveBeenCalled();
        });

        it('should not call openFileInputStatic when capabilities is undefined', () => {
            delete eXeLearning.app.capabilities;
            const staticSpy = vi.spyOn(navbarFile, 'openFileInputStatic').mockImplementation(() => {});
            eXeLearning.app.modals.openUserOdeFiles = { show: vi.fn() };

            navbarFile.openUserOdeFilesEvent();

            expect(staticSpy).not.toHaveBeenCalled();
        });
    });
});
