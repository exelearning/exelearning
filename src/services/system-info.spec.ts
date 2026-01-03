/**
 * Tests for System Information Service
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    configure,
    resetDependencies,
    getRuntimeInfo,
    getDatabaseInfo,
    getApplicationInfo,
    getMemoryInfo,
    getOsInfo,
    getDockerInfo,
    getDiskInfo,
    getSystemInfo,
} from './system-info';

describe('system-info', () => {
    beforeEach(() => {
        resetDependencies();
    });

    afterEach(() => {
        resetDependencies();
    });

    describe('getRuntimeInfo', () => {
        it('should return runtime information', () => {
            const info = getRuntimeInfo();

            expect(info.name).toBe('Bun');
            expect(info.version).toBeDefined();
            expect(info.platform).toBe(process.platform);
            expect(info.arch).toBe(process.arch);
        });

        it('should detect Bun runtime', () => {
            const info = getRuntimeInfo();
            // In Bun test environment, should detect Bun
            expect(info.name).toBe('Bun');
            expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
        });
    });

    describe('getDatabaseInfo', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        it('should return SQLite info by default', () => {
            configure({
                getDbConfig: () => ({ dialect: 'sqlite', sqlitePath: '/data/test.db' }),
            });

            const info = getDatabaseInfo();

            expect(info.engine).toBe('SQLite');
            expect(info.path).toBe('/data/test.db');
        });

        it('should return PostgreSQL info when configured', () => {
            process.env.DB_DRIVER = 'pdo_pgsql';
            process.env.DB_HOST = 'db.example.com';
            process.env.DB_PORT = '5432';
            process.env.DB_NAME = 'mydb';
            process.env.DB_SERVER_VERSION = '15.2';

            configure({
                getDbConfig: () => ({ dialect: 'sqlite', sqlitePath: '' }),
            });

            const info = getDatabaseInfo();

            expect(info.engine).toBe('PostgreSQL');
            expect(info.version).toBe('15.2');
            expect(info.host).toBe('db.example.com');
            expect(info.port).toBe(5432);
            expect(info.database).toBe('mydb');
        });

        it('should return MySQL info when configured', () => {
            process.env.DB_DRIVER = 'pdo_mysql';
            process.env.DB_HOST = 'mysql.example.com';
            process.env.DB_PORT = '3306';
            process.env.DB_NAME = 'exelearning';
            process.env.DB_SERVER_VERSION = '8.0';

            configure({
                getDbConfig: () => ({ dialect: 'sqlite', sqlitePath: '' }),
            });

            const info = getDatabaseInfo();

            expect(info.engine).toBe('MySQL/MariaDB');
            expect(info.version).toBe('8.0');
            expect(info.host).toBe('mysql.example.com');
            expect(info.port).toBe(3306);
        });
    });

    describe('getApplicationInfo', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        it('should return application info', () => {
            process.env.APP_ENV = 'dev';
            process.env.APP_PORT = '3000';
            process.env.FILES_DIR = '/tmp/files';

            configure({
                getAppVersion: () => 'v3.1.0',
            });

            const info = getApplicationInfo();

            expect(info.version).toBe('v3.1.0');
            expect(info.environment).toBe('dev');
            expect(info.port).toBe(3000);
            expect(info.filesDir).toBe('/tmp/files');
        });

        it('should use defaults when env vars not set', () => {
            delete process.env.APP_ENV;
            delete process.env.APP_PORT;
            delete process.env.FILES_DIR;

            configure({
                getAppVersion: () => 'v1.0.0',
            });

            const info = getApplicationInfo();

            expect(info.environment).toBe('prod');
            expect(info.port).toBe(8080);
            expect(info.filesDir).toBe('/mnt/data');
        });
    });

    describe('getMemoryInfo', () => {
        it('should return memory information', () => {
            configure({
                osTotalmem: () => 16 * 1024 * 1024 * 1024, // 16GB
                osFreemem: () => 8 * 1024 * 1024 * 1024, // 8GB
                processMemoryUsage: () => ({
                    heapUsed: 50 * 1024 * 1024, // 50MB
                    heapTotal: 100 * 1024 * 1024, // 100MB
                    rss: 0,
                    external: 0,
                    arrayBuffers: 0,
                }),
            });

            const info = getMemoryInfo();

            expect(info.total).toBe(16 * 1024 * 1024 * 1024);
            expect(info.free).toBe(8 * 1024 * 1024 * 1024);
            expect(info.used).toBe(8 * 1024 * 1024 * 1024);
            expect(info.heapUsed).toBe(50 * 1024 * 1024);
            expect(info.heapTotal).toBe(100 * 1024 * 1024);
        });
    });

    describe('getOsInfo', () => {
        it('should return OS information', () => {
            configure({
                osPlatform: () => 'linux',
                osRelease: () => '5.15.0',
                osHostname: () => 'server01',
                osUptime: () => 86400, // 1 day
                osCpus: () => new Array(4).fill({ model: 'CPU', speed: 3000 }),
            });

            const info = getOsInfo();

            expect(info.platform).toBe('linux');
            expect(info.release).toBe('5.15.0');
            expect(info.hostname).toBe('server01');
            expect(info.uptime).toBe(86400);
            expect(info.cpus).toBe(4);
        });
    });

    describe('getDockerInfo', () => {
        it('should detect Docker via /.dockerenv', () => {
            configure({
                existsSync: (path: string) => path === '/.dockerenv',
                readFileSync: () => '',
            });

            const info = getDockerInfo();

            expect(info.isDocker).toBe(true);
        });

        it('should detect Docker via cgroup', () => {
            configure({
                existsSync: (path: string) => path === '/proc/1/cgroup',
                readFileSync: () => '1:name=systemd:/docker/abc123',
            });

            const info = getDockerInfo();

            expect(info.isDocker).toBe(true);
        });

        it('should detect Kubernetes via cgroup', () => {
            configure({
                existsSync: (path: string) => path === '/proc/1/cgroup',
                readFileSync: () => '1:name=systemd:/kubepods/pod-abc123',
            });

            const info = getDockerInfo();

            expect(info.isDocker).toBe(true);
        });

        it('should return false when not in Docker', () => {
            configure({
                existsSync: () => false,
                readFileSync: () => '',
            });

            const info = getDockerInfo();

            expect(info.isDocker).toBe(false);
            expect(info.containerId).toBe(null);
        });

        it('should include container ID from HOSTNAME when in Docker', () => {
            const originalHostname = process.env.HOSTNAME;
            process.env.HOSTNAME = 'container-abc123';

            configure({
                existsSync: (path: string) => path === '/.dockerenv',
                readFileSync: () => '',
            });

            const info = getDockerInfo();

            expect(info.isDocker).toBe(true);
            expect(info.containerId).toBe('container-abc123');

            process.env.HOSTNAME = originalHostname;
        });
    });

    describe('getDiskInfo', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        it('should return disk information', async () => {
            process.env.FILES_DIR = '/data';

            configure({
                statfs: async () => ({
                    bsize: 4096,
                    blocks: 1000000,
                    bfree: 500000,
                    bavail: 450000,
                    type: 0,
                    files: 0,
                    ffree: 0,
                }),
            });

            const info = await getDiskInfo();

            expect(info.path).toBe('/data');
            expect(info.total).toBe(4096 * 1000000);
            expect(info.free).toBe(4096 * 500000);
            expect(info.available).toBe(4096 * 450000);
            expect(info.error).toBeUndefined();
        });

        it('should handle errors gracefully', async () => {
            process.env.FILES_DIR = '/nonexistent';

            configure({
                statfs: async () => {
                    throw new Error('ENOENT');
                },
            });

            const info = await getDiskInfo();

            expect(info.path).toBe('/nonexistent');
            expect(info.total).toBe(0);
            expect(info.free).toBe(0);
            expect(info.error).toBe('Unable to read disk info');
        });
    });

    describe('getSystemInfo', () => {
        it('should aggregate all system information', async () => {
            configure({
                osTotalmem: () => 16 * 1024 * 1024 * 1024,
                osFreemem: () => 8 * 1024 * 1024 * 1024,
                osPlatform: () => 'linux',
                osRelease: () => '5.15.0',
                osHostname: () => 'server01',
                osUptime: () => 86400,
                osCpus: () => new Array(4).fill({ model: 'CPU', speed: 3000 }),
                processMemoryUsage: () => ({
                    heapUsed: 50 * 1024 * 1024,
                    heapTotal: 100 * 1024 * 1024,
                    rss: 0,
                    external: 0,
                    arrayBuffers: 0,
                }),
                existsSync: () => false,
                readFileSync: () => '',
                statfs: async () => ({
                    bsize: 4096,
                    blocks: 1000000,
                    bfree: 500000,
                    bavail: 450000,
                    type: 0,
                    files: 0,
                    ffree: 0,
                }),
                getAppVersion: () => 'v3.1.0',
                getDbConfig: () => ({ dialect: 'sqlite', sqlitePath: '/data/test.db' }),
            });

            const info = await getSystemInfo();

            // Verify all sections are present
            expect(info.runtime).toBeDefined();
            expect(info.database).toBeDefined();
            expect(info.application).toBeDefined();
            expect(info.memory).toBeDefined();
            expect(info.os).toBeDefined();
            expect(info.docker).toBeDefined();
            expect(info.disk).toBeDefined();
            expect(info.timestamp).toBeDefined();

            // Verify timestamp format
            expect(info.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
});
