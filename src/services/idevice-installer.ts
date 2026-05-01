/**
 * iDevice Installer Service
 *
 * Installs an external iDevice from a ZIP buffer into
 * `public/files/perm/idevices/users/{id}/`. Validates structure, conflicts and
 * security before copying. Backs up existing installations and rolls back on
 * failure.
 *
 * Uses Dependency Injection pattern for testability.
 */
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import { createZipService, type ZipService } from './zip';
import { createFileHelper, type FileHelper } from './file-helper';
import {
    parseIdeviceConfig,
    scanIdevices,
    type IdeviceConfig,
    IDEVICES_BASE_PATH,
    IDEVICES_USERS_PATH,
} from '../routes/idevices';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MAX_ZIP_BYTES = 20 * 1024 * 1024; // 20 MB
export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB
export const DEFAULT_MAX_FILES = 500;
export const DEFAULT_BACKUPS_TO_KEEP = 5;

const MAX_PACKAGE_ROOT_DEPTH = 20;
const ID_REGEX = /^[a-z0-9][a-z0-9_-]{2,79}$/;

const BLOCKED_EXTENSIONS = new Set([
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.ps1',
    '.php',
    '.py',
    '.rb',
    '.jar',
    '.dll',
    '.so',
    '.dylib',
]);

// ============================================================================
// Types
// ============================================================================

export type InstallErrorCode =
    | 'INVALID_ZIP'
    | 'ZIP_TOO_LARGE'
    | 'UNCOMPRESSED_SIZE_TOO_LARGE'
    | 'TOO_MANY_FILES'
    | 'ZIP_SLIP_DETECTED'
    | 'UNSUPPORTED_EXTENSION'
    | 'CONFIG_XML_NOT_FOUND'
    | 'INVALID_CONFIG_XML'
    | 'INVALID_NAME'
    | 'MISSING_REQUIRED_FIELD'
    | 'MISSING_EDITION_FOLDER'
    | 'MISSING_EXPORT_FOLDER'
    | 'MISSING_EDITION_JS'
    | 'MISSING_EXPORT_JS'
    | 'INVALID_COMPONENT_TYPE'
    | 'INVALID_ICON'
    | 'MISSING_ICON_FILE'
    | 'EXPORT_OBJECT_NOT_FOUND'
    | 'EXPORT_OBJECT_CONFLICT'
    | 'IDEVICE_OVERLAPS_BUILTIN'
    | 'IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM'
    | 'COPY_ERROR'
    | 'ROLLBACK_ERROR'
    | 'UNKNOWN_ERROR';

export interface InstallOptions {
    confirmOverwrite?: boolean;
    userId?: number | string;
    maxZipBytes?: number;
    maxUncompressedBytes?: number;
    maxFiles?: number;
}

export interface UserIdeviceScopeOptions {
    userId?: number | string;
}

export interface InstallSuccess {
    success: true;
    id: string;
    name: string;
    title: string;
    version: string;
    exportObject: string;
    overwritten: boolean;
    backupPath?: string;
    /**
     * Full parsed config for the just-installed iDevice. The `url` field points
     * at the on-disk install dir; HTTP-layer callers should overwrite it with
     * the public asset path (e.g. `/{version}/files/perm/idevices/users/{id}`).
     */
    config: IdeviceConfig;
}

export interface InstallFailure {
    success: false;
    code: InstallErrorCode;
    message: string;
    details?: Record<string, unknown>;
}

export type InstallOutcome = InstallSuccess | InstallFailure;

export interface UninstallResult {
    success: boolean;
    code?: 'NOT_FOUND' | 'IDEVICE_OVERLAPS_BUILTIN' | 'COPY_ERROR';
    message?: string;
    backupPath?: string;
}

export interface IdeviceInstallerDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    zipService?: ZipService;
    fileHelper?: FileHelper;
    parseConfig?: typeof parseIdeviceConfig;
    scan?: typeof scanIdevices;
    getCwd?: () => string;
    now?: () => Date;
    randomId?: () => string;
    baseIdevicesPath?: string;
    userIdevicesPath?: string;
}

export interface IdeviceInstallerService {
    installFromBuffer: (zipBuffer: Buffer, options?: InstallOptions) => Promise<InstallOutcome>;
    uninstall: (ideviceId: string, options?: UserIdeviceScopeOptions) => Promise<UninstallResult>;
}

// ============================================================================
// Internal helpers
// ============================================================================

const formatTimestamp = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
};

