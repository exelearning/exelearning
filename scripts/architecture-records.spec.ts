import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    type Config,
    discoverAdrs,
    loadConfig,
    discoverChanges,
    findLegacyReferences,
    isPositiveInteger,
    isValidDate,
    parseFrontmatter,
    findCommittedIndexes,
    findRetiredFilenames,
    renderAdrIndex,
    renderChangeIndex,
    sortAdrs,
    validate,
} from './architecture-records.mts';

let root: string;
let config: Config;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'arch-records-'));
    config = loadConfig(root);
    mkdirSync(join(root, config.recordsDir), { recursive: true });
    mkdirSync(join(root, config.changesDir), { recursive: true });
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

/** Writes an ADR with sane defaults, overridable per field. */
function writeAdr(file: string, overrides: Record<string, string> = {}): void {
    const id = overrides.id ?? file.match(/^(ADR-\d+-\d{2})/)?.[1] ?? 'ADR-1-01';
    const title = overrides.title ?? 'A decision';
    const fields = {
        id,
        title: `"${title}"`,
        status: 'Proposed',
        date: '2026-08-05',
        tracking_issue: id.split('-')[1],
        ...overrides,
    };
    if (overrides.title) fields.title = `"${overrides.title}"`;

    const body = overrides.body ?? `# ${fields.id}: ${title}\n\n## Context\n\nText.\n`;
    const lines = [
        '---',
        ...Object.entries(fields)
            .filter(([key]) => key !== 'body')
            .map(([key, value]) => `${key}: ${value}`),
        'deciders:',
        '  - "@erseco"',
        'related:',
        `  prs: ${overrides.prs ?? '[]'}`,
        `  changes: ${overrides.changes ?? '[]'}`,
        `  adrs: ${overrides.adrs ?? '[]'}`,
        `supersedes: ${overrides.supersedes ?? '[]'}`,
        `superseded_by: ${overrides.superseded_by ?? '[]'}`,
        'ai_assistance:',
        '  tool: "none"',
        '  model: "none"',
        '---',
        '',
        body,
    ];
    writeFileSync(join(root, config.recordsDir, file), lines.join('\n'));
}

function writeChangeDoc(dir: string, name: string, extra: string[] = []): void {
    mkdirSync(join(root, config.changesDir, dir), { recursive: true });
    const issue = dir.split('-')[0];
    writeFileSync(
        join(root, config.changesDir, dir, name),
        [
            '---',
            `tracking_issue: ${issue}`,
            'title: "A change"',
            'status: draft',
            'date: 2026-08-05',
            'authors:',
            '  - "@erseco"',
            ...extra,
            'ai_assistance:',
            '  tool: "none"',
            '  model: "none"',
            '---',
            '',
            '# A change',
            '',
        ].join('\n'),
    );
}

describe('parseFrontmatter', () => {
    test('returns null without frontmatter', () => {
        expect(parseFrontmatter('# Just a heading\n')).toBeNull();
    });

    test('parses scalars, inline lists, block lists and one nesting level', () => {
        const raw = [
            '---',
            'id: ADR-1858-02',
            'title: "Use asset:// references"',
            'tracking_issue: 1858',
            'empty: []',
            'inline: [ADR-1858-01, ADR-1858-03]',
            'deciders:',
            '  - "@erseco"',
            '  - "@other"',
            'related:',
            '  prs: [2011]',
            '  adrs: []',
            'ai_assistance:',
            '  tool: "Claude Code"',
            '  model: "claude-opus-5"',
            '---',
            '',
            '# Body',
        ].join('\n');

        const parsed = parseFrontmatter(raw);
        expect(parsed).not.toBeNull();
        expect(parsed?.data.id).toBe('ADR-1858-02');
        expect(parsed?.data.title).toBe('Use asset:// references');
        expect(parsed?.data.empty).toEqual([]);
        expect(parsed?.data.inline).toEqual(['ADR-1858-01', 'ADR-1858-03']);
        expect(parsed?.data.deciders).toEqual(['@erseco', '@other']);
        expect(parsed?.data.related).toEqual({ prs: ['2011'], adrs: [] });
        expect(parsed?.data.ai_assistance).toEqual({ tool: 'Claude Code', model: 'claude-opus-5' });
        expect(parsed?.body.trim()).toBe('# Body');
    });
});

