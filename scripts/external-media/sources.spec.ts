import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    ARTIFACT_NAMES,
    VERIFIER_NAME,
    VERIFIER_SOURCE,
    CHILD_LEGACY_SOURCES,
    CONTRACT_SOURCES,
    DIST_DIR,
    ENTRIES,
    HOST_LEGACY_SOURCES,
} from './sources';

const ROOT = join(import.meta.dir, '../..');
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8');
const all = [...Object.values(ENTRIES), ...CHILD_LEGACY_SOURCES, ...HOST_LEGACY_SOURCES];

describe('source set', () => {
    it('points at files that exist', () => {
        for (const relative of [...all, ...Object.values(CONTRACT_SOURCES)]) {
            expect(existsSync(join(ROOT, relative)), `missing source: ${relative}`).toBe(true);
        }
    });

    /**
     * Both remainders are empty: every byte of both bundles is built from the canonical
     * TypeScript. This is the end state ADR-0020 was aiming at, so what is asserted is
     * that it STAYS reached — a source reappearing here means something was un-ported.
     */
    it('builds the child bundle from canonical source alone', () => {
        expect(CHILD_LEGACY_SOURCES).toHaveLength(0);
    });

    /**
     * The host half is fully canonical: nothing classic is concatenated after its entry.
     * An empty remainder is the end state, and this is the first bundle to reach it — so
     * the assertion is that it STAYS empty, not that it is ordered correctly.
     */
    it('builds the host bundle from canonical source alone', () => {
        expect(HOST_LEGACY_SOURCES).toHaveLength(0);
    });

    it('publishes the child globals from its own entry', () => {
        expect(read(ENTRIES.child)).toContain('publishChild');
    });

    /** Neither bundle carries classic media code any more. */
    it.each(['child', 'host'])('leaves no classic media code in the %s bundle', which => {
        const built = read(join(DIST_DIR, ARTIFACT_NAMES[which as 'child' | 'host']));
        expect(built).not.toContain('YT.Player');
        expect(built).not.toContain('Vimeo.Player');
    });

    /**
     * The privilege split is the whole point of shipping two bundles: the child runs
     * inside untrusted author content and must never contain the trusted half.
     */
    it('keeps the trusted half out of the child bundle', () => {
        expect(CHILD_LEGACY_SOURCES.some(s => s.endsWith('exe_embed_relay.js'))).toBe(false);
        expect(CHILD_LEGACY_SOURCES.some(s => s.endsWith('exe-media-host.js'))).toBe(false);
        expect(read(ENTRIES.child)).not.toContain('host-entry');
    });

    it('keeps the in-content half out of the host bundle', () => {
        expect(HOST_LEGACY_SOURCES.some(s => s.endsWith('exe_media_bridge.js'))).toBe(false);
        expect(read(ENTRIES.host)).not.toContain('child-entry');
    });

    /** Emptying the remainders must not quietly drop the licence check with them. */
    it('still requires the dual grant from every source it does bundle', () => {
        expect(all.length).toBeGreaterThan(0);
    });

    /**
     * A plugin that vendors a minified file it cannot check is worse off than one reading
     * our source, so the means of checking has to travel with it.
     */
    it('ships a verifier a consumer can run, carrying the same grant', () => {
        expect(existsSync(join(ROOT, VERIFIER_SOURCE))).toBe(true);
        expect(VERIFIER_NAME.endsWith('.mjs'), 'must run under plain node, with no toolchain').toBe(true);

        const source = read(VERIFIER_SOURCE);
        expect(source).toContain('SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later');
        // Dependency-free: a PHP plugin's CI has no install step to give it anything else.
        expect(source).not.toMatch(/from '(?!node:)[^']+'/);
    });

    it('names artifacts by privilege, in a stable dist location', () => {
        expect(ARTIFACT_NAMES.child).toContain('child');
        expect(ARTIFACT_NAMES.host).toContain('host');
        expect(DIST_DIR).toContain('exe_external_media');
    });

    /** Every distributed source carries the dual grant recorded in ADR-0018. */
    it('only bundles sources that carry the dual-licence grant', () => {
        for (const relative of new Set(all)) {
            expect(read(relative), `missing SPDX grant: ${relative}`).toContain(
                'SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later',
            );
        }
    });

    /**
     * The incumbent sources are no longer shipped, but the contract is still derived from
     * them and the parity specs still execute them. That is what keeps "the rewrite
     * behaves the same" a measured claim rather than an assertion. They go at Phase 8.
     */
    it('still keeps the incumbent sources around as the equivalence reference', () => {
        expect(Object.values(CONTRACT_SOURCES).some(s => s.endsWith('exe_embed_shim.js'))).toBe(true);
        expect(Object.values(CONTRACT_SOURCES).some(s => s.endsWith('exe_embed_relay.js'))).toBe(true);
    });

    /**
     * Canonicity is core's, and inside core it moved to `src/shared/external-media/`. The
     * files it moved away from are still readable, still executed by the parity specs,
     * and still look exactly like the thing to edit — so they have to say plainly that
     * they are not, or the next person fixes a bug in a file that ships nowhere.
     */
    it.each(['exe_embed_shim.js', 'exe_embed_relay.js'])('tells a reader that %s is no longer canonical', file => {
        const relative = Object.values(CONTRACT_SOURCES).find(s => s.endsWith(file)) as string;
        const header = read(relative);

        expect(header).toContain('NO LONGER THE CANONICAL SOURCE');
        expect(header).toContain('src/shared/external-media/');
    });

    /** The other half of the same claim: neither is in anything that gets built. */
    it('does not ship the incumbent embed sources', () => {
        for (const file of ['exe_embed_shim.js', 'exe_embed_relay.js']) {
            expect(all.some(s => s.endsWith(file)), `${file} is still being bundled`).toBe(false);
        }
    });
});
