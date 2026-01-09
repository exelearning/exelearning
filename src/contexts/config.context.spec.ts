/**
 * ConfigContext Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createConfigContext, getConfig, resetConfigContext, setConfigContext } from './config.context';

describe('ConfigContext', () => {
    beforeEach(() => {
        resetConfigContext();
    });

    afterEach(() => {
        resetConfigContext();
    });

    describe('createConfigContext', () => {
        it('should create config with default values when env is empty', () => {
            const config = createConfigContext({});

            expect(config.env).toBe('prod');
            expect(config.debug).toBe(false);
            expect(config.onlineMode).toBe(true);
            expect(config.port).toBe(8080);
            expect(config.basePath).toBe('');
        });

        it('should parse APP_ENV correctly', () => {
            const devConfig = createConfigContext({ APP_ENV: 'dev' });
            expect(devConfig.env).toBe('dev');

            const testConfig = createConfigContext({ APP_ENV: 'test' });
            expect(testConfig.env).toBe('test');

            const prodConfig = createConfigContext({ APP_ENV: 'prod' });
            expect(prodConfig.env).toBe('prod');
        });

        it('should parse boolean values correctly', () => {
            const trueConfig = createConfigContext({ APP_DEBUG: 'true' });
            expect(trueConfig.debug).toBe(true);

            const oneConfig = createConfigContext({ APP_DEBUG: '1' });
            expect(oneConfig.debug).toBe(true);

            const yesConfig = createConfigContext({ APP_DEBUG: 'yes' });
            expect(yesConfig.debug).toBe(true);

            const falseConfig = createConfigContext({ APP_DEBUG: 'false' });
            expect(falseConfig.debug).toBe(false);

            const zeroConfig = createConfigContext({ APP_DEBUG: '0' });
            expect(zeroConfig.debug).toBe(false);
        });

        it('should parse port from multiple env variables', () => {
            const appPortConfig = createConfigContext({ APP_PORT: '3000' });
            expect(appPortConfig.port).toBe(3000);

            const portConfig = createConfigContext({ PORT: '4000' });
            expect(portConfig.port).toBe(4000);

            const nestPortConfig = createConfigContext({ NEST_PORT: '5000' });
            expect(nestPortConfig.port).toBe(5000);

            // APP_PORT takes precedence
            const bothConfig = createConfigContext({ APP_PORT: '3000', PORT: '4000' });
            expect(bothConfig.port).toBe(3000);
        });

        it('should use custom cwd function for path resolution', () => {
            const config = createConfigContext({}, () => '/custom/path');
            expect(config.filesDir).toBe('/custom/path/data');
            expect(config.publicDir).toBe('/custom/path/public');
        });
    });

    describe('Database configuration', () => {
        it('should default to SQLite dialect', () => {
            const config = createConfigContext({});
            expect(config.db.dialect).toBe('sqlite');
            expect(config.db.path).toBe('data/exelearning.db');
        });

        it('should parse pdo_sqlite driver', () => {
            const config = createConfigContext({ DB_DRIVER: 'pdo_sqlite' });
            expect(config.db.dialect).toBe('sqlite');
        });

        it('should parse MySQL variants', () => {
            const pdoMysql = createConfigContext({ DB_DRIVER: 'pdo_mysql' });
            expect(pdoMysql.db.dialect).toBe('mysql');

            const mysql = createConfigContext({ DB_DRIVER: 'mysql' });
            expect(mysql.db.dialect).toBe('mysql');

            const mysql2 = createConfigContext({ DB_DRIVER: 'mysql2' });
            expect(mysql2.db.dialect).toBe('mysql');

            const mariadb = createConfigContext({ DB_DRIVER: 'mariadb' });
            expect(mariadb.db.dialect).toBe('mysql');
        });

        it('should parse PostgreSQL variants', () => {
            const pdoPgsql = createConfigContext({ DB_DRIVER: 'pdo_pgsql' });
            expect(pdoPgsql.db.dialect).toBe('postgres');

            const pgsql = createConfigContext({ DB_DRIVER: 'pgsql' });
            expect(pgsql.db.dialect).toBe('postgres');

            const postgres = createConfigContext({ DB_DRIVER: 'postgres' });
            expect(postgres.db.dialect).toBe('postgres');
        });

        it('should set correct default ports per dialect', () => {
            const sqlite = createConfigContext({ DB_DRIVER: 'sqlite' });
            expect(sqlite.db.port).toBe(0);

            const mysql = createConfigContext({ DB_DRIVER: 'mysql' });
            expect(mysql.db.port).toBe(3306);

            const postgres = createConfigContext({ DB_DRIVER: 'postgres' });
            expect(postgres.db.port).toBe(5432);
        });

        it('should set correct default charset per dialect', () => {
            const mysql = createConfigContext({ DB_DRIVER: 'mysql' });
            expect(mysql.db.charset).toBe('utf8mb4');

            const postgres = createConfigContext({ DB_DRIVER: 'postgres' });
            expect(postgres.db.charset).toBe('utf8');
        });

        it('should parse database connection settings', () => {
            const config = createConfigContext({
                DB_DRIVER: 'postgres',
                DB_HOST: 'db.example.com',
                DB_PORT: '5433',
                DB_NAME: 'mydb',
                DB_USER: 'myuser',
                DB_PASSWORD: 'mypassword',
                DB_POOL_MIN: '2',
                DB_POOL_MAX: '20',
            });

            expect(config.db.host).toBe('db.example.com');
            expect(config.db.port).toBe(5433);
            expect(config.db.name).toBe('mydb');
            expect(config.db.user).toBe('myuser');
            expect(config.db.password).toBe('mypassword');
            expect(config.db.poolMin).toBe(2);
            expect(config.db.poolMax).toBe(20);
        });
    });

    describe('Redis configuration', () => {
        it('should be disabled by default', () => {
            const config = createConfigContext({});
            expect(config.redis.enabled).toBe(false);
            expect(config.redis.host).toBe('');
        });

        it('should be enabled when REDIS_HOST is set', () => {
            const config = createConfigContext({
                REDIS_HOST: 'redis.example.com',
            });
            expect(config.redis.enabled).toBe(true);
            expect(config.redis.host).toBe('redis.example.com');
            expect(config.redis.port).toBe(6379);
        });

        it('should parse Redis password', () => {
            const config = createConfigContext({
                REDIS_HOST: 'localhost',
                REDIS_PORT: '6380',
                REDIS_PASSWORD: 'secret',
            });
            expect(config.redis.port).toBe(6380);
            expect(config.redis.password).toBe('secret');
        });
    });

    describe('Authentication configuration', () => {
        it('should default to password auth', () => {
            const config = createConfigContext({});
            expect(config.auth.methods).toEqual(['password']);
        });

        it('should parse multiple auth methods', () => {
            const config = createConfigContext({
                APP_AUTH_METHODS: 'password,cas,openid,guest',
            });
            expect(config.auth.methods).toEqual(['password', 'cas', 'openid', 'guest']);
        });

        it('should filter invalid auth methods', () => {
            const config = createConfigContext({
                APP_AUTH_METHODS: 'password,invalid,cas,unknown',
            });
            expect(config.auth.methods).toEqual(['password', 'cas']);
        });

        it('should parse auth settings', () => {
            const config = createConfigContext({
                AUTH_CREATE_USERS: 'false',
                AUTH_TEMP_EMAIL_DOMAIN: 'custom.domain',
                API_JWT_SECRET: 'supersecret',
                API_JWT_ISSUER: 'myissuer',
                API_JWT_AUDIENCE: 'myaudience',
            });

            expect(config.auth.createUsers).toBe(false);
            expect(config.auth.tempEmailDomain).toBe('custom.domain');
            expect(config.auth.jwtSecret).toBe('supersecret');
            expect(config.auth.jwtIssuer).toBe('myissuer');
            expect(config.auth.jwtAudience).toBe('myaudience');
        });
    });

    describe('CAS configuration', () => {
        it('should parse CAS settings', () => {
            const config = createConfigContext({
                CAS_URL: 'https://cas.example.com',
                CAS_VALIDATE_PATH: '/validate',
                CAS_LOGIN_PATH: '/auth',
                CAS_LOGOUT_PATH: '/exit',
            });

            expect(config.cas.url).toBe('https://cas.example.com');
            expect(config.cas.validatePath).toBe('/validate');
            expect(config.cas.loginPath).toBe('/auth');
            expect(config.cas.logoutPath).toBe('/exit');
        });
    });

    describe('OIDC configuration', () => {
        it('should parse OIDC settings', () => {
            const config = createConfigContext({
                OIDC_ISSUER: 'https://oidc.example.com',
                OIDC_AUTHORIZATION_ENDPOINT: 'https://oidc.example.com/auth',
                OIDC_TOKEN_ENDPOINT: 'https://oidc.example.com/token',
                OIDC_USERINFO_ENDPOINT: 'https://oidc.example.com/userinfo',
                OIDC_SCOPE: 'openid profile email',
                OIDC_CLIENT_ID: 'myclient',
                OIDC_CLIENT_SECRET: 'myclientsecret',
            });

            expect(config.oidc.issuer).toBe('https://oidc.example.com');
            expect(config.oidc.authorizationEndpoint).toBe('https://oidc.example.com/auth');
            expect(config.oidc.tokenEndpoint).toBe('https://oidc.example.com/token');
            expect(config.oidc.userinfoEndpoint).toBe('https://oidc.example.com/userinfo');
            expect(config.oidc.scope).toBe('openid profile email');
            expect(config.oidc.clientId).toBe('myclient');
            expect(config.oidc.clientSecret).toBe('myclientsecret');
        });
    });

    describe('Storage configuration', () => {
        it('should use default storage values', () => {
            const config = createConfigContext({});
            expect(config.storage.maxDiskSpaceMb).toBe(1024);
            expect(config.storage.defaultQuotaMb).toBe(4096);
            expect(config.storage.countAutosaveSpace).toBe(true);
            expect(config.storage.maxUploadSizeMb).toBe(1024);
        });

        it('should parse storage settings', () => {
            const config = createConfigContext({
                USER_STORAGE_MAX_DISK_SPACE: '2048',
                DEFAULT_QUOTA: '8192',
                COUNT_USER_AUTOSAVE_SPACE_ODE_FILES: 'false',
                FILE_UPLOAD_MAX_SIZE: '512',
            });

            expect(config.storage.maxDiskSpaceMb).toBe(2048);
            expect(config.storage.defaultQuotaMb).toBe(8192);
            expect(config.storage.countAutosaveSpace).toBe(false);
            expect(config.storage.maxUploadSizeMb).toBe(512);
        });
    });

    describe('Autosave configuration', () => {
        it('should use default autosave values', () => {
            const config = createConfigContext({});
            expect(config.autosave.enabled).toBe(true);
            expect(config.autosave.intervalSeconds).toBe(600);
            expect(config.autosave.maxFiles).toBe(10);
        });

        it('should parse autosave settings', () => {
            const config = createConfigContext({
                AUTOSAVE_ODE_FILES_FUNCTION: 'false',
                PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL: '300',
                PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES: '5',
            });

            expect(config.autosave.enabled).toBe(false);
            expect(config.autosave.intervalSeconds).toBe(300);
            expect(config.autosave.maxFiles).toBe(5);
        });
    });

    describe('Cleanup configuration', () => {
        it('should be disabled by default', () => {
            const config = createConfigContext({});
            expect(config.cleanup.enabled).toBe(false);
            expect(config.cleanup.intervalHours).toBe(24);
            expect(config.cleanup.unsavedAgeHours).toBe(24);
            expect(config.cleanup.guestAgeDays).toBe(7);
        });

        it('should parse cleanup settings', () => {
            const config = createConfigContext({
                CLEANUP_ENABLED: 'true',
                CLEANUP_INTERVAL_HOURS: '12',
                CLEANUP_UNSAVED_AGE_HOURS: '48',
                CLEANUP_GUEST_AGE_DAYS: '14',
            });

            expect(config.cleanup.enabled).toBe(true);
            expect(config.cleanup.intervalHours).toBe(12);
            expect(config.cleanup.unsavedAgeHours).toBe(48);
            expect(config.cleanup.guestAgeDays).toBe(14);
        });
    });

    describe('Feature configuration', () => {
        it('should use default feature values', () => {
            const config = createConfigContext({});
            expect(config.features.onlineThemesInstall).toBe(false);
            expect(config.features.onlineIdevicesInstall).toBe(false);
            expect(config.features.versionControl).toBe(true);
            expect(config.features.defaultProjectVisibility).toBe('private');
            expect(config.features.collaborativeBlockLevel).toBe('idevice');
            expect(config.features.recentFilesAmount).toBe(3);
        });

        it('should parse feature settings', () => {
            const config = createConfigContext({
                ONLINE_THEMES_INSTALL: '1',
                ONLINE_IDEVICES_INSTALL: '1',
                VERSION_CONTROL: 'false',
                DEFAULT_PROJECT_VISIBILITY: 'public',
                COLLABORATIVE_BLOCK_LEVEL: 'page',
                USER_RECENT_ODE_FILES_AMOUNT: '5',
            });

            expect(config.features.onlineThemesInstall).toBe(true);
            expect(config.features.onlineIdevicesInstall).toBe(true);
            expect(config.features.versionControl).toBe(false);
            expect(config.features.defaultProjectVisibility).toBe('public');
            expect(config.features.collaborativeBlockLevel).toBe('page');
            expect(config.features.recentFilesAmount).toBe(5);
        });
    });

    describe('Test user configuration', () => {
        it('should include test user in dev environment', () => {
            const config = createConfigContext({
                APP_ENV: 'dev',
                TEST_USER_EMAIL: 'test@example.com',
                TEST_USER_USERNAME: 'testuser',
                TEST_USER_PASSWORD: 'testpass',
            });

            expect(config.testUser).toBeDefined();
            expect(config.testUser?.email).toBe('test@example.com');
            expect(config.testUser?.username).toBe('testuser');
            expect(config.testUser?.password).toBe('testpass');
        });

        it('should include test user in test environment', () => {
            const config = createConfigContext({ APP_ENV: 'test' });
            expect(config.testUser).toBeDefined();
        });

        it('should not include test user in prod environment', () => {
            const config = createConfigContext({ APP_ENV: 'prod' });
            expect(config.testUser).toBeUndefined();
        });
    });

    describe('Path configuration', () => {
        it('should prefer ELYSIA_FILES_DIR over FILES_DIR', () => {
            const config = createConfigContext({
                ELYSIA_FILES_DIR: '/elysia/data',
                FILES_DIR: '/files/data',
            });
            expect(config.filesDir).toBe('/elysia/data');
        });

        it('should use FILES_DIR when ELYSIA_FILES_DIR is not set', () => {
            const config = createConfigContext({
                FILES_DIR: '/files/data',
            });
            expect(config.filesDir).toBe('/files/data');
        });
    });

    describe('Immutability', () => {
        it('should return frozen config object', () => {
            const config = createConfigContext({});
            expect(Object.isFrozen(config)).toBe(true);
        });

        it('should have frozen sub-configurations', () => {
            const config = createConfigContext({});
            expect(Object.isFrozen(config.db)).toBe(true);
            expect(Object.isFrozen(config.redis)).toBe(true);
            expect(Object.isFrozen(config.auth)).toBe(true);
            expect(Object.isFrozen(config.cas)).toBe(true);
            expect(Object.isFrozen(config.oidc)).toBe(true);
            expect(Object.isFrozen(config.storage)).toBe(true);
            expect(Object.isFrozen(config.autosave)).toBe(true);
            expect(Object.isFrozen(config.cleanup)).toBe(true);
            expect(Object.isFrozen(config.features)).toBe(true);
        });
    });

    describe('getConfig singleton', () => {
        it('should return the same instance on multiple calls', () => {
            const config1 = getConfig();
            const config2 = getConfig();
            expect(config1).toBe(config2);
        });

        it('should reset with resetConfigContext', () => {
            const config1 = getConfig();
            resetConfigContext();
            const config2 = getConfig();
            // They may be equal but should be different instances
            expect(config1).not.toBe(config2);
        });

        it('should use custom config with setConfigContext', () => {
            const customConfig = createConfigContext({ APP_PORT: '9999' });
            setConfigContext(customConfig);
            const config = getConfig();
            expect(config.port).toBe(9999);
        });
    });
});
