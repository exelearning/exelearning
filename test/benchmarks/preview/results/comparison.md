# Preview refresh benchmark — three-way comparison (real browser)

Generated 2026-07-22T06:00:19.483Z · 20fcbac61 · darwin arm64 · Apple M5 (10 cores) · median of 9 runs (Chromium)

Preview-generation wall-clock in the real browser (native DOM + real
resource pipeline). The Service Worker `postMessage` hand-off is
byte-identical to `main`, so it is excluded — the content policy is the
only per-refresh difference this branch introduces.

- **(a) main** — `generatePreviewForSW` with no policy (what `main` generates).
- **(b) filtered** — this branch's default web/server preview (source-aware policy).
- **(c) opaque** — this branch while custom content is enabled (report-only policy + ZIP).

**Gate:** (b) within 10% of (a) median per fixture — **PASS**.

| Fixture | Pages | (a) main | (b) filtered | Δ (b vs a) | Gate | (c) opaque | (c) snapshot upload |
|---|--:|--:|--:|--:|:--:|--:|--:|
| SMALL | 3 | 8.4 ms | 9.0 ms | +7.1% | ✅ | 36.9 ms | 401.4 KiB |
| MEDIUM | 25 | 8.9 ms | 8.9 ms | +0.0% | ✅ | 37.7 ms | 402.3 KiB |
| LARGE | 50 | 9.6 ms | 9.7 ms | +1.0% | ✅ | 38.1 ms | 403.3 KiB |

### Reading the numbers

- **(b) vs (a)** is the cost of source-filtering the default preview, held
  within 10% by the gate.
- **(c)** is paid only while a user opts in. Its extra cost over (b) is the
  report-only policy plus one ZIP of the full snapshot; the upload column is
  the per-refresh POST body to the capability route. Binary media add their
  bytes to every mode equally (fixtures are text-only to isolate policy cost).
