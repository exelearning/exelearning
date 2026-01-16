/**
 * FigureNormalizer Tests
 *
 * Tests for the FigureNormalizer utility that transforms exe-figure HTML
 * to add IDs expected by the TinyMCE exeimage plugin.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import the FigureNormalizer (will be available as global in browser)
const FigureNormalizer = require('./FigureNormalizer');

describe('FigureNormalizer', () => {
  beforeEach(() => {
    // Reset counter before each test for isolation
    FigureNormalizer.resetCounter();
  });

  describe('normalize()', () => {
    describe('basic transformation', () => {
      it('should add IDs to a basic exe-figure with class-based attribution', () => {
        const input = `
          <figure class="exe-figure exe-image position-center">
            <img src="resources/image.png" alt="test" />
            <figcaption class="figcaption">
              <a class="author" href="https://example.com">Author Name</a>.
              <span class="title"><em>Image Title</em></span>
              <span class="license">(<a href="http://creativecommons.org/licenses/?lang=es" rel="license">CC BY-SA</a>)</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="imagen_1"');
        expect(result).toContain('class="imagen_1"');
        expect(result).toContain('id="author_imagen_1"');
        expect(result).toContain('id="title_imagen_1"');
        expect(result).toContain('id="license_imagen_1"');
      });

      it('should preserve original classes while adding IDs', () => {
        const input = `
          <figure class="exe-figure exe-image">
            <img src="test.png" class="custom-class" />
            <figcaption class="figcaption">
              <span class="author custom">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('class="exe-figure exe-image"');
        expect(result).toContain('class="custom-class imagen_1"');
        expect(result).toContain('class="author custom"');
        expect(result).toContain('id="author_imagen_1"');
      });

      it('should handle header element inside figcaption', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <div class="figcaption header"><strong>Header Text</strong></div>
            <figcaption class="figcaption">
              <span class="author">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="header_imagen_1"');
      });
    });

    describe('skip conditions', () => {
      it('should skip figures that already have figure_imagen_ ID', () => {
        const input = `
          <figure id="figure_imagen_5" class="exe-figure">
            <img id="imagen_5" class="imagen_5" src="test.png" />
            <figcaption class="figcaption">
              <span id="author_imagen_5" class="author">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // Should remain unchanged
        expect(result).toContain('id="figure_imagen_5"');
        expect(result).toContain('id="imagen_5"');
        expect(result).toContain('id="author_imagen_5"');
        // Should NOT add new IDs
        expect(result).not.toContain('imagen_1');
      });

      it('should skip figures that have any figure_ prefix ID', () => {
        const input = `
          <figure id="figure_custom_id" class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span class="author">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // Should keep existing ID
        expect(result).toContain('id="figure_custom_id"');
        // Should NOT add new figure ID
        expect(result).not.toContain('figure_imagen_1');
      });

      it('should return unchanged content without exe-figure', () => {
        const input = '<p>Regular paragraph</p><img src="test.png" />';
        const result = FigureNormalizer.normalize(input);
        expect(result).toBe(input);
      });

      it('should return empty string for empty input', () => {
        expect(FigureNormalizer.normalize('')).toBe('');
        expect(FigureNormalizer.normalize(null)).toBe(null);
        expect(FigureNormalizer.normalize(undefined)).toBe(undefined);
      });

      it('should return non-string values unchanged', () => {
        expect(FigureNormalizer.normalize(123)).toBe(123);
        expect(FigureNormalizer.normalize({})).toEqual({});
      });
    });

    describe('multiple figures', () => {
      it('should assign unique sequential IDs to multiple figures', () => {
        const input = `
          <figure class="exe-figure">
            <img src="img1.png" />
            <figcaption class="figcaption">
              <span class="author">Author 1</span>
            </figcaption>
          </figure>
          <p>Some text between figures</p>
          <figure class="exe-figure">
            <img src="img2.png" />
            <figcaption class="figcaption">
              <span class="author">Author 2</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="author_imagen_1"');
        expect(result).toContain('id="figure_imagen_2"');
        expect(result).toContain('id="author_imagen_2"');
      });

      it('should maintain counter state across multiple normalize calls', () => {
        const input1 = '<figure class="exe-figure"><img src="1.png" /></figure>';
        const input2 = '<figure class="exe-figure"><img src="2.png" /></figure>';

        const result1 = FigureNormalizer.normalize(input1);
        const result2 = FigureNormalizer.normalize(input2);

        expect(result1).toContain('id="figure_imagen_1"');
        expect(result2).toContain('id="figure_imagen_2"');
      });
    });

    describe('edge cases', () => {
      it('should handle figure without img element', () => {
        const input = `
          <figure class="exe-figure">
            <video src="video.mp4"></video>
            <figcaption class="figcaption">
              <span class="author">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="author_imagen_1"');
        expect(result).not.toContain('id="imagen_1"'); // No img, no img ID
      });

      it('should handle figure without figcaption', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="imagen_1"');
      });

      it('should handle figure with some but not all attribution elements', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span class="author">Only Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="author_imagen_1"');
        expect(result).not.toContain('id="title_imagen_1"');
        expect(result).not.toContain('id="license_imagen_1"');
      });

      it('should handle nested elements inside attribution spans', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <a class="author" href="https://example.com"><strong>Bold Author</strong></a>
              <span class="title"><em><a href="#">Linked Title</a></em></span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="author_imagen_1"');
        expect(result).toContain('id="title_imagen_1"');
      });

      it('should handle direct license link without wrapper span', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span class="author">Author</span>.
              <a class="license" href="http://creativecommons.org">CC BY</a>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="license_imagen_1"');
      });

      it('should handle span.license with plain text (no inner link)', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span class="author">Author</span>.
              <span class="license">Public Domain</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // The span itself should get the ID when there's no inner link
        expect(result).toContain('id="license_imagen_1"');
        expect(result).toContain('class="license"');
      });

      it('should not add ID to license inner link if it already has one', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span class="license">(<a id="existing_license_id" href="#">CC BY</a>)</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // Should keep the existing ID, not overwrite it
        expect(result).toContain('id="existing_license_id"');
        expect(result).not.toContain('id="license_imagen_1"');
      });

      it('should handle img that already has an ID', () => {
        const input = `
          <figure class="exe-figure">
            <img id="my_custom_img" src="test.png" />
            <figcaption class="figcaption">
              <span class="author">Author</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // Should keep existing img ID
        expect(result).toContain('id="my_custom_img"');
        expect(result).not.toContain('id="imagen_1"');
        // But figure should still get ID
        expect(result).toContain('id="figure_imagen_1"');
      });

      it('should handle attribution elements that already have IDs', () => {
        const input = `
          <figure class="exe-figure">
            <img src="test.png" />
            <figcaption class="figcaption">
              <span id="custom_author" class="author">Author</span>
              <span id="custom_title" class="title">Title</span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        // Should keep existing IDs
        expect(result).toContain('id="custom_author"');
        expect(result).toContain('id="custom_title"');
        expect(result).not.toContain('id="author_imagen_1"');
        expect(result).not.toContain('id="title_imagen_1"');
      });
    });

    describe('real-world HTML', () => {
      it('should normalize actual legacy format from contentv3.xml', () => {
        // This is actual HTML from a legacy .elp file
        const legacyHtml = `
          <figure class="exe-figure exe-image position-center license-CC-BY-SA" style="width: 560px;">
            <img src="resources/10_razones_para_usar_exe.png" alt="razones para usar eXe" title="razones para usar eXe" width="560" height="396" />
            <figcaption class="figcaption">
              <a href="https://cedec.intef.es" target="_blank" class="author" rel="noopener">Cedec</a>.
              <span class="title"><em>10 razones para usar eXeLearning en la creación de recursos educativos</em></span>
              <span class="license"><span class="sep">(</span><a href="http://creativecommons.org/licenses/?lang=es" rel="license nofollow noopener" target="_blank" title="Creative Commons BY-SA">CC BY-SA</a><span class="sep">)</span></span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(legacyHtml);

        // Check all expected IDs are present
        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="imagen_1"');
        expect(result).toContain('id="author_imagen_1"');
        expect(result).toContain('id="title_imagen_1"');
        expect(result).toContain('id="license_imagen_1"');

        // Check original attributes are preserved
        expect(result).toContain('class="exe-figure exe-image position-center license-CC-BY-SA"');
        expect(result).toContain('alt="razones para usar eXe"');
        expect(result).toContain('href="https://cedec.intef.es"');
      });

      it('should handle the specific case from issue #984 screenshot', () => {
        // Simulating the "Jorge Centeno Blanco. Croquis planta maqueta (CC BY-SA)" image
        const input = `
          <figure class="exe-figure exe-image position-center license-CC-BY-SA">
            <img src="resources/croquis_planta_maqueta.jpg" alt="Croquis planta maqueta" />
            <figcaption class="figcaption">
              <span class="author">Jorge Centeno Blanco</span>.
              <span class="title"><em>Croquis planta maqueta</em></span>
              <span class="license"><span class="sep">(</span><a href="http://creativecommons.org/licenses/by-sa/4.0/" rel="license">CC BY-SA</a><span class="sep">)</span></span>
            </figcaption>
          </figure>
        `;

        const result = FigureNormalizer.normalize(input);

        expect(result).toContain('id="figure_imagen_1"');
        expect(result).toContain('id="author_imagen_1"');
        expect(result).toContain('id="title_imagen_1"');
        expect(result).toContain('id="license_imagen_1"');
      });
    });
  });

  describe('resetCounter()', () => {
    it('should reset counter to 0', () => {
      // First normalize some figures
      FigureNormalizer.normalize('<figure class="exe-figure"><img src="1.png" /></figure>');
      FigureNormalizer.normalize('<figure class="exe-figure"><img src="2.png" /></figure>');

      // Reset
      FigureNormalizer.resetCounter();

      // Counter should start from 1 again
      const result = FigureNormalizer.normalize('<figure class="exe-figure"><img src="3.png" /></figure>');
      expect(result).toContain('id="figure_imagen_1"');
    });
  });
});
