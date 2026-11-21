#!/usr/bin/env bun
/**
 * build-manual.ts — build and validate the eXeLearning user manuals.
 *
 * Each language of the user manual is an unpacked eXeLearning project kept in
 * `doc/manual/<lang>/` (`content.xml`, `content/resources/`, `screenshot.png`
 * and, optionally, its own `theme/` or `custom/`). This script turns every
 * language into the files that are published with a release:
 *
 *   <out>/exelearning-manual-<lang>[-<version>].elpx       editable project
 *   <out>/exelearning-manual-<lang>[-<version>]-html.zip   HTML5 website
 *   <out>/site/<lang>/                                     the same website, unpacked
 *
 * It exports with the exporter of this checkout (the same code as
 * `bun cli elp:export`), so a manual built from a release tag is produced by
 * the very eXeLearning version it documents. Run `make bundle` first: the
 * exporter reads the built assets from `public/`.
 *
 * The build fails when the sources, the package or the website are invalid:
 * `content.xml` is not well-formed, a referenced resource is missing (names
 * are compared case-sensitively on every platform), a page links to a file
 * that was not exported, or a Mermaid diagram was left unrendered or empty.
 *
 * Usage:
 *   bun run scripts/build-manual.ts [--lang=es[,en]] [--out=dist/manual]
 *                                   [--root=doc/manual] [--version=v4.0.6]
 *
 * See doc/development/user-manual.md.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import { unzipSync, zipSync } from 'fflate';
import { parse as parseHtml } from 'parse5';

import { execute as runElpExport } from '../src/cli/commands/elp-export';

/** Files of a package or website, keyed by their POSIX path. */
export type FileMap = Record<string, Uint8Array>;

/** Exports `input` to `output` in `format`; the signature of the `elp:export` CLI command. */
export type ExportProject = (
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
) => Promise<{ success: boolean; message: string }>;

export interface Report {
    errors: string[];
    warnings: string[];
}

export interface BuildOptions {
    /** Directory that holds one folder per language. */
    root: string;
    /** Output directory. */
    out: string;
    /** Languages to build; every language found in `root` when empty. */
    langs: string[];
    /** Release the files are published for (e.g. `v4.0.6`); added to the file names. */
    version?: string;
    exportProject?: ExportProject;
    log?: (line: string) => void;
}

export interface LanguageResult extends Report {
    lang: string;
    /** Paths of the generated files; empty when the sources were invalid. */
    files: string[];
}

export const DEFAULT_ROOT = 'doc/manual';
export const DEFAULT_OUT = 'dist/manual';

/** Project entries that make up the editable sources of a manual. */
const SOURCE_FILES = ['content.xml', 'screenshot.png'];
const SOURCE_DIRS = ['content/resources', 'theme', 'custom'];
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

const LANG_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const decoder = new TextDecoder('utf-8');

export function parseArgs(argv: string[]): Pick<BuildOptions, 'root' | 'out' | 'langs' | 'version'> {
    const options: Pick<BuildOptions, 'root' | 'out' | 'langs' | 'version'> = {
        root: DEFAULT_ROOT,
        out: DEFAULT_OUT,
        langs: [],
    };
    for (const arg of argv) {
        const match = /^--(lang|out|root|version)=(.*)$/.exec(arg);
        if (!match) throw new Error(`Unknown argument: ${arg}`);
        const [, key, value] = match;
        if (!value) throw new Error(`--${key} needs a value`);
        if (key === 'lang') options.langs.push(...value.split(',').filter(Boolean));
        else if (key === 'out') options.out = value;
        else if (key === 'root') options.root = value;
        else options.version = value;
    }
    for (const lang of options.langs) {
        if (!LANG_PATTERN.test(lang)) throw new Error(`Invalid language code: ${lang}`);
    }
    if (options.version !== undefined && !VERSION_PATTERN.test(options.version)) {
        throw new Error(`Invalid version: ${options.version}`);
    }
    return options;
}

/** Languages with a manual: the folders of `root` that contain a `content.xml`. */
export function discoverLanguages(root: string): string[] {
    if (!fs.existsSync(root)) return [];
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && LANG_PATTERN.test(entry.name))
        .filter(entry => fs.existsSync(path.join(root, entry.name, 'content.xml')))
        .map(entry => entry.name)
        .sort();
}

function readTree(dir: string, prefix: string, files: FileMap): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED_FILES.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const key = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) readTree(full, key, files);
        else if (entry.isFile()) files[key] = new Uint8Array(fs.readFileSync(full));
    }
}

