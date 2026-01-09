/**
 * ConfigContext - Centralized Configuration Management
 *
 * Replaces scattered process.env reads with a validated, typed configuration object.
 * All configuration is read once at startup, validated, and frozen.
 *
 * Usage:
 *   import { getConfig, createConfigContext } from './contexts/config.context';
 *
 *   // Production: use default singleton
 *   const config = getConfig();
 *
 *   // Testing: create isolated instance
 *   const testConfig = createConfigContext({ APP_PORT: '3000', ... });
 */
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type DbDialect = 'sqlite' | 'postgres' | 'mysql';
export type AuthMethod = 'none' | 'password' | 'cas' | 'openid' | 'guest';
export type CollaborativeBlockLevel = 'page' | 'idevice';
export type ProjectVisibility = 'private' | 'public';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Database configuration
 */
export interface DbConfig {
    readonly dialect: DbDialect;
    readonly path?: string;
    readonly host: string;
    readonly port: number;
    readonly name: string;
    readonly user: string;
    readonly password: string;
    readonly charset: string;
    readonly poolMin: number;
    readonly poolMax: number;
}

/**
 * Redis configuration
 */
export interface RedisConfig {
    readonly enabled: boolean;
    readonly host: string;
    readonly port: number;
    readonly password: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
    readonly methods: AuthMethod[];
    readonly createUsers: boolean;
    readonly tempEmailDomain: string;
    readonly jwtSecret: string;
    readonly jwtIssuer: string;
    readonly jwtAudience: string;
}

/**
 * CAS configuration
 */
export interface CasConfig {
    readonly url: string;
    readonly validatePath: string;
    readonly loginPath: string;
    readonly logoutPath: string;
}

/**
 * OpenID Connect configuration
 */
export interface OidcConfig {
    readonly issuer: string;
    readonly authorizationEndpoint: string;
    readonly tokenEndpoint: string;
    readonly userinfoEndpoint: string;
    readonly scope: string;
    readonly clientId: string;
    readonly clientSecret: string;
}

/**
 * Storage and quota configuration
 */
export interface StorageConfig {
    readonly maxDiskSpaceMb: number;
    readonly defaultQuotaMb: number;
    readonly countAutosaveSpace: boolean;
    readonly maxUploadSizeMb: number;
}

/**
 * Autosave configuration
 */
export interface AutosaveConfig {
    readonly enabled: boolean;
    readonly intervalSeconds: number;
    readonly maxFiles: number;
}

/**
 * Cleanup configuration
 */
export interface CleanupConfig {
    readonly enabled: boolean;
    readonly intervalHours: number;
    readonly unsavedAgeHours: number;
    readonly guestAgeDays: number;
}

/**
 * Feature flags
 */
export interface FeatureConfig {
    readonly onlineThemesInstall: boolean;
    readonly onlineIdevicesInstall: boolean;
    readonly versionControl: boolean;
    readonly defaultProjectVisibility: ProjectVisibility;
    readonly collaborativeBlockLevel: CollaborativeBlockLevel;
    readonly recentFilesAmount: number;
}

/**
 * Complete application configuration
 */
export interface ConfigContext {
    // Application core
    readonly env: 'dev' | 'prod' | 'test';
    readonly debug: boolean;
    readonly secret: string;
    readonly onlineMode: boolean;
    readonly port: number;
    readonly basePath: string;

    // Paths
    readonly filesDir: string;
    readonly publicDir: string;
    readonly cacheDir: string;
    readonly logDir: string;

    // Logging
    readonly logLevel: LogLevel;

    // Sub-configurations
    readonly db: DbConfig;
    readonly redis: RedisConfig;
    readonly auth: AuthConfig;
    readonly cas: CasConfig;
    readonly oidc: OidcConfig;
    readonly storage: StorageConfig;
    readonly autosave: AutosaveConfig;
    readonly cleanup: CleanupConfig;
    readonly features: FeatureConfig;

    // Test credentials (only populated in dev/test environments)
    readonly testUser?: {
        readonly email: string;
        readonly username: string;
        readonly password: string;
    };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === '') return defaultValue;
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
}

function parseIntValue(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === '') return defaultValue;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseString(value: string | undefined, defaultValue: string): string {
    return value?.trim() || defaultValue;
}

