/**
 * BaseLegacyHandler
 *
 * Base class for legacy iDevice handlers.
 * Provides shared utilities for parsing legacy XML structures.
 *
 * This is a TypeScript port of the browser-side BaseLegacyHandler.js,
 * designed to work in both browser and Node.js environments.
 *
 * Each handler subclass implements:
 * - canHandle(className): Check if this handler supports the legacy class
 * - getTargetType(): Return the modern iDevice type name
 * - extractProperties(dict): Extract iDevice-specific properties
 * - extractHtmlView(dict): Extract HTML content (optional)
 */

import type { IdeviceHandler, IdeviceHandlerContext, FeedbackResult, BlockProperties } from './IdeviceHandler';
import { FEEDBACK_TRANSLATIONS } from '../interfaces';
import { stripLegacyExeTextWrapper } from '../legacyExeTextWrapper';
import { resolveFieldInstances } from '../resolveFieldInstances';

/**
 * Abstract base class for legacy iDevice handlers
 */
export abstract class BaseLegacyHandler implements IdeviceHandler {
    /**
     * Check if this handler can process the given legacy class
     * Must be implemented by subclass
     *
     * @param className - Legacy class name
     * @param ideviceType - Optional iDevice type from _iDeviceDir
     * @returns true if this handler supports this class
     */
    abstract canHandle(className: string, ideviceType?: string): boolean;

    /**
     * Get the target modern iDevice type
     * Must be implemented by subclass
     *
     * @returns Modern iDevice type (e.g., 'form', 'text', 'trueorfalse')
     */
    abstract getTargetType(): string;

    /**
     * Extract iDevice-specific properties from the dictionary
     * Default implementation returns empty object
     *
     * @param dict - Dictionary element of the iDevice
     * @param _ideviceId - Generated iDevice ID
     * @returns Properties object
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        void dict;
        return {};
    }

    /**
     * Extract HTML content from the dictionary
     * Default implementation returns empty string
     *
     * @param dict - Dictionary element from legacy XML
     * @param _context - Context with language info
     * @returns HTML content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        void dict;
        return '';
    }

    /**
     * Extract feedback content from the dictionary
     * Default implementation returns empty content
     *
     * @param dict - Dictionary element from legacy XML
     * @param _context - Context with language info
     * @returns Feedback info
     */
    extractFeedback(dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        void dict;
        return { content: '', buttonCaption: '' };
    }

    /**
     * Get block-level properties (optional)
     * @returns Block properties or undefined
     */
    getBlockProperties?(): BlockProperties;

    // ========================================
    // Localization Utilities
    // ========================================

    /**
     * Get localized "Show Feedback" text based on language code
     * Uses static translations instead of UI locale for legacy imports
     *
     * @param langCode - Language code (e.g., 'es', 'en', 'ca')
     * @returns Localized feedback button text
     */
    getLocalizedFeedbackText(langCode: string | undefined): string {
        // Normalize language code (e.g., 'es-ES' -> 'es')
        const lang = (langCode || '').split('-')[0].toLowerCase();
        return FEEDBACK_TRANSLATIONS[lang] || FEEDBACK_TRANSLATIONS.es;
    }

    // ========================================
    // XML Dictionary Parsing Utilities
    // ========================================