describe('identifier grammars', () => {
    test('accepts the issue-based ADR filename', () => {
        const match = 'ADR-1858-02-use-asset-uri-references.md'.match(config.recordRe);
        expect(match).not.toBeNull();
        expect(match?.[1]).toBe('1858');
        expect(match?.[2]).toBe('02');
        expect(match?.[3]).toBe('use-asset-uri-references');
    });

    test.each([
        'ADR-0035-file-attachment-json-idevice.md', // retired global numbering
        'ADR-1858-2-short-sequence.md', // sequence must be two digits
        'ADR-1858-02-Use-Caps.md', // slug must be kebab-case
        'ADR-01858-02-leading-zero.md', // issue must not have a leading zero
        'SDD-0009-a-design.md',
    ])('rejects %s', file => {
        expect(config.recordRe.test(file)).toBe(false);
    });

    test('accepts issue-based change directories', () => {
        expect(config.changeDirRe.test('1858-file-attachment-restoration')).toBe(true);
        expect(config.changeDirRe.test('2232-issue-based-architecture-identifiers')).toBe(true);
        expect(config.changeDirRe.test('Not-Kebab')).toBe(false);
        expect(config.changeDirRe.test('sdd-0009')).toBe(false);
    });

    test('legacy id pattern does not match the prefix of a new identifier', () => {
        expect((config.retiredRe as RegExp).test('see ADR-0035 for details')).toBe(true);
        expect((config.retiredRe as RegExp).test('see SDD-0009 for details')).toBe(true);
        expect((config.retiredRe as RegExp).test('see ADR-1858-01 for details')).toBe(false);
        expect((config.retiredRe as RegExp).test('ADR-2232-01')).toBe(false);
    });
});

describe('scalar validators', () => {
    test.each(['2026-08-05', '2024-02-29'])('accepts %s', value => {
        expect(isValidDate(value)).toBe(true);
    });

    test.each(['2026-13-01', '2026-02-30', '2026-8-5', 'yesterday', ''])('rejects %s', value => {
        expect(isValidDate(value)).toBe(false);
    });

    test('positive integers exclude zero, negatives and #-prefixed strings', () => {
        expect(isPositiveInteger('1858')).toBe(true);
        expect(isPositiveInteger('0')).toBe(false);
        expect(isPositiveInteger('-1')).toBe(false);
        expect(isPositiveInteger('#2184')).toBe(false);
    });
});

describe('discovery', () => {
    test('skips README, records and template', () => {
        writeFileSync(join(root, config.recordsDir, 'README.md'), '# Policy\n');
        writeFileSync(join(root, config.recordsDir, 'records.md'), '# Index\n');
        writeFileSync(join(root, config.recordsDir, 'template.md'), '# Template\n');
        writeAdr('ADR-1858-01-a-decision.md');

        const { adrs, errors } = discoverAdrs(root, config);
        expect(adrs).toHaveLength(1);
        expect(errors).toHaveLength(0);
    });

    test('reports retired global numbering with an actionable message', () => {
        writeFileSync(join(root, config.recordsDir, 'ADR-0042-a-decision.md'), '---\nid: ADR-0042\n---\n\n# x\n');
        const { errors } = discoverAdrs(root, config);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('retired global numbering');
    });

    test('a change directory with no recognised document is an error', () => {
        mkdirSync(join(root, config.changesDir, '1858-empty'), { recursive: true });
        writeFileSync(join(root, config.changesDir, '1858-empty', 'notes.txt'), 'x');
        const { changes, errors } = discoverChanges(root, config);
        expect(changes).toHaveLength(0);
        expect(errors[0].message).toContain('no recognised document');
    });

    test('the canonical carrier is the first recognised document present', () => {
        writeChangeDoc('1858-a-change', 'design.md');
        writeChangeDoc('1858-a-change', 'proposal.md');
        const { changes } = discoverChanges(root, config);
        expect(changes[0].canonical?.name).toBe('proposal.md');
    });
});

