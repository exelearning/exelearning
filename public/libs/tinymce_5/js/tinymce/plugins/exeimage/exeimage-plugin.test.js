/**
 * ExeImage Plugin Bun Tests
 *
 * Unit tests for the exeimage plugin modifications to support blob/asset URLs.
 * Tests the skipSubmit flag logic and figure_old null handling.
 *
 * Run with: bun test public/libs/tinymce_5/js/tinymce/plugins/exeimage/__tests__/
 */

/* eslint-disable no-undef */

describe('ExeImage Plugin - mySubmit skipSubmit Logic', () => {
  let mockTop;
  let mockApi;
  let submitSkipped;

  beforeEach(() => {
    submitSkipped = false;
    mockApi = {
      close: () => {
        submitSkipped = true;
      },
      getData: () => ({
        alt: 'Test image',
        dimensions: { width: 300, height: 200 },
      }),
    };
    mockTop = {
      imgCompressor: {
        originalSrc: 'blob:http://localhost:3001/test',
        isBlob: true,
        isAsset: false,
        skipSubmit: false,
      },
    };
  });

  // Simulates the mySubmit skipSubmit check
  function simulateMySubmitCheck(top, api) {
    if (top.imgCompressor && top.imgCompressor.skipSubmit) {
      top.imgCompressor.skipSubmit = false;
      api.close();
      return true; // Skipped
    }
    return false; // Not skipped, continue with normal submit
  }

  it('should skip submit when skipSubmit flag is true', () => {
    mockTop.imgCompressor.skipSubmit = true;

    const skipped = simulateMySubmitCheck(mockTop, mockApi);

    expect(skipped).toBe(true);
    expect(mockTop.imgCompressor.skipSubmit).toBe(false); // Flag reset
    expect(submitSkipped).toBe(true); // api.close was called
  });

  it('should NOT skip submit when skipSubmit flag is false', () => {
    mockTop.imgCompressor.skipSubmit = false;

    const skipped = simulateMySubmitCheck(mockTop, mockApi);

    expect(skipped).toBe(false);
    expect(submitSkipped).toBe(false);
  });

  it('should NOT skip submit when imgCompressor is undefined', () => {
    mockTop.imgCompressor = undefined;

    const skipped = simulateMySubmitCheck(mockTop, mockApi);

    expect(skipped).toBe(false);
  });

  it('should NOT skip submit when top is undefined', () => {
    const skipped = simulateMySubmitCheck({}, mockApi);

    expect(skipped).toBe(false);
  });
});

describe('ExeImage Plugin - figure_old Null Handling', () => {
  let mockEditor;

  beforeEach(() => {
    const elements = new Map();

    mockEditor = {
      dom: {
        get: (id) => elements.get(id) || null,
        setElement: (id, element) => elements.set(id, element),
        getOuterHTML: (id) => {
          const el = elements.get(id);
          return el ? el.outerHTML : '';
        },
        setHTML: (el, html) => {
          if (el) el.innerHTML = html;
        },
        create: (tag, attrs, html) => ({
          tagName: tag.toUpperCase(),
          ...attrs,
          innerHTML: html,
        }),
      },
    };
  });

  // Simulates the figure_old null check added to mySubmit
  function simulateFigureUpdate(editor, idSelectedImage, api) {
    const figure_old = editor.dom.get('figure_' + idSelectedImage);

    // Skip figure update if figure_old doesn't exist
    if (!figure_old) {
      if (api) api.close();
      return { skipped: true, reason: 'figure_old is null' };
    }

    // Would normally update the figure here...
    return { skipped: false, figure_old };
  }

  it('should skip and close when figure_old does not exist', () => {
    let closed = false;
    const mockApi = { close: () => { closed = true; } };

    const result = simulateFigureUpdate(mockEditor, 'nonexistent', mockApi);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('figure_old is null');
    expect(closed).toBe(true);
  });

  it('should proceed when figure_old exists', () => {
    // Create a mock figure element
    const figureElement = {
      id: 'figure_imagen_1',
      outerHTML: '<figure id="figure_imagen_1"><img src="test.jpg"/></figure>',
      innerHTML: '<img src="test.jpg"/>',
      parentNode: { replaceChild: () => {} },
    };
    mockEditor.dom.setElement('figure_imagen_1', figureElement);

    const result = simulateFigureUpdate(mockEditor, 'imagen_1', null);

    expect(result.skipped).toBe(false);
    expect(result.figure_old).toBe(figureElement);
  });

  it('should handle empty idSelectedImage', () => {
    let closed = false;
    const mockApi = { close: () => { closed = true; } };

    const result = simulateFigureUpdate(mockEditor, '', mockApi);

    expect(result.skipped).toBe(true);
    expect(closed).toBe(true);
  });
});