    /**
     * Get child elements of an element (filters out text nodes)
     *
     * @param element - Parent element
     * @returns Array of child elements
     */
    protected getChildElements(element: Element): Element[] {
        const result: Element[] = [];
        const children = element.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) {
                // ELEMENT_NODE
                result.push(child as Element);
            }
        }
        return result;
    }

    /**
     * Find a string value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Value or null
     */
    findDictStringValue(dict: Element, key: string): string | null {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                // Handle both <string> and <unicode> value elements
                if (valueEl && (valueEl.tagName === 'string' || valueEl.tagName === 'unicode')) {
                    return valueEl.getAttribute('value') || valueEl.textContent || null;
                }
            }
        }
        return null;
    }

    /**
     * Find a list element in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns List element or null
     */
    findDictList(dict: Element, key: string): Element | null {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'list') {
                    return valueEl;
                }
            }
        }
        return null;
    }

    /**
     * Find an instance element in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Instance element or null
     */
    findDictInstance(dict: Element, key: string): Element | null {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'instance') {
                    return valueEl;
                }
            }
        }
        return null;
    }

    /**
     * Find a boolean value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Boolean value (false if not found)
     */
    findDictBoolValue(dict: Element, key: string): boolean {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'bool') {
                    return valueEl.getAttribute('value') === '1';
                }
            }
        }
        return false;
    }

    /**
     * Find an integer value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Integer value or null
     */
    findDictIntValue(dict: Element, key: string): number | null {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'int') {
                    const value = valueEl.getAttribute('value');
                    return value !== null ? parseInt(value, 10) : null;
                }
            }
        }
        return null;
    }

    // ========================================
    // Field Content Extraction
    // ========================================

    /**
     * Get direct child element by tag name (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @returns First matching child element or null
     */
    protected getDirectChildByTagName(parent: Element, tagName: string): Element | null {
        const children = this.getChildElements(parent);
        return children.find(el => el.tagName === tagName) || null;
    }

    /**
     * Get all direct child elements by tag name (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @returns Array of matching child elements
     */
    protected getDirectChildrenByTagName(parent: Element, tagName: string): Element[] {
        const children = this.getChildElements(parent);
        return children.filter(el => el.tagName === tagName);
    }

    /**
     * Find elements by class name containing a substring (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @param classSubstring - Substring that must be in the class attribute
     * @returns Array of matching elements
     */
    protected getElementsByClassContains(parent: Element, tagName: string, classSubstring: string): Element[] {
        const elements: Element[] = [];
        const allElements = parent.getElementsByTagName(tagName);
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as Element;
            const className = el.getAttribute('class') || '';
            if (className.includes(classSubstring)) {
                elements.push(el);
            }
        }
        return elements;
    }

    /**
     * Extract content from a TextAreaField instance
     *
     * @param fieldInst - TextAreaField instance element
     * @returns HTML content
     */
    extractTextAreaFieldContent(fieldInst: Element | null): string {
        const raw = this.extractTextAreaFieldRawContent(fieldInst);
        return raw ? this.decodeHtmlContent(raw) : '';
    }

    /**
     * Extract the raw TextAreaField content WITHOUT decoding HTML entities.
     *
     * Use this when the value will be reduced to plain text (e.g. quiz option
     * labels via stripHtmlTags). Decoding entities first turns an
     * entity-encoded literal such as "A&lt;B" into live markup ("A<B"), which a
     * later tag-strip then destroys ("A"). Keeping it raw lets stripHtmlTags
     * remove the real <p> tags first and decode &lt;/&gt;/&amp; afterwards, so
     * the literal "<" survives. See MultichoiceHandler / ScormTestHandler.
     *
     * @param fieldInst - TextAreaField instance element
     * @returns Raw (still entity-encoded) content
     */
    extractTextAreaFieldRawContent(fieldInst: Element | null): string {
        if (!fieldInst) return '';
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return '';

        const children = this.getChildElements(dict);

        // Look for content_w_resourcePaths or _content key
        const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

        for (const targetKey of contentKeys) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (
                    child.tagName === 'string' &&
                    child.getAttribute('role') === 'key' &&
                    child.getAttribute('value') === targetKey
                ) {
                    const valueEl = children[i + 1];
                    if (valueEl && valueEl.tagName === 'unicode') {
                        const value = valueEl.getAttribute('value') || valueEl.textContent || '';
                        if (value.trim()) {
                            return value;
                        }
                    }
                }
            }
        }

        return '';
    }

    /**
     * Extract content from a FeedbackField instance
     *
     * @param fieldInst - FeedbackField instance element
     * @returns Feedback content and button caption
     */
    extractFeedbackFieldContent(fieldInst: Element | null): FeedbackResult {
        if (!fieldInst) return { content: '', buttonCaption: '' };
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return { content: '', buttonCaption: '' };

        const children = this.getChildElements(dict);
        let content = '';
        let buttonCaption = '';

        // Look for feedback content
        const contentKeys = ['feedback', 'content_w_resourcePaths', '_content', 'content'];
        for (const targetKey of contentKeys) {
            if (content) break;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (
                    child.tagName === 'string' &&
                    child.getAttribute('role') === 'key' &&
                    child.getAttribute('value') === targetKey
                ) {
                    const valueEl = children[i + 1];
                    if (valueEl && valueEl.tagName === 'unicode') {
                        const value = valueEl.getAttribute('value') || valueEl.textContent || '';
                        if (value.trim()) {
                            content = this.decodeHtmlContent(value);
                            break;
                        }
                    }
                }
            }
        }

        // Look for button caption
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === '_buttonCaption'
            ) {
                const valueEl = children[i + 1];
                if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
                    buttonCaption = valueEl.getAttribute('value') || valueEl.textContent || '';
                    break;
                }
            }
        }

        return {
            content,
            buttonCaption: buttonCaption || 'Show Feedback',
        };
    }

    // ========================================
    // Content Decoding & Transformation
    // ========================================

    /**
     * Decode HTML content from legacy XML format
     *
     * @param content - Encoded HTML content
     * @returns Decoded HTML
     */
    decodeHtmlContent(content: string): string {
        if (!content) return '';
        // 1. Decode basic HTML entities
        const decodedContent = content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, '\u00A0'); // see point 3 below

        // 2. Generate a unique and safe placeholder token to avoid collisions
        let token: string;
        do {
            token = `\u0000LTX${Math.random().toString(36).slice(2)}\u0000`;
        } while (decodedContent.includes(token));

        // 3. Robust LaTeX pattern.
        const latexPattern =
            /\\\((?:[^\\]|\\.)*?\\\)|\\\[(?:[^\\]|\\.)*?\\\]|\\begin\{[^}]+\}(?:[^\\]|\\.)*?\\end\{[^}]+\}|\$\$(?:[^$]|\\.)*?\$\$|(?<!\\)\$(?!\d+(?:[.,]\d+)?\b)(?:[^$\\]|\\.)*?(?<!\\)\$/g;
        const latexBlocks: string[] = [];
        const protectedContent = decodedContent.replace(latexPattern, match => {
            latexBlocks.push(match);
            return `${token}${latexBlocks.length - 1}${token}`;
        });

        // 4. Decode Python-style escape sequences.
        // \n and \t are decoded unconditionally: LaTeX commands using these
        // letters (\nabla, \times) are already safe thanks to the block-level
        // protection in step 3. \r keeps its lookahead as a safety net for
        // LaTeX commands like \right that appear WITHOUT any recognised
        // delimiter around them (see the bare "\left( x \right)" regression
        // test), and are therefore not covered by step 3.
        const finalDecoded = protectedContent
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r(?![a-zA-Z])/g, '\r');

        // 5. Restore the original LaTeX blocks untouched
        const tokenPattern = new RegExp(`${token}(\\d+)${token}`, 'g');
        return finalDecoded.replace(tokenPattern, (_, i) => latexBlocks[Number(i)]);
    }

    /**
     * Remove legacy outer wrapper <div class="exe-text">...</div> when present.
     * The removal is conservative: only strips when the whole HTML is wrapped.
     *
     * @param html - HTML content
     * @returns HTML without the outer legacy wrapper
     */
    protected stripLegacyExeTextWrapper(html: string): string {
        return stripLegacyExeTextWrapper(html);
    }

    /**
     * Strip HTML tags from content, returning plain text.
     * Matches Symfony's strip_tags() behavior for legacy imports.
     *
     * Uses regex instead of DOM parsing to work in both browser and Node.js.
     *
     * @param html - HTML content to strip
     * @returns Plain text content
     */
    stripHtmlTags(html: string): string {
        if (!html) return '';

        // Use regex to strip HTML tags (works in both environments)
        const text = html
            // Remove script and style content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Decode common HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            // Collapse whitespace
            .replace(/\s+/g, ' ');

        return text.trim();
    }

    /**
     * Escape HTML special characters for attribute values
     *
     * @param str - String to escape
     * @returns Escaped string safe for HTML attributes
     */
    escapeHtmlAttr(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Escape HTML entities for safe insertion
     *
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ========================================
    // Common Field Extraction Patterns
    // ========================================

    /**
     * Extract content from "fields" list (JsIdevice format)
     *
     * The `fields` list is the authoritative source of an iDevice's content. It may
     * hold inline `<instance>` fields and/or `<reference key="N">` back-pointers to
     * fields serialized elsewhere in the document, so both must be resolved. When a
     * reference resolver is available (via `context.resolveReference`) the referenced
     * field is read too; otherwise references are skipped. See issue #2159.
     *
     * @param dict - Dictionary element
     * @param context - Optional handler context providing the reference resolver
     * @returns Combined content from text fields
     */
    extractFieldsContent(dict: Element, context?: IdeviceHandlerContext): string {
        const children = this.getChildElements(dict);

        // Find "fields" key and its list
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'fields'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    const contents: string[] = [];
                    const fieldInstances = resolveFieldInstances(listEl, context?.resolveReference);
                    for (const fieldInst of fieldInstances) {
                        const fieldClass = fieldInst.getAttribute('class') || '';
                        if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
                            const content = this.extractTextAreaFieldContent(fieldInst);
                            if (content) {
                                contents.push(content);
                            }
                        }
                    }
                    return contents.join('\n');
                }
                break;
            }
        }

        return '';
    }

    /**
     * Extract rich text content from a dictionary field
     *
     * @param dict - Dictionary element
     * @param fieldName - Field name to look for
     * @returns Content or empty string
     */
    extractRichTextContent(dict: Element, fieldName: string): string {
        const children = this.getChildElements(dict);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === fieldName
            ) {
                const valueEl = children[i + 1];
                if (!valueEl) return '';

                if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
                    return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
                }

                if (valueEl.tagName === 'instance') {
                    return this.extractTextAreaFieldContent(valueEl);
                }
            }
        }

        return '';
    }

    /**
     * Extract content from any TextAreaField or TextField reachable within this
     * iDevice's own object subtree (last-resort fallback).
     *
     * The search is boundary-safe: it never descends into a nested iDevice or Node
     * `<instance>`. In the legacy pickle graph an iDevice inlines its own
     * `_idevice` / `parentNode` / `parent` back-references as full `<instance>`
     * elements, so an unbounded descendant search would cross into a *different*
     * iDevice and return its content. Honouring the iDevice/Node boundary keeps the
     * fallback scoped to the current iDevice. See issue #2159.
     *
     * @param dict - Dictionary element of the current iDevice
     * @returns Content or empty string
     */
    extractAnyTextFieldContent(dict: Element): string {
        return this.findBoundedTextFieldContent(dict);
    }

    /**
     * Depth-first search for a TextAreaField/TextField instance that stays inside
     * the current iDevice's own subtree (does not cross iDevice/Node boundaries).
     *
     * @param element - Element to search within
     * @returns Content of the first matching field, or empty string
     */
    private findBoundedTextFieldContent(element: Element): string {
        const children = this.getChildElements(element);
        for (const child of children) {
            if (child.tagName === 'instance') {
                const className = child.getAttribute('class') || '';
                if (className.includes('TextAreaField') || className.includes('TextField')) {
                    const content = this.extractTextAreaFieldContent(child);
                    if (content) {
                        return content;
                    }
                    // Field matched but empty: no need to descend into its dictionary.
                    continue;
                }
                // Never cross into a nested iDevice or Node; that content belongs to a
                // different object reached only via inlined back-references.
                if (this.isIdeviceOrNodeClass(className)) {
                    continue;
                }
            }

            // Recurse into structural containers (dictionary, list) and non-boundary
            // instances (e.g. resources) that may wrap the field.
            const nested = this.findBoundedTextFieldContent(child);
            if (nested) {
                return nested;
            }
        }

        return '';
    }

    /**
     * Whether a legacy class name denotes an iDevice or a Node (a content boundary).
     *
     * @param className - Legacy class attribute value
     * @returns true for iDevice / Node classes
     */
    private isIdeviceOrNodeClass(className: string): boolean {
        const lower = className.toLowerCase();
        return lower.includes('idevice') || lower.includes('.node.node') || lower.endsWith('.node');
    }

    /**
     * Extract resource path from dictionary
     * Used for extracting file paths from resource instances
     *
     * @param dict - Dictionary element
     * @param key - Key name
     * @returns Resource path or null
     */
    extractResourcePath(dict: Element, key: string): string | null {
        // Look for resource instance
        const resourceInst = this.findDictInstance(dict, key);
        if (!resourceInst) return null;

        const resourceDict = this.getDirectChildByTagName(resourceInst, 'dictionary');
        if (!resourceDict) return null;

        // Get storageName or fileName
        const storageName =
            this.findDictStringValue(resourceDict, '_storageName') ||
            this.findDictStringValue(resourceDict, 'storageName') ||
            this.findDictStringValue(resourceDict, '_fileName') ||
            this.findDictStringValue(resourceDict, 'fileName');

        return storageName || null;
    }
}
