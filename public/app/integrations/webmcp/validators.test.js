import { describe, expect, it } from 'vitest';
import {
    base64ToUint8Array,
    buildPicsumImageUrl,
    clampNumber,
    createFileFromBlob,
    createFileFromBytes,
    detectDataUrlMimeType,
    detectMimeType,
    encodeLegacyText,
    escapeHtml,
    extensionFromMimeType,
    filenameFromImageUrl,
    generateLocalId,
    generateOdeId,
    getFileExtension,
    getMissingRequiredMetadataFields,
    isTextIdeviceComponent,
    isTextIdeviceType,
    mergeHtmlContent,
    normalizeCssSize,
    normalizeImageAlign,
    normalizeInsertPosition,
    normalizeJsonPropertiesForStorage,
    normalizeMetadataValue,
    normalizeQuestionHtml,
    optionalBoolean,
    optionalNumber,
    optionalString,
    parseArrayValue,
    parseJsonObject,
    parseOptionalNumberArray,
    requireAssetUuidUrl,
    requireDataUrl,
    requireHttpImageUrl,
    requireString,
    resolveImageUrlFromInput,
    sanitizeFilename,
    tryParseHttpImageUrl,
    wrapResult,
} from './validators.js';

// ---------------------------------------------------------------------------
// requireString
// ---------------------------------------------------------------------------

describe('requireString', () => {
    it('returns the value when it is a non-empty string', () => {
        expect(requireString('hello', 'field')).toBe('hello');
    });

    it('trims the returned value', () => {
        expect(requireString('  hi  ', 'field')).toBe('hi');
    });

    it('throws when value is an empty string', () => {
        expect(() => requireString('', 'name')).toThrow('name is required');
    });

    it('throws when value is whitespace only', () => {
        expect(() => requireString('   ', 'name')).toThrow('name is required');
    });

    it('throws when value is not a string', () => {
        expect(() => requireString(42, 'num')).toThrow('num is required');
        expect(() => requireString(null, 'x')).toThrow('x is required');
        expect(() => requireString(undefined, 'x')).toThrow('x is required');
    });
});

// ---------------------------------------------------------------------------
// optionalString
// ---------------------------------------------------------------------------

