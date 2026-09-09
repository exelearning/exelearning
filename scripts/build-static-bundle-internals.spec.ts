/**
 * Unit tests for the internal helpers of scripts/build-static-bundle.ts.
 *
 * build-static-bundle.spec.ts covers the pure string/config helpers. This file
 * covers the filesystem-facing helpers: version resolution, translation and
 * iDevice/theme discovery, template rendering and the copy/compress primitives
 * used by the build.
 *
 * Filesystem helpers are exercised against throwaway directories under the OS
 * temp dir — compressJsonInDir deletes the .json files it compresses, so it must
 * never be pointed at the repository tree.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as zlib from 'zlib';

import {
    LOCALES,
    isSemver,
    resolveVersion,
    getBuildVersion,
    getBuildHash,
    parseXlfFile,
    loadAllTranslations,
    readTemplateContent,
    parseIdeviceConfig,
    buildIdevicesList,
    scanThemeIcons,
    buildThemesList,
    processNjkTemplate,
    generateMenuStructureHtml,
    generateMenuIdevicesHtml,
    generateMenuHeadTopHtml,
    generateMenuHeadBottomHtml,
    generateModalsHtml,
    generateStaticHtml,
    generatePwaManifest,
    generateServiceWorker,
    compressJsonInDir,
    copyDirRecursive,
} from './build-static-bundle';

const projectRoot = path.resolve(import.meta.dir, '..');

/** Create an isolated temp directory; every test cleans up after itself. */
function makeTempDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `exe-${prefix}-`));
}

describe('isSemver', () => {
    it('accepts plain and v-prefixed semver', () => {
        expect(isSemver('1.0.0')).toBe(true);
        expect(isSemver('v3.0.2')).toBe(true);
    });

    it('accepts prerelease and build metadata', () => {
        expect(isSemver('v1.0.0-rc1')).toBe(true);
        expect(isSemver('v1.0.0-beta.2')).toBe(true);
        expect(isSemver('v1.0.0-alpha+build123')).toBe(true);
    });

    it('rejects branch names and partial versions', () => {
        expect(isSemver('main')).toBe(false);
        expect(isSemver('pr123')).toBe(false);
        expect(isSemver('v1.0')).toBe(false);
        expect(isSemver('')).toBe(false);
    });
});

describe('resolveVersion', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));

    it('falls back to the package.json version when no input is given', () => {
        expect(resolveVersion(undefined)).toBe(`v${packageJson.version}`);
        expect(resolveVersion('')).toBe(`v${packageJson.version}`);
    });

    it('uses a semver input directly and normalises the v prefix', () => {
        expect(resolveVersion('v3.0.2')).toBe('v3.0.2');
        expect(resolveVersion('3.0.2')).toBe('v3.0.2');
        expect(resolveVersion('v3.0.2-rc1')).toBe('v3.0.2-rc1');
    });

    it('turns main/master into a dated nightly version', () => {
        for (const branch of ['main', 'master']) {
            expect(resolveVersion(branch)).toMatch(/^v0\.0\.0-nightly-\d{12}$/);
        }
    });

    it('embeds a sanitised branch name for other inputs', () => {
        expect(resolveVersion('pr123')).toMatch(/^v0\.0\.0-pr123-\d{12}$/);
        // Invalid chars collapse to a single dash.
        expect(resolveVersion('feature/my_branch')).toMatch(/^v0\.0\.0-feature-my-branch-\d{12}$/);
    });
});

describe('getBuildVersion / getBuildHash', () => {
    it('exposes a version resolved through the same rules as resolveVersion', () => {
        const version = getBuildVersion();
        // Either a plain semver release or one of the generated dated forms.
        expect(isSemver(version) || /^v0\.0\.0-[a-zA-Z0-9.-]+-\d{12}$/.test(version)).toBe(true);
    });

    it('exposes a build hash usable as a cache buster', () => {
        // Short git SHA when git is available, base36 timestamp otherwise.
        expect(getBuildHash()).toMatch(/^[0-9a-z]+$/);
    });
});

describe('parseXlfFile', () => {
    it('returns an empty object for a missing file', () => {
        expect(parseXlfFile(path.join(projectRoot, 'translations/messages.does-not-exist.xlf'))).toEqual({});
    });

    it('parses a real catalog from the repository', () => {
        const result = parseXlfFile(path.join(projectRoot, 'translations/messages.es.xlf'));
        expect(Object.keys(result).length).toBeGreaterThan(0);
    });
});

