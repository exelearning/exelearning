/**
 * File Helper Service for Elysia
 * Provides file system path utilities and directory management
 *
 * Uses Dependency Injection pattern for testability
 */
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';

// Re-export utilities from the shared utils
export {
    getSessionDateComponents,
    getOdeSessionUrl,
    getOdeSessionPath,
    getOdeComponentsSyncUrl,
    getOdeComponentsSyncPath,
    replaceContextPath,
    unreplaceContextPath,
    ODE_XML_CONTEXT_PATH,
} from '../utils/url.util';

import { getSessionDateComponents, getOdeSessionPath } from '../utils/url.util';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Dependencies that can be injected for testing
 */
export interface FileHelperDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    getEnv?: (key: string) => string | undefined;
    getCwd?: () => string;
}

/**
 * File Helper service interface
 */
export interface FileHelper {
    getFilesDir: () => string;
    getTempPath: (subPath?: string) => string;
    getPreviewExportPath: (sessionId: string, tempPath: string) => string;
    getOdeSessionDistDir: (odeSessionId: string) => string;
    getOdeSessionTempDir: (odeSessionId: string) => string;
    getProjectAssetsDir: (projectUuid: string) => string;
    getPublicDirectory: () => string;
    getLibsDir: () => string;
    getThemesDir: () => string;
    getIdevicesDir: () => string;
    createSessionDirectories: (odeSessionId: string) => Promise<void>;
    cleanupSessionDirectories: (odeSessionId: string) => Promise<void>;
    isPathSafe: (basePath: string, targetPath: string) => boolean;
    getContentXmlPath: (odeSessionId: string) => string;
    fileExists: (filePath: string) => Promise<boolean>;
    readFile: (filePath: string) => Promise<Buffer>;
    readFileAsString: (filePath: string, encoding?: BufferEncoding) => Promise<string>;
    writeFile: (filePath: string, content: string | Buffer) => Promise<void>;
    appendFile: (filePath: string, content: string | Buffer) => Promise<void>;
    copyFile: (src: string, dest: string) => Promise<void>;
    copyDir: (src: string, dest: string) => Promise<void>;
    remove: (targetPath: string) => Promise<void>;
    listFiles: (dirPath: string) => Promise<string[]>;
    getStats: (filePath: string) => Promise<fsExtra.Stats | null>;
    generateUniqueFilename: (originalName: string) => string;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a FileHelper instance with injected dependencies
 */
export function createFileHelper(deps: FileHelperDeps = {}): FileHelper {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const getEnv = deps.getEnv ?? ((key: string) => process.env[key]);
    const getCwd = deps.getCwd ?? (() => process.cwd());

    // Internal helper for public directory
    const getPublicDir = (): string => {
        return getEnv('PUBLIC_DIR') || path.join(getCwd(), 'public');
    };

    // ========================================================================
    // Path Functions
    // ========================================================================

    const getFilesDir = (): string => {
        // ELYSIA_FILES_DIR takes priority (used by tests)
        const elysiaFilesDir = getEnv('ELYSIA_FILES_DIR');
        if (elysiaFilesDir) {
            return elysiaFilesDir;
        }
        // FILES_DIR from environment (Docker or make up-local)
        const filesDir = getEnv('FILES_DIR');
        if (filesDir) {
            return filesDir;
        }
        // Fallback to local data directory
        return path.join(getCwd(), 'data');
    };

    const getTempPath = (subPath?: string): string => {
        const filesDir = getFilesDir();
        const tempBase = path.join(filesDir, 'tmp');
        return subPath ? path.join(tempBase, subPath) : tempBase;
    };

    const getOdeSessionTempDir = (odeSessionId: string): string => {
        const filesDir = getFilesDir();
        const sessionPath = getOdeSessionPath(odeSessionId, filesDir);

        if (!sessionPath) {
            console.warn(`Invalid session ID format: ${odeSessionId}. Using fallback directory structure.`);
            return path.join(filesDir, 'tmp', odeSessionId);
        }

        return sessionPath;
    };

    const getPreviewExportPath = (sessionId: string, tempPath: string): string => {
        const sessionDir = getOdeSessionTempDir(sessionId);
        return path.join(sessionDir, 'export', tempPath);
    };

    const getOdeSessionDistDir = (odeSessionId: string): string => {
        const dateComponents = getSessionDateComponents(odeSessionId);
        const filesDir = getFilesDir();

        if (!dateComponents) {
            console.warn(`Invalid session ID format: ${odeSessionId}. Using fallback directory structure.`);
            return path.join(filesDir, 'dist', odeSessionId);
        }

        const { year, month, day } = dateComponents;
        return path.join(filesDir, 'dist', year, month, day, odeSessionId);
    };

    const getProjectAssetsDir = (projectUuid: string): string => {
        return path.join(getFilesDir(), 'assets', projectUuid);
    };

    const getPublicDirectory = (): string => {
        return getPublicDir();
    };

    const getLibsDir = (): string => {
        return path.join(getPublicDir(), 'libs');
    };

    const getThemesDir = (): string => {
        return path.join(getPublicDir(), 'style', 'themes');
    };

    const getIdevicesDir = (): string => {
        return path.join(getPublicDir(), 'app', 'idevice');
    };

    const getContentXmlPath = (odeSessionId: string): string => {
        const tempDir = getOdeSessionTempDir(odeSessionId);
        return path.join(tempDir, 'content.xml');
    };

    // ========================================================================
    // Session Management
    // ========================================================================

    const createSessionDirectories = async (odeSessionId: string): Promise<void> => {
        const distDir = getOdeSessionDistDir(odeSessionId);
        const tempDir = getOdeSessionTempDir(odeSessionId);

        await Promise.all([fs.ensureDir(distDir), fs.ensureDir(tempDir)]);
    };

    const cleanupSessionDirectories = async (odeSessionId: string): Promise<void> => {
        const distDir = getOdeSessionDistDir(odeSessionId);
        const tempDir = getOdeSessionTempDir(odeSessionId);

        await Promise.all([fs.remove(distDir).catch(() => {}), fs.remove(tempDir).catch(() => {})]);
    };

    // ========================================================================
    // Utility Functions
    // ========================================================================

    const isPathSafe = (basePath: string, targetPath: string): boolean => {
        const resolvedBase = path.resolve(basePath);
        const resolvedTarget = path.resolve(basePath, targetPath);
        return resolvedTarget.startsWith(resolvedBase);
    };

    const generateUniqueFilename = (originalName: string): string => {
        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        return `${base}_${crypto.randomUUID()}${ext}`;
    };

    // ========================================================================
    // File I/O Operations
    // ========================================================================

    const fileExists = async (filePath: string): Promise<boolean> => {
        return fs.pathExists(filePath);
    };

    const readFile = async (filePath: string): Promise<Buffer> => {
        return fs.readFile(filePath);
    };

    const readFileAsString = async (filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> => {
        return fs.readFile(filePath, encoding);
    };

    const writeFile = async (filePath: string, content: string | Buffer): Promise<void> => {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
    };

    const appendFile = async (filePath: string, content: string | Buffer): Promise<void> => {
        await fs.ensureDir(path.dirname(filePath));
        await fs.appendFile(filePath, content);
    };

    const copyFile = async (src: string, dest: string): Promise<void> => {
        await fs.ensureDir(path.dirname(dest));
        await fs.copy(src, dest);
    };

    const copyDir = async (src: string, dest: string): Promise<void> => {
        await fs.copy(src, dest, { overwrite: true });
    };

    const remove = async (targetPath: string): Promise<void> => {
        await fs.remove(targetPath);
    };

    const listFiles = async (dirPath: string): Promise<string[]> => {
        if (!(await fs.pathExists(dirPath))) {
            return [];
        }
        return fs.readdir(dirPath);
    };

    const getStats = async (filePath: string): Promise<fsExtra.Stats | null> => {
        try {
            return await fs.stat(filePath);
        } catch {
            return null;
        }
    };

    // ========================================================================
    // Return FileHelper Interface
    // ========================================================================

    return {
        getFilesDir,
        getTempPath,
        getPreviewExportPath,
        getOdeSessionDistDir,
        getOdeSessionTempDir,
        getProjectAssetsDir,
        getPublicDirectory,
        getLibsDir,
        getThemesDir,
        getIdevicesDir,
        createSessionDirectories,
        cleanupSessionDirectories,
        isPathSafe,
        getContentXmlPath,
        fileExists,
        readFile,
        readFileAsString,
        writeFile,
        appendFile,
        copyFile,
        copyDir,
        remove,
        listFiles,
        getStats,
        generateUniqueFilename,
    };
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

const defaultFileHelper = createFileHelper();

// Export all functions from the default instance for backwards compatibility
export const getFilesDir = defaultFileHelper.getFilesDir;
export const getTempPath = defaultFileHelper.getTempPath;
export const getPreviewExportPath = defaultFileHelper.getPreviewExportPath;
export const getOdeSessionDistDir = defaultFileHelper.getOdeSessionDistDir;
export const getOdeSessionTempDir = defaultFileHelper.getOdeSessionTempDir;
export const getProjectAssetsDir = defaultFileHelper.getProjectAssetsDir;
export const getPublicDirectory = defaultFileHelper.getPublicDirectory;
export const getLibsDir = defaultFileHelper.getLibsDir;
export const getThemesDir = defaultFileHelper.getThemesDir;
export const getIdevicesDir = defaultFileHelper.getIdevicesDir;
export const createSessionDirectories = defaultFileHelper.createSessionDirectories;
export const cleanupSessionDirectories = defaultFileHelper.cleanupSessionDirectories;
export const isPathSafe = defaultFileHelper.isPathSafe;
export const getContentXmlPath = defaultFileHelper.getContentXmlPath;
export const fileExists = defaultFileHelper.fileExists;
export const readFile = defaultFileHelper.readFile;
export const readFileAsString = defaultFileHelper.readFileAsString;
export const writeFile = defaultFileHelper.writeFile;
export const appendFile = defaultFileHelper.appendFile;
export const copyFile = defaultFileHelper.copyFile;
export const copyDir = defaultFileHelper.copyDir;
export const remove = defaultFileHelper.remove;
export const listFiles = defaultFileHelper.listFiles;
export const getStats = defaultFileHelper.getStats;
export const generateUniqueFilename = defaultFileHelper.generateUniqueFilename;