describe('validate', () => {
    test('passes a well-formed corpus', () => {
        writeAdr('ADR-1858-01-first-decision.md', { title: 'First decision' });
        writeChangeDoc('1858-a-change', 'proposal.md');
        const { adrs } = discoverAdrs(root, config);
        const { changes } = discoverChanges(root, config);
        expect(validate(adrs, changes, config)).toEqual([]);
    });

    test('rejects an id that disagrees with the filename', () => {
        writeAdr('ADR-1858-01-first-decision.md', { id: 'ADR-1858-02' });
        const { adrs } = discoverAdrs(root, config);
        const problems = validate(adrs, [], config);
        expect(problems.some(p => p.message.includes('does not match filename'))).toBe(true);
    });

    test('rejects a tracking_issue that disagrees with the filename', () => {
        writeAdr('ADR-1858-01-first-decision.md', { tracking_issue: '2193' });
        const { adrs } = discoverAdrs(root, config);
        const problems = validate(adrs, [], config);
        expect(problems.some(p => p.message.includes('does not match filename issue'))).toBe(true);
    });

    test('detects a duplicate local sequence within one issue', () => {
        writeAdr('ADR-1858-01-first.md', { title: 'First' });
        writeAdr('ADR-1858-01-second.md', { title: 'Second' });
        const { adrs } = discoverAdrs(root, config);
        const problems = validate(adrs, [], config);
        expect(problems.some(p => p.message.includes('duplicate ADR id'))).toBe(true);
    });

    test('the same local sequence under different issues is fine', () => {
        writeAdr('ADR-1858-01-first.md', { title: 'First' });
        writeAdr('ADR-2193-01-second.md', { title: 'Second' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config)).toEqual([]);
    });

    test.each([
        ['status', { status: 'InProgress' }, 'is not one of'],
        ['date', { date: '2026-13-99' }, 'not a valid YYYY-MM-DD'],
    ])('rejects an invalid %s', (_field, overrides, expected) => {
        writeAdr('ADR-1858-01-a-decision.md', overrides as Record<string, string>);
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes(expected))).toBe(true);
    });

    test('rejects a reference to an ADR that does not exist', () => {
        writeAdr('ADR-1858-01-a-decision.md', { adrs: '[ADR-9999-01]' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes('unknown ADR'))).toBe(true);
    });

    test('rejects a non-numeric PR reference', () => {
        writeAdr('ADR-1858-01-a-decision.md', { prs: '["#2011"]' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes('not a positive integer'))).toBe(true);
    });

    test('rejects a one-sided supersession', () => {
        writeAdr('ADR-1858-01-old.md', { title: 'Old' });
        writeAdr('ADR-2232-01-new.md', { title: 'New', supersedes: '[ADR-1858-01]' });
        const { adrs } = discoverAdrs(root, config);
        const problems = validate(adrs, [], config);
        expect(problems.some(p => p.message.includes('does not list superseded_by'))).toBe(true);
    });

    test('accepts a symmetric supersession and requires the Superseded status', () => {
        writeAdr('ADR-1858-01-old.md', {
            title: 'Old',
            status: 'Superseded',
            superseded_by: '[ADR-2232-01]',
        });
        writeAdr('ADR-2232-01-new.md', { title: 'New', supersedes: '[ADR-1858-01]' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config)).toEqual([]);
    });

    test('flags a superseded ADR left at the wrong status', () => {
        writeAdr('ADR-1858-01-old.md', { title: 'Old', superseded_by: '[ADR-2232-01]' });
        writeAdr('ADR-2232-01-new.md', { title: 'New', supersedes: '[ADR-1858-01]' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes('not "Superseded"'))).toBe(true);
    });

    test('rejects an H1 that disagrees with the frontmatter', () => {
        writeAdr('ADR-1858-01-a-decision.md', { body: '# Something else\n\n## Context\n\nText.\n' });
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes('H1 is'))).toBe(true);
    });

    test('rejects implementation_prs outside the canonical carrier', () => {
        writeChangeDoc('1858-a-change', 'proposal.md', ['implementation_prs: [2011]']);
        writeChangeDoc('1858-a-change', 'design.md', ['implementation_prs: [2011]']);
        const { changes } = discoverChanges(root, config);
        const problems = validate([], changes, config);
        expect(problems.some(p => p.message.includes('canonical metadata carrier'))).toBe(true);
    });

    test('rejects a change document whose tracking_issue disagrees with its directory', () => {
        mkdirSync(join(root, config.changesDir, '1858-a-change'), { recursive: true });
        writeFileSync(
            join(root, config.changesDir, '1858-a-change', 'proposal.md'),
            [
                '---',
                'tracking_issue: 2193',
                'title: "Mismatched"',
                'status: draft',
                'date: 2026-08-05',
                'authors:',
                '  - "@erseco"',
                '---',
                '',
                '# Mismatched',
            ].join('\n'),
        );
        const { changes } = discoverChanges(root, config);
        const problems = validate([], changes, config);
        expect(problems.some(p => p.message.includes('does not match change directory issue'))).toBe(true);
    });
});