describe('loadAllTranslations', () => {
    // Driven by a fixture directory: parsing the 11 real catalogs takes several
    // seconds, which is far too slow for a unit test (and starves its neighbours).
    // parseXlfFile is covered against the real catalogs above.
    let tmp: string;

    const xlf = (source: string, target: string) =>
        `<?xml version="1.0"?><xliff version="1.2"><file><body>` +
        `<trans-unit id="1"><source>${source}</source><target>${target}</target></trans-unit>` +
        `</body></file></xliff>`;

    beforeAll(() => {
        tmp = makeTempDir('xlf');
        fs.writeFileSync(path.join(tmp, 'messages.es.xlf'), xlf('Hello', 'Hola'));
        fs.writeFileSync(path.join(tmp, 'messages.fr.xlf'), xlf('Hello', 'Bonjour'));
    });

    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('loads a catalog for each requested locale', () => {
        const all = loadAllTranslations(tmp, ['es', 'fr']);
        expect(all.es.translations).toEqual({ Hello: 'Hola' });
        expect(all.fr.translations).toEqual({ Hello: 'Bonjour' });
    });

    it('reports a count matching the parsed entries', () => {
        const all = loadAllTranslations(tmp, ['es']);
        expect(all.es.count).toBe(1);
    });

    it('yields an empty catalog for a locale with no file', () => {
        const all = loadAllTranslations(tmp, ['de']);
        expect(all.de).toEqual({ translations: {}, count: 0 });
    });

    it('defaults to the repository catalogs and every configured locale', () => {
        // Sanity check on the production defaults, without re-parsing everything:
        // a single locale list keeps this cheap.
        const all = loadAllTranslations(undefined, ['en']);
        expect(all.en.count).toBeGreaterThan(0);
        expect(LOCALES).toContain('en');
    });
});

describe('readTemplateContent', () => {
    let tmp: string;

    beforeAll(() => {
        tmp = makeTempDir('tpl');
        fs.mkdirSync(path.join(tmp, 'edition'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'edition', 'tpl.html'), '<p>hello</p>');
    });

    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('returns an empty string when no filename is given', () => {
        expect(readTemplateContent(tmp, 'edition', '')).toBe('');
    });

    it('returns an empty string when the file does not exist', () => {
        expect(readTemplateContent(tmp, 'edition', 'missing.html')).toBe('');
    });

    it('returns the file content when it exists', () => {
        expect(readTemplateContent(tmp, 'edition', 'tpl.html')).toBe('<p>hello</p>');
    });
});

