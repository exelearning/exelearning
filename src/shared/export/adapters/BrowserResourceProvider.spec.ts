/**
 * BrowserResourceProvider tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BrowserResourceProvider } from './BrowserResourceProvider';

// Mock ResourceFetcher interface
interface MockResourceFetcherInterface {
    fetchTheme(themeName: string): Promise<Map<string, Blob>>;
    fetchIdevice(ideviceType: string): Promise<Map<string, Blob>>;
    fetchBaseLibraries(): Promise<Map<string, Blob>>;
    fetchScormFiles(): Promise<Map<string, Blob>>;
    fetchLibraryFiles(paths: string[]): Promise<Map<string, Blob>>;
    fetchLibraryDirectory(libraryName: string): Promise<Map<string, Blob>>;
    fetchSchemas(format: string): Promise<Map<string, Blob>>;
}

// Create a mock Blob
function createMockBlob(content: string | ArrayBuffer): Blob {
    if (typeof content === 'string') {
        return new Blob([content], { type: 'text/plain' });
    }
    return new Blob([content], { type: 'application/octet-stream' });
}

// Mock ResourceFetcher
class MockResourceFetcher implements MockResourceFetcherInterface {
    private themes: Map<string, Map<string, Blob>> = new Map();
    private idevices: Map<string, Map<string, Blob>> = new Map();
    private baseLibraries: Map<string, Blob> = new Map();
    private scormFiles: Map<string, Blob> = new Map();
    private libraryFiles: Map<string, Blob> = new Map();
    private libraryDirectories: Map<string, Map<string, Blob>> = new Map();
    private schemas: Map<string, Map<string, Blob>> = new Map();

    // Setup methods for testing
    setTheme(themeName: string, files: Map<string, Blob>): void {
        this.themes.set(themeName, files);
    }

    setIdevice(type: string, files: Map<string, Blob>): void {
        this.idevices.set(type, files);
    }

    setBaseLibraries(files: Map<string, Blob>): void {
        this.baseLibraries = files;
    }

    setScormFiles(files: Map<string, Blob>): void {
        this.scormFiles = files;
    }

    setLibraryFiles(files: Map<string, Blob>): void {
        this.libraryFiles = files;
    }

    setLibraryDirectory(name: string, files: Map<string, Blob>): void {
        this.libraryDirectories.set(name, files);
    }

    setSchemas(format: string, files: Map<string, Blob>): void {
        this.schemas.set(format, files);
    }

    // Interface methods
    async fetchTheme(themeName: string): Promise<Map<string, Blob>> {
        return this.themes.get(themeName) || new Map();
    }

    async fetchIdevice(ideviceType: string): Promise<Map<string, Blob>> {
        return this.idevices.get(ideviceType) || new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Blob>> {
        return this.baseLibraries;
    }

    async fetchScormFiles(): Promise<Map<string, Blob>> {
        return this.scormFiles;
    }

    async fetchLibraryFiles(_paths: string[]): Promise<Map<string, Blob>> {
        return this.libraryFiles;
    }

    async fetchLibraryDirectory(libraryName: string): Promise<Map<string, Blob>> {
        return this.libraryDirectories.get(libraryName) || new Map();
    }

    async fetchSchemas(format: string): Promise<Map<string, Blob>> {
        return this.schemas.get(format) || new Map();
    }
}

describe('BrowserResourceProvider', () => {
    let mockFetcher: MockResourceFetcher;
    let provider: BrowserResourceProvider;

    beforeEach(() => {
        mockFetcher = new MockResourceFetcher();
        provider = new BrowserResourceProvider(mockFetcher);
    });

    describe('Constructor', () => {
        it('should create provider with fetcher', () => {
            expect(provider).toBeDefined();
        });
    });

    describe('fetchTheme', () => {
        it('should return theme files as Uint8Array map', async () => {
            const themeFiles = new Map<string, Blob>();
            themeFiles.set('content.css', createMockBlob('/* theme css */'));
            themeFiles.set('default.js', createMockBlob('// theme js'));
            mockFetcher.setTheme('base', themeFiles);

            const result = await provider.fetchTheme('base');

            expect(result).toBeInstanceOf(Map);
            expect(result.has('content.css')).toBe(true);
            expect(result.has('default.js')).toBe(true);
        });

        it('should convert Blob to Uint8Array', async () => {
            const cssContent = '/* CSS content */';
            const themeFiles = new Map<string, Blob>();
            themeFiles.set('content.css', createMockBlob(cssContent));
            mockFetcher.setTheme('blue', themeFiles);

            const result = await provider.fetchTheme('blue');
            const buffer = result.get('content.css');

            expect(buffer).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(buffer!)).toBe(cssContent);
        });

        it('should return empty map for missing theme', async () => {
            const result = await provider.fetchTheme('nonexistent');

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });
    });

    describe('fetchIdeviceResources', () => {
        it('should return idevice files as Uint8Array map', async () => {
            const ideviceFiles = new Map<string, Blob>();
            ideviceFiles.set('idevice.js', createMockBlob('// idevice script'));
            ideviceFiles.set('idevice.css', createMockBlob('/* idevice styles */'));
            mockFetcher.setIdevice('FreeTextIdevice', ideviceFiles);

            const result = await provider.fetchIdeviceResources('FreeTextIdevice');

            expect(result).toBeInstanceOf(Map);
            expect(result.has('idevice.js')).toBe(true);
            expect(result.has('idevice.css')).toBe(true);
        });

        it('should return empty map for missing idevice', async () => {
            const result = await provider.fetchIdeviceResources('NonexistentIdevice');

            expect(result.size).toBe(0);
        });
    });

    describe('fetchBaseLibraries', () => {
        it('should return base library files', async () => {
            const libs = new Map<string, Blob>();
            libs.set('jquery/jquery.min.js', createMockBlob('// jquery'));
            libs.set('common.js', createMockBlob('// common'));
            mockFetcher.setBaseLibraries(libs);

            const result = await provider.fetchBaseLibraries();

            expect(result.has('jquery/jquery.min.js')).toBe(true);
            expect(result.has('common.js')).toBe(true);
        });
    });

    describe('fetchScormFiles', () => {
        it('should return SCORM files', async () => {
            const scormFiles = new Map<string, Blob>();
            scormFiles.set('SCORM_API_wrapper.js', createMockBlob('// SCORM API'));
            scormFiles.set('SCOFunctions.js', createMockBlob('// SCO Functions'));
            mockFetcher.setScormFiles(scormFiles);

            const result = await provider.fetchScormFiles();

            expect(result.has('SCORM_API_wrapper.js')).toBe(true);
            expect(result.has('SCOFunctions.js')).toBe(true);
        });
    });

    describe('fetchLibraryFiles', () => {
        it('should return requested library files', async () => {
            const libFiles = new Map<string, Blob>();
            libFiles.set('lib1.js', createMockBlob('// lib1'));
            libFiles.set('lib2.js', createMockBlob('// lib2'));
            mockFetcher.setLibraryFiles(libFiles);

            const result = await provider.fetchLibraryFiles(['lib1.js', 'lib2.js']);

            expect(result.has('lib1.js')).toBe(true);
            expect(result.has('lib2.js')).toBe(true);
        });
    });

    describe('fetchLibraryDirectory', () => {
        it('should return all files from library directory', async () => {
            const libDir = new Map<string, Blob>();
            libDir.set('lib.js', createMockBlob('// lib'));
            libDir.set('lib.css', createMockBlob('/* lib */'));
            mockFetcher.setLibraryDirectory('exe_effects', libDir);

            const result = await provider.fetchLibraryDirectory('exe_effects');

            expect(result.has('lib.js')).toBe(true);
            expect(result.has('lib.css')).toBe(true);
        });
    });

    describe('fetchSchemas', () => {
        it('should return schema files for format', async () => {
            const schemas = new Map<string, Blob>();
            schemas.set('imscp.xsd', createMockBlob('<?xml?>'));
            schemas.set('adlcp.xsd', createMockBlob('<?xml?>'));
            mockFetcher.setSchemas('scorm12', schemas);

            const result = await provider.fetchSchemas('scorm12');

            expect(result.has('imscp.xsd')).toBe(true);
            expect(result.has('adlcp.xsd')).toBe(true);
        });
    });

    describe('Blob to Uint8Array conversion', () => {
        it('should correctly convert text Blob to Uint8Array', async () => {
            const textContent = 'Hello World';
            const files = new Map<string, Blob>();
            files.set('text.txt', createMockBlob(textContent));
            mockFetcher.setBaseLibraries(files);

            const result = await provider.fetchBaseLibraries();
            const buffer = result.get('text.txt');

            expect(new TextDecoder().decode(buffer!)).toBe(textContent);
        });

        it('should correctly convert binary Blob to Uint8Array', async () => {
            const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
            const files = new Map<string, Blob>();
            files.set('image.png', new Blob([binaryData]));
            mockFetcher.setBaseLibraries(files);

            const result = await provider.fetchBaseLibraries();
            const buffer = result.get('image.png');

            expect(buffer?.[0]).toBe(0x89);
            expect(buffer?.[1]).toBe(0x50);
            expect(buffer?.[2]).toBe(0x4e);
            expect(buffer?.[3]).toBe(0x47);
        });

        it('should handle multiple files in parallel', async () => {
            const files = new Map<string, Blob>();
            for (let i = 0; i < 10; i++) {
                files.set(`file${i}.txt`, createMockBlob(`Content ${i}`));
            }
            mockFetcher.setBaseLibraries(files);

            const result = await provider.fetchBaseLibraries();

            expect(result.size).toBe(10);
            for (let i = 0; i < 10; i++) {
                expect(new TextDecoder().decode(result.get(`file${i}.txt`)!)).toBe(`Content ${i}`);
            }
        });
    });

    describe('Error handling', () => {
        it('should handle empty results gracefully', async () => {
            const result = await provider.fetchTheme('nonexistent');

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });
    });

    describe('normalizeIdeviceType', () => {
        it('should normalize FreeTextIdevice to text', () => {
            const result = provider.normalizeIdeviceType('FreeTextIdevice');
            expect(result).toBe('text');
        });

        it('should normalize TextIdevice to text', () => {
            const result = provider.normalizeIdeviceType('TextIdevice');
            expect(result).toBe('text');
        });

        it('should normalize freetextidevice (lowercase) to text', () => {
            const result = provider.normalizeIdeviceType('freetextidevice');
            expect(result).toBe('text');
        });

        it('should normalize freetext to text', () => {
            const result = provider.normalizeIdeviceType('freetext');
            expect(result).toBe('text');
        });

        it('should strip Idevice suffix and return normalized name', () => {
            const result = provider.normalizeIdeviceType('QuestionIdevice');
            expect(result).toBe('question');
        });

        it('should handle lowercase input', () => {
            const result = provider.normalizeIdeviceType('galleryidevice');
            expect(result).toBe('gallery');
        });

        it('should return normalized name for unknown type', () => {
            const result = provider.normalizeIdeviceType('CustomComponent');
            expect(result).toBe('customcomponent');
        });

        it('should handle empty string by returning text', () => {
            const result = provider.normalizeIdeviceType('');
            expect(result).toBe('text');
        });
    });
});
