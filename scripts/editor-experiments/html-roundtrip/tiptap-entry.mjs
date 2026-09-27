// Bundled with `bun build` into tiptap.bundle.js (see README). Tiptap StarterKit + Image, plus
// the generic attributes Tiptap can carry without per-node code: class, style, id, title, lang, dir.
// ponytail: data-* cannot be preserved generically (attribute names must be declared); measured as lost.
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

const GENERIC = ['class', 'style', 'id', 'title', 'lang', 'dir'];
const GenericAttributes = Extension.create({
    name: 'genericAttributes',
    addGlobalAttributes() {
        return [
            {
                types: [
                    'paragraph',
                    'heading',
                    'blockquote',
                    'bulletList',
                    'orderedList',
                    'listItem',
                    'codeBlock',
                    'image',
                    'bold',
                    'italic',
                    'strike',
                    'code',
                    'underline',
                    'link',
                ],
                attributes: Object.fromEntries(
                    GENERIC.map(name => [
                        name,
                        {
                            default: null,
                            parseHTML: el => el.getAttribute(name),
                            renderHTML: attrs => (attrs[name] == null ? {} : { [name]: attrs[name] }),
                        },
                    ]),
                ),
            },
        ];
    },
});

const editor = new Editor({
    element: document.getElementById('editor'),
    extensions: [StarterKit, Image.configure({ inline: true }), GenericAttributes],
});
window.rt = async html => {
    editor.commands.setContent(html, { emitUpdate: false });
    return editor.getHTML();
};
window.editorVersion = '@tiptap/core 3.31.3 + StarterKit + Image(inline) + generic attrs';