function parseDbDialect(driver: string | undefined): DbDialect {
    const d = (driver || 'pdo_sqlite').toLowerCase();
    switch (d) {
        case 'pdo_mysql':
        case 'mysql':
        case 'mysql2':
        case 'mariadb':
            return 'mysql';
        case 'pdo_pgsql':
        case 'pgsql':
        case 'postgres':
        case 'postgresql':
            return 'postgres';
        default:
            return 'sqlite';
    }
}

function parseAuthMethods(value: string | undefined): AuthMethod[] {
    if (!value || value.trim() === '') return ['password'];
    const methods = value.split(',').map(m => m.trim().toLowerCase() as AuthMethod);
    const valid: AuthMethod[] = ['none', 'password', 'cas', 'openid', 'guest'];
    return methods.filter(m => valid.includes(m));
}

function parseLogLevel(value: string | undefined): LogLevel {
    const level = (value || 'info').toLowerCase() as LogLevel;
    const valid: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return valid.includes(level) ? level : 'info';
}

function parseProjectVisibility(value: string | undefined): ProjectVisibility {
    const v = (value || 'private').toLowerCase();
    return v === 'public' ? 'public' : 'private';
}

function parseBlockLevel(value: string | undefined): CollaborativeBlockLevel {
    const v = (value || 'idevice').toLowerCase();
    return v === 'page' ? 'page' : 'idevice';
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ConfigContext from environment variables
 *
 * @param env - Environment variable source (defaults to process.env)
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Frozen ConfigContext object
 */
export function createConfigContext(
    env: Record<string, string | undefined> = process.env,
    cwd: () => string = () => process.cwd(),
): ConfigContext {
    // Application core
    const appEnv = parseString(env.APP_ENV, 'prod') as 'dev' | 'prod' | 'test';
    const debug = parseBoolean(env.APP_DEBUG, false);
    const secret = parseString(env.APP_SECRET, '');
    const onlineMode = parseBoolean(env.APP_ONLINE_MODE, true);
    const port = parseIntValue(env.APP_PORT || env.PORT || env.NEST_PORT, 8080);
    const basePath = parseString(env.BASE_PATH, '');

    // Paths
    const filesDir = parseString(env.ELYSIA_FILES_DIR || env.FILES_DIR, join(cwd(), 'data'));
    const publicDir = parseString(env.PUBLIC_DIR, join(cwd(), 'public'));
    const cacheDir = parseString(env.CACHE_DIR, '');
    const logDir = parseString(env.LOG_DIR, '');

    // Logging
    const logLevel = parseLogLevel(env.LOG_LEVEL);

    // Database
    const dbDialect = parseDbDialect(env.DB_DRIVER);
    const db: DbConfig = Object.freeze({
        dialect: dbDialect,
        path: dbDialect === 'sqlite' ? parseString(env.DB_PATH, 'data/exelearning.db') : undefined,
        host: parseString(env.DB_HOST, 'localhost'),
        port: parseIntValue(env.DB_PORT, dbDialect === 'postgres' ? 5432 : dbDialect === 'mysql' ? 3306 : 0),
        name: parseString(env.DB_NAME, 'exelearning'),
        user: parseString(env.DB_USER, 'exelearning'),
        password: parseString(env.DB_PASSWORD, ''),
        charset: parseString(env.DB_CHARSET, dbDialect === 'mysql' ? 'utf8mb4' : 'utf8'),
        poolMin: parseIntValue(env.DB_POOL_MIN, 0),
        poolMax: parseIntValue(env.DB_POOL_MAX, 10),
    });

    // Redis
    const redisHost = parseString(env.REDIS_HOST, '');
    const redis: RedisConfig = Object.freeze({
        enabled: redisHost.length > 0,
        host: redisHost,
        port: parseIntValue(env.REDIS_PORT, 6379),
        password: parseString(env.REDIS_PASSWORD, ''),
    });

    // Authentication
    const auth: AuthConfig = Object.freeze({
        methods: parseAuthMethods(env.APP_AUTH_METHODS),
        createUsers: parseBoolean(env.AUTH_CREATE_USERS, true),
        tempEmailDomain: parseString(env.AUTH_TEMP_EMAIL_DOMAIN, 'domain.local'),
        jwtSecret: parseString(env.API_JWT_SECRET, 'dev_secret_change_me'),
        jwtIssuer: parseString(env.API_JWT_ISSUER, ''),
        jwtAudience: parseString(env.API_JWT_AUDIENCE, ''),
    });

    // CAS
    const cas: CasConfig = Object.freeze({
        url: parseString(env.CAS_URL, ''),
        validatePath: parseString(env.CAS_VALIDATE_PATH, '/p3/serviceValidate'),
        loginPath: parseString(env.CAS_LOGIN_PATH, '/login'),
        logoutPath: parseString(env.CAS_LOGOUT_PATH, '/logout'),
    });

    // OIDC
    const oidc: OidcConfig = Object.freeze({
        issuer: parseString(env.OIDC_ISSUER, ''),
        authorizationEndpoint: parseString(env.OIDC_AUTHORIZATION_ENDPOINT, ''),
        tokenEndpoint: parseString(env.OIDC_TOKEN_ENDPOINT, ''),
        userinfoEndpoint: parseString(env.OIDC_USERINFO_ENDPOINT, ''),
        scope: parseString(env.OIDC_SCOPE, 'openid email'),
        clientId: parseString(env.OIDC_CLIENT_ID, ''),
        clientSecret: parseString(env.OIDC_CLIENT_SECRET, ''),
    });

    // Storage
    const storage: StorageConfig = Object.freeze({
        maxDiskSpaceMb: parseIntValue(env.USER_STORAGE_MAX_DISK_SPACE, 1024),
        defaultQuotaMb: parseIntValue(env.DEFAULT_QUOTA, 4096),
        countAutosaveSpace: parseBoolean(env.COUNT_USER_AUTOSAVE_SPACE_ODE_FILES, true),
        maxUploadSizeMb: parseIntValue(env.FILE_UPLOAD_MAX_SIZE, 1024),
    });

    // Autosave
    const autosave: AutosaveConfig = Object.freeze({
        enabled: parseBoolean(env.AUTOSAVE_ODE_FILES_FUNCTION, true),
        intervalSeconds: parseIntValue(env.PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL, 600),
        maxFiles: parseIntValue(env.PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES, 10),
    });

    // Cleanup
    const cleanup: CleanupConfig = Object.freeze({
        enabled: parseBoolean(env.CLEANUP_ENABLED, false),
        intervalHours: parseIntValue(env.CLEANUP_INTERVAL_HOURS, 24),
        unsavedAgeHours: parseIntValue(env.CLEANUP_UNSAVED_AGE_HOURS, 24),
        guestAgeDays: parseIntValue(env.CLEANUP_GUEST_AGE_DAYS, 7),
    });

    // Features
    const features: FeatureConfig = Object.freeze({
        onlineThemesInstall: parseBoolean(env.ONLINE_THEMES_INSTALL, false),
        onlineIdevicesInstall: parseBoolean(env.ONLINE_IDEVICES_INSTALL, false),
        versionControl: parseBoolean(env.VERSION_CONTROL, true),
        defaultProjectVisibility: parseProjectVisibility(env.DEFAULT_PROJECT_VISIBILITY),
        collaborativeBlockLevel: parseBlockLevel(env.COLLABORATIVE_BLOCK_LEVEL),
        recentFilesAmount: parseIntValue(env.USER_RECENT_ODE_FILES_AMOUNT, 3),
    });

    // Test user (only in non-prod)
    const testUser =
        appEnv !== 'prod'
            ? Object.freeze({
                  email: parseString(env.TEST_USER_EMAIL, 'user@exelearning.net'),
                  username: parseString(env.TEST_USER_USERNAME, 'user'),
                  password: parseString(env.TEST_USER_PASSWORD, '1234'),
              })
            : undefined;

    return Object.freeze({
        env: appEnv,
        debug,
        secret,
        onlineMode,
        port,
        basePath,
        filesDir,
        publicDir,
        cacheDir,
        logDir,
        logLevel,
        db,
        redis,
        auth,
        cas,
        oidc,
        storage,
        autosave,
        cleanup,
        features,
        testUser,
    });
}

// ============================================================================
// DEFAULT SINGLETON
// ============================================================================

let _config: ConfigContext | null = null;

/**
 * Get the default ConfigContext singleton
 * Created lazily on first access
 */
export function getConfig(): ConfigContext {
    if (!_config) {
        _config = createConfigContext();
    }
    return _config;
}

/**
 * Reset the default ConfigContext (for testing only)
 */
export function resetConfigContext(): void {
    _config = null;
}

/**
 * Set a custom ConfigContext as the default (for testing only)
 */
export function setConfigContext(config: ConfigContext): void {
    _config = config;
}
