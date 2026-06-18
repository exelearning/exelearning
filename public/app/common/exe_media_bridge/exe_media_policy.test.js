/**
 * Unit tests for exe_media_policy — the pure, framework-free policy module that
 * powers the external-media bridge (provider detection/normalization + message
 * validation). Single source of truth shared by the child runtime and the
 * reference parent relay.
 *
 * The module is a classic browser script (no ESM exports) that assigns
 * `globalThis.exeMediaPolicy`. Importing it for its side effect both runs it and
 * lets the coverage instrument see it.
 */

import './exe_media_policy.js';

const policy = globalThis.exeMediaPolicy;

describe('exe_media_policy', () => {
    it('is exposed on the global as an object', () => {
        expect(policy).toBeTruthy();
        expect(typeof policy.parseExternalMedia).toBe('function');
        expect(typeof policy.canonicalEmbedUrl).toBe('function');
        expect(typeof policy.validateCommand).toBe('function');
        expect(typeof policy.validateEvent).toBe('function');
    });

    describe('parseExternalMedia — YouTube', () => {
        const id = 'dQw4w9WgXcQ';
        const cases = [
            `https://www.youtube.com/watch?v=${id}`,
            `https://youtube.com/watch?v=${id}&t=42s`,
            `https://m.youtube.com/watch?v=${id}`,
            `https://youtu.be/${id}`,
            `https://youtu.be/${id}?t=10`,
            `https://www.youtube.com/embed/${id}`,
            `https://www.youtube-nocookie.com/embed/${id}`,
            `https://www.youtube.com/shorts/${id}`,
            `http://www.youtube.com/watch?v=${id}`, // http upgraded
        ];
        for (const url of cases) {
            it(`recognizes ${url}`, () => {
                const d = policy.parseExternalMedia(url);
                expect(d).toBeTruthy();
                expect(d.provider).toBe('youtube');
                expect(d.providerVideoId).toBe(id);
                expect(d.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
                expect(d.originalUrl).toBe(url);
            });
        }
    });

    describe('parseExternalMedia — Vimeo', () => {
        const id = '76979871';
        const cases = [
            `https://vimeo.com/${id}`,
            `https://www.vimeo.com/${id}`,
            `https://player.vimeo.com/video/${id}`,
            `https://player.vimeo.com/video/${id}?h=abc123&title=0`,
            `https://vimeo.com/${id}/privacyhash`,
        ];
        for (const url of cases) {
            it(`recognizes ${url}`, () => {
                const d = policy.parseExternalMedia(url);
                expect(d).toBeTruthy();
                expect(d.provider).toBe('vimeo');
                expect(d.providerVideoId).toBe(id);
                expect(d.embedUrl).toBe(`https://player.vimeo.com/video/${id}`);
            });
        }
    });

    describe('parseExternalMedia — rejection', () => {
        const rejected = [
            'https://example.com/video',
            'https://evil.com/watch?v=dQw4w9WgXcQ', // right query, wrong host
            'https://user@youtube.com/watch?v=dQw4w9WgXcQ', // userinfo
            'ftp://youtube.com/watch?v=dQw4w9WgXcQ', // scheme
            'javascript:alert(1)',
            'not a url',
            '',
            null,
            undefined,
            'https://youtube.com/watch?v=short', // bad id length
            'https://vimeo.com/', // empty path segment
            'https://www.youtube.com/', // no id
        ];
        for (const url of rejected) {
            it(`rejects ${JSON.stringify(url)}`, () => {
                expect(policy.parseExternalMedia(url)).toBeNull();
            });
        }
    });

    describe('parseExternalMedia — element input', () => {
        it('reads src from an iframe-like element', () => {
            const el = document.createElement('iframe');
            el.setAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
            el.setAttribute('title', 'Never Gonna');
            const d = policy.parseExternalMedia(el);
            expect(d.provider).toBe('youtube');
            expect(d.title).toBe('Never Gonna');
        });

        it('reads href from an anchor-like element', () => {
            const el = document.createElement('a');
            el.setAttribute('href', 'https://vimeo.com/76979871');
            const d = policy.parseExternalMedia(el);
            expect(d.provider).toBe('vimeo');
        });
    });

    describe('parseExternalMedia — PDF (deferred, fallback only)', () => {
        it('recognizes a .pdf url as the pdf provider with the original url', () => {
            const d = policy.parseExternalMedia('https://example.org/files/guide.pdf');
            expect(d.provider).toBe('pdf');
            expect(d.embedUrl).toBe('https://example.org/files/guide.pdf');
            // PDF carries no opaque-safe id; it degrades to open-in-new-tab.
            expect(d.requiresBridge).toBe(false);
        });
    });

    describe('canonicalEmbedUrl', () => {
        it('builds the nocookie youtube embed from a bare id', () => {
            expect(policy.canonicalEmbedUrl('youtube', 'dQw4w9WgXcQ')).toBe(
                'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            );
        });
        it('builds the vimeo player url from a bare id', () => {
            expect(policy.canonicalEmbedUrl('vimeo', '76979871')).toBe('https://player.vimeo.com/video/76979871');
        });
        it('returns null for an unknown provider', () => {
            expect(policy.canonicalEmbedUrl('dailymotion', '123')).toBeNull();
        });
        it('returns null for an id that fails the provider regex', () => {
            expect(policy.canonicalEmbedUrl('youtube', 'bad id ../')).toBeNull();
            expect(policy.canonicalEmbedUrl('vimeo', 'NaN')).toBeNull();
        });
    });

    describe('message protocol — handshake', () => {
        it('isHello accepts a well-formed hello', () => {
            expect(policy.isHello({ type: 'exe-media', v: 1, action: 'hello', helloId: 'abc' })).toBe(true);
        });
        it('isHello rejects wrong type/version/action/missing id', () => {
            expect(policy.isHello({ type: 'x', v: 1, action: 'hello', helloId: 'a' })).toBe(false);
            expect(policy.isHello({ type: 'exe-media', v: 2, action: 'hello', helloId: 'a' })).toBe(false);
            expect(policy.isHello({ type: 'exe-media', v: 1, action: 'play', helloId: 'a' })).toBe(false);
            expect(policy.isHello({ type: 'exe-media', v: 1, action: 'hello' })).toBe(false);
            expect(policy.isHello(null)).toBe(false);
            expect(policy.isHello('hello')).toBe(false);
        });
        it('isWelcome accepts a well-formed welcome with nonce + helloId', () => {
            expect(
                policy.isWelcome({ type: 'exe-media', v: 1, action: 'welcome', helloId: 'a', exelearningBridge: 'n' }),
            ).toBe(true);
        });
        it('isWelcome rejects missing nonce', () => {
            expect(policy.isWelcome({ type: 'exe-media', v: 1, action: 'welcome', helloId: 'a' })).toBe(false);
        });
    });

    describe('validateCommand', () => {
        const N = 'nonce-123';
        const cmd = (extra) => ({ type: 'exe-media', v: 1, exelearningBridge: N, ...extra });

        it('accepts a valid open with provider+videoId', () => {
            expect(
                policy.validateCommand(cmd({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' }), N),
            ).toBe(true);
        });
        it('accepts bare play/pause/hide/show/close', () => {
            for (const action of ['play', 'pause', 'hide', 'show', 'close']) {
                expect(policy.validateCommand(cmd({ action }), N)).toBe(true);
            }
        });
        it('accepts seek with a finite non-negative t', () => {
            expect(policy.validateCommand(cmd({ action: 'seek', t: 12.5 }), N)).toBe(true);
        });
        it('rejects a wrong nonce', () => {
            expect(policy.validateCommand(cmd({ action: 'play' }), 'other')).toBe(false);
        });
        it('rejects a missing/empty expected nonce (the !! guard)', () => {
            expect(policy.validateCommand(cmd({ action: 'play' }), '')).toBe(false);
            expect(policy.validateCommand(cmd({ action: 'play' }), undefined)).toBe(false);
        });
        it('rejects an unknown action', () => {
            expect(policy.validateCommand(cmd({ action: 'evalThis' }), N)).toBe(false);
        });
        it('rejects open with an unsupported provider', () => {
            expect(
                policy.validateCommand(cmd({ action: 'open', reqId: 1, provider: 'evil', videoId: 'x' }), N),
            ).toBe(false);
        });
        it('rejects open with a bad videoId', () => {
            expect(
                policy.validateCommand(cmd({ action: 'open', reqId: 1, provider: 'youtube', videoId: '../etc' }), N),
            ).toBe(false);
        });
        it('rejects open without a reqId', () => {
            expect(
                policy.validateCommand(cmd({ action: 'open', provider: 'youtube', videoId: 'dQw4w9WgXcQ' }), N),
            ).toBe(false);
        });
        it('rejects seek with a non-finite/negative t', () => {
            expect(policy.validateCommand(cmd({ action: 'seek', t: -1 }), N)).toBe(false);
            expect(policy.validateCommand(cmd({ action: 'seek', t: Infinity }), N)).toBe(false);
            expect(policy.validateCommand(cmd({ action: 'seek' }), N)).toBe(false);
        });
        it('rejects a wrong envelope (type/version)', () => {
            expect(policy.validateCommand({ type: 'x', v: 1, action: 'play', exelearningBridge: N }, N)).toBe(false);
            expect(policy.validateCommand({ type: 'exe-media', v: 9, action: 'play', exelearningBridge: N }, N)).toBe(
                false,
            );
        });
        it('rejects a non-object / prototype-pollution payload', () => {
            expect(policy.validateCommand(null, N)).toBe(false);
            expect(policy.validateCommand(JSON.parse('{"__proto__":{"x":1},"type":"exe-media","v":1}'), N)).toBe(false);
        });
        it('accepts open with a finite start offset and rejects a bad one', () => {
            expect(
                policy.validateCommand(
                    cmd({ action: 'open', reqId: 2, provider: 'vimeo', videoId: '76979871', start: 30 }),
                    N,
                ),
            ).toBe(true);
            expect(
                policy.validateCommand(
                    cmd({ action: 'open', reqId: 2, provider: 'vimeo', videoId: '76979871', start: -5 }),
                    N,
                ),
            ).toBe(false);
        });
        it('validates getCurrentTime/getDuration require an integer reqId', () => {
            expect(policy.validateCommand(cmd({ action: 'getCurrentTime', reqId: 7 }), N)).toBe(true);
            expect(policy.validateCommand(cmd({ action: 'getDuration', reqId: 7 }), N)).toBe(true);
            expect(policy.validateCommand(cmd({ action: 'getCurrentTime' }), N)).toBe(false);
        });
    });

    describe('validateEvent', () => {
        const ev = (extra) => ({ type: 'exe-media', v: 1, ...extra });
        it('accepts ready/play/pause/ended/closed', () => {
            for (const action of ['ready', 'play', 'pause', 'ended', 'closed']) {
                expect(policy.validateEvent(ev({ action }))).toBe(true);
            }
        });
        it('accepts timeupdate with finite currentTime+duration', () => {
            expect(policy.validateEvent(ev({ action: 'timeupdate', currentTime: 3, duration: 100 }))).toBe(true);
        });
        it('rejects timeupdate with bad numbers', () => {
            expect(policy.validateEvent(ev({ action: 'timeupdate', currentTime: -1, duration: 100 }))).toBe(false);
            expect(policy.validateEvent(ev({ action: 'timeupdate', currentTime: 'x', duration: 100 }))).toBe(false);
        });
        it('accepts seeked with a finite currentTime and rejects a bad one', () => {
            expect(policy.validateEvent(ev({ action: 'seeked', currentTime: 5 }))).toBe(true);
            expect(policy.validateEvent(ev({ action: 'seeked', currentTime: -1 }))).toBe(false);
        });
        it('accepts state with an integer reqId (optional time/duration)', () => {
            expect(policy.validateEvent(ev({ action: 'state', reqId: 3, currentTime: 1, duration: 9 }))).toBe(true);
            expect(policy.validateEvent(ev({ action: 'state' }))).toBe(false);
        });
        it('accepts ready with a finite duration', () => {
            expect(policy.validateEvent(ev({ action: 'ready', duration: 120 }))).toBe(true);
            expect(policy.validateEvent(ev({ action: 'ready', duration: -3 }))).toBe(false);
        });
        it('accepts error with code+fatal', () => {
            expect(policy.validateEvent(ev({ action: 'error', code: 'x', fatal: true }))).toBe(true);
        });
        it('rejects unknown event actions and bad envelopes', () => {
            expect(policy.validateEvent(ev({ action: 'mystery' }))).toBe(false);
            expect(policy.validateEvent({ type: 'x', v: 1, action: 'ready' })).toBe(false);
            expect(policy.validateEvent(null)).toBe(false);
        });
    });
});
