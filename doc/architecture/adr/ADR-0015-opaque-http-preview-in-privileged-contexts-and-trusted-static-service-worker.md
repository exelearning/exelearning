---
id: ADR-0015
title: "Use opaque HTTP preview in privileged contexts and a trusted same-origin Service Worker in standalone static/PWA"
status: Proposed
date: 2026-07-11
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002, SDD-0003]
  adrs: [ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0011, ADR-0013]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0015: Use opaque HTTP preview in privileged contexts and a trusted same-origin Service Worker in standalone static/PWA

## Status

Proposed

This ADR refines ADR-0006 and ADR-0007. Their browser-enforced opaque-origin requirement and deterministic no-silent-downgrade rule remain in force. This record removes `srcdoc` as an authored-content transport, reduces the provider set, and defines the only permitted same-origin exception.

## Context

The editor preview renders author-controlled HTML and JavaScript. In a privileged context, same-origin preview code could reach the editor DOM, session cookies, IndexedDB, Cache API, project data, save/export operations, and Electron preload APIs.

The implementation established four constraints:

1. A Service Worker can only control same-origin clients and therefore cannot serve a sandboxed opaque-origin iframe.
2. `srcdoc` required recursive inlining, Base64 expansion, custom navigation, runtime URL interception, per-page budgets, and compatibility exceptions. It remained lower fidelity than normal URLs.
3. Server-backed runtimes can serve real capability URLs and attach a response-level `Content-Security-Policy: sandbox` to every scriptable document.
4. Standalone static/PWA has no HTTP backend. Its only practical local serving mechanism is a same-origin Service Worker.

## Decision

Use exactly two preview providers:

```text
HttpPreviewProvider
StaticServiceWorkerPreviewProvider
```

Remove `SrcdocPreviewProvider`, its inliner, its authored-content navigation protocol, and all implicit fallback chains.

### Transport matrix

| Runtime | Transport | Security posture |
|---|---|---|
| Cloud/server editor | HTTP preview v2 | opaque |
| Electron | `app://` HTTP-equivalent v2 | opaque/cross-origin from renderer |
| Moodle, WordPress, Omeka S, Nextcloud, Procomún | host HTTP preview v2 | opaque; fail closed without valid configuration |
| Standalone static build | Service Worker | same-origin trusted-content mode |
| Standalone PWA | Service Worker | same-origin trusted-content mode |
| php-wasm playground | disabled by default; explicit development-only unsafe opt-in | never presented as secure |

## Selection invariants

Transport selection is deterministic and enforced in code:

- Server mode always selects HTTP.
- Electron always selects the `app://` HTTP-equivalent transport.
- Neither server nor Electron may be downgraded to `static-service-worker` through an override.
- An embedded editor selects HTTP only when its host supplies a valid protocol-v2 `previewHttp` block.
- `previewTransport: "http"` never bypasses `previewHttp` validation in a runtime that needs host endpoints.
- An embedded editor may select `static-service-worker` only when both fields are present:

```jsonc
{
  "previewTransport": "static-service-worker",
  "allowUnsafeEmbeddedPreview": true
}
```

- The second field is a separate development authorization. The transport name alone is rejected.
- A standalone static/PWA runtime defaults to `static-service-worker`.
- Unknown or removed override values fail closed.
- No unavailable transport silently falls back to a same-origin provider.

## HTTP host contract

Embedded hosts inject two independent URL bases:

```jsonc
{
  "previewHttp": {
    "protocolVersion": 2,
    "managementBaseUrl": "...",
    "servingBaseUrl": "...",
    "managementHeaders": {},
    "managementQuery": {}
  }
}
```

Both bases must resolve to the editor document's origin. Cross-origin and protocol-relative values are rejected.

Management requests carry same-origin credentials and host CSRF material. Serving requests omit credentials and use an unguessable, expiring capability UUID.

The two URL bases are deliberately independent because host frameworks may expose authenticated APIs and public capability routes under different prefixes.

## Protocol v2

HTTP preview separates three resource layers:

1. **Fixed installation resources** — official build resources resolved through `preview-fixed-resources.json`; never uploaded per session.
2. **Session assets** — author media stored under immutable project-model keys; uploaded once per session.
3. **Generated documents** — page HTML and generated CSS/JS published as atomic incremental revisions.

A revision is activated only after all writes and metadata are durable. Readers observe revision N or N+1, never a partial mixture.

## Static/PWA security statement

> The standalone static/PWA Service Worker preview is not a security sandbox. It is intended for trusted projects. An imported ELPX containing malicious JavaScript may be able to access or modify data belonging to the editor origin.

