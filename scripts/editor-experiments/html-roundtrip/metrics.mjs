// Shared HTML canonicalisation and feature counting for the editor round-trip experiment.
// parse5 is the WHATWG parser, so input and editor output are parsed the same way a browser would.
import { parseFragment } from 'parse5';

const VOID = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);
const esc = (s, attr) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/ /g, '&nbsp;')
        .replace(attr ? /"/g : /[<>]/g, c => ({ '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);

// "a:1;B : 2 ;a:3" -> "b: 2; a: 3": formatting normalised and, as in CSS, only the last
// declaration of a repeated property kept (editors legitimately drop the shadowed ones).
export const normStyle = v => {
    const decl = new Map();
    for (const d of v
        .split(';')
        .map(x => x.trim())
        .filter(Boolean)) {
        const i = d.indexOf(':');
        const prop = i < 0 ? d : d.slice(0, i).trim().toLowerCase();
        decl.delete(prop);
        decl.set(
            prop,
            i < 0
                ? d
                : `${prop}: ${d
                      .slice(i + 1)
                      .trim()
                      .replace(/\s+/g, ' ')}`,
        );
    }
    return [...decl.values()].join('; ');
};

const normAttr = a => {
    let v = a.value.replace(/\s+/g, ' ').trim();
    if (a.name === 'style') v = normStyle(v);
    if (a.name === 'class') v = v.split(' ').filter(Boolean).join(' ');
    return [a.name, v];
};

// Canonical serialisation: collapsed whitespace, sorted attributes, one void-element form,
// whitespace-only text nodes dropped. Comments are kept (losing them is a real change).
export function canonical(html) {
    const out = [];
    const walk = nodes => {
        for (const n of nodes) {
            if (n.nodeName === '#text') {
                const t = n.value.replace(/\s+/g, ' ');
                if (t.trim()) out.push(esc(t));
            } else if (n.nodeName === '#comment') {
                out.push(`<!--${n.data.replace(/\s+/g, ' ').trim()}-->`);
            } else if (n.tagName) {
                const attrs = n.attrs.map(normAttr).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
                out.push(`<${n.tagName}${attrs.map(([k, v]) => ` ${k}="${esc(v, true)}"`).join('')}>`);
                walk(n.content ? n.content.childNodes : n.childNodes); // <template> keeps children in .content
                if (!VOID.has(n.tagName)) out.push(`</${n.tagName}>`);
            }
        }
    };
    walk(parseFragment(html).childNodes);
    return out.join('').trim();
}

// Multisets of the things an eXe author would notice missing after a save.
export function features(html) {
    const f = {
        elements: [],
        classes: [],
        data: [],
        dataUser: [],
        styles: [],
        iframes: [],
        assets: [],
        attrs: [],
        comments: 0,
    };
    const walk = nodes => {
        for (const n of nodes) {
            if (n.nodeName === '#comment') f.comments++;
            if (!n.tagName) continue;
            f.elements.push(n.tagName);
            for (const a of n.attrs) {
                const [name, v] = normAttr(a);
                if (name.startsWith('data-mce-bogus')) continue; // editor-internal, never persisted
                f.attrs.push(`${n.tagName}@${name}`);
                if (name === 'class') f.classes.push(...v.split(' ').filter(Boolean));
                else if (name === 'style') f.styles.push(...v.split('; ').filter(Boolean));
                else if (name.startsWith('data-')) {
                    f.data.push(`${name}=${v}`);
                    if (!name.startsWith('data-mce-')) f.dataUser.push(`${name}=${v}`);
                }
                if (v.includes('asset://')) f.assets.push(`${name}=${v}`);
            }
            if (n.tagName === 'iframe') f.iframes.push(n.attrs.find(a => a.name === 'src')?.value ?? '');
            walk(n.content ? n.content.childNodes : n.childNodes);
        }
    };
    walk(parseFragment(html).childNodes);
    return f;
}

// Items of multiset `a` not present in multiset `b` (with multiplicity).
export function missing(a, b) {
    const left = new Map();
    for (const x of b) left.set(x, (left.get(x) || 0) + 1);
    const lost = [];
    for (const x of a) {
        const c = left.get(x) || 0;
        if (c) left.set(x, c - 1);
        else lost.push(x);
    }
    return lost;
}

// Self-check: `node metrics.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
    const assert = (await import('node:assert')).strict;
    assert.equal(
        canonical('<p  class="b  a" id=x STYLE="COLOR:red">a\n  b<br/></p>'),
        canonical('<p id="x" style="color: red;" class="b a">a b<br></p>'),
    );
    assert.equal(normStyle('width:1px; COLOR : red;width:2px'), 'color: red; width: 2px');
    assert.notEqual(canonical('<p><!-- c -->x</p>'), canonical('<p>x</p>'));
    const f = features('<div class="a b" data-x="1" style="color:red"><iframe src="asset://1/a.html"></iframe></div>');
    assert.deepEqual(
        [f.classes, f.data, f.styles, f.iframes, f.assets],
        [['a', 'b'], ['data-x=1'], ['color: red'], ['asset://1/a.html'], ['src=asset://1/a.html']],
    );
    assert.deepEqual(missing(['a', 'a', 'b'], ['a', 'c']), ['a', 'b']);
    console.log('metrics.mjs self-check ok');
}
