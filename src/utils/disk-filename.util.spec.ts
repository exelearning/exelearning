import { prepareDiskFilenameForSave, resolveDiskFilename } from './disk-filename.util';

describe('Disk Filename Utilities', () => {
    describe('prepareDiskFilenameForSave', () => {
        it('should replace absolute path with placeholder', () => {
            const fullPath = '/Users/ernesto/exelearning/files/perm/odes/2025/01/18/file.elpx';
            const filesDir = '/Users/ernesto/exelearning/files';

            const result = prepareDiskFilenameForSave(fullPath, filesDir);

            expect(result).toBe('{{files_dir}}/perm/odes/2025/01/18/file.elpx');
        });

        it('should handle filesDir with trailing slash', () => {
            const fullPath = '/var/exelearning/files/perm/odes/file.elpx';
            const filesDir = '/var/exelearning/files/';

            const result = prepareDiskFilenameForSave(fullPath, filesDir);

            expect(result).toBe('{{files_dir}}/perm/odes/file.elpx');
        });

        it('should handle Windows paths', () => {
            const fullPath = 'C:\\exelearning\\files\\perm\\odes\\file.elpx';
            const filesDir = 'C:\\exelearning\\files';

            const result = prepareDiskFilenameForSave(fullPath, filesDir);

            expect(result).toBe('{{files_dir}}/perm/odes/file.elpx');
        });

        it('should handle path that does not start with filesDir', () => {
            const fullPath = '/other/path/file.elpx';
            const filesDir = '/Users/ernesto/files';

            const result = prepareDiskFilenameForSave(fullPath, filesDir);

            expect(result).toBe('{{files_dir}}/other/path/file.elpx');
        });

        it('should throw error for missing fullPath', () => {
            const fullPath = '';
            const filesDir = '/Users/ernesto/files';

            expect(() => prepareDiskFilenameForSave(fullPath, filesDir)).toThrow('fullPath is required');
        });

        it('should throw error for missing filesDir', () => {
            const fullPath = '/Users/ernesto/files/file.elpx';
            const filesDir = '';

            expect(() => prepareDiskFilenameForSave(fullPath, filesDir)).toThrow('filesDir is required');
        });
    });

    describe('resolveDiskFilename', () => {
        it('should replace placeholder with actual path', () => {
            const diskFilename = '{{files_dir}}/perm/odes/2025/01/18/file.elpx';
            const filesDir = '/Users/ernesto/exelearning/files';

            const result = resolveDiskFilename(diskFilename, filesDir);

            expect(result).toBe('/Users/ernesto/exelearning/files/perm/odes/2025/01/18/file.elpx');
        });

        it('should handle filesDir with trailing slash', () => {
            const diskFilename = '{{files_dir}}/perm/odes/file.elpx';
            const filesDir = '/var/exelearning/files/';

            const result = resolveDiskFilename(diskFilename, filesDir);

            expect(result).toBe('/var/exelearning/files/perm/odes/file.elpx');
        });

        it('should throw error for missing diskFilename', () => {
            const diskFilename = '';
            const filesDir = '/Users/ernesto/files';

            expect(() => resolveDiskFilename(diskFilename, filesDir)).toThrow('diskFilename is required');
        });

        it('should throw error for missing filesDir', () => {
            const diskFilename = '{{files_dir}}/perm/odes/file.elpx';
            const filesDir = '';

            expect(() => resolveDiskFilename(diskFilename, filesDir)).toThrow('filesDir is required');
        });
    });

    describe('prepareDiskFilenameForSave and resolveDiskFilename integration', () => {
        it('should be reversible operations', () => {
            const originalPath = '/Users/ernesto/exelearning/files/perm/odes/2025/01/18/file.elpx';
            const filesDir = '/Users/ernesto/exelearning/files';

            const prepared = prepareDiskFilenameForSave(originalPath, filesDir);
            const resolved = resolveDiskFilename(prepared, filesDir);

            expect(resolved).toBe(originalPath);
        });

        it('should maintain path portability across different filesDir', () => {
            const originalPath = '/Users/ernesto/exelearning/files/perm/odes/file.elpx';
            const originalFilesDir = '/Users/ernesto/exelearning/files';
            const newFilesDir = '/var/production/exelearning/files';

            const prepared = prepareDiskFilenameForSave(originalPath, originalFilesDir);
            const resolved = resolveDiskFilename(prepared, newFilesDir);

            expect(resolved).toBe('/var/production/exelearning/files/perm/odes/file.elpx');
            expect(prepared).toBe('{{files_dir}}/perm/odes/file.elpx');
        });
    });
});
