vi.mock('./properties/projectProperties.js', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {
                manager: this,
                properties: {
                    pp_lang: {
                        value: 'en',
                    },
                },
                load: vi.fn(),
                loadPropertiesFromYjs: vi.fn(),
            };
        }),
    };
});

vi.mock('./idevices/idevicesEngine.js', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {};
        }),
    };
});

vi.mock('./structure/structureEngine.js', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {};
        }),
    };
});

import ProjectManager from './projectManager.js';

describe('ProjectManager', () => {
    let projectManager;
    let mockApp;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="main">
                <div id="workarea">
                    <div id="node-content-container">
                        <div id="node-content" node-selected="test-page"></div>
                    </div>
                </div>
            </div>
            <div id="structure-menu-nav"></div>
            <div id="exe-content-area"></div>
            <div id="exe-idevice-panels"></div>
            <div id="idevices-bottom">
                <div class="idevice_item"></div>
                <div class="idevice_category"></div>
            </div>
            <div id="list_menu_idevices"></div>
            <button id="head-top-download-button">Download</button>
            <button id="head-top-save-button">Save</button>
        `;
        window._ = (value) => value;
        window.eXeLearning = {
            config: {
                isOfflineInstallation: false,
                clientIntervalUpdate: 5000,
            },
            projectId: 'test-project-123',
            app: {
                modals: {
                    alert: {
                        show: vi.fn(),
                    },
                },
            },
        };
        mockApp = {
            interface: {
                loadingScreen: {
                    hide: vi.fn(),
                },
                concurrentUsers: {
                    getConcurrentUsersElementsList: vi.fn(() => []),
                },
            },
            modals: {
                alert: {
                    show: vi.fn(),
                },
            },
            api: {
                parameters: {
                    autosaveOdeFilesFunction: true,
                    autosaveIntervalTime: 1,
                },
                postOdeAutosave: vi.fn(),
                renewSession: vi.fn(),
                getOdeConcurrentUsers: vi.fn().mockResolvedValue({ currentUsers: [] }),
            },
            menus: {
                menuStructure: {
                    menuStructureBehaviour: {
                        nodeSelected: null,
                    },
                    menuStructureCompose: {
                        structureEngine: {
                            resetDataAndStructureData: vi.fn(),
                            resetStructureData: vi.fn(),
                        },
                    },
                },
            },
        };
        projectManager = new ProjectManager(mockApp);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        delete window._;
        delete window.__currentProjectId;
        delete window.eXeLearning;
    });

    // ===========================================
    // Grupo 1: Constructor y Helpers Simples
    // ===========================================

    describe('constructor', () => {
        it('initializes with app reference', () => {
            expect(projectManager.app).toBe(mockApp);
        });

        it('initializes activeLocks as empty Map', () => {
            expect(projectManager.activeLocks).toBeInstanceOf(Map);
            expect(projectManager.activeLocks.size).toBe(0);
        });

        it('initializes Yjs state as disabled', () => {
            expect(projectManager._yjsEnabled).toBe(false);
            expect(projectManager._yjsBridge).toBe(null);
            expect(projectManager._yjsBindings).toBeInstanceOf(Map);
        });

        it('creates properties, idevices and structure engines', () => {
            expect(projectManager.properties).toBeDefined();
            expect(projectManager.idevices).toBeDefined();
            expect(projectManager.structure).toBeDefined();
        });

        it('sets syncIntervalTime to 250', () => {
            expect(projectManager.syncIntervalTime).toBe(250);
        });
    });

    describe('generateProjectId', () => {
        it('generates valid UUID format', () => {
            const id = projectManager.generateProjectId();
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(id).toMatch(uuidRegex);
        });

        it('generates unique IDs on each call', () => {
            const id1 = projectManager.generateProjectId();
            const id2 = projectManager.generateProjectId();
            const id3 = projectManager.generateProjectId();
            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });
    });

    describe('updateUrlWithProjectId', () => {
        it('is a function that can be called', () => {
            // Note: Full URL manipulation testing is skipped due to happy-dom limitations
            // The method uses `new URL(window.location)` which requires a full browser environment
            expect(typeof projectManager.updateUrlWithProjectId).toBe('function');
        });
    });

    describe('getNumericProjectId', () => {
        it('returns null when odeSession is not set', () => {
            projectManager.odeSession = null;
            expect(projectManager.getNumericProjectId()).toBe(null);
        });

        it('returns consistent hash for same session string', () => {
            projectManager.odeSession = 'test-session-abc';
            const hash1 = projectManager.getNumericProjectId();
            const hash2 = projectManager.getNumericProjectId();
            expect(hash1).toBe(hash2);
        });

        it('returns different hash for different sessions', () => {
            projectManager.odeSession = 'session-a';
            const hash1 = projectManager.getNumericProjectId();
            projectManager.odeSession = 'session-b';
            const hash2 = projectManager.getNumericProjectId();
            expect(hash1).not.toBe(hash2);
        });

        it('returns a positive number', () => {
            projectManager.odeSession = 'any-session';
            const result = projectManager.getNumericProjectId();
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('cleanupCurrentIdeviceTimer', () => {
        it('calls idevices.cleanupCurrentIdeviceTimer if available', () => {
            projectManager.idevices.cleanupCurrentIdeviceTimer = vi.fn();
            projectManager.cleanupCurrentIdeviceTimer();
            expect(
                projectManager.idevices.cleanupCurrentIdeviceTimer,
            ).toHaveBeenCalled();
        });

        it('does nothing if method not available', () => {
            projectManager.idevices = {};
            expect(() => projectManager.cleanupCurrentIdeviceTimer()).not.toThrow();
        });
    });

    describe('getTimeIdeviceEditing', () => {
        it('calls idevices.getTimeIdeviceEditing if available', () => {
            const mockTime = 12345;
            projectManager.idevices.getTimeIdeviceEditing = vi
                .fn()
                .mockReturnValue(mockTime);
            const result = projectManager.getTimeIdeviceEditing();
            expect(result).toBe(mockTime);
        });

        it('returns undefined if method not available', () => {
            projectManager.idevices = {};
            const result = projectManager.getTimeIdeviceEditing();
            expect(result).toBeUndefined();
        });
    });

    describe('getEditUnlockDevice', () => {
        it('calls idevices.getEditUnlockDevice if available', () => {
            projectManager.idevices.getEditUnlockDevice = vi
                .fn()
                .mockReturnValue('EDIT');
            const result = projectManager.getEditUnlockDevice();
            expect(result).toBe('EDIT');
        });

        it('returns undefined if method not available', () => {
            projectManager.idevices = {};
            const result = projectManager.getEditUnlockDevice();
            expect(result).toBeUndefined();
        });
    });

    describe('saveMenuHeadButton', () => {
        it('disables the save button when true', async () => {
            await projectManager.saveMenuHeadButton(true);
            const button = document.querySelector('#head-top-save-button');
            expect(button.disabled).toBe(true);
        });

        it('enables the save button when false', async () => {
            const button = document.querySelector('#head-top-save-button');
            button.disabled = true;
            await projectManager.saveMenuHeadButton(false);
            expect(button.disabled).toBe(false);
        });

        it('does nothing if button not found', async () => {
            document.body.innerHTML = '';
            await expect(
                projectManager.saveMenuHeadButton(true),
            ).resolves.toBeUndefined();
        });
    });

    // ===========================================
    // Legacy helper methods tests
    // ===========================================

    describe('helper methods', () => {

    it('marks the installation as offline and exposes the project key', () => {
        projectManager.offlineInstallation = true;
        projectManager.odeId = 'custom-project';
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('offline');
        expect(button.innerHTML).toBe('save');
        expect(button.getAttribute('title')).toBe('Save');
        expect(window.__currentProjectId).toBe('custom-project');
    });

    it('marks the installation as online when the flag is false', () => {
        projectManager.offlineInstallation = false;
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('online');
        expect(button.innerHTML).toBe('Download');
    });

    it('shows the save confirmation modal', () => {
        projectManager.showModalSaveOk();

        expect(mockApp.modals.alert.show).toHaveBeenCalledWith({
            title: 'Saved',
            body: 'The project has been saved.',
        });
    });

    it('shows the save error modal with the response', () => {
        projectManager.showModalSaveError({ responseMessage: 'boom' });

        expect(mockApp.modals.alert.show).toHaveBeenCalledWith({
            title: 'Error',
            body: 'Error while saving: boom',
            contentId: 'error',
        });
    });

    it('hides the loading screen after a short delay', () => {
        vi.useFakeTimers();

        projectManager.showScreen();

        expect(mockApp.interface.loadingScreen.hide).not.toHaveBeenCalled();
        vi.advanceTimersByTime(250);
        expect(mockApp.interface.loadingScreen.hide).toHaveBeenCalled();
    });

    it('schedules an autosave interval and clears previous ones', () => {
        const setIntervalSpy = vi
            .spyOn(global, 'setInterval')
            .mockImplementation(() => 101);
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        projectManager.intervalSaveOde = 77;

        projectManager.generateIntervalAutosave(true);

        expect(clearIntervalSpy).toHaveBeenCalledWith(77);
        expect(setIntervalSpy).toHaveBeenCalledWith(
            expect.any(Function),
            1000,
        );
        const callback = setIntervalSpy.mock.calls[0][0];
        callback();

        expect(mockApp.api.postOdeAutosave).toHaveBeenCalled();
        expect(projectManager.intervalSaveOde).toBe(101);

        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    it('schedules session renewal intervals when autosave is configured', () => {
        const setIntervalSpy = vi
            .spyOn(global, 'setInterval')
            .mockImplementation(() => 88);
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        projectManager.intervalSaveOde = 42;

        projectManager.generateIntervalSessionExpiration(true);

        expect(clearIntervalSpy).toHaveBeenCalledWith(42);
        expect(setIntervalSpy).toHaveBeenCalledWith(
            expect.any(Function),
            10000,
        );
        const callback = setIntervalSpy.mock.calls[0][0];
        callback();

        expect(mockApp.api.renewSession).toHaveBeenCalled();
        expect(projectManager.intervalSaveOde).toBe(88);

        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });
    });

    // ===========================================
    // Grupo 2: Métodos de Validación
    // ===========================================

    describe('checkOpenIdevice', () => {
        it('returns false when no container exists', () => {
            document.body.innerHTML = '';
            expect(projectManager.checkOpenIdevice()).toBe(false);
        });

        it('returns false when no idevice in edition mode', () => {
            document.getElementById('node-content').innerHTML =
                '<div class="idevice_node" mode="view"></div>';
            expect(projectManager.checkOpenIdevice()).toBeFalsy();
        });

        it('returns true and shows alert when idevice in edition mode', () => {
            document.getElementById('node-content').innerHTML =
                '<div class="idevice_node" mode="edition"></div>';
            const result = projectManager.checkOpenIdevice();
            expect(result).toBe(true);
            // The code uses eXeLearning.app.modals.alert.show (global), not mockApp
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Info',
                body: 'You are editing an iDevice. Please close it before continuing',
            });
        });
    });

    describe('checkPageCollaborativeEditing', () => {
        it('returns false when page is not locked', () => {
            projectManager.activeLocks.set('test-page', false);
            const result = projectManager.checkPageCollaborativeEditing();
            expect(result).toBe(false);
        });

        it('shows alert when page is locked by another user', () => {
            projectManager.activeLocks.set('test-page', {
                user: 'other@test.com',
            });
            const result = projectManager.checkPageCollaborativeEditing();
            expect(result).toBe(true);
            // The code uses eXeLearning.app.modals.alert.show (global), not mockApp
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });
    });

    describe('checkModeEdition', () => {
        it('returns true when no elements in edition mode', async () => {
            const elements = document.querySelectorAll('.non-existent');
            const result = await projectManager.checkModeEdition(elements, true);
            expect(result).toBe(true);
        });

        it('returns false when element is in edition mode', async () => {
            document.body.innerHTML +=
                '<div class="test-element" mode="edition"></div>';
            const elements = document.querySelectorAll('.test-element');
            const result = await projectManager.checkModeEdition(elements, true);
            expect(result).toBe(false);
        });
    });

    describe('checkDraggingElement', () => {
        it('returns true when no elements dragging', async () => {
            const elements = [];
            const result = await projectManager.checkDraggingElement(
                elements,
                true,
            );
            expect(result).toBe(true);
        });

        it('returns false when elements are dragging', async () => {
            const elements = [{ id: 'dragging-element' }];
            const result = await projectManager.checkDraggingElement(
                elements,
                true,
            );
            expect(result).toBe(false);
        });
    });

    describe('checkUsersInSession', () => {
        it('returns input when no concurrent users', async () => {
            mockApp.api.getOdeConcurrentUsers.mockResolvedValue({
                currentUsers: [],
            });
            const result = await projectManager.checkUsersInSession(
                'ode1',
                'v1',
                'session1',
                true,
            );
            expect(result).toBe(true);
        });

        it('returns input when only one user', async () => {
            mockApp.api.getOdeConcurrentUsers.mockResolvedValue({
                currentUsers: ['user1'],
            });
            const result = await projectManager.checkUsersInSession(
                'ode1',
                'v1',
                'session1',
                true,
            );
            expect(result).toBe(true);
        });
    });

    // ===========================================
    // Grupo 3: Page Locking / Collaborative
    // ===========================================

    describe('lockIdevices', () => {
        it('adds disabled class to idevices menu', () => {
            projectManager.lockIdevices();
            const menu = document.querySelector('#idevices-bottom');
            expect(menu.classList.contains('disabled')).toBe(true);
        });

        it('sets tabindex -1 on idevice items', () => {
            projectManager.lockIdevices();
            const item = document.querySelector('.idevice_item');
            expect(item.getAttribute('tabindex')).toBe('-1');
        });

        it('adds disabled class to list menu', () => {
            projectManager.lockIdevices();
            const listMenu = document.querySelector('#list_menu_idevices');
            expect(listMenu.classList.contains('disabled')).toBe(true);
        });
    });

    describe('unlockIdevices', () => {
        it('removes disabled class from idevices menu', () => {
            const menu = document.querySelector('#idevices-bottom');
            menu.classList.add('disabled');
            projectManager.unlockIdevices();
            expect(menu.classList.contains('disabled')).toBe(false);
        });

        it('removes tabindex from idevice items', () => {
            const item = document.querySelector('.idevice_item');
            item.setAttribute('tabindex', '-1');
            projectManager.unlockIdevices();
            expect(item.hasAttribute('tabindex')).toBe(false);
        });

        it('removes disabled class from list menu', () => {
            const listMenu = document.querySelector('#list_menu_idevices');
            listMenu.classList.add('disabled');
            projectManager.unlockIdevices();
            expect(listMenu.classList.contains('disabled')).toBe(false);
        });
    });

    describe('clearPageLock', () => {
        it('does nothing when no lock exists', () => {
            expect(() => projectManager.clearPageLock('non-existent')).not.toThrow();
        });

        it('deletes lock from activeLocks', () => {
            const mockGravatar = document.createElement('div');
            projectManager.activeLocks.set('test-page-id', {
                user: 'test@test.com',
                gravatar: mockGravatar,
            });
            projectManager.clearPageLock('test-page-id');
            expect(projectManager.activeLocks.has('test-page-id')).toBe(false);
        });

        it('calls unlockIdevices', () => {
            const spy = vi.spyOn(projectManager, 'unlockIdevices');
            projectManager.clearPageLock('any-page');
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('clearUserLocks', () => {
        it('calls unlockIdevices', () => {
            const spy = vi.spyOn(projectManager, 'unlockIdevices');
            projectManager.clearUserLocks('user@test.com');
            expect(spy).toHaveBeenCalled();
        });

        it('clears all locks for a specific user', () => {
            projectManager.activeLocks.set('page1', {
                user: 'user@test.com',
                gravatar: null,
            });
            projectManager.activeLocks.set('page2', {
                user: 'other@test.com',
                gravatar: null,
            });
            const clearPageLockSpy = vi.spyOn(projectManager, 'clearPageLock');
            projectManager.clearUserLocks('user@test.com');
            expect(clearPageLockSpy).toHaveBeenCalledWith('page1');
            expect(clearPageLockSpy).not.toHaveBeenCalledWith('page2');
        });
    });

    describe('lockPageContent', () => {
        it('returns false when target block not found', () => {
            const result = projectManager.lockPageContent(
                'user@test.com',
                'non-existent',
                Date.now(),
            );
            expect(result).toBe(false);
        });

        it('creates overlay with user info when block exists', () => {
            document.body.innerHTML += `
                <div node-selected="page-123">
                    <div class="content"></div>
                </div>
            `;
            const result = projectManager.lockPageContent(
                'user@test.com',
                'page-123',
                Date.now(),
            );
            expect(result).toBe(true);
            const overlay = document.querySelector('.user-editing-overlay');
            expect(overlay).not.toBeNull();
        });

        it('displays user email in overlay', () => {
            document.body.innerHTML += `
                <div node-selected="page-456">
                    <div class="content"></div>
                </div>
            `;
            projectManager.lockPageContent(
                'test@example.com',
                'page-456',
                Date.now(),
            );
            const emailElement = document.querySelector('.user-editing-email');
            expect(emailElement.textContent).toBe('test@example.com');
        });

        it('calls lockIdevices', () => {
            document.body.innerHTML += `
                <div node-selected="page-789">
                    <div class="content"></div>
                </div>
            `;
            const spy = vi.spyOn(projectManager, 'lockIdevices');
            projectManager.lockPageContent('user@test.com', 'page-789', Date.now());
            expect(spy).toHaveBeenCalled();
        });
    });

    // ===========================================
    // Grupo 4: CRUD Operations
    // ===========================================

    describe('deleteOdeComponent', () => {
        it('removes element from DOM by id', async () => {
            document.body.innerHTML += '<div id="component-to-delete">Content</div>';
            expect(document.getElementById('component-to-delete')).not.toBeNull();
            await projectManager.deleteOdeComponent('component-to-delete');
            expect(document.getElementById('component-to-delete')).toBeNull();
        });

        it('handles non-existent element gracefully', async () => {
            await expect(
                projectManager.deleteOdeComponent('non-existent-id'),
            ).resolves.toBeUndefined();
        });
    });

    describe('deleteOdeBlock', () => {
        it('removes block element from DOM', async () => {
            document.body.innerHTML += '<article id="block-to-delete">Block</article>';
            expect(document.getElementById('block-to-delete')).not.toBeNull();
            await projectManager.deleteOdeBlock('block-to-delete');
            expect(document.getElementById('block-to-delete')).toBeNull();
        });

        it('handles non-existent block gracefully', async () => {
            await expect(
                projectManager.deleteOdeBlock('non-existent-block'),
            ).resolves.toBeUndefined();
        });
    });

    // ===========================================
    // Grupo 5: Lifecycle Methods
    // ===========================================

    describe('loadCurrentProject', () => {
        it('throws error when no project ID in URL', async () => {
            window.eXeLearning.projectId = null;
            await expect(projectManager.loadCurrentProject()).rejects.toThrow(
                'No project ID in URL',
            );
        });

        it('sets yjsProjectId from URL', async () => {
            window.eXeLearning.projectId = 'my-project-id';
            await projectManager.loadCurrentProject();
            expect(projectManager.yjsProjectId).toBe('my-project-id');
        });

        it('generates odeSession from project ID', async () => {
            window.eXeLearning.projectId = 'project-xyz';
            await projectManager.loadCurrentProject();
            expect(projectManager.odeSession).toBe('yjs-project-xyz');
        });

        it('sets odeId from project ID', async () => {
            window.eXeLearning.projectId = 'project-abc';
            await projectManager.loadCurrentProject();
            expect(projectManager.odeId).toBe('project-abc');
        });

        it('sets odeVersion to 1', async () => {
            window.eXeLearning.projectId = 'project-def';
            await projectManager.loadCurrentProject();
            expect(projectManager.odeVersion).toBe('1');
        });
    });

    describe('resetProject', () => {
        it('sets _forceStructureImport flag', () => {
            projectManager.resetProject();
            expect(projectManager._forceStructureImport).toBe(true);
        });

        it('clears navigation tree DOM', () => {
            const nav = document.getElementById('structure-menu-nav');
            nav.innerHTML = '<div>Old content</div>';
            projectManager.resetProject();
            expect(nav.innerHTML).toBe('');
        });

        it('clears content area', () => {
            const content = document.getElementById('exe-content-area');
            content.innerHTML = '<div>Old content</div>';
            projectManager.resetProject();
            expect(content.innerHTML).toBe('');
        });

        it('clears iDevice panels', () => {
            const panels = document.getElementById('exe-idevice-panels');
            panels.innerHTML = '<div>Old panels</div>';
            projectManager.resetProject();
            expect(panels.innerHTML).toBe('');
        });
    });

    describe('loadProjectProperties', () => {
        it('calls properties.load', async () => {
            await projectManager.loadProjectProperties();
            expect(projectManager.properties.load).toHaveBeenCalled();
        });
    });

    describe('loadInterface', () => {
        it('calls app.interface.load', async () => {
            mockApp.interface.load = vi.fn();
            await projectManager.loadInterface();
            expect(mockApp.interface.load).toHaveBeenCalled();
        });
    });

    describe('loadUser', () => {
        it('calls app.user.loadUserPreferences', async () => {
            mockApp.user = { loadUserPreferences: vi.fn() };
            await projectManager.loadUser();
            expect(mockApp.user.loadUserPreferences).toHaveBeenCalled();
        });
    });

    describe('loadStructureData', () => {
        it('resets idevices components', async () => {
            projectManager.idevices.components = { blocks: [1], idevices: [2] };
            projectManager.structure.loadData = vi.fn();
            await projectManager.loadStructureData();
            expect(projectManager.idevices.components).toEqual({
                blocks: [],
                idevices: [],
            });
        });

        it('calls structure.loadData', async () => {
            projectManager.structure.loadData = vi.fn();
            await projectManager.loadStructureData();
            expect(projectManager.structure.loadData).toHaveBeenCalled();
        });
    });

    describe('loadMenus', () => {
        it('calls app.menus.load', async () => {
            mockApp.menus.load = vi.fn();
            await projectManager.loadMenus();
            expect(mockApp.menus.load).toHaveBeenCalled();
        });
    });

    describe('loadModalsContent', () => {
        it('calls releasenotes.load and legalnotes.load', async () => {
            mockApp.modals.releasenotes = { load: vi.fn() };
            mockApp.modals.legalnotes = { load: vi.fn() };
            await projectManager.loadModalsContent();
            expect(mockApp.modals.releasenotes.load).toHaveBeenCalled();
            expect(mockApp.modals.legalnotes.load).toHaveBeenCalled();
        });
    });

    describe('ideviceEngineBehaviour', () => {
        it('calls idevices.behaviour', async () => {
            projectManager.idevices.behaviour = vi.fn();
            await projectManager.ideviceEngineBehaviour();
            expect(projectManager.idevices.behaviour).toHaveBeenCalled();
        });
    });

    describe('lastNodeSelected', () => {
        it('calls app.selectFirstNodeStructure', async () => {
            mockApp.selectFirstNodeStructure = vi.fn();
            await projectManager.lastNodeSelected();
            expect(mockApp.selectFirstNodeStructure).toHaveBeenCalled();
        });
    });

    describe('subscribeToSessionAndNotify', () => {
        it('is a no-op function', async () => {
            await expect(
                projectManager.subscribeToSessionAndNotify(),
            ).resolves.toBeUndefined();
        });
    });

    describe('compatibilityLegacy', () => {
        afterEach(() => {
            // Clean up window.eXe properly to avoid conflicts with vitest.setup.js
            if (window.eXe) {
                window.eXe.app = {
                    clearHistory: vi.fn(),
                    _confirmResponses: new Map(),
                };
            }
        });

        it('creates window.eXe object', async () => {
            await projectManager.compatibilityLegacy();
            expect(window.eXe).toBeDefined();
            expect(window.eXe.app).toBeDefined();
        });

        it('creates isInExe function that returns true', async () => {
            await projectManager.compatibilityLegacy();
            expect(window.eXe.app.isInExe()).toBe(true);
        });

        it('creates getProjectProperties function', async () => {
            await projectManager.compatibilityLegacy();
            const props = window.eXe.app.getProjectProperties();
            expect(props).toBe(projectManager.properties.properties);
        });
    });

    describe('cleanPreviousAutosaves', () => {
        it('calls postCleanAutosavesByUser with session', async () => {
            mockApp.api.postCleanAutosavesByUser = vi.fn();
            projectManager.odeSession = 'test-session';
            await projectManager.cleanPreviousAutosaves();
            expect(mockApp.api.postCleanAutosavesByUser).toHaveBeenCalledWith({
                odeSessionId: 'test-session',
            });
        });
    });

    describe('sortBlocksById', () => {
        beforeEach(() => {
            // Restore DOM that may have been cleared by previous tests
            if (!document.getElementById('node-content')) {
                document.body.innerHTML = `
                    <div id="main">
                        <div id="workarea">
                            <div id="node-content-container">
                                <div id="node-content" node-selected="test-page"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        it('sorts articles in ascending order', () => {
            const nodeContent = document.getElementById('node-content');
            nodeContent.innerHTML = `
                <article id="c-block"><div class="exe-text-activity"><p>C</p></div></article>
                <article id="a-block"><div class="exe-text-activity"><p>A</p></div></article>
                <article id="b-block"><div class="exe-text-activity"><p>B</p></div></article>
            `;
            projectManager.sortBlocksById(true);
            const articles = nodeContent.querySelectorAll('article');
            expect(articles[0].id).toBe('a-block');
            expect(articles[1].id).toBe('b-block');
            expect(articles[2].id).toBe('c-block');
        });

        it('sorts articles in descending order', () => {
            const nodeContent = document.getElementById('node-content');
            nodeContent.innerHTML = `
                <article id="a-block"><div class="exe-text-activity"><p>A</p></div></article>
                <article id="c-block"><div class="exe-text-activity"><p>C</p></div></article>
                <article id="b-block"><div class="exe-text-activity"><p>B</p></div></article>
            `;
            projectManager.sortBlocksById(false);
            const articles = nodeContent.querySelectorAll('article');
            expect(articles[0].id).toBe('c-block');
            expect(articles[1].id).toBe('b-block');
            expect(articles[2].id).toBe('a-block');
        });
    });

    // ===========================================
    // Grupo 6: Yjs Integration (basic coverage)
    // ===========================================

    describe('initializeYjs', () => {
        it('returns early when YjsLoader and YjsModules not available', async () => {
            delete window.YjsLoader;
            delete window.YjsModules;
            await projectManager.initializeYjs();
            expect(projectManager._yjsEnabled).toBe(false);
        });

        it('checks for YjsLoader availability', async () => {
            window.YjsLoader = null;
            window.YjsModules = null;
            await projectManager.initializeYjs();
            expect(projectManager._yjsEnabled).toBe(false);
        });
    });

    describe('reinitializeWithProject', () => {
        it('throws error when YjsProjectBridge not available', async () => {
            window.YjsModules = {};
            await expect(
                projectManager.reinitializeWithProject('new-uuid'),
            ).rejects.toThrow('YjsProjectBridge not available');
        });

        it('disconnects existing bridge if present', async () => {
            const mockDisconnect = vi.fn();
            projectManager._yjsBridge = { disconnect: mockDisconnect };
            window.YjsModules = {};

            try {
                await projectManager.reinitializeWithProject('new-uuid');
            } catch {
                // Expected to fail, we just want to test disconnect was called
            }

            expect(mockDisconnect).toHaveBeenCalled();
            expect(projectManager._yjsBridge).toBe(null);
        });

        it('clears Yjs bindings', async () => {
            projectManager._yjsBindings.set('test', 'binding');
            window.YjsModules = {};

            try {
                await projectManager.reinitializeWithProject('new-uuid');
            } catch {
                // Expected to fail
            }

            expect(projectManager._yjsBindings.size).toBe(0);
        });

        it('updates project IDs before bridge creation', async () => {
            window.YjsModules = {};

            try {
                await projectManager.reinitializeWithProject('my-new-project');
            } catch {
                // Expected to fail
            }

            expect(projectManager.yjsProjectId).toBe('my-new-project');
            expect(projectManager.odeId).toBe('my-new-project');
        });
    });

    describe('importElpDirectly', () => {
        it('throws error when Yjs bridge not initialized', async () => {
            projectManager._yjsBridge = null;
            const mockFile = new File(['content'], 'test.elp');
            await expect(
                projectManager.importElpDirectly(mockFile),
            ).rejects.toThrow('Yjs bridge not initialized');
        });
    });

    describe('checkAndImportElp', () => {
        it('returns early when no import parameter in URL', async () => {
            // No import param, should just return without doing anything
            await projectManager.checkAndImportElp();
            // No error thrown means success
            expect(true).toBe(true);
        });
    });

    // ===========================================
    // Grupo 7: Sync Operations (additional coverage)
    // ===========================================

    describe('checkUserUpdateFlag', () => {
        it('returns false when pageId is falsy', async () => {
            const result = await projectManager.checkUserUpdateFlag(null);
            expect(result).toBe(false);
        });

        it('returns false when pageId is empty string', async () => {
            const result = await projectManager.checkUserUpdateFlag('');
            expect(result).toBe(false);
        });
    });

    describe('updateEditedElement', () => {
        beforeEach(() => {
            // Setup mock for eXeLearning.app.menus.menuStructure
            window.eXeLearning.app.menus = {
                menuStructure: {
                    menuStructureBehaviour: {
                        nodeSelected: {
                            getAttribute: vi.fn().mockReturnValue('page-123'),
                        },
                    },
                },
            };
            projectManager.idevices.resetCurrentIdevicesExportView = vi.fn();
            // Add DOM element to avoid querySelector returning null
            document.body.innerHTML += '<div node-selected="page-123" mode="view"></div>';
        });

        it('calls replaceOdeComponent when odeComponentSyncId present', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'replaceOdeComponent')
                .mockResolvedValue();
            const response = {
                odeComponentSyncId: 'comp-123',
                odeComponentSync: { id: 'comp-123' },
            };
            await projectManager.updateEditedElement(response);
            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledWith(response.odeComponentSync);
            vi.useRealTimers();
        });

        it('calls replaceOdeBlock when odeBlockId present', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'replaceOdeBlock')
                .mockResolvedValue();
            const response = {
                odeBlockId: 'block-123',
                odeBlockSync: { id: 'block-123' },
            };
            await projectManager.updateEditedElement(response);
            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledWith(response.odeBlockSync);
            vi.useRealTimers();
        });

        it('calls replaceOdePage when no component or block id', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'replaceOdePage')
                .mockResolvedValue();
            const response = {
                odePageSync: { id: 'page-123' },
            };
            await projectManager.updateEditedElement(response);
            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledWith(response.odePageSync);
            vi.useRealTimers();
        });
    });

    describe('updateDeletedElement', () => {
        it('calls deleteOdeComponent when odeComponentSyncId present', async () => {
            const spy = vi
                .spyOn(projectManager, 'deleteOdeComponent')
                .mockResolvedValue();
            await projectManager.updateDeletedElement({
                odeComponentSyncId: 'comp-123',
            });
            expect(spy).toHaveBeenCalledWith('comp-123');
        });

        it('calls deleteOdeBlock when odeBlockId present', async () => {
            const spy = vi
                .spyOn(projectManager, 'deleteOdeBlock')
                .mockResolvedValue();
            await projectManager.updateDeletedElement({ odeBlockId: 'block-123' });
            expect(spy).toHaveBeenCalledWith('block-123');
        });

        it('calls deleteOdePage when no component or block id', async () => {
            const spy = vi
                .spyOn(projectManager, 'deleteOdePage')
                .mockResolvedValue();
            await projectManager.updateDeletedElement({ odePageId: 'page-123' });
            expect(spy).toHaveBeenCalledWith('page-123');
        });
    });

    describe('updateAddedElement', () => {
        it('calls addOdeComponent when odeComponentSyncId present', async () => {
            const spy = vi
                .spyOn(projectManager, 'addOdeComponent')
                .mockResolvedValue();
            await projectManager.updateAddedElement({
                odeComponentSyncId: 'comp-123',
                odeComponentSync: { id: 'comp-123' },
            });
            expect(spy).toHaveBeenCalled();
        });

        it('calls addOdeBlock when odeBlockSync present', async () => {
            const spy = vi
                .spyOn(projectManager, 'addOdeBlock')
                .mockResolvedValue();
            await projectManager.updateAddedElement({
                odeBlockSync: { id: 'block-123' },
            });
            expect(spy).toHaveBeenCalled();
        });

        it('calls addOdePage and reloadStructure when page sync', async () => {
            const addSpy = vi
                .spyOn(projectManager, 'addOdePage')
                .mockResolvedValue();
            const reloadSpy = vi
                .spyOn(projectManager, 'reloadStructure')
                .mockResolvedValue();
            await projectManager.updateAddedElement({
                odePageSync: { id: 'page-123' },
            });
            expect(addSpy).toHaveBeenCalled();
            expect(reloadSpy).toHaveBeenCalled();
        });
    });

    describe('updateMovedElement', () => {
        it('calls moveOdeComponent when odeComponentSyncId present', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'moveOdeComponent')
                .mockResolvedValue();
            await projectManager.updateMovedElement({
                odeComponentSyncId: 'comp-123',
                odeComponentSync: { id: 'comp-123' },
            });
            expect(spy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('calls moveOdeBlock when no component id', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'moveOdeBlock')
                .mockResolvedValue();
            await projectManager.updateMovedElement({
                odeBlockSync: { id: 'block-123' },
            });
            expect(spy).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('updateMovedElementOnSamePage', () => {
        it('calls moveOdeComponentOnSamePage when odeComponentSyncId present', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'moveOdeComponentOnSamePage')
                .mockResolvedValue();
            await projectManager.updateMovedElementOnSamePage({
                odeComponentSyncId: 'comp-123',
                odeComponentSync: { id: 'comp-123' },
            });
            expect(spy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('calls moveOdeBlockOnSamePage when no component id', async () => {
            vi.useFakeTimers();
            const spy = vi
                .spyOn(projectManager, 'moveOdeBlockOnSamePage')
                .mockResolvedValue();
            await projectManager.updateMovedElementOnSamePage({
                odeBlockSync: { id: 'block-123' },
            });
            expect(spy).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    // ===========================================
    // Grupo 8: Additional Methods
    // ===========================================

    describe('initialiceProject', () => {
        beforeEach(() => {
            window.eXeLearning.config = {
                ...window.eXeLearning.config,
                defaultTheme: 'base',
            };
            mockApp.themes = { selectTheme: vi.fn(), selected: null };
            mockApp.user = {
                preferences: { preferences: { theme: { value: 'base' } } },
            };
            mockApp.selectFirstNodeStructure = vi.fn();
        });

        it('selects default theme when Yjs not enabled', async () => {
            projectManager._yjsEnabled = false;
            await projectManager.initialiceProject();
            expect(mockApp.themes.selectTheme).toHaveBeenCalledWith('base', false);
        });

        it('calls lastNodeSelected', async () => {
            projectManager._yjsEnabled = false;
            mockApp.themes.selected = 'base';
            const spy = vi.spyOn(projectManager, 'lastNodeSelected');
            await projectManager.initialiceProject();
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('reloadStructure', () => {
        it('calls structure methods and checkUserUpdateFlag', async () => {
            projectManager.structure.getSelectNodeNavId = vi
                .fn()
                .mockReturnValue('nav-123');
            projectManager.structure.resetDataAndStructureData = vi
                .fn()
                .mockResolvedValue('page-123');
            const checkSpy = vi
                .spyOn(projectManager, 'checkUserUpdateFlag')
                .mockResolvedValue(true);
            await projectManager.reloadStructure();
            expect(projectManager.structure.getSelectNodeNavId).toHaveBeenCalled();
            expect(checkSpy).toHaveBeenCalledWith('page-123');
        });
    });

    describe('newSession', () => {
        it('calls createSession with odeSessionId', async () => {
            const spy = vi
                .spyOn(projectManager, 'createSession')
                .mockResolvedValue();
            await projectManager.newSession('session-123');
            expect(spy).toHaveBeenCalledWith({ odeSessionId: 'session-123' });
        });
    });

    describe('createSession', () => {
        it('calls postCloseSession API', async () => {
            mockApp.api.postCloseSession = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'error' });
            await projectManager.createSession({ odeSessionId: 'test' });
            expect(mockApp.api.postCloseSession).toHaveBeenCalledWith({
                odeSessionId: 'test',
            });
        });
    });

    describe('isAvalaibleOdeComponent', () => {
        it('calls checkCurrentOdeUsersComponentFlag with params', async () => {
            mockApp.api.checkCurrentOdeUsersComponentFlag = vi
                .fn()
                .mockResolvedValue({ available: true });
            projectManager.odeSession = 'test-session';
            const result = await projectManager.isAvalaibleOdeComponent(
                'block-1',
                'idevice-1',
            );
            expect(mockApp.api.checkCurrentOdeUsersComponentFlag).toHaveBeenCalledWith(
                {
                    odeSessionId: 'test-session',
                    odeIdeviceId: 'idevice-1',
                    blockId: 'block-1',
                },
            );
        });
    });

    describe('generateIntervalCheckOdeUpdates', () => {
        it('sets interval when online installation', async () => {
            vi.useFakeTimers();
            projectManager.offlineInstallation = false;
            projectManager.clientIntervalUpdate = 1000;
            projectManager.structure.getSelectNodeNavId = vi
                .fn()
                .mockReturnValue('nav-1');
            const setIntervalSpy = vi.spyOn(global, 'setInterval');

            await projectManager.generateIntervalCheckOdeUpdates();

            expect(setIntervalSpy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('does not set interval when offline installation', async () => {
            vi.useFakeTimers();
            projectManager.offlineInstallation = true;
            const setIntervalSpy = vi.spyOn(global, 'setInterval');

            await projectManager.generateIntervalCheckOdeUpdates();

            expect(setIntervalSpy).not.toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('save', () => {
        it('uses Yjs mode when enabled', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = true;
            projectManager._yjsBridge = {
                getDocumentManager: vi.fn().mockReturnValue({
                    save: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
                }),
            };
            mockApp.toasts = {
                createToast: vi.fn().mockReturnValue({
                    toastBody: { innerHTML: '' },
                    remove: vi.fn(),
                }),
            };
            mockApp.interface.connectionTime = {
                loadLasUpdatedInInterface: vi.fn(),
            };

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(projectManager._yjsBridge.getDocumentManager).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('uses legacy API when Yjs not enabled', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = false;
            projectManager.odeSession = 'test';
            projectManager.odeVersion = '1';
            projectManager.odeId = 'proj-1';
            mockApp.api.postOdeSave = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
            mockApp.toasts = {
                createToast: vi.fn().mockReturnValue({
                    toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                    remove: vi.fn(),
                }),
            };
            mockApp.interface.connectionTime = {
                loadLasUpdatedInInterface: vi.fn(),
            };

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(mockApp.api.postOdeSave).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });
});
