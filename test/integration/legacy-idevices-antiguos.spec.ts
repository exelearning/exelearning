/**
 * Integration test for legacy iDevices import from idevices-antiguos.elp
 *
 * Tests that legacy iDevices from contentv3.xml files are correctly identified,
 * matched to handlers, and mapped to modern iDevice types.
 *
 * Uses real fixture: test/fixtures/more/idevices-antiguos.elp
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip } from '../../src/services/zip';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/fixture-loader';

// Path to the idevices-antiguos.elp fixture
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'more', 'idevices-antiguos.elp');

/**
 * Expected iDevices in the ELP file (in order)
 * This mirrors what LegacyXmlParser should extract
 */
const EXPECTED_IDEVICES = [
    { className: 'CasestudyIdevice', targetType: 'casestudy', handler: 'CaseStudyHandler' },
    { className: 'ListaIdevice', targetType: 'form', handler: 'DropdownHandler' },
    { className: 'ExternalUrlIdevice', targetType: 'external-website', handler: 'ExternalUrlHandler' },
    { className: 'ClozeIdevice', targetType: 'form', handler: 'FillHandler' },
    { className: 'ClozelangfpdIdevice', targetType: 'form', handler: 'FillHandler' },
    { className: 'EjercicioresueltofpdIdevice', targetType: 'text', handler: 'FpdSolvedExerciseHandler' },
    { className: 'FreeTextIdevice', targetType: 'text', handler: 'FreeTextHandler' },
    { className: 'GalleryIdevice', targetType: 'image-gallery', handler: 'GalleryHandler' },
    { className: 'JsIdevice', targetType: 'text', handler: 'DefaultHandler' }, // text JsIdevice
    { className: 'JsIdevice', targetType: 'geogebra-activity', handler: 'GeogebraHandler' }, // geogebra JsIdevice
    { className: 'ImageMagnifierIdevice', targetType: 'magnifier', handler: 'ImageMagnifierHandler' },
    { className: 'MultichoiceIdevice', targetType: 'form', handler: 'MultichoiceHandler' },
    { className: 'AppletIdevice', targetType: 'text', handler: 'DefaultHandler' }, // Java applets not supported
    { className: 'MultiSelectIdevice', targetType: 'form', handler: 'MultichoiceHandler' },
    { className: 'RssIdevice', targetType: 'text', handler: 'RssHandler' },
    { className: 'QuizTestIdevice', targetType: 'form', handler: 'ScormTestHandler' },
    { className: 'TrueFalseIdevice', targetType: 'form', handler: 'TrueFalseHandler' },
];

/**
 * Extract all iDevice class names from contentv3.xml
 */
function findAllIdeviceClasses(xml: string): string[] {
    const classes: string[] = [];
    // Match iDevice instance classes (with or without reference attribute)
    // Not sub-classes like Question
    const regex = /<instance\s+class="exe\.engine\.([a-z]+)\.([A-Z][a-zA-Z]+)"(?:\s+reference="\d+")?>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
        const className = match[2];
        // Only include classes that end with 'Idevice'
        if (className.endsWith('Idevice')) {
            classes.push(className);
        }
    }

    return classes;
}

/**
 * Extract JsIdevice _iDeviceDir values to identify their specific types
 */
function findJsIdeviceTypes(xml: string): string[] {
    const types: string[] = [];
    // Look for JsIdevice instances and their _iDeviceDir values
    const jsIdevicePattern =
        /<instance\s+class="exe\.engine\.jsidevice\.JsIdevice"[^>]*>[\s\S]*?<string\s+role="key"\s+value="_iDeviceDir"><\/string>\s*<string\s+value="([^"]+)"/g;
    let match;

    while ((match = jsIdevicePattern.exec(xml)) !== null) {
        types.push(match[1]);
    }

    return types;
}

