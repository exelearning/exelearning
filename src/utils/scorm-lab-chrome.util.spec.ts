import { describe, expect, test } from 'bun:test';
import { parseScormManifest, flattenManifest, renderScormLabChrome } from './scorm-lab-chrome.util';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MAN" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>My Course</title>
      <item identifier="I1" identifierref="R1">
        <title>Page 1</title>
        <item identifier="I1a" identifierref="R1a">
          <title>Page 1 - 1</title>
        </item>
      </item>
      <item identifier="I2" identifierref="R2">
        <title>Page 2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" adlcp:scormtype="sco" href="index.html"/>
    <resource identifier="R1a" type="webcontent" adlcp:scormtype="sco" href="html/p1-1.html"/>
    <resource identifier="R2" type="webcontent" adlcp:scormtype="sco" href="html/p2.html"/>
  </resources>
</manifest>`;

const SINGLE_ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MAN" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>One</title>
      <item identifier="ONLY" identifierref="ONLY_R"><title>Only</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="ONLY_R" href="only.html"/>
  </resources>
</manifest>`;

describe('parseScormManifest', () => {
    test('reads org title, item tree, and resolves identifierref to href', () => {
        const m = parseScormManifest(SAMPLE_XML);
        expect(m.title).toBe('My Course');
        expect(m.items).toHaveLength(2);
        expect(m.items[0].title).toBe('Page 1');
        expect(m.items[0].href).toBe('index.html');
        expect(m.items[0].children).toHaveLength(1);
        expect(m.items[0].children[0].title).toBe('Page 1 - 1');
        expect(m.items[0].children[0].href).toBe('html/p1-1.html');
        expect(m.items[1].href).toBe('html/p2.html');
    });

    test('handles a manifest with a single item (not wrapped in array)', () => {
        const m = parseScormManifest(SINGLE_ITEM_XML);
        expect(m.title).toBe('One');
        expect(m.items).toHaveLength(1);
        expect(m.items[0].href).toBe('only.html');
    });

    test('falls back to a default title when org has none', () => {
        const xml = SAMPLE_XML.replace('<title>My Course</title>', '');
        const m = parseScormManifest(xml);
        expect(m.title).toBe('SCORM Content');
    });
});

describe('flattenManifest', () => {
    test('flattens to a depth-first list of items that have href', () => {
        const m = parseScormManifest(SAMPLE_XML);
        const flat = flattenManifest(m);
        expect(flat.map(e => e.href)).toEqual(['index.html', 'html/p1-1.html', 'html/p2.html']);
        expect(flat[0].depth).toBe(0);
        expect(flat[0].parentId).toBeNull();
        expect(flat[1].depth).toBe(1);
        expect(flat[1].parentId).toBe('I1');
        expect(flat[2].depth).toBe(0);
        expect(flat[2].parentId).toBeNull();
    });

    test('skips items with no href but keeps descendants visible at their own depth', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <manifest xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
          <organizations default="O"><organization identifier="O"><title>X</title>
            <item identifier="FOLDER"><title>Folder</title>
              <item identifier="LEAF" identifierref="R"><title>Leaf</title></item>
            </item>
          </organization></organizations>
          <resources><resource identifier="R" href="leaf.html"/></resources>
        </manifest>`;
        const flat = flattenManifest(parseScormManifest(xml));
        expect(flat).toHaveLength(1);
        expect(flat[0].href).toBe('leaf.html');
        expect(flat[0].depth).toBe(1);
        expect(flat[0].parentId).toBe('FOLDER');
    });
});

describe('renderScormLabChrome', () => {
    test('produces an HTML document with title, nav buttons, and the first SCO as iframe src', () => {
        const m = parseScormManifest(SAMPLE_XML);
        const html = renderScormLabChrome(m, 'es');
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('My Course');
        expect(html).toContain('id="nav-skipprev"');
        expect(html).toContain('id="nav-prev"');
        expect(html).toContain('id="nav-up"');
        expect(html).toContain('id="nav-next"');
        expect(html).toContain('id="nav-skipnext"');
        expect(html).toContain('src="index.html"');
        // The flat TOC list is embedded as inline JSON.
        expect(html).toContain('"href":"index.html"');
        expect(html).toContain('"href":"html/p2.html"');
    });

    test('escapes title characters so they cannot break out of the HTML', () => {
        const xml = SAMPLE_XML.replace(
            '<title>My Course</title>',
            '<title>Evil &lt;script&gt;alert(1)&lt;/script&gt;</title>',
        );
        const html = renderScormLabChrome(parseScormManifest(xml));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('Evil &lt;script&gt;alert(1)&lt;/script&gt;');
    });
});
