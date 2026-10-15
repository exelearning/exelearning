import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getDialect } from './provider-dialects';

/**
 * Parity against the implementation these dialects were ported FROM.
 *
 * The media half had no parity gate, and that is how `open` came to accept any two
 * strings where the incumbent required a known provider and a well-formed id. This closes
 * the same hole for the player dialects: the reference is
 * `mod_exelearning/js/exe_media_host.js`, which exposes its pure command builders and
 * event parsers precisely so they can be checked.
 *
 * The reference lives in a sibling repository, so this spec SKIPS when that checkout is
 * absent rather than failing. A skipped parity gate is honest; a green one that silently
 * compared nothing is what a vacuous spec looks like, and this programme has already
 * produced one of those. The `it('has a reference to compare against')` case makes the
 * skip visible in the run instead of hiding it.
 */
/**
 * THREE references, not one. Moodle, WordPress and Omeka each ship the raw implementation,
 * and their byte counts differ (25 310 / 25 319 / 23 552), so agreeing with one proves
 * nothing about the others. Any divergence between them is itself a finding: it would mean
 * the canonical port has to choose, and the choice would need recording rather than
 * happening by whichever file was read first.
 *
 * The two repositories outside this checkout tree are addressed absolutely because that is
 * where they live; each is skipped independently when absent.
 */
const REFERENCES: Record<string, { policy: string; host: string }> = {
    moodle: {
        policy: '/Users/ernesto/Downloads/git/mod_exelearning_2/js/exe_media_policy.js',
        host: '/Users/ernesto/Downloads/git/mod_exelearning_2/js/exe_media_host.js',
    },
    wordpress: {
        policy: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/wp-exelearning_2/assets/js/exe-media-policy.js',
        host: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/wp-exelearning_2/assets/js/exe-media-host.js',
    },
    omeka: {
        policy: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/omeka-s-exelearning/asset/js/exe-media-policy.js',
        host: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/omeka-s-exelearning/asset/js/exe-media-host.js',
    },
};

const present = Object.entries(REFERENCES).filter(([, files]) => existsSync(files.host) && existsSync(files.policy));

function loadReference(files: { policy: string; host: string }): Record<string, (...args: unknown[]) => unknown> {
    const sandbox: Record<string, unknown> = {
        URL,
        JSON,
        console,
        document: {},
        location: { origin: 'https://lms.example' },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    runInNewContext(readFileSync(files.policy, 'utf8'), sandbox);
    runInNewContext(readFileSync(files.host, 'utf8'), sandbox);
    return (sandbox.exeMediaHost ?? {}) as Record<string, (...args: unknown[]) => unknown>;
}

describe('player dialects — parity with the implementation they came from', () => {
    it('reports which references it could reach', () => {
        const missing = Object.keys(REFERENCES).filter(name => !present.some(([found]) => found === name));
        if (missing.length) {
            console.warn(`[parity] references not found, gate did not run for: ${missing.join(', ')}`);
        }
        // Deliberately not an assertion: none of these repositories is a build dependency
        // of eXeLearning, and CI must not fail for their absence. The warning is the signal.
        expect(true).toBe(true);
    });

    if (!present.length) return;

    // Every reference must agree with the canonical dialects AND, by transitivity, with
    // each other — so a divergence between plugins surfaces here rather than in a browser.
    for (const [name, files] of present) {
        describe(name, () => runParityAgainst(loadReference(files)));
    }
});

function runParityAgainst(reference: Record<string, (...args: unknown[]) => unknown>) {
    describe('command encoding', () => {
        const cases: [string, 'play' | 'pause' | 'seek', number | undefined][] = [
            ['youtube', 'play', undefined],
            ['youtube', 'pause', undefined],
            ['youtube', 'seek', 12.5],
            ['youtube', 'seek', 0],
            ['vimeo', 'play', undefined],
            ['vimeo', 'pause', undefined],
            ['vimeo', 'seek', 12.5],
        ];

        for (const [provider, action, value] of cases) {
            it(`${provider}: ${action}${value === undefined ? '' : ` ${value}`}`, () => {
                const theirs = reference[provider === 'youtube' ? '_ytCommand' : '_vimeoCommand'](action, value);
                expect(getDialect(provider)?.encodeCommand(action, value)).toEqual(theirs as never);
            });
        }

        it('agrees that an unknown action produces nothing', () => {
            expect(reference._ytCommand('open', undefined)).toBeNull();
            expect(getDialect('youtube')?.encodeCommand('open' as never)).toBeNull();
        });
    });

    describe('event decoding', () => {
        const youtubeEvents = [
            { event: 'onReady' },
            { event: 'onError', info: 150 },
            { event: 'onStateChange', info: 1 },
            { event: 'onStateChange', info: { playerState: 2 } },
            { event: 'infoDelivery', info: { currentTime: 42.5, duration: 300, playerState: 1 } },
            { event: 'somethingElse' },
            { noEvent: true },
        ];

        const vimeoEvents = [
            { event: 'ready' },
            { event: 'play' },
            { event: 'pause' },
            { event: 'ended' },
            { event: 'finish' },
            { event: 'error' },
            { event: 'timeupdate', data: { seconds: 10, duration: 120 } },
            { event: 'timeupdate' },
            { event: 'unknown' },
        ];

        for (const raw of youtubeEvents) {
            it(`youtube: ${JSON.stringify(raw)}`, () => {
                const theirs = reference._parseYtEvent(JSON.stringify(raw));
                expect(getDialect('youtube')?.decodeEvent(JSON.stringify(raw))).toEqual(theirs as never);
            });
        }

        for (const raw of vimeoEvents) {
            it(`vimeo: ${JSON.stringify(raw)}`, () => {
                const theirs = reference._parseVimeoEvent(JSON.stringify(raw));
                expect(getDialect('vimeo')?.decodeEvent(JSON.stringify(raw))).toEqual(theirs as never);
            });
        }

        it('agrees that malformed input decodes to nothing', () => {
            for (const raw of ['not json at all', '', 'null']) {
                expect(reference._parseYtEvent(raw)).toBeNull();
                expect(getDialect('youtube')?.decodeEvent(raw)).toBeNull();
            }
        });
    });
}
