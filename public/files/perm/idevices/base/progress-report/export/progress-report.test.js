/**
 * Unit tests for progress-report iDevice (export)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - normalizeFileName: File name normalization (removes accents, special chars)
 * - formatNumber: Number formatting
 * - addZero: Leading zero addition
 * - extractEvaluationDataHtml: HTML data extraction
 * - buildNestedPages: Page structure building
 */
/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $eXeInforme globally.
 * Replaces 'var $eXeInforme' with 'global.$eXeInforme' to make it accessible.
 */
function loadIdevice(code) {
  // Mock required dependencies
  global.$ = () => ({
    length: 0,
    eq: () => ({ attr: () => '' }),
    each: () => {},
    hasClass: () => false,
    attr: () => '',
    find: () => ({ length: 0, each: () => {}, text: () => '' }),
    html: () => '',
  });
  global.jQuery = global.$;

  global.eXe = {
    app: {
      isInExe: () => false,
      getIdeviceInstalledExportPath: () => '',
      clearHistory: () => {},
      _confirmResponses: new Map(),
    },
  };

  global.$exeDevices = {
    iDevice: {
      gamification: {
        helpers: {
          supportedBrowser: () => true,
          isJsonString: (str) => {
            if (!str) return false;
            try {
              return JSON.parse(str);
            } catch {
              return false;
            }
          },
        },
      },
    },
  };

  // Replace 'var $eXeInforme' with 'global.$eXeInforme' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$eXeInforme\s*=/, 'global.$eXeInforme =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeInforme;
}

