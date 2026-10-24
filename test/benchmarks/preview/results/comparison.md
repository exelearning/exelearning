# Preview refresh benchmark — three-way comparison (real browser)

Generated 2026-10-24T21:20:20.219Z · b9f6e7ed6 · darwin arm64 · Apple M5 (10 cores) · median of 25 runs (Chromium)

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
| SMALL | 3 | 6.5 ms<br><sub>5.9–13.1 (median 6.5)</sub> | 7.9 ms<br><sub>6.9–13.0 (median 7.9)</sub> | +1.4 ms <sub>(+21.5%)</sub> | ✅ | 24.7 ms | 242.3 KiB |
| MEDIUM | 25 | 6.9 ms<br><sub>6.4–11.3 (median 6.9)</sub> | 9.8 ms<br><sub>8.3–16.1 (median 9.8)</sub> | +2.9 ms <sub>(+42.0%)</sub> | ✅ | 26.7 ms | 244.4 KiB |
| LARGE | 50 | 7.5 ms<br><sub>6.9–11.7 (median 7.5)</sub> | 11.9 ms<br><sub>10.4–29.5 (median 11.9)</sub> | +4.4 ms <sub>(+58.7%)</sub> | ✅ | 29.4 ms | 246.5 KiB |

### Reading the numbers

- **(b) vs (a)** is the cost of source-filtering the default preview, held
  within +5 ms by the gate. Measured directly, the content policy
  accounts for ~1.4 ms of it on the 50-page fixture.
- **(c)** is paid only while a user opts in. Its extra cost over (b) is the
  report-only policy plus one ZIP of the full snapshot; the upload column is
  the per-refresh POST body to the capability route. Binary media add their
  bytes to every mode equally (fixtures are text-only to isolate policy cost).
