# ADR — opaque editor preview and the SCORM/xAPI gap

**Status:** accepted (always-opaque hardening).

## Context

The editor preview now renders untrusted package content in an opaque-origin sandboxed iframe
(`sandbox="allow-scripts allow-popups allow-forms"`, no `allow-same-origin`), matching the host
plugins (Moodle / WordPress / Omeka S / Procomún). An opaque-origin child cannot reach
`window.parent` — by design — so any feature that historically relied on the child reaching the
parent DOM or a parent API must use an explicit, validated bridge instead.

## SCORM / xAPI in eXe core preview

eXeLearning **core has no SCORM/xAPI relay for its own preview**: the in-app preview is a visual
check of authored content, not a graded attempt, so it never needed to report scores. Under the
opaque sandbox this is unchanged — there is no parent API to discover, and the preview does not
pretend to grade.

If a future need arises to run SCORM-like reporting in the core preview (e.g. an in-editor "test
this SCO" mode), it **must** be implemented as a validated `postMessage` bridge — modelled on
`mod_exelearning`'s `scorm_bridge_relay.js` (window-identity + closed action enum + per-view
nonce + payload-shape checks) — and **must not** be "fixed" by re-adding `allow-same-origin` to
the preview iframe. Direct `window.parent.API` discovery is fundamentally incompatible with the
opaque-origin isolation the preview now guarantees.

## Consequences

- Core preview stays isolated: a malicious imported `.elpx` cannot reach the editor session.
- Hosts that DO grade (Moodle) already relay SCORM/xAPI over validated bridges; their
  forged-message rejection (wrong source / wrong nonce / unknown action / malformed payload /
  replay/dedup) is covered by `mod_exelearning`'s `tests/js/scorm_bridge.test.js` and
  `tests/js/xapi_listener.test.js`.
- Tracked as future work; no `allow-same-origin` workaround is acceptable.
