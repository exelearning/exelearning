/**
 * Tests for WebSocket Configuration
 * Tests the REAL implementation - no mock.module()
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getConfig, getConfigValue, DEBUG } from './config';

describe('WebSocket config', () => {
    // Save and restore environment variables
    let originalElectron: string | undefined;
    let originalDesktopMode: string | undefined;
    let originalTauri: string | undefined;
    let originalDebug: string | undefined;

    beforeEach(() => {
        originalElectron = process.env.ELECTRON;
        originalDesktopMode = process.env.DESKTOP_MODE;
        originalTauri = process.env.TAURI;
        originalDebug = process.env.APP_DEBUG;
        // Clear all
        delete process.env.ELECTRON;
        delete process.env.DESKTOP_MODE;
        delete process.env.TAURI;
    });

    afterEach(() => {
        // Restore
        if (originalElectron !== undefined) process.env.ELECTRON = originalElectron;
        else delete process.env.ELECTRON;
        if (originalDesktopMode !== undefined) process.env.DESKTOP_MODE = originalDesktopMode;
        else delete process.env.DESKTOP_MODE;
        if (originalTauri !== undefined) process.env.TAURI = originalTauri;
        else delete process.env.TAURI;
        if (originalDebug !== undefined) process.env.APP_DEBUG = originalDebug;
        else delete process.env.APP_DEBUG;
    });

    describe('getConfig', () => {
        it('should return server config by default', () => {
            const config = getConfig();
            expect(config.pingInterval).toBe(30_000);
            expect(config.pongTimeout).toBe(10_000);
            expect(config.cleanupDelay).toBe(30_000);
            expect(config.compactThresholdUpdates).toBe(50);
            expect(config.compactThresholdBytes).toBe(512 * 1024);
        });

        it('should return desktop config when ELECTRON=1', () => {
            process.env.ELECTRON = '1';
            const config = getConfig();
            expect(config.pingInterval).toBe(60_000);
            expect(config.cleanupDelay).toBe(5_000);
            expect(config.compactThresholdUpdates).toBe(100);
            expect(config.compactThresholdBytes).toBe(1024 * 1024);
        });

        it('should return desktop config when DESKTOP_MODE=1', () => {
            process.env.DESKTOP_MODE = '1';
            const config = getConfig();
            expect(config.pingInterval).toBe(60_000);
        });

        it('should return desktop config when TAURI=1', () => {
            process.env.TAURI = '1';
            const config = getConfig();
            expect(config.pingInterval).toBe(60_000);
        });
    });

    describe('getConfigValue', () => {
        it('should return config value for key', () => {
            const value = getConfigValue('pingInterval');
            expect(typeof value).toBe('number');
        });

        it('should return override when provided', () => {
            const value = getConfigValue('pingInterval', 45_000);
            expect(value).toBe(45_000);
        });

        it('should return config value when override is undefined', () => {
            const value = getConfigValue('pongTimeout', undefined);
            expect(value).toBe(10_000);
        });

        it('should work for all config keys', () => {
            expect(typeof getConfigValue('pingInterval')).toBe('number');
            expect(typeof getConfigValue('pongTimeout')).toBe('number');
            expect(typeof getConfigValue('cleanupDelay')).toBe('number');
            expect(typeof getConfigValue('compactThresholdUpdates')).toBe('number');
            expect(typeof getConfigValue('compactThresholdBytes')).toBe('number');
        });
    });

    describe('DEBUG', () => {
        it('should be a boolean', () => {
            expect(typeof DEBUG).toBe('boolean');
        });
    });
});
