#!/usr/bin/env bun
/**
 * Architecture record validation and index generation.
 *
 * Discovers Architecture Decision Records under `doc/architecture/adr/` and
 * change directories under `doc/architecture/changes/`, validates their
 * identifiers, metadata and cross-references, and generates the two indexes.
 *
 * Usage:
 *   bun run <this file> list     # print the record index      (core)
 *   node <this file> check       # validate, non-zero on failure (plugins)
 *
 * One source, two runtimes: core runs it with Bun, where `bun test` covers it;
 * the plugin repositories copy it verbatim and run it with the Node that ships
 * on the CI image. It must therefore avoid runtime-specific APIs.
 *
 * The index is deliberately NOT a committed file. It is contributor-facing, it
 * is derived entirely from frontmatter, and a generated file checked into git is
 * a guaranteed merge conflict on every concurrent branch.
 *
 * The identification model is specified in
 * `doc/architecture/changes/2232-issue-based-architecture-identifiers/spec.md`
 * and decided in `doc/architecture/adr/ADR-2232-01-*.md`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const CONFIG_NAME = 'architecture-records.json';

export const ADR_STATUSES = ['Proposed', 'Accepted', 'Rejected', 'Superseded'] as const;
export const CHANGE_STATUSES = ['draft', 'in-review', 'accepted', 'implemented', 'superseded', 'abandoned'] as const;

export const CHANGE_DOCUMENTS = ['proposal.md', 'spec.md', 'design.md', 'research.md', 'tasks.md'] as const;

/**
 * `0` marks a record that predates tracking — written when the repository
 * itself was bootstrapped. GitHub numbers issues and pull requests from 1, so
 * 0 can never collide with a real one, and unlike `1` it does not claim a pull
 * request that exists and is about something else.
 */
export const BOOTSTRAP_NUMBER = 0;

const NUMBER = '(0|[1-9][0-9]*)';
// The local sequence starts at 01: `00` is not a valid ordinal.
const SEQUENCE = '(0[1-9]|[1-9][0-9])';
const SLUG = '([a-z0-9]+(?:-[a-z0-9]+)*)';

export const POSITIVE_INT_RE = /^(0|[1-9][0-9]*)$/;
export const HTTP_URL_RE = /^https?:\/\/\S+$/;

export type Config = {
    prefix: string;
    recordsDir: string;
    changesDir: string;
    legacyAllowlist: string[];
    legacyPatterns: string[];
    architectureRoot: string;
    issuesUrl: string;
    repositoryLabel: string;
    recordRe: RegExp;
    changeDirRe: RegExp;
    retiredRe: RegExp | null;
    retiredNameRe: RegExp;
};

const DEFAULTS = {
    prefix: 'ADR',
    records_dir: 'doc/architecture/adr',
    changes_dir: 'doc/architecture/changes',
    legacy_allowlist: [] as string[],
    legacy_patterns: ['\\b(?:ADR|SDD)-[0-9]{4}(?!-[0-9]{2})\\b'],
    // Where this repository's tracking numbers resolve. The index is rendered
    // in every repository that copies this file, so it must not hard-code core.
    // The whole tree the convention governs. Derived by default from the
    // records directory, so a stray `sdd/` or `archive/` re-created by an old
    // branch is still caught.
    architecture_root: '',
    issues_url: 'https://github.com/exelearning/exelearning/issues',
    repository_label: 'the main eXeLearning repository',
};

/**
 * Everything repository-specific lives in `architecture-records.json`, so this
 * file stays byte-identical everywhere it is copied. Only paths and the record
 * prefix vary; every rule is the same in every repository.
 */
