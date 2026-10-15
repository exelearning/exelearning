/**
 * Generate the classic-script provider table from the canonical registry.
 *
 * The shipped runtimes are classic browser scripts with no imports — that is exactly
 * what lets the child run from `file://` inside an exported package — so they cannot
 * import `src/shared/external-media/providers/registry.ts` at runtime. Unification has
 * to happen at BUILD time instead: the registry stays the single author, and this
 * renders its knowledge into the form a classic script can carry.
 *
 * The result is written between markers in the target file and checked by a drift spec,
 * so hand-editing the block is caught rather than silently accepted.
 *
 *   bun scripts/external-media/generate-provider-table.ts --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROVIDERS } from '../../src/shared/external-media/providers/registry';

/** The slice of a provider definition this generator needs. */
export interface ProviderLike {
    id: string;
    resourceIdPattern: RegExp;
    buildCanonicalEmbedUrl(resourceId: string): string | null;
}

export const GENERATED_BEGIN = '// <<< GENERATED: provider templates — do not edit by hand';
export const GENERATED_END = '// >>> END GENERATED';

/** The file whose provider table is generated. */
export const RELAY_PATH = 'public/app/common/exe_embed_bridge/exe_embed_relay.js';

/**
 * Render the table as ES5 the relay can carry.
 *
 * Each entry keeps the registry's anchored id pattern and its canonical URL, so a value
 * that could carry a path, query or fragment out of the template still cannot reach a
 * live URL — the check travels with the data.
 */
export function renderProviderTemplates(providers: readonly ProviderLike[] = PROVIDERS): string {
    const entries = providers.map(provider => {
        // Probe the registry for the template shape rather than restating it: whatever
        // the canonical builder produces for a known-good id is, by definition, correct.
        const probe = probeFor(provider.id);
        const url = provider.buildCanonicalEmbedUrl(probe);
        if (!url) {
            throw new Error(`provider "${provider.id}" cannot build a URL for its own probe id "${probe}"`);
        }
        const [prefix, suffix] = url.split(probe);
        const tail = suffix ? ` + '${suffix}'` : '';
        return (
            `        '${provider.id}': { re: ${provider.resourceIdPattern.toString()}, ` +
            `build: function (id) { return '${prefix}' + id${tail}; } }`
        );
    });

    return [
        `    ${GENERATED_BEGIN}`,
        '    // Source: src/shared/external-media/providers/registry.ts',
        '    // Regenerate: bun scripts/generate-external-media-providers.ts --write',
        '    var PROVIDER_TEMPLATES = {',
        entries.join(',\n'),
        '    };',
        `    ${GENERATED_END}`,
    ].join('\n');
}

/** A known-good id per provider, used only to discover the template shape. */
function probeFor(providerId: string): string {
    const probes: Record<string, string> = {
        youtube: 'aqzKEbpKQxx',
        vimeo: '769798',
        dailymotion: 'xabcde',
        'mediateca-madrid': 'abcdefgh',
    };
    const probe = probes[providerId];
    if (!probe) throw new Error(`no probe id registered for provider "${providerId}"`);
    return probe;
}

/**
 * Swap the marked block in `source` for `block`. Throws if the markers are unusable.
 *
 * The replacement starts at the beginning of the marker's LINE, not at the marker text,
 * so the block owns its own indentation and re-running cannot accumulate leading
 * whitespace. `block` is expected to carry both markers, which keeps the result
 * replaceable next time.
 */
export function replaceGeneratedBlock(source: string, block: string): string {
    const beginMarker = source.indexOf(GENERATED_BEGIN);
    const end = source.indexOf(GENERATED_END);
    if (beginMarker === -1 || end === -1) {
        throw new Error('generated-block markers not found in the target file');
    }
    if (end < beginMarker) {
        throw new Error('generated-block markers are out of order');
    }
    const begin = source.lastIndexOf('\n', beginMarker) + 1;
    return source.slice(0, begin) + block + source.slice(end + GENERATED_END.length);
}

export interface SyncResult {
    /** True when the file on disk did not match what the registry generates. */
    stale: boolean;
    /** True when this call rewrote the file. */
    written: boolean;
}

/**
 * Bring one target file's generated block in line with the canonical registry.
 *
 * @param path   File carrying the markers.
 * @param write  Rewrite when stale; otherwise only report.
 */
export function syncProviderTable(path: string, { write }: { write: boolean }): SyncResult {
    const current = readFileSync(path, 'utf8');
    const next = replaceGeneratedBlock(current, renderProviderTemplates());
    const stale = next !== current;
    if (stale && write) {
        writeFileSync(path, next);
        return { stale: true, written: true };
    }
    return { stale, written: false };
}
