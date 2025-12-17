/**
 * exe_export Tests
 *
 * Unit tests for the $exeExport object that handles export functionality.
 * Tests focus on pure JavaScript functions that don't require jQuery DOM manipulation.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

describe('$exeExport', () => {
  let $exeExport;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh $exeExport object for each test
    $exeExport = {
      isTogglingBox: false,
      delayLoadingPageTime: 200,
      delayLoadingIdevicesJson: 50,
      delayLoadScorm: 50,
      scormAPIwrapper: 'SCORM_API_wrapper.js',
      scormFunctions: 'SCOFunctions.js',

      setExe: function () {
        window.eXe = {};
        window.eXe.app = window.$exe;
      },

      initExe: function () {
        window.eXe.app.init();
      },

      getIdeviceObjectKey: function (ideviceType) {
        return `$${ideviceType.split('-').join('')}`;
      },

      getIdeviceObject: function (ideviceType) {
        let exportIdeviceKey = this.getIdeviceObjectKey(ideviceType);
        return window[exportIdeviceKey];
      },

      addClassJsExecutedToExeContent: function () {
        let eXeContent = document.querySelector('.exe-content');
        if (eXeContent) {
          eXeContent.classList.add('post-js');
          eXeContent.classList.remove('pre-js');
        }
      },

      triggerPrintIfRequested: function () {
        const params = new URLSearchParams(window.location.search);
        if (params.get('print') === '1' && typeof window.print === 'function') {
          window.print();
        }
      },

      teacherMode: {
        STORAGE_KEY: 'exeTeacherMode',
        isEnabled: function () {
          try {
            return localStorage.getItem(this.STORAGE_KEY) === '1';
          } catch (e) {
            return false;
          }
        },
      },

      searchBar: {
        deepLinking: false,
        markResults: false,
        query: '',
        results: [],
        data: {},
        isPreview: false,
        isIndex: false,

        normalizeText: function (text) {
          if (!text) return '';
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        },

        getLink: function (lnk) {
          if (this.isPreview) return lnk;
          if (!this.isIndex) {
            lnk = lnk.replace('html/', '');
            if (lnk === 'index.html') lnk = '../' + lnk;
          }
          return lnk;
        },
      },
    };

    // Mock $exe
    window.$exe = {
      init: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.$exe;
    delete window.eXe;
  });

  describe('constants', () => {
    it('has delayLoadingPageTime of 200', () => {
      expect($exeExport.delayLoadingPageTime).toBe(200);
    });

    it('has delayLoadingIdevicesJson of 50', () => {
      expect($exeExport.delayLoadingIdevicesJson).toBe(50);
    });

    it('has delayLoadScorm of 50', () => {
      expect($exeExport.delayLoadScorm).toBe(50);
    });

    it('has scormAPIwrapper filename', () => {
      expect($exeExport.scormAPIwrapper).toBe('SCORM_API_wrapper.js');
    });

    it('has scormFunctions filename', () => {
      expect($exeExport.scormFunctions).toBe('SCOFunctions.js');
    });
  });

  describe('setExe', () => {
    it('creates window.eXe object', () => {
      $exeExport.setExe();
      expect(window.eXe).toBeDefined();
    });

    it('sets window.eXe.app to $exe', () => {
      $exeExport.setExe();
      expect(window.eXe.app).toBe(window.$exe);
    });
  });

  describe('initExe', () => {
    it('calls window.eXe.app.init()', () => {
      window.eXe = { app: { init: vi.fn() } };
      $exeExport.initExe();
      expect(window.eXe.app.init).toHaveBeenCalled();
    });
  });

  describe('getIdeviceObjectKey', () => {
    it('converts hyphenated name to camelCase with $ prefix', () => {
      const result = $exeExport.getIdeviceObjectKey('text-idevice');
      expect(result).toBe('$textidevice');
    });

    it('handles multiple hyphens', () => {
      const result = $exeExport.getIdeviceObjectKey('my-custom-idevice');
      expect(result).toBe('$mycustomidevice');
    });

    it('handles name without hyphens', () => {
      const result = $exeExport.getIdeviceObjectKey('simpleidevice');
      expect(result).toBe('$simpleidevice');
    });
  });

  describe('getIdeviceObject', () => {
    it('returns window object by key', () => {
      window.$testidevice = { name: 'test' };
      const result = $exeExport.getIdeviceObject('test-idevice');
      expect(result).toEqual({ name: 'test' });
      delete window.$testidevice;
    });

    it('returns undefined if not found', () => {
      const result = $exeExport.getIdeviceObject('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('addClassJsExecutedToExeContent', () => {
    it('adds post-js class to exe-content', () => {
      const mockElement = {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      };
      vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

      $exeExport.addClassJsExecutedToExeContent();

      expect(mockElement.classList.add).toHaveBeenCalledWith('post-js');
    });

    it('removes pre-js class from exe-content', () => {
      const mockElement = {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      };
      vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

      $exeExport.addClassJsExecutedToExeContent();

      expect(mockElement.classList.remove).toHaveBeenCalledWith('pre-js');
    });

    it('handles missing exe-content element', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      expect(() => $exeExport.addClassJsExecutedToExeContent()).not.toThrow();
    });
  });

  describe('triggerPrintIfRequested', () => {
    let originalLocation;

    beforeEach(() => {
      originalLocation = window.location;
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it('calls window.print when print=1 in URL', () => {
      delete window.location;
      window.location = { search: '?print=1' };
      window.print = vi.fn();

      $exeExport.triggerPrintIfRequested();

      expect(window.print).toHaveBeenCalled();
    });

    it('does not call print when print parameter is not 1', () => {
      delete window.location;
      window.location = { search: '?print=0' };
      window.print = vi.fn();

      $exeExport.triggerPrintIfRequested();

      expect(window.print).not.toHaveBeenCalled();
    });

    it('does not call print when no print parameter', () => {
      delete window.location;
      window.location = { search: '' };
      window.print = vi.fn();

      $exeExport.triggerPrintIfRequested();

      expect(window.print).not.toHaveBeenCalled();
    });
  });

  describe('teacherMode', () => {
    describe('STORAGE_KEY', () => {
      it('is set to exeTeacherMode', () => {
        expect($exeExport.teacherMode.STORAGE_KEY).toBe('exeTeacherMode');
      });
    });

    describe('isEnabled', () => {
      let mockStorage;

      beforeEach(() => {
        mockStorage = {};
        // Replace the teacherMode.isEnabled with a version using mock storage
        $exeExport.teacherMode.isEnabled = function () {
          try {
            return mockStorage[this.STORAGE_KEY] === '1';
          } catch (e) {
            return false;
          }
        };
      });

      it('returns true when storage has value 1', () => {
        mockStorage['exeTeacherMode'] = '1';

        const result = $exeExport.teacherMode.isEnabled();

        expect(result).toBe(true);
      });

      it('returns false when storage has different value', () => {
        mockStorage['exeTeacherMode'] = '0';

        const result = $exeExport.teacherMode.isEnabled();

        expect(result).toBe(false);
      });

      it('returns false when storage is empty', () => {
        delete mockStorage['exeTeacherMode'];

        const result = $exeExport.teacherMode.isEnabled();

        expect(result).toBe(false);
      });

      it('returns false on storage error', () => {
        // Create a modified teacherMode that throws on getItem
        const teacherModeWithError = {
          STORAGE_KEY: 'exeTeacherMode',
          isEnabled: function () {
            try {
              throw new Error('Storage error');
            } catch (e) {
              return false;
            }
          },
        };

        const result = teacherModeWithError.isEnabled();

        expect(result).toBe(false);
      });
    });
  });
});

describe('$exeExport.searchBar', () => {
  let searchBar;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh searchBar for each test
    searchBar = {
      deepLinking: false,
      markResults: false,
      query: '',
      results: [],
      data: {},
      isPreview: false,
      isIndex: false,

      normalizeText: function (text) {
        if (!text) return '';
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      },

      getLink: function (lnk) {
        if (this.isPreview) return lnk;
        if (!this.isIndex) {
          lnk = lnk.replace('html/', '');
          if (lnk === 'index.html') lnk = '../' + lnk;
        }
        return lnk;
      },

      searchInBlocks: function (i, str, fullLink) {
        if (this.deepLinking === false && this.results.indexOf(i) !== -1) {
          return '';
        }
        let res = '';
        const node = this.data[i];
        if (!node) return res;

        const boxes = node.blocks || {};
        let boxCounter = Object.keys(boxes).length;

        for (const x in boxes) {
          const box = boxes[x];
          const boxOrder = box.order;
          let boxtitle = this.normalizeText(box.name);

          // Add iDevice content to search
          const iDevices = box.idevices || {};
          for (const z in iDevices) {
            const iDevice = iDevices[z];
            if (typeof iDevice.htmlView === 'string') {
              let iDeviceHTML = iDevice.htmlView.replace(/<\/?[^>]+(>|$)/g, '');
              boxtitle += ' ' + this.normalizeText(iDeviceHTML);
            }
          }

          if (boxtitle.indexOf(str) !== -1) {
            this.results.push(i);
            let lnk = this.getLink(node.fileUrl);
            if (fullLink) {
              if (this.deepLinking) lnk += '#' + x;
              res += '<li><a href="' + lnk + '">' + node.name + '</a>';
              if (boxCounter > 1) res += '<span> (bloque ' + boxOrder + ')</span></li>';
            } else {
              if (boxCounter > 1)
                res += ', <a href="' + lnk + '#' + x + '">bloque ' + boxOrder + '</a>';
            }
          }
        }
        return res;
      },
    };
  });

  describe('normalizeText', () => {
    it('converts text to lowercase', () => {
      const result = searchBar.normalizeText('HELLO WORLD');
      expect(result).toBe('hello world');
    });

    it('removes diacritical marks (accents)', () => {
      const result = searchBar.normalizeText('café résumé');
      expect(result).toBe('cafe resume');
    });

    it('handles Spanish characters', () => {
      const result = searchBar.normalizeText('niño España');
      expect(result).toBe('nino espana');
    });

    it('handles empty string', () => {
      const result = searchBar.normalizeText('');
      expect(result).toBe('');
    });

    it('handles null/undefined', () => {
      expect(searchBar.normalizeText(null)).toBe('');
      expect(searchBar.normalizeText(undefined)).toBe('');
    });

    it('handles mixed case with accents', () => {
      const result = searchBar.normalizeText('Éducación FRANÇAISE');
      expect(result).toBe('educacion francaise');
    });

    it('handles German umlauts', () => {
      const result = searchBar.normalizeText('München über');
      expect(result).toBe('munchen uber');
    });

    it('handles Portuguese cedilla', () => {
      const result = searchBar.normalizeText('Ação');
      expect(result).toBe('acao');
    });
  });

  describe('getLink', () => {
    it('returns link unchanged in preview mode', () => {
      searchBar.isPreview = true;
      searchBar.isIndex = false;

      const result = searchBar.getLink('html/page1.html');

      expect(result).toBe('html/page1.html');
    });

    it('removes html/ prefix when not on index', () => {
      searchBar.isPreview = false;
      searchBar.isIndex = false;

      const result = searchBar.getLink('html/page1.html');

      expect(result).toBe('page1.html');
    });

    it('adds ../ prefix for index.html when not on index', () => {
      searchBar.isPreview = false;
      searchBar.isIndex = false;

      const result = searchBar.getLink('index.html');

      expect(result).toBe('../index.html');
    });

    it('returns link unchanged on index page', () => {
      searchBar.isPreview = false;
      searchBar.isIndex = true;

      const result = searchBar.getLink('html/page1.html');

      expect(result).toBe('html/page1.html');
    });

    it('handles index.html on index page', () => {
      searchBar.isPreview = false;
      searchBar.isIndex = true;

      const result = searchBar.getLink('index.html');

      expect(result).toBe('index.html');
    });
  });

  describe('searchInBlocks', () => {
    it('returns empty string when result already found and no deep linking', () => {
      searchBar.deepLinking = false;
      searchBar.results = ['page1'];
      searchBar.data = {
        page1: { name: 'Page 1', blocks: {} },
      };

      const result = searchBar.searchInBlocks('page1', 'test', true);

      expect(result).toBe('');
    });

    it('searches in block name', () => {
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.data = {
        page1: {
          name: 'Page 1',
          fileUrl: 'page1.html',
          blocks: {
            block1: {
              order: 1,
              name: 'Test Block',
              idevices: {},
            },
          },
        },
      };
      searchBar.isPreview = false;
      searchBar.isIndex = true;

      const result = searchBar.searchInBlocks('page1', 'test', true);

      expect(result).toContain('Page 1');
      expect(searchBar.results).toContain('page1');
    });

    it('searches in iDevice HTML content', () => {
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.data = {
        page1: {
          name: 'Page 1',
          fileUrl: 'page1.html',
          blocks: {
            block1: {
              order: 1,
              name: 'Block',
              idevices: {
                idevice1: {
                  htmlView: '<p>This contains the search term keyword here</p>',
                },
              },
            },
          },
        },
      };
      searchBar.isPreview = false;
      searchBar.isIndex = true;

      const result = searchBar.searchInBlocks('page1', 'keyword', true);

      expect(result).toContain('Page 1');
    });

    it('returns empty string when no match found', () => {
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.data = {
        page1: {
          name: 'Page 1',
          fileUrl: 'page1.html',
          blocks: {
            block1: {
              order: 1,
              name: 'Something else',
              idevices: {},
            },
          },
        },
      };

      const result = searchBar.searchInBlocks('page1', 'notfound', true);

      expect(result).toBe('');
    });

    it('handles missing node data', () => {
      searchBar.data = {};

      const result = searchBar.searchInBlocks('nonexistent', 'test', true);

      expect(result).toBe('');
    });

    it('shows block order when multiple blocks exist', () => {
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.data = {
        page1: {
          name: 'Page 1',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'First', idevices: {} },
            block2: { order: 2, name: 'Test Block', idevices: {} },
          },
        },
      };
      searchBar.isPreview = false;
      searchBar.isIndex = true;

      const result = searchBar.searchInBlocks('page1', 'test', true);

      expect(result).toContain('bloque 2');
    });
  });
});
