/**
 * MCP Component Tools Tests
 *
 * Tests for component-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerComponentTools } from './components';
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

describe('MCP Component Tools', () => {
    const registeredTools: Array<{ name: string; config: unknown; handler: (...args: any[]) => any }> = [];

    beforeAll(async () => {
        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        await db
            .insertInto('users')
            .values({
                email: 'comp-test@example.com',
                user_id: 'comp-test-user',
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

    describe('registerComponentTools', () => {
        it('should register components/list tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'components.list');
            expect(listTool).toBeDefined();
        });

        it('should register components/create tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const createTool = registeredTools.find(t => t.name === 'components.create');
            expect(createTool).toBeDefined();
        });

        it('should register components/get tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'components.get');
            expect(getTool).toBeDefined();
        });

        it('should register components/update tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'components.update');
            expect(updateTool).toBeDefined();
        });

        it('should register components/setHtml tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const setHtmlTool = registeredTools.find(t => t.name === 'components.setHtml');
            expect(setHtmlTool).toBeDefined();
        });

        it('should register components/delete tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const deleteTool = registeredTools.find(t => t.name === 'components.delete');
            expect(deleteTool).toBeDefined();
        });

        it('should register 6 component tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(6);
        });
    });

    describe('components/list Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'components.list');
            const result = await listTool!.handler({
                projectUuid: 'non-existent',
                blockId: 'some-block',
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
                    uuid: 'comp-other-owner',
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

            registerComponentTools(mockServer, mockDeps);

            const listTool = registeredTools.find(t => t.name === 'components.list');
            const result = await listTool!.handler({
                projectUuid: 'comp-other-owner',
                blockId: 'some-block',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'comp-other-owner').execute();
        });
    });

    describe('components/get Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'components.get');
            const result = await getTool!.handler({
                projectUuid: 'non-existent',
                componentId: 'some-component',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    describe('components/setHtml Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerComponentTools(mockServer, mockDeps);

            const setHtmlTool = registeredTools.find(t => t.name === 'components.setHtml');
            const result = await setHtmlTool!.handler({
                projectUuid: 'non-existent',
                componentId: 'some-component',
                html: '<p>Test</p>',
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

            expect(() => registerComponentTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
