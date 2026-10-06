import { beforeEach, describe, expect, it } from 'bun:test';
import { createDeprecations, withDeprecationNotice, type Deprecations } from './legacy-globals';

let warnings: string[];
let deprecations: Deprecations;

beforeEach(() => {
    warnings = [];
    deprecations = createDeprecations({ warn: message => warnings.push(message) });
});

describe('createDeprecations', () => {
    it('announces a name once and stays quiet afterwards', () => {
        deprecations.notice('exeEmbedRelay', 'exeExternalMediaHost.attach()');
        deprecations.notice('exeEmbedRelay', 'exeExternalMediaHost.attach()');
        deprecations.notice('exeEmbedRelay', 'exeExternalMediaHost.attach()');

        expect(warnings).toHaveLength(1);
    });

    it('announces each name separately', () => {
        deprecations.notice('exeEmbedRelay', 'a');
        deprecations.notice('exeEmbedShim', 'b');

        expect(warnings).toHaveLength(2);
        expect(deprecations.announced()).toEqual(['exeEmbedRelay', 'exeEmbedShim']);
    });

    /**
     * A maintainer who sees this should learn three things without going looking: which
     * name is going away, what to use instead, and that nothing is broken today.
     */
    it('names the replacement and says the old name still works', () => {
        deprecations.notice('exeMediaHost', 'exeExternalMediaHost');

        expect(warnings[0]).toContain('window.exeMediaHost');
        expect(warnings[0]).toContain('exeExternalMediaHost');
        expect(warnings[0]).toContain('deprecated');
        expect(warnings[0]).toMatch(/still works|nothing needs changing/);
    });

    it('reports nothing announced before anything is used', () => {
        expect(deprecations.announced()).toEqual([]);
    });
});

describe('withDeprecationNotice', () => {
    const target = { init: () => 'ran', value: 42 };

    it('passes every property through unchanged', () => {
        const wrapped = withDeprecationNotice(target, 'exeEmbedRelay', 'newThing', deprecations);

        expect(wrapped.init()).toBe('ran');
        expect(wrapped.value).toBe(42);
    });

    /**
     * The notice fires on USE, not on publication. Plugins reach for these globals long
     * after load, so warning at publish time would warn every page about names nobody
     * called — and stay silent for the pages that actually still depend on them.
     */
    it('stays silent until the global is actually touched', () => {
        const wrapped = withDeprecationNotice(target, 'exeEmbedRelay', 'newThing', deprecations);
        expect(warnings).toHaveLength(0);

        void wrapped.value;
        expect(warnings).toHaveLength(1);
    });

    it('warns once however many times it is used', () => {
        const wrapped = withDeprecationNotice(target, 'exeEmbedRelay', 'newThing', deprecations);

        wrapped.init();
        wrapped.init();
        void wrapped.value;

        expect(warnings).toHaveLength(1);
    });

    it('keeps separate names separately counted', () => {
        const relay = withDeprecationNotice(target, 'exeEmbedRelay', 'newThing', deprecations);
        const shim = withDeprecationNotice(target, 'exeEmbedShim', 'otherThing', deprecations);

        void relay.value;
        void shim.value;

        expect(deprecations.announced()).toEqual(['exeEmbedRelay', 'exeEmbedShim']);
    });

    /** A missing warning is a far better outcome than a runtime that will not start. */
    it('returns the plain object where Proxy is unavailable', () => {
        const globals = globalThis as { Proxy?: unknown };
        const proxy = globals.Proxy;
        globals.Proxy = undefined;
        try {
            const wrapped = withDeprecationNotice(target, 'exeEmbedRelay', 'newThing', deprecations);
            expect(wrapped).toBe(target);
            expect(wrapped.init()).toBe('ran');
        } finally {
            globals.Proxy = proxy;
        }
    });
});
