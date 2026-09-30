---
name: embedding-static
description: "Change eXeLearning static runtime capabilities, iframe host communication, embedded save/load or preview integration."
---

# Static and embedded editor

Read `public/app/core/RuntimeConfig.js`, `Capabilities.js`, `EmbeddingBridge.js`, their Vitest tests,
`scripts/build-static-bundle.ts`, and `doc/development/embedding.md`.

- Determine web, static, desktop and embedded capabilities through existing configuration. A static
  editor has no server API; do not gate features only on a URL or assume a backend exists in an iframe.
- Follow the bridge's actual message names, payloads, correlation and save/load/error handling. Keep
  host communication separate from messages originating in uploaded previews or other frames.
- Inspect actual origin/source validation and trusted-origin setup before claiming messages are authenticated.
  An empty trusted-origin list currently has permissive semantics; documentation must not claim an
  unconditional origin restriction. Treat any security-contract change as a separate implementation decision.
- Preserve explicit save state, cancellation, failed import recovery and unsaved-change warnings. A host
  request finishing is not proof the package was stored; report the actual bridge outcome.
- Keep the static resource manifest, bundles, service worker and path/base URL handling consistent.
  Do not assume a server-only fallback repairs missing static assets.
- Clean up listeners and resources when the bridge/editor is destroyed or reinitialized.

Run the core config/capability/bridge Vitest tests and the static builder's relevant specs. Exercise static
E2E plus an embedding harness for load/edit/save/cancel/failure and unwanted message sources when changing
behavior. Use `verify-change`; building the server alone does not validate the embedded distribution.
