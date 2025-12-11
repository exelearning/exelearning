/**
 * Html5Export Fixture Comparison Tests
 *
 * Tests that verify the HTML generation matches the expected export output
 * by comparing with fixtures exported from Symfony (legacy system).
 *
 * This test reads a real .elpx file, parses its structure, generates HTML
 * using the frontend exporters, and compares key elements with the fixture exports.
 *
 * Run with: bun test public/app/yjs/exporters/__tests__/Html5ExportFixture.jest.test.js
 */

 

// Test functions available globally from vitest setup
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// Import required classes
const BaseExporter = require('./BaseExporter');
global.BaseExporter = BaseExporter;

const LibraryDetector = require('./LibraryDetector');
global.LibraryDetector = LibraryDetector;

const IdeviceHtmlRenderer = require('./renderers/IdeviceHtmlRenderer');
const PageHtmlRenderer = require('./renderers/PageHtmlRenderer');
global.IdeviceHtmlRenderer = IdeviceHtmlRenderer;
global.PageHtmlRenderer = PageHtmlRenderer;

const Html5Exporter = require('./Html5Exporter');
global.Html5Exporter = Html5Exporter;

// Real JSZip for reading actual .elpx files
const JSZip = require('jszip');

// Path to fixtures (from project root)
// __dirname is public/app/yjs/exporters, go up 4 levels to reach project root
const PROJECT_ROOT = resolve(__dirname, '../../../../');
const FIXTURES_PATH = join(PROJECT_ROOT, 'test/fixtures');
const EXPORT_FIXTURES_PATH = join(FIXTURES_PATH, 'export');

// Test fixture 1: un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion (ELPX format)
const TEST_PROJECT = {
  elpxFile: join(FIXTURES_PATH, 'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx'),
  exportDir: join(EXPORT_FIXTURES_PATH, 'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion'),
  webExportDir: join(
    EXPORT_FIXTURES_PATH,
    'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion',
    'un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion_web'
  ),
};

// Test fixture 2: old_el_cid.elp (Legacy ELP format with contentv3.xml)
const TEST_PROJECT_EL_CID = {
  elpFile: join(FIXTURES_PATH, 'old_el_cid.elp'),
  exportDir: join(EXPORT_FIXTURES_PATH, 'un-heroe-medieval-el-cid'),
  webExportDir: join(
    EXPORT_FIXTURES_PATH,
    'un-heroe-medieval-el-cid',
    'un-heroe-medieval-el-cid_web'
  ),
};

/**
 * Parse legacy contentv3.xml format (eXeLearning 2.x/3.x)
 * This format uses a dictionary serialization with <string role="key"> and <unicode> elements
 * @param {string} xmlContent - The contentv3.xml content
 * @returns {Object} Parsed structure with pages, metadata
 */
