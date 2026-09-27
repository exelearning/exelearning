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

  // simple-lightbox.min.js next to this file is an eXe-patched SimpleLightbox
  // 2.10.3 (array captionsData + title/author/license caption links). Stock
  // SimpleLightbox only reads a single attribute, so replacing the file with an
  // upstream build silently drops author and license from every gallery.
  describe('patched SimpleLightbox captions', () => {
    let preloads;
    let OriginalImage;

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
      (0, eval)(readFileSync(join(__dirname, 'simple-lightbox.min.js'), 'utf-8'));
      (0, eval)(code);
      document.body.innerHTML = `
        <div id="gallery-1"><div class="imageGallery-IDevice">
          <a title="Sunset" href="full.jpg" class="imageLink">
            <img src="thumb.jpg" title="Sunset" alt="Sunset" titlelink=""
              author="Jane Doe" authorlink="https://example.com/jane"
              license="CC-BY" licenselink="http://creativecommons.org/licenses/"/>
          </a>
        </div></div>`;
    });

    afterEach(() => {
      window.Image = OriginalImage;
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('renders title, author link and license link in the caption', () => {
      window.$imagegallery.createSLightboxGallery('gallery-1');
      document.querySelector('#gallery-1 a').click();
      expect(preloads.length).toBeGreaterThan(0);
      preloads.forEach(img => img.dispatchEvent(new Event('load')));

      const caption = document.querySelector('.sl-wrapper .sl-caption');
      expect(caption).not.toBeNull();
      expect(caption.querySelector('.caption.title em').textContent).toBe('Sunset');
      const author = caption.querySelector('a.caption.author');
      expect(author.getAttribute('href')).toBe('https://example.com/jane');
      expect(author.textContent).toBe('Jane Doe');
      const license = caption.querySelector('.caption.license a[rel~="license"]');
      expect(license.getAttribute('href')).toBe('http://creativecommons.org/licenses/');
      expect(license.textContent).toBe('CC-BY');
    });
  });
});
