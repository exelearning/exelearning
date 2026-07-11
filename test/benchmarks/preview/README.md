# Preview refresh benchmark

Reproducible benchmark for the eXeLearning HTTP preview transport. It quantifies
the cost of the debounced auto-refresh across two protocols:

- **v1 (manifest/blobs)**: on every change the client regenerates the whole export
  file map, SHA-256-hashes every file, POSTs a full manifest to
  `/api/preview-session/{id}/manifest`, and uploads the blobs the server reports
  missing to `/api/preview-session/{id}/blobs`.
- **v2 (assets/revisions)**: layered — project assets upload once per session
  (`/assets`), documents publish as revision **deltas** (`/revisions`), and fixed
  install resources (libs/theme) are never uploaded.

The harness auto-detects which protocol the running build speaks and labels the
byte buckets accordingly. Use it to capture a `baseline` on one build and an
`after` on another, then diff the two.

### How uploads are measured

Playwright cannot size a multipart request body, and both protocols upload
multipart. So the harness injects a `fetch` shim into the page (test code, not app
code) that measures the **exact serialized body** of every `/api/preview-session`
request. This is the real on-wire payload for both protocols.

## Run

```bash
# 1. Build the front-end bundle ONCE so the preview serves the fresh runtime.
make bundle

# 2. Run the benchmark (chromium, 1 worker, boots its own server on :3011).
bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
```

Results are written to:

- `test/benchmarks/preview/results/baseline.json` — machine-readable
- `test/benchmarks/preview/results/baseline.md` — human-readable table

### Capturing the "after" run

```bash
BENCH_OUT=after bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
```

`BENCH_OUT` sets the output basename (default `baseline`). On any non-`baseline`
run, the harness also writes `results/comparison.md` diffing that run against the
committed `results/baseline.json` (absolute + % change for refresh ms, uploaded
bytes, request count per fixture × scenario, plus the S6 outcome).

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `BENCH_OUT` | `baseline` | Output file basename. |
| `BENCH_PORT` | `3011` | Port for the throwaway server. |
| `E2E_BASE_URL` | (unset) | Point at an already-running server instead of booting one. |

The config forces `DB_PATH=:memory:` and a scratchpad `FILES_DIR`, so a
developer `.env` pointing `DB_PATH` at `/mnt/data` cannot break the run.

## Fixtures (deterministic)

Built fresh each run from fixed seeds, so baseline and after are byte-identical.

| Size | Pages | Images (~200 KiB) | Large media |
|---|--:|--:|--:|
| SMALL | 3 | 0 | — |
| MEDIUM | 25 | 10 | — |
| LARGE | 50 | 30 | 1 × 50 MiB |

- **Pages** come from a text-only `.elpx` (`fixtures.ts`) imported through the
  real browser import path — one Text iDevice per page, each with a `bench-marker`
  span the edit scenarios mutate.
- **Binary assets** are generated in-browser from a seeded PRNG and inserted via
  the app's own `AssetManager.insertImage()` (exactly like dropping a file into a
  page), then referenced from a page. They are deterministic random bytes with an
  `image/png` / `video/mp4` mime — valid for measuring transport cost (hashing +
  upload volume), not decodable media. This keeps the 50 MiB blob off the CDP
  channel and guarantees each asset is registered and referenced.

## Scenarios (median of 3 unless noted)

| ID | What it does |
|---|---|
| S1 | Initial preview open — cold session, full upload (fresh session each repeat). |
| S2 | One-word text edit on page 0 → auto-refresh. |
| S3 | Insert a new ~2 MiB image into a page → refresh. |
| S4 | Text edit right after S3 → shows the S3 image is **not** re-uploaded. |
| S5 | Rename a page (structural) → shared nav changes on every page. |
| S6 | Rapid typing + lost-update probe (see below). |

Each scenario mutates the Yjs document (the same event a real edit fires), waits
for the provider's version counter to advance (the refresh fully synced), and
attributes the preview-session requests in that window to the scenario. Timing is
wall-clock from trigger to sync completion and **includes the fixed 500 ms
debounce** (reported so it can be subtracted when comparing protocols).

### S6 — rapid typing / lost update

Two observations:

- **Burst**: 10 edits as fast as possible. The 500 ms debounce should coalesce
  them into a single refresh reflecting the final marker.
- **Overlap probe**: throttle the upload (CDP, 12 KiB/s) so the first refresh
  stays in-flight, then edit again while it is running — after the first refresh
  has already snapshotted the doc. The harness counts publish rounds via the
  provider revision counter:
  - **1 round, preview stuck on the first edit** ⇒ the second refresh was DROPPED
    (v1: `refresh()` early-returns on `this.isLoading` and nothing re-schedules) —
    a genuine lost update.
  - **≥2 rounds, preview shows the second edit** ⇒ the second refresh was
    COALESCED into a follow-up round (v2: `refresh()` sets `_pendingRefresh` and a
    `do…while` loop drains it) — the edit survives.

  The report records which happened per fixture. On the committed baseline (v1)
  the loss reproduces on all sizes; on v2 it is coalesced and the final state
  survives.

## Files

| File | Role |
|---|---|
| `playwright.bench.config.ts` | Standalone config; boots the server on :3011. |
| `preview-refresh.bench.spec.ts` | The benchmark (S1–S6 × 3 fixtures). |
| `fixtures.ts` | Deterministic text `.elpx` builder (Node side). |
| `browserAgent.ts` | In-page helpers (build assets, edit, rename, rapid edits). |
| `measure.ts` | Preview-session request capture + aggregation. |
| `report.ts` | Writes `results/<BENCH_OUT>.json` and `.md`. |
| `results/` | Output. |
