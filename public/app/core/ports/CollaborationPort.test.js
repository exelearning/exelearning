import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborationPort } from './CollaborationPort.js';

describe('CollaborationPort', () => {
    let port;

    beforeEach(() => {
        port = new CollaborationPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof CollaborationPort).toBe('function');
            expect(new CollaborationPort()).toBeInstanceOf(CollaborationPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.isEnabled).toBe('function');
            expect(typeof port.connect).toBe('function');
            expect(typeof port.disconnect).toBe('function');
            expect(typeof port.getPresence).toBe('function');
            expect(typeof port.updatePresence).toBe('function');
            expect(typeof port.onPresenceChange).toBe('function');
            expect(typeof port.getWebSocketUrl).toBe('function');
            expect(typeof port.obtainBlockSync).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('connect() should throw not implemented error', async () => {
            await expect(port.connect('project-id')).rejects.toThrow(
                'CollaborationPort.connect() not implemented',
            );
        });

        it('disconnect() should throw not implemented error', async () => {
            await expect(port.disconnect()).rejects.toThrow(
                'CollaborationPort.disconnect() not implemented',
            );
        });

        it('getPresence() should throw not implemented error', async () => {
            await expect(port.getPresence()).rejects.toThrow(
                'CollaborationPort.getPresence() not implemented',
            );
        });

        it('updatePresence() should throw not implemented error', async () => {
            await expect(port.updatePresence({})).rejects.toThrow(
                'CollaborationPort.updatePresence() not implemented',
            );
        });

        it('onPresenceChange() should throw not implemented error', () => {
            expect(() => port.onPresenceChange(() => {})).toThrow(
                'CollaborationPort.onPresenceChange() not implemented',
            );
        });

        it('obtainBlockSync() should throw not implemented error', async () => {
            await expect(port.obtainBlockSync({})).rejects.toThrow(
                'CollaborationPort.obtainBlockSync() not implemented',
            );
        });
    });

    describe('default implementation methods', () => {
        it('isEnabled() should return false by default', () => {
            expect(port.isEnabled()).toBe(false);
        });

        it('getWebSocketUrl() should return null by default', () => {
            expect(port.getWebSocketUrl()).toBeNull();
        });
    });

    describe('default export', () => {
        it('should export CollaborationPort as default', async () => {
            const module = await import('./CollaborationPort.js');
            expect(module.default).toBe(CollaborationPort);
        });
    });
});
