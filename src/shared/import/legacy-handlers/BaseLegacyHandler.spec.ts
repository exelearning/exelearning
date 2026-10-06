/**
 * BaseLegacyHandler Unit Tests
 *
 * Tests for the base class that provides shared utilities for legacy iDevice handlers.
 *
 * Note: Tests for DOM-heavy methods (extractTextAreaFieldContent, extractFeedbackFieldContent,
 * extractFieldsContent, etc.) are covered by integration tests through LegacyXmlParser since
 * @xmldom/xmldom has limited selector support.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { DOMParser } from '@xmldom/xmldom';

import { BaseLegacyHandler } from './BaseLegacyHandler';

/**
 * Concrete implementation of BaseLegacyHandler for testing
 */
class TestHandler extends BaseLegacyHandler {
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('Test');
    }

    getTargetType(): string {
        return 'text';
    }

    // Expose protected methods for testing
    public testGetChildElements(element: Element): Element[] {
        return this.getChildElements(element);
    }

    public testGetDirectChildByTagName(parent: Element, tagName: string): Element | null {
        return this.getDirectChildByTagName(parent, tagName);
    }

    public testGetDirectChildrenByTagName(parent: Element, tagName: string): Element[] {
        return this.getDirectChildrenByTagName(parent, tagName);
    }

    public testGetElementsByClassContains(parent: Element, tagName: string, classSubstring: string): Element[] {
        return this.getElementsByClassContains(parent, tagName, classSubstring);
    }
}

/**
 * Helper to create DOM element from XML string
 */
function createDomElement(xml: string): Element {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    return doc.documentElement;
}

