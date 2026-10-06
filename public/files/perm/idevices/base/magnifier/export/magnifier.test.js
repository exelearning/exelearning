/**
 * Unit tests for magnifier iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getImageName: Extract image filename from path
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $magnifier globally.
 * Replaces 'var $magnifier' with 'global.$magnifier' to make it accessible.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$magnifier\s*=/, 'global.$magnifier =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$magnifier;
}

describe('magnifier iDevice export', () => {
  let $magnifier;

  beforeEach(() => {
    global.$magnifier = undefined;

    const filePath = join(__dirname, 'magnifier.js');
    const code = readFileSync(filePath, 'utf-8');

    $magnifier = loadExportIdevice(code);
  });

  describe('getImageName', () => {
    it('extracts filename from unix path', () => {
      expect($magnifier.getImageName('/path/to/image.jpg')).toBe('image.jpg');
    });

    it('does not handle windows backslash paths (only forward slash)', () => {
      // getImageName only splits by '/', not '\\'
      // Windows paths with backslashes are returned as-is
      expect($magnifier.getImageName('C:\\path\\to\\image.png')).toBe('C:\\path\\to\\image.png');
    });

    it('returns filename when no path separator', () => {
      expect($magnifier.getImageName('image.gif')).toBe('image.gif');
    });

    it('handles paths with multiple extensions', () => {
      expect($magnifier.getImageName('/path/to/file.name.jpg')).toBe('file.name.jpg');
    });

    it('handles deep nested paths', () => {
      expect($magnifier.getImageName('/a/b/c/d/e/f/image.webp')).toBe('image.webp');
    });

    it('handles empty string', () => {
      expect($magnifier.getImageName('')).toBe('');
    });
  });

  describe('msgs', () => {
    it('has default message definitions', () => {
      expect($magnifier.msgs).toBeDefined();
      expect($magnifier.msgs.msgFullScreen).toBe('Pantalla completa');
      expect($magnifier.msgs.msgNotImage).toBe('La imagen no está disponible');
    });
  });

  describe('isInExe', () => {
    it('is initialized as true', () => {
      expect($magnifier.isInExe).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initialized as empty string', () => {
      expect($magnifier.idevicePath).toBe('');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $magnifier.init).toBe('function');
    });
  });

  describe('renderView', () => {
    it('exists as a function', () => {
      expect(typeof $magnifier.renderView).toBe('function');
    });
  });

  describe('renderBehaviour', () => {
    it('exists as a function', () => {
      expect(typeof $magnifier.renderBehaviour).toBe('function');
    });
  });

  describe('transformObject', () => {
    it('exists as a function', () => {
      expect(typeof $magnifier.transformObject).toBe('function');
    });
  });

  describe('createInterfaceMagnifier', () => {
    it('exists as a function', () => {
      expect(typeof $magnifier.createInterfaceMagnifier).toBe('function');
    });
  });

  describe('changeDirectory (export path resolution)', () => {
    beforeEach(() => {
      // changeDirectory relies on eXe.app.isInExe(); the shared setup mock
      // does not define it, so provide a controllable stub (default: export).
      global.eXe.app.isInExe = () => false;
      document.documentElement.removeAttribute('id');
      document.body.innerHTML = '';
    });

    function mountNode(id) {
      document.body.innerHTML = `<div id="${id}" class="idevice_node magnifier"></div>`;
    }

    it('returns the resource unchanged inside the eXe editor', () => {
      global.eXe.app.isInExe = () => true;
      mountNode('idev-1');
      const out = $magnifier.changeDirectory({
        ideviceId: 'idev-1',
        imageResource: 'content/resources/img.jpg',
      });
      expect(out).toBe('content/resources/img.jpg');
    });

    it('returns the resource unchanged when the iDevice node is missing', () => {
      const out = $magnifier.changeDirectory({
        ideviceId: 'absent',
        imageResource: 'content/resources/img.jpg',
      });
      expect(out).toBe('content/resources/img.jpg');
    });

    it('returns a falsy resource untouched', () => {
      mountNode('idev-1');
      expect(
        $magnifier.changeDirectory({ ideviceId: 'idev-1', imageResource: '' })
      ).toBe('');
    });

    it.each(['blob:http://x/y', 'data:image/png;base64,AAA', 'asset://uuid.jpg'])(
      'keeps %s URLs as-is',
      (url) => {
        mountNode('idev-1');
        expect(
          $magnifier.changeDirectory({ ideviceId: 'idev-1', imageResource: url })
        ).toBe(url);
      }
    );

    it('preserves content/resources path on the index page (regression #1953)', () => {
      document.documentElement.id = 'exe-index';
      const ideviceId = 'idevice-1780487482081-mnjl9i39r';
      mountNode(ideviceId);
      const out = $magnifier.changeDirectory({
        ideviceId,
        imageResource: 'content/resources/img_animales.jpg',
      });
      // Must NOT insert the iDevice id as an intermediate folder.
      expect(out).toBe('content/resources/img_animales.jpg');
      expect(out).not.toContain(ideviceId);
    });

    it('prepends ../ for a content/resources path on a subpage', () => {
      mountNode('idev-1'); // no #exe-index id on <html> => subpage
      const out = $magnifier.changeDirectory({
        ideviceId: 'idev-1',
        imageResource: 'content/resources/img_animales.jpg',
      });
      expect(out).toBe('../content/resources/img_animales.jpg');
    });

    it('collapses a duplicated <filename>/<filename> tail', () => {
      document.documentElement.id = 'exe-index';
      mountNode('idev-1');
      const out = $magnifier.changeDirectory({
        ideviceId: 'idev-1',
        imageResource: 'content/resources/img.jpg/img.jpg',
      });
      expect(out).toBe('content/resources/img.jpg');
    });

    it('leaves an already page-relative ../content/resources path untouched', () => {
      mountNode('idev-1');
      const out = $magnifier.changeDirectory({
        ideviceId: 'idev-1',
        imageResource: '../content/resources/img.jpg',
      });
      expect(out).toBe('../content/resources/img.jpg');
    });
  });
});
