import { describe, expect, it } from 'bun:test';
import { decryptDataGame, encryptDataGame } from '../utils/dataGameCipher';
import { CAPTURE_FIELD, captureMolecules, type MoleculeView } from './moleculeCapture';

const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';
const MODEL = '\n  Mrv  \n\n  1  0  0  0  0  0            999 V2000\n';

/** Wrap a payload the way the iDevice stores it. */
function payloadHtml(data: Record<string, unknown>, wrapper = 'dmole-DataGame js-hidden'): string {
    return `<div class="dmole-IDevice"><div class="${wrapper}">${encryptDataGame(JSON.stringify(data))}</div></div>`;
}

/** Read back what a pass wrote, so the assertions are about stored data rather than about text. */
function storedQuestions(html: string): Record<string, unknown>[] {
    const stored = /<div class="dmole-DataGame[^"]*">([\s\S]*?)<\/div>/.exec(html);
    if (!stored) throw new Error('no payload in the html');

    return JSON.parse(decryptDataGame(stored[1])).selectsGame;
}

/** A renderer that always succeeds, recording what it was asked to draw. */
function recorder(image = PICTURE) {
    const seen: MoleculeView[] = [];
    return { seen, render: async (view: MoleculeView) => (seen.push(view), image) };
}

describe('captureMolecules', () => {
    it('leaves alone html that carries no molecules', async () => {
        const html = '<div class="text-IDevice"><p>Sin moléculas</p></div>';

        expect(await captureMolecules(html, async () => PICTURE)).toBe(html);
    });

    it('leaves alone empty html', async () => {
        expect(await captureMolecules('', async () => PICTURE)).toBe('');
    });

    it('writes the picture in beside the model it came from', async () => {
        const html = payloadHtml({ selectsGame: [{ modelData: MODEL, modelFormat: 'sdf' }] });

        const [question] = storedQuestions(await captureMolecules(html, async () => PICTURE));

        expect(question[CAPTURE_FIELD]).toBe(PICTURE);
        // The model stays: the payload is still the activity's, and still playable.
        expect(question.modelData).toBe(MODEL);
    });

    it('hands the renderer everything the activity stored about the view', async () => {
        const { seen, render } = recorder();
        const view = {
            modelData: MODEL,
            modelFormat: 'sdf',
            modelStyle: 'sphere',
            bgDark: true,
            cameraView: [1, 2, 3],
        };

        await captureMolecules(payloadHtml({ selectsGame: [view] }), render);

        expect(seen[0]).toMatchObject(view);
    });

    it('draws every molecule in the payload', async () => {
        const { seen, render } = recorder();
        const html = payloadHtml({
            selectsGame: [
                { modelData: MODEL, modelFormat: 'sdf' },
                { modelData: MODEL, modelFormat: 'pdb' },
            ],
        });

        const questions = storedQuestions(await captureMolecules(html, render));

        expect(seen).toHaveLength(2);
        expect(questions.map(q => q[CAPTURE_FIELD])).toEqual([PICTURE, PICTURE]);
    });

    it('opens every payload in the html, a page holding more than one activity', async () => {
        const { seen, render } = recorder();
        const html =
            payloadHtml({ selectsGame: [{ modelData: MODEL }] }) + payloadHtml({ selectsGame: [{ modelData: MODEL }] });

        await captureMolecules(html, render);

        expect(seen).toHaveLength(2);
    });

    it('keeps the rest of the payload as it was', async () => {
        const html = payloadHtml({
            activityMode: 'show',
            percentajeQuestions: 50,
            selectsGame: [{ modelData: MODEL, quextion: '¿Cuál es?' }],
        });

        const stored = /<div class="dmole-DataGame[^"]*">([\s\S]*?)<\/div>/.exec(
            await captureMolecules(html, async () => PICTURE),
        );
        const data = JSON.parse(decryptDataGame((stored as RegExpExecArray)[1]));

        expect(data.activityMode).toBe('show');
        expect(data.percentajeQuestions).toBe(50);
        expect(data.selectsGame[0].quextion).toBe('¿Cuál es?');
    });

    it('skips a question that has no model to draw', async () => {
        const { seen, render } = recorder();
        const html = payloadHtml({ selectsGame: [{ quextion: 'Sin modelo' }, { modelData: MODEL }] });

        const questions = storedQuestions(await captureMolecules(html, render));

        expect(seen).toHaveLength(1);
        expect(questions[0][CAPTURE_FIELD]).toBeUndefined();
        expect(questions[1][CAPTURE_FIELD]).toBe(PICTURE);
    });

    it('leaves the payload untouched when nothing could be drawn', async () => {
        const html = payloadHtml({ selectsGame: [{ modelData: MODEL }] });

        expect(await captureMolecules(html, async () => null)).toBe(html);
    });

    it('carries on past a molecule that will not draw', async () => {
        // One picture missing from the sheet, not a sheet that fails to appear.
        const html = payloadHtml({
            selectsGame: [
                { modelData: MODEL, modelFormat: 'sdf' },
                { modelData: MODEL, modelFormat: 'pdb' },
            ],
        });
        const render = async (view: MoleculeView) => {
            if (view.modelFormat === 'sdf') throw new Error('no WebGL');
            return PICTURE;
        };

        const questions = storedQuestions(await captureMolecules(html, render));

        expect(questions[0][CAPTURE_FIELD]).toBeUndefined();
        expect(questions[1][CAPTURE_FIELD]).toBe(PICTURE);
    });

    it('leaves an unreadable payload for the adapter to report', async () => {
        const html = '<div class="dmole-DataGame">no es un payload</div>';

        expect(await captureMolecules(html, async () => PICTURE)).toBe(html);
    });

    it('leaves a payload with no questions in it', async () => {
        const html = payloadHtml({ activityMode: 'show' });

        expect(await captureMolecules(html, async () => PICTURE)).toBe(html);
    });

    it('leaves an empty payload div', async () => {
        const html = '<div class="dmole-DataGame js-hidden"></div>';

        expect(await captureMolecules(html, async () => PICTURE)).toBe(html);
    });
});
