import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { PadlockWorksheetAdapter } from './PadlockWorksheetAdapter';

interface PadlockFixture {
    instructions?: string;
    feedback?: string;
    /** The combination, which the editor keeps in the payload. */
    solution?: string;
}

/** A component as the editor writes one: both texts in their own divs, emptied in the payload. */
function padlockHtml(fixture: PadlockFixture = {}): string {
    const payload = JSON.stringify({
        candadoSolution: fixture.solution ?? '1234',
        // The editor writes these as empty strings and keeps the real content in the divs.
        candadoInstructions: '',
        candadoRetro: '',
        candadoAttemps: 3,
    });

    let html = '<div class="candado-IDevice"><div class="candado-version js-hidden">1</div>';
    if (fixture.instructions !== undefined)
        html += `<div class="candado-instructions js-hidden">${fixture.instructions}</div>`;
    if (fixture.feedback !== undefined) html += `<div class="candado-retro js-hidden">${fixture.feedback}</div>`;
    html += `<div class="candado-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

    return html;
}

function build(fixture: PadlockFixture = {}, options = {}) {
    return PadlockWorksheetAdapter.build(
        padlockHtml({ instructions: '<p>Busca el código en la unidad</p>', feedback: '<p>La célula</p>', ...fixture }),
        options,
    );
}

describe('PadlockWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(PadlockWorksheetAdapter.ideviceType).toBe('padlock');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(build({}, { title: 'Candado' })?.title).toBe('Candado');
        expect(build()?.title).toBe('Padlock');
    });

    it('prints the instructions, and the feedback under them', () => {
        const activity = build();

        expect(activity?.instructions).toBe('<p>Busca el código en la unidad</p>');
        expect(activity?.items).toHaveLength(1);
        expect(activity?.items[0].prompt).toBe('<p>La célula</p>');
    });

    it('asks nothing, there being no lock to open on paper', () => {
        expect(build()?.items[0].answer).toBeUndefined();
    });

    it('never prints the combination', () => {
        expect(JSON.stringify(build({ solution: 'SECRETO' }))).not.toContain('SECRETO');
    });

    it('reads both from their divs, the payload keeping them empty', () => {
        // The editor writes `candadoInstructions` and `candadoRetro` as empty strings.
        const activity = build({ instructions: '<p>Del div</p>', feedback: '<p>También del div</p>' });

        expect(activity?.instructions).toBe('<p>Del div</p>');
        expect(activity?.items[0].prompt).toBe('<p>También del div</p>');
    });

    it('prints the instructions alone when the lock guards nothing', () => {
        const activity = PadlockWorksheetAdapter.build(padlockHtml({ instructions: '<p>Sólo esto</p>' }), {});

        expect(activity?.instructions).toBe('<p>Sólo esto</p>');
        expect(activity?.items).toEqual([]);
    });

    it('prints the feedback alone when the author wrote no instructions', () => {
        const activity = PadlockWorksheetAdapter.build(padlockHtml({ feedback: '<p>Sólo esto</p>' }), {});

        expect(activity?.instructions).toBeUndefined();
        expect(activity?.items[0].prompt).toBe('<p>Sólo esto</p>');
    });

    it('strips anything unsafe the author left in either', () => {
        const activity = build({
            instructions: '<p>Hola<script>alert(1)</script></p>',
            feedback: '<p>Adiós<img src=x onerror=alert(2)></p>',
        });

        expect(activity?.instructions).toBe('<p>Hola</p>');
        // The picture is content and stays; what goes is the handler hung off it.
        expect(activity?.items[0].prompt).toBe('<p>Adiós<img src="x" /></p>');
    });

    describe('what cannot be printed', () => {
        it('skips a component with neither text in it', () => {
            expect(PadlockWorksheetAdapter.build(padlockHtml(), {})).toBeNull();
            expect(PadlockWorksheetAdapter.build('<div class="candado-IDevice"></div>', {})).toBeNull();
        });

        it('skips one whose texts are empty', () => {
            expect(PadlockWorksheetAdapter.build(padlockHtml({ instructions: '  ', feedback: '' }), {})).toBeNull();
        });
    });
});
