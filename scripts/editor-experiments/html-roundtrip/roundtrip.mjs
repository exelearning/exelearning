// Round-trips every corpus fragment through each editor in headless Chromium and scores the output.
//
//   node roundtrip.mjs <exelearning-checkout> [editors=all] [corpus=corpus.json]
//
// Writes results.json (per-editor aggregates, loss categories, per-fragment failures) and results.md.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import { canonical, features, missing } from './metrics.mjs';

const [checkout, only, corpusFile = 'corpus.json'] = process.argv.slice(2);
if (!checkout) throw new Error('usage: node roundtrip.mjs <exelearning-checkout> [editor,editor] [corpus.json]');
const EDITORS = [
    'tinymce5',
    'tinymce8',
    'tinymce8-relaxed',
    'hugerte',
    'tinymce8-nomedia',
    'hugerte-nomedia',
    'squire',
    'wangeditor',
    'tiptap',
];
const editors = only && only !== 'all' ? only.split(',') : EDITORS;
const corpus = JSON.parse(readFileSync(corpusFile, 'utf8'));

// Static server: this folder, plus eXe's vendored TinyMCE 5 under /tinymce5/ (read-only).
const here = import.meta.dirname;
const tiny5 = join(checkout, 'public/libs/tinymce_5/js/tinymce');
const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
};
const server = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = url.startsWith('/tinymce5/') ? join(tiny5, normalize(url.slice(10))) : join(here, normalize(url));
    if (!existsSync(file) || !(file.startsWith(here) || file.startsWith(tiny5))) {
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

// Synthetic probes for eXe behaviours the fixtures do not contain (reported apart, never in the %).
// Markers taken from public/app/editor/tinymce_5_settings.js (data-mce-html, data-mce-pdf, data-asset-id).
const PROBES = {
    'iframe html asset (data-mce-html)':
        '<iframe src="asset://00000000-0000-0000-0000-000000000001.html" data-mce-html="true" style="width:100%; height:600px; border:1px solid #ccc;"></iframe>',
    'iframe pdf asset (data-mce-pdf)':
        '<iframe src="asset://00000000-0000-0000-0000-000000000002.pdf" data-mce-pdf="true" width="100%" height="600"></iframe>',
    'img data-asset-id':
        '<p><img src="asset://00000000-0000-0000-0000-000000000003.png" data-asset-id="00000000-0000-0000-0000-000000000003" alt=""></p>',
    'iframe third-party (not youtube)':
        '<p><iframe src="https://example.org/embed/1" width="560" height="315"></iframe></p>',
    'object/embed':
        '<p><object data="asset://00000000-0000-0000-0000-000000000004.swf" type="application/x-shockwave-flash"></object><embed src="asset://00000000-0000-0000-0000-000000000005.svg"></p>',
    'comment with HTML': '<p>a<!-- <b>note</b> -->b</p>',
    'javascript: link + onclick': '<p><a href="javascript:void(0)" onclick="toggle(this)">x</a></p>',
    'inline script': '<div class="exe-game"><script>var x = 1;</script><p>game</p></div>',
    'mermaid block': '<pre class="mermaid">graph TD; A-->B</pre>',
    'MathML': '<p><math><mi>x</mi><mo>=</mo><mn>2</mn></math></p>',
    'LaTeX span': '<p><span class="exe-math-code">\\(x^2\\)</span></p>',
    'video asset':
        '<video controls="controls"><source src="asset://00000000-0000-0000-0000-000000000006.mp4" type="video/mp4"></video>',
    'span data-mce-* (non-iframe)': '<p><span class="x" data-mce-foo="1">t</span></p>',
    'div data-mce-pdf (non-iframe)': '<div data-mce-pdf="true"><p>a</p></div>',
};

const METRICS = ['elements', 'classes', 'data', 'dataUser', 'styles', 'iframes', 'assets', 'comments'];
const browser = await chromium.launch();
const results = {
    corpus: { file: corpusFile, count: corpus.count, kinds: corpus.kinds },
    generated: new Date().toISOString(),
    browser: browser.version(),
    editors: {},
};

const baseline = new Map(); // fragment id -> canonical TinyMCE 5 output
for (const name of editors) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 200)));
    await page.goto(`${base}/harness.html?editor=${name}`);
    await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
    const version = await page.evaluate(() => window.editorVersion);
    // For each metric: fragments that contain the feature (applicable) and those that kept all of it.
    const agg = { n: 0, errors: 0, identical: 0, sameAsBaseline: 0 };
    const items = Object.fromEntries(METRICS.map(m => [m, [0, 0]])); // [kept, total] occurrences
    const kept = Object.fromEntries(METRICS.map(m => [m, 0]));
    const applicable = Object.fromEntries(METRICS.map(m => [m, 0]));
    const added = {}; // attributes the editor introduced, e.g. iframe@sandbox
    const byKind = {};
    const losses = {}; // "category: item" -> { count, fragments, example }
    const failures = [];
    for (const frag of corpus.fragments) {
        let out;
        try {
            out = await page.evaluate(h => window.rt(h), frag.html);
        } catch (e) {
            agg.errors++;
            failures.push({ id: frag.id, error: String(e).slice(0, 300) });
            continue;
        }
        const a = features(frag.html),
            b = features(out);
        const row = { identical: canonical(frag.html) === canonical(out) };
        if (name === 'tinymce5') baseline.set(frag.id, canonical(out));
        else if (baseline.get(frag.id) === canonical(out)) agg.sameAsBaseline++;
        const lost = {
            elements: missing(a.elements, b.elements),
            classes: missing(a.classes, b.classes),
            data: missing(a.data, b.data),
            dataUser: missing(a.dataUser, b.dataUser),
            styles: missing(a.styles, b.styles),
            iframes: missing(a.iframes, b.iframes),
            assets: missing(a.assets, b.assets),
            comments: Array(Math.max(0, a.comments - b.comments)).fill('<!-- -->'),
        };
        agg.n++;
        for (const m of METRICS) {
            const total = m === 'comments' ? a.comments : a[m].length;
            if (total) {
                applicable[m]++;
                if (!lost[m].length) kept[m]++;
            }
            items[m][0] += total - lost[m].length;
            items[m][1] += total;
        }
        for (const x of new Set(missing(b.attrs, a.attrs))) added[x] = (added[x] || 0) + 1;
        const k = (byKind[frag.kind] ??= { n: 0, identical: 0 });
        k.n++;
        if (row.identical) k.identical++;
        if (row.identical) agg.identical++;
        // Loss categories: element tags, class tokens, data-* names, style properties, attribute names.
        const cats = [
            ...lost.elements.map(t => `element <${t}>`),
            ...lost.classes.map(c => `class .${c}`),
            ...lost.data.map(d => `data attr ${d.split('=')[0]}`),
            ...lost.styles.map(s => `style ${s.split(':')[0]}`),
            ...missing(a.attrs, b.attrs).map(x => `attribute ${x}`),
            ...lost.assets.map(() => 'asset:// URL'),
            ...lost.comments.map(() => 'comment'),
        ];
        for (const c of new Set(cats)) {
            const l = (losses[c] ??= { count: 0, fragments: 0, example: frag.id });
            l.fragments++;
            l.count += cats.filter(x => x === c).length;
        }
        if (!row.identical && failures.length < 400)
            failures.push({
                id: frag.id,
                lost: Object.fromEntries(
                    Object.entries(lost)
                        .filter(([, v]) => v.length)
                        .map(([k2, v]) => [k2, v.slice(0, 8)]),
                ),
            });
    }
    const pct = (x, n) => (n ? Math.round((1000 * x) / n) / 10 : null);
    results.editors[name] = {
        version,
        fragments: agg.n,
        errors: agg.errors,
        pageErrors: consoleErrors.slice(0, 5),
        pct: {
            identical: pct(agg.identical, agg.n),
            sameAsTinymce5: name === 'tinymce5' || !baseline.size ? null : pct(agg.sameAsBaseline, agg.n),
            ...Object.fromEntries(METRICS.map(m => [m, pct(kept[m], applicable[m])])),
        },
        applicable,
        itemPct: Object.fromEntries(METRICS.map(m => [m, pct(items[m][0], items[m][1])])),
        probes: {},
        topAdditions: Object.entries(added)
            .sort((x, y) => y[1] - x[1])
            .slice(0, 10)
            .map(([attribute, fragments]) => ({ attribute, fragments })),
        identicalByKind: Object.fromEntries(Object.entries(byKind).map(([k2, v]) => [k2, `${v.identical}/${v.n}`])),
        topLosses: Object.entries(losses)
            .sort((x, y) => y[1].fragments - x[1].fragments)
            .slice(0, 15)
            .map(([c, v]) => ({ category: c, ...v })),
        failures,
    };
    for (const [probe, html] of Object.entries(PROBES)) {
        let out;
        try {
            out = await page.evaluate(h => window.rt(h), html);
        } catch (e) {
            out = `ERROR ${String(e).slice(0, 120)}`;
        }
        results.editors[name].probes[probe] = { same: canonical(html) === canonical(out), out: out.slice(0, 400) };
    }
    console.log(name, version, results.editors[name].pct, 'errors', agg.errors);
    await page.close();
}
await browser.close();
server.close();

