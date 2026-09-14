import { describe, it, expect } from 'vitest';
import {
    DATA_GAME_CLASS,
    isDataGameType,
    getDataGameClass,
    encodeDataGameState,
    buildDataGameHtml,
} from './dataGameBuilder.js';

// ---------------------------------------------------------------------------
// DATA_GAME_CLASS catalog
// ---------------------------------------------------------------------------

describe('DATA_GAME_CLASS', () => {
    it('is frozen', () => {
        expect(Object.isFrozen(DATA_GAME_CLASS)).toBe(true);
    });

    it('contains exactly 28 entries', () => {
        expect(Object.keys(DATA_GAME_CLASS).length).toBe(28);
    });

    it('maps every documented type to the correct CSS class', () => {
        const expected = {
            'az-quiz-game': 'rosco-DataGame js-hidden',
            beforeafter: 'beforeafter-DataGame js-hidden',
            challenge: 'desafio-DataGame js-hidden',
            checklist: 'listacotejo-DataGame js-hidden',
            classify: 'clasifica-DataGame js-hidden',
            complete: 'completa-DataGame js-hidden',
            crossword: 'crucigrama-DataGame js-hidden',
            discover: 'descubre-DataGame js-hidden',
            dragdrop: 'dragdrop-DataGame js-hidden',
            flipcards: 'flipcards-DataGame js-hidden',
            guess: 'adivina-DataGame js-hidden',
            'hidden-image': 'hiddenimage-DataGame js-hidden',
            identify: 'identifica-DataGame js-hidden',
            map: 'mapa-DataGame js-hidden',
            mathematicaloperations: 'mathoperations-DataGame js-hidden',
            mathproblems: 'mathproblems-DataGame js-hidden',
            padlock: 'candado-DataGame js-hidden',
            'periodic-table': 'periodic-table-DataGame js-hidden',
            'progress-report': 'informe-DataGame js-hidden',
            puzzle: 'puzzle-DataGame js-hidden',
            'quick-questions': 'quext-DataGame js-hidden',
            'quick-questions-multiple-choice': 'selecciona-DataGame js-hidden',
            'quick-questions-video': 'vquext-DataGame js-hidden',
            relate: 'relaciona-DataGame js-hidden',
            'select-media-files': 'seleccionamedias-DataGame js-hidden',
            sort: 'ordena-DataGame js-hidden',
            trivial: 'trivial-DataGame js-hidden',
            'word-search': 'sopa-DataGame js-hidden',
        };

        for (const [type, cls] of Object.entries(expected)) {
            expect(DATA_GAME_CLASS[type], `class for '${type}'`).toBe(cls);
        }
    });

    it('every class string contains "DataGame" and "js-hidden"', () => {
        for (const [type, cls] of Object.entries(DATA_GAME_CLASS)) {
            expect(cls, `class for '${type}' should contain DataGame`).toContain('DataGame');
            expect(cls, `class for '${type}' should contain js-hidden`).toContain('js-hidden');
        }
    });
});

// ---------------------------------------------------------------------------
// isDataGameType
// ---------------------------------------------------------------------------

