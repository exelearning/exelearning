import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../utils/dataGameCipher';
import {
    extractDataGame,
    extractDivContent,
    extractKeyedDivContent,
    extractMediaLinks,
    extractMediaLinksByClass,
} from './dataGameReader';

/** Build a DataGame div the way the iDevice editors write it. */
function dataGameDiv(prefix: string, data: unknown): string {
    return `<div class="${prefix}-DataGame js-hidden">${encryptDataGame(JSON.stringify(data))}</div>`;
}

describe('extractDivContent', () => {
    it('reads the inner HTML of a div identified by class', () => {
        const html = '<div class="adivina-extra-content">The Cantar de Mio Cid</div>';

        expect(extractDivContent(html, 'adivina-extra-content')).toBe('The Cantar de Mio Cid');
    });

    it('keeps nested divs intact instead of stopping at the first close tag', () => {
        const html =
            '<div class="adivina-IDevice">' +
            '<div class="adivina-extra-content"><div class="note"><p>Inner</p></div> tail</div>' +
            '</div>';

        expect(extractDivContent(html, 'adivina-extra-content')).toBe('<div class="note"><p>Inner</p></div> tail');
    });

    it('matches the class among other classes and ignores partial names', () => {
        const html = '<div class="js-hidden adivina-DataGame extra">payload</div>';

        expect(extractDivContent(html, 'adivina-DataGame')).toBe('payload');
        expect(extractDivContent(html, 'adivina-Data')).toBe('');
    });

    it('returns empty string for a missing div and for empty input', () => {
        expect(extractDivContent('<div class="other">x</div>', 'adivina-DataGame')).toBe('');
        expect(extractDivContent('', 'adivina-DataGame')).toBe('');
    });

    it('reads an unterminated div, as a browser would', () => {
        // HTML5 parsing closes the tag implicitly rather than discarding it, so a payload saved
        // without its closing tag is still recovered.
        expect(extractDivContent('<div class="adivina-DataGame">never closed', 'adivina-DataGame')).toBe(
            'never closed',
        );
    });
});

describe('extractDataGame', () => {
    it('decodes an obfuscated payload', () => {
        const data = { typeGame: 'Adivina', wordsGame: [{ word: 'Valencia' }] };

        expect(extractDataGame(dataGameDiv('adivina', data), 'adivina')).toEqual(data);
    });

    it('reads legacy activities that stored the JSON in the clear', () => {
        const html = '<div class="adivina-DataGame js-hidden">{"typeGame":"Adivina","wordsGame":[]}</div>';

        expect(extractDataGame(html, 'adivina')).toEqual({ typeGame: 'Adivina', wordsGame: [] });
    });

    it('preserves literal formatting and image attributes inside legacy plaintext JSON', () => {
        const data = { instructions: '<p>Read <b>this</b></p>', options: ['<img src="asset://pic" alt="A &amp; B">'] };
        const html = `<div class="quext-DataGame">${JSON.stringify(data)}</div>`;
        expect(extractDataGame(html, 'quext')).toEqual(data);
    });

    it('also decodes legacy JSON escaped as HTML text', () => {
        const html = '<div class="quext-DataGame">{&quot;instructions&quot;:&quot;A &amp; B&quot;}</div>';
        expect(extractDataGame(html, 'quext')).toEqual({ instructions: 'A & B' });
    });

    it('preserves accents and non latin-1 characters', () => {
        const data = { instructions: 'Rellene la palabra que falta: Ω, señor' };

        expect(extractDataGame(dataGameDiv('adivina', data), 'adivina')).toEqual(data);
    });

    it('returns null for absent, empty and corrupt payloads', () => {
        expect(extractDataGame('<div class="quext-DataGame">x</div>', 'adivina')).toBeNull();
        expect(extractDataGame('<div class="adivina-DataGame js-hidden">   </div>', 'adivina')).toBeNull();
        expect(extractDataGame('<div class="adivina-DataGame js-hidden">not json</div>', 'adivina')).toBeNull();
    });

    it('returns null when the payload decodes to a non-object', () => {
        const html = `<div class="adivina-DataGame js-hidden">${encryptDataGame('42')}</div>`;

        expect(extractDataGame(html, 'adivina')).toBeNull();
    });
});

