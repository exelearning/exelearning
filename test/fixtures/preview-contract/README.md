# Preview serving contract v2 — conformance vectors

`vectors.json` is a machine-readable sequence of requests and expected
responses that every host implementing the
[preview serving contract v2](../../../doc/development/preview-serving-contract.md)
(Moodle, WordPress, Omeka S, Nextcloud, Procomún, Electron, eXe core) should
replay against its own endpoints. The reference consumer is
[`src/routes/preview-session.conformance.spec.ts`](../../../src/routes/preview-session.conformance.spec.ts) —
port its interpretation, not just its assertions.

## Harness semantics

1. **Fixed resources.** Before replaying, materialize every entry of
   `fixedResources` under a throwaway distribution root: write `content` to
   `path` (relative to the root) and register the id → `{ path, size }` in the
   host's copy of the fixed-resource manifest. The host must resolve fixed refs
   through that manifest only.
2. **Authentication.** Management requests (`/api/preview-session…`) run as an
   authenticated session owner (however the host authenticates). Serving
   requests (`/preview/…`) run with **no credentials**.
3. **Steps run in order** against ONE session. After `create-session`, capture
   `previewId` from the response body and substitute it for `{previewId}` in
   every later path. `constants` exists only for human reference — asset keys
   appear verbatim inside the steps.
4. **Request bodies.**
   - `body.kind === "assets"` → multipart form: field `assets` =
     `JSON.stringify(entries.map(e => ({ key: e.key, size: byteLength(e.content) })))`,
     plus one `files[]` part per entry (the UTF-8 bytes of `content`),
     index-aligned.
   - `body.kind === "revision"` → multipart form: field `revision` =
     `JSON.stringify({ ...meta, writes: writes.map(w => w.path) })`, plus one
     `files[]` part per `writes` entry (the UTF-8 bytes of `content`),
     index-aligned.
   - `request.headers` (e.g. `Range`, `If-None-Match`) are sent verbatim.
5. **Expectations.**
   - `expect.status` — exact match.
   - `expect.body` — recursive **subset** match against the parsed JSON
     response (arrays must match exactly, objects may carry extra keys).
   - `expect.bodyText` — exact match of the response body text.
   - `expect.headers` — per header (names case-insensitive): a string means
     exact value match; `{ "startsWith": s }` / `{ "contains": s }` match a
     prefix / substring; `{ "absent": true }` asserts the header is not set.
     `{previewId}` is substituted in expected header string values too (the
     bare-root redirect `Location` is `{previewId}/index.html`).
6. **Redirects.** The harness must NOT auto-follow redirects: a step expecting a
   `302` asserts the status and `Location` directly. `Location` is RELATIVE (so
   it survives `BASE_PATH` and the Electron `app://` origin); resolve it against
   the request URL only if you additionally replay the followed request.

## What the sequence proves

- protocol v2 negotiation (`protocolVersion: 2`, `revision: 0` at creation);
- asset upload + **immutability** (re-uploading a key with different bytes is
  `alreadyStored` and the original bytes keep serving);
- atomic revision publication and the three-layer resolution order;
- tiered `Cache-Control` (document `no-store` / asset `no-cache` + `ETag` /
  fixed `private, max-age=31536000` / 404 `no-store`);
- the bare capability root (`/preview/{id}`) `302`-redirects to
  `{id}/index.html` (relative Location) and never serves index.html bytes;
- conditional (`304`) and single-range asset requests with the canonical Range
  classification: satisfiable → `206`; valid-but-unsatisfiable (`bytes=99-`,
  `bytes=-0`) → `416`; and syntactically invalid / unsupported specs
  (multi-range, non-`bytes` unit, unparseable, inverted `bytes=5-2` /
  `bytes=15-2`) IGNORED → full `200` body;
- the sandbox-first CSP on every scriptable type from the session **and** the
  fixed layer (the "SVG opened in a new tab" hole);
- hardening headers on every response, 404s included;
- traversal rejection (raw and percent-encoded);
- `409 revision-conflict` with `currentRevision`, `422 missing-assets`;
- session deletion kills the capability URL.

Keep this fixture in sync with the contract document; hosts vendor it verbatim
(do not fork the JSON).
