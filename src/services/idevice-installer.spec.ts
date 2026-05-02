/**
 * Tests for the iDevice Installer Service
 *
 * Builds ZIP packages dynamically (via the project's zipService) so we exercise
 * the real fflate-based pipeline including Zip Slip protection.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as fflate from 'fflate';
import { createIdeviceInstallerService } from './idevice-installer';

const TEST_ROOT = path.join(process.cwd(), 'test', 'temp', 'idevice-installer');

const buildZip = (files: Record<string, string | Uint8Array>): Buffer => {
    const zippable: fflate.Zippable = {};
    for (const [name, content] of Object.entries(files)) {
        const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        zippable[name] = [data, { level: 6 }];
    }
    return Buffer.from(fflate.zipSync(zippable));
};

const validConfigXml = (overrides: Record<string, string> = {}): string => {
    const fields: Record<string, string> = {
        name: 'my-test-idevice',
        title: 'My Test iDevice',
        category: 'Activity',
        version: '1.0',
        'api-version': '3.0',
        'component-type': 'json',
        icon: `
        <name>my-test-idevice-icon</name>
        <url>my-test-idevice-icon.svg</url>
        <type>img</type>
    `,
        ...overrides,
    };
    const body = Object.entries(fields)
        .map(([k, v]) => `    <${k}>${v}</${k}>`)
        .join('\n');
    return `<?xml version="1.0"?>\n<idevice>\n${body}\n</idevice>\n`;
};

const editionJs = (varName = '$exeMyTestIdevice') => `var ${varName} = { init: function () {} };\n`;
const exportJs = (varName = '$mytestidevice') => `var ${varName} = { render: function () {} };\n`;

const validPackageFiles = (folder = 'my-test-idevice', overrides: Record<string, string> = {}) => ({
    [`${folder}/config.xml`]: validConfigXml(overrides),
    [`${folder}/my-test-idevice-icon.svg`]: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
    [`${folder}/edition/my-test-idevice.js`]: editionJs(),
    [`${folder}/export/my-test-idevice.js`]: exportJs(),
});

describe('IdeviceInstallerService', () => {
    let runDir: string;
    let baseDir: string;
    let usersDir: string;

    beforeEach(async () => {
        runDir = path.join(TEST_ROOT, `run-${crypto.randomUUID()}`);
        baseDir = path.join(runDir, 'base');
        usersDir = path.join(runDir, 'users');
        await fs.ensureDir(baseDir);
        await fs.ensureDir(usersDir);
        process.env.ELYSIA_FILES_DIR = path.join(runDir, 'files');
        await fs.ensureDir(process.env.ELYSIA_FILES_DIR);
    });

    afterEach(async () => {
        delete process.env.ELYSIA_FILES_DIR;
        await fs.remove(runDir).catch(() => {});
    });

    const createService = () =>
        createIdeviceInstallerService({
            baseIdevicesPath: baseDir,
            userIdevicesPath: usersDir,
        });

    // ========================================================================
    // Happy path
    // ========================================================================
    describe('installFromBuffer (success)', () => {
        it('installs a valid iDevice into users/', async () => {
            const zip = buildZip(validPackageFiles());
            const result = await createService().installFromBuffer(zip);

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.id).toBe('my-test-idevice');
            expect(result.title).toBe('My Test iDevice');
            expect(result.exportObject).toBe('$mytestidevice');
            expect(result.overwritten).toBe(false);
            expect(await fs.pathExists(path.join(usersDir, 'my-test-idevice', 'config.xml'))).toBe(true);
            expect(result.config.id).toBe('my-test-idevice');
            expect(result.config.editionJs).toContain('my-test-idevice.js');
            expect(result.config.exportJs).toContain('my-test-idevice.js');
            expect(result.config.url).toBe(path.join(usersDir, 'my-test-idevice'));
        });

        it('installs a valid iDevice into the scoped user directory', async () => {
            const zip = buildZip(validPackageFiles());
            const result = await createService().installFromBuffer(zip, { userId: 42 });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(await fs.pathExists(path.join(usersDir, '42', 'my-test-idevice', 'config.xml'))).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, 'my-test-idevice', 'config.xml'))).toBe(false);
            expect(result.config.url).toBe(path.join(usersDir, '42', 'my-test-idevice'));
        });

        it('accepts a ZIP without a top-level folder', async () => {
            const zip = buildZip({
                'config.xml': validConfigXml(),
                'my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
                'edition/my-test-idevice.js': editionJs(),
                'export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(true);
        });

        it('accepts a ZIP with nested wrapper folders around the iDevice root', async () => {
            const zip = buildZip(validPackageFiles('outer-folder/my-test-idevice'));
            const result = await createService().installFromBuffer(zip);

            expect(result.success).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, 'my-test-idevice', 'config.xml'))).toBe(true);
        });

        it('honors <export-object> override in config.xml', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ 'export-object': '$customExport' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs('$customExport'),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(true);
            if (result.success) expect(result.exportObject).toBe('$customExport');
        });

        it('detects the export object via window["..."] = pattern', async () => {
            const zip = buildZip({
                'my-test-idevice/config.xml': validConfigXml(),
                'my-test-idevice/my-test-idevice-icon.svg':
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
                'my-test-idevice/edition/my-test-idevice.js': editionJs(),
                'my-test-idevice/export/my-test-idevice.js': 'window["$mytestidevice"] = { render: () => {} };',
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(true);
        });
    });

    // ========================================================================
    // Structure / config errors
    // ========================================================================
    describe('installFromBuffer (structure errors)', () => {
        it('rejects an empty buffer', async () => {
            const result = await createService().installFromBuffer(Buffer.alloc(0));
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('INVALID_ZIP');
        });

        it('rejects a ZIP exceeding maxZipBytes', async () => {
            const zip = buildZip(validPackageFiles());
            const result = await createService().installFromBuffer(zip, { maxZipBytes: 10 });
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('ZIP_TOO_LARGE');
        });

        it('rejects a non-ZIP buffer', async () => {
            const result = await createService().installFromBuffer(Buffer.from('not a zip'));
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('INVALID_ZIP');
        });

        it('rejects ZIPs without config.xml', async () => {
            const zip = buildZip({
                'pkg/edition/x.js': 'var $x={};',
                'pkg/export/x.js': 'var $x={};',
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('CONFIG_XML_NOT_FOUND');
        });

        it('rejects missing <name>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ name: '' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('rejects missing visible <title>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ title: '' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('rejects invalid <name>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ name: 'INVALID NAME!' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('INVALID_NAME');
        });

        it('rejects missing <category>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ category: '' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('rejects non-json <component-type>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ 'component-type': 'html' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('INVALID_COMPONENT_TYPE');
        });

        it('rejects missing <version>', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ version: '' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('rejects missing nested icon fields', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({ icon: '<name>my-test-idevice-icon</name>' }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_REQUIRED_FIELD');
        });

        it('rejects icon URL that does not match the required SVG filename', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml({
                    icon: `
        <name>my-test-idevice-icon</name>
        <url>other-icon.svg</url>
        <type>img</type>
    `,
                }),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('INVALID_ICON');
        });

        it('rejects missing icon SVG file', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_ICON_FILE');
        });

        it('rejects missing edition/ folder', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_EDITION_FOLDER');
        });

        it('rejects missing export/ folder', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_EXPORT_FOLDER');
        });

        it('rejects missing JS in edition/', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/styles.css': '.x{}',
                'pkg/export/my-test-idevice.js': exportJs(),
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_EDITION_JS');
        });

        it('rejects missing JS in export/', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/styles.css': '.x{}',
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('MISSING_EXPORT_JS');
        });

        it('rejects when export object is not defined in any export JS', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': '// no global declared\nconsole.log("hi");',
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('EXPORT_OBJECT_NOT_FOUND');
        });
    });

    // ========================================================================
    // Security
    // ========================================================================
    describe('installFromBuffer (security)', () => {
        it('blocks .php files in the package', async () => {
            const zip = buildZip({
                'pkg/config.xml': validConfigXml(),
                'pkg/my-test-idevice-icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                'pkg/edition/my-test-idevice.js': editionJs(),
                'pkg/export/my-test-idevice.js': exportJs(),
                'pkg/evil.php': '<?php evil(); ?>',
            });
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('UNSUPPORTED_EXTENSION');
        });

        it('rejects ZIPs with too many files', async () => {
            const files: Record<string, string> = {
                ...validPackageFiles('pkg'),
            };
            for (let i = 0; i < 50; i++) files[`pkg/extra/file${i}.txt`] = 'x';
            const zip = buildZip(files);
            const result = await createService().installFromBuffer(zip, { maxFiles: 5 });
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('TOO_MANY_FILES');
        });

        it('rejects when uncompressed size exceeds limit', async () => {
            const big = 'x'.repeat(10_000);
            const zip = buildZip({
                ...validPackageFiles('pkg'),
                'pkg/big.txt': big,
            });
            const result = await createService().installFromBuffer(zip, { maxUncompressedBytes: 1000 });
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('UNCOMPRESSED_SIZE_TOO_LARGE');
        });

        it('detects Zip Slip via crafted entry names', async () => {
            const zippable: fflate.Zippable = {
                '../escape.txt': [new TextEncoder().encode('boom'), { level: 6 }],
            };
            const evilZip = Buffer.from(fflate.zipSync(zippable));
            const result = await createService().installFromBuffer(evilZip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('ZIP_SLIP_DETECTED');
        });
    });

    // ========================================================================
    // Conflicts
    // ========================================================================
    describe('installFromBuffer (conflicts)', () => {
        const seedBuiltin = async (id: string, exportObject: string) => {
            const dir = path.join(baseDir, id);
            await fs.ensureDir(path.join(dir, 'edition'));
            await fs.ensureDir(path.join(dir, 'export'));
            await fs.writeFile(
                path.join(dir, 'config.xml'),
                validConfigXml({
                    name: id,
                    title: id,
                    'export-object': exportObject,
                    icon: `
        <name>${id}-icon</name>
        <url>${id}-icon.svg</url>
        <type>img</type>
    `,
                }),
            );
            await fs.writeFile(path.join(dir, 'edition', `${id}.js`), editionJs());
            await fs.writeFile(path.join(dir, 'export', `${id}.js`), exportJs(exportObject));
        };

        it('blocks installation when id matches a built-in iDevice', async () => {
            await seedBuiltin('my-test-idevice', '$mytestidevice');
            const zip = buildZip(validPackageFiles());
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('IDEVICE_OVERLAPS_BUILTIN');
        });

        it('blocks when export object collides with another iDevice', async () => {
            await seedBuiltin('other-idevice', '$mytestidevice');
            const zip = buildZip(validPackageFiles());
            const result = await createService().installFromBuffer(zip);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('EXPORT_OBJECT_CONFLICT');
        });

        it('requires confirmOverwrite when the iDevice already exists in users/', async () => {
            await createService().installFromBuffer(buildZip(validPackageFiles()));

            const result = await createService().installFromBuffer(buildZip(validPackageFiles()));
            expect(result.success).toBe(false);
            if (!result.success) expect(result.code).toBe('IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM');
        });

        it('does not treat another user installation as an overwrite', async () => {
            await createService().installFromBuffer(buildZip(validPackageFiles()), { userId: 42 });

            const result = await createService().installFromBuffer(buildZip(validPackageFiles()), { userId: 84 });

            expect(result.success).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, '42', 'my-test-idevice', 'config.xml'))).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, '84', 'my-test-idevice', 'config.xml'))).toBe(true);
        });

        it('overwrites and creates a backup when confirmOverwrite=true', async () => {
            await createService().installFromBuffer(buildZip(validPackageFiles()));
            const result = await createService().installFromBuffer(buildZip(validPackageFiles({ version: '2.0' })), {
                confirmOverwrite: true,
            });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.overwritten).toBe(true);
            expect(result.backupPath).toBeTruthy();
            expect(await fs.pathExists(result.backupPath as string)).toBe(true);
        });
    });

    // ========================================================================
    // Uninstall
    // ========================================================================
    describe('uninstall', () => {
        it('returns NOT_FOUND for an iDevice that is not installed', async () => {
            const result = await createService().uninstall('not-installed');
            expect(result.success).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('rejects invalid ids', async () => {
            const result = await createService().uninstall('../escape');
            expect(result.success).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('blocks uninstall of a built-in iDevice', async () => {
            const dir = path.join(baseDir, 'builtin-thing');
            await fs.ensureDir(dir);
            await fs.writeFile(
                path.join(dir, 'config.xml'),
                validConfigXml({
                    name: 'builtin-thing',
                    title: 'Built-in thing',
                    icon: `
        <name>builtin-thing-icon</name>
        <url>builtin-thing-icon.svg</url>
        <type>img</type>
    `,
                }),
            );
            const result = await createService().uninstall('builtin-thing');
            expect(result.success).toBe(false);
            expect(result.code).toBe('IDEVICE_OVERLAPS_BUILTIN');
        });

        it('removes a user iDevice folder', async () => {
            const installed = await createService().installFromBuffer(buildZip(validPackageFiles()));
            expect(installed.success).toBe(true);

            const result = await createService().uninstall('my-test-idevice');
            expect(result.success).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, 'my-test-idevice'))).toBe(false);
        });

        it('removes only the scoped user iDevice folder', async () => {
            await createService().installFromBuffer(buildZip(validPackageFiles()), { userId: 42 });
            await createService().installFromBuffer(buildZip(validPackageFiles()), { userId: 84 });

            const result = await createService().uninstall('my-test-idevice', { userId: 42 });

            expect(result.success).toBe(true);
            expect(await fs.pathExists(path.join(usersDir, '42', 'my-test-idevice'))).toBe(false);
            expect(await fs.pathExists(path.join(usersDir, '84', 'my-test-idevice'))).toBe(true);
        });
    });

    // ========================================================================
    // Download
    // ========================================================================
    describe('download', () => {
        it('returns NOT_FOUND for an iDevice that is not installed', async () => {
            const result = await createService().download('not-installed');

            expect(result.success).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('rejects invalid ids', async () => {
            const result = await createService().download('../escape');

            expect(result.success).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('downloads an installed user iDevice as a ZIP', async () => {
            const service = createService();
            await service.installFromBuffer(buildZip(validPackageFiles()), { userId: 42 });

            const result = await service.download('my-test-idevice', { userId: 42 });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.zipFileName).toBe('my-test-idevice.zip');
            const zipBuffer = Buffer.from(result.zipBase64 as string, 'base64');
            const contents = fflate.unzipSync(new Uint8Array(zipBuffer));
            expect(Object.keys(contents)).toContain('config.xml');
            expect(Object.keys(contents)).toContain('edition/my-test-idevice.js');
            expect(Object.keys(contents)).toContain('export/my-test-idevice.js');
        });

        it('downloads only from the scoped user directory', async () => {
            const service = createService();
            await service.installFromBuffer(buildZip(validPackageFiles()), { userId: 42 });

            const result = await service.download('my-test-idevice', { userId: 84 });

            expect(result.success).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });
    });
});
