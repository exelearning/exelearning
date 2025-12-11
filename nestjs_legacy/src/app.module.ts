import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionUserMiddleware } from './middleware/session-user.middleware';
import { HealthModule } from './modules/health/health.module';
import { WorkareaModule } from './modules/workarea/workarea.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { PagesModule } from './modules/pages/pages.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { SessionModule } from './modules/session/session.module';
import { ExportModule } from './modules/export/export.module';
import { StaticFilesModule } from './modules/static-files/static-files.module';
import { IDeviceModule } from './modules/idevice/idevice.module';
import { FilemanagerModule } from './modules/filemanager/filemanager.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { YjsStorageModule } from './modules/yjs-storage/yjs-storage.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TranslationModule } from './modules/translation/translation.module';
import { ResourcesModule } from './modules/resources/resources.module';
import * as path from 'path';
import * as fs from 'fs';
import databaseConfig from './config/database.config';
import {
    mapPdoDriverToTypeOrm,
    isSqlite,
    getDefaultPort,
    getDefaultCharset,
    TypeOrmDriver,
} from './config/database-driver.helper';
import {
    handleLegacySQLite,
    handleLegacyDatabaseSQL,
} from './config/legacy-database.handler';
import { DataSource } from 'typeorm';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../.env'], // Load local .env first (takes precedence), then parent .env
            load: [databaseConfig],
        }),

        // Database - supports SQLite (sql.js), MySQL, and PostgreSQL
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const logger = new Logger('DatabaseInit');

                // Determine database driver from environment
                const pdoDriver = configService.get<string>('DB_DRIVER');
                const driver: TypeOrmDriver = mapPdoDriverToTypeOrm(pdoDriver);

                // Use APP_ENV and APP_DEBUG for environment control
                const appEnv = configService.get<string>('APP_ENV') || 'prod';
                const appDebug = configService.get<string>('APP_DEBUG') === '1';
                const isDevEnv = appEnv === 'dev';

                logger.log(`Database driver: ${driver} (from DB_DRIVER=${pdoDriver || 'default'})`);
                logger.log(`Environment: APP_ENV=${appEnv}, APP_DEBUG=${appDebug ? '1' : '0'}`);

                // Common TypeORM options
                const commonOptions = {
                    entities: [__dirname + '/**/*.entity{.ts,.js}'],
                    synchronize: isDevEnv,      // Only sync schema in dev
                    migrationsRun: true,
                    migrations: [path.join(__dirname, 'migrations/**/*{.ts,.js}')],
                    logging: appDebug,          // SQL logging when APP_DEBUG=1
                };

                // SQLite configuration (sql.js)
                if (isSqlite(pdoDriver)) {
                    const dbPathFromEnv =
                        configService.get<string>('DB_PATH') || 'data/exelearning.db';
                    const dbPath = path.isAbsolute(dbPathFromEnv)
                        ? dbPathFromEnv
                        : path.resolve(process.cwd(), dbPathFromEnv);
                    const dbDir = path.dirname(dbPath);

                    if (!fs.existsSync(dbDir)) {
                        fs.mkdirSync(dbDir, { recursive: true });
                    }

                    // Check for legacy Symfony database and handle migration (SQLite only)
                    const initialDb = await handleLegacySQLite(dbPath, logger);

                    logger.log(`SQLite database path: ${dbPath}`);

                    return {
                        type: 'sqljs',
                        database: initialDb,
                        location: dbPath,
                        autoSave: true,
                        autoSaveInterval: 1000,
                        ...commonOptions,
                    } as any;
                }

                // MySQL/MariaDB configuration
                if (driver === 'mysql') {
                    const host = configService.get<string>('DB_HOST') || 'localhost';
                    const port =
                        parseInt(configService.get<string>('DB_PORT'), 10) ||
                        getDefaultPort('mysql');
                    const database = configService.get<string>('DB_NAME') || 'exelearning';
                    const username = configService.get<string>('DB_USER') || 'root';
                    const password = configService.get<string>('DB_PASSWORD') || '';
                    const charset =
                        configService.get<string>('DB_CHARSET') || getDefaultCharset('mysql');

                    logger.log(`MySQL database: ${username}@${host}:${port}/${database}`);

                    // Check for legacy Symfony database and rename old tables
                    try {
                        const tempDataSource = new DataSource({
                            type: 'mysql',
                            host,
                            port,
                            database,
                            username,
                            password,
                            charset,
                        });
                        await tempDataSource.initialize();
                        await handleLegacyDatabaseSQL(tempDataSource, logger);
                        await tempDataSource.destroy();
                    } catch (error) {
                        logger.warn(`Could not check for legacy tables: ${error.message}`);
                    }

                    return {
                        type: 'mysql',
                        host,
                        port,
                        database,
                        username,
                        password,
                        charset,
                        ...commonOptions,
                    } as any;
                }

                // PostgreSQL configuration
                if (driver === 'postgres') {
                    const host = configService.get<string>('DB_HOST') || 'localhost';
                    const port =
                        parseInt(configService.get<string>('DB_PORT'), 10) ||
                        getDefaultPort('postgres');
                    const database = configService.get<string>('DB_NAME') || 'exelearning';
                    const username = configService.get<string>('DB_USER') || 'postgres';
                    const password = configService.get<string>('DB_PASSWORD') || '';

                    logger.log(`PostgreSQL database: ${username}@${host}:${port}/${database}`);

                    // Check for legacy Symfony database and rename old tables
                    try {
                        const tempDataSource = new DataSource({
                            type: 'postgres',
                            host,
                            port,
                            database,
                            username,
                            password,
                        });
                        await tempDataSource.initialize();
                        await handleLegacyDatabaseSQL(tempDataSource, logger);
                        await tempDataSource.destroy();
                    } catch (error) {
                        logger.warn(`Could not check for legacy tables: ${error.message}`);
                    }

                    return {
                        type: 'postgres',
                        host,
                        port,
                        database,
                        username,
                        password,
                        ...commonOptions,
                    } as any;
                }

                // Fallback to SQLite (should not reach here)
                logger.warn(`Unknown driver "${driver}", falling back to SQLite`);
                const dbPath = path.resolve(process.cwd(), 'data/exelearning.db');
                return {
                    type: 'sqljs',
                    database: new Uint8Array(),
                    location: dbPath,
                    autoSave: true,
                    autoSaveInterval: 1000,
                    ...commonOptions,
                } as any;
            },
            inject: [ConfigService],
        }),

        // Feature modules
        HealthModule,
        WorkareaModule,
        AuthModule,
        CollaborationModule, // NEW: Yjs WebSocket collaboration
        YjsStorageModule, // NEW: Yjs document persistence
        ProjectsModule, // NEW: Yjs-based project management (v2 API)
        AssetsModule, // NEW: Asset management for Yjs projects
        ProjectModule, // Legacy ODE-based project management
        PagesModule,
        ExportModule,
        FilemanagerModule,
        UserPreferencesModule,
        SessionModule,
        StaticFilesModule,
        IDeviceModule,
        TranslationModule,
        ResourcesModule, // Resources API for client-side exports
    ],
    controllers: [],
    providers: [],
})
export class AppModule implements NestModule {
    /**
     * Configure middleware
     * Registers SessionUserMiddleware globally to populate req.user from req.session
     */
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(SessionUserMiddleware).forRoutes('*'); // Apply to all routes
    }
}
