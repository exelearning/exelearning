/**
 * Scorm12ManifestGenerator Tests
 *
 * Tests for SCORM 1.2 imsmanifest.xml generation.
 */

/* eslint-disable no-undef */

const Scorm12ManifestGenerator = require('./Scorm12ManifestGenerator');

describe('Scorm12ManifestGenerator', () => {
  const samplePages = [
    { id: 'page1', title: 'Home', parentId: null, visible: true },
    { id: 'page2', title: 'About', parentId: null, visible: true },
    { id: 'page3', title: 'Sub Page', parentId: 'page1', visible: true },
  ];

  const sampleMetadata = {
    title: 'Test SCORM Package',
    language: 'en',
    author: 'Test Author',
    description: 'A test package',
    license: 'CC-BY-SA',
  };

  describe('constructor', () => {
    test('creates instance with projectId, pages, and metadata', () => {
      const generator = new Scorm12ManifestGenerator('proj123', samplePages, sampleMetadata);

      expect(generator.projectId).toBe('proj123');
      expect(generator.pages).toBe(samplePages);
      expect(generator.metadata).toBe(sampleMetadata);
    });

    test('generates projectId if not provided', () => {
      const generator = new Scorm12ManifestGenerator(null, samplePages, sampleMetadata);

      expect(generator.projectId).toBeTruthy();
      expect(generator.projectId.startsWith('exe-')).toBe(true);
    });
  });

  describe('generate', () => {
    test('generates valid XML declaration', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    test('includes SCORM 1.2 namespaces', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"');
      expect(xml).toContain('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"');
      expect(xml).toContain('xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"');
    });

    test('includes manifest identifier', () => {
      const generator = new Scorm12ManifestGenerator('proj123', samplePages, sampleMetadata);

      const xml = generator.generate();

      expect(xml).toContain('identifier="eXe-MANIFEST-proj123"');
    });
  });

  describe('generateMetadata', () => {
    test('includes ADL SCORM schema', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateMetadata();

      expect(xml).toContain('<schema>ADL SCORM</schema>');
      expect(xml).toContain('<schemaversion>1.2</schemaversion>');
    });

    test('includes LOM location reference', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateMetadata();

      expect(xml).toContain('<adlcp:location>imslrm.xml</adlcp:location>');
    });
  });

  describe('generateOrganizations', () => {
    test('includes organization with hierarchical structure', () => {
      const generator = new Scorm12ManifestGenerator('proj123', samplePages, sampleMetadata);

      const xml = generator.generateOrganizations();

      expect(xml).toContain('structure="hierarchical"');
      expect(xml).toContain('identifier="eXe-proj123"');
    });

    test('includes project title', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateOrganizations();

      expect(xml).toContain('<title>Test SCORM Package</title>');
    });
  });

  describe('generateItems', () => {
    test('generates items for all pages', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateItems();

      expect(xml).toContain('identifier="ITEM-page1"');
      expect(xml).toContain('identifier="ITEM-page2"');
      expect(xml).toContain('identifier="ITEM-page3"');
    });

    test('includes identifierref for resources', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateItems();

      expect(xml).toContain('identifierref="RES-page1"');
      expect(xml).toContain('identifierref="RES-page2"');
    });

    test('includes isvisible attribute', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateItems();

      expect(xml).toContain('isvisible="true"');
    });

    test('nests child pages under parent', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateItems();

      // page3 should be nested inside page1's item (child comes after parent opening)
      const page1Start = xml.indexOf('ITEM-page1');
      const page3Pos = xml.indexOf('ITEM-page3');
      const page2Pos = xml.indexOf('ITEM-page2');

      // page3 (child of page1) should appear after page1 but before page2
      expect(page3Pos).toBeGreaterThan(page1Start);
      expect(page3Pos).toBeLessThan(page2Pos);
    });

    test('includes page titles', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateItems();

      expect(xml).toContain('<title>Home</title>');
      expect(xml).toContain('<title>About</title>');
      expect(xml).toContain('<title>Sub Page</title>');
    });
  });

  describe('generateResources', () => {
    test('generates resource for each page', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources([], {});

      expect(xml).toContain('identifier="RES-page1"');
      expect(xml).toContain('identifier="RES-page2"');
      expect(xml).toContain('identifier="RES-page3"');
    });

    test('sets type to webcontent', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources([], {});

      expect(xml).toContain('type="webcontent"');
    });

    test('sets scormtype to sco for pages', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources([], {});

      expect(xml).toContain('adlcp:scormtype="sco"');
    });

    test('generates COMMON_FILES resource', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources(['libs/jquery.js', 'theme/style.css'], {});

      expect(xml).toContain('identifier="COMMON_FILES"');
      expect(xml).toContain('adlcp:scormtype="asset"');
    });

    test('includes common files in COMMON_FILES resource', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources(['libs/jquery.js', 'theme/style.css'], {});

      expect(xml).toContain('<file href="libs/jquery.js"/>');
      expect(xml).toContain('<file href="theme/style.css"/>');
    });

    test('adds dependency on COMMON_FILES for page resources', () => {
      const generator = new Scorm12ManifestGenerator('test', samplePages, sampleMetadata);

      const xml = generator.generateResources([], {});

      expect(xml).toContain('<dependency identifierref="COMMON_FILES"/>');
    });
  });

  describe('escapeXml', () => {
    test('escapes XML special characters', () => {
      const generator = new Scorm12ManifestGenerator('test', [], {});

      expect(generator.escapeXml('Test & <>"\'chars')).toBe('Test &amp; &lt;&gt;&quot;&#039;chars');
    });

    test('returns empty string for null', () => {
      const generator = new Scorm12ManifestGenerator('test', [], {});

      expect(generator.escapeXml(null)).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    test('sanitizes title for filename use', () => {
      const generator = new Scorm12ManifestGenerator('test', [], {});

      expect(generator.sanitizeFilename('My Page Title')).toBe('my-page-title');
      expect(generator.sanitizeFilename('Página con acentos')).toBe('pagina-con-acentos');
    });

    test('returns default for empty title', () => {
      const generator = new Scorm12ManifestGenerator('test', [], {});

      expect(generator.sanitizeFilename('')).toBe('page');
      expect(generator.sanitizeFilename(null)).toBe('page');
    });
  });
});
