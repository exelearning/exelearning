/**
 * FigureNormalizer
 *
 * Normalizes exe-figure HTML to add IDs expected by the TinyMCE exeimage plugin.
 *
 * The TinyMCE exeimage plugin expects ID-based elements (e.g., id="author_imagen_1"),
 * but legacy .elp files and saved content use CSS class-based elements (e.g., class="author").
 *
 * This utility transforms class-based exe-figure elements to include the expected IDs,
 * enabling the image attribution fields to be properly read and edited.
 *
 * Usage:
 *   FigureNormalizer.resetCounter();  // Reset at document scope
 *   const normalizedHtml = FigureNormalizer.normalize(html);
 */
class FigureNormalizer {
  /**
   * Counter for generating unique figure/image IDs
   * Reset this at document scope to ensure unique IDs across the document
   */
  static imageCounter = 0;

  /**
   * Reset the image counter (call at document scope before processing)
   */
  static resetCounter() {
    this.imageCounter = 0;
  }

  /**
   * Normalize exe-figure HTML to add IDs expected by TinyMCE exeimage plugin
   *
   * Transforms:
   * - figure.exe-figure → id="figure_imagen_X"
   * - img inside figure → id="imagen_X" + class="imagen_X"
   * - .author element → id="author_imagen_X"
   * - .title element → id="title_imagen_X"
   * - license link/span → id="license_imagen_X"
   * - .figcaption.header → id="header_imagen_X"
   *
   * @param {string} html - HTML content to normalize
   * @returns {string} - Normalized HTML with IDs added
   */
  static normalize(html) {
    // Quick exit for empty or non-matching content
    if (!html || typeof html !== 'string' || !html.includes('exe-figure')) {
      return html;
    }

    // Parse HTML using a container element
    const container = document.createElement('div');
    container.innerHTML = html;

    // Find all exe-figure elements
    const figures = container.querySelectorAll('figure.exe-figure');

    for (const figure of figures) {
      // Skip if already has a figure_imagen_ ID (already normalized)
      if (figure.id && figure.id.startsWith('figure_imagen_')) {
        continue;
      }

      // Also skip if figure has any figure_ ID prefix (could be figure_something)
      if (figure.id && figure.id.startsWith('figure_')) {
        continue;
      }

      // Generate unique suffix for this figure
      this.imageCounter++;
      const suffix = `imagen_${this.imageCounter}`;

      // Set figure ID
      figure.id = `figure_${suffix}`;

      // Set img ID and class
      const img = figure.querySelector('img');
      if (img && !img.id) {
        img.id = suffix;
        img.classList.add(suffix);
      }

      // Normalize attribution elements
      this._addIdIfMissing(figure, '.figcaption.header, div.header', `header_${suffix}`);
      this._addIdIfMissing(figure, '.author', `author_${suffix}`);
      this._addIdIfMissing(figure, '.title', `title_${suffix}`);
      this._addIdToLicense(figure, suffix);
    }

    return container.innerHTML;
  }

  /**
   * Add ID to an element if it doesn't already have one
   * @param {Element} figure - The figure element to search within
   * @param {string} selector - CSS selector to find the element
   * @param {string} id - The ID to add
   * @private
   */
  static _addIdIfMissing(figure, selector, id) {
    const element = figure.querySelector(selector);
    if (element && !element.id) {
      element.id = id;
    }
  }

  /**
   * Add ID to the license element within a figcaption
   *
   * The license can be structured in several ways in legacy content:
   * 1. <span class="license">(<a href="...">CC BY-SA</a>)</span>
   * 2. <a class="license" href="...">CC BY-SA</a>
   * 3. <span class="license">CC BY-SA</span>
   *
   * The exeimage plugin looks for an element with id="license_imagen_X"
   *
   * @param {Element} figure - The figure element to search within
   * @param {string} suffix - The suffix for the ID (e.g., "imagen_1")
   * @private
   */
  static _addIdToLicense(figure, suffix) {
    const figcaption = figure.querySelector('figcaption');
    if (!figcaption) return;

    // Look for various license element patterns
    const licenseSpan = figcaption.querySelector('span.license');
    const licenseLink = figcaption.querySelector('a[rel*="license"], a.license');

    if (licenseSpan) {
      // If the span contains a link, add ID to the link (inner element)
      const innerLink = licenseSpan.querySelector('a');
      if (innerLink && !innerLink.id) {
        innerLink.id = `license_${suffix}`;
      } else if (!licenseSpan.id && !innerLink) {
        // If no inner link, add ID to the span itself
        licenseSpan.id = `license_${suffix}`;
      }
    } else if (licenseLink && !licenseLink.id) {
      // Direct license link without wrapper span
      licenseLink.id = `license_${suffix}`;
    }
  }
}

// Export for Node.js/CommonJS (tests) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FigureNormalizer;
} else if (typeof window !== 'undefined') {
  window.FigureNormalizer = FigureNormalizer;
}
