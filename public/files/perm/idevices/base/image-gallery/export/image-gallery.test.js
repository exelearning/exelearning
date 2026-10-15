/**
 * Unit tests for image-gallery iDevice (export/runtime)
 *
 * Tests configuration and basic functions.
 * Note: This file doesn't have auto-init call but uses eXe.app.isInExe().
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('image-gallery iDevice export', () => {
  let code;

  beforeEach(() => {
    const filePath = join(__dirname, 'image-gallery.js');
    code = readFileSync(filePath, 'utf-8');
  });

  describe('file structure', () => {
    it('defines $imagegallery variable', () => {
      expect(code).toContain('var $imagegallery');
    });

    it('has renderView function', () => {
      expect(code).toContain('renderView:');
    });

    it('has renderBehaviour function', () => {
      expect(code).toContain('renderBehaviour');
    });

    it('has getStringGallery function', () => {
      expect(code).toContain('getStringGallery:');
    });

    it('has getLinkLicense function', () => {
      expect(code).toContain('getLinkLicense:');
    });

    it('has init function', () => {
      expect(code).toContain('init:');
    });
  });

  describe('no auto-init', () => {
    it('does not have auto-init call at end', () => {
      // image-gallery doesn't have $(function() { ... }) auto-init
      expect(code).not.toMatch(/\$\(function\s*\(\)\s*\{\s*\$imagegallery\.init\(\)/);
    });
  });

  describe('SimpleLightbox configuration', () => {
    it('disables fileExt check for blob:// URL support', () => {
      // SimpleLightbox by default checks if href ends with image extension
      // blob:// URLs don't have extensions, so fileExt must be disabled
      expect(code).toContain('fileExt: false');
    });

    it('has createSLightboxGallery function', () => {
      expect(code).toContain('createSLightboxGallery:');
    });
  });

  describe('changeDirectory URL handling', () => {
    it('keeps asset:// URLs as-is', () => {
      // asset:// URLs should not be converted to relative paths
      expect(code).toContain("file.startsWith('asset://')");
    });

    it('keeps blob: URLs as-is', () => {
      // blob: URLs are already resolved and should not be modified
      expect(code).toContain("file.startsWith('blob:')");
    });

    it('keeps data: URLs as-is', () => {
      // data: URLs are inline data and should not be modified
      expect(code).toContain("file.startsWith('data:')");
    });
  });

  describe('renderBehaviour context handling', () => {
    it('only re-renders gallery when not in editor and node exists', () => {
      // Gallery is re-rendered only when not in eXe editor and the node exists
      expect(code).toContain('!isInExe && $node.length == 1');
    });

    it('uses isInExe check from eXe.app', () => {
      // Uses eXe.app.isInExe() to detect editor context
      expect(code).toContain('isInExe = eXe.app.isInExe()');
    });
  });

  describe('changeDirectory folder path handling', () => {
    it('preserves valid content/resources paths', () => {
      // Paths starting with content/resources/ should be preserved
      expect(code).toContain("file.startsWith('content/resources/')");
    });

    it('detects malformed paths with duplicated filename as folder', () => {
      // Handles cases like content/resources/image.png/image.png
      expect(code).toContain('possibleFolder === filename');
    });
  });

  // simple-lightbox.min.js next to this file is stock SimpleLightbox, copied
  // from npm by bundle:vendor. The title/author/license caption is built by
  // $imagegallery.buildCaption and handed over through captionSelector, so the
  // test loads the npm build the export actually ships.
  describe('SimpleLightbox captions', () => {
    let preloads;
    let OriginalImage;

    const gallery = (imgAttrs) => `
        <div id="gallery-1"><div class="imageGallery-IDevice">
          <a title="Sunset" href="full.jpg" class="imageLink">
            <img src="thumb.jpg" ${imgAttrs}/>
          </a>
        </div></div>`;

    const openCaption = () => {
      window.$imagegallery.createSLightboxGallery('gallery-1');
      document.querySelector('#gallery-1 a').click();
      expect(preloads.length).toBeGreaterThan(0);
      preloads.forEach(img => img.dispatchEvent(new Event('load')));
      return document.querySelector('.sl-wrapper .sl-caption');
    };

    beforeEach(() => {
      preloads = [];
      OriginalImage = window.Image;
      // Capture the lightbox's off-DOM preload image so the test can fire its
      // load event (happy-dom does not fetch images).
      window.Image = class extends OriginalImage {
        constructor(...args) {
          super(...args);
          preloads.push(this);
        }
      };
      // The lightbox writes #pid=N to the history; happy-dom's test URL
      // origin rejects that, and it is irrelevant to caption rendering.
      vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
      const lib = createRequire(import.meta.url).resolve('simplelightbox/dist/simple-lightbox.min.js');
      (0, eval)(readFileSync(lib, 'utf-8'));
      (0, eval)(code);
      delete window.$exe_i18n;
    });

    afterEach(() => {
      window.Image = OriginalImage;
      vi.restoreAllMocks();
      document.querySelectorAll('.sl-wrapper, .sl-overlay').forEach(n => n.remove());
      document.body.innerHTML = '';
      delete window.$exe_i18n;
    });

    it('renders title, author link and license link in the caption', () => {
      document.body.innerHTML = gallery(
        'title="Sunset" alt="Sunset" titlelink="" author="Jane Doe" authorlink="https://example.com/jane" license="CC-BY" licenselink="http://creativecommons.org/licenses/"'
      );
      const caption = openCaption();
      expect(caption).not.toBeNull();
      expect(caption.querySelector('.caption.title em').textContent).toBe('Sunset');
      const author = caption.querySelector('a.caption.author');
      expect(author.getAttribute('href')).toBe('https://example.com/jane');
      expect(author.getAttribute('target')).toBe('_blank');
      expect(author.getAttribute('rel')).toBe('noopener');
      expect(author.textContent).toBe('Jane Doe');
      const license = caption.querySelector('.caption.license a[rel~="license"]');
      expect(license.getAttribute('href')).toBe('http://creativecommons.org/licenses/');
      expect(license.getAttribute('rel')).toBe('license nofollow noopener');
      expect(license.textContent).toBe('CC-BY');
      expect(caption.querySelector('.caption.license').textContent).toBe('(CC-BY)');
    });

    it('links the title and keeps plain author and custom license as spans', () => {
      document.body.innerHTML = gallery(
        'title="Sunset" titlelink="https://example.com/sunset" author="Jane Doe" authorlink="" license="Mine" licenselink=""'
      );
      const caption = openCaption();
      expect(caption.querySelector('a.caption.title[href="https://example.com/sunset"] em').textContent).toBe('Sunset');
      expect(caption.querySelector('span.caption.autor').textContent).toBe('Jane Doe');
      expect(caption.querySelector('.caption.license .custom-license').textContent).toBe('Mine');
    });

    it('treats the legacy literal "undefined" attributes as empty', () => {
      document.body.innerHTML = gallery(
        'title="Sunset" titlelink="undefined" author="undefined" authorlink="undefined" license="undefined" licenselink="undefined"'
      );
      const caption = openCaption();
      expect(caption.querySelector('a')).toBeNull();
      expect(caption.querySelector('.caption.author, .caption.autor, .caption.license')).toBeNull();
      expect(caption.textContent).toBe('Sunset');
      expect(caption.textContent).not.toContain('undefined');
    });

    it('shows no caption when every field is empty', () => {
      document.body.innerHTML = gallery(
        'title="" titlelink="" author="undefined" authorlink="" license="" licenselink=""'
      );
      const caption = openCaption();
      expect(caption === null || caption.innerHTML === '' || caption.style.display === 'none').toBe(true);
      expect(window.$imagegallery.buildCaption(document.querySelector('#gallery-1 img'))).toBeNull();
    });

    it('never renders javascript: links', () => {
      document.body.innerHTML = gallery(
        'title="Sunset" titlelink="javascript:alert(1)" author="Jane" authorlink="javascript:alert(1)" license="CC-BY" licenselink="JaVaScRiPt:alert(1)"'
      );
      const caption = openCaption();
      expect(caption.querySelector('a[href]')).toBeNull();
      expect(caption.textContent).toContain('Jane');
      expect(caption.textContent).toContain('Sunset');
    });

    it('renders stored markup as text', () => {
      document.body.innerHTML = gallery(
        'title="&lt;b&gt;bold&lt;/b&gt;" author="&lt;img src=x onerror=window.__pwned=1&gt;" license="CC-BY" licenselink=""'
      );
      const caption = openCaption();
      expect(caption.querySelector('img')).toBeNull();
      expect(caption.querySelector('b')).toBeNull();
      expect(caption.textContent).toContain('<img src=x');
      expect(window.__pwned).toBeUndefined();
    });

    it('labels a license shown alone with the translated $exe_i18n string', () => {
      window.$exe_i18n = { license: 'Licencia' };
      document.body.innerHTML = gallery('title="" author="" license="CC0" licenselink="http://creativecommons.org/publicdomain/zero/1.0/deed"');
      const caption = openCaption();
      expect(caption.querySelector('.caption.license').textContent).toBe('Licencia: CC0');
    });

    it('falls back to an English label without $exe_i18n', () => {
      document.body.innerHTML = gallery('license="Mine"');
      const caption = openCaption();
      expect(caption.querySelector('.caption.license').textContent).toBe('License: Mine');
    });
  });

  describe('getStringGallery escaping', () => {
    beforeEach(() => {
      (0, eval)(code);
      window.eXe.app.isInExe = () => true;
    });

    afterEach(() => {
      delete window.eXe.app.isInExe;
    });

    it('escapes quotes and markup in attribute values', () => {
      const html = window.$imagegallery.getStringGallery({
        ideviceId: 'g1',
        0: {
          img: 'full.jpg',
          thumbnail: 'thumb.jpg',
          title: 'Say "hi" <b>&',
          linktitle: '',
          author: '" onmouseover="window.__x=1',
          linkauthor: '',
          license: 'CC-BY',
        },
      });
      const div = document.createElement('div');
      div.innerHTML = html;
      const img = div.querySelector('img');
      expect(img.getAttribute('title')).toBe('Say "hi" <b>&');
      expect(img.getAttribute('author')).toBe('" onmouseover="window.__x=1');
      expect(img.hasAttribute('onmouseover')).toBe(false);
      expect(div.querySelector('a').getAttribute('title')).toBe('Say "hi" <b>&');
      expect(img.getAttribute('licenselink')).toBe('http://creativecommons.org/licenses/');
    });

    it('keeps the legacy "undefined" text for missing values', () => {
      const html = window.$imagegallery.getStringGallery({
        ideviceId: 'g1',
        0: { img: 'full.jpg', thumbnail: 'thumb.jpg', title: 'T', license: '' },
      });
      expect(html).toContain('author="undefined"');
    });
  });
});
