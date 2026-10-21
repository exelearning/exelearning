import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { CompleteWorksheetAdapter, splitGappedText } from './CompleteWorksheetAdapter';
import type { PrintableActivity } from '../types';

interface CompleteFixtureOptions {
    instructions?: string;
    /** The author's text, with hidden words wrapped in `@@`. */
    textText?: string;
    textAfter?: string;
    /** 0 write the word, 1 drag it, 2 pick it from a list. */
    type?: number;
    wordsErrors?: string;
    /** Whether a gap is as wide as the word it hides. */
    wordsSize?: boolean;
}

/** Build component HTML the way the Complete editor writes it. */
function completeHtml(options: CompleteFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Completa',
        instructions: options.instructions ?? '',
        // Stored escaped, as the editor writes it.
        textText: escape(options.textText ?? '<p>El @@Cid@@ tomo @@Valencia@@.</p>'),
        type: options.type ?? 0,
        wordsErrors: options.wordsErrors ?? '',
        // Proportional by default, so the width tests read directly. An explicit undefined is
        // passed through, since that is a case of its own.
        wordsSize: 'wordsSize' in options ? options.wordsSize : true,
    });

    let html = '<div class="completa-IDevice">';
    html += `<div class="completa-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (options.textAfter) {
        html += `<div class="completa-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

/** The words the activity offers above its text, or [] when it offers none. */
function bankOf(activity: PrintableActivity | null): string[] {
    const board = activity?.board;
    return board?.kind === 'wordBank' ? board.words : [];
}

/** How many gaps the printed text has. */
function gapCount(activity: PrintableActivity | null): number {
    return (activity?.items[0].prompt.match(/class="worksheet-gap"/g) ?? []).length;
}

describe('splitGappedText', () => {
    it('turns each pair of markers into a token', () => {
        expect(splitGappedText('El @@Cid@@ tomo @@Valencia@@.')).toEqual({
            text: 'El {{gap-0}} tomo {{gap-1}}.',
            words: ['Cid', 'Valencia'],
        });
    });

    it('keeps the text as it is when there are no markers', () => {
        expect(splitGappedText('Nothing hidden here.')).toEqual({
            text: 'Nothing hidden here.',
            words: [],
        });
    });

    it('leaves a dangling marker alone rather than swallowing the rest', () => {
        expect(splitGappedText('El @@Cid@@ tomo @@Valencia')).toEqual({
            text: 'El {{gap-0}} tomo @@Valencia',
            words: ['Cid'],
        });
    });

    it('keeps an empty gap as an empty word', () => {
        expect(splitGappedText('a @@@@ b').words).toEqual(['']);
    });
});

