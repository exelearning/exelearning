/**
 * SessionMonitor Tests
 *
 * Unit tests for SessionMonitor class that handles session validity checking
 * and automatic redirect to login when session expires.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import SessionMonitor from './sessionMonitor.js';

describe('SessionMonitor', () => {
  let monitor;
  let mockFetch;
  let mockSetInterval;
  let mockClearInterval;
  let intervalCallbacks;
  let intervalId;

  beforeEach(() => {
    // Track interval callbacks for manual triggering
    intervalCallbacks = [];
    intervalId = 1;

    // Mock setInterval
    mockSetInterval = vi.fn((callback, delay) => {
      intervalCallbacks.push({ callback, delay });
      return intervalId++;
    });

    // Mock clearInterval
    mockClearInterval = vi.fn();

    // Setup window mocks
    global.window = global.window || {};
    global.window.setInterval = mockSetInterval;
    global.window.clearInterval = mockClearInterval;
    global.window.location = {
      assign: vi.fn(),
      href: 'http://localhost:3000/workarea',
    };
    global.window.onbeforeunload = vi.fn();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock console.debug
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
      monitor = null;
    }
    vi.clearAllMocks();
    intervalCallbacks = [];
  });

  describe('constructor', () => {
    it('initializes with default values', () => {
      monitor = new SessionMonitor();

      expect(monitor.checkUrl).toBe('');
      expect(monitor.loginUrl).toBe('/login');
      expect(monitor.interval).toBe(60000);
      expect(monitor.timerId).toBeNull();
      expect(monitor.pendingCheck).toBe(false);
      expect(monitor.invalidated).toBe(false);
    });

    it('accepts custom options', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        loginUrl: '/auth/login',
        interval: 30000,
      });

      expect(monitor.checkUrl).toBe('/api/session/check');
      expect(monitor.loginUrl).toBe('/auth/login');
      expect(monitor.interval).toBe(30000);
    });

    it('enforces minimum interval of 10000ms', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        interval: 5000,
      });

      expect(monitor.interval).toBe(10000);
    });

    it('handles invalid interval gracefully', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        interval: 'invalid',
      });

      expect(monitor.interval).toBe(60000);
    });

    it('accepts callback functions', () => {
      const closeYjsConnections = vi.fn();
      const onSessionInvalid = vi.fn();
      const onNetworkError = vi.fn();
      const onRedirect = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        closeYjsConnections,
        onSessionInvalid,
        onNetworkError,
        onRedirect,
      });

      expect(monitor.closeYjsConnections).toBe(closeYjsConnections);
      expect(monitor.onSessionInvalid).toBe(onSessionInvalid);
      expect(monitor.onNetworkError).toBe(onNetworkError);
      expect(monitor.onRedirect).toBe(onRedirect);
    });

    it('accepts custom fetch options', () => {
      const fetchOptions = {
        headers: { 'X-Custom-Header': 'value' },
      };

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        fetchOptions,
      });

      expect(monitor.fetchOptions).toBe(fetchOptions);
    });

    it('provides default onRedirect that uses window.location.assign', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.onRedirect('/login');

      expect(window.location.assign).toHaveBeenCalledWith('/login');
    });
  });

  describe('start', () => {
    it('starts interval when checkUrl is provided', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        interval: 30000,
      });

      // Mock checkSession to prevent actual fetch
      monitor.checkSession = vi.fn();

      monitor.start();

      expect(mockSetInterval).toHaveBeenCalledTimes(1);
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(monitor.timerId).not.toBeNull();
    });

    it('performs initial check immediately', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const checkSessionSpy = vi.spyOn(monitor, 'checkSession');

      monitor.start();

      expect(checkSessionSpy).toHaveBeenCalledWith('initial');
    });

    it('does not start if already running', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.checkSession = vi.fn();

      monitor.start();
      monitor.start();

      expect(mockSetInterval).toHaveBeenCalledTimes(1);
    });

    it('does not start if checkUrl is empty', () => {
      monitor = new SessionMonitor({
        checkUrl: '',
      });

      monitor.start();

      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(monitor.timerId).toBeNull();
    });
  });

  describe('stop', () => {
    it('clears interval when running', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.checkSession = vi.fn();
      monitor.start();

      const timerId = monitor.timerId;
      monitor.stop();

      expect(mockClearInterval).toHaveBeenCalledWith(timerId);
      expect(monitor.timerId).toBeNull();
    });

    it('does nothing if not running', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.stop();

      expect(mockClearInterval).not.toHaveBeenCalled();
    });
  });

  describe('triggerImmediateCheck', () => {
    it('calls checkSession with provided reason', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const checkSessionSpy = vi.spyOn(monitor, 'checkSession');

      monitor.triggerImmediateCheck('user-action');

      expect(checkSessionSpy).toHaveBeenCalledWith('user-action');
    });

    it('uses default reason "manual"', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const checkSessionSpy = vi.spyOn(monitor, 'checkSession');

      monitor.triggerImmediateCheck();

      expect(checkSessionSpy).toHaveBeenCalledWith('manual');
    });
  });

  describe('handleYjsConnectionError', () => {
    it('triggers immediate check with yjs-connection-error reason', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const checkSessionSpy = vi.spyOn(monitor, 'checkSession').mockImplementation(() => {});

      monitor.handleYjsConnectionError(new Error('WebSocket closed'));

      expect(checkSessionSpy).toHaveBeenCalledWith('yjs-connection-error');
    });

    it('does nothing if already invalidated', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.invalidated = true;

      const checkSessionSpy = vi.spyOn(monitor, 'checkSession');

      monitor.handleYjsConnectionError(new Error('WebSocket closed'));

      expect(checkSessionSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkSession', () => {
    it('makes fetch request with correct options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ authenticated: true }),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      await monitor.checkSession('test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session/check',
        expect.objectContaining({
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('merges custom headers from fetchOptions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ authenticated: true }),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        fetchOptions: {
          headers: { 'X-Custom': 'value' },
        },
      });

      await monitor.checkSession('test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session/check',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('does nothing if checkUrl is empty', async () => {
      monitor = new SessionMonitor({
        checkUrl: '',
      });

      await monitor.checkSession('test');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does nothing if already invalidated', async () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.invalidated = true;

      await monitor.checkSession('test');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does nothing if check is already pending', async () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.pendingCheck = true;

      await monitor.checkSession('test');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sets pendingCheck to true during check', async () => {
      let pendingDuringFetch = false;

      mockFetch.mockImplementation(async () => {
        pendingDuringFetch = monitor.pendingCheck;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ authenticated: true }),
        };
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      await monitor.checkSession('test');

      expect(pendingDuringFetch).toBe(true);
      expect(monitor.pendingCheck).toBe(false);
    });

    it('handles 401 response by calling handleInvalidSession', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).toHaveBeenCalledWith('unauthorized');
    });

    it('handles 403 response by calling handleInvalidSession', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => 'application/json' },
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).toHaveBeenCalledWith('unauthorized');
    });

    it('handles authenticated: false in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ authenticated: false }),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).toHaveBeenCalledWith('session-check');
    });

    it('handles missing authenticated field in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).toHaveBeenCalledWith('session-check');
    });

    it('handles null payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: () => Promise.reject(new Error('Not JSON')),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).toHaveBeenCalledWith('session-check');
    });

    it('does not call handleInvalidSession for other HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      expect(handleInvalidSpy).not.toHaveBeenCalled();
    });

    it('calls onNetworkError callback on fetch failure', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      const onNetworkError = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onNetworkError,
      });

      await monitor.checkSession('test-reason');

      expect(onNetworkError).toHaveBeenCalledWith(networkError, 'test-reason');
    });

    it('handles onNetworkError callback throwing error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const onNetworkError = vi.fn(() => {
        throw new Error('Callback error');
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onNetworkError,
      });

      // Should not throw
      await expect(monitor.checkSession('test')).resolves.not.toThrow();
      expect(console.debug).toHaveBeenCalled();
    });

    it('logs network error when no callback provided', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      await monitor.checkSession('test');

      expect(console.debug).toHaveBeenCalledWith(
        'SessionMonitor: network error',
        expect.any(Error)
      );
    });

    it('resets pendingCheck after error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      await monitor.checkSession('test');

      expect(monitor.pendingCheck).toBe(false);
    });

    it('tries to parse JSON even for non-JSON content type', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        json: () => Promise.resolve({ authenticated: true }),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      const handleInvalidSpy = vi.spyOn(monitor, 'handleInvalidSession');

      await monitor.checkSession('test');

      // Should not call handleInvalidSession since authenticated is true
      expect(handleInvalidSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleInvalidSession', () => {
    it('sets invalidated to true', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.handleInvalidSession('test');

      expect(monitor.invalidated).toBe(true);
    });

    it('stops the monitor', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.checkSession = vi.fn();
      monitor.start();

      monitor.handleInvalidSession('test');

      expect(monitor.timerId).toBeNull();
    });

    it('calls closeYjsConnections callback', () => {
      const closeYjsConnections = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        closeYjsConnections,
      });

      monitor.handleInvalidSession('test-reason');

      expect(closeYjsConnections).toHaveBeenCalledWith('test-reason');
    });

    it('calls onSessionInvalid callback', () => {
      const onSessionInvalid = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onSessionInvalid,
      });

      monitor.handleInvalidSession('test-reason');

      expect(onSessionInvalid).toHaveBeenCalledWith('test-reason');
    });

    it('clears window.onbeforeunload', () => {
      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      window.onbeforeunload = vi.fn();

      monitor.handleInvalidSession('test');

      expect(window.onbeforeunload).toBeNull();
    });

    it('calls onRedirect with loginUrl and reason', () => {
      const onRedirect = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        loginUrl: '/auth/login',
        onRedirect,
      });

      monitor.handleInvalidSession('test-reason');

      expect(onRedirect).toHaveBeenCalledWith('/auth/login', 'test-reason');
    });

    it('does nothing if already invalidated', () => {
      const closeYjsConnections = vi.fn();
      const onSessionInvalid = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        closeYjsConnections,
        onSessionInvalid,
      });

      monitor.invalidated = true;

      monitor.handleInvalidSession('test');

      expect(closeYjsConnections).not.toHaveBeenCalled();
      expect(onSessionInvalid).not.toHaveBeenCalled();
    });

    it('handles closeYjsConnections throwing error', () => {
      const closeYjsConnections = vi.fn(() => {
        throw new Error('Close error');
      });
      const onSessionInvalid = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        closeYjsConnections,
        onSessionInvalid,
      });

      // Should not throw and should continue to onSessionInvalid
      expect(() => monitor.handleInvalidSession('test')).not.toThrow();
      expect(onSessionInvalid).toHaveBeenCalled();
    });

    it('handles onSessionInvalid throwing error', () => {
      const onSessionInvalid = vi.fn(() => {
        throw new Error('Callback error');
      });
      const onRedirect = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onSessionInvalid,
        onRedirect,
      });

      // Should not throw and should continue to redirect
      expect(() => monitor.handleInvalidSession('test')).not.toThrow();
      expect(onRedirect).toHaveBeenCalled();
    });

    it('handles onRedirect throwing error', () => {
      const onRedirect = vi.fn(() => {
        throw new Error('Redirect error');
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onRedirect,
      });

      // Should not throw but should log error
      expect(() => monitor.handleInvalidSession('test')).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'SessionMonitor: redirect handler failed',
        expect.any(Error)
      );
    });
  });

  describe('integration scenarios', () => {
    it('full flow: start -> check -> invalid -> redirect', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ authenticated: false }),
      });

      const closeYjsConnections = vi.fn();
      const onSessionInvalid = vi.fn();
      const onRedirect = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        loginUrl: '/login',
        closeYjsConnections,
        onSessionInvalid,
        onRedirect,
      });

      // Start will trigger initial check
      monitor.start();

      // Wait for async check to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(closeYjsConnections).toHaveBeenCalledWith('session-check');
      expect(onSessionInvalid).toHaveBeenCalledWith('session-check');
      expect(onRedirect).toHaveBeenCalledWith('/login', 'session-check');
      expect(monitor.invalidated).toBe(true);
      expect(monitor.timerId).toBeNull();
    });

    it('handles rapid successive checks gracefully', async () => {
      let resolvePromise;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValue(fetchPromise);

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      // Trigger multiple checks
      monitor.checkSession('first');
      monitor.checkSession('second');
      monitor.checkSession('third');

      // Only one fetch should be made
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Resolve the fetch
      resolvePromise({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ authenticated: true }),
      });

      await fetchPromise;
    });

    it('Yjs connection error triggers session check', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ authenticated: true }),
      });

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
      });

      monitor.handleYjsConnectionError(new Error('WebSocket disconnected'));

      // Wait for async check
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalled();
    });

    it('prevents duplicate invalidation on concurrent failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
      });

      const onRedirect = vi.fn();

      monitor = new SessionMonitor({
        checkUrl: '/api/session/check',
        onRedirect,
      });

      // Simulate concurrent invalid session handling
      await Promise.all([
        monitor.checkSession('first'),
        monitor.handleInvalidSession('second'),
      ]);

      // onRedirect should only be called once
      expect(onRedirect).toHaveBeenCalledTimes(1);
    });
  });
});
