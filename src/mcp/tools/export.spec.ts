/**
 * MCP Export Tools Tests
 *
 * Tests for export-related MCP tools.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerExportTools } from './export';
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

describe('MCP Export Tools', () => {
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

    beforeEach(() => {
        registeredTools.length = 0;
    });

    describe('registerExportTools', () => {
        it('should register export/formats tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const formatsTool = registeredTools.find(t => t.name === 'export.formats');
            expect(formatsTool).toBeDefined();
        });

        it('should register export/generate tool', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            expect(generateTool).toBeDefined();
        });

        it('should register 2 export tools', () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            expect(registeredTools.length).toBe(2);
        });
    });

    describe('export/formats Handler', () => {
        it('should return list of export formats', async () => {
            const mockServer = {
                registerTool: (name: string, config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const formatsTool = registeredTools.find(t => t.name === 'export.formats');
            expect(formatsTool).toBeDefined();

            const result = await formatsTool!.handler({});

            expect(result.content).toBeDefined();
            expect(result.content.length).toBe(1);

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            // data.data is an array of formats directly
            expect(Array.isArray(data.data)).toBe(true);

            // Check expected formats
            const formatIds = data.data.map((f: { id: string }) => f.id);
            expect(formatIds).toContain('html5');
            expect(formatIds).toContain('scorm12');
            expect(formatIds).toContain('scorm2004');
            expect(formatIds).toContain('epub3');
            expect(formatIds).toContain('ims');
            expect(formatIds).toContain('elpx');
        });

        it('should return format with all required fields', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const formatsTool = registeredTools.find(t => t.name === 'export.formats');
            expect(formatsTool).toBeDefined();

            const result = await formatsTool!.handler({});
            const data = JSON.parse(result.content[0].text);

            // data.data is an array
            const format = data.data[0];
            expect(format.id).toBeDefined();
            expect(format.name).toBeDefined();
            expect(format.extension).toBeDefined();
            expect(format.mimeType).toBeDefined();
        });
    });

    describe('export/generate Handler', () => {
        it('should return download URL for valid format', async () => {
            // Create test project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'test-project-uuid',
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

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            expect(generateTool).toBeDefined();

            const result = await generateTool!.handler({
                projectUuid: 'test-project-uuid',
                format: 'scorm12',
            });

            expect(result.content).toBeDefined();
            const data = JSON.parse(result.content[0].text);

            expect(data.success).toBe(true);
            expect(data.data.downloadUrl).toBeDefined();
            // URL format is /api/v1/export/projects/{uuid}/export/{format}
            expect(data.data.downloadUrl).toContain('test-project-uuid');
            expect(data.data.downloadUrl).toContain('scorm12');
            expect(data.data.format).toBe('scorm12');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'test-project-uuid').execute();
        });

        it('should return correct URL for html5 format', async () => {
            // Create test project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'html5-test-uuid',
                    title: 'HTML5 Test',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            const result = await generateTool!.handler({
                projectUuid: 'html5-test-uuid',
                format: 'html5',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.data.downloadUrl).toContain('html5-test-uuid');
            expect(data.data.downloadUrl).toContain('html5');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'html5-test-uuid').execute();
        });

        it('should return correct URL for epub3 format', async () => {
            // Create test project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'epub-test-uuid',
                    title: 'EPUB Test',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            const result = await generateTool!.handler({
                projectUuid: 'epub-test-uuid',
                format: 'epub3',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.data.downloadUrl).toContain('epub-test-uuid');
            expect(data.data.downloadUrl).toContain('epub3');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'epub-test-uuid').execute();
        });

        it('should include auth requirement message', async () => {
            // Create test project
            await db
                .insertInto('projects')
                .values({
                    uuid: 'auth-test-uuid',
                    title: 'Auth Test',
                    owner_id: 1,
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            const result = await generateTool!.handler({
                projectUuid: 'auth-test-uuid',
                format: 'scorm12',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.data.message).toContain('Authorization');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'auth-test-uuid').execute();
        });

        it('should return error for non-existent project', async () => {
            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            const result = await generateTool!.handler({
                projectUuid: 'non-existent-uuid',
                format: 'scorm12',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return error for unauthorized project access', async () => {
            // Create test project owned by different user
            await db
                .insertInto('projects')
                .values({
                    uuid: 'other-user-uuid',
                    title: 'Other User Project',
                    owner_id: 999, // Different user
                    created_at: now(),
                })
                .execute();

            const mockServer = {
                registerTool: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    registeredTools.push({ name, config: _config, handler });
                },
            } as unknown as McpServer;

            registerExportTools(mockServer, mockDeps);

            const generateTool = registeredTools.find(t => t.name === 'export.generate');
            const result = await generateTool!.handler({
                projectUuid: 'other-user-uuid',
                format: 'scorm12',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');

            // Cleanup
            await db.deleteFrom('projects').where('uuid', '=', 'other-user-uuid').execute();
        });
    });

    describe('Tool Registration with Real McpServer', () => {
        it('should register tools without error', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            expect(() => registerExportTools(realServer, mockDeps)).not.toThrow();
        });
    });
});
