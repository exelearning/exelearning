# Embedder sync across repos

The external-media **embed bridge** (promote-to-parent relay + shim) and the **modal
media bridge** (policy + host) are duplicated across eXeLearning core and the host
plugins so each can ship self-contained assets. To stop the copies from drifting,
`scripts/check-embed-sync.mjs` asserts a set of behavioural invariants in every copy.

## Canonical sources

| Bridge | Files | Canonical | Mirrors |
|---|---|---|---|
| Embed relay + shim | `exe_embed_relay.js`, `exe_embed_shim.js` | **eXe core** (`public/app/common/exe_embed_bridge/`) | mod_exelearning, wp-exelearning, omeka-s-exelearning, procomun |
| Media policy | `exe_media_policy.js` | **eXe core** (`public/app/common/exe_media_bridge/`) | mod, wp, omeka, procomun |
| Media host | `exe_media_host.js` (raw-postMessage) | **mod_exelearning** | wp, omeka, procomun (core ships a separate SDK-based host fork) |
| Sandbox PHP | `player_iframe.php` / `class-iframe-sandbox.php` / `IframeSandbox.php` | **mod_exelearning** | wp, omeka |

Changes flow **from core outward**: edit the canonical file, then propagate to the
mirrors (only the export wrapper and each repo's code style — tabs/Yoda for WP/Omeka,
`@package` headers — should differ; the invariants must match).

## Running the check

```bash
node scripts/check-embed-sync.mjs \
  --mod <mod_exelearning> \
  --wp <wp-exelearning> \
  --omeka <omeka-s-exelearning> \
  --procomun <procomun>
```

Mirror paths may also come from `MOD_EXE_DIR` / `WP_EXE_DIR` / `OMEKA_EXE_DIR` /
`PROCOMUN_EXE_DIR`. With no mirror paths it only sanity-checks the core files. It
normalises whitespace and quote style, so tabs-vs-spaces and the IIFE-vs-`module.exports`
wrapper never count as drift — only a missing behavioural invariant does. Exit code is
non-zero on drift. It is a local pre-/post-change check, not a CI gate (there is no shared
CI across the repos yet).

## Not covered

The SCORM/xAPI bridge (`scorm_bridge_*.js`, `scorm_tracker.js`, `xapi_listener.js`) is
maintained only in mod_exelearning and is out of scope for this checker.
