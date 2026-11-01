import { describe, expect, it } from 'vitest';
import { decodeEntry, isHtmlEntry } from './previewSnapshotEntries.js';

describe('previewSnapshotEntries', () => {
    describe('isHtmlEntry', () => {
        it.each(['index.html', 'html/page.htm', 'page.xhtml', 'HTML/PAGE.HTML'])('accepts %s', path => {
            expect(isHtmlEntry(path)).toBe(true);
        });

        it.each(['style.css', 'script.js', 'image.png', 'page.html.bak'])('rejects %s', path => {
            expect(isHtmlEntry(path)).toBe(false);
        });
    });

    describe('decodeEntry', () => {
        it('passes a string through untouched', () => {
            expect(decodeEntry('<p>ya text</p>')).toBe('<p>ya text</p>');
        });

        /** Snapshot entries arrive as bytes or as text depending on where they came from. */
        it('decodes bytes as UTF-8', () => {
            const bytes = new TextEncoder().encode('<p>café</p>');

            expect(decodeEntry(bytes)).toBe('<p>café</p>');
        });

        it('decodes an ArrayBuffer, not just a view of one', () => {
            const bytes = new TextEncoder().encode('<p>café</p>');

            expect(decodeEntry(bytes.buffer)).toBe('<p>café</p>');
        });
    });
});
