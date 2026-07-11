# Preview refresh — baseline vs after

- Baseline: `939f93f24f70` (feat/incremental-preview-revisions), protocol ?, 2026-07-11T00:12:36.541Z
- After: `fe75c8c460b9` (fix/opaque-iframe-external-media), protocol v2, 2026-07-11T01:00:24.276Z
- Machine: darwin/arm64, 10× Apple M5

Δ% is (after − baseline) / baseline; negative = improvement. Median of 3 per cell.

## SMALL — 3 pages, 0 images

| Scenario | Refresh ms | Uploaded bytes | Requests |
|---|---|---|---|
| S1 initial preview open (cold session) | 238 → 235 (−1.3%) | 1.64 MiB → 46.9 KiB (−97%) | 3 → 2 (-1) |
| S2 text edit (one word) | 579 → 527 (−9.0%) | 21.6 KiB → 17.3 KiB (−20%) | 2 → 1 (-1) |
| S3 add a new ~2 MiB image | 608 → 586 (−3.6%) | 2.02 MiB → 2.02 MiB (−0.2%) | 2 → 2 |
| S4 text edit after adding image | 582 → 574 (−1.4%) | 22.4 KiB → 18.1 KiB (−19%) | 2 → 1 (-1) |
| S5 rename a page (structural) | 582 → 574 (−1.4%) | 48.3 KiB → 44.2 KiB (−8.4%) | 2 → 1 (-1) |

First open: 1.64 MiB → 46.9 KiB (−97%) uploaded.

**S6 lost-update**: baseline reproduced=true (shown `rev2000`), after reproduced=false (shown `rev2001`, expected `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).

## MEDIUM — 25 pages, 10 images

| Scenario | Refresh ms | Uploaded bytes | Requests |
|---|---|---|---|
| S1 initial preview open (cold session) | 225 → 227 (+0.9%) | 3.91 MiB → 2.32 MiB (−41%) | 3 → 3 |
| S2 text edit (one word) | 585 → 579 (−1.0%) | 26.6 KiB → 19.6 KiB (−26%) | 2 → 1 (-1) |
| S3 add a new ~2 MiB image | 608 → 589 (−3.1%) | 2.03 MiB → 2.02 MiB (−0.3%) | 2 → 2 |
| S4 text edit after adding image | 607 → 579 (−4.6%) | 27.5 KiB → 20.4 KiB (−26%) | 2 → 1 (-1) |
| S5 rename a page (structural) | 592 → 577 (−2.5%) | 375.0 KiB → 371.9 KiB (−0.8%) | 2 → 1 (-1) |

First open: 3.91 MiB → 2.32 MiB (−41%) uploaded.

**S6 lost-update**: baseline reproduced=true (shown `rev2000`), after reproduced=false (shown `rev2001`, expected `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).

## LARGE — 50 pages, 30 images, 50.00 MiB media

| Scenario | Refresh ms | Uploaded bytes | Requests |
|---|---|---|---|
| S1 initial preview open (cold session) | 439 → 314 (−28%) | 58.26 MiB → 56.67 MiB (−2.7%) | 3 → 3 |
| S2 text edit (one word) | 772 → 576 (−25%) | 33.4 KiB → 22.9 KiB (−31%) | 2 → 1 (-1) |
| S3 add a new ~2 MiB image | 803 → 587 (−27%) | 2.03 MiB → 2.02 MiB (−0.5%) | 2 → 2 |
| S4 text edit after adding image | 795 → 581 (−27%) | 34.4 KiB → 23.9 KiB (−31%) | 2 → 1 (-1) |
| S5 rename a page (structural) | 1211 → 579 (−52%) | 826.4 KiB → 823.9 KiB (−0.3%) | 2 → 1 (-1) |

First open: 58.26 MiB → 56.67 MiB (−2.7%) uploaded.

**S6 lost-update**: baseline reproduced=true (shown `rev2000`), after reproduced=false (shown `rev2001`, expected `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).
