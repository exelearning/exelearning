import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectRepositoryPort } from './ProjectRepositoryPort.js';

describe('ProjectRepositoryPort', () => {
    let port;

    beforeEach(() => {
        port = new ProjectRepositoryPort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof ProjectRepositoryPort).toBe('function');
            expect(new ProjectRepositoryPort()).toBeInstanceOf(ProjectRepositoryPort);
        });

        it('should have all required methods', () => {
            expect(typeof port.list).toBe('function');
            expect(typeof port.get).toBe('function');
            expect(typeof port.create).toBe('function');
            expect(typeof port.update).toBe('function');
            expect(typeof port.delete).toBe('function');
            expect(typeof port.getRecent).toBe('function');
            expect(typeof port.exists).toBe('function');
            expect(typeof port.save).toBe('function');
            expect(typeof port.autoSave).toBe('function');
            expect(typeof port.saveAs).toBe('function');
            expect(typeof port.duplicate).toBe('function');
            expect(typeof port.getLastUpdated).toBe('function');
            expect(typeof port.getConcurrentUsers).toBe('function');
            expect(typeof port.closeSession).toBe('function');
            expect(typeof port.joinSession).toBe('function');
            expect(typeof port.checkCurrentUsers).toBe('function');
            expect(typeof port.openFile).toBe('function');
            expect(typeof port.openLocalFile).toBe('function');
            expect(typeof port.openLargeLocalFile).toBe('function');
            expect(typeof port.getLocalProperties).toBe('function');
            expect(typeof port.getLocalComponents).toBe('function');
            expect(typeof port.importToRoot).toBe('function');
            expect(typeof port.importToRootFromLocal).toBe('function');
            expect(typeof port.importAsChild).toBe('function');
            expect(typeof port.openMultipleLocalFiles).toBe('function');
            expect(typeof port.deleteByDate).toBe('function');
            expect(typeof port.cleanAutosaves).toBe('function');
            expect(typeof port.getStructure).toBe('function');
            expect(typeof port.getProperties).toBe('function');
            expect(typeof port.saveProperties).toBe('function');
            expect(typeof port.getUsedFiles).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('list() should throw not implemented error', async () => {
            await expect(port.list()).rejects.toThrow('ProjectRepositoryPort.list() not implemented');
        });

        it('get() should throw not implemented error', async () => {
            await expect(port.get('project-id')).rejects.toThrow(
                'ProjectRepositoryPort.get() not implemented',
            );
        });

        it('create() should throw not implemented error', async () => {
            await expect(port.create({ title: 'Test' })).rejects.toThrow(
                'ProjectRepositoryPort.create() not implemented',
            );
        });

        it('update() should throw not implemented error', async () => {
            await expect(port.update('project-id', {})).rejects.toThrow(
                'ProjectRepositoryPort.update() not implemented',
            );
        });

        it('delete() should throw not implemented error', async () => {
            await expect(port.delete('project-id')).rejects.toThrow(
                'ProjectRepositoryPort.delete() not implemented',
            );
        });

        it('getRecent() should throw not implemented error', async () => {
            await expect(port.getRecent()).rejects.toThrow(
                'ProjectRepositoryPort.getRecent() not implemented',
            );
        });

        it('getRecent() with limit should throw not implemented error', async () => {
            await expect(port.getRecent(5)).rejects.toThrow(
                'ProjectRepositoryPort.getRecent() not implemented',
            );
        });

        it('exists() should throw not implemented error', async () => {
            await expect(port.exists('project-id')).rejects.toThrow(
                'ProjectRepositoryPort.exists() not implemented',
            );
        });

        it('save() should throw not implemented error', async () => {
            await expect(port.save('session-id', {})).rejects.toThrow(
                'ProjectRepositoryPort.save() not implemented',
            );
        });

        it('autoSave() should throw not implemented error', async () => {
            await expect(port.autoSave('session-id', {})).rejects.toThrow(
                'ProjectRepositoryPort.autoSave() not implemented',
            );
        });

        it('saveAs() should throw not implemented error', async () => {
            await expect(port.saveAs('session-id', {})).rejects.toThrow(
                'ProjectRepositoryPort.saveAs() not implemented',
            );
        });

        it('duplicate() should throw not implemented error', async () => {
            await expect(port.duplicate('project-id')).rejects.toThrow(
                'ProjectRepositoryPort.duplicate() not implemented',
            );
        });

        it('getLastUpdated() should throw not implemented error', async () => {
            await expect(port.getLastUpdated('project-id')).rejects.toThrow(
                'ProjectRepositoryPort.getLastUpdated() not implemented',
            );
        });

        it('getConcurrentUsers() should throw not implemented error', async () => {
            await expect(port.getConcurrentUsers('id', 'version', 'session')).rejects.toThrow(
                'ProjectRepositoryPort.getConcurrentUsers() not implemented',
            );
        });

        it('closeSession() should throw not implemented error', async () => {
            await expect(port.closeSession({})).rejects.toThrow(
                'ProjectRepositoryPort.closeSession() not implemented',
            );
        });

        it('joinSession() should throw not implemented error', async () => {
            await expect(port.joinSession('session-id')).rejects.toThrow(
                'ProjectRepositoryPort.joinSession() not implemented',
            );
        });

        it('checkCurrentUsers() should throw not implemented error', async () => {
            await expect(port.checkCurrentUsers({})).rejects.toThrow(
                'ProjectRepositoryPort.checkCurrentUsers() not implemented',
            );
        });

        it('openFile() should throw not implemented error', async () => {
            await expect(port.openFile('file.elp')).rejects.toThrow(
                'ProjectRepositoryPort.openFile() not implemented',
            );
        });

        it('openLocalFile() should throw not implemented error', async () => {
            await expect(port.openLocalFile({})).rejects.toThrow(
                'ProjectRepositoryPort.openLocalFile() not implemented',
            );
        });

        it('openLargeLocalFile() should throw not implemented error', async () => {
            await expect(port.openLargeLocalFile({})).rejects.toThrow(
                'ProjectRepositoryPort.openLargeLocalFile() not implemented',
            );
        });

        it('getLocalProperties() should throw not implemented error', async () => {
            await expect(port.getLocalProperties({})).rejects.toThrow(
                'ProjectRepositoryPort.getLocalProperties() not implemented',
            );
        });

        it('getLocalComponents() should throw not implemented error', async () => {
            await expect(port.getLocalComponents({})).rejects.toThrow(
                'ProjectRepositoryPort.getLocalComponents() not implemented',
            );
        });

        it('importToRoot() should throw not implemented error', async () => {
            await expect(port.importToRoot({})).rejects.toThrow(
                'ProjectRepositoryPort.importToRoot() not implemented',
            );
        });

        it('importToRootFromLocal() should throw not implemented error', async () => {
            await expect(port.importToRootFromLocal({})).rejects.toThrow(
                'ProjectRepositoryPort.importToRootFromLocal() not implemented',
            );
        });

        it('importAsChild() should throw not implemented error', async () => {
            await expect(port.importAsChild('nav-id', {})).rejects.toThrow(
                'ProjectRepositoryPort.importAsChild() not implemented',
            );
        });

        it('openMultipleLocalFiles() should throw not implemented error', async () => {
            await expect(port.openMultipleLocalFiles({})).rejects.toThrow(
                'ProjectRepositoryPort.openMultipleLocalFiles() not implemented',
            );
        });

        it('deleteByDate() should throw not implemented error', async () => {
            await expect(port.deleteByDate({})).rejects.toThrow(
                'ProjectRepositoryPort.deleteByDate() not implemented',
            );
        });

        it('cleanAutosaves() should throw not implemented error', async () => {
            await expect(port.cleanAutosaves({})).rejects.toThrow(
                'ProjectRepositoryPort.cleanAutosaves() not implemented',
            );
        });

        it('getStructure() should throw not implemented error', async () => {
            await expect(port.getStructure('version-id', 'session-id')).rejects.toThrow(
                'ProjectRepositoryPort.getStructure() not implemented',
            );
        });

        it('getProperties() should throw not implemented error', async () => {
            await expect(port.getProperties('session-id')).rejects.toThrow(
                'ProjectRepositoryPort.getProperties() not implemented',
            );
        });

        it('saveProperties() should throw not implemented error', async () => {
            await expect(port.saveProperties({})).rejects.toThrow(
                'ProjectRepositoryPort.saveProperties() not implemented',
            );
        });

        it('getUsedFiles() should throw not implemented error', async () => {
            await expect(port.getUsedFiles({})).rejects.toThrow(
                'ProjectRepositoryPort.getUsedFiles() not implemented',
            );
        });
    });

    describe('default export', () => {
        it('should export ProjectRepositoryPort as default', async () => {
            const module = await import('./ProjectRepositoryPort.js');
            expect(module.default).toBe(ProjectRepositoryPort);
        });
    });
});
