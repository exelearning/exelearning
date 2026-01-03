/**
 * Elysia Application Entry Point for Node.js
 * This file is used for legacy systems that don't support Bun (e.g., Core2 Duo CPUs).
 *
 * Usage: npx tsx src/index-node.ts
 */

// =============================================================================
// POLYFILL: Response.redirect for relative URLs and mutable headers
// Node.js requires absolute URLs and returns immutable headers.
// This polyfill creates a new Response with mutable headers.
// =============================================================================
const BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || process.env.PORT || '8080'}`;

Response.redirect = (url: string | URL, status?: number): Response => {
    let absoluteUrl: string;

    if (typeof url === 'string' && !url.startsWith('http://') && !url.startsWith('https://')) {
        // Relative URL - convert to absolute
        absoluteUrl = new URL(url, BASE_URL).toString();
    } else {
        absoluteUrl = url.toString();
    }

    // Create a new Response with mutable headers (Node.js Response.redirect returns immutable headers)
    return new Response(null, {
        status: status || 302,
        headers: {
            Location: absoluteUrl,
        },
    });
};
// =============================================================================

import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';
import { cors } from '@elysiajs/cors';
// Note: staticPlugin not used in Node.js - we serve static files manually in onRequest
// because staticPlugin doesn't set content-type properly with the Node.js adapter
import * as bcrypt from 'bcryptjs';
import { healthRoutes, healthCheckAlias } from './routes/health';
import { authRoutes } from './routes/auth';
import { projectRoutes, symfonyCompatProjectRoutes } from './routes/project';
import { assetsRoutes } from './routes/assets';
import { exportRoutes } from './routes/export';
import { convertRoutes } from './routes/convert';
import { pagesRoutes } from './routes/pages';
import { configRoutes } from './routes/config';
import { idevicesRoutes } from './routes/idevices';
import { gamesRoutes } from './routes/games';
import { themesRoutes } from './routes/themes';
import { resourcesRoutes } from './routes/resources';
import { userRoutes } from './routes/user';
// NOTE: WebSocket/Yjs routes disabled in Node.js legacy mode (not supported)
// import { yjsRoutes } from './routes/yjs';
// import { createWebSocketRoutes, initialize as initWebSocket, ... } from './websocket/yjs-websocket';
import { getFilesDir } from './services/file-helper';
import { db } from './db/client';
import { migrateToLatest } from './db/migrations';
import { findUserByEmail, createUser } from './db/queries/users';
import { getSettingNumber } from './services/app-settings';
import { renderTemplate, setRenderLocale } from './services/template';
import { getBasePath } from './utils/basepath.util';
import { HttpException, TranslatableException, getStatusText } from './exceptions';
import { MIME_TYPES } from './utils/mime-types';
import * as fs from 'fs';
import * as path from 'path';

// Get port from environment (default: 8080)
const PORT = parseInt(process.env.APP_PORT || process.env.PORT || '8080', 10);

// Use Node.js adapter for Elysia
const app = new Elysia({ adapter: node() })
    // === GLOBAL ERROR HANDLER ===
    .onError(({ code, error, request, set }) => {
        let statusCode = 500;
        if (code === 'NOT_FOUND') statusCode = 404;
        else if (code === 'VALIDATION') statusCode = 400;
        else if (code === 'PARSE') statusCode = 400;
        else if (error instanceof HttpException) statusCode = error.statusCode;
        else if (error instanceof TranslatableException) statusCode = error.statusCode;

        const url = new URL(request.url);
        const pathname = url.pathname;

        const logLevel = statusCode >= 500 ? 'error' : 'warn';
        console[logLevel](
            `[${logLevel.toUpperCase()}] ${request.method} ${pathname} - ${statusCode}: ${error.message}`,
        );
        if (statusCode >= 500) console.error(error.stack);

        const isApi =
            pathname.startsWith('/api/') ||
            request.headers.get('accept')?.includes('application/json') ||
            request.headers.get('content-type')?.includes('application/json');

        set.status = statusCode;

        if (isApi) {
            return {
                statusCode,
                message: error.message,
                error: getStatusText(statusCode),
                timestamp: new Date().toISOString(),
                path: pathname,
            };
        }

        const template =
            pathname.startsWith('/workarea') || pathname.startsWith('/project') ? 'workarea/error' : 'security/error';

        const acceptLanguage = request.headers.get('accept-language') || 'en';
        const userLocale = acceptLanguage.split(',')[0].split('-')[0] || 'en';
        setRenderLocale(userLocale);

        set.headers['content-type'] = 'text/html; charset=utf-8';

        try {
            return renderTemplate(template, {
                error: error.message || getStatusText(statusCode),
                message: error.message,
                status_code: statusCode,
                is_authenticated: false,
                basePath: getBasePath(),
                locale: userLocale,
            });
        } catch (renderErr) {
            console.error('[Error] Template render failed:', renderErr);
            const basePath = getBasePath();
            return `<!DOCTYPE html>
