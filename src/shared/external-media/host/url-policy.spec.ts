import { describe, expect, it } from 'bun:test';
import {
    contentDir,
    isCrossOriginHttps,
    isIpOrLocalHost,
    isRelatedToHost,
    isSameOriginPackageFile,
    normalizeHost,
    packageId,
    validate,
    type HostLocation,
} from './url-policy';

const LMS: HostLocation = { origin: 'https://lms.example', hostname: 'lms.example' };
const CONTENT = 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/index.html';
const check = (raw: string, options = {}) => validate(raw, CONTENT, LMS, options);

describe('normalizeHost', () => {
    it('lowercases and strips the FQDN-root dot', () => {
        expect(normalizeHost('LMS.Example.')).toBe('lms.example');
        expect(normalizeHost('')).toBe('');
    });
});

describe('isIpOrLocalHost', () => {
    it('refuses IP literals and local names', () => {
        for (const host of ['127.0.0.1', '10.0.0.1', '[::1]', 'localhost', 'dev.localhost', 'box.local', '']) {
            expect(isIpOrLocalHost(host), host).toBe(true);
        }
    });

    it('allows an ordinary public host', () => {
        expect(isIpOrLocalHost('www.youtube.com')).toBe(false);
    });
});

describe('isRelatedToHost', () => {
    it('matches the host, its subdomains and its superdomains', () => {
        expect(isRelatedToHost('lms.example', 'lms.example')).toBe(true);
        expect(isRelatedToHost('files.lms.example', 'lms.example')).toBe(true);
        expect(isRelatedToHost('example', 'lms.example')).toBe(true);
    });

    /** The dotted boundary is what stops a look-alike prefix matching. */
    it('does not match a look-alike prefix', () => {
        expect(isRelatedToHost('evil-lms.example', 'lms.example')).toBe(false);
    });

    it('is false when the host page has no hostname', () => {
        expect(isRelatedToHost('anything.example', '')).toBe(false);
    });
});

describe('isCrossOriginHttps', () => {
    const cross = (raw: string) => isCrossOriginHttps(new URL(raw), LMS);

    it('accepts a public https host that is unrelated to the host page', () => {
        expect(cross('https://www.youtube-nocookie.com/embed/x')).toBe(true);
    });

    it('refuses http, userinfo, same origin, related hosts, IPs and local names', () => {
        expect(cross('http://www.youtube.com/embed/x')).toBe(false);
        expect(cross('https://evil.example@www.youtube.com/embed/x')).toBe(false);
        expect(cross('https://lms.example/x')).toBe(false);
        expect(cross('https://files.lms.example/x')).toBe(false);
        expect(cross('https://127.0.0.1/x')).toBe(false);
        expect(cross('https://box.local/x')).toBe(false);
        expect(cross('https://lms.example./x')).toBe(false);
    });
});

describe('package-file helpers', () => {
    it('finds the content directory and the package hash', () => {
        expect(contentDir(CONTENT)).toBe('https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/');
        expect(packageId(CONTENT)).toBe('a1b2c3d4e5f6a7b8');
        expect(packageId('https://lms.example/preview/index.html')).toBeNull();
        expect(contentDir('not a url')).toBe('');
    });

    it('recognises a file under the content directory or carrying the package hash', () => {
        expect(isSameOriginPackageFile(new URL(`${contentDir(CONTENT)}doc.pdf`), CONTENT)).toBe(true);
        expect(isSameOriginPackageFile(new URL('https://lms.example/other/a1b2c3d4e5f6a7b8/doc.pdf'), CONTENT)).toBe(
            true,
        );
        expect(isSameOriginPackageFile(new URL('https://lms.example/elsewhere/doc.pdf'), CONTENT)).toBe(false);
    });
});

describe('validate — open mode', () => {
    it('promotes a cross-origin https embed verbatim', () => {
        expect(check('https://example.com/player')).toEqual({ url: 'https://example.com/player', kind: 'video' });
    });

    /**
     * The reported URL is parsed with NO base. A relative value would otherwise inherit
     * the host page's origin and pass as same-origin.
     */
    it('refuses a relative or scheme-relative value rather than resolving it', () => {
        expect(check('/evil.html')).toBeNull();
        expect(check('//evil.example/x')).toBeNull();
        expect(check('not a url')).toBeNull();
    });

    it('refuses userinfo smuggling a trusted-looking host', () => {
        expect(check('https://evil.example@www.youtube.com/embed/x')).toBeNull();
    });

    it('refuses the host page own origin and anything related to it', () => {
        expect(check('https://lms.example/secret')).toBeNull();
        expect(check('https://files.lms.example/secret')).toBeNull();
    });
});