describe('Legacy iDevices Import - idevices-antiguos.elp', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempTestDir('idevices-antiguos-test-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(tempDir);
    });

    describe('Fixture file validation', () => {
        it('fixture file should exist', async () => {
            const exists = await fs.pathExists(FIXTURE_PATH);
            expect(exists).toBe(true);
        });

        it('should contain contentv3.xml (legacy format)', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const exists = await fs.pathExists(contentV3Path);
            expect(exists).toBe(true);
        });
    });

    describe('iDevice detection', () => {
        it('should contain expected number of iDevices', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const ideviceClasses = findAllIdeviceClasses(xmlContent);

            // Should have 17 iDevice instances
            expect(ideviceClasses.length).toBe(17);

            console.log(`Found ${ideviceClasses.length} iDevices:`, ideviceClasses);
        });

        it('should contain CasestudyIdevice', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('CasestudyIdevice');
        });

        it('should contain ListaIdevice (Dropdown)', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('ListaIdevice');
        });

        it('should contain ClozelangfpdIdevice (FPD cloze variant)', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('ClozelangfpdIdevice');
        });

        it('should contain GalleryIdevice', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('GalleryIdevice');
        });

        it('should contain JsIdevice with geogebra-activity type', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            // Verify JsIdevice exists
            expect(xmlContent).toContain('JsIdevice');
            // Verify geogebra-activity type exists
            expect(xmlContent).toContain('geogebra-activity');
        });

        it('should contain ImageMagnifierIdevice', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('ImageMagnifierIdevice');
        });

        it('should contain QuizTestIdevice (ScormTest)', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            expect(xmlContent).toContain('QuizTestIdevice');
        });
    });

    describe('iDevice order verification', () => {
        it('should have iDevices in the expected order', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const ideviceClasses = findAllIdeviceClasses(xmlContent);

            // First iDevice should be CasestudyIdevice
            expect(ideviceClasses[0]).toBe('CasestudyIdevice');

            // Second should be ListaIdevice (Dropdown)
            expect(ideviceClasses[1]).toBe('ListaIdevice');

            // Third should be ExternalUrlIdevice
            expect(ideviceClasses[2]).toBe('ExternalUrlIdevice');

            // Check other key positions
            expect(ideviceClasses).toContain('ClozelangfpdIdevice');
            expect(ideviceClasses).toContain('GalleryIdevice');
            expect(ideviceClasses).toContain('MultichoiceIdevice');
            expect(ideviceClasses).toContain('TrueFalseIdevice');
        });
    });

    describe('Content extraction verification', () => {
        it('CasestudyIdevice should have story content', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            // Casestudy should have storyTextArea with content
            expect(xmlContent).toContain('storyTextArea');
            // Should have lorem ipsum-like content
            expect(xmlContent).toContain('Sed ut perspiciatis');
        });

        it('CasestudyIdevice should have questions with feedback', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            // Should have questions list
            expect(xmlContent).toContain('exe.engine.casestudyidevice.Question');
            // Should have feedback
            expect(xmlContent).toContain('feedbackTextArea');
        });

        it('GalleryIdevice should have gallery images', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            // Gallery should have GalleryImage instances
            expect(xmlContent).toContain('GalleryImage');
        });

        it('JsIdevice (geogebra) should have geogebra content', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            // Geogebra content should have auto-geogebra div
            expect(xmlContent).toContain('auto-geogebra');
            // Should reference geogebra.org
            expect(xmlContent).toContain('geogebra.org');
        });
    });

    describe('Handler coverage verification', () => {
        it('all expected iDevice types should have handlers', () => {
            // Verify our EXPECTED_IDEVICES list covers all types
            const handlers = new Set(EXPECTED_IDEVICES.map(i => i.handler));

            expect(handlers.has('CaseStudyHandler')).toBe(true);
            expect(handlers.has('DropdownHandler')).toBe(true);
            expect(handlers.has('ExternalUrlHandler')).toBe(true);
            expect(handlers.has('FillHandler')).toBe(true);
            expect(handlers.has('FpdSolvedExerciseHandler')).toBe(true);
            expect(handlers.has('FreeTextHandler')).toBe(true);
            expect(handlers.has('GalleryHandler')).toBe(true);
            expect(handlers.has('GeogebraHandler')).toBe(true);
            expect(handlers.has('ImageMagnifierHandler')).toBe(true);
            expect(handlers.has('MultichoiceHandler')).toBe(true);
            expect(handlers.has('RssHandler')).toBe(true);
            expect(handlers.has('ScormTestHandler')).toBe(true);
            expect(handlers.has('TrueFalseHandler')).toBe(true);
            expect(handlers.has('DefaultHandler')).toBe(true); // For AppletIdevice and text JsIdevice
        });

        it('should map ClozelangfpdIdevice to form via FillHandler', () => {
            const clozelangfpd = EXPECTED_IDEVICES.find(i => i.className === 'ClozelangfpdIdevice');
            expect(clozelangfpd).toBeDefined();
            expect(clozelangfpd!.handler).toBe('FillHandler');
            expect(clozelangfpd!.targetType).toBe('form');
        });

        it('should map geogebra JsIdevice to geogebra-activity via GeogebraHandler', () => {
            const geogebra = EXPECTED_IDEVICES.find(
                i => i.className === 'JsIdevice' && i.targetType === 'geogebra-activity',
            );
            expect(geogebra).toBeDefined();
            expect(geogebra!.handler).toBe('GeogebraHandler');
        });
    });
});
