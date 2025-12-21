/**
 * ImageMagnifierHandler Tests
 *
 * Unit tests for ImageMagnifierHandler - handles ImageMagnifierIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const ImageMagnifierHandler = require('./ImageMagnifierHandler');

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

describe('ImageMagnifierHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ImageMagnifierHandler();
  });

  describe('canHandle', () => {
    it('returns true for ImageMagnifierIdevice', () => {
      expect(handler.canHandle('exe.engine.imagemagnifieridevice.ImageMagnifierIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.imagegalleryidevice.ImageGalleryIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns magnifier', () => {
      expect(handler.getTargetType()).toBe('magnifier');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from captionTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="captionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Image caption</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Image caption</p>');
    });

    it('extracts from descriptionTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="descriptionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Description</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Description</p>');
    });

    it('extracts from direct caption value', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="caption"></string>
          <unicode value="Simple caption"></unicode>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Simple caption</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts image source from magnifierField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
            <dictionary>
              <string role="key" value="_imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <unicode value="zoom-image.jpg"></unicode>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.imageSrc).toBe('zoom-image.jpg');
    });

    it('extracts zoomSize', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="zoomSize"></string>
          <unicode value="2.5"></unicode>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
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
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.zoomSize).toBe(2.5);
    });

    it('extracts glassSize', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="glassSize"></string>
          <unicode value="200"></unicode>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
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
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.glassSize).toBe(200);
    });

    it('extracts maxWidth', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="maxImageWidth"></string>
          <unicode value="800"></unicode>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
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
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.maxWidth).toBe(800);
    });

    it('extracts initial zoom position', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="initialZoomX"></string>
          <unicode value="0.5"></unicode>
          <string role="key" value="initialZoomY"></string>
          <unicode value="0.3"></unicode>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
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
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.initialZoomX).toBe(0.5);
      expect(props.initialZoomY).toBe(0.3);
    });

    it('returns empty object for null dict', () => {
      const props = handler.extractProperties(null);
      expect(props).toEqual({});
    });
  });

  describe('extractImagePath', () => {
    it('extracts from magnifierField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
            <dictionary>
              <string role="key" value="_imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <unicode value="magnified.jpg"></unicode>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractImagePath(dict);
      expect(path).toBe('magnified.jpg');
    });

    it('extracts from direct imageResource', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_imageResource"></string>
          <instance class="exe.engine.resource.Resource">
            <dictionary>
              <string role="key" value="_storageName"></string>
              <unicode value="direct-image.jpg"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractImagePath(dict);
      expect(path).toBe('direct-image.jpg');
    });

    it('returns null when no image found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const path = handler.extractImagePath(dict);
      expect(path).toBeNull();
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
