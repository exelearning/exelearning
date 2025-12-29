/**
 * System Information Service
 * Provides runtime, database, memory, OS, disk and Docker information for admin dashboard
 */
import os from 'node:os';
import fs from 'node:fs';
import { getDbConfig } from '../db/dialect';
import { getAppVersion } from '../utils/version';

// ============================================================================
// TYPES
// ============================================================================

export interface RuntimeInfo {
    name: string;
    version: string;
    platform: string;
    arch: string;
}

export interface DatabaseInfo {
    engine: string;
    version: string;
    path?: string;
    host?: string;
    port?: number;
    database?: string;
}

export interface ApplicationInfo {
    version: string;
    environment: string;
    port: number;
    filesDir: string;
}

export interface MemoryInfo {
    total: number;
    free: number;
    used: number;
    heapUsed: number;
    heapTotal: number;
}

export interface OsInfo {
    platform: string;
    release: string;
    hostname: string;
    uptime: number;
    cpus: number;
}

export interface DockerInfo {
    isDocker: boolean;
    containerId: string | null;
}

export interface DiskInfo {
    path: string;
    total: number;
    free: number;
    available: number;
    error?: string;
}

export interface SystemInfo {
    runtime: RuntimeInfo;
    database: DatabaseInfo;
    application: ApplicationInfo;
    memory: MemoryInfo;
    os: OsInfo;
    docker: DockerInfo;
    disk: DiskInfo;
    timestamp: string;
}

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface SystemInfoDependencies {
    existsSync: typeof fs.existsSync;
    readFileSync: typeof fs.readFileSync;
    statfs: typeof fs.promises.statfs;
    osTotalmem: typeof os.totalmem;
    osFreemem: typeof os.freemem;
    osPlatform: typeof os.platform;
    osRelease: typeof os.release;
    osHostname: typeof os.hostname;
    osUptime: typeof os.uptime;
    osCpus: typeof os.cpus;
    processMemoryUsage: typeof process.memoryUsage;
    getAppVersion: typeof getAppVersion;
    getDbConfig: typeof getDbConfig;
}

const defaultDeps: SystemInfoDependencies = {
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    statfs: fs.promises.statfs,
    osTotalmem: os.totalmem,
    osFreemem: os.freemem,
    osPlatform: os.platform,
    osRelease: os.release,
    osHostname: os.hostname,
    osUptime: os.uptime,
    osCpus: os.cpus,
    processMemoryUsage: process.memoryUsage.bind(process),
    getAppVersion,
    getDbConfig,
};

let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<SystemInfoDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

// ============================================================================
// INFORMATION FUNCTIONS
// ============================================================================

/**
 * Get runtime information (Bun version, platform, architecture)
 */
export function getRuntimeInfo(): RuntimeInfo {
    // biome-ignore lint/suspicious/noExplicitAny: Bun global type
    const bunVersion = typeof (globalThis as any).Bun !== 'undefined' ? (globalThis as any).Bun.version : null;

    return {
        name: bunVersion ? 'Bun' : 'Node.js',
        version: bunVersion || process.version,
        platform: process.platform,
        arch: process.arch,
    };
}

/**
 * Get database information (engine, version, connection details)
 */
export function getDatabaseInfo(): DatabaseInfo {
    const config = deps.getDbConfig();
    const driver = process.env.DB_DRIVER || 'pdo_sqlite';

    let engine: string;
    switch (driver) {
        case 'pdo_pgsql':
            engine = 'PostgreSQL';
            break;
        case 'pdo_mysql':
            engine = 'MySQL/MariaDB';
            break;
        default:
            engine = 'SQLite';
    }

    const baseInfo: DatabaseInfo = {
        engine,
        version: process.env.DB_SERVER_VERSION || 'unknown',
    };

    // Add connection-specific info based on engine type
    if (engine === 'SQLite') {
        return {
            ...baseInfo,
            path: config.sqlitePath,
        };
    }

    return {
        ...baseInfo,
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'exelearning',
    };
}

/**
 * Get application information (version, environment, port)
 */
export function getApplicationInfo(): ApplicationInfo {
    return {
        version: deps.getAppVersion(),
        environment: process.env.APP_ENV || 'prod',
        port: Number.parseInt(process.env.APP_PORT || '8080', 10),
        filesDir: process.env.FILES_DIR || '/mnt/data',
    };
}

/**
 * Get memory information (system RAM and heap usage)
 */
export function getMemoryInfo(): MemoryInfo {
    const mem = deps.processMemoryUsage();
    const total = deps.osTotalmem();
    const free = deps.osFreemem();

    return {
        total,
        free,
        used: total - free,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
    };
}

/**
 * Get operating system information
 */
export function getOsInfo(): OsInfo {
    return {
        platform: deps.osPlatform(),
        release: deps.osRelease(),
        hostname: deps.osHostname(),
        uptime: deps.osUptime(),
        cpus: deps.osCpus().length,
    };
}

/**
 * Get Docker environment information
 */
export function getDockerInfo(): DockerInfo {
    // Check for Docker environment indicators
    const hasDockerEnv = deps.existsSync('/.dockerenv');

    let hasCgroupDocker = false;
    try {
        if (deps.existsSync('/proc/1/cgroup')) {
            const cgroup = deps.readFileSync('/proc/1/cgroup', 'utf8');
            hasCgroupDocker = cgroup.includes('docker') || cgroup.includes('kubepods');
        }
    } catch {
        // Ignore read errors (e.g., on macOS)
    }

    const isDocker = hasDockerEnv || hasCgroupDocker;

    return {
        isDocker,
        containerId: isDocker ? process.env.HOSTNAME || null : null,
    };
}

/**
 * Get disk space information for FILES_DIR
 */
export async function getDiskInfo(): Promise<DiskInfo> {
    const filesDir = process.env.FILES_DIR || '/mnt/data';

    try {
        const stats = await deps.statfs(filesDir);
        return {
            path: filesDir,
            total: stats.bsize * stats.blocks,
            free: stats.bsize * stats.bfree,
            available: stats.bsize * stats.bavail,
        };
    } catch {
        return {
            path: filesDir,
            total: 0,
            free: 0,
            available: 0,
            error: 'Unable to read disk info',
        };
    }
}

// ============================================================================
// MAIN AGGREGATOR
// ============================================================================

/**
 * Get all system information aggregated
 */
export async function getSystemInfo(): Promise<SystemInfo> {
    return {
        runtime: getRuntimeInfo(),
        database: getDatabaseInfo(),
        application: getApplicationInfo(),
        memory: getMemoryInfo(),
        os: getOsInfo(),
        docker: getDockerInfo(),
        disk: await getDiskInfo(),
        timestamp: new Date().toISOString(),
    };
}
