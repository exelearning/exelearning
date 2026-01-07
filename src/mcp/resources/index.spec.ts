/**
 * MCP Resources Tests
 *
 * Tests for MCP resource registration.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectResources, registerCatalogResources } from './index';
import type { McpDependencies } from '../types';

// ============================================================================
// TEST DATA
// ============================================================================

const mockDeps: McpDependencies = {
    authToken: 'test-token',
    user: {
        userId: 1,
        email: 'test@example.com',
        roles: ['ROLE_USER'],
    },
};

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Resources', () => {
    const registeredResources: Array<{ name: string; uri: string | object }> = [];

    beforeEach(() => {
        registeredResources.length = 0;
    });

    describe('registerProjectResources', () => {
        it('should register project structure resource', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerProjectResources(mockServer, mockDeps);

            const structureResource = registeredResources.find(r => r.name === 'project-structure');
            expect(structureResource).toBeDefined();
        });

        it('should register project metadata resource', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerProjectResources(mockServer, mockDeps);

            const metadataResource = registeredResources.find(r => r.name === 'project-metadata');
            expect(metadataResource).toBeDefined();
        });

        it('should register 2 project resources', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerProjectResources(mockServer, mockDeps);

            expect(registeredResources.length).toBe(2);
        });
    });

    describe('registerCatalogResources', () => {
        it('should register idevices catalog resource', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            const idevicesResource = registeredResources.find(r => r.name === 'idevices-catalog');
            expect(idevicesResource).toBeDefined();
            expect(idevicesResource?.uri).toBe('exelearning://idevices');
        });

        it('should register themes catalog resource', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            const themesResource = registeredResources.find(r => r.name === 'themes-catalog');
            expect(themesResource).toBeDefined();
            expect(themesResource?.uri).toBe('exelearning://themes');
        });

        it('should register export formats catalog resource', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            const formatsResource = registeredResources.find(r => r.name === 'export-formats-catalog');
            expect(formatsResource).toBeDefined();
            expect(formatsResource?.uri).toBe('exelearning://export-formats');
        });

        it('should register 3 catalog resources', () => {
            const mockServer = {
                registerResource: (name: string, uri: string | object, _opts: unknown, _handler?: unknown) => {
                    registeredResources.push({ name, uri });
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            expect(registeredResources.length).toBe(3);
        });
    });

    describe('Resource Handlers with Real McpServer', () => {
        let realServer: McpServer;

        beforeEach(() => {
            realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });
        });

        it('should register project resources without error', () => {
            expect(() => registerProjectResources(realServer, mockDeps)).not.toThrow();
        });

        it('should register catalog resources without error', () => {
            expect(() => registerCatalogResources(realServer, mockDeps)).not.toThrow();
        });
    });

    describe('Catalog Resource Handlers', () => {
        it('export-formats handler should return formats list', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerResource: (name: string, _uri: unknown, _opts: unknown, handler?: (...args: any[]) => any) => {
                    if (name === 'export-formats-catalog' && handler) {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            expect(capturedHandler).not.toBeNull();

            const result = await capturedHandler!(new URL('exelearning://export-formats'));

            expect(result.contents).toBeDefined();
            expect(result.contents.length).toBe(1);
            expect(result.contents[0].mimeType).toBe('application/json');

            const data = JSON.parse(result.contents[0].text);
            expect(data.formats).toBeDefined();
            expect(Array.isArray(data.formats)).toBe(true);
            expect(data.formats.length).toBeGreaterThan(0);

            // Check format structure
            const format = data.formats[0];
            expect(format.id).toBeDefined();
            expect(format.name).toBeDefined();
            expect(format.extension).toBeDefined();
        });

        it('idevices handler should return idevices list', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerResource: (name: string, _uri: unknown, _opts: unknown, handler?: (...args: any[]) => any) => {
                    if (name === 'idevices-catalog' && handler) {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            expect(capturedHandler).not.toBeNull();

            const result = await capturedHandler!(new URL('exelearning://idevices'));

            expect(result.contents).toBeDefined();
            expect(result.contents.length).toBe(1);
            expect(result.contents[0].mimeType).toBe('application/json');

            const data = JSON.parse(result.contents[0].text);
            expect(data.idevices).toBeDefined();
            expect(Array.isArray(data.idevices)).toBe(true);
        });

        it('themes handler should return themes list', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerResource: (name: string, _uri: unknown, _opts: unknown, handler?: (...args: any[]) => any) => {
                    if (name === 'themes-catalog' && handler) {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerCatalogResources(mockServer, mockDeps);

            expect(capturedHandler).not.toBeNull();

            const result = await capturedHandler!(new URL('exelearning://themes'));

            expect(result.contents).toBeDefined();
            expect(result.contents.length).toBe(1);
            expect(result.contents[0].mimeType).toBe('application/json');

            const data = JSON.parse(result.contents[0].text);
            expect(data.themes).toBeDefined();
            expect(Array.isArray(data.themes)).toBe(true);
        });
    });
});
