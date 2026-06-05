/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { DataProvider } from './DataProvider.js';

describe('DataProvider', () => {
    describe('abstract methods', () => {
        it('should throw for getLanguages()', async () => {
            const provider = new DataProvider();
            await expect(provider.getLanguages()).rejects.toThrow('must be implemented');
        });

        it('should throw for getThemes()', async () => {
            const provider = new DataProvider();
            await expect(provider.getThemes()).rejects.toThrow('must be implemented');
        });

        it('should throw for getIdevices()', async () => {
            const provider = new DataProvider();
            await expect(provider.getIdevices()).rejects.toThrow('must be implemented');
        });

        it('should throw for getParameters()', async () => {
            const provider = new DataProvider();
            await expect(provider.getParameters()).rejects.toThrow('must be implemented');
        });

        it('should throw for getTranslations()', async () => {
            const provider = new DataProvider();
            await expect(provider.getTranslations('en')).rejects.toThrow('must be implemented');
        });

        it('should throw for getUploadLimits()', async () => {
            const provider = new DataProvider();
            await expect(provider.getUploadLimits()).rejects.toThrow('must be implemented');
        });
    });
});
