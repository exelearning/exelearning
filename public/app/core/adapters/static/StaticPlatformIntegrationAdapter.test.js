import { describe, it, expect, beforeEach } from 'vitest';
import { StaticPlatformIntegrationAdapter } from './StaticPlatformIntegrationAdapter.js';

describe('StaticPlatformIntegrationAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new StaticPlatformIntegrationAdapter();
    });

    describe('uploadElp', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.uploadElp({ elpData: 'base64data' });

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('openElp', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.openElp({ resourceId: '123' });

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('isSupported', () => {
        it('should return false', () => {
            expect(adapter.isSupported()).toBe(false);
        });
    });
});
