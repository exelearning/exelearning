/**
 * Whether a print package needs MathJax.
 *
 * An export pre-renders the formulas on its pages, but the print preview converts the
 * activities again from their data when printing, and the worksheet sanitizer drops a
 * pre-rendered formula. So the preview renders those formulas itself, with the MathJax of
 * the package. It goes in only when the author asked for it or the printed content has
 * LaTeX; most such packages already carry it for its accessibility menu.
 */
import type { ExportPage } from './interfaces';
import { decryptDataGame } from './utils/dataGameCipher';

// The test the preview applies before loading MathJax: LatexPreRenderer.hasLatex.
const HAS_LATEX = /\\\(|\\\[|\$\$|\\begin\{|\\(?:eq)?ref\{/;
const DATA_GAME = /<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

function dataGamesHaveLatex(html: string | undefined): boolean {
    if (!html || !/DataGame/i.test(html)) return false;
    for (const [, encrypted] of html.matchAll(DATA_GAME)) {
        if (HAS_LATEX.test(decryptDataGame(encrypted.trim()))) return true;
    }
    return false;
}

/**
 * Whether printing these pages can meet a formula: in a title, an HTML fragment, a property
 * of a JSON activity or the encrypted data of a game.
 *
 * @param pages - The pages of the print package
 */
export function printPagesHaveLatex(pages: ExportPage[]): boolean {
    // JSON keeps the backslash of every delimiter, so one test covers every string at any depth.
    if (HAS_LATEX.test(JSON.stringify(pages))) return true;
    return pages.some(page =>
        (page.blocks || []).some(block =>
            (block.components || []).some(component => dataGamesHaveLatex(component.content)),
        ),
    );
}