describe('isDataGameType', () => {
    it('returns true for every known type', () => {
        for (const type of Object.keys(DATA_GAME_CLASS)) {
            expect(isDataGameType(type), `isDataGameType('${type}')`).toBe(true);
        }
    });

    it('returns false for unknown types', () => {
        expect(isDataGameType('foobar')).toBe(false);
        expect(isDataGameType('')).toBe(false);
        expect(isDataGameType(null)).toBe(false);
        expect(isDataGameType(undefined)).toBe(false);
        expect(isDataGameType(42)).toBe(false);
    });

    it('is case-sensitive', () => {
        expect(isDataGameType('Flipcards')).toBe(false);
        expect(isDataGameType('CROSSWORD')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getDataGameClass
// ---------------------------------------------------------------------------

describe('getDataGameClass', () => {
    it('returns the correct class for az-quiz-game', () => {
        expect(getDataGameClass('az-quiz-game')).toBe('rosco-DataGame js-hidden');
    });

    it('returns the correct class for flipcards', () => {
        expect(getDataGameClass('flipcards')).toBe('flipcards-DataGame js-hidden');
    });

    it('returns the correct class for crossword', () => {
        expect(getDataGameClass('crossword')).toBe('crucigrama-DataGame js-hidden');
    });

    it('returns the correct class for word-search', () => {
        expect(getDataGameClass('word-search')).toBe('sopa-DataGame js-hidden');
    });

    it('throws for unknown type', () => {
        expect(() => getDataGameClass('foobar')).toThrow(
            "type 'foobar' is not a Pattern 2 DataGame iDevice",
        );
    });

    it('throws for empty string', () => {
        expect(() => getDataGameClass('')).toThrow("type '' is not a Pattern 2 DataGame iDevice");
    });
});

// ---------------------------------------------------------------------------
// encodeDataGameState
// ---------------------------------------------------------------------------

describe('encodeDataGameState', () => {
    it('round-trips a simple object', () => {
        const state = { typeGame: 'Flipcards', cards: [{ front: 'A', back: 'B' }] };
        const encoded = encodeDataGameState(state);
        const decoded = JSON.parse(decodeURIComponent(encoded));
        expect(decoded).toEqual(state);
    });

    it('round-trips a complex nested object', () => {
        const state = {
            typeGame: 'Crossword',
            words: [{ word: 'HOLA', clue: 'Saludo' }],
            config: { rows: 10, cols: 10, showTimer: true },
            meta: { version: 3, tags: ['spanish', 'greetings'] },
        };
        const encoded = encodeDataGameState(state);
        expect(typeof encoded).toBe('string');
        const decoded = JSON.parse(decodeURIComponent(encoded));
        expect(decoded).toEqual(state);
    });

    it('percent-encodes special characters', () => {
        const state = { text: 'Hello & <World>' };
        const encoded = encodeDataGameState(state);
        // The JSON will contain < and & which must be percent-encoded
        expect(encoded).not.toContain('<');
        expect(encoded).not.toContain('>');
        expect(encoded).not.toContain('&');
        // Round-trip still works
        const decoded = JSON.parse(decodeURIComponent(encoded));
        expect(decoded.text).toBe('Hello & <World>');
    });

    it('produces a string starting with %7B (encoded {)', () => {
        const encoded = encodeDataGameState({ x: 1 });
        expect(encoded.startsWith('%7B')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// buildDataGameHtml
// ---------------------------------------------------------------------------

describe('buildDataGameHtml', () => {
    it('builds correct HTML for flipcards with instructions and textAfter', () => {
        const state = { typeGame: 'Flipcards', cards: [] };
        const html = buildDataGameHtml('flipcards', state, {
            instructions: 'Flip the cards',
            textAfter: 'Well done!',
        });

        expect(html).toContain('<div class="flipcards-IDevice">');
        expect(html).toContain('class="flipcards-instructions gameQP-instructions"');
        expect(html).toContain('<p>Flip the cards</p>');
        expect(html).toContain('class="flipcards-DataGame js-hidden"');
        expect(html).toContain('class="flipcards-text-after"');
        expect(html).toContain('Well done!');
    });

    it('builds correct HTML for crossword without optional fields', () => {
        const state = { typeGame: 'Crucigrama', words: [] };
        const html = buildDataGameHtml('crossword', state);

        expect(html).toContain('<div class="crossword-IDevice">');
        expect(html).toContain('class="crucigrama-DataGame js-hidden"');
        expect(html).not.toContain('instructions');
        expect(html).not.toContain('text-after');
    });

    it('builds correct HTML for word-search with only instructions', () => {
        const state = { typeGame: 'Sopa', words: ['HELLO'] };
        const html = buildDataGameHtml('word-search', state, { instructions: 'Find the words' });

        expect(html).toContain('<div class="word-search-IDevice">');
        expect(html).toContain('class="word-search-instructions gameQP-instructions"');
        expect(html).toContain('<p>Find the words</p>');
        expect(html).toContain('class="sopa-DataGame js-hidden"');
        expect(html).not.toContain('text-after');
    });

    it('embeds the URI-encoded state inside the DataGame div', () => {
        const state = { typeGame: 'Flipcards', cards: [{ front: 'Q', back: 'A' }] };
        const html = buildDataGameHtml('flipcards', state);
        const encoded = encodeDataGameState(state);
        expect(html).toContain(encoded);
    });

    it('escapes instructions to prevent HTML injection', () => {
        const state = { x: 1 };
        const html = buildDataGameHtml('puzzle', state, {
            instructions: '<script>alert("xss")</script>',
        });
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('escapes textAfter to prevent HTML injection', () => {
        const state = { x: 1 };
        const html = buildDataGameHtml('puzzle', state, {
            textAfter: '<b>bold</b> & more',
        });
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;');
        expect(html).toContain('&amp;');
    });

    it('omits instructions div when instructions is empty string', () => {
        const html = buildDataGameHtml('trivial', { x: 1 }, { instructions: '' });
        expect(html).not.toContain('instructions');
    });

    it('omits textAfter div when textAfter is empty string', () => {
        const html = buildDataGameHtml('trivial', { x: 1 }, { textAfter: '' });
        expect(html).not.toContain('text-after');
    });

    it('omits both optional divs when opts is not provided', () => {
        const html = buildDataGameHtml('sort', { x: 1 });
        expect(html).not.toContain('instructions');
        expect(html).not.toContain('text-after');
    });

    it('throws for unknown type', () => {
        expect(() => buildDataGameHtml('notareal', {})).toThrow(
            "type 'notareal' is not a Pattern 2 DataGame iDevice",
        );
    });

    it('builds correct HTML for az-quiz-game type', () => {
        const state = { typeGame: 'Rosco', wordsGame: [] };
        const html = buildDataGameHtml('az-quiz-game', state, { instructions: 'Start!' });

        expect(html).toContain('<div class="az-quiz-game-IDevice">');
        expect(html).toContain('class="rosco-DataGame js-hidden"');
        expect(html).toContain('class="az-quiz-game-instructions gameQP-instructions"');
    });
});