// ============================================================================
// Factory
// ============================================================================

export function createIdeviceInstallerService(deps: IdeviceInstallerDeps = {}): IdeviceInstallerService {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const zipService = deps.zipService ?? createZipService({ fs, path });
    const fileHelper = deps.fileHelper ?? createFileHelper({ fs, path });
    const parseConfig = deps.parseConfig ?? parseIdeviceConfig;
    const scan = deps.scan ?? scanIdevices;
    const getCwd = deps.getCwd ?? (() => process.cwd());
    const now = deps.now ?? (() => new Date());
    const randomId = deps.randomId ?? (() => crypto.randomUUID());
    const baseDir = deps.baseIdevicesPath ?? path.join(getCwd(), IDEVICES_BASE_PATH);
    const usersDir = deps.userIdevicesPath ?? path.join(getCwd(), IDEVICES_USERS_PATH);
    const normalizeUserDirName = (userId: number | string | undefined): string | null => {
        if (userId === undefined || userId === null || userId === '') return null;
        const userDirName = String(userId);
        return /^\d+$/.test(userDirName) && fileHelper.isPathSafe(usersDir, userDirName) ? userDirName : null;
    };

    const getScopedUsersDir = (userId: number | string | undefined): string => {
        const userDirName = normalizeUserDirName(userId);
        return userDirName ? path.join(usersDir, userDirName) : usersDir;
    };

    const fail = (code: InstallErrorCode, message: string, details?: Record<string, unknown>): InstallFailure => ({
        success: false,
        code,
        message,
        details,
    });

    const getConfigValue = (xmlContent: string, tag: string): string => {
        const match = xmlContent.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`));
        return match?.[1]?.trim() ?? '';
    };

    const getNestedConfigValue = (xmlContent: string, parent: string, child: string): string => {
        const parentMatch = xmlContent.match(new RegExp(`<${parent}>\\s*([\\s\\S]*?)\\s*<\\/${parent}>`));
        if (!parentMatch) return '';
        const childMatch = parentMatch[1].match(new RegExp(`<${child}>\\s*([\\s\\S]*?)\\s*<\\/${child}>`));
        return childMatch?.[1]?.trim() ?? '';
    };

    const requireConfigValue = (
        xmlContent: string,
        tag: string,
    ): { ok: true; value: string } | { ok: false; failure: InstallFailure } => {
        const value = getConfigValue(xmlContent, tag);
        if (value) return { ok: true, value };
        return { ok: false, failure: fail('MISSING_REQUIRED_FIELD', `config.xml is missing <${tag}>.`) };
    };

    /**
     * Locate the directory inside `extractRoot` that holds `config.xml`.
     * Supports zips whose root already is the iDevice and zips wrapped in one
     * or more container folders.
     */
    const findPackageRoot = async (extractRoot: string): Promise<string | null> => {
        let current = extractRoot;
        for (let depth = 0; depth < MAX_PACKAGE_ROOT_DEPTH; depth += 1) {
            if (await fs.pathExists(path.join(current, 'config.xml'))) {
                return current;
            }
            const entries = await fs.readdir(current, { withFileTypes: true });
            const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__MACOSX');
            if (dirs.length !== 1) {
                return null;
            }
            current = path.join(current, dirs[0].name);
        }
        return null;
    };

    const sumDirectorySize = async (dir: string): Promise<{ files: number; bytes: number }> => {
        let files = 0;
        let bytes = 0;
        const walk = async (current: string): Promise<void> => {
            const entries = await fs.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else {
                    files += 1;
                    const stat = await fs.stat(full);
                    bytes += stat.size;
                }
            }
        };
        await walk(dir);
        return { files, bytes };
    };

    const collectFilesByExtension = async (dir: string, allowed: Set<string>): Promise<string[]> => {
        const offending: string[] = [];
        const walk = async (current: string): Promise<void> => {
            const entries = await fs.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (allowed.has(ext)) {
                        offending.push(path.relative(dir, full));
                    }
                }
            }
        };
        await walk(dir);
        return offending;
    };

    const readDir = async (dir: string): Promise<string[]> => {
        if (!(await fs.pathExists(dir))) return [];
        return fs.readdir(dir);
    };

    const exportObjectIsDefined = async (exportDir: string, exportObject: string): Promise<boolean> => {
        const files = await readDir(exportDir);
        const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.test.') && !f.includes('.spec.'));
        // Escape `$` for regex.
        const escaped = exportObject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp(`(?:var|let|const)\\s+${escaped}\\s*=`),
            new RegExp(`window\\s*\\.\\s*${escaped}\\s*=`),
            new RegExp(`window\\s*\\[\\s*['"]${escaped}['"]\\s*\\]\\s*=`),
        ];
        for (const file of jsFiles) {
            const content = await fs.readFile(path.join(exportDir, file), 'utf-8');
            if (patterns.some(p => p.test(content))) return true;
        }
        return false;
    };

    const pruneOldBackups = async (id: string, keep: number, backupsDir: string): Promise<void> => {
        if (!(await fs.pathExists(backupsDir))) return;
        const entries = await fs.readdir(backupsDir);
        const matching = entries.filter(name => name.startsWith(`${id}_`)).sort();
        const toRemove = matching.slice(0, Math.max(0, matching.length - keep));
        for (const name of toRemove) {
            await fs.remove(path.join(backupsDir, name)).catch(() => {});
        }
    };

    const backupExisting = async (id: string, userInstallDir: string): Promise<string> => {
        const target = path.join(userInstallDir, id);
        const backupsDir = path.join(userInstallDir, '.backups');
        const stamp = formatTimestamp(now());
        const backupPath = path.join(backupsDir, `${id}_${stamp}`);
        await fs.ensureDir(backupsDir);
        await fs.move(target, backupPath, { overwrite: true });
        return backupPath;
    };

    const restoreBackup = async (id: string, backupPath: string, userInstallDir: string): Promise<void> => {
        const target = path.join(userInstallDir, id);
        await fs.remove(target).catch(() => {});
        await fs.move(backupPath, target, { overwrite: true });
    };

    // ========================================================================
    // installFromBuffer
    // ========================================================================
    const installFromBuffer = async (zipBuffer: Buffer, options: InstallOptions = {}): Promise<InstallOutcome> => {
        const maxZipBytes = options.maxZipBytes ?? DEFAULT_MAX_ZIP_BYTES;
        const maxUncompressedBytes = options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;
        const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
        const userInstallDir = getScopedUsersDir(options.userId);

        if (options.userId !== undefined && normalizeUserDirName(options.userId) === null) {
            return fail('INVALID_NAME', `Unsafe user id: "${options.userId}".`);
        }

        if (!zipBuffer || zipBuffer.length === 0) {
            return fail('INVALID_ZIP', 'Empty ZIP buffer.');
        }
        if (zipBuffer.length > maxZipBytes) {
            return fail(
                'ZIP_TOO_LARGE',
                `ZIP exceeds the maximum size of ${Math.round(maxZipBytes / (1024 * 1024))} MB.`,
                { size: zipBuffer.length, maxBytes: maxZipBytes },
            );
        }

        const tempRoot = path.join(fileHelper.getTempPath('idevice-installer'), randomId());
        let backupPath: string | undefined;
        let installedId: string | undefined;
        let movedExisting = false;

        try {
            await fs.ensureDir(tempRoot);

            // 1. Extract (zip slip protection inside zipService).
            try {
                await zipService.extractZipFromBuffer(zipBuffer, tempRoot);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('Security error')) {
                    return fail('ZIP_SLIP_DETECTED', 'The ZIP contains unsafe paths.');
                }
                return fail('INVALID_ZIP', `Could not read ZIP: ${message}`);
            }

            // 2. Size + file count limits.
            const stats = await sumDirectorySize(tempRoot);
            if (stats.files > maxFiles) {
                return fail('TOO_MANY_FILES', `ZIP contains too many files (${stats.files} > ${maxFiles}).`, {
                    files: stats.files,
                    maxFiles,
                });
            }
            if (stats.bytes > maxUncompressedBytes) {
                return fail(
                    'UNCOMPRESSED_SIZE_TOO_LARGE',
                    `Uncompressed size exceeds ${Math.round(maxUncompressedBytes / (1024 * 1024))} MB.`,
                    { bytes: stats.bytes, maxBytes: maxUncompressedBytes },
                );
            }

            // 3. Locate package root.
            const pkgRoot = await findPackageRoot(tempRoot);
            if (!pkgRoot) {
                return fail('CONFIG_XML_NOT_FOUND', 'config.xml not found at the package root.');
            }

            // 4. Reject blocked extensions.
            const blocked = await collectFilesByExtension(pkgRoot, BLOCKED_EXTENSIONS);
            if (blocked.length > 0) {
                return fail('UNSUPPORTED_EXTENSION', `Package contains forbidden file types: ${blocked.join(', ')}`, {
                    files: blocked,
                });
            }

            // 5. Parse and validate config.xml.
            //
            // eXeLearning convention (see public/files/perm/idevices/base/*/config.xml):
            //   <name>  = technical identifier; matches the folder name and must
            //             pass ID_REGEX so it is safe as a directory.
            //   <title> = human-readable name shown in the UI.
            const configPath = path.join(pkgRoot, 'config.xml');
            const xmlContent = await fs.readFile(configPath, 'utf-8');

            const nameResult = requireConfigValue(xmlContent, 'name');
            if (!nameResult.ok) return nameResult.failure;
            const id = nameResult.value;
            if (!ID_REGEX.test(id)) {
                return fail('INVALID_NAME', `Invalid <name>: "${id}". Must match ${ID_REGEX}.`);
            }

            const requiredFields = ['title', 'category', 'component-type', 'version'];
            for (const field of requiredFields) {
                const result = requireConfigValue(xmlContent, field);
                if (!result.ok) return result.failure;
            }

            const componentType = getConfigValue(xmlContent, 'component-type');
            if (componentType !== 'json') {
                return fail('INVALID_COMPONENT_TYPE', 'config.xml <component-type> must be "json".', {
                    componentType,
                });
            }

            const iconName = getNestedConfigValue(xmlContent, 'icon', 'name');
            const iconUrl = getNestedConfigValue(xmlContent, 'icon', 'url');
            const iconType = getNestedConfigValue(xmlContent, 'icon', 'type');
            if (!iconName || !iconUrl || !iconType) {
                return fail(
                    'MISSING_REQUIRED_FIELD',
                    'config.xml is missing <icon><name>, <icon><url> or <icon><type>.',
                );
            }

            const expectedIconFilename = `${id}-icon.svg`;
            if (iconUrl !== expectedIconFilename) {
                return fail('INVALID_ICON', `<icon><url> must be "${expectedIconFilename}".`, {
                    expectedIconFilename,
                    iconUrl,
                });
            }
            if (!(await fs.pathExists(path.join(pkgRoot, expectedIconFilename)))) {
                return fail('MISSING_ICON_FILE', `Package is missing ${expectedIconFilename}.`, {
                    expectedIconFilename,
                });
            }

            const config = parseConfig(xmlContent, id, pkgRoot);
            if (!config) {
                return fail('INVALID_CONFIG_XML', 'Could not parse config.xml.');
            }

            // 6. Required folders.
            const editionDir = path.join(pkgRoot, 'edition');
            const exportDir = path.join(pkgRoot, 'export');
            if (!(await fs.pathExists(editionDir))) {
                return fail('MISSING_EDITION_FOLDER', 'Package is missing the edition/ folder.');
            }
            if (!(await fs.pathExists(exportDir))) {
                return fail('MISSING_EXPORT_FOLDER', 'Package is missing the export/ folder.');
            }

            // 7. Required JS in edition + export.
            if (config.editionJs.length === 0) {
                return fail('MISSING_EDITION_JS', 'edition/ does not contain the JS files declared in config.xml.');
            }
            if (config.exportJs.length === 0) {
                return fail('MISSING_EXPORT_JS', 'export/ does not contain the JS files declared in config.xml.');
            }

            // 8. Verify export object is defined somewhere in export/*.js.
            const exportObject = config.exportObject;
            if (!exportObject) {
                return fail('EXPORT_OBJECT_NOT_FOUND', 'Could not derive export object from config.xml.');
            }
            const defined = await exportObjectIsDefined(exportDir, exportObject);
            if (!defined) {
                return fail(
                    'EXPORT_OBJECT_NOT_FOUND',
                    `Export object "${exportObject}" is not defined in any export/*.js file. Add <export-object> to config.xml or define the variable.`,
                    { exportObject },
                );
            }

            // 9. Conflict detection against base/ and the current user's install dir.
            const baseInstalled = scan(baseDir);
            const userInstalled = scan(userInstallDir);
            if (baseInstalled.some(d => d.id === id)) {
                return fail(
                    'IDEVICE_OVERLAPS_BUILTIN',
                    `Cannot overwrite built-in iDevice "${id}". Choose a different <name>.`,
                    { id },
                );
            }

            const exportConflict =
                baseInstalled.find(d => d.exportObject === exportObject && d.id !== id) ||
                userInstalled.find(d => d.exportObject === exportObject && d.id !== id);
            if (exportConflict) {
                return fail(
                    'EXPORT_OBJECT_CONFLICT',
                    `Export object "${exportObject}" is already used by iDevice "${exportConflict.id}".`,
                    { exportObject, conflictingId: exportConflict.id },
                );
            }

            const existingUser = userInstalled.find(d => d.id === id);
            if (existingUser && !options.confirmOverwrite) {
                return fail(
                    'IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM',
                    `iDevice "${id}" already exists in the user's iDevices folder. Re-send with confirmOverwrite=true to update.`,
                    { id, existingVersion: existingUser.version },
                );
            }

            // 10. Backup if overwriting.
            await fs.ensureDir(userInstallDir);
            const finalDest = path.join(userInstallDir, id);

            // Final safety check (should never trigger because id is regex-validated).
            if (!fileHelper.isPathSafe(userInstallDir, id)) {
                return fail('INVALID_NAME', `Unsafe iDevice id: "${id}".`);
            }

            if (existingUser) {
                backupPath = await backupExisting(id, userInstallDir);
                movedExisting = true;
            }

            // 11. Copy temp -> users/{userId}/{id} when scoped, or users/{id} for fallback/local use.
            await fs.copy(pkgRoot, finalDest, { overwrite: true, errorOnExist: false });
            installedId = id;

            // 12. Prune old backups.
            await pruneOldBackups(id, DEFAULT_BACKUPS_TO_KEEP, path.join(userInstallDir, '.backups'));

            // 13. Re-parse from the final destination so `url`, `editionJs`,
            // `exportJs`, etc. reflect the on-disk install (the temp pkgRoot
            // disappears in the `finally` block).
            const installedConfig = parseConfig(xmlContent, id, finalDest) ?? config;

            return {
                success: true,
                id,
                name: id,
                title: installedConfig.title,
                version: installedConfig.version,
                exportObject,
                overwritten: !!existingUser,
                backupPath,
                config: installedConfig,
            };
        } catch (err) {
            // Roll back if we already moved the previous version aside.
            if (movedExisting && backupPath && installedId) {
                try {
                    await restoreBackup(installedId, backupPath, userInstallDir);
                } catch (rollbackErr) {
                    const message = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
                    return fail('ROLLBACK_ERROR', `Install failed and rollback failed: ${message}`);
                }
            }
            const message = err instanceof Error ? err.message : String(err);
            return fail('UNKNOWN_ERROR', `Unexpected installer error: ${message}`);
        } finally {
            await fs.remove(tempRoot).catch(() => {});
        }
    };

    // ========================================================================
    // uninstall
    // ========================================================================
    const uninstall = async (ideviceId: string, options: UserIdeviceScopeOptions = {}): Promise<UninstallResult> => {
        if (!ID_REGEX.test(ideviceId)) {
            return { success: false, code: 'NOT_FOUND', message: `Invalid iDevice id: "${ideviceId}".` };
        }
        const userInstallDir = getScopedUsersDir(options.userId);
        if (options.userId !== undefined && normalizeUserDirName(options.userId) === null) {
            return { success: false, code: 'NOT_FOUND', message: `Unsafe user id: "${options.userId}".` };
        }
        // Built-in iDevices cannot be uninstalled.
        const builtin = path.join(baseDir, ideviceId);
        if (await fs.pathExists(builtin)) {
            // Only block if it does NOT also exist in users (would be impossible normally).
            const userPath = path.join(userInstallDir, ideviceId);
            if (!(await fs.pathExists(userPath))) {
                return {
                    success: false,
                    code: 'IDEVICE_OVERLAPS_BUILTIN',
                    message: `Cannot uninstall built-in iDevice "${ideviceId}".`,
                };
            }
        }
        const target = path.join(userInstallDir, ideviceId);
        if (!(await fs.pathExists(target))) {
            return { success: false, code: 'NOT_FOUND', message: `iDevice "${ideviceId}" is not installed.` };
        }
        try {
            await fs.remove(target);
            return { success: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, code: 'COPY_ERROR', message };
        }
    };

    return { installFromBuffer, uninstall };
}

// ============================================================================
// Default instance
// ============================================================================

const defaultInstaller = createIdeviceInstallerService();
export const installIdeviceFromBuffer = defaultInstaller.installFromBuffer;
export const uninstallIdevice = defaultInstaller.uninstall;

export type { IdeviceConfig };
