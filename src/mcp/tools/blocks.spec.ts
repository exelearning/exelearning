/**
 * MCP Block Tools Tests
 *
 * Tests for block-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBlockTools } from './blocks';
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

describe('MCP Block Tools', () => {
    const registeredTools: Array<{ name: string; config: unknown; handler: (...args: any[]) => any }> = [];

    beforeAll(async () => {
        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        await db
            .insertInto('users')
            .values({
                email: 'block-test@example.com',
                user_id: 'block-test-user',
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

    describe('registerBlockTools', () => {
        it('should register blocks/list tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'blocks.list');
            expect(listTool).toBeDefined();
        });

        it('should register blocks/create tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const createTool = registeredTools.find(t => t.name === 'blocks.create');
            expect(createTool).toBeDefined();
        });

        it('should register blocks/get tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'blocks.get');
            expect(getTool).toBeDefined();
        });

        it('should register blocks/update tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'blocks.update');
            expect(updateTool).toBeDefined();
        });

        it('should register blocks/delete tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'blocks.delete');
            expect(deleteTool).toBeDefined();
        });

        it('should register blocks/move tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const moveTool = registeredTools.find(t => t.name === 'blocks.move');
            expect(moveTool).toBeDefined();
        });

        it('should register 6 block tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(6);
        });
    });

    describe('blocks/list Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'blocks.list');
            const result = await listTool!.handler({
                projectUuid: 'non-existent',
                pageId: 'some-page',
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
                    uuid: 'blocks-other-owner',
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

            registerBlockTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'blocks.list');
            const result = await listTool!.handler({
                projectUuid: 'blocks-other-owner',
                pageId: 'some-page',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'blocks-other-owner').execute();
        });
    });

    describe('blocks/get Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerBlockTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'blocks.get');
            const result = await getTool!.handler({
                projectUuid: 'non-existent',
                blockId: 'some-block',
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

            expect(() => registerBlockTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
