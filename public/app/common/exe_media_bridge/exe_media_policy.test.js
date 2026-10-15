import { describe, expect, it } from 'vitest';
import './exe_media_policy.js';

const policy = window.exeMediaPolicy;

function envelope(action, extra = {}) {
    return { type: policy.TYPE, v: policy.VERSION, action, ...extra };
}

describe('exeMediaPolicy', () => {
    describe('parseExternalMedia', () => {
        it('parses YouTube watch, embed, shorts and youtu.be URLs', () => {
            expect(policy.parseExternalMedia('https://www.youtube.com/watch?v=dQw4w9WgXcQ').providerVideoId).toBe(
                'dQw4w9WgXcQ',
            );
            expect(policy.parseExternalMedia('https://youtube.com/embed/dQw4w9WgXcQ').embedUrl).toBe(
                'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            );
            expect(policy.parseExternalMedia('https://www.youtube.com/shorts/dQw4w9WgXcQ').provider).toBe('youtube');
            expect(policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ').providerVideoId).toBe('dQw4w9WgXcQ');
        });

        it('parses Vimeo page and player URLs', () => {
            expect(policy.parseExternalMedia('https://vimeo.com/76979871').providerVideoId).toBe('76979871');
            expect(policy.parseExternalMedia('https://player.vimeo.com/video/76979871').embedUrl).toBe(
                'https://player.vimeo.com/video/76979871',
            );
        });

        it('treats a .pdf path as a deferred open-in-new-tab descriptor', () => {
            const d = policy.parseExternalMedia('https://example.com/notes.PDF');
            expect(d.provider).toBe('pdf');
            expect(d.requiresBridge).toBe(false);
            expect(d.aspectRatio).toBeUndefined();
        });

        it('reads src/href/title from an element', () => {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            iframe.setAttribute('title', 'Never Gonna Give You Up');
            const d = policy.parseExternalMedia(iframe);
            expect(d.title).toBe('Never Gonna Give You Up');
            expect(d.provider).toBe('youtube');
        });

        it('rejects userinfo, non-http schemes, look-alike hosts and malformed ids', () => {
            expect(policy.parseExternalMedia('https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
            expect(policy.parseExternalMedia('javascript:alert(1)')).toBeNull();
            expect(policy.parseExternalMedia('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
            expect(policy.parseExternalMedia('https://youtu.be/short')).toBeNull();
            expect(policy.parseExternalMedia('https://vimeo.com/not-a-number')).toBeNull();
            expect(policy.parseExternalMedia('')).toBeNull();
            expect(policy.parseExternalMedia('not a url')).toBeNull();
            expect(policy.parseExternalMedia(null)).toBeNull();
        });
    });

    describe('canonicalEmbedUrl / id checks', () => {
        it('rebuilds privacy-preserving URLs and refuses unknown shapes', () => {
            expect(policy.canonicalEmbedUrl('youtube', 'dQw4w9WgXcQ')).toBe(
                'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            );
            expect(policy.canonicalEmbedUrl('vimeo', '76979871')).toBe('https://player.vimeo.com/video/76979871');
            expect(policy.canonicalEmbedUrl('youtube', 'nope')).toBeNull();
            expect(policy.canonicalEmbedUrl('other', 'dQw4w9WgXcQ')).toBeNull();
        });

        it('allow-lists only youtube and vimeo', () => {
            expect(policy.isAllowedProvider('youtube')).toBe(true);
            expect(policy.isAllowedProvider('vimeo')).toBe(true);
            expect(policy.isAllowedProvider('pdf')).toBe(false);
        });
    });

    describe('handshake validators', () => {
        it('accepts a hello with a non-empty helloId', () => {
            expect(policy.isHello(envelope('hello', { helloId: 'h1' }))).toBe(true);
            expect(policy.isHello(envelope('hello', { helloId: '' }))).toBe(false);
            expect(policy.isHello({ type: 'other', action: 'hello', helloId: 'h1' })).toBe(false);
        });

        it('accepts a welcome that echoes the helloId and carries a nonce', () => {
            expect(policy.isWelcome(envelope('welcome', { helloId: 'h1', exelearningBridge: 'n1' }))).toBe(true);
            expect(policy.isWelcome(envelope('welcome', { helloId: 'h1', exelearningBridge: '' }))).toBe(false);
        });
    });

    describe('validateCommand', () => {
        const nonce = 'secret-nonce';

        it('requires the envelope, a present matching nonce, and a known action', () => {
            expect(policy.validateCommand(envelope('play', { exelearningBridge: nonce }), nonce)).toBe(true);
            expect(policy.validateCommand(envelope('play', { exelearningBridge: nonce }), '')).toBe(false);
            expect(policy.validateCommand(envelope('play', { exelearningBridge: 'other' }), nonce)).toBe(false);
            expect(policy.validateCommand(envelope('explode', { exelearningBridge: nonce }), nonce)).toBe(false);
        });

        it('validates open / seek / time requests', () => {
            expect(
                policy.validateCommand(
                    envelope('open', {
                        exelearningBridge: nonce,
                        reqId: 1,
                        provider: 'youtube',
                        videoId: 'dQw4w9WgXcQ',
                    }),
                    nonce,
                ),
            ).toBe(true);
            expect(
                policy.validateCommand(
                    envelope('open', {
                        exelearningBridge: nonce,
                        reqId: 1,
                        provider: 'youtube',
                        videoId: 'dQw4w9WgXcQ',
                        start: 12,
                    }),
                    nonce,
                ),
            ).toBe(true);
            expect(
                policy.validateCommand(
                    envelope('open', { exelearningBridge: nonce, reqId: 1, provider: 'youtube', videoId: 'bad' }),
                    nonce,
                ),
            ).toBe(false);
            expect(policy.validateCommand(envelope('seek', { exelearningBridge: nonce, t: 3 }), nonce)).toBe(true);
            expect(policy.validateCommand(envelope('seek', { exelearningBridge: nonce, t: -1 }), nonce)).toBe(false);
            expect(
                policy.validateCommand(envelope('getCurrentTime', { exelearningBridge: nonce, reqId: 2 }), nonce),
            ).toBe(true);
            expect(policy.validateCommand(envelope('getDuration', { exelearningBridge: nonce, reqId: 1.5 }), nonce)).toBe(
                false,
            );
        });
    });

    describe('validateEvent', () => {
        it('validates timeupdate, seeked, state, ready and error payloads', () => {
            expect(policy.validateEvent(envelope('timeupdate', { currentTime: 1, duration: 10 }))).toBe(true);
            expect(policy.validateEvent(envelope('timeupdate', { currentTime: -1, duration: 10 }))).toBe(false);
            expect(policy.validateEvent(envelope('seeked', { currentTime: 4 }))).toBe(true);
            expect(policy.validateEvent(envelope('state', { reqId: 3 }))).toBe(true);
            expect(policy.validateEvent(envelope('ready'))).toBe(true);
            expect(policy.validateEvent(envelope('ready', { duration: 9 }))).toBe(true);
            expect(policy.validateEvent(envelope('error', { code: 'boom', fatal: true }))).toBe(true);
            expect(policy.validateEvent(envelope('error', { code: 'boom' }))).toBe(false);
            expect(policy.validateEvent(envelope('play'))).toBe(true);
            expect(policy.validateEvent(envelope('nope'))).toBe(false);
        });
    });
});