The provider exposes `opaqueSafe = false` and the UI displays a translated, non-blocking warning the first time static/PWA preview is prepared. The warning is shown once per provider lifetime rather than on every refresh.

The stronger development-only warning remains visible when an embedded playground deliberately enables the unsafe Service Worker opt-in.

## Deployment guidance

- Prefer a dedicated origin for standalone static/PWA.
- Do not share that origin with authenticated or sensitive applications.
- Open only trusted ELPX projects in static/PWA mode.
- Do not describe the Service Worker mode as equivalent to opaque HTTP preview.
- “No login” does not eliminate risk: editor data may still exist in IndexedDB, Cache API, or local storage.

## Response isolation

Opaque HTTP preview uses an iframe without `allow-same-origin`. Every scriptable response type also receives the sandbox-first CSP, including HTML, SVG, XML, `text/xml`, and XHTML.

This response policy keeps a capability document sandboxed even when opened directly in a new tab.

Scriptable author documents fetched for download/open actions must not be converted into editor-origin blob URLs. They are downloaded as inert bytes instead.

## External media

Opaque preview cannot safely frame arbitrary external content directly. The untrusted child reports a validated maintained-provider identifier and geometry; the trusted parent reconstructs the canonical provider URL and overlays the real player within the authored-content rectangle.

Static/PWA is already same-origin trusted-content mode and renders external media directly without the opaque relay.

## Alternatives rejected

### Keep `srcdoc`

Rejected because of incomplete fidelity, Base64/memory expansion, duplicated navigation, dynamic-resource interception, and continuing maintenance cost.

### Add a second preview domain

Rejected because of DNS, certificate, deployment, and host-integration burden. The project requires same-host capability serving.

### Run a JavaScript or WebAssembly web server in the browser

Rejected because it would still require a Service Worker gateway and would not create an opaque client. It adds runtime cost without solving the browser-origin constraint.

### Sandbox individual iDevices with JavaScript compartments

Rejected as the primary boundary. Existing iDevices depend on DOM and global runtime behavior; a JavaScript membrane is not equivalent to browser-enforced origin isolation.

### Make a Service Worker control an opaque iframe

Rejected as impossible under the browser service-worker model.

## Consequences

### Positive

- One high-fidelity URL-based transport in every backend-capable context.
- A smaller provider set and substantially less preview-specific client code.
- No recursive authored-resource inliner.
- Strong isolation where credentials or privileged APIs exist.
- Honest, explicit treatment of the only same-origin mode.

### Negative

- Static/PWA cannot safely execute hostile authored JavaScript.
- php-wasm playground preview is unavailable unless explicitly enabled as unsafe development behavior.
- Host browser activation depends on a core editor build containing `HttpPreviewProvider` and the fixed-resource manifest.

## Validation

Tests must demonstrate:

- no mode selects `srcdoc`;
- embedded missing or malformed `previewHttp` fails closed;
- HTTP overrides cannot bypass endpoint validation;
- server and Electron reject Service Worker downgrade attempts;
- embedded Service Worker requires the separate unsafe authorization;
- standalone static/PWA selects Service Worker;
- static/PWA displays the trusted-content warning once;
- opaque iframe sandbox omits `allow-same-origin`;
- scriptable serving responses contain the sandbox CSP;
- the Service Worker cannot serve an opaque iframe;
- no edit is lost while a refresh is already in flight.

## Activation status

Core server and static/PWA transports are covered by the core browser suites. Electron uses the shared serving implementation and has adapter tests.

Embedding hosts may implement and test their endpoints before a compatible editor release exists. Such a host must distinguish:

```text
implemented → API-tested → browser-activated → production-released
```

Bootstrap string tests are not proof of browser activation. The final host gate is a real static-editor artifact from the target core commit driving create → assets → revision → capability iframe → incremental update → cleanup.

## Follow-up

- Publish a core editor release containing `HttpPreviewProvider`, `StaticServiceWorkerPreviewProvider`, and `bundles/preview-fixed-resources.json`.
- Run the same versioned core artifact through each host's browser integration suite.
- Measure memory and concurrent-session behavior before increasing preview byte limits.

## References

- ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0013.
- SDD-0002 and SDD-0003.
- `doc/development/preview-architecture.md`.
- `doc/development/preview-serving-contract.md`.
- PR #1968 and host PRs mod_exelearning#80, wp-exelearning#56, omeka-s-exelearning#21, nextcloud-exelearning#68, procomun#260.