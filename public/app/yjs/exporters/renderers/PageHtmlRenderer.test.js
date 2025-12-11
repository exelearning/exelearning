/**
 * PageHtmlRenderer Tests
 */

// Import the classes
const IdeviceHtmlRenderer = require('./IdeviceHtmlRenderer');
const PageHtmlRenderer = require('./PageHtmlRenderer');

describe('PageHtmlRenderer', () => {
  let ideviceRenderer;
  let pageRenderer;
  let samplePages;

  beforeEach(() => {
    ideviceRenderer = new IdeviceHtmlRenderer();
    pageRenderer = new PageHtmlRenderer(ideviceRenderer);

    // Sample pages for testing
    samplePages = [
      {
        id: 'page1',
        title: 'Home Page',
        parentId: null,
        blocks: [
          {
            id: 'block1',
            name: 'Introduction',
            components: [
              { id: 'comp1', type: 'text', content: '<p>Welcome!</p>', properties: {} },
            ],
            properties: {},
          },
        ],
      },
      {
        id: 'page2',
        title: 'Second Page',
        parentId: null,
        blocks: [],
      },
      {
        id: 'page3',
        title: 'Child Page',
        parentId: 'page1',
        blocks: [],
      },
    ];
  });

  describe('render', () => {
    it('should render a complete HTML page', () => {
      const html = pageRenderer.render(samplePages[0], {
        projectTitle: 'Test Project',
        language: 'en',
        allPages: samplePages,
        isIndex: true,
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en"');
      expect(html).toContain('<title>Home Page | Test Project</title>');
      expect(html).toContain('Welcome!');
    });

    it('should include navigation menu', () => {
      const html = pageRenderer.render(samplePages[0], {
        projectTitle: 'Test',
        allPages: samplePages,
      });

      expect(html).toContain('<nav id="siteNav">');
      expect(html).toContain('Home Page');
      expect(html).toContain('Second Page');
    });

    it('should include page header', () => {
      const html = pageRenderer.render(samplePages[0], {
        allPages: samplePages,
      });

      expect(html).toContain('<header class="page-header">');
      expect(html).toContain('<h2 class="page-title">Home Page</h2>');
    });

    it('should include footer with author and license', () => {
      const html = pageRenderer.render(samplePages[0], {
        allPages: samplePages,
        author: 'John Doe',
        license: 'MIT',
      });

      expect(html).toContain('<footer id="packageLicense"');
      expect(html).toContain('John Doe');
      expect(html).toContain('MIT');
    });

    it('should include script references', () => {
      const html = pageRenderer.render(samplePages[0], {
        allPages: samplePages,
      });

      expect(html).toContain('libs/jquery/jquery.min.js');
      expect(html).toContain('libs/common.js');
      expect(html).toContain('theme/default.js');
    });

    it('should use basePath for subpages', () => {
      const html = pageRenderer.render(samplePages[1], {
        allPages: samplePages,
        basePath: '../',
        isIndex: false,
      });

      expect(html).toContain('../libs/jquery/jquery.min.js');
      expect(html).toContain('../theme/content.css');
    });

    it('should include custom styles when provided', () => {
      const html = pageRenderer.render(samplePages[0], {
        allPages: samplePages,
        customStyles: '.custom { color: red; }',
      });

      expect(html).toContain('<style>');
      expect(html).toContain('.custom { color: red; }');
    });
  });

  describe('renderNavigation', () => {
    it('should render navigation with all pages', () => {
      const nav = pageRenderer.renderNavigation(samplePages, 'page1', '');

      expect(nav).toContain('<nav id="siteNav">');
      expect(nav).toContain('<ul>');
      expect(nav).toContain('Home Page');
      expect(nav).toContain('Second Page');
    });

    it('should mark current page as active', () => {
      const nav = pageRenderer.renderNavigation(samplePages, 'page1', '');

      expect(nav).toContain('class="active"');
    });

    it('should handle nested pages (children)', () => {
      const nav = pageRenderer.renderNavigation(samplePages, 'page3', '');

      // Should include child page in nested list
      expect(nav).toContain('Child Page');
      expect(nav).toContain('class="other-section"');
    });

    it('should generate correct links with basePath', () => {
      const nav = pageRenderer.renderNavigation(samplePages, 'page2', '../');

      expect(nav).toContain('../index.html');
      expect(nav).toContain('../html/');
    });
  });

  describe('renderPagination', () => {
    it('should render prev link for non-first page', () => {
      const pagination = pageRenderer.renderPagination(samplePages[1], samplePages, '');

      expect(pagination).toContain('class="prev"');
      expect(pagination).toContain('Home Page');
    });

    it('should render next link for non-last page', () => {
      const pagination = pageRenderer.renderPagination(samplePages[0], samplePages, '');

      expect(pagination).toContain('class="next"');
      expect(pagination).toContain('Second Page');
    });

    it('should return empty string for single page', () => {
      const singlePage = [samplePages[0]];
      const pagination = pageRenderer.renderPagination(singlePage[0], singlePage, '');

      expect(pagination).toBe('');
    });
  });

  describe('renderSinglePage', () => {
    it('should render all pages in single HTML document', () => {
      const html = pageRenderer.renderSinglePage(samplePages, {
        projectTitle: 'Test Project',
        language: 'es',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('exe-single-page');
      expect(html).toContain('section-page1');
      expect(html).toContain('section-page2');
      expect(html).toContain('section-page3');
    });

    it('should use anchor links for navigation', () => {
      const html = pageRenderer.renderSinglePage(samplePages, {
        projectTitle: 'Test',
      });

      expect(html).toContain('href="#section-page1"');
      expect(html).toContain('href="#section-page2"');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove accents and special characters', () => {
      expect(pageRenderer.sanitizeFilename('Página Principal')).toBe('pagina-principal');
    });

    it('should handle empty strings', () => {
      expect(pageRenderer.sanitizeFilename('')).toBe('page');
      expect(pageRenderer.sanitizeFilename(null)).toBe('page');
    });

    it('should truncate long titles', () => {
      const longTitle = 'a'.repeat(100);
      const result = pageRenderer.sanitizeFilename(longTitle);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getPageLink', () => {
    it('should return index.html for first page', () => {
      const link = pageRenderer.getPageLink(samplePages[0], samplePages, '');
      expect(link).toBe('index.html');
    });

    it('should return html/filename.html for other pages', () => {
      const link = pageRenderer.getPageLink(samplePages[1], samplePages, '');
      expect(link).toContain('html/');
      expect(link).toContain('.html');
    });

    it('should add basePath when provided', () => {
      const link = pageRenderer.getPageLink(samplePages[0], samplePages, '../');
      expect(link).toBe('../index.html');
    });
  });

  describe('isAncestorOf', () => {
    it('should return true when page is direct parent', () => {
      expect(pageRenderer.isAncestorOf('page1', 'page3', samplePages)).toBe(true);
    });

    it('should return false when page is not ancestor', () => {
      expect(pageRenderer.isAncestorOf('page2', 'page3', samplePages)).toBe(false);
    });

    it('should return false for root pages', () => {
      expect(pageRenderer.isAncestorOf('page1', 'page1', samplePages)).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(pageRenderer.escapeHtml('<script>')).toBe('&lt;script&gt;');
    });
  });
});