export function loadConfig(root: string): Config {
    const merged = { ...DEFAULTS };
    const path = join(root, CONFIG_NAME);
    if (existsSync(path)) {
        Object.assign(merged, JSON.parse(readFileSync(path, 'utf8')));
    }
    const prefix = merged.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
        prefix: merged.prefix,
        recordsDir: merged.records_dir,
        changesDir: merged.changes_dir,
        legacyAllowlist: merged.legacy_allowlist,
        legacyPatterns: merged.legacy_patterns,
        architectureRoot:
            merged.architecture_root || merged.records_dir.slice(0, merged.records_dir.lastIndexOf('/')),
        issuesUrl: merged.issues_url,
        repositoryLabel: merged.repository_label,
        recordRe: new RegExp(`^${prefix}-${NUMBER}-${SEQUENCE}-${SLUG}\\.md$`),
        changeDirRe: new RegExp(`^${NUMBER}-${SLUG}$`),
        retiredRe: merged.legacy_patterns.length > 0 ? new RegExp(merged.legacy_patterns.join('|')) : null,
        // Four digits NOT followed by a two-digit sequence: `ADR-2193-01-…` is
        // current and must not match on its own four-digit prefix.
        retiredNameRe: new RegExp(`^(?:ADR|SDD|${prefix})-[0-9]{4}-(?![0-9]{2}-)`),
    };
}

const GENERATED_BANNER = '<!-- Produced by `make architecture-records`. Not a committed file. -->';

// ---------------------------------------------------------------------------
// Minimal frontmatter parser
// ---------------------------------------------------------------------------

export type YamlValue = string | number | YamlValue[] | { [key: string]: YamlValue };

/**
 * Parses the bounded YAML subset used by architecture frontmatter:
 * scalars, inline lists, block lists, and one level of nested mappings.
 * Deliberately not a general YAML parser — the schema is fixed and small,
 * and a full YAML dependency is not warranted for it.
 */
