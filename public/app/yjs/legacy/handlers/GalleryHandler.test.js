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
    it('extracts images in indexed format with resources/ prefix', () => {
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

      expect(props.img_0).toBeDefined();
      expect(props.img_0.img).toBe('resources/image1.jpg');
      expect(props.img_0.thumbnail).toBe('');
      expect(props.img_0.title).toBe('Caption 1');
      expect(props.img_0.linktitle).toBe('');
      expect(props.img_0.author).toBe('');
      expect(props.img_0.linkauthor).toBe('');
      expect(props.img_0.license).toBe('');
    });

    it('extracts images with thumbnails including resources/ prefix', () => {
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
                <string role="key" value="caption"></string>
                <unicode value="Image with thumbnail"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.img_0).toBeDefined();
      expect(props.img_0.img).toBe('resources/big.jpg');
      expect(props.img_0.thumbnail).toBe('resources/thumb.jpg');
      expect(props.img_0.title).toBe('Image with thumbnail');
    });

    it('extracts multiple images with sequential indices', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="first.jpg"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="caption"></string>
                <unicode value="First image"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.galleryidevice.GalleryImage">
              <dictionary>
                <string role="key" value="_imageResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="second.jpg"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="caption"></string>
                <unicode value="Second image"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.img_0).toBeDefined();
      expect(props.img_0.img).toBe('resources/first.jpg');
      expect(props.img_0.title).toBe('First image');

      expect(props.img_1).toBeDefined();
      expect(props.img_1.img).toBe('resources/second.jpg');
      expect(props.img_1.title).toBe('Second image');
    });

    it('returns empty object when no images', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(Object.keys(props).length).toBe(0);
    });
  });

  describe('extractImages', () => {
    it('extracts images from nested GalleryImages wrapper with .listitems (real ELP format)', () => {
      // This is the actual structure from home_is_where_art_is.elp
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="images"></string>
          <instance class="exe.engine.galleryidevice.GalleryImages">
            <dictionary>
              <string role="key" value=".listitems"></string>
              <list>
                <instance class="exe.engine.galleryidevice.GalleryImage">
                  <dictionary>
                    <string role="key" value="_imageResource"></string>
                    <instance class="exe.engine.resource.Resource">
                      <dictionary>
                        <string role="key" value="_storageName"></string>
                        <string value="image1.jpg"></string>
                      </dictionary>
                    </instance>
                    <string role="key" value="_caption"></string>
                    <instance class="exe.engine.field.TextField">
                      <dictionary>
                        <string role="key" value="content"></string>
                        <unicode value="First image caption"></unicode>
                      </dictionary>
                    </instance>
                    <string role="key" value="_thumbnailResource"></string>
                    <instance class="exe.engine.resource.Resource">
                      <dictionary>
                        <string role="key" value="_storageName"></string>
                        <string value="image1Thumbnail.png"></string>
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
                        <string value="image2.jpg"></string>
                      </dictionary>
                    </instance>
                    <string role="key" value="_caption"></string>
                    <instance class="exe.engine.field.TextField">
                      <dictionary>
                        <string role="key" value="content"></string>
                        <unicode value="Second image caption"></unicode>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const images = handler.extractImages(dict);

      expect(images.length).toBe(2);
      expect(images[0].src).toBe('image1.jpg');
      expect(images[0].caption).toBe('First image caption');
      expect(images[0].thumbnail).toBe('image1Thumbnail.png');
      expect(images[1].src).toBe('image2.jpg');
      expect(images[1].caption).toBe('Second image caption');
    });

    it('extracts caption from TextField instance', () => {
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
                <string role="key" value="_caption"></string>
                <instance class="exe.engine.field.TextField">
                  <dictionary>
                    <string role="key" value="content"></string>
                    <unicode value="Caption from TextField"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const images = handler.extractImages(dict);

      expect(images.length).toBe(1);
      expect(images[0].src).toBe('photo.jpg');
      expect(images[0].caption).toBe('Caption from TextField');
    });

    it('extracts image with direct string caption (fallback)', () => {
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