describe('optionalString', () => {
    it('returns trimmed string for non-empty string input', () => {
        expect(optionalString('  hello  ')).toBe('hello');
    });

    it('returns null for empty string', () => {
        expect(optionalString('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
        expect(optionalString('   ')).toBeNull();
    });

    it('returns null for non-string values', () => {
        expect(optionalString(42)).toBeNull();
        expect(optionalString(null)).toBeNull();
        expect(optionalString(undefined)).toBeNull();
        expect(optionalString([])).toBeNull();
        expect(optionalString({})).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// optionalNumber
// ---------------------------------------------------------------------------

describe('optionalNumber', () => {
    it('returns the number for finite number input', () => {
        expect(optionalNumber(3.14)).toBe(3.14);
        expect(optionalNumber(0)).toBe(0);
    });

    it('returns null for non-finite numbers', () => {
        expect(optionalNumber(Infinity)).toBeNull();
        expect(optionalNumber(NaN)).toBeNull();
    });

    it('parses numeric strings', () => {
        expect(optionalNumber('42')).toBe(42);
        expect(optionalNumber('3.14')).toBe(3.14);
        expect(optionalNumber(' 7 ')).toBe(7);
    });

    it('returns null for non-numeric strings', () => {
        expect(optionalNumber('abc')).toBeNull();
        expect(optionalNumber('')).toBeNull();
    });

    it('returns null for non-number, non-string values', () => {
        expect(optionalNumber(null)).toBeNull();
        expect(optionalNumber(undefined)).toBeNull();
        expect(optionalNumber({})).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// optionalBoolean
// ---------------------------------------------------------------------------

describe('optionalBoolean', () => {
    it('returns boolean values directly', () => {
        expect(optionalBoolean(true)).toBe(true);
        expect(optionalBoolean(false)).toBe(false);
    });

    it('parses truthy string variants', () => {
        expect(optionalBoolean('true')).toBe(true);
        expect(optionalBoolean('TRUE')).toBe(true);
        expect(optionalBoolean('1')).toBe(true);
        expect(optionalBoolean('yes')).toBe(true);
        expect(optionalBoolean('YES')).toBe(true);
    });

    it('parses falsy string variants', () => {
        expect(optionalBoolean('false')).toBe(false);
        expect(optionalBoolean('FALSE')).toBe(false);
        expect(optionalBoolean('0')).toBe(false);
        expect(optionalBoolean('no')).toBe(false);
        expect(optionalBoolean('NO')).toBe(false);
    });

    it('returns defaultValue for unrecognised strings', () => {
        expect(optionalBoolean('maybe', false)).toBe(false);
        expect(optionalBoolean('maybe', true)).toBe(true);
    });

    it('returns defaultValue for non-string, non-boolean values', () => {
        expect(optionalBoolean(null, false)).toBe(false);
        expect(optionalBoolean(undefined, true)).toBe(true);
        expect(optionalBoolean(42, false)).toBe(false);
    });

    it('defaults to false when defaultValue is not provided', () => {
        expect(optionalBoolean(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// normalizeMetadataValue
// ---------------------------------------------------------------------------

describe('normalizeMetadataValue', () => {
    it('trims string values', () => {
        expect(normalizeMetadataValue('  hello  ')).toBe('hello');
    });

    it('returns empty string for non-string values', () => {
        expect(normalizeMetadataValue(null)).toBe('');
        expect(normalizeMetadataValue(undefined)).toBe('');
        expect(normalizeMetadataValue(42)).toBe('');
        expect(normalizeMetadataValue({})).toBe('');
    });
});

// ---------------------------------------------------------------------------
// getMissingRequiredMetadataFields
// ---------------------------------------------------------------------------

describe('getMissingRequiredMetadataFields', () => {
    it('returns empty array when all required fields are present', () => {
        expect(getMissingRequiredMetadataFields({ title: 'T', author: 'A', description: 'D' })).toEqual([]);
    });

    it('reports missing title', () => {
        expect(getMissingRequiredMetadataFields({ title: '', author: 'A', description: 'D' })).toContain('title');
    });

    it('reports missing author', () => {
        expect(getMissingRequiredMetadataFields({ title: 'T', author: '', description: 'D' })).toContain('author');
    });

    it('reports missing description', () => {
        expect(getMissingRequiredMetadataFields({ title: 'T', author: 'A', description: '' })).toContain('description');
    });

    it('reports all missing fields', () => {
        const result = getMissingRequiredMetadataFields({ title: '', author: '', description: '' });
        expect(result).toEqual(['title', 'author', 'description']);
    });
});

// ---------------------------------------------------------------------------
// clampNumber
// ---------------------------------------------------------------------------

describe('clampNumber', () => {
    it('returns the value when within bounds', () => {
        expect(clampNumber(5, 0, 10, 0)).toBe(5);
    });

    it('clamps to min when value is below min', () => {
        expect(clampNumber(-5, 0, 10, 0)).toBe(0);
    });

    it('clamps to max when value is above max', () => {
        expect(clampNumber(15, 0, 10, 0)).toBe(10);
    });

    it('returns defaultValue for non-finite input', () => {
        expect(clampNumber(NaN, 0, 10, 99)).toBe(99);
        expect(clampNumber(Infinity, 0, 10, 99)).toBe(99);
        expect(clampNumber(null, 0, 10, 99)).toBe(99);
    });

    it('handles boundary values exactly', () => {
        expect(clampNumber(0, 0, 10, 5)).toBe(0);
        expect(clampNumber(10, 0, 10, 5)).toBe(10);
    });
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less-than', () => {
        expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater-than', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes all entities in a combined string', () => {
        expect(escapeHtml('a & <b> "c" \'d\'')).toBe('a &amp; &lt;b&gt; &quot;c&quot; &#39;d&#39;');
    });

    it('coerces non-string values to string', () => {
        expect(escapeHtml(42)).toBe('42');
        expect(escapeHtml(null)).toBe('null');
    });
});

// ---------------------------------------------------------------------------
// tryParseHttpImageUrl
// ---------------------------------------------------------------------------

describe('tryParseHttpImageUrl', () => {
    it('accepts http URLs', () => {
        expect(tryParseHttpImageUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
    });

    it('accepts https URLs', () => {
        expect(tryParseHttpImageUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
    });

    it('rejects ftp protocol', () => {
        expect(tryParseHttpImageUrl('ftp://example.com/img.png')).toBeNull();
    });

    it('rejects data URLs', () => {
        expect(tryParseHttpImageUrl('data:image/png;base64,abc')).toBeNull();
    });

    it('rejects blob URLs', () => {
        expect(tryParseHttpImageUrl('blob:https://example.com/abc')).toBeNull();
    });

    it('rejects plain strings that are not URLs', () => {
        expect(tryParseHttpImageUrl('not a url')).toBeNull();
    });

    it('rejects empty string', () => {
        expect(tryParseHttpImageUrl('')).toBeNull();
    });

    it('rejects null / non-string values', () => {
        expect(tryParseHttpImageUrl(null)).toBeNull();
        expect(tryParseHttpImageUrl(undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// buildPicsumImageUrl
// ---------------------------------------------------------------------------

describe('buildPicsumImageUrl', () => {
    it('builds a picsum URL with the given seed and dimensions', () => {
        const url = buildPicsumImageUrl('myseed', 640, 480);
        expect(url).toBe('https://picsum.photos/seed/myseed/640/480');
    });

    it('URL-encodes the seed', () => {
        const url = buildPicsumImageUrl('my seed/test', 100, 100);
        expect(url).toContain('my%20seed%2Ftest');
    });

    it('clamps width to [64, 4096] with default 1280', () => {
        expect(buildPicsumImageUrl('s', 0, 720)).toContain('/64/');
        expect(buildPicsumImageUrl('s', 9999, 720)).toContain('/4096/');
        expect(buildPicsumImageUrl('s', null, 720)).toContain('/1280/');
    });

    it('clamps height to [64, 4096] with default 720', () => {
        expect(buildPicsumImageUrl('s', 640, 0)).toMatch(/\/64$/);
        expect(buildPicsumImageUrl('s', 640, 9999)).toMatch(/\/4096$/);
        expect(buildPicsumImageUrl('s', 640, null)).toMatch(/\/720$/);
    });

    it('uses a fallback seed when seed is empty or null', () => {
        const url = buildPicsumImageUrl(null, 640, 480);
        expect(url).toMatch(/^https:\/\/picsum\.photos\/seed\/img-\d+\/640\/480$/);
    });
});

// ---------------------------------------------------------------------------
// normalizeInsertPosition
// ---------------------------------------------------------------------------

describe('normalizeInsertPosition', () => {
    it('returns append for "append"', () => {
        expect(normalizeInsertPosition('append')).toBe('append');
    });

    it('returns append for "after"', () => {
        expect(normalizeInsertPosition('after')).toBe('append');
    });

    it('returns prepend for "prepend"', () => {
        expect(normalizeInsertPosition('prepend')).toBe('prepend');
    });

    it('returns prepend for "before"', () => {
        expect(normalizeInsertPosition('before')).toBe('prepend');
    });

    it('returns replace for "replace"', () => {
        expect(normalizeInsertPosition('replace')).toBe('replace');
    });

    it('is case-insensitive', () => {
        expect(normalizeInsertPosition('APPEND')).toBe('append');
        expect(normalizeInsertPosition('Prepend')).toBe('prepend');
    });

    it('defaults to append for null / undefined / empty', () => {
        expect(normalizeInsertPosition(null)).toBe('append');
        expect(normalizeInsertPosition(undefined)).toBe('append');
        expect(normalizeInsertPosition('')).toBe('append');
    });

    it('throws for unrecognised values', () => {
        expect(() => normalizeInsertPosition('middle')).toThrow('position must be');
    });
});

// ---------------------------------------------------------------------------
// mergeHtmlContent
// ---------------------------------------------------------------------------

describe('mergeHtmlContent', () => {
    it('appends fragment to currentHtml for append position', () => {
        expect(mergeHtmlContent('<p>A</p>', '<p>B</p>', 'append')).toBe('<p>A</p><p>B</p>');
    });

    it('prepends fragment before currentHtml for prepend position', () => {
        expect(mergeHtmlContent('<p>A</p>', '<p>B</p>', 'prepend')).toBe('<p>B</p><p>A</p>');
    });

    it('replaces currentHtml entirely for replace position', () => {
        expect(mergeHtmlContent('<p>A</p>', '<p>B</p>', 'replace')).toBe('<p>B</p>');
    });

    it('handles empty currentHtml gracefully', () => {
        expect(mergeHtmlContent('', '<p>B</p>', 'append')).toBe('<p>B</p>');
        expect(mergeHtmlContent(null, '<p>B</p>', 'prepend')).toBe('<p>B</p>');
    });
});

// ---------------------------------------------------------------------------
// base64ToUint8Array
// ---------------------------------------------------------------------------

describe('base64ToUint8Array', () => {
    it('decodes a plain base64 string', () => {
        // "hello" in base64 is "aGVsbG8="
        const result = base64ToUint8Array('aGVsbG8=');
        expect(result).toBeInstanceOf(Uint8Array);
        expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]); // "hello"
    });

    it('strips the data URL prefix before decoding', () => {
        const result = base64ToUint8Array('data:text/plain;base64,aGVsbG8=');
        expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
    });

    it('returns a Uint8Array of the correct length', () => {
        const result = base64ToUint8Array('aGVsbG8=');
        expect(result.length).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// wrapResult
// ---------------------------------------------------------------------------

describe('wrapResult', () => {
    it('returns the MCP content envelope shape', () => {
        const result = wrapResult({ ok: true });
        expect(result).toEqual({
            content: [{ type: 'text', text: expect.any(String) }],
        });
    });

    it('serialises the payload as pretty-printed JSON', () => {
        const result = wrapResult({ value: 42, name: 'test' });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual({ value: 42, name: 'test' });
        // Ensure pretty-printed (has newlines)
        expect(result.content[0].text).toContain('\n');
    });

    it('handles nested objects and arrays', () => {
        const payload = { pages: [{ id: '1', name: 'Page 1' }] };
        const result = wrapResult(payload);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.pages[0].name).toBe('Page 1');
    });

    it('handles null payload', () => {
        const result = wrapResult(null);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// normalizeJsonPropertiesForStorage
// ---------------------------------------------------------------------------

describe('normalizeJsonPropertiesForStorage', () => {
    it('returns "{}" for null', () => {
        expect(normalizeJsonPropertiesForStorage(null)).toBe('{}');
    });

    it('returns "{}" for undefined', () => {
        expect(normalizeJsonPropertiesForStorage(undefined)).toBe('{}');
    });

    it('returns "{}" for empty string', () => {
        expect(normalizeJsonPropertiesForStorage('')).toBe('{}');
    });

    it('returns serialised JSON for a plain object', () => {
        const result = normalizeJsonPropertiesForStorage({ a: 1 });
        expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('parses and re-serialises a valid JSON object string', () => {
        const result = normalizeJsonPropertiesForStorage('{"x":2}');
        expect(JSON.parse(result)).toEqual({ x: 2 });
    });

    it('throws when value is an array', () => {
        expect(() => normalizeJsonPropertiesForStorage([1, 2])).toThrow('must be a JSON object');
    });

    it('throws when value is a JSON array string', () => {
        expect(() => normalizeJsonPropertiesForStorage('[1,2]')).toThrow('must be a JSON object');
    });

    it('throws when value is invalid JSON string', () => {
        expect(() => normalizeJsonPropertiesForStorage('not json')).toThrow('is not valid JSON');
    });

    it('throws for a number value', () => {
        expect(() => normalizeJsonPropertiesForStorage(42)).toThrow('must be a JSON object or JSON string');
    });

    it('uses default fieldName in error message', () => {
        expect(() => normalizeJsonPropertiesForStorage(42)).toThrow('jsonProperties');
    });

    it('uses custom fieldName in error message', () => {
        expect(() => normalizeJsonPropertiesForStorage(42, 'myField')).toThrow('myField');
    });
});

// ---------------------------------------------------------------------------
// parseJsonObject
// ---------------------------------------------------------------------------

describe('parseJsonObject', () => {
    it('returns {} for falsy values', () => {
        expect(parseJsonObject(null)).toEqual({});
        expect(parseJsonObject(undefined)).toEqual({});
        expect(parseJsonObject('')).toEqual({});
        expect(parseJsonObject(0)).toEqual({});
    });

    it('returns a shallow copy of a plain object', () => {
        const input = { a: 1 };
        const result = parseJsonObject(input);
        expect(result).toEqual({ a: 1 });
        expect(result).not.toBe(input);
    });

    it('throws when value is an array', () => {
        expect(() => parseJsonObject([1, 2])).toThrow('must be a JSON object');
    });

    it('parses a valid JSON object string', () => {
        expect(parseJsonObject('{"key":"val"}')).toEqual({ key: 'val' });
    });

    it('throws for a JSON array string', () => {
        // parseJsonObject catches the inner throw and re-throws as "not valid JSON"
        expect(() => parseJsonObject('[1,2]')).toThrow('jsonProperties');
    });

    it('throws for invalid JSON string', () => {
        expect(() => parseJsonObject('bad json')).toThrow('is not valid JSON');
    });

    it('uses custom fieldName in error message', () => {
        expect(() => parseJsonObject([1], 'options')).toThrow('options');
    });
});

// ---------------------------------------------------------------------------
// parseArrayValue
// ---------------------------------------------------------------------------

describe('parseArrayValue', () => {
    it('returns an array directly when passed an array', () => {
        expect(parseArrayValue([1, 2, 3], 'items')).toEqual([1, 2, 3]);
    });

    it('parses a JSON array string', () => {
        expect(parseArrayValue('[1,2,3]', 'items')).toEqual([1, 2, 3]);
    });

    it('throws for a plain non-array string', () => {
        expect(() => parseArrayValue('hello', 'items')).toThrow('items must be an array');
    });

    it('throws for null', () => {
        expect(() => parseArrayValue(null, 'items')).toThrow('items must be an array');
    });

    it('throws for a JSON object string', () => {
        expect(() => parseArrayValue('{"a":1}', 'items')).toThrow('items must be an array');
    });

    it('throws for a number', () => {
        expect(() => parseArrayValue(42, 'items')).toThrow('items must be an array');
    });
});

// ---------------------------------------------------------------------------
// requireHttpImageUrl
// ---------------------------------------------------------------------------

describe('requireHttpImageUrl', () => {
    it('returns the URL for a valid http URL', () => {
        expect(requireHttpImageUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
    });

    it('returns the URL for a valid https URL', () => {
        expect(requireHttpImageUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
    });

    it('throws for a non-http URL', () => {
        expect(() => requireHttpImageUrl('ftp://example.com/img.png')).toThrow(
            'imageUrl must be a valid absolute URL (http/https)',
        );
    });

    it('throws for a plain string', () => {
        expect(() => requireHttpImageUrl('not a url')).toThrow('imageUrl must be a valid absolute URL (http/https)');
    });

    it('throws for null', () => {
        expect(() => requireHttpImageUrl(null)).toThrow('imageUrl must be a valid absolute URL (http/https)');
    });
});

// ---------------------------------------------------------------------------
// resolveImageUrlFromInput
// ---------------------------------------------------------------------------

describe('resolveImageUrlFromInput', () => {
    it('returns the URL directly for a valid http URL', () => {
        expect(resolveImageUrlFromInput('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    });

    it('throws for a non-URL string without allowTextAsPicsumSeed', () => {
        expect(() => resolveImageUrlFromInput('my photo')).toThrow(
            'imageUrl must be a valid absolute URL (http/https)',
        );
    });

    it('builds a picsum URL when allowTextAsPicsumSeed is true and value is plain text', () => {
        const result = resolveImageUrlFromInput('my-seed', { allowTextAsPicsumSeed: true });
        expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/my-seed\//);
    });

    it('uses picsumSeed when value is absent', () => {
        const result = resolveImageUrlFromInput(null, { picsumSeed: 'test-seed' });
        expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/test-seed\//);
    });

    it('throws when value is absent and no picsumSeed provided', () => {
        expect(() => resolveImageUrlFromInput(null, {})).toThrow('imageUrl is required');
    });

    it('respects picsumWidth and picsumHeight options', () => {
        const result = resolveImageUrlFromInput(null, { picsumSeed: 'seed', picsumWidth: 200, picsumHeight: 150 });
        expect(result).toBe('https://picsum.photos/seed/seed/200/150');
    });
});

// ---------------------------------------------------------------------------
// parseOptionalNumberArray
// ---------------------------------------------------------------------------

describe('parseOptionalNumberArray', () => {
    it('returns integers from a numeric array', () => {
        expect(parseOptionalNumberArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('filters out non-integer numbers', () => {
        expect(parseOptionalNumberArray([1, 2.5, 3])).toEqual([1, 3]);
    });

    it('filters out non-numeric items', () => {
        expect(parseOptionalNumberArray([1, 'a', null, 2])).toEqual([1, 2]);
    });

    it('parses a JSON array string', () => {
        expect(parseOptionalNumberArray('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('returns [] for an invalid JSON string', () => {
        expect(parseOptionalNumberArray('not json')).toEqual([]);
    });

    it('returns [] for null', () => {
        expect(parseOptionalNumberArray(null)).toEqual([]);
    });

    it('returns [] for undefined', () => {
        expect(parseOptionalNumberArray(undefined)).toEqual([]);
    });

    it('returns [] for an empty string', () => {
        expect(parseOptionalNumberArray('')).toEqual([]);
    });

    it('returns [] for a JSON object string', () => {
        expect(parseOptionalNumberArray('{"a":1}')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// normalizeQuestionHtml
// ---------------------------------------------------------------------------

describe('normalizeQuestionHtml', () => {
    it('wraps plain text in <p> tags', () => {
        expect(normalizeQuestionHtml('Hello world', 'q1')).toBe('<p>Hello world</p>');
    });

    it('passes through strings that already contain HTML tags', () => {
        expect(normalizeQuestionHtml('<p>Hello</p>', 'q1')).toBe('<p>Hello</p>');
    });

    it('escapes plain text when wrapping', () => {
        expect(normalizeQuestionHtml('a & b', 'q1')).toBe('<p>a &amp; b</p>');
    });

    it('throws for empty string', () => {
        expect(() => normalizeQuestionHtml('', 'q1')).toThrow('q1.baseText is required');
    });

    it('throws for null', () => {
        expect(() => normalizeQuestionHtml(null, 'question')).toThrow('question.baseText is required');
    });

    it('throws for whitespace-only string', () => {
        expect(() => normalizeQuestionHtml('   ', 'q2')).toThrow('q2.baseText is required');
    });
});

// ---------------------------------------------------------------------------
// detectMimeType
// ---------------------------------------------------------------------------

describe('detectMimeType', () => {
    it('returns image/png for .png files', () => {
        expect(detectMimeType('photo.png')).toBe('image/png');
    });

    it('returns image/jpeg for .jpg files', () => {
        expect(detectMimeType('photo.jpg')).toBe('image/jpeg');
    });

    it('returns image/jpeg for .jpeg files', () => {
        expect(detectMimeType('photo.jpeg')).toBe('image/jpeg');
    });

    it('returns image/webp for .webp files', () => {
        expect(detectMimeType('photo.webp')).toBe('image/webp');
    });

    it('returns image/gif for .gif files', () => {
        expect(detectMimeType('anim.gif')).toBe('image/gif');
    });

    it('returns image/svg+xml for .svg files', () => {
        expect(detectMimeType('icon.svg')).toBe('image/svg+xml');
    });

    it('returns image/avif for .avif files', () => {
        expect(detectMimeType('photo.avif')).toBe('image/avif');
    });

    it('returns application/octet-stream for unknown extensions', () => {
        expect(detectMimeType('file.xyz')).toBe('application/octet-stream');
    });

    it('returns application/octet-stream for files without extension', () => {
        expect(detectMimeType('README')).toBe('application/octet-stream');
    });
});

// ---------------------------------------------------------------------------
// extensionFromMimeType
// ---------------------------------------------------------------------------

describe('extensionFromMimeType', () => {
    it('returns png for image/png', () => {
        expect(extensionFromMimeType('image/png')).toBe('png');
    });

    it('returns jpg for image/jpeg', () => {
        expect(extensionFromMimeType('image/jpeg')).toBe('jpg');
    });

    it('returns webp for image/webp', () => {
        expect(extensionFromMimeType('image/webp')).toBe('webp');
    });

    it('returns svg for image/svg+xml', () => {
        expect(extensionFromMimeType('image/svg+xml')).toBe('svg');
    });

    it('returns empty string for unknown MIME type', () => {
        expect(extensionFromMimeType('application/pdf')).toBe('');
    });

    it('returns empty string for null', () => {
        expect(extensionFromMimeType(null)).toBe('');
    });

    it('is case-insensitive', () => {
        expect(extensionFromMimeType('IMAGE/PNG')).toBe('png');
    });
});

// ---------------------------------------------------------------------------
// getFileExtension
// ---------------------------------------------------------------------------

describe('getFileExtension', () => {
    it('returns the lowercased extension', () => {
        expect(getFileExtension('photo.PNG')).toBe('png');
        expect(getFileExtension('file.jpg')).toBe('jpg');
    });

    it('returns empty string for a file with no extension', () => {
        expect(getFileExtension('README')).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(getFileExtension('')).toBe('');
    });

    it('returns empty string for non-string values', () => {
        expect(getFileExtension(null)).toBe('');
        expect(getFileExtension(undefined)).toBe('');
        expect(getFileExtension(42)).toBe('');
    });

    it('returns the last extension for dotted names', () => {
        expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });
});

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
    it('returns the filename unchanged when safe', () => {
        expect(sanitizeFilename('photo.jpg')).toBe('photo.jpg');
    });

    it('replaces unsafe filesystem characters with hyphens', () => {
        expect(sanitizeFilename('file/name:test*.jpg')).toBe('file-name-test-.jpg');
    });

    it('trims leading/trailing whitespace', () => {
        expect(sanitizeFilename('  photo.jpg  ')).toBe('photo.jpg');
    });

    it('limits the result to 120 characters', () => {
        const long = 'a'.repeat(200);
        expect(sanitizeFilename(long).length).toBe(120);
    });

    it('returns empty string for non-string values', () => {
        expect(sanitizeFilename(null)).toBe('');
        expect(sanitizeFilename(undefined)).toBe('');
        expect(sanitizeFilename(42)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(sanitizeFilename('')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// filenameFromImageUrl
// ---------------------------------------------------------------------------

describe('filenameFromImageUrl', () => {
    it('extracts filename from URL path', () => {
        expect(filenameFromImageUrl('https://example.com/images/photo.jpg')).toBe('photo.jpg');
    });

    it('uses mimeType extension when URL has no extension', () => {
        const result = filenameFromImageUrl('https://example.com/image', 'image/png');
        expect(result).toMatch(/\.png$/);
    });

    it('falls back to png when mimeType is unknown and URL has no extension', () => {
        const result = filenameFromImageUrl('https://example.com/image', '');
        expect(result).toMatch(/\.png$/);
    });

    it('returns a timestamped fallback for invalid URL', () => {
        const result = filenameFromImageUrl('not a url', 'image/jpeg');
        expect(result).toMatch(/^internet-image-\d+\.jpg$/);
    });

    it('decodes percent-encoded filenames', () => {
        // %20 decodes to a space; sanitizeFilename trims but keeps spaces in the middle
        const result = filenameFromImageUrl('https://example.com/my%20photo.jpg');
        expect(result).toBe('my photo.jpg');
    });
});

// ---------------------------------------------------------------------------
// normalizeCssSize
// ---------------------------------------------------------------------------

describe('normalizeCssSize', () => {
    it('appends px for a positive finite number', () => {
        expect(normalizeCssSize(100)).toBe('100px');
        expect(normalizeCssSize(3.5)).toBe('3.5px');
    });

    it('returns empty string for zero or negative numbers', () => {
        expect(normalizeCssSize(0)).toBe('');
        expect(normalizeCssSize(-10)).toBe('');
    });

    it('returns a px string unchanged', () => {
        expect(normalizeCssSize('200px')).toBe('200px');
    });

    it('returns a percent string unchanged', () => {
        expect(normalizeCssSize('50%')).toBe('50%');
    });

    it('appends px when string is a bare number', () => {
        expect(normalizeCssSize('42')).toBe('42px');
    });

    it('returns rem/em/vw/vh strings unchanged', () => {
        expect(normalizeCssSize('2rem')).toBe('2rem');
        expect(normalizeCssSize('1.5em')).toBe('1.5em');
        expect(normalizeCssSize('50vw')).toBe('50vw');
        expect(normalizeCssSize('100vh')).toBe('100vh');
    });

    it('returns empty string for unrecognised string', () => {
        expect(normalizeCssSize('large')).toBe('');
        expect(normalizeCssSize('auto')).toBe('');
    });

    it('returns empty string for null or undefined', () => {
        expect(normalizeCssSize(null)).toBe('');
        expect(normalizeCssSize(undefined)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// normalizeImageAlign
// ---------------------------------------------------------------------------

describe('normalizeImageAlign', () => {
    it('maps left to exe-image-left', () => {
        expect(normalizeImageAlign('left')).toBe('exe-image-left');
    });

    it('maps right to exe-image-right', () => {
        expect(normalizeImageAlign('right')).toBe('exe-image-right');
    });

    it('maps center to exe-image-center', () => {
        expect(normalizeImageAlign('center')).toBe('exe-image-center');
    });

    it('maps inline to exe-image-inline', () => {
        expect(normalizeImageAlign('inline')).toBe('exe-image-inline');
    });

    it('is case-insensitive', () => {
        expect(normalizeImageAlign('LEFT')).toBe('exe-image-left');
        expect(normalizeImageAlign('Center')).toBe('exe-image-center');
    });

    it('returns empty string for unrecognised value', () => {
        expect(normalizeImageAlign('middle')).toBe('');
        expect(normalizeImageAlign('justify')).toBe('');
    });

    it('returns empty string for null or empty', () => {
        expect(normalizeImageAlign(null)).toBe('');
        expect(normalizeImageAlign('')).toBe('');
        expect(normalizeImageAlign(undefined)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// requireDataUrl
// ---------------------------------------------------------------------------

describe('requireDataUrl', () => {
    it('returns the data URL when valid', () => {
        const url = 'data:image/png;base64,abc123';
        expect(requireDataUrl(url)).toBe(url);
    });

    it('throws for a non-data-URL string', () => {
        expect(() => requireDataUrl('https://example.com/image.png')).toThrow(
            'dataUrl must be a valid base64 data URL',
        );
    });

    it('throws for a data URL missing the base64 marker', () => {
        expect(() => requireDataUrl('data:text/plain,hello')).toThrow('dataUrl must be a valid base64 data URL');
    });

    it('throws for empty string', () => {
        expect(() => requireDataUrl('')).toThrow();
    });

    it('throws for null', () => {
        expect(() => requireDataUrl(null)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// detectDataUrlMimeType
// ---------------------------------------------------------------------------

describe('detectDataUrlMimeType', () => {
    it('extracts the MIME type from a data URL', () => {
        expect(detectDataUrlMimeType('data:image/png;base64,abc')).toBe('image/png');
    });

    it('extracts MIME type case-insensitively and returns lowercase', () => {
        expect(detectDataUrlMimeType('data:IMAGE/JPEG;base64,abc')).toBe('image/jpeg');
    });

    it('returns empty string for a non-data-URL string', () => {
        expect(detectDataUrlMimeType('https://example.com/img.png')).toBe('');
    });

    it('returns empty string for null', () => {
        expect(detectDataUrlMimeType(null)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(detectDataUrlMimeType('')).toBe('');
    });

    it('handles image/svg+xml correctly', () => {
        expect(detectDataUrlMimeType('data:image/svg+xml;base64,abc')).toBe('image/svg+xml');
    });
});

// ---------------------------------------------------------------------------
// createFileFromBytes
// ---------------------------------------------------------------------------

describe('createFileFromBytes', () => {
    it('creates a File with the given name and MIME type', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const file = createFileFromBytes(bytes, 'test.png', 'image/png');
        expect(file.name).toBe('test.png');
        expect(file.type).toBe('image/png');
        expect(file.size).toBe(3);
    });

    it('returns a File instance when File is available', () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]);
        const file = createFileFromBytes(bytes, 'hello.txt', 'text/plain');
        expect(file).toBeInstanceOf(File);
    });

    it('sets the correct byte length', () => {
        const bytes = new Uint8Array(10);
        const file = createFileFromBytes(bytes, 'data.bin', 'application/octet-stream');
        expect(file.size).toBe(10);
    });
});

// ---------------------------------------------------------------------------
// createFileFromBlob
// ---------------------------------------------------------------------------

describe('createFileFromBlob', () => {
    it('creates a File from a Blob with the given name and MIME type', () => {
        const blob = new Blob(['hello'], { type: 'text/plain' });
        const file = createFileFromBlob(blob, 'hello.txt', 'text/plain');
        expect(file.name).toBe('hello.txt');
        expect(file.type).toBe('text/plain');
    });

    it('returns a File instance when File is available', () => {
        const blob = new Blob(['data'], { type: 'application/octet-stream' });
        const file = createFileFromBlob(blob, 'data.bin', 'application/octet-stream');
        expect(file).toBeInstanceOf(File);
    });

    it('uses the provided mimeType over the blob type', () => {
        const blob = new Blob(['<svg/>'], { type: 'text/plain' });
        const file = createFileFromBlob(blob, 'icon.svg', 'image/svg+xml');
        expect(file.type).toBe('image/svg+xml');
    });

    it('preserves the blob size', () => {
        const blob = new Blob(['12345']);
        const file = createFileFromBlob(blob, 'num.txt', 'text/plain');
        expect(file.size).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// isTextIdeviceType
// ---------------------------------------------------------------------------

describe('isTextIdeviceType', () => {
    it('returns true for the canonical type "text"', () => {
        expect(isTextIdeviceType('text')).toBe(true);
    });

    it('is case-insensitive for the canonical type', () => {
        expect(isTextIdeviceType('TEXT')).toBe(true);
        expect(isTextIdeviceType('Text')).toBe(true);
    });

    it('returns false for types that merely contain the word "text" (strict equality)', () => {
        expect(isTextIdeviceType('textArea')).toBe(false);
        expect(isTextIdeviceType('richtext')).toBe(false);
        expect(isTextIdeviceType('external-text-website')).toBe(false);
        expect(isTextIdeviceType('FreeTextIdevice')).toBe(false);
    });

    it('returns false for unrelated iDevice types', () => {
        expect(isTextIdeviceType('casestudy')).toBe(false);
        expect(isTextIdeviceType('rubric')).toBe(false);
        expect(isTextIdeviceType('image')).toBe(false);
        expect(isTextIdeviceType('quiz')).toBe(false);
    });

    it('returns false for null or undefined', () => {
        expect(isTextIdeviceType(null)).toBe(false);
        expect(isTextIdeviceType(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isTextIdeviceType('')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isTextIdeviceComponent
// ---------------------------------------------------------------------------

describe('isTextIdeviceComponent', () => {
    it('returns true when component.ideviceType is exactly "text"', () => {
        expect(isTextIdeviceComponent({ ideviceType: 'text' })).toBe(true);
    });

    it('returns false when component.ideviceType is not exactly "text"', () => {
        expect(isTextIdeviceComponent({ ideviceType: 'image' })).toBe(false);
        expect(isTextIdeviceComponent({ ideviceType: 'textArea' })).toBe(false);
    });

    it('returns false for null component', () => {
        expect(isTextIdeviceComponent(null)).toBe(false);
    });

    it('returns false for undefined component', () => {
        expect(isTextIdeviceComponent(undefined)).toBe(false);
    });

    it('returns false when ideviceType is absent', () => {
        expect(isTextIdeviceComponent({})).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// generateOdeId / generateLocalId (deprecated alias)
// ---------------------------------------------------------------------------

const ODE_ID_RE = /^\d{14}[A-Z0-9]{6}$/;

describe('generateOdeId', () => {
    it('returns the canonical ODE id format: 14 digits + 6 [A-Z0-9]', () => {
        expect(generateOdeId()).toMatch(ODE_ID_RE);
    });

    it('produces unique IDs on successive calls', () => {
        const a = generateOdeId();
        const b = generateOdeId();
        expect(a).not.toBe(b);
    });

    it('encodes the current UTC timestamp in the leading 14 digits', () => {
        const before = Date.now();
        const id = generateOdeId();
        const after = Date.now();
        const ts = id.slice(0, 14);
        const isoLike = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;
        const parsed = Date.parse(isoLike);
        expect(parsed).toBeGreaterThanOrEqual(before - 1000);
        expect(parsed).toBeLessThanOrEqual(after + 1000);
    });
});

describe('generateLocalId (deprecated alias)', () => {
    it('delegates to generateOdeId and ignores any prefix argument', () => {
        expect(generateLocalId()).toMatch(ODE_ID_RE);
        expect(generateLocalId('block')).toMatch(ODE_ID_RE);
    });

    it('is unique across calls', () => {
        expect(generateLocalId()).not.toBe(generateLocalId());
    });
});

// ---------------------------------------------------------------------------
// requireAssetUuidUrl
// ---------------------------------------------------------------------------

describe('requireAssetUuidUrl', () => {
    const VALID_UUID = '3f7a1b2c-4d5e-6f78-9a0b-1c2d3e4f5678';

    it('accepts asset:// followed by a UUID with no extension', () => {
        const url = `asset://${VALID_UUID}`;
        expect(requireAssetUuidUrl(url)).toBe(url);
    });

    it('accepts asset:// followed by a UUID and a file extension', () => {
        const url = `asset://${VALID_UUID}.jpg`;
        expect(requireAssetUuidUrl(url)).toBe(url);
    });

    it('is case-insensitive on the UUID', () => {
        const url = `asset://${VALID_UUID.toUpperCase()}.PNG`;
        expect(requireAssetUuidUrl(url)).toBe(url);
    });

    it('trims surrounding whitespace', () => {
        const url = `asset://${VALID_UUID}.webp`;
        expect(requireAssetUuidUrl(`  ${url}  `)).toBe(url);
    });

    it('rejects path-style asset references', () => {
        expect(() => requireAssetUuidUrl('asset://images/foo.png')).toThrow(
            /assetId must be a valid asset:\/\/ URL with a UUID identifier/,
        );
    });

    it('rejects bare UUIDs without scheme', () => {
        expect(() => requireAssetUuidUrl(VALID_UUID)).toThrow();
    });

    it('rejects http/https URLs', () => {
        expect(() => requireAssetUuidUrl(`https://example.com/${VALID_UUID}.png`)).toThrow();
    });

    it('rejects non-string input', () => {
        expect(() => requireAssetUuidUrl(null)).toThrow();
        expect(() => requireAssetUuidUrl(undefined)).toThrow();
        expect(() => requireAssetUuidUrl(42)).toThrow();
        expect(() => requireAssetUuidUrl({ url: `asset://${VALID_UUID}` })).toThrow();
    });

    it('rejects malformed UUIDs', () => {
        expect(() => requireAssetUuidUrl('asset://not-a-uuid')).toThrow();
        expect(() => requireAssetUuidUrl(`asset://${VALID_UUID.slice(0, -1)}`)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// encodeLegacyText
// ---------------------------------------------------------------------------

describe('encodeLegacyText', () => {
    it('encodes plain ASCII text', () => {
        const result = encodeLegacyText('hello world');
        // Both escape() and encodeURIComponent encode spaces
        expect(result).toMatch(/hello/);
    });

    it('encodes special characters', () => {
        const result = encodeLegacyText('<p>test</p>');
        expect(result).not.toBe('<p>test</p>');
    });

    it('handles null by treating it as empty string', () => {
        const result = encodeLegacyText(null);
        expect(result).toBe('');
    });

    it('handles undefined by treating it as empty string', () => {
        const result = encodeLegacyText(undefined);
        expect(result).toBe('');
    });

    it('converts numbers to their string encoding', () => {
        const result = encodeLegacyText(42);
        expect(result).toBe('42');
    });

    it('returns a string', () => {
        expect(typeof encodeLegacyText('test')).toBe('string');
    });
});
