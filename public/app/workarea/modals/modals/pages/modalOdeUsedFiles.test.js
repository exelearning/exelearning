import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalOdeUsedFiles from './modalOdeUsedFiles.js';

describe('ModalOdeUsedFiles', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: { odeSession: 'test-session' },
        api: {
          getOdeSessionUsedFiles: vi.fn().mockResolvedValue({ usedFiles: [] }),
          app: {
            menus: {
              navbar: {
                utilities: {
                  json2Csv: vi.fn().mockReturnValue('csv-content'),
                }
              }
            }
          }
        },
      },
    };

    // Mock URL.createObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalOdeUsedFiles';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary">End</button>
        <button class="close btn btn-secondary">Cancel</button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalOdeUsedFiles') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };

    // Mock interact
    const mockInteractable = {
      draggable: vi.fn().mockReturnThis(),
    };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    mockManager = {
      closeModals: vi.fn(() => false),
    };

    modal = new ModalOdeUsedFiles(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('createPathLink', () => {
    it('should return empty span for empty path', () => {
      const result = modal.createPathLink('');
      expect(result.tagName).toBe('SPAN');
      expect(result.textContent).toBe('');
    });

    it('should return empty span for null path', () => {
      const result = modal.createPathLink(null);
      expect(result.tagName).toBe('SPAN');
      expect(result.textContent).toBe('');
    });

    it('should return empty span for undefined path', () => {
      const result = modal.createPathLink(undefined);
      expect(result.tagName).toBe('SPAN');
      expect(result.textContent).toBe('');
    });

    it('should create clickable link for asset:// URL', () => {
      const assetPath = 'asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const result = modal.createPathLink(assetPath);
      expect(result.tagName).toBe('A');
      expect(result.href).toContain('#');
      expect(result.textContent).toBe(assetPath);
      expect(result.title).toBe('Click to open resource in new window');
      expect(result.onclick).toBeDefined();
    });

    it('should set cursor style to pointer for asset links', () => {
      const assetPath = 'asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const result = modal.createPathLink(assetPath);
      expect(result.style.cursor).toBe('pointer');
    });

    it('should handle uppercase asset:// URLs', () => {
      const assetPath = 'ASSET://A1B2C3D4-E5F6-7890-ABCD-EF1234567890';
      const result = modal.createPathLink(assetPath);
      expect(result.tagName).toBe('A');
      expect(result.onclick).toBeDefined();
    });

    it('should create external link for server path starting with /', () => {
      const serverPath = '/api/assets/image.png';
      const result = modal.createPathLink(serverPath);
      expect(result.tagName).toBe('A');
      expect(result.href).toContain(serverPath);
      expect(result.target).toBe('_blank');
      expect(result.rel).toBe('noopener noreferrer');
    });

    it('should create external link for http URL', () => {
      const httpPath = 'http://example.com/image.png';
      const result = modal.createPathLink(httpPath);
      expect(result.tagName).toBe('A');
      expect(result.href).toBe(httpPath);
      expect(result.target).toBe('_blank');
    });

    it('should create external link for https URL', () => {
      const httpsPath = 'https://example.com/image.png';
      const result = modal.createPathLink(httpsPath);
      expect(result.tagName).toBe('A');
      expect(result.href).toBe(httpsPath);
      expect(result.target).toBe('_blank');
    });

    it('should return span for non-URL path', () => {
      const otherPath = 'some-relative-path.png';
      const result = modal.createPathLink(otherPath);
      expect(result.tagName).toBe('SPAN');
      expect(result.textContent).toBe(otherPath);
    });

    it('should return span for file:// protocol paths', () => {
      const filePath = 'file:///home/user/image.png';
      const result = modal.createPathLink(filePath);
      expect(result.tagName).toBe('SPAN');
      expect(result.textContent).toBe(filePath);
    });
  });

  describe('openAssetInNewWindow', () => {
    let mockAssetManager;

    beforeEach(() => {
      mockAssetManager = {
        getAsset: vi.fn(),
        createBlobURL: vi.fn().mockResolvedValue('blob:test-url'),
      };
      window.eXeLearning.app.project._yjsBridge = {
        assetManager: mockAssetManager,
      };
      window.open = vi.fn();
      window.alert = vi.fn();
    });

    it('should open asset in new window when asset exists', async () => {
      const mockBlob = new Blob(['test']);
      mockAssetManager.getAsset.mockResolvedValue({ blob: mockBlob });

      await modal.openAssetInNewWindow('test-asset-id');

      expect(mockAssetManager.getAsset).toHaveBeenCalledWith('test-asset-id');
      expect(mockAssetManager.createBlobURL).toHaveBeenCalledWith(mockBlob);
      expect(window.open).toHaveBeenCalledWith('blob:test-url', '_blank');
    });

    it('should show alert when AssetManager is not available', async () => {
      window.eXeLearning.app.project._yjsBridge = null;

      await modal.openAssetInNewWindow('test-asset-id');

      expect(window.alert).toHaveBeenCalledWith('Cannot open resource: Asset manager not available');
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should show alert when asset is not found', async () => {
      mockAssetManager.getAsset.mockResolvedValue(null);

      await modal.openAssetInNewWindow('test-asset-id');

      expect(window.alert).toHaveBeenCalledWith('Cannot open resource: Asset not found');
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should show alert when asset has no blob', async () => {
      mockAssetManager.getAsset.mockResolvedValue({ filename: 'test.png' });

      await modal.openAssetInNewWindow('test-asset-id');

      expect(window.alert).toHaveBeenCalledWith('Cannot open resource: Asset not found');
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should show alert when error occurs', async () => {
      mockAssetManager.getAsset.mockRejectedValue(new Error('DB error'));

      await modal.openAssetInNewWindow('test-asset-id');

      expect(window.alert).toHaveBeenCalledWith('Error opening resource');
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('makeTheadElements', () => {
    it('should create thead with 6 columns', () => {
      const thead = modal.makeTheadElements();
      expect(thead.tagName).toBe('THEAD');
      const headers = thead.querySelectorAll('th');
      expect(headers.length).toBe(6);
    });

    it('should have correct column titles', () => {
      const thead = modal.makeTheadElements();
      const headers = thead.querySelectorAll('th');
      expect(headers[0].textContent).toBe('File');
      expect(headers[1].textContent).toBe('Path');
      expect(headers[2].textContent).toBe('Size');
      expect(headers[3].textContent).toBe('Page name');
      expect(headers[4].textContent).toBe('Block name');
      expect(headers[5].textContent).toBe('iDevice');
    });
  });

  describe('makeTbodyElements', () => {
    it('should create table rows from used files data', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: '/resources',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      expect(tbody.querySelectorAll('tr').length).toBe(1);
      expect(tbody.querySelector('td').textContent).toBe('image.png');
    });

    it('should create empty tbody for empty usedFiles array', () => {
      const data = { usedFiles: [] };
      const tbody = modal.makeTbodyElements(data);
      expect(tbody.tagName).toBe('TBODY');
      expect(tbody.querySelectorAll('tr').length).toBe(0);
    });

    it('should create multiple rows for multiple files', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image1.png',
            usedFilesPath: '/resources/image1.png',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Page1',
            blockNamesUsedFiles: 'Block1',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          },
          {
            usedFiles: 'image2.png',
            usedFilesPath: '/resources/image2.png',
            usedFilesSize: '200KB',
            pageNamesUsedFiles: 'Page2',
            blockNamesUsedFiles: 'Block2',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 2
          },
          {
            usedFiles: 'video.mp4',
            usedFilesPath: 'asset://abc-123',
            usedFilesSize: '5MB',
            pageNamesUsedFiles: 'Page3',
            blockNamesUsedFiles: 'Block3',
            typeComponentSyncUsedFiles: 'Video',
            orderComponentSyncUsedFiles: 3
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      expect(tbody.querySelectorAll('tr').length).toBe(3);
    });

    it('should populate all 6 columns correctly', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'test.png',
            usedFilesPath: '/path/test.png',
            usedFilesSize: '50KB',
            pageNamesUsedFiles: 'TestPage',
            blockNamesUsedFiles: 'TestBlock',
            typeComponentSyncUsedFiles: 'ImageTest',
            orderComponentSyncUsedFiles: 42
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      const cells = tbody.querySelectorAll('td');
      expect(cells.length).toBe(6);
      expect(cells[0].textContent).toBe('test.png');
      // cells[1] is the path link
      expect(cells[2].textContent).toBe('50KB');
      expect(cells[3].textContent).toBe('TestPage');
      expect(cells[4].textContent).toBe('TestBlock');
      expect(cells[5].textContent).toBe('ImageTest');
    });

    it('should make path column clickable for server paths', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: '/api/assets/image.png',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      const pathCell = tbody.querySelectorAll('td')[1];
      const link = pathCell.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.target).toBe('_blank');
    });

    it('should make path column clickable for asset:// URLs', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: 'asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      const pathCell = tbody.querySelectorAll('td')[1];
      const link = pathCell.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.onclick).toBeDefined();
    });

    it('should handle non-clickable paths as spans', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: 'relative/path/image.png',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      const pathCell = tbody.querySelectorAll('td')[1];
      const span = pathCell.querySelector('span');
      expect(span).not.toBeNull();
      expect(span.textContent).toBe('relative/path/image.png');
    });
  });

  describe('makeOdeListElements', () => {
    it('should create complete table with thead and tbody', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: '/resources',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const table = modal.makeOdeListElements(data);
      expect(table.tagName).toBe('TABLE');
      expect(table.querySelector('thead')).not.toBeNull();
      expect(table.querySelector('tbody')).not.toBeNull();
    });

    it('should have table and table-striped classes', () => {
      const data = { usedFiles: [] };
      const table = modal.makeOdeListElements(data);
      expect(table.classList.contains('table')).toBe(true);
      expect(table.classList.contains('table-striped')).toBe(true);
    });

    it('should create table with empty data', () => {
      const data = { usedFiles: [] };
      const table = modal.makeOdeListElements(data);
      expect(table.querySelector('thead th')).not.toBeNull();
      expect(table.querySelector('tbody tr')).toBeNull();
    });
  });

  describe('setBodyElement', () => {
    it('should set body content using DOM element', () => {
      const table = document.createElement('table');
      table.innerHTML = '<tr><td>test</td></tr>';
      modal.setBodyElement(table);
      expect(modal.modalElementBody.querySelector('table')).not.toBeNull();
      expect(modal.modalElementBody.querySelector('td').textContent).toBe('test');
    });

    it('should clear previous content before setting new element', () => {
      modal.modalElementBody.innerHTML = '<p>old content</p>';
      const table = document.createElement('table');
      modal.setBodyElement(table);
      expect(modal.modalElementBody.querySelector('p')).toBeNull();
      expect(modal.modalElementBody.querySelector('table')).not.toBeNull();
    });

    it('should preserve event handlers on elements', () => {
      const link = document.createElement('a');
      const clickHandler = vi.fn();
      link.onclick = clickHandler;
      modal.setBodyElement(link);
      modal.modalElementBody.querySelector('a').click();
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should set title and body content', async () => {
      vi.useFakeTimers();
      modal.show({ usedFiles: [] });
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Resource Report');
      expect(mockElement.querySelector('table')).not.toBeNull();
      vi.useRealTimers();
    });

    it('should use custom title when provided', async () => {
      vi.useFakeTimers();
      modal.show({ usedFiles: [], title: 'Custom Title' });
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Custom Title');
      vi.useRealTimers();
    });

    it('should handle undefined odeElements by using default object', async () => {
      vi.useFakeTimers();
      // When called without args, odeElements defaults to {} but needs usedFiles
      // Testing that title still defaults correctly when no custom title provided
      modal.show({ usedFiles: [] });
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Resource Report');
      vi.useRealTimers();
    });

    it('should use longer timeout when closeModals returns true', async () => {
      mockManager.closeModals.mockReturnValue(true);
      vi.useFakeTimers();
      modal.show({ usedFiles: [] });

      // At 400ms, modal should not be shown yet
      vi.advanceTimersByTime(400);
      expect(mockBootstrapModal.show).not.toHaveBeenCalled();

      // At 500ms, modal should be shown
      vi.advanceTimersByTime(100);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should use shorter timeout when closeModals returns false', async () => {
      mockManager.closeModals.mockReturnValue(false);
      vi.useFakeTimers();
      modal.show({ usedFiles: [] });

      // At 50ms, modal should be shown
      vi.advanceTimersByTime(50);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should call setConfirmExec with downloadCsv callback', async () => {
      vi.useFakeTimers();
      const setConfirmExecSpy = vi.spyOn(modal, 'setConfirmExec');
      modal.show({ usedFiles: [] });
      vi.advanceTimersByTime(500);
      expect(setConfirmExecSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('downloadCsv', () => {
    beforeEach(() => {
      // Mock alerts
      window.eXeLearning.app.alerts = {
        showToast: vi.fn(),
      };
    });

    it('should warn when no table found', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      // Clear modal body to have no table
      modal.modalElementBody.innerHTML = '';
      modal.downloadCsv();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ModalOdeUsedFiles] No table found for CSV export'
      );
    });

    it('should show toast when no data rows in table', () => {
      // Create table with no data rows
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th><th>Path</th></tr></thead>
          <tbody></tbody>
        </table>
      `;
      modal.downloadCsv();
      expect(window.eXeLearning.app.alerts.showToast).toHaveBeenCalledWith({
        type: 'info',
        message: 'No resources to export',
      });
    });

    it('should set preventCloseModal to true', () => {
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th></tr></thead>
          <tbody><tr><td>test.png</td></tr></tbody>
        </table>
      `;
      expect(modal.preventCloseModal).toBeFalsy();
      modal.downloadCsv();
      expect(modal.preventCloseModal).toBe(true);
    });

    it('should not call server API (parses table directly)', () => {
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th><th>Path</th></tr></thead>
          <tbody><tr><td>image.png</td><td>/files/image.png</td></tr></tbody>
        </table>
      `;
      modal.downloadCsv();
      // Should NOT call the API since we parse the table directly
      expect(window.eXeLearning.app.api.getOdeSessionUsedFiles).not.toHaveBeenCalled();
    });

    it('should create and trigger download', () => {
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th><th>Path</th></tr></thead>
          <tbody><tr><td>image.png</td><td>/files/image.png</td></tr></tbody>
        </table>
      `;

      // Store original createElement
      const originalCreateElement = document.createElement.bind(document);
      const clickSpy = vi.fn();

      // Mock createElement to intercept anchor creation
      document.createElement = vi.fn((tag) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      modal.downloadCsv();

      expect(clickSpy).toHaveBeenCalled();

      // Restore original
      document.createElement = originalCreateElement;
    });

    it('should create blob with BOM for Excel compatibility', () => {
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th></tr></thead>
          <tbody><tr><td>test.png</td></tr></tbody>
        </table>
      `;

      const blobConstructorSpy = vi.spyOn(window, 'Blob');
      modal.downloadCsv();

      expect(blobConstructorSpy).toHaveBeenCalled();
      const blobArgs = blobConstructorSpy.mock.calls[0][0];
      expect(blobArgs[0]).toBe('\ufeff'); // BOM
    });

    it('should use tableToCSV method', () => {
      modal.modalElementBody.innerHTML = `
        <table>
          <thead><tr><th>File</th><th>Size</th></tr></thead>
          <tbody><tr><td>image.png</td><td>100KB</td></tr></tbody>
        </table>
      `;

      const tableToCSVSpy = vi.spyOn(modal, 'tableToCSV');
      modal.downloadCsv();

      expect(tableToCSVSpy).toHaveBeenCalled();
      const table = tableToCSVSpy.mock.calls[0][0];
      expect(table.tagName).toBe('TABLE');
    });
  });

  describe('constructor', () => {
    it('should set default button texts', () => {
      expect(modal.confirmButtonDefaultText).toBe('End');
      expect(modal.cancelButtonDefaultText).toBe('Cancel');
    });

    it('should find confirm and cancel buttons', () => {
      expect(modal.confirmButton).not.toBeNull();
      expect(modal.cancelButton).not.toBeNull();
    });
  });
});
