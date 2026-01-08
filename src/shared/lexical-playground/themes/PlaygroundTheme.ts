/**
 * Lexical Playground Theme Configuration
 *
 * Defines CSS classes for all editor elements.
 * Inspired by the official Lexical playground theme.
 */
import type { EditorThemeClasses } from '../types';

const PlaygroundTheme: EditorThemeClasses = {
    paragraph: 'PlaygroundEditorTheme__paragraph',
    heading: {
        h1: 'PlaygroundEditorTheme__h1',
        h2: 'PlaygroundEditorTheme__h2',
        h3: 'PlaygroundEditorTheme__h3',
        h4: 'PlaygroundEditorTheme__h4',
        h5: 'PlaygroundEditorTheme__h5',
        h6: 'PlaygroundEditorTheme__h6',
    },
    list: {
        ul: 'PlaygroundEditorTheme__ul',
        ol: 'PlaygroundEditorTheme__ol',
        listitem: 'PlaygroundEditorTheme__listItem',
        nested: {
            listitem: 'PlaygroundEditorTheme__nestedListItem',
        },
        listitemChecked: 'PlaygroundEditorTheme__listItemChecked',
        listitemUnchecked: 'PlaygroundEditorTheme__listItemUnchecked',
    },
    quote: 'PlaygroundEditorTheme__quote',
    code: 'PlaygroundEditorTheme__code',
    codeHighlight: {
        atrule: 'PlaygroundEditorTheme__tokenAttr',
        attr: 'PlaygroundEditorTheme__tokenAttr',
        boolean: 'PlaygroundEditorTheme__tokenProperty',
        builtin: 'PlaygroundEditorTheme__tokenSelector',
        cdata: 'PlaygroundEditorTheme__tokenComment',
        char: 'PlaygroundEditorTheme__tokenSelector',
        class: 'PlaygroundEditorTheme__tokenFunction',
        'class-name': 'PlaygroundEditorTheme__tokenFunction',
        comment: 'PlaygroundEditorTheme__tokenComment',
        constant: 'PlaygroundEditorTheme__tokenProperty',
        deleted: 'PlaygroundEditorTheme__tokenProperty',
        doctype: 'PlaygroundEditorTheme__tokenComment',
        entity: 'PlaygroundEditorTheme__tokenOperator',
        function: 'PlaygroundEditorTheme__tokenFunction',
        important: 'PlaygroundEditorTheme__tokenVariable',
        inserted: 'PlaygroundEditorTheme__tokenSelector',
        keyword: 'PlaygroundEditorTheme__tokenAttr',
        namespace: 'PlaygroundEditorTheme__tokenVariable',
        number: 'PlaygroundEditorTheme__tokenProperty',
        operator: 'PlaygroundEditorTheme__tokenOperator',
        prolog: 'PlaygroundEditorTheme__tokenComment',
        property: 'PlaygroundEditorTheme__tokenProperty',
        punctuation: 'PlaygroundEditorTheme__tokenPunctuation',
        regex: 'PlaygroundEditorTheme__tokenVariable',
        selector: 'PlaygroundEditorTheme__tokenSelector',
        string: 'PlaygroundEditorTheme__tokenSelector',
        symbol: 'PlaygroundEditorTheme__tokenProperty',
        tag: 'PlaygroundEditorTheme__tokenProperty',
        url: 'PlaygroundEditorTheme__tokenOperator',
        variable: 'PlaygroundEditorTheme__tokenVariable',
    },
    table: 'PlaygroundEditorTheme__table',
    tableCell: 'PlaygroundEditorTheme__tableCell',
    tableCellHeader: 'PlaygroundEditorTheme__tableCellHeader',
    tableRow: 'PlaygroundEditorTheme__tableRow',
    link: 'PlaygroundEditorTheme__link',
    text: {
        bold: 'PlaygroundEditorTheme__textBold',
        italic: 'PlaygroundEditorTheme__textItalic',
        underline: 'PlaygroundEditorTheme__textUnderline',
        strikethrough: 'PlaygroundEditorTheme__textStrikethrough',
        subscript: 'PlaygroundEditorTheme__textSubscript',
        superscript: 'PlaygroundEditorTheme__textSuperscript',
        code: 'PlaygroundEditorTheme__textCode',
        highlight: 'PlaygroundEditorTheme__textHighlight',
    },
    image: 'PlaygroundEditorTheme__image',
    horizontalRule: 'PlaygroundEditorTheme__hr',
    characterLimit: 'PlaygroundEditorTheme__characterLimit',
};

export default PlaygroundTheme;
