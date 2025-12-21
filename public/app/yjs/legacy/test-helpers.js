/**
 * Test helpers for legacy handler tests
 *
 * Provides XML parsing utilities for creating test fixtures
 */

// Create a real XML DOM parser for proper testing
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

// Helper to get dictionary element from XML
const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

// Helper to create TextAreaField XML
const textAreaFieldXml = (content) => `
  <instance class="exe.engine.field.TextAreaField">
    <dictionary>
      <string role="key" value="content_w_resourcePaths"></string>
      <unicode value="${escapeXml(content)}"></unicode>
    </dictionary>
  </instance>
`;

// Escape XML special characters
const escapeXml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

module.exports = {
  createXmlDoc,
  parseDictionary,
  textAreaFieldXml,
  escapeXml
};
