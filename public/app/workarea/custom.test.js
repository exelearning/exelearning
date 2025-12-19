import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('custom.js', () => {
    beforeEach(async () => {
        vi.resetModules();
        global.jQuery = vi.fn((callback) => callback());
        delete global.$eXeLearningCustom;
        await import('./custom.js');
    });

    afterEach(() => {
        delete global.$eXeLearningCustom;
        delete global.jQuery;
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
        expect(global.jQuery).toHaveBeenCalledTimes(1);
        expect(global.jQuery.mock.calls[0][0]).toBeTypeOf('function');
    });
});
