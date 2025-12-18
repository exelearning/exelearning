import { describe, it, expect, beforeEach } from 'vitest';

describe('custom.js', () => {
    beforeEach(() => {
        // Reset $eXeLearningCustom before each test
        global.$eXeLearningCustom = {
            init: function () {
                // alert("eXeLearning is ready!");
            },
        };
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
});
