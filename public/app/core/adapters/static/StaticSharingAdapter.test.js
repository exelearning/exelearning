import { describe, it, expect } from 'vitest';
import { StaticSharingAdapter } from './StaticSharingAdapter.js';

describe('StaticSharingAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new StaticSharingAdapter();
    });

    describe('getProject', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.getProject('123');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('updateVisibility', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.updateVisibility('123', 'public');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('addCollaborator', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.addCollaborator('123', 'user@example.com', 'editor');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('removeCollaborator', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.removeCollaborator('123', 'user-456');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('transferOwnership', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.transferOwnership('123', 'new-owner');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('isSupported', () => {
        it('should return false', () => {
            expect(adapter.isSupported()).toBe(false);
        });
    });
});
