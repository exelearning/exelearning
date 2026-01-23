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

    describe('decodeHtmlContent', () => {
        it('should decode HTML entities', () => {
            expect(handler.decodeHtmlContent('&lt;div&gt;Hello&lt;/div&gt;')).toBe('<div>Hello</div>');
        });

        it('should decode &amp;', () => {
            expect(handler.decodeHtmlContent('A &amp; B')).toBe('A & B');
        });

        it('should decode &quot;', () => {
            expect(handler.decodeHtmlContent('Say &quot;Hello&quot;')).toBe('Say "Hello"');
        });

        it('should decode &#39;', () => {
            expect(handler.decodeHtmlContent('It&#39;s nice')).toBe("It's nice");
        });

        it('should decode \\n to newline', () => {
            expect(handler.decodeHtmlContent('Line1\\nLine2')).toBe('Line1\nLine2');
        });

        it('should decode \\t to tab', () => {
            expect(handler.decodeHtmlContent('Col1\\tCol2')).toBe('Col1\tCol2');
        });

        it('should return empty string for empty input', () => {
            expect(handler.decodeHtmlContent('')).toBe('');
        });

        it('should preserve LaTeX \\right command', () => {
            const latex = '\\left( x \\right)';
            // \\r followed by 'i' in 'right' should NOT be converted
            expect(handler.decodeHtmlContent(latex)).toBe('\\left( x \\right)');
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
    });
});
