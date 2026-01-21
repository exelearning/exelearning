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
    formatLicenseText,
    getLicenseClass,
    getLicenseUrl,
    LICENSE_REGISTRY,
    shouldShowLicenseFooter,
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

            it('should map legacy Python eXeLearning iDevice types', () => {
                // JsIdevice was a text iDevice in old Python eXeLearning (pre-v3.0)
                expect(IDEVICE_TYPE_MAP['jsidevice']).toBe('text');
                expect(IDEVICE_TYPE_MAP['js']).toBe('text');

                // GalleryImages from old Python format
                expect(IDEVICE_TYPE_MAP['galleryimages']).toBe('image-gallery');
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

    describe('License Registry', () => {
        describe('LICENSE_REGISTRY', () => {
            it('should have all CC 4.0 licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 4.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 4.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 4.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 4.0']).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 4.0'],
                ).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 4.0'],
                ).toBeDefined();
            });

            it('should have all CC 3.0 licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 3.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 3.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 3.0']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 3.0']).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 3.0'],
                ).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 3.0'],
                ).toBeDefined();
            });

            it('should have all CC 2.5 licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 2.5']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 2.5']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 2.5']).toBeDefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 2.5']).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 2.5'],
                ).toBeDefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 2.5'],
                ).toBeDefined();
            });

            it('should have GPL, EUPL, and GFDL licenses', () => {
                expect(LICENSE_REGISTRY['gnu/gpl']).toBeDefined();
                expect(LICENSE_REGISTRY['free software license gpl']).toBeDefined();
                expect(LICENSE_REGISTRY['free software license eupl']).toBeDefined();
                expect(LICENSE_REGISTRY['dual free content license gpl and eupl']).toBeDefined();
                expect(LICENSE_REGISTRY['license gfdl']).toBeDefined();
            });

            it('should have other license types', () => {
                expect(LICENSE_REGISTRY['public domain']).toBeDefined();
                expect(LICENSE_REGISTRY['propietary license']).toBeDefined();
                expect(LICENSE_REGISTRY['intellectual property license']).toBeDefined();
                expect(LICENSE_REGISTRY['not appropriate']).toBeDefined();
                expect(LICENSE_REGISTRY['other free software licenses']).toBeDefined();
            });

            it('should have correct structure for each entry', () => {
                for (const [key, entry] of Object.entries(LICENSE_REGISTRY)) {
                    expect(entry.displayName).toBeDefined();
                    expect(typeof entry.displayName).toBe('string');
                    expect(typeof entry.url).toBe('string');
                    expect(typeof entry.cssClass).toBe('string');
                }
            });

            it('should include short codes in displayName for CC licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 4.0'].displayName).toContain('(BY)');
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 4.0'].displayName).toContain(
                    '(BY-SA)',
                );
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 4.0'].displayName).toContain(
                    '(BY-NC)',
                );
            });

            it('should have correct URLs for CC 3.0 licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 3.0'].url).toBe(
                    'https://creativecommons.org/licenses/by/3.0/',
                );
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 3.0'].url).toBe(
                    'https://creativecommons.org/licenses/by-sa/3.0/',
                );
            });

            it('should have correct URLs for CC 2.5 licenses', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 2.5'].url).toBe(
                    'https://creativecommons.org/licenses/by/2.5/',
                );
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 2.5'].url).toBe(
                    'https://creativecommons.org/licenses/by-sa/2.5/',
                );
            });

            it('should have empty URLs for licenses without official URLs', () => {
                expect(LICENSE_REGISTRY['free software license eupl'].url).toBe('');
                expect(LICENSE_REGISTRY['free software license gpl'].url).toBe('');
                expect(LICENSE_REGISTRY['license gfdl'].url).toBe('');
                expect(LICENSE_REGISTRY['intellectual property license'].url).toBe('');
                expect(LICENSE_REGISTRY['not appropriate'].url).toBe('');
            });

            it('should have total of 28 licenses', () => {
                // 6 CC 4.0 + 6 CC 3.0 + 6 CC 2.5 + 2 GPL + 1 EUPL + 1 dual + 1 GFDL
                // + 1 public domain + 1 propietary + 1 IP + 1 not appropriate + 1 other = 28
                expect(Object.keys(LICENSE_REGISTRY).length).toBe(28);
            });

            it('should mark CC 3.0 licenses as legacy', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 3.0'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 3.0'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 3.0'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 3.0'].legacy).toBe(true);
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 3.0'].legacy,
                ).toBe(true);
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 3.0'].legacy,
                ).toBe(true);
            });

            it('should mark CC 2.5 licenses as legacy', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 2.5'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 2.5'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 2.5'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 2.5'].legacy).toBe(true);
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 2.5'].legacy,
                ).toBe(true);
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 2.5'].legacy,
                ).toBe(true);
            });

            it('should mark GPL, EUPL, GFDL and other free software licenses as legacy', () => {
                expect(LICENSE_REGISTRY['gnu/gpl'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['free software license gpl'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['free software license eupl'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['dual free content license gpl and eupl'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['license gfdl'].legacy).toBe(true);
                expect(LICENSE_REGISTRY['other free software licenses'].legacy).toBe(true);
            });

            it('should NOT mark CC 4.0 licenses as legacy (available in dropdown)', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 4.0'].legacy).toBeUndefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - share alike 4.0'].legacy).toBeUndefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non derived work 4.0'].legacy).toBeUndefined();
                expect(LICENSE_REGISTRY['creative commons: attribution - non commercial 4.0'].legacy).toBeUndefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non commercial - share alike 4.0'].legacy,
                ).toBeUndefined();
                expect(
                    LICENSE_REGISTRY['creative commons: attribution - non derived work - non commercial 4.0'].legacy,
                ).toBeUndefined();
            });

            it('should NOT mark public domain, propietary, and not appropriate as legacy', () => {
                expect(LICENSE_REGISTRY['public domain'].legacy).toBeUndefined();
                expect(LICENSE_REGISTRY['propietary license'].legacy).toBeUndefined();
                expect(LICENSE_REGISTRY['not appropriate'].legacy).toBeUndefined();
            });

            it('should mark intellectual property license as legacy', () => {
                expect(LICENSE_REGISTRY['intellectual property license'].legacy).toBe(true);
            });

            it('should mark propietary license and not appropriate with hideInFooter', () => {
                expect(LICENSE_REGISTRY['propietary license'].hideInFooter).toBe(true);
                expect(LICENSE_REGISTRY['not appropriate'].hideInFooter).toBe(true);
            });

            it('should NOT mark other licenses with hideInFooter', () => {
                expect(LICENSE_REGISTRY['creative commons: attribution 4.0'].hideInFooter).toBeUndefined();
                expect(LICENSE_REGISTRY['public domain'].hideInFooter).toBeUndefined();
                expect(LICENSE_REGISTRY['intellectual property license'].hideInFooter).toBeUndefined();
            });

            it('should have exactly 19 legacy licenses and 9 non-legacy licenses', () => {
                const legacyCount = Object.values(LICENSE_REGISTRY).filter(e => e.legacy === true).length;
                const nonLegacyCount = Object.values(LICENSE_REGISTRY).filter(e => !e.legacy).length;
                // CC 3.0: 6 licenses
                // CC 2.5: 6 licenses
                // GNU/GPL: 1, free software gpl: 1, EUPL: 1, dual: 1, GFDL: 1, other: 1, IP: 1 = 7
                // Total legacy: 6 + 6 + 7 = 19
                // Non-legacy: CC 4.0 (6) + public domain (1) + propietary (1) + not appropriate (1) = 9
                // Total: 19 + 9 = 28
                expect(legacyCount).toBe(19);
                expect(nonLegacyCount).toBe(9);
            });
        });
    });

    describe('License Functions', () => {
        describe('getLicenseUrl', () => {
            it('should return empty string for empty license (no license specified)', () => {
                expect(getLicenseUrl('')).toBe('');
                expect(getLicenseUrl(null as unknown as string)).toBe('');
            });

            it('should return correct URL for CC BY-SA license', () => {
                expect(getLicenseUrl('creative commons: attribution - share alike 4.0')).toBe(
                    'https://creativecommons.org/licenses/by-sa/4.0/',
                );
            });

            it('should return correct URL for CC BY license', () => {
                expect(getLicenseUrl('creative commons: attribution 4.0')).toBe(
                    'https://creativecommons.org/licenses/by/4.0/',
                );
            });

            it('should return correct URL for CC BY-NC license', () => {
                expect(getLicenseUrl('creative commons: attribution - non commercial 4.0')).toBe(
                    'https://creativecommons.org/licenses/by-nc/4.0/',
                );
            });

            it('should return correct URL for CC BY-NC-SA license', () => {
                expect(getLicenseUrl('creative commons: attribution - non commercial - share alike 4.0')).toBe(
                    'https://creativecommons.org/licenses/by-nc-sa/4.0/',
                );
            });

            it('should return correct URL for CC BY-ND license', () => {
                expect(getLicenseUrl('creative commons: attribution - non derived work 4.0')).toBe(
                    'https://creativecommons.org/licenses/by-nd/4.0/',
                );
            });

            it('should return correct URL for CC BY-NC-ND license', () => {
                expect(getLicenseUrl('creative commons: attribution - non derived work - non commercial 4.0')).toBe(
                    'https://creativecommons.org/licenses/by-nc-nd/4.0/',
                );
            });

            it('should return correct URL for public domain', () => {
                expect(getLicenseUrl('public domain')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
            });

            it('should return correct URL for GNU/GPL license', () => {
                expect(getLicenseUrl('gnu/gpl')).toBe('https://www.gnu.org/licenses/gpl.html');
            });

            it('should handle case-insensitive matching', () => {
                expect(getLicenseUrl('CREATIVE COMMONS: ATTRIBUTION 4.0')).toBe(
                    'https://creativecommons.org/licenses/by/4.0/',
                );
                expect(getLicenseUrl('Public Domain')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
            });

            it('should fallback to keyword matching for non-exact matches', () => {
                expect(getLicenseUrl('some license with share alike')).toBe(
                    'https://creativecommons.org/licenses/by-sa/4.0/',
                );
                expect(getLicenseUrl('license with by-nc-nd')).toBe(
                    'https://creativecommons.org/licenses/by-nc-nd/4.0/',
                );
            });

            // New tests for CC 3.0 and 2.5 licenses
            it('should return correct URLs for CC 3.0 licenses', () => {
                expect(getLicenseUrl('creative commons: attribution 3.0')).toBe(
                    'https://creativecommons.org/licenses/by/3.0/',
                );
                expect(getLicenseUrl('creative commons: attribution - share alike 3.0')).toBe(
                    'https://creativecommons.org/licenses/by-sa/3.0/',
                );
                expect(getLicenseUrl('creative commons: attribution - non commercial 3.0')).toBe(
                    'https://creativecommons.org/licenses/by-nc/3.0/',
                );
            });

            it('should return correct URLs for CC 2.5 licenses', () => {
                expect(getLicenseUrl('creative commons: attribution 2.5')).toBe(
                    'https://creativecommons.org/licenses/by/2.5/',
                );
                expect(getLicenseUrl('creative commons: attribution - share alike 2.5')).toBe(
                    'https://creativecommons.org/licenses/by-sa/2.5/',
                );
            });

            // New tests for licenses without URLs
            it('should return empty string for licenses without URLs', () => {
                expect(getLicenseUrl('free software license eupl')).toBe('');
                expect(getLicenseUrl('free software license gpl')).toBe('');
                expect(getLicenseUrl('license gfdl')).toBe('');
                expect(getLicenseUrl('intellectual property license')).toBe('');
                expect(getLicenseUrl('not appropriate')).toBe('');
                expect(getLicenseUrl('propietary license')).toBe('');
            });

            it('should return GPL URL for gnu/gpl but empty for other GPL variants', () => {
                expect(getLicenseUrl('gnu/gpl')).toBe('https://www.gnu.org/licenses/gpl.html');
                // 'free software license gpl' has no URL in original eXe
                expect(getLicenseUrl('free software license gpl')).toBe('');
            });
        });

        describe('formatLicenseText', () => {
            it('should convert short codes to full display text', () => {
                expect(formatLicenseText('CC-BY-SA')).toBe('creative commons: attribution - share alike 4.0');
                expect(formatLicenseText('CC-BY')).toBe('creative commons: attribution 4.0');
                expect(formatLicenseText('CC-BY-NC')).toBe('creative commons: attribution - non commercial 4.0');
                expect(formatLicenseText('CC-BY-ND')).toBe('creative commons: attribution - non derived work 4.0');
                expect(formatLicenseText('CC-BY-NC-SA')).toBe(
                    'creative commons: attribution - non commercial - share alike 4.0',
                );
                expect(formatLicenseText('CC-BY-NC-ND')).toBe(
                    'creative commons: attribution - non derived work - non commercial 4.0',
                );
            });

            it('should handle case insensitivity', () => {
                expect(formatLicenseText('cc-by-sa')).toBe('creative commons: attribution - share alike 4.0');
                expect(formatLicenseText('CC-BY-SA')).toBe('creative commons: attribution - share alike 4.0');
                expect(formatLicenseText('Cc-By-Sa')).toBe('creative commons: attribution - share alike 4.0');
            });

            it('should pass through already full names (with short codes)', () => {
                expect(formatLicenseText('creative commons: attribution - share alike 4.0')).toBe(
                    'creative commons: attribution - share alike 4.0 (BY-SA)',
                );
                expect(formatLicenseText('public domain')).toBe('public domain');
                expect(formatLicenseText('propietary license')).toBe('propietary license');
            });

            it('should handle CC0 / public domain', () => {
                expect(formatLicenseText('CC0')).toBe('public domain');
                expect(formatLicenseText('cc-0')).toBe('public domain');
                expect(formatLicenseText('public domain')).toBe('public domain');
            });

            it('should return empty string for empty input (no license specified)', () => {
                expect(formatLicenseText('')).toBe('');
            });

            it('should trim whitespace', () => {
                expect(formatLicenseText('  CC-BY-SA  ')).toBe('creative commons: attribution - share alike 4.0');
            });

            // New tests for CC 3.0 and 2.5 licenses
            it('should pass through CC 3.0 licenses (with short codes)', () => {
                expect(formatLicenseText('creative commons: attribution 3.0')).toBe(
                    'creative commons: attribution 3.0 (BY)',
                );
                expect(formatLicenseText('creative commons: attribution - share alike 3.0')).toBe(
                    'creative commons: attribution - share alike 3.0 (BY-SA)',
                );
            });

            it('should pass through CC 2.5 licenses (with short codes)', () => {
                expect(formatLicenseText('creative commons: attribution 2.5')).toBe(
                    'creative commons: attribution 2.5 (BY)',
                );
                expect(formatLicenseText('creative commons: attribution - share alike 2.5')).toBe(
                    'creative commons: attribution - share alike 2.5 (BY-SA)',
                );
            });

            // New tests for GPL, EUPL, GFDL, and other licenses
            it('should format GPL licenses', () => {
                expect(formatLicenseText('gnu/gpl')).toBe('gnu/gpl');
                expect(formatLicenseText('free software license gpl')).toBe('free software license GPL');
            });

            it('should format EUPL license', () => {
                expect(formatLicenseText('free software license eupl')).toBe('free software license EUPL');
            });

            it('should format dual GPL/EUPL license', () => {
                expect(formatLicenseText('dual free content license gpl and eupl')).toBe(
                    'dual free content license GPL and EUPL',
                );
            });

            it('should format GFDL license', () => {
                expect(formatLicenseText('license gfdl')).toBe('license GFDL');
            });

            it('should format other license types', () => {
                expect(formatLicenseText('intellectual property license')).toBe('intellectual property license');
                expect(formatLicenseText('not appropriate')).toBe('not appropriate');
                expect(formatLicenseText('other free software licenses')).toBe('other free software licenses');
            });

            it('should fallback to keyword matching for partial matches', () => {
                expect(formatLicenseText('some eupl license')).toBe('free software license EUPL');
                expect(formatLicenseText('gfdl documentation')).toBe('license GFDL');
                expect(formatLicenseText('gpl open source')).toBe('gnu/gpl');
            });
        });

        describe('getLicenseClass', () => {
            // getLicenseClass looks up cssClass from LICENSE_REGISTRY by license name

            it('should return correct CSS class for CC 4.0 licenses', () => {
                expect(getLicenseClass('creative commons: attribution 4.0')).toBe('cc');
                expect(getLicenseClass('creative commons: attribution - share alike 4.0')).toBe('cc cc-by-sa');
                expect(getLicenseClass('creative commons: attribution - non commercial 4.0')).toBe('cc cc-by-nc');
                expect(getLicenseClass('creative commons: attribution - non derived work 4.0')).toBe('cc cc-by-nd');
                expect(getLicenseClass('creative commons: attribution - non commercial - share alike 4.0')).toBe(
                    'cc cc-by-nc-sa',
                );
                expect(getLicenseClass('creative commons: attribution - non derived work - non commercial 4.0')).toBe(
                    'cc cc-by-nc-nd',
                );
            });

            it('should return correct CSS class for CC 3.0 licenses', () => {
                expect(getLicenseClass('creative commons: attribution 3.0')).toBe('cc');
                expect(getLicenseClass('creative commons: attribution - share alike 3.0')).toBe('cc cc-by-sa');
                expect(getLicenseClass('creative commons: attribution - non commercial 3.0')).toBe('cc cc-by-nc');
            });

            it('should return correct CSS class for CC 2.5 licenses', () => {
                expect(getLicenseClass('creative commons: attribution 2.5')).toBe('cc');
                expect(getLicenseClass('creative commons: attribution - share alike 2.5')).toBe('cc cc-by-sa');
            });

            it('should return cc cc-0 for public domain', () => {
                expect(getLicenseClass('public domain')).toBe('cc cc-0');
            });

            it('should return empty class for propietary license (shows text without icon)', () => {
                expect(getLicenseClass('propietary license')).toBe('');
            });

            it('should handle case insensitivity', () => {
                expect(getLicenseClass('CREATIVE COMMONS: ATTRIBUTION 4.0')).toBe('cc');
                expect(getLicenseClass('Public Domain')).toBe('cc cc-0');
            });

            it('should return empty string for empty input', () => {
                expect(getLicenseClass('')).toBe('');
            });

            it('should return empty string for licenses without icons', () => {
                expect(getLicenseClass('gnu/gpl')).toBe('');
                expect(getLicenseClass('free software license eupl')).toBe('');
                expect(getLicenseClass('license gfdl')).toBe('');
                expect(getLicenseClass('intellectual property license')).toBe('');
                expect(getLicenseClass('not appropriate')).toBe('');
                expect(getLicenseClass('other free software licenses')).toBe('');
            });

            it('should return empty for unknown licenses', () => {
                expect(getLicenseClass('unknown license')).toBe('');
                expect(getLicenseClass('some random text')).toBe('');
            });
        });

        describe('shouldShowLicenseFooter', () => {
            it('should return false for empty license', () => {
                expect(shouldShowLicenseFooter('')).toBe(false);
                expect(shouldShowLicenseFooter(null as unknown as string)).toBe(false);
                expect(shouldShowLicenseFooter(undefined as unknown as string)).toBe(false);
            });

            it('should return false for propietary license', () => {
                expect(shouldShowLicenseFooter('propietary license')).toBe(false);
                expect(shouldShowLicenseFooter('Propietary License')).toBe(false);
                expect(shouldShowLicenseFooter('PROPIETARY LICENSE')).toBe(false);
            });

            it('should return false for not appropriate', () => {
                expect(shouldShowLicenseFooter('not appropriate')).toBe(false);
                expect(shouldShowLicenseFooter('Not Appropriate')).toBe(false);
                expect(shouldShowLicenseFooter('NOT APPROPRIATE')).toBe(false);
            });

            it('should return true for CC licenses', () => {
                expect(shouldShowLicenseFooter('creative commons: attribution 4.0')).toBe(true);
                expect(shouldShowLicenseFooter('creative commons: attribution - share alike 4.0')).toBe(true);
            });

            it('should return true for public domain', () => {
                expect(shouldShowLicenseFooter('public domain')).toBe(true);
            });

            it('should return true for legacy licenses (they still display)', () => {
                expect(shouldShowLicenseFooter('creative commons: attribution 3.0')).toBe(true);
                expect(shouldShowLicenseFooter('gnu/gpl')).toBe(true);
                expect(shouldShowLicenseFooter('intellectual property license')).toBe(true);
            });

            it('should return true for unknown licenses', () => {
                expect(shouldShowLicenseFooter('some random license')).toBe(true);
            });
        });
    });
});
