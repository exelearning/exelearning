import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModalStyleManager from './modalStyleManager.js';

describe('ModalStyleManager', () => {
    let modal;
    let mockManager;
    let mockElement;
    let mockBootstrapModal;
    let mockThemes;

    beforeEach(() => {
        // Mock translation function
        window._ = vi.fn((key) => key);

        // Mock eXeLearning global
        window.eXeLearning = {
            app: {
                project: {
                    odeSession: 'test-session-123',
                },
                api: {
                    parameters: {
                        canInstallThemes: true,
                        themeInfoFieldsConfig: {
                            title: { title: 'Title', tag: 'text' },
                            author: { title: 'Author', tag: 'text' },
                            description: { title: 'Description', tag: 'textarea' },
                        },
                        themeEditionFieldsConfig: {
                            title: {
                                title: 'Title',
                                tag: 'text',
                                config: 'title',
                                category: 'General',
                            },
                            author: {
                                title: 'Author',
                                tag: 'text',
                                config: 'author',
                                category: 'General',
                            },
                            description: {
                                title: 'Description',
                                tag: 'textarea',
                                config: 'description',
                                category: 'General',
                            },
                            primaryColor: {
                                title: 'Primary Color',
                                tag: 'color',
                                config: 'primaryColor',
                                category: 'Colors',
                            },
                            logo: {
                                title: 'Logo',
                                tag: 'img',
                                config: 'logo',
                                category: 'Images',
                            },
                        },
                    },
                    postUploadTheme: vi.fn().mockResolvedValue({ responseMessage: 'ERROR' }),
                    postNewTheme: vi.fn(),
                    putEditTheme: vi.fn(),
                    deleteTheme: vi.fn(),
                    getThemeZip: vi.fn(),
                },
                themes: {
                    selected: { id: 'theme-base-1' },
                },
                menus: {
                    menuStructure: {
                        menuStructureBehaviour: {
                            nodeSelected: {
                                getAttribute: vi.fn(() => 'page-123'),
                            },
                        },
                    },
                },
                modals: {
                    confirm: {
                        show: vi.fn(),
                    },
                },
            },
            config: {
                basePath: '/base',
                themeTypeBase: 'base',
                themeTypeUser: 'user',
                isOfflineInstallation: false,
                userStyles: true,
            },
        };

        // Mock DOM
        mockElement = document.createElement('div');
        mockElement.id = 'modalStyleManager';
        mockElement.innerHTML = `
            <div class="modal-header">
                <h5 class="modal-title"></h5>
            </div>
            <div class="modal-body">
                <div class="modal-body-content"></div>
                <div class="alert alert-danger">
                    <span class="text"></span>
                    <button class="close-alert"></button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary">Confirm</button>
                <button class="close btn btn-secondary">Cancel</button>
            </div>
        `;
        document.body.appendChild(mockElement);

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'modalStyleManager') return mockElement;
            return null;
        });

        // Mock bootstrap.Modal
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

        // Mock interact
        const mockInteractable = {
            draggable: vi.fn().mockReturnThis(),
        };
        window.interact = vi.fn().mockImplementation(() => mockInteractable);
        window.interact.modifiers = {
            restrictRect: vi.fn(),
        };

        // Mock themes
        mockThemes = {
            installed: {
                'theme-base-1': {
                    id: 'theme-base-1',
                    title: 'Base Theme 1',
                    type: 'base',
                    dirName: 'base-theme-1',
                    downloadable: true,
                    author: 'Test Author',
                    description: 'Test Description',
                },
                'theme-base-2': {
                    id: 'theme-base-2',
                    title: 'Base Theme 2',
                    type: 'base',
                    dirName: 'base-theme-2',
                    downloadable: true,
                },
                'theme-user-1': {
                    id: 'theme-user-1',
                    title: 'User Theme 1',
                    type: 'user',
                    dirName: 'user-theme-1',
                    downloadable: true,
                },
            },
            manager: {
                selected: { id: 'theme-base-1' },
                selectTheme: vi.fn().mockResolvedValue(true),
            },
            loadTheme: vi.fn(),
            loadThemes: vi.fn(),
            orderThemesInstalled: vi.fn(),
            removeTheme: vi.fn(),
            newTheme: vi.fn((data) => ({
                id: null,
                title: data.title,
                type: 'user',
            })),
        };

        mockManager = {
            closeModals: vi.fn(() => false),
        };

        modal = new ModalStyleManager(mockManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct ID', () => {
            expect(modal.id).toBe('modalStyleManager');
        });

        it('should initialize DOM element references', () => {
            expect(modal.modalElementBodyContent).toBe(
                mockElement.querySelector('.modal-body-content')
            );
            expect(modal.modalFooter).toBe(mockElement.querySelector('.modal-footer'));
            expect(modal.confirmButton).toBe(
                mockElement.querySelector('button.btn.btn-primary')
            );
            expect(modal.cancelButton).toBe(
                mockElement.querySelector('button.close.btn.btn-secondary')
            );
            expect(modal.modalElementAlert).toBe(
                mockElement.querySelector('.alert.alert-danger')
            );
            expect(modal.modalElementAlertText).toBe(mockElement.querySelector('.text'));
            expect(modal.modalElementAlertCloseButton).toBe(
                mockElement.querySelector('.close-alert')
            );
        });

        it('should initialize readers array', () => {
            expect(modal.readers).toEqual([]);
        });
    });

    describe('show', () => {
        it('should display the modal with themes', () => {
            vi.useFakeTimers();
            modal.show(mockThemes);
            vi.advanceTimersByTime(500);

            expect(modal.themes).toBe(mockThemes);
            expect(modal.themeSelectedPrevId).toBe('theme-base-1');
            expect(modal.themeSelectedId).toBe('theme-base-1');
            expect(modal.themeEdition).toBe(false);
            expect(mockBootstrapModal.show).toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('should separate base and user themes', () => {
            vi.useFakeTimers();
            modal.show(mockThemes);
            vi.advanceTimersByTime(500);

            expect(modal.themesBase).toEqual({
                'theme-base-1': mockThemes.installed['theme-base-1'],
                'theme-base-2': mockThemes.installed['theme-base-2'],
            });
            expect(modal.themesUser).toEqual({
                'theme-user-1': mockThemes.installed['theme-user-1'],
            });

            vi.useRealTimers();
        });

        it('should hide alert on show', () => {
            vi.useFakeTimers();
            modal.modalElementAlert.classList.add('show');
            modal.show(mockThemes);
            vi.advanceTimersByTime(500);

            expect(modal.modalElementAlert.classList.contains('show')).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('confirmExecEvent', () => {
        it('should save theme selection when not editing', async () => {
            modal.themes = mockThemes;
            modal.themeEdition = false;
            modal.themeSelectedId = 'theme-base-2';

            await modal.confirmExecEvent();

            expect(mockThemes.manager.selectTheme).toHaveBeenCalledWith(
                'theme-base-2',
                true
            );
        });

        it('should create new theme when editing without ID', async () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.themeEdition = { id: null, title: 'New Theme' };
            modal.modalElementBodyContent.innerHTML = `
                <input class="theme-edit-value-field" field="title" value="New Theme">
                <textarea class="theme-edit-value-field" field="description">Description</textarea>
            `;

            const newThemeSpy = vi.spyOn(modal, 'newTheme').mockResolvedValue(true);
            const backEventSpy = vi.spyOn(modal, 'backExecEvent').mockImplementation(() => {});

            await modal.confirmExecEvent();

            expect(newThemeSpy).toHaveBeenCalled();
            expect(backEventSpy).toHaveBeenCalled();
        });

        it('should edit existing theme when editing with ID', async () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.themeEdition = {
                id: 'theme-user-1',
                dirName: 'user-theme-1',
                title: 'User Theme 1',
            };
            modal.themeSelectedId = 'theme-user-1';
            modal.modalElementBodyContent.innerHTML = `
                <input class="theme-edit-value-field" field="title" value="Updated Theme">
            `;

            const editThemeSpy = vi.spyOn(modal, 'editTheme').mockResolvedValue(true);
            const backEventSpy = vi.spyOn(modal, 'backExecEvent').mockImplementation(() => {});

            await modal.confirmExecEvent();

            expect(editThemeSpy).toHaveBeenCalledWith('user-theme-1', expect.any(Object));
            expect(backEventSpy).toHaveBeenCalled();
        });

        it('should reload theme if editing the selected theme', async () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.themeEdition = {
                id: 'theme-base-1',
                dirName: 'base-theme-1',
            };
            modal.themeSelectedId = 'theme-base-1';
            modal.modalElementBodyContent.innerHTML = `
                <input class="theme-edit-value-field" field="title" value="Updated">
            `;

            vi.spyOn(modal, 'editTheme').mockResolvedValue(true);
            vi.spyOn(modal, 'backExecEvent').mockImplementation(() => {});

            await modal.confirmExecEvent();

            expect(mockThemes.manager.selectTheme).toHaveBeenCalledWith(
                'theme-base-1',
                true,
                true
            );
        });
    });

    describe('getFormEditThemeValues', () => {
        it('should extract form field values', () => {
            modal.modalElementBodyContent.innerHTML = `
                <input class="theme-edit-value-field" field="title" value="Test Title">
                <textarea class="theme-edit-value-field" field="description">Test Description</textarea>
                <input class="theme-edit-value-field" field="color" type="color" value="#ff0000">
            `;

            const values = modal.getFormEditThemeValues();

            expect(values.data.title).toBe('Test Title');
            expect(values.data.description).toBe('Test Description');
            expect(values.data.color).toBe('#ff0000');
        });

        it('should handle fields without value attribute', () => {
            modal.modalElementBodyContent.innerHTML = `
                <div class="theme-edit-value-field" field="custom" value="custom-value"></div>
            `;

            const values = modal.getFormEditThemeValues();

            expect(values.data.custom).toBe('custom-value');
        });
    });

    describe('button visibility methods', () => {
        it('setConfirmButtonText should set button text', () => {
            modal.setConfirmButtonText('Save Changes');
            expect(modal.confirmButton.innerHTML).toBe('Save Changes');
        });

        it('hideConfirmButtonText should hide confirm button', () => {
            modal.hideConfirmButtonText();
            expect(modal.confirmButton.style.display).toBe('none');
        });

        it('showConfirmButtonText should show confirm button', () => {
            modal.showConfirmButtonText();
            expect(modal.confirmButton.style.display).toBe('flex');
        });

        it('setCancelButtonText should set button text', () => {
            modal.setCancelButtonText('Close');
            expect(modal.cancelButton.innerHTML).toBe('Close');
        });

        it('hideCancelButtonText should hide cancel button', () => {
            modal.hideCancelButtonText();
            expect(modal.cancelButton.style.display).toBe('none');
        });

        it('showCancelButtonText should show cancel button', () => {
            modal.showCancelButtonText();
            expect(modal.cancelButton.style.display).toBe('flex');
        });
    });

    describe('generateButtonBack and removeButtonBack', () => {
        it('should generate back button with correct attributes', () => {
            const button = modal.generateButtonBack();

            expect(button.classList.contains('back')).toBe(true);
            expect(button.classList.contains('btn')).toBe(true);
            expect(button.classList.contains('btn-secondary')).toBe(true);
            expect(button.getAttribute('type')).toBe('button');
            expect(button.innerHTML).toBe('Back');
        });

        it('should add back button to modal footer', () => {
            modal.generateButtonBack();

            expect(modal.modalFooter.querySelector('.back')).not.toBeNull();
        });

        it('should trigger backExecEvent on click', () => {
            const backEventSpy = vi.spyOn(modal, 'backExecEvent').mockImplementation(() => {});
            const button = modal.generateButtonBack();

            button.click();

            expect(backEventSpy).toHaveBeenCalled();
        });

        it('removeButtonBack should remove the button if it exists', () => {
            modal.generateButtonBack();
            expect(modal.buttonBack).toBeDefined();

            modal.removeButtonBack();

            expect(modal.modalFooter.querySelector('.back')).toBeNull();
        });

        it('removeButtonBack should not throw if button does not exist', () => {
            expect(() => modal.removeButtonBack()).not.toThrow();
        });
    });

    describe('backExecEvent', () => {
        it('should reset themeEdition flag', () => {
            modal.themes = mockThemes;
            modal.themeEdition = { id: 'test' };

            vi.spyOn(modal, 'setBodyElement').mockImplementation(() => {});
            vi.spyOn(modal, 'makeBodyElement').mockReturnValue(document.createElement('div'));
            vi.spyOn(modal, 'addBehaviourExeTabs').mockImplementation(() => {});
            vi.spyOn(modal, 'clickSelectedTab').mockImplementation(() => {});
            vi.spyOn(modal, 'showButtonsConfirmCancel').mockImplementation(() => {});

            modal.backExecEvent();

            expect(modal.themeEdition).toBe(false);
        });

        it('should call necessary methods to restore modal', () => {
            modal.themes = mockThemes;

            const setBodySpy = vi.spyOn(modal, 'setBodyElement').mockImplementation(() => {});
            const makeBodySpy = vi
                .spyOn(modal, 'makeBodyElement')
                .mockReturnValue(document.createElement('div'));
            const addBehaviourSpy = vi
                .spyOn(modal, 'addBehaviourExeTabs')
                .mockImplementation(() => {});
            const clickTabSpy = vi.spyOn(modal, 'clickSelectedTab').mockImplementation(() => {});
            const showButtonsSpy = vi
                .spyOn(modal, 'showButtonsConfirmCancel')
                .mockImplementation(() => {});

            modal.backExecEvent();

            expect(makeBodySpy).toHaveBeenCalled();
            expect(setBodySpy).toHaveBeenCalled();
            expect(addBehaviourSpy).toHaveBeenCalled();
            expect(clickTabSpy).toHaveBeenCalled();
            expect(showButtonsSpy).toHaveBeenCalled();
        });
    });

    describe('getBaseThemes', () => {
        it('should return only base themes', () => {
            const baseThemes = modal.getBaseThemes(mockThemes.installed);

            expect(Object.keys(baseThemes)).toHaveLength(2);
            expect(baseThemes['theme-base-1']).toBeDefined();
            expect(baseThemes['theme-base-2']).toBeDefined();
            expect(baseThemes['theme-user-1']).toBeUndefined();
        });
    });

    describe('getUserThemes', () => {
        it('should return only user themes', () => {
            const userThemes = modal.getUserThemes(mockThemes.installed);

            expect(Object.keys(userThemes)).toHaveLength(1);
            expect(userThemes['theme-user-1']).toBeDefined();
            expect(userThemes['theme-base-1']).toBeUndefined();
        });
    });

    describe('makeBodyElement', () => {
        it('should create body container with correct class', () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.paramInstallThemes = true;

            const body = modal.makeBodyElement();

            expect(body.classList.contains('body-themes-container')).toBe(true);
        });

        it('should include button container', () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.paramInstallThemes = true;

            const body = modal.makeBodyElement();
            const buttonContainer = body.querySelector('.themes-button-container');

            expect(buttonContainer).not.toBeNull();
        });

        it('should include themes list container', () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.paramInstallThemes = true;

            const body = modal.makeBodyElement();
            const listContainer = body.querySelector('.themes-list-container');

            expect(listContainer).not.toBeNull();
        });

        it('should create tabs when user themes exist', () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = modal.getUserThemes(mockThemes.installed);
            modal.paramInstallThemes = true;

            const body = modal.makeBodyElement();
            const tabs = body.querySelector('.exe-form-tabs');

            expect(tabs).not.toBeNull();
        });

        it('should not create tabs when only base themes exist', () => {
            modal.themes = mockThemes;
            modal.themesBase = modal.getBaseThemes(mockThemes.installed);
            modal.themesUser = {};
            modal.paramInstallThemes = true;

            const body = modal.makeBodyElement();
            const tabs = body.querySelector('.exe-form-tabs');
            const container = body.querySelector('.themes-list-container');

            expect(tabs).toBeNull();
            expect(container.classList.contains('no-tabs')).toBe(true);
        });
    });

    describe('makeElementToButtons', () => {
        it('should create buttons container', () => {
            const buttonsContainer = modal.makeElementToButtons(true);

            expect(buttonsContainer.classList.contains('themes-button-container')).toBe(true);
        });

        it('should include new theme button', () => {
            const buttonsContainer = modal.makeElementToButtons(true);
            const newButton = buttonsContainer.querySelector('.themes-button-new');

            expect(newButton).not.toBeNull();
            expect(newButton.innerHTML).toBe('New style');
        });

        it('should include import button when allowed', () => {
            const buttonsContainer = modal.makeElementToButtons(true);
            const importButton = buttonsContainer.querySelector('.themes-button-import');

            expect(importButton).not.toBeNull();
            expect(importButton.innerHTML).toBe('Import style');
        });

        it('should not include import button when offline and userStyles disabled', () => {
            window.eXeLearning.config.isOfflineInstallation = false;
            window.eXeLearning.config.userStyles = false;

            const buttonsContainer = modal.makeElementToButtons(true);
            const importButton = buttonsContainer.querySelector('.themes-button-import');

            expect(importButton).toBeNull();
        });
    });

    describe('makeElementButtonNewTheme', () => {
        it('should create new theme button with correct attributes', () => {
            const button = modal.makeElementButtonNewTheme();

            expect(button.classList.contains('themes-button-new')).toBe(true);
            expect(button.classList.contains('btn')).toBe(true);
            expect(button.classList.contains('btn-secondary')).toBe(true);
            expect(button.innerHTML).toBe('New style');
        });

        it('should trigger new theme on click', () => {
            modal.themes = mockThemes;
            modal.themeEdition = false;

            const button = modal.makeElementButtonNewTheme();

            const editContainer = document.createElement('div');
            editContainer.innerHTML = '<div class="exe-form-tabs"><li><a></a></li></div><input>';

            vi.spyOn(modal, 'makeElementEditTheme').mockReturnValue(editContainer);
            vi.spyOn(modal, 'addBehaviourExeTabs').mockImplementation(() => {});
            vi.spyOn(modal, 'focusTextInput').mockImplementation(() => {});
            vi.spyOn(modal, 'generateButtonBack').mockImplementation(() => {});
            vi.spyOn(modal, 'hideCancelButtonText').mockImplementation(() => {});

            button.click();

            expect(modal.themeEdition).toBeDefined();
            expect(modal.themeEdition.title).toBe('My new style');
        });
    });

    describe('showAlert', () => {
        it('should display alert with text', () => {
            modal.showAlert('Test error message');

            expect(modal.modalElementAlert.innerHTML).toBe('Test error message');
            expect(modal.modalElementAlert.classList.contains('show')).toBe(true);
        });
    });

    describe('setBodyElement', () => {
        it('should clear and set body content', () => {
            modal.modalElementBodyContent.innerHTML = '<div>Old content</div>';
            const newElement = document.createElement('div');
            newElement.innerHTML = 'New content';

            modal.setBodyElement(newElement);

            expect(modal.modalElementBodyContent.children).toHaveLength(1);
            expect(modal.modalElementBodyContent.children[0]).toBe(newElement);
        });
    });

    describe('addBehaviourButtonCloseAlert', () => {
        it('should hide alert on close button click', () => {
            modal.modalElementAlert.classList.add('show');
            modal.modalElementAlertText.innerHTML = 'Error';

            modal.modalElementAlertCloseButton.click();

            expect(modal.modalElementAlertText.innerHTML).toBe('');
            expect(modal.modalElementAlert.classList.contains('show')).toBe(false);
        });
    });

    describe('selectTheme', () => {
        it('should call theme manager selectTheme', async () => {
            modal.themes = mockThemes;
            modal.modalElementBodyContent.innerHTML = `
                <table class="themes-table">
                    <tr class="theme-row" theme-id="theme-base-1"></tr>
                    <tr class="theme-row" theme-id="theme-base-2"></tr>
                </table>
            `;

            await modal.selectTheme('theme-base-2', true);

            expect(mockThemes.manager.selectTheme).toHaveBeenCalledWith('theme-base-2', true);
            expect(modal.themeSelectedId).toBe('theme-base-2');
        });
    });

    describe('addClassSelectThemeRow', () => {
        it('should add selected class to correct row', () => {
            modal.modalElementBodyContent.innerHTML = `
                <table class="themes-table">
                    <tr class="theme-row" theme-id="theme-base-1"></tr>
                    <tr class="theme-row" theme-id="theme-base-2"></tr>
                </table>
            `;

            modal.addClassSelectThemeRow('theme-base-2');

            const rows = modal.modalElementBody.querySelectorAll('.theme-row');
            expect(rows[0].classList.contains('selected')).toBe(false);
            expect(rows[1].classList.contains('selected')).toBe(true);
        });
    });

    describe('addNewReader', () => {
        it('should create FileReader and add to readers array', () => {
            const mockFile = new File(['content'], 'theme.zip', { type: 'application/zip' });

            vi.spyOn(modal, 'uploadTheme').mockImplementation(() => {});

            modal.addNewReader(mockFile);

            expect(modal.readers).toHaveLength(1);
            expect(modal.readers[0]).toBeInstanceOf(FileReader);
        });
    });

    describe('focusTextInput', () => {
        it('should focus and reset input value', () => {
            const input = document.createElement('input');
            input.value = 'test value';
            document.body.appendChild(input);

            const focusSpy = vi.spyOn(input, 'focus');

            modal.focusTextInput(input);

            expect(focusSpy).toHaveBeenCalled();
            expect(input.value).toBe('test value');

            document.body.removeChild(input);
        });

        it('should handle null input', () => {
            expect(() => modal.focusTextInput(null)).not.toThrow();
        });
    });

    describe('API methods', () => {
        describe('uploadTheme', () => {
            it('should upload theme and reload themes on success', async () => {
                const response = {
                    responseMessage: 'OK',
                    theme: {
                        id: 'new-theme',
                        title: 'New Theme',
                    },
                };

                window.eXeLearning.app.api.postUploadTheme.mockResolvedValue(response);

                modal.themes = mockThemes;
                modal.themesBase = {};
                modal.themesUser = {};

                vi.spyOn(modal, 'makeBodyElement').mockReturnValue(document.createElement('div'));
                vi.spyOn(modal, 'setBodyElement').mockImplementation(() => {});
                vi.spyOn(modal, 'addBehaviourExeTabs').mockImplementation(() => {});

                await modal.uploadTheme('theme.zip', 'base64data');

                expect(window.eXeLearning.app.api.postUploadTheme).toHaveBeenCalledWith({
                    filename: 'theme.zip',
                    file: 'base64data',
                });
                expect(mockThemes.loadTheme).toHaveBeenCalledWith(response.theme);
                expect(mockThemes.orderThemesInstalled).toHaveBeenCalled();
            });

            it('should show alert on upload failure', async () => {
                const response = {
                    responseMessage: 'ERROR',
                    error: 'Invalid theme',
                };

                window.eXeLearning.app.api.postUploadTheme.mockResolvedValue(response);

                modal.themes = mockThemes;

                vi.spyOn(modal, 'showElementAlert').mockImplementation(() => {});

                await modal.uploadTheme('theme.zip', 'base64data');

                expect(modal.showElementAlert).toHaveBeenCalledWith(
                    'Failed to install the new style',
                    response
                );
            });
        });

        describe('newTheme', () => {
            it('should create new theme and reload on success', async () => {
                const response = {
                    responseMessage: 'OK',
                    themes: {
                        themes: {
                            'new-theme': { id: 'new-theme', title: 'New Theme' },
                        },
                    },
                };

                window.eXeLearning.app.api.postNewTheme.mockResolvedValue(response);

                modal.themes = mockThemes;
                modal.themesBase = {};
                modal.themesUser = {};

                vi.spyOn(modal, 'makeBodyElement').mockReturnValue(document.createElement('div'));
                vi.spyOn(modal, 'setBodyElement').mockImplementation(() => {});
                vi.spyOn(modal, 'addBehaviourExeTabs').mockImplementation(() => {});

                vi.useFakeTimers();
                const promise = modal.newTheme({ data: { title: 'New Theme' } });
                await vi.advanceTimersByTimeAsync(1000);
                await promise;

                expect(window.eXeLearning.app.api.postNewTheme).toHaveBeenCalledWith({
                    data: { title: 'New Theme' },
                });
                expect(mockThemes.loadThemes).toHaveBeenCalled();

                vi.useRealTimers();
            });

            it('should show alert on creation failure', async () => {
                const response = {
                    responseMessage: 'ERROR',
                    error: 'Creation failed',
                };

                window.eXeLearning.app.api.postNewTheme.mockResolvedValue(response);

                modal.themes = mockThemes;

                vi.spyOn(modal, 'showElementAlert').mockImplementation(() => {});

                await modal.newTheme({ data: { title: 'New Theme' } });

                expect(modal.showElementAlert).toHaveBeenCalledWith(
                    'Failed to create the style',
                    response
                );
            });
        });

        describe('editTheme', () => {
            it('should edit theme and reload on success', async () => {
                const response = {
                    responseMessage: 'OK',
                    themes: {
                        themes: {
                            'edited-theme': { id: 'edited-theme', title: 'Edited Theme' },
                        },
                    },
                };

                window.eXeLearning.app.api.putEditTheme.mockResolvedValue(response);

                modal.themes = mockThemes;
                modal.themesBase = {};
                modal.themesUser = {};

                vi.spyOn(modal, 'makeBodyElement').mockReturnValue(document.createElement('div'));
                vi.spyOn(modal, 'setBodyElement').mockImplementation(() => {});
                vi.spyOn(modal, 'addBehaviourExeTabs').mockImplementation(() => {});

                vi.useFakeTimers();
                const promise = modal.editTheme('theme-dir', { data: { title: 'Edited' } });
                await vi.advanceTimersByTimeAsync(1000);
                await promise;

                expect(window.eXeLearning.app.api.putEditTheme).toHaveBeenCalledWith(
                    'theme-dir',
                    { data: { title: 'Edited' } }
                );
                expect(mockThemes.loadThemes).toHaveBeenCalled();

                vi.useRealTimers();
            });

            it('should show alert on edit failure', async () => {
                const response = {
                    responseMessage: 'ERROR',
                    error: 'Edit failed',
                };

                window.eXeLearning.app.api.putEditTheme.mockResolvedValue(response);

                modal.themes = mockThemes;

                vi.spyOn(modal, 'showElementAlert').mockImplementation(() => {});

                await modal.editTheme('theme-dir', { data: { title: 'Edited' } });

                expect(modal.showElementAlert).toHaveBeenCalledWith(
                    'Failed to edit the style ',
                    response
                );
            });
        });

        describe('removeTheme', () => {
            it('should remove theme and reload on success', async () => {
                vi.useFakeTimers();

                const response = {
                    responseMessage: 'OK',
                    deleted: {
                        name: 'theme-user-1',
                    },
                };

                window.eXeLearning.app.api.deleteTheme.mockResolvedValue(response);

                modal.themes = mockThemes;

                await modal.removeTheme('theme-user-1');

                expect(window.eXeLearning.app.api.deleteTheme).toHaveBeenCalledWith({
                    id: 'theme-user-1',
                });
                expect(mockThemes.removeTheme).toHaveBeenCalledWith('theme-user-1');

                vi.useRealTimers();
            });

            it('should show alert on removal failure', async () => {
                vi.useFakeTimers();

                const response = {
                    responseMessage: 'ERROR',
                    error: 'Delete failed',
                };

                window.eXeLearning.app.api.deleteTheme.mockResolvedValue(response);

                modal.themes = mockThemes;

                vi.spyOn(modal, 'showElementAlert').mockImplementation(() => {});

                await modal.removeTheme('theme-user-1');

                vi.advanceTimersByTime(500);

                expect(modal.showElementAlert).toHaveBeenCalled();

                vi.useRealTimers();
            });
        });

        describe('downloadThemeZip', () => {
            it('should download theme as zip file', async () => {
                const response = {
                    zipFileName: 'theme.zip',
                    zipBase64: 'base64data',
                };

                window.eXeLearning.app.api.getThemeZip.mockResolvedValue(response);

                const theme = { dirName: 'test-theme' };

                const mockLink = {
                    setAttribute: vi.fn(),
                    click: vi.fn(),
                    remove: vi.fn(),
                };
                vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

                await modal.downloadThemeZip(theme);

                expect(window.eXeLearning.app.api.getThemeZip).toHaveBeenCalledWith(
                    'test-session-123',
                    'test-theme'
                );
                expect(mockLink.setAttribute).toHaveBeenCalledWith('type', 'hidden');
                expect(mockLink.download).toBe('theme.zip');
                expect(mockLink.click).toHaveBeenCalled();
                expect(mockLink.remove).toHaveBeenCalled();
            });

            it('should not download if response is invalid', async () => {
                const response = {};

                window.eXeLearning.app.api.getThemeZip.mockResolvedValue(response);

                const theme = { dirName: 'test-theme' };

                const createElementSpy = vi.spyOn(document, 'createElement');

                await modal.downloadThemeZip(theme);

                expect(createElementSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe('makeRowTableThemesElement', () => {
        it('should create theme row with correct attributes', () => {
            const theme = mockThemes.installed['theme-base-1'];
            const row = modal.makeRowTableThemesElement(theme);

            expect(row.tagName).toBe('TR');
            expect(row.getAttribute('theme-id')).toBe('theme-base-1');
            expect(row.classList.contains('theme-row')).toBe(true);
        });

        it('should mark selected theme', () => {
            const theme = mockThemes.installed['theme-base-1'];
            const row = modal.makeRowTableThemesElement(theme);

            expect(row.classList.contains('selected')).toBe(true);
        });

        it('should include edit and remove actions for user themes', () => {
            const theme = mockThemes.installed['theme-user-1'];
            const row = modal.makeRowTableThemesElement(theme);

            const editAction = row.querySelector('.theme-action-edit');
            const removeAction = row.querySelector('.theme-action-remove');

            expect(editAction).not.toBeNull();
            expect(removeAction).not.toBeNull();
        });

        it('should not include edit/remove actions for base themes', () => {
            const theme = mockThemes.installed['theme-base-1'];
            const row = modal.makeRowTableThemesElement(theme);

            const editAction = row.querySelector('.theme-action-edit');
            const removeAction = row.querySelector('.theme-action-remove');

            expect(editAction).toBeNull();
            expect(removeAction).toBeNull();
        });

        it('should always include export and info actions', () => {
            const theme = mockThemes.installed['theme-base-1'];
            const row = modal.makeRowTableThemesElement(theme);

            const exportAction = row.querySelector('.theme-action-export');
            const infoAction = row.querySelector('.theme-action-info');

            expect(exportAction).not.toBeNull();
            expect(infoAction).not.toBeNull();
        });
    });

    describe('makeElementEditTheme', () => {
        beforeEach(() => {
            modal.themeEdition = { id: 'test-theme', title: 'Test Theme' };
            modal.paramsEdit = {
                title: {
                    title: 'Title',
                    tag: 'text',
                    config: 'title',
                    category: 'General',
                },
                description: {
                    title: 'Description',
                    tag: 'textarea',
                    config: 'description',
                    category: 'General',
                },
            };
        });

        it('should create edit theme container', () => {
            const theme = { id: 'test-theme', title: 'Test Theme' };
            const container = modal.makeElementEditTheme(theme);

            expect(container.classList.contains('edit-theme-container')).toBe(true);
        });

        it('should include theme title', () => {
            const theme = { id: 'test-theme', title: 'Test Theme' };
            const container = modal.makeElementEditTheme(theme);

            const title = container.querySelector('.theme-edit-title');
            expect(title.innerHTML).toBe('Style: Test Theme');
        });

        it('should include edit table', () => {
            const theme = { id: 'test-theme', title: 'Test Theme' };
            const container = modal.makeElementEditTheme(theme);

            const table = container.querySelector('.edit-theme-table');
            expect(table).not.toBeNull();
        });
    });

    describe('makeElementInfoTheme', () => {
        beforeEach(() => {
            modal.paramsInfo = {
                title: { title: 'Title', tag: 'text' },
                author: { title: 'Author', tag: 'text' },
                description: { title: 'Description', tag: 'textarea' },
            };
        });

        it('should create info container', () => {
            const theme = {
                title: 'Test Theme',
                author: 'Test Author',
                description: 'Test Description',
            };
            const container = modal.makeElementInfoTheme(theme);

            expect(container.classList.contains('info-theme-container')).toBe(true);
        });

        it('should include properties title', () => {
            const theme = {
                title: 'Test Theme',
            };
            const container = modal.makeElementInfoTheme(theme);

            const title = container.querySelector('.theme-properties-title');
            expect(title.innerHTML).toBe('Style properties');
        });

        it('should include info table', () => {
            const theme = {
                title: 'Test Theme',
            };
            const container = modal.makeElementInfoTheme(theme);

            const table = container.querySelector('.info-theme-table');
            expect(table).not.toBeNull();
        });
    });

    describe('makeElementEditThemeText', () => {
        it('should create text input with value', () => {
            const input = modal.makeElementEditThemeText('Test Value');

            expect(input.tagName).toBe('INPUT');
            expect(input.getAttribute('type')).toBe('text');
            expect(input.getAttribute('value')).toBe('Test Value');
            expect(input.classList.contains('theme-edit-value-text')).toBe(true);
        });
    });

    describe('makeElementEditThemeTextarea', () => {
        it('should create textarea with value', () => {
            const textarea = modal.makeElementEditThemeTextarea('Test Content');

            expect(textarea.tagName).toBe('TEXTAREA');
            expect(textarea.innerHTML).toBe('Test Content');
            expect(textarea.classList.contains('theme-edit-value-text')).toBe(true);
        });
    });

    describe('makeElementEditThemeColor', () => {
        it('should create color input with value', () => {
            const input = modal.makeElementEditThemeColor('#ff0000');

            expect(input.tagName).toBe('INPUT');
            expect(input.getAttribute('type')).toBe('color');
            expect(input.getAttribute('value')).toBe('#ff0000');
        });
    });

    describe('makeElementEditThemeImg', () => {
        it('should create image container', () => {
            const container = modal.makeElementEditThemeImg('');

            expect(container.classList.contains('img-container')).toBe(true);
        });

        it('should add no-img class when no value', () => {
            const container = modal.makeElementEditThemeImg('');

            expect(container.classList.contains('no-img')).toBe(true);
        });

        it('should set image src when value exists', () => {
            const container = modal.makeElementEditThemeImg('/path/to/image.jpg');
            const img = container.querySelector('.preview-img');

            expect(img.getAttribute('src')).toContain('/base/path/to/image.jpg');
        });

        it('should create file input with event handler (not appended to container)', () => {
            modal.themeEdition = { id: 'test-theme', title: 'Test' };
            const container = modal.makeElementEditThemeImg('');

            // The file input is created but not appended to the container
            // It's only accessible through the button click event
            const button = container.querySelector('input[type="button"]');

            expect(button).not.toBeNull();
            expect(button.getAttribute('value')).toBe('Select image');
        });

        it('should include button to select image', () => {
            const container = modal.makeElementEditThemeImg('');
            const button = container.querySelector('input[type="button"]');

            expect(button).not.toBeNull();
            expect(button.getAttribute('value')).toBe('Select image');
        });

        it('should include remove button', () => {
            const container = modal.makeElementEditThemeImg('');
            const removeBtn = container.querySelector('.remove-img');

            expect(removeBtn).not.toBeNull();
            expect(removeBtn.innerHTML).toBe('close');
        });
    });

    describe('readFile', () => {
        it('should read file and return data URL', async () => {
            const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
            const result = await modal.readFile(mockFile);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
    });
});
