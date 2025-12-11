/**
 * Tests for LomMetadataGenerator
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LomMetadataGenerator } from './LomMetadata';

describe('LomMetadataGenerator', () => {
    let generator: LomMetadataGenerator;

    beforeEach(() => {
        generator = new LomMetadataGenerator('test-project-123', {
            title: 'Test Course',
            description: 'A comprehensive test course',
            author: 'Test Author',
            language: 'en',
            license: 'CC-BY-SA-4.0',
            catalogName: 'TestCatalog',
            catalogEntry: 'TEST-001',
        });
    });

    describe('generate', () => {
        it('should generate valid XML declaration', () => {
            const xml = generator.generate();

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        });

        it('should include LOM namespace', () => {
            const xml = generator.generate();

            expect(xml).toContain('xmlns="http://ltsc.ieee.org/xsd/LOM"');
            expect(xml).toContain('xsi:schemaLocation="http://ltsc.ieee.org/xsd/LOM lomCustom.xsd"');
        });

        it('should close with </lom>', () => {
            const xml = generator.generate();

            expect(xml).toContain('</lom>');
        });
    });

    describe('generateGeneral', () => {
        it('should include identifier with catalog and entry', () => {
            const xml = generator.generate();

            expect(xml).toContain('<identifier>');
            expect(xml).toContain('<catalog uniqueElementName="catalog">TestCatalog</catalog>');
            expect(xml).toContain('<entry uniqueElementName="entry">TEST-001</entry>');
        });

        it('should include title with language', () => {
            const xml = generator.generate();

            expect(xml).toContain('<title>');
            expect(xml).toContain('<string language="en">Test Course</string>');
        });

        it('should include language element', () => {
            const xml = generator.generate();

            expect(xml).toContain('<language>en</language>');
        });

        it('should include description', () => {
            const xml = generator.generate();

            expect(xml).toContain('<description>');
            expect(xml).toContain('<string language="en">A comprehensive test course</string>');
        });

        it('should include aggregation level', () => {
            const xml = generator.generate();

            expect(xml).toContain('<aggregationLevel uniqueElementName="aggregationLevel">');
            expect(xml).toContain('<source uniqueElementName="source">LOM-ESv1.0</source>');
            expect(xml).toContain('<value uniqueElementName="value">2</value>');
        });

        it('should use default values when not provided', () => {
            const minimalGen = new LomMetadataGenerator('minimal-id', {});
            const xml = minimalGen.generate();

            expect(xml).toContain('<catalog uniqueElementName="catalog">none</catalog>');
            expect(xml).toContain('<entry uniqueElementName="entry">ODE-minimal-id</entry>');
        });
    });

    describe('generateLifeCycle', () => {
        it('should include contribute section with author role', () => {
            const xml = generator.generate();

            expect(xml).toContain('<lifeCycle>');
            expect(xml).toContain('<contribute>');
            expect(xml).toContain('<value uniqueElementName="value">author</value>');
        });

        it('should include vCard entity', () => {
            const xml = generator.generate();

            expect(xml).toContain('<entity>');
            expect(xml).toContain('BEGIN:VCARD');
            expect(xml).toContain('FN:Test Author');
            expect(xml).toContain('END:VCARD');
        });

        it('should include date with ISO format', () => {
            const xml = generator.generate();

            expect(xml).toContain('<date>');
            expect(xml).toContain('<dateTime uniqueElementName="dateTime">');
            // Should match ISO date pattern
            expect(xml).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{2}[+-]\d{2}:\d{2}/);
        });
    });

    describe('generateMetaMetadata', () => {
        it('should include creator role', () => {
            const xml = generator.generate();

            expect(xml).toContain('<metaMetadata uniqueElementName="metaMetadata">');
            expect(xml).toContain('<value uniqueElementName="value">creator</value>');
        });

        it('should include metadata schema', () => {
            const xml = generator.generate();

            expect(xml).toContain('<metadataSchema>LOM-ESv1.0</metadataSchema>');
        });
    });

    describe('generateTechnical', () => {
        it('should include platform requirements', () => {
            const xml = generator.generate();

            expect(xml).toContain('<technical uniqueElementName="technical">');
            expect(xml).toContain('<otherPlatformRequirements>');
            expect(xml).toContain('editor: eXe Learning');
        });
    });

    describe('generateEducational', () => {
        it('should include language', () => {
            const xml = generator.generate();

            expect(xml).toContain('<educational>');
            expect(xml).toContain('<language>en</language>');
        });
    });

    describe('generateRights', () => {
        it('should include copyright and restrictions', () => {
            const xml = generator.generate();

            expect(xml).toContain('<rights uniqueElementName="rights">');
            expect(xml).toContain('<copyrightAndOtherRestrictions');
            expect(xml).toContain('<value uniqueElementName="value">CC-BY-SA-4.0</value>');
        });

        it('should include access section', () => {
            const xml = generator.generate();

            expect(xml).toContain('<access uniqueElementName="access">');
            expect(xml).toContain('<accessType uniqueElementName="accessType">');
            expect(xml).toContain('<value uniqueElementName="value">universal</value>');
        });
    });

    describe('getCurrentDateTime', () => {
        it('should return valid ISO datetime with timezone', () => {
            const dateTime = generator.getCurrentDateTime();

            // Should match pattern: YYYY-MM-DDTHH:mm:ss.00+/-HH:MM
            expect(dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{2}[+-]\d{2}:\d{2}$/);
        });
    });

    describe('getLocalizedString', () => {
        it('should return English string for English language', () => {
            const result = generator.getLocalizedString('Metadata creation date', 'en');
            expect(result).toBe('Metadata creation date');
        });

        it('should return Spanish string for Spanish language', () => {
            const result = generator.getLocalizedString('Metadata creation date', 'es');
            expect(result).toBe('Fecha de creación de los metadatos');
        });

        it('should return French string for French language', () => {
            const result = generator.getLocalizedString('Metadata creation date', 'fr');
            expect(result).toBe('Date de création des métadonnées');
        });

        it('should return English for unknown language', () => {
            const result = generator.getLocalizedString('Metadata creation date', 'xx');
            expect(result).toBe('Metadata creation date');
        });

        it('should return key for unknown translation key', () => {
            const result = generator.getLocalizedString('Unknown key', 'en');
            expect(result).toBe('Unknown key');
        });

        it('should handle language codes with country suffix', () => {
            const result = generator.getLocalizedString('Metadata creation date', 'es-ES');
            expect(result).toBe('Fecha de creación de los metadatos');
        });
    });

    describe('escapeXml', () => {
        it('should escape XML special characters', () => {
            const generatorWithSpecialChars = new LomMetadataGenerator('test', {
                title: 'Test & Course <1>',
                description: 'Description with "quotes"',
            });
            const xml = generatorWithSpecialChars.generate();

            expect(xml).toContain('Test &amp; Course &lt;1&gt;');
            expect(xml).toContain('Description with &quot;quotes&quot;');
        });

        it('should handle empty strings', () => {
            expect(generator.escapeXml('')).toBe('');
        });
    });

    describe('generateId', () => {
        it('should generate unique IDs with exe- prefix', () => {
            const gen = new LomMetadataGenerator('', {});
            const xml = gen.generate();

            expect(xml).toMatch(/ODE-exe-[a-z0-9]+/);
        });
    });

    describe('different languages', () => {
        it('should generate correct metadata for Spanish', () => {
            const esGenerator = new LomMetadataGenerator('es-project', {
                title: 'Curso de Prueba',
                language: 'es',
            });
            const xml = esGenerator.generate();

            expect(xml).toContain('<language>es</language>');
            expect(xml).toContain('language="es"');
        });

        it('should generate correct metadata for German', () => {
            const deGenerator = new LomMetadataGenerator('de-project', {
                title: 'Testkurs',
                language: 'de',
            });
            const xml = deGenerator.generate();

            expect(xml).toContain('<language>de</language>');
            expect(xml).toContain('Erstellungsdatum der Metadaten');
        });
    });
});
