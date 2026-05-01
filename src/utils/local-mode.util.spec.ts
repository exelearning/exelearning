/**
 * Tests for local-mode.util
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { isLocalMode, isDevEnv, canInstallIdevicesFromEnv, canInstallIdevices } from './local-mode.util';

describe('local-mode.util', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.APP_ONLINE_MODE;
        delete process.env.APP_ENV;
        delete process.env.ONLINE_IDEVICES_INSTALL;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('isLocalMode', () => {
        it('returns true when APP_ONLINE_MODE=0', () => {
            process.env.APP_ONLINE_MODE = '0';
            expect(isLocalMode()).toBe(true);
        });

        it('returns false when APP_ONLINE_MODE=1', () => {
            process.env.APP_ONLINE_MODE = '1';
            expect(isLocalMode()).toBe(false);
        });

        it('defaults to false when unset', () => {
            expect(isLocalMode()).toBe(false);
        });
    });

    describe('isDevEnv', () => {
        it('returns true when APP_ENV=dev', () => {
            process.env.APP_ENV = 'dev';
            expect(isDevEnv()).toBe(true);
        });

        it('returns false otherwise', () => {
            process.env.APP_ENV = 'prod';
            expect(isDevEnv()).toBe(false);
        });
    });

    describe('canInstallIdevicesFromEnv', () => {
        it('allows local mode', () => {
            process.env.APP_ONLINE_MODE = '0';
            expect(canInstallIdevicesFromEnv()).toBe(true);
        });

        it('allows dev env', () => {
            process.env.APP_ENV = 'dev';
            expect(canInstallIdevicesFromEnv()).toBe(true);
        });

        it('allows admin opt-in via ONLINE_IDEVICES_INSTALL=1', () => {
            process.env.APP_ONLINE_MODE = '1';
            process.env.ONLINE_IDEVICES_INSTALL = '1';
            expect(canInstallIdevicesFromEnv()).toBe(true);
        });

        it('blocks plain online mode', () => {
            process.env.APP_ONLINE_MODE = '1';
            expect(canInstallIdevicesFromEnv()).toBe(false);
        });
    });

    describe('canInstallIdevices', () => {
        const fakeDb = {} as never;

        it('returns true in local mode without touching DB', async () => {
            process.env.APP_ONLINE_MODE = '0';
            expect(await canInstallIdevices(fakeDb)).toBe(true);
        });

        it('returns true in dev env without touching DB', async () => {
            process.env.APP_ENV = 'dev';
            expect(await canInstallIdevices(fakeDb)).toBe(true);
        });

        it('uses ONLINE_IDEVICES_INSTALL as fallback in online mode', async () => {
            process.env.APP_ONLINE_MODE = '1';
            process.env.ONLINE_IDEVICES_INSTALL = '1';
            expect(await canInstallIdevices(fakeDb)).toBe(true);
        });

        it('returns false in plain online mode', async () => {
            process.env.APP_ONLINE_MODE = '1';
            expect(await canInstallIdevices(fakeDb)).toBe(false);
        });
    });
});
