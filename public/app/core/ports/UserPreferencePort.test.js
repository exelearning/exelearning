import { describe, it, expect, beforeEach } from 'vitest';
import { UserPreferencePort } from './UserPreferencePort.js';

describe('UserPreferencePort', () => {
    let port;

    beforeEach(() => {
        port = new UserPreferencePort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof UserPreferencePort).toBe('function');
            expect(new UserPreferencePort()).toBeInstanceOf(UserPreferencePort);
        });

        it('should have all required methods', () => {
            expect(typeof port.getPreferences).toBe('function');
            expect(typeof port.savePreferences).toBe('function');
            expect(typeof port.acceptLopd).toBe('function');
            expect(typeof port.isLopdAccepted).toBe('function');
            expect(typeof port.getPreference).toBe('function');
            expect(typeof port.setPreference).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('getPreferences() should throw not implemented error', async () => {
            await expect(port.getPreferences()).rejects.toThrow(
                'UserPreferencePort.getPreferences() not implemented',
            );
        });

        it('savePreferences() should throw not implemented error', async () => {
            await expect(port.savePreferences({})).rejects.toThrow(
                'UserPreferencePort.savePreferences() not implemented',
            );
        });

        it('acceptLopd() should throw not implemented error', async () => {
            await expect(port.acceptLopd()).rejects.toThrow(
                'UserPreferencePort.acceptLopd() not implemented',
            );
        });

        it('isLopdAccepted() should throw not implemented error', async () => {
            await expect(port.isLopdAccepted()).rejects.toThrow(
                'UserPreferencePort.isLopdAccepted() not implemented',
            );
        });

        it('getPreference() should throw not implemented error', async () => {
            await expect(port.getPreference('key')).rejects.toThrow(
                'UserPreferencePort.getPreference() not implemented',
            );
        });

        it('getPreference() with default value should throw not implemented error', async () => {
            await expect(port.getPreference('key', 'default')).rejects.toThrow(
                'UserPreferencePort.getPreference() not implemented',
            );
        });

        it('setPreference() should throw not implemented error', async () => {
            await expect(port.setPreference('key', 'value')).rejects.toThrow(
                'UserPreferencePort.setPreference() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export UserPreferencePort as default', async () => {
            const module = await import('./UserPreferencePort.js');
            expect(module.default).toBe(UserPreferencePort);
        });
    });
});
