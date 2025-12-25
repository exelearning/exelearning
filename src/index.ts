/**
 * Elysia Application Entry Point
 * New backend replacing NestJS
 */
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
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
import { adminRoutes } from './routes/admin';
import { yjsRoutes } from './routes/yjs';
import {
    createWebSocketRoutes,
    initialize as initWebSocket,
    getServerInfo,
    getActiveRooms,
    stop as stopWebSocket,
} from './websocket/yjs-websocket';
import { getFilesDir } from './services/file-helper';
import { db } from './db/client';
import { migrateToLatest } from './db/migrations';
import { findUserByEmail, createUser } from './db/queries/users';
import { renderTemplate, setRenderLocale } from './services/template';
import { getSettingNumber } from './services/app-settings';
import { getBasePath } from './utils/basepath.util';
import { HttpException, TranslatableException, getStatusText } from './exceptions';
import { MIME_TYPES } from './utils/mime-types';
import * as fs from 'fs';
import * as path from 'path';

// Get port from environment (default: 8080)
// APP_PORT is used by Electron, PORT is standard convention
const PORT = parseInt(process.env.APP_PORT || process.env.PORT || '8080', 10);

const app = new Elysia()
    // === GLOBAL ERROR HANDLER ===
    .onError(({ code, error, request, set }) => {
        // Determine HTTP status code
        let statusCode = 500;
        if (code === 'NOT_FOUND') statusCode = 404;
        else if (code === 'VALIDATION') statusCode = 400;
        else if (code === 'PARSE') statusCode = 400;
        else if (error instanceof HttpException) statusCode = error.statusCode;
        else if (error instanceof TranslatableException) statusCode = error.statusCode;

        const url = new URL(request.url);
        const pathname = url.pathname;

        // Log error (5xx = error, 4xx = warning)
        const logLevel = statusCode >= 500 ? 'error' : 'warn';
        console[logLevel](
            `[${logLevel.toUpperCase()}] ${request.method} ${pathname} - ${statusCode}: ${error.message}`,
        );
        if (statusCode >= 500) console.error(error.stack);

        // Detect if API request
        const isApi =
            pathname.startsWith('/api/') ||
            request.headers.get('accept')?.includes('application/json') ||
            request.headers.get('content-type')?.includes('application/json');

        set.status = statusCode;

        // API: return JSON
        if (isApi) {
            return {
                statusCode,
                message: error.message,
                error: getStatusText(statusCode),
                timestamp: new Date().toISOString(),
                path: pathname,
            };
        }

        // Web: render HTML error page
        const template =
            pathname.startsWith('/workarea') || pathname.startsWith('/project') ? 'workarea/error' : 'security/error';

        // Detect user locale from Accept-Language header
        const acceptLanguage = request.headers.get('accept-language') || 'en';
        const userLocale = acceptLanguage.split(',')[0].split('-')[0] || 'en';
        setRenderLocale(userLocale);

        set.headers['content-type'] = 'text/html; charset=utf-8';

        try {
            return renderTemplate(template, {
                error: error.message || getStatusText(statusCode),
                message: error.message,
                status_code: statusCode,
                is_authenticated: false, // TODO: extract from JWT if present
                basePath: getBasePath(),
                locale: userLocale,
            });
        } catch (renderErr) {
            // Fallback HTML if template fails
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
    // Serve files from FILES_DIR for /files/tmp/* and /files/dist/* paths
    // Also handle versioned paths like /v0.0.0-alpha/libs/* -> /libs/*
    // Also handle BASE_PATH prefixed static files
    // Also handle exemindmap editor to bypass Bun's HMR bundler
    .onRequest(({ request }) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        // Strip BASE_PATH prefix if present (e.g., /web/exelearning/libs -> /libs)
        const basePath = getBasePath();
        if (basePath && pathname.startsWith(basePath)) {
            pathname = pathname.slice(basePath.length) || '/';
        }

        // Serve static files from public/ when BASE_PATH is present
        // (static plugin only handles root paths, not prefixed paths)
        if (basePath && pathname !== '/') {
            const publicPath = path.join(process.cwd(), 'public', pathname);
            // Security: ensure path is within public/
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
                    // Fall through to let other handlers process
                }
            }
        }

        // Handle /files/tmp/* and /files/dist/* - serve from FILES_DIR
        const filesMatch = pathname.match(/^\/files\/(tmp|dist)\/(.+)$/);
        if (filesMatch) {
            const filesDir = getFilesDir();
            const subPath = filesMatch[1]; // 'tmp' or 'dist'
            const relativePath = filesMatch[2]; // rest of the path

            // Prevent path traversal
            const cleanPath = relativePath.replace(/\.\./g, '');
            const filePath = path.join(filesDir, subPath, cleanPath);

            // Security: ensure path is within FILES_DIR
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
                                'Cache-Control': 'public, max-age=3600', // 1 hour cache
                            },
                        });
                    }
                } catch (err) {
                    console.error('[StaticFiles] Error serving file:', filePath, err);
                }
            }
            // File not found - let it fall through to 404
        }

        // Match /v{version}/libs/* and rewrite to /libs/*
        const versionedLibsMatch = pathname.match(/^\/v[\d.]+[^/]*\/libs\/(.+)$/);
        if (versionedLibsMatch) {
            // Serve the file directly from public/libs
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

        // Match /v{version}/* and rewrite to /* (except /libs which is handled above)
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
    })
    // Serve exemindmap editor via API endpoint to bypass Bun's HTML bundler
    // This uses /api/exemindmap-editor/* which Bun won't intercept
    .get('/api/exemindmap-editor/*', ({ params, set }) => {
        const relativePath = params['*'] || 'index.html';
        const editorBase = 'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor';
        const filePath = path.join(process.cwd(), editorBase, relativePath);

        // Security: ensure path is within the editor directory
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

            // For HTML files, rewrite relative paths to absolute paths
            if (ext === '.html' || ext === '.htm') {
                let html = content.toString('utf-8');
                // Fix relative paths like ../../../../../../../app/ -> /app/
                html = html.replace(/href="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/app\//g, 'href="/app/');
                html = html.replace(/src="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/app\//g, 'src="/app/');
                // Fix local paths like css/ and js/ -> /api/exemindmap-editor/css/ etc
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
    })
    // Serve codemagic editor via API endpoint to bypass Bun's HTML bundler
    // This uses /api/codemagic-editor/* which Bun won't intercept
    .get('/api/codemagic-editor/*', ({ params, set }) => {
        const relativePath = params['*'] || 'codemagic.html';
        const editorBase = 'public/libs/tinymce_5/js/tinymce/plugins/codemagic';
        const filePath = path.join(process.cwd(), editorBase, relativePath);

        // Security: ensure path is within the editor directory
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

            // For HTML files, rewrite relative paths to absolute paths
            if (ext === '.html' || ext === '.htm') {
                let html = content.toString('utf-8');
                // Fix includes/ paths -> /api/codemagic-editor/includes/
                html = html.replace(/src="includes\//g, 'src="/api/codemagic-editor/includes/');
                html = html.replace(/href="includes\//g, 'href="/api/codemagic-editor/includes/');
                // Fix images/icons/ paths -> /api/codemagic-editor/images/
                html = html.replace(/src="images\//g, 'src="/api/codemagic-editor/images/');
                content = Buffer.from(html, 'utf-8');
            }

            set.headers['Content-Type'] = contentType;
            set.headers['Content-Length'] = content.length.toString();
            return content;
        }

        set.status = 404;
        return 'Not Found';
    })
    // Static files from public directory (served at root, BASE_PATH handled in onRequest)
    .use(
        staticPlugin({
            assets: 'public',
            prefix: '/',
            alwaysStatic: false,
        }),
    );

// Get BASE_PATH for route registration and add routes
// Routes are always added at root, PLUS at BASE_PATH if configured
// This allows frontend code that doesn't use BASE_PATH to still work
const routePrefix = getBasePath();

// Always register routes at root
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
    .use(adminRoutes)
    .use(yjsRoutes)
    .use(createWebSocketRoutes())
    .get('/api', () => ({
        name: 'eXeLearning API',
        version: '4.0.0-elysia',
        framework: 'Elysia',
        runtime: 'Bun',
    }))
    .get('/api/websocket/info', () => getServerInfo())
    .get('/api/websocket/rooms', () => ({ rooms: getActiveRooms() }));

// Also register routes at BASE_PATH if configured
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
            .use(adminRoutes)
            .use(yjsRoutes)
            .use(createWebSocketRoutes())
            .get('/api', () => ({
                name: 'eXeLearning API',
                version: '4.0.0-elysia',
                framework: 'Elysia',
                runtime: 'Bun',
            }))
            .get('/api/websocket/info', () => getServerInfo())
            .get('/api/websocket/rooms', () => ({ rooms: getActiveRooms() })),
    );
}

// Bootstrap: run migrations, seed, and start server
async function bootstrap() {
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
        const hashedPassword = await Bun.password.hash(testPassword, { algorithm: 'bcrypt' });
        const defaultQuota = await getSettingNumber(
            db as any,
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
    initWebSocket();

    console.log(`Elysia server running at http://localhost:${PORT}`);
    console.log(`Pages: /login, /workarea`);
    console.log(`Auth endpoints: /api/auth/login, /api/auth/logout, /api/session/check`);
    console.log(`Project endpoints: /api/project/*, /api/export/*`);
    console.log(`Filemanager endpoints: /filemanager/*`);
    console.log(`WebSocket (Yjs): ws://localhost:${PORT}/yjs/project-<uuid>?token=<jwt>`);
    console.log(`Static files: /public/*`);
}

bootstrap().catch(err => {
    console.error('[FATAL] Bootstrap failed:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    stopWebSocket();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    stopWebSocket();
    process.exit(0);
});

export type App = typeof app;
