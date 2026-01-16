import { describe, it, expect, beforeEach } from 'vitest';
import { SharingPort } from './SharingPort.js';

describe('SharingPort', () => {
    let port;

    beforeEach(() => {
        port = new SharingPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof SharingPort).toBe('function');
            expect(new SharingPort()).toBeInstanceOf(SharingPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.getProject).toBe('function');
            expect(typeof port.updateVisibility).toBe('function');
            expect(typeof port.addCollaborator).toBe('function');
            expect(typeof port.removeCollaborator).toBe('function');
            expect(typeof port.transferOwnership).toBe('function');
            expect(typeof port.isSupported).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('getProject() should throw not implemented error', async () => {
            await expect(port.getProject('project-id')).rejects.toThrow(
                'SharingPort.getProject() not implemented',
            );
        });

        it('updateVisibility() should throw not implemented error', async () => {
            await expect(port.updateVisibility('project-id', 'public')).rejects.toThrow(
                'SharingPort.updateVisibility() not implemented',
            );
        });

        it('addCollaborator() should throw not implemented error', async () => {
            await expect(port.addCollaborator('project-id', 'user@example.com')).rejects.toThrow(
                'SharingPort.addCollaborator() not implemented',
            );
        });

        it('addCollaborator() with role should throw not implemented error', async () => {
            await expect(
                port.addCollaborator('project-id', 'user@example.com', 'viewer'),
            ).rejects.toThrow('SharingPort.addCollaborator() not implemented');
        });

        it('removeCollaborator() should throw not implemented error', async () => {
            await expect(port.removeCollaborator('project-id', 123)).rejects.toThrow(
                'SharingPort.removeCollaborator() not implemented',
            );
        });

        it('transferOwnership() should throw not implemented error', async () => {
            await expect(port.transferOwnership('project-id', 456)).rejects.toThrow(
                'SharingPort.transferOwnership() not implemented',
            );
        });
    });

    describe('default implementation methods', () => {
        it('isSupported() should return true by default', () => {
            expect(port.isSupported()).toBe(true);
        });
    });

    describe('default export', () => {
        it('should export SharingPort as default', async () => {
            const module = await import('./SharingPort.js');
            expect(module.default).toBe(SharingPort);
        });
    });
});
