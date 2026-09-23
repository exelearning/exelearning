import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { ChallengeWorksheetAdapter } from './ChallengeWorksheetAdapter';

interface ChallengeFixture {
    desafioTitle?: string;
    desafioDescription?: string;
    desafioSolution?: string;
    instructionsExe?: string;
    instructions?: string;
    instructionsDiv?: string;
    challenges?: Record<string, unknown>[];
    /** The div the later version of the iDevice writes beside the payload. */
    mainDiv?: string;
    challengeDivs?: string[];
    /** The activity own word for a smaller challenge. */
    msgChallenge?: string;
}

/** One of the smaller challenges, as the editor stores it. */
function challenge(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: 'Los primeros síntomas',
        description: '<p>Busca la fecha del primer caso</p>',
        solution: 'G P Ñ',
        timeShow: -1,
        clues: [{ clue: 'Empieza por G', time: 5 }],
        ...overrides,
    };
}

function challengeHtml(fixture: ChallengeFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'desafio',
        desafioTitle: fixture.desafioTitle ?? 'Pandemia reto mundial',
        desafioDescription: fixture.desafioDescription ?? '<p>Averigua qué pandemia fue</p>',
        desafioSolution: fixture.desafioSolution ?? 'Gripe española',
        desafioType: 0,
        desafioTime: 60,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        challengesGame: fixture.challenges ?? [challenge()],
        msgs: { msgChallenge: fixture.msgChallenge ?? 'Reto' },
    });

    let html = '<div class="desafio-IDevice">';
    if (fixture.instructionsDiv) html += `<div class="desafio-instructions">${fixture.instructionsDiv}</div>`;
    html += '<div class="desafio-version js-hidden">1</div>';
    if (fixture.mainDiv !== undefined) html += `<div class="desafio-EDescription">${fixture.mainDiv}</div>`;
    for (const div of fixture.challengeDivs ?? []) html += `<div class="desafio-ChallengeDescription">${div}</div>`;
    html += `<div class="desafio-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    html += '</div>';

    return html;
}

function itemsOf(fixture: ChallengeFixture = {}, options = {}): PrintableItem[] {
    return ChallengeWorksheetAdapter.build(challengeHtml(fixture), options)?.items ?? [];
}

/** A challenge's name as the sheet marks it: a title over its wording, not the first line of it. */
function titled(name: string): string {
    return `<strong class="worksheet-challenge-title">${name}</strong>`;
}

/** A smaller challenge, under the activity's own name for it. */
function numbered(position: number, name: string): string {
    return titled(`Reto ${position}. ${name}`);
}

/** Two blank lines, which is the room every challenge is answered in. */
const ANSWER = { kind: 'writingSpace', lines: 2 };

describe('ChallengeWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ChallengeWorksheetAdapter.ideviceType).toBe('challenge');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(ChallengeWorksheetAdapter.build(challengeHtml(), { title: 'Desafío' })?.title).toBe('Desafío');
        expect(ChallengeWorksheetAdapter.build(challengeHtml(), {})?.title).toBe('Challenge');
    });

    it('prints the main challenge first, then the smaller ones', () => {
        const items = itemsOf({
            challenges: [challenge({ title: 'Primer paso' }), challenge({ title: 'Segundo paso' })],
        });

        expect(items.map(item => item.prompt)).toEqual([
            titled('Pandemia reto mundial'),
            numbered(1, 'Primer paso'),
            numbered(2, 'Segundo paso'),
        ]);
    });

    it('sets each one as title, wording, then room to answer', () => {
        const [main] = itemsOf();

        expect(main.prompt).toBe(titled('Pandemia reto mundial'));
        expect(main.extraText).toBe('<p>Averigua qué pandemia fue</p>');
        expect(main.answer).toEqual(ANSWER);
    });

    it('leaves the same room under a smaller challenge as under the main one', () => {
        const [, first] = itemsOf();

        expect(first.prompt).toBe(numbered(1, 'Los primeros síntomas'));
        expect(first.extraText).toBe('<p>Busca la fecha del primer caso</p>');
        expect(first.answer).toEqual(ANSWER);
    });

    describe('what a smaller challenge is called', () => {
        it('the activity own word for one, numbered from one as its runtime numbers them', () => {
            const [, first, second] = itemsOf({
                challenges: [challenge({ title: 'Uno' }), challenge({ title: 'Dos' })],
            });

            expect(first.prompt).toBe(numbered(1, 'Uno'));
            expect(second.prompt).toBe(numbered(2, 'Dos'));
        });

        it('the author word, where they changed it', () => {
            const [, first] = itemsOf({ msgChallenge: 'Prueba' });

            expect(first.prompt).toBe(titled('Prueba 1. Los primeros síntomas'));
        });

        it('the number alone where the activity names none', () => {
            // Inventing a word would need a translation for something already translated.
            const [, first] = itemsOf({ msgChallenge: '' });

            expect(first.prompt).toBe(titled('1. Los primeros síntomas'));
        });

        it('escaped, an author being free to type anything into it', () => {
            const [, first] = itemsOf({ msgChallenge: '<b>Reto' });

            expect(first.prompt).toContain('&lt;b&gt;Reto 1.');
        });

        it('never goes on the main challenge, which is not one of them', () => {
            expect(itemsOf()[0].prompt).toBe(titled('Pandemia reto mundial'));
        });
    });

    it('does not number the list on top of the names they already carry', () => {
        expect(ChallengeWorksheetAdapter.build(challengeHtml(), {})?.unnumbered).toBe(true);
    });

    describe('what is never printed', () => {
        it('the solution to anything', () => {
            const printed = JSON.stringify(itemsOf({ challenges: [challenge()] }));

            expect(printed).not.toContain('Gripe española');
            expect(printed).not.toContain('G P Ñ');
        });

        it('the clues, which only the clock hands over', () => {
            // On paper they would all be visible at once, answering the questions being asked.
            expect(JSON.stringify(itemsOf())).not.toContain('Empieza por G');
        });
    });

    describe('where a description is read from', () => {
        it('the div beside the payload, which is the copy the pipeline rewrote', () => {
            const [main, first] = itemsOf({
                mainDiv: '<p>Del div</p>',
                challengeDivs: ['<p>Reto del div</p>'],
            });

            expect(main.extraText).toBe('<p>Del div</p>');
            expect(first.extraText).toBe('<p>Reto del div</p>');
        });

        it('the payload, for a project saved before the divs existed', () => {
            const [main, first] = itemsOf();

            expect(main.extraText).toBe('<p>Averigua qué pandemia fue</p>');
            expect(first.extraText).toBe('<p>Busca la fecha del primer caso</p>');
        });

        it('the payload again, where an empty div would leave the challenge with no words', () => {
            expect(itemsOf({ mainDiv: '' })[0].extraText).toBe('<p>Averigua qué pandemia fue</p>');
        });

        it('by position, the challenges keying their divs by nothing else', () => {
            const [, first, second] = itemsOf({
                challenges: [challenge({ title: 'Reto 1' }), challenge({ title: 'Reto 2' })],
                challengeDivs: ['<p>Primero</p>', '<p>Segundo</p>'],
            });

            expect(first.extraText).toBe('<p>Primero</p>');
            expect(second.extraText).toBe('<p>Segundo</p>');
        });
    });

    describe('instructions', () => {
        it('are read from the div before the payload', () => {
            const activity = ChallengeWorksheetAdapter.build(
                challengeHtml({ instructionsDiv: '<p>Del div</p>', instructionsExe: '<p>Del payload</p>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Del div</p>');
        });

        it('are taken raw from the payload, this iDevice not escaping them', () => {
            // Unescaping would rewrite a literal %41 an author typed into an A.
            const activity = ChallengeWorksheetAdapter.build(
                challengeHtml({ instructionsExe: '<p>Resuelve el %41 primero</p>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Resuelve el %41 primero</p>');
        });

        it('fall back to the plain copy', () => {
            const activity = ChallengeWorksheetAdapter.build(challengeHtml({ instructions: 'Completa todo' }), {});

            expect(activity?.instructions).toBe('Completa todo');
        });
    });

    it('strips anything unsafe the author left in the words', () => {
        const [main] = itemsOf({ desafioTitle: 'Hola<script>alert(1)</script>' });

        expect(main.prompt).toBe(titled('Hola'));
    });

    it('drops a video an author embedded in a description, a sheet having nothing to play it with', () => {
        const [main] = itemsOf({ desafioDescription: '<p>Mira<iframe src="https://v/1"></iframe></p>' });

        expect(main.extraText).toBe('<p>Mira</p>');
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(ChallengeWorksheetAdapter.build('<div class="desafio-IDevice"></div>', {})).toBeNull();
        });

        it('skips a challenge with neither a title nor any words', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { challenges: [challenge(), challenge({ title: '', description: '' })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(2);
            expect(omissions).toEqual(['invalid-data']);
        });

        it('prints the smaller challenges when the main one is empty', () => {
            const items = itemsOf({ desafioTitle: '', desafioDescription: '' });

            expect(items.map(item => item.prompt)).toEqual([numbered(1, 'Los primeros síntomas')]);
        });

        it('skips the activity when nothing survives', () => {
            expect(
                ChallengeWorksheetAdapter.build(
                    challengeHtml({ desafioTitle: '', desafioDescription: '', challenges: [] }),
                    {},
                ),
            ).toBeNull();
        });
    });

    it('prints a challenge that has a title and no words', () => {
        const [, first] = itemsOf({ challenges: [challenge({ description: '' })] });

        expect(first.prompt).toBe(numbered(1, 'Los primeros síntomas'));
        expect(first.extraText).toBeUndefined();
        expect(first.answer).toEqual(ANSWER);
    });
});