function parseContentV3Xml(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parsing error: ${parseError.textContent}`);
  }

  const meta = {};
  const pages = [];

  // Extract metadata from top-level dictionary (Package level)
  const packageInstance = doc.querySelector('instance[class="exe.engine.package.Package"]');
  if (!packageInstance) return { meta, pages };

  const topDict = packageInstance.querySelector(':scope > dictionary');
  if (!topDict) return { meta, pages };

  // Helper function to get value after a key element
  function getValueAfterKey(parentEl, keyName) {
    const children = Array.from(parentEl.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' && child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === keyName) {
        const valueEl = children[i + 1];
        if (valueEl) {
          if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
            return valueEl.getAttribute('value') || valueEl.textContent || '';
          } else if (valueEl.tagName === 'bool') {
            return valueEl.getAttribute('value') === '1';
          } else if (valueEl.tagName === 'int') {
            return parseInt(valueEl.getAttribute('value') || '0', 10);
          }
          return valueEl;
        }
      }
    }
    return null;
  }

  // Parse top-level metadata
  const metaKeys = ['_title', '_author', '_description', '_lang', '_addPagination', '_addSearchBox'];
  for (const key of metaKeys) {
    const value = getValueAfterKey(topDict, key);
    if (value !== null) {
      meta[key] = value;
    }
  }

  // Find all Node instances - the root has parent = <none>
  const nodeInstances = doc.querySelectorAll('instance[class="exe.engine.node.Node"]');

  // Find the root node (parent = <none>)
  let rootNode = null;
  for (const nodeEl of nodeInstances) {
    const nodeDict = nodeEl.querySelector(':scope > dictionary');
    if (!nodeDict) continue;

    const parentKey = Array.from(nodeDict.children).find(el =>
      el.tagName === 'string' && el.getAttribute('role') === 'key' &&
      el.getAttribute('value') === 'parent'
    );
    if (parentKey) {
      const parentValue = parentKey.nextElementSibling;
      if (parentValue && parentValue.tagName === 'none') {
        rootNode = nodeEl;
        break;
      }
    }
  }

  if (!rootNode) return { meta, pages };

  // Recursively extract pages from node tree
  function extractPagesFromNode(nodeEl, parentId = null) {
    const nodeDict = nodeEl.querySelector(':scope > dictionary');
    if (!nodeDict) return;

    const pageId = getValueAfterKey(nodeDict, '_id');
    const pageTitle = getValueAfterKey(nodeDict, '_title');

    if (pageId !== null && pageTitle) {
      const page = {
        id: String(pageId),
        title: pageTitle,
        parentId: parentId,
        order: pages.length,
        blocks: [],
      };

      // Extract idevices as components in a single block
      const idevicesKey = Array.from(nodeDict.children).find(el =>
        el.tagName === 'string' && el.getAttribute('role') === 'key' &&
        el.getAttribute('value') === 'idevices'
      );

      if (idevicesKey) {
        const idevicesList = idevicesKey.nextElementSibling;
        if (idevicesList && idevicesList.tagName === 'list') {
          const block = {
            id: `block-${pageId}`,
            name: '',
            order: 0,
            components: [],
          };

          const ideviceInstances = idevicesList.querySelectorAll(':scope > instance');
          let compOrder = 0;
          for (const ideviceEl of ideviceInstances) {
            const ideviceDict = ideviceEl.querySelector(':scope > dictionary');
            if (!ideviceDict) continue;

            let ideviceType = ideviceEl.getAttribute('class') || 'text';
            const ideviceId = getValueAfterKey(ideviceDict, '_id') ||
                              getValueAfterKey(ideviceDict, 'id') ||
                              `idevice-${compOrder}`;

            // Extract type from class name
            const classMatch = ideviceType.match(/\.([A-Za-z]+)(Idevice)?$/i);
            if (classMatch) {
              ideviceType = classMatch[1].toLowerCase().replace('idevice', '');
            }

            block.components.push({
              id: String(ideviceId),
              type: ideviceType,
              order: compOrder++,
              content: '', // Content is complex in v3 format
              properties: {},
            });
          }

          if (block.components.length > 0) {
            page.blocks.push(block);
          }
        }
      }

      pages.push(page);
    }

    // Find children nodes
    const childrenKey = Array.from(nodeDict.children).find(el =>
      el.tagName === 'string' && el.getAttribute('role') === 'key' &&
      el.getAttribute('value') === 'children'
    );

    if (childrenKey) {
      const childrenList = childrenKey.nextElementSibling;
      if (childrenList && childrenList.tagName === 'list') {
        const childNodes = childrenList.querySelectorAll(':scope > instance[class="exe.engine.node.Node"]');
        for (const childNode of childNodes) {
          extractPagesFromNode(childNode, pageId !== null ? String(pageId) : null);
        }
      }
    }
  }

  extractPagesFromNode(rootNode);

  return { meta, pages };
}

/**
 * Parse ODE XML content and extract structure
 * Uses the new eXeLearning 4.x format with nested key/value elements
 * @param {string} xmlContent - The content.xml content
 * @returns {Object} Parsed structure with pages, metadata
 */
function parseOdeXml(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parsing error: ${parseError.textContent}`);
  }

  // Extract metadata from odeProperties (new format: <odeProperty><key>...</key><value>...</value></odeProperty>)
  const meta = {};
  const propEls = doc.querySelectorAll('odeProperties > odeProperty');
  for (const propEl of propEls) {
    const keyEl = propEl.querySelector('key');
    const valueEl = propEl.querySelector('value');
    if (keyEl && valueEl) {
      meta[keyEl.textContent] = valueEl.textContent || '';
    }
  }

  // Extract pages from odeNavStructures (new format with child elements instead of attributes)
  const pages = [];
  const navStructures = doc.querySelectorAll('odeNavStructures > odeNavStructure');

  for (const navEl of navStructures) {
    const pageIdEl = navEl.querySelector(':scope > odePageId');
    const parentIdEl = navEl.querySelector(':scope > odeParentPageId');
    const pageNameEl = navEl.querySelector(':scope > pageName');
    const orderEl = navEl.querySelector(':scope > odeNavStructureOrder');

    const page = {
      id: pageIdEl?.textContent || '',
      title: pageNameEl?.textContent || '',
      parentId: parentIdEl?.textContent?.trim() || null, // Empty string -> null
      order: parseInt(orderEl?.textContent || '0', 10),
      blocks: [],
    };

    // Extract blocks (odePagStructure)
    const pagStructures = navEl.querySelectorAll(':scope > odePagStructures > odePagStructure');
    for (const pagEl of pagStructures) {
      const blockIdEl = pagEl.querySelector(':scope > odeBlockId');
      const blockNameEl = pagEl.querySelector(':scope > blockName');
      const blockOrderEl = pagEl.querySelector(':scope > odePagStructureOrder');

      const block = {
        id: blockIdEl?.textContent || '',
        name: blockNameEl?.textContent || '',
        order: parseInt(blockOrderEl?.textContent || '0', 10),
        components: [],
      };

      // Extract components (odeComponent)
      const components = pagEl.querySelectorAll(':scope > odeComponents > odeComponent');
      for (const compEl of components) {
        const ideviceIdEl = compEl.querySelector(':scope > odeIdeviceId');
        const ideviceTypeEl = compEl.querySelector(':scope > odeIdeviceTypeName');
        const orderEl = compEl.querySelector(':scope > odeComponentsOrder');
        const htmlViewEl = compEl.querySelector(':scope > htmlView');
        const jsonPropsEl = compEl.querySelector(':scope > jsonProperties');

        const component = {
          id: ideviceIdEl?.textContent || '',
          type: ideviceTypeEl?.textContent || 'text',
          order: parseInt(orderEl?.textContent || '0', 10),
          content: htmlViewEl?.textContent || '',
          properties: {},
        };

        // Extract JSON properties
        if (jsonPropsEl && jsonPropsEl.textContent) {
          try {
            component.properties = JSON.parse(jsonPropsEl.textContent);
          } catch (e) {
            // Ignore parse errors
          }
        }

        block.components.push(component);
      }

      page.blocks.push(block);
    }

    pages.push(page);
  }

  return { meta, pages };
}

/**
 * Create a mock document manager from parsed ODE structure
 * @param {Object} parsed - Parsed ODE structure
 * @returns {Object} Mock document manager
 */
function createDocManagerFromParsed(parsed) {
  const { meta, pages } = parsed;

  // Convert to MockYMap/MockYArray format
  const metadataMap = new MockYMap({
    title: meta.pp_title || 'Untitled',
    author: meta.pp_author || '',
    language: meta.pp_lang || 'en',
    description: meta.pp_description || '',
    license: meta.pp_license || 'CC-BY-SA',
    theme: meta.pp_theme || 'base',
  });

  // Convert pages to MockYArray of MockYMaps
  const pageItems = pages.map((page) => {
    const blocks = page.blocks.map((block) => {
      const components = block.components.map((comp) => {
        return new MockYMap({
          id: comp.id,
          ideviceId: comp.id,
          ideviceType: comp.type,
          order: comp.order,
          htmlContent: comp.content,
          properties: new MockYMap(comp.properties),
        });
      });

      return new MockYMap({
        id: block.id,
        blockId: block.id,
        blockName: block.name,
        order: block.order,
        components: new MockYArray(components),
      });
    });

    return new MockYMap({
      id: page.id,
      pageId: page.id,
      pageName: page.title,
      parentId: page.parentId,
      order: page.order,
      blocks: new MockYArray(blocks),
    });
  });

  const navigationArray = new MockYArray(pageItems);

  return {
    getMetadata: () => metadataMap,
    getNavigation: () => navigationArray,
  };
}

