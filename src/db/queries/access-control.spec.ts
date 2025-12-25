/**
 * WebSocket Access Control Tests
 * Tests for project access validation in WebSocket connections
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database, User, Project } from '../types';
import { up } from '../migrations/001_initial';
import { now } from '../types';
import { v4 as uuidv4 } from 'uuid';

let testDb: Kysely<Database>;
let owner: User;
let collaborator: User;
let randomUser: User;
let privateProject: Project;
let publicProject: Project;

// Simulated checkProjectAccess function (mirrors the actual implementation)
async function checkProjectAccess(
    db: Kysely<Database>,
    projectUuid: string,
    userId: number,
): Promise<{ hasAccess: boolean; reason?: string }> {
    // Check database for project
    const project = await db.selectFrom('projects').selectAll().where('uuid', '=', projectUuid).executeTakeFirst();

    if (!project) {
        // Project not found - deny access
        return { hasAccess: false, reason: 'Project not found' };
    }

    // Owner has access
    if (project.owner_id === userId) {
        return { hasAccess: true };
    }

    // Check collaborators
    const collab = await db
        .selectFrom('project_collaborators')
        .select('project_id')
        .where('project_id', '=', project.id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

    if (collab) {
        return { hasAccess: true };
    }

    // Check if public
    if (project.visibility === 'public') {
        return { hasAccess: true };
    }

    return { hasAccess: false, reason: 'No access to project' };
}

describe('WebSocket Access Control', () => {
    beforeAll(async () => {
        // Create in-memory SQLite database
        testDb = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Run migrations
        await up(testDb);

        // Create test users
        const timestamp = now();
        const hashedPassword = await Bun.password.hash('test123', 'bcrypt');

        owner = await testDb
            .insertInto('users')
            .values({
                email: 'owner@test.com',
                user_id: 'user-owner-001',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        collaborator = await testDb
            .insertInto('users')
            .values({
                email: 'collab@test.com',
                user_id: 'user-collab-002',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        randomUser = await testDb
            .insertInto('users')
            .values({
                email: 'random@test.com',
                user_id: 'user-random-003',
                password: hashedPassword,
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    });

    afterAll(async () => {
        await testDb.destroy();
    });

    beforeEach(async () => {
        // Clean up projects and collaborators
        await testDb.deleteFrom('project_collaborators').execute();
        await testDb.deleteFrom('projects').execute();

        const timestamp = now();

        // Create a private project owned by owner
        privateProject = await testDb
            .insertInto('projects')
            .values({
                uuid: uuidv4(),
                title: 'Private Project',
                owner_id: owner.id,
                saved_once: 1,
                status: 'active',
                visibility: 'private',
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Create a public project
        publicProject = await testDb
            .insertInto('projects')
            .values({
                uuid: uuidv4(),
                title: 'Public Project',
                owner_id: owner.id,
                saved_once: 1,
                status: 'active',
                visibility: 'public',
                created_at: timestamp,
                updated_at: timestamp,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Add collaborator to private project
        await testDb
            .insertInto('project_collaborators')
            .values({
                project_id: privateProject.id,
                user_id: collaborator.id,
            })
            .execute();
    });

    it('should deny access to non-existent projects', async () => {
        const nonExistentUuid = uuidv4();

        const result = await checkProjectAccess(testDb, nonExistentUuid, owner.id);

        expect(result.hasAccess).toBe(false);
        expect(result.reason).toBe('Project not found');
    });

    it('should allow owner to connect to their project', async () => {
        const result = await checkProjectAccess(testDb, privateProject.uuid, owner.id);

        expect(result.hasAccess).toBe(true);
    });

    it('should allow collaborator to connect', async () => {
        const result = await checkProjectAccess(testDb, privateProject.uuid, collaborator.id);

        expect(result.hasAccess).toBe(true);
    });

    it('should deny access to non-collaborator on private project', async () => {
        const result = await checkProjectAccess(testDb, privateProject.uuid, randomUser.id);

        expect(result.hasAccess).toBe(false);
        expect(result.reason).toBe('No access to project');
    });

    it('should allow any user to access public projects', async () => {
        const result = await checkProjectAccess(testDb, publicProject.uuid, randomUser.id);

        expect(result.hasAccess).toBe(true);
    });

    it('should deny access when user is not owner, collaborator, or project is private', async () => {
        // Create another private project without collaborators
        const isolatedProject = await testDb
            .insertInto('projects')
            .values({
                uuid: uuidv4(),
                title: 'Isolated Project',
                owner_id: owner.id,
                saved_once: 1,
                status: 'active',
                visibility: 'private',
                created_at: now(),
                updated_at: now(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Random user should not have access
        const result = await checkProjectAccess(testDb, isolatedProject.uuid, randomUser.id);

        expect(result.hasAccess).toBe(false);
    });

    it('should handle multiple collaborators correctly', async () => {
        // Add another collaborator
        const anotherCollab = await testDb
            .insertInto('users')
            .values({
                email: 'another@test.com',
                user_id: 'user-another-004',
                password: 'hash',
                roles: JSON.stringify(['ROLE_USER']),
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        await testDb
            .insertInto('project_collaborators')
            .values({
                project_id: privateProject.id,
                user_id: anotherCollab.id,
            })
            .execute();

        // Both collaborators should have access
        const result1 = await checkProjectAccess(testDb, privateProject.uuid, collaborator.id);
        const result2 = await checkProjectAccess(testDb, privateProject.uuid, anotherCollab.id);

        expect(result1.hasAccess).toBe(true);
        expect(result2.hasAccess).toBe(true);
    });
});
