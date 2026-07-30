import { describe, expect, it } from 'vitest';
import { collectDropdownBlankNodes, dropdownBlanks, escapeHtml, isDropdownBlank, unescapeEntitiesOnce } from './html';

describe('escapeHtml', () => {
    it('escapes markup-significant characters', () => {
        expect(escapeHtml('<b a="x" b=\'y\'>&')).toBe('&lt;b a=&quot;x&quot; b=&#39;y&#39;&gt;&amp;');
    });

    it('coerces null/undefined to an empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(42)).toBe('42');
    });
});

describe('unescapeEntitiesOnce', () => {
    it('unescapes exactly one level of entities', () => {
        expect(unescapeEntitiesOnce('&lt;span&gt;&amp;lt;&quot;&#39;')).toBe('<span>&lt;"\'');
    });

    it('coerces null to an empty string', () => {
        expect(unescapeEntitiesOnce(null)).toBe('');
    });
});

describe('dropdownBlanks', () => {
    it('extracts correct words from legacy line-through spans, in order', () => {
        const html =
            '<p>A <span style="text-decoration: line-through;">one</span> B ' +
            '<span style="text-decoration: line-through">two</span></p>';
        expect(dropdownBlanks(html)).toEqual(['one', 'two']);
    });

    it('accepts modern text-decoration-line and s/strike/del elements', () => {
        expect(dropdownBlanks('<span style="text-decoration-line: line-through">x</span>')).toEqual(['x']);
        expect(dropdownBlanks('<s>y</s> <del>z</del>')).toEqual(['y', 'z']);
    });

    it('ignores non-blank markup and trims the word', () => {
        expect(
            dropdownBlanks('<p>plain <b>bold</b> <span style="text-decoration: line-through;"> spaced </span></p>'),
        ).toEqual(['spaced']);
    });

    it('skips empty blanks and never double-counts nested blanks', () => {
        expect(dropdownBlanks('<span style="text-decoration: line-through;"></span>')).toEqual([]);
        expect(dropdownBlanks('<s>a <span style="text-decoration: line-through;">b</span></s>')).toEqual(['a b']);
    });

    it('returns [] for empty or invalid input', () => {
        expect(dropdownBlanks('')).toEqual([]);
        expect(dropdownBlanks(null)).toEqual([]);
    });
});

describe('isDropdownBlank / collectDropdownBlankNodes', () => {
    it('recognizes every legacy blank shape on live DOM nodes', () => {
        const host = document.createElement('div');
        host.innerHTML = '<s>a</s><span style="text-decoration: line-through;">b</span><b>c</b>';
        const [s, span, b] = Array.from(host.children);
        expect(isDropdownBlank(s ?? null)).toBe(true);
        expect(isDropdownBlank(span ?? null)).toBe(true);
        expect(isDropdownBlank(b ?? null)).toBe(false);
        expect(isDropdownBlank(null)).toBe(false);
        expect(collectDropdownBlankNodes(host).map(node => node.textContent)).toEqual(['a', 'b']);
    });

    it('returns [] for a missing root', () => {
        expect(collectDropdownBlankNodes(null)).toEqual([]);
    });
});