describe('extractMediaLinks', () => {
    it('keys sidecar links by the question index held in the link text', () => {
        const html =
            '<a href="blob:http://x/aaa" class="js-hidden adivina-LinkImages">0</a>' +
            '<a href="blob:http://x/bbb" class="js-hidden adivina-LinkImages">2</a>';

        const links = extractMediaLinks(html, 'adivina', 'Images');

        expect(links.get(0)).toBe('blob:http://x/aaa');
        expect(links.get(2)).toBe('blob:http://x/bbb');
        expect(links.size).toBe(2);
    });

    it('keeps the image and audio families apart', () => {
        const html =
            '<a href="pic.png" class="js-hidden adivina-LinkImages">0</a>' +
            '<a href="sound.mp3" class="js-hidden adivina-LinkAudios">0</a>';

        expect(extractMediaLinks(html, 'adivina', 'Images').get(0)).toBe('pic.png');
        expect(extractMediaLinks(html, 'adivina', 'Audios').get(0)).toBe('sound.mp3');
    });

    it('ignores another iDevice prefix in the same document', () => {
        const html = '<a href="pic.png" class="js-hidden quext-LinkImages">0</a>';

        expect(extractMediaLinks(html, 'adivina', 'Images').size).toBe(0);
    });

    it('skips links with an empty href or a non-numeric index', () => {
        const html =
            '<a href="" class="js-hidden adivina-LinkImages">0</a>' +
            '<a href="pic.png" class="js-hidden adivina-LinkImages">n/a</a>' +
            '<a href="ok.png" class="js-hidden adivina-LinkImages">1</a>';

        const links = extractMediaLinks(html, 'adivina', 'Images');

        expect(links.size).toBe(1);
        expect(links.get(1)).toBe('ok.png');
    });

    it('returns an empty map for empty input', () => {
        expect(extractMediaLinks('', 'adivina', 'Images').size).toBe(0);
    });
});

describe('extractMediaLinksByClass', () => {
    const link = (className: string, index: number, href: string) =>
        `<a href="${href}" class="js-hidden ${className}">${index}</a>`;

    it('reads the links of the class it is given', () => {
        const html = link('ordena-LinkImages-0', 0, 'blob:one') + link('ordena-LinkImages-0', 1, 'blob:two');

        expect([...extractMediaLinksByClass(html, 'ordena-LinkImages-0')]).toEqual([
            [0, 'blob:one'],
            [1, 'blob:two'],
        ]);
    });

    it('keeps the rounds apart when their classes only differ by number', () => {
        // Sort keys its links twice over, so one round must not read another's pictures.
        const html =
            link('ordena-LinkImages-0', 0, 'blob:round-one') + link('ordena-LinkImages-1', 0, 'blob:round-two');

        expect(extractMediaLinksByClass(html, 'ordena-LinkImages-0').get(0)).toBe('blob:round-one');
        expect(extractMediaLinksByClass(html, 'ordena-LinkImages-1').get(0)).toBe('blob:round-two');
    });

    it('is what the prefix-and-kind form is built on', () => {
        const html = link('adivina-LinkImages', 3, 'blob:three');

        expect(extractMediaLinks(html, 'adivina', 'Images')).toEqual(
            extractMediaLinksByClass(html, 'adivina-LinkImages'),
        );
    });
});

describe('extractKeyedDivContent', () => {
    const sidecar = (index: number, body: string) =>
        `<div class="js-hidden mathproblems-LinkWordings" data-id="${index}">${body}</div>`;

    it('reads each sidecar under the index it carries', () => {
        const html = sidecar(0, '<p>Primero</p>') + sidecar(1, '<p>Segundo</p>');
        const found = extractKeyedDivContent(html, 'mathproblems-LinkWordings');

        expect(found.get(0)).toBe('<p>Primero</p>');
        expect(found.get(1)).toBe('<p>Segundo</p>');
    });

    it('keeps the markup inside, pictures and all', () => {
        const html = sidecar(0, '<img src="blob:figure" alt="Figura">');

        expect(extractKeyedDivContent(html, 'mathproblems-LinkWordings').get(0)).toContain('<img');
    });

    it('ignores a sidecar with no index to file it under', () => {
        const html = '<div class="mathproblems-LinkWordings">Sin id</div>' + sidecar(1, 'Con id');
        const found = extractKeyedDivContent(html, 'mathproblems-LinkWordings');

        expect([...found.keys()]).toEqual([1]);
    });

    it('keeps the first when an index is written twice', () => {
        const html = sidecar(0, 'Primera') + sidecar(0, 'Segunda');

        expect(extractKeyedDivContent(html, 'mathproblems-LinkWordings').get(0)).toBe('Primera');
    });

    it('reads nothing from markup that carries none', () => {
        expect(extractKeyedDivContent('<p>Nada</p>', 'mathproblems-LinkWordings').size).toBe(0);
        expect(extractKeyedDivContent('', 'mathproblems-LinkWordings').size).toBe(0);
    });
});
