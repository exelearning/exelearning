/**
 * LomMetadataGenerator Tests
 *
 * Tests for LOM (Learning Object Metadata) imslrm.xml generation.
 */

/* eslint-disable no-undef */

const LomMetadataGenerator = require('./LomMetadataGenerator');

describe('LomMetadataGenerator', () => {
  const sampleMetadata = {
    title: 'Test LOM Package',
    language: 'es',
    author: 'John Doe',
    description: 'A test learning object',
    license: 'CC-BY-SA',
  };

  describe('constructor', () => {
    test('creates instance with projectId and metadata', () => {
      const generator = new LomMetadataGenerator('proj123', sampleMetadata);

      expect(generator.projectId).toBe('proj123');
      expect(generator.metadata).toBe(sampleMetadata);
    });

    test('generates projectId if not provided', () => {
      const generator = new LomMetadataGenerator(null, sampleMetadata);

      expect(generator.projectId).toBeTruthy();
      expect(generator.projectId.startsWith('exe-')).toBe(true);
    });
  });

  describe('generate', () => {
    test('generates valid XML declaration', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    test('includes LOM namespace', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('xmlns="http://ltsc.ieee.org/xsd/LOM"');
    });

    test('includes all main sections', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('<general');
      expect(xml).toContain('<lifeCycle>');
      expect(xml).toContain('<metaMetadata');
      expect(xml).toContain('<technical');
      expect(xml).toContain('<educational>');
      expect(xml).toContain('<rights');
    });
  });

  describe('generateGeneral', () => {
    test('includes identifier section', () => {
      const generator = new LomMetadataGenerator('proj123', sampleMetadata);

      const xml = generator.generateGeneral();

      expect(xml).toContain('<identifier>');
      expect(xml).toContain('<catalog');
      expect(xml).toContain('<entry');
    });

    test('includes title with language', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateGeneral();

      expect(xml).toContain('<title>');
      expect(xml).toContain('Test LOM Package');
      expect(xml).toContain('language="es"');
    });

    test('includes language element', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateGeneral();

      expect(xml).toContain('<language>es</language>');
    });

    test('includes description', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateGeneral();

      expect(xml).toContain('<description>');
      expect(xml).toContain('A test learning object');
    });

    test('includes aggregationLevel', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateGeneral();

      expect(xml).toContain('<aggregationLevel');
      expect(xml).toContain('LOM-ESv1.0');
    });
  });

  describe('generateLifeCycle', () => {
    test('includes contribute section with author role', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateLifeCycle();

      expect(xml).toContain('<lifeCycle>');
      expect(xml).toContain('<contribute>');
      expect(xml).toContain('<role');
      expect(xml).toContain('author');
    });

    test('includes entity with vCard format', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateLifeCycle();

      expect(xml).toContain('<entity>');
      expect(xml).toContain('BEGIN:VCARD');
      expect(xml).toContain('FN:John Doe');
      expect(xml).toContain('END:VCARD');
    });

    test('includes date with dateTime', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateLifeCycle();

      expect(xml).toContain('<date>');
      expect(xml).toContain('<dateTime');
    });
  });

  describe('generateMetaMetadata', () => {
    test('includes creator role', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateMetaMetadata();

      expect(xml).toContain('<metaMetadata');
      expect(xml).toContain('creator');
    });

    test('includes metadataSchema', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateMetaMetadata();

      expect(xml).toContain('<metadataSchema>LOM-ESv1.0</metadataSchema>');
    });

    test('includes language', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateMetaMetadata();

      expect(xml).toContain('<language>es</language>');
    });
  });

  describe('generateTechnical', () => {
    test('includes eXe Learning platform requirement', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateTechnical();

      expect(xml).toContain('<technical');
      expect(xml).toContain('<otherPlatformRequirements>');
      expect(xml).toContain('eXe Learning');
    });
  });

  describe('generateEducational', () => {
    test('includes language element', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateEducational();

      expect(xml).toContain('<educational>');
      expect(xml).toContain('<language>es</language>');
    });
  });

  describe('generateRights', () => {
    test('includes copyrightAndOtherRestrictions', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateRights();

      expect(xml).toContain('<rights');
      expect(xml).toContain('<copyrightAndOtherRestrictions');
      expect(xml).toContain('CC-BY-SA');
    });

    test('includes access section', () => {
      const generator = new LomMetadataGenerator('test', sampleMetadata);

      const xml = generator.generateRights();

      expect(xml).toContain('<access');
      expect(xml).toContain('<accessType');
      expect(xml).toContain('universal');
    });
  });

  describe('getCurrentDateTime', () => {
    test('returns ISO formatted date', () => {
      const generator = new LomMetadataGenerator('test', {});

      const dateTime = generator.getCurrentDateTime();

      // Should match pattern: YYYY-MM-DDTHH:MM:SS.00+HH:MM
      expect(dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{2}[+-]\d{2}:\d{2}$/);
    });
  });

  describe('getLocalizedString', () => {
    test('returns Spanish translation for es language', () => {
      const generator = new LomMetadataGenerator('test', {});

      const result = generator.getLocalizedString('Metadata creation date', 'es');

      expect(result).toBe('Fecha de creación de los metadatos');
    });

    test('returns English for unknown language', () => {
      const generator = new LomMetadataGenerator('test', {});

      const result = generator.getLocalizedString('Metadata creation date', 'xx');

      expect(result).toBe('Metadata creation date');
    });

    test('returns key for unknown string', () => {
      const generator = new LomMetadataGenerator('test', {});

      const result = generator.getLocalizedString('Unknown key', 'en');

      expect(result).toBe('Unknown key');
    });
  });

  describe('escapeXml', () => {
    test('escapes XML special characters', () => {
      const generator = new LomMetadataGenerator('test', {});

      expect(generator.escapeXml('Test & <>"\'chars')).toBe('Test &amp; &lt;&gt;&quot;&#039;chars');
    });

    test('returns empty string for null', () => {
      const generator = new LomMetadataGenerator('test', {});

      expect(generator.escapeXml(null)).toBe('');
    });
  });
});
