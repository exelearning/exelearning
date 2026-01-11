import { describe, it, expect } from 'vitest';
import { NullCollaborationAdapter } from './NullCollaborationAdapter.js';

describe('NullCollaborationAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new NullCollaborationAdapter();
    });

    describe('isEnabled', () => {
        it('should return false', () => {
            expect(adapter.isEnabled()).toBe(false);
        });
    });

    describe('connect', () => {
        it('should be no-op (not throw)', async () => {
            await adapter.connect('project-123');
            // Should not throw
        });
    });

    describe('disconnect', () => {
        it('should be no-op (not throw)', async () => {
            await adapter.disconnect();
            // Should not throw
        });
    });

    describe('getPresence', () => {
        it('should return local user only', async () => {
            const presence = await adapter.getPresence();

            expect(presence).toHaveLength(1);
            expect(presence[0]).toEqual({
                clientId: 0,
                userId: 'local',
                username: 'You',
                color: '#4285f4',
                cursor: null,
            });
        });
    });

    describe('updatePresence', () => {
        it('should be no-op (not throw)', async () => {
            await adapter.updatePresence({ cursor: { x: 0, y: 0 } });
            // Should not throw
        });
    });

    describe('onPresenceChange', () => {
        it('should return no-op unsubscribe function', () => {
            const callback = () => {};

            const unsubscribe = adapter.onPresenceChange(callback);

            expect(typeof unsubscribe).toBe('function');
            unsubscribe(); // Should not throw
        });
    });

    describe('getWebSocketUrl', () => {
        it('should return null', () => {
            expect(adapter.getWebSocketUrl()).toBeNull();
        });
    });

    describe('obtainBlockSync', () => {
        it('should return OK with null block', async () => {
            const result = await adapter.obtainBlockSync({ blockId: '123' });

            expect(result).toEqual({ responseMessage: 'OK', block: null });
        });
    });
});
