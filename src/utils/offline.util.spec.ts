import { describe, it, expect, afterEach } from 'bun:test';
import { isOfflineMode } from './offline.util';

const originalOnlineMode = process.env.APP_ONLINE_MODE;

afterEach(() => {
    if (originalOnlineMode === undefined) {
        delete process.env.APP_ONLINE_MODE;
    } else {
        process.env.APP_ONLINE_MODE = originalOnlineMode;
    }
});

describe('isOfflineMode', () => {
    it('is offline when APP_ONLINE_MODE is 0', () => {
        process.env.APP_ONLINE_MODE = '0';
        expect(isOfflineMode()).toBe(true);
    });

    it('is online when APP_ONLINE_MODE is 1', () => {
        process.env.APP_ONLINE_MODE = '1';
        expect(isOfflineMode()).toBe(false);
    });

    it('defaults to online when APP_ONLINE_MODE is unset', () => {
        delete process.env.APP_ONLINE_MODE;
        expect(isOfflineMode()).toBe(false);
    });

    it('reads the environment on every call', () => {
        process.env.APP_ONLINE_MODE = '1';
        expect(isOfflineMode()).toBe(false);
        process.env.APP_ONLINE_MODE = '0';
        expect(isOfflineMode()).toBe(true);
    });
});