describe('BaseLegacyHandler', () => {
    let handler: TestHandler;

    beforeEach(() => {
        handler = new TestHandler();
    });

    describe('abstract method implementations', () => {
        it('should implement canHandle correctly', () => {
            expect(handler.canHandle('TestIdevice')).toBe(true);
            expect(handler.canHandle('OtherIdevice')).toBe(false);
        });

        it('should implement getTargetType correctly', () => {
            expect(handler.getTargetType()).toBe('text');
        });

        it('should have default extractProperties returning empty object', () => {
            const dict = createDomElement('<dictionary></dictionary>');
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should have default extractHtmlView returning empty string', () => {
            const dict = createDomElement('<dictionary></dictionary>');
            expect(handler.extractHtmlView(dict)).toBe('');
        });

        it('should have default extractFeedback returning empty result', () => {
            const dict = createDomElement('<dictionary></dictionary>');
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('getLocalizedFeedbackText', () => {
        it('should return Spanish text for "es"', () => {
            expect(handler.getLocalizedFeedbackText('es')).toBe('Mostrar retroalimentación');
        });

        it('should return English text for "en"', () => {
            expect(handler.getLocalizedFeedbackText('en')).toBe('Show Feedback');
        });

        it('should return Catalan text for "ca"', () => {
            expect(handler.getLocalizedFeedbackText('ca')).toBe('Mostra la retroalimentació');
        });

        it('should return Basque text for "eu"', () => {
            expect(handler.getLocalizedFeedbackText('eu')).toBe('Erakutsi feedbacka');
        });

        it('should return Galician text for "gl"', () => {
            expect(handler.getLocalizedFeedbackText('gl')).toBe('Mostrar retroalimentación');
        });

        it('should return Portuguese text for "pt"', () => {
            expect(handler.getLocalizedFeedbackText('pt')).toBe('Mostrar feedback');
        });

        it('should return French text for "fr"', () => {
            expect(handler.getLocalizedFeedbackText('fr')).toBe('Afficher le feedback');
        });

        it('should return German text for "de"', () => {
            expect(handler.getLocalizedFeedbackText('de')).toBe('Feedback anzeigen');
        });

        it('should return Italian text for "it"', () => {
            expect(handler.getLocalizedFeedbackText('it')).toBe('Mostra feedback');
        });

        it('should handle language codes with region (es-ES)', () => {
            expect(handler.getLocalizedFeedbackText('es-ES')).toBe('Mostrar retroalimentación');
        });

        it('should handle language codes with region (en-US)', () => {
            expect(handler.getLocalizedFeedbackText('en-US')).toBe('Show Feedback');
        });

        it('should default to Spanish for unknown language', () => {
            expect(handler.getLocalizedFeedbackText('xx')).toBe('Mostrar retroalimentación');
        });

        it('should default to Spanish for empty string', () => {
            expect(handler.getLocalizedFeedbackText('')).toBe('Mostrar retroalimentación');
        });

        it('should default to Spanish for undefined', () => {
            expect(handler.getLocalizedFeedbackText(undefined)).toBe('Mostrar retroalimentación');
        });
    });

    describe('getChildElements', () => {
        it('should return only element children, not text nodes', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="test"/>
                    <unicode value="value"/>
                </dictionary>
            `);
            const children = handler.testGetChildElements(dict);
            expect(children.length).toBe(2);
            expect(children[0].tagName).toBe('string');
            expect(children[1].tagName).toBe('unicode');
        });

        it('should return empty array for element with no children', () => {
            const dict = createDomElement('<dictionary/>');
            const children = handler.testGetChildElements(dict);
            expect(children.length).toBe(0);
        });
    });

    describe('getDirectChildByTagName', () => {
        it('should find direct child by tag name', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="test"/>
                    <instance class="Field"/>
                </dictionary>
            `);
            const instance = handler.testGetDirectChildByTagName(dict, 'instance');
            expect(instance).not.toBeNull();
            expect(instance?.getAttribute('class')).toBe('Field');
        });

        it('should return null if tag not found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="test"/>
                </dictionary>
            `);
            const result = handler.testGetDirectChildByTagName(dict, 'instance');
            expect(result).toBeNull();
        });
    });

    describe('getDirectChildrenByTagName', () => {
        it('should find all direct children by tag name', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="Field1"/>
                    <string role="key" value="test"/>
                    <instance class="Field2"/>
                </dictionary>
            `);
            const instances = handler.testGetDirectChildrenByTagName(dict, 'instance');
            expect(instances.length).toBe(2);
            expect(instances[0].getAttribute('class')).toBe('Field1');
            expect(instances[1].getAttribute('class')).toBe('Field2');
        });

        it('should return empty array if tag not found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="test"/>
                </dictionary>
            `);
            const result = handler.testGetDirectChildrenByTagName(dict, 'instance');
            expect(result.length).toBe(0);
        });
    });

    describe('findDictStringValue', () => {
        it('should find string value in dictionary', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="title"/>
                    <string value="Test Title"/>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'title')).toBe('Test Title');
        });

        it('should find unicode value in dictionary', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="content"/>
                    <unicode value="Unicode Content"/>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'content')).toBe('Unicode Content');
        });

        it('should return null for non-existent key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <string value="value"/>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'missing')).toBeNull();
        });

        it('should handle text content in unicode element', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="text"/>
                    <unicode>Text Content Inside</unicode>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'text')).toBe('Text Content Inside');
        });
    });

    describe('findDictList', () => {
        it('should find list element in dictionary', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="options"/>
                    <list>
                        <item>Option 1</item>
                        <item>Option 2</item>
                    </list>
                </dictionary>
            `);
            const list = handler.findDictList(dict, 'options');
            expect(list).not.toBeNull();
            expect(list?.tagName).toBe('list');
        });

        it('should return null for non-existent key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <list/>
                </dictionary>
            `);
            expect(handler.findDictList(dict, 'missing')).toBeNull();
        });
    });

    describe('findDictInstance', () => {
        it('should find instance element in dictionary', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="field"/>
                    <instance class="TextAreaField">
                        <dictionary/>
                    </instance>
                </dictionary>
            `);
            const instance = handler.findDictInstance(dict, 'field');
            expect(instance).not.toBeNull();
            expect(instance?.getAttribute('class')).toBe('TextAreaField');
        });

        it('should return null for non-existent key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <instance class="OtherField"/>
                </dictionary>
            `);
            expect(handler.findDictInstance(dict, 'missing')).toBeNull();
        });
    });

    describe('findDictBoolValue', () => {
        it('should return true for bool value="1"', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="enabled"/>
                    <bool value="1"/>
                </dictionary>
            `);
            expect(handler.findDictBoolValue(dict, 'enabled')).toBe(true);
        });

        it('should return false for bool value="0"', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="disabled"/>
                    <bool value="0"/>
                </dictionary>
            `);
            expect(handler.findDictBoolValue(dict, 'disabled')).toBe(false);
        });

        it('should return false for non-existent key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <bool value="1"/>
                </dictionary>
            `);
            expect(handler.findDictBoolValue(dict, 'missing')).toBe(false);
        });
    });

    describe('findDictIntValue', () => {
        it('should return integer value', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="count"/>
                    <int value="42"/>
                </dictionary>
            `);
            expect(handler.findDictIntValue(dict, 'count')).toBe(42);
        });

        it('should return null for non-existent key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <int value="10"/>
                </dictionary>
            `);
            expect(handler.findDictIntValue(dict, 'missing')).toBeNull();
        });

        it('should parse negative integers', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="negative"/>
                    <int value="-5"/>
                </dictionary>
            `);
            expect(handler.findDictIntValue(dict, 'negative')).toBe(-5);
        });
    });

    describe('decodeHtmlContent - LaTeX stress cases (regression)', () => {
        // --- RESTORED REGRESSION TESTS (plain \n / \t decoding outside LaTeX) ---
        // These were covered before the LaTeX protection block was introduced and
        // must keep working: since LaTeX blocks are protected first, escapes
        // outside those blocks are decoded unconditionally, without a lookahead.

        it('should decode \\n to newline', () => {
            expect(handler.decodeHtmlContent('Line1\\nLine2')).toBe('Line1\nLine2');
        });

        it('should decode \\t to tab', () => {
            expect(handler.decodeHtmlContent('Col1\\tCol2')).toBe('Col1\tCol2');
        });

        it('should decode \\n even when immediately followed by a letter (no false LaTeX match)', () => {
            const input = 'Text\\nnext line without any LaTeX nearby';
            expect(handler.decodeHtmlContent(input)).toBe('Text\nnext line without any LaTeX nearby');
        });

        it('should decode &nbsp; to a non-breaking space, not a regular space', () => {
            const result = handler.decodeHtmlContent('Hello&nbsp;World');
            expect(result).toBe('Hello\u00A0World');
            expect(result).not.toBe('Hello World');
        });

        it.each([
            // Commands starting with 't' (previously broken by \t -> tab)
            ['\\( 4 \\times \\dfrac{1}{2} \\)'],
            ['\\( \\tan(x) + \\theta \\)'],
            ['\\( \\tfrac{1}{2} + \\text{units} \\)'],
            ['\\( \\top \\land \\bot \\)'],

            // Commands starting with 'n' (previously broken by \n -> newline)
            ['\\( \\nabla f(x, y) \\)'],
            ['\\( \\neq \\quad \\nleq \\quad \\ngeq \\)'],
            ['\\( a \\notin B \\)'],

            // Commands starting with 'r' (already protected before, re-confirm)
            ['\\( \\left( x \\right) \\)'],
            ['\\( \\rho \\cdot \\rightarrow \\)'],

            // Mixed dangerous commands in the same formula
            [
                '\\( 4 \\times \\dfrac{1}{2} = \\dfrac{4}{1} \\times \\dfrac{1}{2} = \\dfrac{4 \\times 1}{1 \\times 2} = \\dfrac{4}{2} \\)',
            ],
            ['\\( \\nabla \\times \\vec{F} = \\left( \\tfrac{\\partial}{\\partial x} \\right) \\)'],

            // \begin{...}...\end{...} environments without $, \(, \[ delimiters
            ['\\begin{equation} a \\times b = c \\end{equation}'],
            ['\\begin{align} x &= \\nabla f \\\\ y &= \\tan(\\theta) \\end{align}'],

            // Multiple LaTeX blocks in the same content (placeholder collision check)
            ['First \\( a \\times b \\) then \\( \\nabla \\times c \\) and finally \\( \\tan(\\theta) \\)'],

            // Text that literally contains something resembling the internal placeholder
            [
                'Note: __LATEX_BLOCK_0__ is an internal placeholder, it should not be touched, and here is a real formula \\( a \\times b \\)',
            ],

            // Escaped dollar sign before a real formula
            ['Price: \\$5, formula: $x \\times y$'],
            ['The cost is \\$10.50 and the equation is $\\nabla \\times \\vec{F}$'],
        ])('should leave LaTeX content unchanged: %s', input => {
            expect(handler.decodeHtmlContent(input)).toBe(input);
        });

        it.each([
            // HTML entities inside LaTeX must still be decoded
            ['\\( x &lt; y \\)', '\\( x < y \\)'],
            ['$a &amp;&amp; b$', '$a && b$'],
            ['\\begin{equation} x &lt; y \\end{equation}', '\\begin{equation} x < y \\end{equation}'],
        ])('should decode HTML entities inside LaTeX: %s -> %s', (input, expected) => {
            expect(handler.decodeHtmlContent(input)).toBe(expected);
        });

        // --- REVIEWER REGRESSION TESTS (Currency vs Formula) ---

        it('should not be tricked by preceding currency text leaving LaTeX commands unprotected (Reviewer Case)', () => {
            // If the regex is greedy, it might match from the currency "$" to the opening "$"
            // of the formula, leaving "\times" outside the protected block where it would be
            // corrupted into a tab character.
            const input = 'Price: $5 and formula $x \\times y$';
            expect(handler.decodeHtmlContent(input)).toBe(input);
        });

        it('should handle multiple currency amounts without misclassification', () => {
            const input = 'Price: $5 and $10 total';
            expect(handler.decodeHtmlContent(input)).toBe(input);
        });

        it('should protect a $...$ formula starting with a digit glued to a variable (e.g. "2x")', () => {
            const input = 'The formula is $2x+3$';
            expect(handler.decodeHtmlContent(input)).toBe(input);
        });

        it('should protect a $...$ formula with a numeric coefficient and a LaTeX command', () => {
            const input = 'Compute $5x \\times 2$ to get the result';
            expect(handler.decodeHtmlContent(input)).toBe(input);
        });

        it(
            'KNOWN LIMITATION: a $...$ formula consisting of a bare number only (e.g. "$5$") ' +
                'is still misclassified as currency',
            () => {
                // "$5$" has nothing after the digit but the closing "$" itself,
                // which counts as a word boundary — so it's indistinguishable
                // from a currency amount. Rare in practice (a lone number is
                // seldom wrapped in $ $ without any operator or variable).
                // Note: It remains unchanged in the output because it contains no
                // Python-style escape sequences (\n, \t, \r) to corrupt.
                const input = 'The answer is $5$';
                const result = handler.decodeHtmlContent(input);
                expect(result).toBe(input);
            },
        );
    });

    describe('extractTextAreaFieldRawContent (quiz option plain text)', () => {
        // How a quiz option is read by MultichoiceHandler / ScormTestHandler:
        // raw field value (one XML decode) -> stripHtmlTags.
        function optionPlainText(unicodeAttrValue: string): string {
            const field = createDomElement(`
                <instance class="exe.engine.field.TextAreaField">
                    <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="${unicodeAttrValue}"/>
                    </dictionary>
                </instance>
            `);
            return handler.stripHtmlTags(handler.extractTextAreaFieldRawContent(field));
        }

        it('returns the raw content without decoding entities', () => {
            const field = createDomElement(`
                <instance class="exe.engine.field.TextAreaField">
                    <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="&lt;p&gt;A &amp;lt; B&lt;/p&gt;"/>
                    </dictionary>
                </instance>
            `);
            expect(handler.extractTextAreaFieldRawContent(field)).toBe('<p>A &lt; B</p>');
        });

        // Real <unicode value="..."> values from an eXe 2.9 contentv3.xml.
        it.each([
            ['&lt;p&gt;A &amp;lt; B&lt;/p&gt;', 'A < B'],
            ['&lt;p&gt;A&amp;gt;B&lt;/p&gt;', 'A>B'],
            ['&lt;p&gt;A=B&lt;/p&gt;', 'A=B'],
            ['&lt;p&gt;A + B &amp;gt; C+D &amp;amp;&amp;amp; 4&lt;/p&gt;', 'A + B > C+D && 4'],
            ['&lt;p&gt;a = b &amp;amp;&amp;amp;  c&amp;gt;a y &amp;amp; b&amp;lt;a&lt;/p&gt;', 'a = b && c>a y & b<a'],
        ])('preserves real eXe 2.9 escaped option %s -> %s', (attrValue, expected) => {
            expect(optionPlainText(attrValue)).toBe(expected);
        });
    });

    describe('stripHtmlTags', () => {
        it('should strip simple HTML tags', () => {
            expect(handler.stripHtmlTags('<p>Hello</p>')).toBe('Hello');
        });

        it('should strip nested tags', () => {
            expect(handler.stripHtmlTags('<div><p>Hello <strong>World</strong></p></div>')).toBe('Hello World');
        });

        it('should remove script content', () => {
            expect(handler.stripHtmlTags('Before<script>alert("xss")</script>After')).toBe('BeforeAfter');
        });

        it('should remove style content', () => {
            expect(handler.stripHtmlTags('Before<style>.red{color:red}</style>After')).toBe('BeforeAfter');
        });

        it('should decode &nbsp;', () => {
            expect(handler.stripHtmlTags('Hello&nbsp;World')).toBe('Hello World');
        });

        it('should collapse whitespace', () => {
            expect(handler.stripHtmlTags('Hello    World')).toBe('Hello World');
        });

        it('should return empty string for empty input', () => {
            expect(handler.stripHtmlTags('')).toBe('');
        });

        it('should trim result', () => {
            expect(handler.stripHtmlTags('  <p>  Hello  </p>  ')).toBe('Hello');
        });
    });

    describe('escapeHtmlAttr', () => {
        it('should escape & character', () => {
            expect(handler.escapeHtmlAttr('A & B')).toBe('A &amp; B');
        });

        it('should escape < and > characters', () => {
            expect(handler.escapeHtmlAttr('<tag>')).toBe('&lt;tag&gt;');
        });

        it('should escape double quotes', () => {
            expect(handler.escapeHtmlAttr('Say "Hello"')).toBe('Say &quot;Hello&quot;');
        });

        it('should escape single quotes', () => {
            expect(handler.escapeHtmlAttr("It's nice")).toBe('It&#39;s nice');
        });

        it('should return empty string for empty input', () => {
            expect(handler.escapeHtmlAttr('')).toBe('');
        });
    });

    describe('escapeHtml', () => {
        it('should escape all HTML special characters', () => {
            const input = '<div class="test">It\'s & more</div>';
            const expected = '&lt;div class=&quot;test&quot;&gt;It&#039;s &amp; more&lt;/div&gt;';
            expect(handler.escapeHtml(input)).toBe(expected);
        });

        it('should return empty string for empty input', () => {
            expect(handler.escapeHtml('')).toBe('');
        });
    });

    describe('extractTextAreaFieldContent', () => {
        it('should return empty string for null input', () => {
            expect(handler.extractTextAreaFieldContent(null)).toBe('');
        });

        it('should return empty string when no dictionary', () => {
            const field = createDomElement(`
                <instance class="TextAreaField"/>
            `);
            expect(handler.extractTextAreaFieldContent(field)).toBe('');
        });

        it('should extract content from content_w_resourcePaths', () => {
            const field = createDomElement(`
                <instance class="TextAreaField">
                    <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="&lt;p&gt;Hello World&lt;/p&gt;"/>
                    </dictionary>
                </instance>
            `);
            const content = handler.extractTextAreaFieldContent(field);
            expect(content).toBe('<p>Hello World</p>');
        });

        it('should extract content from _content key', () => {
            const field = createDomElement(`
                <instance class="TextAreaField">
                    <dictionary>
                        <string role="key" value="_content"/>
                        <unicode value="Content text"/>
                    </dictionary>
                </instance>
            `);
            const content = handler.extractTextAreaFieldContent(field);
            expect(content).toBe('Content text');
        });
    });

    describe('extractFeedbackFieldContent', () => {
        it('should return empty result for null input', () => {
            const result = handler.extractFeedbackFieldContent(null);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });

        it('should extract feedback content and button caption', () => {
            const field = createDomElement(`
                <instance class="FeedbackField">
                    <dictionary>
                        <string role="key" value="feedback"/>
                        <unicode value="Great job!"/>
                        <string role="key" value="_buttonCaption"/>
                        <unicode value="Show Answer"/>
                    </dictionary>
                </instance>
            `);
            const result = handler.extractFeedbackFieldContent(field);
            expect(result.content).toBe('Great job!');
            expect(result.buttonCaption).toBe('Show Answer');
        });

        it('should default button caption to "Show Feedback"', () => {
            const field = createDomElement(`
                <instance class="FeedbackField">
                    <dictionary>
                        <string role="key" value="feedback"/>
                        <unicode value="Feedback text"/>
                    </dictionary>
                </instance>
            `);
            const result = handler.extractFeedbackFieldContent(field);
            expect(result.buttonCaption).toBe('Show Feedback');
        });

        it('should skip empty/whitespace-only feedback content (line 370)', () => {
            const field = createDomElement(`
                <instance class="FeedbackField">
                    <dictionary>
                        <string role="key" value="feedback"/>
                        <unicode value="   "/>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Actual content"/>
                    </dictionary>
                </instance>
            `);
            const result = handler.extractFeedbackFieldContent(field);
            expect(result.content).toBe('Actual content');
        });

        it('should extract button caption from string element (line 388)', () => {
            const field = createDomElement(`
                <instance class="FeedbackField">
                    <dictionary>
                        <string role="key" value="feedback"/>
                        <unicode value="Feedback"/>
                        <string role="key" value="_buttonCaption"/>
                        <string value="Click Me"/>
                    </dictionary>
                </instance>
            `);
            const result = handler.extractFeedbackFieldContent(field);
            expect(result.buttonCaption).toBe('Click Me');
        });
    });

    describe('findDictStringValue edge cases', () => {
        it('should return null when unicode element has no value and no textContent (line 147)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="empty"/>
                    <unicode/>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'empty')).toBeNull();
        });

        it('should return null when key is found but next element is not string/unicode', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="notstring"/>
                    <int value="42"/>
                </dictionary>
            `);
            expect(handler.findDictStringValue(dict, 'notstring')).toBeNull();
        });
    });

    describe('findDictList edge cases', () => {
        it('should return null when key is found but next element is not a list (line 172)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="notlist"/>
                    <string value="not a list"/>
                </dictionary>
            `);
            expect(handler.findDictList(dict, 'notlist')).toBeNull();
        });
    });

    describe('findDictInstance edge cases', () => {
        it('should return null when key is found but next element is not an instance (line 197)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="notinstance"/>
                    <string value="not an instance"/>
                </dictionary>
            `);
            expect(handler.findDictInstance(dict, 'notinstance')).toBeNull();
        });
    });

    describe('findDictBoolValue edge cases', () => {
        it('should return true when bool value is 1 (line 222)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="flag"/>
                    <bool value="1"/>
                </dictionary>
            `);
            expect(handler.findDictBoolValue(dict, 'flag')).toBe(true);
        });

        it('should return false when key found but next element is not bool', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="notbool"/>
                    <string value="true"/>
                </dictionary>
            `);
            expect(handler.findDictBoolValue(dict, 'notbool')).toBe(false);
        });
    });

    describe('findDictIntValue edge cases', () => {
        it('should return NaN when int has empty value attribute (line 248)', () => {
            // When getAttribute returns empty string, parseInt returns NaN
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="emptyval"/>
                    <int value=""/>
                </dictionary>
            `);
            const result = handler.findDictIntValue(dict, 'emptyval');
            expect(Number.isNaN(result as number)).toBe(true);
        });

        it('should return null when key found but next element is not int', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="notint"/>
                    <string value="42"/>
                </dictionary>
            `);
            expect(handler.findDictIntValue(dict, 'notint')).toBeNull();
        });

        it('should handle int with zero value', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="zero"/>
                    <int value="0"/>
                </dictionary>
            `);
            expect(handler.findDictIntValue(dict, 'zero')).toBe(0);
        });
    });

    describe('getElementsByClassContains (lines 287-296)', () => {
        it('should find elements by class substring', () => {
            const parent = createDomElement(`
                <root>
                    <div class="field-text-area"/>
                    <div class="field-select"/>
                    <div class="field-text-input"/>
                    <div class="other"/>
                </root>
            `);
            const result = handler.testGetElementsByClassContains(parent, 'div', 'field-text');
            expect(result.length).toBe(2);
            expect(result[0].getAttribute('class')).toBe('field-text-area');
            expect(result[1].getAttribute('class')).toBe('field-text-input');
        });

        it('should return empty array when no matches', () => {
            const parent = createDomElement(`
                <root>
                    <div class="other"/>
                </root>
            `);
            const result = handler.testGetElementsByClassContains(parent, 'div', 'field');
            expect(result.length).toBe(0);
        });

        it('should handle elements without class attribute', () => {
            const parent = createDomElement(`
                <root>
                    <div/>
                    <div class="field"/>
                </root>
            `);
            const result = handler.testGetElementsByClassContains(parent, 'div', 'field');
            expect(result.length).toBe(1);
        });
    });

    describe('extractFieldsContent (lines 526-527)', () => {
        it('should extract content from fields list with TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content_w_resourcePaths"/>
                                <unicode value="Field 1 content"/>
                            </dictionary>
                        </instance>
                        <instance class="TextField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Field 2 content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractFieldsContent(dict);
            expect(result).toContain('Field 1 content');
            expect(result).toContain('Field 2 content');
        });

        it('should return empty string when no fields key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <list/>
                </dictionary>
            `);
            expect(handler.extractFieldsContent(dict)).toBe('');
        });

        it('should return empty string when fields value is not a list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <string value="not a list"/>
                </dictionary>
            `);
            expect(handler.extractFieldsContent(dict)).toBe('');
        });

        it('should skip non-text field instances', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="SelectField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Skipped"/>
                            </dictionary>
                        </instance>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Included"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractFieldsContent(dict);
            expect(result).toBe('Included');
            expect(result).not.toContain('Skipped');
        });
    });

    describe('extractRichTextContent (lines 550-560)', () => {
        it('should return empty string when field not found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <unicode value="value"/>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'missing')).toBe('');
        });

        it('should return empty string when value element is missing (line 552)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="field"/>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'field')).toBe('');
        });

        it('should extract from unicode element (line 554-555)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="richText"/>
                    <unicode value="&lt;p&gt;Rich content&lt;/p&gt;"/>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'richText')).toBe('<p>Rich content</p>');
        });

        it('should extract from string element (line 554-555)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="richText"/>
                    <string value="Plain content"/>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'richText')).toBe('Plain content');
        });

        it('should extract from instance element (line 558-559)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="richText"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Instance content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'richText')).toBe('Instance content');
        });

        it('should return empty string for unsupported value element type', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="field"/>
                    <list/>
                </dictionary>
            `);
            expect(handler.extractRichTextContent(dict, 'field')).toBe('');
        });
    });

    describe('extractAnyTextFieldContent (lines 577-596)', () => {
        it('should extract from direct child TextAreaField instance (lines 577-583)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Direct content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('Direct content');
        });

        it('should extract from direct child TextField instance', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="TextField content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('TextField content');
        });

        it('should extract from nested TextAreaField instance (lines 589-596)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <nested>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Nested content"/>
                            </dictionary>
                        </instance>
                    </nested>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('Nested content');
        });

        it('should return empty string when no text field found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="SelectField">
                        <dictionary/>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('');
        });

        it('should skip text fields with empty content', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value=""/>
                        </dictionary>
                    </instance>
                    <nested>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Real content"/>
                            </dictionary>
                        </instance>
                    </nested>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('Real content');
        });

        it('does not cross into a nested JsIdevice boundary (issue #2159)', () => {
            // Field belongs to a DIFFERENT iDevice inlined via a back-reference.
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="parentNode"/>
                    <instance class="exe.engine.jsidevice.JsIdevice">
                        <dictionary>
                            <string role="key" value="fields"/>
                            <list>
                                <instance class="exe.engine.field.TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content_w_resourcePaths"/>
                                        <unicode value="Foreign iDevice content"/>
                                    </dictionary>
                                </instance>
                            </list>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('');
        });

        it('does not cross into a nested Node boundary (issue #2159)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="parentNode"/>
                    <instance class="exe.engine.node.Node">
                        <dictionary>
                            <instance class="exe.engine.field.TextAreaField">
                                <dictionary>
                                    <string role="key" value="content_w_resourcePaths"/>
                                    <unicode value="Node subtree content"/>
                                </dictionary>
                            </instance>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('');
        });

        it('still finds a field nested in the iDevice own containers (not a boundary)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="exe.engine.field.TextAreaField">
                            <dictionary>
                                <string role="key" value="content_w_resourcePaths"/>
                                <unicode value="Own field content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractAnyTextFieldContent(dict)).toBe('Own field content');
        });
    });

    describe('extractFieldsContent with <reference> fields (issue #2159)', () => {
        it('resolves a <reference> field via the context resolver', () => {
            const referenced = createDomElement(`
                <instance class="exe.engine.field.TextAreaField" reference="33">
                    <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Referenced field content"/>
                    </dictionary>
                </instance>
            `);
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <reference key="33"/>
                    </list>
                </dictionary>
            `);
            const context = {
                language: 'en',
                ideviceId: 'idevice-1',
                className: 'exe.engine.jsidevice.JsIdevice',
                resolveReference: (key: string) => (key === '33' ? referenced : undefined),
            };
            expect(handler.extractFieldsContent(dict, context)).toBe('Referenced field content');
        });

        it('skips a <reference> field when no resolver is provided', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <reference key="33"/>
                    </list>
                </dictionary>
            `);
            expect(handler.extractFieldsContent(dict)).toBe('');
        });
    });

    describe('extractResourcePath (lines 610-624)', () => {
        it('should return null when resource instance not found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <instance class="Other"/>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'resource')).toBeNull();
        });

        it('should return null when resource has no dictionary', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="resource"/>
                    <instance class="Resource"/>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'resource')).toBeNull();
        });

        it('should extract _storageName from resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="image"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="_storageName"/>
                            <string value="image.png"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'image')).toBe('image.png');
        });

        it('should extract storageName from resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="file"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="storageName"/>
                            <string value="document.pdf"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'file')).toBe('document.pdf');
        });

        it('should extract _fileName from resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="media"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="_fileName"/>
                            <string value="video.mp4"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'media')).toBe('video.mp4');
        });

        it('should extract fileName from resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="audio"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="fileName"/>
                            <string value="audio.mp3"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'audio')).toBe('audio.mp3');
        });

        it('should return null when no storage/file name found', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="resource"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="other"/>
                            <string value="value"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractResourcePath(dict, 'resource')).toBeNull();
        });
    });
});
