/**
 * resolveFieldInstances Unit Tests
 */

import { describe, it, expect } from 'bun:test';
import { DOMParser } from '@xmldom/xmldom';

import { resolveFieldInstances } from './resolveFieldInstances';

/**
 * Parse an XML string and return its documentElement as an Element.
 */
function parse(xml: string): Element {
    return new DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element;
}

/**
 * Build a `reference` -> `instance` resolver from every <instance reference="N">
 * in the document that owns `listEl` (first-match, like the parser's real map).
 */
function referenceResolver(root: Element): (key: string) => Element | undefined {
    const map = new Map<string, Element>();
    const instances = root.getElementsByTagName('instance');
    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i] as unknown as Element;
        const ref = inst.getAttribute('reference');
        if (ref && !map.has(ref)) map.set(ref, inst);
    }
    return (key: string) => map.get(key);
}

describe('resolveFieldInstances', () => {
    it('returns inline <instance> children in document order', () => {
        const list = parse(`<list>
            <instance class="exe.engine.field.TextAreaField" reference="1"/>
            <instance class="exe.engine.field.FeedbackField" reference="2"/>
        </list>`);

        const result = resolveFieldInstances(list);
        expect(result.length).toBe(2);
        expect(result[0].getAttribute('reference')).toBe('1');
        expect(result[1].getAttribute('reference')).toBe('2');
    });

    it('resolves a <reference> to its originating <instance>', () => {
        const root = parse(`<root>
            <instance class="exe.engine.field.TextAreaField" reference="33"/>
            <list>
                <reference key="33"/>
            </list>
        </root>`);
        const list = root.getElementsByTagName('list')[0] as unknown as Element;

        const result = resolveFieldInstances(list, referenceResolver(root));
        expect(result.length).toBe(1);
        expect(result[0].tagName).toBe('instance');
        expect(result[0].getAttribute('reference')).toBe('33');
    });

    it('preserves order across mixed <instance> and <reference> children', () => {
        const root = parse(`<root>
            <instance class="exe.engine.field.TextAreaField" reference="10"/>
            <list>
                <instance class="exe.engine.field.TextAreaField" reference="20"/>
                <reference key="10"/>
                <instance class="exe.engine.field.TextAreaField" reference="30"/>
            </list>
        </root>`);
        const list = root.getElementsByTagName('list')[0] as unknown as Element;

        const result = resolveFieldInstances(list, referenceResolver(root));
        expect(result.map(el => el.getAttribute('reference'))).toEqual(['20', '10', '30']);
    });

    it('skips <reference> children when no resolver is supplied', () => {
        const list = parse(`<list>
            <reference key="33"/>
            <instance class="exe.engine.field.TextAreaField" reference="1"/>
        </list>`);

        const result = resolveFieldInstances(list);
        expect(result.length).toBe(1);
        expect(result[0].getAttribute('reference')).toBe('1');
    });

    it('skips a <reference> that does not resolve to any instance', () => {
        const list = parse(`<list>
            <reference key="999"/>
        </list>`);

        const result = resolveFieldInstances(list, () => undefined);
        expect(result.length).toBe(0);
    });

    it('ignores non-element nodes and unrelated tags', () => {
        const list = parse(`<list>
            <int value="5"/>
            <instance class="exe.engine.field.TextAreaField" reference="1"/>
            <none/>
        </list>`);

        const result = resolveFieldInstances(list);
        expect(result.length).toBe(1);
        expect(result[0].getAttribute('reference')).toBe('1');
    });
});
