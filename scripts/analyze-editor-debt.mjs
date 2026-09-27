#!/usr/bin/env node
/**
 * Read-only analysis of how eXeLearning is coupled to its bundled TinyMCE 5.
 *
 * It backs ADR-2467-01 (doc/architecture/adr/ADR-2467-01-select-future-rich-text-editor-strategy.md).
 * Node >= 18 or Bun, standard library only.
 *
 * Usage, from the repository root:
 *   node scripts/analyze-editor-debt.mjs                   # JSON on stdout, writes nothing
 *   node scripts/analyze-editor-debt.mjs --out tmp/editor  # also editor-debt.{json,csv,md}
 *   node scripts/analyze-editor-debt.mjs --charts          # also regenerate the ADR's SVG charts
 *   node scripts/analyze-editor-debt.mjs --charts-out DIR  # write the SVG charts to DIR instead
 *   node scripts/analyze-editor-debt.mjs --upstream DIR    # repeatable; see below
 *
 * --upstream takes an extracted `npm pack tinymce@5.10.x` directory. With it, plugins
 * are classified by sha256 against upstream and fork deltas are counted; without it a
 * header heuristic is used, which yields the same upstream/fork/own split on this tree.
 *
 * --charts writes four SVG files into doc/architecture/adr/assets/editor-comparison/.
 * Charts 1-3 are drawn from evaluation.json in that directory (opinion scores and
 * engineering estimates); chart 4 is drawn from the metrics computed here.
 *
 * The output is deterministic: files are walked in sorted order and no timestamps or
 * absolute paths are emitted. The repository is only read, except for --charts.
 *
 * ponytail: regexes over comment-stripped source, not an AST. The counts are ordinal
 * indicators of coupling, not proofs; an AST pass is the upgrade if exact counts matter.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = k => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const OUT = opt('--out')[0];
const UPSTREAM = opt('--upstream');
const CHARTS_OUT = opt('--charts-out')[0];
const CHARTS = args.includes('--charts') || Boolean(CHARTS_OUT);
const ROOT = process.cwd();
const TMCE = path.join(ROOT, 'public/libs/tinymce_5/js/tinymce');
const SETTINGS = path.join(ROOT, 'public/app/editor/tinymce_5_settings.js');
const IDEVICES = path.join(ROOT, 'public/files/perm/idevices');
const CHART_DIR = path.join(ROOT, 'doc/architecture/adr/assets/editor-comparison');

if (!fs.existsSync(TMCE) || !fs.existsSync(SETTINGS)) {
    console.error('Run from the eXeLearning repository root (public/libs/tinymce_5 not found).');
    process.exit(2);
}

// Third-party code shipped inside plugin directories: reported as vendored, not as eXe code.
const VENDORED = [
    [/codemirror\/codemirror\.js$/, 'CodeMirror'],
    [/editor\/js\/jquery\.min\.js$/, 'jQuery (mindmap editor)'],
    [/(^|\/)cropper\.js$/, 'Cropper'],
    [/jquery-cropper\.js$/, 'jQuery Cropper'],
    [/FileSaver\.min\.js$/, 'FileSaver'],
];

const METRICS = {
    tinymceGlobal: /\btiny(?:mce|MCE)\.(?!PluginManager\.add\b)\w+/g,
    tinymceDOM: /\btinymce\.DOM\.\w+/g,
    activeEditor: /\bactiveEditor\b/g,
    editorDom: /\b(?!tinymce\b)\w+\.dom\.\w+/g,
    selection: /\.selection\.\w+/g,
    parser: /\.parser\.\w+/g,
    serializer: /\.serializer\.\w+/g,
    schema: /\.schema\.\w+/g,
    windowManager: /\bwindowManager\.\w+/g,
    uiRegistry: /\bui\.registry\.\w+/g,
    execCommand: /\bexecCommand\(/g,
    addCommand: /\baddCommand\(/g,
    undoManager: /\bundoManager\.\w+/g,
    events: /\.on\(\s*['"][\w ,]+['"]/g,
    // Coupling that breaks on an editor change or a TinyMCE major upgrade.
    toxClasses: /\btox-[a-z][\w-]*/g,
    mceInternals:
        /\b(?:data-mce-[\w-]+|mce-(?:object|preview-object|content-body|edit-area|item-\w+)|mceNonEditable|_mce_\w+)/g,
    tinymceUtilInternals:
        /\btinymce\.(?:util\.(?:Tools|Delay|VK|URI|ImageUploader)|dom\.(?:DOMUtils|TreeWalker|RangeUtils)|Env|html\.\w+)\b/g,
    removedInV6:
        /\b(?:tinymce\.dom\.DomQuery|tinymce\.util\.(?:Promise|XHR|JSON)|editor\.\$|\.settings\.\w+|getParam\(|\.fire\(|toolbar_drawer|fontsizeselect|formatselect)\b/g,
    directDom:
        /\b(?:getBody|getDoc|getWin|getContainer|getContentAreaContainer)\(\)|\bdocument\.(?:querySelector(?:All)?|getElementById|getElementsBy\w+|createElement|write)\b|\.innerHTML\b|\.outerHTML\b|contentWindow|contentDocument/g,
    jquery: /(?:\$|jQuery)\s*\(|\$\.\w+|\bjQuery\b/g,
    externalDialogs:
        /\bopenUrl\(|<iframe\b|createElement\(\s*['"]iframe['"]|window\.open\(|\burl\s*:\s*(?![^,\n]*templates\/)[^,\n]*\.html/g,
    openUrl: /\bopenUrl\(/g,
    parentWindow: /\b(?:parent|top|window\.opener)\.(?:eXeLearning|tinymce|\$|jQuery|document|window)\b/g,
    exeGlobals: /\b(?:eXeLearning|\$exeTinyMCE|\$exeDevice\w*|\$exe)\b/g,
    oldLibraries:
        /\b(?:CodeMirror|mindmaps|jquery-ui-1\.8|qtip|DomQuery|cropper|saveAs|abcjs|ABCJS|MathJax|mermaid)\b/gi,
};

const stripComments = s =>
    s
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
const count = src => Object.fromEntries(Object.entries(METRICS).map(([k, re]) => [k, (src.match(re) || []).length]));

const sloc = s => s.split('\n').filter(l => l.trim()).length;
const walk = d =>
    fs
        .readdirSync(d, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const isTest = f => /\.(test|spec)\.[jt]s$/.test(f);
const add = (a, b) => {
    for (const k in b) a[k] = (a[k] || 0) + b[k];
    return a;
};
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read = f => fs.readFileSync(f, 'utf8');

// --- plugin lists from the main config and from iDevices that call tinymce.init directly
const settingsSrc = read(SETTINGS);
const mainPlugins = (settingsSrc.match(/plugins:\s*\n?\s*'([^']+)'/) || [undefined, ''])[1]
    .split(/\s+/)
    .filter(Boolean);
const ideviceFiles = walk(IDEVICES).filter(f => f.endsWith('.js') && !isTest(f));
const ideviceInits = [];
for (const f of ideviceFiles) {
    const s = read(f);
    if (!/tinymce\.init\(/.test(s)) continue;
    const m = s.match(/plugins:\s*\[?\s*['"]([^'"]+)['"]/);
    ideviceInits.push({ file: rel(f), plugins: m ? m[1].split(/\s+/).filter(Boolean) : [] });
}
const ideviceExtraPlugins = [...new Set(ideviceInits.flatMap(i => i.plugins))].sort();

// --- iDevice call sites (case matters: most iDevices spell it tinyMCE)
const ideviceCalls = { filesMentioningTinymce: 0, exeTinyMCEInitFiles: 0, tinymceInitFiles: 0 };
const callPatterns = {
    'tinyMCE.get(': /\btinyMCE\.get\(/g,
    'tinymce.get(': /\btinymce\.get\(/g,
    'tinymce.editors': /\btiny(?:mce|MCE)\.editors\b/g,
};
for (const k of Object.keys(callPatterns)) ideviceCalls[k] = 0;
for (const f of ideviceFiles) {
    const s = read(f);
    if (!/tinymce|tinyMCE/.test(s)) continue;
    ideviceCalls.filesMentioningTinymce++;
    if (/\$exeTinyMCE\.init/.test(s)) ideviceCalls.exeTinyMCEInitFiles++;
    if (/tinymce\.init\(/.test(s)) ideviceCalls.tinymceInitFiles++;
    for (const [k, re] of Object.entries(callPatterns)) ideviceCalls[k] += (s.match(re) || []).length;
}

// --- persisted TinyMCE-named markers in application code (content-format coupling)
const persistedMarkers = { 'data-mce-html': 0, 'data-mce-pdf': 0 };
for (const dir of ['public/app', 'src']) {
    for (const f of walk(path.join(ROOT, dir))) {
        if (!/\.(js|ts)$/.test(f) || isTest(f) || /public\/app\/common\//.test(rel(f))) continue;
        const s = read(f);
        for (const k of Object.keys(persistedMarkers)) persistedMarkers[k] += s.split(k).length - 1;
    }
}

// --- upstream comparison
function upstreamMatch(name, file) {
    for (const dir of UPSTREAM) {
        const min = path.join(dir, 'plugins', name, 'plugin.min.js');
        if (fs.existsSync(min) && sha(min) === sha(file)) return true;
    }
    return false;
}
const forkBase = src => (src.match(/Copyright \(c\) Tiny Technologies[\s\S]{0,400}?Version: ([\d.]+)/) || [])[1];

// --- per-plugin analysis
const pluginsDir = path.join(TMCE, 'plugins');
const plugins = [];
for (const name of fs.readdirSync(pluginsDir).sort()) {
    const dir = path.join(pluginsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const main = path.join(dir, 'plugin.min.js');
    const mainSrc = fs.existsSync(main) ? read(main) : '';
    const tinyHeader = /Copyright \(c\) Tiny Technologies/.test(mainSrc.slice(0, 600));
    let classification;
    if (fs.existsSync(main) && upstreamMatch(name, main)) classification = 'upstream';
    // Heuristic: an untouched upstream build is a handful of very long minified lines.
    else if (tinyHeader && mainSrc.split('\n').length <= 12) classification = 'upstream';
    else if (tinyHeader) classification = 'exe-fork-of-core';
    else classification = 'exe-own';
    const vendored = [];
    const metrics = {};
    let loc = 0;
    let testLoc = 0;
    for (const f of walk(dir)) {
        if (!/\.(js|html?)$/.test(f)) continue;
        const r = rel(f);
        const src = read(f);
        if (isTest(f)) {
            testLoc += sloc(src);
            continue;
        }
        const v = VENDORED.find(([re]) => re.test(r));
        if (v) {
            vendored.push({ file: r, lib: v[1], bytes: fs.statSync(f).size });
            continue;
        }
        if (/\/langs\//.test(r)) continue;
        loc += sloc(src);
        add(metrics, count(stripComments(src)));
    }
    plugins.push({
        name,
        classification,
        forkedFrom: classification === 'exe-fork-of-core' ? forkBase(mainSrc) : undefined,
        inMainConfig: mainPlugins.includes(name),
        inIdeviceConfigs: ideviceExtraPlugins.includes(name),
        loc,
        testLoc,
        hasTests: testLoc > 0,
        vendored,
        metrics,
    });
}

// Fork deltas (only when matching upstream directories are given).
for (const p of plugins.filter(p => p.classification === 'exe-fork-of-core')) {
    const baseName = { exeimage: 'image', exelink: 'link', exemedia: 'media' }[p.name] || p.name;
    for (const dir of UPSTREAM) {
        const up = path.join(dir, 'plugins', baseName, 'plugin.js');
        if (!fs.existsSync(up)) continue;
        const ver = (read(up).match(/Version: ([\d.]+)/) || [])[1];
        if (ver !== p.forkedFrom) continue;
        const a = new Set(
            read(up)
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean),
        );
        const b = read(path.join(pluginsDir, p.name, 'plugin.min.js'))
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
        p.upstreamBase = `${baseName}@${ver}`;
        p.linesNotInUpstream = b.filter(l => !a.has(l)).length;
    }
}

const coreSrc = read(path.join(TMCE, 'tinymce.min.js'));
const core = { version: (coreSrc.match(/Version: ([\d.]+ \([\d-]+\))/) || [])[1] };
for (const dir of UPSTREAM) {
    const c = path.join(dir, 'tinymce.min.js');
    if (fs.existsSync(c) && sha(c) === sha(path.join(TMCE, 'tinymce.min.js'))) core.identicalToUpstream = true;
}

// --- migration-risk score: transparent weights, a judgement rather than a calibrated model
const W = {
    toxClasses: 3,
    mceInternals: 2,
    tinymceUtilInternals: 2,
    removedInV6: 3,
    activeEditor: 2,
    externalDialogs: 5,
    parentWindow: 3,
    directDom: 0.5,
    jquery: 0.5,
    oldLibraries: 1,
    windowManager: 0.5,
    selection: 0.25,
    editorDom: 0.1,
};
for (const p of plugins) {
    const s = Object.entries(W).reduce((acc, [k, w]) => acc + w * (p.metrics[k] || 0), 0);
    p.riskScore = Math.round(s + p.loc / 100 + p.vendored.length * 10 + (p.hasTests ? 0 : 5));
}
const own = plugins.filter(p => p.classification !== 'upstream');
own.sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name));

// --- consumers outside the plugin tree
function scan(scopes) {
    const out = {};
    for (const [label, dir, filter] of scopes) {
        const t = { files: 0, loc: 0 };
        for (const f of walk(path.join(ROOT, dir)).filter(f => f.endsWith('.js') && !isTest(f) && filter(rel(f)))) {
            const src = read(f);
            if (!/tinymce|tinyMCE|tox-|mce-/.test(src)) continue;
            t.files++;
            t.loc += sloc(src);
            add(t, count(stripComments(src)));
        }
        out[label] = t;
    }
    return out;
}
const consumers = scan([
    ['settings', 'public/app/editor', r => r.endsWith('tinymce_5_settings.js')],
    [
        'app',
        'public/app',
        r => !r.endsWith('tinymce_5_settings.js') && !/common\/(edicuatex|mindmaps|mermaid|exe_math)\//.test(r),
    ],
    ['idevices', 'public/files/perm/idevices', () => true],
]);

// --- tests that touch TinyMCE
const touching = (dir, re) =>
    walk(path.join(ROOT, dir))
        .filter(f => re.test(f) && /tinymce|tinyMCE|tox-/.test(read(f)))
        .map(rel);
const tests = {
    vitest: touching('public', /\.test\.js$/),
    playwright: touching('test/e2e', /\.(spec|helpers?)\.ts$|helpers\/.*\.ts$/),
    bun: touching('src', /\.spec\.ts$/),
};

const totals = { loc: 0, testLoc: 0 };
for (const p of own) {
    totals.loc += p.loc;
    totals.testLoc += p.testLoc;
    add(totals, p.metrics);
}
const withMetric = pred => own.filter(pred).map(p => p.name);

// Chart 4 series: how many of the eXe plugins (own + forks) show each kind of coupling.
const debtChart = [
    ['eXe plugins (own + forks of core)', own.map(p => p.name)],
    ['with direct DOM access', withMetric(p => p.metrics.directDom > 0)],
    ['with jQuery', withMetric(p => p.metrics.jquery > 0)],
    ['with direct tinymce global access', withMetric(p => p.metrics.tinymceGlobal > 0)],
    ['with .tox-* UI selectors', withMetric(p => p.metrics.toxClasses > 0)],
    ['with APIs removed in TinyMCE 6', withMetric(p => p.metrics.removedInV6 > 0)],
    ['with TinyMCE internal markers', withMetric(p => p.metrics.mceInternals > 0)],
    [
        'using parser / schema / serializer',
        withMetric(p => p.metrics.parser + p.metrics.schema + p.metrics.serializer > 0),
    ],
    ['without any test file', withMetric(p => !p.hasTests)],
].map(([label, names]) => ({ label, count: names.length, plugins: names }));

const result = {
    generatedFrom: rel(TMCE),
    core,
    counts: {
        pluginDirs: plugins.length,
        mainConfigPlugins: mainPlugins.length,
        ideviceExtraPlugins,
        upstream: plugins.filter(p => p.classification === 'upstream').length,
        exeFork: plugins.filter(p => p.classification === 'exe-fork-of-core').length,
        exeOwn: plugins.filter(p => p.classification === 'exe-own').length,
        shippedButUnconfigured: plugins.filter(p => !p.inMainConfig && !p.inIdeviceConfigs).map(p => p.name),
        configuredButMissing: [...mainPlugins, ...ideviceExtraPlugins].filter(n => !plugins.some(p => p.name === n)),
        testFiles: { vitest: tests.vitest.length, playwright: tests.playwright.length, bun: tests.bun.length },
    },
    ideviceCalls,
    persistedMarkers,
    debtChart,
    mainPlugins,
    ideviceInits,
    riskWeights: W,
    exePluginsByRisk: own,
    upstreamPlugins: plugins.filter(p => p.classification === 'upstream').map(p => p.name),
    exePluginTotals: totals,
    consumers,
    tests,
};

// --- evaluation (opinion scores and estimates) from the ADR's evaluation.json
const EVAL_FILE = path.join(CHART_DIR, 'evaluation.json');
const evaluation = fs.existsSync(EVAL_FILE) ? JSON.parse(read(EVAL_FILE)) : null;
const round1 = n => Math.round(n * 10) / 10;
if (evaluation) {
    const ids = evaluation.options.map(o => o.id);
    const effortTotals = {};
    for (const id of ids) {
        const e = evaluation.effort[id];
        const cats = evaluation.effortCategories.map(c => e[c.id]);
        effortTotals[id] = {
            min: round1(cats.reduce((s, r) => s + r[0], 0)),
            max: round1(cats.reduce((s, r) => s + r[1], 0)),
            confidence: e.confidence,
        };
    }
    const byId = Object.fromEntries(evaluation.criteria.map(c => [c.id, c]));
    const unweighted = Object.fromEntries(
        ids.map((id, i) => [id, evaluation.criteria.reduce((s, c) => s + c.scores[i], 0)]),
    );
    // Weighted score as a percentage of the maximum reachable with the same weights.
    const weighted = {};
    for (const p of evaluation.profiles) {
        const w = c => (c.id in p.weights ? p.weights[c.id] : p.default);
        const max = evaluation.criteria.reduce((s, c) => s + 5 * w(c), 0);
        weighted[p.id] = Object.fromEntries(
            ids.map((id, i) => [
                id,
                round1((100 * evaluation.criteria.reduce((s, c) => s + w(c) * c.scores[i], 0)) / max),
            ]),
        );
    }
    // Chart 3 Y axis: mean "distance from best" over the long-term risk criteria.
    const architecturalRisk = Object.fromEntries(
        ids.map((id, i) => [
            id,
            round1(
                evaluation.architecturalRisk.reduce((s, c) => s + (5 - byId[c].scores[i]), 0) /
                    evaluation.architecturalRisk.length,
            ),
        ]),
    );
    result.evaluation = { effortTotals, unweighted, weighted, architecturalRisk };
}

// --- markdown + csv
const cols = [
    'loc',
    'tinymceGlobal',
    'selection',
    'editorDom',
    'windowManager',
    'uiRegistry',
    'execCommand',
    'undoManager',
    'tinymceDOM',
    'activeEditor',
    'toxClasses',
    'mceInternals',
    'tinymceUtilInternals',
    'removedInV6',
    'directDom',
    'jquery',
    'externalDialogs',
    'parentWindow',
    'oldLibraries',
];
const cell = (o, c) => o[c] ?? o.metrics?.[c] ?? 0;
let md = `# TinyMCE coupling metrics\n\nCore: ${core.version}${core.identicalToUpstream ? ' (byte-identical to upstream)' : ''}. `;
md += `Plugins: ${plugins.length} directories, ${result.counts.upstream} upstream, ${result.counts.exeFork} eXe forks of core, `;
md += `${result.counts.exeOwn} eXe-own. Main config enables ${mainPlugins.length}.\n\n`;
md += `| plugin | class | ${cols.join(' | ')} | tests | risk |\n|${'---|'.repeat(cols.length + 4)}\n`;
for (const p of own) {
    const cls = p.classification + (p.forkedFrom ? `@${p.forkedFrom}` : '');
    md += `| ${p.name} | ${cls} | ${cols.map(c => cell(p, c)).join(' | ')} | ${p.testLoc} | ${p.riskScore} |\n`;
}
md += `| **total** | | ${cols.map(c => cell(totals, c)).join(' | ')} | ${totals.testLoc} | |\n\n`;
md += '## Coupling per plugin (chart 4)\n\n| series | plugins |\n|---|---|\n';
for (const d of debtChart) md += `| ${d.label} | ${d.count} |\n`;
md += '\n## iDevice call sites\n\n| pattern | count |\n|---|---|\n';
for (const [k, v] of Object.entries(ideviceCalls)) md += `| ${k} | ${v} |\n`;
md += '\n## Persisted TinyMCE-named markers in application code\n\n| marker | occurrences |\n|---|---|\n';
for (const [k, v] of Object.entries(persistedMarkers)) md += `| ${k} | ${v} |\n`;
const ccols = [
    'loc',
    'tinymceGlobal',
    'activeEditor',
    'windowManager',
    'undoManager',
    'toxClasses',
    'mceInternals',
    'removedInV6',
];
md += `\n## Consumers outside plugins (files mentioning TinyMCE)\n\n| scope | files | ${ccols.join(' | ')} |\n|${'---|'.repeat(ccols.length + 2)}\n`;
for (const [k, v] of Object.entries(consumers))
    md += `| ${k} | ${v.files} | ${ccols.map(c => v[c] ?? 0).join(' | ')} |\n`;
if (result.evaluation) {
    const ev = result.evaluation;
    const opts = evaluation.options;
    md += `\n## Evaluation (opinion scores, engineering estimates)\n\n| option | effort min-max (person-weeks) | confidence | unweighted (of ${evaluation.criteria.length * 5}) | architectural risk (0-4) |\n|---|---|---|---|---|\n`;
    for (const o of opts) {
        const t = ev.effortTotals[o.id];
        md += `| ${o.label} | ${t.min}-${t.max} | ${t.confidence} | ${ev.unweighted[o.id]} | ${ev.architecturalRisk[o.id]} |\n`;
    }
    md += `\n| weight profile | ${opts.map(o => o.short).join(' | ')} |\n|${'---|'.repeat(opts.length + 1)}\n`;
    for (const p of evaluation.profiles)
        md += `| ${p.label} | ${opts.map(o => ev.weighted[p.id][o.id]).join(' | ')} |\n`;
}
const csv = [['plugin', 'classification', 'forkedFrom', ...cols, 'testLoc', 'riskScore'].join(',')]
    .concat(
        own.map(p =>
            [p.name, p.classification, p.forkedFrom || '', ...cols.map(c => cell(p, c)), p.testLoc, p.riskScore].join(
                ',',
            ),
        ),
    )
    .join('\n');

// --- SVG charts
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif"';
const svg = (w, h, title, desc, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" ${FONT}>\n` +
    `<title id="t">${esc(title)}</title>\n<desc id="d">${esc(desc)}</desc>\n` +
    // Opaque background so the chart stays readable on GitHub's light and dark themes.
    `<rect width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#d0d7de"/>\n` +
    `<text x="20" y="30" font-size="17" font-weight="600" fill="#1f2328">${esc(title)}</text>\n${body}</svg>\n`;
const text = (x, y, s, extra = '') =>
    `<text x="${x}" y="${y}" font-size="13" fill="#1f2328" ${extra}>${esc(s)}</text>\n`;
const note = (x, y, s) => `<text x="${x}" y="${y}" font-size="12" fill="#57606a">${esc(s)}</text>\n`;

function effortChart(ev, evaluation) {
    const opts = evaluation.options.filter(o => o.id !== 'stay5');
    const max = Math.ceil(Math.max(...opts.map(o => ev.effortTotals[o.id].max)) / 20) * 20;
    const [x0, w, rowH, top] = [170, 560, 44, 60];
    const X = v => x0 + (v / max) * w;
    let b = note(20, 48, 'Engineering estimate, not an implementation measurement. Bar = midpoint, whisker = min-max.');
    for (let v = 0; v <= max; v += 20) {
        b += `<line x1="${X(v)}" y1="${top}" x2="${X(v)}" y2="${top + rowH * opts.length}" stroke="#eaeef2"/>\n`;
        b += note(X(v) - 6, top + rowH * opts.length + 18, v);
    }
    opts.forEach((o, i) => {
        const t = ev.effortTotals[o.id];
        const y = top + i * rowH + 10;
        const mid = (t.min + t.max) / 2;
        b += text(20, y + 17, o.short);
        b += `<rect x="${x0}" y="${y + 4}" width="${X(mid) - x0}" height="18" fill="#6e9fd6"/>\n`;
        b += `<line x1="${X(t.min)}" y1="${y + 13}" x2="${X(t.max)}" y2="${y + 13}" stroke="#1f2328" stroke-width="2"/>\n`;
        for (const v of [t.min, t.max]) {
            b += `<line x1="${X(v)}" y1="${y + 5}" x2="${X(v)}" y2="${y + 21}" stroke="#1f2328" stroke-width="2"/>\n`;
        }
        b += note(X(t.max) + 8, y + 17, `${t.min}-${t.max} (${t.confidence})`);
    });
    b += note(x0, top + rowH * opts.length + 36, 'person-weeks, total of ten cost categories (evaluation.json)');
    return svg(
        860,
        top + rowH * opts.length + 50,
        'Estimated migration effort by option',
        'Horizontal bars with min-max whiskers; engineering estimates in person-weeks.',
        b,
    );
}

function compatChart(evaluation) {
    const opts = evaluation.options;
    const crit = evaluation.compatibilityChart.map(id => evaluation.criteria.find(c => c.id === id));
    const [x0, cw, top, rh] = [190, 130, 90, 34];
    const fill = ['', '#d73a49', '#f0883e', '#e3c34b', '#8cc265', '#2da44e'];
    let b = note(20, 48, 'Evaluation scores (technical opinion), 1 = worst, 5 = best compatibility with current eXe.');
    crit.forEach((c, j) => {
        b += text(x0 + j * cw + cw / 2, top - 12, c.label, 'text-anchor="middle" font-weight="600"');
    });
    opts.forEach((o, i) => {
        const y = top + i * rh;
        b += text(20, y + 22, o.short);
        crit.forEach((c, j) => {
            const s = c.scores[evaluation.options.indexOf(o)];
            b += `<rect x="${x0 + j * cw + 2}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" rx="3" fill="${fill[s]}"/>\n`;
            b += text(x0 + j * cw + cw / 2, y + 22, s, 'text-anchor="middle" font-weight="600"');
        });
    });
    return svg(
        x0 + crit.length * cw + 20,
        top + opts.length * rh + 20,
        'Compatibility with current eXe',
        'Heatmap of evaluation scores per option for five compatibility criteria.',
        b,
    );
}

function scatterChart(ev, evaluation) {
    const [x0, y0, w, h] = [70, 70, 620, 330];
    const maxX = Math.ceil(Math.max(...Object.values(ev.effortTotals).map(t => t.max)) / 20) * 20;
    const X = v => x0 + (v / maxX) * w;
    const Y = v => y0 + h - (v / 4) * h;
    let b = note(
        20,
        48,
        'Evaluation scores and engineering estimates, not measurements. Horizontal whisker = effort min-max.',
    );
    for (let v = 0; v <= 4; v++) {
        b +=
            `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + w}" y2="${Y(v)}" stroke="#eaeef2"/>\n` +
            note(x0 - 18, Y(v) + 4, v);
    }
    for (let v = 0; v <= maxX; v += 20) b += note(X(v) - 6, y0 + h + 18, v);
    b += `<line x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}" stroke="#57606a"/>\n`;
    b += `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}" stroke="#57606a"/>\n`;
    b += note(x0 + w / 2 - 150, y0 + h + 38, 'Migration effort, person-weeks (midpoint of estimate)');
    b += `<text x="18" y="${y0 + h / 2 + 90}" font-size="12" fill="#57606a" transform="rotate(-90 18 ${y0 + h / 2 + 90})">Long-term architectural change / risk (0-4)</text>\n`;
    const pts = evaluation.options.map(o => {
        const t = ev.effortTotals[o.id];
        return { o, t, cx: X((t.min + t.max) / 2), cy: Y(ev.architecturalRisk[o.id]) };
    });
    let labels = '';
    for (const p of pts) {
        b += `<line x1="${X(p.t.min)}" y1="${p.cy}" x2="${X(p.t.max)}" y2="${p.cy}" stroke="#8c959f" stroke-width="2"/>\n`;
        b += `<circle cx="${p.cx}" cy="${p.cy}" r="7" fill="#6e9fd6" stroke="#1f2328"/>\n`;
        // Label right of the whisker; above the point when it would run into another whisker.
        const label = `${p.o.short} (${ev.architecturalRisk[p.o.id]})`;
        const lx = X(p.t.max) + 8;
        const clash = pts.some(q => q !== p && Math.abs(q.cy - p.cy) < 14 && X(q.t.min) < lx + label.length * 7.5);
        const [x, y] = clash ? [p.cx - 20, p.cy - 14] : [lx, p.cy + 4];
        labels += text(x, y, label, 'paint-order="stroke" stroke="#ffffff" stroke-width="4"');
    }
    b += labels;
    return svg(
        740,
        y0 + h + 52,
        'Migration effort vs long-term architectural risk',
        'Scatter plot; X is the estimated effort midpoint, Y is the mean distance from the best score over the risk criteria.',
        b,
    );
}

function debtSvg(series, total) {
    const [x0, w, rowH, top] = [290, 400, 30, 60];
    let b = note(
        20,
        48,
        `Measured by scripts/analyze-editor-debt.mjs on ${total} eXe plugins (regex counts over source).`,
    );
    series.forEach((d, i) => {
        const y = top + i * rowH;
        b += text(20, y + 18, d.label);
        b += `<rect x="${x0}" y="${y + 5}" width="${(d.count / total) * w}" height="18" fill="${i === 0 ? '#8c959f' : '#d97b4a'}"/>\n`;
        b += text(x0 + (d.count / total) * w + 8, y + 18, d.count, 'font-weight="600"');
    });
    return svg(
        760,
        top + rowH * series.length + 20,
        'Current TinyMCE 5 technical debt in eXe plugins',
        'Number of eXe plugins (own and forks) showing each kind of coupling.',
        b,
    );
}

// Self-check: counters and classifier must agree with known facts of this tree.
if (count("tinymce.activeEditor.dom.select('.tox-dialog')").toxClasses !== 1) throw new Error('tox counter broken');
if (!plugins.some(p => p.name === 'exelink' && p.classification === 'exe-fork-of-core')) {
    throw new Error('classifier broken: exelink should be a fork of core');
}

if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'editor-debt.json'), `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, 'editor-debt.md'), md);
    fs.writeFileSync(path.join(OUT, 'editor-debt.csv'), `${csv}\n`);
}
if (CHARTS) {
    if (!result.evaluation) throw new Error(`--charts needs ${rel(EVAL_FILE)}`);
    const dir = CHARTS_OUT || CHART_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const w = (name, content) => fs.writeFileSync(path.join(dir, name), content);
    w('1-migration-effort.svg', effortChart(result.evaluation, evaluation));
    w('2-compatibility.svg', compatChart(evaluation));
    w('3-effort-vs-risk.svg', scatterChart(result.evaluation, evaluation));
    w('4-technical-debt.svg', debtSvg(debtChart, own.length));
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
