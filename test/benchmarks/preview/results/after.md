# Preview refresh benchmark — after

- Date: 2026-07-11T01:00:24.276Z
- Git: `fe75c8c460b9` (fix/opaque-iframe-external-media)
- Machine: darwin/arm64, 10× Apple M5, 24 GiB RAM
- Node: v26.4.0

Wire protocol: **v2** (assets + revisions).

Refresh time is wall-clock from triggering the action to the preview provider completing the sync. S2–S6 are debounced edits, so their time includes the fixed 500 ms debounce; S1 is a direct click-to-open (no debounce). Uploaded bytes are the EXACT serialized request bodies, measured in-page by a fetch shim (works for the multipart uploads both protocols use). Median of the repeats.

## SMALL — 3 pages, 0 images (200.0 KiB each)

First preview open uploaded **46.9 KiB** across **4** docs+assets. JS heap after build: 29.75 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Revision | Assets | Requests | Docs+assets up |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 235 | 46.9 KiB | 46.9 KiB | 0 B | 2 | 4 |
| S2 text edit (one word) | 527 | 17.3 KiB | 17.3 KiB | 0 B | 1 | 1 |
| S3 add a new ~2 MiB image | 586 | 2.02 MiB | 17.9 KiB | 2.00 MiB | 2 | 2 |
| S4 text edit after adding image | 574 | 18.1 KiB | 18.1 KiB | 0 B | 1 | 1 |
| S5 rename a page (structural) | 574 | 44.2 KiB | 44.2 KiB | 0 B | 1 | 3 |

- **S1**: Full publish of documents + assets (v2 excludes fixed install resources); fresh session each repeat.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Asset-upload median 0.0 KiB — the 2 MiB image from S3 is NOT re-uploaded (v1 de-dups by hash; v2 uploads assets once per session).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=false, lost update reproduced=**false** (expected `rev2001`, shown `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).

## MEDIUM — 25 pages, 10 images (200.0 KiB each)

First preview open uploaded **2.32 MiB** across **36** docs+assets. JS heap after build: 37.77 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Revision | Assets | Requests | Docs+assets up |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 227 | 2.32 MiB | 374.5 KiB | 1.96 MiB | 3 | 36 |
| S2 text edit (one word) | 579 | 19.6 KiB | 19.6 KiB | 0 B | 1 | 1 |
| S3 add a new ~2 MiB image | 589 | 2.02 MiB | 20.2 KiB | 2.00 MiB | 2 | 2 |
| S4 text edit after adding image | 579 | 20.4 KiB | 20.4 KiB | 0 B | 1 | 1 |
| S5 rename a page (structural) | 577 | 371.9 KiB | 371.9 KiB | 0 B | 1 | 25 |

- **S1**: Full publish of documents + assets (v2 excludes fixed install resources); fresh session each repeat.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Asset-upload median 0.0 KiB — the 2 MiB image from S3 is NOT re-uploaded (v1 de-dups by hash; v2 uploads assets once per session).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=false, lost update reproduced=**false** (expected `rev2001`, shown `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).

## LARGE — 50 pages, 30 images (200.0 KiB each), 1 media asset 50.00 MiB

First preview open uploaded **56.67 MiB** across **82** docs+assets. JS heap after build: 82.40 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Revision | Assets | Requests | Docs+assets up |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 314 | 56.67 MiB | 826.4 KiB | 55.87 MiB | 3 | 82 |
| S2 text edit (one word) | 576 | 22.9 KiB | 22.9 KiB | 0 B | 1 | 1 |
| S3 add a new ~2 MiB image | 587 | 2.02 MiB | 23.7 KiB | 2.00 MiB | 2 | 2 |
| S4 text edit after adding image | 581 | 23.9 KiB | 23.9 KiB | 0 B | 1 | 1 |
| S5 rename a page (structural) | 579 | 823.9 KiB | 823.9 KiB | 0 B | 1 | 50 |

- **S1**: Full publish of documents + assets (v2 excludes fixed install resources); fresh session each repeat.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Asset-upload median 0.0 KiB — the 2 MiB image from S3 is NOT re-uploaded (v1 de-dups by hash; v2 uploads assets once per session).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=false, lost update reproduced=**false** (expected `rev2001`, shown `rev2001`). Upload throttled to 12 KiB/s; in-flight observed=true, publish rounds for the 2 overlapping edits=2 (syncCount=2), shown=rev2001. Second edit COALESCED into a follow-up round — final state rev2001 SURVIVED (lossless queue).
