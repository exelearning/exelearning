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
            saveButtonAs: createButton('navbar-button-save-as'),
            saveButtonAsOffline: createButton('navbar-button-save-as-offline'),
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
                href: ''
            },
            onbeforeunload: null,
            electronAPI: null,
            fetch: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            innerWidth: 1024,
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
                    reinitializeWithProject: null,
                    exportToElpxViaYjs: null,
                    importFromElpxViaYjs: null,
                },
                modals: {
                    templateselection: { show: vi.fn() },
                    sessionlogout: { show: vi.fn() },
                    confirm: { show: vi.fn() },
                    alert: { show: vi.fn() },
                    uploadprogress: {
                        show: vi.fn(),
                        setProcessingPhase: vi.fn(),
                        setComplete: vi.fn(),
                        hide: vi.fn(),
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
                    getOdeExportDownload: vi.fn().mockResolvedValue({ url: 'http://test.com/file.zip' }),
                    getOdePreviewUrl: vi.fn(),
                    getFileResourcesForceDownload: vi.fn().mockResolvedValue({ url: 'http://test.com/file.zip' }),
                },
                interface: {
                    connectionTime: {
                        loadLasUpdatedInInterface: vi.fn(),
                    },
                },
            },
            config: {
                isOfflineInstallation: false,
            },
            symfony: {
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
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-save-as');
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-save-as-offline');
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
            expect(navbarFile.saveButtonAs).toBe(mockButtons.saveButtonAs);
            expect(navbarFile.saveButtonAsOffline).toBe(mockButtons.saveButtonAsOffline);
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
                setSaveAsProjectEvent: vi.spyOn(navbarFile, 'setSaveAsProjectEvent'),
                setSaveAsProjectOfflineEvent: vi.spyOn(navbarFile, 'setSaveAsProjectOfflineEvent'),
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
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('setNewProjectEvent should add click listener', () => {
            navbarFile.setNewProjectEvent();
            expect(mockButtons.newButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setNewFromTemplateEvent should add click listener', () => {
            navbarFile.setNewFromTemplateEvent();
            expect(mockButtons.newFromTemplateButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setSaveProjectEvent should add click listener', () => {
            navbarFile.setSaveProjectEvent();
            expect(mockButtons.saveButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setSaveAsProjectEvent should add click listener', () => {
            navbarFile.setSaveAsProjectEvent();
            expect(mockButtons.saveButtonAs.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setSaveAsProjectOfflineEvent should add click listener when button exists', () => {
            navbarFile.setSaveAsProjectOfflineEvent();
            expect(mockButtons.saveButtonAsOffline.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('setSaveAsProjectOfflineEvent should not add listener when button is null', () => {
            navbarFile.saveButtonAsOffline = null;
            navbarFile.setSaveAsProjectOfflineEvent();
            expect(mockButtons.saveButtonAsOffline.addEventListener).not.toHaveBeenCalled();
        });

        it('setUploadPlatformEvent should add click listener when button exists', () => {
            navbarFile.setUploadPlatformEvent();
            expect(mockButtons.uploadPlatformButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
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

        it('setSaveAsProjectEvent should return early if idevice is open', () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            vi.spyOn(navbarFile, 'saveAsOdeEvent');
            navbarFile.setSaveAsProjectEvent();

            const clickHandler = mockButtons.saveButtonAs.addEventListener.mock.calls[0][1];
            clickHandler();

            expect(eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
            expect(navbarFile.saveAsOdeEvent).not.toHaveBeenCalled();
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

        describe('saveOdeEvent', () => {
            it('should call project save method', () => {
                navbarFile.saveOdeEvent();

                expect(eXeLearning.app.project.save).toHaveBeenCalled();
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
    });

    describe('newSession', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should check current ODE users', async () => {
            eXeLearning.app.api.postCheckCurrentOdeUsers.mockResolvedValue({
                leaveEmptySession: true,
            });
            vi.spyOn(navbarFile, 'createSession');

            await navbarFile.newSession('session-123');

            expect(eXeLearning.app.api.postCheckCurrentOdeUsers).toHaveBeenCalledWith({
                odeSessionId: 'session-123',
            });
        });

        it('should create session if allowed', async () => {
            eXeLearning.app.api.postCheckCurrentOdeUsers.mockResolvedValue({
                leaveEmptySession: true,
            });
            vi.spyOn(navbarFile, 'createSession');

            await navbarFile.newSession('session-123');

            expect(navbarFile.createSession).toHaveBeenCalledWith({
                odeSessionId: 'session-123',
            });
        });

        it('should show session logout modal if not allowed', async () => {
            eXeLearning.app.api.postCheckCurrentOdeUsers.mockResolvedValue({
                leaveEmptySession: false,
            });

            await navbarFile.newSession('session-123');

            expect(eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalledWith({
                title: 'New file',
                forceOpen: 'Create new file without saving',
                newFile: true,
            });
        });
    });

    describe('createSession', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should use legacy mode when Yjs is not enabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.api.postCloseSession.mockResolvedValue({
                responseMessage: 'OK',
            });

            await navbarFile.createSession({ odeSessionId: 'session-123' });

            expect(eXeLearning.app.api.postCloseSession).toHaveBeenCalledWith({
                odeSessionId: 'session-123',
            });
            expect(window.onbeforeunload).toBeNull();
            expect(window.location.href).toBe('/workarea');
        });

        it('should use Yjs mode when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.reinitializeWithProject = vi.fn();

            // Use global.fetch since the source code uses the global fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ uuid: 'new-project-uuid' }),
            });

            await navbarFile.createSession({ odeSessionId: 'session-123' });

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/project/create-quick',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                })
            );
        });

        it('should fall back to legacy mode on Yjs error', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.reinitializeWithProject = vi.fn();

            // Use global.fetch to simulate network error
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            eXeLearning.app.api.postCloseSession.mockResolvedValue({
                responseMessage: 'OK',
            });

            await navbarFile.createSession({ odeSessionId: 'session-123' });

            expect(eXeLearning.app.api.postCloseSession).toHaveBeenCalled();
        });
    });

    describe('openPrintPreview', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should use client preview when available', async () => {
            vi.spyOn(navbarFile, 'openClientPreview').mockResolvedValue(true);

            await navbarFile.openPrintPreview();

            expect(navbarFile.openClientPreview).toHaveBeenCalled();
        });

        it('should fall back to server preview when client preview not available', async () => {
            vi.spyOn(navbarFile, 'openClientPreview').mockResolvedValue(false);

            // Mock global fetch (not window.fetch) as the source uses the global
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ url: 'http://localhost/preview' }),
            });

            await navbarFile.openPrintPreview();

            expect(global.fetch).toHaveBeenCalled();

            await vi.runAllTimersAsync();
        });

        it('should show error when preview fails', async () => {
            vi.spyOn(navbarFile, 'openClientPreview').mockResolvedValue(false);

            // Mock global fetch with a failed response
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            await navbarFile.openPrintPreview();

            // After fetch fails, the method handles the error internally
            expect(global.fetch).toHaveBeenCalled();

            await vi.runAllTimersAsync();
        });

        it('should show error when no session ID available', async () => {
            vi.spyOn(navbarFile, 'openClientPreview').mockResolvedValue(false);
            eXeLearning.app.project.odeSession = null;
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await navbarFile.openPrintPreview();

            expect(consoleWarnSpy).toHaveBeenCalledWith('Print preview requires an active session id.');
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
            expect(window.SharedExporters.createExporter).toHaveBeenCalled();
            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(appendSpy).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalled();
        });

        it('should show alert on export error', async () => {
            window.SharedExporters.createExporter.mockReturnValue({
                export: vi.fn().mockResolvedValue({
                    success: false,
                    error: 'bad',
                }),
            });

            const result = await navbarFile.exportViaYjs('HTML5', 'html5');

            expect(result).toBe(true);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
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

    describe('integration', () => {
        beforeEach(() => {
            navbarFile = new NavbarFile(mockMenu);
        });

        it('should setup all event listeners on setEvents call', () => {
            navbarFile.setEvents();

            expect(mockButtons.newButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.newFromTemplateButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.saveButton.addEventListener).toHaveBeenCalled();
            expect(mockButtons.saveButtonAs.addEventListener).toHaveBeenCalled();
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
            const newHandler = mockButtons.newButton.addEventListener.mock.calls[0][1];
            newHandler();
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
    });
});
