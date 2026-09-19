import { describe, expect, it } from 'bun:test';
import { DATA_GAME_CIPHER_KEY, decryptDataGame, encryptDataGame } from './dataGameCipher';

describe('dataGameCipher', () => {
    describe('decryptDataGame', () => {
        it('decodes a payload produced by the browser helper', () => {
            // Captured from test/fixtures/export/un-heroe-medieval-el-cid: the opening of a real
            // guess activity's DataGame div.
            const payload = '%E9%B0%E6%EB%E2%F7%D5%F3%FF%F7%B0%A8%B0%D3%F6%FB%E4%FB%FC%F3%B0';

            expect(decryptDataGame(payload)).toBe('{"typeGame":"Adivina"');
        });

        it('returns empty string for empty, undefined and null-ish input', () => {
            expect(decryptDataGame('')).toBe('');
            expect(decryptDataGame(undefined)).toBe('');
            expect(decryptDataGame(null)).toBe('');
            expect(decryptDataGame('undefined')).toBe('');
            expect(decryptDataGame('null')).toBe('');
        });

        it('decodes %uXXXX sequences that decodeURIComponent would reject', () => {
            // escape() emits %uXXXX for characters outside Latin-1. This is the case that made
            // LibraryDetector silently return '' before the cipher was centralised here.
            const payload = encryptDataGame('{"q":"Ω Привет 🎓"}');

            expect(payload).toContain('%u');
            expect(() => decodeURIComponent(payload)).toThrow();
            expect(decryptDataGame(payload)).toBe('{"q":"Ω Привет 🎓"}');
        });
    });

    describe('encryptDataGame', () => {
        it('returns empty string for empty input', () => {
            expect(encryptDataGame('')).toBe('');
            expect(encryptDataGame(undefined)).toBe('');
            expect(encryptDataGame(null)).toBe('');
        });

        it('applies XOR with the shared key before escaping', () => {
            // 'A' (65) ^ 146 = 211 = 0xD3, which escape() renders as %D3.
            expect(encryptDataGame('A')).toBe('%D3');
            expect(DATA_GAME_CIPHER_KEY).toBe(146);
        });
    });

    describe('hostile input', () => {
        // These helpers are reached from untyped JavaScript through the exporters bundle, so the
        // guards are not merely theoretical: a caller can hand over something that is not a string.
        it('returns empty string instead of throwing when decoding a non-string', () => {
            const notAString = Object.create(null) as unknown as string;

            expect(() => unescape(notAString)).toThrow();
            expect(decryptDataGame(notAString)).toBe('');
        });

        it('returns empty string instead of throwing when encoding a non-string', () => {
            const notAString = { length: 1 } as unknown as string;

            expect(encryptDataGame(notAString)).toBe('');
        });
    });

    describe('round trip', () => {
        it.each([
            ['plain ascii', '{"word":"Valencia","definition":"Ciudad"}'],
            ['accents and enye', '{"word":"Montañés","definition":"Señor de la mañana"}'],
            ['html markup', '<p>Observe las letras &amp; rellene</p>'],
            ['quotes and backslashes', '{"a":"say \\"hi\\"","b":"c:\\\\path"}'],
            ['non latin-1', 'Ω Привет 🎓'],
        ])('survives a round trip: %s', (_label, original) => {
            expect(decryptDataGame(encryptDataGame(original))).toBe(original);
        });

        it('round trips a full guess-shaped payload', () => {
            const dataGame = {
                typeGame: 'Adivina',
                instructions: '<p>Observe las letras</p>',
                wordsGame: [{ word: 'Valencia', definition: 'Ciudad conquistada', type: 1 }],
            };

            const restored = JSON.parse(decryptDataGame(encryptDataGame(JSON.stringify(dataGame))));

            expect(restored).toEqual(dataGame);
        });
    });
});
