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
    it('returns default structure for null dict', () => {
      const props = handler.extractProperties(null);
      expect(props).toEqual({
        textTextarea: '',
        imageResource: '',
        isDefaultImage: '1',
        width: 600,
        height: '',
        align: 'left',
        initialZSize: 100,
        glassSize: 2,
      });
    });

    it('returns default structure for empty dict', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props.textTextarea).toBe('');
      expect(props.imageResource).toBe('');
      expect(props.isDefaultImage).toBe('1');
      expect(props.width).toBe(600);
      expect(props.initialZSize).toBe(100);
      expect(props.glassSize).toBe(2);
    });

    it('extracts imageResource from magnifierField', () => {
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
      expect(props.imageResource).toBe('zoom-image.jpg');
      expect(props.isDefaultImage).toBe('0');
    });

    it('extracts textTextarea from caption', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="captionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Instructions here</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.textTextarea).toBe('<p>Instructions here</p>');
    });

    it('converts zoomSize to initialZSize (multiplier to percentage)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="zoomSize"></string>
          <unicode value="2.5"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      // 2.5 * 100 = 250
      expect(props.initialZSize).toBe(250);
    });

    it('converts legacy glassSize px to modern range (1-6)', () => {
      // 50px -> 1, 100px -> 2, 150px -> 3, 200px -> 4, 250px -> 5, 300px -> 6
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="glassSize"></string>
          <unicode value="150"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      // 150 / 50 = 3
      expect(props.glassSize).toBe(3);
    });

    it('clamps glassSize to valid range', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="glassSize"></string>
          <unicode value="500"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      // 500 / 50 = 10, clamped to 6
      expect(props.glassSize).toBe(6);
    });

    it('extracts width from maxImageWidth', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="maxImageWidth"></string>
          <unicode value="800"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.width).toBe(800);
    });

    it('extracts all properties together', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="captionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Look closely</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="zoomSize"></string>
          <unicode value="2"></unicode>
          <string role="key" value="glassSize"></string>
          <unicode value="200"></unicode>
          <string role="key" value="maxImageWidth"></string>
          <unicode value="700"></unicode>
          <string role="key" value="_magnifierField"></string>
          <instance class="exe.engine.imagemagnifieridevice.MagnifierField">
            <dictionary>
              <string role="key" value="_imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <unicode value="detailed-image.jpg"></unicode>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.textTextarea).toBe('<p>Look closely</p>');
      expect(props.imageResource).toBe('detailed-image.jpg');
      expect(props.isDefaultImage).toBe('0');
      expect(props.width).toBe(700);
      expect(props.initialZSize).toBe(200); // 2 * 100
      expect(props.glassSize).toBe(4); // 200 / 50
      expect(props.align).toBe('left');
      expect(props.height).toBe('');
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
