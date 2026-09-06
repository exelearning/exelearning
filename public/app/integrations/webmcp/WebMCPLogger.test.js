import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPLogger from './WebMCPLogger.js';

describe('WebMCPLogger', () => {
    beforeEach(() => {
        window.eXeLearning = { config: {} };
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.eXeLearning;
    });

    describe('prefix', () => {
        it('includes [WebMCP] prefix in info messages by default', () => {
            const logger = new WebMCPLogger();
            logger.info('hello');
            expect(console.info).toHaveBeenCalledWith('[WebMCP] hello');
        });

        it('uses custom prefix when provided via options', () => {
            const logger = new WebMCPLogger({ prefix: '[Custom]' });
            logger.info('test');
            expect(console.info).toHaveBeenCalledWith('[Custom] test');
        });

        it('includes prefix in warn messages', () => {
            const logger = new WebMCPLogger();
            logger.warn('something wrong');
            expect(console.warn).toHaveBeenCalledWith('[WebMCP] something wrong');
        });

        it('includes prefix in error messages', () => {
            const logger = new WebMCPLogger();
            logger.error('boom');
            expect(console.error).toHaveBeenCalledWith('[WebMCP] boom');
        });
    });

    describe('always-visible log levels', () => {
        it('logs info regardless of debug flag', () => {
            const logger = new WebMCPLogger({ debug: false });
            logger.info('always');
            expect(console.info).toHaveBeenCalledTimes(1);
        });

        it('logs warn regardless of debug flag', () => {
            const logger = new WebMCPLogger({ debug: false });
            logger.warn('always');
            expect(console.warn).toHaveBeenCalledTimes(1);
        });

        it('logs error regardless of debug flag', () => {
            const logger = new WebMCPLogger({ debug: false });
            logger.error('always');
            expect(console.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('debug level gating', () => {
        it('suppresses debug messages when debug flag is false', () => {
            const logger = new WebMCPLogger({ debug: false });
            logger.debug('hidden');
            expect(console.debug).not.toHaveBeenCalled();
        });

        it('emits debug messages when debug option is true', () => {
            const logger = new WebMCPLogger({ debug: true });
            logger.debug('visible');
            expect(console.debug).toHaveBeenCalledWith('[WebMCP] visible');
        });

        it('reads debug flag from window.eXeLearning.config.webmcpDebug', () => {
            window.eXeLearning.config.webmcpDebug = true;
            const logger = new WebMCPLogger();
            logger.debug('from config');
            expect(console.debug).toHaveBeenCalledTimes(1);
        });

        it('suppresses debug when window.eXeLearning.config.webmcpDebug is false', () => {
            window.eXeLearning.config.webmcpDebug = false;
            const logger = new WebMCPLogger();
            logger.debug('suppressed');
            expect(console.debug).not.toHaveBeenCalled();
        });

        it('options.debug overrides window config', () => {
            window.eXeLearning.config.webmcpDebug = true;
            const logger = new WebMCPLogger({ debug: false });
            logger.debug('override');
            expect(console.debug).not.toHaveBeenCalled();
        });

        it('isDebugEnabled returns false by default', () => {
            const logger = new WebMCPLogger();
            expect(logger.isDebugEnabled()).toBe(false);
        });

        it('isDebugEnabled returns true when options.debug is true', () => {
            const logger = new WebMCPLogger({ debug: true });
            expect(logger.isDebugEnabled()).toBe(true);
        });
    });

    describe('extra arguments', () => {
        it('forwards additional arguments to console methods', () => {
            const logger = new WebMCPLogger();
            const obj = { key: 'value' };
            logger.info('msg', obj, 42);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] msg', obj, 42);
        });
    });

    describe('structured lifecycle logging', () => {
        it('logDetection logs at info level with result data', () => {
            const logger = new WebMCPLogger();
            const result = { native: true, fallback: false, mode: 'native' };
            logger.logDetection(result);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Detection complete', result);
        });

        it('logFallbackLoad logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { status: 'started', url: 'https://example.com/webmcp.js' };
            logger.logFallbackLoad(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Fallback load', event);
        });

        it('logRegistration logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { status: 'completed', toolCount: 5 };
            logger.logRegistration(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Registration', event);
        });

        it('logToolInvocation logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { tool: 'exe.pages.create', writes: true, duration: 120 };
            logger.logToolInvocation(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Tool invocation', event);
        });

        it('logPermission logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { tool: 'exe.project.save', action: 'granted', policy: 'session' };
            logger.logPermission(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Permission', event);
        });

        it('logValidation logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { tool: 'exe.pages.create', field: 'name', error: 'required' };
            logger.logValidation(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Validation', event);
        });

        it('logDisposal logs at info level with event data', () => {
            const logger = new WebMCPLogger();
            const event = { toolsRemoved: 8, reason: 'shutdown' };
            logger.logDisposal(event);
            expect(console.info).toHaveBeenCalledWith('[WebMCP] Disposal', event);
        });
    });
});
