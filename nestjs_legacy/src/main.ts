import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import * as nunjucks from 'nunjucks';
import { join, resolve } from 'path';
import { existsSync, createReadStream } from 'fs';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { YjsWebSocketService } from './modules/collaboration/services/yjs-websocket.service';
import { TranslationService } from './modules/translation/services/translation.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { getBasePath } from './utils/basepath.util';
import { seedDatabase } from './database/database-seeder.service';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import { lookup } from 'mime-types';

// Environment control: APP_DEBUG=1 enables verbose logging
const isDebug = process.env.APP_DEBUG === '1';
const debugLog = (...args: any[]) => {
    if (isDebug) console.log(...args);
};

async function bootstrap() {
    // Configure NestJS logger based on APP_DEBUG
    // APP_DEBUG=0: Only errors and warnings (production mode)
    // APP_DEBUG=1: All logs including debug (development mode)
    const loggerLevel = isDebug ? ['log', 'error', 'warn', 'debug', 'verbose'] : ['error', 'warn'];

    const fastifyAdapter = new FastifyAdapter({
        bodyLimit: 104857600, // 100MB
    });

    const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
        logger: loggerLevel as any,
    });

    const fastify = app.getHttpAdapter().getInstance();

    const secureCookies = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.COOKIE_SECURE ?? '').toLowerCase(),
    );
    const sameSite = (process.env.COOKIE_SAMESITE as any) || 'lax';

    // If running behind a proxy/https terminator and using secure cookies, trust the proxy
    if (secureCookies) {
        fastify.register(require('@fastify/under-pressure'), { trustProxy: true });
    }

    // Register cookie plugin (required for sessions)
    await fastify.register(fastifyCookie);

    // Configure session middleware
    await fastify.register(fastifySession, {
        secret: process.env.APP_SECRET || 'CHANGE_THIS_TO_A_SECRET_THAT_IS_AT_LEAST_32_CHARS',
        cookie: {
            maxAge: 86400000, // 24 hours
            httpOnly: true,
            secure: secureCookies,
            sameSite,
        },
    });

    // Register multipart for file uploads
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 100 * 1024 * 1024, // 100MB max file size
        },
        attachFieldsToBody: false, // Don't attach to body, we'll process manually
    });

    // Enable CORS for development
    app.enableCors({
        origin: true,
        credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    );

    // Apply BASE_PATH as global prefix for subdirectory installation
    // Examples: BASE_PATH=/exelearning or BASE_PATH=/web/exelearning
    const basePath = getBasePath();
    if (basePath) {
        app.setGlobalPrefix(basePath);
        debugLog(`[Bootstrap] BASE_PATH configured: ${basePath}`);
    }

    // Determine base directory for views and static files
    // Priority order:
    // 1. process.resourcesPath (set by Electron main.js in dev mode)
    // 2. dist/ directory (when running compiled code from dist/src/)
    // 3. Project root (when running with ts-node from src/)
    const baseDirCandidates = [
        (process as any).resourcesPath, // Packaged app resources (from Electron)
        join(__dirname, '..'), // Compiled: dist/src -> dist OR ts-node: src -> project root
        join(__dirname, '..', '..'), // Compiled: dist/src -> project root
    ];

    debugLog('[Bootstrap] __dirname:', __dirname);
    debugLog('[Bootstrap] process.resourcesPath:', (process as any).resourcesPath);
    debugLog('[Bootstrap] process.cwd():', process.cwd());
    debugLog('[Bootstrap] Base directory candidates:', baseDirCandidates);

    // Find the first candidate where both the directory AND views/ subdirectory exist
    const baseDir =
        baseDirCandidates.find((p) => {
            if (!p || !existsSync(p)) {
                debugLog(`[Bootstrap] ✗ Candidate ${p}: directory does not exist`);
                return false;
            }
            const viewsDir = join(p, 'views');
            const exists = existsSync(viewsDir);
            debugLog(
                `[Bootstrap] ${exists ? '✓' : '✗'} Candidate ${p}: views ${exists ? 'found' : 'not found'} at ${viewsDir}`,
            );
            return exists;
        }) || baseDirCandidates[baseDirCandidates.length - 1];

    debugLog('[Bootstrap] ✓ Selected base directory:', baseDir);

    // Configure Nunjucks for template rendering
    const viewsPath = join(baseDir, 'views');
    debugLog('[Bootstrap] Views path:', viewsPath);
    debugLog('[Bootstrap] Views path exists:', existsSync(viewsPath));

    if (!existsSync(viewsPath)) {
        console.error('[Bootstrap] ✗✗✗ CRITICAL ERROR: Views directory not found! ✗✗✗');
        console.error('[Bootstrap] This usually means the build failed or views were not copied.');
        console.error('[Bootstrap] Run "npm run build" to compile and copy views to dist/');
        throw new Error(`Views directory not found at ${viewsPath}. Run "npm run build" first.`);
    }

    // Public directory - prefer packaged extraResources, fallback to repo root
    const publicPathLocal = join(baseDir, 'public');
    const publicPathRoot = join(__dirname, '..', '..', 'public');
    const publicPath = existsSync(publicPathLocal) ? publicPathLocal : publicPathRoot;

    // Configure Nunjucks
    const env = nunjucks.configure(viewsPath, {
        autoescape: true,
        watch: process.env.NODE_ENV === 'development',
    });

    // Add custom filters for Nunjucks
    env.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
    env.addFilter('safe', (str) => {
        return new nunjucks.runtime.SafeString(str);
    });

    // Asset versioning filter - generates {basePath}/{version}/path for cache busting
    let appVersion = process.env.APP_VERSION;
    if (!appVersion) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const packageJson = require(join(__dirname, '..', '..', 'package.json'));
            appVersion = `v${packageJson.version}`;
        } catch {
            appVersion = 'v0.0.0';
            console.warn('[Bootstrap] Could not load package.json for version, using fallback');
        }
    }
    env.addFilter('asset', (path: string) => {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${basePath}/${appVersion}/${cleanPath}`;
    });

    // Get TranslationService for i18n filters and global exception filter
    const translationService = app.get(TranslationService);

    // Translation filter for Nunjucks templates - {{ 'key' | trans }}
    env.addFilter('trans', (key: string, params?: Record<string, string>) => {
        return translationService.trans(key, params || {});
    });

    // Register global exception filter with translation support
    app.useGlobalFilters(new HttpExceptionFilter(translationService));

    // Register Nunjucks view engine with Fastify
    app.setViewEngine({
        engine: {
            nunjucks: env,
        },
        templates: viewsPath,
    });

    // Versioned assets hook - strip {basePath}/{version}/ prefix
    // This enables cache busting: /v3.0.0/libs/foo.js → /libs/foo.js
    fastify.addHook('onRequest', async (request, reply) => {
        const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escapedBasePath}/v[^/]+/(.*)$`);
        const versionedMatch = request.url.match(pattern);
        if (versionedMatch) {
            // Fastify request.url is read-only, modify raw.url instead
            (request.raw as any).url = (basePath || '') + '/' + versionedMatch[1];
        }
    });

    // Serve static files from the existing public directory
    await fastify.register(fastifyStatic, {
        root: publicPath,
        prefix: basePath || '/',
        decorateReply: false,
    });

    // Serve FILES_DIR (data/) under {basePath}/files/ prefix for session file access
    const filesDir = resolve(process.env.FILES_DIR || join(baseDir, 'files'));
    const filesPrefix = basePath ? `${basePath}/files` : '/files';

    if (existsSync(filesDir)) {
        // Handler for iDevice resource paths
        fastify.get(`${filesPrefix}/tmp/*`, async (request, reply) => {
            const requestPath = (request.params as any)['*'];
            const pathParts = requestPath.split('/').filter((p: string) => p);

            // Check if this matches the iDevice resource pattern
            if (pathParts.length >= 5) {
                const year = pathParts[0];
                const month = pathParts[1];
                const day = pathParts[2];
                const sessionId = pathParts[3];
                const ideviceId = pathParts[4];
                const filename = pathParts.length > 5 ? pathParts.slice(5).join('/') : pathParts[4];

                // Try content/resources path first
                const resourcePath = resolve(
                    pathParts.length > 5
                        ? join(filesDir, 'tmp', year, month, day, sessionId, 'content', 'resources', ideviceId, filename)
                        : join(filesDir, 'tmp', year, month, day, sessionId, 'content', 'resources', filename),
                );

                debugLog(`[iDevice Resource] Requested: ${requestPath}`);
                debugLog(`[iDevice Resource] Looking for: ${resourcePath}`);

                if (existsSync(resourcePath)) {
                    debugLog(`[iDevice Resource] ✓ Serving file: ${resourcePath}`);
                    const mimeType = lookup(resourcePath) || 'application/octet-stream';
                    return reply.type(mimeType).send(createReadStream(resourcePath));
                }

                // If not found, try direct path
                const directPath = resolve(join(filesDir, 'tmp', requestPath));
                if (existsSync(directPath)) {
                    debugLog(`[iDevice Resource] ✓ Serving direct file: ${directPath}`);
                    const mimeType = lookup(directPath) || 'application/octet-stream';
                    return reply.type(mimeType).send(createReadStream(directPath));
                }

                debugLog(`[iDevice Resource] ✗ File not found`);
            }

            // Try serving as direct file
            const directPath = resolve(join(filesDir, 'tmp', requestPath));
            if (existsSync(directPath)) {
                const mimeType = lookup(directPath) || 'application/octet-stream';
                return reply.type(mimeType).send(createReadStream(directPath));
            }

            return reply.code(404).send({ error: 'File not found' });
        });

        // Register static serving for other files in filesDir
        await fastify.register(fastifyStatic, {
            root: filesDir,
            prefix: filesPrefix,
            decorateReply: false,
        });

        debugLog(`Serving session files from: ${filesDir} at ${filesPrefix}/`);
    } else {
        debugLog(`FILES_DIR not found: ${filesDir}`);
    }

    // Seed the database (creates tables and test user if needed)
    try {
        const dataSource = app.get(DataSource);
        await seedDatabase(dataSource);
    } catch (error) {
        console.warn('[Bootstrap] Database seeding skipped:', error.message);
    }

    // Port configuration:
    // - NEST_PORT: for local development (e.g., 3001)
    // - Default 8080: standard port inside Docker container
    const port = process.env.NEST_PORT || 8080;
    await app.listen(port, '0.0.0.0');

    // Initialize WebSocket service with the HTTP server
    const httpServer = app.getHttpServer();
    const yjsWebSocketService = app.get(YjsWebSocketService);
    yjsWebSocketService.initialize(httpServer);

    const baseUrl = basePath ? `http://localhost:${port}${basePath}` : `http://localhost:${port}`;
    console.log(`NestJS application is running on: ${baseUrl}`);
    console.log(`Environment: APP_ENV=${process.env.APP_ENV || 'prod'}, APP_DEBUG=${process.env.APP_DEBUG || '0'}`);
    debugLog(`WebSocket relay available at: ws://localhost:${port}${basePath}/yjs/<documentName>`);
}

bootstrap();
