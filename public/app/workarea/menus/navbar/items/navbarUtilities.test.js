/**
 * navbarUtilities Tests
 *
 * Unit tests for NavbarFile (navbarUtilities) class.
 * Tests event setup, event handlers, CSV generation, and preview functionality.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NavbarFile from './navbarUtilities.js';

describe('NavbarUtilities', () => {
    let mockMenu;
    let mockButtons;
    let navbarUtilities;
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
            dropdownUtilities: createButton('dropdownUtilities'),
            preferencesButton: createButton('navbar-button-preferences'),
            ideviceManagerButton: createButton('navbar-button-idevice-manager'),
            brokenLinksButton: createButton('navbar-button-odebrokenlinks'),
            filemanagerButton: createButton('navbar-button-filemanager'),
            usedFilesButton: createButton('navbar-button-odeusedfiles'),
            previewButton: createButton('navbar-button-preview'),
            projectPreferencesButton: createButton('head-top-settings-button'),
        };

        Object.values(mockButtons).forEach((button) => navbarElement.appendChild(button));
        vi.spyOn(navbarElement, 'querySelector');

        mockMenu = {
            navbar: navbarElement,
        };

        // Mock document.querySelector
        const rootNav = document.createElement('div');
        rootNav.setAttribute('nav-id', 'root');
        const rootButton = document.createElement('button');
        rootButton.click = vi.fn();
        rootNav.appendChild(rootButton);
        document.body.appendChild(rootNav);

        vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
            if (selector === '#navbar-button-preferences') return mockButtons.preferencesButton;
            if (selector === '#head-top-settings-button') return mockButtons.projectPreferencesButton;
            if (selector === '[nav-id="root"]') return rootNav;
            return null;
        });

        if (!global.$ || !global.$.fn) {
            throw new Error('jQuery is not available in the test environment');
        }
        originalTooltip = global.$.fn.tooltip;
        global.$.fn.tooltip = vi.fn().mockReturnThis();

        // Mock window
        global.window = {
            AppLogger: { log: vi.fn() },
            open: vi.fn(),
            location: { origin: 'http://localhost:8080' },
        };

        // Mock eXeLearning
        global.eXeLearning = {
            app: {
                project: {
                    checkOpenIdevice: vi.fn(() => false),
                    odeSession: 'test-session-123',
                    _yjsEnabled: false,
                    _yjsBridge: null,
                },
                user: {
                    preferences: {
                        showModalPreferences: vi.fn(),
                    },
                },
                idevices: {
                    showModalIdeviceManager: vi.fn(),
                },
                modals: {
                    filemanager: { show: vi.fn() },
                    odebrokenlinks: { show: vi.fn() },
                    odeusedfiles: { show: vi.fn() },
                    alert: { show: vi.fn() },
                },
                toasts: {
                    createToast: vi.fn(() => ({
                        toastBody: { innerHTML: '', classList: { add: vi.fn() } },
                        remove: vi.fn(),
                    })),
                },
                api: {
                    getOdeSessionBrokenLinks: vi.fn(),
                    getOdeSessionUsedFiles: vi.fn(),
                    getOdePreviewUrl: vi.fn(),
                },
                interface: null,
                config: { basePath: '', version: 'v1' },
            },
        };

        // Mock i18n
        global._ = vi.fn((str) => str);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        global.$.fn.tooltip = originalTooltip;
        delete global.window;
        delete global.eXeLearning;
        delete global._;
    });

    describe('constructor', () => {
        it('should initialize with menu reference', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(navbarUtilities.menu).toBe(mockMenu);
        });

        it('should query for dropdown utilities button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#dropdownUtilities');
        });

        it('should query for preferences button from document', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(document.querySelector).toHaveBeenCalledWith('#navbar-button-preferences');
        });

        it('should query for idevice manager button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-idevice-manager');
        });

        it('should query for broken links button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-odebrokenlinks');
        });

        it('should query for file manager button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-filemanager');
        });

        it('should query for used files button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-odeusedfiles');
        });

        it('should query for preview button', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(mockMenu.navbar.querySelector).toHaveBeenCalledWith('#navbar-button-preview');
        });

        it('should query for project preferences button from document', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            expect(document.querySelector).toHaveBeenCalledWith('#head-top-settings-button');
        });
    });

    describe('setEvents', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        it('should call all event setup methods', () => {
            vi.spyOn(navbarUtilities, 'setTooltips');
            vi.spyOn(navbarUtilities, 'setPreferencesEvent');
            vi.spyOn(navbarUtilities, 'setIdeviceManagerEvent');
            vi.spyOn(navbarUtilities, 'setFileManagerEvent');
            vi.spyOn(navbarUtilities, 'setOdeBrokenLinksEvent');
            vi.spyOn(navbarUtilities, 'setOdeUsedFilesEvent');
            vi.spyOn(navbarUtilities, 'setPreviewEvent');
            vi.spyOn(navbarUtilities, 'setProjectPreferencesEvent');

            navbarUtilities.setEvents();

            expect(navbarUtilities.setTooltips).toHaveBeenCalled();
            expect(navbarUtilities.setPreferencesEvent).toHaveBeenCalled();
            expect(navbarUtilities.setIdeviceManagerEvent).toHaveBeenCalled();
            expect(navbarUtilities.setFileManagerEvent).toHaveBeenCalled();
            expect(navbarUtilities.setOdeBrokenLinksEvent).toHaveBeenCalled();
            expect(navbarUtilities.setOdeUsedFilesEvent).toHaveBeenCalled();
            expect(navbarUtilities.setPreviewEvent).toHaveBeenCalled();
            expect(navbarUtilities.setProjectPreferencesEvent).toHaveBeenCalled();
        });
    });

    describe('setTooltips', () => {
        it('should initialize jQuery tooltips on menu buttons', () => {
            navbarUtilities = new NavbarFile(mockMenu);
            navbarUtilities.setTooltips();

            expect(global.$.fn.tooltip).toHaveBeenCalled();
        });
    });

    describe('event listener setup', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        it('setPreferencesEvent should add click listener', () => {
            navbarUtilities.setPreferencesEvent();
            expect(mockButtons.preferencesButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setIdeviceManagerEvent should add click listener', () => {
            navbarUtilities.setIdeviceManagerEvent();
            expect(mockButtons.ideviceManagerButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setFileManagerEvent should add click listener', () => {
            navbarUtilities.setFileManagerEvent();
            expect(mockButtons.filemanagerButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setOdeBrokenLinksEvent should add click listener', () => {
            navbarUtilities.setOdeBrokenLinksEvent();
            expect(mockButtons.brokenLinksButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setOdeUsedFilesEvent should add click listener', () => {
            navbarUtilities.setOdeUsedFilesEvent();
            expect(mockButtons.usedFilesButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setPreviewEvent should add click listener', () => {
            navbarUtilities.setPreviewEvent();
            expect(mockButtons.previewButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });

        it('setProjectPreferencesEvent should add click listener', () => {
            navbarUtilities.setProjectPreferencesEvent();
            expect(mockButtons.projectPreferencesButton.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });
    });

    describe('event handlers', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        describe('preferencesEvent', () => {
            it('should show preferences modal', () => {
                navbarUtilities.preferencesEvent();
                expect(eXeLearning.app.user.preferences.showModalPreferences).toHaveBeenCalled();
            });
        });

        describe('ideviceManagerEvent', () => {
            it('should show idevice manager modal', () => {
                navbarUtilities.ideviceManagerEvent();
                expect(eXeLearning.app.idevices.showModalIdeviceManager).toHaveBeenCalled();
            });
        });

        describe('fileManagerEvent', () => {
            it('should show file manager modal', () => {
                navbarUtilities.fileManagerEvent();
                expect(eXeLearning.app.modals.filemanager.show).toHaveBeenCalled();
            });
        });

        describe('preferences click handler', () => {
            it('should prevent default and return false if idevice is open', () => {
                eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
                navbarUtilities.setPreferencesEvent();

                const clickHandler = mockButtons.preferencesButton.addEventListener.mock.calls[0][1];
                const mockEvent = { preventDefault: vi.fn() };

                const result = clickHandler(mockEvent);

                expect(eXeLearning.app.project.checkOpenIdevice).toHaveBeenCalled();
                expect(mockEvent.preventDefault).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('should call preferencesEvent when no idevice is open', () => {
                eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
                vi.spyOn(navbarUtilities, 'preferencesEvent');
                navbarUtilities.setPreferencesEvent();

                const clickHandler = mockButtons.preferencesButton.addEventListener.mock.calls[0][1];
                const mockEvent = { preventDefault: vi.fn() };

                clickHandler(mockEvent);

                expect(navbarUtilities.preferencesEvent).toHaveBeenCalled();
            });
        });

        describe('preview click handler', () => {
            it('should return early if idevice is open', () => {
                eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
                vi.spyOn(navbarUtilities, 'previewEvent');
                navbarUtilities.setPreviewEvent();

                const clickHandler = mockButtons.previewButton.addEventListener.mock.calls[0][1];
                clickHandler();

                expect(navbarUtilities.previewEvent).not.toHaveBeenCalled();
            });

            it('should call previewEvent when no idevice is open', () => {
                eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
                vi.spyOn(navbarUtilities, 'previewEvent');
                navbarUtilities.setPreviewEvent();

                const clickHandler = mockButtons.previewButton.addEventListener.mock.calls[0][1];
                clickHandler();

                expect(navbarUtilities.previewEvent).toHaveBeenCalled();
            });
        });
    });

    describe('json2Csv', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        describe('broken links export', () => {
            it('should convert broken links to CSV', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://broken.com',
                            brokenLinksError: '404',
                            nTimesBrokenLinks: 2,
                            pageNamesBrokenLinks: 'Page 1',
                            blockNamesBrokenLinks: 'Block 1',
                            typeComponentSyncBrokenLinks: 'text',
                            orderComponentSyncBrokenLinks: 1,
                        },
                    ],
                };
                const headers = ['Link', 'Error', 'Times', 'Page name', 'Block name', 'Type', 'Block position'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('Link,Error,Times,Page name,Block name,Type,Block position');
                expect(csv).toContain('http://broken.com');
                expect(csv).toContain('404');
            });

            it('should skip rows where Error is null', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://broken.com',
                            brokenLinksError: null,
                        },
                    ],
                };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                // Should only have header row
                const lines = csv.trim().split('\r\n');
                expect(lines.length).toBe(1);
            });

            it('should skip rows where Error is undefined', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://broken.com',
                        },
                    ],
                };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                const lines = csv.trim().split('\r\n');
                expect(lines.length).toBe(1);
            });
        });

        describe('used files export', () => {
            it('should convert used files to CSV', () => {
                const data = {
                    usedFiles: [
                        {
                            usedFiles: 'image.png',
                            usedFilesPath: '/resources/image.png',
                            usedFilesSize: '1024',
                            pageNamesUsedFiles: 'Page 1',
                            blockNamesUsedFiles: 'Block 1',
                            typeComponentSyncUsedFiles: 'image',
                            orderComponentSyncUsedFiles: 0,
                        },
                    ],
                };
                const headers = ['File', 'Path', 'Size', 'Page name', 'Block name', 'Type', 'Block position'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('File,Path,Size,Page name,Block name,Type,Block position');
                expect(csv).toContain('image.png');
                expect(csv).toContain('/resources/image.png');
            });
        });

        describe('edge cases', () => {
            it('should handle JSON string input', () => {
                const data = JSON.stringify({
                    brokenLinks: [
                        {
                            brokenLinks: 'http://test.com',
                            brokenLinksError: '500',
                        },
                    ],
                });
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('http://test.com');
            });

            it('should escape commas in values', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://test.com?a=1,b=2',
                            brokenLinksError: 'error,with,commas',
                        },
                    ],
                };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('"error,with,commas"');
            });

            it('should escape quotes in values', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://test.com',
                            brokenLinksError: 'error with "quotes"',
                        },
                    ],
                };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('""quotes""');
            });

            it('should escape newlines in values', () => {
                const data = {
                    brokenLinks: [
                        {
                            brokenLinks: 'http://test.com',
                            brokenLinksError: 'error\nwith\nnewlines',
                        },
                    ],
                };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('"error\nwith\nnewlines"');
            });

            it('should handle null values', () => {
                const data = {
                    usedFiles: [
                        {
                            usedFiles: 'file.txt',
                            usedFilesPath: null,
                        },
                    ],
                };
                const headers = ['File', 'Path'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toContain('file.txt,');
            });

            it('should handle empty data array', () => {
                const data = { brokenLinks: [] };
                const headers = ['Link', 'Error'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toBe('Link,Error\r\n');
            });

            it('should return headers only for unknown type', () => {
                const data = { unknownType: [] };
                const headers = ['Unknown', 'Headers'];

                const csv = navbarUtilities.json2Csv(data, headers);

                expect(csv).toBe('Unknown,Headers\r\n');
            });
        });
    });

    describe('collectAllIdevicesHtml', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        it('should return empty array when yjsBridge is not available', () => {
            eXeLearning.app.project._yjsBridge = null;

            const result = navbarUtilities.collectAllIdevicesHtml();

            expect(result).toEqual([]);
        });

        it('should return empty array when structureBinding is not available', () => {
            eXeLearning.app.project._yjsBridge = {};

            const result = navbarUtilities.collectAllIdevicesHtml();

            expect(result).toEqual([]);
        });

        it('should return empty array when navigation is not available', () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    manager: {
                        getNavigation: vi.fn(() => null),
                    },
                },
            };

            const result = navbarUtilities.collectAllIdevicesHtml();

            expect(result).toEqual([]);
        });

        it('should collect idevices from navigation structure', () => {
            // Mock navigation structure
            const mockCompMap = {
                get: vi.fn((key) => {
                    const data = {
                        htmlContent: '<p>Test content</p>',
                        ideviceType: 'text',
                        order: 0,
                    };
                    return data[key];
                }),
            };
            const mockBlockMap = {
                get: vi.fn((key) => {
                    if (key === 'blockName') return 'Block 1';
                    if (key === 'components') {
                        return { length: 1, get: vi.fn(() => mockCompMap) };
                    }
                    return null;
                }),
            };
            const mockPageMap = {
                get: vi.fn((key) => {
                    if (key === 'title') return 'Page 1';
                    if (key === 'blocks') {
                        return { length: 1, get: vi.fn(() => mockBlockMap) };
                    }
                    return null;
                }),
            };
            const mockNavigation = {
                length: 1,
                get: vi.fn(() => mockPageMap),
            };

            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    manager: {
                        getNavigation: vi.fn(() => mockNavigation),
                    },
                },
            };

            const result = navbarUtilities.collectAllIdevicesHtml();

            expect(result.length).toBe(1);
            expect(result[0].pageName).toBe('Page 1');
            expect(result[0].blockName).toBe('Block 1');
            expect(result[0].html).toContain('<p>Test content</p>');
        });
    });

    describe('async methods', () => {
        beforeEach(() => {
            navbarUtilities = new NavbarFile(mockMenu);
        });

        describe('getOdeSessionBrokenLinksEvent', () => {
            it('should call API with session ID and collected idevices', async () => {
                vi.spyOn(navbarUtilities, 'collectAllIdevicesHtml').mockReturnValue([
                    { html: '<p>Test</p>', pageName: 'Page 1' },
                ]);
                eXeLearning.app.api.getOdeSessionBrokenLinks.mockResolvedValue({
                    responseMessage: 'OK',
                });

                await navbarUtilities.getOdeSessionBrokenLinksEvent();

                expect(eXeLearning.app.api.getOdeSessionBrokenLinks).toHaveBeenCalledWith({
                    csv: false,
                    odeSessionId: 'test-session-123',
                    idevices: [{ html: '<p>Test</p>', pageName: 'Page 1' }],
                });
            });
        });

        describe('getOdeSessionUsedFilesEvent', () => {
            it('should call API with session ID, collected idevices and asset metadata', async () => {
                vi.spyOn(navbarUtilities, 'collectAllIdevicesHtml').mockReturnValue([
                    { html: '<p>Test</p>', pageName: 'Page 1' },
                ]);
                vi.spyOn(navbarUtilities, 'collectAssetMetadata').mockResolvedValue({});
                eXeLearning.app.api.getOdeSessionUsedFiles.mockResolvedValue({
                    responseMessage: 'OK',
                });

                await navbarUtilities.getOdeSessionUsedFilesEvent();

                expect(eXeLearning.app.api.getOdeSessionUsedFiles).toHaveBeenCalledWith({
                    csv: false,
                    odeSessionId: 'test-session-123',
                    resourceReport: true,
                    idevices: [{ html: '<p>Test</p>', pageName: 'Page 1' }],
                    assetMetadata: {},
                });
            });

            it('should include asset metadata when assets are found in HTML', async () => {
                const mockIdevices = [
                    { html: '<img src="asset://abc123-def456"/>', pageName: 'Page 1' },
                ];
                vi.spyOn(navbarUtilities, 'collectAllIdevicesHtml').mockReturnValue(mockIdevices);

                const mockAssetMetadata = {
                    'abc123-def456': { filename: 'image.png', size: 1024, mime: 'image/png' },
                };
                vi.spyOn(navbarUtilities, 'collectAssetMetadata').mockResolvedValue(mockAssetMetadata);
                eXeLearning.app.api.getOdeSessionUsedFiles.mockResolvedValue({
                    responseMessage: 'OK',
                });

                await navbarUtilities.getOdeSessionUsedFilesEvent();

                expect(navbarUtilities.collectAssetMetadata).toHaveBeenCalledWith(mockIdevices);
                expect(eXeLearning.app.api.getOdeSessionUsedFiles).toHaveBeenCalledWith({
                    csv: false,
                    odeSessionId: 'test-session-123',
                    resourceReport: true,
                    idevices: mockIdevices,
                    assetMetadata: mockAssetMetadata,
                });
            });
        });

        describe('collectAssetMetadata', () => {
            it('should return empty object when assetManager is not available', async () => {
                eXeLearning.app.project._yjsBridge = null;

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: '<img src="asset://abc123"/>' },
                ]);

                expect(result).toEqual({});
            });

            it('should extract asset IDs from HTML and fetch metadata', async () => {
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue({
                        filename: 'test.png',
                        size: 2048,
                        mime: 'image/png',
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: '<img src="asset://abc123-def4-5678-90ab-cdef12345678"/>' },
                ]);

                expect(mockAssetManager.getAsset).toHaveBeenCalledWith('abc123-def4-5678-90ab-cdef12345678');
                expect(result).toEqual({
                    'abc123-def4-5678-90ab-cdef12345678': {
                        filename: 'test.png',
                        size: 2048,
                        mime: 'image/png',
                    },
                });
            });

            it('should handle multiple assets and deduplicate', async () => {
                const asset1Id = 'a1111111-1111-1111-1111-111111111111';
                const asset2Id = 'b2222222-2222-2222-2222-222222222222';
                const mockAssetManager = {
                    getAsset: vi.fn().mockImplementation((id) => {
                        if (id === asset1Id) {
                            return Promise.resolve({ filename: 'a.png', size: 100, mime: 'image/png' });
                        }
                        if (id === asset2Id) {
                            return Promise.resolve({ filename: 'b.jpg', size: 200, mime: 'image/jpeg' });
                        }
                        return Promise.resolve(null);
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${asset1Id}"/><img src="asset://${asset1Id}"/>` },
                    { html: `<img src="asset://${asset2Id}"/>` },
                ]);

                // Should call getAsset only twice (deduplicated)
                expect(mockAssetManager.getAsset).toHaveBeenCalledTimes(2);
                expect(result).toEqual({
                    [asset1Id]: { filename: 'a.png', size: 100, mime: 'image/png' },
                    [asset2Id]: { filename: 'b.jpg', size: 200, mime: 'image/jpeg' },
                });
            });

            it('should handle missing assets gracefully', async () => {
                const missingAssetId = 'c3333333-3333-3333-3333-333333333333';
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue(null),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${missingAssetId}"/>` },
                ]);

                expect(result).toEqual({});
            });

            it('should handle assets without filename using null', async () => {
                const assetId = 'd4444444-4444-4444-4444-444444444444';
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue({
                        size: 1024,
                        mime: 'application/octet-stream',
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${assetId}"/>` },
                ]);

                expect(result[assetId].filename).toBeNull();
                expect(result[assetId].size).toBe(1024);
            });

            it('should handle getAsset errors gracefully', async () => {
                const assetId = 'e5555555-5555-5555-5555-555555555555';
                const mockAssetManager = {
                    getAsset: vi.fn().mockRejectedValue(new Error('Database error')),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${assetId}"/>` },
                ]);

                expect(mockAssetManager.getAsset).toHaveBeenCalledWith(assetId);
                expect(result).toEqual({});
            });

            it('should skip idevices without html field', async () => {
                const mockAssetManager = {
                    getAsset: vi.fn(),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { pageName: 'Page 1' },
                    { html: null, pageName: 'Page 2' },
                    { html: undefined, pageName: 'Page 3' },
                ]);

                expect(mockAssetManager.getAsset).not.toHaveBeenCalled();
                expect(result).toEqual({});
            });

            it('should return empty object for empty idevices array', async () => {
                const mockAssetManager = {
                    getAsset: vi.fn(),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([]);

                expect(mockAssetManager.getAsset).not.toHaveBeenCalled();
                expect(result).toEqual({});
            });

            it('should handle assets with zero size', async () => {
                const assetId = 'f6666666-6666-6666-6666-666666666666';
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue({
                        filename: 'empty.txt',
                        size: 0,
                        mime: 'text/plain',
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<a href="asset://${assetId}">Link</a>` },
                ]);

                expect(result[assetId]).toEqual({
                    filename: 'empty.txt',
                    size: 0,
                    mime: 'text/plain',
                });
            });

            it('should extract asset IDs from various URL patterns', async () => {
                const assetId = 'a1111111-1111-1111-1111-111111111111';
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue({
                        filename: 'file.pdf',
                        size: 5000,
                        mime: 'application/pdf',
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                // Test various patterns: img src, a href, data attributes, etc.
                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${assetId}"/>` },
                    { html: `<a href="asset://${assetId}">Download</a>` },
                    { html: `<video data-src="asset://${assetId}"></video>` },
                ]);

                // Should only fetch once due to deduplication
                expect(mockAssetManager.getAsset).toHaveBeenCalledTimes(1);
                expect(result[assetId].filename).toBe('file.pdf');
            });

            it('should use default mime type when not provided', async () => {
                const assetId = 'b2222222-2222-2222-2222-222222222222';
                const mockAssetManager = {
                    getAsset: vi.fn().mockResolvedValue({
                        filename: 'unknown',
                        size: 100,
                    }),
                };
                eXeLearning.app.project._yjsBridge = {
                    assetManager: mockAssetManager,
                };

                const result = await navbarUtilities.collectAssetMetadata([
                    { html: `<img src="asset://${assetId}"/>` },
                ]);

                expect(result[assetId].mime).toBe('application/octet-stream');
            });
        });

        describe('odeBrokenLinksEvent', () => {
            it('should collect idevices and show modal', () => {
                vi.spyOn(navbarUtilities, 'collectAllIdevicesHtml').mockReturnValue([
                    { html: '<a href="https://test.com">Link</a>', pageName: 'Page 1' },
                ]);

                navbarUtilities.odeBrokenLinksEvent();

                expect(navbarUtilities.collectAllIdevicesHtml).toHaveBeenCalled();
                expect(eXeLearning.app.modals.odebrokenlinks.show).toHaveBeenCalledWith([
                    { html: '<a href="https://test.com">Link</a>', pageName: 'Page 1' },
                ]);
            });

            it('should show modal with empty array when no idevices found', () => {
                vi.spyOn(navbarUtilities, 'collectAllIdevicesHtml').mockReturnValue([]);

                navbarUtilities.odeBrokenLinksEvent();

                expect(eXeLearning.app.modals.odebrokenlinks.show).toHaveBeenCalledWith([]);
            });
        });

        describe('odeUsedFilesEvent', () => {
            it('should show toast and modal when files found', async () => {
                vi.spyOn(navbarUtilities, 'getOdeSessionUsedFilesEvent').mockResolvedValue({
                    responseMessage: 'OK',
                    usedFiles: [{ file: 'image.png' }],
                });

                navbarUtilities.odeUsedFilesEvent();

                await vi.waitFor(() => {
                    expect(eXeLearning.app.toasts.createToast).toHaveBeenCalled();
                });
            });

            it('should show alert when no files found', async () => {
                vi.spyOn(navbarUtilities, 'getOdeSessionUsedFilesEvent').mockResolvedValue({
                    responseMessage: 'OK',
                    usedFiles: null,
                });

                navbarUtilities.odeUsedFilesEvent();

                await vi.waitFor(() => {
                    expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                        title: 'Resources report',
                        body: 'The project has no files.',
                    });
                });
            });
        });

        describe('previewEvent', () => {
            it('should use preview panel if available', async () => {
                const mockPanel = { toggle: vi.fn() };
                eXeLearning.app.interface = {
                    previewButton: {
                        getPanel: vi.fn(() => mockPanel),
                    },
                };

                await navbarUtilities.previewEvent();

                expect(mockPanel.toggle).toHaveBeenCalled();
            });

            it('should fall back to server-side preview when panel not available', async () => {
                vi.useFakeTimers();
                eXeLearning.app.interface = null;
                eXeLearning.app.project._yjsEnabled = false;
                eXeLearning.app.api.getOdePreviewUrl.mockResolvedValue({
                    responseMessage: 'OK',
                    urlPreviewIndex: 'http://localhost/preview',
                });

                await navbarUtilities.previewEvent();

                expect(eXeLearning.app.toasts.createToast).toHaveBeenCalled();
                expect(eXeLearning.app.api.getOdePreviewUrl).toHaveBeenCalledWith('test-session-123');

                // Advance timers to complete pending setTimeout callbacks
                await vi.runAllTimersAsync();
                vi.useRealTimers();
            });

            it('should show error on server preview failure', async () => {
                vi.useFakeTimers();
                eXeLearning.app.interface = null;
                eXeLearning.app.project._yjsEnabled = false;
                eXeLearning.app.api.getOdePreviewUrl.mockResolvedValue({
                    responseMessage: 'Error',
                });

                await navbarUtilities.previewEvent();

                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();

                // Advance timers to complete pending setTimeout callbacks
                await vi.runAllTimersAsync();
                vi.useRealTimers();
            });
        });

        describe('openClientPreview', () => {
            it('should return false when yjsBridge is not available', async () => {
                eXeLearning.app.project._yjsBridge = null;

                const result = await navbarUtilities.openClientPreview();

                expect(result).toBe(false);
            });

            it('should return false when documentManager is not available', async () => {
                eXeLearning.app.project._yjsBridge = {};

                const result = await navbarUtilities.openClientPreview();

                expect(result).toBe(false);
            });

            it('should return false when SharedExporters is not available', async () => {
                eXeLearning.app.project._yjsBridge = {
                    documentManager: {},
                };
                window.SharedExporters = null;

                const result = await navbarUtilities.openClientPreview();

                expect(result).toBe(false);
            });

            it('should call SharedExporters.openPreviewWindow when available', async () => {
                eXeLearning.app.project._yjsBridge = {
                    documentManager: {},
                };
                window.SharedExporters = {
                    openPreviewWindow: vi.fn().mockResolvedValue({}),
                };

                const result = await navbarUtilities.openClientPreview();

                expect(window.SharedExporters.openPreviewWindow).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('should handle preview error and show alert', async () => {
                eXeLearning.app.project._yjsBridge = {
                    documentManager: {},
                };
                window.SharedExporters = {
                    openPreviewWindow: vi.fn().mockRejectedValue(new Error('Preview failed')),
                };

                const result = await navbarUtilities.openClientPreview();

                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
                expect(result).toBe(true); // Error was handled
            });
        });
    });
});
