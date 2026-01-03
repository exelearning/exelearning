/**
 * IdeviceList class Tests
 *
 * Unit tests for the IdeviceList class that manages installed iDevices.
 *
 * Run with: make test-frontend
 */

 

import IdeviceList from './idevicesList.js';

describe('IdeviceList', () => {
  let mockManager;

  beforeEach(() => {
    // Mock AppLogger
    window.AppLogger = {
      log: vi.fn(),
    };

    // Mock translation function
    window._ = vi.fn((text) => text);

    // Mock manager
    mockManager = {
      symfonyURL: 'http://localhost:8080',
      app: {
        api: {
          getIdevicesInstalled: vi.fn(),
          endpoints: {
            api_idevices_download_file_resources: {
              path: '/api/idevices/resources',
            },
          },
        },
        project: {
          idevices: {
            loadScriptDynamically: vi.fn(),
            loadStyleByInsertingIt: vi.fn(),
          },
        },
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.AppLogger;
    delete window._;
  });

  describe('constructor', () => {
    it('sets manager reference', () => {
      const list = new IdeviceList(mockManager);
      expect(list.manager).toBe(mockManager);
    });

    it('initializes installed as empty object', () => {
      const list = new IdeviceList(mockManager);
      expect(list.installed).toEqual({});
    });
  });

  describe('load', () => {
    it('calls loadIdevicesInstalled', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue({
        idevices: [],
      });

      const list = new IdeviceList(mockManager);
      const loadSpy = vi.spyOn(list, 'loadIdevicesInstalled');

      await list.load();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadIdevicesInstalled', () => {
    it('populates installed from API response', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue({
        idevices: [
          {
            name: 'text',
            title: 'Text iDevice',
            url: '/files/perm/idevices/base/text',
            editionJs: [],
            editionCss: [],
            exportJs: [],
            exportCss: [],
          },
          {
            name: 'quiz',
            title: 'Quiz iDevice',
            url: '/files/perm/idevices/base/quiz',
            editionJs: [],
            editionCss: [],
            exportJs: [],
            exportCss: [],
          },
        ],
      });

      const list = new IdeviceList(mockManager);
      await list.loadIdevicesInstalled();

      expect(Object.keys(list.installed)).toHaveLength(2);
      expect(list.installed['text']).toBeDefined();
      expect(list.installed['quiz']).toBeDefined();
    });

    it('handles empty API response', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue({
        idevices: [],
      });

      const list = new IdeviceList(mockManager);
      await list.loadIdevicesInstalled();

      expect(Object.keys(list.installed)).toHaveLength(0);
    });

    it('handles null API response', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue(null);

      const list = new IdeviceList(mockManager);
      await list.loadIdevicesInstalled();

      expect(Object.keys(list.installed)).toHaveLength(0);
    });

    it('handles API response without idevices property', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue({});

      const list = new IdeviceList(mockManager);
      await list.loadIdevicesInstalled();

      expect(Object.keys(list.installed)).toHaveLength(0);
    });

    it('creates Idevice instances with correct data', async () => {
      mockManager.app.api.getIdevicesInstalled.mockResolvedValue({
        idevices: [
          {
            name: 'test-idevice',
            title: 'Test',
            url: '/files/perm/idevices/base/test-idevice',
            editionJs: ['test.js'],
            editionCss: ['test.css'],
            exportJs: ['test.js'],
            exportCss: ['test.css'],
          },
        ],
      });

      const list = new IdeviceList(mockManager);
      await list.loadIdevicesInstalled();

      expect(list.installed['test-idevice']).toBeDefined();
      expect(list.installed['test-idevice'].id).toBe('test-idevice');
    });
  });

  describe('loadIdevice', () => {
    it('adds idevice to installed', () => {
      const list = new IdeviceList(mockManager);
      const ideviceData = {
        name: 'new-idevice',
        title: 'New iDevice',
        url: '/files/perm/idevices/base/new-idevice',
        editionJs: [],
        editionCss: [],
        exportJs: [],
        exportCss: [],
      };

      list.loadIdevice(ideviceData);

      expect(list.installed['new-idevice']).toBeDefined();
    });

    it('creates Idevice instance with proper id', () => {
      const list = new IdeviceList(mockManager);
      const ideviceData = {
        name: 'custom',
        title: 'Custom',
        url: '/files/perm/idevices/base/custom',
        editionJs: [],
        editionCss: [],
        exportJs: [],
        exportCss: [],
      };

      list.loadIdevice(ideviceData);

      expect(list.installed['custom'].id).toBe('custom');
    });

    it('overwrites existing idevice with same name', () => {
      const list = new IdeviceList(mockManager);

      list.loadIdevice({
        name: 'test',
        title: 'Version 1',
        url: '/test1',
        editionJs: [],
        editionCss: [],
        exportJs: [],
        exportCss: [],
      });
      list.loadIdevice({
        name: 'test',
        title: 'Version 2',
        url: '/test2',
        editionJs: [],
        editionCss: [],
        exportJs: [],
        exportCss: [],
      });

      expect(list.installed['test'].title).toBe('Version 2');
    });
  });

  describe('removeIdevice', () => {
    it('removes idevice from installed', () => {
      const list = new IdeviceList(mockManager);
      list.installed['to-remove'] = { id: 'to-remove' };

      list.removeIdevice('to-remove');

      expect(list.installed['to-remove']).toBeUndefined();
    });

    it('does nothing if idevice does not exist', () => {
      const list = new IdeviceList(mockManager);
      list.installed['existing'] = { id: 'existing' };

      list.removeIdevice('non-existing');

      expect(list.installed['existing']).toBeDefined();
      expect(Object.keys(list.installed)).toHaveLength(1);
    });
  });

  describe('getIdeviceInstalled', () => {
    it('returns idevice by name', () => {
      const list = new IdeviceList(mockManager);
      const mockIdevice = { id: 'text', title: 'Text' };
      list.installed['text'] = mockIdevice;

      const result = list.getIdeviceInstalled('text');

      expect(result).toBe(mockIdevice);
    });

    it('returns null when not found', () => {
      const list = new IdeviceList(mockManager);

      const result = list.getIdeviceInstalled('non-existing');

      expect(result).toBeNull();
    });

    it('finds correct idevice among multiple', () => {
      const list = new IdeviceList(mockManager);
      list.installed['first'] = { id: 'first' };
      list.installed['second'] = { id: 'second' };
      list.installed['third'] = { id: 'third' };

      expect(list.getIdeviceInstalled('first').id).toBe('first');
      expect(list.getIdeviceInstalled('second').id).toBe('second');
      expect(list.getIdeviceInstalled('third').id).toBe('third');
    });

    it('returns null for empty string name', () => {
      const list = new IdeviceList(mockManager);
      list.installed['test'] = { id: 'test' };

      const result = list.getIdeviceInstalled('');

      expect(result).toBeNull();
    });

    it('returns null for null name', () => {
      const list = new IdeviceList(mockManager);
      list.installed['test'] = { id: 'test' };

      const result = list.getIdeviceInstalled(null);

      expect(result).toBeNull();
    });
  });
});