describe('ExeImage Plugin - Image Type Detection for Blob/Asset', () => {
  function isAssetOrBlobImage(src) {
    if (!src) return false;
    return src.startsWith('blob:') || src.startsWith('asset://');
  }

  it('should detect blob: URLs as asset/blob images', () => {
    expect(isAssetOrBlobImage('blob:http://localhost:3001/uuid')).toBe(true);
  });

  it('should detect asset:// URLs as asset/blob images', () => {
    expect(isAssetOrBlobImage('asset://uuid/filename.jpg')).toBe(true);
  });

  it('should NOT detect regular file paths as asset/blob images', () => {
    expect(isAssetOrBlobImage('files/tmp/session/image.jpg')).toBe(false);
  });

  it('should NOT detect http:// URLs as asset/blob images', () => {
    expect(isAssetOrBlobImage('http://example.com/image.jpg')).toBe(false);
  });

  it('should NOT detect data: URLs as asset/blob images', () => {
    expect(isAssetOrBlobImage('data:image/png;base64,abc')).toBe(false);
  });

  it('should handle null/undefined src', () => {
    expect(isAssetOrBlobImage(null)).toBe(false);
    expect(isAssetOrBlobImage(undefined)).toBe(false);
    expect(isAssetOrBlobImage('')).toBe(false);
  });
});

describe('ExeImage Plugin - TinyMCE Editor Direct Update', () => {
  let mockEditor;
  let selectedNode;

  beforeEach(() => {
    selectedNode = {
      tagName: 'IMG',
      src: 'blob:http://localhost:3001/original',
      width: 800,
      height: 600,
    };

    mockEditor = {
      selection: {
        getNode: () => selectedNode,
      },
      dom: {
        setAttribs: (node, attrs) => {
          Object.assign(node, attrs);
        },
      },
      undoManager: {
        add: () => {},
      },
    };
  });

  function updateImageDirectly(editor, newPath, newWidth, newHeight) {
    const selectedImg = editor.selection.getNode();
    if (selectedImg && selectedImg.tagName === 'IMG') {
      editor.dom.setAttribs(selectedImg, {
        src: newPath,
        width: newWidth,
        height: newHeight,
      });
      editor.undoManager.add();
      return true;
    }
    return false;
  }

  it('should update image attributes when IMG is selected', () => {
    const result = updateImageDirectly(
      mockEditor,
      'blob:http://localhost:3001/new-optimized',
      300,
      225
    );

    expect(result).toBe(true);
    expect(selectedNode.src).toBe('blob:http://localhost:3001/new-optimized');
    expect(selectedNode.width).toBe(300);
    expect(selectedNode.height).toBe(225);
  });

  it('should NOT update when non-IMG element is selected', () => {
    selectedNode.tagName = 'DIV';

    const result = updateImageDirectly(
      mockEditor,
      'blob:http://localhost:3001/new',
      300,
      225
    );

    expect(result).toBe(false);
  });

  it('should NOT update when selection returns null', () => {
    mockEditor.selection.getNode = () => null;

    const result = updateImageDirectly(
      mockEditor,
      'blob:http://localhost:3001/new',
      300,
      225
    );

    expect(result).toBe(false);
  });
});

