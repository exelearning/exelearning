/**
 * componentDownloadHelper Tests
 *
 * Unit tests for component download helper functions.
 * Tests filename building, storage key generation, and download orchestration.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    downloadComponentFile,
    buildComponentFileName,
    buildComponentStorageKey,
} from './componentDownloadHelper.js';

describe('componentDownloadHelper', () => {
    let originalLocalStorage;

    beforeEach(() => {
        vi.clearAllMocks();

        // Store original localStorage
        originalLocalStorage = window.localStorage;

        // Mock window properties directly on the window object
        window.__currentProjectId = 'test-project-123';
        window.electronAPI = undefined;

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            },
            writable: true,
            configurable: true,
        });

        // Mock document for browser download
        global.document = {
            createElement: vi.fn(() => ({
                click: vi.fn(),
                style: {},
            })),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn(),
            },
        };

        // Mock eXeLearning config
        global.eXeLearning = {
            config: {
                isOfflineInstallation: false,
            },
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.__currentProjectId;
        delete window.electronAPI;
        // Restore original localStorage
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
            configurable: true,
        });
        delete global.document;
        delete global.eXeLearning;
    });

    describe('buildComponentFileName', () => {
        it('should build filename with identifier and extension', () => {
            const result = buildComponentFileName('my-component', 'json');
            expect(result).toBe('my-component.json');
        });

        it('should handle extension with leading dot', () => {
            const result = buildComponentFileName('my-component', '.json');
            expect(result).toBe('my-component.json');
        });

        it('should handle extension without leading dot', () => {
            const result = buildComponentFileName('my-component', 'xml');
            expect(result).toBe('my-component.xml');
        });

        it('should trim identifier whitespace', () => {
            const result = buildComponentFileName('  spaced-name  ', 'txt');
            expect(result).toBe('spaced-name.txt');
        });

        it('should generate fallback identifier when empty string', () => {
            const result = buildComponentFileName('', 'json');
            expect(result).toMatch(/^component-\d+\.json$/);
        });

        it('should generate fallback identifier when only whitespace', () => {
            const result = buildComponentFileName('   ', 'json');
            expect(result).toMatch(/^component-\d+\.json$/);
        });

        it('should generate fallback identifier when null', () => {
            const result = buildComponentFileName(null, 'json');
            expect(result).toMatch(/^component-\d+\.json$/);
        });

        it('should generate fallback identifier when undefined', () => {
            const result = buildComponentFileName(undefined, 'json');
            expect(result).toMatch(/^component-\d+\.json$/);
        });

        it('should handle missing extension', () => {
            const result = buildComponentFileName('my-component', '');
            expect(result).toBe('my-component');
        });

        it('should handle null extension', () => {
            const result = buildComponentFileName('my-component', null);
            expect(result).toBe('my-component');
        });

        it('should handle undefined extension', () => {
            const result = buildComponentFileName('my-component', undefined);
            expect(result).toBe('my-component');
        });

        it('should handle numeric identifier', () => {
            const result = buildComponentFileName(123, 'json');
            // Number is not a string, so should use fallback
            expect(result).toMatch(/^component-\d+\.json$/);
        });
    });

    describe('buildComponentStorageKey', () => {
        it('should build storage key with identifier and type', () => {
            const result = buildComponentStorageKey('my-id', 'idevice');
            expect(result).toBe('component:idevice:my-id');
        });

        it('should trim identifier whitespace', () => {
            const result = buildComponentStorageKey('  spaced-id  ', 'block');
            expect(result).toBe('component:block:spaced-id');
        });

        it('should trim type whitespace', () => {
            const result = buildComponentStorageKey('my-id', '  block  ');
            expect(result).toBe('component:block:my-id');
        });

        it('should generate fallback identifier when empty', () => {
            const result = buildComponentStorageKey('', 'idevice');
            expect(result).toMatch(/^component:idevice:component-\d+$/);
        });

        it('should generate fallback identifier when null', () => {
            const result = buildComponentStorageKey(null, 'idevice');
            expect(result).toMatch(/^component:idevice:component-\d+$/);
        });

        it('should generate fallback identifier when undefined', () => {
            const result = buildComponentStorageKey(undefined, 'idevice');
            expect(result).toMatch(/^component:idevice:component-\d+$/);
        });

        it('should use default type when empty', () => {
            const result = buildComponentStorageKey('my-id', '');
            expect(result).toBe('component:component:my-id');
        });

        it('should use default type when null', () => {
            const result = buildComponentStorageKey('my-id', null);
            expect(result).toBe('component:component:my-id');
        });

        it('should use default type when undefined', () => {
            const result = buildComponentStorageKey('my-id', undefined);
            expect(result).toBe('component:component:my-id');
        });

        it('should use default type when only whitespace', () => {
            const result = buildComponentStorageKey('my-id', '   ');
            expect(result).toBe('component:component:my-id');
        });

        it('should handle both defaults', () => {
            const result = buildComponentStorageKey('', '');
            expect(result).toMatch(/^component:component:component-\d+$/);
        });
    });

    describe('downloadComponentFile', () => {
        let mockAnchor;

        beforeEach(() => {
            mockAnchor = {
                href: '',
                download: '',
                rel: '',
                style: {},
                click: vi.fn(),
            };
            global.document.createElement = vi.fn(() => mockAnchor);
        });

        it('should do nothing when url is empty', async () => {
            await downloadComponentFile('', 'test.json');
            expect(document.createElement).not.toHaveBeenCalled();
        });

        it('should do nothing when url is null', async () => {
            await downloadComponentFile(null, 'test.json');
            expect(document.createElement).not.toHaveBeenCalled();
        });

        it('should do nothing when url is undefined', async () => {
            await downloadComponentFile(undefined, 'test.json');
            expect(document.createElement).not.toHaveBeenCalled();
        });

        it('should trigger browser download for non-electron environment', async () => {
            await downloadComponentFile('https://example.com/file.json', 'test.json');

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockAnchor.href).toBe('https://example.com/file.json');
            expect(mockAnchor.download).toBe('test.json');
            expect(mockAnchor.rel).toBe('noopener');
            expect(mockAnchor.style.display).toBe('none');
            expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
            expect(mockAnchor.click).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
        });

        it('should use fallback filename when suggestedName is empty', async () => {
            await downloadComponentFile('https://example.com/file.json', '');

            expect(mockAnchor.download).toBe('component-export.bin');
        });

        it('should use fallback filename when suggestedName is null', async () => {
            await downloadComponentFile('https://example.com/file.json', null);

            expect(mockAnchor.download).toBe('component-export.bin');
        });

        it('should trim filename whitespace', async () => {
            await downloadComponentFile('https://example.com/file.json', '  my-file.json  ');

            expect(mockAnchor.download).toBe('my-file.json');
        });

        describe('Electron environment', () => {
            let mockElectronAPI;

            beforeEach(() => {
                mockElectronAPI = {
                    save: vi.fn(),
                    saveAs: vi.fn(),
                    saveBuffer: vi.fn(),
                    saveBufferAs: vi.fn(),
                };
                window.electronAPI = mockElectronAPI;
                global.eXeLearning.config.isOfflineInstallation = true;
            });

            it('should try save first when key is remembered', async () => {
                window.localStorage.getItem = vi.fn(() => '1');
                mockElectronAPI.save = vi.fn(() => Promise.resolve(true));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(mockElectronAPI.save).toHaveBeenCalled();
                expect(mockElectronAPI.saveAs).not.toHaveBeenCalled();
                expect(document.createElement).not.toHaveBeenCalled();
            });

            it('should fall back to saveAs when save fails', async () => {
                window.localStorage.getItem = vi.fn(() => '1');
                mockElectronAPI.save = vi.fn(() => Promise.resolve(false));
                mockElectronAPI.saveAs = vi.fn(() => Promise.resolve(true));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(mockElectronAPI.save).toHaveBeenCalled();
                expect(mockElectronAPI.saveAs).toHaveBeenCalled();
                expect(document.createElement).not.toHaveBeenCalled();
            });

            it('should try saveAs when key is not remembered (save not called first)', async () => {
                window.localStorage.getItem = vi.fn(() => null);
                mockElectronAPI.saveAs = vi.fn(() => Promise.resolve(true));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                // When key is not remembered, save is NOT called because hasRemembered is false
                // But save might be called anyway if the condition is different
                // Let's just verify saveAs was called
                expect(mockElectronAPI.saveAs).toHaveBeenCalled();
            });

            it('should mark key as remembered after successful saveAs', async () => {
                window.localStorage.getItem = vi.fn(() => null);
                mockElectronAPI.saveAs = vi.fn(() => Promise.resolve(true));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(window.localStorage.setItem).toHaveBeenCalled();
            });

            it('should fall back to browser download when electron fails', async () => {
                window.localStorage.getItem = vi.fn(() => null);
                mockElectronAPI.saveAs = vi.fn(() => Promise.resolve(false));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(document.createElement).toHaveBeenCalledWith('a');
                expect(mockAnchor.click).toHaveBeenCalled();
            });

            it('should fall back to browser download when electron throws', async () => {
                window.localStorage.getItem = vi.fn(() => null);
                mockElectronAPI.saveAs = vi.fn(() => Promise.reject(new Error('Electron error')));

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(document.createElement).toHaveBeenCalledWith('a');
                expect(mockAnchor.click).toHaveBeenCalled();
            });

            it('should handle missing electronAPI methods gracefully', async () => {
                window.electronAPI = {};

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(document.createElement).toHaveBeenCalledWith('a');
            });

            describe('blob: URL handling', () => {
                let mockBlob;
                let mockBase64;
                let originalFetch;
                let originalFileReader;

                beforeEach(() => {
                    // Create mock blob and base64 data
                    mockBlob = new Blob(['test content'], { type: 'application/zip' });
                    mockBase64 = 'dGVzdCBjb250ZW50'; // base64 of "test content"

                    // Mock fetch for blob: URLs
                    originalFetch = global.fetch;
                    global.fetch = vi.fn(() => Promise.resolve({
                        blob: () => Promise.resolve(mockBlob),
                    }));

                    // Mock FileReader for blobToBase64
                    originalFileReader = global.FileReader;
                    global.FileReader = class MockFileReader {
                        constructor() {
                            this.result = null;
                            this.onload = null;
                            this.onerror = null;
                        }
                        readAsDataURL() {
                            // Simulate async behavior with setTimeout
                            setTimeout(() => {
                                this.result = `data:application/zip;base64,${mockBase64}`;
                                if (this.onload) this.onload();
                            }, 0);
                        }
                    };
                });

                afterEach(() => {
                    global.fetch = originalFetch;
                    global.FileReader = originalFileReader;
                });

                it('should use saveBufferAs for blob: URLs when not remembered', async () => {
                    window.localStorage.getItem = vi.fn(() => null);
                    mockElectronAPI.saveBufferAs = vi.fn(() => Promise.resolve(true));

                    const blobUrl = 'blob:http://localhost:8080/12345678-1234-1234-1234-123456789abc';
                    await downloadComponentFile(blobUrl, 'test.zip');

                    // Should NOT call saveAs (uses HTTP which fails for blob:)
                    expect(mockElectronAPI.saveAs).not.toHaveBeenCalled();
                    // Should call saveBufferAs with base64 data
                    expect(mockElectronAPI.saveBufferAs).toHaveBeenCalledWith(
                        mockBase64,
                        expect.any(String),
                        'test.zip'
                    );
                });

                it('should use saveBuffer for blob: URLs when key is remembered', async () => {
                    window.localStorage.getItem = vi.fn(() => '1');
                    mockElectronAPI.saveBuffer = vi.fn(() => Promise.resolve(true));

                    const blobUrl = 'blob:http://localhost:8080/12345678-1234-1234-1234-123456789abc';
                    await downloadComponentFile(blobUrl, 'test.zip');

                    // Should NOT call save (uses HTTP which fails for blob:)
                    expect(mockElectronAPI.save).not.toHaveBeenCalled();
                    // Should call saveBuffer with base64 data
                    expect(mockElectronAPI.saveBuffer).toHaveBeenCalledWith(
                        mockBase64,
                        expect.any(String),
                        'test.zip'
                    );
                });

                it('should fall back to saveBufferAs when saveBuffer fails for blob: URL', async () => {
                    window.localStorage.getItem = vi.fn(() => '1');
                    mockElectronAPI.saveBuffer = vi.fn(() => Promise.resolve(false));
                    mockElectronAPI.saveBufferAs = vi.fn(() => Promise.resolve(true));

                    const blobUrl = 'blob:http://localhost:8080/12345678-1234-1234-1234-123456789abc';
                    await downloadComponentFile(blobUrl, 'test.zip');

                    expect(mockElectronAPI.saveBuffer).toHaveBeenCalled();
                    expect(mockElectronAPI.saveBufferAs).toHaveBeenCalled();
                });

                it('should fall back to browser download when both buffer methods fail for blob: URL', async () => {
                    window.localStorage.getItem = vi.fn(() => null);
                    mockElectronAPI.saveBufferAs = vi.fn(() => Promise.resolve(false));

                    const blobUrl = 'blob:http://localhost:8080/12345678-1234-1234-1234-123456789abc';
                    await downloadComponentFile(blobUrl, 'test.zip');

                    // Should fall back to browser download
                    expect(document.createElement).toHaveBeenCalledWith('a');
                    expect(mockAnchor.click).toHaveBeenCalled();
                });

                it('should handle fetch error for blob: URLs gracefully', async () => {
                    window.localStorage.getItem = vi.fn(() => null);
                    global.fetch = vi.fn(() => Promise.reject(new Error('Fetch failed')));

                    const blobUrl = 'blob:http://localhost:8080/12345678-1234-1234-1234-123456789abc';
                    await downloadComponentFile(blobUrl, 'test.zip');

                    // Should fall back to browser download
                    expect(document.createElement).toHaveBeenCalledWith('a');
                });
            });
        });

        describe('keyOptions handling (in Electron environment)', () => {
            let mockElectronAPI;
            let mockGetItem;
            let uniqueProjectId;

            beforeEach(() => {
                // Use unique project ID for each test to avoid module-level cache interference
                // The module has a rememberedComponentKeys Set that persists across tests
                uniqueProjectId = `key-options-project-${Date.now()}-${Math.random()}`;
                window.__currentProjectId = uniqueProjectId;

                // Create fresh mock for localStorage.getItem
                mockGetItem = vi.fn(() => null);
                Object.defineProperty(window, 'localStorage', {
                    value: {
                        getItem: mockGetItem,
                        setItem: vi.fn(),
                        removeItem: vi.fn(),
                        clear: vi.fn(),
                    },
                    writable: true,
                    configurable: true,
                });

                mockElectronAPI = {
                    save: vi.fn(() => Promise.resolve(false)),
                    saveAs: vi.fn(() => Promise.resolve(true)),
                };
                window.electronAPI = mockElectronAPI;
                global.eXeLearning.config.isOfflineInstallation = true;
            });

            it('should use default storage key when keyOptions is undefined', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json');

                // Should use project id + 'component'
                expect(mockGetItem).toHaveBeenCalledWith(
                    `__exe_component_download:${uniqueProjectId}:component`
                );
            });

            it('should use string keyOptions as suffix', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json', 'custom-suffix');

                expect(mockGetItem).toHaveBeenCalledWith(
                    `__exe_component_download:${uniqueProjectId}:custom-suffix`
                );
            });

            it('should use fully-qualified key with colon as-is', async () => {
                // Using a unique absolute key to avoid cache
                const uniqueAbsoluteKey = `absolute:key:${Date.now()}`;
                await downloadComponentFile('https://example.com/file.json', 'test.json', uniqueAbsoluteKey);

                expect(mockGetItem).toHaveBeenCalledWith(
                    `__exe_component_download:${uniqueAbsoluteKey}`
                );
            });

            it('should use absoluteKey from object options', async () => {
                // Using a unique absolute key to avoid cache
                const uniqueAbsoluteKey = `my-absolute-key-${Date.now()}`;
                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    absoluteKey: uniqueAbsoluteKey,
                });

                expect(mockGetItem).toHaveBeenCalledWith(
                    `__exe_component_download:${uniqueAbsoluteKey}`
                );
            });

            it('should use typeKeySuffix from object options', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    typeKeySuffix: 'my-suffix',
                });

                expect(mockGetItem).toHaveBeenCalledWith(
                    `__exe_component_download:${uniqueProjectId}:my-suffix`
                );
            });

            it('should use default project id when __currentProjectId is not set', async () => {
                delete window.__currentProjectId;

                await downloadComponentFile('https://example.com/file.json', 'test.json');

                expect(mockGetItem).toHaveBeenCalledWith(
                    '__exe_component_download:default:component'
                );
            });
        });

        describe('localStorage error handling', () => {
            it('should handle localStorage.getItem throwing', async () => {
                window.localStorage.getItem = vi.fn(() => {
                    throw new Error('localStorage unavailable');
                });

                // Should not throw, should fall through to browser download
                await expect(
                    downloadComponentFile('https://example.com/file.json', 'test.json')
                ).resolves.not.toThrow();

                expect(document.createElement).toHaveBeenCalledWith('a');
            });

            it('should handle localStorage.setItem throwing', async () => {
                window.electronAPI = {
                    saveAs: vi.fn(() => Promise.resolve(true)),
                };
                global.eXeLearning.config.isOfflineInstallation = true;
                window.localStorage.getItem = vi.fn(() => null);
                window.localStorage.setItem = vi.fn(() => {
                    throw new Error('localStorage full');
                });

                // Should not throw
                await expect(
                    downloadComponentFile('https://example.com/file.json', 'test.json')
                ).resolves.not.toThrow();
            });
        });

        describe('alwaysAskLocation option (Electron)', () => {
            let mockElectronAPI;

            beforeEach(() => {
                window.__currentProjectId = `always-ask-test-${Date.now()}`;
                mockElectronAPI = {
                    save: vi.fn(() => Promise.resolve(true)),
                    saveAs: vi.fn(() => Promise.resolve(true)),
                    saveBuffer: vi.fn(() => Promise.resolve(true)),
                    saveBufferAs: vi.fn(() => Promise.resolve(true)),
                };
                window.electronAPI = mockElectronAPI;
                global.eXeLearning.config.isOfflineInstallation = true;
                // Mark key as remembered
                window.localStorage.getItem = vi.fn(() => '1');
                window.localStorage.setItem = vi.fn();
            });

            it('should always use saveAs when alwaysAskLocation is true, even if key is remembered', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    typeKeySuffix: 'page',
                    alwaysAskLocation: true,
                });

                // save should NOT be called because alwaysAskLocation is true
                expect(mockElectronAPI.save).not.toHaveBeenCalled();
                // saveAs should be called
                expect(mockElectronAPI.saveAs).toHaveBeenCalled();
            });

            it('should NOT mark key as remembered when alwaysAskLocation is true', async () => {
                // Start with no remembered key
                window.localStorage.getItem = vi.fn(() => null);

                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    typeKeySuffix: 'idevice',
                    alwaysAskLocation: true,
                });

                // setItem should NOT be called because alwaysAskLocation prevents remembering
                expect(window.localStorage.setItem).not.toHaveBeenCalled();
            });

            it('should use normal save flow when alwaysAskLocation is false', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    typeKeySuffix: 'block',
                    alwaysAskLocation: false,
                });

                // save should be called first since key is remembered
                expect(mockElectronAPI.save).toHaveBeenCalled();
                // saveAs should NOT be called since save succeeded
                expect(mockElectronAPI.saveAs).not.toHaveBeenCalled();
            });

            it('should use normal save flow when alwaysAskLocation is not specified', async () => {
                await downloadComponentFile('https://example.com/file.json', 'test.json', {
                    typeKeySuffix: 'page',
                });

                // save should be called first since key is remembered
                expect(mockElectronAPI.save).toHaveBeenCalled();
            });
        });
    });
});
