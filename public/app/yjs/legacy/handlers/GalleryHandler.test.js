/**
 * GalleryHandler Tests
 *
 * Unit tests for GalleryHandler - handles ImageGalleryIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const GalleryHandler = require('./GalleryHandler');

// Helper to parse XML
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

// Escape XML special characters
const escapeXml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

describe('GalleryHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new GalleryHandler();
  });

  describe('canHandle', () => {
    it('returns true for ImageGalleryIdevice', () => {
      expect(handler.canHandle('exe.engine.imagegalleryidevice.ImageGalleryIdevice')).toBe(true);
    });

    it('returns true for GalleryIdevice', () => {
      expect(handler.canHandle('exe.engine.galleryidevice.GalleryIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns image-gallery', () => {
      expect(handler.getTargetType()).toBe('image-gallery');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from descriptionTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="descriptionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Gallery description</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Gallery description</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts images array', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="image1.jpg"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="caption"></string>
                <unicode value="Caption 1"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.images).toBeDefined();
      expect(props.images.length).toBe(1);
    });

    it('extracts showCaptions setting', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="showCaptions"></string>
          <bool value="1"></bool>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="image.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.showCaptions).toBe(true);
    });

    it('extracts showThumbnails setting', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="showThumbnails"></string>
          <bool value="1"></bool>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="image.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.showThumbnails).toBe(true);
    });
  });

  describe('extractImages', () => {
    it('extracts image with caption', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="photo.jpg"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="caption"></string>
                <unicode value="Photo caption"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const images = handler.extractImages(dict);

      expect(images.length).toBe(1);
      expect(images[0].src).toBe('photo.jpg');
      expect(images[0].caption).toBe('Photo caption');
      expect(images[0].alt).toBe('Photo caption');
    });

    it('extracts image with thumbnail', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="big.jpg"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="_thumbnailResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="thumb.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const images = handler.extractImages(dict);

      expect(images[0].thumbnail).toBe('thumb.jpg');
    });

    it('handles multiple images', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="img1.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="img2.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="img3.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const images = handler.extractImages(dict);
      expect(images.length).toBe(3);
    });

    it('looks for _images key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_images"></string>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="image.jpg"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const images = handler.extractImages(dict);
      expect(images.length).toBe(1);
    });

    it('returns empty array when no images', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const images = handler.extractImages(dict);
      expect(images).toEqual([]);
    });
  });

  describe('extractResourcePath', () => {
    it('extracts storage name from resource', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_imageResource"></string>
          <instance class="exe.engine.resource.Resource">
            <dictionary>
              <string role="key" value="_storageName"></string>
              <unicode value="resource.jpg"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractResourcePath(dict, '_imageResource');
      expect(path).toBe('resource.jpg');
    });

    it('returns null for missing resource', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const path = handler.extractResourcePath(dict, '_imageResource');
      expect(path).toBeNull();
    });
  });
});