describe('ExeImage Plugin - centralized caption contract', () => {
  // Mirrors the helpers added to mySubmit: the figure carries the asset id + the
  // per-instance caption presentation as data-* so the live resolver / exporter can
  // re-derive the caption from the centralized File Manager metadata.

  // Mirror of exeAssetIdFromSrc().
  function exeAssetIdFromSrc(src) {
    const m = /^asset:\/\/([a-z0-9-]+?)(?:\.[a-z0-9]+)?(?:[/?#]|$)/i.exec(src || '');
    return m ? m[1] : '';
  }

  // Mirror of exeFigureAttrs().
  function exeFigureAttrs(figureClasses, figureStyle, assetId, heading, notes, hidden) {
    const attrs = { class: figureClasses, style: (figureStyle || '').trim() };
    if (assetId) attrs['data-asset-id'] = assetId;
    if (heading) attrs['data-caption-heading'] = heading;
    if (notes) attrs['data-caption-notes'] = notes;
    if (hidden) attrs['data-caption-hidden'] = 'true';
    return attrs;
  }

  it('extracts the asset id from an asset:// src (with or without extension)', () => {
    expect(exeAssetIdFromSrc('asset://abc123.jpg')).toBe('abc123');
    expect(exeAssetIdFromSrc('asset://abc123')).toBe('abc123');
    expect(exeAssetIdFromSrc('asset://uuid-with-dashes.png')).toBe('uuid-with-dashes');
  });

  it('returns no id for non-asset srcs', () => {
    expect(exeAssetIdFromSrc('https://example.com/x.jpg')).toBe('');
    expect(exeAssetIdFromSrc('blob:http://localhost/abc')).toBe('');
    expect(exeAssetIdFromSrc('')).toBe('');
  });

  it('stamps the asset id + per-instance caption data on the figure, omitting empties', () => {
    const attrs = exeFigureAttrs('exe-figure position-center', 'width: 200px;', 'u1', 'Fig 1', 'A note', true);
    expect(attrs['data-asset-id']).toBe('u1');
    expect(attrs['data-caption-heading']).toBe('Fig 1');
    expect(attrs['data-caption-notes']).toBe('A note');
    expect(attrs['data-caption-hidden']).toBe('true');
  });

  it('omits empty per-instance attributes (clean markup when nothing is set)', () => {
    const attrs = exeFigureAttrs('exe-figure', '', 'u1', '', '', false);
    expect(attrs['data-asset-id']).toBe('u1');
    expect('data-caption-heading' in attrs).toBe(false);
    expect('data-caption-notes' in attrs).toBe(false);
    expect('data-caption-hidden' in attrs).toBe(false);
  });
});

describe('ExeImage Plugin - read-only attribution mirror (asset:// images)', () => {
  // Mirror of exeAttributionMirror(): maps centralized File Manager metadata to the
  // read-only ro_* fields shown (disabled) for asset:// images. MUST stay in lockstep
  // with plugin.min.js.
  function exeAttributionMirror(meta) {
    meta = meta || {};
    return {
      ro_title: meta.title || '',
      ro_author: meta.author || '',
      ro_authorlink: meta.authorUrl || '',
      ro_source: meta.sourceUrl || '',
      ro_license: meta.license || '',
    };
  }

  // Mirror of exeAssetIdFromSrc() (asset id from an asset:// src).
  function exeAssetIdFromSrc(src) {
    const m = /^asset:\/\/([a-z0-9-]+?)(?:\.[a-z0-9]+)?(?:[/?#]|$)/i.exec(src || '');
    return m ? m[1] : '';
  }

  // Mirror of exeImageAssetId(): the figure's data-asset-id (stashed as image.assetId)
  // wins over the display src, which TinyMCE rewrites for editing. MUST stay in lockstep.
  function exeImageAssetId(image) {
    if (!image) return '';
    return image.assetId || exeAssetIdFromSrc(image.src);
  }

  // Mirror of makeDialogBody()'s tab-inclusion branching (tab names only). The dialog
  // uses a tabpanel when there is an advanced/upload tab OR the image is asset-backed;
  // asset-backed images append the read-only 'attribution' tab. Returns null when the
  // dialog falls back to a plain (tab-less) panel.
  function imageDialogTabNames({ isAsset, hasAdvTab, hasUpload }) {
    if (!(hasAdvTab || hasUpload || isAsset)) return null;
    const tabs = ['general'];
    if (hasAdvTab) tabs.push('advanced');
    if (hasUpload) tabs.push('upload');
    if (isAsset) tabs.push('attribution');
    return tabs;
  }

  it('maps centralized File Manager metadata to the disabled ro_* fields', () => {
    const meta = {
      title: 'Sunset',
      author: 'Ada Lovelace',
      authorUrl: 'https://example.org/ada',
      sourceUrl: 'https://example.org/sunset',
      license: 'Creative Commons BY-SA',
    };
    expect(exeAttributionMirror(meta)).toEqual({
      ro_title: 'Sunset',
      ro_author: 'Ada Lovelace',
      ro_authorlink: 'https://example.org/ada',
      ro_source: 'https://example.org/sunset',
      ro_license: 'Creative Commons BY-SA',
    });
  });

  it('yields empty strings for missing metadata or an external image', () => {
    expect(exeAttributionMirror({})).toEqual({
      ro_title: '',
      ro_author: '',
      ro_authorlink: '',
      ro_source: '',
      ro_license: '',
    });
    expect(exeAttributionMirror(null).ro_license).toBe('');
    expect(exeAttributionMirror({ author: 'Only author' }).ro_title).toBe('');
  });

  it('resolves the asset id from the figure data-asset-id first, then the src', () => {
    // On re-open the display src is a rewritten/blob URL — the figure id must still win.
    expect(exeImageAssetId({ assetId: 'u1', src: 'blob:http://localhost/xyz' })).toBe('u1');
    // Fresh insert: no figure id yet, fall back to the asset:// src.
    expect(exeImageAssetId({ assetId: '', src: 'asset://u2.jpg' })).toBe('u2');
    // External image: neither → no asset id.
    expect(exeImageAssetId({ assetId: '', src: 'https://example.com/x.jpg' })).toBe('');
    expect(exeImageAssetId(null)).toBe('');
  });

  it('appends the read-only attribution tab only for asset:// images', () => {
    expect(imageDialogTabNames({ isAsset: true, hasAdvTab: true, hasUpload: false })).toEqual([
      'general',
      'advanced',
      'attribution',
    ]);
    expect(imageDialogTabNames({ isAsset: false, hasAdvTab: true, hasUpload: false })).toEqual([
      'general',
      'advanced',
    ]);
  });

  it('forces a tabpanel for an asset image even without advanced/upload tabs', () => {
    expect(imageDialogTabNames({ isAsset: true, hasAdvTab: false, hasUpload: false })).toEqual([
      'general',
      'attribution',
    ]);
  });

  it('keeps a plain (tab-less) panel for an external image with no advanced/upload tabs', () => {
    expect(imageDialogTabNames({ isAsset: false, hasAdvTab: false, hasUpload: false })).toBeNull();
  });
});

describe('ExeImage Plugin - non-editable auto-derived caption (PR #1868)', () => {
  // Mirrors the caption-locking helpers added to the plugin. The exe-figure caption
  // (header div + figcaption) is auto-derived from the centralized File Manager metadata,
  // so it must be contenteditable="false" inside the editor (typing would be discarded on
  // save) and the attribute must be stripped on serialize so the stored markup stays clean.

  // Mirror of isExeFigureNode().
  function isExeFigureNode(node) {
    const className = node.attr('class');
    return !!className && /\bexe-figure\b/.test(className);
  }

  // Mirror of isExeCaptionNode() — matches both `div.figcaption.header` and `figcaption.figcaption`.
  function isExeCaptionNode(node) {
    const className = node.attr('class');
    return !!className && /\bfigcaption\b/.test(className);
  }

  // Minimal TinyMCE AST node mock: attr(name[, value]) get/set and getAll(tag).
  function makeNode(tag, className, children = []) {
    const attrs = className == null ? {} : { class: className };
    return {
      tag,
      children,
      attr(name, value) {
        if (arguments.length > 1) {
          if (value === null) delete attrs[name];
          else attrs[name] = value;
          return undefined;
        }
        return attrs[name] !== undefined ? attrs[name] : null;
      },
      getAll(t) {
        return children.filter(c => c.tag === t);
      },
    };
  }

  // Mirror of toggleExeCaptionEditableState().
  function toggleExeCaptionEditableState(inEditor) {
    return function (nodes) {
      let i = nodes.length;
      const lockCaption = function (node) {
        if (isExeCaptionNode(node)) {
          node.attr('contenteditable', inEditor ? 'false' : null);
        }
      };
      while (i--) {
        const figure = nodes[i];
        if (!isExeFigureNode(figure)) continue;
        figure.getAll('figcaption').forEach(lockCaption);
        figure.getAll('div').forEach(lockCaption);
      }
    };
  }

  // Mirror of exeLockCaptionEditable() (DOM path used right after figure creation).
  function exeLockCaptionEditable(figureEl) {
    if (!figureEl || typeof figureEl.querySelectorAll !== 'function') return;
    figureEl.querySelectorAll('.figcaption.header, figcaption.figcaption').forEach(function (node) {
      node.setAttribute('contenteditable', 'false');
    });
  }

  it('recognizes exe-figure and caption nodes by class', () => {
    expect(isExeFigureNode(makeNode('figure', 'exe-figure position-center'))).toBe(true);
    expect(isExeFigureNode(makeNode('figure', 'image'))).toBe(false);
    expect(isExeFigureNode(makeNode('figure', null))).toBe(false);
    expect(isExeCaptionNode(makeNode('div', 'figcaption header'))).toBe(true);
    expect(isExeCaptionNode(makeNode('figcaption', 'figcaption'))).toBe(true);
    expect(isExeCaptionNode(makeNode('img', null))).toBe(false);
  });

  it('locks the caption nodes (header + figcaption) non-editable inside the editor', () => {
    const header = makeNode('div', 'figcaption header');
    const footer = makeNode('figcaption', 'figcaption');
    const img = makeNode('img', null);
    const figure = makeNode('figure', 'exe-figure', [header, img, footer]);

    toggleExeCaptionEditableState(true)([figure]);

    expect(header.attr('contenteditable')).toBe('false');
    expect(footer.attr('contenteditable')).toBe('false');
    expect(img.attr('contenteditable')).toBe(null); // image stays as-is
  });

  it('strips contenteditable from caption nodes on serialize', () => {
    const header = makeNode('div', 'figcaption header');
    const footer = makeNode('figcaption', 'figcaption');
    const figure = makeNode('figure', 'exe-figure', [header, footer]);
    toggleExeCaptionEditableState(true)([figure]);

    toggleExeCaptionEditableState(false)([figure]);

    expect(header.attr('contenteditable')).toBe(null);
    expect(footer.attr('contenteditable')).toBe(null);
  });

  it('ignores non-exe figures (legacy upstream figure.image is untouched)', () => {
    const footer = makeNode('figcaption', 'figcaption');
    const legacyFigure = makeNode('figure', 'image', [footer]);

    toggleExeCaptionEditableState(true)([legacyFigure]);

    expect(footer.attr('contenteditable')).toBe(null);
  });

  it('locks the caption in the DOM right after figure creation', () => {
    const calls = [];
    const makeEl = () => ({ setAttribute: (k, v) => calls.push([k, v]) });
    const header = makeEl();
    const footer = makeEl();
    const figureEl = {
      querySelectorAll: sel => {
        expect(sel).toBe('.figcaption.header, figcaption.figcaption');
        return [header, footer];
      },
    };

    exeLockCaptionEditable(figureEl);

    expect(calls).toEqual([
      ['contenteditable', 'false'],
      ['contenteditable', 'false'],
    ]);
  });

  it('is a no-op for missing or non-element figures', () => {
    expect(() => exeLockCaptionEditable(null)).not.toThrow();
    expect(() => exeLockCaptionEditable({})).not.toThrow();
  });
});