/** Reads the editable sources of one language. Anything else in the folder is left out. */
export function readSources(dir: string): FileMap {
    const files: FileMap = {};
    for (const name of SOURCE_FILES) {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) files[name] = new Uint8Array(fs.readFileSync(full));
    }
    for (const name of SOURCE_DIRS) {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) readTree(full, name, files);
    }
    return files;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function decodeUri(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/** The `content/resources/...` files that `content.xml` references, as written in it. */
export function resourceReferences(contentXml: string): string[] {
    const refs = new Set<string>();
    const pattern = /\{\{context_path\}\}\/(content\/resources\/[^"'<>\\?#]+)/g;
    for (const match of decodeEntities(contentXml).matchAll(pattern)) refs.add(match[1]);
    return [...refs].sort();
}

/** The eXeLearning version the manual says it documents (its subtitle), if any. */
export function documentedVersion(contentXml: string): string | null {
    const subtitle = /<key>pp_subtitle<\/key>\s*<value>([^<]*)<\/value>/.exec(contentXml);
    const version = subtitle && /\d+\.\d+(\.\d+)*/.exec(subtitle[1]);
    return version ? version[0] : null;
}

/**
 * Checks a project (sources or packaged `.elpx`): `content.xml` is present and
 * well-formed and every resource it references is in the project. Names are
 * compared exactly, so a file that only differs in case is reported even on
 * case-insensitive file systems, where it would otherwise only break after
 * publishing. With `reportUnused`, resources that nothing references are
 * reported as warnings: they only add weight to the repository.
 */
export function validateProject(
    files: FileMap,
    label: string,
    { reportUnused = false } = {},
): Report & { references: string[] } {
    const report = { errors: [] as string[], warnings: [] as string[], references: [] as string[] };
    const content = files['content.xml'];
    if (!content) {
        report.errors.push(`${label}: content.xml is missing`);
        return report;
    }
    const xml = decoder.decode(content);
    const valid = XMLValidator.validate(xml);
    if (valid !== true) {
        report.errors.push(`${label}: content.xml is not well-formed: ${valid.err.msg} (line ${valid.err.line})`);
    }

    const names = Object.keys(files);
    const byLowerCase = new Map(names.map(name => [name.toLowerCase(), name]));
    const used = new Set<string>();
    report.references = resourceReferences(xml);
    for (const ref of report.references) {
        const found = [ref, decodeUri(ref)].find(candidate => candidate in files);
        if (found) {
            used.add(found);
            continue;
        }
        const similar = byLowerCase.get(decodeUri(ref).toLowerCase());
        report.errors.push(
            similar
                ? `${label}: content.xml references ${ref}, but the file is named ${similar} (names are case-sensitive)`
                : `${label}: content.xml references ${ref}, which is not in the project`,
        );
    }
    for (const name of reportUnused ? names : []) {
        if (name.startsWith('content/resources/') && !used.has(name)) {
            report.warnings.push(`${label}: ${name} is not referenced by content.xml`);
        }
    }
    return report;
}

const LINK_ATTRIBUTES = new Set(['src', 'href', 'poster', 'data']);

interface HtmlNode {
    attrs?: { name: string; value: string }[];
    childNodes?: HtmlNode[];
    content?: HtmlNode;
}

/** Local `src`, `href`, `poster` and `data` values of the elements of a page. */
export function localLinks(html: string): string[] {
    const links: string[] = [];
    const pending: HtmlNode[] = [parseHtml(html) as HtmlNode];
    for (let node = pending.pop(); node; node = pending.pop()) {
        for (const { name, value } of node.attrs ?? []) {
            const url = value.trim();
            const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
            if (!LINK_ATTRIBUTES.has(name) || !url || isExternal || url.startsWith('#') || url.includes('{{')) continue;
            links.push(url);
        }
        pending.push(...(node.childNodes ?? []));
        if (node.content) pending.push(node.content);
    }
    return links;
}

/**
 * Checks an exported website: it has an `index.html`, every local link of its
 * pages points to an exported file and every Mermaid diagram was drawn.
 * Links into the editor's own files (`files/perm/`) can never be exported; they
 * come from the content, so they are reported as warnings to fix in the editor.
 */
export function validateSite(files: FileMap, label: string): Report & { pages: number; links: number } {
    const report = { errors: [] as string[], warnings: [] as string[], pages: 0, links: 0 };
    if (!files['index.html']) report.errors.push(`${label}: index.html is missing`);

    const names = Object.keys(files);
    const directories = new Set<string>(['.']);
    for (const name of names) {
        for (let dir = path.posix.dirname(name); dir !== '.'; dir = path.posix.dirname(dir)) directories.add(dir);
    }

    for (const page of names.filter(name => name.endsWith('.html')).sort()) {
        report.pages++;
        const html = decoder.decode(files[page]);
        if (/class="mermaid"/.test(html)) {
            report.errors.push(`${label}: ${page} has a Mermaid diagram that was not pre-rendered`);
        }
        if (html.includes('exe-mermaid-rendered')) {
            // A diagram drawn without a size is in the page, but nobody can see it.
            for (const [, box] of html.matchAll(/<svg\b[^>]*\sviewBox="([^"]*)"/g)) {
                const [, , width, height] = box
                    .trim()
                    .split(/[\s,]+/)
                    .map(Number);
                if (!(width > 0 && height > 0)) {
                    report.errors.push(`${label}: ${page} has an empty Mermaid diagram (viewBox "${box}")`);
                }
            }
        }
        for (const url of localLinks(html)) {
            report.links++;
            const target = decodeUri(url.replace(/[?#].*$/, ''));
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), target)).replace(/\/$/, '');
            const exists = !target.startsWith('/') && (resolved in files || directories.has(resolved));
            if (exists) continue;
            const problems = url.includes('files/perm/') ? report.warnings : report.errors;
            problems.push(`${label}: ${page} links to ${url}, which was not exported`);
        }
    }
    return report;
}

/** Base name of the published files of a language, e.g. `exelearning-manual-es-v4.0.6`. */
export function assetBaseName(lang: string, version?: string): string {
    return version ? `exelearning-manual-${lang}-${version}` : `exelearning-manual-${lang}`;
}

function writeTree(dir: string, files: FileMap): void {
    for (const [name, data] of Object.entries(files)) {
        if (name.endsWith('/')) continue;
        const target = path.join(dir, ...name.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
}

async function exportTo(exportProject: ExportProject, input: string, output: string, format: string): Promise<FileMap> {
    const result = await exportProject([input, output], { format });
    if (!result.success) throw new Error(result.message);
    return unzipSync(new Uint8Array(fs.readFileSync(output)), { filter: file => !/(^|\/)\.\.(\/|$)/.test(file.name) });
}

/** Builds and validates the manual of one language. */
export async function buildLanguage(lang: string, options: BuildOptions): Promise<LanguageResult> {
    const { root, out, version, exportProject = runElpExport, log = console.log } = options;
    const result: LanguageResult = { lang, files: [], errors: [], warnings: [] };
    const label = `manual/${lang}`;
    const collect = (report: Report): void => {
        result.errors.push(...report.errors);
        result.warnings.push(...report.warnings);
    };

    const sources = readSources(path.join(root, lang));
    const sourceReport = validateProject(sources, `${label} sources`, { reportUnused: true });
    collect(sourceReport);
    log(`${label}: ${Object.keys(sources).length} source files, ${sourceReport.references.length} resource references`);
    if (result.errors.length > 0) return result;

    const documented = documentedVersion(decoder.decode(sources['content.xml']));
    if (version && documented !== version.replace(/^v/, '').replace(/-.*$/, '')) {
        result.warnings.push(
            `${label}: published for ${version}, but its subtitle says it documents ${documented ?? 'no version'}`,
        );
    }

    const base = assetBaseName(lang, version);
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `exe-manual-${lang}-`));
    try {
        // The sources hold no generated files; the exporter adds the DTD, the
        // style and the website, exactly as saving the project in eXeLearning does.
        const input = path.join(work, 'sources.elpx');
        fs.writeFileSync(input, zipSync(sources, { level: 0 }));

        const elpxPath = path.join(work, `${base}.elpx`);
        const elpx = await exportTo(exportProject, input, elpxPath, 'elpx');
        collect(validateProject(elpx, `${label} ${base}.elpx`));

        const sitePath = path.join(work, `${base}-html.zip`);
        const site = await exportTo(exportProject, input, sitePath, 'html5');
        const siteReport = validateSite(site, `${label} website`);
        collect(siteReport);
        log(`${label}: ${siteReport.pages} pages, ${siteReport.links} local links`);
        if (result.errors.length > 0) return result;

        const siteDir = path.join(out, 'site', lang);
        fs.rmSync(siteDir, { recursive: true, force: true });
        fs.mkdirSync(siteDir, { recursive: true });
        writeTree(siteDir, site);
        for (const built of [elpxPath, sitePath]) {
            const target = path.join(out, path.basename(built));
            fs.copyFileSync(built, target);
            result.files.push(target);
        }
        result.files.push(siteDir);
    } catch (error) {
        result.errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
    return result;
}

/** Builds the requested languages (all of them by default), one after another. */
export async function buildManuals(options: BuildOptions): Promise<LanguageResult[]> {
    const available = discoverLanguages(options.root);
    const langs = options.langs.length > 0 ? options.langs : available;
    if (langs.length === 0) throw new Error(`No manual found in ${options.root}`);
    for (const lang of langs) {
        if (!available.includes(lang)) throw new Error(`No manual for "${lang}" in ${options.root}`);
    }
    const results: LanguageResult[] = [];
    for (const lang of langs) results.push(await buildLanguage(lang, options));
    return results;
}

/** Runs the build and prints its report. Returns the process exit code. */
export async function run(
    argv: string[],
    overrides: Partial<BuildOptions> = {},
    env: Record<string, string | undefined> = process.env,
): Promise<number> {
    const log = overrides.log ?? console.log;
    // GitHub Actions turns these prefixes into annotations on the run.
    const annotate = env.GITHUB_ACTIONS === 'true';
    let results: LanguageResult[];
    try {
        results = await buildManuals({ ...parseArgs(argv), ...overrides });
    } catch (error) {
        log(`ERROR ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
    let errors = 0;
    for (const result of results) {
        for (const warning of result.warnings) log(annotate ? `::warning::${warning}` : `WARNING ${warning}`);
        for (const error of result.errors) log(annotate ? `::error::${error}` : `ERROR ${error}`);
        for (const file of result.files) log(`BUILT ${file}`);
        errors += result.errors.length;
    }
    log(errors === 0 ? 'OK' : `${errors} problems`);
    return errors === 0 ? 0 : 1;
}

if (import.meta.main) {
    process.exit(await run(process.argv.slice(2)));
}
