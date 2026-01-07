/**
 * MCP Prompts Tests
 *
 * Tests for MCP prompt template registration.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from './index';

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Prompts', () => {
    let server: McpServer;
    const registeredPrompts: string[] = [];

    beforeEach(() => {
        registeredPrompts.length = 0;

        // Create mock server that tracks registered prompts
        server = {
            registerPrompt: (name: string, _config: unknown, _handler: unknown) => {
                registeredPrompts.push(name);
            },
        } as unknown as McpServer;
    });

    describe('registerPrompts', () => {
        it('should register all prompt templates', () => {
            registerPrompts(server);

            expect(registeredPrompts).toContain('create-course');
            expect(registeredPrompts).toContain('add-content');
            expect(registeredPrompts).toContain('export-for-lms');
            expect(registeredPrompts).toContain('review-project');
            expect(registeredPrompts).toContain('translate-project');
        });

        it('should register exactly 5 prompts', () => {
            registerPrompts(server);

            expect(registeredPrompts.length).toBe(5);
        });
    });

    describe('Prompt Templates with Real McpServer', () => {
        it('should register prompts without error', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            // Should not throw when registering prompts
            expect(() => registerPrompts(realServer)).not.toThrow();
        });

        it('should fail when registering prompts twice', () => {
            const realServer = new McpServer({
                name: 'test-server',
                version: '1.0.0',
            });

            registerPrompts(realServer);

            // Should throw when registering again
            expect(() => registerPrompts(realServer)).toThrow('already registered');
        });
    });

    describe('Prompt Handler Behavior', () => {
        it('create-course handler should generate correct structure', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'create-course') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            expect(capturedHandler).not.toBeNull();

            const result = await capturedHandler!({
                title: 'Test Course',
                modules: '4',
                language: 'es',
                includeIntro: 'yes',
                includeSummary: 'yes',
            });

            expect(result.messages).toBeDefined();
            expect(result.messages.length).toBe(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].content.type).toBe('text');
            expect(result.messages[0].content.text).toContain('Test Course');
            expect(result.messages[0].content.text).toContain('es');
            expect(result.messages[0].content.text).toContain('Module 1');
            expect(result.messages[0].content.text).toContain('Module 4');
            expect(result.messages[0].content.text).toContain('Introduction');
            expect(result.messages[0].content.text).toContain('Summary');
        });

        it('create-course handler should handle defaults', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'create-course') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                title: 'Default Course',
            });

            expect(result.messages[0].content.text).toContain('Default Course');
            expect(result.messages[0].content.text).toContain('en'); // default language
            expect(result.messages[0].content.text).toContain('Module 1');
            expect(result.messages[0].content.text).toContain('Module 3'); // default 3 modules
            expect(result.messages[0].content.text).toContain('Introduction');
            expect(result.messages[0].content.text).toContain('Summary');
        });

        it('create-course handler should exclude intro/summary when set to no', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'create-course') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                title: 'No Intro Course',
                includeIntro: 'no',
                includeSummary: 'no',
            });

            expect(result.messages[0].content.text).not.toContain('- Introduction');
            expect(result.messages[0].content.text).not.toContain('- Summary');
        });

        it('add-content handler should generate correct message', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'add-content') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                projectUuid: 'abc-123',
                pageId: 'page-1',
                contentType: 'quiz',
                topic: 'Mathematics',
            });

            expect(result.messages[0].content.text).toContain('abc-123');
            expect(result.messages[0].content.text).toContain('page-1');
            expect(result.messages[0].content.text).toContain('quiz');
            expect(result.messages[0].content.text).toContain('Mathematics');
        });

        it('add-content handler should handle unknown content types', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'add-content') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                projectUuid: 'abc-123',
                pageId: 'page-1',
                contentType: 'unknown-type',
            });

            expect(result.messages[0].content.text).toContain('Create appropriate content');
        });

        it('export-for-lms handler should provide LMS recommendations', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'export-for-lms') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            // Moodle recommendation
            let result = await capturedHandler!({
                projectUuid: 'project-123',
                lmsType: 'moodle',
            });
            expect(result.messages[0].content.text).toContain('SCORM 1.2');
            expect(result.messages[0].content.text).toContain('Moodle');

            // Blackboard recommendation
            result = await capturedHandler!({
                projectUuid: 'project-123',
                lmsType: 'blackboard',
            });
            expect(result.messages[0].content.text).toContain('SCORM 2004');

            // Default recommendation
            result = await capturedHandler!({
                projectUuid: 'project-123',
            });
            expect(result.messages[0].content.text).toContain('SCORM 1.2');
            expect(result.messages[0].content.text).toContain('widely compatible');
        });

        it('review-project handler should include project UUID', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'review-project') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                projectUuid: 'review-uuid-123',
            });

            expect(result.messages[0].content.text).toContain('review-uuid-123');
            expect(result.messages[0].content.text).toContain('project://review-uuid-123/structure');
            expect(result.messages[0].content.text).toContain('project://review-uuid-123/metadata');
        });

        it('translate-project handler should include target language', async () => {
            let capturedHandler: ((...args: any[]) => any) | null = null;

            const mockServer = {
                registerPrompt: (name: string, _config: unknown, handler: (...args: any[]) => any) => {
                    if (name === 'translate-project') {
                        capturedHandler = handler;
                    }
                },
            } as unknown as McpServer;

            registerPrompts(mockServer);

            const result = await capturedHandler!({
                projectUuid: 'translate-uuid',
                targetLanguage: 'fr',
            });

            expect(result.messages[0].content.text).toContain('translate-uuid');
            expect(result.messages[0].content.text).toContain('fr');
            expect(result.messages[0].content.text).toContain('Preserve all HTML formatting');
        });
    });
});
