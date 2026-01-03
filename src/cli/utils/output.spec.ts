/**
 * Tests for CLI Output Utilities
 */
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { colors, success, error, warning, info, table, keyValue, list, section, EXIT_CODES } from './output';

describe('CLI output utilities', () => {
    let consoleLogSpy: ReturnType<typeof spyOn>;
    let consoleErrorSpy: ReturnType<typeof spyOn>;
    let consoleWarnSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe('colors', () => {
        it('should wrap text with reset codes', () => {
            const result = colors.reset('text');
            expect(result).toContain('text');
        });

        it('should wrap text with bold codes', () => {
            const result = colors.bold('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[1m');
        });

        it('should wrap text with dim codes', () => {
            const result = colors.dim('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[2m');
        });

        it('should wrap text with red codes', () => {
            const result = colors.red('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[31m');
        });

        it('should wrap text with green codes', () => {
            const result = colors.green('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[32m');
        });

        it('should wrap text with yellow codes', () => {
            const result = colors.yellow('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[33m');
        });

        it('should wrap text with blue codes', () => {
            const result = colors.blue('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[34m');
        });

        it('should wrap text with magenta codes', () => {
            const result = colors.magenta('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[35m');
        });

        it('should wrap text with cyan codes', () => {
            const result = colors.cyan('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[36m');
        });

        it('should wrap text with gray codes', () => {
            const result = colors.gray('text');
            expect(result).toContain('text');
            expect(result).toContain('\x1b[90m');
        });
    });

    describe('success', () => {
        it('should print success message', () => {
            success('Operation completed');
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('SUCCESS');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('Operation completed');
        });
    });

    describe('error', () => {
        it('should print error message to stderr', () => {
            error('Something went wrong');
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR');
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('Something went wrong');
        });
    });

    describe('warning', () => {
        it('should print warning message', () => {
            warning('Be careful');
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('WARNING');
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('Be careful');
        });
    });

    describe('info', () => {
        it('should print info message', () => {
            info('FYI');
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('INFO');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('FYI');
        });
    });

    describe('table', () => {
        it('should print formatted table', () => {
            table(
                ['Name', 'Age'],
                [
                    ['Alice', '30'],
                    ['Bob', '25'],
                ],
            );
            expect(consoleLogSpy).toHaveBeenCalled();
            // Should have separators + header + rows
            expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
        });

        it('should handle empty headers', () => {
            table([], []);
            // Should not print anything
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should handle missing cells', () => {
            table(['A', 'B', 'C'], [['1']]);
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('keyValue', () => {
        it('should print key-value pairs', () => {
            keyValue({ name: 'Alice', age: 30 });
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle null values', () => {
            keyValue({ name: null });
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('(none)');
        });

        it('should handle undefined values', () => {
            keyValue({ name: undefined });
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('(none)');
        });

        it('should handle boolean values', () => {
            keyValue({ active: true, disabled: false });
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('list', () => {
        it('should print bulleted list', () => {
            list(['Item 1', 'Item 2', 'Item 3']);
            expect(consoleLogSpy).toHaveBeenCalledTimes(3);
        });

        it('should use custom bullet', () => {
            list(['Item'], '*');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('*');
        });

        it('should handle empty list', () => {
            list([]);
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('section', () => {
        it('should print section header', () => {
            section('My Section');
            expect(consoleLogSpy).toHaveBeenCalledTimes(3); // empty line + title + separator
        });
    });

    describe('EXIT_CODES', () => {
        it('should have SUCCESS as 0', () => {
            expect(EXIT_CODES.SUCCESS).toBe(0);
        });

        it('should have FAILURE as 1', () => {
            expect(EXIT_CODES.FAILURE).toBe(1);
        });

        it('should have INVALID_ARGS as 2', () => {
            expect(EXIT_CODES.INVALID_ARGS).toBe(2);
        });

        it('should have NOT_FOUND as 3', () => {
            expect(EXIT_CODES.NOT_FOUND).toBe(3);
        });
    });
});