writeFileSync('results.json', JSON.stringify(results, null, 1));
const cols = ['identical', 'sameAsTinymce5', ...METRICS];
const head = ['Editor', 'Version / config', 'Errors', ...cols.map(c => `${c} %`)];
const md = [
    `# Editor round-trip results`,
    '',
    `Corpus: ${corpus.count} fragments (${Object.entries(corpus.kinds)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}). Chromium ${results.browser}. Generated ${results.generated}.`,
    '',
    '"identical %" is over all fragments and compares canonical forms (whitespace, attribute order, void-element syntax, style formatting and shadowed duplicate style declarations normalised). "sameAsTinymce5 %" is the share of fragments whose canonical output equals the TinyMCE 5.10.2 output (a differential, needs tinymce5 in the same run). Every other column is the share of the fragments containing that feature in which none of it was lost (multiset comparison, so wrappers the editor adds do not count). Denominators: ' +
        Object.entries(Object.values(results.editors)[0]?.applicable || {})
            .map(([k, v]) => `${k} ${v}`)
            .join(', ') +
        '.',
    '',
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...Object.entries(results.editors).map(
        ([n, r]) => `| ${n} | ${r.version} | ${r.errors} | ${cols.map(c => r.pct[c]).join(' | ')} |`,
    ),
    '',
    'Occurrence-level retention (share of individual items kept, all fragments pooled) and identical fragments by source kind:',
    '',
    `| Editor | ${METRICS.join(' | ')} | identical by kind |`,
    `|---|${METRICS.map(() => '---').join('|')}|---|`,
    ...Object.entries(results.editors).map(
        ([n, r]) =>
            `| ${n} | ${METRICS.map(m => r.itemPct[m]).join(' | ')} | ${Object.entries(r.identicalByKind)
                .map(([k, v]) => `${k} ${v}`)
                .join(', ')} |`,
    ),
    '',
    'Synthetic probes (not part of the corpus): "same" = canonical output equals input; full outputs in results.json.',
    '',
    `| Probe | ${Object.keys(results.editors).join(' | ')} |`,
    `|---|${Object.keys(results.editors)
        .map(() => '---')
        .join('|')}|`,
    ...Object.keys(PROBES).map(
        p =>
            `| ${p} | ${Object.values(results.editors)
                .map(r => (r.probes[p].same ? 'same' : 'changed'))
                .join(' | ')} |`,
    ),
    '',
    ...Object.entries(results.editors).flatMap(([n, r]) => [
        `## ${n}: top losses`,
        '',
        'Category | Fragments | Occurrences | Example fragment',
        '---|---|---|---',
        ...r.topLosses
            .slice(0, 8)
            .map(l => `${l.category.replace(/\|/g, '\\|')} | ${l.fragments} | ${l.count} | ${l.example}`),
        '',
        `Attributes added (fragments): ${
            r.topAdditions
                .slice(0, 6)
                .map(x => `${x.attribute} (${x.fragments})`)
                .join(', ') || 'none'
        }`,
        '',
    ]),
];
writeFileSync('results.md', md.join('\n'));
