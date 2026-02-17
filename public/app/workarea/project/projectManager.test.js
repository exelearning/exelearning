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

    it('marks the installation as static when in static mode', () => {
        projectManager.app.runtimeConfig = {
            isStaticMode: () => true,
        };
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('static');
        expect(button.innerHTML).toBe('save');
        expect(button.getAttribute('title')).toBe('Save');
    });

    it('exposes project key for Electron when electronAPI is available', () => {
        // Simulate Electron environment (electronAPI exists, static mode)
        window.electronAPI = { test: true };
        projectManager.app.runtimeConfig = {
            isStaticMode: () => true,
        };
        projectManager.odeId = 'custom-project';
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('static');
        expect(button.innerHTML).toBe('save');
        expect(button.getAttribute('title')).toBe('Save');
        expect(window.__currentProjectId).toBe('custom-project');

        // Cleanup
        delete window.electronAPI;
    });

    it('marks the installation as online when in server mode', () => {
        projectManager.app.runtimeConfig = {
            isStaticMode: () => false,
        };
        projectManager.offlineInstallation = false;
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('online');
        expect(button.innerHTML).toBe('Download');
    });

    it('defaults to online when no runtimeConfig is available', () => {
        projectManager.app.runtimeConfig = null;
        const button = document.querySelector('#head-top-download-button');

        projectManager.setInstallationTypeAttribute();

        expect(document.body.getAttribute('installation-type')).toBe('online');
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
                body: 'Unsaved changes detected. Save your iDevice before continuing.',
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

        it('resets preview panel state when available', () => {
            const resetSpy = vi.fn();
            mockApp.interface.previewButton = {
                getPanel: vi.fn(() => ({
                    resetToDefaultState: resetSpy,
                })),
            };

            projectManager.resetProject();

            expect(resetSpy).toHaveBeenCalled();
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

        it('passes skipSyncWait option to bridge initialize', async () => {
            const mockInitialize = vi.fn().mockResolvedValue();
            // Create a proper constructor class for mocking
            class MockBridge {
                constructor() {
                    this.initialize = mockInitialize;
                }
            }
            window.YjsModules = { YjsProjectBridge: MockBridge };
            // Mock localStorage
            const originalLocalStorage = global.localStorage;
            global.localStorage = { getItem: vi.fn().mockReturnValue(null) };

            await projectManager.reinitializeWithProject('test-uuid', {
                skipSyncWait: true,
            });

            expect(mockInitialize).toHaveBeenCalledWith(
                'test-uuid',
                null, // authToken from localStorage.getItem mock
                expect.objectContaining({
                    skipSyncWait: true,
                }),
            );

            global.localStorage = originalLocalStorage;
        });

        it('defaults skipSyncWait to false when not provided', async () => {
            const mockInitialize = vi.fn().mockResolvedValue();
            // Create a proper constructor class for mocking
            class MockBridge {
                constructor() {
                    this.initialize = mockInitialize;
                }
            }
            window.YjsModules = { YjsProjectBridge: MockBridge };
            // Mock localStorage
            const originalLocalStorage = global.localStorage;
            global.localStorage = { getItem: vi.fn().mockReturnValue(null) };

            await projectManager.reinitializeWithProject('test-uuid');

            expect(mockInitialize).toHaveBeenCalledWith(
                'test-uuid',
                null, // authToken from localStorage.getItem mock
                expect.objectContaining({
                    skipSyncWait: false,
                }),
            );

            global.localStorage = originalLocalStorage;
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
        let originalFetch;
        let originalHistoryReplaceState;

        beforeEach(() => {
            originalFetch = global.fetch;
            originalHistoryReplaceState = window.history.replaceState;
            window.__exeInitialProjectImported = undefined;

            projectManager.app.modals.loader = {
                show: vi.fn(),
                hide: vi.fn(),
            };
            projectManager.importFromElpxViaYjs = vi.fn().mockResolvedValue({
                pages: 1,
                blocks: 1,
                components: 1,
            });
            projectManager._yjsBridge = {
                documentManager: {
                    saveToServer: vi.fn().mockResolvedValue(undefined),
                },
            };
        });

        afterEach(() => {
            global.fetch = originalFetch;
            window.history.replaceState = originalHistoryReplaceState;
            delete window.__exeInitialProjectImported;
        });

        it('returns early when no import parameter in URL', async () => {
            // No import param, should just return without doing anything
            await projectManager.checkAndImportElp();
            // No error thrown means success
            expect(true).toBe(true);
        });

        it('imports from embedding initialProjectUrl and prevents duplicate import', async () => {
            projectManager.app.runtimeConfig = {
                embeddingConfig: {
                    initialProjectUrl: 'https://cdn.example.com/course.elpx',
                },
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['abc'])),
            });

            await projectManager.checkAndImportElp();
            await projectManager.checkAndImportElp();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(projectManager.importFromElpxViaYjs).toHaveBeenCalledTimes(1);
            expect(window.__exeInitialProjectImported).toBe('https://cdn.example.com/course.elpx');
        });

        it('imports from URL param, prefixes basePath and executes cleanup', async () => {
            const OriginalURLSearchParams = global.URLSearchParams;
            const OriginalURL = global.URL;
            global.URLSearchParams = class MockURLSearchParams {
                get(key) {
                    return key === 'import' ? '/tmp/project.elpx' : null;
                }
            };
            global.URL = class MockURL {
                constructor(value) {
                    const str = String(value || '');
                    if (str.includes('/tmp/project.elpx')) {
                        this.pathname = '/tmp/project.elpx';
                        return;
                    }
                    this.searchParams = { delete: vi.fn() };
                }
            };
            window.eXeLearning.config.basePath = '/exelearning';

            const replaceStateSpy = vi.fn();
            window.history.replaceState = replaceStateSpy;

            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    blob: vi.fn().mockResolvedValue(new Blob(['abc'])),
                })
                .mockResolvedValueOnce({
                    ok: true,
                });

            try {
                await projectManager.checkAndImportElp();

                expect(global.fetch).toHaveBeenNthCalledWith(1, '/exelearning/tmp/project.elpx', { credentials: 'include' });
                expect(global.fetch).toHaveBeenNthCalledWith(
                    2,
                    '/exelearning/api/project/cleanup-import?path=%2Ftmp%2Fproject.elpx',
                    { method: 'DELETE' },
                );
                expect(replaceStateSpy).toHaveBeenCalled();
            } finally {
                global.URLSearchParams = OriginalURLSearchParams;
                global.URL = OriginalURL;
            }
        });

        it('shows alert and hides loader on fetch failure', async () => {
            projectManager.app.runtimeConfig = {
                embeddingConfig: {
                    initialProjectUrl: 'https://cdn.example.com/fail.elpx',
                },
            };
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                statusText: 'Forbidden',
            });

            await projectManager.checkAndImportElp();

            expect(projectManager.app.modals.loader.hide).toHaveBeenCalled();
            expect(projectManager.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import Error',
                    body: expect.stringContaining('Forbidden'),
                }),
            );
        });

        it('continues when saveToServer fails', async () => {
            projectManager.app.runtimeConfig = {
                embeddingConfig: {
                    initialProjectUrl: 'https://cdn.example.com/course.elpx',
                },
            };
            projectManager._yjsBridge.documentManager.saveToServer = vi
                .fn()
                .mockRejectedValue(new Error('save failed'));
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['abc'])),
            });
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await expect(projectManager.checkAndImportElp()).resolves.toBeUndefined();
            expect(warnSpy).toHaveBeenCalled();
        });

        it('uses fallback filename when URL parsing fails', async () => {
            projectManager.app.runtimeConfig = {
                embeddingConfig: {
                    initialProjectUrl: '/path/to/from-split.elpx',
                },
            };
            const OriginalURL = global.URL;
            global.URL = class MockURLThatThrows {
                constructor() {
                    throw new Error('bad url');
                }
            };
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['abc'])),
            });

            try {
                await projectManager.checkAndImportElp();
                const importedFile = projectManager.importFromElpxViaYjs.mock.calls[0][0];
                expect(importedFile.name).toBe('from-split.elpx');
            } finally {
                global.URL = OriginalURL;
            }
        });

        it('continues when cleanup-import request fails', async () => {
            const OriginalURLSearchParams = global.URLSearchParams;
            const OriginalURL = global.URL;
            global.URLSearchParams = class MockURLSearchParams {
                get(key) {
                    return key === 'import' ? '/tmp/project.elpx' : null;
                }
            };
            global.URL = class MockURL {
                constructor(value) {
                    const str = String(value || '');
                    if (str.includes('/tmp/project.elpx')) {
                        this.pathname = '/tmp/project.elpx';
                        return;
                    }
                    this.searchParams = { delete: vi.fn() };
                }
            };
            window.eXeLearning.config.basePath = '/exelearning';
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    blob: vi.fn().mockResolvedValue(new Blob(['abc'])),
                })
                .mockRejectedValueOnce(new Error('cleanup failed'));

            try {
                await expect(projectManager.checkAndImportElp()).resolves.toBeUndefined();
                expect(warnSpy).toHaveBeenCalled();
            } finally {
                global.URLSearchParams = OriginalURLSearchParams;
                global.URL = OriginalURL;
            }
        });
    });

    describe('_resolveDocumentReady', () => {
        it('dispatches event and resolves app.documentReady once', () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            const resolveSpy = vi.fn();
            projectManager.app._documentReadyResolve = resolveSpy;

            projectManager._resolveDocumentReady();

            expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
            expect(resolveSpy).toHaveBeenCalledTimes(1);
            expect(projectManager.app._documentReadyResolve).toBeNull();
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

        it('handles save error in Yjs mode', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = true;
            projectManager._yjsBridge = {
                getDocumentManager: vi.fn().mockReturnValue({
                    save: vi.fn().mockResolvedValue({ success: false, message: 'error' }),
                }),
            };
            const mockToast = {
                toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                remove: vi.fn(),
            };
            mockApp.toasts = { createToast: vi.fn().mockReturnValue(mockToast) };

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(mockToast.toastBody.classList.add).toHaveBeenCalledWith('error');
            vi.useRealTimers();
        });

        it('handles missing document manager in Yjs mode', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = true;
            projectManager._yjsBridge = {
                getDocumentManager: vi.fn().mockReturnValue(null),
            };
            const mockToast = {
                toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                remove: vi.fn(),
            };
            mockApp.toasts = { createToast: vi.fn().mockReturnValue(mockToast) };

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(mockToast.toastBody.classList.add).toHaveBeenCalledWith('error');
            vi.useRealTimers();
        });

        it('handles legacy API error', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = false;
            projectManager.odeSession = 'test';
            projectManager.odeVersion = '1';
            projectManager.odeId = 'proj-1';
            mockApp.api.postOdeSave = vi.fn().mockResolvedValue({ responseMessage: 'ERROR' });
            const mockToast = {
                toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                remove: vi.fn(),
            };
            mockApp.toasts = { createToast: vi.fn().mockReturnValue(mockToast) };
            const showModalSpy = vi.spyOn(projectManager, 'showModalSaveError');

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(showModalSpy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('handles exception during save', async () => {
            vi.useFakeTimers();
            projectManager._yjsEnabled = true;
            projectManager._yjsBridge = {
                getDocumentManager: vi.fn().mockImplementation(() => {
                    throw new Error('Bridge error');
                }),
            };
            const mockToast = {
                toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                remove: vi.fn(),
            };
            mockApp.toasts = { createToast: vi.fn().mockReturnValue(mockToast) };

            await projectManager.save();
            vi.advanceTimersByTime(2000);

            expect(mockToast.toastBody.classList.add).toHaveBeenCalledWith('error');
            vi.useRealTimers();
        });
    });

    // ===========================================
    // Grupo 9: Load and Open Methods
    // ===========================================

    describe('load', () => {
        beforeEach(() => {
            projectManager.loadCurrentProject = vi.fn().mockResolvedValue();
            projectManager.loadProjectProperties = vi.fn().mockResolvedValue();
            projectManager.loadInterface = vi.fn().mockResolvedValue();
            projectManager.initializeYjs = vi.fn().mockResolvedValue();
            projectManager.loadStructureData = vi.fn().mockResolvedValue();
            projectManager.loadMenus = vi.fn().mockResolvedValue();
            projectManager.loadModalsContent = vi.fn().mockResolvedValue();
            projectManager.ideviceEngineBehaviour = vi.fn();
            projectManager.compatibilityLegacy = vi.fn();
            projectManager.initialiceProject = vi.fn().mockResolvedValue();
            projectManager.showScreen = vi.fn();
            projectManager.setInstallationTypeAttribute = vi.fn();
            projectManager.generateIntervalAutosave = vi.fn();
            projectManager.cleanPreviousAutosaves = vi.fn();
            projectManager.subscribeToSessionAndNotify = vi.fn().mockResolvedValue();
            projectManager.properties = {
                properties: { pp_lang: { value: 'en' } },
                load: vi.fn(),
                loadPropertiesFromYjs: vi.fn(),
            };
            mockApp.locale = { loadContentTranslationsStrings: vi.fn() };
            mockApp.interface.shareButton = { loadVisibilityFromProject: vi.fn() };
            projectManager.structure = { subscribeToYjsChanges: vi.fn() };
        });

        it('calls all initialization methods in order', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(projectManager.loadCurrentProject).toHaveBeenCalled();
            expect(projectManager.loadProjectProperties).toHaveBeenCalled();
            expect(projectManager.loadInterface).toHaveBeenCalled();
            expect(projectManager.initializeYjs).toHaveBeenCalled();
            expect(projectManager.loadStructureData).toHaveBeenCalled();
            expect(projectManager.loadMenus).toHaveBeenCalled();
            expect(projectManager.loadModalsContent).toHaveBeenCalled();
            expect(projectManager.ideviceEngineBehaviour).toHaveBeenCalled();
            expect(projectManager.compatibilityLegacy).toHaveBeenCalled();
            expect(projectManager.initialiceProject).toHaveBeenCalled();
            expect(projectManager.showScreen).toHaveBeenCalled();
            expect(projectManager.setInstallationTypeAttribute).toHaveBeenCalled();
        });

        it('loads content translations after Yjs initialization', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(projectManager.properties.loadPropertiesFromYjs).toHaveBeenCalled();
            expect(mockApp.locale.loadContentTranslationsStrings).toHaveBeenCalledWith('en');
        });

        it('loads content translations with correct language from properties', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = true;
            projectManager.properties.properties.pp_lang.value = 'es';

            await projectManager.load();

            expect(mockApp.locale.loadContentTranslationsStrings).toHaveBeenCalledWith('es');
        });

        it('generates autosave interval when Yjs not enabled', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(projectManager.generateIntervalAutosave).toHaveBeenCalled();
        });

        it('skips autosave when Yjs is enabled', async () => {
            projectManager._yjsEnabled = true;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(projectManager.generateIntervalAutosave).not.toHaveBeenCalled();
        });

        it('subscribes to Yjs changes when enabled', async () => {
            projectManager._yjsEnabled = true;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(projectManager.structure.subscribeToYjsChanges).toHaveBeenCalled();
        });

        it('calls subscribeToSessionAndNotify when online', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = false;

            await projectManager.load();

            expect(projectManager.subscribeToSessionAndNotify).toHaveBeenCalled();
        });

        it('loads share button visibility when available', async () => {
            projectManager._yjsEnabled = false;
            projectManager.offlineInstallation = true;

            await projectManager.load();

            expect(mockApp.interface.shareButton.loadVisibilityFromProject).toHaveBeenCalled();
        });
    });

    describe('openLoad', () => {
        beforeEach(() => {
            projectManager.resetProject = vi.fn();
            projectManager.loadUser = vi.fn().mockResolvedValue();
            projectManager.loadProjectProperties = vi.fn().mockResolvedValue();
            projectManager.loadStructureData = vi.fn().mockResolvedValue();
            projectManager.loadModalsContent = vi.fn().mockResolvedValue();
            projectManager.initialiceProject = vi.fn().mockResolvedValue();
            projectManager.showScreen = vi.fn();
            projectManager.setInstallationTypeAttribute = vi.fn();
            projectManager.generateIntervalAutosave = vi.fn();
            projectManager.subscribeToSessionAndNotify = vi.fn().mockResolvedValue();
            projectManager.properties = {
                formProperties: { remove: vi.fn() },
                properties: { pp_lang: { value: 'en' } },
            };
            projectManager.structure = {
                reloadStructureMenu: vi.fn().mockResolvedValue(),
            };
            mockApp.interface.loadingScreen = { show: vi.fn(), hide: vi.fn() };
            mockApp.interface.odeTitleElement = { setTitle: vi.fn() };
            mockApp.locale = { loadContentTranslationsStrings: vi.fn().mockResolvedValue() };
            window.eXeLearning.app.modals.openuserodefiles = { close: vi.fn() };
        });

        it('calls resetProject first', async () => {
            projectManager.offlineInstallation = true;
            await projectManager.openLoad();
            expect(projectManager.resetProject).toHaveBeenCalled();
        });

        it('closes openuserodefiles modal', async () => {
            projectManager.offlineInstallation = true;
            await projectManager.openLoad();
            expect(window.eXeLearning.app.modals.openuserodefiles.close).toHaveBeenCalled();
        });

        it('shows loading screen', async () => {
            projectManager.offlineInstallation = true;
            await projectManager.openLoad();
            expect(mockApp.interface.loadingScreen.show).toHaveBeenCalled();
        });

        it('calls all load methods', async () => {
            projectManager.offlineInstallation = true;

            await projectManager.openLoad();

            expect(projectManager.loadUser).toHaveBeenCalled();
            expect(projectManager.loadProjectProperties).toHaveBeenCalled();
            expect(projectManager.loadStructureData).toHaveBeenCalled();
            expect(projectManager.loadModalsContent).toHaveBeenCalled();
            expect(projectManager.initialiceProject).toHaveBeenCalled();
        });

        it('loads content translations after loading properties', async () => {
            projectManager.offlineInstallation = true;

            await projectManager.openLoad();

            expect(mockApp.locale.loadContentTranslationsStrings).toHaveBeenCalledWith('en');
        });

        it('loads content translations with correct language', async () => {
            projectManager.offlineInstallation = true;
            projectManager.properties.properties.pp_lang.value = 'fr';

            await projectManager.openLoad();

            expect(mockApp.locale.loadContentTranslationsStrings).toHaveBeenCalledWith('fr');
        });
    });

    describe('updateUserPage', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="template-page" style="overflow: auto;"></div>
                <div id="node-content-container"></div>
            `;
            projectManager.loadStructureData = vi.fn().mockResolvedValue();
            projectManager.loadModalsContent = vi.fn().mockResolvedValue();
            projectManager.initialiceProject = vi.fn().mockResolvedValue();
            projectManager.structure = {
                reloadStructureMenu: vi.fn().mockResolvedValue(),
            };
        });

        it('preserves scroll position when template-page exists', async () => {
            const templatePage = document.querySelector('.template-page');
            Object.defineProperty(templatePage, 'scrollTop', { value: 100, writable: true });
            templatePage.scrollTo = vi.fn();

            await projectManager.updateUserPage('page-123', false);

            expect(templatePage.scrollTo).toHaveBeenCalledWith(0, 100);
        });

        it('uses node-content-container when template-page not exists', async () => {
            document.body.innerHTML = '<div id="node-content-container"></div>';
            const container = document.querySelector('#node-content-container');
            Object.defineProperty(container, 'scrollTop', { value: 50, writable: true });
            container.scrollTo = vi.fn();

            await projectManager.updateUserPage('page-123', false);

            expect(container.scrollTo).toHaveBeenCalledWith(0, 50);
        });

        it('resets nodeSelected when forceLoad is true', async () => {
            projectManager.updateUserPage('page-123', true);
            // forceLoad sets nodeSelected to null (falsy)
            expect(mockApp.menus.menuStructure.menuStructureBehaviour.nodeSelected).toBeFalsy();
        });
    });

    // ===========================================
    // Grupo 10: Collaborative Editing Methods
    // ===========================================

    describe('collaborativePageLock', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="idevices-bottom">
                    <div class="idevice_item"></div>
                    <div class="idevice_category"></div>
                </div>
                <div id="list_menu_idevices"></div>
                <div page-id="page-123">
                    <button>
                        <span class="node-text-span">Page Title</span>
                        <span class="node-menu-button"></span>
                    </button>
                    <div class="nav-element-text">
                        <span class="node-text-span">Page Title</span>
                        <span class="node-menu-button"></span>
                    </div>
                    <div class="drag-over-border"></div>
                </div>
            `;
            // Create a real DOM element for cloneNode to return
            const gravatarClone = document.createElement('div');
            gravatarClone.innerHTML = '<span class="exe-gravatar" width="30px"></span>';

            // The code uses eXeLearning.app.interface.concurrentUsers
            const mockConcurrentUsers = {
                getConcurrentUsersElementsList: vi.fn().mockReturnValue([
                    {
                        dataset: { username: 'user@test.com' },
                        classList: { add: vi.fn() },
                        querySelector: vi.fn().mockReturnValue({ remove: vi.fn() }),
                        cloneNode: vi.fn().mockReturnValue(gravatarClone),
                    },
                ]),
            };
            mockApp.interface.concurrentUsers = mockConcurrentUsers;
            window.eXeLearning.app.interface = {
                concurrentUsers: mockConcurrentUsers,
            };
            projectManager.clearUserLocks = vi.fn();
            projectManager.lockPageContent = vi.fn();
        });

        it('clears user locks first', () => {
            projectManager.collaborativePageLock('user@test.com', 'page-123', 'page');
            expect(projectManager.clearUserLocks).toHaveBeenCalledWith('user@test.com');
        });

        it('returns early when page element not found', () => {
            projectManager.collaborativePageLock('user@test.com', 'non-existent', 'page');
            // Should not throw
        });

        it('disables buttons when mode is page', () => {
            projectManager.collaborativePageLock('user@test.com', 'page-123', 'page');
            const button = document.querySelector('[page-id="page-123"] button');
            expect(button.disabled).toBe(true);
        });

        it('calls lockPageContent when mode is page', () => {
            projectManager.collaborativePageLock('user@test.com', 'page-123', 'page', Date.now());
            expect(projectManager.lockPageContent).toHaveBeenCalled();
        });
    });

    describe('handleBlockEditingOverlay', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="test-block">
                    <div class="content"></div>
                </div>
            `;
            projectManager.collaborativePageLock = vi.fn();
            projectManager.clearPageLock = vi.fn();
            projectManager.updateUserPage = vi.fn();
            projectManager.cleanupCurrentIdeviceTimer = vi.fn();
            projectManager.idevices = {
                ideviceActive: { timeIdeviceEditing: Date.now() },
            };
        });

        it('parses message parameters correctly', () => {
            projectManager.handleBlockEditingOverlay(
                'user:other@test.com,pageId:page-123,actionType:EDIT,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.collaborativePageLock).toHaveBeenCalled();
        });

        it('calls clearPageLock on UNDO_IDEVICE action', () => {
            projectManager.handleBlockEditingOverlay(
                'user:other@test.com,pageId:page-123,actionType:UNDO_IDEVICE,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.clearPageLock).toHaveBeenCalledWith('page-123');
        });

        it('calls clearPageLock on SAVE_BLOCK action', () => {
            projectManager.handleBlockEditingOverlay(
                'user:other@test.com,pageId:page-123,actionType:SAVE_BLOCK,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.clearPageLock).toHaveBeenCalledWith('page-123');
        });

        it('returns early when same user', () => {
            projectManager.handleBlockEditingOverlay(
                'user:current@test.com,pageId:page-123,actionType:EDIT,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.collaborativePageLock).not.toHaveBeenCalled();
        });

        it('returns early when no pageId', () => {
            projectManager.handleBlockEditingOverlay(
                'user:other@test.com,actionType:EDIT,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.collaborativePageLock).not.toHaveBeenCalled();
        });

        it('handles collaborative-page-lock action type', () => {
            projectManager.handleBlockEditingOverlay(
                'user:other@test.com,pageId:page-123,actionType:collaborative-page-lock,collaborativeMode:page,blockId:test-block',
                'current@test.com'
            );
            expect(projectManager.collaborativePageLock).toHaveBeenCalledWith(
                'other@test.com',
                'page-123',
                'page'
            );
        });
    });

    describe('unlockResource', () => {
        beforeEach(() => {
            projectManager.odeSession = 'test-session';
            // The code uses this.app.project.structure not projectManager.structure
            const mockStructure = {
                nodeSelected: {
                    getAttribute: vi.fn().mockReturnValue('nav-123'),
                },
            };
            mockApp.project = {
                structure: mockStructure,
            };
            projectManager.structure = mockStructure;
            projectManager.showUnlockSuccess = vi.fn();
            projectManager.showForceUnlockOption = vi.fn();
        });

        it('calls postEditIdevice with correct params', async () => {
            mockApp.api.postEditIdevice = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            projectManager.unlockResource('block-123', 'idevice-123');

            expect(mockApp.api.postEditIdevice).toHaveBeenCalledWith({
                odeSessionId: 'test-session',
                odeNavStructureSyncId: 'nav-123',
                blockId: 'block-123',
                odeIdeviceId: 'idevice-123',
                actionType: 'UNLOCK_RESOURCE',
                odeComponentFlag: false,
                timeIdeviceEditing: null,
            });
        });
    });

    // ===========================================
    // Grupo 11: Platform and Session Methods
    // ===========================================

    describe('loadPlatformProject', () => {
        beforeEach(() => {
            window.eXeLearning.user = { odePlatformId: 'platform-123' };
            window.eXeLearning.config.platformUrlGet = 'http://platform.test';
            // Mock URL params
            Object.defineProperty(window, 'location', {
                value: {
                    search: '?jwt_token=test-token',
                    replace: vi.fn(),
                },
                writable: true,
            });
        });

        it('calls platformIntegrationOpenElp with correct params', async () => {
            mockApp.api.platformIntegrationOpenElp = vi.fn().mockResolvedValue({
                responseMessage: 'FAIL',
            });

            await projectManager.loadPlatformProject('session-123');

            expect(mockApp.api.platformIntegrationOpenElp).toHaveBeenCalledWith({
                odePlatformId: 'platform-123',
                odeSessionId: 'session-123',
                platformUrlGet: 'http://platform.test',
                jwt_token: 'test-token',
            });
        });
    });

    describe('createSession', () => {
        it('reloads project on success', async () => {
            mockApp.api.postCloseSession = vi.fn().mockResolvedValue({
                responseMessage: 'OK',
            });
            // The code uses this.app.project.loadCurrentProject/openLoad
            mockApp.project = {
                loadCurrentProject: vi.fn(),
                openLoad: vi.fn(),
            };

            await projectManager.createSession({ odeSessionId: 'session-123' });

            expect(mockApp.project.loadCurrentProject).toHaveBeenCalled();
            expect(mockApp.project.openLoad).toHaveBeenCalled();
        });
    });

    // ===========================================
    // Grupo 12: Sync Replace Methods
    // ===========================================

    describe('replaceOdeComponent', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view">
                                <div id="old-idevice-123" class="idevice_node"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            window.eXeLearning.app.menus = {
                menuStructure: {
                    menuStructureBehaviour: {
                        nodeSelected: {
                            getAttribute: vi.fn().mockReturnValue('page-123'),
                        },
                    },
                },
            };
            projectManager.idevices = {
                getBlockById: vi.fn().mockReturnValue({
                    blockContent: document.createElement('div'),
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                    order: 0,
                }),
                resetCurrentIdevicesExportView: vi.fn(),
            };
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('removes old component when exists', async () => {
            const newOdeComponentSync = {
                odeIdeviceId: 'old-idevice-123',
                blockId: 'block-123',
            };

            await projectManager.replaceOdeComponent(newOdeComponentSync);

            expect(document.getElementById('old-idevice-123')).toBeNull();
        });

        it('creates new idevice in content', async () => {
            const newOdeComponentSync = {
                odeIdeviceId: 'new-idevice-123',
                blockId: 'block-123',
            };

            await projectManager.replaceOdeComponent(newOdeComponentSync);

            expect(projectManager.idevices.createIdeviceInContent).toHaveBeenCalled();
        });
    });

    describe('replaceOdeBlock', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view">
                                <div id="old-block-123"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            projectManager.idevices = {
                newBlockNode: vi.fn().mockResolvedValue({
                    blockContent: document.createElement('div'),
                    order: 0,
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                }),
            };
        });

        it('removes old block when exists', async () => {
            const newOdeBlockSync = {
                blockId: 'old-block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.replaceOdeBlock(newOdeBlockSync);

            expect(document.getElementById('old-block-123')).toBeNull();
        });

        it('creates new block node', async () => {
            const newOdeBlockSync = {
                blockId: 'new-block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.replaceOdeBlock(newOdeBlockSync);

            expect(projectManager.idevices.newBlockNode).toHaveBeenCalled();
        });

        it('loads idevices in block', async () => {
            const newOdeBlockSync = {
                blockId: 'new-block-123',
                odeComponentsSyncs: [{ id: 'idevice-1' }],
            };

            await projectManager.replaceOdeBlock(newOdeBlockSync);

            expect(projectManager.idevices.createIdeviceInContent).toHaveBeenCalled();
        });
    });

    describe('replaceOdePage', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="exe-title"><span class="exe-title content"></span></div>
            `;
            // The code uses this.app.project.properties, not projectManager.properties
            const mockProperties = {
                properties: { pp_title: { value: 'Test Title' } },
                loadPropertiesFromYjs: vi.fn(),
                formProperties: { reloadValues: vi.fn() },
            };
            mockApp.project = {
                properties: mockProperties,
            };
            projectManager.properties = mockProperties;
            projectManager.structure = { data: [] };
            projectManager.idevices = { setNodeContentPageTitle: vi.fn() };
            mockApp.menus.menuStructure.menuStructureBehaviour = {
                nodeSelected: {
                    getAttribute: vi.fn().mockReturnValue('nav-123'),
                },
            };
            mockApp.menus.menuStructure.menuStructureCompose = {
                structureEngine: {
                    cloneNodeNav: vi.fn().mockResolvedValue(),
                    resetDataAndStructureData: vi.fn().mockResolvedValue(),
                },
            };
        });

        it('synchronizes properties from Yjs', async () => {
            // Pass a page object that triggers the else branch (page exists but doesn't match)
            const pageSync = { id: 'page-123', pageId: 'page-123', odeNavStructureSyncProperties: {} };
            await projectManager.replaceOdePage(pageSync);

            expect(mockApp.project.properties.loadPropertiesFromYjs).toHaveBeenCalled();
        });

        it('updates title in menu head', async () => {
            const pageSync = { id: 'page-123', pageId: 'page-123', odeNavStructureSyncProperties: {} };
            await projectManager.replaceOdePage(pageSync);

            const titleElement = document.querySelector('#exe-title > .exe-title.content');
            expect(titleElement.innerHTML).toBe('Test Title');
        });
    });

    // ===========================================
    // Grupo 13: Add/Move/Delete Methods
    // ===========================================

    describe('addOdeComponent', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view"></div>
                        </div>
                    </div>
                </div>
            `;
            projectManager.idevices = {
                getBlockById: vi.fn().mockReturnValue({
                    blockContent: document.createElement('div'),
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                    order: 0,
                }),
            };
        });

        it('creates idevice in block content', async () => {
            const newOdeComponentSync = {
                blockId: 'block-123',
                odeIdeviceId: 'idevice-123',
            };

            await projectManager.addOdeComponent(newOdeComponentSync);

            expect(projectManager.idevices.createIdeviceInContent).toHaveBeenCalled();
        });

        it('sets mode to export', async () => {
            const newOdeComponentSync = {
                blockId: 'block-123',
                odeIdeviceId: 'idevice-123',
            };

            await projectManager.addOdeComponent(newOdeComponentSync);

            expect(newOdeComponentSync.mode).toBe('export');
        });
    });

    describe('addOdeBlock', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // The code uses `.nav-element .selected` - a selected element inside nav-element
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view">
                                <div class="nav-element">
                                    <div class="selected" nav-id="nav-123"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            window.eXeLearning.app.menus = {
                menuStructure: {
                    menuStructureBehaviour: {
                        nodeSelected: {
                            getAttribute: vi.fn().mockReturnValue('page-123'),
                        },
                    },
                },
            };
            projectManager.idevices = {
                newBlockNode: vi.fn().mockResolvedValue({
                    blockContent: document.createElement('div'),
                    order: 0,
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                }),
                resetCurrentIdevicesExportView: vi.fn(),
            };
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('creates new block node', async () => {
            const newOdeBlockSync = {
                blockId: 'block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.addOdeBlock(newOdeBlockSync);

            expect(projectManager.idevices.newBlockNode).toHaveBeenCalled();
        });

        it('sets mode to export', async () => {
            const newOdeBlockSync = {
                blockId: 'block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.addOdeBlock(newOdeBlockSync);

            expect(newOdeBlockSync.mode).toBe('export');
        });
    });

    describe('addOdePage', () => {
        beforeEach(() => {
            // The code uses eXeLearning.app.menus, not mockApp.menus directly
            const menuStructureCompose = {
                structureEngine: {
                    cloneNodeNav: vi.fn().mockResolvedValue(),
                    resetStructureData: vi.fn().mockResolvedValue(),
                },
            };
            const menuStructureBehaviour = {
                nodeSelected: {
                    getAttribute: vi.fn().mockReturnValue('nav-123'),
                },
                menuNavList: {
                    getElementsByClassName: vi.fn().mockReturnValue([]),
                },
            };
            mockApp.menus.menuStructure = {
                menuStructureCompose,
                menuStructureBehaviour,
            };
            // Also set on eXeLearning.app
            window.eXeLearning.app.menus = {
                menuStructure: {
                    menuStructureCompose,
                    menuStructureBehaviour,
                },
            };
        });

        it('clones nav node', async () => {
            const newOdePageSync = { id: 'page-123' };

            await projectManager.addOdePage(newOdePageSync);

            expect(mockApp.menus.menuStructure.menuStructureCompose.structureEngine.cloneNodeNav).toHaveBeenCalledWith(newOdePageSync);
        });

        it('resets structure data', async () => {
            const newOdePageSync = { id: 'page-123' };

            await projectManager.addOdePage(newOdePageSync);

            expect(mockApp.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData).toHaveBeenCalled();
        });
    });

    describe('deleteOdePage', () => {
        beforeEach(() => {
            projectManager.structure = { data: [{ pageId: 'page-123' }, { pageId: 'page-456' }] };
            mockApp.menus.menuStructure.menuStructureCompose = {
                structureEngine: {
                    resetStructureData: vi.fn().mockResolvedValue(),
                },
            };
            mockApp.menus.menuStructure.menuStructureBehaviour = {
                nodeSelected: {
                    getAttribute: vi.fn()
                        .mockReturnValueOnce('nav-123')
                        .mockReturnValueOnce('page-456'),
                },
            };
        });

        it('removes page from structure data', async () => {
            await projectManager.deleteOdePage('page-123');

            expect(projectManager.structure.data.length).toBe(1);
            expect(projectManager.structure.data[0].pageId).toBe('page-456');
        });
    });

    describe('moveOdeBlock', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="idevice-element-in-content" block-id="block-123"></div>
            `;
            projectManager.deleteOdeBlock = vi.fn();
            projectManager.addOdeBlock = vi.fn();
        });

        it('deletes block when found in page', async () => {
            const OdeBlockSync = { blockId: 'block-123' };

            await projectManager.moveOdeBlock(OdeBlockSync);

            expect(projectManager.deleteOdeBlock).toHaveBeenCalledWith('block-123');
        });

        it('adds block when not found in page', async () => {
            const OdeBlockSync = { blockId: 'block-999', id: 'block-999' };

            await projectManager.moveOdeBlock(OdeBlockSync);

            expect(projectManager.addOdeBlock).toHaveBeenCalled();
        });
    });

    describe('moveOdeComponent', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="idevice_node">
                    <div class="idevice-element-in-content" idevice-id="idevice-123"></div>
                </div>
            `;
            projectManager.deleteOdeComponent = vi.fn();
            projectManager.deleteOdeBlock = vi.fn();
            projectManager.replaceOdeComponent = vi.fn();
        });

        it('deletes component when found', async () => {
            const odeComponentSync = { odeIdeviceId: 'idevice-123' };

            await projectManager.moveOdeComponent(odeComponentSync);

            expect(projectManager.deleteOdeComponent).toHaveBeenCalledWith('idevice-123');
        });

        it('replaces component when not found', async () => {
            const odeComponentSync = { odeIdeviceId: 'idevice-999' };

            await projectManager.moveOdeComponent(odeComponentSync);

            expect(projectManager.replaceOdeComponent).toHaveBeenCalled();
        });

        it('deletes previous block when isUndoMoveTo', async () => {
            const odeComponentSync = {
                odeIdeviceId: 'idevice-123',
                previousBlockId: 'prev-block-123',
            };

            await projectManager.moveOdeComponent(odeComponentSync, true);

            expect(projectManager.deleteOdeBlock).toHaveBeenCalledWith('prev-block-123');
        });
    });

    // ===========================================
    // Grupo 14: Move on Same Page Methods
    // ===========================================

    describe('moveOdeBlockOnSamePage', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view">
                                <div id="old-block-123"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            projectManager.idevices = {
                newBlockNode: vi.fn().mockResolvedValue({
                    blockContent: document.createElement('div'),
                    order: 0,
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                }),
            };
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('removes old block', async () => {
            const odeBlockSync = {
                blockId: 'old-block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.moveOdeBlockOnSamePage(odeBlockSync);

            expect(document.getElementById('old-block-123')).toBeNull();
        });

        it('creates new block node', async () => {
            const odeBlockSync = {
                blockId: 'block-123',
                odeComponentsSyncs: [],
            };

            await projectManager.moveOdeBlockOnSamePage(odeBlockSync);

            expect(projectManager.idevices.newBlockNode).toHaveBeenCalled();
        });

        it('creates iDevices sequentially with for...of (not parallel)', async () => {
            const creationOrder = [];
            projectManager.idevices.createIdeviceInContent = vi.fn().mockImplementation(async (idevice) => {
                // Simulate async work with small delay
                await new Promise(r => setTimeout(r, 10));
                creationOrder.push(idevice.odeIdeviceTypeName);
                return { ideviceContent: document.createElement('div') };
            });

            const odeBlockSync = {
                blockId: 'block-123',
                odeComponentsSyncs: [
                    { htmlView: '<div>1</div>', odeIdeviceTypeName: 'first' },
                    { htmlView: '<div>2</div>', odeIdeviceTypeName: 'second' },
                    { htmlView: '<div>3</div>', odeIdeviceTypeName: 'third' },
                ],
            };

            // Trigger the interval callback
            await projectManager.moveOdeBlockOnSamePage(odeBlockSync);
            await vi.advanceTimersByTimeAsync(projectManager.syncIntervalTime + 50);

            // Sequential: must be in order
            expect(creationOrder).toEqual(['first', 'second', 'third']);
        });

        it('skips iDevices with null htmlView', async () => {
            const creationOrder = [];
            projectManager.idevices.createIdeviceInContent = vi.fn().mockImplementation(async (idevice) => {
                creationOrder.push(idevice.odeIdeviceTypeName);
                return { ideviceContent: document.createElement('div') };
            });

            const odeBlockSync = {
                blockId: 'block-123',
                odeComponentsSyncs: [
                    { htmlView: '<div>1</div>', odeIdeviceTypeName: 'first' },
                    { htmlView: null, odeIdeviceTypeName: 'empty' },
                    { htmlView: '<div>3</div>', odeIdeviceTypeName: 'third' },
                ],
            };

            await projectManager.moveOdeBlockOnSamePage(odeBlockSync);
            await vi.advanceTimersByTimeAsync(projectManager.syncIntervalTime + 50);

            // Empty idevice should be skipped
            expect(creationOrder).toEqual(['first', 'third']);
        });
    });

    describe('moveOdeComponentOnSamePage', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="main">
                    <div id="workarea">
                        <div id="node-content-container">
                            <div id="node-content" mode="view">
                                <div id="old-idevice-123"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            projectManager.idevices = {
                getBlockById: vi.fn().mockReturnValue({
                    blockContent: document.createElement('div'),
                }),
                createIdeviceInContent: vi.fn().mockResolvedValue({
                    ideviceContent: document.createElement('div'),
                    order: 0,
                }),
                newBlockNode: vi.fn().mockResolvedValue({
                    blockContent: document.createElement('div'),
                    order: 0,
                }),
            };
            mockApp.api.postObtainOdeBlockSync = vi.fn().mockResolvedValue({});
        });

        it('removes old idevice', async () => {
            const odeIdeviceSync = {
                odeIdeviceId: 'old-idevice-123',
                blockId: 'block-123',
            };

            await projectManager.moveOdeComponentOnSamePage(odeIdeviceSync);

            expect(document.getElementById('old-idevice-123')).toBeNull();
        });

        it('creates idevice in block content', async () => {
            const odeIdeviceSync = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-123',
            };

            await projectManager.moveOdeComponentOnSamePage(odeIdeviceSync);

            expect(projectManager.idevices.createIdeviceInContent).toHaveBeenCalled();
        });

        it('creates new block when block not found', async () => {
            projectManager.idevices.getBlockById = vi.fn().mockReturnValue(null);
            const odeIdeviceSync = {
                odeIdeviceId: 'idevice-123',
                blockId: 'new-block-123',
            };

            await projectManager.moveOdeComponentOnSamePage(odeIdeviceSync);

            expect(mockApp.api.postObtainOdeBlockSync).toHaveBeenCalled();
        });
    });

    // ===========================================
    // Grupo 15: User Flag and Order Map Methods
    // ===========================================

    describe('changeUserFlagOnEdit', () => {
        beforeEach(() => {
            projectManager.odeSession = 'test-session';
            projectManager.offlineInstallation = true;
            mockApp.api.postEditIdevice = vi.fn().mockResolvedValue({});
        });

        it('calls postEditIdevice with correct params', async () => {
            await projectManager.changeUserFlagOnEdit(
                true,
                'nav-123',
                'block-123',
                'idevice-123',
                false,
                Date.now(),
                'EDIT',
                'page-123'
            );

            expect(mockApp.api.postEditIdevice).toHaveBeenCalledWith({
                odeSessionId: 'test-session',
                odeIdeviceId: 'idevice-123',
                blockId: 'block-123',
                odeNavStructureSyncId: 'nav-123',
                odeComponentFlag: true,
                timeIdeviceEditing: expect.any(Number),
                actionType: 'EDIT',
                pageId: 'page-123',
            });
        });
    });

    describe('updateOrderNavMap', () => {
        beforeEach(() => {
            mockApp.menus.menuStructure.menuStructureBehaviour = {
                nodeSelected: {
                    getAttribute: vi.fn().mockReturnValue('nav-123'),
                },
            };
            mockApp.menus.menuStructure.menuStructureCompose = {
                structureEngine: {
                    resetDataAndStructureData: vi.fn(),
                },
            };
            // The code uses eXeLearning.app.user.preferences, not mockApp.user
            window.eXeLearning.app.user = {
                preferences: {
                    preferences: {
                        theme: { value: 'base' },
                    },
                },
            };
            mockApp.modals.confirm = { show: vi.fn() };
        });

        it('resets data and structure', async () => {
            await projectManager.updateOrderNavMap({ styleThemeValueId: 'base' });

            expect(mockApp.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData).toHaveBeenCalledWith('nav-123');
        });

        it('shows confirm dialog when theme changed', async () => {
            await projectManager.updateOrderNavMap({ styleThemeValueId: 'new-theme' });

            expect(mockApp.modals.confirm.show).toHaveBeenCalled();
        });

        it('does not show dialog when same theme', async () => {
            await projectManager.updateOrderNavMap({ styleThemeValueId: 'base' });

            expect(mockApp.modals.confirm.show).not.toHaveBeenCalled();
        });
    });

    // ===========================================
    // Grupo 16: Refresh After Import
    // ===========================================

    describe('refreshAfterDirectImport', () => {
        beforeEach(() => {
            window.eXeLearning.app.modals = {
                openuserodefiles: { close: vi.fn() },
                alert: { show: vi.fn() },
            };
            projectManager.structure = {
                isYjsEnabled: vi.fn().mockReturnValue(true),
                getStructureFromYjs: vi.fn().mockReturnValue([]),
                processStructureData: vi.fn(),
                reloadStructureMenu: vi.fn().mockResolvedValue(),
            };
            projectManager.properties = {
                loadPropertiesFromYjs: vi.fn(),
            };
            projectManager.initialiceProject = vi.fn().mockResolvedValue();
            projectManager.showScreen = vi.fn();
            mockApp.interface.odeTitleElement = { setTitle: vi.fn() };
        });

        it('closes openuserodefiles modal', async () => {
            await projectManager.refreshAfterDirectImport();

            expect(window.eXeLearning.app.modals.openuserodefiles.close).toHaveBeenCalled();
        });

        it('reloads structure from Yjs', async () => {
            await projectManager.refreshAfterDirectImport();

            expect(projectManager.structure.getStructureFromYjs).toHaveBeenCalled();
            expect(projectManager.structure.processStructureData).toHaveBeenCalled();
        });

        it('sets title when odeTitleElement available', async () => {
            await projectManager.refreshAfterDirectImport();

            expect(mockApp.interface.odeTitleElement.setTitle).toHaveBeenCalled();
        });

        it('calls initialiceProject and showScreen', async () => {
            await projectManager.refreshAfterDirectImport();

            expect(projectManager.initialiceProject).toHaveBeenCalled();
            expect(projectManager.showScreen).toHaveBeenCalled();
        });

        it('reinitializes theme binding when themes manager exists', async () => {
            mockApp.themes = { initYjsBinding: vi.fn() };

            await projectManager.refreshAfterDirectImport();

            expect(mockApp.themes.initYjsBinding).toHaveBeenCalled();
        });

        it('does not fail when themes manager is not available', async () => {
            mockApp.themes = null;

            await expect(projectManager.refreshAfterDirectImport()).resolves.not.toThrow();
        });
    });
});
