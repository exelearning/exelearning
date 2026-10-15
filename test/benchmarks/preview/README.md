# Preview refresh benchmark

Reproducible three-way benchmark for the eXeLearning editor preview, built to
close the methodological gap of the earlier maximal opaque-preview work
(PR #1968), which only ever compared its intermediate branches against each
other and **never against `main`**.

This harness measures the preview-generation cost **in a real Chromium browser**
(native DOM + the real resource pipeline) under all three transport
configurations of the hybrid trust boundary:

| Config | What it is |
|---|---|
| **(a) main** | `SharedExporters.generatePreviewForSW` with **no** content policy — byte-for-byte what `main` generates (the base branch and `main` share the exporter). |
| **(b) filtered** | This branch's **default** web/server preview: the panel's `_generatePreviewFiles()` with the active-content grant off (source-aware filtering policy). |
| **(c) opaque** | This branch **while custom content is enabled**: `_generatePreviewFiles({ forOpaqueSnapshot: true })` — the report-only policy (author bytes untouched) plus one ZIP of the full snapshot. Also reports the snapshot upload size. |

### Why generation, and why the SW hand-off is excluded

A default-mode refresh is: **generate the file map** → hand it to the Service
Worker via `postMessage` → the iframe reloads from the SW cache. This branch
changes **only** the generation step (it adds the content policy); the SW
hand-off and the zero-network transport are byte-identical to `main`. So the
benchmark isolates generation — the sole differentiator — and runs it in the
real browser so the numbers reflect an actual refresh (native DOM parsing, real
theme/resource pipeline), not a micro-benchmark.

## Gate

**(b) must be within `+5 ms` of (a), per fixture.** The check is one-sided:
filtered may be arbitrarily *faster*, and up to 5 ms slower. The `expect()` in
the spec enforces it and the run fails if it is breached. Override with
`BENCH_BUDGET_MS`.

### Why the gate is absolute and not a percentage

It used to be "within 10% of (a)", and that gate did not work.

The measured quantity is ~8–10 ms. This harness's own run-to-run spread on
**identical code** reaches ~30% of that — a few hundred microseconds of GC or
scheduler jitter landing inside a 9 ms window moves the median. Measured on one
machine, back to back, same commit, 25 samples each: the 50-page fixture reported
`+12.8%`, `+16.7%` and `+15.7%` on one tree and `+5.5%`, `+24.4%`, `+9.3%` on
another — ranges that overlap almost completely. A 10% relative gate therefore
fails on code that changed nothing, and cannot distinguish that noise from a real
regression of similar size. It was reporting weather, not signal.

What matters to the user is the **absolute** cost added to a 500 ms-debounced
refresh whose SW hand-off and iframe reload are excluded from this measurement
entirely. One or two milliseconds is imperceptible. A structural regression — a
policy that turns super-linear, a per-page reparse — costs tens of milliseconds
and trips the budget immediately.

Every reported figure carries its `min–max (median)` spread so a reader can see
the variance rather than trust a bare median. For reference, the content policy
itself was measured in isolation at **~1.4 ms** for the 50-page fixture, so most
of the budget is headroom for the harness, not for the policy.

The default sample count is **25**. At the previous default of 7 the medians were
not reproducible between consecutive runs.

## Fixtures

Built fresh in-browser through the app's own structure binding
(`createBlock` / `createComponent`), so the import path is real and every run is
deterministic:

| Size | Pages | Active-content pages |
|---|--:|--:|
| SMALL | 3 | 1 |
| MEDIUM | 25 | 2 |
| LARGE | 50 | 3 |

Pages are benign text iDevices — representative of real educational content —
with a small, fixed number carrying author active content (a `<script>`, an
`on*` handler and a `javascript:` link). A project that is *mostly* active
content is exactly the one whose author opts into the opaque transport (which
has no gate), so loading the default-mode fixtures with heavy active content
would not be representative. Fixtures are text-only: binary media add identical
bytes to every mode, so they cancel out of the comparison.

## Run

```bash
# 1. Build the front-end bundle ONCE so the preview serves the fresh runtime.
make bundle

# 2. Run the benchmark (Chromium, 1 worker, boots its own server on :3012).
make bench-preview
# or directly:
bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
```

Results are written to:

- `results/comparison.md` — human-readable table (committed)
- `results/comparison.json` — machine-readable (committed)

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `BENCH_RUNS` | `25` | Median sample count per config (plus 2 warmups). Below ~25 the medians are not reproducible between runs. |
| `BENCH_BUDGET_MS` | `5` | Absolute ms (b) may cost over (a) before the gate fails. |
| `BENCH_PORT` | `3012` | Port for the throwaway server. |
| `E2E_BASE_URL` | (unset) | Point at an already-running server instead of booting one. |

The config forces `DB_PATH=:memory:` and a scratchpad `FILES_DIR`, so a
developer `.env` pointing `DB_PATH` at `/mnt/data` cannot break the run.

## Methodology notes

- Each config runs in its **own** warmed loop (2 warmups + N measured), so no
  config pays another's cold-cache/JIT penalty — interleaving the three per
  iteration biases whichever runs first, which is why an early draft showed
  filtered spuriously *faster* than main.
- The opaque snapshot upload size is the ZIP body POSTed to the capability
  route per refresh. It is reported honestly and has **no gate**: the opaque
  cost is paid only by users who opt in, only while opted in.
