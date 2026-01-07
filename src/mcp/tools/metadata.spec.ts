/**
 * MCP Metadata Tools Tests
 *
 * Tests for metadata-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMetadataTools } from './metadata';
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

describe('MCP Metadata Tools', () => {
    const registeredTools: Array<{ name: string; config: unknown; handler: (...args: any[]) => any }> = [];

    beforeAll(async () => {
        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        await db
            .insertInto('users')
            .values({
                email: 'meta-test@example.com',
                user_id: 'meta-test-user',
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

    describe('registerMetadataTools', () => {
        it('should register metadata/get tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerMetadataTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'metadata.get');
            expect(getTool).toBeDefined();
        });

        it('should register metadata/update tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerMetadataTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'metadata.update');
            expect(updateTool).toBeDefined();
        });

        it('should register 2 metadata tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerMetadataTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(2);
        });
    });

    describe('metadata/get Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerMetadataTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'metadata.get');
            const result = await getTool!.handler({
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
                    uuid: 'meta-other-owner',
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

            registerMetadataTools(mockServer, mockDeps);

            const getTool = registeredTools.find(t => t.name === 'metadata.get');
            const result = await getTool!.handler({
                projectUuid: 'meta-other-owner',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'meta-other-owner').execute();
        });
    });

    describe('metadata/update Handler', () => {
        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerMetadataTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'metadata.update');
            const result = await updateTool!.handler({
                projectUuid: 'non-existent',
                title: 'New Title',
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
                    uuid: 'meta-update-other-owner',
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

            registerMetadataTools(mockServer, mockDeps);

            const updateTool = registeredTools.find(t => t.name === 'metadata.update');
            const result = await updateTool!.handler({
                projectUuid: 'meta-update-other-owner',
                title: 'New Title',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'meta-update-other-owner').execute();
        });
    });

    describe('Tool Registration with Real McpServer', () => {
        it('should register tools without error', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            expect(() => registerMetadataTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
