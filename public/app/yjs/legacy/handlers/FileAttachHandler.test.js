/**
 * FileAttachHandler Tests
 *
 * Unit tests for FileAttachHandler - handles FileAttachIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const FileAttachHandler = require('./FileAttachHandler');

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

describe('FileAttachHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new FileAttachHandler();
  });

  describe('canHandle', () => {
    it('returns true for FileAttachIdevice', () => {
      expect(handler.canHandle('exe.engine.fileattachidevice.FileAttachIdevice')).toBe(true);
    });

    it('returns true for AttachmentIdevice', () => {
      expect(handler.canHandle('exe.engine.attachmentidevice.AttachmentIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text (Symfony converts to text iDevice with file links)', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractIntroHtml', () => {
    it('extracts instructions from introHTML TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="introHTML"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="&lt;p&gt;estas son las instrucciones&lt;/p&gt;"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const introHtml = handler.extractIntroHtml(dict);

      expect(introHtml).toContain('<p>estas son las instrucciones</p>');
    });

    it('returns empty string when no introHTML', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractIntroHtml(dict)).toBe('');
    });
  });

  describe('extractHtmlView', () => {
    it('generates file links HTML (Symfony format)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="document.pdf"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="_displayName"></string>
                <unicode value="My Document"></unicode>
                <string role="key" value="_description"></string>
                <unicode value="A PDF file"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);

      // Format: <p><a href="path" target="_blank" download="filename">description</a></p>
      expect(html).toContain('<p><a href=');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('download="document.pdf"');
      expect(html).toContain('document.pdf');
      expect(html).toContain('A PDF file'); // description used as link text
    });

    it('includes introHTML before file links', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="introHTML"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="&lt;p&gt;Instructions text&lt;/p&gt;"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="fileAttachmentFields"></string>
          <list>
            <instance class="exe.engine.extendedfieldengine.FileField">
              <dictionary>
                <string role="key" value="fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="file.mp3"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="fileDescription"></string>
                <instance class="exe.engine.field.TextField">
                  <dictionary>
                    <string role="key" value="content"></string>
                    <unicode value="Audio file description"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);

      // Should have introHTML BEFORE file links
      expect(html).toContain('<p>Instructions text</p>');
      expect(html).toContain('<p><a href=');
      expect(html).toContain('download="file.mp3"');
      expect(html).toContain('Audio file description');

      // Verify order: instructions before file links
      const introIndex = html.indexOf('Instructions text');
      const linkIndex = html.indexOf('Audio file description');
      expect(introIndex).toBeLessThan(linkIndex);
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no files', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('returns only introHTML when no files', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="introHTML"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="&lt;p&gt;Only instructions&lt;/p&gt;"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Only instructions</p>');
      expect(html).not.toContain('<a href=');
    });
  });

  describe('extractProperties', () => {
    it('returns textTextarea with file links HTML', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="file.pdf"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.textTextarea).toBeDefined();
      expect(props.textTextarea).toContain('file.pdf');
      expect(props.textTextarea).toContain('target="_blank"');
    });

    it('returns empty object when no files', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractFiles', () => {
    it('extracts file with display name, description and path', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="report.pdf"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="_displayName"></string>
                <unicode value="Annual Report"></unicode>
                <string role="key" value="_description"></string>
                <unicode value="PDF version"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const files = handler.extractFiles(dict);

      expect(files.length).toBe(1);
      expect(files[0].filename).toBe('report.pdf');
      expect(files[0].displayName).toBe('Annual Report');
      expect(files[0].description).toBe('PDF version');
      expect(files[0].path).toBe('resources/report.pdf');
    });

    it('extracts files from fileAttachmentFields key (FileAttachIdeviceInc format)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fileAttachmentFields"></string>
          <list>
            <instance class="exe.engine.extendedfieldengine.FileField">
              <dictionary>
                <string role="key" value="fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <string value="file_example_MP3_700KB.mp3"></string>
                  </dictionary>
                </instance>
                <string role="key" value="fileDescription"></string>
                <instance class="exe.engine.field.TextField">
                  <dictionary>
                    <string role="key" value="content"></string>
                    <unicode value="Audio file"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.extendedfieldengine.FileField">
              <dictionary>
                <string role="key" value="fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <string value="El_Cid.elp"></string>
                  </dictionary>
                </instance>
                <string role="key" value="fileDescription"></string>
                <instance class="exe.engine.field.TextField">
                  <dictionary>
                    <string role="key" value="content"></string>
                    <unicode value="ELP project file"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const files = handler.extractFiles(dict);

      expect(files.length).toBe(2);
      expect(files[0].filename).toBe('file_example_MP3_700KB.mp3');
      expect(files[0].description).toBe('Audio file');
      expect(files[0].path).toBe('resources/file_example_MP3_700KB.mp3');
      expect(files[1].filename).toBe('El_Cid.elp');
      expect(files[1].description).toBe('ELP project file');
      expect(files[1].path).toBe('resources/El_Cid.elp');
    });

    it('handles multiple files', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="file1.pdf"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="file2.doc"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="file3.txt"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const files = handler.extractFiles(dict);
      expect(files.length).toBe(3);
    });

    it('looks for files key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="files"></string>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="attached.pdf"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const files = handler.extractFiles(dict);
      expect(files.length).toBe(1);
    });

    it('uses filename as displayName if not provided', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.fileattachidevice.FileField">
              <dictionary>
                <string role="key" value="_fileResource"></string>
                <instance class="exe.engine.resource.Resource">
                  <dictionary>
                    <string role="key" value="_storageName"></string>
                    <unicode value="noname.pdf"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const files = handler.extractFiles(dict);
      expect(files[0].displayName).toBe('noname.pdf');
    });

    it('returns empty array when no files list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const files = handler.extractFiles(dict);
      expect(files).toEqual([]);
    });
  });

  describe('extractResourcePath', () => {
    it('extracts storage name from resource', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_fileResource"></string>
          <instance class="exe.engine.resource.Resource">
            <dictionary>
              <string role="key" value="_storageName"></string>
              <unicode value="resource.pdf"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const path = handler.extractResourcePath(dict, '_fileResource');
      expect(path).toBe('resource.pdf');
    });

    it('returns null for missing resource', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const path = handler.extractResourcePath(dict, '_fileResource');
      expect(path).toBeNull();
    });
  });
});