describe('findLegacyReferences', () => {
    test('flags a retired identifier in an ordinary file', () => {
        writeFileSync(join(root, 'notes.md'), 'See ADR-0035 for the rationale.\n');
        const problems = findLegacyReferences(root, ['notes.md'], config);
        expect(problems).toHaveLength(1);
        expect(problems[0].file).toBe('notes.md:1');
        expect(problems[0].message).toContain('ADR-0035');
    });

    test('does not flag a current identifier', () => {
        writeFileSync(join(root, 'notes.md'), 'See ADR-1858-01 and ADR-2232-01.\n');
        expect(findLegacyReferences(root, ['notes.md'], config)).toEqual([]);
    });

    test('allows a document to name its own legacy_id', () => {
        writeFileSync(
            join(root, 'design.md'),
            ['---', 'legacy_id: SDD-0009', '---', '', 'Written as SDD-0009.', ''].join('\n'),
        );
        expect(findLegacyReferences(root, ['design.md'], config)).toEqual([]);
    });

    test('still flags a different legacy id inside a migrated document', () => {
        writeFileSync(
            join(root, 'design.md'),
            ['---', 'legacy_id: SDD-0009', '---', '', 'See ADR-0035.', ''].join('\n'),
        );
        const problems = findLegacyReferences(root, ['design.md'], config);
        expect(problems).toHaveLength(1);
        expect(problems[0].message).toContain('ADR-0035');
    });

    test('skips the documented allowlist', () => {
        mkdirSync(join(root, 'doc/architecture'), { recursive: true });
        writeFileSync(join(root, 'doc/architecture/migration-map.md'), 'ADR-0035 -> ADR-1858-01\n');
        const allowed = { ...config, legacyAllowlist: ['doc/architecture/migration-map.md'] };
        expect(findLegacyReferences(root, ['doc/architecture/migration-map.md'], allowed)).toEqual([]);
    });
});

describe('findCommittedIndexes', () => {
    test('rejects a committed record index', () => {
        const problems = findCommittedIndexes([`${config.recordsDir}/records.md`, 'README.md'], config);
        expect(problems).toHaveLength(1);
        expect(problems[0].message).toContain('must not be committed');
    });

    test('accepts a tree with no index file', () => {
        expect(findCommittedIndexes(['README.md', `${config.recordsDir}/ADR-1858-01-a.md`], config)).toEqual([]);
    });
});

describe('second review findings', () => {
    test('a block list nested under a mapping key survives', () => {
        const parsed = parseFrontmatter(
            ['---', 'related:', '  prs:', '    - 2011', '  adrs:', '    - ADR-9999-01', '---', '', '# x'].join('\n'),
        );
        expect(parsed?.data.related).toEqual({ prs: ['2011'], adrs: ['ADR-9999-01'] });
    });

    test('a dangling ADR in a nested block list is still caught', () => {
        writeFileSync(
            join(root, config.recordsDir, 'ADR-90-01-a.md'),
            ['---', 'id: ADR-90-01', 'title: "A"', 'status: Proposed', 'date: 2026-08-05',
             'tracking_issue: 90', 'deciders:', '  - "@e"', 'related:', '  adrs:', '    - ADR-9999-01',
             'ai_assistance:', '  tool: "none"', '  model: "none"', '---', '', '# ADR-90-01: A', ''].join('\n'),
        );
        const { adrs } = discoverAdrs(root, config);
        expect(validate(adrs, [], config).some(p => p.message.includes('unknown ADR'))).toBe(true);
    });

    test('a self legacy_id does not hide another retired id on the same line', () => {
        writeFileSync(
            join(root, 'design.md'),
            ['---', 'legacy_id: SDD-0009', '---', '', 'Previously SDD-0009; see ADR-0035 too.', ''].join('\n'),
        );
        const problems = findLegacyReferences(root, ['design.md'], config);
        expect(problems).toHaveLength(1);
        expect(problems[0].message).toContain('ADR-0035');
    });

    test('status may not be repeated outside the canonical document', () => {
        writeChangeDoc('90-a-change', 'proposal.md');
        writeChangeDoc('90-a-change', 'design.md');
        const { changes } = discoverChanges(root, config);
        expect(validate([], changes, config).some(p => p.message.includes('canonical carrier'))).toBe(true);
    });

    test('a retired file anywhere under the architecture tree is caught', () => {
        expect(findRetiredFilenames([`${config.architectureRoot}/archive/SDD-0010-old.md`], config)).toHaveLength(1);
    });

    test('a records.md anywhere under the architecture tree is caught', () => {
        expect(findCommittedIndexes([`${config.architectureRoot}/sdd/records.md`], config)).toHaveLength(1);
    });
});