describe('validate — PDFs', () => {
    it('accepts a PDF belonging to this package, flagged same-origin', () => {
        const verdict = check(`${contentDir(CONTENT)}handout.pdf`);
        expect(verdict).toMatchObject({ kind: 'pdf', sameOrigin: true });
    });

    it('refuses a same-origin PDF that is not part of this package', () => {
        expect(check('https://lms.example/elsewhere/secret.pdf')).toBeNull();
    });

    /**
     * Ported as it ships. Phase 0 (§7.2) argues remote PDFs should leave the allowlist,
     * because a server may answer text/html to a `.pdf` path — that is a policy decision
     * to take on its own terms, not to smuggle in under an equivalence refactor.
     */
    it('still accepts a cross-origin PDF, exactly as the incumbent does', () => {
        expect(check('https://files.example.org/handout.pdf')).toEqual({
            url: 'https://files.example.org/handout.pdf',
            kind: 'pdf',
        });
    });

    it('refuses a cross-origin PDF on a local or IP host', () => {
        expect(check('https://127.0.0.1/handout.pdf')).toBeNull();
    });
});

describe('validate — strict mode', () => {
    const strict = { strict: true, allowlist: ['www.youtube.com', 'player.vimeo.com', 'evil.example'] };

    it('rebuilds the canonical URL for an allowlisted provider', () => {
        expect(check('https://www.youtube.com/embed/aqz-KE-bpKQ', strict)).toEqual({
            url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
            kind: 'video',
        });
        expect(check('https://player.vimeo.com/video/76979871', strict)).toEqual({
            url: 'https://player.vimeo.com/video/76979871',
            kind: 'video',
        });
    });

    it('refuses a host that is not on the allowlist', () => {
        expect(check('https://example.com/player', strict)).toBeNull();
    });

    /** Being allowlisted is not enough: the URL must still parse as that provider. */
    it('refuses an allowlisted host that is not a known provider', () => {
        expect(check('https://evil.example/player', strict)).toBeNull();
    });

    it('refuses an allowlisted provider whose id does not parse', () => {
        expect(check('https://www.youtube.com/embed/tooshort', strict)).toBeNull();
    });

    it('refuses non-https even when allowlisted', () => {
        expect(check('http://www.youtube.com/embed/aqz-KE-bpKQ', strict)).toBeNull();
    });

    /**
     * Strict mode WITHOUT an allowlist means "the maintained providers", which is what the
     * registry already is — not "nothing".
     *
     * An embedder that asks for strict and supplies no list is asking for the maintained
     * set; making that block everything turns an omitted argument into a silent, total
     * failure of video playback, with no error anywhere: the geometry still arrives, the
     * overlay is still created, and it stays permanently empty. Procomún shipped exactly
     * that. Deriving the default from the registry also keeps one source of truth for who
     * the maintained providers are, instead of asking every embedder to restate hosts the
     * bundle already knows.
     */
    it('falls back to the maintained providers when strict mode gets no allowlist', () => {
        const noList = { strict: true };

        expect(check('https://www.youtube.com/embed/aqz-KE-bpKQ', noList)).toEqual({
            url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
            kind: 'video',
        });
        expect(check('https://player.vimeo.com/video/76979871', noList)).toEqual({
            url: 'https://player.vimeo.com/video/76979871',
            kind: 'video',
        });
        // The fallback is the registry, not "anything": an unknown host is still refused.
        expect(check('https://example.com/player', noList)).toBeNull();
    });

    /**
     * An EXPLICITLY empty list is a decision, not an omission, and must keep meaning
     * "promote nothing". Without this the two cases collapse and an embedder loses the
     * ability to turn promotion off while staying in strict mode.
     */
    it('honours an explicitly empty allowlist as "allow nothing"', () => {
        expect(check('https://www.youtube.com/embed/aqz-KE-bpKQ', { strict: true, allowlist: [] })).toBeNull();
    });
});
