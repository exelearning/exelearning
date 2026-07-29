/**
 * The source set for each distributable bundle, split by PRIVILEGE.
 *
 * Each bundle is built in two parts, which is the strangler-fig migration made literal
 * (ADR-0020):
 *
 *  - a CANONICAL ENTRY — TypeScript under `src/shared/external-media/`, bundled by
 *    esbuild into a classic IIFE. This is the embed half, the part that was rewritten.
 *  - the LEGACY REMAINDER — classic scripts still shipped verbatim. This is the media
 *    bridge, not yet ported. It shrinks to nothing at Phase 8.
 *
 * Order matters and is load order: these publish globals and read each other's.
 *
 *  - the canonical entry comes FIRST, because `exe_media_bridge.js` checks
 *    `win.exeEmbedShim` at module scope and defers to it for declarative embeds;
 *  - `exe_media_policy.js` must precede both the media bridge and the media host,
 *    which read `root.exeMediaPolicy` at module scope.
 *
 * The legacy remainder is concatenated rather than module-bundled on purpose: each is a
 * classic browser script with no imports, which is what lets the child run from
 * `file://` inside an exported package. The canonical entry is bundled to the same
 * shape — an IIFE, no imports, ES2017 — so the concatenation stays valid.
 */

/** Canonical TypeScript entries, bundled to classic IIFEs. */
export const ENTRIES = {
    child: 'src/shared/external-media/child-bundle.ts',
    host: 'src/shared/external-media/host-bundle.ts',
} as const;

/**
 * Classic scripts concatenated AFTER the canonical entry, in this order.
 *
 * Everything still listed here is awaiting its turn in the migration; an empty list is
 * the end state, not a degenerate case.
 */
/**
 * Empty: both halves are fully canonical.
 *
 * The classic media policy and bridge are no longer built into the child bundle. Their
 * knowledge lives in `providers/registry.ts`, `protocol/schemas.ts` and `media/`; the
 * bridge's declarative scan is not ported because it was already unreachable whenever the
 * embed half is present, which in this bundle is always.
 */
export const CHILD_LEGACY_SOURCES = [] as const;

/**
 * Empty: the host half is fully canonical.
 *
 * `exe_media_policy.js` and `exe-media-host.js` are no longer built into the host bundle.
 * The policy's knowledge lives in `providers/registry.ts` and `protocol/schemas.ts`; the
 * host's behaviour in `media/`, ported from the raw-`postMessage` implementation the host
 * plugins actually run rather than from core's SDK-based fork (ADR-0022).
 */
export const HOST_LEGACY_SOURCES = [] as const;

/**
 * The incumbent classic sources, kept as the equivalence reference.
 *
 * They are no longer shipped — the canonical entry replaced them — but the contract is
 * still derived from them and the parity specs still execute them, which is what keeps
 * "the rewrite behaves the same" a measured claim rather than an assertion. Removed at
 * Phase 8, once nothing reads them.
 */
export const CONTRACT_SOURCES = {
    policy: 'public/app/common/exe_media_bridge/exe_media_policy.js',
    relay: 'public/app/common/exe_embed_bridge/exe_embed_relay.js',
    shim: 'public/app/common/exe_embed_bridge/exe_embed_shim.js',
} as const;

/** Where the distribution is written, relative to the repository root. */
export const DIST_DIR = 'public/app/common/exe_external_media/dist';

export const ARTIFACT_NAMES = {
    child: 'exe-external-media-child.min.js',
    host: 'exe-external-media-host.min.js',
} as const;

/**
 * The consumer's verifier, copied verbatim into the distribution.
 *
 * It travels with the bytes it verifies for the same reason the licence banner does: a
 * check that lives only in this repository is no check at all to a plugin that vendored
 * the files. Copied rather than generated so what ships is reviewable, lintable source
 * with its own tests, not a string in a build script.
 */
export const VERIFIER_SOURCE = 'scripts/external-media/dist-verifier.mjs';
export const VERIFIER_NAME = 'verify.mjs';
