/**
 * ApiCallBaseFunctions Tests
 *
 * Unit tests for the ApiCallBaseFunctions class that handles AJAX requests.
 *
 * Run with: make test-frontend
 */

 

import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

describe('ApiCallBaseFunctions', () => {
  let mockAjax;
  let originalAjax;
  let mockBody;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock body element
    mockBody = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
    vi.spyOn(document, 'querySelector').mockReturnValue(mockBody);

    // Stub jQuery ajax
    originalAjax = global.$.ajax;
    mockAjax = vi.fn().mockResolvedValue({ success: true });
    global.$.ajax = mockAjax;

    // Mock eXeLearning global
    global.eXeLearning = {
      config: {
        clientCallWaitingTime: 30000,
        basePath: '/web/exelearning',
      },
      app: {
        toasts: {
          default: {
            createToast: vi.fn(),
          },
        },
      },
    };

    // Mock translation function
    global._ = vi.fn((text) => text);
  });

  afterEach(() => {
    vi.useRealTimers();
    global.$.ajax = originalAjax;
    delete global.eXeLearning;
    delete global._;
  });

  describe('constructor', () => {
    it('initializes nCurretPetitions to 0', () => {
      const api = new ApiCallBaseFunctions();
      expect(api.nCurretPetitions).toBe(0);
    });

    it('initializes _accessErrorHandled to false', () => {
      const api = new ApiCallBaseFunctions();
      expect(api._accessErrorHandled).toBe(false);
    });

    it('queries body element', () => {
      new ApiCallBaseFunctions();
      expect(document.querySelector).toHaveBeenCalledWith('body');
    });
  });

  describe('handleAccessError', () => {
    it('returns false for non-access errors', () => {
      const api = new ApiCallBaseFunctions();
      const result = api.handleAccessError(500, 'Server Error');
      expect(result).toBe(false);
    });

    it('handles 401 errors', () => {
      const api = new ApiCallBaseFunctions();
      const result = api.handleAccessError(401, 'Unauthorized');
      expect(result).toBe(true);
      expect(api._accessErrorHandled).toBe(true);
    });

    it('shows toast for 401 errors', () => {
      const api = new ApiCallBaseFunctions();
      api.handleAccessError(401, 'Unauthorized');

      expect(global.eXeLearning.app.toasts.default.createToast).toHaveBeenCalledWith({
        icon: 'error',
        title: 'Session Expired',
        body: 'Your session has expired. Please log in again.',
        error: true,
        remove: 5000,
      });
    });

    it('redirects to login after 401', () => {
      const api = new ApiCallBaseFunctions();
      const originalHref = window.location.href;

      api.handleAccessError(401, 'Unauthorized');
      vi.advanceTimersByTime(2000);

      expect(window.location.href).toBe('/web/exelearning/login');
      window.location.href = originalHref;
    });

    it('handles 403 errors', () => {
      const api = new ApiCallBaseFunctions();
      const result = api.handleAccessError(403, 'Forbidden');
      expect(result).toBe(true);
      expect(api._accessErrorHandled).toBe(true);
    });

    it('shows toast for 403 errors', () => {
      const api = new ApiCallBaseFunctions();
      api.handleAccessError(403, 'Forbidden');

      expect(global.eXeLearning.app.toasts.default.createToast).toHaveBeenCalledWith({
        icon: 'error',
        title: 'Access Denied',
        body: 'You no longer have access to this project.',
        error: true,
        remove: 5000,
      });
    });

    it('redirects to workarea after 403', () => {
      const api = new ApiCallBaseFunctions();
      const originalHref = window.location.href;

      api.handleAccessError(403, 'Forbidden');
      vi.advanceTimersByTime(2000);

      expect(window.location.href).toBe('/web/exelearning/workarea');
      window.location.href = originalHref;
    });

    it('prevents multiple redirects', () => {
      const api = new ApiCallBaseFunctions();
      api._accessErrorHandled = true;

      const result = api.handleAccessError(401, 'Unauthorized');

      expect(result).toBe(true);
      expect(global.eXeLearning.app.toasts.default.createToast).not.toHaveBeenCalled();
    });

    it('handles missing toast system', () => {
      delete global.eXeLearning.app.toasts;
      const api = new ApiCallBaseFunctions();

      expect(() => api.handleAccessError(401, 'Unauthorized')).not.toThrow();
    });
  });

  describe('get', () => {
    it('calls doAjax with GET method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({ data: 'test' });

      await api.get('/api/test', { id: 1 });

      expect(api.doAjax).toHaveBeenCalledWith('/api/test', 'GET', { id: 1 }, true);
    });

    it('returns error response on error with responseJSON', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Server error' },
      });

      const result = await api.get('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Server error' });
    });

    it('returns generic error when no responseJSON', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockRejectedValue({ statusText: 'Network error' });

      const result = await api.get('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Network error' });
    });

    it('passes waiting parameter', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({});

      await api.get('/api/test', {}, false);

      expect(api.doAjax).toHaveBeenCalledWith('/api/test', 'GET', {}, false);
    });
  });

  describe('post', () => {
    it('calls doAjax with POST method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({});

      await api.post('/api/test', { name: 'test' });

      expect(api.doAjax).toHaveBeenCalledWith('/api/test', 'POST', { name: 'test' }, true);
    });

    it('returns error response on error', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Bad request' },
      });

      const result = await api.post('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Bad request' });
    });
  });

  describe('postJson', () => {
    it('calls doJsonAjax with POST method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doJsonAjax').mockResolvedValue({});

      await api.postJson('/api/test', { complex: [1, 2, 3] });

      expect(api.doJsonAjax).toHaveBeenCalledWith('/api/test', 'POST', { complex: [1, 2, 3] }, true);
    });

    it('returns error response on error', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doJsonAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Validation error' },
      });

      const result = await api.postJson('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Validation error' });
    });
  });

  describe('put', () => {
    it('calls doAjax with PUT method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({});

      await api.put('/api/test/1', { name: 'updated' });

      expect(api.doAjax).toHaveBeenCalledWith('/api/test/1', 'PUT', { name: 'updated' }, true);
    });

    it('returns error response on error', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Update failed' },
      });

      const result = await api.put('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Update failed' });
    });
  });

  describe('delete', () => {
    it('calls doAjax with DELETE method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({});

      await api.delete('/api/test/1', {});

      expect(api.doAjax).toHaveBeenCalledWith('/api/test/1', 'DELETE', {}, true);
    });

    it('returns error response on error', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Delete failed' },
      });

      const result = await api.delete('/api/test', {});

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Delete failed' });
    });
  });

  describe('do', () => {
    it('calls doAjax with specified method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doAjax').mockResolvedValue({});

      await api.do('PATCH', '/api/test/1', { partial: true });

      expect(api.doAjax).toHaveBeenCalledWith('/api/test/1', 'PATCH', { partial: true }, true);
    });
  });

  describe('fileSendPost', () => {
    it('calls doFileSendAjax with POST method', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doFileSendAjax').mockResolvedValue({});
      const formData = new FormData();

      await api.fileSendPost('/api/upload', formData);

      expect(api.doFileSendAjax).toHaveBeenCalledWith('/api/upload', 'POST', formData, true);
    });

    it('returns error response on error', async () => {
      const api = new ApiCallBaseFunctions();
      vi.spyOn(api, 'doFileSendAjax').mockRejectedValue({
        responseJSON: { responseMessage: 'ERROR', error: 'Upload failed' },
      });

      const result = await api.fileSendPost('/api/upload', new FormData());

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Upload failed' });
    });
  });

  describe('doAjax', () => {
    it('calls $.ajax with correct parameters', async () => {
      const api = new ApiCallBaseFunctions();

      await api.doAjax('/api/test', 'GET', { id: 1 }, true);

      expect(mockAjax).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test',
          method: 'GET',
          data: { id: 1 },
          dataType: 'json',
          timeout: 30000,
        })
      );
    });

    it('adds waiting class when waiting is true', async () => {
      const api = new ApiCallBaseFunctions();

      await api.doAjax('/api/test', 'GET', {}, true);

      expect(mockBody.classList.add).toHaveBeenCalledWith('ajax-petition-on');
    });

    it('does not add waiting class when waiting is false', async () => {
      const api = new ApiCallBaseFunctions();

      await api.doAjax('/api/test', 'GET', {}, false);

      expect(mockBody.classList.add).not.toHaveBeenCalled();
    });

    it('removes waiting class after response', async () => {
      const api = new ApiCallBaseFunctions();

      await api.doAjax('/api/test', 'GET', {}, true);
      vi.advanceTimersByTime(100);

      expect(mockBody.classList.remove).toHaveBeenCalledWith('ajax-petition-on');
    });

    it('handles access errors on jQuery error', async () => {
      const api = new ApiCallBaseFunctions();
      mockAjax.mockRejectedValue({ status: 401, responseText: 'Unauthorized' });
      vi.spyOn(api, 'handleAccessError');

      await expect(api.doAjax('/api/test', 'GET', {}, true)).rejects.toEqual({
        status: 401,
        responseText: 'Unauthorized',
      });

      expect(api.handleAccessError).toHaveBeenCalledWith(401, 'Unauthorized');
    });

    it('returns response on success', async () => {
      const api = new ApiCallBaseFunctions();
      mockAjax.mockResolvedValue({ data: 'test response' });

      const result = await api.doAjax('/api/test', 'GET', {}, true);

      expect(result).toEqual({ data: 'test response' });
    });
  });

  describe('doJsonAjax', () => {
    it('calls $.ajax with JSON content type', async () => {
      const api = new ApiCallBaseFunctions();

      await api.doJsonAjax('/api/test', 'POST', { array: [1, 2] }, true);

      expect(mockAjax).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test',
          method: 'POST',
          data: JSON.stringify({ array: [1, 2] }),
          contentType: 'application/json',
          dataType: 'json',
        })
      );
    });

    it('stringifies data to JSON', async () => {
      const api = new ApiCallBaseFunctions();
      const complexData = { nested: { value: 123 } };

      await api.doJsonAjax('/api/test', 'POST', complexData, true);

      expect(mockAjax).toHaveBeenCalledWith(
        expect.objectContaining({
          data: '{"nested":{"value":123}}',
        })
      );
    });
  });

  describe('doFileSendAjax', () => {
    it('calls $.ajax with file upload options', async () => {
      const api = new ApiCallBaseFunctions();
      const formData = new FormData();

      await api.doFileSendAjax('/api/upload', 'POST', formData, true);

      expect(mockAjax).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/upload',
          method: 'POST',
          data: formData,
          cache: false,
          contentType: false,
          processData: false,
          type: 'POST',
        })
      );
    });
  });

  describe('getText', () => {
    it('calls $.ajax with text dataType', async () => {
      const api = new ApiCallBaseFunctions();
      mockAjax.mockResolvedValue('plain text response');

      await api.getText('/api/text', true);

      expect(mockAjax).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/text',
          dataType: 'text',
          mimeType: 'text/plain',
          async: false,
        })
      );
    });

    it('returns text response', async () => {
      const api = new ApiCallBaseFunctions();
      mockAjax.mockResolvedValue('Hello World');

      const result = await api.getText('/api/text', true);

      expect(result).toBe('Hello World');
    });
  });

  describe('addWaitingPetition', () => {
    it('increments nCurretPetitions', () => {
      const api = new ApiCallBaseFunctions();

      api.addWaitingPetition();

      expect(api.nCurretPetitions).toBe(1);
    });

    it('adds class to body', () => {
      const api = new ApiCallBaseFunctions();

      api.addWaitingPetition();

      expect(mockBody.classList.add).toHaveBeenCalledWith('ajax-petition-on');
    });

    it('handles multiple petitions', () => {
      const api = new ApiCallBaseFunctions();

      api.addWaitingPetition();
      api.addWaitingPetition();
      api.addWaitingPetition();

      expect(api.nCurretPetitions).toBe(3);
    });
  });

  describe('removeWaitingPetition', () => {
    it('decrements nCurretPetitions', () => {
      const api = new ApiCallBaseFunctions();
      api.nCurretPetitions = 3;

      api.removeWaitingPetition();

      expect(api.nCurretPetitions).toBe(2);
    });

    it('removes class when counter reaches zero', () => {
      const api = new ApiCallBaseFunctions();
      api.nCurretPetitions = 1;

      api.removeWaitingPetition();

      expect(mockBody.classList.remove).toHaveBeenCalledWith('ajax-petition-on');
    });

    it('does not remove class when counter is still positive', () => {
      const api = new ApiCallBaseFunctions();
      api.nCurretPetitions = 2;

      api.removeWaitingPetition();

      expect(mockBody.classList.remove).not.toHaveBeenCalled();
    });

    it('handles negative counters gracefully', () => {
      const api = new ApiCallBaseFunctions();
      api.nCurretPetitions = 0;

      api.removeWaitingPetition();

      expect(api.nCurretPetitions).toBe(-1);
      expect(mockBody.classList.remove).toHaveBeenCalled();
    });
  });
});
