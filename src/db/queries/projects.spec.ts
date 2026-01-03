/**
 * Tests for Project Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database, Project, User } from '../types';
import {
    findProjectById,
    findProjectByUuid,
    findProjectByPlatformId,
    findProjectWithOwner,
    findProjectByUuidWithOwner,
    getProjectCollaborators,
    addCollaborator,
    removeCollaborator,
    isCollaborator,
    findProjectsByOwner,
    findProjectsAsCollaborator,
    findAllProjectsForUser,
    findSavedProjectsForUser,
    createProject,
    updateProject,
    updateProjectByUuid,
    markProjectAsSaved,
    updateLastAccessed,
    softDeleteProject,
    hardDeleteProject,
    hasAccess,
    checkProjectAccess,
    findSavedProjectsByOwner,
    createProjectWithUuid,
    transferOwnership,
    transferOwnershipByUuid,
    updateProjectVisibility,
    updateProjectVisibilityByUuid,
} from './projects';
import { createUser } from './users';

describe('Project Queries', () => {
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
        // Create test user for foreign key requirements
        testUser = await createUser(db, {
            email: 'test@example.com',
            user_id: 'test-user',
            password: 'hashed',
        });
    });

    // ============================================================================
    // CREATE QUERIES
    // ============================================================================

    describe('createProject', () => {
        it('should create a project with required fields', async () => {
            const project = await createProject(db, {
                title: 'My Project',
                owner_id: testUser.id,
            });

            expect(project.id).toBeDefined();
            expect(project.uuid).toBeDefined();
            expect(project.uuid.length).toBe(36);
            expect(project.title).toBe('My Project');
            expect(project.owner_id).toBe(testUser.id);
            expect(project.status).toBe('active');
            expect(project.visibility).toBe('private');
            expect(project.saved_once).toBe(0);
        });

        it('should create a project with optional fields', async () => {
            const project = await createProject(db, {
                title: 'Full Project',
                description: 'A complete project',
                owner_id: testUser.id,
                language: 'es',
                author: 'John Doe',
                license: 'CC-BY-4.0',
            });

            expect(project.description).toBe('A complete project');
            expect(project.language).toBe('es');
            expect(project.author).toBe('John Doe');
            expect(project.license).toBe('CC-BY-4.0');
        });

        it('should generate unique UUIDs', async () => {
            const project1 = await createProject(db, { title: 'P1', owner_id: testUser.id });
            const project2 = await createProject(db, { title: 'P2', owner_id: testUser.id });

            expect(project1.uuid).not.toBe(project2.uuid);
        });
    });

    describe('createProjectWithUuid', () => {
        it('should create a project with specified UUID', async () => {
            const customUuid = 'custom-uuid-12345';
            const project = await createProjectWithUuid(db, customUuid, {
                title: 'Custom UUID Project',
                owner_id: testUser.id,
            });

            expect(project.uuid).toBe(customUuid);
        });

        it('should enforce unique UUID constraint', async () => {
            const uuid = 'duplicate-uuid';
            await createProjectWithUuid(db, uuid, { title: 'First', owner_id: testUser.id });

            await expect(createProjectWithUuid(db, uuid, { title: 'Second', owner_id: testUser.id })).rejects.toThrow();
        });
    });

    // ============================================================================
    // READ QUERIES
    // ============================================================================

    describe('findProjectById', () => {
        it('should find existing project by ID', async () => {
            const created = await createProject(db, {
                title: 'Find Me',
                owner_id: testUser.id,
            });

            const found = await findProjectById(db, created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.title).toBe('Find Me');
        });

        it('should return undefined for non-existent ID', async () => {
            const found = await findProjectById(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findProjectByUuid', () => {
        it('should find existing project by UUID', async () => {
            const uuid = 'find-by-uuid-test';
            await createProjectWithUuid(db, uuid, {
                title: 'UUID Project',
                owner_id: testUser.id,
            });

            const found = await findProjectByUuid(db, uuid);

            expect(found).toBeDefined();
            expect(found?.uuid).toBe(uuid);
        });

        it('should return undefined for non-existent UUID', async () => {
            const found = await findProjectByUuid(db, 'nonexistent-uuid');
            expect(found).toBeUndefined();
        });
    });

    describe('findProjectByPlatformId', () => {
        it('should find existing project by platform_id', async () => {
            const uuid = 'platform-id-test';
            const platformId = 'moodle-cmid-12345';

            await createProjectWithUuid(db, uuid, {
                title: 'Platform Project',
                owner_id: testUser.id,
            });

            // Update project with platform_id
            await updateProjectByUuid(db, uuid, { platform_id: platformId });

            const found = await findProjectByPlatformId(db, platformId);

            expect(found).toBeDefined();
            expect(found?.uuid).toBe(uuid);
            expect(found?.platform_id).toBe(platformId);
        });

        it('should return undefined for non-existent platform_id', async () => {
            const found = await findProjectByPlatformId(db, 'nonexistent-platform-id');
            expect(found).toBeUndefined();
        });

        it('should return undefined when platform_id is null', async () => {
            const uuid = 'null-platform-id-test';
            await createProjectWithUuid(db, uuid, {
                title: 'No Platform Project',
                owner_id: testUser.id,
            });

            // Project has null platform_id by default
            const found = await findProjectByPlatformId(db, 'any-id');
            expect(found).toBeUndefined();
        });
    });

    describe('findProjectWithOwner', () => {
        it('should find project with owner data', async () => {
            const project = await createProject(db, {
                title: 'With Owner',
                owner_id: testUser.id,
            });

            const found = await findProjectWithOwner(db, project.id);

            expect(found).toBeDefined();
            expect(found?.owner).toBeDefined();
            expect(found?.owner.email).toBe(testUser.email);
            expect(found?.owner.id).toBe(testUser.id);
        });

        it('should return undefined for non-existent project', async () => {
            const found = await findProjectWithOwner(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findProjectByUuidWithOwner', () => {
        it('should find project by UUID with owner data', async () => {
            const uuid = 'with-owner-uuid';
            await createProjectWithUuid(db, uuid, {
                title: 'UUID With Owner',
                owner_id: testUser.id,
            });

            const found = await findProjectByUuidWithOwner(db, uuid);

            expect(found).toBeDefined();
            expect(found?.uuid).toBe(uuid);
            expect(found?.owner.email).toBe(testUser.email);
        });
    });

    // ============================================================================
    // UPDATE QUERIES
    // ============================================================================

    describe('updateProject', () => {
        it('should update project fields', async () => {
            const project = await createProject(db, {
                title: 'Original Title',
                owner_id: testUser.id,
            });

            const updated = await updateProject(db, project.id, {
                title: 'Updated Title',
                description: 'Added description',
            });

            expect(updated?.title).toBe('Updated Title');
            expect(updated?.description).toBe('Added description');
        });

        it('should update updated_at timestamp', async () => {
            const project = await createProject(db, {
                title: 'Timestamp Test',
                owner_id: testUser.id,
            });

            const originalUpdatedAt = project.updated_at;
            await new Promise(r => setTimeout(r, 10));

            const updated = await updateProject(db, project.id, { title: 'New Title' });

            expect(updated?.updated_at).not.toBe(originalUpdatedAt);
        });

        it('should return undefined for non-existent project', async () => {
            const result = await updateProject(db, 99999, { title: 'Test' });
            expect(result).toBeUndefined();
        });
    });

    describe('updateProjectByUuid', () => {
        it('should update project by UUID', async () => {
            const uuid = 'update-by-uuid';
            await createProjectWithUuid(db, uuid, { title: 'Original', owner_id: testUser.id });

            const updated = await updateProjectByUuid(db, uuid, { title: 'Updated' });

            expect(updated?.title).toBe('Updated');
        });
    });

    describe('markProjectAsSaved', () => {
        it('should set saved_once to 1', async () => {
            const project = await createProject(db, {
                title: 'Save Test',
                owner_id: testUser.id,
            });

            expect(project.saved_once).toBe(0);

            await markProjectAsSaved(db, project.id);

            const found = await findProjectById(db, project.id);
            expect(found?.saved_once).toBe(1);
        });
    });

    describe('updateLastAccessed', () => {
        it('should update last_accessed_at', async () => {
            const project = await createProject(db, {
                title: 'Access Test',
                owner_id: testUser.id,
            });

            await updateLastAccessed(db, project.id);

            const found = await findProjectById(db, project.id);
            expect(found?.last_accessed_at).toBeDefined();
        });
    });

    describe('updateProjectVisibility', () => {
        it('should update visibility', async () => {
            const project = await createProject(db, {
                title: 'Visibility Test',
                owner_id: testUser.id,
            });

            expect(project.visibility).toBe('private');

            await updateProjectVisibility(db, project.id, 'public');

            const found = await findProjectById(db, project.id);
            expect(found?.visibility).toBe('public');
        });
    });

    describe('transferOwnership', () => {
        it('should transfer project to new owner who is a collaborator', async () => {
            const newOwner = await createUser(db, {
                email: 'newowner@example.com',
                user_id: 'new-owner',
                password: 'h',
            });

            const project = await createProject(db, {
                title: 'Transfer Test',
                owner_id: testUser.id,
            });

            // Add new owner as collaborator first (required)
            await addCollaborator(db, project.id, newOwner.id);

            const result = await transferOwnership(db, project.id, newOwner.id);

            expect(result.success).toBe(true);
            expect(result.previousOwnerId).toBe(testUser.id);
            expect(result.newOwnerId).toBe(newOwner.id);

            const found = await findProjectById(db, project.id);
            expect(found?.owner_id).toBe(newOwner.id);
        });

        it('should add previous owner as collaborator after transfer', async () => {
            const newOwner = await createUser(db, {
                email: 'newowner@example.com',
                user_id: 'new-owner',
                password: 'h',
            });

            const project = await createProject(db, {
                title: 'Transfer Test',
                owner_id: testUser.id,
            });

            await addCollaborator(db, project.id, newOwner.id);
            await transferOwnership(db, project.id, newOwner.id);

            // Verify previous owner is now a collaborator
            const isPrevOwnerCollab = await isCollaborator(db, project.id, testUser.id);
            expect(isPrevOwnerCollab).toBe(true);
        });

        it('should remove new owner from collaborators after transfer', async () => {
            const newOwner = await createUser(db, {
                email: 'newowner@example.com',
                user_id: 'new-owner',
                password: 'h',
            });

            const project = await createProject(db, {
                title: 'Transfer Test',
                owner_id: testUser.id,
            });

            await addCollaborator(db, project.id, newOwner.id);

            // Verify new owner is collaborator before transfer
            expect(await isCollaborator(db, project.id, newOwner.id)).toBe(true);

            await transferOwnership(db, project.id, newOwner.id);

            // Verify new owner is NOT a collaborator anymore (they are now owner)
            const isNewOwnerCollab = await isCollaborator(db, project.id, newOwner.id);
            expect(isNewOwnerCollab).toBe(false);
        });

        it('should throw error if new owner is not a collaborator', async () => {
            const newOwner = await createUser(db, {
                email: 'notcollab@example.com',
                user_id: 'not-collab',
                password: 'h',
            });

            const project = await createProject(db, {
                title: 'Transfer Test',
                owner_id: testUser.id,
            });

            // Do NOT add newOwner as collaborator
            await expect(transferOwnership(db, project.id, newOwner.id)).rejects.toThrow(
                'New owner must be a current collaborator',
            );
        });

        it('should throw error if transferring to self', async () => {
            const project = await createProject(db, {
                title: 'Self Transfer Test',
                owner_id: testUser.id,
            });

            await expect(transferOwnership(db, project.id, testUser.id)).rejects.toThrow(
                'Cannot transfer ownership to current owner',
            );
        });

        it('should throw error if project not found', async () => {
            await expect(transferOwnership(db, 99999, 1)).rejects.toThrow('Project not found');
        });

        it('should preserve other collaborators after transfer', async () => {
            const newOwner = await createUser(db, {
                email: 'newowner@example.com',
                user_id: 'new-owner',
                password: 'h',
            });
            const otherCollab = await createUser(db, {
                email: 'other@example.com',
                user_id: 'other-collab',
                password: 'h',
            });

            const project = await createProject(db, {
                title: 'Multi Collab Test',
                owner_id: testUser.id,
            });

            // Add collaborators
            await addCollaborator(db, project.id, newOwner.id);
            await addCollaborator(db, project.id, otherCollab.id);

            // Transfer to newOwner
            await transferOwnership(db, project.id, newOwner.id);

            // Verify other collaborator is still there
            const isOtherCollab = await isCollaborator(db, project.id, otherCollab.id);
            expect(isOtherCollab).toBe(true);

            // Verify all collaborators (should be: testUser + otherCollab)
            const collaborators = await getProjectCollaborators(db, project.id);
            expect(collaborators.length).toBe(2);
            expect(collaborators.some(c => c.id === testUser.id)).toBe(true);
            expect(collaborators.some(c => c.id === otherCollab.id)).toBe(true);
        });
    });

    // ============================================================================
    // DELETE QUERIES
    // ============================================================================

    describe('softDeleteProject', () => {
        it('should set status to inactive', async () => {
            const project = await createProject(db, {
                title: 'Delete Me',
                owner_id: testUser.id,
            });

            await softDeleteProject(db, project.id);

            const found = await findProjectById(db, project.id);
            expect(found?.status).toBe('inactive');
        });
    });

    describe('hardDeleteProject', () => {
        it('should completely remove project', async () => {
            const project = await createProject(db, {
                title: 'Hard Delete',
                owner_id: testUser.id,
            });

            await hardDeleteProject(db, project.id);

            const found = await findProjectById(db, project.id);
            expect(found).toBeUndefined();
        });
    });

    // ============================================================================
    // PROJECT LISTS
    // ============================================================================

    describe('findProjectsByOwner', () => {
        it('should return empty array when no projects', async () => {
            const projects = await findProjectsByOwner(db, testUser.id);
            expect(projects).toEqual([]);
        });

        it('should return only active/archived projects for owner', async () => {
            await createProject(db, { title: 'Active 1', owner_id: testUser.id });
            await createProject(db, { title: 'Active 2', owner_id: testUser.id });
            const inactive = await createProject(db, { title: 'Inactive', owner_id: testUser.id });
            await softDeleteProject(db, inactive.id);

            const projects = await findProjectsByOwner(db, testUser.id);

            expect(projects.length).toBe(2);
            expect(projects.every(p => p.status !== 'inactive')).toBe(true);
        });

        it('should not return other users projects', async () => {
            const otherUser = await createUser(db, {
                email: 'other@example.com',
                user_id: 'other',
                password: 'h',
            });
            await createProject(db, { title: 'My Project', owner_id: testUser.id });
            await createProject(db, { title: 'Other Project', owner_id: otherUser.id });

            const myProjects = await findProjectsByOwner(db, testUser.id);

            expect(myProjects.length).toBe(1);
            expect(myProjects[0].title).toBe('My Project');
        });
    });

    describe('findSavedProjectsByOwner', () => {
        it('should return only saved projects', async () => {
            const saved = await createProject(db, { title: 'Saved', owner_id: testUser.id });
            await createProject(db, { title: 'Not Saved', owner_id: testUser.id });
            await markProjectAsSaved(db, saved.id);

            const projects = await findSavedProjectsByOwner(db, testUser.id);

            expect(projects.length).toBe(1);
            expect(projects[0].title).toBe('Saved');
        });
    });

    describe('findProjectsAsCollaborator', () => {
        it('should return projects where user is collaborator', async () => {
            const owner = await createUser(db, {
                email: 'owner@example.com',
                user_id: 'owner',
                password: 'h',
            });
            const project = await createProject(db, { title: 'Collab Project', owner_id: owner.id });
            await addCollaborator(db, project.id, testUser.id);

            const projects = await findProjectsAsCollaborator(db, testUser.id);

            expect(projects.length).toBe(1);
            expect(projects[0].title).toBe('Collab Project');
        });
    });

    describe('findAllProjectsForUser', () => {
        it('should return owned and collaborating projects', async () => {
            // Owned project
            await createProject(db, { title: 'Owned', owner_id: testUser.id });

            // Collaborating project
            const owner = await createUser(db, {
                email: 'owner2@example.com',
                user_id: 'owner2',
                password: 'h',
            });
            const collabProject = await createProject(db, { title: 'Collab', owner_id: owner.id });
            await addCollaborator(db, collabProject.id, testUser.id);

            const projects = await findAllProjectsForUser(db, testUser.id);

            expect(projects.length).toBe(2);
            expect(projects.map(p => p.title).sort()).toEqual(['Collab', 'Owned']);
        });
    });

    // ============================================================================
    // COLLABORATORS
    // ============================================================================

    describe('Collaborators', () => {
        let project: Project;
        let collaborator: User;

        beforeEach(async () => {
            project = await createProject(db, { title: 'Collab Project', owner_id: testUser.id });
            collaborator = await createUser(db, {
                email: 'collab@example.com',
                user_id: 'collab',
                password: 'h',
            });
        });

        describe('addCollaborator', () => {
            it('should add a collaborator to a project', async () => {
                await addCollaborator(db, project.id, collaborator.id);

                const isCollab = await isCollaborator(db, project.id, collaborator.id);
                expect(isCollab).toBe(true);
            });

            it('should not fail when adding same collaborator twice', async () => {
                await addCollaborator(db, project.id, collaborator.id);
                await addCollaborator(db, project.id, collaborator.id);

                const collaborators = await getProjectCollaborators(db, project.id);
                expect(collaborators.length).toBe(1);
            });
        });

        describe('removeCollaborator', () => {
            it('should remove a collaborator', async () => {
                await addCollaborator(db, project.id, collaborator.id);
                await removeCollaborator(db, project.id, collaborator.id);

                const isCollab = await isCollaborator(db, project.id, collaborator.id);
                expect(isCollab).toBe(false);
            });

            it('should not fail when removing non-collaborator', async () => {
                await removeCollaborator(db, project.id, collaborator.id);
            });
        });

        describe('isCollaborator', () => {
            it('should return true for collaborator', async () => {
                await addCollaborator(db, project.id, collaborator.id);
                expect(await isCollaborator(db, project.id, collaborator.id)).toBe(true);
            });

            it('should return false for non-collaborator', async () => {
                expect(await isCollaborator(db, project.id, collaborator.id)).toBe(false);
            });

            it('should return false for owner (not a collaborator)', async () => {
                expect(await isCollaborator(db, project.id, testUser.id)).toBe(false);
            });
        });

        describe('getProjectCollaborators', () => {
            it('should return empty array when no collaborators', async () => {
                const collaborators = await getProjectCollaborators(db, project.id);
                expect(collaborators).toEqual([]);
            });

            it('should return all collaborators', async () => {
                const collab2 = await createUser(db, {
                    email: 'collab2@example.com',
                    user_id: 'collab2',
                    password: 'h',
                });
                await addCollaborator(db, project.id, collaborator.id);
                await addCollaborator(db, project.id, collab2.id);

                const collaborators = await getProjectCollaborators(db, project.id);

                expect(collaborators.length).toBe(2);
            });
        });
    });

    // ============================================================================
    // ACCESS CONTROL
    // ============================================================================

    describe('Access Control', () => {
        describe('hasAccess', () => {
            it('should return true for owner', async () => {
                const project = await createProject(db, { title: 'Access Test', owner_id: testUser.id });

                expect(await hasAccess(db, project.id, testUser.id)).toBe(true);
            });

            it('should return true for collaborator', async () => {
                const project = await createProject(db, { title: 'Collab Access', owner_id: testUser.id });
                const collaborator = await createUser(db, {
                    email: 'access@example.com',
                    user_id: 'access-user',
                    password: 'h',
                });
                await addCollaborator(db, project.id, collaborator.id);

                expect(await hasAccess(db, project.id, collaborator.id)).toBe(true);
            });

            it('should return false for non-owner non-collaborator', async () => {
                const project = await createProject(db, { title: 'No Access', owner_id: testUser.id });
                const stranger = await createUser(db, {
                    email: 'stranger@example.com',
                    user_id: 'stranger',
                    password: 'h',
                });

                expect(await hasAccess(db, project.id, stranger.id)).toBe(false);
            });

            it('should return false for non-existent project', async () => {
                expect(await hasAccess(db, 99999, testUser.id)).toBe(false);
            });
        });

        describe('checkProjectAccess', () => {
            it('should return hasAccess=false for undefined project', async () => {
                const result = await checkProjectAccess(db, undefined, testUser.id);
                expect(result.hasAccess).toBe(false);
                expect(result.reason).toBe('PROJECT_NOT_FOUND');
            });

            it('should return hasAccess=false for inactive project', async () => {
                const project = await createProject(db, { title: 'Inactive', owner_id: testUser.id });
                await softDeleteProject(db, project.id);
                const inactiveProject = await findProjectById(db, project.id);

                const result = await checkProjectAccess(db, inactiveProject, testUser.id);
                expect(result.hasAccess).toBe(false);
                expect(result.reason).toBe('PROJECT_INACTIVE');
            });

            it('should return hasAccess=true for public project without user', async () => {
                const project = await createProject(db, { title: 'Public', owner_id: testUser.id });
                await updateProjectVisibility(db, project.id, 'public');
                const publicProject = await findProjectById(db, project.id);

                const result = await checkProjectAccess(db, publicProject);
                expect(result.hasAccess).toBe(true);
            });

            it('should return hasAccess=false for private project without user', async () => {
                const project = await createProject(db, { title: 'Private', owner_id: testUser.id });

                const result = await checkProjectAccess(db, project);
                expect(result.hasAccess).toBe(false);
                expect(result.reason).toBe('AUTHENTICATION_REQUIRED');
            });

            it('should return hasAccess=true for owner', async () => {
                const project = await createProject(db, { title: 'Owner Access', owner_id: testUser.id });

                const result = await checkProjectAccess(db, project, testUser.id);
                expect(result.hasAccess).toBe(true);
            });

            it('should return hasAccess=true for collaborator', async () => {
                const project = await createProject(db, { title: 'Collab Access', owner_id: testUser.id });
                const collaborator = await createUser(db, {
                    email: 'check@example.com',
                    user_id: 'check',
                    password: 'h',
                });
                await addCollaborator(db, project.id, collaborator.id);

                const result = await checkProjectAccess(db, project, collaborator.id);
                expect(result.hasAccess).toBe(true);
            });

            it('should return hasAccess=false for stranger', async () => {
                const project = await createProject(db, { title: 'No Access', owner_id: testUser.id });
                const stranger = await createUser(db, {
                    email: 'noaccess@example.com',
                    user_id: 'noaccess',
                    password: 'h',
                });

                const result = await checkProjectAccess(db, project, stranger.id);
                expect(result.hasAccess).toBe(false);
                expect(result.reason).toBe('ACCESS_DENIED');
            });
        });
    });

    // ============================================================================
    // ADDITIONAL QUERIES - Coverage for missing functions
    // ============================================================================

    describe('findSavedProjectsForUser', () => {
        it('should return only saved projects for owner', async () => {
            const saved = await createProject(db, { title: 'Saved Project', owner_id: testUser.id });
            await markProjectAsSaved(db, saved.id);
            await createProject(db, { title: 'Not Saved', owner_id: testUser.id });

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects.length).toBe(1);
            expect(projects[0].title).toBe('Saved Project');
            expect(projects[0].saved_once).toBe(1);
        });

        it('should include collaborating saved projects', async () => {
            const owner = await createUser(db, {
                email: 'savedowner@example.com',
                user_id: 'saved-owner',
                password: 'h',
            });
            const collabProject = await createProject(db, { title: 'Collab Saved', owner_id: owner.id });
            await markProjectAsSaved(db, collabProject.id);
            await addCollaborator(db, collabProject.id, testUser.id);

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects.some(p => p.title === 'Collab Saved')).toBe(true);
        });

        it('should return empty array when no saved projects', async () => {
            await createProject(db, { title: 'Not Saved', owner_id: testUser.id });

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects).toEqual([]);
        });

        it('should not include inactive saved projects', async () => {
            const saved = await createProject(db, { title: 'Inactive Saved', owner_id: testUser.id });
            await markProjectAsSaved(db, saved.id);
            await softDeleteProject(db, saved.id);

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects.length).toBe(0);
        });

        it('should deduplicate when user is both owner and collaborator', async () => {
            // This edge case: user owns project AND is added as collaborator
            const project = await createProject(db, { title: 'Owner And Collab', owner_id: testUser.id });
            await markProjectAsSaved(db, project.id);
            // Note: addCollaborator uses onConflict doNothing, so this won't duplicate

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects.length).toBe(1);
        });

        it('should sort by updated_at DESC', async () => {
            const older = await createProject(db, { title: 'Older', owner_id: testUser.id });
            await markProjectAsSaved(db, older.id);

            await new Promise(r => setTimeout(r, 10));

            const newer = await createProject(db, { title: 'Newer', owner_id: testUser.id });
            await markProjectAsSaved(db, newer.id);

            const projects = await findSavedProjectsForUser(db, testUser.id);

            expect(projects.length).toBe(2);
            expect(projects[0].title).toBe('Newer');
            expect(projects[1].title).toBe('Older');
        });
    });

    describe('transferOwnershipByUuid', () => {
        it('should transfer project to new owner by UUID', async () => {
            const uuid = 'transfer-by-uuid-test';
            const project = await createProjectWithUuid(db, uuid, {
                title: 'Transfer UUID Test',
                owner_id: testUser.id,
            });

            const newOwner = await createUser(db, {
                email: 'newowner-uuid@example.com',
                user_id: 'new-owner-uuid',
                password: 'h',
            });

            // Add new owner as collaborator first (required)
            await addCollaborator(db, project.id, newOwner.id);

            const result = await transferOwnershipByUuid(db, uuid, newOwner.id);

            expect(result.success).toBe(true);
            expect(result.previousOwnerId).toBe(testUser.id);
            expect(result.newOwnerId).toBe(newOwner.id);

            const found = await findProjectByUuid(db, uuid);
            expect(found?.owner_id).toBe(newOwner.id);
        });

        it('should update updated_at timestamp', async () => {
            const uuid = 'transfer-uuid-timestamp';
            const project = await createProjectWithUuid(db, uuid, {
                title: 'Timestamp Test',
                owner_id: testUser.id,
            });
            const originalUpdatedAt = project.updated_at;

            await new Promise(r => setTimeout(r, 10));

            const newOwner = await createUser(db, {
                email: 'timestamp-owner@example.com',
                user_id: 'timestamp-owner',
                password: 'h',
            });

            // Add new owner as collaborator first (required)
            await addCollaborator(db, project.id, newOwner.id);

            await transferOwnershipByUuid(db, uuid, newOwner.id);

            const found = await findProjectByUuid(db, uuid);
            expect(found?.updated_at).not.toBe(originalUpdatedAt);
        });

        it('should throw error if project UUID not found', async () => {
            await expect(transferOwnershipByUuid(db, 'nonexistent-uuid', 1)).rejects.toThrow('Project not found');
        });

        it('should add previous owner as collaborator after transfer by UUID', async () => {
            const uuid = 'transfer-uuid-collab';
            const project = await createProjectWithUuid(db, uuid, {
                title: 'Transfer Collab Test',
                owner_id: testUser.id,
            });

            const newOwner = await createUser(db, {
                email: 'newowner-collab@example.com',
                user_id: 'new-owner-collab',
                password: 'h',
            });

            await addCollaborator(db, project.id, newOwner.id);
            await transferOwnershipByUuid(db, uuid, newOwner.id);

            // Verify previous owner is now a collaborator
            const isPrevOwnerCollab = await isCollaborator(db, project.id, testUser.id);
            expect(isPrevOwnerCollab).toBe(true);

            // Verify new owner is NOT a collaborator (they are now owner)
            const isNewOwnerCollab = await isCollaborator(db, project.id, newOwner.id);
            expect(isNewOwnerCollab).toBe(false);
        });
    });

    describe('updateProjectVisibilityByUuid', () => {
        it('should update visibility by UUID', async () => {
            const uuid = 'visibility-uuid-test';
            await createProjectWithUuid(db, uuid, {
                title: 'Visibility UUID Test',
                owner_id: testUser.id,
            });

            await updateProjectVisibilityByUuid(db, uuid, 'public');

            const found = await findProjectByUuid(db, uuid);
            expect(found?.visibility).toBe('public');
        });

        it('should change from public to private', async () => {
            const uuid = 'vis-toggle-uuid';
            await createProjectWithUuid(db, uuid, {
                title: 'Toggle Visibility',
                owner_id: testUser.id,
            });
            await updateProjectVisibilityByUuid(db, uuid, 'public');

            await updateProjectVisibilityByUuid(db, uuid, 'private');

            const found = await findProjectByUuid(db, uuid);
            expect(found?.visibility).toBe('private');
        });

        it('should update updated_at timestamp', async () => {
            const uuid = 'vis-timestamp-uuid';
            const project = await createProjectWithUuid(db, uuid, {
                title: 'Vis Timestamp',
                owner_id: testUser.id,
            });
            const originalUpdatedAt = project.updated_at;

            await new Promise(r => setTimeout(r, 10));
            await updateProjectVisibilityByUuid(db, uuid, 'public');

            const found = await findProjectByUuid(db, uuid);
            expect(found?.updated_at).not.toBe(originalUpdatedAt);
        });
    });
});
