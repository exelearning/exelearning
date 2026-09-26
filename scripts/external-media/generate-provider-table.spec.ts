import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    renderProviderTemplates,
    GENERATED_BEGIN,
    GENERATED_END,
    replaceGeneratedBlock,
    RELAY_PATH,
    syncProviderTable,
} from './generate-provider-table';
import { buildCanonicalEmbedUrl, PROVIDERS } from '../../src/shared/external-media/providers/registry';

describe('renderProviderTemplates', () => {
    it('emits a classic-script table with no imports, so it can ship inside a package', () => {
        const source = renderProviderTemplates();
        expect(source).not.toContain('import ');
        expect(source).not.toContain('require(');
        expect(source).not.toContain('export ');
    });

    it('covers every provider in the canonical registry', () => {
        const source = renderProviderTemplates();
        for (const provider of PROVIDERS) {
            expect(source, provider.id).toContain(provider.id);
        }
    });

    /**
     * The generated table is the security-critical half: it is what rebuilds the URL
     * that gets loaded into a player iframe. It must reproduce the canonical registry
     * exactly, so it is checked by EXECUTING it, not by reading it.
     */
    it('rebuilds exactly the URLs the canonical registry rebuilds', () => {
        const sandbox: Record<string, unknown> = {};
        runInNewContext(`${renderProviderTemplates()}\nresult = PROVIDER_TEMPLATES;`, sandbox);
        const templates = sandbox.result as Record<string, { re: RegExp; build: (id: string) => string }>;

        const probes: Record<string, string> = {
            youtube: 'aqz-KE-bpKQ',
            vimeo: '76979871',
            dailymotion: 'x8abc12',
            'mediateca-madrid': 'abcd1234',
        };
        for (const [id, probe] of Object.entries(probes)) {
            expect(templates[id], id).toBeDefined();
            expect(templates[id].build(probe), id).toBe(buildCanonicalEmbedUrl(id, probe));
        }
    });

    it('reproduces the registry id patterns, so a bad id cannot escape the template', () => {
        const sandbox: Record<string, unknown> = {};
        runInNewContext(`${renderProviderTemplates()}\nresult = PROVIDER_TEMPLATES;`, sandbox);
        const templates = sandbox.result as Record<string, { re: RegExp }>;

        for (const bad of ['../../evil', 'abc/def', 'abc?x=1', 'abc#frag', '']) {
            expect(templates.youtube.re.test(bad), bad).toBe(false);
        }
        expect(templates.vimeo.re.test('notanumber')).toBe(false);
    });

    it('is deterministic, so regenerating never produces a spurious diff', () => {
        expect(renderProviderTemplates()).toBe(renderProviderTemplates());
    });
});

describe('replaceGeneratedBlock', () => {
    const file = `before\n${GENERATED_BEGIN}\nOLD\n${GENERATED_END}\nafter\n`;
    // The replacement carries its own markers, exactly as renderProviderTemplates does,
    // so the block stays replaceable on the next run.
    const block = `${GENERATED_BEGIN}\nNEW\n${GENERATED_END}`;

    it('replaces only what lies between the markers', () => {
        const out = replaceGeneratedBlock(file, block);
        expect(out).toContain('before');
        expect(out).toContain('after');
        expect(out).toContain('NEW');
        expect(out).not.toContain('OLD');
    });

    it('is idempotent', () => {
        const once = replaceGeneratedBlock(file, block);
        expect(replaceGeneratedBlock(once, block)).toBe(once);
    });

    it('refuses a file with no markers rather than guessing where to write', () => {
        expect(() => replaceGeneratedBlock('no markers here', block)).toThrow();
    });

    it('refuses a file whose markers are out of order', () => {
        expect(() => replaceGeneratedBlock(`${GENERATED_END}\nx\n${GENERATED_BEGIN}`, block)).toThrow();
    });
});

describe('the shipped relay table is generated, not hand-written', () => {
    /**
     * The drift gate. The relay's provider table is security-critical — it rebuilds the
     * URL that ends up in a player iframe — so it must remain byte-identical to what the
     * canonical registry generates. Hand-editing it is caught here rather than shipped.
     */
    it('regenerating the relay reproduces the committed file exactly', () => {
        const path = join(import.meta.dir, '../..', RELAY_PATH);
        const current = readFileSync(path, 'utf8');
        expect(replaceGeneratedBlock(current, renderProviderTemplates())).toBe(current);
    });

    it('the relay carries the markers the generator needs', () => {
        const current = readFileSync(join(import.meta.dir, '../..', RELAY_PATH), 'utf8');
        expect(current).toContain(GENERATED_BEGIN);
        expect(current).toContain(GENERATED_END);
    });
});

describe('syncProviderTable', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'exe-gen-'));
    });
    afterEach(() => rmSync(tmp, { recursive: true, force: true }));

    /** A target file whose generated block is deliberately wrong. */
    function writeStale(): string {
        const path = join(tmp, 'target.js');
        writeFileSync(path, `head\n    ${GENERATED_BEGIN}\n    var PROVIDER_TEMPLATES = {};\n    ${GENERATED_END}\ntail\n`);
        return path;
    }

    it('reports a stale file without touching it when not writing', () => {
        const path = writeStale();
        const before = readFileSync(path, 'utf8');
        const result = syncProviderTable(path, { write: false });
        expect(result.stale).toBe(true);
        expect(result.written).toBe(false);
        expect(readFileSync(path, 'utf8')).toBe(before);
    });

    it('rewrites a stale file when asked, and reports it', () => {
        const path = writeStale();
        const result = syncProviderTable(path, { write: true });
        expect(result.stale).toBe(true);
        expect(result.written).toBe(true);
        expect(readFileSync(path, 'utf8')).toContain('youtube-nocookie.com/embed/');
    });

    it('is a no-op on an already-current file', () => {
        const path = writeStale();
        syncProviderTable(path, { write: true });
        const result = syncProviderTable(path, { write: true });
        expect(result.stale).toBe(false);
        expect(result.written).toBe(false);
    });
});

describe('defensive paths', () => {
    /** A registry entry that cannot build a URL for its own id is a broken registry. */
    it('refuses to emit a table for a provider whose builder returns null', () => {
        const broken = [{ id: 'youtube', resourceIdPattern: /^x$/, buildCanonicalEmbedUrl: () => null }];
        expect(() => renderProviderTemplates(broken)).toThrow(/cannot build a URL/);
    });

    it('refuses a provider it has no probe id for, rather than emitting a wrong template', () => {
        const unknown = [
            { id: 'brand-new', resourceIdPattern: /^x$/, buildCanonicalEmbedUrl: () => 'https://x/x' },
        ];
        expect(() => renderProviderTemplates(unknown)).toThrow(/no probe id/);
    });
});
