/**
 * XML validation and comparison utilities for export tests
 */

import * as fs from 'fs-extra';

/**
 * XML validation result
 */
export interface XmlValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * XML comparison options
 */
export interface XmlCompareOptions {
    /** Ignore attribute order differences */
    ignoreAttributeOrder?: boolean;
    /** Ignore whitespace differences */
    ignoreWhitespace?: boolean;
    /** Attributes to ignore when comparing (e.g., timestamps, IDs) */
    ignoreAttributes?: string[];
    /** Elements to ignore when comparing */
    ignoreElements?: string[];
    /** Patterns for attribute values to normalize (e.g., dates) */
    normalizePatterns?: { pattern: RegExp; replacement: string }[];
}

/**
 * XML comparison result
 */
export interface XmlCompareResult {
    match: boolean;
    differences: string[];
}

/**
 * Validate basic XML structure
 * Checks for well-formed XML without external schema validation
 * @param xml XML string to validate
 * @returns Validation result
 */
export function validateXmlStructure(xml: string): XmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for XML declaration
    if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
        errors.push('XML does not start with declaration or root element');
    }

    // Check for balanced tags using a simple stack approach
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z_:][\w:.-]*)[^>]*\/?>/g;
    const selfClosingRegex = /\/\s*>$/;

    let match;
    while ((match = tagRegex.exec(xml)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];

        // Skip processing instructions, comments, and CDATA
        if (fullTag.startsWith('<?') || fullTag.startsWith('<!')) {
            continue;
        }

        // Self-closing tag
        if (selfClosingRegex.test(fullTag)) {
            continue;
        }

        // Closing tag
        if (fullTag.startsWith('</')) {
            if (tagStack.length === 0) {
                errors.push(`Unexpected closing tag: </${tagName}>`);
            } else if (tagStack[tagStack.length - 1] !== tagName) {
                errors.push(`Mismatched tags: expected </${tagStack[tagStack.length - 1]}>, found </${tagName}>`);
            } else {
                tagStack.pop();
            }
        } else {
            // Opening tag
            tagStack.push(tagName);
        }
    }

    // Check for unclosed tags
    if (tagStack.length > 0) {
        errors.push(`Unclosed tags: ${tagStack.join(', ')}`);
    }

    // Check for common XML issues
    if (xml.includes('&&') && !xml.includes('&amp;&amp;')) {
        warnings.push('Possible unescaped ampersand detected');
    }

    if (/<[^>]*</.test(xml)) {
        errors.push('Possible nested tag or unescaped < character');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate XML file from disk
 * @param filePath Path to XML file
 * @returns Validation result
 */
export async function validateXmlFile(filePath: string): Promise<XmlValidationResult> {
    if (!(await fs.pathExists(filePath))) {
        return {
            valid: false,
            errors: [`File not found: ${filePath}`],
            warnings: [],
        };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return validateXmlStructure(content);
}

/**
 * Normalize XML for comparison
 * @param xml XML string
 * @param options Normalization options
 * @returns Normalized XML string
 */
export function normalizeXml(xml: string, options: XmlCompareOptions = {}): string {
    let normalized = xml;

    // Remove XML declaration for comparison
    normalized = normalized.replace(/<\?xml[^?]*\?>\s*/g, '');

    // Normalize whitespace if requested
    if (options.ignoreWhitespace !== false) {
        // Collapse multiple whitespace to single space
        normalized = normalized.replace(/>\s+</g, '><');
        // Remove leading/trailing whitespace from text content
        normalized = normalized.replace(/>\s+/g, '>').replace(/\s+</g, '<');
    }

    // Remove ignored attributes
    if (options.ignoreAttributes?.length) {
        for (const attr of options.ignoreAttributes) {
            // Remove attribute from tags
            const attrRegex = new RegExp(`\\s+${attr}\\s*=\\s*"[^"]*"`, 'g');
            normalized = normalized.replace(attrRegex, '');
            const attrRegexSingle = new RegExp(`\\s+${attr}\\s*=\\s*'[^']*'`, 'g');
            normalized = normalized.replace(attrRegexSingle, '');
        }
    }

    // Remove ignored elements
    if (options.ignoreElements?.length) {
        for (const elem of options.ignoreElements) {
            // Remove element with content
            const elemRegex = new RegExp(`<${elem}[^>]*>.*?</${elem}>`, 'gs');
            normalized = normalized.replace(elemRegex, '');
            // Remove self-closing element
            const selfClosingRegex = new RegExp(`<${elem}[^>]*/\\s*>`, 'g');
            normalized = normalized.replace(selfClosingRegex, '');
        }
    }

    // Apply normalization patterns
    if (options.normalizePatterns?.length) {
        for (const { pattern, replacement } of options.normalizePatterns) {
            normalized = normalized.replace(pattern, replacement);
        }
    }

    return normalized.trim();
}

/**
 * Compare two XML strings
 * @param actual Actual XML
 * @param expected Expected XML
 * @param options Comparison options
 * @returns Comparison result
 */
export function compareXml(actual: string, expected: string, options: XmlCompareOptions = {}): XmlCompareResult {
    const normalizedActual = normalizeXml(actual, options);
    const normalizedExpected = normalizeXml(expected, options);

    if (normalizedActual === normalizedExpected) {
        return { match: true, differences: [] };
    }

    // Find differences
    const differences: string[] = [];

    // Simple line-by-line comparison for basic difference reporting
    const actualLines = normalizedActual.split(/(?=<)/);
    const expectedLines = normalizedExpected.split(/(?=<)/);

    const maxLines = Math.max(actualLines.length, expectedLines.length);

    for (let i = 0; i < maxLines; i++) {
        const actualLine = actualLines[i] || '';
        const expectedLine = expectedLines[i] || '';

        if (actualLine !== expectedLine) {
            if (!actualLine) {
                differences.push(`Missing element at position ${i}: ${expectedLine.substring(0, 100)}`);
            } else if (!expectedLine) {
                differences.push(`Extra element at position ${i}: ${actualLine.substring(0, 100)}`);
            } else {
                differences.push(
                    `Difference at position ${i}:\n  Expected: ${expectedLine.substring(0, 100)}\n  Actual: ${actualLine.substring(0, 100)}`,
                );
            }

            // Limit the number of differences reported
            if (differences.length >= 10) {
                differences.push('... (more differences truncated)');
                break;
            }
        }
    }

    return { match: false, differences };
}

/**
 * Compare two XML files
 * @param actualPath Path to actual XML file
 * @param expectedPath Path to expected XML file
 * @param options Comparison options
 * @returns Comparison result
 */
export async function compareXmlFiles(
    actualPath: string,
    expectedPath: string,
    options: XmlCompareOptions = {},
): Promise<XmlCompareResult> {
    if (!(await fs.pathExists(actualPath))) {
        return {
            match: false,
            differences: [`Actual file not found: ${actualPath}`],
        };
    }

    if (!(await fs.pathExists(expectedPath))) {
        return {
            match: false,
            differences: [`Expected file not found: ${expectedPath}`],
        };
    }

    const actualContent = await fs.readFile(actualPath, 'utf-8');
    const expectedContent = await fs.readFile(expectedPath, 'utf-8');

    return compareXml(actualContent, expectedContent, options);
}

/**
 * Extract element content from XML
 * @param xml XML string
 * @param elementName Element name to extract
 * @returns Array of element contents
 */
export function extractElements(xml: string, elementName: string): string[] {
    const elements: string[] = [];
    const regex = new RegExp(`<${elementName}[^>]*>([\\s\\S]*?)</${elementName}>`, 'g');

    let match;
    while ((match = regex.exec(xml)) !== null) {
        elements.push(match[1]);
    }

    return elements;
}

/**
 * Extract attribute value from XML
 * @param xml XML string
 * @param elementName Element name
 * @param attributeName Attribute name
 * @returns Array of attribute values
 */
export function extractAttributeValues(xml: string, elementName: string, attributeName: string): string[] {
    const values: string[] = [];
    const regex = new RegExp(`<${elementName}[^>]*\\s${attributeName}\\s*=\\s*["']([^"']*)["'][^>]*>`, 'g');

    let match;
    while ((match = regex.exec(xml)) !== null) {
        values.push(match[1]);
    }

    return values;
}

/**
 * Check if XML contains required elements
 * @param xml XML string
 * @param requiredElements Array of required element names
 * @returns Object with found and missing elements
 */
export function checkRequiredElements(xml: string, requiredElements: string[]): { found: string[]; missing: string[] } {
    const found: string[] = [];
    const missing: string[] = [];

    for (const element of requiredElements) {
        const regex = new RegExp(`<${element}[\\s>/]`, 'i');
        if (regex.test(xml)) {
            found.push(element);
        } else {
            missing.push(element);
        }
    }

    return { found, missing };
}

/**
 * Validate SCORM manifest structure
 * @param xml imsmanifest.xml content
 * @returns Validation result
 */
export function validateScormManifest(xml: string): XmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    const basicValidation = validateXmlStructure(xml);
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Required SCORM elements
    const requiredElements = ['manifest', 'metadata', 'organizations', 'organization', 'resources'];

    const { missing } = checkRequiredElements(xml, requiredElements);
    if (missing.length > 0) {
        errors.push(`Missing required SCORM elements: ${missing.join(', ')}`);
    }

    // Check for identifier attribute on manifest
    if (!/<manifest[^>]*identifier\s*=/.test(xml)) {
        errors.push('Missing identifier attribute on manifest element');
    }

    // Check for at least one resource
    if (!/<resource\s/.test(xml)) {
        warnings.push('No resources defined in manifest');
    }

    // Check for at least one item
    if (!/<item\s/.test(xml)) {
        warnings.push('No items defined in organization');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate IMS manifest structure
 * @param xml imsmanifest.xml content
 * @returns Validation result
 */
export function validateImsManifest(xml: string): XmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    const basicValidation = validateXmlStructure(xml);
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Required IMS elements (similar to SCORM but without SCORM-specific)
    const requiredElements = ['manifest', 'organizations', 'resources'];

    const { missing } = checkRequiredElements(xml, requiredElements);
    if (missing.length > 0) {
        errors.push(`Missing required IMS elements: ${missing.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate EPUB package.opf structure
 * @param xml package.opf content
 * @returns Validation result
 */
export function validateEpubPackage(xml: string): XmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    const basicValidation = validateXmlStructure(xml);
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Required EPUB package elements
    const requiredElements = ['package', 'metadata', 'manifest', 'spine'];

    const { missing } = checkRequiredElements(xml, requiredElements);
    if (missing.length > 0) {
        errors.push(`Missing required EPUB elements: ${missing.join(', ')}`);
    }

    // Check for dc:title in metadata
    if (!/<dc:title/.test(xml)) {
        errors.push('Missing dc:title in metadata');
    }

    // Check for dc:identifier in metadata
    if (!/<dc:identifier/.test(xml)) {
        errors.push('Missing dc:identifier in metadata');
    }

    // Check for at least one item in manifest
    if (!/<item\s/.test(xml)) {
        errors.push('No items defined in manifest');
    }

    // Check for at least one itemref in spine
    if (!/<itemref\s/.test(xml)) {
        errors.push('No itemrefs defined in spine');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Default options for comparing manifest files (ignoring timestamps and IDs)
 */
export const MANIFEST_COMPARE_OPTIONS: XmlCompareOptions = {
    ignoreWhitespace: true,
    ignoreAttributes: ['identifier', 'timestamp', 'date'],
    normalizePatterns: [
        // Normalize date-time patterns
        { pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, replacement: 'DATETIME' },
        // Normalize timestamps in IDs
        { pattern: /\d{14}[A-Z]{6}/g, replacement: 'TIMESTAMP_ID' },
        // Normalize UUID patterns
        {
            pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            replacement: 'UUID',
        },
    ],
};