describe('progress-report iDevice (export)', () => {
  let $eXeInforme;

  beforeEach(() => {
    // Reset $eXeInforme before loading
    global.$eXeInforme = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'progress-report.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $eXeInforme = loadIdevice(code);
  });

  describe('normalizeFileName', () => {
    it('converts accented vowels to plain vowels', () => {
      expect($eXeInforme.normalizeFileName('árbol')).toBe('arbol');
      expect($eXeInforme.normalizeFileName('éxito')).toBe('exito');
      expect($eXeInforme.normalizeFileName('único')).toBe('unico');
    });

    it('converts ñ to n', () => {
      expect($eXeInforme.normalizeFileName('niño')).toBe('nino');
      expect($eXeInforme.normalizeFileName('España')).toBe('espana');
    });

    it('converts to lowercase', () => {
      expect($eXeInforme.normalizeFileName('HELLO')).toBe('hello');
      expect($eXeInforme.normalizeFileName('MiXeD')).toBe('mixed');
    });

    it('replaces spaces with hyphens', () => {
      expect($eXeInforme.normalizeFileName('hello world')).toBe('hello-world');
      expect($eXeInforme.normalizeFileName('a b c')).toBe('a-b-c');
    });

    it('removes special characters', () => {
      expect($eXeInforme.normalizeFileName('hello@world')).toBe('helloworld');
      expect($eXeInforme.normalizeFileName('test#123')).toBe('test123');
      expect($eXeInforme.normalizeFileName('file:name')).toBe('filename');
    });

    it('replaces ampersand with hyphen', () => {
      expect($eXeInforme.normalizeFileName('A&B')).toBe('a-b');
    });

    it('handles German umlauts', () => {
      expect($eXeInforme.normalizeFileName('über')).toBe('ueber');
      expect($eXeInforme.normalizeFileName('öffnen')).toBe('oeffnen');
      // Note: ß is not in the replacement map so it stays as is
      expect($eXeInforme.normalizeFileName('größe')).toBe('groeße');
    });

    it('collapses multiple hyphens', () => {
      expect($eXeInforme.normalizeFileName('a--b---c')).toBe('a-b-c');
    });

    it('trims leading and trailing hyphens', () => {
      expect($eXeInforme.normalizeFileName('-hello-')).toBe('hello');
      expect($eXeInforme.normalizeFileName('---test---')).toBe('test');
    });

    it('handles empty string', () => {
      expect($eXeInforme.normalizeFileName('')).toBe('');
    });

    it('handles non-string input', () => {
      expect($eXeInforme.normalizeFileName(null)).toBe('');
      expect($eXeInforme.normalizeFileName(undefined)).toBe('');
      expect($eXeInforme.normalizeFileName(123)).toBe('');
    });

    it('handles Vietnamese characters', () => {
      expect($eXeInforme.normalizeFileName('ầ')).toBe('a');
      expect($eXeInforme.normalizeFileName('ế')).toBe('e');
    });

    it('handles Polish characters', () => {
      expect($eXeInforme.normalizeFileName('łódź')).toBe('lodz');
    });

    it('handles Czech characters', () => {
      expect($eXeInforme.normalizeFileName('čeština')).toBe('cheshtina');
    });
  });

  describe('formatNumber', () => {
    it('returns integer as is', () => {
      expect($eXeInforme.formatNumber(5)).toBe(5);
      expect($eXeInforme.formatNumber(10)).toBe(10);
      expect($eXeInforme.formatNumber(0)).toBe(0);
    });

    it('formats decimal numbers to 2 decimal places', () => {
      expect($eXeInforme.formatNumber(5.5)).toBe('5.50');
      expect($eXeInforme.formatNumber(3.14159)).toBe('3.14');
      expect($eXeInforme.formatNumber(7.999)).toBe('8.00');
    });

    it('returns 0 for non-number inputs', () => {
      expect($eXeInforme.formatNumber('string')).toBe(0);
      expect($eXeInforme.formatNumber(null)).toBe(0);
      expect($eXeInforme.formatNumber(undefined)).toBe(0);
    });

    it('returns 0 for NaN', () => {
      expect($eXeInforme.formatNumber(NaN)).toBe(0);
    });

    it('handles negative numbers', () => {
      expect($eXeInforme.formatNumber(-5)).toBe(-5);
      expect($eXeInforme.formatNumber(-3.14)).toBe('-3.14');
    });
  });

  describe('addZero', () => {
    it('adds leading zero to single digit numbers', () => {
      expect($eXeInforme.addZero(0)).toBe('00');
      expect($eXeInforme.addZero(1)).toBe('01');
      expect($eXeInforme.addZero(9)).toBe('09');
    });

    it('returns two digit numbers as is', () => {
      expect($eXeInforme.addZero(10)).toBe(10);
      expect($eXeInforme.addZero(99)).toBe(99);
    });

    it('returns three digit numbers as is', () => {
      expect($eXeInforme.addZero(100)).toBe(100);
    });
  });

  describe('extractEvaluationDataHtml', () => {
    it('extracts evaluation data from HTML with data attributes', () => {
      const html = '<div data-id="12345" data-evaluationid="eval-001"></div>';
      const result = $eXeInforme.extractEvaluationDataHtml(html);

      expect(result).not.toBe(false);
      expect(result.dataId).toBe('12345');
      expect(result.evaluationId).toBe('eval-001');
      expect(result.evaluation).toBe(true); // default when no evaluationb
    });

    it('extracts evaluation boolean when present', () => {
      const htmlTrue = '<div data-id="123" data-evaluationid="eval" data-evaluationb="true"></div>';
      const resultTrue = $eXeInforme.extractEvaluationDataHtml(htmlTrue);
      expect(resultTrue.evaluation).toBe(true);

      const htmlFalse = '<div data-id="123" data-evaluationid="eval" data-evaluationb="false"></div>';
      const resultFalse = $eXeInforme.extractEvaluationDataHtml(htmlFalse);
      expect(resultFalse.evaluation).toBe(false);
    });

    it('handles evaluation values: 1, yes, on as true', () => {
      const html1 = '<div data-id="123" data-evaluationid="eval" data-evaluationb="1"></div>';
      expect($eXeInforme.extractEvaluationDataHtml(html1).evaluation).toBe(true);

      const htmlYes = '<div data-id="123" data-evaluationid="eval" data-evaluationb="yes"></div>';
      expect($eXeInforme.extractEvaluationDataHtml(htmlYes).evaluation).toBe(true);

      const htmlOn = '<div data-id="123" data-evaluationid="eval" data-evaluationb="on"></div>';
      expect($eXeInforme.extractEvaluationDataHtml(htmlOn).evaluation).toBe(true);
    });

    it('returns false for empty or invalid HTML', () => {
      expect($eXeInforme.extractEvaluationDataHtml('')).toBe(false);
      expect($eXeInforme.extractEvaluationDataHtml(null)).toBe(false);
      expect($eXeInforme.extractEvaluationDataHtml('<div>no data</div>')).toBe(false);
    });

    it('returns false when evaluationid is missing', () => {
      const html = '<div data-id="123"></div>';
      expect($eXeInforme.extractEvaluationDataHtml(html)).toBe(false);
    });
  });

  describe('buildNestedPages', () => {
    it('returns empty array for non-array input', () => {
      expect($eXeInforme.buildNestedPages(null)).toEqual([]);
      expect($eXeInforme.buildNestedPages(undefined)).toEqual([]);
      expect($eXeInforme.buildNestedPages('string')).toEqual([]);
      expect($eXeInforme.buildNestedPages({})).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      expect($eXeInforme.buildNestedPages([])).toEqual([]);
    });

    it('builds flat pages correctly', () => {
      const data = [
        {
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Page 1',
          ode_nav_structure_sync_id: 'page-1',
          ode_nav_structure_sync_order: 0,
          navIsActive: 1,
          componentId: null,
        },
        {
          odePageId: 'page-2',
          odeParentPageId: null,
          pageName: 'Page 2',
          ode_nav_structure_sync_id: 'page-2',
          ode_nav_structure_sync_order: 1,
          navIsActive: 1,
          componentId: null,
        },
      ];

      const result = $eXeInforme.buildNestedPages(data);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Page 1');
      expect(result[1].title).toBe('Page 2');
    });

    it('builds nested pages with parent-child relationship', () => {
      const data = [
        {
          odePageId: 'parent',
          odeParentPageId: null,
          pageName: 'Parent Page',
          ode_nav_structure_sync_id: 'parent',
          ode_nav_structure_sync_order: 0,
          navIsActive: 1,
          componentId: null,
        },
        {
          odePageId: 'child',
          odeParentPageId: 'parent',
          pageName: 'Child Page',
          ode_nav_structure_sync_id: 'child',
          ode_nav_structure_sync_order: 0,
          navIsActive: 1,
          componentId: null,
        },
      ];

      const result = $eXeInforme.buildNestedPages(data);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Parent Page');
      expect(result[0].children.length).toBe(1);
      expect(result[0].children[0].title).toBe('Child Page');
    });

    it('includes components in pages', () => {
      const data = [
        {
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'Page 1',
          ode_nav_structure_sync_id: 'page-1',
          ode_nav_structure_sync_order: 0,
          navIsActive: 1,
          componentId: 'comp-1',
          ode_idevice_id: 'idev-1',
          odeIdeviceTypeName: 'quiz',
          blockName: 'Quiz Block',
          htmlViewer: '',
          jsonProperties: null,
        },
      ];

      const result = $eXeInforme.buildNestedPages(data);

      expect(result.length).toBe(1);
      expect(result[0].components.length).toBe(1);
      expect(result[0].components[0].componentId).toBe('comp-1');
      expect(result[0].components[0].blockName).toBe('Quiz Block');
    });

    it('sorts pages by order', () => {
      const data = [
        {
          odePageId: 'page-3',
          odeParentPageId: null,
          pageName: 'Third',
          ode_nav_structure_sync_id: 'page-3',
          ode_nav_structure_sync_order: 2,
          navIsActive: 1,
          componentId: null,
        },
        {
          odePageId: 'page-1',
          odeParentPageId: null,
          pageName: 'First',
          ode_nav_structure_sync_id: 'page-1',
          ode_nav_structure_sync_order: 0,
          navIsActive: 1,
          componentId: null,
        },
        {
          odePageId: 'page-2',
          odeParentPageId: null,
          pageName: 'Second',
          ode_nav_structure_sync_id: 'page-2',
          ode_nav_structure_sync_order: 1,
          navIsActive: 1,
          componentId: null,
        },
      ];

      const result = $eXeInforme.buildNestedPages(data);

      expect(result[0].title).toBe('First');
      expect(result[1].title).toBe('Second');
      expect(result[2].title).toBe('Third');
    });
  });

  describe('isPreviewMode', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.isPreviewMode).toBe('function');
    });
  });

  describe('getEvaluatioID', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.getEvaluatioID).toBe('function');
    });

    it('returns object with required properties', () => {
      const result = $eXeInforme.getEvaluatioID('', '');
      expect(result).toHaveProperty('evaluation');
      expect(result).toHaveProperty('ideviceID');
      expect(result).toHaveProperty('evaluationID');
    });

    it('returns default values for empty input', () => {
      const result = $eXeInforme.getEvaluatioID('', '');
      expect(result.evaluation).toBe(false);
      expect(result.ideviceID).toBe('');
      expect(result.evaluationID).toBe('');
    });

    it('extracts data from HTML', () => {
      const html = '<div data-id="test-id" data-evaluationid="eval-123"></div>';
      const result = $eXeInforme.getEvaluatioID(html, '');
      expect(result.ideviceID).toBe('test-id');
      expect(result.evaluationID).toBe('eval-123');
    });
  });

  describe('options', () => {
    it('is defined as object', () => {
      expect($eXeInforme.options).toBeDefined();
      expect(typeof $eXeInforme.options).toBe('object');
    });
  });

  describe('createInterfaceinforme', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.createInterfaceinforme).toBe('function');
    });
  });

  describe('getURLPage', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.getURLPage).toBe('function');
    });
  });

  describe('getDateNow', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.getDateNow).toBe('function');
    });

    it('returns a formatted date string', () => {
      const result = $eXeInforme.getDateNow();
      expect(typeof result).toBe('string');
      // Format should be dd/mm/yyyy hh:mm:ss
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/);
    });
  });



  describe('generateHtmlFromJsonPages', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.generateHtmlFromJsonPages).toBe('function');
    });
  });

  describe('createPagesHtml', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.createPagesHtml).toBe('function');
    });
  });

  describe('applyTypeShow', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.applyTypeShow).toBe('function');
    });
  });

  describe('extractIdevicesFromDom', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.extractIdevicesFromDom).toBe('function');
    });
  });

  describe('extractIdevicesFromYjs', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.extractIdevicesFromYjs).toBe('function');
    });
  });



  describe('init', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.init).toBe('function');
    });
  });

  describe('loadFromDom', () => {
    it('is defined as a function', () => {
      expect(typeof $eXeInforme.loadFromDom).toBe('function');
    });
  });

  describe('preview data sources', () => {
    it('extractIdevicesFromPagesData uses window.exeSearchData when data-pages is not available', () => {
      const originalDollar = global.$;
      const originalJQuery = global.jQuery;
      const originalSearchData = window.exeSearchData;

      try {
        global.$ = (selector) => {
          if (selector === '#exe-client-search') {
            return { attr: () => '' };
          }
          return {
            attr: () => '',
            length: 0,
            each: () => {},
            find: () => ({ length: 0, each: () => {}, text: () => '' }),
          };
        };
        global.jQuery = global.$;

        window.exeSearchData = {
          'page-1': {
            name: 'Page 1',
            order: 1,
            blocks: {
              'block-1': {
                name: 'Block 1',
                order: 1,
                idevices: {
                  'idevice-1': {
                    order: 1,
                    htmlView: '<div data-evaluationid="ev-1" data-evaluationb="true"></div>',
                    jsonProperties: null,
                  },
                },
              },
            },
          },
        };

        const result = $eXeInforme.extractIdevicesFromPagesData();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('page-1');
        expect(result[0].componentId).toBe('idevice-1');
      } finally {
        window.exeSearchData = originalSearchData;
        global.$ = originalDollar;
        global.jQuery = originalJQuery;
      }
    });

    it('extractIdevicesFromPagesData extracts odeIdeviceTypeName from data-idevice-type in htmlView', () => {
      const originalSearchData = window.exeSearchData;

      try {
        window.exeSearchData = {
          'page-1': {
            name: 'Page 1',
            order: 1,
            blocks: {
              'block-1': {
                name: 'Block 1',
                order: 1,
                idevices: {
                  'idevice-typed': {
                    order: 1,
                    htmlView:
                      '<article class="idevice_node quiz" data-idevice-type="quiz" data-idevice-id="idevice-typed"></article>',
                    jsonProperties: null,
                  },
                  'idevice-untyped': {
                    order: 2,
                    htmlView: '<div>no type attribute here</div>',
                    jsonProperties: null,
                  },
                },
              },
            },
          },
        };

        const result = $eXeInforme.extractIdevicesFromPagesData();
        expect(result.length).toBe(2);

        const typed = result.find((r) => r.componentId === 'idevice-typed');
        expect(typed.odeIdeviceTypeName).toBe('quiz');

        const untyped = result.find((r) => r.componentId === 'idevice-untyped');
        expect(untyped.odeIdeviceTypeName).toBe('');
      } finally {
        window.exeSearchData = originalSearchData;
      }
    });

    it('extractIdevicesFromParentYjs reads from window.opener in new-tab preview', () => {
      const originalOpenerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener');
      const originalExtractFromYjs = $eXeInforme.extractIdevicesFromYjs;

      try {
        $eXeInforme.extractIdevicesFromYjs = () => [
          { odePageId: 'page-from-opener', componentId: 'idevice-from-opener' },
        ];

        Object.defineProperty(window, 'opener', {
          configurable: true,
          value: {
            eXeLearning: {
              app: {
                project: {
                  odeSession: 'session-opener',
                  _yjsBridge: {
                    documentManager: {},
                  },
                },
              },
            },
          },
        });

        const result = $eXeInforme.extractIdevicesFromParentYjs();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('page-from-opener');
      } finally {
        $eXeInforme.extractIdevicesFromYjs = originalExtractFromYjs;

        if (originalOpenerDescriptor) {
          Object.defineProperty(window, 'opener', originalOpenerDescriptor);
        } else {
          delete window.opener;
        }
      }
    });
  });

  describe('ordering regressions', () => {
    it('extractIdevicesFromYjs uses page order instead of navigation index', () => {
      const makeYMap = (data) => ({
        get: (key) => data[key],
      });

      const pageA = makeYMap({
        id: 'page-a',
        title: 'Page A',
        parentId: null,
        order: 5,
        blocks: {
          length: 0,
          get: () => null,
        },
      });

      const pageB = makeYMap({
        id: 'page-b',
        title: 'Page B',
        parentId: null,
        order: 1,
        blocks: {
          length: 0,
          get: () => null,
        },
      });

      const navigation = {
        length: 2,
        get: (idx) => (idx === 0 ? pageA : pageB),
      };

      const yjsBridge = {
        documentManager: {
          ydoc: {
            getArray: () => navigation,
          },
        },
      };

      const result = $eXeInforme.extractIdevicesFromYjs(yjsBridge, 'session-1');

      const rowA = result.find((row) => row.odePageId === 'page-a');
      const rowB = result.find((row) => row.odePageId === 'page-b');

      expect(rowA.ode_nav_structure_sync_order).toBe(5);
      expect(rowB.ode_nav_structure_sync_order).toBe(1);
    });

    it('parseOdeXmlToJson sorts pages by odeNavStructureOrder', () => {
      const originalDOMParser = global.DOMParser;

      const makeTextNode = (value) => ({ textContent: value });
      const makeNavNode = ({ id, parentId, name, order }) => ({
        querySelector: (selector) => {
          if (selector === 'odePageId') return makeTextNode(id);
          if (selector === 'odeParentPageId') return makeTextNode(parentId || '');
          if (selector === 'pageName') return makeTextNode(name);
          if (selector === 'odeNavStructureOrder') return makeTextNode(String(order));
          return null;
        },
        querySelectorAll: (selector) => {
          if (selector === 'odePagStructures > odePagStructure') return [];
          return [];
        },
      });

      const nodeB = makeNavNode({ id: 'page-b', parentId: null, name: 'Page B', order: 2 });
      const nodeA = makeNavNode({ id: 'page-a', parentId: null, name: 'Page A', order: 1 });

      global.DOMParser = class {
        parseFromString() {
          return {
            querySelectorAll: (selector) => {
              if (selector === 'odeNavStructures > odeNavStructure') {
                return [nodeB, nodeA];
              }
              return [];
            },
          };
        }
      };

      try {
        const result = $eXeInforme.parseOdeXmlToJson('<ode />');
        expect(result.map((p) => p.id)).toEqual(['page-a', 'page-b']);
      } finally {
        global.DOMParser = originalDOMParser;
      }
    });
  });
});
