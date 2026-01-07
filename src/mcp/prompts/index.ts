/**
 * MCP Prompts
 *
 * Pre-defined prompt templates for common workflows.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ============================================================================
// PROMPT REGISTRATION
// ============================================================================

/**
 * Register prompt templates with the MCP server.
 */
export function registerPrompts(server: McpServer): void {
    // Create course prompt
    server.registerPrompt(
        'create-course',
        {
            title: 'Create Course',
            description: 'Create a new eXeLearning course with an initial structure of pages and content.',
            argsSchema: {
                title: z.string().describe('The title of the course'),
                modules: z.string().optional().describe('Number of modules/sections (default: 3)'),
                language: z.string().optional().describe('Language code (en, es, fr, etc.)'),
                includeIntro: z.string().optional().describe('Include introduction page (yes/no)'),
                includeSummary: z.string().optional().describe('Include summary page (yes/no)'),
            },
        },
        async args => {
            const modules = parseInt(args.modules || '3', 10) || 3;
            const language = args.language || 'en';
            const includeIntro = args.includeIntro !== 'no';
            const includeSummary = args.includeSummary !== 'no';

            let structure = '';
            if (includeIntro) {
                structure += '- Introduction\n';
            }
            for (let i = 1; i <= modules; i++) {
                structure += `- Module ${i}\n`;
            }
            if (includeSummary) {
                structure += '- Summary\n';
            }

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Create a new eXeLearning course with the following specifications:

**Title:** ${args.title}
**Language:** ${language}
**Structure:**
${structure}

Please:
1. First create the project using the projects/create tool
2. Set the metadata (title, language) using metadata/update
3. Create the pages according to the structure above
4. For each page, create at least one block with a text component

Return the project UUID when done so I can continue working on it.`,
                        },
                    },
                ],
            };
        },
    );

    // Add content prompt
    server.registerPrompt(
        'add-content',
        {
            title: 'Add Content',
            description: 'Add educational content to a specific page in the project.',
            argsSchema: {
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page to add content to'),
                contentType: z.string().describe('Type of content: text, quiz, reflection, gallery, video'),
                topic: z.string().optional().describe('Topic or subject of the content'),
            },
        },
        async args => {
            const contentDescriptions: Record<string, string> = {
                text: 'Create a text block with formatted HTML content about the topic',
                quiz: 'Create a quiz with multiple choice or true/false questions',
                reflection: 'Create a reflection activity with thought-provoking questions',
                gallery: 'Create an image gallery placeholder',
                video: 'Create a video embed placeholder',
            };

            const description = contentDescriptions[args.contentType] || 'Create appropriate content';

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Add ${args.contentType} content to page ${args.pageId} in project ${args.projectUuid}.

${args.topic ? `**Topic:** ${args.topic}` : ''}

Please:
1. First get the page to understand its context using pages/get
2. Create a new block in the page using blocks/create
3. ${description} using components/create with the appropriate ideviceType
4. If creating text content, use components/setHtml to add the actual HTML

Confirm when the content has been added.`,
                        },
                    },
                ],
            };
        },
    );

    // Export for LMS prompt
    server.registerPrompt(
        'export-for-lms',
        {
            title: 'Export for LMS',
            description: 'Export a project for a Learning Management System.',
            argsSchema: {
                projectUuid: z.string().describe('The UUID of the project to export'),
                lmsType: z
                    .string()
                    .optional()
                    .describe('LMS type: moodle, canvas, blackboard (determines best format)'),
            },
        },
        async args => {
            const lmsRecommendations: Record<string, string> = {
                moodle: 'SCORM 1.2 (most compatible with Moodle)',
                canvas: 'SCORM 1.2 or IMS Content Package',
                blackboard: 'SCORM 2004 (best support in Blackboard)',
            };

            const recommendation = args.lmsType
                ? lmsRecommendations[args.lmsType.toLowerCase()] || 'SCORM 1.2 (widely compatible)'
                : 'SCORM 1.2 (widely compatible)';

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Export project ${args.projectUuid} for use in a Learning Management System.

${args.lmsType ? `**Target LMS:** ${args.lmsType}` : ''}
**Recommended format:** ${recommendation}

Please:
1. First check the project exists and get its metadata using metadata/get
2. Verify the project structure using the project structure resource
3. Use export/generate to create the SCORM export
4. Provide the download URL and instructions for importing into the LMS

Note: The download URL requires authentication with a JWT token.`,
                        },
                    },
                ],
            };
        },
    );

    // Review project prompt
    server.registerPrompt(
        'review-project',
        {
            title: 'Review Project',
            description: 'Review a project structure and provide improvement suggestions.',
            argsSchema: {
                projectUuid: z.string().describe('The UUID of the project to review'),
            },
        },
        async args => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Review the structure and content of project ${args.projectUuid}.

Please:
1. Read the project structure resource (project://${args.projectUuid}/structure)
2. Read the project metadata resource (project://${args.projectUuid}/metadata)
3. Analyze the organization of pages and content
4. Provide suggestions for:
   - Improving the page hierarchy
   - Adding missing content types
   - Enhancing accessibility
   - Better metadata (title, description, language settings)

Format your review as a structured report.`,
                        },
                    },
                ],
            };
        },
    );

    // Translate project prompt
    server.registerPrompt(
        'translate-project',
        {
            title: 'Translate Project',
            description: 'Guide for translating project content to another language.',
            argsSchema: {
                projectUuid: z.string().describe('The UUID of the project to translate'),
                targetLanguage: z.string().describe('Target language code (es, fr, de, etc.)'),
            },
        },
        async args => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Help me translate project ${args.projectUuid} to ${args.targetLanguage}.

Please:
1. First, read the project structure to understand all content
2. Update the metadata language setting using metadata/update
3. For each text component, use components/get to read the current content
4. Translate the content and use components/setHtml to update it

Important:
- Preserve all HTML formatting
- Translate all visible text including titles and instructions
- Do not translate technical identifiers or code

Provide progress updates as you work through each page.`,
                        },
                    },
                ],
            };
        },
    );
}