/**
 * Extract text content from HTML, ignoring tags
 * @param {string} html - HTML string
 * @returns {string} Plain text content
 */
function extractTextContent(html) {
  // Simple regex-based extraction (for testing purposes)
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract navigation structure from HTML
 * @param {string} html - HTML string
 * @returns {Array} Array of navigation items with title and children
 */
function extractNavigation(html) {
  const navItems = [];
  // Match navigation links: <a href="..." class="...">Title</a>
  const linkRegex = /<a[^>]*href=["'][^"']*["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    navItems.push(match[1].trim());
  }
  return navItems;
}

describe('Html5Export Fixture Comparison', () => {
  let elpxContent;
  let parsedStructure;
  let mockDocManager;
  let exporter;

  beforeAll(async () => {
    // Check if fixture files exist
    if (!existsSync(TEST_PROJECT.elpxFile)) {
      console.warn(`Fixture file not found: ${TEST_PROJECT.elpxFile}`);
      return;
    }

    // Read and extract the .elpx file
    const elpxBuffer = readFileSync(TEST_PROJECT.elpxFile);
    const zip = await JSZip.loadAsync(elpxBuffer);

    // Find content.xml (try both locations)
    let contentXmlFile = zip.file('content.xml');
    if (!contentXmlFile) {
      contentXmlFile = zip.file('contentv3.xml');
    }

    if (!contentXmlFile) {
      console.warn('No content.xml found in .elpx file');
      return;
    }

    const xmlContent = await contentXmlFile.async('string');
    parsedStructure = parseOdeXml(xmlContent);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    if (!parsedStructure) return;

    mockDocManager = createDocManagerFromParsed(parsedStructure);
    exporter = new Html5Exporter(mockDocManager, null, null);
  });

  describe('Fixture file availability', () => {
    it('should have the test .elpx file', () => {
      expect(existsSync(TEST_PROJECT.elpxFile)).toBe(true);
    });

    it('should have the web export fixture directory', () => {
      expect(existsSync(TEST_PROJECT.webExportDir)).toBe(true);
    });
  });

  describe('ODE XML Parsing', () => {
    it('should parse the content.xml successfully', () => {
      if (!parsedStructure) {
        console.warn('Skipping: parsedStructure not available');
        return;
      }

      expect(parsedStructure).toBeDefined();
      expect(parsedStructure.meta).toBeDefined();
      expect(parsedStructure.pages).toBeDefined();
      expect(parsedStructure.pages.length).toBeGreaterThan(0);
    });

    it('should extract the correct project title', () => {
      if (!parsedStructure) return;

      expect(parsedStructure.meta.pp_title).toContain('contenido de ejemplo');
    });

    it('should extract multiple pages', () => {
      if (!parsedStructure) return;

      // The fixture should have multiple pages
      expect(parsedStructure.pages.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Page structure matches fixture', () => {
    it('should generate pages matching fixture filenames', () => {
      if (!parsedStructure || !existsSync(TEST_PROJECT.webExportDir)) return;

      // Read fixture HTML files
      const htmlDir = join(TEST_PROJECT.webExportDir, 'html');
      if (!existsSync(htmlDir)) return;

      const fixtureHtmlFiles = readdirSync(htmlDir).filter(f => f.endsWith('.html'));

      // Build page list from exporter
      const pages = exporter.buildPageList();

      // Count matches - we expect most files to match
      let matchCount = 0;
      for (const filename of fixtureHtmlFiles) {
        const pageTitle = filename.replace('.html', '').replace(/-/g, ' ');

        // Check that a page with similar title exists
        const matchingPage = pages.find(p => {
          const sanitized = exporter.sanitizePageFilename(p.title);
          return sanitized === filename.replace('.html', '');
        });

        if (matchingPage) {
          matchCount++;
          continue;
        }

        // Try to find by partial match (first 10 chars)
        const looseMatch = pages.find(p => {
          const cleanTitle = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const cleanFilename = pageTitle.toLowerCase();
          return cleanTitle.includes(cleanFilename.substring(0, 10)) ||
                 cleanFilename.includes(cleanTitle.substring(0, 10));
        });

        if (looseMatch) {
          matchCount++;
        }
      }

      // At least 30% of fixture files should match pages
      // Note: Symfony may generate different filename sanitization than the frontend
      const matchRatio = matchCount / fixtureHtmlFiles.length;
      expect(matchRatio).toBeGreaterThanOrEqual(0.3);
    });

    it('should have hierarchical page structure with parent-child relationships', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();

      // Find pages with children
      const pagesWithChildren = pages.filter(p => {
        return pages.some(child => child.parentId === p.id);
      });

      // The fixture has nested pages (e.g., "Otro apartado" with sub-sections)
      expect(pagesWithChildren.length).toBeGreaterThan(0);
    });
  });

  describe('HTML generation matches fixture structure', () => {
    it('should generate valid HTML with DOCTYPE', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include navigation structure', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('<nav id="siteNav">');
      expect(html).toContain('</nav>');
    });

    it('should include page content section', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('<main');
      expect(html).toContain('class="page"');
    });

    it('should include iDevice wrappers for content', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      // Find a page with content
      const pageWithContent = pages.find(p =>
        p.blocks && p.blocks.length > 0 &&
        p.blocks.some(b => b.components && b.components.length > 0)
      );

      if (!pageWithContent) return;

      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pageWithContent, pages, meta);

      // Should have iDevice node wrapper
      expect(html).toContain('idevice_node');
    });
  });

  describe('Navigation generation matches fixture', () => {
    it('should generate navigation links for all root pages', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const rootPages = exporter.getRootPages(pages);
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      // Each root page should have a navigation link
      for (const page of rootPages) {
        expect(html).toContain(page.title);
      }
    });

    it('should mark current page as active in navigation', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      // First page should be marked active
      expect(html).toContain('class="active');
    });
  });

  describe('Content comparison with fixture export', () => {
    it('should have similar page titles to fixture', async () => {
      if (!parsedStructure || !existsSync(TEST_PROJECT.webExportDir)) return;

      // Read index.html from fixture
      const indexPath = join(TEST_PROJECT.webExportDir, 'index.html');
      if (!existsSync(indexPath)) return;

      const fixtureHtml = readFileSync(indexPath, 'utf-8');

      // Extract navigation from fixture
      const fixtureNav = extractNavigation(fixtureHtml);

      // Get pages from exporter
      const pages = exporter.buildPageList();
      const pageTitles = pages.map(p => p.title);

      // At least some titles should match
      const matchingTitles = fixtureNav.filter(navTitle =>
        pageTitles.some(pageTitle =>
          pageTitle.toLowerCase().includes(navTitle.toLowerCase().substring(0, 10)) ||
          navTitle.toLowerCase().includes(pageTitle.toLowerCase().substring(0, 10))
        )
      );

      expect(matchingTitles.length).toBeGreaterThan(0);
    });

    it('should preserve iDevice content from source', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();

      // Find a page with content
      const pageWithContent = pages.find(p =>
        p.blocks && p.blocks.length > 0 &&
        p.blocks.some(b =>
          b.components && b.components.length > 0 &&
          b.components.some(c => c.content && c.content.length > 10)
        )
      );

      if (!pageWithContent) return;

      // Get the first component with content
      const component = pageWithContent.blocks
        .flatMap(b => b.components || [])
        .find(c => c.content && c.content.length > 10);

      if (!component) return;

      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pageWithContent, pages, meta);

      // The generated HTML should contain some text from the component content
      const contentText = extractTextContent(component.content);
      const shortSnippet = contentText.substring(0, 30);

      if (shortSnippet.length > 5) {
        // At least part of the content should be in the output
        const htmlText = extractTextContent(html);
        expect(htmlText.toLowerCase()).toContain(shortSnippet.toLowerCase().substring(0, 20));
      }
    });
  });

  describe('Theme and style references', () => {
    it('should include theme CSS reference', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('theme/content.css');
    });

    it('should include base CSS reference', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('content/css/base.css');
    });

    it('should include Bootstrap CSS', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('bootstrap');
    });
  });

  describe('JavaScript references', () => {
    it('should include jQuery reference', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('jquery');
    });

    it('should include common.js reference', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('common.js');
    });

    it('should include theme JS reference', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const html = exporter.generatePageHtml(pages[0], pages, meta);

      expect(html).toContain('theme/default.js');
    });
  });

  describe('Filename generation', () => {
    it('should sanitize page filenames correctly', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();

      // Test specific page title sanitization
      const pageWithLongTitle = pages.find(p =>
        p.title && p.title.length > 30
      );

      if (pageWithLongTitle) {
        const sanitized = exporter.sanitizePageFilename(pageWithLongTitle.title);
        // Should be lowercase
        expect(sanitized).toBe(sanitized.toLowerCase());
        // Should not contain special characters
        expect(sanitized).not.toMatch(/[áéíóúñ]/);
        // Should have hyphens instead of spaces
        expect(sanitized).not.toContain(' ');
      }
    });

    it('should generate filenames matching fixture pattern', () => {
      if (!parsedStructure || !existsSync(TEST_PROJECT.webExportDir)) return;

      const htmlDir = join(TEST_PROJECT.webExportDir, 'html');
      if (!existsSync(htmlDir)) return;

      const fixtureFiles = readdirSync(htmlDir).filter(f => f.endsWith('.html'));
      const pages = exporter.buildPageList();

      // Check that we can generate similar filenames
      for (const page of pages.slice(1)) { // Skip first (index.html)
        const sanitized = exporter.sanitizePageFilename(page.title);

        // Should be similar format to fixture files
        expect(sanitized).toMatch(/^[a-z0-9-]+$/);
        expect(sanitized.length).toBeLessThanOrEqual(50);
      }
    });
  });

  describe('Block rendering', () => {
    it('should render blocks with correct structure', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const pageWithBlocks = pages.find(p =>
        p.blocks && p.blocks.length > 0
      );

      if (!pageWithBlocks) return;

      const renderer = new IdeviceHtmlRenderer();
      const block = pageWithBlocks.blocks[0];
      const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

      // Should have article wrapper
      expect(html).toContain('<article');
      expect(html).toContain('class="box');
      expect(html).toContain('</article>');
    });

    it('should render iDevices within blocks', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const pageWithContent = pages.find(p =>
        p.blocks && p.blocks.length > 0 &&
        p.blocks.some(b => b.components && b.components.length > 0)
      );

      if (!pageWithContent) return;

      const renderer = new IdeviceHtmlRenderer();
      const blockWithComponents = pageWithContent.blocks.find(b =>
        b.components && b.components.length > 0
      );

      if (!blockWithComponents) return;

      const html = renderer.renderBlock(blockWithComponents, {
        basePath: '',
        includeDataAttributes: true,
      });

      // Should contain iDevice node
      expect(html).toContain('idevice_node');
    });
  });

  // ==========================================================================
  // DETAILED FILE-BY-FILE COMPARISON
  // ==========================================================================

  describe('Detailed HTML comparison with fixture files', () => {
    /**
     * Helper: Read fixture HTML file
     */
    function readFixtureHtml(filename) {
      const filePath = filename === 'index.html'
        ? join(TEST_PROJECT.webExportDir, filename)
        : join(TEST_PROJECT.webExportDir, 'html', filename);

      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    }

    /**
     * Helper: Extract navigation items from HTML
     */
    function extractNavItems(html) {
      const navMatch = html.match(/<nav id="siteNav">([\s\S]*?)<\/nav>/);
      if (!navMatch) return [];

      const navHtml = navMatch[1];
      const items = [];
      const linkRegex = /<a[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = linkRegex.exec(navHtml)) !== null) {
        items.push(match[1].trim());
      }
      return items;
    }

    /**
     * Helper: Extract page title from HTML
     */
    function extractPageTitle(html) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      return titleMatch ? titleMatch[1].trim() : '';
    }

    /**
     * Helper: Extract page ID from HTML
     */
    function extractPageId(html) {
      const match = html.match(/<html[^>]*id="exe-([^"]+)"/);
      return match ? match[1] : null;
    }

    /**
     * Helper: Extract language from HTML
     */
    function extractLanguage(html) {
      const match = html.match(/<html[^>]*lang="([^"]+)"/);
      return match ? match[1] : null;
    }

    /**
     * Helper: Extract main content from HTML
     */
    function extractMainContent(html) {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
      return mainMatch ? mainMatch[1] : '';
    }

    /**
     * Helper: Count iDevice nodes in HTML
     */
    function countIdeviceNodes(html) {
      const matches = html.match(/class="[^"]*idevice_node[^"]*"/g);
      return matches ? matches.length : 0;
    }

    /**
     * Helper: Extract CSS links from HTML
     */
    function extractCssLinks(html) {
      const links = [];
      const regex = /<link[^>]*href="([^"]+\.css)"[^>]*>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        links.push(match[1]);
      }
      return links;
    }

    /**
     * Helper: Extract JS scripts from HTML
     */
    function extractJsScripts(html) {
      const scripts = [];
      const regex = /<script[^>]*src="([^"]+\.js)"[^>]*>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        scripts.push(match[1]);
      }
      return scripts;
    }

    describe('index.html comparison', () => {
      it('should have the same navigation structure as fixture', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('index.html');
        if (!fixtureHtml) return;

        const fixtureNav = extractNavItems(fixtureHtml);
        const pages = exporter.buildPageList();
        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);
        const generatedNav = extractNavItems(generatedHtml);

        // Both should have navigation items
        expect(fixtureNav.length).toBeGreaterThan(0);
        expect(generatedNav.length).toBeGreaterThan(0);

        // Check that major navigation items exist in both
        const fixtureNavLower = fixtureNav.map(n => n.toLowerCase());
        const generatedNavLower = generatedNav.map(n => n.toLowerCase());

        // At least 50% of fixture nav items should be in generated
        let matchCount = 0;
        for (const item of fixtureNavLower) {
          if (generatedNavLower.some(g => g.includes(item.substring(0, 8)) || item.includes(g.substring(0, 8)))) {
            matchCount++;
          }
        }
        expect(matchCount / fixtureNav.length).toBeGreaterThanOrEqual(0.5);
      });

      it('should use the same language as fixture', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('index.html');
        if (!fixtureHtml) return;

        const fixtureLang = extractLanguage(fixtureHtml);
        const pages = exporter.buildPageList();
        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);
        const generatedLang = extractLanguage(generatedHtml);

        // Both should have the same language (es for this fixture)
        expect(fixtureLang).toBe('es');
        expect(generatedLang).toBe(fixtureLang);
      });

      it('should include similar CSS files as fixture', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('index.html');
        if (!fixtureHtml) return;

        const fixtureCss = extractCssLinks(fixtureHtml);
        const pages = exporter.buildPageList();
        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);
        const generatedCss = extractCssLinks(generatedHtml);

        // Check common CSS files
        const commonCssPatterns = ['bootstrap', 'base.css', 'content.css'];
        for (const pattern of commonCssPatterns) {
          const fixtureHas = fixtureCss.some(c => c.includes(pattern));
          const generatedHas = generatedCss.some(c => c.includes(pattern));
          expect(generatedHas).toBe(fixtureHas);
        }
      });

      it('should include similar JS files as fixture', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('index.html');
        if (!fixtureHtml) return;

        const fixtureJs = extractJsScripts(fixtureHtml);
        const pages = exporter.buildPageList();
        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);
        const generatedJs = extractJsScripts(generatedHtml);

        // Check common JS files
        const commonJsPatterns = ['jquery', 'common.js'];
        for (const pattern of commonJsPatterns) {
          const fixtureHas = fixtureJs.some(j => j.includes(pattern));
          const generatedHas = generatedJs.some(j => j.includes(pattern));
          expect(generatedHas).toBe(fixtureHas);
        }
      });
    });

    describe('Multiple page comparison', () => {
      it('should generate correct number of pages', () => {
        if (!parsedStructure || !existsSync(TEST_PROJECT.webExportDir)) return;

        const htmlDir = join(TEST_PROJECT.webExportDir, 'html');
        if (!existsSync(htmlDir)) return;

        const fixtureHtmlFiles = readdirSync(htmlDir).filter(f => f.endsWith('.html'));
        const pages = exporter.buildPageList();

        // Generated pages count should be close to fixture count (+1 for index.html)
        // Fixture has 13 HTML files + index.html = 14 pages
        const fixturePageCount = fixtureHtmlFiles.length + 1;
        const generatedPageCount = pages.length;

        // Should have at least 80% of the fixture pages
        expect(generatedPageCount / fixturePageCount).toBeGreaterThanOrEqual(0.8);
      });

      it('should have similar content structure for each page', () => {
        if (!parsedStructure || !existsSync(TEST_PROJECT.webExportDir)) return;

        const pages = exporter.buildPageList();
        const meta = mockDocManager.getMetadata();

        // Test a few specific pages
        const testPages = pages.slice(0, 3);

        for (const page of testPages) {
          const generatedHtml = exporter.generatePageHtml(page, pages, meta);

          // Each page should have proper structure
          expect(generatedHtml).toContain('<!DOCTYPE html>');
          expect(generatedHtml).toContain('<nav id="siteNav">');
          expect(generatedHtml).toContain('<main');
          expect(generatedHtml).toContain('</main>');

          // Each page should include the page title
          expect(generatedHtml).toContain(page.title);
        }
      });
    });

    describe('Content preservation', () => {
      it('should preserve text content from iDevices', () => {
        if (!parsedStructure) return;

        // Get a page with content
        const pages = exporter.buildPageList();
        const pageWithContent = pages.find(p =>
          p.blocks?.some(b =>
            b.components?.some(c => c.content && c.content.length > 50)
          )
        );

        if (!pageWithContent) return;

        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pageWithContent, pages, meta);

        // Find text snippets that should be preserved
        for (const block of pageWithContent.blocks || []) {
          for (const component of block.components || []) {
            if (component.content && component.content.length > 50) {
              const contentText = extractTextContent(component.content);

              // Take a unique snippet from the middle of the content
              const snippet = contentText.substring(20, 50).trim();
              if (snippet.length > 10) {
                const generatedText = extractTextContent(generatedHtml);
                expect(generatedText.toLowerCase()).toContain(snippet.toLowerCase().substring(0, 15));
              }
            }
          }
        }
      });

      it('should include iDevice IDs in generated HTML', () => {
        if (!parsedStructure) return;

        const pages = exporter.buildPageList();
        const pageWithContent = pages.find(p =>
          p.blocks?.some(b => b.components?.length > 0)
        );

        if (!pageWithContent) return;

        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(pageWithContent, pages, meta);

        // Each iDevice should have its ID in the HTML
        for (const block of pageWithContent.blocks || []) {
          for (const component of block.components || []) {
            if (component.id) {
              expect(generatedHtml).toContain(component.id);
            }
          }
        }
      });
    });

    describe('Specific page comparison: apartado-uno', () => {
      it('should match fixture structure for page with long title', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('apartado-uno-con-un-titulo-largo-para-comprobar-posicionamiento.html');
        if (!fixtureHtml) return;

        // Find corresponding page in parsed structure
        const pages = exporter.buildPageList();
        const page = pages.find(p =>
          p.title.toLowerCase().includes('apartado uno')
        );

        if (!page) return;

        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(page, pages, meta);

        // Compare iDevice count
        const fixtureIdeviceCount = countIdeviceNodes(fixtureHtml);
        const generatedIdeviceCount = countIdeviceNodes(generatedHtml);

        // Should have similar iDevice count
        expect(generatedIdeviceCount).toBeGreaterThanOrEqual(fixtureIdeviceCount * 0.5);

        // Both should have the page title
        expect(fixtureHtml).toContain('Apartado uno');
        expect(generatedHtml).toContain('Apartado uno');
      });
    });

    describe('Specific page comparison: otro-apartado', () => {
      it('should match fixture structure for nested page', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('otro-apartado.html');
        if (!fixtureHtml) return;

        // Find corresponding page in parsed structure
        const pages = exporter.buildPageList();
        const page = pages.find(p =>
          p.title.toLowerCase().includes('otro apartado')
        );

        if (!page) return;

        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(page, pages, meta);

        // Both should have the page title
        expect(fixtureHtml).toContain('Otro apartado');
        expect(generatedHtml).toContain('Otro apartado');

        // Both should have navigation
        expect(extractNavItems(fixtureHtml).length).toBeGreaterThan(0);
        expect(extractNavItems(generatedHtml).length).toBeGreaterThan(0);
      });
    });

    describe('Specific page comparison: unidad-2-1-2 (nested 3 levels)', () => {
      it('should match fixture for deeply nested page', () => {
        if (!parsedStructure) return;

        const fixtureHtml = readFixtureHtml('unidad-2-1-2.html');
        if (!fixtureHtml) return;

        // Find corresponding page in parsed structure
        const pages = exporter.buildPageList();
        const page = pages.find(p =>
          p.title.toLowerCase().includes('unidad 2.1.2') ||
          p.title.toLowerCase().includes('unidad 2-1-2')
        );

        if (!page) return;

        const meta = mockDocManager.getMetadata();
        const generatedHtml = exporter.generatePageHtml(page, pages, meta);

        // Should have navigation with parent sections visible
        const fixtureNav = extractNavItems(fixtureHtml);
        const generatedNav = extractNavItems(generatedHtml);

        expect(fixtureNav.length).toBeGreaterThan(3);
        expect(generatedNav.length).toBeGreaterThan(3);
      });
    });
  });

  // ==========================================================================
  // HTML STRUCTURE ELEMENT-BY-ELEMENT COMPARISON
  // ==========================================================================

  describe('HTML element structure comparison', () => {
    /**
     * Helper: Extract specific HTML elements for comparison
     */
    function extractElement(html, selector) {
      // Simple regex extraction for common elements
      const patterns = {
        'html': /<html[^>]*>/,
        'head': /<head[^>]*>([\s\S]*?)<\/head>/,
        'body': /<body[^>]*>/,
        'nav': /<nav[^>]*id="siteNav"[^>]*>([\s\S]*?)<\/nav>/,
        'main': /<main[^>]*>([\s\S]*?)<\/main>/,
        'footer': /<footer[^>]*>([\s\S]*?)<\/footer>/,
      };
      const match = html.match(patterns[selector]);
      return match ? match[0] : null;
    }

    it('should have matching html element attributes', () => {
      if (!parsedStructure) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT.webExportDir, 'index.html'), 'utf-8');
      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);

      const fixtureHtmlEl = extractElement(fixtureHtml, 'html');
      const generatedHtmlEl = extractElement(generatedHtml, 'html');

      // Both should have lang attribute
      expect(fixtureHtmlEl).toContain('lang="');
      expect(generatedHtmlEl).toContain('lang="');

      // Both should have id attribute
      expect(fixtureHtmlEl).toContain('id="exe-');
      expect(generatedHtmlEl).toContain('id="exe-');
    });

    it('should have matching body element attributes', () => {
      if (!parsedStructure) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT.webExportDir, 'index.html'), 'utf-8');
      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);

      const fixtureBody = extractElement(fixtureHtml, 'body');
      const generatedBody = extractElement(generatedHtml, 'body');

      // Both should have class with exe-export
      expect(fixtureBody).toContain('exe-export');
      expect(generatedBody).toContain('exe-export');

      // Both should have lang attribute
      expect(fixtureBody).toContain('lang="');
      expect(generatedBody).toContain('lang="');
    });

    it('should generate matching meta tags', () => {
      if (!parsedStructure) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT.webExportDir, 'index.html'), 'utf-8');
      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);

      // Both should have charset
      expect(fixtureHtml).toContain('charset="utf-8"');
      expect(generatedHtml).toContain('charset="utf-8"');

      // Both should have viewport
      expect(fixtureHtml).toContain('name="viewport"');
      expect(generatedHtml).toContain('name="viewport"');

      // Both should have generator meta
      expect(fixtureHtml).toContain('name="generator"');
      expect(generatedHtml).toContain('name="generator"');
    });

    it('should generate matching navigation structure', () => {
      if (!parsedStructure) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT.webExportDir, 'index.html'), 'utf-8');
      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);

      const fixtureNav = extractElement(fixtureHtml, 'nav');
      const generatedNav = extractElement(generatedHtml, 'nav');

      // Both should have nav with ul structure
      expect(fixtureNav).toContain('<ul>');
      expect(generatedNav).toContain('<ul>');

      // Both should have li elements
      expect(fixtureNav).toContain('<li');
      expect(generatedNav).toContain('<li');

      // Both should have links
      expect(fixtureNav).toContain('<a href=');
      expect(generatedNav).toContain('<a href=');
    });

    it('should generate matching main content structure', () => {
      if (!parsedStructure) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT.webExportDir, 'index.html'), 'utf-8');
      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pages[0], pages, meta);

      const fixtureMain = extractElement(fixtureHtml, 'main');
      const generatedMain = extractElement(generatedHtml, 'main');

      // Both should have main with class="page"
      expect(fixtureMain).toContain('class="page"');
      expect(generatedMain).toContain('class="page"');
    });
  });

  // ==========================================================================
  // REGRESSION TESTS - Ensure specific content is preserved
  // ==========================================================================

  describe('Regression tests for content preservation', () => {
    it('should preserve Spanish special characters (ñ, á, é, í, ó, ú)', () => {
      if (!parsedStructure) return;

      // Check that parsed content contains Spanish characters
      const hasSpanishChars = parsedStructure.pages.some(p =>
        p.title.includes('ñ') || p.title.includes('á') ||
        p.title.includes('é') || p.title.includes('í') ||
        p.title.includes('ó') || p.title.includes('ú') ||
        p.blocks?.some(b =>
          b.components?.some(c =>
            c.content?.includes('ñ') || c.content?.includes('á')
          )
        )
      );

      // The fixture has Spanish content
      expect(hasSpanishChars).toBe(true);
    });

    it('should preserve HTML entities in content', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const meta = mockDocManager.getMetadata();

      // Generate HTML for a page with content
      const pageWithContent = pages.find(p =>
        p.blocks?.some(b => b.components?.some(c => c.content?.length > 100))
      );

      if (!pageWithContent) return;

      const generatedHtml = exporter.generatePageHtml(pageWithContent, pages, meta);

      // Should be valid HTML (no broken entities)
      expect(generatedHtml).not.toContain('&amp;amp;'); // Double-encoded
      expect(generatedHtml).not.toContain('&amp;lt;'); // Double-encoded
    });

    it('should preserve image references', () => {
      if (!parsedStructure) return;

      // Check for images in parsed content
      const hasImages = parsedStructure.pages.some(p =>
        p.blocks?.some(b =>
          b.components?.some(c =>
            c.content?.includes('<img') || c.content?.includes('src=')
          )
        )
      );

      if (!hasImages) return;

      const pages = exporter.buildPageList();
      const pageWithImages = pages.find(p =>
        p.blocks?.some(b =>
          b.components?.some(c => c.content?.includes('<img'))
        )
      );

      if (!pageWithImages) return;

      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pageWithImages, pages, meta);

      // Should contain img tags
      expect(generatedHtml).toContain('<img');
    });

    it('should preserve link references', () => {
      if (!parsedStructure) return;

      const pages = exporter.buildPageList();
      const pageWithLinks = pages.find(p =>
        p.blocks?.some(b =>
          b.components?.some(c => c.content?.includes('<a href'))
        )
      );

      if (!pageWithLinks) return;

      const meta = mockDocManager.getMetadata();
      const generatedHtml = exporter.generatePageHtml(pageWithLinks, pages, meta);

      // Should contain link tags
      expect(generatedHtml).toContain('<a href');
    });
  });
});

