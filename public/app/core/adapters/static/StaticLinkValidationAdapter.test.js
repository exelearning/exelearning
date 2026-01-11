import { describe, it, expect, beforeEach } from 'vitest';
import { StaticLinkValidationAdapter } from './StaticLinkValidationAdapter.js';

describe('StaticLinkValidationAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new StaticLinkValidationAdapter();
    });

    describe('getSessionBrokenLinks', () => {
        it('should return OK with empty brokenLinks', async () => {
            const result = await adapter.getSessionBrokenLinks({ sessionId: '123' });

            expect(result).toEqual({ responseMessage: 'OK', brokenLinks: [] });
        });
    });

    describe('extractLinks', () => {
        it('should return OK with empty links', async () => {
            const result = await adapter.extractLinks({ content: '<html></html>' });

            expect(result).toEqual({ responseMessage: 'OK', links: [], totalLinks: 0 });
        });
    });

    describe('getValidationStreamUrl', () => {
        it('should return null', () => {
            const url = adapter.getValidationStreamUrl();

            expect(url).toBeNull();
        });
    });

    describe('getPageBrokenLinks', () => {
        it('should return empty brokenLinks', async () => {
            const result = await adapter.getPageBrokenLinks('page-123');

            expect(result).toEqual({ brokenLinks: [] });
        });
    });

    describe('getBlockBrokenLinks', () => {
        it('should return empty brokenLinks', async () => {
            const result = await adapter.getBlockBrokenLinks('block-456');

            expect(result).toEqual({ brokenLinks: [] });
        });
    });

    describe('getIdeviceBrokenLinks', () => {
        it('should return empty brokenLinks', async () => {
            const result = await adapter.getIdeviceBrokenLinks('idevice-789');

            expect(result).toEqual({ brokenLinks: [] });
        });
    });

    describe('isSupported', () => {
        it('should return false', () => {
            expect(adapter.isSupported()).toBe(false);
        });
    });
});
