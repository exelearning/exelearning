/**
 * Tests for Project Folder Manager Service
 * Uses DI pattern with mocked query functions — no real DB needed.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import type { ProjectFolder, Project } from '../db/types';
import type { ProjectFolderWithCount } from '../db/queries/project-folders';
import {
    configure,
    resetDependencies,
    listFolders,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    assignProject,
    MAX_FOLDER_DEPTH,
} from './project-folder-manager';

const now = Date.now();

/** Default no-op findChildFolders mock: no siblings, so name-collision checks pass. */
const noSiblings = async () => [];

function makeFolder(overrides: Partial<ProjectFolder> = {}): ProjectFolder {
    return {
        id: 1,
        uuid: 'folder-uuid-1',
        user_id: 10,
        parent_folder_id: null,
        name: 'My Folder',
        created_at: now,
        updated_at: now,
        ...overrides,
    };
}

function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 1,
        uuid: 'project-uuid-1',
        title: 'A Project',
        description: null,
        owner_id: 10,
        status: 'active',
        visibility: 'private',
        language: null,
        author: null,
        license: null,
        last_accessed_at: null,
        saved_once: 1,
        platform_id: null,
        created_at: now,
        updated_at: now,
        ...overrides,
    };
}

describe('Project Folder Manager Service', () => {
    afterEach(() => {
        resetDependencies();
    });

    describe('listFolders', () => {
        it('returns a flat list unchanged when there is no nesting', async () => {
            const folders: ProjectFolderWithCount[] = [
                { id: 1, uuid: 'f1', name: 'Folder', parentId: null, projectCount: 3 },
            ];
            configure({ queries: { findFoldersWithCountsForUser: async () => folders } as any });

            const result = await listFolders({} as any, 10);

            expect(result).toEqual([{ uuid: 'f1', name: 'Folder', parentUuid: null, depth: 0, projectCount: 3 }]);
        });

        it('sorts nested folders into tree order with parentUuid and depth', async () => {
            // Deliberately out of tree order to prove sortIntoTreeOrder rebuilds it.
            const folders: ProjectFolderWithCount[] = [
                { id: 3, uuid: 'grandchild', name: 'Grandchild', parentId: 2, projectCount: 0 },
                { id: 1, uuid: 'root', name: 'Root', parentId: null, projectCount: 0 },
                { id: 2, uuid: 'child', name: 'Child', parentId: 1, projectCount: 0 },
                { id: 4, uuid: 'other-root', name: 'Other Root', parentId: null, projectCount: 0 },
            ];
            configure({ queries: { findFoldersWithCountsForUser: async () => folders } as any });

            const result = await listFolders({} as any, 10);

            expect(result.map(f => ({ uuid: f.uuid, parentUuid: f.parentUuid, depth: f.depth }))).toEqual([
                { uuid: 'root', parentUuid: null, depth: 0 },
                { uuid: 'child', parentUuid: 'root', depth: 1 },
                { uuid: 'grandchild', parentUuid: 'child', depth: 2 },
                { uuid: 'other-root', parentUuid: null, depth: 0 },
            ]);
        });
    });

    describe('createFolder', () => {
        it('rejects an empty name without calling the query', async () => {
            let called = false;
            configure({
                queries: {
                    createFolder: async () => {
                        called = true;
                        return makeFolder();
                    },
                } as any,
            });

            const result = await createFolder({} as any, 10, '   ');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('INVALID_NAME');
            expect(called).toBe(false);
        });

        it('rejects a name over the max length', async () => {
            const result = await createFolder({} as any, 10, 'a'.repeat(256));
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('INVALID_NAME');
        });

        it('trims the name before persisting', async () => {
            let receivedName = '';
            configure({
                queries: {
                    findChildFolders: noSiblings,
                    createFolder: async (_db: any, _userId: number, name: string) => {
                        receivedName = name;
                        return makeFolder({ name });
                    },
                } as any,
            });

            const result = await createFolder({} as any, 10, '  Trimmed  ');

            expect(result.success).toBe(true);
            expect(receivedName).toBe('Trimmed');
        });

        it('maps a query failure (duplicate name) to a DUPLICATE_NAME error', async () => {
            configure({
                queries: {
                    findChildFolders: noSiblings,
                    createFolder: async () => {
                        throw new Error('UNIQUE constraint failed');
                    },
                } as any,
            });

            const result = await createFolder({} as any, 10, 'Duplicate');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('DUPLICATE_NAME');
        });

        it('returns DUPLICATE_NAME when a sibling already has the same name (case/whitespace insensitive)', async () => {
            configure({
                queries: {
                    findChildFolders: async () => [makeFolder({ name: ' duplicate ' })],
                } as any,
            });

            const result = await createFolder({} as any, 10, 'Duplicate');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('DUPLICATE_NAME');
        });

        it('returns PARENT_NOT_FOUND when parentFolderUuid does not resolve to a folder', async () => {
            configure({ queries: { findFolderByUuid: async () => undefined } as any });

            const result = await createFolder({} as any, 10, 'Child', 'missing-parent');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('PARENT_NOT_FOUND');
        });

        it('returns PARENT_FORBIDDEN when the parent folder belongs to another user', async () => {
            configure({ queries: { findFolderByUuid: async () => makeFolder({ user_id: 999 }) } as any });

            const result = await createFolder({} as any, 10, 'Child', 'parent-uuid');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('PARENT_FORBIDDEN');
        });

        it('returns MAX_DEPTH_EXCEEDED when the parent is already at the deepest allowed level', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ user_id: 10 }),
                    findFolderDepth: async () => MAX_FOLDER_DEPTH - 1, // parent is already the deepest level
                } as any,
            });

            const result = await createFolder({} as any, 10, 'Too Deep', 'parent-uuid');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('MAX_DEPTH_EXCEEDED');
        });

        it('creates a folder under an owned parent within the depth limit', async () => {
            let receivedParentId: number | null | undefined;
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ id: 5, user_id: 10 }),
                    findFolderDepth: async () => 0,
                    findChildFolders: noSiblings,
                    createFolder: async (_db: any, _userId: number, name: string, parentFolderId: number | null) => {
                        receivedParentId = parentFolderId;
                        return makeFolder({ name, parent_folder_id: parentFolderId });
                    },
                } as any,
            });

            const result = await createFolder({} as any, 10, 'Child', 'parent-uuid');

            expect(result.success).toBe(true);
            expect(receivedParentId).toBe(5);
        });
    });

    describe('renameFolder', () => {
        it('rejects an invalid name', async () => {
            const result = await renameFolder({} as any, 10, 'folder-uuid-1', '');
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('INVALID_NAME');
        });

        it('returns FOLDER_NOT_FOUND when the folder does not exist', async () => {
            configure({ queries: { findFolderByUuid: async () => undefined } as any });

            const result = await renameFolder({} as any, 10, 'missing', 'New Name');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_NOT_FOUND');
        });

        it('returns FOLDER_FORBIDDEN when the folder belongs to another user', async () => {
            configure({ queries: { findFolderByUuid: async () => makeFolder({ user_id: 999 }) } as any });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'New Name');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_FORBIDDEN');
        });

        it('renames the folder when owned by the caller', async () => {
            const renamed = makeFolder({ name: 'New Name' });
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder(),
                    findChildFolders: noSiblings,
                    renameFolder: async () => renamed,
                } as any,
            });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'New Name');

            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual(renamed);
        });

        it('maps a duplicate-name failure from the query to DUPLICATE_NAME', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder(),
                    findChildFolders: noSiblings,
                    renameFolder: async () => {
                        throw new Error('UNIQUE constraint failed');
                    },
                } as any,
            });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'Taken Name');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('DUPLICATE_NAME');
        });

        it('returns DUPLICATE_NAME when a sibling under the same parent already has this name', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ id: 1, parent_folder_id: 7 }),
                    findChildFolders: async () => [makeFolder({ id: 2, name: 'Taken' })],
                } as any,
            });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'Taken');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('DUPLICATE_NAME');
        });

        it('does not collide with itself when the name is unchanged', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ id: 1, name: 'Same Name' }),
                    findChildFolders: async () => [makeFolder({ id: 1, name: 'Same Name' })],
                    renameFolder: async () => makeFolder({ id: 1, name: 'Same Name' }),
                } as any,
            });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'Same Name');

            expect(result.success).toBe(true);
        });

        it('treats a race where the row vanished mid-update as FOLDER_NOT_FOUND', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder(),
                    findChildFolders: noSiblings,
                    renameFolder: async () => undefined,
                } as any,
            });

            const result = await renameFolder({} as any, 10, 'folder-uuid-1', 'New Name');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_NOT_FOUND');
        });
    });

    describe('moveFolder', () => {
        it('returns FOLDER_NOT_FOUND when the folder does not exist', async () => {
            configure({ queries: { findFolderByUuid: async () => undefined } as any });

            const result = await moveFolder({} as any, 10, 'missing', 'new-parent-uuid');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_NOT_FOUND');
        });

        it('returns FOLDER_FORBIDDEN when the folder belongs to another user', async () => {
            configure({ queries: { findFolderByUuid: async () => makeFolder({ user_id: 999 }) } as any });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', null);

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_FORBIDDEN');
        });

        it('returns PARENT_NOT_FOUND when the new parent does not exist', async () => {
            configure({
                queries: {
                    findFolderByUuid: async (_db: any, uuid: string) =>
                        uuid === 'folder-uuid-1' ? makeFolder({ id: 1, user_id: 10 }) : undefined,
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', 'missing-parent');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('PARENT_NOT_FOUND');
        });

        it('returns CYCLIC_PARENT when moving a folder into itself', async () => {
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ id: 1, uuid: 'folder-uuid-1', user_id: 10 }),
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', 'folder-uuid-1');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('CYCLIC_PARENT');
        });

        it('returns CYCLIC_PARENT when moving a folder into one of its own descendants', async () => {
            configure({
                queries: {
                    findFolderByUuid: async (_db: any, uuid: string) =>
                        uuid === 'folder-uuid-1'
                            ? makeFolder({ id: 1, uuid: 'folder-uuid-1', user_id: 10 })
                            : makeFolder({ id: 2, uuid: 'descendant-uuid', user_id: 10 }),
                    findDescendantFolderIds: async () => [2],
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', 'descendant-uuid');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('CYCLIC_PARENT');
        });

        it('returns MAX_DEPTH_EXCEEDED when the moved subtree would not fit at the new depth', async () => {
            configure({
                queries: {
                    findFolderByUuid: async (_db: any, uuid: string) =>
                        uuid === 'folder-uuid-1'
                            ? makeFolder({ id: 1, uuid: 'folder-uuid-1', user_id: 10 })
                            : makeFolder({ id: 2, uuid: 'new-parent-uuid', user_id: 10 }),
                    findDescendantFolderIds: async () => [],
                    findFolderDepth: async () => MAX_FOLDER_DEPTH - 1, // new parent already at the deepest level
                    findSubtreeHeight: async () => 0,
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', 'new-parent-uuid');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('MAX_DEPTH_EXCEEDED');
        });

        it('moves a folder to a new parent when everything checks out', async () => {
            let receivedNewParentId: number | null | undefined;
            configure({
                queries: {
                    findFolderByUuid: async (_db: any, uuid: string) =>
                        uuid === 'folder-uuid-1'
                            ? makeFolder({ id: 1, uuid: 'folder-uuid-1', user_id: 10 })
                            : makeFolder({ id: 2, uuid: 'new-parent-uuid', user_id: 10 }),
                    findDescendantFolderIds: async () => [],
                    findFolderDepth: async () => 0,
                    findSubtreeHeight: async () => 0,
                    findChildFolders: noSiblings,
                    updateFolderParent: async (_db: any, _folderId: number, newParentId: number | null) => {
                        receivedNewParentId = newParentId;
                        return makeFolder({ id: 1, parent_folder_id: newParentId });
                    },
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', 'new-parent-uuid');

            expect(result.success).toBe(true);
            expect(receivedNewParentId).toBe(2);
        });

        it('moves a folder back to top-level when newParentFolderUuid is null', async () => {
            let receivedNewParentId: number | null | undefined = -999;
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder({ id: 1, user_id: 10, parent_folder_id: 5 }),
                    findSubtreeHeight: async () => 0,
                    findChildFolders: noSiblings,
                    updateFolderParent: async (_db: any, _folderId: number, newParentId: number | null) => {
                        receivedNewParentId = newParentId;
                        return makeFolder({ id: 1, parent_folder_id: newParentId });
                    },
                } as any,
            });

            const result = await moveFolder({} as any, 10, 'folder-uuid-1', null);

            expect(result.success).toBe(true);
            expect(receivedNewParentId).toBeNull();
        });
    });

    describe('deleteFolder', () => {
        it('returns FOLDER_NOT_FOUND when the folder does not exist', async () => {
            configure({ queries: { findFolderByUuid: async () => undefined } as any });

            const result = await deleteFolder({} as any, 10, 'missing');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_NOT_FOUND');
        });

        it('returns FOLDER_FORBIDDEN when the folder belongs to another user', async () => {
            configure({ queries: { findFolderByUuid: async () => makeFolder({ user_id: 999 }) } as any });

            const result = await deleteFolder({} as any, 10, 'folder-uuid-1');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_FORBIDDEN');
        });

        it('deletes the folder when owned by the caller', async () => {
            let deletedId: number | null = null;
            configure({
                queries: {
                    findFolderByUuid: async () => makeFolder(),
                    deleteFolder: async (_db: any, folderId: number) => {
                        deletedId = folderId;
                    },
                } as any,
            });

            const result = await deleteFolder({} as any, 10, 'folder-uuid-1');

            expect(result.success).toBe(true);
            expect(deletedId).toBe(1);
        });
    });

    describe('assignProject', () => {
        it('returns PROJECT_NOT_FOUND when the project does not exist', async () => {
            configure({ projectQueries: { findProjectByUuid: async () => undefined } as any });

            const result = await assignProject({} as any, 10, 'missing-project', null);

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('PROJECT_NOT_FOUND');
        });

        it('returns PROJECT_ACCESS_DENIED when the user has no access to the project', async () => {
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject({ owner_id: 999 }),
                    hasAccess: async () => false,
                } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', null);

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('PROJECT_ACCESS_DENIED');
        });

        it('unfiles a project when folderUuid is null', async () => {
            let receivedFolderId: number | null | undefined;
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject(),
                    hasAccess: async () => true,
                } as any,
                queries: {
                    assignProjectToFolder: async (
                        _db: any,
                        _projectId: number,
                        _userId: number,
                        folderId: number | null,
                    ) => {
                        receivedFolderId = folderId;
                    },
                } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', null);

            expect(result.success).toBe(true);
            expect(receivedFolderId).toBeNull();
        });

        it('returns FOLDER_NOT_FOUND when the target folder does not exist', async () => {
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject(),
                    hasAccess: async () => true,
                } as any,
                queries: { findFolderByUuid: async () => undefined } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', 'missing-folder');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_NOT_FOUND');
        });

        it('returns FOLDER_FORBIDDEN when the target folder belongs to another user', async () => {
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject(),
                    hasAccess: async () => true,
                } as any,
                queries: { findFolderByUuid: async () => makeFolder({ user_id: 999 }) } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', 'folder-uuid-1');

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('FOLDER_FORBIDDEN');
        });

        it('files a project into an owned folder (owner access)', async () => {
            let receivedFolderId: number | null | undefined;
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject({ owner_id: 10 }),
                    hasAccess: async () => true,
                } as any,
                queries: {
                    findFolderByUuid: async () => makeFolder({ user_id: 10 }),
                    assignProjectToFolder: async (
                        _db: any,
                        _projectId: number,
                        _userId: number,
                        folderId: number | null,
                    ) => {
                        receivedFolderId = folderId;
                    },
                } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', 'folder-uuid-1');

            expect(result.success).toBe(true);
            expect(receivedFolderId).toBe(1);
        });

        it('files a shared project into a collaborators own folder (non-owner access)', async () => {
            let receivedUserId: number | undefined;
            configure({
                projectQueries: {
                    findProjectByUuid: async () => makeProject({ owner_id: 999 }),
                    hasAccess: async () => true,
                } as any,
                queries: {
                    findFolderByUuid: async () => makeFolder({ user_id: 10 }),
                    assignProjectToFolder: async (_db: any, _projectId: number, userId: number) => {
                        receivedUserId = userId;
                    },
                } as any,
            });

            const result = await assignProject({} as any, 10, 'project-uuid-1', 'folder-uuid-1');

            expect(result.success).toBe(true);
            expect(receivedUserId).toBe(10);
        });
    });
});
