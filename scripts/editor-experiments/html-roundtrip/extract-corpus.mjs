// Deterministic extractor of iDevice HTML fragments from the .elp/.elpx fixtures of an eXe checkout.
//
//   node extract-corpus.mjs <exelearning-checkout> [out=corpus.json]
//
// Sources (sorted, so output is stable across runs and machines):
//   content.xml (eXe 3.x):  <htmlView> of each odeComponent            -> kind "htmlView"
//                           every HTML-looking string in <jsonProperties> -> kind "jsonField"
//   contentv3.xml (2.x):    every <unicode content="true" value="...">  -> kind "legacyField"
// Asset references are rewritten the way ElpxImporter does before content reaches the editor
// ({{context_path}}/x and legacy resources/x -> asset://<id>.<ext>); the id is a stable hash of the
// path instead of the importer's random UUID. Fragments are deduplicated on their canonical form (metrics.mjs); provenance keeps every occurrence.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { canonical } from './metrics.mjs';

const root = process.argv[2];
const outFile = process.argv[3] || 'corpus.json';
if (!root) throw new Error('usage: node extract-corpus.mjs <exelearning-checkout> [out]');

const walk = dir =>
    readdirSync(dir)
        .sort()
        .flatMap(n => {
            const p = join(dir, n);
            return statSync(p).isDirectory() ? walk(p) : /\.elpx?$/i.test(n) ? [p] : [];
        });
const decode = s =>
    s.replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-f]+));/gi, (m, e, d, h) =>
        d
            ? String.fromCodePoint(+d)
            : h
              ? String.fromCodePoint(parseInt(h, 16))
              : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()],
    );
const text = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`));
    return m ? (m[1] ?? decode(m[2] ?? '')) : '';
};
const assetUrl = path => {
    const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
    const h = createHash('sha1').update(path).digest('hex');
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
    return `asset://${id}${ext ? `.${ext}` : ''}`;
};
const toAssetUrls = html =>
    html
        .replace(/\{\{context_path\}\}\/([^"'\s)<>\\]+)/g, (_, p) => assetUrl(p))
        .replace(/(\s(?:src|href|data|poster)=["'])resources\/([^"']+)/gi, (_, a, p) => a + assetUrl(`resources/${p}`));
const looksHtml = s => /<([a-z][a-z0-9]*)\b[^>]*>/i.test(s);

function* fromContentXml(xml) {
    for (const [, block] of xml.matchAll(/<odeComponent>([\s\S]*?)<\/odeComponent>/g)) {
        const node = text(block, 'odeIdeviceId');
        const type = text(block, 'odeIdeviceTypeName');
        const view = text(block, 'htmlView');
        if (looksHtml(view)) yield { kind: 'htmlView', node, type, path: 'htmlView', html: view };
        let json;
        try {
            json = JSON.parse(text(block, 'jsonProperties') || 'null');
        } catch {
            continue;
        }
        const visit = (v, path) => {
            if (typeof v === 'string') {
                if (looksHtml(v)) return [{ path, html: v }];
                return [];
            }
            if (v && typeof v === 'object') return Object.keys(v).flatMap(k => visit(v[k], `${path}.${k}`));
            return [];
        };
        for (const f of visit(json, 'jsonProperties')) yield { kind: 'jsonField', node, type, ...f };
    }
}

function* fromContentV3(xml) {
    const idevices = [...xml.matchAll(/<instance class="([\w.]+Idevice)" reference="(\d+)"/g)];
    let i = 0;
    for (const m of xml.matchAll(/<unicode content="true" value="([^"]*)"/g)) {
        while (i + 1 < idevices.length && idevices[i + 1].index < m.index) i++;
        const owner = idevices[i] && idevices[i].index < m.index ? idevices[i] : null;
        const html = decode(m[1]);
        if (looksHtml(html))
            yield {
                kind: 'legacyField',
                node: owner ? `ref${owner[2]}` : '',
                type: owner ? owner[1].split('.').pop() : '',
                path: `offset${m.index}`,
                html,
            };
    }
}

const byKey = new Map();
const files = walk(join(root, 'test/fixtures'));
for (const file of files) {
    const zip = unzipSync(new Uint8Array(readFileSync(file)), { filter: f => /^content(v3)?\.xml$/.test(f.name) });
    const src = zip['content.xml']
        ? fromContentXml(strFromU8(zip['content.xml']))
        : zip['contentv3.xml']
          ? fromContentV3(strFromU8(zip['contentv3.xml']))
          : [];
    for (const frag of src) {
        const html = toAssetUrls(frag.html.replace(/\r\n?/g, '\n').trim());
        const key = canonical(html);
        if (!key) continue;
        const where = { fixture: relative(root, file), node: frag.node, type: frag.type, path: frag.path };
        const hit = byKey.get(key);
        if (hit) {
            hit.occurrences.push(where);
            continue;
        }
        byKey.set(key, { id: '', kind: frag.kind, html, occurrences: [where] });
    }
}
const fragments = [...byKey.values()].map(f => ({
    ...f,
    id: createHash('sha1').update(f.html).digest('hex').slice(0, 12),
}));

// Feature coverage (fragment counts), on raw HTML.
const cov = {
    table: /<table\b/i,
    dl: /<dl\b/i,
    iframe: /<iframe\b/i,
    'data-*': /\sdata-[\w-]+=/i,
    class: /\sclass=/i,
    'inline style': /\sstyle=/i,
    'asset://': /asset:\/\//i,
    'data-mce-*': /\sdata-mce-[\w-]+=/i,
    'math (LaTeX/MathML)': /<math\b|\\\(|\\\[|\$\$|exe-math/i,
    mermaid: /mermaid/i,
    'figure/figcaption': /<fig(ure|caption)\b/i,
    'audio/video': /<(audio|video)\b/i,
    script: /<script\b/i,
    'on* handler': /\son[a-z]+=/i,
    comment: /<!--/,
};
const coverage = Object.fromEntries(
    Object.entries(cov).map(([k, re]) => [k, fragments.filter(f => re.test(f.html)).length]),
);
const kinds = fragments.reduce((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {});
writeFileSync(
    outFile,
    JSON.stringify(
        {
            source: 'test/fixtures/**/*.elp{,x}',
            fixtures: files.map(f => relative(root, f)),
            count: fragments.length,
            kinds,
            coverage,
            fragments,
        },
        null,
        1,
    ),
);
console.log(JSON.stringify({ fixtures: files.length, fragments: fragments.length, kinds, coverage }, null, 1));
