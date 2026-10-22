/**
 * The bits of the harness more than one entry point needs.
 *
 * The walks, the cards and the provenance probe each grew their own copy of "log into
 * Moodle" and "wait for the promoted players to finish loading". Three copies of a login
 * flow means Moodle changing its form breaks the run in three places and gets fixed in two.
 */
import { execFileSync } from 'node:child_process';

/**
 * Establish a Moodle session with curl and return the session cookie.
 *
 * Driven through curl rather than the browser because Moodle's login form rejects a
 * scripted browser submission; the cookie is then injected into the browser context.
 *
 * @param {string} jar Path to the cookie jar for this run.
 * @param {{url: string, user: string, pass: string}} credentials
 * @returns {string} The MoodleSession value, or '' if login failed.
 */
export function moodleSession(jar, { url, user, pass }) {
    const page = execFileSync('curl', ['-s', '-c', jar, url], { encoding: 'utf8' });
    const token = /name="logintoken" value="([^"]+)/.exec(page)?.[1] ?? '';
    execFileSync('curl', [
        '-s', '-b', jar, '-c', jar, '-o', '/dev/null', '-L', '-X', 'POST', url,
        '--data-urlencode', `username=${user}`,
        '--data-urlencode', `password=${pass}`,
        '--data-urlencode', `logintoken=${token}`,
    ]);
    const session = /MoodleSession\s+(\S+)/.exec(execFileSync('grep', ['-i', 'MoodleSession', jar], { encoding: 'utf8' }));
    return session?.[1] ?? '';
}

/**
 * Wait for every promoted player to FINISH loading, then let it paint.
 *
 * Providers do not paint at the same speed: YouTube shows its poster almost at once, Vimeo
 * takes several seconds. A fixed pause tuned to the fast one photographs the slow one as a
 * black rectangle, which reads in the report as "the isolation broke the video" when the
 * video was merely still on its way. `load` fires on a cross-origin iframe, so this is
 * observable from the trusted page without reading into the frame.
 *
 * @param {import('@playwright/test').Page} page The trusted page holding the overlays.
 */
export async function waitForPromotedPlayers(page) {
    await page
        .waitForFunction(
            () =>
                Array.from(document.querySelectorAll('.exe-embed-overlay iframe')).every(f => {
                    const frame = f;
                    if (frame.__exeLoaded) return true;
                    frame.addEventListener('load', () => {
                        frame.__exeLoaded = true;
                    });
                    return false;
                }),
            undefined,
            { timeout: 20_000, polling: 250 },
        )
        .catch(() => {});
    // The provider still needs a beat to paint its first frame after `load`.
    await page.waitForTimeout(1200);
}
