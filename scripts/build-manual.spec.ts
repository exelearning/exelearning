/**
 * The user-manual build (scripts/build-manual.ts) must only publish a manual that
 * opens and reads correctly: these specs cover its checks (sources, package and
 * website), run one real build through the exporter with a tiny project, and keep
 * the manuals stored in doc/manual/ valid on every test run.
 */
import { afterAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { unzipSync, zipSync } from 'fflate';

import {
    DEFAULT_OUT,
    DEFAULT_ROOT,
    assetBaseName,
    buildLanguage,
    buildManuals,
    discoverLanguages,
    documentedVersion,
    localLinks,
    parseArgs,
    readSources,
    resourceReferences,
    run,
    validateProject,
    validateSite,
    type ExportProject,
    type FileMap,
} from './build-manual';

const encoder = new TextEncoder();
const text = (value: string): Uint8Array => encoder.encode(value);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const roots: string[] = [];
function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-manual-spec-'));
    roots.push(dir);
    return dir;
}

afterAll(() => {
    for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A one-page project whose text iDevice shows `content/resources/<image>`. */
function contentXml(image = 'pic.png', subtitle = 'eXe version: 4.0.6'): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences><userPreference><key>theme</key><value>base</value></userPreference></userPreferences>
<odeResources>
  <odeResource><key>odeId</key><value>20260101000000MANUAL</value></odeResource>
  <odeResource><key>odeVersionId</key><value>20260101000000MANUA2</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Tiny manual</value></odeProperty>
  <odeProperty>
    <key>pp_subtitle</key>
    <value>${subtitle}</value>
  </odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-1</odePageId><odeParentPageId></odeParentPageId>
  <pageName>Start</pageName><odeNavStructureOrder>0</odeNavStructureOrder>
  <odeNavStructureProperties>
    <odeNavStructureProperty><key>titlePage</key><value>Start</value></odeNavStructureProperty>
    <odeNavStructureProperty><key>visibility</key><value>true</value></odeNavStructureProperty>
  </odeNavStructureProperties>
  <odePagStructures>
    <odePagStructure>
      <odePageId>page-1</odePageId><odeBlockId>block-1</odeBlockId>
      <blockName>Welcome</blockName><iconName></iconName>
      <odePagStructureOrder>1</odePagStructureOrder>
      <odePagStructureProperties>
        <odePagStructureProperty><key>visibility</key><value>true</value></odePagStructureProperty>
      </odePagStructureProperties>
      <odeComponents><odeComponent>
          <odePageId>page-1</odePageId><odeBlockId>block-1</odeBlockId>
          <odeIdeviceId>idevice-1</odeIdeviceId><odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView><![CDATA[<p>Hello <img src="{{context_path}}/content/resources/${image}" alt="A picture" /></p>]]></htmlView>
          <odeComponentsOrder>1</odeComponentsOrder>
          <odeComponentsProperties>
            <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
          </odeComponentsProperties>
      </odeComponent></odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
</odeNavStructures>
</ode>
`;
}

/** Writes a manual folder for `lang` under `root`. */
function writeManual(
    root: string,
    lang: string,
    xml = contentXml(),
    resources: Record<string, Uint8Array> = { 'pic.png': PNG },
): void {
    const dir = path.join(root, lang);
    fs.mkdirSync(path.join(dir, 'content', 'resources'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'content.xml'), xml);
    for (const [name, data] of Object.entries(resources)) {
        const target = path.join(dir, 'content', 'resources', ...name.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
}

/** An exporter that writes `packages[format]` instead of running the real export. */
function fakeExporter(packages: Record<string, FileMap>): ExportProject {
    return async ([, output], flags) => {
        fs.writeFileSync(output, zipSync(packages[String(flags.format)]));
        return { success: true, message: 'ok' };
    };
}

const VALID_ELPX: FileMap = { 'content.xml': text(contentXml()), 'content/resources/pic.png': PNG };
const VALID_SITE: FileMap = {
    'index.html': text('<html><body><a href="html/a.html">A</a></body></html>'),
    'html/a.html': text('<p>A</p>'),
};

describe('parseArgs', () => {
    it('uses the repository defaults', () => {
        expect(parseArgs([])).toEqual({ root: DEFAULT_ROOT, out: DEFAULT_OUT, langs: [] });
    });

    it('reads languages, paths and version', () => {
        expect(parseArgs(['--lang=es,en', '--lang=pt-BR', '--out=o', '--root=r', '--version=v4.0.6'])).toEqual({
            root: 'r',
            out: 'o',
            langs: ['es', 'en', 'pt-BR'],
            version: 'v4.0.6',
        });
    });

    it('rejects unknown arguments, empty values and unsafe names', () => {
        expect(() => parseArgs(['--nope'])).toThrow('Unknown argument: --nope');
        expect(() => parseArgs(['--out='])).toThrow('--out needs a value');
        expect(() => parseArgs(['--lang=../etc'])).toThrow('Invalid language code: ../etc');
        expect(() => parseArgs(['--version=v1/../../x'])).toThrow('Invalid version');
    });
});

describe('discoverLanguages', () => {
    it('lists the folders that hold a content.xml', () => {
        const root = tempDir();
        writeManual(root, 'es');
        writeManual(root, 'en');
        fs.mkdirSync(path.join(root, 'fr'));
        fs.mkdirSync(path.join(root, 'Img'));
        fs.writeFileSync(path.join(root, 'index.md'), '# Manual');

        expect(discoverLanguages(root)).toEqual(['en', 'es']);
    });

    it('returns nothing for a missing folder', () => {
        expect(discoverLanguages(path.join(tempDir(), 'missing'))).toEqual([]);
    });
});

describe('readSources', () => {
    it('reads only the project sources, with POSIX paths', () => {
        const root = tempDir();
        writeManual(root, 'es', contentXml(), {
            'pic.png': PNG,
            'audio/voice.mp3': text('mp3'),
            '.DS_Store': text('x'),
        });
        const dir = path.join(root, 'es');
        fs.writeFileSync(path.join(dir, 'screenshot.png'), PNG);
        fs.mkdirSync(path.join(dir, 'theme'));
        fs.writeFileSync(path.join(dir, 'theme', 'style.css'), 'body{}');
        fs.writeFileSync(path.join(dir, 'index.html'), 'generated');
        fs.writeFileSync(path.join(dir, 'README.md'), 'notes');

        expect(Object.keys(readSources(dir)).sort()).toEqual([
            'content.xml',
            'content/resources/audio/voice.mp3',
            'content/resources/pic.png',
            'screenshot.png',
            'theme/style.css',
        ]);
    });
});

describe('resourceReferences', () => {
    it('finds plain, escaped and JSON-embedded references once each', () => {
        const xml = [
            '<img src="{{context_path}}/content/resources/a.png" />',
            '&lt;img src=&quot;{{context_path}}/content/resources/b c.jpg&quot;&gt;',
            '{"html":"<a href=\\"{{context_path}}/content/resources/d.pdf?x=1#p\\">"}',
            "<a href='{{context_path}}/content/resources/a.png'>",
            '{{context_path}}/20250605150704KZYGBR/legacy.jpg',
        ].join('\n');

        expect(resourceReferences(xml)).toEqual([
            'content/resources/a.png',
            'content/resources/b c.jpg',
            'content/resources/d.pdf',
        ]);
    });
});

describe('documentedVersion', () => {
    it('reads the version from the subtitle', () => {
        expect(documentedVersion(contentXml('pic.png', 'Versión de eXe: 4.0.6'))).toBe('4.0.6');
        expect(documentedVersion(contentXml('pic.png', 'A manual'))).toBeNull();
        expect(documentedVersion('<ode></ode>')).toBeNull();
    });
});

describe('validateProject', () => {
    it('accepts a project whose references are all present', () => {
        const report = validateProject(VALID_ELPX, 'p');
        expect(report.errors).toEqual([]);
        expect(report.references).toEqual(['content/resources/pic.png']);
    });

    it('accepts URL-encoded references', () => {
        const files = { 'content.xml': text(contentXml('my%20pic.png')), 'content/resources/my pic.png': PNG };
        expect(validateProject(files, 'p').errors).toEqual([]);
    });

    it('accepts names with a literal percent sign', () => {
        const files = { 'content.xml': text(contentXml('100%.png')), 'content/resources/100%.png': PNG };
        expect(validateProject(files, 'p').errors).toEqual([]);
    });

    it('fails without content.xml', () => {
        expect(validateProject({}, 'p').errors).toEqual(['p: content.xml is missing']);
    });

    it('fails when content.xml is not well-formed', () => {
        const files = { 'content.xml': text('<ode><odeProperties></ode>') };
        expect(validateProject(files, 'p').errors[0]).toStartWith('p: content.xml is not well-formed:');
    });

    it('fails when a referenced resource is missing', () => {
        const files = { 'content.xml': text(contentXml('gone.png')), 'content/resources/pic.png': PNG };
        expect(validateProject(files, 'p').errors).toEqual([
            'p: content.xml references content/resources/gone.png, which is not in the project',
        ]);
    });

    it('fails when a resource only differs in case', () => {
        const files = { 'content.xml': text(contentXml('editar.png')), 'content/resources/Editar.PNG': PNG };
        expect(validateProject(files, 'p').errors).toEqual([
            'p: content.xml references content/resources/editar.png, but the file is named content/resources/Editar.PNG (names are case-sensitive)',
        ]);
    });

    it('reports unused resources only when asked to', () => {
        const files = { ...VALID_ELPX, 'content/resources/old.png': PNG, 'screenshot.png': PNG };
        expect(validateProject(files, 'p').warnings).toEqual([]);
        expect(validateProject(files, 'p', { reportUnused: true }).warnings).toEqual([
            'p: content/resources/old.png is not referenced by content.xml',
        ]);
    });
});

describe('localLinks', () => {
    it('returns the local URLs of elements only', () => {
        const html = `<html><head><link href="libs/a.css?v=1"><script src="libs/a.js"></script>
            <script>var x = '<img src="not-a-link.png">';</script></head><body>
            <!-- <img src="commented.png"> -->
            <a href="https://exelearning.net">ext</a><a href="//cdn.example/x.js">cdn</a>
            <a href="mailto:a@example.org">mail</a><a href="#top">top</a><a href="">empty</a>
            <img src="{{context_path}}/x.png"><video poster="content/p.jpg"></video>
            <object data="content/doc.pdf"></object><div data-json='{"h":"<a href=\\"in-json.html\\">"}'></div>
            <template><img src="in-template.png"></template>
            <a href="html/b.html#frag">b</a></body></html>`;

        expect(localLinks(html).sort()).toEqual([
            'content/doc.pdf',
            'content/p.jpg',
            'html/b.html#frag',
            'in-template.png',
            'libs/a.css?v=1',
            'libs/a.js',
        ]);
    });
});

describe('validateSite', () => {
    it('accepts a site whose links all resolve', () => {
        const files: FileMap = {
            'index.html': text(
                '<a href="html/a.html">a</a><a href="libs/">libs</a><img src="content/resources/my%20pic.png">',
            ),
            'html/a.html': text(
                '<a href="../index.html#x">home</a><a href="./">here</a><script src="../libs/a.js?v=2"></script>',
            ),
            'libs/a.js': text(''),
            'content/resources/my pic.png': PNG,
        };
        expect(validateSite(files, 's')).toEqual({ errors: [], warnings: [], pages: 2, links: 6 });
    });

    it('fails without index.html', () => {
        expect(validateSite({ 'html/a.html': text('<p>a</p>') }, 's').errors).toEqual(['s: index.html is missing']);
    });

    it('fails on links to files that were not exported', () => {
        const files = { 'index.html': text('<img src="content/resources/gone.png"><a href="/abs.html">x</a>') };
        expect(validateSite(files, 's').errors.sort()).toEqual([
            's: index.html links to /abs.html, which was not exported',
            's: index.html links to content/resources/gone.png, which was not exported',
        ]);
    });

    it('only warns about links into the editor files', () => {
        const report = validateSite({ 'index.html': text('<img src="../files/perm/idevices/x/timer.png">') }, 's');
        expect(report.errors).toEqual([]);
        expect(report.warnings).toEqual([
            's: index.html links to ../files/perm/idevices/x/timer.png, which was not exported',
        ]);
    });

    it('fails on Mermaid diagrams left unrendered', () => {
        const report = validateSite({ 'index.html': text('<pre class="mermaid">graph TD; A-->B;</pre>') }, 's');
        expect(report.errors).toEqual(['s: index.html has a Mermaid diagram that was not pre-rendered']);
    });

    it('fails on Mermaid diagrams drawn without a size', () => {
        const diagram = (box: string): string =>
            `<div class="exe-mermaid-rendered"><svg id="m" viewBox="${box}"><g></g></svg></div>`;
        const files = { 'index.html': text(diagram('0 0 1200 196') + diagram('0 0 0 196') + diagram('')) };

        expect(validateSite(files, 's').errors).toEqual([
            's: index.html has an empty Mermaid diagram (viewBox "0 0 0 196")',
            's: index.html has an empty Mermaid diagram (viewBox "")',
        ]);
    });
});

describe('assetBaseName', () => {
    it('adds the version when there is one', () => {
        expect(assetBaseName('es')).toBe('exelearning-manual-es');
        expect(assetBaseName('en', 'v4.0.6')).toBe('exelearning-manual-en-v4.0.6');
    });
});

describe('buildLanguage', () => {
    it('builds the package, the website ZIP and the unpacked website with the real exporter', async () => {
        const root = tempDir();
        const out = path.join(tempDir(), 'out');
        writeManual(root, 'en');
        const lines: string[] = [];

        const result = await buildLanguage('en', { root, out, langs: [], version: 'v4.0.6', log: l => lines.push(l) });

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.files).toEqual([
            path.join(out, 'exelearning-manual-en-v4.0.6.elpx'),
            path.join(out, 'exelearning-manual-en-v4.0.6-html.zip'),
            path.join(out, 'site', 'en'),
        ]);
        const elpx = unzipSync(new Uint8Array(fs.readFileSync(result.files[0])));
        expect(Object.keys(elpx)).toEqual(
            expect.arrayContaining(['content.xml', 'content.dtd', 'index.html', 'content/resources/pic.png']),
        );
        const site = unzipSync(new Uint8Array(fs.readFileSync(result.files[1])));
        expect(Object.keys(site)).toEqual(expect.arrayContaining(['index.html', 'content/resources/pic.png']));
        expect(fs.readFileSync(path.join(out, 'site', 'en', 'index.html'), 'utf8')).toContain('Tiny manual');
        expect(fs.existsSync(path.join(out, 'site', 'en', 'content', 'resources', 'pic.png'))).toBe(true);
        expect(lines).toContain('manual/en: 2 source files, 1 resource references');
    }, 60_000);

    it('stops before exporting when the sources are invalid', async () => {
        const root = tempDir();
        const out = path.join(tempDir(), 'out');
        writeManual(root, 'es', contentXml('Pic.png'));
        let exported = false;
        const exportProject: ExportProject = async () => {
            exported = true;
            return { success: true, message: '' };
        };

        const result = await buildLanguage('es', { root, out, langs: [], exportProject, log: () => {} });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('names are case-sensitive');
        expect(result.files).toEqual([]);
        expect(exported).toBe(false);
        expect(fs.existsSync(out)).toBe(false);
    });

    it('publishes nothing when the exported website is invalid', async () => {
        const root = tempDir();
        const out = path.join(tempDir(), 'out');
        writeManual(root, 'es');
        const exportProject = fakeExporter({ elpx: VALID_ELPX, html5: { 'index.html': text('<img src="gone.png">') } });

        const result = await buildLanguage('es', { root, out, langs: [], exportProject, log: () => {} });

        expect(result.errors).toEqual(['manual/es website: index.html links to gone.png, which was not exported']);
        expect(result.files).toEqual([]);
        expect(fs.existsSync(out)).toBe(false);
    });

    it('reports a failed export', async () => {
        const root = tempDir();
        writeManual(root, 'es');
        const exportProject: ExportProject = async () => ({ success: false, message: 'Export failed: boom' });

        const result = await buildLanguage('es', { root, out: tempDir(), langs: [], exportProject, log: () => {} });

        expect(result.errors).toEqual(['manual/es: Export failed: boom']);
        expect(result.files).toEqual([]);
    });

    it('reports an exporter that throws something that is not an Error', async () => {
        const root = tempDir();
        writeManual(root, 'es');
        const exportProject: ExportProject = async () => {
            throw 'disk full';
        };

        const result = await buildLanguage('es', { root, out: tempDir(), langs: [], exportProject, log: () => {} });

        expect(result.errors).toEqual(['manual/es: disk full']);
    });

    it('warns when the manual documents another version than the release', async () => {
        const root = tempDir();
        writeManual(root, 'es');
        writeManual(root, 'en', contentXml('pic.png', 'A manual'));
        const exportProject = fakeExporter({ elpx: VALID_ELPX, html5: VALID_SITE });
        const build = (lang: string, version: string) =>
            buildLanguage(lang, { root, out: tempDir(), langs: [], version, exportProject, log: () => {} });

        expect((await build('es', 'v4.0.6')).warnings).toEqual([]);
        expect((await build('es', 'v4.0.6-1')).warnings).toEqual([]);
        expect((await build('es', 'v4.0.7')).warnings).toEqual([
            'manual/es: published for v4.0.7, but its subtitle says it documents 4.0.6',
        ]);
        expect((await build('en', 'v4.0.7')).warnings).toEqual([
            'manual/en: published for v4.0.7, but its subtitle says it documents no version',
        ]);
    });

    it('replaces the website of a previous build and skips unsafe archive entries', async () => {
        const root = tempDir();
        const out = tempDir();
        writeManual(root, 'es');
        fs.mkdirSync(path.join(out, 'site', 'es'), { recursive: true });
        fs.writeFileSync(path.join(out, 'site', 'es', 'stale.html'), 'old');
        const site = { ...VALID_SITE, '../escaped.html': text('x'), 'html/': new Uint8Array() };
        const exportProject = fakeExporter({ elpx: VALID_ELPX, html5: site });

        const result = await buildLanguage('es', { root, out, langs: [], exportProject, log: () => {} });

        expect(result.errors).toEqual([]);
        expect(fs.readdirSync(path.join(out, 'site', 'es')).sort()).toEqual(['html', 'index.html']);
        expect(fs.existsSync(path.join(out, 'site', 'escaped.html'))).toBe(false);
    });
});

describe('buildManuals', () => {
    const exportProject = fakeExporter({ elpx: VALID_ELPX, html5: VALID_SITE });

    it('builds every language by default and only the requested ones otherwise', async () => {
        const root = tempDir();
        writeManual(root, 'es');
        writeManual(root, 'en');
        const options = { root, out: tempDir(), exportProject, log: () => {} };

        expect((await buildManuals({ ...options, langs: [] })).map(r => r.lang)).toEqual(['en', 'es']);
        expect((await buildManuals({ ...options, langs: ['es'] })).map(r => r.lang)).toEqual(['es']);
    });

    it('fails for a language without manual and for an empty folder', async () => {
        const root = tempDir();
        const options = { root, out: tempDir(), exportProject, log: () => {} };
        await expect(buildManuals({ ...options, langs: [] })).rejects.toThrow(`No manual found in ${root}`);

        writeManual(root, 'es');
        await expect(buildManuals({ ...options, langs: ['en'] })).rejects.toThrow(`No manual for "en" in ${root}`);
    });
});

describe('run', () => {
    const exportProject = fakeExporter({ elpx: VALID_ELPX, html5: VALID_SITE });

    it('prints the report and returns 0 when every manual is valid', async () => {
        const root = tempDir();
        const out = tempDir();
        writeManual(root, 'es', contentXml(), { 'pic.png': PNG, 'old.png': PNG });
        const lines: string[] = [];

        const code = await run([`--root=${root}`, `--out=${out}`], { exportProject, log: l => lines.push(l) }, {});

        expect(code).toBe(0);
        expect(lines).toContain(
            'WARNING manual/es sources: content/resources/old.png is not referenced by content.xml',
        );
        expect(lines).toContain(`BUILT ${path.join(out, 'exelearning-manual-es.elpx')}`);
        expect(lines.at(-1)).toBe('OK');
    });

    it('returns 1 and annotates the problems on GitHub Actions', async () => {
        const root = tempDir();
        writeManual(root, 'es', contentXml('gone.png'), { 'old.png': PNG });
        const lines: string[] = [];

        const code = await run(
            [`--root=${root}`, `--out=${tempDir()}`],
            { exportProject, log: l => lines.push(l) },
            { GITHUB_ACTIONS: 'true' },
        );

        expect(code).toBe(1);
        expect(lines).toContain(
            '::warning::manual/es sources: content/resources/old.png is not referenced by content.xml',
        );
        expect(lines).toContain(
            '::error::manual/es sources: content.xml references content/resources/gone.png, which is not in the project',
        );
        expect(lines.at(-1)).toBe('1 problems');
    });

    it('prints plain errors outside GitHub Actions', async () => {
        const root = tempDir();
        writeManual(root, 'es', contentXml('gone.png'), {});
        const lines: string[] = [];

        expect(
            await run([`--root=${root}`, `--out=${tempDir()}`], { exportProject, log: l => lines.push(l) }, {}),
        ).toBe(1);
        expect(lines[1]).toStartWith('ERROR manual/es sources: content.xml references');
    });

    it('returns 1 for invalid arguments or a missing manual', async () => {
        const lines: string[] = [];
        const log = (line: string): void => void lines.push(line);

        expect(await run(['--bogus'], { log }, {})).toBe(1);
        expect(await run([`--root=${tempDir()}`], { log }, {})).toBe(1);
        expect(lines[0]).toBe('ERROR Unknown argument: --bogus');
        expect(lines[1]).toStartWith('ERROR No manual found in ');
    });
});

describe('the manuals in doc/manual', () => {
    const root = path.resolve(import.meta.dir, '..', DEFAULT_ROOT);
    const languages = discoverLanguages(root);

    it('include the Spanish manual', () => {
        expect(languages).toContain('es');
    });

    for (const lang of languages) {
        it(`${lang}: content.xml is well-formed and every referenced resource is stored`, () => {
            const report = validateProject(readSources(path.join(root, lang)), lang, { reportUnused: true });
            expect(report.errors).toEqual([]);
            expect(report.warnings).toEqual([]);
            expect(report.references.length).toBeGreaterThan(0);
        });

        it(`${lang}: stores no generated files`, () => {
            const stored = fs.readdirSync(path.join(root, lang)).filter(name => name !== '.DS_Store');
            expect(stored.sort()).toEqual(['content', 'content.xml', 'screenshot.png']);
            expect(fs.readdirSync(path.join(root, lang, 'content')).filter(name => name !== '.DS_Store')).toEqual([
                'resources',
            ]);
        });
    }
});
