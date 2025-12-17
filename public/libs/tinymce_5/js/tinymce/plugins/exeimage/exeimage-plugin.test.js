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
