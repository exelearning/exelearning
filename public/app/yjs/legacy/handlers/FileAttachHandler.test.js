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
    it('returns download-source-file', () => {
      expect(handler.getTargetType()).toBe('download-source-file');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts intro text and file links', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="introductoryText"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Download files:</p>')}"></unicode>
            </dictionary>
          </instance>
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

      expect(html).toContain('<p>Download files:</p>');
      expect(html).toContain('document.pdf');
      expect(html).toContain('My Document');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts files array', () => {
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

      expect(props.files).toBeDefined();
      expect(props.files.length).toBe(1);
    });

    it('returns empty object when no files', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractFiles', () => {
    it('extracts file with display name and description', () => {
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