export function parseFrontmatter(raw: string): { data: Record<string, YamlValue>; body: string } | null {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return null;

    const data: Record<string, YamlValue> = {};
    const lines = match[1].split(/\r?\n/);

    let currentKey: string | null = null;
    let currentList: string[] | null = null;
    let currentMap: Record<string, YamlValue> | null = null;
    // A `-` item belongs to this nested key when the mapping opened one, so
    // `related:\n  adrs:\n    - X` keeps X under `adrs` instead of replacing
    // the whole mapping with a flat list.
    let pendingNestedKey: string | null = null;

    const flush = (): void => {
        if (currentKey === null) return;
        if (currentList !== null) data[currentKey] = currentList;
        else if (currentMap !== null) data[currentKey] = currentMap;
        currentList = null;
        currentMap = null;
        currentKey = null;
        pendingNestedKey = null;
    };

    for (const line of lines) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue;

        const topLevel = line.match(/^([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
        if (topLevel) {
            flush();
            const key = topLevel[1];
            const rest = topLevel[2].trim();
            if (rest === '') {
                currentKey = key;
            } else {
                data[key] = parseScalarOrInlineList(rest);
            }
            continue;
        }

        const listItem = line.match(/^\s+-\s*(.*)$/);
        if (listItem && currentKey !== null) {
            const value = stripQuotes(listItem[1].trim());
            if (pendingNestedKey !== null) {
                currentMap ??= {};
                if (!Array.isArray(currentMap[pendingNestedKey])) currentMap[pendingNestedKey] = [];
                (currentMap[pendingNestedKey] as YamlValue[]).push(value);
                continue;
            }
            currentMap = null;
            currentList ??= [];
            currentList.push(value);
            continue;
        }

        const nested = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
        if (nested && currentKey !== null) {
            currentList = null;
            currentMap ??= {};
            const rest = nested[2].trim();
            if (rest === '') {
                pendingNestedKey = nested[1];
                currentMap[pendingNestedKey] = [];
            } else {
                pendingNestedKey = null;
                currentMap[nested[1]] = parseScalarOrInlineList(rest);
            }
        }
    }
    flush();

    return { data, body: match[2] };
}

function stripQuotes(value: string): string {
    return value.replace(/^["'](.*)["']$/, '$1');
}

function parseScalarOrInlineList(raw: string): YamlValue {
    if (raw.startsWith('[') && raw.endsWith(']')) {
        const inner = raw.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map(part => stripQuotes(part.trim()));
    }
    return stripQuotes(raw);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type Adr = {
    path: string;
    file: string;
    id: string;
    issue: number;
    sequence: string;
    title: string;
    status: string;
    date: string;
    trackingIssue: string;
    legacyId: string | null;
    supersedes: string[];
    supersededBy: string[];
    relatedAdrs: string[];
    relatedChanges: string[];
    relatedPrs: string[];
    deciders: string[];
    aiTool: string | null;
    aiModel: string | null;
    h1: string | null;
};

export type ChangeDoc = {
    path: string;
    name: string;
    data: Record<string, YamlValue>;
};

export type Change = {
    dir: string;
    name: string;
    issue: number;
    slug: string;
    documents: ChangeDoc[];
    canonical: ChangeDoc | null;
    title: string;
    status: string;
    date: string;
    implementationPrs: string[];
    relatedAdrs: string[];
    legacyId: string | null;
};

export type Diagnostic = { file: string; message: string };

function asList(value: YamlValue | undefined): string[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'object') return [];
    const single = String(value).trim();
    return single === '' ? [] : [single];
}

function asString(value: YamlValue | undefined): string {
    if (value === undefined) return '';
    if (typeof value === 'object') return '';
    return String(value);
}

function nested(data: Record<string, YamlValue>, key: string, sub: string): YamlValue | undefined {
    const node = data[key];
    if (node && typeof node === 'object' && !Array.isArray(node)) return node[sub];
    return undefined;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverAdrs(root: string, config: Config): { adrs: Adr[]; errors: Diagnostic[] } {
    const dir = join(root, config.recordsDir);
    const adrs: Adr[] = [];
    const errors: Diagnostic[] = [];
    if (!existsSync(dir)) return { adrs, errors };

    for (const file of readdirSync(dir).sort()) {
        if (!file.endsWith('.md')) continue;
        if (file === 'README.md' || file === 'records.md' || file === 'template.md') continue;

        const rel = `${config.recordsDir}/${file}`;

        // The new grammar is checked first: `ADR-1858-01-slug.md` also starts with
        // four digits, so the legacy pattern would otherwise shadow it.
        const match = file.match(config.recordRe);
        if (!match) {
            errors.push({
                file: rel,
                message: config.retiredNameRe.test(file)
                    ? 'uses the retired global numbering. Rename to ADR-<issue>-<NN>-<decision-slug>.md ' +
                      '(see doc/architecture/adr/README.md).'
                    : 'filename does not match ADR-<issue>-<NN>-<decision-slug>.md',
            });
            continue;
        }

        const parsed = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
        if (!parsed) {
            errors.push({ file: rel, message: 'missing YAML frontmatter' });
            continue;
        }

        const { data, body } = parsed;
        const h1 = body.match(/^# (.+)$/m)?.[1] ?? null;

        adrs.push({
            path: rel,
            file,
            id: asString(data.id),
            issue: Number(match[1]),
            sequence: match[2],
            title: asString(data.title),
            status: asString(data.status),
            date: asString(data.date),
            trackingIssue: asString(data.tracking_issue),
            legacyId: data.legacy_id !== undefined ? asString(data.legacy_id) : null,
            supersedes: asList(data.supersedes),
            supersededBy: asList(data.superseded_by),
            relatedAdrs: asList(nested(data, 'related', 'adrs')),
            relatedChanges: asList(nested(data, 'related', 'changes')),
            relatedPrs: asList(nested(data, 'related', 'prs')),
            deciders: asList(data.deciders),
            aiTool: data.ai_assistance !== undefined ? asString(nested(data, 'ai_assistance', 'tool')) : null,
            aiModel: data.ai_assistance !== undefined ? asString(nested(data, 'ai_assistance', 'model')) : null,
            h1,
        });
    }

    return { adrs, errors };
}

export function discoverChanges(root: string, config: Config): { changes: Change[]; errors: Diagnostic[] } {
    const dir = join(root, config.changesDir);
    const changes: Change[] = [];
    const errors: Diagnostic[] = [];
    if (!existsSync(dir)) return { changes, errors };

    for (const entry of readdirSync(dir).sort()) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;

        const rel = `${config.changesDir}/${entry}`;
        const match = entry.match(config.changeDirRe);
        if (!match) {
            errors.push({ file: rel, message: 'directory name does not match <issue>-<change-slug>' });
            continue;
        }

        const documents: ChangeDoc[] = [];
        for (const name of CHANGE_DOCUMENTS) {
            const docPath = join(full, name);
            if (!existsSync(docPath)) continue;
            const parsed = parseFrontmatter(readFileSync(docPath, 'utf8'));
            if (!parsed) {
                errors.push({ file: `${rel}/${name}`, message: 'missing YAML frontmatter' });
                continue;
            }
            documents.push({ path: `${rel}/${name}`, name, data: parsed.data });
        }

        if (documents.length === 0) {
            errors.push({
                file: rel,
                message: `contains no recognised document (${CHANGE_DOCUMENTS.join(', ')})`,
            });
            continue;
        }

        const canonical = documents[0];
        changes.push({
            dir: rel,
            name: entry,
            issue: Number(match[1]),
            slug: match[2],
            documents,
            canonical,
            title: asString(canonical.data.title),
            status: asString(canonical.data.status),
            date: asString(canonical.data.date),
            implementationPrs: asList(canonical.data.implementation_prs),
            relatedAdrs: asList(canonical.data.related_adrs),
            legacyId: canonical.data.legacy_id !== undefined ? asString(canonical.data.legacy_id) : null,
        });
    }

    return { changes, errors };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A tracking number: a real GitHub number, or the bootstrap sentinel `0`. */
export function isTrackingNumber(value: string): boolean {
    return POSITIVE_INT_RE.test(value);
}

export function isPositiveInteger(value: string): boolean {
    return /^[1-9][0-9]*$/.test(value);
}

export function validate(adrs: Adr[], changes: Change[], config: Config): Diagnostic[] {
    const problems: Diagnostic[] = [];
    const add = (file: string, message: string): void => {
        problems.push({ file, message });
    };

    const adrIds = new Set(adrs.map(a => a.id));
    const changeNames = new Set(changes.map(c => c.name));
    const seenIds = new Map<string, string>();
    const seenSequences = new Map<string, string>();

    for (const adr of adrs) {
        const expectedId = `${config.prefix}-${adr.issue}-${adr.sequence}`;

        if (adr.id === '') add(adr.path, 'missing required field `id`');
        else if (adr.id !== expectedId) {
            add(adr.path, `frontmatter id "${adr.id}" does not match filename (expected "${expectedId}")`);
        }

        if (adr.title === '') add(adr.path, 'missing required field `title`');
        if (adr.date === '') add(adr.path, 'missing required field `date`');
        else if (!isValidDate(adr.date)) add(adr.path, `date "${adr.date}" is not a valid YYYY-MM-DD date`);

        if (adr.status === '') add(adr.path, 'missing required field `status`');
        else if (!(ADR_STATUSES as readonly string[]).includes(adr.status)) {
            add(adr.path, `status "${adr.status}" is not one of ${ADR_STATUSES.join(', ')}`);
        }

        if (adr.trackingIssue === '') add(adr.path, 'missing required field `tracking_issue`');
        else if (!isTrackingNumber(adr.trackingIssue)) {
            add(adr.path, `tracking_issue "${adr.trackingIssue}" is not a positive integer`);
        } else if (Number(adr.trackingIssue) !== adr.issue) {
            add(adr.path, `tracking_issue ${adr.trackingIssue} does not match filename issue ${adr.issue}`);
        }

        if (adr.deciders.length === 0) add(adr.path, 'missing required field `deciders`');
        if (adr.aiTool === null || adr.aiTool === '') {
            add(adr.path, 'missing required field `ai_assistance.tool` (use `none` if no AI tool was used)');
        }
        if (adr.aiModel === null || adr.aiModel === '') {
            add(adr.path, 'missing required field `ai_assistance.model` (use `none` if no AI tool was used)');
        }

        const expectedH1 = `${expectedId}: ${adr.title}`;
        if (adr.h1 === null) add(adr.path, 'missing H1 heading');
        else if (adr.h1 !== expectedH1) add(adr.path, `H1 is "${adr.h1}" but should be "${expectedH1}"`);

        const previousId = seenIds.get(adr.id);
        if (previousId !== undefined) add(adr.path, `duplicate ADR id "${adr.id}" (also in ${previousId})`);
        else if (adr.id !== '') seenIds.set(adr.id, adr.path);

        const sequenceKey = `${adr.issue}-${adr.sequence}`;
        const previousSequence = seenSequences.get(sequenceKey);
        if (previousSequence !== undefined) {
            add(
                adr.path,
                `duplicate local sequence ${adr.sequence} for issue ${adr.issue} (also in ${previousSequence})`,
            );
        } else seenSequences.set(sequenceKey, adr.path);

        for (const ref of adr.relatedAdrs) {
            if (!adrIds.has(ref)) add(adr.path, `related.adrs references unknown ADR "${ref}"`);
        }
        for (const ref of adr.relatedChanges) {
            if (!changeNames.has(ref)) add(adr.path, `related.changes references unknown change "${ref}"`);
        }
        for (const pr of adr.relatedPrs) {
            if (!isPositiveInteger(pr)) add(adr.path, `related.prs value "${pr}" is not a positive integer`);
        }

        for (const ref of adr.supersedes) {
            if (ref === adr.id) add(adr.path, 'ADR cannot supersede itself');
            else if (!adrIds.has(ref)) add(adr.path, `supersedes references unknown ADR "${ref}"`);
            else {
                const target = adrs.find(a => a.id === ref);
                if (target && !target.supersededBy.includes(adr.id)) {
                    add(adr.path, `supersedes "${ref}" but ${target.path} does not list superseded_by: [${adr.id}]`);
                }
                if (target && target.status !== 'Superseded') {
                    add(target.path, `is superseded by ${adr.id} but status is "${target.status}", not "Superseded"`);
                }
            }
        }
        for (const ref of adr.supersededBy) {
            if (ref === adr.id) add(adr.path, 'ADR cannot be superseded by itself');
            else if (!adrIds.has(ref)) add(adr.path, `superseded_by references unknown ADR "${ref}"`);
            else {
                const target = adrs.find(a => a.id === ref);
                if (target && !target.supersedes.includes(adr.id)) {
                    add(adr.path, `superseded_by "${ref}" but ${target.path} does not list supersedes: [${adr.id}]`);
                }
            }
        }
    }

    for (const change of changes) {
        const canonical = change.canonical;
        if (canonical === null) continue;

        if (change.title === '') add(canonical.path, 'missing required field `title`');
        if (change.date === '') add(canonical.path, 'missing required field `date`');
        else if (!isValidDate(change.date)) {
            add(canonical.path, `date "${change.date}" is not a valid YYYY-MM-DD date`);
        }

        if (change.status === '') add(canonical.path, 'missing required field `status`');
        else if (!(CHANGE_STATUSES as readonly string[]).includes(change.status)) {
            add(canonical.path, `status "${change.status}" is not one of ${CHANGE_STATUSES.join(', ')}`);
        }

        for (const pr of change.implementationPrs) {
            if (!isPositiveInteger(pr)) {
                add(canonical.path, `implementation_prs value "${pr}" is not a positive integer`);
            }
        }
        for (const ref of change.relatedAdrs) {
            if (!adrIds.has(ref)) add(canonical.path, `related_adrs references unknown ADR "${ref}"`);
        }

        for (const doc of change.documents) {
            const issue = asString(doc.data.tracking_issue);
            if (issue === '') add(doc.path, 'missing required field `tracking_issue`');
            else if (!isPositiveInteger(issue)) {
                add(doc.path, `tracking_issue "${issue}" is not a positive integer`);
            } else if (Number(issue) !== change.issue) {
                add(doc.path, `tracking_issue ${issue} does not match change directory issue ${change.issue}`);
            }

            if (asString(doc.data.title) === '') add(doc.path, 'missing required field `title`');

            // Split by what the field describes. `date`, `authors` and
            // `ai_assistance` describe THIS document, so every document carries
            // them. `status` and `related_adrs` describe the CHANGE, so they
            // live in the canonical document alone — duplicating them is how the
            // two sources drift, which is exactly what this convention removes.
            if (doc.name !== canonical.name) {
                for (const field of ['status', 'related_adrs'] as const) {
                    if (doc.data[field] !== undefined) {
                        add(
                            doc.path,
                            `declares \`${field}\`, but ${canonical.name} is the canonical carrier ` +
                                'for it — a second copy can only drift',
                        );
                    }
                }
            }

            const docDate = asString(doc.data.date);
            if (docDate === '') add(doc.path, 'missing required field `date`');
            else if (!isValidDate(docDate)) add(doc.path, `date "${docDate}" is not a valid YYYY-MM-DD date`);

            if (asList(doc.data.authors).length === 0) add(doc.path, 'missing required field `authors`');

            const docAi = doc.data.ai_assistance;
            const aiTool = docAi && typeof docAi === 'object' && !Array.isArray(docAi) ? asString(docAi.tool) : '';
            const aiModel = docAi && typeof docAi === 'object' && !Array.isArray(docAi) ? asString(docAi.model) : '';
            if (aiTool === '' || aiModel === '') {
                add(doc.path, 'missing `ai_assistance.tool` / `ai_assistance.model` (use `none` if unused)');
            }



            for (const pr of asList(doc.data.related_prs)) {
                if (!isPositiveInteger(pr)) add(doc.path, `related_prs value "${pr}" is not a positive integer`);
            }

            if (doc !== canonical && doc.data.implementation_prs !== undefined) {
                add(
                    doc.path,
                    `declares implementation_prs, but ${canonical.name} is the canonical metadata carrier for this change`,
                );
            }
        }
    }

    return problems;
}

/**
 * The index is derived, not stored. Committing it reintroduces exactly the
 * merge-conflict class this convention removes, so its presence is an error.
 */
export function findCommittedIndexes(files: string[], config: Config): Diagnostic[] {
    return files
        // Anywhere under the architecture tree, not two fixed paths: an old
        // branch can re-create `sdd/records.md`.
        .filter(file => file.startsWith(`${config.architectureRoot}/`) && file.endsWith('/records.md'))
        .map(file => ({
            file,
            message:
                'the record index must not be committed — it is derived from frontmatter and ' +
                'conflicts on every concurrent branch. Delete it; `make architecture-records` prints it.',
        }));
}

/**
 * A retired filename anywhere under the architecture tree, not just directly in
 * the records directory: a four-digit `SDD-NNNN-old.md` dropped into a change
 * directory is ignored by
 * discovery (it is not one of the five recognised documents) and its content
 * need never mention its own id, so only the path catches it.
 * (Example spelled without a literal retired id, so this file does not trip
 * its own detector.)
 */
export function findRetiredFilenames(files: string[], config: Config): Diagnostic[] {
    return files
        .filter(file => file.startsWith(`${config.architectureRoot}/`))
        .filter(file => config.retiredNameRe.test(file.slice(file.lastIndexOf('/') + 1)))
        .map(file => ({
            file,
            message:
                'uses the retired global numbering in its filename. Rename it to the ' +
                'tracking-number form, or move it out of the architecture tree.',
        }));
}

/** Scans tracked files for retired identifiers outside the documented allowlist. */
export function findLegacyReferences(root: string, files: string[], config: Config): Diagnostic[] {
    const problems: Diagnostic[] = [];
    for (const file of files) {
        if (config.legacyAllowlist.some(allowed => file === allowed || file.startsWith(allowed))) {
            continue;
        }
        const full = join(root, file);
        if (!existsSync(full)) continue;

        let content: string;
        try {
            content = readFileSync(full, 'utf8');
        } catch {
            continue;
        }
        if (content.includes('\0')) continue;

        // A migrated document may name its own former identifier, so that the
        // provenance note in the document itself stays readable.
        const ownLegacyId = file.endsWith('.md')
            ? (parseFrontmatter(content)?.data.legacy_id as string | undefined)
            : undefined;

        content.split(/\r?\n/).forEach((line, index) => {
            if (line.includes('legacy_id:')) return;
            // matchAll, not match: a line may name its own legacy id AND another
            // retired one, and the first hit must not swallow the second.
            const global = config.retiredRe ? new RegExp(config.retiredRe.source, 'g') : null;
            const hit = global
                ? [...line.matchAll(global)].map(m => m[0]).find(id => id !== ownLegacyId)
                : undefined;
            if (hit !== undefined) {
                problems.push({
                    file: `${file}:${index + 1}`,
                    message: `references retired identifier "${hit}". Use the current identifier.`,
                });
            }
        });
    }
    return problems;
}

// ---------------------------------------------------------------------------
// Index generation
// ---------------------------------------------------------------------------

export function sortAdrs(adrs: Adr[]): Adr[] {
    return [...adrs].sort((a, b) => a.issue - b.issue || a.sequence.localeCompare(b.sequence));
}

export function sortChanges(changes: Change[]): Change[] {
    return [...changes].sort((a, b) => a.issue - b.issue || a.slug.localeCompare(b.slug));
}

function issueLink(issue: number, config: Config): string {
    if (issue === BOOTSTRAP_NUMBER) return 'bootstrap';
    return `[#${issue}](${config.issuesUrl}/${issue})`;
}

export function renderAdrIndex(adrs: Adr[], config: Config): string {
    const sorted = sortAdrs(adrs);
    const lines: string[] = [
        GENERATED_BANNER,
        '',
        '# ADR Index',
        '',
        `Architecture Decision Records for ${config.repositoryLabel}, ordered by`,
        `tracking number and then by local sequence. See ${config.recordsDir}/README.md`,
        'for the policy.',
        '',
        '| ID | Title | Status | Issue | Date |',
        '|---|---|---|---|---|',
    ];

    for (const adr of sorted) {
        lines.push(
            `| [${adr.id}](${adr.file}) | ${adr.title} | ${adr.status} | ${issueLink(adr.issue, config)} | ${adr.date} |`,
        );
    }

    for (const status of ADR_STATUSES) {
        lines.push('', `## ${status}`, '');
        const group = sorted.filter(adr => adr.status === status);
        if (group.length === 0) {
            lines.push(`_No ${status.toLowerCase()} ADRs._`);
            continue;
        }
        for (const adr of group) {
            const supersession = adr.supersededBy.length > 0 ? ` — superseded by ${adr.supersededBy.join(', ')}` : '';
            lines.push(`- [${adr.id}](${adr.file}) — ${adr.title}${supersession}`);
        }
    }

    return `${lines.join('\n')}\n`;
}

export function renderChangeIndex(changes: Change[], config: Config): string {
    const sorted = sortChanges(changes);
    const lines: string[] = [
        GENERATED_BANNER,
        '',
        '# Change Index',
        '',
        `Change proposals, specifications and designs for ${config.repositoryLabel},`,
        'ordered by tracking number. Each change lives in its own directory named',
        `\`<number>-<change-slug>\`. See ${config.changesDir}/README.md for the policy.`,
        '',
        '| Change | Title | Status | Issue | Date | Documents |',
        '|---|---|---|---|---|---|',
    ];

    for (const change of sorted) {
        const docs = change.documents
            .map(doc => `[${doc.name.replace(/\.md$/, '')}](${change.name}/${doc.name})`)
            .join(', ');
        lines.push(
            `| \`${change.name}\` | ${change.title} | ${change.status} | ${issueLink(change.issue, config)} | ${change.date} | ${docs} |`,
        );
    }

    for (const status of CHANGE_STATUSES) {
        lines.push('', `## ${status}`, '');
        const group = sorted.filter(change => change.status === status);
        if (group.length === 0) {
            lines.push(`_No ${status} changes._`);
            continue;
        }
        for (const change of group) {
            const adrs = change.relatedAdrs.length > 0 ? ` — ${change.relatedAdrs.join(', ')}` : '';
            lines.push(`- [\`${change.name}\`](${change.name}/${change.documents[0].name}) — ${change.title}${adrs}`);
        }
    }

    return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Tracked files plus not-yet-added ones, honouring .gitignore. Including
 * untracked files matters: otherwise a brand-new file passes `check` locally
 * and only fails in CI, once it has been committed.
 */
function trackedFiles(root: string): string[] {
    // node:child_process rather than Bun.spawnSync: this file is copied verbatim
    // into the plugin repositories, which run it with the Node that ships on the
    // CI image. It must execute identically under both runtimes.
    try {
        const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
            cwd: root,
            encoding: 'utf8',
        });
        return [...new Set(out.split('\n').filter(Boolean))];
    } catch {
        return [];
    }
}

function report(title: string, problems: Diagnostic[]): void {
    if (problems.length === 0) return;
    console.error(`\n${title}`);
    for (const problem of problems) console.error(`  ✗ ${problem.file}: ${problem.message}`);
}

export function run(mode: 'list' | 'check', root: string): number {
    const config = loadConfig(root);
    const { adrs, errors: adrErrors } = discoverAdrs(root, config);
    const { changes, errors: changeErrors } = discoverChanges(root, config);
    const structural = [...adrErrors, ...changeErrors];

    if (mode === 'list') {
        report('Structural problems:', structural);
        if (structural.length > 0) {
            console.error('\nRefusing to list records while structural problems remain.');
            return 1;
        }
        console.log(renderAdrIndex(adrs, config));
        console.log(renderChangeIndex(changes, config));
        return 0;
    }

    const files = trackedFiles(root);
    const metadata = validate(adrs, changes, config);
    const legacy = findLegacyReferences(root, files, config);
    const committedIndexes = findCommittedIndexes(files, config);
    const retiredNames = findRetiredFilenames(files, config);

    report('Structural problems:', structural);
    report('Metadata problems:', metadata);
    report('Retired identifier references:', legacy);
    report('Committed index:', committedIndexes);
    report('Retired filenames:', retiredNames);

    const bootstrap = adrs.filter(adr => adr.issue === BOOTSTRAP_NUMBER).length;
    const total =
        structural.length + metadata.length + legacy.length + committedIndexes.length + retiredNames.length;
    if (total === 0) {
        console.log(`Architecture records OK — ${adrs.length} records${bootstrap > 0 ? ` (${bootstrap} from repository bootstrap)` : ''}, ${changes.length} changes.`);
        return 0;
    }
    console.error(`\n${total} problem(s) found.`);
    return 1;
}

if (import.meta.main) {
    const mode = process.argv[2];
    if (mode !== 'list' && mode !== 'check') {
        console.error('Usage: bun run scripts/architecture-records.mts <list|check>');
        process.exit(2);
    }
    process.exit(run(mode, process.cwd()));
}
