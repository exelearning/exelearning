// ProseKit 0.22.3 harness. Bundled by: npx esbuild harness-prosekit.js --bundle --format=iife --outfile=harness-prosekit.bundle.js
// Model: node attrs hold the canonical asset:// URL; node views render the blob: URL;
// schema toDOM (used by getDocHTML and the clipboard serializer) emits asset://.
import {
    createEditor,
    union,
    defineNodeSpec,
    defineNodeView,
    defineBaseKeymap,
    defineBaseCommands,
    defineHistory,
} from 'prosekit/core';
import { defineDoc } from 'prosekit/extensions/doc';
import { defineText } from 'prosekit/extensions/text';
import { defineParagraph } from 'prosekit/extensions/paragraph';
import { defineLink } from 'prosekit/extensions/link';
import { undoDepth } from 'prosekit/pm/history';
import { DOMSerializer } from 'prosekit/pm/model';
import { defineImage } from 'prosekit/extensions/image';

// ?off=1,3 disables hooks for the ablation runs.
const off = new Set((new URLSearchParams(location.search).get('off') || '').split(','));
const on = n => !off.has(String(n));

const S = window.AssetStore;
// A pasted/foreign display blob maps back to its asset (the clipboard itself carries asset://).
const canon = v => (S.isBlob(v) ? S.blobToAsset(v) || v : v);
const display = v => (S.isAsset(v) ? S.resolveSync(v) || v : v);
const IMG_ATTRS = ['src', 'alt', 'title', 'width', 'height', 'class', 'style'];

// HOOK 1: inline image node with canonical src in attrs. (ProseKit's defineImage is a
// block node without alt; eXe content has inline images with alt, so it is replaced.)
const image = defineNodeSpec({
    name: 'image',
    inline: true,
    group: 'inline',
    draggable: true,
    attrs: Object.fromEntries(IMG_ATTRS.map(a => [a, { default: null }])),
    parseDOM: [
        {
            tag: 'img[src]',
            getAttrs: el =>
                Object.fromEntries(
                    IMG_ATTRS.map(a => [a, a === 'src' ? canon(el.getAttribute(a)) : el.getAttribute(a)]),
                ),
        },
    ],
    toDOM: node => ['img', Object.fromEntries(Object.entries(node.attrs).filter(([, v]) => v != null))],
});

// HOOK 2: node view renders the blob: URL; the model keeps asset://.
const imageView = defineNodeView({
    name: 'image',
    constructor: node => {
        const dom = document.createElement('img');
        const paint = n => {
            for (const a of IMG_ATTRS)
                n.attrs[a] == null
                    ? dom.removeAttribute(a)
                    : dom.setAttribute(a, a === 'src' ? display(n.attrs[a]) : n.attrs[a]);
        };
        paint(node);
        return { dom, update: n => n.type === node.type && (paint(n), true) };
    },
});

// HOOK 3: video/audio/iframe kept as an opaque HTML island (atom) so arbitrary
// attributes and <source> children survive; the view clones it with blob: URLs.
const media = defineNodeSpec({
    name: 'media',
    group: 'block',
    atom: true,
    attrs: { html: { default: '' } },
    parseDOM: ['video', 'audio', 'iframe'].map(tag => ({
        tag,
        getAttrs: el => {
            const c = el.cloneNode(true);
            for (const e of [c, ...c.querySelectorAll('[src]')])
                if (e.hasAttribute('src')) e.setAttribute('src', canon(e.getAttribute('src')));
            return { html: c.outerHTML };
        },
    })),
    toDOM: node => {
        const t = document.createElement('template');
        t.innerHTML = node.attrs.html;
        return t.content.firstElementChild;
    },
});
const mediaView = defineNodeView({
    name: 'media',
    constructor: node => {
        const t = document.createElement('template');
        t.innerHTML = node.attrs.html;
        const dom = t.content.firstElementChild;
        for (const e of [dom, ...dom.querySelectorAll('[src]')])
            if (e.hasAttribute('src')) e.setAttribute('src', display(e.getAttribute('src')));
        dom.contentEditable = 'false';
        return { dom };
    },
});

(async () => {
    await S.seed();
    const parts = [
        defineDoc(),
        defineText(),
        defineParagraph(),
        defineLink(),
        defineBaseKeymap(),
        defineBaseCommands(),
        defineHistory(),
    ];
    parts.push(on(1) ? image : defineImage()); // off: stock block image, no alt attr
    if (on(2)) parts.push(imageView, mediaView); // off: no display mapping
    if (on(3)) parts.push(media); // off: video/audio/iframe have no node type
    const extension = union(...parts);
    const editor = createEditor({ extension, defaultContent: window.FIXTURE });
    const mount = document.getElementById('ed');
    editor.mount(mount);
    const view = () => editor.view;
    const findImage = alt => {
        let pos = -1;
        view().state.doc.descendants((n, p) => {
            if (pos < 0 && n.type.name === 'image' && n.attrs.alt === alt) pos = p;
        });
        return pos;
    };
    window.H = {
        version: 'prosekit 0.22.3',
        view,
        frameSelector: null,
        // HOOK 4: serialize the doc's content, not the doc: getDocHTML() wraps it in <div> (measured).
        getStored() {
            if (!on(4)) return S.safetyNet(editor.getDocHTML());
            // Serialize into an inert document: img elements created in the live
            // document start fetching asset:// (measured ERR_UNKNOWN_URL_SCHEME).
            const doc = document.implementation.createHTMLDocument('');
            const box = doc.createElement('div');
            box.appendChild(
                DOMSerializer.fromSchema(view().state.schema).serializeFragment(view().state.doc.content, {
                    document: doc,
                }),
            );
            return S.safetyNet(box.innerHTML);
        },
        hasUndo: () => undoDepth(view().state) > 0,
        setAlt(alt) {
            // Custom eXe dialog equivalent: reads node.attrs.src (asset://), writes attrs.
            const pos = findImage('old alt');
            if (pos < 0) throw new Error('image with alt "old alt" not found');
            const shown = view().state.doc.nodeAt(pos).attrs.src;
            view().dispatch(view().state.tr.setNodeAttribute(pos, 'alt', alt));
            return 'dialog would show: ' + shown;
        },
        async insertAsset() {
            const url = await S.newImageAsset();
            const st = view().state;
            view().dispatch(st.tr.replaceSelectionWith(st.schema.nodes.image.create({ src: url, alt: 'inserted' })));
            return url;
        },
        reload(html) {
            editor.setContent(html);
        },
        safetyNetHits: () => S.safetyNetHits,
    };
    window.HREADY = true;
})().catch(e => {
    window.HERROR = String((e && e.stack) || e);
});
