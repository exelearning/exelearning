import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('custom.js', () => {
    let originalJQuery;
    let jquerySpy;

    beforeEach(async () => {
        vi.resetModules();
        if (!global.jQuery) {
            throw new Error('jQuery is not available in the test environment');
        }
        originalJQuery = global.jQuery;
        jquerySpy = vi.fn((...args) => originalJQuery(...args));
        global.jQuery = jquerySpy;
        global.$ = originalJQuery;
        delete global.$eXeLearningCustom;
        await import('./custom.js');
    });

    afterEach(() => {
        delete global.$eXeLearningCustom;
        global.jQuery = originalJQuery;
    });

    it('should have $eXeLearningCustom object defined', () => {
        expect(global.$eXeLearningCustom).toBeDefined();
        expect(global.$eXeLearningCustom).toBeTypeOf('object');
    });

    it('should have init function defined', () => {
        expect(global.$eXeLearningCustom.init).toBeDefined();
    });

    it('should have init function as a function type', () => {
        expect(global.$eXeLearningCustom.init).toBeTypeOf('function');
    });

    it('should be able to call init function without errors', () => {
        expect(() => {
            global.$eXeLearningCustom.init();
        }).not.toThrow();
    });

    it('should execute the jQuery ready handler', () => {
        expect(jquerySpy).toHaveBeenCalled();
        expect(jquerySpy.mock.calls[0][0]).toBeTypeOf('function');
    });
});