<html><head><title>Error ${statusCode}</title></head>
<body><h1>Error ${statusCode}</h1><p>${error.message}</p>
<a href="${basePath}/login">Return to login</a></body></html>`;
        }
    })
    .use(
        cors({
            origin: true,
            credentials: true,
        }),
    )
    .onRequest(({ request }) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        const basePath = getBasePath();
        if (basePath && pathname.startsWith(basePath)) {
            pathname = pathname.slice(basePath.length) || '/';
        }

        if (basePath && pathname !== '/') {
            const publicPath = path.join(process.cwd(), 'public', pathname);
            const resolvedPath = path.resolve(publicPath);
            const resolvedBase = path.resolve(path.join(process.cwd(), 'public'));
            if (resolvedPath.startsWith(resolvedBase) && fs.existsSync(publicPath)) {
                try {
                    const stats = fs.statSync(publicPath);
                    if (stats.isFile()) {
                        const content = fs.readFileSync(publicPath);
                        const ext = path.extname(publicPath).toLowerCase();
                        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                        return new Response(content, {
                            headers: {
                                'Content-Type': contentType,
                                'Content-Length': stats.size.toString(),
                                'Cache-Control': 'public, max-age=3600',
                            },
                        });
                    }
                } catch {
                    // Fall through
                }
            }
        }

        const filesMatch = pathname.match(/^\/files\/(tmp|dist)\/(.+)$/);
        if (filesMatch) {
            const filesDir = getFilesDir();
            const subPath = filesMatch[1];
            const relativePath = filesMatch[2];

            const cleanPath = relativePath.replace(/\.\./g, '');
            const filePath = path.join(filesDir, subPath, cleanPath);

            const resolvedPath = path.resolve(filePath);
            const resolvedBase = path.resolve(filesDir);
            if (!resolvedPath.startsWith(resolvedBase)) {
                return new Response('Forbidden', { status: 403 });
            }

            if (fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.isFile()) {
                        const content = fs.readFileSync(filePath);
                        const ext = path.extname(filePath).toLowerCase();
                        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                        return new Response(content, {
                            headers: {
                                'Content-Type': contentType,
                                'Content-Length': stats.size.toString(),
                                'Cache-Control': 'public, max-age=3600',
                            },
                        });
                    }
                } catch (err) {
                    console.error('[StaticFiles] Error serving file:', filePath, err);
                }
            }
        }

        const versionedLibsMatch = pathname.match(/^\/v[\d.]+[^/]*\/libs\/(.+)$/);
        if (versionedLibsMatch) {
            const filePath = path.join(process.cwd(), 'public', 'libs', versionedLibsMatch[1]);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                return new Response(content, {
                    headers: { 'Content-Type': contentType },
                });
            }
        }

        const versionedMatch = pathname.match(/^\/v[\d.]+[^/]*\/(.+)$/);
        if (versionedMatch && !versionedMatch[1].startsWith('libs/')) {
            const filePath = path.join(process.cwd(), 'public', versionedMatch[1]);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                return new Response(content, {
                    headers: { 'Content-Type': contentType },
                });
            }
        }

        // Serve static files from public/ directory
        // This replaces staticPlugin which doesn't set content-type properly in Node.js
        const publicPath = path.join(process.cwd(), 'public', pathname);
        const resolvedPath = path.resolve(publicPath);
        const resolvedBase = path.resolve(path.join(process.cwd(), 'public'));

        // Security: ensure path is within public/
        if (resolvedPath.startsWith(resolvedBase) && fs.existsSync(publicPath)) {
            try {
                const stats = fs.statSync(publicPath);
                if (stats.isFile()) {
                    const content = fs.readFileSync(publicPath);
                    const ext = path.extname(publicPath).toLowerCase();
                    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                    return new Response(content, {
                        headers: {
                            'Content-Type': contentType,
                            'Content-Length': stats.size.toString(),
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            } catch {
                // Fall through to routes
            }
        }
    })
    .get('/api/exemindmap-editor/*', ({ params, set }) => {
        const relativePath = params['*'] || 'index.html';
        const editorBase = 'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor';
        const filePath = path.join(process.cwd(), editorBase, relativePath);

        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(path.join(process.cwd(), editorBase));
        if (!resolvedPath.startsWith(resolvedBase)) {
            set.status = 403;
            return 'Forbidden';
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            let content = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            if (ext === '.html' || ext === '.htm') {
                let html = content.toString('utf-8');
                html = html.replace(/href="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/app\//g, 'href="/app/');
                html = html.replace(/src="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/app\//g, 'src="/app/');
                html = html.replace(/href="css\//g, 'href="/api/exemindmap-editor/css/');
                html = html.replace(/src="js\//g, 'src="/api/exemindmap-editor/js/');
                content = Buffer.from(html, 'utf-8');
            }

            set.headers['Content-Type'] = contentType;
            set.headers['Content-Length'] = content.length.toString();
            return content;
        }

        set.status = 404;
        return 'Not Found';
    });
// Note: staticPlugin removed - static files are served manually in onRequest above

const routePrefix = getBasePath();

// Register routes at root
app.use(healthRoutes)
    .use(healthCheckAlias)
    .use(authRoutes)
    .use(pagesRoutes)
    .use(projectRoutes)
    .use(symfonyCompatProjectRoutes)
    .use(assetsRoutes)
    .use(exportRoutes)
    .use(convertRoutes)
    .use(configRoutes)
    .use(idevicesRoutes)
    .use(gamesRoutes)
    .use(themesRoutes)
    .use(resourcesRoutes)
    .use(userRoutes)
    // NOTE: WebSocket/Yjs routes disabled in Node.js legacy mode
    // .use(yjsRoutes)
    // .use(createWebSocketRoutes())
    .get('/api', () => ({
        name: 'eXeLearning API',
        version: '4.0.0-elysia',
        framework: 'Elysia',
        runtime: 'Node.js (legacy - no WebSocket)',
    }))
    // WebSocket info endpoints disabled in legacy mode
    .get('/api/websocket/info', () => ({ error: 'WebSocket not supported in legacy mode' }))
    .get('/api/websocket/rooms', () => ({ error: 'WebSocket not supported in legacy mode' }));

// Register routes at BASE_PATH if configured
if (routePrefix) {
    app.group(routePrefix, group =>
        group
            .use(healthRoutes)
            .use(healthCheckAlias)
            .use(authRoutes)
            .use(pagesRoutes)
            .use(projectRoutes)
            .use(symfonyCompatProjectRoutes)
            .use(assetsRoutes)
            .use(exportRoutes)
            .use(convertRoutes)
            .use(configRoutes)
            .use(idevicesRoutes)
            .use(themesRoutes)
            .use(userRoutes)
            // NOTE: WebSocket/Yjs routes disabled in Node.js legacy mode
            // .use(yjsRoutes)
            // .use(createWebSocketRoutes())
            .get('/api', () => ({
                name: 'eXeLearning API',
                version: '4.0.0-elysia',
                framework: 'Elysia',
                runtime: 'Node.js (legacy - no WebSocket)',
            }))
            .get('/api/websocket/info', () => ({ error: 'WebSocket not supported in legacy mode' }))
            .get('/api/websocket/rooms', () => ({ error: 'WebSocket not supported in legacy mode' })),
    );
}

// Bootstrap: run migrations, seed, and start server
async function bootstrap() {
    console.log('[Node.js Legacy Mode] Starting eXeLearning...');

    // 1. Run migrations
    console.log('[DB] Running migrations...');
    const migrationResult = await migrateToLatest(db);
    if (!migrationResult.success) {
        console.error('[DB] Migration failed:', migrationResult.error);
        process.exit(1);
    }

    // 2. Seed test user if not exists
    const testEmail = process.env.TEST_USER_EMAIL || 'user@exelearning.net';
    const testPassword = process.env.TEST_USER_PASSWORD || '1234';

    const existingUser = await findUserByEmail(db, testEmail);
    if (!existingUser) {
        console.log('[DB] Creating test user...');
        // Use bcryptjs instead of Bun.password.hash
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        const defaultQuota = await getSettingNumber(
            db,
            'DEFAULT_QUOTA',
            parseInt(process.env.DEFAULT_QUOTA || '4096', 10),
        );
        await createUser(db, {
            email: testEmail,
            user_id: 'test-user',
            password: hashedPassword,
            roles: '["ROLE_USER"]',
            is_lopd_accepted: 1,
            quota_mb: defaultQuota,
            is_active: 1,
        });
        console.log(`[DB] Test user created: ${testEmail}`);
    }

    // 3. Start server
    app.listen(PORT);
    // NOTE: WebSocket/initWebSocket() disabled in Node.js legacy mode

    console.log(`Elysia (Node.js) server running at http://localhost:${PORT}`);
    console.log(`Pages: /login, /workarea`);
    console.log(`Auth endpoints: /api/auth/login, /api/auth/logout, /api/session/check`);
    console.log(`Project endpoints: /api/project/*, /api/export/*`);
    console.log(`Filemanager endpoints: /filemanager/*`);
    console.log(`NOTE: WebSocket disabled in legacy mode (APP_ONLINE_MODE=0)`);
    console.log(`Static files: /public/*`);
}

bootstrap().catch(err => {
    console.error('[FATAL] Bootstrap failed:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    // NOTE: stopWebSocket() disabled in Node.js legacy mode
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    // NOTE: stopWebSocket() disabled in Node.js legacy mode
    process.exit(0);
});

export type App = typeof app;
