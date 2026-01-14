/**
 * Tests for constants.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
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
    IDEVICE_TYPE_MAP,
    normalizeIdeviceType,
} from './constants';
import { resetIdeviceConfigCache, loadIdeviceConfigs } from '../../services/idevice-config';

// Path to real iDevices for integration testing
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

describe('Constants', () => {
    describe('ExportFormat enum', () => {
        it('should have all expected export formats', () => {
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
        it('should have info for all export formats', () => {
            expect(EXPORT_FORMAT_INFO[ExportFormat.HTML5]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.HTML5_SINGLE_PAGE]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.SCORM_12]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.SCORM_2004]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.IMS]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.EPUB3]).toBeDefined();
            expect(EXPORT_FORMAT_INFO[ExportFormat.ELPX]).toBeDefined();
        });

        it('should have correct HTML5 format info', () => {
            const html5Info = EXPORT_FORMAT_INFO[ExportFormat.HTML5];
            expect(html5Info.name).toBe('HTML5 Website');
            expect(html5Info.extension).toBe('.zip');
            expect(html5Info.suffix).toBe('_web');
            expect(html5Info.description).toContain('HTML5');
        });

        it('should have correct SCORM 1.2 format info', () => {
            const scormInfo = EXPORT_FORMAT_INFO[ExportFormat.SCORM_12];
            expect(scormInfo.name).toBe('SCORM 1.2');
            expect(scormInfo.extension).toBe('.zip');
            expect(scormInfo.suffix).toBe('_scorm');
        });

        it('should have correct EPUB3 format info', () => {
            const epubInfo = EXPORT_FORMAT_INFO[ExportFormat.EPUB3];
            expect(epubInfo.name).toBe('EPUB3');
            expect(epubInfo.extension).toBe('.epub');
        });

        it('should have correct ELPX format info', () => {
            const elpxInfo = EXPORT_FORMAT_INFO[ExportFormat.ELPX];
            expect(elpxInfo.name).toBe('eXeLearning Project');
            expect(elpxInfo.extension).toBe('.elpx');
        });

        it('all formats should have required properties', () => {
            for (const format of Object.values(ExportFormat)) {
                const info = EXPORT_FORMAT_INFO[format];
                expect(info.name).toBeDefined();
                expect(info.extension).toBeDefined();
                expect(info.suffix).toBeDefined();
                expect(info.description).toBeDefined();
            }
        });
    });

    // NOTE: IDEVICE_CONFIGS tests removed - configs now loaded dynamically from config.xml
    // See src/services/idevice-config.spec.ts for comprehensive tests

    describe('getIdeviceConfig (re-exported from idevice-config service)', () => {
        // Reset cache before and after each test
        beforeEach(() => {
            resetIdeviceConfigCache();
        });

        afterEach(() => {
            resetIdeviceConfigCache();
        });

        it('should return config for known idevice type (loaded from config.xml)', () => {
            // Skip if real iDevices path doesn't exist
            if (!fs.existsSync(REAL_IDEVICES_PATH)) {
                console.log('Skipping test - real iDevices path not found');
                return;
            }

            // Explicitly load from real path
            loadIdeviceConfigs(REAL_IDEVICES_PATH);

            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
            expect(config.componentType).toBe('json');
        });

        it('should return derived config for unknown idevice type', () => {
            // This test uses fallback behavior, no real configs needed
            const config = getIdeviceConfig('CustomUnknownIdevice');
            expect(config.cssClass).toBe('customunknown');
            // Default componentType for unknown iDevices is 'html' (not 'json')
            expect(config.componentType).toBe('html');
            expect(config.template).toBe('customunknown.html');
        });

        it('should handle idevice types with "Idevice" suffix', () => {
            // This test uses fallback behavior, no real configs needed
            const config = getIdeviceConfig('TestIdevice');
            expect(config.cssClass).toBe('test');
            expect(config.template).toBe('test.html');
        });
    });

    describe('LIBRARY_PATTERNS', () => {
        it('should have patterns for common libraries', () => {
            const patternNames = LIBRARY_PATTERNS.map(p => p.name);
            expect(patternNames).toContain('exe_effects');
            expect(patternNames).toContain('exe_games');
            expect(patternNames).toContain('exe_lightbox');
            expect(patternNames).toContain('exe_tooltips');
            expect(patternNames).toContain('exe_media');
            expect(patternNames).toContain('mermaid');
        });

        it('all patterns should have required properties', () => {
            for (const pattern of LIBRARY_PATTERNS) {
                expect(pattern.name).toBeDefined();
                expect(pattern.type).toBeDefined();
                expect(pattern.pattern).toBeDefined();
                expect(pattern.files).toBeDefined();
                expect(Array.isArray(pattern.files)).toBe(true);
            }
        });

        it('should have class type patterns', () => {
            const classPatterns = LIBRARY_PATTERNS.filter(p => p.type === 'class');
            expect(classPatterns.length).toBeGreaterThan(0);
        });

        it('should have regex type patterns', () => {
            const regexPatterns = LIBRARY_PATTERNS.filter(p => p.type === 'regex');
            expect(regexPatterns.length).toBeGreaterThan(0);
        });

        it('should have rel type patterns', () => {
            const relPatterns = LIBRARY_PATTERNS.filter(p => p.type === 'rel');
            expect(relPatterns.length).toBeGreaterThan(0);
        });

        it('exe_effects pattern should match exe-fx class', () => {
            const effectsPattern = LIBRARY_PATTERNS.find(p => p.name === 'exe_effects');
            expect(effectsPattern?.pattern).toBe('exe-fx');
        });

        it('exe_math pattern should match LaTeX expressions', () => {
            const mathPattern = LIBRARY_PATTERNS.find(p => p.name === 'exe_math');
            expect(mathPattern?.type).toBe('regex');
            expect(mathPattern?.pattern).toBeInstanceOf(RegExp);
        });

        it('exe_elpx_download pattern should match download-source-file iDevice', () => {
            const elpxPattern = LIBRARY_PATTERNS.find(p => p.name === 'exe_elpx_download');
            expect(elpxPattern).toBeDefined();
            expect(elpxPattern?.type).toBe('class');
            expect(elpxPattern?.pattern).toBe('exe-download-package-link');
            expect(elpxPattern?.files).toContain('fflate/fflate.umd.js');
            expect(elpxPattern?.files).toContain('exe_elpx_download/exe_elpx_download.js');
        });
    });

    describe('BASE_LIBRARIES', () => {
        it('should include jQuery', () => {
            expect(BASE_LIBRARIES).toContain('jquery/jquery.min.js');
        });

        it('should include common.js', () => {
            expect(BASE_LIBRARIES).toContain('common.js');
        });

        it('should include Bootstrap', () => {
            expect(BASE_LIBRARIES.some(lib => lib.includes('bootstrap'))).toBe(true);
        });

        it('should have correct order (jQuery before Bootstrap)', () => {
            const jqueryIndex = BASE_LIBRARIES.indexOf('jquery/jquery.min.js');
            const bootstrapIndex = BASE_LIBRARIES.findIndex(lib => lib.includes('bootstrap.bundle'));
            expect(jqueryIndex).toBeLessThan(bootstrapIndex);
        });
    });

    describe('SCORM_LIBRARIES', () => {
        it('should include SCORM API wrapper', () => {
            expect(SCORM_LIBRARIES).toContain('scorm/SCORM_API_wrapper.js');
        });

        it('should include SCO functions', () => {
            expect(SCORM_LIBRARIES).toContain('scorm/SCOFunctions.js');
        });
    });

    describe('MIME_TO_EXTENSION', () => {
        it('should map common image types', () => {
            expect(MIME_TO_EXTENSION['image/jpeg']).toBe('.jpg');
            expect(MIME_TO_EXTENSION['image/png']).toBe('.png');
            expect(MIME_TO_EXTENSION['image/gif']).toBe('.gif');
            expect(MIME_TO_EXTENSION['image/webp']).toBe('.webp');
            expect(MIME_TO_EXTENSION['image/svg+xml']).toBe('.svg');
        });

        it('should map common video types', () => {
            expect(MIME_TO_EXTENSION['video/mp4']).toBe('.mp4');
            expect(MIME_TO_EXTENSION['video/webm']).toBe('.webm');
            expect(MIME_TO_EXTENSION['video/ogg']).toBe('.ogv');
        });

        it('should map common audio types', () => {
            expect(MIME_TO_EXTENSION['audio/mpeg']).toBe('.mp3');
            expect(MIME_TO_EXTENSION['audio/ogg']).toBe('.ogg');
            expect(MIME_TO_EXTENSION['audio/wav']).toBe('.wav');
        });

        it('should map document types', () => {
            expect(MIME_TO_EXTENSION['application/pdf']).toBe('.pdf');
            expect(MIME_TO_EXTENSION['text/html']).toBe('.html');
            expect(MIME_TO_EXTENSION['text/css']).toBe('.css');
            expect(MIME_TO_EXTENSION['application/javascript']).toBe('.js');
        });
    });

    describe('getExtensionFromMime', () => {
        it('should return correct extension for known MIME types', () => {
            expect(getExtensionFromMime('image/jpeg')).toBe('.jpg');
            expect(getExtensionFromMime('image/png')).toBe('.png');
            expect(getExtensionFromMime('application/pdf')).toBe('.pdf');
        });

        it('should return .bin for unknown MIME types', () => {
            expect(getExtensionFromMime('unknown/type')).toBe('.bin');
            expect(getExtensionFromMime('application/x-custom')).toBe('.bin');
        });
    });

    describe('XML Namespaces', () => {
        describe('SCORM_12_NAMESPACES', () => {
            it('should have imscp namespace', () => {
                expect(SCORM_12_NAMESPACES.imscp).toContain('imscp');
            });

            it('should have adlcp namespace', () => {
                expect(SCORM_12_NAMESPACES.adlcp).toContain('adlnet');
            });

            it('should have imsmd namespace', () => {
                expect(SCORM_12_NAMESPACES.imsmd).toContain('imsmd');
            });

            it('should have xsi namespace', () => {
                expect(SCORM_12_NAMESPACES.xsi).toContain('XMLSchema-instance');
            });
        });

        describe('SCORM_2004_NAMESPACES', () => {
            it('should have all SCORM 2004 namespaces', () => {
                expect(SCORM_2004_NAMESPACES.imscp).toContain('imscp');
                expect(SCORM_2004_NAMESPACES.adlcp).toContain('adlcp');
                expect(SCORM_2004_NAMESPACES.adlseq).toContain('adlseq');
                expect(SCORM_2004_NAMESPACES.adlnav).toContain('adlnav');
                expect(SCORM_2004_NAMESPACES.imsss).toContain('imsss');
                expect(SCORM_2004_NAMESPACES.xsi).toContain('XMLSchema-instance');
            });
        });

        describe('IMS_NAMESPACES', () => {
            it('should have IMS namespaces', () => {
                expect(IMS_NAMESPACES.imscp).toContain('imscp');
                expect(IMS_NAMESPACES.imsmd).toContain('imsmd');
                expect(IMS_NAMESPACES.xsi).toContain('XMLSchema-instance');
            });
        });

        describe('LOM_NAMESPACES', () => {
            it('should have LOM namespace', () => {
                expect(LOM_NAMESPACES.lom).toContain('imsmd');
            });

            it('should have xsi namespace', () => {
                expect(LOM_NAMESPACES.xsi).toContain('XMLSchema-instance');
            });
        });
    });

    describe('iDevice Type Mapping', () => {
        describe('IDEVICE_TYPE_MAP', () => {
            it('should map freetext variations to text', () => {
                expect(IDEVICE_TYPE_MAP['freetext']).toBe('text');
                expect(IDEVICE_TYPE_MAP['text']).toBe('text');
                expect(IDEVICE_TYPE_MAP['freetextidevice']).toBe('text');
                expect(IDEVICE_TYPE_MAP['textidevice']).toBe('text');
            });

            it('should map Spanish iDevice names to English', () => {
                expect(IDEVICE_TYPE_MAP['adivina']).toBe('guess');
                expect(IDEVICE_TYPE_MAP['listacotejo']).toBe('checklist');
                expect(IDEVICE_TYPE_MAP['ordena']).toBe('sort');
                expect(IDEVICE_TYPE_MAP['clasifica']).toBe('classify');
                expect(IDEVICE_TYPE_MAP['relaciona']).toBe('relate');
            });

            it('should map plural to singular', () => {
                expect(IDEVICE_TYPE_MAP['rubrics']).toBe('rubric');
            });

            it('should map alternative names', () => {
                expect(IDEVICE_TYPE_MAP['download-package']).toBe('download-source-file');
            });
        });

        describe('normalizeIdeviceType', () => {
            it('should return text for empty input', () => {
                expect(normalizeIdeviceType('')).toBe('text');
                expect(normalizeIdeviceType(null as unknown as string)).toBe('text');
                expect(normalizeIdeviceType(undefined as unknown as string)).toBe('text');
            });

            it('should normalize to lowercase', () => {
                expect(normalizeIdeviceType('TEXT')).toBe('text');
                expect(normalizeIdeviceType('FreeText')).toBe('text');
            });

            it('should strip idevice suffix', () => {
                expect(normalizeIdeviceType('TextIdevice')).toBe('text');
                expect(normalizeIdeviceType('freetext-idevice')).toBe('text');
            });

            it('should map Spanish names', () => {
                expect(normalizeIdeviceType('adivina-activity')).toBe('guess');
                expect(normalizeIdeviceType('ADIVINA-ACTIVITY')).toBe('guess');
                expect(normalizeIdeviceType('listacotejo-activity')).toBe('checklist');
            });

            it('should return canonical name for known types', () => {
                expect(normalizeIdeviceType('rubrics')).toBe('rubric');
                expect(normalizeIdeviceType('download-package')).toBe('download-source-file');
            });

            it('should return original (normalized) for unknown types', () => {
                expect(normalizeIdeviceType('custom-idevice-type')).toBe('custom-idevice-type');
                expect(normalizeIdeviceType('my-special-widget')).toBe('my-special-widget');
            });
        });
    });
});
