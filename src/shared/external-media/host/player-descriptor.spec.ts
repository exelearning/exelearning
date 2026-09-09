import { describe, expect, it } from 'bun:test';
import { describePlayer } from './player-descriptor';

const video = { url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', kind: 'video' as const };
const packagePdf = { url: 'https://lms.example/pkg/handout.pdf', kind: 'pdf' as const, sameOrigin: true };
const remotePdf = { url: 'https://files.example.org/handout.pdf', kind: 'pdf' as const };

describe('describePlayer — video', () => {
    it('sandboxes the player and keeps the provider own origin', () => {
        const player = describePlayer(video);
        expect(player.sandbox).toContain('allow-scripts');
        expect(player.sandbox).toContain('allow-same-origin');
        expect(player.allowFullscreen).toBe(true);
    });

    /**
     * The two tokens whose absence is the point: a hostile embed must be unable to
     * redirect the host tab or spam dialogs.
     */
    it('never grants top-navigation or modals', () => {
        const player = describePlayer(video);
        expect(player.sandbox).not.toContain('allow-top-navigation');
        expect(player.sandbox).not.toContain('allow-modals');
    });

    it('sends a referrer the provider will accept, without leaking the full URL', () => {
        // YouTube refuses an embedder it cannot identify (error 153); a bare origin is
        // enough for it and is all the host page should disclose.
        expect(describePlayer(video).referrerPolicy).toBe('strict-origin-when-cross-origin');
    });
});

describe('describePlayer — PDFs', () => {
    it('leaves a package PDF unsandboxed so the built-in viewer renders it', () => {
        const player = describePlayer(packagePdf);
        expect(player.sandbox).toBeUndefined();
        expect(player.referrerPolicy).toBe('no-referrer');
    });

    /**
     * A server can answer scripted HTML at a `.pdf` path, so a remote PDF is treated as
     * untrusted markup: no scripts, no top-navigation.
     */
    it('sandboxes a remote PDF without scripts or top-navigation', () => {
        const player = describePlayer(remotePdf);
        expect(player.sandbox).toBe('allow-same-origin');
        expect(player.sandbox).not.toContain('allow-scripts');
        expect(player.sandbox).not.toContain('allow-top-navigation');
    });

    it('never sends a referrer for either kind of PDF', () => {
        expect(describePlayer(packagePdf).referrerPolicy).toBe('no-referrer');
        expect(describePlayer(remotePdf).referrerPolicy).toBe('no-referrer');
    });
});

describe('describePlayer — invariants across every kind', () => {
    it('always carries the validated URL through unchanged', () => {
        for (const verdict of [video, packagePdf, remotePdf]) {
            expect(describePlayer(verdict).src).toBe(verdict.url);
        }
    });

    it('only the package PDF is ever created without a sandbox', () => {
        const unsandboxed = [video, packagePdf, remotePdf].filter(v => describePlayer(v).sandbox === undefined);
        expect(unsandboxed).toEqual([packagePdf]);
    });
});
