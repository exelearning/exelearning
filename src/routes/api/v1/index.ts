/**
 * REST API v1 Router
 *
 * Provides a complete REST API for programmatic access to eXeLearning projects.
 * Changes made via REST API are automatically synchronized with WebSocket clients
 * using Yjs CRDTs for conflict resolution.
 *
 * Features:
 * - Full CRUD for projects, pages, blocks, and components
 * - Metadata and export operations
 * - User management (admin)
 * - Swagger/OpenAPI documentation at /api/v1/docs
 */
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { projectsRoutes } from './projects';
import { pagesRoutes } from './pages';
import { blocksRoutes } from './blocks';
import { componentsRoutes } from './components';
import { metadataRoutes } from './metadata';
import { exportRoutes } from './export';
import { usersRoutes } from './users';
import { assetsRoutes } from './assets';

/**
 * Create the API v1 router with all endpoints and Swagger documentation
 */
export const apiV1Routes = new Elysia({ prefix: '/api/v1' })
    // Swagger documentation
    .use(
        swagger({
            documentation: {
                info: {
                    title: 'eXeLearning REST API',
                    version: '1.0.0',
                    description: `
REST API for programmatic access to eXeLearning projects.

## Features

- **Real-time Sync**: Changes via REST are automatically broadcast to connected WebSocket clients
- **CRDT Conflict Resolution**: Uses Yjs CRDTs to merge concurrent edits
- **Full CRUD**: Create, read, update, delete projects, pages, blocks, and components

## Authentication

All endpoints require a valid JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Get a token by logging in via POST /api/auth/login

## Rate Limiting

API requests are limited to 1000 requests per minute per user.

## Response Format

All responses follow a consistent format:

**Success:**
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

**Error:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
\`\`\`
                    `,
                    contact: {
                        name: 'eXeLearning Team',
                        url: 'https://exelearning.net',
                    },
                    license: {
                        name: 'AGPL-3.0',
                        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
                    },
                },
                tags: [
                    {
                        name: 'Projects',
                        description: 'Project management operations',
                    },
                    {
                        name: 'Pages',
                        description: 'Page (navigation node) operations',
                    },
                    {
                        name: 'Blocks',
                        description: 'Block (iDevice container) operations',
                    },
                    {
                        name: 'Components',
                        description: 'Component (iDevice) operations',
                    },
                    {
                        name: 'Metadata',
                        description: 'Project metadata operations',
                    },
                    {
                        name: 'Export',
                        description: 'Export project to various formats',
                    },
                    {
                        name: 'Users',
                        description: 'User management (admin only)',
                    },
                    {
                        name: 'Assets',
                        description: 'Asset file management (images, media, documents)',
                    },
                ],
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                            description: 'JWT token from /api/auth/login',
                        },
                    },
                },
                security: [{ bearerAuth: [] }],
            },
            path: '/docs',
            exclude: ['/api/v1/docs', '/api/v1/docs/json'],
        }),
    )
    // API info endpoint
    .get(
        '/',
        () => ({
            name: 'eXeLearning REST API',
            version: '1.0.0',
            documentation: '/api/v1/docs',
            endpoints: {
                projects: '/api/v1/projects',
                pages: '/api/v1/projects/:uuid/pages',
                blocks: '/api/v1/projects/:uuid/blocks',
                components: '/api/v1/projects/:uuid/components',
                metadata: '/api/v1/projects/:uuid/metadata',
                export: '/api/v1/projects/:uuid/export',
                assets: '/api/v1/projects/:uuid/assets',
                users: '/api/v1/users',
            },
        }),
        {
            detail: {
                summary: 'API Information',
                description: 'Get API version and available endpoints',
                tags: ['Info'],
            },
        },
    )
    // Register all route modules
    .use(projectsRoutes)
    .use(pagesRoutes)
    .use(blocksRoutes)
    .use(componentsRoutes)
    .use(metadataRoutes)
    .use(exportRoutes)
    .use(usersRoutes)
    .use(assetsRoutes);