describe('parseIdeviceConfig asset discovery', () => {
    let tmp: string;

    beforeAll(() => {
        tmp = makeTempDir('idevice');
        fs.mkdirSync(path.join(tmp, 'edition'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'export'), { recursive: true });
        // Auto-discovery source files: the idevice-named file must sort first and
        // test/spec files must be ignored.
        fs.writeFileSync(path.join(tmp, 'edition', 'alpha.js'), '');
        fs.writeFileSync(path.join(tmp, 'edition', 'demo.js'), '');
        fs.writeFileSync(path.join(tmp, 'edition', 'demo.test.js'), '');
        fs.writeFileSync(path.join(tmp, 'edition', 'demo.spec.js'), '');
        fs.writeFileSync(path.join(tmp, 'edition', 'demo.css'), '');
        fs.writeFileSync(path.join(tmp, 'export', 'demo.js'), '');
        fs.writeFileSync(path.join(tmp, 'export', 'demo.css'), '');
    });

    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('auto-discovers edition scripts when config.xml declares none', () => {
        const result = parseIdeviceConfig('<idevice-config><title>Demo</title></idevice-config>', 'demo', tmp);
        expect(result).not.toBeNull();
        // demo.js sorts before alpha.js because it matches the iDevice id.
        expect(result!.editionJs).toEqual(['demo.js', 'alpha.js']);
        // .test./.spec. files are filtered out.
        expect(result!.editionJs).not.toContain('demo.test.js');
        expect(result!.editionJs).not.toContain('demo.spec.js');
        expect(result!.editionCss).toEqual(['demo.css']);
    });

    it('keeps only declared filenames that exist on disk', () => {
        const xml =
            '<idevice-config><edition-js>' +
            '<filename>demo.js</filename><filename>ghost.js</filename>' +
            '</edition-js></idevice-config>';
        const result = parseIdeviceConfig(xml, 'demo', tmp);
        expect(result!.editionJs).toEqual(['demo.js']);
    });

    it('falls back to the conventional filename when the declared list is empty', () => {
        const result = parseIdeviceConfig('<idevice-config><edition-js></edition-js></idevice-config>', 'demo', tmp);
        expect(result!.editionJs).toEqual(['demo.js']);
    });

    it('returns an empty list when the asset folder does not exist', () => {
        const empty = makeTempDir('idevice-empty');
        try {
            const result = parseIdeviceConfig('<idevice-config><title>X</title></idevice-config>', 'demo', empty);
            expect(result!.editionJs).toEqual([]);
            expect(result!.exportCss).toEqual([]);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });

    it('reads the declared template files from disk', () => {
        fs.writeFileSync(path.join(tmp, 'edition', 'edit.html'), '<edit/>');
        fs.writeFileSync(path.join(tmp, 'export', 'view.html'), '<view/>');
        const xml =
            '<idevice-config>' +
            '<edition-template-filename>edit.html</edition-template-filename>' +
            '<export-template-filename>view.html</export-template-filename>' +
            '</idevice-config>';
        const result = parseIdeviceConfig(xml, 'demo', tmp);
        expect(result!.editionTemplateContent).toBe('<edit/>');
        expect(result!.exportTemplateContent).toBe('<view/>');
    });

    it('returns null when parsing throws', () => {
        // A non-string content makes the internal .match() calls throw.
        expect(parseIdeviceConfig(null as unknown as string, 'demo', tmp)).toBeNull();
    });
});

describe('buildIdevicesList', () => {
    it('discovers the base iDevices shipped in the repository', () => {
        const { idevices } = buildIdevicesList();
        expect(idevices.length).toBeGreaterThan(0);
        expect(idevices.every(i => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
    });

    it('sorts by category and then title', () => {
        // Fixture with a deliberately unsorted layout on disk, and the exact order expected out.
        const tmp = makeTempDir('idevice-sort');
        try {
            const write = (dir: string, category: string, title: string) => {
                fs.mkdirSync(path.join(tmp, dir), { recursive: true });
                fs.writeFileSync(
                    path.join(tmp, dir, 'config.xml'),
                    `<idevice-config><category>${category}</category><title>${title}</title></idevice-config>`,
                );
            };
            write('c-one', 'Zeta', 'Alpha');
            write('a-two', 'Alpha', 'Zulu');
            write('b-three', 'Alpha', 'Bravo');

            const { idevices } = buildIdevicesList(tmp);
            expect(idevices.map(i => `${i.category}/${i.title}`)).toEqual(['Alpha/Bravo', 'Alpha/Zulu', 'Zeta/Alpha']);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('returns an empty list when the iDevices directory is missing', () => {
        expect(buildIdevicesList(path.join(os.tmpdir(), 'exe-absent-idevices-xyz'))).toEqual({ idevices: [] });
    });
});

describe('scanThemeIcons', () => {
    it('returns an empty map when the theme has no icons folder', () => {
        const tmp = makeTempDir('theme-noicons');
        try {
            expect(scanThemeIcons(tmp, '/themes/x')).toEqual({});
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('indexes image files and ignores everything else', () => {
        const tmp = makeTempDir('theme-icons');
        try {
            const icons = path.join(tmp, 'icons');
            fs.mkdirSync(icons, { recursive: true });
            for (const name of ['a.png', 'b.svg', 'c.gif', 'd.jpg', 'e.jpeg']) {
                fs.writeFileSync(path.join(icons, name), '');
            }
            fs.writeFileSync(path.join(icons, 'notes.txt'), '');
            fs.mkdirSync(path.join(icons, 'nested'));

            const result = scanThemeIcons(tmp, '/themes/x');
            expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
            expect(result.a).toEqual({ id: 'a', title: 'a', type: 'img', value: '/themes/x/icons/a.png' });
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('buildThemesList', () => {
    it('discovers the base themes shipped in the repository', () => {
        const { themes } = buildThemesList();
        expect(themes.length).toBeGreaterThan(0);
        for (const theme of themes) {
            expect(theme.dirName).toBeTruthy();
            expect(theme.url).toBe(`/files/perm/themes/base/${theme.dirName}`);
            expect(theme.type).toBe('base');
            expect(Array.isArray(theme.cssFiles)).toBe(true);
        }
    });

    it('includes the default theme', () => {
        expect(buildThemesList().themes.map(t => t.dirName)).toContain('base');
    });
});

describe('processNjkTemplate', () => {
    it('returns an empty string for a missing template', () => {
        expect(processNjkTemplate(path.join(projectRoot, 'views/does-not-exist.njk'))).toBe('');
    });

    it('renders a real template without leaving Nunjucks tags behind', () => {
        const html = processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuStructure.njk'));
        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toContain('{%');
    });
});

describe('menu and modal HTML generation', () => {
    it('generates the structure menu', () => {
        expect(generateMenuStructureHtml().length).toBeGreaterThan(0);
    });

    it('generates the iDevices menu', () => {
        expect(generateMenuIdevicesHtml().length).toBeGreaterThan(0);
    });

    it('generates the head bottom menu', () => {
        expect(generateMenuHeadBottomHtml().length).toBeGreaterThan(0);
    });

    it('splices the navbar into the head top menu', () => {
        const headTop = generateMenuHeadTopHtml();
        const navbar = processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuNavbar.njk'));
        expect(navbar.length).toBeGreaterThan(0);
        // The navbar is injected verbatim before the closing </div>, so it must appear whole.
        expect(headTop).toContain(navbar);
    });

    it('concatenates every modal template', () => {
        const modals = generateModalsHtml();
        expect(modals.length).toBeGreaterThan(0);
        expect(modals).toContain('modal');
    });

    it('emits a root element for every modal ModalsManagement instantiates', () => {
        // The static list of templates in build-static-bundle.ts is maintained by
        // hand, while ModalsManagement constructs every modal unconditionally and
        // the base Modal constructor dereferences its root element. A template
        // missing from the list therefore breaks the whole static app at startup,
        // which no other test would notice. Derive the expectation from the
        // manager itself so the two cannot drift.
        const modalsRoot = path.join(projectRoot, 'public/app/workarea/modals');
        const managerSource = fs.readFileSync(path.join(modalsRoot, 'modalsManager.js'), 'utf8');
        const importedFiles = [...managerSource.matchAll(/^import\s+\w+\s+from\s+'(\.\/modals\/[^']+)'/gm)].map(
            match => match[1],
        );
        expect(importedFiles.length).toBeGreaterThan(10);

        const html = generateModalsHtml();
        const missing: string[] = [];

        for (const relativePath of importedFiles) {
            const source = fs.readFileSync(path.join(modalsRoot, relativePath), 'utf8');
            const id = source.match(/(?:let|const) id = '([^']+)'/)?.[1] ?? source.match(/super\(\s*manager,\s*'([^']+)'/)?.[1];
            // Modals that resolve their element some other way (e.g. by passing a
            // node in) have no literal id to check.
            if (!id) continue;
            if (!html.includes(`id="${id}"`)) missing.push(`${relativePath} -> #${id}`);
        }

        expect(missing).toEqual([]);
    });
});

describe('generateStaticHtml', () => {
    it('fills every placeholder and versions local URLs', () => {
        const html = generateStaticHtml({ version: 'test' });
        expect(html).not.toContain('{{MENU_STRUCTURE_HTML}}');
        expect(html).not.toContain('{{MENU_IDEVICES_HTML}}');
        expect(html).not.toContain('{{MENU_HEAD_TOP_HTML}}');
        expect(html).not.toContain('{{MENU_HEAD_BOTTOM_HTML}}');
        expect(html).not.toContain('{{MODALS_HTML}}');
        expect(html).not.toContain('{{BUILD_VERSION}}');
        expect(html).toContain(`?v=${getBuildVersion()}`);
    });
});

describe('generatePwaManifest / generateServiceWorker', () => {
    it('generates a manifest carrying the current version and hash', () => {
        const manifest = JSON.parse(generatePwaManifest());
        expect(manifest.id).toBe(`exelearning-${getBuildVersion()}-${getBuildHash()}`);
    });

    it('generates a service worker whose cache name carries version and hash', () => {
        expect(generateServiceWorker()).toContain(
            `const CACHE_NAME = 'exelearning-static-${getBuildVersion()}-${getBuildHash()}'`,
        );
    });
});

describe('compressJsonInDir', () => {
    it('returns zero stats when the directory does not exist', () => {
        expect(compressJsonInDir(path.join(os.tmpdir(), 'exe-absent-dir-xyz'))).toEqual({
            count: 0,
            origTotal: 0,
            compressedTotal: 0,
        });
    });

    it('zstd-compresses json files recursively, removes the originals and leaves other files alone', () => {
        const tmp = makeTempDir('zstd');
        try {
            const payload = JSON.stringify({ data: 'x'.repeat(500) });
            fs.writeFileSync(path.join(tmp, 'a.json'), payload);
            fs.writeFileSync(path.join(tmp, 'keep.txt'), 'untouched');
            fs.mkdirSync(path.join(tmp, 'nested'));
            fs.writeFileSync(path.join(tmp, 'nested', 'b.json'), payload);

            const stats = compressJsonInDir(tmp);

            expect(stats.count).toBe(2);
            expect(stats.origTotal).toBe(payload.length * 2);
            expect(stats.compressedTotal).toBeGreaterThan(0);
            expect(stats.compressedTotal).toBeLessThan(stats.origTotal);

            expect(fs.existsSync(path.join(tmp, 'a.json'))).toBe(false);
            expect(fs.existsSync(path.join(tmp, 'nested', 'b.json'))).toBe(false);
            expect(fs.existsSync(path.join(tmp, 'keep.txt'))).toBe(true);

            const roundTripped = zlib.zstdDecompressSync(fs.readFileSync(path.join(tmp, 'a.json.zst'))).toString();
            expect(roundTripped).toBe(payload);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('copyDirRecursive', () => {
    it('does nothing when the source is missing', () => {
        const dest = makeTempDir('copy-dest-missing');
        try {
            copyDirRecursive(path.join(os.tmpdir(), 'exe-absent-src-xyz'), path.join(dest, 'out'));
            expect(fs.existsSync(path.join(dest, 'out'))).toBe(false);
        } finally {
            fs.rmSync(dest, { recursive: true, force: true });
        }
    });

    it('copies nested files and skips dotfiles and test files by default', () => {
        const src = makeTempDir('copy-src');
        const dest = makeTempDir('copy-dest');
        try {
            fs.writeFileSync(path.join(src, 'app.js'), 'app');
            fs.writeFileSync(path.join(src, 'app.test.js'), 'test');
            fs.writeFileSync(path.join(src, 'app.spec.js'), 'spec');
            fs.writeFileSync(path.join(src, '.hidden'), 'hidden');
            fs.mkdirSync(path.join(src, 'sub'));
            fs.writeFileSync(path.join(src, 'sub', 'deep.js'), 'deep');

            const out = path.join(dest, 'out');
            copyDirRecursive(src, out);

            expect(fs.readFileSync(path.join(out, 'app.js'), 'utf-8')).toBe('app');
            expect(fs.readFileSync(path.join(out, 'sub', 'deep.js'), 'utf-8')).toBe('deep');
            expect(fs.existsSync(path.join(out, 'app.test.js'))).toBe(false);
            expect(fs.existsSync(path.join(out, 'app.spec.js'))).toBe(false);
            expect(fs.existsSync(path.join(out, '.hidden'))).toBe(false);
        } finally {
            fs.rmSync(src, { recursive: true, force: true });
            fs.rmSync(dest, { recursive: true, force: true });
        }
    });

    it('honours the exclude list and custom exclude patterns', () => {
        const src = makeTempDir('copy-src-excl');
        const dest = makeTempDir('copy-dest-excl');
        try {
            fs.writeFileSync(path.join(src, 'keep.js'), 'keep');
            fs.writeFileSync(path.join(src, 'drop.min.js'), 'drop');
            fs.mkdirSync(path.join(src, 'test'));
            fs.writeFileSync(path.join(src, 'test', 'x.js'), 'x');

            const out = path.join(dest, 'out');
            copyDirRecursive(src, out, ['test'], ['.min.js']);

            expect(fs.existsSync(path.join(out, 'keep.js'))).toBe(true);
            expect(fs.existsSync(path.join(out, 'drop.min.js'))).toBe(false);
            expect(fs.existsSync(path.join(out, 'test'))).toBe(false);
        } finally {
            fs.rmSync(src, { recursive: true, force: true });
            fs.rmSync(dest, { recursive: true, force: true });
        }
    });
});
