/**
 * LoggerContext Tests
 */
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
    createLoggerContext,
    getLogger,
    resetLoggerContext,
    setLoggerContext,
    silentLogger,
    CapturingLogger,
} from './logger.context';
import { createConfigContext, resetConfigContext } from './config.context';

describe('LoggerContext', () => {
    beforeEach(() => {
        resetLoggerContext();
        resetConfigContext();
    });

    afterEach(() => {
        resetLoggerContext();
        resetConfigContext();
    });

    describe('silentLogger', () => {
        it('should have all logger methods', () => {
            expect(typeof silentLogger.debug).toBe('function');
            expect(typeof silentLogger.info).toBe('function');
            expect(typeof silentLogger.warn).toBe('function');
            expect(typeof silentLogger.error).toBe('function');
            expect(typeof silentLogger.child).toBe('function');
        });

        it('should not throw when logging', () => {
            expect(() => silentLogger.debug('test')).not.toThrow();
            expect(() => silentLogger.info('test')).not.toThrow();
            expect(() => silentLogger.warn('test')).not.toThrow();
            expect(() => silentLogger.error('test')).not.toThrow();
            expect(() => silentLogger.error('test', new Error('err'))).not.toThrow();
        });

        it('should return silentLogger from child()', () => {
            const child = silentLogger.child({ component: 'test' });
            expect(child).toBe(silentLogger);
        });

        it('should have error level', () => {
            expect(silentLogger.level).toBe('error');
        });
    });

    describe('CapturingLogger', () => {
        let logger: CapturingLogger;

        beforeEach(() => {
            logger = new CapturingLogger();
        });

        it('should capture debug messages', () => {
            logger.debug('debug message', { key: 'value' });
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].level).toBe('debug');
            expect(logger.logs[0].message).toBe('debug message');
            expect(logger.logs[0].context).toEqual({ key: 'value' });
        });

        it('should capture info messages', () => {
            logger.info('info message');
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].level).toBe('info');
            expect(logger.logs[0].message).toBe('info message');
        });

        it('should capture warn messages', () => {
            logger.warn('warn message');
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].level).toBe('warn');
        });

        it('should capture error messages with error object', () => {
            const error = new Error('test error');
            logger.error('error message', error, { extra: 'data' });
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].level).toBe('error');
            expect(logger.logs[0].error).toBe(error);
            expect(logger.logs[0].context).toEqual({ extra: 'data' });
        });

        it('should capture error messages without error object', () => {
            logger.error('error message');
            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].error).toBeUndefined();
        });

        it('should include timestamp in captured logs', () => {
            const before = new Date();
            logger.info('test');
            const after = new Date();

            expect(logger.logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(logger.logs[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should clear logs', () => {
            logger.info('test1');
            logger.info('test2');
            expect(logger.logs).toHaveLength(2);

            logger.clear();
            expect(logger.logs).toHaveLength(0);
        });

        it('should find logs by predicate', () => {
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');

            const warnings = logger.findLogs(log => log.level === 'warn');
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toBe('warn message');
        });

        it('should check for log existence with hasLog', () => {
            logger.info('user logged in');
            logger.error('failed to connect');

            expect(logger.hasLog('info', 'logged in')).toBe(true);
            expect(logger.hasLog('error', 'connect')).toBe(true);
            expect(logger.hasLog('warn', 'anything')).toBe(false);
        });

        it('should support regex in hasLog', () => {
            logger.info('User 123 logged in');

            expect(logger.hasLog('info', /User \d+ logged/)).toBe(true);
            expect(logger.hasLog('info', /Admin \d+/)).toBe(false);
        });

        it('should respect log level', () => {
            const warnLogger = new CapturingLogger('warn');
            warnLogger.debug('debug');
            warnLogger.info('info');
            warnLogger.warn('warn');
            warnLogger.error('error');

            expect(warnLogger.logs).toHaveLength(2);
            expect(warnLogger.hasLog('warn', 'warn')).toBe(true);
            expect(warnLogger.hasLog('error', 'error')).toBe(true);
        });

        it('should create child logger with merged context', () => {
            const parent = new CapturingLogger('debug', { requestId: 'abc' });
            const child = parent.child({ userId: 123 }) as CapturingLogger;

            child.info('test');
            expect(child.logs[0].context).toEqual({ requestId: 'abc', userId: 123 });
        });
    });

    describe('createLoggerContext', () => {
        it('should create legacy logger by default in non-prod', () => {
            const config = createConfigContext({ APP_ENV: 'dev' });
            const logger = createLoggerContext({}, config);
            expect(logger.level).toBe('info');
        });

        it('should create structured logger in prod', () => {
            const config = createConfigContext({ APP_ENV: 'prod' });
            const logger = createLoggerContext({}, config);
            expect(logger.level).toBe('info');
        });

        it('should use log level from config', () => {
            const config = createConfigContext({ LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({}, config);
            expect(logger.level).toBe('debug');
        });

        it('should allow overriding log level', () => {
            const config = createConfigContext({ LOG_LEVEL: 'info' });
            const logger = createLoggerContext({ level: 'warn' }, config);
            expect(logger.level).toBe('warn');
        });

        it('should allow forcing structured mode', () => {
            const config = createConfigContext({ APP_ENV: 'dev' });
            const logger = createLoggerContext({ structured: true }, config);
            expect(logger.level).toBe('info');
        });

        it('should support prefix option for legacy logger', () => {
            const config = createConfigContext({ APP_ENV: 'dev' });
            const logger = createLoggerContext({ prefix: 'MyComponent' }, config);
            expect(logger.level).toBe('info');
        });
    });

    describe('log level filtering', () => {
        it('should filter debug when level is info', () => {
            const logger = new CapturingLogger('info');
            logger.debug('should not appear');
            logger.info('should appear');

            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].message).toBe('should appear');
        });

        it('should filter debug and info when level is warn', () => {
            const logger = new CapturingLogger('warn');
            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(logger.logs).toHaveLength(2);
            expect(logger.logs[0].message).toBe('warn');
            expect(logger.logs[1].message).toBe('error');
        });

        it('should only show errors when level is error', () => {
            const logger = new CapturingLogger('error');
            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(logger.logs).toHaveLength(1);
            expect(logger.logs[0].message).toBe('error');
        });

        it('should show all when level is debug', () => {
            const logger = new CapturingLogger('debug');
            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(logger.logs).toHaveLength(4);
        });
    });

    describe('getLogger singleton', () => {
        it('should return the same instance on multiple calls', () => {
            const logger1 = getLogger();
            const logger2 = getLogger();
            expect(logger1).toBe(logger2);
        });

        it('should reset with resetLoggerContext', () => {
            const logger1 = getLogger();
            resetLoggerContext();
            const logger2 = getLogger();
            expect(logger1).not.toBe(logger2);
        });

        it('should use custom logger with setLoggerContext', () => {
            const customLogger = new CapturingLogger();
            setLoggerContext(customLogger);

            const logger = getLogger();
            expect(logger).toBe(customLogger);
        });
    });

    describe('child loggers', () => {
        it('should inherit parent log level', () => {
            const parent = new CapturingLogger('warn');
            const child = parent.child({ component: 'test' }) as CapturingLogger;

            expect(child.level).toBe('warn');
        });

        it('should merge context from multiple levels', () => {
            const root = new CapturingLogger('debug', { app: 'test' });
            const request = root.child({ requestId: '123' }) as CapturingLogger;
            const user = request.child({ userId: 456 }) as CapturingLogger;

            user.info('action');

            expect(user.logs[0].context).toEqual({
                app: 'test',
                requestId: '123',
                userId: 456,
            });
        });
    });

    describe('StructuredLogger', () => {
        let debugSpy: ReturnType<typeof spyOn>;
        let infoSpy: ReturnType<typeof spyOn>;
        let warnSpy: ReturnType<typeof spyOn>;
        let errorSpy: ReturnType<typeof spyOn>;

        beforeEach(() => {
            debugSpy = spyOn(console, 'debug').mockImplementation(() => {});
            infoSpy = spyOn(console, 'info').mockImplementation(() => {});
            warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
            errorSpy = spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            debugSpy.mockRestore();
            infoSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should output JSON for debug messages', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);

            logger.debug('debug message', { key: 'value' });

            expect(debugSpy).toHaveBeenCalledTimes(1);
            const output = debugSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.level).toBe('debug');
            expect(parsed.message).toBe('debug message');
            expect(parsed.key).toBe('value');
            expect(parsed.timestamp).toBeDefined();
        });

        it('should output JSON for info messages', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);

            logger.info('info message');

            expect(infoSpy).toHaveBeenCalledTimes(1);
            const output = infoSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.level).toBe('info');
            expect(parsed.message).toBe('info message');
        });

        it('should output JSON for warn messages', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);

            logger.warn('warn message', { warning: true });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            const output = warnSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.level).toBe('warn');
            expect(parsed.message).toBe('warn message');
            expect(parsed.warning).toBe(true);
        });

        it('should output JSON for error messages with error object', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);
            const error = new Error('test error');

            logger.error('error message', error, { extra: 'data' });

            expect(errorSpy).toHaveBeenCalledTimes(1);
            const output = errorSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.level).toBe('error');
            expect(parsed.message).toBe('error message');
            expect(parsed.error.name).toBe('Error');
            expect(parsed.error.message).toBe('test error');
            expect(parsed.extra).toBe('data');
        });

        it('should output JSON for error messages without error object', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);

            logger.error('error message', null, { extra: 'data' });

            expect(errorSpy).toHaveBeenCalledTimes(1);
            const output = errorSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.level).toBe('error');
            expect(parsed.error).toBeUndefined();
        });

        it('should include base context in child logger output', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: true }, config);
            const child = logger.child({ component: 'test-component' });

            child.info('child message');

            expect(infoSpy).toHaveBeenCalledTimes(1);
            const output = infoSpy.mock.calls[0][0];
            const parsed = JSON.parse(output);
            expect(parsed.component).toBe('test-component');
        });

        it('should respect log level filtering', () => {
            const config = createConfigContext({ APP_ENV: 'prod', LOG_LEVEL: 'warn' });
            const logger = createLoggerContext({ structured: true }, config);

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(debugSpy).not.toHaveBeenCalled();
            expect(infoSpy).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('LegacyLogger', () => {
        let debugSpy: ReturnType<typeof spyOn>;
        let logSpy: ReturnType<typeof spyOn>;
        let warnSpy: ReturnType<typeof spyOn>;
        let errorSpy: ReturnType<typeof spyOn>;

        beforeEach(() => {
            debugSpy = spyOn(console, 'debug').mockImplementation(() => {});
            logSpy = spyOn(console, 'log').mockImplementation(() => {});
            warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
            errorSpy = spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            debugSpy.mockRestore();
            logSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should output legacy format for debug messages', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false, prefix: 'TestComponent' }, config);

            logger.debug('debug message', { key: 'value' });

            expect(debugSpy).toHaveBeenCalledTimes(1);
            const output = debugSpy.mock.calls[0][0];
            expect(output).toContain('[TestComponent]');
            expect(output).toContain('debug message');
            expect(output).toContain('"key":"value"');
        });

        it('should output legacy format for info messages', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false, prefix: 'TestComponent' }, config);

            logger.info('info message');

            expect(logSpy).toHaveBeenCalledTimes(1);
            const output = logSpy.mock.calls[0][0];
            expect(output).toContain('[TestComponent]');
            expect(output).toContain('info message');
        });

        it('should output legacy format for warn messages', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false, prefix: 'TestComponent' }, config);

            logger.warn('warn message');

            expect(warnSpy).toHaveBeenCalledTimes(1);
            const output = warnSpy.mock.calls[0][0];
            expect(output).toContain('[TestComponent]');
            expect(output).toContain('warn message');
        });

        it('should output legacy format for error messages with error object', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false, prefix: 'TestComponent' }, config);
            const error = new Error('test error');

            logger.error('error message', error, { extra: 'data' });

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('[TestComponent]');
            expect(errorSpy.mock.calls[0][0]).toContain('error message');
            expect(errorSpy.mock.calls[0][1]).toBe('test error');
        });

        it('should output legacy format for error messages without error object', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false, prefix: 'TestComponent' }, config);

            logger.error('error message', null, { extra: 'data' });

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('error message');
        });

        it('should create child logger with component prefix', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false }, config);
            const child = logger.child({ component: 'ChildComponent' });

            child.info('child message');

            expect(logSpy).toHaveBeenCalledTimes(1);
            const output = logSpy.mock.calls[0][0];
            expect(output).toContain('[ChildComponent]');
        });

        it('should output without prefix when none specified', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'debug' });
            const logger = createLoggerContext({ structured: false }, config);

            logger.info('message without prefix');

            expect(logSpy).toHaveBeenCalledTimes(1);
            const output = logSpy.mock.calls[0][0];
            expect(output).toBe('message without prefix');
        });

        it('should respect log level filtering', () => {
            const config = createConfigContext({ APP_ENV: 'dev', LOG_LEVEL: 'error' });
            const logger = createLoggerContext({ structured: false }, config);

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(debugSpy).not.toHaveBeenCalled();
            expect(logSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });
    });
});
