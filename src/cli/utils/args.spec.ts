/**
 * Tests for CLI Argument Parser
 */
import { describe, it, expect } from 'bun:test';
import { parseArgs, getString, getNumber, getBoolean, getArray, hasHelp } from './args';

describe('CLI args parser', () => {
    describe('parseArgs', () => {
        it('should parse command as first non-flag argument', () => {
            const result = parseArgs(['bun', 'script.ts', 'create-user']);
            expect(result.command).toBe('create-user');
        });

        it('should handle empty argv', () => {
            const result = parseArgs(['bun', 'script.ts']);
            expect(result.command).toBe('');
            expect(result.positional).toEqual([]);
        });

        it('should collect positional arguments', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', 'arg1', 'arg2', 'arg3']);
            expect(result.positional).toEqual(['arg1', 'arg2', 'arg3']);
        });

        it('should parse long flag with equals sign', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '--name=value']);
            expect(result.flags['name']).toBe('value');
        });

        it('should parse long flag with space separator', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '--name', 'value']);
            expect(result.flags['name']).toBe('value');
        });

        it('should parse boolean long flag', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '--verbose']);
            expect(result.flags['verbose']).toBe(true);
        });

        it('should parse short flag with equals sign', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '-n=value']);
            expect(result.flags['n']).toBe('value');
        });

        it('should parse short flag with space separator', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '-n', 'value']);
            expect(result.flags['n']).toBe('value');
        });

        it('should parse boolean short flag', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '-v']);
            expect(result.flags['v']).toBe(true);
        });

        it('should handle repeated flags as arrays', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', '--role', 'admin', '--role', 'user']);
            expect(result.flags['role']).toEqual(['admin', 'user']);
        });

        it('should handle mixed positional and flags', () => {
            const result = parseArgs(['bun', 'script.ts', 'cmd', 'pos1', '--flag', 'value', 'pos2']);
            expect(result.command).toBe('cmd');
            expect(result.positional).toEqual(['pos1', 'pos2']);
            expect(result.flags['flag']).toBe('value');
        });

        it('should not treat flag starting with - as command', () => {
            const result = parseArgs(['bun', 'script.ts', '--help']);
            expect(result.command).toBe('');
            expect(result.flags['help']).toBe(true);
        });
    });

    describe('getString', () => {
        it('should return string value', () => {
            const flags = { name: 'John' };
            expect(getString(flags, 'name')).toBe('John');
        });

        it('should return first element from array', () => {
            const flags = { name: ['John', 'Jane'] };
            expect(getString(flags, 'name')).toBe('John');
        });

        it('should return default value when not found', () => {
            const flags = {};
            expect(getString(flags, 'name', 'default')).toBe('default');
        });

        it('should return undefined when not found and no default', () => {
            const flags = {};
            expect(getString(flags, 'name')).toBeUndefined();
        });

        it('should return default for boolean flags', () => {
            const flags = { verbose: true };
            expect(getString(flags, 'verbose', 'default')).toBe('default');
        });
    });

    describe('getNumber', () => {
        it('should parse number from string', () => {
            const flags = { count: '42' };
            expect(getNumber(flags, 'count')).toBe(42);
        });

        it('should return default for invalid number', () => {
            const flags = { count: 'abc' };
            expect(getNumber(flags, 'count', 10)).toBe(10);
        });

        it('should return default when not found', () => {
            const flags = {};
            expect(getNumber(flags, 'count', 5)).toBe(5);
        });

        it('should return undefined when not found and no default', () => {
            const flags = {};
            expect(getNumber(flags, 'count')).toBeUndefined();
        });
    });

    describe('getBoolean', () => {
        it('should return true for boolean true', () => {
            const flags = { verbose: true };
            expect(getBoolean(flags, 'verbose')).toBe(true);
        });

        it('should return false for boolean false', () => {
            const flags = { verbose: false };
            expect(getBoolean(flags, 'verbose')).toBe(false);
        });

        it('should return true for string "true"', () => {
            const flags = { verbose: 'true' };
            expect(getBoolean(flags, 'verbose')).toBe(true);
        });

        it('should return false for string "false"', () => {
            const flags = { verbose: 'false' };
            expect(getBoolean(flags, 'verbose')).toBe(false);
        });

        it('should return false for string "0"', () => {
            const flags = { verbose: '0' };
            expect(getBoolean(flags, 'verbose')).toBe(false);
        });

        it('should return true for any other string', () => {
            const flags = { verbose: 'yes' };
            expect(getBoolean(flags, 'verbose')).toBe(true);
        });

        it('should return default when not found', () => {
            const flags = {};
            expect(getBoolean(flags, 'verbose', true)).toBe(true);
            expect(getBoolean(flags, 'verbose', false)).toBe(false);
        });
    });

    describe('getArray', () => {
        it('should return array as is', () => {
            const flags = { roles: ['admin', 'user'] };
            expect(getArray(flags, 'roles')).toEqual(['admin', 'user']);
        });

        it('should wrap string in array', () => {
            const flags = { roles: 'admin' };
            expect(getArray(flags, 'roles')).toEqual(['admin']);
        });

        it('should return empty array when not found', () => {
            const flags = {};
            expect(getArray(flags, 'roles')).toEqual([]);
        });

        it('should return empty array for boolean', () => {
            const flags = { roles: true };
            expect(getArray(flags, 'roles')).toEqual([]);
        });
    });

    describe('hasHelp', () => {
        it('should return true for --help', () => {
            const flags = { help: true };
            expect(hasHelp(flags)).toBe(true);
        });

        it('should return true for -h', () => {
            const flags = { h: true };
            expect(hasHelp(flags)).toBe(true);
        });

        it('should return false when no help flag', () => {
            const flags = { verbose: true };
            expect(hasHelp(flags)).toBe(false);
        });

        it('should return false for help=value (not boolean)', () => {
            const flags = { help: 'value' };
            expect(hasHelp(flags)).toBe(false);
        });
    });
});
