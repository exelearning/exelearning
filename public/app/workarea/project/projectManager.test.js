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

describe('projectManager helper methods', () => {
    let projectManager;
    let mockApp;

    beforeEach(() => {
        document.body.innerHTML =
            '<button id="head-top-download-button">Download</button>';
        window._ = (value) => value;
        window.eXeLearning = {
            config: {
                isOfflineInstallation: false,
                clientIntervalUpdate: 5000,
            },
        };
        mockApp = {
            interface: {
                loadingScreen: {
                    hide: vi.fn(),
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
            },
        };
        projectManager = new ProjectManager(mockApp);
    });

    afterEach(() => {
        vi.useRealTimers();
        delete window._;
        delete window.__currentProjectId;
        delete window.eXeLearning;
    });

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
