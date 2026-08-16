/**
 * Tests for Project Folder Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database, User } from '../types';
import { createUser } from './users';
import { createProject } from './projects';
import {
    findFoldersForUser,
    findChildFolders,
    findFoldersWithCountsForUser,
    findFolderById,
    findFolderByUuid,
    findFolderDepth,
    findDescendantFolderIds,
    findSubtreeHeight,
    countProjectsInFolder,
    findFolderAssignmentsForUser,
    createFolder,
    renameFolder,
    updateFolderParent,
    deleteFolder,
    assignProjectToFolder,
    removeFolderAssignmentsForProject,
    removeFolderAssignmentForUserAndProject,
} from './project-folders';

describe('Project Folder Queries', () => {
    let db: Kysely<Database>;
    let testUser: User;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        testUser = await createUser(db, {
            email: 'folders@example.com',
            user_id: 'folders-user',
            password: 'hashed',
        });
    });

    describe('createFolder', () => {
        it('should create a folder with a generated uuid', async () => {
            const folder = await createFolder(db, testUser.id, 'Math 101');

            expect(folder.id).toBeDefined();
            expect(folder.uuid).toBeDefined();
            expect(folder.name).toBe('Math 101');
            expect(folder.user_id).toBe(testUser.id);
        });

        it('does not reject a duplicate folder name at the DB level (enforced by the service instead)', async () => {
            await createFolder(db, testUser.id, 'Duplicate');
            await expect(createFolder(db, testUser.id, 'Duplicate')).resolves.toBeDefined();
        });

        it('should allow the same folder name for different users', async () => {
            const otherUser = await createUser(db, {
                email: 'other-folders@example.com',
                user_id: 'other-folders',
                password: 'h',
            });
            await createFolder(db, testUser.id, 'Shared Name');
            const folder = await createFolder(db, otherUser.id, 'Shared Name');
            expect(folder.name).toBe('Shared Name');
        });

        it('should create a folder under a parent when parentFolderId is given', async () => {
            const parent = await createFolder(db, testUser.id, 'Parent');
            const child = await createFolder(db, testUser.id, 'Child', parent.id);

            expect(child.parent_folder_id).toBe(parent.id);
        });

        it('should default parent_folder_id to null', async () => {
            const folder = await createFolder(db, testUser.id, 'Top Level');
            expect(folder.parent_folder_id).toBeNull();
        });
    });

    describe('findChildFolders', () => {
        it('should return only the immediate children of a folder', async () => {
            const parent = await createFolder(db, testUser.id, 'Parent');
            const child = await createFolder(db, testUser.id, 'Child', parent.id);
            await createFolder(db, testUser.id, 'Grandchild', child.id);
            await createFolder(db, testUser.id, 'Other Root');

            const children = await findChildFolders(db, testUser.id, parent.id);

            expect(children.map(f => f.name)).toEqual(['Child']);
        });

        it('should return top-level folders when parentFolderId is null', async () => {
            const parent = await createFolder(db, testUser.id, 'Parent');
            await createFolder(db, testUser.id, 'Child', parent.id);
            await createFolder(db, testUser.id, 'Another Root');

            const roots = await findChildFolders(db, testUser.id, null);

            expect(roots.map(f => f.name).sort()).toEqual(['Another Root', 'Parent']);
        });
    });

    describe('findFolderDepth', () => {
        it('should return 0 for a top-level folder', async () => {
            const folder = await createFolder(db, testUser.id, 'Root');
            expect(await findFolderDepth(db, folder.id)).toBe(0);
        });

        it('should return the correct depth for nested folders', async () => {
            const root = await createFolder(db, testUser.id, 'Root');
            const child = await createFolder(db, testUser.id, 'Child', root.id);
            const grandchild = await createFolder(db, testUser.id, 'Grandchild', child.id);

            expect(await findFolderDepth(db, child.id)).toBe(1);
            expect(await findFolderDepth(db, grandchild.id)).toBe(2);
        });
    });

    describe('findDescendantFolderIds', () => {
        it('should return all descendants across multiple levels', async () => {
            const root = await createFolder(db, testUser.id, 'Root');
            const child = await createFolder(db, testUser.id, 'Child', root.id);
            const grandchild = await createFolder(db, testUser.id, 'Grandchild', child.id);
            await createFolder(db, testUser.id, 'Unrelated');

            const descendants = await findDescendantFolderIds(db, root.id);

            expect(descendants.sort()).toEqual([child.id, grandchild.id].sort());
        });

        it('should return an empty array for a leaf folder', async () => {
            const folder = await createFolder(db, testUser.id, 'Leaf');
            expect(await findDescendantFolderIds(db, folder.id)).toEqual([]);
        });
    });

    describe('findSubtreeHeight', () => {
        it('should return 0 for a leaf folder', async () => {
            const folder = await createFolder(db, testUser.id, 'Leaf');
            expect(await findSubtreeHeight(db, folder.id)).toBe(0);
        });

        it('should return the height of the deepest branch', async () => {
            const root = await createFolder(db, testUser.id, 'Root');
            const child = await createFolder(db, testUser.id, 'Child', root.id);
            await createFolder(db, testUser.id, 'Grandchild', child.id);

            expect(await findSubtreeHeight(db, root.id)).toBe(2);
            expect(await findSubtreeHeight(db, child.id)).toBe(1);
        });
    });

    describe('updateFolderParent', () => {
        it('should reparent a folder', async () => {
            const folderA = await createFolder(db, testUser.id, 'A');
            const folderB = await createFolder(db, testUser.id, 'B');

            const updated = await updateFolderParent(db, folderB.id, folderA.id);

            expect(updated?.parent_folder_id).toBe(folderA.id);
        });

        it('should move a folder back to top-level when newParentId is null', async () => {
            const parent = await createFolder(db, testUser.id, 'Parent');
            const child = await createFolder(db, testUser.id, 'Child', parent.id);

            const updated = await updateFolderParent(db, child.id, null);

            expect(updated?.parent_folder_id).toBeNull();
        });
    });

    describe('findFoldersForUser', () => {
        it('should return only the given users folders, sorted by name', async () => {
            const otherUser = await createUser(db, { email: 'other2@example.com', user_id: 'other2', password: 'h' });
            await createFolder(db, testUser.id, 'Zeta');
            await createFolder(db, testUser.id, 'Alpha');
            await createFolder(db, otherUser.id, 'Not Mine');

            const folders = await findFoldersForUser(db, testUser.id);

            expect(folders.map(f => f.name)).toEqual(['Alpha', 'Zeta']);
        });
    });

    describe('findFoldersWithCountsForUser', () => {
        it('should include a project count per folder', async () => {
            const folder = await createFolder(db, testUser.id, 'Counted');
            const emptyFolder = await createFolder(db, testUser.id, 'Empty');
            const project1 = await createProject(db, { title: 'P1', owner_id: testUser.id });
            const project2 = await createProject(db, { title: 'P2', owner_id: testUser.id });
            await assignProjectToFolder(db, project1.id, testUser.id, folder.id);
            await assignProjectToFolder(db, project2.id, testUser.id, folder.id);

            const folders = await findFoldersWithCountsForUser(db, testUser.id);

            const counted = folders.find(f => f.uuid === folder.uuid);
            const empty = folders.find(f => f.uuid === emptyFolder.uuid);
            expect(counted?.projectCount).toBe(2);
            expect(empty?.projectCount).toBe(0);
        });

        it('should include the parentId of each folder', async () => {
            const parent = await createFolder(db, testUser.id, 'Parent');
            const child = await createFolder(db, testUser.id, 'Child', parent.id);

            const folders = await findFoldersWithCountsForUser(db, testUser.id);

            expect(folders.find(f => f.uuid === parent.uuid)?.parentId).toBeNull();
            expect(folders.find(f => f.uuid === child.uuid)?.parentId).toBe(parent.id);
        });
    });

    describe('findFolderById / findFolderByUuid', () => {
        it('should find a folder by id and by uuid', async () => {
            const folder = await createFolder(db, testUser.id, 'Findable');

            expect((await findFolderById(db, folder.id))?.uuid).toBe(folder.uuid);
            expect((await findFolderByUuid(db, folder.uuid))?.id).toBe(folder.id);
        });

        it('should return undefined for a missing folder', async () => {
            expect(await findFolderById(db, 999999)).toBeUndefined();
            expect(await findFolderByUuid(db, 'missing-uuid')).toBeUndefined();
        });
    });

    describe('renameFolder', () => {
        it('should update the folder name', async () => {
            const folder = await createFolder(db, testUser.id, 'Old Name');

            const updated = await renameFolder(db, folder.id, 'New Name');

            expect(updated?.name).toBe('New Name');
        });
    });

    describe('assignProjectToFolder', () => {
        it('should file a project into a folder', async () => {
            const folder = await createFolder(db, testUser.id, 'Destination');
            const project = await createProject(db, { title: 'To File', owner_id: testUser.id });

            await assignProjectToFolder(db, project.id, testUser.id, folder.id);

            const assignments = await findFolderAssignmentsForUser(db, testUser.id);
            expect(assignments.get(project.id)).toBe(folder.uuid);
        });

        it('should move a project by replacing the previous assignment, not duplicating it', async () => {
            const folderA = await createFolder(db, testUser.id, 'Folder A');
            const folderB = await createFolder(db, testUser.id, 'Folder B');
            const project = await createProject(db, { title: 'Movable', owner_id: testUser.id });

            await assignProjectToFolder(db, project.id, testUser.id, folderA.id);
            await assignProjectToFolder(db, project.id, testUser.id, folderB.id);

            const assignments = await findFolderAssignmentsForUser(db, testUser.id);
            expect(assignments.get(project.id)).toBe(folderB.uuid);
            expect(await countProjectsInFolder(db, folderA.id)).toBe(0);
            expect(await countProjectsInFolder(db, folderB.id)).toBe(1);
        });

        it('should unfile a project when folderId is null', async () => {
            const folder = await createFolder(db, testUser.id, 'Temp Folder');
            const project = await createProject(db, { title: 'Unfileable', owner_id: testUser.id });
            await assignProjectToFolder(db, project.id, testUser.id, folder.id);

            await assignProjectToFolder(db, project.id, testUser.id, null);

            const assignments = await findFolderAssignmentsForUser(db, testUser.id);
            expect(assignments.has(project.id)).toBe(false);
        });
    });

    describe('deleteFolder', () => {
        it('should delete the folder and unfile (not delete) its projects', async () => {
            const folder = await createFolder(db, testUser.id, 'Doomed Folder');
            const project = await createProject(db, { title: 'Survivor', owner_id: testUser.id });
            await assignProjectToFolder(db, project.id, testUser.id, folder.id);

            await deleteFolder(db, folder.id);

            expect(await findFolderById(db, folder.id)).toBeUndefined();
            const assignments = await findFolderAssignmentsForUser(db, testUser.id);
            expect(assignments.has(project.id)).toBe(false);
        });

        it('should cascade-delete descendant folders and unfile their projects too', async () => {
            const root = await createFolder(db, testUser.id, 'Root');
            const child = await createFolder(db, testUser.id, 'Child', root.id);
            const grandchild = await createFolder(db, testUser.id, 'Grandchild', child.id);
            const rootProject = await createProject(db, { title: 'In Root', owner_id: testUser.id });
            const grandchildProject = await createProject(db, { title: 'In Grandchild', owner_id: testUser.id });
            await assignProjectToFolder(db, rootProject.id, testUser.id, root.id);
            await assignProjectToFolder(db, grandchildProject.id, testUser.id, grandchild.id);

            await deleteFolder(db, root.id);

            expect(await findFolderById(db, root.id)).toBeUndefined();
            expect(await findFolderById(db, child.id)).toBeUndefined();
            expect(await findFolderById(db, grandchild.id)).toBeUndefined();

            const assignments = await findFolderAssignmentsForUser(db, testUser.id);
            expect(assignments.has(rootProject.id)).toBe(false);
            expect(assignments.has(grandchildProject.id)).toBe(false);
        });
    });

    describe('removeFolderAssignmentsForProject', () => {
        it('should remove every users assignment for a project', async () => {
            const otherUser = await createUser(db, {
                email: 'collab-folders@example.com',
                user_id: 'collab-folders',
                password: 'h',
            });
            const folderOwner = await createFolder(db, testUser.id, 'Owner Folder');
            const folderCollab = await createFolder(db, otherUser.id, 'Collab Folder');
            const project = await createProject(db, { title: 'Shared', owner_id: testUser.id });
            await assignProjectToFolder(db, project.id, testUser.id, folderOwner.id);
            await assignProjectToFolder(db, project.id, otherUser.id, folderCollab.id);

            await removeFolderAssignmentsForProject(db, project.id);

            expect((await findFolderAssignmentsForUser(db, testUser.id)).has(project.id)).toBe(false);
            expect((await findFolderAssignmentsForUser(db, otherUser.id)).has(project.id)).toBe(false);
        });
    });

    describe('removeFolderAssignmentForUserAndProject', () => {
        it('should remove only the given users assignment', async () => {
            const otherUser = await createUser(db, {
                email: 'collab-folders2@example.com',
                user_id: 'collab-folders2',
                password: 'h',
            });
            const folderOwner = await createFolder(db, testUser.id, 'Owner Folder 2');
            const folderCollab = await createFolder(db, otherUser.id, 'Collab Folder 2');
            const project = await createProject(db, { title: 'Shared 2', owner_id: testUser.id });
            await assignProjectToFolder(db, project.id, testUser.id, folderOwner.id);
            await assignProjectToFolder(db, project.id, otherUser.id, folderCollab.id);

            await removeFolderAssignmentForUserAndProject(db, project.id, otherUser.id);

            expect((await findFolderAssignmentsForUser(db, testUser.id)).has(project.id)).toBe(true);
            expect((await findFolderAssignmentsForUser(db, otherUser.id)).has(project.id)).toBe(false);
        });
    });
});