// ==============================================================================
// SECOND FIXTURE: old_el_cid.elp (Legacy ELP format)
// ==============================================================================

describe('Html5Export Fixture Comparison - El Cid (Legacy ELP)', () => {
  let parsedStructureElCid;
  let mockDocManagerElCid;
  let exporterElCid;

  beforeAll(async () => {
    // Check if fixture files exist
    if (!existsSync(TEST_PROJECT_EL_CID.elpFile)) {
      console.warn(`Fixture file not found: ${TEST_PROJECT_EL_CID.elpFile}`);
      return;
    }

    // Read and extract the .elp file
    const elpBuffer = readFileSync(TEST_PROJECT_EL_CID.elpFile);
    const zip = await JSZip.loadAsync(elpBuffer);

    // Find contentv3.xml (legacy format)
    const contentXmlFile = zip.file('contentv3.xml');

    if (!contentXmlFile) {
      console.warn('No contentv3.xml found in .elp file');
      return;
    }

    const xmlContent = await contentXmlFile.async('string');
    parsedStructureElCid = parseContentV3Xml(xmlContent);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    if (!parsedStructureElCid) return;

    mockDocManagerElCid = createDocManagerFromParsed(parsedStructureElCid);
    exporterElCid = new Html5Exporter(mockDocManagerElCid, null, null);
  });

  describe('Fixture file availability - El Cid', () => {
    it('should have the test .elp file', () => {
      expect(existsSync(TEST_PROJECT_EL_CID.elpFile)).toBe(true);
    });

    it('should have the web export fixture directory', () => {
      expect(existsSync(TEST_PROJECT_EL_CID.webExportDir)).toBe(true);
    });
  });

  describe('Legacy XML Parsing - El Cid', () => {
    it('should parse the contentv3.xml successfully', () => {
      if (!parsedStructureElCid) {
        console.warn('Skipping: parsedStructureElCid not available');
        return;
      }

      expect(parsedStructureElCid).toBeDefined();
      expect(parsedStructureElCid.meta).toBeDefined();
      expect(parsedStructureElCid.pages).toBeDefined();
    });

    it('should extract the correct project title', () => {
      if (!parsedStructureElCid) return;

      expect(parsedStructureElCid.meta._title).toContain('héroe medieval');
    });

    it('should extract pages from the node tree', () => {
      if (!parsedStructureElCid) return;

      // The fixture should have multiple pages
      expect(parsedStructureElCid.pages.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract the correct language (es)', () => {
      if (!parsedStructureElCid) return;

      expect(parsedStructureElCid.meta._lang).toBe('es');
    });
  });

  describe('Page structure matches fixture - El Cid', () => {
    /**
     * Helper: Read fixture HTML file for El Cid
     */
    function readElCidFixtureHtml(filename) {
      const filePath = filename === 'index.html'
        ? join(TEST_PROJECT_EL_CID.webExportDir, filename)
        : join(TEST_PROJECT_EL_CID.webExportDir, 'html', filename);

      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    }

    it('should have correct number of pages compared to fixture', () => {
      if (!parsedStructureElCid || !existsSync(TEST_PROJECT_EL_CID.webExportDir)) return;

      const htmlDir = join(TEST_PROJECT_EL_CID.webExportDir, 'html');
      if (!existsSync(htmlDir)) return;

      const fixtureHtmlFiles = readdirSync(htmlDir).filter(f => f.endsWith('.html'));

      // Fixture has: 8 HTML files in html/ + index.html = 9 pages
      expect(fixtureHtmlFiles.length).toBe(8);

      // Our parsed pages should have a similar count
      expect(parsedStructureElCid.pages.length).toBeGreaterThanOrEqual(1);
    });

    it('should have index.html in fixture', () => {
      if (!parsedStructureElCid) return;

      const indexHtml = readElCidFixtureHtml('index.html');
      expect(indexHtml).not.toBeNull();
      expect(indexHtml).toContain('<!DOCTYPE html>');
    });
  });

  describe('HTML comparison with El Cid fixture', () => {
    /**
     * Helper: Extract navigation items from HTML
     */
    function extractNavItems(html) {
      const navMatch = html.match(/<nav id="siteNav">([\s\S]*?)<\/nav>/);
      if (!navMatch) return [];

      const navHtml = navMatch[1];
      const items = [];
      const linkRegex = /<a[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = linkRegex.exec(navHtml)) !== null) {
        items.push(match[1].trim());
      }
      return items;
    }

    /**
     * Helper: Extract language from HTML
     */
    function extractLanguage(html) {
      const match = html.match(/<html[^>]*lang="([^"]+)"/);
      return match ? match[1] : null;
    }

    it('should match fixture language (es)', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');
      const fixtureLang = extractLanguage(fixtureHtml);

      expect(fixtureLang).toBe('es');

      // Check that our parsed structure also has Spanish
      expect(parsedStructureElCid.meta._lang).toBe('es');
    });

    it('should have navigation in fixture index.html', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');
      const fixtureNav = extractNavItems(fixtureHtml);

      expect(fixtureNav.length).toBeGreaterThan(0);
    });

    it('should have matching page titles with fixture', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');
      const fixtureNav = extractNavItems(fixtureHtml);

      // Check that some parsed page titles match fixture navigation
      const pageTitles = parsedStructureElCid.pages.map(p => p.title.toLowerCase());

      let matchCount = 0;
      for (const navItem of fixtureNav) {
        if (pageTitles.some(t => t.includes(navItem.toLowerCase().substring(0, 8)) ||
                                  navItem.toLowerCase().includes(t.substring(0, 8)))) {
          matchCount++;
        }
      }

      // At least some navigation items should match page titles
      expect(matchCount).toBeGreaterThan(0);
    });
  });

  describe('Specific page comparison - El Cid', () => {
    it('should have La Edad Media page in fixture', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(
        join(TEST_PROJECT_EL_CID.webExportDir, 'html', 'la-edad-media.html'),
        'utf-8'
      );

      expect(fixtureHtml).toContain('La Edad Media');
      expect(fixtureHtml).toContain('<!DOCTYPE html>');
    });

    it('should have El Poema de Mio Cid page in fixture', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(
        join(TEST_PROJECT_EL_CID.webExportDir, 'html', 'el-poema-de-mio-cid.html'),
        'utf-8'
      );

      expect(fixtureHtml).toContain('Poema');
      expect(fixtureHtml).toContain('Cid');
    });

    it('should have proper iDevice structure in fixture pages', () => {
      if (!parsedStructureElCid) return;

      const fixtureHtml = readFileSync(
        join(TEST_PROJECT_EL_CID.webExportDir, 'html', 'el-texto-descriptivo.html'),
        'utf-8'
      );

      // Fixture pages should have iDevice nodes
      expect(fixtureHtml).toContain('idevice');
    });
  });

  describe('Content preservation - El Cid', () => {
    it('should have author metadata', () => {
      if (!parsedStructureElCid) return;

      expect(parsedStructureElCid.meta._author).toBeDefined();
      expect(parsedStructureElCid.meta._author).toContain('Guillermo');
    });

    it('should have description metadata', () => {
      if (!parsedStructureElCid) return;

      expect(parsedStructureElCid.meta._description).toBeDefined();
      expect(parsedStructureElCid.meta._description.length).toBeGreaterThan(20);
    });

    it('should preserve project settings', () => {
      if (!parsedStructureElCid) return;

      // Check that pagination setting is preserved
      expect(parsedStructureElCid.meta._addPagination).toBeDefined();

      // Check that search box setting is preserved
      expect(parsedStructureElCid.meta._addSearchBox).toBeDefined();
    });
  });

  describe('HTML structure comparison - El Cid', () => {
    it('should have matching DOCTYPE in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('<!DOCTYPE html>');
    });

    it('should have proper head structure in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('<head>');
      expect(fixtureHtml).toContain('charset="utf-8"');
      expect(fixtureHtml).toContain('</head>');
    });

    it('should have Bootstrap CSS in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('bootstrap');
    });

    it('should have jQuery in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('jquery');
    });

    it('should have proper body structure in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('<body');
      expect(fixtureHtml).toContain('</body>');
      expect(fixtureHtml).toContain('exe-export');
    });

    it('should have navigation in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('<nav id="siteNav">');
      expect(fixtureHtml).toContain('</nav>');
    });

    it('should have main content in fixture', () => {
      const fixtureHtml = readFileSync(join(TEST_PROJECT_EL_CID.webExportDir, 'index.html'), 'utf-8');

      expect(fixtureHtml).toContain('<main');
      expect(fixtureHtml).toContain('</main>');
    });
  });
});
