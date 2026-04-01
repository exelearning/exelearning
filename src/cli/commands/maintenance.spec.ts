import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execute, configure, resetDependencies } from './maintenance';

describe('maintenance CLI command', () => {
    let storedSettings: Map<string, { value: string; type: string }>;

    beforeEach(() => {
        storedSettings = new Map();
        configure({
            db: {} as any,
            setSetting: async (_db: any, key: string, value: string, type: string) => {
                storedSettings.set(key, { value, type });
            },
            getSetting: async (_db: any, key: string) => {
                const entry = storedSettings.get(key);
                if (!entry) return undefined;
                return { key, value: entry.value, type: entry.type, updated_at: null, updated_by: null };
            },
        });
    });

    afterEach(() => {
        resetDependencies();
    });

    it('execute(["on"]) sets MAINTENANCE_MODE to true', async () => {
        const result = await execute(['on'], {});
        expect(result.success).toBe(true);
        expect(result.message).toContain('enabled');
        expect(storedSettings.get('MAINTENANCE_MODE')?.value).toBe('true');
    });

    it('execute(["off"]) sets MAINTENANCE_MODE to false', async () => {
        storedSettings.set('MAINTENANCE_MODE', { value: 'true', type: 'boolean' });
        const result = await execute(['off'], {});
        expect(result.success).toBe(true);
        expect(result.message).toContain('disabled');
        expect(storedSettings.get('MAINTENANCE_MODE')?.value).toBe('false');
    });

    it('execute(["status"]) returns current status when disabled', async () => {
        const result = await execute(['status'], {});
        expect(result.success).toBe(true);
        expect(result.message).toContain('disabled');
    });

    it('execute(["status"]) returns current status when enabled', async () => {
        storedSettings.set('MAINTENANCE_MODE', { value: 'true', type: 'boolean' });
        const result = await execute(['status'], {});
        expect(result.success).toBe(true);
        expect(result.message).toContain('enabled');
    });

    it('execute([]) defaults to status', async () => {
        const result = await execute([], {});
        expect(result.success).toBe(true);
        expect(result.message).toContain('disabled');
    });

    it('invalid subcommand returns error', async () => {
        const result = await execute(['invalid'], {});
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown subcommand');
    });

    it('printHelp outputs usage info', () => {
        const { printHelp } = require('./maintenance');
        const logs: string[] = [];
        const origLog = console.log;
        console.log = (...args: unknown[]) => logs.push(args.join(' '));
        printHelp();
        console.log = origLog;
        const output = logs.join('\n');
        expect(output).toContain('maintenance');
        expect(output).toContain('on');
        expect(output).toContain('off');
        expect(output).toContain('status');
    });
});
