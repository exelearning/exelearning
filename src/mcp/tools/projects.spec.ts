/**
 * MCP Project Tools Tests
 *
 * Tests for project-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from './projects';
import type { McpDependencies } from '../types';
import { db, resetClientCacheForTesting } from '../../db/client';
import { up } from '../../db/migrations/001_initial';
import { now } from '../../db/types';

// ============================================================================
// TEST DATA
// ============================================================================

const mockDeps: McpDependencies = {
    authToken: 'Bearer test-token',
    user: {
        userId: 1,
        email: 'test@example.com',
        roles: ['ROLE_USER'],
    },
};

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Project Tools', () => {
    const registeredTools: Array<{ name: string; config: unknown; handler: (...args: any[]) => any }> = [];

    beforeAll(async () => {
        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        await db
            .insertInto('users')
            .values({
                email: 'test@example.com',
                user_id: 'test-user',
                password: 'hashed',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
    });

    afterAll(async () => {
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        registeredTools.length = 0;
        // Clean up projects
        await db.deleteFrom('projects').execute();
    });

    describe('registerProjectTools', () => {
        it('should register projects/list tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'projects.list');
            expect(listTool).toBeDefined();
        });

        it('should register projects/create tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const createTool = registeredTools.find(t => t.name === 'projects.create');
            expect(createTool).toBeDefined();
        });

        it('should register projects/get tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'projects.get');
            expect(getTool).toBeDefined();
        });

        it('should register projects/update tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'projects.update');
            expect(updateTool).toBeDefined();
        });

        it('should register projects/delete tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'projects.delete');
            expect(deleteTool).toBeDefined();
        });

        it('should register projects/duplicate tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const duplicateTool = registeredTools.find(t => t.name === 'projects.duplicate');
            expect(duplicateTool).toBeDefined();
        });

        it('should register 6 project tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(6);
        });
    });

    describe('projects/list Handler', () => {
        it('should return empty list when no projects', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'projects.list');
            const result = await listTool!.handler({});

            expect(result.content).toBeDefined();
            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should return projects for user', async () => {
            // Create test project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'list-test-uuid',
                    title: 'Test Project',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'projects.list');
            const result = await listTool!.handler({});

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            expect(data.data[0].title).toBe('Test Project');
        });

        it('should apply search filter', async () => {
            await db
                .insertInto('projects')
                .values([
                    { uuid: 'search-1', title: 'Math Course', owner_id: 1, created_at: now() },
                    { uuid: 'search-2', title: 'Science Course', owner_id: 1, created_at: now() },
                ])
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'projects.list');
            const result = await listTool!.handler({ search: 'Math' });

            const data = JSON.parse(result.content[0].text);
            expect(data.data.length).toBe(1);
            expect(data.data[0].title).toBe('Math Course');
        });

        it('should apply pagination', async () => {
            await db
                .insertInto('projects')
                .values([
                    { uuid: 'page-1', title: 'Project 1', owner_id: 1, created_at: now() },
                    { uuid: 'page-2', title: 'Project 2', owner_id: 1, created_at: now() },
                    { uuid: 'page-3', title: 'Project 3', owner_id: 1, created_at: now() },
                ])
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'projects.list');
            const result = await listTool!.handler({ limit: 2, offset: 1 });

            const data = JSON.parse(result.content[0].text);
            expect(data.data.length).toBe(2);
            expect(data.total).toBe(3);
        });
    });

    describe('projects/get Handler', () => {
        it('should return project by uuid', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'get-test-uuid',
                    title: 'Get Test',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'projects.get');
            const result = await getTool!.handler({ uuid: 'get-test-uuid' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.data.title).toBe('Get Test');
        });

        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'projects.get');
            const result = await getTool!.handler({ uuid: 'non-existent' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized access', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'other-owner-uuid',
                    title: 'Other Project',
                    owner_id: 999, // Different user
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'projects.get');
            const result = await getTool!.handler({ uuid: 'other-owner-uuid' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });
    });

    // Note: projects/create and projects/duplicate success cases require Yjs integration
    // and are tested in integration tests. Unit tests focus on error paths.

    describe('projects/update Handler', () => {
        it('should update project title', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'update-test-uuid',
                    title: 'Original Title',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'projects.update');
            const result = await updateTool!.handler({
                uuid: 'update-test-uuid',
                title: 'Updated Title',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.data.title).toBe('Updated Title');
        });

        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'projects.update');
            const result = await updateTool!.handler({
                uuid: 'non-existent',
                title: 'New Title',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized access', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'update-other-owner',
                    title: 'Other Project',
                    owner_id: 999,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'projects.update');
            const result = await updateTool!.handler({
                uuid: 'update-other-owner',
                title: 'New Title',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });
    });

    describe('projects/delete Handler', () => {
        it('should delete project', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'delete-test-uuid',
                    title: 'Delete Test',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'projects.delete');
            const result = await deleteTool!.handler({ uuid: 'delete-test-uuid' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.data.deleted).toBe(true);
        });

        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'projects.delete');
            const result = await deleteTool!.handler({ uuid: 'non-existent' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized access', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'delete-other-owner',
                    title: 'Other Project',
                    owner_id: 999,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'projects.delete');
            const result = await deleteTool!.handler({ uuid: 'delete-other-owner' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });
    });

    describe('projects/duplicate Handler', () => {
        // Note: Success cases require Yjs integration and are tested in integration tests.

        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const dupTool = registeredTools.find(t => t.name === 'projects.duplicate');
            const result = await dupTool!.handler({ uuid: 'non-existent' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized access', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'dup-other-owner',
                    title: 'Other Project',
                    owner_id: 999,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerProjectTools(mockServer, mockDeps);

            const dupTool = registeredTools.find(t => t.name === 'projects.duplicate');
            const result = await dupTool!.handler({ uuid: 'dup-other-owner' });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });
    });

    describe('Tool Registration with Real McpServer', () => {
        it('should register tools without error', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            expect(() => registerProjectTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
