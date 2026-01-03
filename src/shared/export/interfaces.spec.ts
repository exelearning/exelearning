/**
 * Tests for export interfaces and constants
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportAsset,
    Html5ExportOptions,
    ScormExportOptions,
    Epub3ExportOptions,
    ExportResult,
} from './interfaces';

import {
    ExportFormat,
    EXPORT_FORMAT_INFO,
    getIdeviceConfig,
    LIBRARY_PATTERNS,
    BASE_LIBRARIES,
    SCORM_LIBRARIES,
    MIME_TO_EXTENSION,
    getExtensionFromMime,
    SCORM_12_NAMESPACES,
    SCORM_2004_NAMESPACES,
    IMS_NAMESPACES,
    LOM_NAMESPACES,
} from './constants';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../services/idevice-config';
import * as fs from 'fs-extra';
import * as path from 'path';

// Path to real iDevices for integration testing
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

describe('Export Interfaces', () => {
    describe('ExportDocument interface', () => {
        it('should accept valid document implementations', () => {
            const mockDocument: ExportDocument = {
                getMetadata: () => ({
                    title: 'Test Project',
                    author: 'Test Author',
                    language: 'en',
                    theme: 'base',
                }),
                getNavigation: () => [],
            };

            expect(mockDocument.getMetadata().title).toBe('Test Project');
            expect(mockDocument.getNavigation()).toEqual([]);
        });
    });

    describe('ExportMetadata interface', () => {
        it('should accept minimal metadata', () => {
            const metadata: ExportMetadata = {
                title: 'Test',
                author: 'Author',
                language: 'en',
                theme: 'base',
            };

            expect(metadata.title).toBe('Test');
        });

        it('should accept full metadata with optional fields', () => {
            const metadata: ExportMetadata = {
                title: 'Test Project',
                author: 'Test Author',
                language: 'en',
                theme: 'cedec',
                customStyles: '.custom { color: red; }',
                license: 'CC-BY-SA',
                description: 'A test project',
                keywords: 'test, project',
                category: 'Education',
                exelearningVersion: '4.0.0',
                odeIdentifier: 'ode-123',
                createdAt: '2024-01-01',
                modifiedAt: '2024-01-02',
                addAccessibilityToolbar: true,
                scormIdentifier: 'scorm-123',
                masteryScore: 80,
            };

            expect(metadata.addAccessibilityToolbar).toBe(true);
            expect(metadata.masteryScore).toBe(80);
        });
    });

    describe('ExportPage interface', () => {
        it('should accept valid page structure', () => {
            const page: ExportPage = {
                id: 'page-1',
                title: 'First Page',
                parentId: null,
                order: 0,
                blocks: [],
            };

            expect(page.id).toBe('page-1');
            expect(page.parentId).toBeNull();
        });

        it('should accept page with nested blocks and components', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'FreeTextIdevice',
                order: 0,
                content: '<p>Hello World</p>',
                properties: { visibility: 'true' },
            };

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Introduction',
                order: 0,
                components: [component],
            };

            const page: ExportPage = {
                id: 'page-1',
                title: 'First Page',
                parentId: null,
                order: 0,
                blocks: [block],
            };

            expect(page.blocks.length).toBe(1);
            expect(page.blocks[0].components.length).toBe(1);
            expect(page.blocks[0].components[0].type).toBe('FreeTextIdevice');
        });
    });

    describe('ExportAsset interface', () => {
        it('should accept valid asset structure', () => {
            const asset: ExportAsset = {
                id: 'asset-uuid-123',
                filename: 'image.png',
                originalPath: 'content/resources/asset-uuid-123/image.png',
                mime: 'image/png',
                data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
            };

            expect(asset.id).toBe('asset-uuid-123');
            expect(asset.mime).toBe('image/png');
        });
    });

    describe('ExportOptions interfaces', () => {
        it('should accept HTML5 export options', () => {
            const options: Html5ExportOptions = {
                filename: 'my-project',
                includeDataAttributes: true,
                singlePage: false,
            };

            expect(options.singlePage).toBe(false);
        });

        it('should accept SCORM export options', () => {
            const options: ScormExportOptions = {
                version: '1.2',
                masteryScore: 80,
                scormIdentifier: 'SCORM-001',
            };

            expect(options.version).toBe('1.2');
            expect(options.masteryScore).toBe(80);
        });

        it('should accept SCORM 2004 options', () => {
            const options: ScormExportOptions = {
                version: '2004',
            };

            expect(options.version).toBe('2004');
        });

        it('should accept EPUB3 export options', () => {
            const options: Epub3ExportOptions = {
                coverImage: 'cover.jpg',
                publisher: 'Test Publisher',
                bookId: 'book-123',
            };

            expect(options.publisher).toBe('Test Publisher');
        });
    });

    describe('ExportResult interface', () => {
        it('should accept successful result', () => {
            const result: ExportResult = {
                success: true,
                filename: 'project_web.zip',
                data: new Uint8Array([1, 2, 3]),
            };

            expect(result.success).toBe(true);
        });

        it('should accept error result', () => {
            const result: ExportResult = {
                success: false,
                error: 'Export failed: invalid document',
            };

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});

describe('Export Constants', () => {
    describe('ExportFormat enum', () => {
        it('should have all expected formats', () => {
            expect(ExportFormat.HTML5).toBe('html5');
            expect(ExportFormat.HTML5_SINGLE_PAGE).toBe('html5-sp');
            expect(ExportFormat.SCORM_12).toBe('scorm12');
            expect(ExportFormat.SCORM_2004).toBe('scorm2004');
            expect(ExportFormat.IMS).toBe('ims');
            expect(ExportFormat.EPUB3).toBe('epub3');
            expect(ExportFormat.ELPX).toBe('elpx');
        });
    });

    describe('EXPORT_FORMAT_INFO', () => {
        it('should have info for all formats', () => {
            expect(EXPORT_FORMAT_INFO[ExportFormat.HTML5].name).toBe('HTML5 Website');
            expect(EXPORT_FORMAT_INFO[ExportFormat.HTML5].extension).toBe('.zip');
            expect(EXPORT_FORMAT_INFO[ExportFormat.HTML5].suffix).toBe('_web');

            expect(EXPORT_FORMAT_INFO[ExportFormat.SCORM_12].name).toBe('SCORM 1.2');
            expect(EXPORT_FORMAT_INFO[ExportFormat.EPUB3].extension).toBe('.epub');
            expect(EXPORT_FORMAT_INFO[ExportFormat.ELPX].extension).toBe('.elpx');
        });
    });

    // NOTE: IDEVICE_CONFIGS tests removed - configs now loaded dynamically from config.xml
    // See src/services/idevice-config.spec.ts for comprehensive tests

    describe('getIdeviceConfig', () => {
        // Load real configs for tests that need them
        beforeAll(() => {
            if (fs.existsSync(REAL_IDEVICES_PATH)) {
                loadIdeviceConfigs(REAL_IDEVICES_PATH);
            }
        });

        afterAll(() => {
            resetIdeviceConfigCache();
        });

        it('should return known config for known type', () => {
            // Use 'text' which exists in config.xml
            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
            expect(config.componentType).toBe('json');
        });

        it('should return derived config for unknown type', () => {
            const config = getIdeviceConfig('UnknownIdevice');
            expect(config.cssClass).toBe('unknown');
            expect(config.template).toBe('unknown.html');
        });

        it('should handle hyphenated types', () => {
            const config = getIdeviceConfig('image-gallery');
            expect(config.cssClass).toBe('image-gallery');
        });
    });

    describe('LIBRARY_PATTERNS', () => {
        it('should have effects pattern', () => {
            const effects = LIBRARY_PATTERNS.find(p => p.name === 'exe_effects');
            expect(effects).toBeDefined();
            expect(effects?.type).toBe('class');
            expect(effects?.pattern).toBe('exe-fx');
        });

        it('should have media pattern', () => {
            const media = LIBRARY_PATTERNS.find(p => p.name === 'exe_media');
            expect(media).toBeDefined();
            expect(media?.files.length).toBeGreaterThan(0);
        });

        it('should have regex pattern for media links', () => {
            const mediaLink = LIBRARY_PATTERNS.find(p => p.name === 'exe_media_link');
            expect(mediaLink).toBeDefined();
            expect(mediaLink?.type).toBe('regex');
            expect(mediaLink?.pattern).toBeInstanceOf(RegExp);
        });

        it('should have math pattern with regex', () => {
            const math = LIBRARY_PATTERNS.find(p => p.name === 'exe_math');
            expect(math).toBeDefined();
            expect(math?.type).toBe('regex');
        });

        it('should have at least 15 library patterns', () => {
            expect(LIBRARY_PATTERNS.length).toBeGreaterThanOrEqual(15);
        });
    });

    describe('BASE_LIBRARIES', () => {
        it('should include jQuery', () => {
            expect(BASE_LIBRARIES).toContain('jquery/jquery.min.js');
        });

        it('should include Bootstrap', () => {
            expect(BASE_LIBRARIES.some(f => f.includes('bootstrap'))).toBe(true);
        });

        it('should include common scripts', () => {
            expect(BASE_LIBRARIES).toContain('common.js');
            expect(BASE_LIBRARIES).toContain('common_i18n.js');
        });
    });

    describe('SCORM_LIBRARIES', () => {
        it('should include SCORM API wrapper', () => {
            expect(SCORM_LIBRARIES).toContain('scorm/SCORM_API_wrapper.js');
        });
    });

    describe('MIME_TO_EXTENSION', () => {
        it('should map common image types', () => {
            expect(MIME_TO_EXTENSION['image/jpeg']).toBe('.jpg');
            expect(MIME_TO_EXTENSION['image/png']).toBe('.png');
            expect(MIME_TO_EXTENSION['image/svg+xml']).toBe('.svg');
        });

        it('should map video types', () => {
            expect(MIME_TO_EXTENSION['video/mp4']).toBe('.mp4');
            expect(MIME_TO_EXTENSION['video/webm']).toBe('.webm');
        });

        it('should map audio types', () => {
            expect(MIME_TO_EXTENSION['audio/mpeg']).toBe('.mp3');
        });
    });

    describe('getExtensionFromMime', () => {
        it('should return correct extension for known mime', () => {
            expect(getExtensionFromMime('image/png')).toBe('.png');
            expect(getExtensionFromMime('application/pdf')).toBe('.pdf');
        });

        it('should return .bin for unknown mime', () => {
            expect(getExtensionFromMime('application/unknown')).toBe('.bin');
        });
    });

    describe('XML Namespaces', () => {
        it('should have SCORM 1.2 namespaces', () => {
            expect(SCORM_12_NAMESPACES.imscp).toContain('imscp_rootv1p1p2');
            expect(SCORM_12_NAMESPACES.adlcp).toContain('adlcp_rootv1p2');
        });

        it('should have SCORM 2004 namespaces', () => {
            expect(SCORM_2004_NAMESPACES.imscp).toContain('imscp_v1p1');
            expect(SCORM_2004_NAMESPACES.adlcp).toContain('adlcp_v1p3');
        });

        it('should have IMS namespaces', () => {
            expect(IMS_NAMESPACES.imscp).toContain('imscp_v1p1');
        });

        it('should have LOM namespaces', () => {
            expect(LOM_NAMESPACES.lom).toContain('LOM');
        });
    });
});
