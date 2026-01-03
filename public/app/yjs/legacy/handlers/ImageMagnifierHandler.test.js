/**
 * ImageMagnifierHandler Tests
 *
 * Unit tests for ImageMagnifierHandler - handles ImageMagnifierIdevice.
 * Based on Symfony OdeOldXmlImageMagnifierIdevice.php behavior.
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
        width: '',
        height: '',
        align: 'left',
        initialZSize: '100',
        maxZSize: '150',
        glassSize: '2',
      });
    });

    it('returns default structure for empty dict', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props.textTextarea).toBe('');
      expect(props.imageResource).toBe('');
      expect(props.isDefaultImage).toBe('1');
      expect(props.width).toBe('');
      expect(props.initialZSize).toBe('100');
      expect(props.glassSize).toBe('2');
    });

    it('extracts imageResource from imageMagnifier key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <string value="sunflowers.jpg"></string>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.imageResource).toBe('resources/sunflowers.jpg');
      expect(props.isDefaultImage).toBe('0');
    });

    it('extracts textTextarea from text TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="text"></string>
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

    it('extracts align from float field', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="float"></string>
          <unicode value="right"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.align).toBe('right');
    });

    it('extracts MagnifierField properties (glassSize, initialZSize, etc.)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="glassSize"></string>
              <unicode value="3"></unicode>
              <string role="key" value="initialZSize"></string>
              <unicode value="150"></unicode>
              <string role="key" value="maxZSize"></string>
              <unicode value="200"></unicode>
              <string role="key" value="width"></string>
              <unicode value="400"></unicode>
              <string role="key" value="height"></string>
              <unicode value="300"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.glassSize).toBe('3');
      expect(props.initialZSize).toBe('150');
      expect(props.maxZSize).toBe('200');
      expect(props.width).toBe('400');
      expect(props.height).toBe('300');
    });

    it('sets isDefaultImage to 1 when no imageResource (ignores XML value)', () => {
      // Even if XML says isDefaultImage = 0, without an actual imageResource
      // we must use the default image (isDefaultImage = '1')
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="isDefaultImage"></string>
              <bool value="0"></bool>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      // No imageResource means use default image
      expect(props.isDefaultImage).toBe('1');
    });

    it('extracts all properties together (real legacy structure)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="float"></string>
          <unicode value="left"></unicode>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="glassSize"></string>
              <unicode value="2"></unicode>
              <string role="key" value="initialZSize"></string>
              <unicode value="100"></unicode>
              <string role="key" value="maxZSize"></string>
              <unicode value="150"></unicode>
              <string role="key" value="width"></string>
              <unicode value="100"></unicode>
              <string role="key" value="height"></string>
              <unicode value="100"></unicode>
              <string role="key" value="imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <string value="sunflowers.jpg"></string>
                </dictionary>
              </instance>
              <string role="key" value="isDefaultImage"></string>
              <bool value="1"></bool>
            </dictionary>
          </instance>
          <string role="key" value="text"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Lorem ipsum text</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.textTextarea).toBe('<p>Lorem ipsum text</p>');
      expect(props.imageResource).toBe('resources/sunflowers.jpg');
      expect(props.isDefaultImage).toBe('0'); // Has imageResource, so custom image (ignore XML value)
      expect(props.width).toBe('100');
      expect(props.height).toBe('100');
      expect(props.initialZSize).toBe('100');
      expect(props.maxZSize).toBe('150');
      expect(props.glassSize).toBe('2');
      expect(props.align).toBe('left');
    });
  });

  describe('extractImagePath', () => {
    it('extracts from imageMagnifier key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <string value="magnified.jpg"></string>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractImagePath(dict);
      expect(path).toBe('resources/magnified.jpg');
    });

    it('extracts from MagnifierField by class', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="imageResource"></string>
              <instance class="exe.engine.resource.Resource">
                <dictionary>
                  <string role="key" value="_storageName"></string>
                  <string value="by-class.jpg"></string>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractImagePath(dict);
      expect(path).toBe('resources/by-class.jpg');
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
          <string role="key" value="imageResource"></string>
          <instance class="exe.engine.resource.Resource">
            <dictionary>
              <string role="key" value="_storageName"></string>
              <string value="resource.jpg"></string>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractResourcePath(dict, 'imageResource');
      expect(path).toBe('resource.jpg');
    });

    it('returns null for missing resource', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const path = handler.extractResourcePath(dict, 'imageResource');
      expect(path).toBeNull();
    });
  });

  describe('getMagnifierFieldDict', () => {
    it('finds MagnifierField by imageMagnifier key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="imageMagnifier"></string>
          <instance class="exe.engine.field.MagnifierField">
            <dictionary>
              <string role="key" value="testKey"></string>
              <unicode value="testValue"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const mDict = handler.getMagnifierFieldDict(dict);
      expect(mDict).not.toBeNull();
      expect(handler.findDictStringValue(mDict, 'testKey')).toBe('testValue');
    });

    it('returns null when not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const mDict = handler.getMagnifierFieldDict(dict);
      expect(mDict).toBeNull();
    });
  });
});