describe('CompleteWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(CompleteWorksheetAdapter.ideviceType).toBe('complete');
    });

    it('prints the text with a gap where each word was', () => {
        const activity = CompleteWorksheetAdapter.build(completeHtml(), {});

        expect(activity?.items).toHaveLength(1);
        expect(gapCount(activity)).toBe(2);
        expect(activity?.items[0].prompt).toContain('El ');
        expect(activity?.items[0].prompt).toContain(' tomo ');
    });

    it('never prints the hidden words in the text', () => {
        const activity = CompleteWorksheetAdapter.build(completeHtml(), {});

        expect(activity?.items[0].prompt).not.toContain('Cid');
        expect(activity?.items[0].prompt).not.toContain('Valencia');
    });

    it('keeps the author formatting around a gap', () => {
        const activity = CompleteWorksheetAdapter.build(
            completeHtml({ textText: '<p>El <b>@@Cid@@</b> llego.</p>' }),
            {},
        );

        // Sanitising the text whole keeps the tags paired around the gap.
        expect(activity?.items[0].prompt).toContain('<b><span class="worksheet-gap"');
        expect(activity?.items[0].prompt).toContain('</span></b>');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(CompleteWorksheetAdapter.build(completeHtml(), { title: 'Completa' })?.title).toBe('Completa');
        expect(CompleteWorksheetAdapter.build(completeHtml(), {})?.title).toBe('Complete');
    });

    it('carries over instructions and closing text', () => {
        const activity = CompleteWorksheetAdapter.build(
            completeHtml({ instructions: '<p>Rellene</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Rellene</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('gap width', () => {
        it('draws every gap the same fixed width when the activity does not size them', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ textText: 'a @@Cid@@ b @@Valencia@@', wordsSize: false }),
                {},
            );
            const widths = [...(activity?.items[0].prompt.matchAll(/width: ([\d.]+)mm/g) ?? [])].map(m => Number(m[1]));

            // Twelve characters, whatever the word: 12 * 2.2mm.
            expect(widths).toEqual([26.4, 26.4]);
        });

        it('treats a missing setting as a fixed width', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ textText: 'a @@Cid@@', wordsSize: undefined }),
                {},
            );
            const width = Number(/width: ([\d.]+)mm/.exec(activity?.items[0].prompt ?? '')?.[1]);

            expect(width).toBe(26.4);
        });

        it('sizes each gap to the word it hides', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ textText: 'a @@Cid@@ b @@Valencia@@' }), {});
            const widths = [...(activity?.items[0].prompt.matchAll(/width: ([\d.]+)mm/g) ?? [])].map(m => Number(m[1]));

            expect(widths).toHaveLength(2);
            // Valencia is longer than Cid, so its gap is wider.
            expect(widths[1]).toBeGreaterThan(widths[0]);
        });

        it('sizes a gap from the first alternative of the word', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ textText: 'a @@Cid|Campeador@@' }), {});
            const width = Number(/width: ([\d.]+)mm/.exec(activity?.items[0].prompt ?? '')?.[1]);

            // Three characters, not the nine of the alternative.
            expect(width).toBe(6.6);
        });

        it('gives a very short word a gap that can still be written in', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ textText: 'a @@y@@ b' }), {});
            const width = Number(/width: ([\d.]+)mm/.exec(activity?.items[0].prompt ?? '')?.[1]);

            expect(width).toBe(6.6);
        });
    });

    describe('the words on offer', () => {
        it('offers nothing in the mode where the student writes the word', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ type: 0 }), {});

            expect(activity?.board).toBeUndefined();
        });

        it('lists the words in the drag mode', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ type: 1 }), {});

            expect(bankOf(activity).sort()).toEqual(['Cid', 'Valencia']);
        });

        it('lists the words in the select mode', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ type: 2 }), {});

            expect(bankOf(activity).sort()).toEqual(['Cid', 'Valencia']);
        });

        it('mixes the wrong words in with the right ones', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ type: 1, wordsErrors: 'Sevilla, Toledo' }),
                {},
            );

            expect(bankOf(activity).sort()).toEqual(['Cid', 'Sevilla', 'Toledo', 'Valencia']);
        });

        it('splits the alternatives of a wrong word into separate entries', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ type: 1, wordsErrors: 'Toledo|Burgos' }),
                {},
            );

            expect(bankOf(activity).sort()).toEqual(['Burgos', 'Cid', 'Toledo', 'Valencia']);
        });

        it('offers only the first alternative of a hidden word', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ type: 1, textText: 'a @@Cid|Campeador@@' }),
                {},
            );

            expect(bankOf(activity)).toEqual(['Cid']);
        });

        it('shuffles the words, so their order gives nothing away', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ type: 1, textText: 'a @@uno@@ b @@dos@@ c @@tres@@ d @@cuatro@@' }),
                { random: () => 0 },
            );

            const words = bankOf(activity);
            expect([...words].sort()).toEqual(['cuatro', 'dos', 'tres', 'uno']);
            expect(words).not.toEqual(['uno', 'dos', 'tres', 'cuatro']);
        });

        it('ignores blank entries in the wrong words', () => {
            const activity = CompleteWorksheetAdapter.build(completeHtml({ type: 1, wordsErrors: 'Toledo, , ,' }), {});

            expect(bankOf(activity).sort()).toEqual(['Cid', 'Toledo', 'Valencia']);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(CompleteWorksheetAdapter.build('<div class="completa-IDevice"></div>', {})).toBeNull();
            expect(CompleteWorksheetAdapter.build('<div class="completa-DataGame">not json</div>', {})).toBeNull();
            expect(CompleteWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when the text hides no word', () => {
            expect(CompleteWorksheetAdapter.build(completeHtml({ textText: '<p>Nothing.</p>' }), {})).toBeNull();
        });

        it('returns null when the activity has no text at all', () => {
            const html = `<div class="completa-DataGame js-hidden">${encryptDataGame('{"type":0}')}</div>`;

            expect(CompleteWorksheetAdapter.build(html, {})).toBeNull();
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into the text', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ textText: '<p>El @@Cid@@</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('<script');
            expect(activity?.items[0].prompt).toContain('worksheet-gap');
        });

        it('strips markup smuggled into an offered word', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ type: 1, wordsErrors: '<img src=x onerror=alert(1)>' }),
                {},
            );

            expect(bankOf(activity).join('')).not.toContain('onerror');
        });

        it('strips a script smuggled into the instructions', () => {
            const activity = CompleteWorksheetAdapter.build(
                completeHtml({ instructions: '<p>Hi</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hi</p>');
        });
    });
});
