/**
 * Every game runtime keeps one options entry per activity and every handler
 * looks it up as options[i], where i is the activity's position on the page.
 * loadGame() skips activities that are already running (no DataGame left), so
 * it must neither wipe their entries nor push the new ones out of position:
 * either way a handler reads options[i] === undefined ('msgs', 'gameStarted',
 * 'questionsGame', 'solution'... in Sentry).
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const baseDir = dirname(fileURLToPath(import.meta.url));

const runtimes = readdirSync(baseDir)
    .map((name) => join(baseDir, name, 'export', `${name}.js`))
    .filter((file) => existsSync(file))
    .map((file) => ({ file, code: readFileSync(file, 'utf-8') }))
    .filter(({ code }) => code.includes('Skip already initialized activities'));

function loadGameBody(code) {
    const start = code.indexOf('\n    loadGame: function');
    return code.slice(start, code.indexOf('\n    },', start));
}

describe('game runtimes keep options aligned with their activities', () => {
    it('finds the game runtimes', () => {
        expect(runtimes.length).toBeGreaterThan(20);
    });

    it.each(runtimes.map(({ file, code }) => [file.slice(baseDir.length + 1), code]))(
        '%s stores options by activity index',
        (_file, code) => {
            const body = loadGameBody(code);
            expect(body).not.toMatch(/\.options\s*=\s*\[\]/);
            expect(body).not.toMatch(/\.options\.push\(/);
        }
    );

    it.each(
        runtimes
            .filter(({ code }) => /\.options\.length\s*=/.test(loadGameBody(code)))
            .map(({ file, code }) => [file.slice(baseDir.length + 1), code])
    )(
        '%s starts with an options array (setting .length on {} keeps it an object)',
        (_file, code) => {
            expect(code).toMatch(/\n {4}options: \[\],/);
        }
    );
});
