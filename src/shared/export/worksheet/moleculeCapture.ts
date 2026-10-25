/**
 * Turning a stored molecule into a picture, before the sheet is built
 *
 * Electrical circuits keeps its diagram twice — the TikZ source and the SVG it was rendered into —
 * so a worksheet can simply print the second one. The 3D viewer keeps only the first half: the
 * molecule as an SDF or PDB file, plus the style and the camera angle the author settled on. What
 * a reader sees is drawn by WebGL from those, and nothing about it is stored.
 *
 * An adapter cannot draw it. Adapters are pure functions over stored data with no DOM, which is
 * what lets them run under Bun for a command-line export, so the drawing has to be made before the
 * adapter is asked for an exercise. That is what this pass does: it opens each payload, asks the
 * caller to render every molecule in it, writes the results back in, and closes it again — the same
 * shape as the LaTeX pass that already runs over these payloads.
 *
 * The rendering itself is the caller's, injected. Only a browser can do it, so keeping it out of
 * here is what makes the pass testable without a graphics stack, and what lets a command-line
 * export skip it rather than fail: with nothing supplied, the questions simply print without their
 * molecules.
 */

import { decryptDataGame, encryptDataGame } from '../utils/dataGameCipher';

/** Where a capture is written, so the adapter finds it beside the model it came from. */
export const CAPTURE_FIELD = 'modelImage';

/** What one molecule needs to be drawn, as the activity stored it. */
export interface MoleculeView {
    /** The model file's text: SDF, PDB or whatever `modelFormat` says. */
    modelData?: string;
    modelFormat?: string;
    /** How the author had it drawn: 'stick', 'sphere', 'cartoon'… */
    modelStyle?: string;
    /** Whether the author set a dark background. */
    bgDark?: boolean;
    /** The camera the author left it at, so the print matches what they framed. */
    cameraView?: number[];
}

/**
 * Draws one molecule and returns a picture of it.
 *
 * @returns A data URI, or null when this one cannot be drawn
 */
export type MoleculeRenderer = (view: MoleculeView) => Promise<string | null>;

/** Class of the payload this pass opens. */
const PAYLOAD_CLASS = 'dmole-DataGame';

/** A payload div and the text inside it. */
const PAYLOAD_PATTERN = new RegExp(`<div[^>]*class="[^"]*${PAYLOAD_CLASS}[^"]*"[^>]*>([\\s\\S]*?)</div>`, 'gi');

/** One question, of which only the model half matters here. */
interface StoredQuestion extends MoleculeView {
    [CAPTURE_FIELD]?: string;
}

/**
 * Draw every molecule in one payload.
 *
 * @returns The questions with their captures written in, or null when none could be drawn
 */
async function captureQuestions(
    questions: StoredQuestion[],
    render: MoleculeRenderer,
): Promise<StoredQuestion[] | null> {
    let drawn = 0;
    const captured = [];

    for (const question of questions) {
        // A question whose model is missing has nothing to draw; it still prints its words.
        if (!question?.modelData) {
            captured.push(question);
            continue;
        }

        try {
            const image = await render(question);
            if (!image) {
                captured.push(question);
                continue;
            }
            captured.push({ ...question, [CAPTURE_FIELD]: image });
            drawn++;
        } catch {
            // One molecule that will not draw is one picture missing from the sheet, not a sheet
            // that fails to appear.
            captured.push(question);
        }
    }

    return drawn > 0 ? captured : null;
}

/**
 * Draw the molecules in a component's stored HTML.
 *
 * Called before the adapter is asked for an exercise, on the component as it is stored. Anything
 * that cannot be drawn is left as it was, so the worst case is a question printed without its
 * picture.
 *
 * @param html - The component's stored HTML
 * @param render - How to draw one molecule; supplied by whoever has a browser
 * @returns The HTML, with every molecule that could be drawn carrying its picture
 */
export async function captureMolecules(html: string, render: MoleculeRenderer): Promise<string> {
    if (!html || !html.includes(PAYLOAD_CLASS)) return html;

    let result = html;

    for (const match of [...html.matchAll(PAYLOAD_PATTERN)]) {
        const [payloadDiv, stored] = match;
        const encrypted = stored.trim();
        if (!encrypted) continue;

        try {
            const data = JSON.parse(decryptDataGame(encrypted));
            if (!data || !Array.isArray(data.selectsGame)) continue;

            const captured = await captureQuestions(data.selectsGame, render);
            if (!captured) continue;

            const reopened = encryptDataGame(JSON.stringify({ ...data, selectsGame: captured }));
            result = result.replace(payloadDiv, payloadDiv.replace(encrypted, reopened));
        } catch {
            // An unreadable payload is the adapter's problem to report, not this pass's to solve.
        }
    }

    return result;
}
