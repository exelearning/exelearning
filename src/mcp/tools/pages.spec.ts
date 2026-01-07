/**
 * MCP Page Tools Tests
 *
 * Tests for page-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPageTools } from './pages';
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

describe('MCP Page Tools', () => {
    const registeredTools: Array<{ name: string; config: unknown; handler: (...args: any[]) => any }> = [];

    beforeAll(async () => {
        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        await db
            .insertInto('users')
            .values({
                email: 'page-test@example.com',
                user_id: 'page-test-user',
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

    beforeEach(() => {
        registeredTools.length = 0;
    });

    describe('registerPageTools', () => {
        it('should register pages/list tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'pages.list');
            expect(listTool).toBeDefined();
        });

        it('should register pages/create tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const createTool = registeredTools.find(t => t.name === 'pages.create');
            expect(createTool).toBeDefined();
        });

        it('should register pages/get tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'pages.get');
            expect(getTool).toBeDefined();
        });

        it('should register pages/update tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'pages.update');
            expect(updateTool).toBeDefined();
        });

        it('should register pages/delete tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'pages.delete');
            expect(deleteTool).toBeDefined();
        });

        it('should register pages/move tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const moveTool = registeredTools.find(t => t.name === 'pages.move');
            expect(moveTool).toBeDefined();
        });

        it('should register 6 page tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(6);
        });
    });

    describe('pages/list Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'pages.list');
            const result = await listTool!.handler({
                projectUuid: 'non-existent',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized access', async () => {
            // Create project owned by different user
            await db
                .insertInto('projects')
                .values({
                    uuid: 'pages-other-owner',
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

            registerPageTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'pages.list');
            const result = await listTool!.handler({
                projectUuid: 'pages-other-owner',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'pages-other-owner').execute();
        });
    });

    describe('pages/get Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'pages.get');
            const result = await getTool!.handler({
                projectUuid: 'non-existent',
                pageId: 'some-page',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    describe('pages/create Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerPageTools(mockServer, mockDeps);

            const createTool = registeredTools.find(t => t.name === 'pages.create');
            const result = await createTool!.handler({
                projectUuid: 'non-existent',
                name: 'New Page',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Tool Registration with Real McpServer', () => {
        it('should register tools without error', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            expect(() => registerPageTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
