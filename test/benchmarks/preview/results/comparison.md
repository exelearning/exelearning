# Preview refresh benchmark — three-way comparison (real browser)

Generated 2026-07-26T05:01:14.690Z · 1310d1c5c · darwin arm64 · Apple M5 (10 cores) · median of 25 runs (Chromium)

Preview-generation wall-clock in the real browser (native DOM + real
resource pipeline). The Service Worker `postMessage` hand-off is
byte-identical to `main`, so it is excluded — the content policy is the
only per-refresh difference this branch introduces.

- **(a) main** — `generatePreviewForSW` with no policy (what `main` generates).
- **(b) filtered** — this branch's default web/server preview (source-aware policy).
- **(c) opaque** — this branch while custom content is enabled (report-only policy + ZIP).

**Gate:** (b) within **+5 ms** of (a) per fixture — **PASS**.
The gate is absolute, not relative: on a ~9 ms operation this harness's own
run-to-run spread reaches ~30%, so a percentage gate flaps on identical code.
Percentages below are informational; the spread columns show why.

| Fixture | Pages | (a) main | (b) filtered | Δ (b vs a) | Gate | (c) opaque | (c) snapshot upload |
|---|--:|--:|--:|--:|:--:|--:|--:|
| SMALL | 3 | 8.2 ms<br><sub>7.0–13.2 (median 8.2)</sub> | 9.2 ms<br><sub>7.5–14.9 (median 9.2)</sub> | +1.0 ms <sub>(+12.2%)</sub> | ✅ | 36.9 ms | 401.4 KiB |
| MEDIUM | 25 | 8.2 ms<br><sub>7.3–11.1 (median 8.2)</sub> | 10.0 ms<br><sub>8.4–14.4 (median 10.0)</sub> | +1.8 ms <sub>(+22.0%)</sub> | ✅ | 38.1 ms | 402.3 KiB |
| LARGE | 50 | 8.5 ms<br><sub>8.0–11.9 (median 8.5)</sub> | 10.7 ms<br><sub>9.1–15.4 (median 10.7)</sub> | +2.2 ms <sub>(+25.9%)</sub> | ✅ | 39.8 ms | 403.3 KiB |

### Reading the numbers

- **(b) vs (a)** is the cost of source-filtering the default preview, held
  within +5 ms by the gate. Measured directly, the content policy
  accounts for ~1.4 ms of it on the 50-page fixture.
- **(c)** is paid only while a user opts in. Its extra cost over (b) is the
  report-only policy plus one ZIP of the full snapshot; the upload column is
  the per-refresh POST body to the capability route. Binary media add their
  bytes to every mode equally (fixtures are text-only to isolate policy cost).
