# Vendoring the external-media artifacts

How a host plugin consumes eXeLearning's embed/media runtime without carrying a copy of
its source.

Applies to `mod_exelearning`, `wp-exelearning`, `omeka-s-exelearning`, `procomun` and
`nextcloud-exelearning`. Superseded practice: hand-copying `exe_embed_shim.js` /
`exe_embed_relay.js` into each repository and checking them with
`tools/check-embed-sync.mjs`.

## Why this changed

eXeLearning core is canonical (ADR-2199-12). Until now that was a claim in a comment: five
repositories held five copies that had genuinely diverged, and the only thing checking
them looked for the presence of about ten substrings — which every divergent copy
satisfied.

Vendoring built artifacts replaces the claim with a property. A plugin holds the exact
bytes core published, and can prove it. Divergence stops being something a checker might
notice and becomes something that cannot be expressed.

Distributing them is lawful because ADR-2199-09 dual-licenses the family
`AGPL-3.0-or-later OR GPL-3.0-or-later`, so the same bytes can live in eXeLearning and in
a GPL-3.0 plugin without either project relicensing anything. GPL-3.0 plugins should list
the artifacts in their third-party libraries declaration (Moodle: `thirdpartylibs.xml`).

## What to vendor

Copy the whole `dist/` directory. It is self-describing:

| File | What it is |
|---|---|
| `exe-external-media-child.min.js` | Runs **inside untrusted author content**. Promotes embeds to placeholders and reports geometry. |
| `exe-external-media-host.min.js` | Runs **on the trusted page**. Validates, mounts and positions players. |
| `exe-external-media.manifest.json` | `sha256` and byte count per artifact, plus a `buildHash` over that list, plus the source commit. |
| `exe-external-media.contract.json` | Protocol version, providers, handshake and sandbox attributes — for writing your own tests against. |
| `verify.mjs` | The checker below. Ships with the bytes it checks. |

**Never load the host bundle inside content, or the child bundle on the host page.** The
split is the privilege boundary, not a packaging convenience.

## Verifying

```bash
node path/to/exe_external_media/verify.mjs path/to/exe_external_media
```

Exit code 0 means the copy is intact; non-zero prints what is wrong and fails your
pipeline. It needs nothing but `node` — no install step, no `package.json`, no toolchain.
Add it as a CI step.

### Integrity is not provenance

Run without arguments, `verify.mjs` proves only that **nothing was edited after
vendoring**. It cannot prove the copy came from eXeLearning: a consistent forgery — file
and digests changed together — is easy to produce, and a build hash contained in the copy
cannot vouch for the copy.

For provenance, pass the hash eXeLearning published for the release you meant to vendor,
obtained out of band:

```bash
node verify.mjs . --build-hash <the buildHash eXeLearning published for that release>
```

The value is the `buildHash` field of the release's manifest, but take it from the release
announcement rather than from the copy you are checking — a hash read out of the artifact
you are verifying cannot tell you anything about that artifact.

Pin that hash in your repository. It is what turns "these files verify" into "these files
are the ones I chose".

## Loading them

The host does **not** start itself: the policy it applies is the embedding page's
decision, so the page supplies it.

```html
<script src=".../exe-external-media-host.min.js"></script>
<script>
  window.exeExternalMediaHost.create({ strict: false }).scan();
</script>
```

`strict: true` additionally requires an `allowlist` of hostnames. Note what strict mode
actually does, because the name undersells it: a URL must be `https:`, its host must be on
the allowlist, **and** it must parse as a known provider — an allowlisted host that is not
a recognised provider is still refused. What loads is then the provider's canonical embed
URL rebuilt from the parsed resource id, never the URL the content supplied. Strict mode
is an allowlist of *providers*, gated by hostname; it is not a URL passthrough.

Measured, with `allowlist: ['www.youtube.com', 'cdn.tercero.example']`: [M]

| Input | Result |
|---|---|
| `https://www.youtube.com/watch?v=aqz-KE-bpKQ` | `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ` |
| `https://cdn.tercero.example/player.html` | refused — allowlisted, but not a provider |
| `https://vimeo.com/123456` | refused — a provider, but not allowlisted |
| `http://www.youtube.com/watch?v=aqz-KE-bpKQ` | refused — not https |

Note the first row: what loads is the `-nocookie` host, because the URL is rebuilt from the
registry rather than taken from the content. Authors get the privacy-preserving variant
whether or not they knew to type it.

The child **does** self-start, because nothing inside the content document would call it.
Include it in the rendered page's `<head>`:

```html
<script src=".../exe-external-media-child.min.js"></script>
```

Starting is not activating. The child announces itself and waits; a document whose host
never answers stays exactly as the author wrote it (ADR-2199-08). This is what keeps exported
packages usable on `file://`, in an ePub reader, or in a third-party LMS.

### The legacy names still work

`window.exeEmbedRelay.init(config)` and `window.exeEmbedShim` are kept as facades over the
same runtime, so a plugin can vendor the artifacts **before** changing how it calls them.
They log a deprecation notice once per session naming the replacement, and are removed in
a later major (ADR-2199-11). Migrate when convenient, not as a precondition.

## When core changes

eXeLearning and its plugins are **released together**: core is built, the editor is
tagged, and the same version is cut for every plugin. So this is not a migration you
schedule — it is part of cutting a release.

1. eXeLearning core rebuilds and publishes new artifacts and a new `buildHash`.
2. Your plugin re-vendors `dist/` and updates the pinned hash in one commit, in the same
   release as core.
3. CI verifies.

Because the versions move together, the hash to pin is simply **the one from the core
release your version is paired with**. There is no window in which a plugin is expected to
work against an artifact from a different release, and none is supported.

What does span releases is the **content**: an exported package carries whatever child
runtime was current when it was exported, and then lives for years. The host half stays
backward compatible with those packages — that, and not plugin lag, is what the legacy
globals and the `exelearningBridge` field are for.

**Do not patch a vendored file.** A local fix is invisible upstream, will be silently
reverted by the next re-vendor, and `verify.mjs` will fail your build in the meantime —
which is the intended outcome, not an obstacle to route around. Fix it in core.

## References

- ADR-2199-12 — core is canonical, verified by manifest
- ADR-2199-11 — strangler-fig migration and the deprecation facades
- ADR-2199-09 — the dual licence that makes vendoring lawful
- ADR-2199-08 — why the child stays inert without a host
