import AppLogger from './logger.js';

describe('AppLogger', () => {
  let consoleLogSpy;
  let consoleDebugSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleGroupSpy;
  let consoleGroupEndSpy;
  let consoleTableSpy;
  let consoleTimeSpy;
  let consoleTimeEndSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    consoleTimeSpy = vi.spyOn(console, 'time').mockImplementation(() => {});
    consoleTimeEndSpy = vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__APP_DEBUG__;
  });

  describe('isDebug getter', () => {
    it('should return true when window.__APP_DEBUG__ is "1"', () => {
      window.__APP_DEBUG__ = '1';
      expect(AppLogger.isDebug).toBe(true);
    });

    it('should return true when window.__APP_DEBUG__ is boolean true', () => {
      window.__APP_DEBUG__ = true;
      expect(AppLogger.isDebug).toBe(true);
    });

    it('should return false when window.__APP_DEBUG__ is "0"', () => {
      window.__APP_DEBUG__ = '0';
      expect(AppLogger.isDebug).toBe(false);
    });

    it('should return false when window.__APP_DEBUG__ is false', () => {
      window.__APP_DEBUG__ = false;
      expect(AppLogger.isDebug).toBe(false);
    });

    it('should return false when window.__APP_DEBUG__ is undefined', () => {
      delete window.__APP_DEBUG__;
      expect(AppLogger.isDebug).toBe(false);
    });
  });

  describe('when APP_DEBUG is enabled', () => {
    beforeEach(() => {
      window.__APP_DEBUG__ = '1';
    });

    describe('log', () => {
      it('should call console.log with [App] prefix', () => {
        AppLogger.log('test message');
        expect(consoleLogSpy).toHaveBeenCalledWith('[App]', 'test message');
      });

      it('should handle multiple arguments', () => {
        AppLogger.log('message', 'arg2', 'arg3');
        expect(consoleLogSpy).toHaveBeenCalledWith('[App]', 'message', 'arg2', 'arg3');
      });

      it('should handle objects', () => {
        const obj = { key: 'value' };
        AppLogger.log('object:', obj);
        expect(consoleLogSpy).toHaveBeenCalledWith('[App]', 'object:', obj);
      });
    });

    describe('debug', () => {
      it('should call console.debug with [App] prefix', () => {
        AppLogger.debug('debug message');
        expect(consoleDebugSpy).toHaveBeenCalledWith('[App]', 'debug message');
      });

      it('should handle multiple arguments', () => {
        AppLogger.debug('debug', 1, 2, 3);
        expect(consoleDebugSpy).toHaveBeenCalledWith('[App]', 'debug', 1, 2, 3);
      });
    });

    describe('info', () => {
      it('should call console.info with [App] prefix', () => {
        AppLogger.info('info message');
        expect(consoleInfoSpy).toHaveBeenCalledWith('[App]', 'info message');
      });

      it('should handle multiple arguments', () => {
        AppLogger.info('info', { data: 'value' });
        expect(consoleInfoSpy).toHaveBeenCalledWith('[App]', 'info', { data: 'value' });
      });
    });

    describe('group', () => {
      it('should call console.group with label', () => {
        AppLogger.group('Test Group');
        expect(consoleGroupSpy).toHaveBeenCalledWith('Test Group');
      });
    });

    describe('groupEnd', () => {
      it('should call console.groupEnd', () => {
        AppLogger.groupEnd();
        expect(consoleGroupEndSpy).toHaveBeenCalled();
      });
    });

    describe('table', () => {
      it('should call console.table with data', () => {
        const data = [{ name: 'John', age: 30 }];
        AppLogger.table(data);
        expect(consoleTableSpy).toHaveBeenCalledWith(data);
      });
    });

    describe('time', () => {
      it('should call console.time with label', () => {
        AppLogger.time('timer1');
        expect(consoleTimeSpy).toHaveBeenCalledWith('timer1');
      });
    });

    describe('timeEnd', () => {
      it('should call console.timeEnd with label', () => {
        AppLogger.timeEnd('timer1');
        expect(consoleTimeEndSpy).toHaveBeenCalledWith('timer1');
      });
    });
  });

  describe('when APP_DEBUG is disabled', () => {
    beforeEach(() => {
      window.__APP_DEBUG__ = '0';
    });

    describe('log', () => {
      it('should NOT call console.log', () => {
        AppLogger.log('test message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('debug', () => {
      it('should NOT call console.debug', () => {
        AppLogger.debug('debug message');
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      });
    });

    describe('info', () => {
      it('should NOT call console.info', () => {
        AppLogger.info('info message');
        expect(consoleInfoSpy).not.toHaveBeenCalled();
      });
    });

    describe('group', () => {
      it('should NOT call console.group', () => {
        AppLogger.group('Test Group');
        expect(consoleGroupSpy).not.toHaveBeenCalled();
      });
    });

    describe('groupEnd', () => {
      it('should NOT call console.groupEnd', () => {
        AppLogger.groupEnd();
        expect(consoleGroupEndSpy).not.toHaveBeenCalled();
      });
    });

    describe('table', () => {
      it('should NOT call console.table', () => {
        const data = [{ name: 'John', age: 30 }];
        AppLogger.table(data);
        expect(consoleTableSpy).not.toHaveBeenCalled();
      });
    });

    describe('time', () => {
      it('should NOT call console.time', () => {
        AppLogger.time('timer1');
        expect(consoleTimeSpy).not.toHaveBeenCalled();
      });
    });

    describe('timeEnd', () => {
      it('should NOT call console.timeEnd', () => {
        AppLogger.timeEnd('timer1');
        expect(consoleTimeEndSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('methods that always execute', () => {
    beforeEach(() => {
      window.__APP_DEBUG__ = '0';
    });

    describe('warn', () => {
      it('should always call console.warn even when debug is off', () => {
        AppLogger.warn('warning message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[App]', 'warning message');
      });

      it('should handle multiple arguments', () => {
        AppLogger.warn('warning', { error: 'details' });
        expect(consoleWarnSpy).toHaveBeenCalledWith('[App]', 'warning', { error: 'details' });
      });

      it('should work when debug is enabled', () => {
        window.__APP_DEBUG__ = '1';
        AppLogger.warn('warning');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[App]', 'warning');
      });
    });

    describe('error', () => {
      it('should always call console.error even when debug is off', () => {
        AppLogger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[App]', 'error message');
      });

      it('should handle multiple arguments', () => {
        const error = new Error('test error');
        AppLogger.error('Error occurred:', error);
        expect(consoleErrorSpy).toHaveBeenCalledWith('[App]', 'Error occurred:', error);
      });

      it('should work when debug is enabled', () => {
        window.__APP_DEBUG__ = '1';
        AppLogger.error('error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[App]', 'error');
      });
    });
  });

  describe('global availability', () => {
    it('should be available as window.AppLogger', () => {
      expect(window.AppLogger).toBe(AppLogger);
    });
  });
});