describe('review findings', () => {
    test('rejects local sequence 00 — the ordinal starts at 01', () => {
        expect(config.recordRe.test('ADR-2232-00-invalid-sequence.md')).toBe(false);
        expect(config.recordRe.test('ADR-2232-01-valid-sequence.md')).toBe(true);
    });

    test('a non-canonical change document must carry its own document fields', () => {
        writeChangeDoc('90-a-change', 'proposal.md');
        writeFileSync(
            join(root, config.changesDir, '90-a-change', 'design.md'),
            ['---', 'tracking_issue: 90', 'title: "Incomplete"', '---', '', '# Incomplete', ''].join('\n'),
        );
        const { changes } = discoverChanges(root, config);
        const messages = validate([], changes, config).map(p => p.message);
        for (const field of ['`date`', '`authors`', 'ai_assistance']) {
            expect(messages.some(m => m.includes(field))).toBe(true);
        }
    });

    test('a non-canonical change document may not carry related_adrs at all', () => {
        writeChangeDoc('90-a-change', 'proposal.md');
        writeChangeDoc('90-a-change', 'design.md', ['related_adrs: [ADR-99-01]']);
        const { changes } = discoverChanges(root, config);
        expect(validate([], changes, config).some(p => p.message.includes('canonical carrier'))).toBe(true);
    });

    test('a retired filename inside a change directory is rejected', () => {
        const inside = `${config.changesDir}/9999-example/SDD-0010-old-design.md`;
        expect(findRetiredFilenames([inside], config)).toHaveLength(1);
    });

    test('a current identifier is not mistaken for a retired filename', () => {
        expect(findRetiredFilenames([`${config.recordsDir}/ADR-2193-01-a-decision.md`], config)).toEqual([]);
    });

    test('the index links to the configured repository, not always core', () => {
        writeAdr('ADR-90-01-a-decision.md', { title: 'A decision' });
        const { adrs } = discoverAdrs(root, config);
        const plugin = {
            ...config,
            issuesUrl: 'https://github.com/exelearning/wp-exelearning/issues',
            repositoryLabel: 'the WordPress plugin',
        };
        const rendered = renderAdrIndex(adrs, plugin);
        expect(rendered).toContain('exelearning/wp-exelearning/issues/90');
        expect(rendered).toContain('the WordPress plugin');
        expect(rendered).not.toContain('exelearning/exelearning/issues');
    });
});

describe('index rendering', () => {
    test('sorts by issue then local sequence', () => {
        writeAdr('ADR-2193-01-later-issue.md', { title: 'Later issue' });
        writeAdr('ADR-1858-02-second.md', { title: 'Second' });
        writeAdr('ADR-1858-01-first.md', { title: 'First' });
        const { adrs } = discoverAdrs(root, config);
        expect(sortAdrs(adrs).map(a => a.id)).toEqual(['ADR-1858-01', 'ADR-1858-02', 'ADR-2193-01']);
    });

    test('is deterministic and says it is not a committed file', () => {
        writeAdr('ADR-1858-01-a-decision.md', { title: 'A decision' });
        writeChangeDoc('1858-a-change', 'proposal.md');
        const { adrs } = discoverAdrs(root, config);
        const { changes } = discoverChanges(root, config);

        expect(renderAdrIndex(adrs, config)).toBe(renderAdrIndex(adrs, config));
        expect(renderChangeIndex(changes, config)).toBe(renderChangeIndex(changes, config));
        expect(renderAdrIndex(adrs, config)).toContain('Not a committed file');
        expect(renderAdrIndex(adrs, config)).toContain('[ADR-1858-01](ADR-1858-01-a-decision.md)');
        expect(renderChangeIndex(changes, config)).toContain('`1858-a-change`');
    });

    test('renders empty status groups rather than omitting them', () => {
        writeAdr('ADR-1858-01-a-decision.md');
        const { adrs } = discoverAdrs(root, config);
        expect(renderAdrIndex(adrs, config)).toContain('_No accepted ADRs._');
    });
});
